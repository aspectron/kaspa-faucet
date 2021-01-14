import {dpc, html, css, BaseElement, FlowFormat} from '/flow/flow-ux/flow-ux.js';
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
            .caption { font-family : "Open Sans"; font-size: 14px;  }
			.balance { font-family : "IBM Plex Sans Condensed"; font-size: 36px; margin-top: 4px;}
			.info { margin-top: 4px; }
            .tiny-caption { font-family : "Open Sans"; font-size: 10px; }
			.tiny-value { font-family : "Consolas"; font-size: 16px; color:#666; margin-top: 4px; }
			.pending, .blue-score { margin-top: 4px; margin-right: 10px; }
			
			[row] {
				display: flex;
				flex-direction: row;
			}
			[col] {
				display: flex;
				flex-direction: column;
			}
			
		`
	}
	
	constructor(){
        super();
		this.balances = {};
		this.blueScores = {};
		this.balanceUpdates = {};
		this.blueScoreUpdates = {};
		//this.network = flow.app.network;
	}

	onlineCallback() {
		const { rpc, networks } = flow.app;
		networks.forEach((network)=>{
			this.balanceUpdates[network] = rpc.subscribe(`balance-${network}`);
			(async()=>{
				for await(const msg of this.balanceUpdates[network]) {
					// console.log("balanceUpdates: msg.data", network, msg.data)
					const { available, pending } = msg.data;
					try {
						this.balances[network] = {
							available : Decimal(available||0).mul(1e-8),
							pending : pending ? Decimal(pending).mul(1e-8) : 0
						};
					} catch(ex) {
						console.log(ex);
					}
					if(this.network == network)
						this.requestUpdate();
				}
			})().then();

			this.blueScoreUpdates[network] = rpc.subscribe(`blue-score-${network}`);
			(async()=>{
				for await(const msg of this.blueScoreUpdates[network]) {
					// console.log("blueScoreUpdates: msg.data", network, msg.data)
					const { blueScore } = msg.data;
						this.blueScores[network] = blueScore;
					if(this.network == network)
						this.requestUpdate();
				}
			})().then();
		})
	}

	offlineCallback() {
		Object.values(this.balanceUpdates).forEach(subscriber => subscriber.stop());
		Object.values(this.blueScoreUpdates).forEach(subscriber => subscriber.stop());
	}
	

	render(){
		
		const available = this.balances[this.network]?.available ? flow.app.formatKSP(this.balances[this.network].available, true)+' KSP' : '---';
		const pending = this.balances[this.network]?.pending ? flow.app.formatKSP(this.balances[this.network].pending, true)+' KSP' : null;
		const blueScore = this.blueScores[this.network] ? FlowFormat.commas(this.blueScores[this.network]) : '---';

        return html`
            <div class='wrapper'>
                <div class='caption'>Faucet Balance</div>
                <div class='balance'>${available}</div>
				<div class='info' row>
					<div class='blue-score' col>
						<div class='tiny-caption'>DAG BLUE SCORE</div>
						<div class='tiny-value'>${blueScore}</div>
					</div>
					${ pending ? html`
						<div class='pending' col>
							<div class='tiny-caption'>PENDING</div>
							<div class='tiny-value'>${pending}</div>
						</div>
					` : '' }
				</div>
            </div>
		`;
	}

}

FaucetBalance.define("faucet-balance");
