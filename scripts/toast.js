'use strict';
function buildToast(level, msg){
  const t = document.createElement('div'); t.className='toast';
  const d = document.createElement('span'); d.className='dot '+(level==='warn'?'warn':'ok');
  const s = document.createElement('span'); s.className='toast-msg'; s.textContent=msg;
  t.append(d,s); $('toasts').appendChild(t);
  return t;
}
function dismissToast(t){
  if(t._gone) return; t._gone=true;
  clearTimeout(t._timer);
  t.style.opacity='0'; t.style.transition='opacity .3s';
  setTimeout(()=>t.remove(),300);
}
function toast(level, msg){
  const t = buildToast(level, msg);
  t._timer = setTimeout(()=>dismissToast(t), 2600);
}
function toastAction(msg, actionLabel, onAction){
  const t = buildToast('ok', msg);
  const btn = document.createElement('button');
  btn.className='toast-undo'; btn.type='button'; btn.textContent=actionLabel;
  btn.addEventListener('click', ()=>{ onAction(); dismissToast(t); });
  t.appendChild(btn);
  t._timer = setTimeout(()=>dismissToast(t), 6000);
}
