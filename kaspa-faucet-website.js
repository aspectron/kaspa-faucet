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


		flowHttp.on("init::app", args=>{
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

		this.rpc = { }
		this.wallets = { }
		for (const {network,port} of Object.values(Wallet.networkTypes)) {
			console.log(`Creating rpc for network '${network}' on port '${port}'`);
			const rpc = this.rpc[network] = new RPC({
				clientConfig:{
					host:"127.0.0.1:"+port
				}
			});
			console.log(`Creating wallet for network '${network}' on port '${port}'`);


			this.wallets[network] = Wallet.fromMnemonic("wasp involve attitude matter power weekend two income nephew super way focus", { network, rpc });
		}
	}

	async main() {
		//await this.initNATS();
		await this.initHttp();
		await this.initKaspa();

		const { flowHttp } = this;

		let requests = flowHttp.socket.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of requests) {
				let ts = Date.now();
				const { data, ip } = msg;
				console.log(`request[${ip}]: `, data);
				const { address, network, amount, captcha } = data;
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
					msg.respond({ amount, address, network });
					info.ts = ts;
					info.available -= amount;
				}
			}
		})();

		// setInterval(()=>{
		// 	let balance = Math.random();
		// 	console.log('posting balance update', balance);
		// 	flowHttp.socket.publish('balance', { balance })
		// }, 1000);

		for( const [network,wallet] of Object.entries(this.wallets)) {

			wallet.on("blue-score-changed", (result)=>{
				let {blueScore} = result;
				console.log("blue-score-changed: result, blueScore:", result, blueScore)
				flowHttp.socket.publish(`blue-score-${network}`, { blueScore });
			})

			wallet.on("balance-update", (detail)=>{
				console.log("wallet:balance-update", wallet.balance, detail);
				const { balance } = wallet;

				//let txlist = [];
				// added = added.values().flat();
				// removed = removed.values().flat();
				//console.log('info',added,removed)
				flowHttp.socket.publish(`balance-${network}`, { balance });
				//flowHttp.socket.publish('transactions', { added, removed });
			})

			let seq = 0;
			wallet.on("utxo-change", (detail)=>{
				console.log("wallet:utxo-change", detail);
				let {added,removed} = detail;
				//console.log("change",[...added.values()].flat(),removed);
				added = [...added.values()].flat();
				removed = [...removed.values()].flat();
				flowHttp.socket.publish(`utxo-change-${network}`, { added, removed, seq : seq++ });
			})
		}
	}
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
