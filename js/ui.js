export function $(id){return document.getElementById(id)}
export function showModal(title,bodyHTML,actionsHTML=""){ $("modalTitle").textContent=title;$("modalBody").innerHTML=bodyHTML;$("modalActions").innerHTML=actionsHTML;$("modalBackdrop").classList.remove("hidden");}
export function closeModal(){$("modalBackdrop").classList.add("hidden");$("modalBody").innerHTML="";$("modalActions").innerHTML=""}
export function toast(message,type="info"){
  const el=document.createElement("div");el.className=`toast ${type}`;el.textContent=message;$("toastStack").appendChild(el);setTimeout(()=>el.remove(),3200);
}
export function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
