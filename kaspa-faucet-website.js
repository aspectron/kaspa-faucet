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

class KaspaFaucet extends EventEmitter{
	constructor(appFolder, opt={}){
		super();
		this.opt = Object.assign({
			port:3001
		}, opt)
		this.appFolder = appFolder;
		this.config = utils.getConfig(path.join(appFolder, "config", "kaspa-faucet-website"));
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



	async main() {
		//await this.initNATS();
		await this.initHttp();

		const { flowHttp } = this;

		let request = flowHttp.socket.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of request) {
				console.log("MESSAGE: ",msg.data, "FROM IP:", msg.ip);
				msg.respond({nat:123});
			}
		})();

		setInterval(()=>{
			let balance = Math.random();
			console.log('posting balance update', balance);
			flowHttp.socket.publish('balance', { balance })
		}, 1000);
	}

}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
