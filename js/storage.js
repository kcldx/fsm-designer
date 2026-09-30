const WORKSPACE_KEY="fsm-designer-workspaces";
const LEGACY_KEY="fsm-designer-machine";

export function persist(machine){
  const workspaces=restoreWorkspaces();
  workspaces[machine.type]=machine;
  localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspaces));
  // Keep the legacy key for older versions/bookmarks.
  localStorage.setItem(LEGACY_KEY,JSON.stringify(machine));
}

export function persistWorkspaces(workspaces){
  localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspaces));
  const active=workspaces?.DFA||Object.values(workspaces||{})[0];
  if(active)localStorage.setItem(LEGACY_KEY,JSON.stringify(active));
}

export function restoreWorkspaces(){
  try{
    const raw=localStorage.getItem(WORKSPACE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed;
    }
  }catch{}
  try{
    const legacy=localStorage.getItem(LEGACY_KEY);
    if(legacy){const machine=JSON.parse(legacy);return {[machine.type||"DFA"]:machine};}
  }catch{}
  return {};
}

export function restore(){
  const workspaces=restoreWorkspaces();
  return workspaces.DFA||Object.values(workspaces)[0]||null;
}

export function saveTheme(theme){localStorage.setItem("fsm-designer-theme",theme)}
export function loadTheme(){return localStorage.getItem("fsm-designer-theme")||"light"}
