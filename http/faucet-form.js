import {dpc, html, css, BaseElement, FlowFormat } from '/flow/flow-ux/flow-ux.js';
import {Decimal} from '/flow/flow-ux/extern/decimal.js';
import {KAS} from './kas.js';

export class FaucetForm extends BaseElement {
	static get properties(){
		return {
			errorMessage:{type:String},
			network : {type:String},
			networks:{type:Array},
			address:{type:String}
		}
	}
	static get styles(){
		return css`
			:host{
				display:block;
				max-width:100%;
			}
			flow-select{margin:8px 0px;}
			.error{color:red;min-height:30px;padding:16px;box-sizing:border-box;font-family:"Open Sans";font-size:16px;}
			.captcha{min-height:50px;margin-top:20px;}
			.message{margin:30px 0px;font-family:"Open Sans";font-size:16px;font-weight:normal;}
		`
	}

	constructor(){
		super();
		this.networks = [];
		this.networks = {};
		this.address = '';
		//this.network = flow.app.network;
	}

	onlineCallback() {
		const { rpc } = flow.app;
	}

	offlineCallback() {
	}


	render(){

		const { aliases } = flow.app;
		return html`
			<div class="message">Enter your address and the amount of Kaspa you want to receive:</div>
			<flow-input label="Address (Must start with '${this.network}' prefix)" class="address" x-value="${this.address}"></flow-input>
			<flow-input label="Amount (KAS)" class="amount" value=""></flow-input>
			<flow-select label="Network" selected="${this.network}" class="network"
				@select=${this.networkChange}>
				${this.networks.map(n => html`<flow-menu-item value="${n}">${aliases[n]}</flow-menu-item>`)}
			</flow-select>
			<!--
			<div class="captcha">
				<slot name="captcha"></slot>
			</div>
			-->
			<div class="error">${this.errorMessage}</div>
			<flow-btn primary @click="${this.submit}">SUBMIT</flow-btn>
		`;
	}

	submit(){

  		let qS = this.renderRoot.querySelector.bind(this.renderRoot);
		let address = qS(".address").value;
		let network = qS(".network").value;
		let amount = qS(".amount").value;
		let captcha = this.querySelector('.g-recaptcha .g-recaptcha-response')?.value;
		//let network = flow.app.network;
		//kaspatest:qq0nvlmn07f6edcdfynt4nu4l4r58rkquuvgt635ac
		console.log({ address, network, amount, captcha });

		if(!/^kaspa:[1-9A-HJ-NP-Za-km-z]/.test(address)){
			return this.setError("Invalid Address");
		}

		if(!address)
			return this.setError("Please enter address");

		amount = parseFloat(amount) || 0;
		if(!amount || amount<1e-8 || amount>100000)
			return this.setError("Please enter amount between 1-1000");
		//if(!captcha)
		//	return

		amount = Decimal(amount).mul(1e8);

		this.setError(false);

		const duration = (v) => {
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

		flow.app.rpc.request("faucet-request", {
			address, network, amount, captcha
		},(error, result)=>{
			console.log({error, result});
			if(error){
				let msg = '';
				if(error.error == 'limit') {
					let { period, available } = error;
					msg = html`Unable to send funds: you have <b>${KAS(available)}</b> KAS ${ period == null ? html`available.` : html`remaining.<br/>&nbsp;<br/>Your limit will update in ${FlowFormat.duration(period)}.` }`;
				}
				else {
					msg = error.error || error.toString();

					if(/ApiError/.test(msg)) {
						msg = html`<div class='api-error'>${[msg].map(v=>html`${v}<br/>`)}</div>`;
					}
				}

				FlowDialog.show({
					title:html`<b class="error">Error</b>`,
					body: html`
						<div class="msg">
							${ msg }
						</div>
					`,
					cls:"custom",
					btns:['Close:primary:close'],//, {text:"Ok", cls:"success", value:"ok-btn"}]
		//			btns:['Close:danger:close', {text:"Ok", cls:"success", value:"ok-btn"}]
				});
	
				return;
			}

			//this.setError(false);
			// console.log("SERVER RESPONSE:", result);
			FlowDialog.show({
				title:"Success",
				body: html`
					<div class="msg">
						We have successfully sent
						<b>${KAS(result.amount)} KAS</b> to the requested address:<br/>&nbsp;<br/>
						<b>${address}</b><br/>&nbsp;<br/>
						<span class='txid'><nobr>TXID: ${result.txid}</nobr></span>
					</div>
				`,
				cls:"custom",
				btns:['Close:primary:close'],//, {text:"Ok", cls:"success", value:"ok-btn"}]
	//			btns:['Close:danger:close', {text:"Ok", cls:"success", value:"ok-btn"}]
			});
		})
	}

	setError(err){
		if(!err){
			this.errorMessage = "";
			return
		}

		this.errorMessage = err.error||err;
	}

	onReCaptchaReady(){

	}

	networkChange({ detail : { selected:network }}) {
		//flow.app.network = network;
		this.fire("network-change", {network});
	}
}

FaucetForm.define("faucet-form",{
	"window.grecaptcha":"https://www.google.com/recaptcha/api.js?onload=OnReCaptchaLoad&render=explicit"
});
