import '/style/style.js';
import {dpc, camelCase, html, UID, FlowApp} from '/flow/flow-ux/flow-ux.js';
export *  from './faucet-form.js';
export *  from './faucet-info.js';
export *  from './faucet-balance.js';
export *  from './faucet-transactions.js';
export *  from './kaspa-transaction.js';

class App extends FlowApp {
	constructor(){
		super();
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
}

App.define("kaspa-app");
