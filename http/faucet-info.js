import {dpc, html, css, BaseElement, FlowFormat} from '/flow/flow-ux/flow-ux.js';

export class FaucetInfo extends BaseElement {
	static get properties(){
		return {
            limits:{type:Array},
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
        this.limits = [];
        this.addresses = [];

    }


	onlineCallback() {
		const { rpc } = flow.app;
		this.addressUpdates = rpc.subscribe(`addresses`);
		(async()=>{
			for await(const msg of this.addressUpdates) {
                const { addresses } = msg.data;
                this.addresses = addresses;
                // this.requestUpdate();
				// this.networks = networks;
				// console.log("available networks:",networks);
			}
		})().then();

        this.limitUpdates = rpc.subscribe(`limits`);
		(async()=>{
			for await(const msg of this.limitUpdates) {
                this.limits = msg.data.limits;
			}
		})().then();
	}

	offlineCallback() {
		this.addressUpdates.stop();
	}


	render(){
        const address = this.addresses[this.network];
        const limit = this.limits[this.network];
        return html`
            <div class="info">
                <div class="caption">Welcome to Kaspa Faucet</div>
                <div class="info-content">
                    <p>Kaspa Faucet sends Kaspa to anyone requesting.</p>
                    <p>It has a defined address, where you can send or mine Kaspa.
                    If the faucet address has enough Kaspa, it will send it to an address you provide. </p>
                    <p>Faucet can receive funds at the following address:</p>
                    <p><b>${address}</b></p>
                    <p>Requests are limited to the maximum of <b>${FlowFormat.commas(limit)}</b> KSP per IP address, per <b>24 hours</b>.</p>
                </div>
            </div>
		`;
	}

}

FaucetInfo.define("faucet-info");
