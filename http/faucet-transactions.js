import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetTransactions extends BaseElement {
	static get properties(){
		return {
			transactions : { type : Array },
			network : { type : String }
		}
	}
	static get styles(){
		return css`
			:host{
                display:block; margin-top: 16px;

            }
            .caption { font-family : "Open Sans"; font-size: 14px; }
			.headers { font-family : "Open Sans"; font-size: 10px; margin-top: 16px; display:flex; flex-direction: row; }
			.xx-headers div { border: 1px solid red; }
			.headers :nth-child(1) { width: 80px; text-align:center; }
			.headers :nth-child(2) { width: 120px; text-align:center; }
			.headers :nth-child(3) { width: 300px; }
			/*.headers div { border: 1px solid red; }*/
            .transactions { /*font-family : "IBM Plex Sans Condensed"; font-size: 18px;*/ margin-top: 4px;}

		`
	}

	constructor(){
        super();
		this.transactions = [];
		//this.network = flow.app.network;
		// for(let i = 0; i < 10; i++)
		// 	this.transactions.push({ amount : i+100 });
	}

	onlineCallback() {
		const { rpc } = flow.app;
		this.transactionUpdates = rpc.subscribe(`utxo-change-${this.network}`);
		(async()=>{
			for await(const msg of this.transactionUpdates) {
				const { added, removed } = msg.data;
				removed.forEach(tx=>{
					tx.amount = -parseInt(tx.amount) * 1e-8;
					this.transactions.unshift(tx); 
				});
				added.forEach(tx=>{
					tx.amount = parseInt(tx.amount) * 1e-8;
					this.transactions.unshift(tx);
				});
				// console.log(this.transactions);
				//this.transactions.push(msg.data.transaction);

				while(this.transactions.length > 25)
					this.transactions.pop();
				this.requestUpdate();
			}
		})().then();
	}

	offlineCallback() {
		this.transactionUpdates.stop();
	}

	render(){
        return html`
            <div class='wrapper'>
				<div class='caption'>Faucet Transactions</div>
				<div class='headers'><div>VALUE (KSP)</div><div>DAG BLUE SCORE</div><div>TXID</div></div>
                <div class='transactions'>
                    ${
                        this.transactions.map(tx => html`<kaspa-transaction .data=${tx}></kaspa-transaction>`)
                    }
                </div>
            </div>
		`;
	}

}

FaucetTransactions.define("faucet-transactions");
