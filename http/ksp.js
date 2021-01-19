import {Decimal} from './flow/flow-ux/extern/decimal.js';

export const KSP = (v, trailingZeros) => {
    var [int,frac] = Decimal(v).mul(1e-8).toFixed(8).split('.');
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if(trailingZeros)
        return `${int}.${frac}`;
    frac = frac.replace(/0+$/,'');
    return frac ? `${int}.${frac}` : int;
}
