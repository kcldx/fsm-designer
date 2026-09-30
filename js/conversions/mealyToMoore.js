import {makeState,makeTransition} from "../state.js";
export function mealyToMoore(machine){
  const states=[],transitions=[],stateMap=new Map();
  for(const s of machine.states){
    const incoming=machine.transitions.filter(t=>t.to===s.id);
    const variants=incoming.length?Array.from(new Set(incoming.map(t=>t.output))):[""];
    for(const out of variants){
      const id=`${s.id}__${out||"empty"}`,name=`${s.name} / ${out||"ε"}`;
      states.push(makeState({id,name,x:s.x+variants.indexOf(out)*150,y:s.y,isStart:s.isStart&&variants.indexOf(out)===0,isFinal:s.isFinal,output:out}));
      stateMap.set(`${s.id}|${out}`,id);
    }
  }
  for(const t of machine.transitions){
    const sourceVariants=machine.states.find(s=>s.id===t.from);
    const targetVariants=machine.transitions.filter(x=>x.to===t.to);
    const sourceIds=states.filter(s=>s.id.startsWith(`${t.from}__`));
    for(const src of sourceIds){
      const dest=stateMap.get(`${t.to}|${t.output}`)||stateMap.get(`${t.to}|`);
      if(dest)transitions.push(makeTransition({from:src.id,to:dest,symbol:t.symbol}));
    }
  }
  return {version:1,type:"MOORE",states,transitions,inputAlphabet:[...machine.inputAlphabet],outputAlphabet:[...machine.outputAlphabet],meta:{name:"Mealy → Moore conversion",convertedFrom:"MEALY"}};
}
