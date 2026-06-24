'use strict';
function render(){ applyTheme(); renderMonthRail(); renderHead(); renderRows(); renderTotals(); }

function sortedKeys(){ return Object.keys(state.months).sort(); }

function renderMonthRail(){
  const rail = $('monthRail'); rail.innerHTML = '';
  const keys = sortedKeys();
  let activeChip = null;

  keys.forEach(k => {
    const chip = document.createElement('button');
    chip.className = 'mchip' + (k===state.currentMonth ? ' active' : '');
    chip.type = 'button';
    const bal = monthBalance(k);
    chip.innerHTML =
      `<span class="mc-name">${monthLabel(k)}</span>`+
      `<span class="mc-bal ${bal<0?'neg':'pos'}">${formatMoney(bal)}</span>`;
    chip.addEventListener('click', ()=>{ state.currentMonth=k; saveDebounced(); render(); });
    if(k===state.currentMonth){
      const del = document.createElement('span');
      del.className='mc-del'; del.title='Ta bort månad'; del.textContent='×';
      del.setAttribute('role','button');
      del.addEventListener('click', (e)=>{ e.stopPropagation(); deleteMonth(k); });
      chip.appendChild(del);
      activeChip = chip;
    }
    rail.appendChild(chip);
  });

  const add = document.createElement('button');
  add.className='mchip add'; add.type='button'; add.title='Ny månad'; add.textContent='+';
  add.addEventListener('click', newMonth);
  rail.appendChild(add);

  if(activeChip){
    // center the active chip by scrolling the rail itself; scrollIntoView would also scroll the page
    const railRect = rail.getBoundingClientRect();
    const chipRect = activeChip.getBoundingClientRect();
    const current = chipRect.left - railRect.left;
    const target  = (rail.clientWidth - activeChip.offsetWidth) / 2;
    rail.scrollLeft += current - target;
  }
}

function renderHead(){
  $('monthTitle').textContent = monthLabel(state.currentMonth);
  const m = currentMonth();
  const inc = countLeaves(m.income), exp = countLeaves(m.expenses);
  $('monthSub').textContent = (inc + exp) ? `${inc} intäkter · ${exp} utgifter` : 'Inga poster ännu';
}

function renderRows(){
  const m = currentMonth();
  const totalExp = sum(m.expenses);
  fillSection('incomeRows', m.income, 'income', 0);
  fillSection('expenseRows', m.expenses, 'expense', totalExp);
}

function fillSection(containerId, list, type, totalExp){
  const c = $(containerId); c.innerHTML = '';
  if(!list.length){
    const e = document.createElement('div'); e.className='empty';
    e.textContent = type==='income' ? 'Inga intäkter ännu.' : 'Inga utgifter ännu.';
    c.appendChild(e); return;
  }
  list.forEach(item=> c.appendChild(createRow(type, item, list, totalExp)));
}

function setBar(fill, label, val, total){
  const pct = total>0 ? (val/total*100) : 0;
  fill.style.width = pct.toFixed(1)+'%';
  fill.classList.toggle('big', pct>=33);
  label.textContent = Math.round(pct)+'%';
}

let pendingFocus = null;
function maybeFocus(item, input){
  if(pendingFocus && item===pendingFocus){
    pendingFocus = null;
    requestAnimationFrame(()=> input.focus());
  }
}
function onEnter(input, fn){
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); fn(); } });
}
function addAfter(arr, item){
  const it = {name:'',amount:0};
  const i = arr.indexOf(item);
  arr.splice(i>-1 ? i+1 : arr.length, 0, it);
  pendingFocus = it; markDirty(); render();
}

function createRow(type, item, arr, totalExp, isChild){
  return isGroup(item)
    ? createGroup(type, item, arr, totalExp)
    : createLeaf(type, item, arr, totalExp, isChild);
}

function createLeaf(type, item, arr, totalExp, isChild){
  const wrap = document.createElement('div'); wrap.className='item';
  wrap._item = item; wrap._arr = arr; wrap._type = type;
  const row = document.createElement('div'); row.className='row';

  const handle = document.createElement('div');
  handle.className='drag-handle'; handle.textContent='⠿'; handle.title='Dra för att flytta';
  handle.setAttribute('aria-label','Flytta rad');
  attachDrag(handle, wrap);

  const name = document.createElement('input');
  name.className='inp name'; name.placeholder='Namn'; name.value=item.name||'';
  name.setAttribute('aria-label','Namn');
  name.addEventListener('input', e=>{ item.name=e.target.value; markDirty(); });
  maybeFocus(item, name);

  const amtWrap = document.createElement('div'); amtWrap.className='amt-wrap';
  const amt = document.createElement('input');
  amt.className='inp amt'; amt.type='number'; amt.placeholder='0'; amt.inputMode='numeric';
  if(isChild){
    amt.classList.add('no-step');
    amt.addEventListener('keydown', ev=>{ if(ev.key==='ArrowUp'||ev.key==='ArrowDown') ev.preventDefault(); });
  } else {
    amt.step='100';
  }
  amt.value = (item.amount!=null && item.amount!==0) ? item.amount : '';
  amt.setAttribute('aria-label','Belopp');
  amt.addEventListener('input', e=>{ item.amount=Number(e.target.value)||0; liveRefresh(); markDirty(); });
  const kr = document.createElement('span'); kr.className='kr'; kr.textContent='kr';
  amtWrap.appendChild(amt); amtWrap.appendChild(kr);

  const addNext = ()=> addAfter(arr, item);
  onEnter(name, addNext); onEnter(amt, addNext);

  const del = document.createElement('button');
  del.className='row-del'; del.type='button'; del.title='Ta bort'; del.textContent='×';
  del.addEventListener('click', ()=> deleteItem(arr, item));

  row.append(handle, name, amtWrap, del);
  wrap.appendChild(row);

  if(type==='expense' && !isChild){
    wrap.appendChild(buildBar(wrap, itemAmount(item), totalExp));
  }
  return wrap;
}

function createGroup(type, item, arr, totalExp){
  if(!Array.isArray(item.children)) item.children = [];
  const wrap = document.createElement('div'); wrap.className='item group';
  if(item.collapsed) wrap.classList.add('collapsed');
  wrap._item = item; wrap._arr = arr; wrap._type = type;

  const row = document.createElement('div'); row.className='row';

  const handle = document.createElement('div');
  handle.className='drag-handle'; handle.textContent='⠿'; handle.title='Dra för att flytta';
  handle.setAttribute('aria-label','Flytta grupp');
  attachDrag(handle, wrap);

  const nameCell = document.createElement('div'); nameCell.className='name-cell';
  const chev = document.createElement('button');
  chev.className='chevron'; chev.type='button'; chev.textContent='▾';
  chev.setAttribute('aria-label','Fäll ihop grupp');
  chev.addEventListener('click', ()=>{
    item.collapsed = !item.collapsed;
    wrap.classList.toggle('collapsed', item.collapsed);
    saveDebounced();
  });
  const name = document.createElement('input');
  name.className='inp name'; name.placeholder='Gruppnamn'; name.value=item.name||'';
  name.setAttribute('aria-label','Gruppnamn');
  name.addEventListener('input', e=>{ item.name=e.target.value; markDirty(); });
  onEnter(name, ()=>{
    const child = {name:'',amount:0};
    item.children.push(child); item.collapsed = false;
    pendingFocus = child; markDirty(); render();
  });
  maybeFocus(item, name);
  nameCell.append(chev, name);

  const total = document.createElement('span');
  total.className='group-total'; total.textContent = formatMoney(itemAmount(item));
  wrap._totalEl = total;

  const del = document.createElement('button');
  del.className='row-del'; del.type='button'; del.title='Ta bort grupp'; del.textContent='×';
  del.addEventListener('click', ()=> deleteItem(arr, item));

  row.append(handle, nameCell, total, del);
  wrap.appendChild(row);

  if(type==='expense') wrap.appendChild(buildBar(wrap, itemAmount(item), totalExp));

  const kids = document.createElement('div'); kids.className='group-children';
  item.children.forEach(child=> kids.appendChild(createLeaf(type, child, item.children, totalExp, true)));
  wrap.appendChild(kids);

  const addWrap = document.createElement('div'); addWrap.className='add-sub';
  const addBtn = document.createElement('button');
  addBtn.className='btn ghost sm'; addBtn.type='button'; addBtn.textContent='+ Lägg till underpost';
  addBtn.addEventListener('click', ()=>{
    const child = {name:'',amount:0};
    item.children.push(child); pendingFocus = child;
    item.collapsed = false;
    markDirty(); render();
  });
  addWrap.appendChild(addBtn);
  wrap.appendChild(addWrap);

  return wrap;
}

function buildBar(wrap, val, total){
  const bar = document.createElement('div'); bar.className='item-bar';
  const track = document.createElement('div'); track.className='ib-track';
  const fill = document.createElement('div'); fill.className='ib-fill';
  track.appendChild(fill);
  const pctLabel = document.createElement('span'); pctLabel.className='ib-pct';
  bar.append(track, pctLabel);
  wrap._barFill = fill; wrap._barPct = pctLabel;
  setBar(fill, pctLabel, val, total);
  return bar;
}

// drag-reorder, scoped to the row's own container (top level or one group) via :scope > .item
function attachDrag(handle, wrap){
  handle.addEventListener('pointerdown', (e)=>{
    if(e.button != null && e.button !== 0) return;
    e.preventDefault();
    const container = wrap.parentElement;
    try{ handle.setPointerCapture(e.pointerId); }catch(_){}
    document.body.classList.add('dragging-active');
    wrap.classList.add('dragging');

    const move = (ev)=>{
      const y = ev.clientY;
      const others = Array.from(container.querySelectorAll(':scope > .item')).filter(n=>n!==wrap);
      let placed = false;
      for(const sib of others){
        const r = sib.getBoundingClientRect();
        if(y < r.top + r.height/2){ container.insertBefore(wrap, sib); placed = true; break; }
      }
      if(!placed) container.appendChild(wrap);
    };
    const up = ()=>{
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging-active');
      wrap.classList.remove('dragging');
      commitOrder(wrap._arr, container);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
}

// rebuild the array in place (length=0 then push) so references the rows hold stay valid
function commitOrder(arr, container){
  if(!arr) return;
  const newArr = Array.from(container.querySelectorAll(':scope > .item')).map(n=>n._item).filter(Boolean);
  arr.length = 0; arr.push.apply(arr, newArr);
  markDirty(); render();
}

function liveRefresh(){
  document.querySelectorAll('#incomeRows .item.group, #expenseRows .item.group').forEach(g=>{
    if(g._totalEl && g._item) g._totalEl.textContent = formatMoney(itemAmount(g._item));
  });
  renderTotals();
  updateBars();
}
function updateBars(){
  const total = sum(currentMonth().expenses);
  $('expenseRows').querySelectorAll('.item').forEach(el=>{
    if(!el._barFill || !el._barPct || !el._item) return;
    setBar(el._barFill, el._barPct, itemAmount(el._item), total);
  });
}

function renderTotals(){
  const m = currentMonth();
  const income = sum(m.income), expenses = sum(m.expenses), balance = income-expenses;

  $('incomeTotal').textContent  = formatMoney(income);
  $('expenseTotal').textContent = formatMoney(expenses);
  $('balanceTotal').textContent = formatMoney(balance);
  $('balanceTotal').className   = 'value ' + (balance<0?'neg':'pos');
  $('incomeHeadTotal').textContent  = formatMoney(income);
  $('expenseHeadTotal').textContent = formatMoney(expenses);

  const rate = income>0 ? Math.round(balance/income*100) : 0;
  const pill = $('savingsPill');
  pill.textContent = (rate>=0?'↑ ':'↓ ') + Math.abs(rate) + '% sparkvot';
  pill.className = 'pill ' + (balance<0?'neg':'pos');

  const spentPct = income>0 ? Math.min(100, expenses/income*100) : (expenses>0?100:0);
  const fill = $('fbFill');
  fill.style.width = spentPct.toFixed(1)+'%';
  fill.classList.toggle('over', expenses>income && income>0);
  $('fbSpent').textContent  = formatMoney(expenses);
  $('fbIncome').textContent = formatMoney(income);
  $('fbPct').textContent    = (income>0?Math.round(expenses/income*100):0)+'%';
  const left = $('fbLeftLabel');
  left.textContent = (balance<0?'Underskott ':'Kvar ') + formatMoney(Math.abs(balance));
  left.className = 'fb-foot-left';

  const chipBal = document.querySelector('#monthRail .mchip.active .mc-bal');
  if(chipBal){ chipBal.textContent = formatMoney(balance); chipBal.className = 'mc-bal ' + (balance<0?'neg':'pos'); }
}
