import {transitionLabel} from "./transition.js";
const NS="http://www.w3.org/2000/svg";

export class CanvasRenderer{
  constructor(svg,app){
    this.svg=svg;this.app=app;this.viewport=svg.querySelector("#canvasViewport");
    this.transitionLayer=svg.querySelector("#transitionLayer");this.stateLayer=svg.querySelector("#stateLayer");this.startLayer=svg.querySelector("#startArrowLayer");
    this.zoom=1;this.pan={x:0,y:0};this.drag=null;this.panning=null;this.panMode=false;this.suppressClick=false;this.bind();
  }
  bind(){
    this.svg.addEventListener("mousedown",e=>{
      const onBlank=!e.target.closest?.(".state-group,.transition-path,.transition-label");
      const shouldPan=e.button===1||(e.button===0&&(e.shiftKey||this.svg.classList.contains("space-pan")||this.panMode||onBlank));
      if(shouldPan){
        e.preventDefault();
        this.panning={x:e.clientX,y:e.clientY,px:this.pan.x,py:this.pan.y,moved:false};
        this.svg.classList.add("panning");
      }
    });
    window.addEventListener("mousemove",e=>{
      if(this.panning){
        const dx=e.clientX-this.panning.x,dy=e.clientY-this.panning.y;
        if(Math.abs(dx)+Math.abs(dy)>3)this.panning.moved=true;
        this.pan.x=this.panning.px+dx;this.pan.y=this.panning.py+dy;this.render();
      }
      if(this.drag){
        const p=this.screenToWorld(e.clientX,e.clientY);
        this.drag.state.x=p.x+this.drag.dx;this.drag.state.y=p.y+this.drag.dy;
        this.app.markDirty();this.render();
      }
    });
    window.addEventListener("mouseup",()=>{
      if(this.drag){this.app.pushHistory();this.drag=null}
      if(this.panning){if(this.panning.moved)this.suppressClick=true;this.panning=null;this.svg.classList.remove("panning")}
    });
    window.addEventListener("keydown",e=>{if(e.code==="Space"&&!e.repeat)this.svg.classList.add("space-pan")});
    window.addEventListener("keyup",e=>{if(e.code==="Space")this.svg.classList.remove("space-pan")});
    this.svg.addEventListener("wheel",e=>{e.preventDefault();this.setZoom(this.zoom*(e.deltaY<0?1.1:.9),e.clientX,e.clientY)},{passive:false});
    this.svg.addEventListener("dblclick",e=>{const g=e.target.closest?.(".state-group");if(g)this.app.editState(g.dataset.id);});
  }
  setZoom(z,cx,cy){
    const old=this.zoom;this.zoom=Math.max(.45,Math.min(2.4,z));
    if(cx!==undefined&&cy!==undefined){const r=this.svg.getBoundingClientRect(),sx=cx-r.left,sy=cy-r.top;this.pan.x=sx-(sx-this.pan.x)*(this.zoom/old);this.pan.y=sy-(sy-this.pan.y)*(this.zoom/old)}
    this.render();this.app.updateZoom();
  }
  resetView(){this.zoom=1;this.pan={x:0,y:0};this.render();this.app.updateZoom();}
  worldToScreen(x,y){return {x:x*this.zoom+this.pan.x,y:y*this.zoom+this.pan.y}}
  screenToWorld(clientX,clientY){const r=this.svg.getBoundingClientRect();return {x:(clientX-r.left-this.pan.x)/this.zoom,y:(clientY-r.top-this.pan.y)/this.zoom}}
  render(){
    this.viewport.setAttribute("transform",`translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);
    this.transitionLayer.innerHTML="";this.stateLayer.innerHTML="";this.startLayer.innerHTML="";
    const m=this.app.machine;
    const byPair=new Map();
    for(const t of m.transitions){const key=t.from===t.to?`loop:${t.from}`:[t.from,t.to].sort().join("::");if(!byPair.has(key))byPair.set(key,[]);byPair.get(key).push(t);}
    for(const t of m.transitions)this.drawTransition(t,byPair.get(t.from===t.to?`loop:${t.from}`:[t.from,t.to].sort().join("::"))||[]);
    for(const s of m.states)this.drawState(s);
    const start=m.states.find(s=>s.isStart);if(start)this.drawStartArrow(start);
    document.getElementById("canvasEmpty").classList.toggle("hidden",m.states.length>0);
  }
  el(tag,attrs){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);return e}
  drawTransition(t,group){
    const from=this.app.getState(t.from),to=this.app.getState(t.to);if(!from||!to)return;
    let path,labelX,labelY;
    if(from.id===to.id){
      path=this.el("path",{d:`M ${from.x-14} ${from.y-32} C ${from.x-70} ${from.y-115}, ${from.x+70} ${from.y-115}, ${from.x+14} ${from.y-32}`,"class":"transition-path"+(this.app.selected?.type==="transition"&&this.app.selected.id===t.id?" selected":"")});
      labelX=from.x;labelY=from.y-98;
    }else{
      const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,off=(group.length>1?(group.indexOf(t)-(group.length-1)/2)*42:0),nx=-uy,ny=ux;
      const r=34,sx=from.x+ux*r,sy=from.y+uy*r,ex=to.x-ux*r,ey=to.y-uy*r;
      const cx=(sx+ex)/2+nx*off,cy=(sy+ey)/2+ny*off;
      path=this.el("path",{d:`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,"class":"transition-path"+(this.app.selected?.type==="transition"&&this.app.selected.id===t.id?" selected":"")});
      labelX=(sx+2*cx+ex)/4;labelY=(sy+2*cy+ey)/4-7;
    }
    path.dataset.id=t.id;path.addEventListener("click",e=>{e.stopPropagation();this.app.selectTransition(t.id);});
    this.transitionLayer.appendChild(path);
    const label=this.el("text",{x:labelX,y:labelY,"class":"transition-label"});label.textContent=transitionLabel(this.app.machine,t);this.transitionLayer.appendChild(label);
  }
  drawState(s){
    const g=this.el("g",{"class":`state-group ${s.isStart?"start ":""}${s.isFinal?"final ":""}${this.app.selected?.type==="state"&&this.app.selected.id===s.id?"selected ":""}${this.app.activeStates?.has(s.id)?"active":""}`,"data-id":s.id});
    const c=this.el("circle",{cx:s.x,cy:s.y,r:34,"class":"state-circle"});g.appendChild(c);
    if(s.isFinal)g.appendChild(this.el("circle",{cx:s.x,cy:s.y,r:40,"class":"final-ring"}));
    const text=this.el("text",{x:s.x,y:s.output&&this.app.machine.type==="MOORE"?s.y-4:s.y,"class":"state-label"});text.textContent=s.name;g.appendChild(text);
    if(this.app.machine.type==="MOORE"){const o=this.el("text",{x:s.x,y:s.y+13,"class":"state-output"});o.textContent=`/${s.output||"—"}`;g.appendChild(o)}
    g.addEventListener("click",e=>{e.stopPropagation();if(this.app.handleQuickStateClick(s.id))return;this.app.selectState(s.id);});
    g.addEventListener("mousedown",e=>{
      if(e.button!==0||e.shiftKey||this.panMode||this.app.quickTransition?.active||e.target.closest?.(".transition-path"))return;
      e.stopPropagation();
      const p=this.screenToWorld(e.clientX,e.clientY);this.drag={state:s,dx:s.x-p.x,dy:s.y-p.y};this.app.selectState(s.id);
    });
    this.stateLayer.appendChild(g);
  }
  drawStartArrow(s){
    const x=s.x-75,y=s.y;const p=this.el("path",{d:`M ${x} ${y} L ${s.x-38} ${y}`,"class":"start-arrow"});this.startLayer.appendChild(p);
  }
  buildExportSVG(){
    const source=this.svg.cloneNode(true);
    const rect=this.svg.getBoundingClientRect();
    const width=Math.max(900,Math.round(rect.width));
    const height=Math.max(600,Math.round(rect.height));
    source.setAttribute("xmlns","http://www.w3.org/2000/svg");
    source.setAttribute("width",width);source.setAttribute("height",height);source.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const root=getComputedStyle(document.documentElement);
    const vars={
      text:root.getPropertyValue("--text").trim(),canvas:root.getPropertyValue("--canvas").trim(),primary:root.getPropertyValue("--primary").trim(),success:root.getPropertyValue("--success").trim(),muted:root.getPropertyValue("--muted").trim()
    };
    const style=document.createElementNS(NS,"style");
    style.textContent=`
      .canvas-bg{fill:${vars.canvas}} .canvas-grid{color:${root.getPropertyValue("--grid").trim()};opacity:.8}
      .arrow-fill{fill:${vars.text}}
      .transition-path{fill:none;stroke:${vars.text};stroke-width:2;marker-end:url(#arrowHead)}
      .transition-path.selected{stroke:${vars.primary};stroke-width:3}
      .transition-label{font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;fill:${vars.text};paint-order:stroke;stroke:${vars.canvas};stroke-width:5px;stroke-linejoin:round}
      .state-circle{fill:${vars.canvas};stroke:${vars.primary};stroke-width:2.5}
      .state-group.start .state-circle{stroke:${vars.success}}
      .state-group.final .final-ring{fill:none;stroke:#7181ee;stroke-width:2.5}
      .state-group.start.final .final-ring{stroke:${vars.success}}
      .state-label{font-family:Inter,Arial,sans-serif;fill:${vars.text};font-size:14px;font-weight:800;text-anchor:middle;dominant-baseline:middle}
      .state-output{font-family:Inter,Arial,sans-serif;fill:${vars.muted};font-size:10px;font-weight:700;text-anchor:middle}
      .start-arrow{stroke:${vars.success};stroke-width:3;fill:none;marker-end:url(#arrowHead)}
    `;
    source.insertBefore(style,source.firstChild);
    return source;
  }
}
