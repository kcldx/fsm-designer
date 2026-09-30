export function simulateMealy(machine,input){
  const start=machine.states.find(s=>s.isStart);
  if(!start) return {error:"No start state is defined.",trace:[],output:[]};
  let current=start.id,output=[],trace=[{step:0,state:current,input:"",output:"",next:current}];
  for(let i=0;i<input.length;i++){
    const symbol=input[i],t=machine.transitions.find(x=>x.from===current&&x.symbol===symbol);
    if(!t)return {error:`No transition from ${machine.states.find(s=>s.id===current)?.name} on "${symbol}".`,trace,output};
    output.push(t.output);trace.push({step:i+1,state:current,input:symbol,output:t.output,next:t.to,transitionId:t.id});current=t.to;
  }
  return {trace,output,current:[current]};
}
