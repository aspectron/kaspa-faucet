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
                display:block;margin:2px;
            }
            .transaction { 
				margin-top: 4px;
			}

            .caption { font-family : "Open Sans"; font-size: 14px; }
            .value { font-family : "Consolas"; font-size: 22px; color:#666; }
            /*.value { font-family : "IBM Plex Mono"; font-size: 22px;  }*/
            /*.value { font-family : "IBM Plex Sans Condensed"; font-size: 22px;  }*/
			[row] {
				display: flex;
				flex-direction: row;
			}
			
			[col] {
				display: flex;
				flex-direction: column;
				margin: 4px;
			}
			
		`;
	}

	constructor(){
        super();
        this.transactions = [];
	}

	render(){

		let tx = this.data;

        return html`
            <div class='transaction' row>
				<div col>
					<div class='value'>${(tx.amount>0?' ':'')+flow.app.formatKSP(tx.amount)} KSP</div>
				</div>
				<div col>
					<div class='value'>${tx.blockBlueScore}</div>
				</div>
				<div col>
					<div class='value'>${tx.transactionId.substring(0,20)}</div>
				</div>
            </div>
		`;
	}

}

KaspaTransaction.define("kaspa-transaction");
