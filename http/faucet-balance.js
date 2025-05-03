import {dpc, html, css, BaseElement, FlowFormat} from '/flow/flow-ux/flow-ux.js';
import { KAS } from './kas.js'

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
		this.blocksSinceLastUpdate = 0;
		//this.network = flow.app.network;
	}

	onlineCallback() {
		const { rpc } = flow.app;

		this.balanceUpdates = rpc.subscribe('balance');
		(async()=>{
			for await(const msg of this.balanceUpdates) {
				const { network, balance:{available, pending} } = msg.data;
				console.log("balance:msg.data", msg.data)
				try {
					this.balances[network] = {
						available,
						pending
					};
				} catch(ex) {
					console.log(ex);
				}
				if(this.network == network)
					this.requestUpdate();
			}
		})().then();

		this.blueScoreUpdates = rpc.subscribe(`blue-score`);
		(async()=>{
			for await(const msg of this.blueScoreUpdates) {
				const {network, blueScore, blocksSinceLastUpdate} = msg.data;
				this.blueScores[network] = blueScore;
				this.blocksSinceLastUpdate = blocksSinceLastUpdate;
				if (this.network == network)
					this.requestUpdate();
			}
		})().then();
	}

	offlineCallback() {
		this.balanceUpdates.stop();
		this.blueScoreUpdates.stop();
	}


	render(){

		const available = this.balances[this.network]?.available ? KAS(this.balances[this.network].available)+' KAS' : '---';
		const pending = this.balances[this.network]?.pending ? KAS(this.balances[this.network].pending)+' KAS' : null;
		const blueScore = this.blueScores[this.network] ? FlowFormat.commas(this.blueScores[this.network]) : '---';
		const blocksSinceLastUpdate = this.blocksSinceLastUpdate ? (this.blocksSinceLastUpdate < 10 ? "" : "") + this.blocksSinceLastUpdate.toFixed(1) : '--.-';

        return html`
            <div class='wrapper'>
                <div class='caption'>Faucet Balance</div>
                <div class='balance'>${available}</div>
				<div class='info' row>
					<div class='blue-score' col>
						<div class='tiny-caption'>DAG BLUE SCORE</div>
						<div class='tiny-value'>${blueScore}</div>
					</div>
					<div class='blue-score' col>
						<div class='tiny-caption'>BLOCKS/S</div>
						<div class='tiny-value'>${blocksSinceLastUpdate}</div>
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
