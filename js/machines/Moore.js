export function simulateMoore(machine,input){
  const start=machine.states.find(s=>s.isStart);
  if(!start) return {error:"No start state is defined.",trace:[],output:[]};
  let current=start.id,output=[start.output],trace=[{step:0,state:current,input:"",output:start.output,next:current}];
  for(let i=0;i<input.length;i++){
    const symbol=input[i],t=machine.transitions.find(x=>x.from===current&&x.symbol===symbol);
    if(!t)return {error:`No transition from ${machine.states.find(s=>s.id===current)?.name} on "${symbol}".`,trace,output};
    current=t.to;output.push(machine.states.find(s=>s.id===current)?.output??"");trace.push({step:i+1,state:t.from,input:symbol,output:machine.states.find(s=>s.id===current)?.output??"",next:current,transitionId:t.id});
  }
  return {trace,output,current:[current]};
}
