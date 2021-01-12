import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';
import {Decimal} from '/flow/flow-ux/extern/decimal.js';

export class FaucetBalance extends BaseElement {
	static get properties(){
		return {
			network : { type : String },
            balances : { type : Object }
		}
	}
	static get styles(){
		return css`
			:host{
                display:block;
                
            }
            .caption { font-family : "Open Sans"; font-size: 14px; }
            .balance { font-family : "IBM Plex Sans Condensed"; font-size: 36px; margin-top: 4px;}
			
		`
	}
	
	constructor(){
        super();
		this.balances = {};
		this.balanceUpdates = {};
		//this.network = flow.app.network;
	}

	onlineCallback() {
		const { rpc, networks } = flow.app;
		networks.forEach((network)=>{
			this.balanceUpdates[network] = rpc.subscribe(`balance-${network}`);
			(async()=>{
				for await(const msg of this.balanceUpdates[network]) {
					this.balances[network] = Decimal(msg.data.balance).mul(1e-8);
					if(this.network == network)
						this.requestUpdate();
				}
			})().then();
		})
	}
	
	offlineCallback() {
		Object.values(this.balanceUpdates).forEach(subscriber => subscriber.stop());
	}
	

	render(){
		
		const balance = this.balances[this.network] ? flow.app.formatKSP(this.balances[this.network], true)+' KSP' : '---';

        return html`
            <div class='wrapper'>
                <div class='caption'>Faucet Balance</div>
                <div class='balance'>${balance}</div>
            </div>
		`;
	}

}

FaucetBalance.define("faucet-balance");
