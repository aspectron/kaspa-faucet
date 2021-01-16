const path = require('path');
const crypto = require('crypto');
const EventEmitter = require("events");
const FlowRouter = require('@aspectron/flow-router');
const utils = require('@aspectron/flow-utils');
require("colors");
const fs = require("fs");
const args = utils.args();
const sockjs = require('sockjs');
const session = require('express-session');
const express = require('express');
const bodyParser = require('body-parser');
const Cookie = require("cookie");
const CookieSignature = require("cookie-signature");
const { Command, CommanderError } = require('commander');
const {FlowHttp} = require('@aspectron/flow-http')({
	express,
	session,
	sockjs,
	Cookie,
	CookieSignature,
});
const Decimal = require('decimal.js');
const { Wallet, initKaspaFramework, log } = require('kaspa-wallet');
const { RPC } = require('kaspa-grpc-node');
const DAY = 1000*60*60*24;
const HOUR = 1000*60*60;
const MIN = 1000*60;

class KaspaFaucet extends EventEmitter{
	constructor(appFolder){
		super();
		this.appFolder = appFolder;
		this.config = utils.getConfig(path.join(appFolder, "config", "kaspa-faucet"));
		this.ip_limit_map = new Map();

		this.options = {
			port : 3000
		}
	}

	async initHttp(){

		const { host, port } = this.options;

		let flowHttp = new FlowHttp(__dirname, {
			config:{
				websocketMode:"RPC",
				websocketPath:"/rpc",
				http:{
					host,
					port,
					session:{
						secret:"34343546756767567657534578678672346573237436523798",
						key:"kaspa-faucet-website"
					}
				},
				staticFiles:{
					'/':'http'
				}
			}
		});
		this.flowHttp = flowHttp;

		flowHttp.on("app.init", args=>{
			let {app} = args;
			app.use(bodyParser.json())
			app.use(bodyParser.urlencoded({ extended: true }))
			
			let rootFolder = this.appFolder;

			let router = new FlowRouter(app, {
				mount:{
					flowUX:"/flow/flow-ux",
					litHtml:'/lit-html',
					litElement:'/lit-element',
					webcomponents:'/webcomponentsjs',
					sockjs:'/sockjs',
				},
				rootFolder,
				folders:[{url:'/http', folder:path.join(rootFolder, "http")}]
			});
			router.init();
		});

		flowHttp.init();
	}

	async initKaspa() {

		await initKaspaFramework();

		// support using --kaspa, --kaspatest --kaspadev --kaspasim from command line

		const aliases = Object.keys(Wallet.networkAliases);
		let filter = aliases.map((alias) => { return this.options[alias] ? Wallet.networkAliases[alias] : null; }).filter(v=>v);

		this.rpc = { }
		this.wallets = { }
		this.addresses = { }
		this.limits = { }

		// const limits_ = {
		// 	kaspa : 1000,
		// 	kaspatest : 2500,
		// }

		for (const {network,port} of Object.values(Wallet.networkTypes)) {
			if(filter.length && !filter.includes(network)) {
				log.verbose(`Skipping creation of '${network}'...`);
				continue;
			}
			// log.info(`Creating rpc for network '${network}' on port '${port}'`);
			const rpc = this.rpc[network] = new RPC({
				clientConfig:{
					host:"127.0.0.1:"+port
				}
			});
			log.info(`Creating wallet for network '${network}' on port '${port}'`);

			this.wallets[network] = Wallet.fromMnemonic("wasp involve attitude matter power weekend two income nephew super way focus", { network, rpc });
//			this.wallets[network] = Wallet.fromMnemonic("live excuse stone acquire remain later core enjoy visual advice body play", { network, rpc });
			this.addresses[network] = this.wallets[network].receiveAddress;
			this.limits[network] = this.options.limit === false ? 0 : 1000; // || limits_[network] || 1000;
			this.wallets[network].setLogLevel(log.level);
		}

		this.networks = Object.keys(this.wallets);
	}

	async initFaucet() {

		const { flowHttp } = this;

		// this.flowHttp.on('socket.connect')

		let socketConnections = flowHttp.sockets.events.subscribe('connect');
		(async()=>{
			for await(const event of socketConnections) {
				//console.log("###################################### socket connect")
				const { networks, addresses, limits } = this;
				//event.socket.write(JSON.stringify(['networks', addresses]));
				event.socket.publish('networks', { networks });
				event.socket.publish('addresses', { addresses });
				event.socket.publish('limits', { limits });
				//setTimeout(()=>{
					networks.forEach(network=>{
						let wallet = this.wallets[network];
						if(!wallet)
							return
						event.socket.publish(`balance-${network}`, {
							available : wallet.balance,
							pending : 0
						});
					})
				//}, 5000)
				// Object.entries(this.addresses).forEach(([network,address]) => {
				// 	event.socket.emit(`address-${network}`, { address })
				// })
			}
		})();


		let requests = flowHttp.sockets.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of requests) {
				const ts = Date.now();
				const period_start = ts-DAY;
				const { data, ip } = msg;
				log.verbose(`request[${ip}]: `, data);
				const { address, network, amount, captcha } = data;
				// TODO check amount
				const limit = this.limits[network] === false ? Number.MAX_SAFE_INTEGER : (this.limits[network] || 0);

				if(!this.networks.includes(network)) {
					msg.error(`Unknown network ${network}`);
					continue;
				}
				const [ prefix ] = address.split(':');
				if(prefix != network) {
					msg.error(`Incompatible address ${address} for network ${network}`);
					continue;
				}

				if(!this.wallets[network]) {
					msg.error(`Wallet interface is not active for network ${network}`);
					continue;
				}


				let user = this.ip_limit_map.get(ip);
				if(!user) {
					user = { };
					this.ip_limit_map.set(ip,user);
				}

				if(!user[network])
					user[network] = [];

				user[network] = user[network].filter(tx => tx.ts > period_start);
				const transactions = user[network];
				const spent = transactions.reduce((tx,v) => tx.amount+v, 0);
				//const available = limit - spent;
				const available = Decimal(limit).mul(1e8).sub(spent);
				if(available.lt(amount)) {
					msg.error(`Unable to send funds. ${Decimal(available).mul(1e-8).toFixed(8)} KSP remains available, ${amount} is needed.`);
					continue;
				}
				else {
					try {
						log.info(`Sending ${amount} to ${address}`);
						let response = await this.wallets[network].submitTransaction({
							toAddr: address,
							amount: amount,
							fee: 400,
						}, true);

						msg.respond({ amount, address, network, response, available });
						transactions.push({ts,amount});

					} catch(ex) {
						console.log(ex);
						msg.respond(ex);
					}
				}
			}
		})();

		for( const [network,wallet] of Object.entries(this.wallets)) {

			wallet.syncVirtualSelectedParentBlueScore()
			.catch(e=>{
				console.log(`[${network}] syncVirtualSelectedParentBlueScore Error`, e)
			})

			wallet.on("blue-score-changed", (result)=>{
				let {blueScore} = result;
				//console.log(`[${network}] blue-score-changed: result, blueScore:`, result, blueScore)
				flowHttp.sockets.publish(`blue-score-${network}`, { blueScore });
			})

			wallet.on("balance-update", (detail)=>{
				const { balance, available, pending } = detail;
				//console.log(`[${network}] wallet:balance-update`, detail);

				//let txlist = [];
				// added = added.values().flat();
				// removed = removed.values().flat();
				//console.log('info',added,removed)
				flowHttp.sockets.publish(`balance-${network}`, { available, pending });
				//flowHttp.sockets.publish('transactions', { added, removed });
			})

			let seq = 0;
			wallet.on("utxo-change", (detail)=>{
				//console.log(`[${network}] wallet:utxo-change`,'added:', detail.added.entries(), 'removed:', detail.removed.entries());
				let {added,removed} = detail;
				//console.log("change",[...added.values()].flat(),removed);
				added = [...added.values()].flat();
				removed = [...removed.values()].flat();
				flowHttp.sockets.publish(`utxo-change-${network}`, { added, removed, seq : seq++ });
			})

			/*
			//utxoSync() debug....
			wallet.addressManager.receiveAddress.next();
			wallet.addressManager.receiveAddress.next();
			wallet.addressManager.receiveAddress.next();
			setTimeout(()=>{
				wallet.addressManager.receiveAddress.next();
				wallet.addressManager.receiveAddress.next();
				wallet.addressManager.receiveAddress.next();
			}, 1000)

			/*
			await wallet.addressDiscovery(20)
		    .catch(e=>{
		        console.log("addressDiscovery:error", e)
		    })
		    */
		}
	}

	async main() {
		const logLevels = ['error','warn','info','verbose','debug'];
		const program = this.program = new Command();
		program
			.version('0.0.1', '--version')
			.description('Kaspa Wallet client')
			.helpOption('--help','display help for command')
			.option('--log <level>',`set log level ${logLevels.join(', ')}`, (level)=>{
				if(!logLevels.includes(level))
					throw new Error(`Log level must be one of: ${logLevels.join(', ')}`);
				return level;
			}) // TODO - propagate to Wallet.ts etc.
			.option('--verbose','log wallet activity')
			.option('--debug','debug wallet activity')
			.option('--testnet','use testnet network')
			.option('--devnet','use devnet network')
			.option('--simnet','use simnet network')
			.option('--host <host>','http host (default: localhost)', 'localhost')
			.option('--port <port>',`set http port (default ${this.options.port})`, (port)=>{
				port = parseInt(port);
				if(isNaN(port))
					throw new Error('Port is not a number');
				if(port < 0 || port > 0xffff)
					throw new Error('Port number is out of range');
				return port;
			})
			.option('--limit <limit>',`KSP/day limit per IP`, (limit)=>{
				limit = parseFloat(limit);
				if(isNaN(limit) || limit <= 0)
					throw new Error('KSP/day limit is invalid');
				return limit;
			})
			.option('--no-limit','disable KSP/day limit')
			;

		program.command('run', { isDefault : true })
			.description('run faucet')
			.action(async ()=>{

				let options = program.opts();
				Object.entries(options).forEach(([k,v])=>{ if(v === undefined) delete options[k]; })
				Object.assign(this.options, options);
				// console.log(this.options);
				// return;

				log.level = (this.options.verbose&&'verbose')||(this.options.debug&&'debug')||(this.options.log)||'info';

				await this.initHttp();
				await this.initKaspa();
				await this.initFaucet();
			})

		program.parse();


	}
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	try {
		await kaspaFaucet.main();
	} catch(ex) {
		console.log(ex.toString());
	}
})();
