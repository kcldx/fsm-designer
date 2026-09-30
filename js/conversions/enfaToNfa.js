function closure(machine,ids){
  const out=new Set(ids),stack=[...ids];
  while(stack.length){const id=stack.pop();for(const t of machine.transitions.filter(t=>t.from===id&&t.symbol==="ε"))if(!out.has(t.to)){out.add(t.to);stack.push(t.to)}}
  return out;
}
export function enfaToNfa(machine){
  const transitions=[], seen=new Set();
  for(const s of machine.states){
    const c=closure(machine,[s.id]);
    for(const q of c) for(const a of machine.inputAlphabet){
      for(const t of machine.transitions.filter(t=>t.from===q&&t.symbol===a)){
        const dest=closure(machine,[t.to]);
        for(const d of dest){const k=`${s.id}|${a}|${d}`;if(!seen.has(k)){seen.add(k);transitions.push({id:crypto.randomUUID(),from:s.id,to:d,symbol:a,output:""})}}
      }
    }
  }
  const states=machine.states.map(s=>({...s,isFinal:s.isFinal||[...closure(machine,[s.id])].some(id=>machine.states.find(q=>q.id===id)?.isFinal)}));
  return {version:1,type:"NFA",states,transitions,inputAlphabet:[...machine.inputAlphabet],outputAlphabet:[],meta:{name:"ε-NFA → NFA conversion",convertedFrom:"ENFA"}};
}
