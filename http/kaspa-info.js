import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class KaspaInfo extends BaseElement {
	static get properties(){
		return {
			errorMessage:{type:String}
		}
	}
	static get styles(){
		return css`
			:host{display:block;max-width:1000px;margin:auto;margin-top:100px;}
            .info {display:flex;flex-direction:column;justify-content:center;margin:50px;}
            .info-title { font-size:24px;font-weight:bold;text-align:center;}
            .info-content {padding:10px;font-size:18px;}
		`
	}

	render(){
        return html`
        
        <div class="info">
                <div class="info-title">Kaspa Faucet</div>
                <div class="info-content">Faucet is an open source Kaspa faucet that sends Kaspa to anyone requesting. 
                    It has a defined address, where Kaspa is mined into. Requests to the faucet are passed via https POST. 
                    If the faucet address has enough Kaspa, it will send it. 
                    Each request yields a fixed amount, and requests are limited to one request per IP address per 24 hours.
                </div>
            </div>

			<div class="info">
                <div class="info-title">About Kaspa</div>
                <div class="info-content">Kaspa is an ongoing project that aims to be a consensus stack similar to Bitcoin in its base blockchain layer
                    design and similar to Ethereum in its capabilities and expressiveness. The high-level mission is to build a 
                    decentralized currency that will be attractive for HODLers and institutional investors as a store of value (SoV),
                    and at the same time support open finance applications. One can acquire Kaspa by mining it; there is no premine.
                </div>
            </div>


            <div class="info">
                <flow-link></flow-link>
            </div>
		`;
	}

	constructor(){
		super();
	}

	
}

KaspaInfo.define("kaspa-info");
