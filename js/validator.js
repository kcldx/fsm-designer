import {groupTransitions,getState} from "./transition.js";

export function validateMachine(machine){
  const errors=[], warnings=[];
  const types=["DFA","NFA","ENFA","MEALY","MOORE"];
  if(!types.includes(machine.type)) errors.push(`Unknown machine type "${machine.type}".`);
  const names=new Set();
  for(const s of machine.states){
    if(!s.name?.trim()) errors.push(`A state has an empty name.`);
    if(names.has(s.name.trim())) errors.push(`Duplicate state name "${s.name}".`);
    names.add(s.name.trim());
  }
  const symbols=new Set(machine.inputAlphabet);
  if(symbols.size!==machine.inputAlphabet.length) errors.push("Duplicate input alphabet symbols are not allowed.");
  if(machine.type==="MEALY"||machine.type==="MOORE"){
    const outs=new Set(machine.outputAlphabet);
    if(outs.size!==machine.outputAlphabet.length) errors.push("Duplicate output alphabet symbols are not allowed.");
  }
  const starts=machine.states.filter(s=>s.isStart);
  if(starts.length!==1) errors.push(`${machine.type} requires exactly one start state (found ${starts.length}).`);
  if(machine.type!=="MEALY"&&machine.type!=="MOORE"&&!machine.states.some(s=>s.isFinal)) warnings.push("No final state is defined, so all acceptance simulations will reject.");
  const stateIds=new Set(machine.states.map(s=>s.id));
  const keyMap=new Map();
  for(const t of machine.transitions){
    if(!stateIds.has(t.from)||!stateIds.has(t.to)) errors.push(`Transition references a state that does not exist.`);
    if(machine.type==="ENFA"&&t.symbol!=="ε"&&!symbols.has(t.symbol)) errors.push(`Symbol "${t.symbol}" is not in the input alphabet.`);
    if(machine.type!=="ENFA"&&!symbols.has(t.symbol)) errors.push(`Symbol "${t.symbol}" is not in the input alphabet.`);
    if(machine.type==="MEALY"){
      if(!t.symbol) errors.push("Every Mealy transition must have an input.");
      if(!t.output) errors.push("Every Mealy transition must have an output.");
      if(t.output&&!machine.outputAlphabet.includes(t.output)) errors.push(`Mealy output "${t.output}" is not in the output alphabet.`);
    }
    if(machine.type==="DFA"){
      const key=`${t.from}::${t.symbol}`;
      if(keyMap.has(key)) errors.push(`DFA state "${getState(machine,t.from)?.name}" has multiple transitions for input "${t.symbol}".`);
      keyMap.set(key,t.id);
    }
    if(machine.type==="MOORE"){
      // Moore output is checked on states below.
    }
  }
  if(machine.type==="DFA"){
    for(const s of machine.states) for(const a of machine.inputAlphabet){
      if(!machine.transitions.some(t=>t.from===s.id&&t.symbol===a)) warnings.push(`Missing DFA transition: ${s.name} on "${a}".`);
    }
  }
  if(machine.type==="MOORE"){
    for(const s of machine.states){
      if(!s.output) errors.push(`Moore state "${s.name}" has no output.`);
      else if(!machine.outputAlphabet.includes(s.output)) errors.push(`Moore output "${s.output}" on state "${s.name}" is not in the output alphabet.`);
    }
  }
  return {valid:errors.length===0,errors,warnings};
}
