'use strict';
const STORAGE_KEY = 'family_budget_v2';
const $ = id => document.getElementById(id);
const MONTH_NAMES = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function formatMoney(v){ return (Math.round(Number(v)||0)).toLocaleString('sv-SE') + ' kr'; }
function timeNow(){ return new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}); }
function monthLabel(key){
  const [y,m] = (key||'').split('-');
  if(!y||!m) return key;
  const name = MONTH_NAMES[Number(m)-1] || m;
  return name.charAt(0).toUpperCase()+name.slice(1)+' '+y;
}
function ensureMonth(key){ if(!state.months[key]) state.months[key] = { income:[], expenses:[] }; }
function currentMonth(){ ensureMonth(state.currentMonth); return state.months[state.currentMonth]; }
function isGroup(it){ return it && Array.isArray(it.children); }
function itemAmount(it){ return isGroup(it) ? it.children.reduce((s,c)=>s+itemAmount(c),0) : (Number(it.amount)||0); }
function sum(arr){ return arr.reduce((s,i)=>s+itemAmount(i),0); }
function countLeaves(arr){ return arr.reduce((n,it)=> n + (isGroup(it) ? countLeaves(it.children) : 1), 0); }
function monthBalance(key){ const m=state.months[key]; return m ? sum(m.income)-sum(m.expenses) : 0; }
