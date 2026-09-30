export function simulateDFA(machine,input,fromIndex=0){
  const start=machine.states.find(s=>s.isStart);
  if(!start) return {accepted:false,error:"No start state is defined.",trace:[]};
  let current=start.id, trace=[{step:0,current:[current],symbol:"",next:[current]}];
  for(let i=fromIndex;i<input.length;i++){
    const symbol=input[i];
    const t=machine.transitions.find(x=>x.from===current&&x.symbol===symbol);
    if(!t){trace.push({step:i+1,current:[current],symbol,next:[]});return {accepted:false,error:`No transition from ${machine.states.find(s=>s.id===current)?.name} on "${symbol}".`,trace};}
    current=t.to;trace.push({step:i+1,current:[t.from],symbol,next:[current],transitionId:t.id});
  }
  return {accepted:machine.states.find(s=>s.id===current)?.isFinal===true,current:[current],trace};
}
