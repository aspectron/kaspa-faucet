const path = require('path');
const crypto = require('crypto');
const EventEmitter = require("events");
const FlowRouter = require('@aspectron/flow-router');
const utils = require('@aspectron/flow-utils');
//require("colors");
const fs = require("fs");
const args = utils.args();
const sockjs = require('sockjs');
const session = require('express-session');
const express = require('express');
const bodyParser = require('body-parser');
const Cookie = require("cookie");
const CookieSignature = require("cookie-signature");
const { Command, CommanderError } = require('commander');
const ws = require('ws');
const {FlowHttp} = require('@aspectron/flow-http')({
	express,
	session,
	//sockjs,
	ws,
	Cookie,
	CookieSignature,
});
const Decimal = require('decimal.js');
const { Wallet, initKaspaFramework, log } = require('@kaspa/wallet-worker');
Wallet.setWorkerLogLevel("none");

const { RPC } = require('@kaspa/grpc-node');
const DAY = 1000*60*60*24;
const HOUR = 1000*60*60;
const MIN = 1000*60;

class KaspaFaucet extends EventEmitter{
	constructor(appFolder){
		super();
		this.appFolder = appFolder;
		this.config = utils.getConfig(path.join(appFolder, "config", "kaspa-faucet"));
		if(!this.config.apikeys)
			log.error('missing config.apikeys configuration');
		this.ip_limit_map = new Map();
		this.cache = { };

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

/*
	openWallet() {
		return new Promise(async (resolve, reject) => {
			let walletMeta = await storage.getWallet();
			if(!walletMeta || !walletMeta.wallet?.mnemonic){
				return reject("Please create wallet")
			}

			if(walletMeta.encryption=='none'){
				const { network, rpc } = this;
				let wallet = Wallet.fromMnemonic(walletMeta.wallet.mnemonic, { network, rpc });
				return resolve(wallet);
			}

			//this.decryptWallet(walletMeta.wallet.mnemonic).then(resolve, reject);
			console.log('Wallet must not be encrypted');
		})
	}
*/
	async initKaspa() {

		await initKaspaFramework();

		const aliases = Object.keys(Wallet.networkAliases);
		let filter = aliases.map((alias) => { return this.options[alias] ? Wallet.networkAliases[alias] : null; }).filter(v=>v);

		this.rpc = { }
		this.wallets = { }
		this.addresses = { }
		this.limits = { }

		if(this.options.rpc && filter.length != 1) {
			log.error('You must explicitly use the network flag when specifying the RPC option');
			log.error('Option required: --mainnet, --testnet, --devnet, --simnet')
			process.exit(1);
		}

		const seeds = fs.readFileSync(".seeds")+"";
		for (const {network,port} of Object.values(Wallet.networkTypes)) {
			if(filter.length && !filter.includes(network)) {
				log.verbose(`Skipping creation of '${network}'...`);
				continue;
			}

			const host = this.options.rpc || `127.0.0.1:${port}`;
			log.info(`Creating gRPC binding for network '${network}' at ${host}`);
			const rpc = this.rpc[network] = new RPC({ clientConfig:{ host } });
			rpc.onError((error)=>{ log.error(`gRPC[${host}] ${error}`); })
			
			this.wallets[network] = Wallet.fromMnemonic(
				seeds,
				// "wasp involve attitude matter power weekend two income nephew super way focus",
				//"divert crucial husband artist country twice twenty radar gesture gather engage library",
				{ network, rpc },
				{disableAddressDerivation:true}
			);
			this.wallets[network].checkGRPCFlags();

			// if(1) {
			// 	this.wallets[network] = Wallet.fromMnemonic(
			// 		"wasp involve attitude matter power weekend two income nephew super way focus",
			// 		{ network, rpc },
			// 		{disableAddressDerivation:true}
			// 	);
			// } else {
			// 	this.wallets[network] = Wallet.fromMnemonic(
			// 		"live excuse stone acquire remain later core enjoy visual advice body play",
			// 		{ network, rpc },
			// 		{disableAddressDerivation:true}
			// 	);
			// }
			this.addresses[network] = await this.wallets[network].receiveAddress;
			this.limits[network] = this.options.limit === false ? Number.MAX_SAFE_INTEGER : Decimal(this.options.limit || 1000).mul(1e8).toNumber(); // || limits_[network] || 1000;
			this.wallets[network].setLogLevel(log.level);

			log.info(`${Wallet.networkTypes[network].name} address - ${this.addresses[network]}`);
		}

		this.networks = Object.keys(this.wallets);
	}

	calculateAvailable({ network, ip }) {
		if(this.limits[network] == Number.MAX_SAFE_INTEGER)
			return Number.MAX_SAFE_INTEGER;

		let user = this.ip_limit_map.get(ip);
		if(!user) {
			user = { };
			this.ip_limit_map.set(ip,user);
		}

		if(!user[network])
			user[network] = [];

		const ts = Date.now();
		const period_start = ts-DAY;
		const transactions = user[network] = user[network].filter(tx => tx.ts > period_start);
		const spent = transactions.reduce((v, tx) => tx.amount+v, 0);
		const available = this.limits[network] - spent;
		const period = transactions.length ? transactions[0].ts - period_start : null;
		return { available, period };
	}

	updateLimit({ network, ip, amount }) {
		if(this.limits[network] == Number.MAX_SAFE_INTEGER)
			return;
		this.ip_limit_map.get(ip)[network].push({ ts : Date.now(), amount });
	}

	publishLimit({ network, socket, ip }) {
		const limit = this.limits[network];
		const { available } = this.calculateAvailable({ network, ip });
		socket.publish(`limit`, { network, available, limit });
	}

	async initFaucet() {
		const { flowHttp } = this;
		let socketConnections = flowHttp.sockets.events.subscribe('connect');
		(async()=>{
			for await(const event of socketConnections) {
				const { networks, addresses, limits } = this;
				const { socket, ip } = event;
				socket.publish('networks', { networks });
				socket.publish('addresses', { addresses });
				networks.forEach(network=>{
					let wallet = this.wallets[network];
					
					if(!wallet)
						return;
					const { balance } = wallet;
					//setTimeout(()=>{
						socket.publish(`balance`, { network, balance });
						//console.log("wallet balance",  balance)
					//}, 50);
					this.publishLimit({ network, socket, ip });

					let cache = this.cache[network];
					if(cache && cache.length) {
						cache.forEach((msg) => {
							socket.publish(`utxo-change`, msg);
						})
					}

				});
			}
		})();

		let configRequests = flowHttp.sockets.subscribe("get-config");
		(async ()=>{
			let {key:captchaKey} = this.config.captcha;
			for await(const msg of configRequests) {
				//const { data, ip, socket } = msg;
				msg.respond({ captchaKey })
			}
		})();

		let requests = flowHttp.sockets.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of requests) {
				const { data, ip, socket } = msg;
				const { address, network, amount : amount_, captcha } = data;
				let captchaRes = {};
				captchaRes = await utils.validateCaptcha({captcha, secret: this.config.captcha.secret})
				.catch(err=>{
					console.log("validateCaptcha:err", err)
					if(!captchaRes)
						captchaRes = {}
					captchaRes.error = {error:"Captcha validation failure"};
					captchaRes.result = {success:false};
				});

				//console.log("validateCaptcha:", captchaRes)

				if(!captchaRes?.result.success){
					msg.error(captchaRes?.error.error || "Captcha validation failure");
					continue;
				}

				const amount = parseInt(amount_);
				if(isNaN(amount) || !amount || amount < 0) {
					msg.error(`Invalid amount: ${amount_}`);
					continue;
				}
				log.info(`request from ${ip} for ${Wallet.KAS(amount)}`);
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

				let { available, period } = this.calculateAvailable({ network, ip });
				if(available < amount) {
					msg.error({ error: 'limit', available, period });
					continue;
				}
				else {
					try {
						const fee = 0;
						let response = await this.wallets[network].submitTransaction({
							toAddr: address,
							amount, fee,
							networkFeeMax : 1e8,
							calculateNetworkFee:true,
							changeAddrOverride: this.addresses[network]
						});

						const txid = response?.txid || null;
						({ available, period } = this.calculateAvailable({ network, ip }));
						msg.respond({ amount, address, network, txid, available });
						this.updateLimit({ network, ip, amount });
						this.publishLimit({ network, socket, ip });
					} catch(ex) {
						console.log(ex);
						msg.respond(ex);
					}
				}
			}
		})();

		const getIp = (req) => {
			return req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-client-ip'];
		}

		const getAvailable = async ({network, ip})=>{
			
			if(!network || !/^kaspa(test|dev|sim)*/.test(network))
				return { error : `Unknown network: ${network}` };

			network = network.split(':').shift();
			if(!this.networks.includes(network))
				return { error : `Unknown network: ${network}` };

			let { available, period } = this.calculateAvailable({ network, ip });
			return {available, period};
		}

		const getKaspa = async ({address, amount:amount_, ip})=>{
			const amount = parseInt(amount_);
			if(isNaN(amount) || !amount || amount < 0)
				return { error : `Invalid amount: ${amount_}` };
			
			if(!address || !/^kaspa(test|dev|sim)*:/.test(address))
				return { error : `Invalid address: ${address}` };

			let network = address.split(':').shift();
			if(!this.networks.includes(network))
				return { error : `Unknown network: ${network}` };

			if(!this.wallets[network])
				return { error : `Wallet interface is not active for network ${network}`};

			let { available, period } = this.calculateAvailable({ network, ip });
			if(available < amount) {
				return { error : `Unable to send funds: you have ${this.KAS(available)} KAS ${ period == null ? `available.` : `remaining. Your limit will update in ${this.duration(period)}.` }`};
			}
			else {
				try {
					const fee = 0;
					let response = await this.wallets[network].submitTransaction({
						toAddr: address,
						amount, fee,
						networkFeeMax : 1e8,
						calculateNetworkFee:true,
						changeAddrOverride: this.addresses[network]
					});

					//available -= amount+fee;
					const txid = response?.txid || null;
					this.updateLimit({ network, ip, amount });
					({ available, period } = this.calculateAvailable({ network, ip }));
					return { success : true, amount, address, network, txid, available, period };
				} catch(ex) {
					console.log(ex);
					return {error: 'Internal faucet failure', info : ex.toString()};
				}
			}
		}

		/*
		this.flowHttp.app.get("/api/:apikey/available/:network", async (req,res) => {
			if(!req.params.apikey || !this.config.apikeys.includes(req.params.apikey))
				return res.json({ error : "invalid api key"});
			const network = req.params.network;
			const ip = req.query.ip;
			res.json(await getAvailable({network, ip}))
		});

		this.flowHttp.app.get("/api/:apikey/get/:address", async (req,res) => {
			if(!req.params.apikey || !this.config.apikeys.includes(req.params.apikey))
				return res.json({ error : "invalid api key"});

			const amount = req.query.amount;
			const address = req.params.address;
			const ip = req.query.ip;
			res.json(await getKaspa({address, amount, ip}))
		});
		*/

		/*
		this.flowHttp.app.get("/api/available/:network", async (req,res) => {
			const network = req.params.network;
			const ip = getIp(req);
			res.json(await getAvailable({network, ip}))
		});

		this.flowHttp.app.get("/api/get/:address/:amount", async (req,res) => {
			const address = req.params.address;
			const amount = req.params.amount;
			const ip = getIp(req);
			res.json(await getKaspa({address, amount, ip}))
		});
		*/

		for( const [network,wallet] of Object.entries(this.wallets)) {

			wallet.sync()
			.catch(e=>{
				console.log(`[${network}] syncVirtualSelectedParentBlueScore Error`, e)
			})

			wallet.on("ready", (result)=>{
				log.info(`ready (${network})`);
				flowHttp.sockets.publish(`wallet-ready`, { network });
			});

			wallet.on("api-online", (result)=>{
				log.info(`${network} - gRPC API is online`);
				flowHttp.sockets.publish(`wallet-online`, { network });
			});

			wallet.on("api-offline", (result)=>{
				log.info(`${network} - gRPC API is offline`);
				flowHttp.sockets.publish(`wallet-offline`, { network });
			});

			wallet.on("sync-start", (result)=>{
				flowHttp.sockets.publish(`sync-start`, { network });
			});

			wallet.on("sync-finish", (result)=>{
				flowHttp.sockets.publish(`sync-finish`, { network });
			});

			wallet.on("blue-score-changed", (result)=>{
				let {blueScore} = result;
				//console.log(`[${network}] blue-score-changed: result, blueScore:`, result, blueScore)
				flowHttp.sockets.publish(`blue-score`, { blueScore, network });
			})

			wallet.on("balance-update", (detail)=>{
				const { balance, available, pending } = detail;
				flowHttp.sockets.publish(`balance`, { network, balance : { available, pending } });
			})

			let seq = 0;
			this.cache[network] = [];
			wallet.on("utxo-change", (detail)=>{
				let {added,removed} = detail;
				added = [...added.values()].flat();
				removed = [...removed.values()].flat();
				flowHttp.sockets.publish(`utxo-change`, { network, added, removed, seq : seq++ });
				this.cache[network].push({ network, added, removed, seq });
				while(this.cache[network].length > 24)
					this.cache[network].shift();
			})
		}
	}


	duration(v) {
		let hrs = Math.floor(v/1000/60/60);
		let min = Math.floor(v/1000/60%60);
		let sec = Math.floor(v/1000%60);
		if(!hrs && !min && !sec)
			v;
			//return this.commas(v);
		let t = '';
		if(hrs) t += (hrs < 10 ? '0'+hrs : hrs) + ' h ';
		if(hrs || min) t += (min < 10 ? '0'+min : min) + ' m ';
		if(hrs || min || sec) t += (sec < 10 ? '0'+sec : sec) + ' s ';
		return t;
	}

	async main() {
		const logLevels = ['error','warn','info','verbose','debug'];
		const program = this.program = new Command();
		program
			.version('0.0.1', '--version')
			.description('Kaspa Faucet')
			.helpOption('--help','display help for command')
			.option('--log <level>',`set log level ${logLevels.join(', ')}`, (level)=>{
				if(!logLevels.includes(level))
					throw new Error(`Log level must be one of: ${logLevels.join(', ')}`);
				return level;
			})
			.option('--verbose','log wallet activity')
			.option('--debug','debug wallet activity')
			.option('--mainnet','use mainnet network')
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
			.option('--limit <limit>',`KAS/day limit per IP`, (limit)=>{
				limit = parseFloat(limit);
				if(isNaN(limit) || limit <= 0)
					throw new Error('KAS/day limit is invalid');
				return limit;
			})
			.option('--no-limit','disable KAS/day limit')
            .option('--rpc <address>','use custom RPC address <host:port>')
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

	KAS(v) {
		var [int,frac] = Decimal(v).mul(1e-8).toFixed(8).split('.');
		int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		frac = frac?.replace(/0+$/,'');
		return frac ? `${int}.${frac}` : int;
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
