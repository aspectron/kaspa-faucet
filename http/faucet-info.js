import {dpc, html, css, BaseElement, FlowFormat} from '/flow/flow-ux/flow-ux.js';
import { KSP } from './ksp.js'

export class FaucetInfo extends BaseElement {
	static get properties(){
		return {
            limit:{type:Number},
            available:{type:Number},
            address:{type:String}
		}
	}
	static get styles(){
		return css`
            :host{display:block; font-family: "Open Sans"; }
            .caption { font-size: 22px; }
            .info-content {font-size:16px;}
		`
    }
    
    constructor() {
        super();
        this.limit = 0;
        this.available = 0;
        this.address = '';
    }

	render(){
        return html`
            <div class="info">
                <div class="caption">Welcome to Kaspa Faucet</div>
                <div class="info-content">
                    <p>Kaspa Faucet sends Kaspa to anyone requesting.</p>
                    <p>It has a defined address, where you can send or mine Kaspa.
                    If the faucet address has enough Kaspa, it will send it to an address you provide. </p>
                    <p>Faucet can receive funds at the following address:</p>
                    <p><b>${this.address}</b></p>
                    <p>Requests are limited to the maximum of <b>${KSP(this.limit)} KSP</b> per IP address, per <b>24 hours</b>.</p>
                    <p>You currently have <b>${KSP(this.available)} KSP</b> ${this.limit==this.available?'available':'remaining'}.</p>
                </div>
            </div>
		`;
	}

}

FaucetInfo.define("faucet-info");
