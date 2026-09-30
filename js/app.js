import {createEmptyMachine,makeState,makeTransition,normalizeMachine,cloneMachine} from "./state.js";
import {CanvasRenderer} from "./canvas.js";
import {simulate} from "./simulator.js";
import {validateMachine} from "./validator.js";
import {persist,restoreWorkspaces,persistWorkspaces,saveTheme,loadTheme} from "./storage.js";
import {nfaToDfa} from "./conversions/nfaToDfa.js";
import {enfaToNfa} from "./conversions/enfaToNfa.js";
import {enfaToDfa} from "./conversions/enfaToDfa.js";
import {mealyToMoore} from "./conversions/mealyToMoore.js";
import {mooreToMealy} from "./conversions/mooreToMealy.js";
import {showModal,closeModal,toast,$,escapeHTML} from "./ui.js";

class FSMApp{
  constructor(){
    this.workspaces=restoreWorkspaces();
    if(!this.workspaces.DFA)this.workspaces.DFA=this.exampleDFA();
    for(const type of ["DFA","NFA","ENFA","MEALY","MOORE"]){
      if(!this.workspaces[type])this.workspaces[type]=createEmptyMachine(type);
      else this.workspaces[type]=normalizeMachine(this.workspaces[type]);
    }
    this.machine=this.workspaces.DFA;
    this.selected=null;this.activeStates=new Set();this.history=[];this.future=[];this.simResult=null;this.stepIndex=0;this.quickTransition={active:false,from:null};
    document.documentElement.dataset.theme=loadTheme();
    this.canvas=new CanvasRenderer($("fsmCanvas"),this);
    persistWorkspaces(this.workspaces);
    this.bindUI();this.syncTypeUI();this.renderAll();this.canvas.render();
  }
  exampleDFA(){
    const m=createEmptyMachine("DFA");
    m.inputAlphabet=["0","1"];
    const q0=makeState({name:"q0",x:160,y:180,isStart:true});
    const q1=makeState({name:"q1",x:390,y:180});
    const q2=makeState({name:"q2",x:620,y:180,isFinal:true});
    m.states=[q0,q1,q2];
    m.transitions=[
      makeTransition({from:q0.id,to:q0.id,symbol:"0"}),
      makeTransition({from:q0.id,to:q1.id,symbol:"1"}),
      makeTransition({from:q1.id,to:q0.id,symbol:"0"}),
      makeTransition({from:q1.id,to:q2.id,symbol:"1"}),
      makeTransition({from:q2.id,to:q2.id,symbol:"1"}),
      makeTransition({from:q2.id,to:q0.id,symbol:"0"})
    ];
    m.meta.name="Example DFA";
    return m;
  }
  getState(id){return this.machine.states.find(s=>s.id===id)}
  getTransition(id){return this.machine.transitions.find(t=>t.id===id)}
  markDirty(){this.status("Unsaved changes")}
  snapshot(){return cloneMachine(this.machine)}
  pushHistory(){
    const last=this.history[this.history.length-1];
    const current=JSON.stringify(this.machine);
    if(last!==current){this.history.push(current);if(this.history.length>60)this.history.shift();this.future=[]}
    this.workspaces[this.machine.type]=this.machine;persistWorkspaces(this.workspaces);this.renderAll();this.canvas.render();
  }
  mutate(fn,{history=true}={}){
    if(history)this.history.push(JSON.stringify(this.machine));
    fn();this.future=[];persist(this.machine);this.renderAll();this.canvas.render();
  }
  bindUI(){
    $("machineType").addEventListener("change",e=>this.changeType(e.target.value));
    document.querySelectorAll(".machine-card").forEach(b=>b.addEventListener("click",()=>this.changeType(b.dataset.machine)));
    $("newBtn").onclick=()=>this.newMachine();
    $("clearBtn").onclick=()=>this.clearMachine();
    $("saveBtn").onclick=()=>this.exportPNG();
    $("validateBtn").onclick=()=>this.showValidation();
    $("themeToggle").onclick=()=>this.toggleTheme();
    $("settingsBtn").onclick=()=>this.settings();
    $("addStateTool").onclick=()=>this.addStateDialog();
    $("addTransitionTool").onclick=()=>this.startQuickTransition();
    $("addTransitionDialogTool").onclick=()=>this.addTransitionDialog();
    $("setStartTool").onclick=()=>this.chooseStateTool("start");
    $("setFinalTool").onclick=()=>this.chooseStateTool("final");
    $("deleteTool").onclick=()=>this.deleteSelected();
    $("moveTool").onclick=()=>{this.canvas.panMode=!this.canvas.panMode;toast(this.canvas.panMode?"Pan mode enabled: drag the canvas to move the workspace.":"Select mode restored: drag states to move them.","info")};
    $("zoomInTool").onclick=()=>this.canvas.setZoom(this.canvas.zoom*1.15);
    $("zoomOutTool").onclick=()=>this.canvas.setZoom(this.canvas.zoom*.87);
    $("resetViewTool").onclick=()=>this.canvas.resetView();
    $("zoomPlus").onclick=()=>this.canvas.setZoom(this.canvas.zoom*1.15);
    $("zoomMinus").onclick=()=>this.canvas.setZoom(this.canvas.zoom*.87);
    $("fullscreenBtn").onclick=()=>{const el=$("canvasWrap");if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()};
    $("undoBtn").onclick=()=>this.undo();$("redoBtn").onclick=()=>this.redo();
    $("runBtn").onclick=()=>this.runSimulation();$("stepBtn").onclick=()=>this.stepSimulation();$("resetSimBtn").onclick=()=>this.resetSimulation();
    document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>this.selectTab(t.dataset.tab));
    document.querySelectorAll(".property-tab").forEach(t=>t.onclick=()=>this.selectPropertyTab(t.dataset.propertyTab));
    $("stateNameInput").addEventListener("input",e=>this.updateSelectedState({name:e.target.value}));
    $("stateStartCheck").onchange=e=>this.setStart(this.selected?.id,e.target.checked);
    $("stateFinalCheck").onchange=e=>this.setFinal(this.selected?.id,e.target.checked);
    $("stateOutputInput").oninput=e=>this.updateSelectedState({output:e.target.value});
    $("updatePositionBtn").onclick=()=>this.updateSelectedState({x:Number($("stateXInput").value),y:Number($("stateYInput").value)});
    $("deleteStateBtn").onclick=()=>this.deleteState(this.selected?.id);
    $("transitionFromInput").onchange=e=>this.updateSelectedTransition({from:e.target.value});
    $("transitionToInput").onchange=e=>this.updateSelectedTransition({to:e.target.value});
    $("transitionSymbolInput").oninput=e=>this.updateSelectedTransition({symbol:e.target.value});
    $("epsilonSymbolBtn").onclick=()=>{if(this.machine.type==="ENFA")this.updateSelectedTransition({symbol:"ε"});};
    $("transitionOutputInput").oninput=e=>this.updateSelectedTransition({output:e.target.value});
    $("updateTransitionBtn").onclick=()=>this.refreshSelection();
    $("deleteTransitionBtn").onclick=()=>this.deleteTransition(this.selected?.id);
    $("addInputSymbolBtn").onclick=()=>this.addAlphabetSymbol("input");$("inputSymbolField").addEventListener("keydown",e=>{if(e.key==="Enter")this.addAlphabetSymbol("input")});
    $("addOutputSymbolBtn").onclick=()=>this.addAlphabetSymbol("output");$("outputSymbolField").addEventListener("keydown",e=>{if(e.key==="Enter")this.addAlphabetSymbol("output")});
    $("convertBtn").onclick=()=>this.convert();
    $("modalClose").onclick=closeModal;$("modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
    $("fsmCanvas").addEventListener("click",()=>{this.selected=null;this.refreshSelection();this.canvas.render()});
    window.addEventListener("keydown",e=>this.shortcuts(e));
  }
  shortcuts(e){
    const tag=document.activeElement?.tagName;
    if(["INPUT","SELECT","TEXTAREA"].includes(tag))return;
    if(e.key.toLowerCase()==="s"){e.preventDefault();this.addStateDialog()}
    if(e.key.toLowerCase()==="t"){e.preventDefault();this.startQuickTransition()}
    if(e.key.toLowerCase()==="a"){e.preventDefault();this.addTransitionDialog()}
    if(e.key==="Escape"){this.quickTransition={active:false,from:null};document.getElementById("addTransitionTool")?.classList.remove("active");document.getElementById("quickInstruction")?.classList.add("hidden");this.status("Ready");this.canvas.render();toast("Quick Transition cancelled.","info")}
    if(e.key==="Delete"){e.preventDefault();this.deleteSelected()}
    if(e.ctrlKey&&e.key.toLowerCase()==="s"){e.preventDefault();this.exportPNG()}
    if(e.ctrlKey&&e.key.toLowerCase()==="z"){e.preventDefault();this.undo()}
    if(e.ctrlKey&&e.key.toLowerCase()==="y"){e.preventDefault();this.redo()}
  }
  changeType(type){
    if(type===this.machine.type){this.syncTypeUI();return}
    this.workspaces[this.machine.type]=this.machine;
    this.machine=this.workspaces[type]||createEmptyMachine(type);
    this.workspaces[type]=this.machine;
    this.selected=null;this.simResult=null;this.stepIndex=0;this.history=[];this.future=[];
    persistWorkspaces(this.workspaces);this.syncTypeUI();this.renderAll();this.canvas.resetView();
    toast(`${this.machineLabel(type)} workspace opened. Other machine workspaces are preserved.`,"info");
  }
  machineLabel(type){return type==="ENFA"?"ε-NFA":type==="MEALY"?"Mealy Machine":type==="MOORE"?"Moore Machine":type}
  syncTypeUI(){
    $("machineType").value=this.machine.type;
    document.querySelectorAll(".machine-card").forEach(b=>b.classList.toggle("active",b.dataset.machine===this.machine.type));
    const isOutputMachine=["MEALY","MOORE"].includes(this.machine.type);
    const usesFinalStates=!isOutputMachine;
    $("outputAlphabetSection").classList.toggle("hidden",!isOutputMachine);
    $("stateOutputEditor").classList.toggle("hidden",this.machine.type!=="MOORE");
    $("transitionOutputEditor").classList.toggle("hidden",this.machine.type!=="MEALY");
    $("epsilonSymbolBtn")?.classList.toggle("hidden",this.machine.type!=="ENFA");
    document.querySelectorAll(".final-only-ui,.final-only-tool").forEach(el=>el.classList.toggle("hidden",!usesFinalStates));
    if(!usesFinalStates){
      const hadFinal=this.machine.states.some(s=>s.isFinal);
      this.machine.states.forEach(s=>s.isFinal=false);
      if(hadFinal) persistWorkspaces(this.workspaces);
    }
    $("statusMachine").textContent=this.machineLabel(this.machine.type);
  }
  newMachine(){
    showModal("New FSM",`<div class="modal-form"><div class="modal-note">Start a clean ${escapeHTML(this.machineLabel(this.machine.type))}. The previous machine stays preserved in its ${escapeHTML(this.machineLabel(this.machine.type))} workspace until you replace it.</div></div>`,
      `<button class="btn neutral" id="modalCancel">Cancel</button><button class="btn primary" id="modalConfirm">Create New</button>`);
    $("modalCancel").onclick=closeModal;$("modalConfirm").onclick=()=>{this.history.push(JSON.stringify(this.machine));this.machine=createEmptyMachine(this.machine.type);this.workspaces[this.machine.type]=this.machine;this.selected=null;this.simResult=null;persistWorkspaces(this.workspaces);closeModal();this.renderAll();this.canvas.resetView();toast("New FSM created.","success")};
  }
  clearMachine(){
    showModal("Clear FSM",`<div class="modal-form"><div class="modal-note">This will remove all states and transitions from the current machine.</div></div>`,
      `<button class="btn neutral" id="modalCancel">Cancel</button><button class="danger-btn" id="modalConfirm" style="margin:0">Clear</button>`);
    $("modalCancel").onclick=closeModal;$("modalConfirm").onclick=()=>{this.history.push(JSON.stringify(this.machine));this.machine=createEmptyMachine(this.machine.type);this.workspaces[this.machine.type]=this.machine;this.selected=null;this.simResult=null;persistWorkspaces(this.workspaces);closeModal();this.renderAll();this.canvas.resetView();toast("FSM cleared.","success")};
  }
  addStateDialog(){
    const output=this.machine.type==="MOORE"?`<label>Default Output</label><input id="dlgOutput" placeholder="e.g. A">`:"";
    showModal("Add States",`<div class="modal-form">
      <div class="modal-note"><b>Fast State Creator</b> — create one or many states and choose a naming style. States are automatically arranged on the canvas.</div>
      <label>Number of States</label><input id="dlgCount" type="number" min="1" max="100" value="3">
      <label>Naming Style</label>
      <select id="dlgNamingStyle">
        <option value="letters">Letters — A, B, C, D…</option>
        <option value="qnumber" selected>q + Number — q0, q1, q2…</option>
        <option value="prefixnumber">Custom Prefix + Number — S0, S1, S2…</option>
        <option value="custom">Custom Names — type each name</option>
      </select>
      <div id="dlgPrefixWrap">
        <label id="dlgPrefixLabel">Prefix</label><input id="dlgPrefix" value="q" placeholder="e.g. S, state-">
      </div>
      <div id="dlgStartNumberWrap">
        <label>Starting Number</label><input id="dlgStartNumber" type="number" min="0" value="0">
      </div>
      <div id="dlgCustomWrap" class="hidden">
        <label>Custom Names</label><input id="dlgCustomNames" placeholder="e.g. A, B, C, D">
        <div class="modal-note">Separate names with commas. Example: <b>start, middle, final</b></div>
      </div>
      ${output}
      <label class="modal-check"><input type="checkbox" id="dlgStart" checked> Make first created state the Start / Initial State</label>
      <label class="modal-check"><input type="checkbox" id="dlgFinal"> Make last created state a Final / Accepting State</label>
      <div class="modal-note"><b>Recommended:</b> use <b>Letters</b> for classroom diagrams, or <b>q + Number</b> for formal automata notation.</div>
    </div>`,
      `<button class="btn neutral" id="modalCancel">Cancel</button><button class="btn primary" id="modalConfirm">Add States</button>`);
    $("modalCancel").onclick=closeModal;
    const syncNaming=()=>{
      const style=$("dlgNamingStyle").value;
      $("dlgPrefixWrap").classList.toggle("hidden",style!=="prefixnumber"&&style!=="qnumber");
      $("dlgStartNumberWrap").classList.toggle("hidden",style==="letters"||style==="custom");
      $("dlgCustomWrap").classList.toggle("hidden",style!=="custom");
      if(style==="qnumber")$("dlgPrefix").value="q";
    };
    $("dlgNamingStyle").onchange=syncNaming; syncNaming;
    const finalRow=$("dlgFinalRow");
    if(finalRow) finalRow.classList.toggle("hidden",["MEALY","MOORE"].includes(this.machine.type));
    syncNaming();
    $("modalConfirm").onclick=()=>{
      const count=Math.max(1,Math.min(100,Number($("dlgCount").value)||1));
      const style=$("dlgNamingStyle").value;
      const startNumber=Number($("dlgStartNumber").value)||0;
      const prefix=style==="qnumber"?"q":($("dlgPrefix").value.trim()||"S");
      const outputValue=this.machine.type==="MOORE"?$("dlgOutput").value.trim():"";
      const names=[];
      if(style==="custom"){
        const entered=$("dlgCustomNames").value.split(",").map(v=>v.trim()).filter(Boolean);
        if(entered.length!==count)return toast(`Enter exactly ${count} custom state name${count===1?"":"s"}.`,"error");
        names.push(...entered);
      }else{
        for(let i=0;i<count;i++){
          if(style==="letters") names.push(this.letterStateName(startNumber+i));
          else names.push(`${prefix}${startNumber+i}`);
        }
      }
      const seen=new Set();
      for(const name of names){
        if(seen.has(name)||this.machine.states.some(st=>st.name===name))
          return toast(`State name "${name}" already exists. Choose different names.`,"error");
        seen.add(name);
      }
      this.mutate(()=>names.forEach((name,i)=>{
        const p=this.nextPosition(this.machine.states.length);
        this.machine.states.push(makeState({name,x:p.x,y:p.y,isStart:$("dlgStart").checked&&i===0,isFinal:!["MEALY","MOORE"].includes(this.machine.type)&&$("dlgFinal").checked&&i===names.length-1,output:outputValue}));
      }));
      closeModal();toast(`${count} state${count===1?"":"s"} added: ${names.join(", ")}`,"success");
    };
  }
  letterStateName(index){
    let n=Math.max(0,Math.floor(index)),name="";
    do{ name=String.fromCharCode(65+(n%26))+name; n=Math.floor(n/26)-1; }while(n>=0);
    return name;
  }
  nextPosition(n=this.machine.states.length){const cols=Math.max(4,Math.floor(760/170));return {x:150+(n%cols)*170,y:120+Math.floor(n/cols)*145}}
  addTransitionDialog(){
    if(this.machine.states.length<1)return toast("Add at least one state first.","error");
    const opts=this.machine.states.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");
    const symbolOptions=(this.machine.type==="ENFA"?`<option value="ε">ε — Epsilon</option>`:"")+this.machine.inputAlphabet.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
    const symbolControl=this.machine.type==="ENFA"
      ? `<select id="dlgSymbol">${symbolOptions}</select>`
      : `<input id="dlgSymbol" list="symbolList" placeholder="e.g. 0, 1, a"><datalist id="symbolList">${this.machine.inputAlphabet.map(s=>`<option value="${escapeHTML(s)}">`).join("")}</datalist>`;
    showModal("Add Transition",`<div class="modal-form"><label>From State</label><select id="dlgFrom">${opts}</select><label>Input Symbol</label>${symbolControl}${this.machine.type==="MEALY"?`<label>Output</label><input id="dlgTransitionOutput" list="outputList" placeholder="output"><datalist id="outputList">${this.machine.outputAlphabet.map(s=>`<option value="${escapeHTML(s)}">`).join("")}</datalist>`:""}<label>To State</label><select id="dlgTo">${opts}</select><div class="modal-note">${this.machine.type==="ENFA"?`Choose <b>ε — Epsilon</b> directly from the Input Symbol menu. ε is a transition label, not a normal input-alphabet symbol.`:`Self-loops and parallel transitions are supported where valid.`}</div></div>`,
      `<button class="btn neutral" id="modalCancel">Cancel</button><button class="btn primary" id="modalConfirm">Add Transition</button>`);
    $("modalCancel").onclick=closeModal;$("modalConfirm").onclick=()=>{
      const from=$("dlgFrom").value,to=$("dlgTo").value,symbol=$("dlgSymbol").value.trim(),output=this.machine.type==="MEALY"?$("dlgTransitionOutput").value.trim():"";
      if(!symbol)return toast("Input symbol is required.","error");
      if(this.machine.type!=="ENFA"&&!this.machine.inputAlphabet.includes(symbol))return toast(`"${symbol}" is not in the input alphabet.`,"error");
      if(this.machine.type==="ENFA"&&symbol!=="ε"&&!this.machine.inputAlphabet.includes(symbol))return toast(`"${symbol}" is not in the input alphabet.`,"error");
      if(this.machine.type==="MEALY"&&!this.machine.outputAlphabet.includes(output))return toast(`"${output}" is not in the output alphabet.`,"error");
      if(this.machine.type==="DFA"&&this.machine.transitions.some(t=>t.from===from&&t.symbol===symbol))return toast("Invalid DFA: that state already has a transition for this symbol.","error");
      this.mutate(()=>this.machine.transitions.push(makeTransition({from,to,symbol,output})));closeModal();toast("Transition added.","success");
    };
  }
  chooseStateTool(kind){
    if(!this.machine.states.length)return toast("Add a state first.","error");
    toast(`Select a state to ${kind==="start"?"set as the start state":"toggle as a final state"}.`,"info");
    this.pendingTool=kind;
  }
  selectState(id){
    if(this.pendingTool){if(this.pendingTool==="start")this.setStart(id,true);else this.setFinal(id,!this.getState(id).isFinal);this.pendingTool=null;return}
    this.selected={type:"state",id};this.refreshSelection();this.canvas.render();
  }
  selectTransition(id){this.selected={type:"transition",id};this.selectPropertyTab("transition");this.refreshSelection();this.canvas.render()}
  setStart(id,value){
    if(!id)return;this.mutate(()=>this.machine.states.forEach(s=>s.isStart=s.id===id&&value));this.selected={type:"state",id};this.refreshSelection();toast(value?"Start state updated.":"Start state cleared.","success");
  }
  setFinal(id,value){if(!id||["MEALY","MOORE"].includes(this.machine.type))return;this.mutate(()=>{const s=this.getState(id);if(s)s.isFinal=value});this.selected={type:"state",id};this.refreshSelection()}
  updateSelectedState(patch){
    if(this.selected?.type!=="state")return;const s=this.getState(this.selected.id);if(!s)return;
    if(patch.name!==undefined){const name=patch.name.trim();if(name&&this.machine.states.some(x=>x.id!==s.id&&x.name===name))return toast("That state name is already used.","error")}
    this.mutate(()=>Object.assign(s,patch),{history:true});
  }
  updateSelectedTransition(patch){
    if(this.selected?.type!=="transition")return;const t=this.getTransition(this.selected.id);if(!t)return;
    if(patch.symbol!==undefined&&this.machine.type!=="ENFA"&&!this.machine.inputAlphabet.includes(patch.symbol))return toast("That symbol is not in the input alphabet.","error");
    this.mutate(()=>Object.assign(t,patch),{history:true});
  }
  refreshSelection(){
    const s=this.selected?.type==="state"?this.getState(this.selected.id):null;
    $("stateEditorEmpty").classList.toggle("hidden",!!s);$("stateEditor").classList.toggle("hidden",!s);
    if(s){$("stateNameInput").value=s.name;$("stateStartCheck").checked=s.isStart;$("stateFinalCheck").checked=s.isFinal;$("stateOutputInput").value=s.output||"";$("stateXInput").value=Math.round(s.x);$("stateYInput").value=Math.round(s.y);$("stateFinalCheck").disabled=["MEALY","MOORE"].includes(this.machine.type)}
    const t=this.selected?.type==="transition"?this.getTransition(this.selected.id):null;
    $("transitionEditorEmpty").classList.toggle("hidden",!!t);$("transitionEditor").classList.toggle("hidden",!t);
    if(t){this.fillTransitionSelects();$("transitionFromInput").value=t.from;$("transitionToInput").value=t.to;$("transitionSymbolInput").value=t.symbol;$("transitionOutputInput").value=t.output||""}
    this.renderTransitionSummary(t);
    this.updateLegends();
  }
  fillTransitionSelects(){const opts=this.machine.states.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");$("transitionFromInput").innerHTML=opts;$("transitionToInput").innerHTML=opts}
  deleteSelected(){if(!this.selected)return toast("Nothing is selected.","info");if(this.selected.type==="state")this.deleteState(this.selected.id);else this.deleteTransition(this.selected.id)}
  deleteState(id){
    if(!id)return;const s=this.getState(id);if(!s)return;
    this.mutate(()=>{this.machine.states=this.machine.states.filter(x=>x.id!==id);this.machine.transitions=this.machine.transitions.filter(t=>t.from!==id&&t.to!==id)});this.selected=null;this.refreshSelection();toast(`State "${s.name}" deleted.`,"success");
  }
  deleteTransition(id){const t=this.getTransition(id);if(!t)return;this.mutate(()=>this.machine.transitions=this.machine.transitions.filter(x=>x.id!==id));this.selected=null;this.refreshSelection();toast("Transition deleted.","success")}
  startQuickTransition(){
    this.quickTransition={active:true,from:null};
    this.canvas.panMode=false;
    document.getElementById("addTransitionTool")?.classList.add("active");
    document.getElementById("quickInstruction")?.classList.remove("hidden");
    this.status("Quick Transition: click SOURCE state → DESTINATION state");
    toast("Quick Transition ON — click the source state, then the destination state. Press Esc to cancel.","info");
    this.canvas.render();
  }
  handleQuickStateClick(id){
    if(!this.quickTransition.active)return false;
    if(!this.quickTransition.from){
      this.quickTransition.from=id;
      toast(`Source selected: ${this.getState(id)?.name||"state"}. Now click the destination state.` ,"info");
      this.canvas.render();
      return true;
    }
    const from=this.quickTransition.from,to=id;
    this.quickTransition={active:false,from:null};
    document.getElementById("addTransitionTool")?.classList.remove("active");
    document.getElementById("quickInstruction")?.classList.add("hidden");
    if(from===to){
      const symbol=window.prompt("Input symbol for the self-loop (use ε for epsilon):",this.machine.type==="ENFA"?"ε":"0");
      if(symbol===null){this.status("Ready");return true;}
      this.createQuickTransition(from,to,symbol.trim());
      return true;
    }
    const defaultSymbol=this.machine.type==="ENFA"?"0":"0";
    const symbol=window.prompt(`Input symbol for ${this.getState(from)?.name||"source"} → ${this.getState(to)?.name||"destination"}${this.machine.type==="ENFA"?" (type ε for epsilon)":""}:`,defaultSymbol);
    if(symbol===null){this.status("Ready");this.canvas.render();return true;}
    this.createQuickTransition(from,to,symbol.trim());
    return true;
  }
  createQuickTransition(from,to,symbol){
    if(!symbol)return toast("Transition cancelled: enter a symbol.","error");
    if(this.machine.type==="ENFA" && symbol.toLowerCase()==="epsilon")symbol="ε";
    const output=this.machine.type==="MEALY"?(window.prompt("Output symbol (Mealy):","")||"").trim():"";
    this.mutate(()=>this.machine.transitions.push(makeTransition({from,to,symbol,output})));
    const created=this.machine.transitions[this.machine.transitions.length-1];
    this.selected={type:"transition",id:created.id};
    this.selectPropertyTab("transition");
    toast(`Transition ${this.getState(from)?.name||from} → ${this.getState(to)?.name||to} on ${symbol} created.`,"success");
    this.status("Ready");
    this.canvas.render();
  }
  addAlphabetSymbol(kind){
    const field=kind==="input"?$("inputSymbolField"):$("outputSymbolField"),v=field.value.trim();if(!v)return;
    const arr=kind==="input"?this.machine.inputAlphabet:this.machine.outputAlphabet;if(arr.includes(v))return toast("Duplicate symbols are not allowed.","error");
    this.mutate(()=>arr.push(v));field.value="";toast(`${kind==="input"?"Input":"Output"} symbol "${v}" added.`,"success");
  }
  removeAlphabetSymbol(kind,symbol){
    this.mutate(()=>{const arr=kind==="input"?this.machine.inputAlphabet:this.machine.outputAlphabet;const i=arr.indexOf(symbol);if(i>=0)arr.splice(i,1)});
    toast(`Symbol "${symbol}" removed.`,"success");
  }
  undo(){if(!this.history.length)return toast("Nothing to undo.","info");this.future.push(JSON.stringify(this.machine));this.machine=normalizeMachine(JSON.parse(this.history.pop()));this.workspaces[this.machine.type]=this.machine;this.selected=null;this.syncTypeUI();persistWorkspaces(this.workspaces);this.renderAll();this.canvas.render();toast("Undo complete.","success")}
  redo(){if(!this.future.length)return toast("Nothing to redo.","info");this.history.push(JSON.stringify(this.machine));this.machine=normalizeMachine(JSON.parse(this.future.pop()));this.workspaces[this.machine.type]=this.machine;this.selected=null;this.syncTypeUI();persistWorkspaces(this.workspaces);this.renderAll();this.canvas.render();toast("Redo complete.","success")}
  runSimulation(){
    const input=$("inputString").value;
    const result=simulate(this.machine,input);this.simResult=result;this.stepIndex=result.trace?.length||0;this.activeStates=new Set(result.current||[]);
    this.showResult(result);this.renderTrace(result.trace||[]);this.selectTab("step");this.canvas.render();this.status(result.error?"Simulation stopped":"Simulation complete");
  }
  stepSimulation(){
    const input=$("inputString").value;const result=simulate(this.machine,input);
    if(result.error){this.showResult(result);return}
    this.simResult=result;this.stepIndex=Math.min(this.stepIndex+1,result.trace.length-1);
    const row=result.trace[this.stepIndex]||result.trace[0];this.activeStates=new Set(row.next?.length?row.next:(row.current||[]));
    this.showResult({...result,accepted:undefined,partial:true});this.renderTrace(result.trace.slice(0,this.stepIndex+1),this.stepIndex);this.selectTab("step");this.canvas.render();
  }
  resetSimulation(){this.simResult=null;this.stepIndex=0;this.activeStates=new Set();$("resultBox").classList.add("hidden");$("outputSummary").classList.add("hidden");$("stepSummary").textContent="Run or step through an input to see the trace.";this.renderTrace([]);this.canvas.render();this.status("Ready")}
  showResult(result){
    const box=$("resultBox"),out=$("outputSummary");box.classList.remove("hidden","accept","reject");
    if(result.error){box.classList.add("reject");box.innerHTML=`<strong>Simulation Error</strong><div><span>${escapeHTML(result.error)}</span></div>`}
    else if(this.machine.type==="MEALY"||this.machine.type==="MOORE"){box.classList.add("accept");box.innerHTML=`<strong>Simulation Complete</strong><div><span>Trace generated for ${escapeHTML($("inputString").value||"ε")}.</span></div>`;out.classList.remove("hidden");out.innerHTML=`Output sequence: <b>${escapeHTML((result.output||[]).join(" "))}</b>`}
    else if(result.partial){box.classList.add("accept");box.innerHTML=`<strong>Step ${this.stepIndex}</strong><div><span>Current active state set highlighted on the canvas.</span></div>`}
    else {box.classList.add(result.accepted?"accept":"reject");box.innerHTML=`<strong>Result: ${result.accepted?"ACCEPTED":"REJECTED"}</strong><div><span>${result.accepted?"The input string is accepted by this machine.":"No accepting state was reached."}</span></div>`}
  }
  renderTrace(trace,activeIndex=-1){
    const head=$("traceTable").querySelector("thead"),body=$("traceTable").querySelector("tbody");
    if(this.machine.type==="MEALY"){head.innerHTML="<tr><th>Step</th><th>State</th><th>Input</th><th>Output</th><th>Next State</th></tr>";body.innerHTML=trace.map((r,i)=>`<tr class="${i===activeIndex?"active-row":""}"><td>${r.step}</td><td>${escapeHTML(this.getState(r.state)?.name||"")}</td><td>${escapeHTML(r.input)}</td><td>${escapeHTML(r.output)}</td><td>${escapeHTML(this.getState(r.next)?.name||"")}</td></tr>`).join("")}
    else if(this.machine.type==="MOORE"){head.innerHTML="<tr><th>Step</th><th>State</th><th>Input</th><th>Output</th></tr>";body.innerHTML=trace.map((r,i)=>`<tr class="${i===activeIndex?"active-row":""}"><td>${r.step}</td><td>${escapeHTML(this.getState(r.state)?.name||"")}</td><td>${escapeHTML(r.input)}</td><td>${escapeHTML(r.output)}</td></tr>`).join("")}
    else if(this.machine.type==="ENFA"){head.innerHTML="<tr><th>Step</th><th>Current States</th><th>Symbol</th><th>Next States</th><th>ε-Closure</th></tr>";body.innerHTML=trace.map((r,i)=>`<tr class="${i===activeIndex?"active-row":""}"><td>${r.step}</td><td>{${r.current.map(id=>escapeHTML(this.getState(id)?.name||"")).join(", ")}}</td><td>${escapeHTML(r.symbol)}</td><td>{${r.next.map(id=>escapeHTML(this.getState(id)?.name||"")).join(", ")}}</td><td>{${(r.closure||[]).map(id=>escapeHTML(this.getState(id)?.name||"")).join(", ")}}</td></tr>`).join("")}
    else {head.innerHTML="<tr><th>Step</th><th>Current State(s)</th><th>Read Symbol</th><th>Next State(s)</th></tr>";body.innerHTML=trace.map((r,i)=>`<tr class="${i===activeIndex?"active-row":""}"><td>${r.step}</td><td>{${r.current.map(id=>escapeHTML(this.getState(id)?.name||"")).join(", ")}}</td><td>${escapeHTML(r.symbol)}</td><td>{${r.next.map(id=>escapeHTML(this.getState(id)?.name||"")).join(", ")}}</td></tr>`).join("")}
    if(trace.length){
      const idx=Math.max(0,Math.min(activeIndex>=0?activeIndex:trace.length-1,trace.length-1));
      const r=trace[idx];
      const names=ids=>(ids||[]).map(id=>this.getState(id)?.name||id).join(", ");
      const current=names(r.current);
      const next=names(r.next);
      const symbol=r.symbol||"—";
      let detail=`<b>Step ${r.step||0}:</b> reading <span class="step-symbol">${escapeHTML(symbol)}</span> from <b>${escapeHTML(current||"—")}</b>`;
      if(this.machine.type==="MEALY") detail+=` → next <b>${escapeHTML(next||"—")}</b>${r.output?` with output <b>${escapeHTML(r.output)}</b>`:""}`;
      else if(this.machine.type==="MOORE") detail+=` → <b>${escapeHTML(current||"—")}</b>${r.output?` with output <b>${escapeHTML(r.output)}</b>`:""}`;
      else detail+=` → next <b>${escapeHTML(next||"—")}</b>`;
      $("stepSummary").innerHTML=`<div><b>${this.machineLabel(this.machine.type)} Step-by-Step</b> — the symbol is the input currently being consumed to choose the transition.</div><div class="step-current">${detail}</div>`;
    }else $("stepSummary").innerHTML="Run or step through an input to see the trace.";
  }
  selectTab(tab){document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===tab));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===`tab-${tab}`))}
  selectPropertyTab(tab){document.querySelectorAll(".property-tab").forEach(t=>t.classList.toggle("active",t.dataset.propertyTab===tab));$("stateProperties").classList.toggle("active",tab==="state");$("transitionProperties").classList.toggle("active",tab==="transition")}
  showValidation(){const v=validateMachine(this.machine);this.selectTab("validation");$("validationPanel").className="validation-panel";$("validationPanel").innerHTML=`<div class="validation-header ${v.valid?"valid":"invalid"}">${v.valid?"✓ Machine is valid":"⚠ Machine has validation errors"}</div>${v.errors.length?`<ul class="validation-list">${v.errors.map(x=>`<li>${escapeHTML(x)}</li>`).join("")}</ul>`:""}${v.warnings.length?`<div class="modal-note" style="margin-top:10px"><b>Warnings</b><ul class="validation-list">${v.warnings.map(x=>`<li>${escapeHTML(x)}</li>`).join("")}</ul></div>`:""}`;this.status(v.valid?"Valid":"Validation errors");toast(v.valid?"Machine is valid.":"Validation found issues.","info")}
  convert(){
    const choice=$("conversionSelect").value;if(!choice)return toast("Choose a conversion first.","info");
    const v=validateMachine(this.machine);if(!v.valid)return toast("Fix validation errors before conversion.","error");
    try{
      let result;
      if(choice==="NFA_DFA"&&this.machine.type==="NFA")result=nfaToDfa(this.machine);
      else if(choice==="ENFA_NFA"&&this.machine.type==="ENFA")result=enfaToNfa(this.machine);
      else if(choice==="ENFA_DFA"&&this.machine.type==="ENFA")result=enfaToDfa(this.machine);
      else if(choice==="MEALY_MOORE"&&this.machine.type==="MEALY")result=mealyToMoore(this.machine);
      else if(choice==="MOORE_MEALY"&&this.machine.type==="MOORE")result=mooreToMealy(this.machine);
      else return toast("That conversion does not match the current machine type.","error");
      this.history.push(JSON.stringify(this.machine));this.machine=normalizeMachine(result);this.workspaces[this.machine.type]=this.machine;this.selected=null;persistWorkspaces(this.workspaces);this.syncTypeUI();this.renderAll();this.canvas.resetView();toast("Conversion completed. The converted machine is now active.","success");
    }catch(e){toast(`Conversion failed: ${e.message}`,"error")}
  }
  async exportPNG(){
    try{
      const svg=this.canvas.buildExportSVG();
      const xml=new XMLSerializer().serializeToString(svg);
      const blob=new Blob([xml],{type:"image/svg+xml;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const img=new Image();
      img.onload=()=>{
        const scale=2;
        const width=Math.max(900,Math.round(svg.viewBox.baseVal.width))*scale;
        const height=Math.max(600,Math.round(svg.viewBox.baseVal.height))*scale;
        const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim()||"#ffffff";
        ctx.fillRect(0,0,width,height);
        ctx.drawImage(img,0,0,width,height);
        URL.revokeObjectURL(url);
        canvas.toBlob(png=>{
          if(!png)return toast("Could not create PNG.","error");
          const a=document.createElement("a");a.href=URL.createObjectURL(png);a.download=`fsm-${this.machine.type.toLowerCase()}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
          toast("FSM canvas saved as PNG.","success");
        },"image/png");
      };
      img.onerror=()=>{URL.revokeObjectURL(url);toast("Could not export the canvas as PNG.","error")};
      img.src=url;
    }catch(e){toast(`PNG export failed: ${e.message}`,"error")}
  }
  settings(){showModal("Settings",`<div class="modal-form"><div class="modal-note">Theme preference is stored in LocalStorage. JSON files are downloaded directly by your browser. No backend or database is required.</div><label>Current Theme</label><select id="settingsTheme"><option value="light">Light</option><option value="dark">Dark</option></select></div>`,`<button class="btn primary" id="modalConfirm">Done</button>`);$("settingsTheme").value=document.documentElement.dataset.theme;$("settingsTheme").onchange=e=>this.setTheme(e.target.value);$("modalConfirm").onclick=closeModal}
  setTheme(theme){document.documentElement.dataset.theme=theme;saveTheme(theme);$("themeToggle").textContent=theme==="dark"?"☾":"☼";$("themeToggle").classList.toggle("theme-light",theme!=="dark")}
  toggleTheme(){this.setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark")}
  editState(id){this.selectState(id);this.selectPropertyTab("state");$("stateNameInput").focus()}
  updateZoom(){$("zoomLabel").textContent=`${Math.round(this.canvas.zoom*100)}%`}
  renderAlphabet(){
    $("inputAlphabetChips").innerHTML=this.machine.inputAlphabet.map(s=>`<span class="chip">${escapeHTML(s)} <button title="Remove symbol" data-remove-input="${escapeHTML(s)}">×</button></span>`).join("")||`<span style="font-size:11px;color:var(--muted)">No symbols</span>`;
    $("outputAlphabetChips").innerHTML=this.machine.outputAlphabet.map(s=>`<span class="chip">${escapeHTML(s)} <button title="Remove symbol" data-remove-output="${escapeHTML(s)}">×</button></span>`).join("")||`<span style="font-size:11px;color:var(--muted)">No outputs</span>`;
    document.querySelectorAll("[data-remove-input]").forEach(b=>b.onclick=()=>this.removeAlphabetSymbol("input",b.dataset.removeInput));
    document.querySelectorAll("[data-remove-output]").forEach(b=>b.onclick=()=>this.removeAlphabetSymbol("output",b.dataset.removeOutput));
  }
  updateLegends(){const start=this.machine.states.find(s=>s.isStart);const finals=this.machine.states.filter(s=>s.isFinal);$("startLegend").textContent=start?start.name:"—";$("finalLegend").textContent=["MEALY","MOORE"].includes(this.machine.type)?"—":(finals.length?finals.map(s=>s.name).join(", "):"—")}
  renderFormalDefinition(){
    const q=this.machine.states.map(s=>s.name).join(", ")||"∅";
    const sigma=this.machine.inputAlphabet.join(", ")||"∅";
    const gamma=this.machine.outputAlphabet.join(", ")||"∅";
    const start=this.machine.states.find(s=>s.isStart)?.name||"—";
    const finals=this.machine.states.filter(s=>s.isFinal).map(s=>s.name).join(", ")||"∅";
    const delta=this.machine.type==="DFA"?"Q × Σ → Q":this.machine.type==="NFA"?"Q × Σ → P(Q)":this.machine.type==="ENFA"?"Q × (Σ ∪ {ε}) → P(Q)":"Q × Σ → Q";
    const tuple=this.machine.type==="DFA"||this.machine.type==="NFA"||this.machine.type==="ENFA"?"5-tuple":"6-tuple";
    const lambda=this.machine.type==="MOORE"?"λ: Q → Γ":this.machine.type==="MEALY"?"λ: Q × Σ → Γ":"";
    const el=$("formalDefinition");
    if(!el)return;
    el.innerHTML=`<div class="tuple-badge">${tuple}</div><div class="tuple-expression">${this.machine.type==="DFA"||this.machine.type==="NFA"||this.machine.type==="ENFA"?"(Q, Σ, δ, q₀, F)":"(Q, Σ, Γ, δ, λ, q₀)"}</div><div class="tuple-grid"><div><b>Q</b><span>States: ${escapeHTML(q)}</span></div><div><b>Σ</b><span>Input Alphabet: ${escapeHTML(sigma)}</span></div>${this.machine.type==="MEALY"||this.machine.type==="MOORE"?`<div><b>Γ</b><span>Output Alphabet: ${escapeHTML(gamma)}</span></div>`:""}<div><b>δ</b><span>Transition Function: ${escapeHTML(delta)}</span></div>${lambda?`<div><b>λ</b><span>Output Function: ${escapeHTML(lambda)}</span></div>`:""}<div><b>q₀</b><span>Start / Initial State: ${escapeHTML(start)}</span></div>${["DFA","NFA","ENFA"].includes(this.machine.type)?`<div><b>F</b><span>Final / Accepting States: ${escapeHTML(finals)}</span></div>`:""}</div>`;
  }

  renderTransitionSummary(t){
    const el=$("transitionSummary");if(!el)return;
    if(!t){el.classList.add("hidden");return;}
    const from=this.getState(t.from)?.name||"—",to=this.getState(t.to)?.name||"—";
    if(this.machine.type==="NFA"){
      const next=this.machine.transitions.filter(x=>x.from===t.from&&x.symbol===t.symbol).map(x=>this.getState(x.to)?.name||x.to);
      el.innerHTML=`<div class="transition-summary-title">Transition Definition</div><div class="transition-summary-row"><b>Current State:</b><span>${escapeHTML(from)}</span></div><div class="transition-summary-row"><b>Input Symbol:</b><span>${escapeHTML(t.symbol)}</span></div><div class="transition-summary-row"><b>Next States:</b><span>${escapeHTML([...new Set(next)].join(", "))}</span></div>`;
    }else if(this.machine.type==="ENFA"){
      el.innerHTML=`<div class="transition-summary-title">Transition Definition</div><div class="transition-summary-row"><b>Current State:</b><span>${escapeHTML(from)}</span></div><div class="transition-summary-row"><b>Input Symbol:</b><span>${escapeHTML(t.symbol==="ε"?"ε":t.symbol)}</span></div><div class="transition-summary-row"><b>Next State:</b><span>${escapeHTML(to)}</span></div>`;
    }else if(this.machine.type==="MEALY"){
      el.innerHTML=`<div class="transition-summary-title">Transition Definition</div><div class="transition-summary-row"><b>Current State:</b><span>${escapeHTML(from)}</span></div><div class="transition-summary-row"><b>Input Symbol:</b><span>${escapeHTML(t.symbol)}</span></div><div class="transition-summary-row"><b>Next State:</b><span>${escapeHTML(to)}</span></div><div class="transition-summary-row"><b>Output:</b><span>${escapeHTML(t.output||"—")}</span></div>`;
    }else{
      el.innerHTML=`<div class="transition-summary-title">Transition Definition</div><div class="transition-summary-row"><b>Current State:</b><span>${escapeHTML(from)}</span></div><div class="transition-summary-row"><b>Input Symbol:</b><span>${escapeHTML(t.symbol)}</span></div><div class="transition-summary-row"><b>Next State:</b><span>${escapeHTML(to)}</span></div>`;
    }
    el.classList.remove("hidden");
  }

  renderTransitionTable(){
    const el=$("transitionMatrix");
    if(!el)return;

    const states=this.machine.states||[];
    // ε is a transition label for ε-NFA, but it is not part of the ordinary input alphabet Σ.
    const symbols=this.machine.type==="ENFA"
      ? [...new Set([...(this.machine.inputAlphabet||[]), "ε"])]
      : [...(this.machine.inputAlphabet||[])];
    const phi="φ";

    if(!states.length){
      el.innerHTML=`<div class="matrix-empty">Add states to generate the transition table.</div>`;
      return;
    }

    if(!symbols.length && this.machine.type!=="MOORE"){
      el.innerHTML=`<div class="matrix-empty">Add input symbols to generate the transition table.</div>`;
      return;
    }

    const headerSymbols=symbols.map(s=>`<th>Input ${escapeHTML(s)}</th>`).join("");
    let html=`<table class="transition-table"><thead><tr><th>Current State</th>`;

    // Moore output belongs to the state, not to a transition.
    if(this.machine.type==="MOORE"){
      html+=`<th>Output</th>${headerSymbols}`;
    }else{
      html+=headerSymbols;
    }
    html+=`</tr></thead><tbody>`;

    for(const state of states){
      html+=`<tr><td><b>${escapeHTML(state.name)}</b></td>`;

      if(this.machine.type==="MOORE"){
        html+=`<td>${escapeHTML(state.output||phi)}</td>`;
      }

      for(const symbol of symbols){
        const ts=this.machine.transitions.filter(t=>t.from===state.id && t.symbol===symbol);
        let value=phi;

        if(ts.length){
          if(this.machine.type==="NFA" || this.machine.type==="ENFA"){
            // NFA/ε-NFA can have multiple destinations for the same state/symbol pair.
            value=[...new Set(ts.map(t=>this.getState(t.to)?.name||t.to))].join(", ") || phi;
          }else if(this.machine.type==="MEALY"){
            // Mealy output belongs to the transition: destination / output.
            value=[...new Set(ts.map(t=>{
              const dest=this.getState(t.to)?.name||t.to;
              return `${dest} / ${t.output||phi}`;
            }))].join(", ") || phi;
          }else{
            // DFA should have one destination. Showing all found destinations also makes
            // an accidental duplicate transition visible instead of silently hiding it.
            value=[...new Set(ts.map(t=>this.getState(t.to)?.name||t.to))].join(", ") || phi;
          }
        }

        html+=`<td class="${value===phi?"empty-cell":""}">${escapeHTML(value)}</td>`;
      }
      html+=`</tr>`;
    }

    html+=`</tbody></table>`;
    el.innerHTML=html;
  }

  renderAll(){
    this.syncTypeUI();this.renderAlphabet();this.renderFormalDefinition();this.renderTransitionTable();this.refreshSelection();
    $("stateCount").textContent=this.machine.states.length;$("transitionCount").textContent=this.machine.transitions.length;
    this.updateLegends();this.status("Ready");
  }
  status(text){$("statusText").textContent=text}
}
window.fsmApp=new FSMApp();
