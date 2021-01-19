import {Decimal} from './flow/flow-ux/extern/decimal.js';

export const KSP = (v) => {
    var [int,frac] = Decimal(v).mul(1e-8).toFixed(8).split('.');
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    frac = frac.replace(/0+$/,'');
    return frac ? `${int}.${frac}` : int;
}
