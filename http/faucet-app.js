import '/style/style.js';
import {dpc, camelCase, html, UID, FlowApp, FlowFormat } from '/flow/flow-ux/flow-ux.js';
export *  from './faucet-form.js';
export *  from './faucet-info.js';
export *  from './faucet-balance.js';
export *  from './faucet-transactions.js';
export *  from './kaspa-transaction.js';

class KaspaFaucetApp extends FlowApp {


	static get properties(){
		return {
			network:{type:String},
			networks:{type:Array},
			address:{type:String},
			addresses:{type:Array},
			limit:{type:Number},
			limits:{type:Array}
		}
	}
	constructor(){
		super();

		this.networks = ['kaspa','kaspatest','kaspadev','kaspasim'];
		this.network = "kaspatest";
		// window.app = this;
		//this.initSiteConfig(config)
		this.opt = {

		}


		this.aliases = {
			kaspa : 'MAINNET',
			kaspatest : 'TESTNET',
			kaspadev : 'DEVNET',
			kaspasim : 'SIMNET'
		}		

		this.initLog();
		dpc(async ()=>this.init());
		this.registerListener("popstate", (e)=>{
			let {menu="home", args=[]} = e.state||{};
			console.log(`popstate: ${document.location}, state: ${JSON.stringify(e.state)}`)
			this.setMenu(menu, args, true);
		});
	}



	async init(){
		await this.initSockjsRPC({
			// args:{
			// 	transports:["websocket"]
			// }
		});
		//await this.initSocketIONATS();
		await this.initUI();
		dpc(()=>this.setLoading(false));
	}

	async initUI(){
		this.bodyEl = document.body;
		//this.initTabs();
	}
	initTabs(){
		/*
		this.menuEl = document.querySelector("#left-menu");
		this.menuEl.addEventListener("click", e=>{
			let el = e.target.closest("[data-menu]");
			if(!el 
				|| el.classList.contains("active")
				|| el.classList.contains("disabled"))
				return

			this.setMenu(el.getAttribute("data-menu"));
		});

		this.initialUrlState = this.getStateFromUrl();
		*/
	}

	handleWorkspaceMenu(menu, el){
		let fn = camelCase(`on-${menu}-click`);
		if(this[fn])
			this[fn](el);
	}

	getStateFromUrl(){
		//TODO 
		//let args, menu = window.location.hash.replace("#", "");
		let paths = window.location.pathname.replace(/^\/{1,}|\/{1,}$/g, "").split("/");
		///[menu, ...args] = menu.split(":")
		let menu = paths.shift() || "home";
		let args = paths;
		console.log("getStateFromUrl", menu, args)
		return {menu, args, paths};
	}
	updateUrlState(data, title, url){
		if(!url)
			url = `/${data.menu}/${data.args.join("/")}`;
		if(title){
			title = camelCase(data.menu);
			title = title[0].toUpperCase()+title.substring(1);
		}

		history.replaceState(data, title, url);
	}

	setMenu(menu, args=[], skipHistory=false){
		this.fire("before-menu-change", {menu, args, app:this}, {}, window);
		this.log("menu", menu)
		this.activateMenu(menu, args, skipHistory)
	}
	activateMenu(menu, args=[], skipHistory=false){
		//window.location.hash = `${menu}${args.length?':'+args.join(":"):''}`;
		if(!skipHistory){
			let url = `/${menu}${args.length?'/'+args.join("/"):''}`;
			history.pushState({menu, args}, menu, url);
		}

		document.querySelectorAll(".left-area .menu li, .tab-content, [for][slot='header']").forEach(el=>{
			let m = el.getAttribute("data-menu") || el.getAttribute("for");
			if(el.classList.contains("active")){
				if(m == menu)
					return
				el.classList.remove("active")
			}
			if(m == menu){
				el.classList.add("active")
				el.handleUrlArgs?.(args);
			}
		})
	}

	initUrlState(){
		dpc(200, ()=>{
			let {menu, args} = this.initialUrlState || this.getStateFromUrl();
			let component = document.querySelector(`.menu-handler[for='${menu}'],.tab-content[for='${menu}']`);
			//console.log("component", component.constructor)
			if(!component || !component.handleUrl){
				this.setMenu(menu, args||[]);
			}else{
				component.handleUrl(menu, args||[], this);
			}
		})
	}

	signoutCallback(){
		super.signoutCallback?.();
		this.setMenu("home")
	}

	formatKSP(v, noTrailingZeros) {
		return FlowFormat.crypto(v, { noTrailingZeros });
	}

	onlineCallback() {
		const { rpc } = flow.app;
		this.networkUpdates = rpc.subscribe(`networks`);
		(async()=>{
			for await(const msg of this.networkUpdates) {
				const { networks } = msg.data;
				this.networks = networks;
				console.log("available networks:", networks);
				this.requestUpdate();
			}
		})().then();

		this.addressUpdates = rpc.subscribe(`addresses`);
		(async()=>{
			for await(const msg of this.addressUpdates) {
                const { addresses } = msg.data;
                this.addresses = addresses;
                this.requestUpdate();
				// this.networks = networks;
				// console.log("available networks:",networks);
			}
		})().then();

		this.limitUpdates = rpc.subscribe(`limits`);
		(async()=>{
			for await(const msg of this.limitUpdates) {
                this.limits = msg.data.limits;
			}
		})().then();
	}

	offlineCallback() {
		this.networkUpdates.stop();
		this.addressUpdates.stop();
		this.limitUpdates.stop();
	}

	
	render(){
		let network = this.network;
		let address = this.addresses?.[this.network] || '';
		let limit = this.limits?.[this.network] || '';
		return html`
		<flow-app-layout no-drawer no-header>
			<!--flow-app-drawer slot="drawer" class="left-area">
			<ul class="menu" id="left-menu">
				<li data-menu="home" class="active" title="Home">
					<fa-icon icon="fal:home"></fa-icon>
					<span class="text">Home</span>
				</li>
			</ul>
		</flow-app-drawer-->
		<div slot="main" class="main-area flex sbar" col>
			<div for="home" row class="content">
				<div col class="balance-wrapper">
					<faucet-balance network="${network}"></faucet-balance>
					<faucet-transactions network="${network}"></faucet-transactions>
				</div>
				<div col class='form-wrapper'>
					<faucet-info limit="${limit}" address="${address}"></faucet-info>
					<faucet-form network="${network}" .networks="${this.networks}" address="${address}" @network-change="${this.onNetworkChange}">
						<div slot="captcha" class="g-recaptcha" 
							data-sitekey="6LeGJSoTAAAAAKtLbjbdiIQTFK9tYLqyRx0Td-MA"></div>
					</faucet-form>
				</div>
			</div>
		</div>
		</flow-app-layout>
		`
	}

	onNetworkChange(e){
		console.log("on-network-change", e.detail)
		this.network = e.detail.network;
	}

}

KaspaFaucetApp.define("kaspa-faucet-app");
