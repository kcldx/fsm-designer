import {simulateDFA} from "./machines/DFA.js";
import {simulateNFA} from "./machines/NFA.js";
import {simulateENFA} from "./machines/ENFA.js";
import {simulateMealy} from "./machines/Mealy.js";
import {simulateMoore} from "./machines/Moore.js";

export function tokenizeInput(input,alphabet){
  const text=String(input??"").trim();
  if(!text)return [];
  const symbols=[...alphabet].filter(Boolean).sort((a,b)=>b.length-a.length);
  const chars=[...text];
  // If alphabet symbols are single characters, preserve the familiar string behavior.
  if(symbols.every(s=>[...s].length===1)) return chars;
  const out=[];let i=0;
  while(i<text.length){
    const match=symbols.find(s=>text.startsWith(s,i));
    if(!match) return {error:`Cannot tokenize input near "${text.slice(i)}".`};
    out.push(match);i+=match.length;
  }
  return out;
}
export function simulate(machine,input){
  const tokenized=tokenizeInput(input,machine.inputAlphabet);
  if(tokenized?.error)return {error:tokenized.error,trace:[]};
  const tokens=Array.isArray(tokenized)?tokenized:[];
  switch(machine.type){
    case "DFA":return simulateDFA(machine,tokens);
    case "NFA":return simulateNFA(machine,tokens);
    case "ENFA":return simulateENFA(machine,tokens);
    case "MEALY":return simulateMealy(machine,tokens);
    case "MOORE":return simulateMoore(machine,tokens);
    default:return {error:"Unsupported machine type.",trace:[]};
  }
}
