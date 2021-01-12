import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetInfo extends BaseElement {
	static get properties(){
		return {
            limit:{type:Number},
            network:{type:String}
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
        this.limit = 1000;
        this.addresses = [];

    }


	onlineCallback() {
		const { rpc } = flow.app;
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
	}

	offlineCallback() {
		this.addressUpdates.stop();
	}


	render(){
        const address = this.addresses[this.network];
        return html`
            <div class="info">
                <div class="caption">Welcome to Kaspa Faucet</div>
                <div class="info-content">
                    <p>Kaspa Faucet sends Kaspa to anyone requesting.</p>
                    <p>It has a defined address, where Kaspa is mined into. 
                    If the faucet address has enough Kaspa, it will send to an address you provide. </p>
                    <p>Faucet can receive funds at the following address:</p>
                    <p><b>${address}</b></p>
                    <p>Requests are limited to the maximum of ${this.limit.toFixed()} KSP per IP address per 24 hours.</p>
                </div>
            </div>
		`;
	}

}

FaucetInfo.define("faucet-info");
