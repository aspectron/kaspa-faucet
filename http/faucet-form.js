import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetForm extends BaseElement {
	static get properties(){
		return {
			errorMessage:{type:String},
		}
	}
	static get styles(){
		return css`
			:host{display:block;
				
			}
			flow-select{margin:8px 0px;}
			.error{color:red;min-height:30px;padding:5px;box-sizing:border-box;}
			.captcha{min-height:50px;margin-top:20px;}
			.message{margin:30px 0px;font-family:"Exo 2";font-size:16px;font-weight:bold;text-align:center;}
			
		`
	}
	
	constructor(){
		super();
	}

	onlineCallback() {
		const { rpc } = flow.app;
		console.log("I AM CONNECTED!");
	}
	
	offlineCallback() {
		console.log("I AM DISCONNECTED!");
		this.balanceUpdates.stop();
	}
	

	render(){
		
		return html`
			<div class="message">Enter your address and the amount of Kaspa you want to receive</div>
			<flow-input label="Address" class="address" value="kaspatest:123123123"></flow-input>
			<flow-input label="Amount" class="amount" value="12.99"></flow-input>
			<flow-select label="Network" selected="mainnet" class="network">
				<flow-menu-item value="kaspatest">TESTNET</flow-menu-item>
				<flow-menu-item value="kaspa">MAINNET</flow-menu-item>
				<flow-menu-item value="ksapadev">DEVNET</flow-menu-item>
				<flow-menu-item value="kaspasim">SIMNET</flow-menu-item>
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

		this.setError(false);

		app.rpc.request("faucet-request", {
			address, network, amount, captcha
		},(err, result)=>{
			if(err){
				this.setError(err);
				return
			}

			this.setError(false);
			console.log("SERVER RESPONSE:", result);
			FlowDialog.alert("Success", `We have sent ${result.amount} to ${address}.`);
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

}

FaucetForm.define("faucet-form",{
	"window.grecaptcha":"https://www.google.com/recaptcha/api.js?onload=OnReCaptchaLoad&render=explicit"
});
