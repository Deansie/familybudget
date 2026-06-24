'use strict';
function deleteItem(arr, item){
  const idx = arr.indexOf(item);
  if(idx < 0) return;
  const mk = state.currentMonth;
  arr.splice(idx, 1);
  touch(mk); saveDebounced(); render();
  const label = (item.name && item.name.trim())
    ? '"' + item.name.trim() + '"'
    : (isGroup(item) ? 'gruppen' : 'raden');
  toastAction('Tog bort ' + label, 'Ångra', ()=>{
    arr.splice(Math.min(idx, arr.length), 0, item);
    touch(mk); saveDebounced(); render();
  });
}

function addIncome(){ const it={name:'',amount:0}; currentMonth().income.push(it); pendingFocus=it; markDirty(); render(); }
function addExpense(){ const it={name:'',amount:0}; currentMonth().expenses.push(it); pendingFocus=it; markDirty(); render(); }
function addGroup(type){
  const g = {name:'', children:[{name:'',amount:0}], collapsed:false};
  (type==='income' ? currentMonth().income : currentMonth().expenses).push(g);
  pendingFocus = g; markDirty(); render();
}

function newMonth(){
  const dlg = $('monthDialog');
  $('monthInput').value = '';
  $('copyCheck').checked = true;
  dlg.returnValue = '';
  dlg.showModal();
  $('monthForm').onsubmit = (ev)=>{
    const val = (ev.submitter && ev.submitter.value) || 'cancel';
    if(val!=='ok'){ return; }
    const key = $('monthInput').value;
    if(!/^\d{4}-\d{2}$/.test(key)){ ev.preventDefault(); toast('warn','Ogiltig månad'); return; }
    if(state.months[key]){ ev.preventDefault(); toast('warn','Månaden finns redan'); return; }
    state.months[key] = $('copyCheck').checked
      ? JSON.parse(JSON.stringify(currentMonth()))
      : { income:[], expenses:[] };
    state.currentMonth = key;
    markDirty(); render();
    toast('ok','Skapade '+monthLabel(key));
  };
}

function deleteMonth(key){
  if(Object.keys(state.months).length<=1){ toast('warn','Du måste ha minst en månad'); return; }
  showConfirm('Ta bort månad', `Vill du ta bort ${monthLabel(key)}? Detta går inte att ångra.`, ()=>{
    state.deletedMonths = state.deletedMonths || {};
    state.deletedMonths[key] = Date.now();
    delete state.months[key];
    if(state.currentMonth===key) state.currentMonth = Object.keys(state.months).sort().reverse()[0];
    saveDebounced(); render();
    toast('ok','Tog bort '+monthLabel(key));
  });
}

function showConfirm(title, text, onOk){
  const dlg = $('confirmDialog');
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  dlg.showModal();
  dlg.querySelector('form').onsubmit = (ev)=>{
    if(ev.submitter && ev.submitter.value==='ok') onOk();
  };
}

// default: editable on desktop, locked (read-only) on mobile to avoid accidental taps
let editMode = !matchMedia('(max-width:920px)').matches;
function applyEditMode(){
  $('app').classList.toggle('locked', !editMode);
  const b = $('editToggle');
  b.textContent = editMode ? '✓ Klar' : '✎ Redigera';
  b.classList.toggle('on', editMode);
}

function applyTheme(){
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
