document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  $('addIncomeBtn').addEventListener('click', addIncome);
  $('addExpenseBtn').addEventListener('click', addExpense);
  $('addIncomeGroupBtn').addEventListener('click', ()=>addGroup('income'));
  $('addExpenseGroupBtn').addEventListener('click', ()=>addGroup('expense'));
  $('onedriveBtn').onclick = signInOneDrive;
  $('editToggle').addEventListener('click', ()=>{ editMode=!editMode; applyEditMode(); });

  window.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); saveAll().then(()=>toast('ok','Sparat')); }
  });

  // follow the OS light/dark setting live; addListener is the fallback for older iOS Safari
  const mq = matchMedia('(prefers-color-scheme: dark)');
  if(mq.addEventListener) mq.addEventListener('change', applyTheme);
  else if(mq.addListener) mq.addListener(applyTheme);

  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) saveDebounced.flush();
    else if(pca && msAccount && !isEditing()) pullFromOneDrive();
  });
  window.addEventListener('pagehide', ()=> saveDebounced.flush());

  render();
  applyEditMode();
  initOneDrive();
});
