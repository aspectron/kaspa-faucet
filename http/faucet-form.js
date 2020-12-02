import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetForm extends BaseElement {
	static get properties(){
		return {
			errorMessage:{type:String}
		}
	}
	static get styles(){
		return css`
			:host{display:block;max-width:500px;margin:auto}
			flow-select{margin:8px 0px;}
			.error{color:red;min-height:30px;padding:5px;box-sizing:border-box;}
			.captcha{min-height:50px;}
		`
	}

	render(){
		return html`
			<flow-input label="Address" class="address"
				placeholder="kaspatest:qq0nvlmn07f6edcdfynt4nu4l4r58rkquuvgt635ac">
			</flow-input>
			<flow-select label="Network" selected="mainnet" class="network">
				<flow-menu-item value="testnet">TESTNET</flow-menu-item>
				<flow-menu-item value="mainnet">MAINNET</flow-menu-item>
			</flow-select>
			<flow-input label="Amount" class="amount"
				placeholder="10">
			</flow-input>
			<div class="captcha">
				<slot name="captcha"></slot>
			</div>
			<div class="error">${this.errorMessage}</div>
			<flow-btn primary @click="${this.submit}">SUBMIT</flow-btn>
		`;
	}

	constructor(){
		super();
	}

	submit(){
		let qS = this.renderRoot.querySelector.bind(this.renderRoot);
		let address = qS(".address").value;
		let network = qS(".network").value;
		let amount = qS(".amount").value;
		let captcha = this.querySelector('.g-recaptcha .g-recaptcha-response')?.value;

		console.log("address, network, amount, captcha:::", {
			address, network, amount, captcha
		})

		if(!address)
			return this.setError("Please enter address");

		amount = parseFloat(amount||"", 10);
		if(isNaN(amount) || !amount || amount<1 || amount>1000)
			return this.setError("Please enter amount between 1-1000");
		//if(!captcha)
		//	return

		this.setError(false);

		app.rpc.dispatch("faucet-request", {
			address, network, amount, captcha
		},(err, result)=>{
			if(err){
				this.setError(err);
				return
			}

			this.setError(false);
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
