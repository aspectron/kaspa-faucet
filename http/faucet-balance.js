import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetBalance extends BaseElement {
	static get properties(){
		return {
            balance : { type : Number }
		}
	}
	static get styles(){
		return css`
			:host{
                display:block;margin:32px;
                
            }
            .caption { font-family : "Open Sans"; font-size: 14px; }
            .balance { font-family : "IBM Plex Sans Condensed"; font-size: 36px; margin-top: 4px;}
			
		`
	}
	
	constructor(){
        super();
        this.balance = 0;
	}

	onlineCallback() {
		const { rpc } = flow.app;
		this.balanceUpdates = rpc.subscribe('balance');
		(async()=>{
			for await(const msg of this.balanceUpdates) {
                this.balance = msg.data.balance * 1e-8;
			}
		})().then();
	}
	
	offlineCallback() {
		console.log("I AM DISCONNECTED!");
		this.balanceUpdates.stop();
	}
	

	render(){
		
        return html`
            <div class='wrapper'>
                <div class='caption'>Faucet Balance</div>
                <div class='balance'>${flow.app.formatKSP(this.balance)} KSP</div>
            </div>
		`;
	}

}

FaucetBalance.define("faucet-balance");
