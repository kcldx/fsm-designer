export function simulateNFA(machine,input){
  const start=machine.states.find(s=>s.isStart);
  if(!start) return {accepted:false,error:"No start state is defined.",trace:[]};
  let current=new Set([start.id]),trace=[{step:0,current:[...current],symbol:"",next:[...current]}];
  for(let i=0;i<input.length;i++){
    const symbol=input[i],next=new Set(),used=[];
    for(const id of current) for(const t of machine.transitions.filter(x=>x.from===id&&x.symbol===symbol)){next.add(t.to);used.push(t.id);}
    trace.push({step:i+1,current:[...current],symbol,next:[...next],transitionIds:used});
    current=next;
  }
  const accepted=[...current].some(id=>machine.states.find(s=>s.id===id)?.isFinal);
  return {accepted,current:[...current],trace};
}
