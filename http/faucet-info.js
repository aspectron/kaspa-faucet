import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetInfo extends BaseElement {
	static get properties(){
		return {
			limit:{type:Number}
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
    }

	render(){
        return html`
            <div class="info">
                <div class="caption">Welcome to Kaspa Faucet</div>
                <div class="info-content">
                    <p>Kaspa Faucet sends Kaspa to anyone requesting.</p>
                    <p>It has a defined address, where Kaspa is mined into. 
                    If the faucet address has enough Kaspa, it will send to an address you provide. </p>
                    <p>Requests are limited to the maximum of ${this.limit.toFixed()} KSP per IP address per 24 hours.</p>
                </div>
            </div>


            <div class="info">
                <flow-link></flow-link>
            </div>
		`;
	}

}

FaucetInfo.define("faucet-info");
