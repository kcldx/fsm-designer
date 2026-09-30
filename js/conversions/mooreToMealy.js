import {makeTransition} from "../state.js";
export function mooreToMealy(machine){
  const transitions=machine.transitions.map(t=>makeTransition({from:t.from,to:t.to,symbol:t.symbol,output:machine.states.find(s=>s.id===t.to)?.output||""}));
  return {version:1,type:"MEALY",states:machine.states.map(s=>({...s,output:""})),transitions,inputAlphabet:[...machine.inputAlphabet],outputAlphabet:[...machine.outputAlphabet],meta:{name:"Moore → Mealy conversion",convertedFrom:"MOORE"}};
}
