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
		this.config = utils.getConfig(path.join(appFolder, "config", "kaspa-faucet-website"));
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
		}
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
				//event.socket.write(JSON.stringify(['networks', addresses]));
				event.socket.publish('networks', { networks : Object.keys(this.addresses) });
				event.socket.publish('addresses', { addresses : this.addresses });
				// Object.entries(this.addresses).forEach(([network,address]) => {
				// 	event.socket.emit(`address-${network}`, { address })
				// })
			}
		})().then(()=>{ });


		let requests = flowHttp.sockets.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of requests) {
				let ts = Date.now();
				const { data, ip } = msg;
				console.log(`request[${ip}]: `, data);
				const { address, network, amount, captcha } = data;

				if(!this.wallets[network]) {
					msg.error({ message : `Unable to send funds` });
					return;
				}


				let user = this.ip_limit_map.get(ip);
				if(!user) {
					user = { };
					this.ip_limit_map.set(ip,user);
				}

				if(!user[network])
					user[network] = { ts };
				let info = user[network];

				if(ts - info.ts > DAY)
					info.available = this.config.ksp_per_day_limit;
				console.log({user});
				if(info.available < amount) {

					const msec_to_reset = (info.ts + DAY - Date.now());
					console.log({msec_to_reset});
					msg.error({ error : 'limit', message : `Unable to send funds`, network, ...info, msec_to_reset });
				}
				else {
					// TODO - send transaction

					try {
						let response = await this.wallets[network].submitTransaction({
							toAddr: address,
							amount: amount,
							fee: 400,
						}, true);

						msg.respond({ amount, address, network, response });
						info.ts = ts;
						info.available -= amount;

					} catch(ex) {
						console.log(ex);
						msg.respond(ex);
					}
					// .catch(async (error)=>{
					// 	console.log("\n\nerror", error)
					// })

					// =====================
				}
			}
		})();

		// setInterval(()=>{
		// 	let balance = Math.random();
		// 	console.log('posting balance update', balance);
		// 	flowHttp.sockets.publish('balance', { balance })
		// }, 1000);

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
				console.log(`[${network}] wallet:balance-update`, wallet.balance, detail);
				const { balance } = wallet;

				//let txlist = [];
				// added = added.values().flat();
				// removed = removed.values().flat();
				//console.log('info',added,removed)
				flowHttp.sockets.publish(`balance-${network}`, { balance });
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
		}
	}
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
