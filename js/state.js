export function makeState({id,name,x,y,isStart=false,isFinal=false,output=""}={}){
  return {id:id||crypto.randomUUID(),name:name||"State",x:Number.isFinite(x)?x:180,y:Number.isFinite(y)?y:160,isStart:!!isStart,isFinal:!!isFinal,output:output??""};
}
export function makeTransition({id,from,to,symbol="",output=""}={}){
  return {id:id||crypto.randomUUID(),from,to,symbol:String(symbol??""),output:String(output??"")};
}
export function cloneMachine(machine){return structuredClone(machine)}
export function createEmptyMachine(type="DFA"){
  return {version:1,type,states:[],transitions:[],inputAlphabet:type==="ENFA"?["0","1"]:["0","1"],outputAlphabet:(type==="MEALY"||type==="MOORE")?["0","1"]:[],meta:{name:"Untitled FSM",createdAt:new Date().toISOString()}};
}
export function normalizeMachine(raw){
  const type=raw?.type||"DFA";
  const m=createEmptyMachine(type);
  m.inputAlphabet=Array.isArray(raw?.inputAlphabet)?[...new Set(raw.inputAlphabet.map(String))]:m.inputAlphabet;
  m.outputAlphabet=Array.isArray(raw?.outputAlphabet)?[...new Set(raw.outputAlphabet.map(String))]:m.outputAlphabet;
  m.states=Array.isArray(raw?.states)?raw.states.map(s=>makeState(s)):[];
  // Mealy and Moore machines do not use accepting/final states in their 6-tuple.
  if(type==="MEALY"||type==="MOORE") m.states.forEach(s=>{s.isFinal=false});
  m.transitions=Array.isArray(raw?.transitions)?raw.transitions.map(t=>makeTransition(t)):[];
  m.meta={...m.meta,...(raw?.meta||{})};
  return m;
}
