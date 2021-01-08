import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class FaucetTransactions extends BaseElement {
	static get properties(){
		return {
            transactions : { type : Array }
		}
	}
	static get styles(){
		return css`
			:host{
                display:block;margin:32px;

            }
            .caption { font-family : "Open Sans"; font-size: 14px; }
            .transactions { font-family : "IBM Plex Sans Condensed"; font-size: 14px; margin-top: 4px;}

		`
	}

	constructor(){
        super();
		this.transactions = [];
		for(let i = 0; i < 10; i++)
			this.transactions.push({ amount : i+100 });
	}

	onlineCallback() {
		const { rpc } = flow.app;
		this.transactionUpdates = rpc.subscribe('transaction');
		(async()=>{
			for await(const msg of this.transactionUpdates) {
                this.transactions.push(msg.data.transaction);
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
                <div class='transactions'>
                    ${
                        this.transactions.reverse().map(tx => html`<kaspa-transaction .data=${tx}></kaspa-transaction>`)
                    }
                </div>
            </div>
		`;
	}

}

FaucetTransactions.define("faucet-transactions");
