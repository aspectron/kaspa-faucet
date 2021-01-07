const path = require('path');
const crypto = require('crypto');
const EventEmitter = require("events");
const socketio = require('socket.io');
const FlowRouter = require('@aspectron/flow-router');
const utils = require('@aspectron/flow-utils');
require("colors");
const serveStatic = require('serve-static')
const fastify = require('fastify')({ logger: false })
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

	async main() {
		//await this.initNATS();
		await this.initHttp();
	}

	async initNATS() {

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
			//this.log("init::app", app.options)

			
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


		// fastify.use('/', serveStatic(path.join(this.appFolder, '/http')))

		// const start = async () => {
		// 	try {
		// 		await fastify.listen(this.opt.port)
		// 		fastify.log.info(`server listening on ${fastify.server.address().port}`)
		// 	} catch (err) {
		// 		fastify.log.error(err)
		// 		process.exit(1)
		// 	}
		// }
		// start()



		let request = flowHttp.socket.subscribe("faucet-request");
		(async ()=>{
			for await(const msg of request) {
				console.log("MESSAGE: ",msg.data);
				msg.respond({nat:123});
			}
		})();


	}
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
