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
const {FlowHttp} = require('@aspectron/flow-http')({
	express,
	session,
	sockjs,
	Cookie,
	CookieSignature,
});
const Decimal = require('decimal.js');
const { Wallet, initKaspaFramework } = require('kaspa-wallet');
const { RPC } = require('kaspa-grpc-node');
const DAY = 1000*60*60*24;
const HOUR = 1000*60*60;
const MIN = 1000*60;

class KaspaFaucet extends EventEmitter{
	constructor(appFolder, opt={}){
		super();
		this.opt = Object.assign({
			port:3001
		}, opt)
		this.appFolder = appFolder;
		this.config = utils.getConfig(path.join(appFolder, "config", "kaspa-faucet"));
		this.ip_limit_map = new Map();
	}

	async initHttp(){

		let flowHttp = new FlowHttp(__dirname, {
			config:{
				websocketMode:"RPC",
				websocketPath:"/rpc",
				http:{
					host:"localhost",
					port:3001,
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
		let networkNames = Object.keys(Wallet.networkTypes);
		const argv = process.argv.slice(2).map(v => v.replace(/^--/,''));
		console.log('argv:',argv);
		let filter = networkNames.filter(name => argv.includes(name));
		console.log("networkNames",networkNames,'filter:',filter);

		this.rpc = { }
		this.wallets = { }
		this.addresses = { }
		this.limits = { }

		const limits_ = {
			kaspa : 1000,
			kaspatest : 2500,
		}

		for (const {network,port} of Object.values(Wallet.networkTypes)) {
			if(filter.length && !filter.includes(network)) {
				console.log(`Skipping creation of '${network}'...`);
				continue;
			}
			console.log(`Creating rpc for network '${network}' on port '${port}'`);
			const rpc = this.rpc[network] = new RPC({
				clientConfig:{
					host:"127.0.0.1:"+port
				}
			});
			console.log(`Creating wallet for network '${network}' on port '${port}'`);

			this.wallets[network] = Wallet.fromMnemonic("wasp involve attitude matter power weekend two income nephew super way focus", { network, rpc });
			this.addresses[network] = this.wallets[network].receiveAddress;
			this.limits[network] = limits_[network] || 1000;
		}

		this.networks = Object.keys(this.wallets);
	}

	async main() {
		//await this.initNATS();
		await this.initHttp();
		await this.initKaspa();

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
				console.log(`request[${ip}]: `, data);
				const { address, network, amount : amount_, captcha } = data;
				// TODO check amount
				const amount = Decimal(amount_);
				const limit = Decimal(this.limits[network] || 0).mul(1e8);

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
				const spent = Decimal(0);
				transactions.forEach(tx => spent.add(tx.amount));
				const available = limit.sub(spent);
				if(available.lt(amount)) {
					msg.error(`Unable to send funds. ${available.mul(1e-8).toFixed(8)} KSP remains available.`);
					continue;
				}				
				else {
					try {
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
				console.log(`[${network}] blue-score-changed: result, blueScore:`, result, blueScore)
				flowHttp.sockets.publish(`blue-score-${network}`, { blueScore });
			})

			wallet.on("balance-update", (detail)=>{
				const { balance, available, pending } = detail;
				console.log(`[${network}] wallet:balance-update`, detail);

				//let txlist = [];
				// added = added.values().flat();
				// removed = removed.values().flat();
				//console.log('info',added,removed)
				flowHttp.sockets.publish(`balance-${network}`, { available, pending });
				//flowHttp.sockets.publish('transactions', { added, removed });
			})

			let seq = 0;
			wallet.on("utxo-change", (detail)=>{
				console.log(`[${network}] wallet:utxo-change`,'added:', detail.added.entries(), 'removed:', detail.removed.entries());
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
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
