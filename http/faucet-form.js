import {dpc, html, css, BaseElement, FlowFormat } from '/flow/flow-ux/flow-ux.js';
import {Decimal} from '/flow/flow-ux/extern/decimal.js';

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
			:host{display:block;
				
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
			<flow-input label="Address (Must start with '${this.network}' prfix)" class="address" value="${this.address}"></flow-input>
			<flow-input label="Amount" class="amount" value="12.99"></flow-input>
			<flow-select label="Network" selected="${this.network}" class="network"
				@select=${this.networkChange}>
				${this.networks.map(n => html`<flow-menu-item value="${n}">${aliases[n]}</flow-menu-item>`)}
			</flow-select>
			<div class="captcha">
				<slot name="captcha"></slot>
			</div>
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

		if(!/^kaspa(test|main|dev):[1-9A-HJ-NP-Za-km-z]/.test(address)){
			return this.setError("Invalid Address");
		}

		if(!address)
			return this.setError("Please enter address");

		amount = parseFloat(amount) || 0;
		if(!amount || amount<1 || amount>1000)
			return this.setError("Please enter amount between 1-1000");
		//if(!captcha)
		//	return

		amount = Decimal(amount).mul(1e8);

		this.setError(false);

		flow.app.rpc.request("faucet-request", {
			address, network, amount, captcha
		},(err, result)=>{
			console.log({err, result});
			if(err){
				if(err.error == 'limit') {
					let { msec_to_reset, available } = err;
					this.setError(`Unable to send funds: you have ${flow.app.formatKSP(available)} remaining. Your limit will be reset in ${FlowFormat.duration(msec_to_reset)}.`);
				}
				else {
					this.setError(err.toString());
				}
				return;
			}

			this.setError(false);
			console.log("SERVER RESPONSE:", result);

			/*
			FlowDialog.show({
				body: html`
					<div>
					We have successfully sent <b>${Decimal(result.amount).mul(1e-8)}</b> to <b>${address}</b>.
					</div>
                    <flow-btn slot="buttons" @click="${close}">Close</flow-btn>
				`
			});
			*/
			FlowDialog.alert(`Success`, html`We have successfully sent <b>${Decimal(result.amount).mul(1e-8)}</b> to <b>${address}</b>.`);
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
