import {makeState,makeTransition} from "../state.js";
function closureSet(machine,set){return new Set(set)}
export function nfaToDfa(machine){
  const start=machine.states.find(s=>s.isStart);if(!start)throw new Error("NFA needs a start state.");
  const alphabet=machine.inputAlphabet;
  const key=set=>[...set].sort().join("|");
  const subsets=new Map(),queue=[],startSet=new Set([start.id]);
  subsets.set(key(startSet),startSet);queue.push(startSet);
  const states=[],transitions=[];
  while(queue.length){
    const subset=queue.shift(),subsetKey=key(subset);
    if(!states.find(s=>s.id===subsetKey)){
      states.push(makeState({id:subsetKey,name:`{${[...subset].map(id=>machine.states.find(s=>s.id===id)?.name).join(",")}}`,x:160+states.length*150,y:160,isStart:states.length===0,isFinal:[...subset].some(id=>machine.states.find(s=>s.id===id)?.isFinal)}));
    }
    for(const a of alphabet){
      const next=new Set();
      for(const id of subset) for(const t of machine.transitions.filter(t=>t.from===id&&t.symbol===a))next.add(t.to);
      if(!next.size)continue;
      const nk=key(next);
      if(!subsets.has(nk)){subsets.set(nk,next);queue.push(next);}
      transitions.push(makeTransition({from:subsetKey,to:nk,symbol:a}));
    }
  }
  return {version:1,type:"DFA",states,transitions,inputAlphabet:[...alphabet],outputAlphabet:[],meta:{name:"NFA → DFA conversion",convertedFrom:"NFA"}};
}
