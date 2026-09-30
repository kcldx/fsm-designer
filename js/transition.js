export function groupTransitions(machine){
  const map=new Map();
  for(const t of machine.transitions){
    const key=`${t.from}::${t.symbol}`;
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(t);
  }
  return map;
}
export function transitionLabel(machine,t){
  if(machine.type==="MEALY") return `${t.symbol} / ${t.output}`;
  return t.symbol;
}
export function getState(machine,id){return machine.states.find(s=>s.id===id)}
export function stateName(machine,id){return getState(machine,id)?.name??id}
