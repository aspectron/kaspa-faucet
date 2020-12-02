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

class KaspaFaucet extends EventEmitter{
	constructor(appFolder, opt={}){
		super();
		this.opt = Object.assign({
			port:3000
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

		await fastify.register(require('middie'));
		await fastify.register(require('@aspectron/flow-fastify-socket-io'), {path:"/rpc"});

		fastify.io.on("faucet-request", async (args, callback)=>{
			console.log("fauset-request:args", args)
			let {captcha="xxx"} = args;
			let {error, result} = await utils.validateCaptcha({
				captcha, secret:this.config.captcha.secret
			})
			console.log("captcha:err, result", error, result)
			if(!result.success)
				return callback(error)

			callback({error:"TODO: at server"})

		})



		//fastify.get('/hello', async (request, reply) => {
		//	return { hello: 'world' }
		//})

		let flowRouter = new FlowRouter(fastify, {
			rootFolder:this.appFolder,
			mount:{
				flowUX:"/flow/flow-ux",
				litHtml:'/lit-html',
				litElement:'/lit-element',
				webcomponents:'/webcomponentsjs'
			},
			folders:[
				//{url:'/abc', folder:'/node_modules/xyz'}
			]
		})

		flowRouter.init();

		fastify.use('/', serveStatic(path.join(this.appFolder, '/http')))

		const start = async () => {
			try {
				await fastify.listen(this.opt.port)
				fastify.log.info(`server listening on ${fastify.server.address().port}`)
			} catch (err) {
				fastify.log.error(err)
				process.exit(1)
			}
		}
		start()
	}
}

(async () => {
	let kaspaFaucet = new KaspaFaucet(__dirname);
	kaspaFaucet.main();
})();
