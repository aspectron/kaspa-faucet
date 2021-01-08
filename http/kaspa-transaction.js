import {dpc, html, css, BaseElement} from '/flow/flow-ux/flow-ux.js';

export class KaspaTransaction extends BaseElement {
	static get properties(){
		return {
            data : { type : Object }
		}
	}
	static get styles(){
		return css`
			:host{
                display:block;margin:32px;
            }
            .transaction { font-family : "IBM Plex Sans Condensed"; font-size: 14px; margin-top: 4px;}
		`;
	}

	constructor(){
        super();
        this.transactions = [];
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
				${ JSON.stringify(this.data) }
            </div>
		`;
	}

}

KaspaTransaction.define("kaspa-transaction");
