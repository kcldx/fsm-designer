import {enfaToNfa} from "./enfaToNfa.js";
import {nfaToDfa} from "./nfaToDfa.js";
export function enfaToDfa(machine){return nfaToDfa(enfaToNfa(machine))}
