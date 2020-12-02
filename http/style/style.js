import {ScrollbarStyle} from '/flow/flow-ux/flow-ux.js';
let sBar = document.createElement('style');
sBar.innerHTML = ScrollbarStyle.cssText;
document.head.appendChild(sBar);