function closure(machine,ids){
  const result=new Set(ids),stack=[...ids];
  while(stack.length){
    const id=stack.pop();
    for(const t of machine.transitions.filter(x=>x.from===id&&x.symbol==="ε")){
      if(!result.has(t.to)){result.add(t.to);stack.push(t.to);}
    }
  }
  return result;
}
export function epsilonClosure(machine,ids){return closure(machine,ids)}
export function simulateENFA(machine,input){
  const start=machine.states.find(s=>s.isStart);
  if(!start) return {accepted:false,error:"No start state is defined.",trace:[]};
  let current=closure(machine,[start.id]),trace=[{step:0,current:[...current],closure:[...current],symbol:"",next:[...current]}];
  for(let i=0;i<input.length;i++){
    const symbol=input[i],raw=new Set(),used=[];
    for(const id of current) for(const t of machine.transitions.filter(x=>x.from===id&&x.symbol===symbol)){raw.add(t.to);used.push(t.id);}
    const next=closure(machine,[...raw]);
    trace.push({step:i+1,current:[...current],symbol,next:[...next],closure:[...next],transitionIds:used});
    current=next;
  }
  const accepted=[...current].some(id=>machine.states.find(s=>s.id===id)?.isFinal);
  return {accepted,current:[...current],trace};
}
