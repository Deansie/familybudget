'use strict';
let pca = null, msAccount = null;
// app-folder scope: can only read or write this one budget.json, nothing else in the drive
const MS_SCOPES = ['Files.ReadWrite.AppFolder'];
const GRAPH_FILE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/budget.json:/content';
const msalConfig = {
  auth: {
    clientId: '31fc0f4f-3641-4644-bddd-252c6ef7e804',
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: location.origin + location.pathname
  },
  cache: { cacheLocation: 'localStorage' }
};

function setOd(level, name, hint){
  $('odDot').className = 'dot' + (level==='ok'?' ok':level==='warn'?' warn':'');
  if(name!=null) $('odName').textContent = name;
  if(hint!=null) $('odHint').innerHTML = hint;
}
function odSignedIn(){
  setOd('ok', msAccount.username || 'Inloggad', 'Synkas automatiskt');
  const b=$('onedriveBtn'); b.textContent='Logga ut'; b.onclick=signOutOneDrive;
}
function odSignedOut(){
  setOd('', 'Inte inloggad', 'Logga in för automatisk synk på alla enheter.');
  const b=$('onedriveBtn'); b.textContent='☁ Logga in med OneDrive'; b.onclick=signInOneDrive;
}

async function initOneDrive(){
  if(typeof msal === 'undefined'){ setOd('warn','OneDrive', 'Kunde inte ladda inloggningsbiblioteket (offline?)'); return; }
  try{
    pca = new msal.PublicClientApplication(msalConfig);
    await pca.initialize();
    const res = await pca.handleRedirectPromise();
    if(res && res.account) msAccount = res.account;
    if(!msAccount){ const a = pca.getAllAccounts(); if(a.length) msAccount = a[0]; }
  }catch(e){ console.warn('MSAL init', e); setOd('warn','OneDrive','Inloggning misslyckades'); return; }

  if(msAccount){ odSignedIn(); await pullFromOneDrive(); }
  else odSignedOut();
}

async function getToken(){
  if(!pca || !msAccount) return null;
  try{
    const r = await pca.acquireTokenSilent({ scopes: MS_SCOPES, account: msAccount });
    return r.accessToken;
  }catch(e){
    console.warn('Tyst token misslyckades, omdirigerar', e);
    await pca.acquireTokenRedirect({ scopes: MS_SCOPES, account: msAccount });
    return null;
  }
}

function signInOneDrive(){
  if(!pca){ toast('warn','OneDrive ej redo'); return; }
  pca.loginRedirect({ scopes: MS_SCOPES });
}
function signOutOneDrive(){
  if(!pca || !msAccount) return;
  localStorage.removeItem(STORAGE_KEY);
  pca.logoutRedirect({ account: msAccount, postLogoutRedirectUri: msalConfig.auth.redirectUri });
}

// tombstones: keep the newest delete-time per month so a deleted month does not come back
function mergeTombstones(a, b){
  const out = { ...(b||{}) };
  const x = a || {};
  for(const k in x) out[k] = Math.max(out[k]||0, x[k]);
  return out;
}
// real = has been edited (updatedAt) or has rows; the blank startup template must never overwrite the cloud
function monthHasData(m){ return !!m && ((m.updatedAt||0) > 0 || (m.income && m.income.length) || (m.expenses && m.expenses.length)); }
// per-month merge, newest updatedAt wins. On a tie keep the LOCAL object: the DOM holds
// references to it, so swapping in a cloud clone would orphan an in-progress edit and lose it.
function mergeMonths(local, cloud, tombstones){
  const out = { ...cloud };
  for(const k in local){
    const l = local[k], c = cloud[k];
    if(c){
      const ln = l.updatedAt||0, cn = c.updatedAt||0;
      if(ln > cn || (ln === cn && monthHasData(l))) out[k] = l;
    } else if(monthHasData(l)){
      out[k] = l;
    }
  }
  if(tombstones){
    for(const k in tombstones){
      if(out[k] && (out[k].updatedAt||0) <= tombstones[k]) delete out[k];
    }
  }
  return out;
}
function mergeCloud(cloud){
  if(!cloud || !cloud.months) return;
  state.deletedMonths = mergeTombstones(state.deletedMonths, cloud.deletedMonths);
  state.months = mergeMonths(state.months, cloud.months, state.deletedMonths);
  ensureCurrentMonthValid();
}
function ensureCurrentMonthValid(){
  const keys = Object.keys(state.months);
  if(!keys.length){ const k = monthKey(new Date()); state.months[k] = { income:[], expenses:[] }; state.currentMonth = k; return; }
  if(!state.months[state.currentMonth]) state.currentMonth = keys.sort().reverse()[0];
}

// merge the cloud copy into local instead of overwriting; 404 means first run, so seed from local
async function pullFromOneDrive(){
  const token = await getToken(); if(!token) return;
  setOd('ok', null, 'Hämtar…');
  try{
    const r = await fetch(GRAPH_FILE, { headers:{ Authorization:'Bearer '+token } });
    if(r.status === 404){ await pushToOneDrive(); return; }
    if(!r.ok) throw new Error('GET '+r.status);
    const text = (await r.text()).trim();
    if(text){
      const cloud = JSON.parse(text);
      if(cloud.theme && cloud.theme !== state.theme){ state.theme = cloud.theme; applyTheme(); }
      const before = JSON.stringify(state.months);
      mergeCloud(cloud);
      persistLocal();
      // repaint only if the merge changed data and no edit is in progress
      if(JSON.stringify(state.months) !== before && !isEditing()) render();
    }
    setOd('ok', null, 'Synkad '+timeNow());
  }catch(e){ console.warn('OneDrive-hämtning', e); setOd('warn', null, 'Synk misslyckades'); }
}

// read-merge-write so we never clobber a month another device changed. A 412 from If-Match means
// someone wrote first, so re-merge and retry; pushing/pushQueued coalesces the rapid autosaves.
let pushing = false, pushQueued = false;
async function pushToOneDrive(){
  if(pushing){ pushQueued = true; return; }
  pushing = true;
  try{
    const token = await getToken(); if(!token) return;
    for(let attempt = 0; attempt < 3; attempt++){
      let etag = null;
      const g = await fetch(GRAPH_FILE, { headers:{ Authorization:'Bearer '+token } });
      if(g.ok){
        etag = g.headers.get('ETag');
        const text = (await g.text()).trim();
        if(text) mergeCloud(JSON.parse(text));
      }
      const headers = { Authorization:'Bearer '+token, 'Content-Type':'application/json' };
      if(etag) headers['If-Match'] = etag;
      const r = await fetch(GRAPH_FILE, { method:'PUT', headers, body: JSON.stringify(state, null, 2) });
      if(r.status === 412) continue;
      if(!r.ok) throw new Error('PUT '+r.status);
      persistLocal(); setOd('ok', null, 'Synkad '+timeNow());
      return;
    }
    setOd('warn', null, 'Kunde inte synka');
  }catch(e){ console.warn('OneDrive-sparning', e); setOd('warn', null, 'Kunde inte synka'); }
  finally{
    pushing = false;
    if(pushQueued){ pushQueued = false; pushToOneDrive(); }
  }
}
