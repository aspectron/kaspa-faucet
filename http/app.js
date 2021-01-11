import '/style/style.js';
import {dpc, camelCase, html, UID, FlowApp, FlowFormat } from '/flow/flow-ux/flow-ux.js';
export *  from './faucet-form.js';
export *  from './faucet-info.js';
export *  from './faucet-balance.js';
export *  from './faucet-transactions.js';
export *  from './kaspa-transaction.js';

class App extends FlowApp {


	static get properties(){
		return {
			network:{type:String}
		}
	}
	constructor(){
		super();

		this.network = "kaspatest";
		// window.app = this;
		//this.initSiteConfig(config)
		this.opt = {

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

	formatKSP(v) {
		return FlowFormat.crypto(v, { noTrailingZeros : true });
	}

	onlineCallback() {
		const { rpc } = flow.app;
		this.networkUpdates = rpc.subscribe(`networks`);
		(async()=>{
			for await(const msg of this.networkUpdates) {
				const { networks } = msg.data;
				this.networks = networks;
				// console.log({networks});
			}
		})().then(()=>{
		});
	}

	offlineCallback() {
		this.networkUpdates.stop();
	}

/*	
	render(){
		return html`
		<div class="header"><slot name="logo"></slot><slot name="header"></slot></div>
		<div class="header header-sm"><fa-icon class="menu-icon"
			icon="${this['menu-icon'] || 'bars'}" 
			@click="${this.toggleFloatingDrawer}"></fa-icon><slot 
			name="header-sm"></slot></div>
		<div class="body">
			<div class="drawer sbar">
			<div class="drawer-top">
				<fa-icon class="drawer-close-icon"
				icon="${this['drawer-close-icon'] || 'times'}" 
				@click="${this.toggleFloatingDrawer}"></fa-icon>
			</div>
			<slot name="drawer"></slot></div>
			<div class="main sbar">
				<div class="wrapper">
					${this.content()}<div 
					class="main-mask" @click="${this.toggleFloatingDrawer}"></div>
				</div>
				<div class="footer">
					<slot name="footer"></slot>
				</div>
			</div>
		</div>
		`
	}

	content() {
		return html`
		
		<div slot="main" class="main-area flex sbar" col>
			<div for="home" row class="content">
				<div col class="balance-wrapper">
					
					<faucet-balance network="kaspatest"></faucet-balance>
					<faucet-transactions network="kaspatest"></faucet-transactions>
				</div>
				<div col class='form-wrapper'>
					<faucet-info></faucet-info>
					<faucet-form network="kaspatest">
						<div slot="captcha" class="g-recaptcha" 
							data-sitekey="6LeGJSoTAAAAAKtLbjbdiIQTFK9tYLqyRx0Td-MA"></div>
					</faucet-form>
				</div>
			</div>
			<div for="home" row class="content">
				<!-- div class="logo-col"><img src="/images/logo/logo-bright.png" xclass="logo" /></div -->
				<div col class="balance-wrapper">
					
					<faucet-balance network="kaspa"></faucet-balance>
					<faucet-transactions network="kaspa"></faucet-transactions>
				</div>
				<div col class='form-wrapper'>
					<faucet-info></faucet-info>
					<faucet-form network="kaspa">
						<div slot="captcha" class="g-recaptcha" 
							data-sitekey="6LeGJSoTAAAAAKtLbjbdiIQTFK9tYLqyRx0Td-MA"></div>
					</faucet-form>
				</div>
			</div>
			
		</div>		
		
		
		`;
	}
*/

}

App.define("kaspa-app");
