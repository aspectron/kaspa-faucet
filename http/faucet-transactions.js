import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';
import {Decimal} from '/flow/flow-ux/extern/decimal.js';
// import {BigNumber} from '/flow/flow-ux/resources/extern/bignumber.js/bignumber.mjs';

// Decimal.set({ precision : 2, rounding : 4 });
// console.log("Decimal:", Decimal('123.123456789999').toFixed(8));

export class FaucetTransactions extends BaseElement {
	static get properties(){
		return {
			//transactions : { type : Array },
			//networks : { type : Array },
			network : { type : String },
			limit : { type : Number }
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
			.headers :nth-child(1) { width: 140px; text-align:center; }
			.headers :nth-child(2) { width: 120px; text-align:center; }
			.headers :nth-child(3) { width: 300px; }
			/*.headers div { border: 1px solid red; }*/
            .transactions { /*font-family : "IBM Plex Sans Condensed"; font-size: 18px;*/ margin-top: 4px;}

		`
	}

	constructor(){
        super();
		this.transactions = {};
		this.limit = 25;
		this.transactionUpdates = {};
		//this.network = flow.app.network;
		// for(let i = 0; i < 10; i++)
		// 	this.transactions.push({ amount : i+100 });
	}

	onlineCallback() {
		const { rpc, networks } = flow.app;

		networks.forEach((network) => {
			const transactions = this.transactions[network] = [];
			this.transactionUpdates[network] = rpc.subscribe(`utxo-change-${network}`);
			(async()=>{
				for await(const msg of this.transactionUpdates[network]) {
					const { added, removed, seq } = msg.data;
					console.log({seq});
					// removed does not contain an amount...
					// removed.forEach(tx=>{
					// 	transactions.unshift({
					// 		...tx,
					// 		amount : Decimal(tx.amount).mul(1e-8).neg()
					// 	}); 
					// });
					added.forEach(tx=>{
						transactions.unshift({
							...tx,
							amount : Decimal(tx.amount).mul(1e-8)
						}); 
					});
					// console.log(this.transactions);
					//this.transactions.push(msg.data.transaction);

					while(transactions.length > this.limit)
						transactions.pop();

					if(this.network == network)
						this.requestUpdate();
				}
			})().then();
		})
	}

	offlineCallback() {
		Object.values(this.transactionUpdates).forEach(subscriber=>subscriber.stop());
	}

	render(){
		const transactions = this.transactions[this.network] || [];
        return html`
            <div class='wrapper'>
				<div class='caption'>Faucet Transactions</div>
				<div class='headers'><div>VALUE (KSP)</div><div>DAG BLUE SCORE</div><div>TXID</div></div>
                <div class='transactions'>
                    ${
                        transactions.map(tx => html`<kaspa-transaction .data=${tx}></kaspa-transaction>`)
                    }
                </div>
            </div>
		`;
	}

}

FaucetTransactions.define("faucet-transactions");
