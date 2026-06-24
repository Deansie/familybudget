'use strict';
let state = loadLocal();
const saveDebounced = debounce(saveAll, 600);

function loadLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const p = JSON.parse(raw);
      if(!p.months || typeof p.months !== 'object') p.months = {};
      return p;
    }
  }catch(e){ console.warn('Kunde inte läsa lokalt sparad data', e); }
  const key = monthKey(new Date());
  return { theme:'auto', currentMonth:key, months:{ [key]:{ income:[], expenses:[] } } };
}

function persistLocal(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(e){ console.error('Lokal sparning misslyckades', e); }
}

async function saveAll(){
  state.lastSavedLocal = new Date().toISOString();
  persistLocal();
  if(pca && msAccount) pushToOneDrive();
}

function debounce(fn, wait){
  let t;
  const d = (...a)=>{ clearTimeout(t); t=setTimeout(()=>{ t=null; fn(...a); }, wait); };
  d.flush = ()=>{ if(t){ clearTimeout(t); t=null; fn(); } };
  return d;
}

// stamp the month's updatedAt so the cloud merge can keep the newest copy of each month
function touch(key){ const m = state.months[key]; if(m) m.updatedAt = Date.now(); }
function markDirty(){ touch(state.currentMonth); saveDebounced(); }

// caret in one of our inputs; lets a background sync skip re-rendering during an edit
function isEditing(){ const a = document.activeElement; return !!(a && a.classList && a.classList.contains('inp')); }
