// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { priceScopePreview } from "@/lib/estimator-preview.functions";
import { detectChanges } from "@/lib/change-detect.functions";
import { estimateDimensions } from "@/lib/dimensions.functions";
import { renderDesign } from "@/lib/design-render.functions";
import { renderPlan3d } from "@/lib/plan3d.functions";
import { runRoomTool } from "@/lib/room-tools.functions";
import { startWalkthrough, pollWalkthrough } from "@/lib/walkthrough.functions";
import { getMyCredits, listCreditHistory } from "@/lib/credits.functions";
import { saveEstimate, listSavedEstimates, deleteSavedEstimate, getWorkspaceSummary, getPropertyTree, saveRoomVersion, setPropertyDna, copyPropertyDna, createProject, setVersionStatus, listRoomVersions } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { uploadRoomPhoto, roomPhotoUrl, isStoredPhoto, uploadRenderDataUrl } from "@/lib/room-photos";
import { getPortfolioReport } from "@/lib/reports.functions";
import { loadSampleWorkspace, removeSampleWorkspace, hasSampleWorkspace } from "@/lib/sample.functions";
import { listPresentations, createPresentation, deletePresentation, getPresentationPackage } from "@/lib/presentations.functions";
import { buildSocialReel } from "@/lib/social-reel";
import { submitFeedback } from "@/lib/feedback";
import { polishFeedback } from "@/lib/feedback.functions";
import { listTeam, inviteMember, revokeInvite, acceptInvite, declineInvite } from "@/lib/team.functions";
import { getPrefs, savePrefs, DEFAULT_PREFS } from "@/lib/prefs";
import { exportMyData, deleteMyAccount } from "@/lib/account.functions";


export function initApp(): () => void {
  const root = document.querySelector('.rd-app') as HTMLElement | null;
  if (root && root.dataset['rdInit'] === '1') return () => {};
  if (root) root.dataset['rdInit'] = '1';
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => { const id = window.setInterval(fn, ms); timers.push(id); return id; };
  const setTimeout = (fn: any, ms?: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {

/* ---------- room svg ---------- */
/* ---------- room photos ---------- */
function room(mode,pal){
  const src = mode==='after' ? (pal || PHOTOS.after) : PHOTOS.before;
  return photo(src, mode==='after' ? 'Redesigned space, AI render' : 'Original space before redesign');
}
const PALS={
  warm:PHOTOS.after,
  coastal:PHOTOS.coastal,
  farm:PHOTOS.farmhouse,
  green:PHOTOS.japandi,
  kitchen:PHOTOS.kitchen,
  bath:PHOTOS.bath,
  yard:PHOTOS.resortYard,
  exterior:PHOTOS.paintedBrick,
  craftsman:PHOTOS.craftsman,
  ranch:PHOTOS.ranch
};

/* ---------- nav ---------- */
const titles={dash:['Dashboard','Your workspace at a glance'],props:['Properties','Property, project, room, version'],
studio:['Studio','Price a room and save it to a project'],designs:['Designs','Saved versions across your properties'],
listings:['Listing Batch','Stage a whole property in one direction'],scope:['Scope &amp; Budget','Planning estimates from approved designs'],
products:['Products','Shop the design, three price tiers per item'],present:['Presentations','Client ready packages and approval links'],
reports:['Reports','Portfolio rollup, budget fit and credit spend'],
team:['Team','Unlimited seats on Pro and above'],settings:['Settings','Brand kit, defaults and integrations'],
account:['Account','Profile, security, subscription and billing'],
help:['Help Center','Guides, answers and support'],
tutorials:['Tutorials','Short walkthroughs, five minutes or less'],
notifications:['Notifications','Activity, mentions and alerts']};
const ACCT_ALIAS={team:'team',settings:'brand',branding:'brand',billing:'billing',invoices:'invoices',api:'api',profile:'profile',security:'security'};
function go(v,fromHash){
  if(ACCT_ALIAS[v]){ const pane=ACCT_ALIAS[v]; v='account'; setTimeout(()=>acctPane(pane),0); }
  document.querySelectorAll('.nav-i').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  try{ window.__rdRailForView && window.__rdRailForView(v); }catch(_){}
  if(v==='studio'){ try{ paintStudioSub(); }catch(_){} }
  if(v==='reports'){ try{ paintReports(); }catch(_){} }
  if(!titles[v]) return;
  const t1=document.getElementById('pgTitle'); if(t1) t1.innerHTML=titles[v][0];
  const t2=document.getElementById('pgCrumb'); if(t2) t2.innerHTML=titles[v][1];
  if(!fromHash){
    try{
      const h='#v-'+v;
      if(location.hash!==h) history.replaceState(null,'',location.pathname+location.search+h);
    }catch(_){}
  }
  window.scrollTo({top:0});
}

/* deep links: /app#v-scope, /app#scope and browser back/forward */
function viewFromHash(){
  const raw=(location.hash||'').replace(/^#/,'').replace(/^v-/,'');
  if(!raw) return '';
  return (titles[raw]||ACCT_ALIAS[raw])?raw:'';
}
window.addEventListener('hashchange',()=>{ const v=viewFromHash(); if(v) go(v,true); });

document.querySelectorAll('.nav-i').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
/* the app shell mounts after this module runs, and can remount once,
   so keep re-asserting the deep linked view for a short window */
(function applyHash(){
  const v=viewFromHash();
  if(!v) return;
  const want='v-'+(ACCT_ALIAS[v]?'account':v);
  let tries=0;
  const tick=()=>{
    const target=document.getElementById(want);
    if(target && !target.classList.contains('on')) go(v,true);
    if(++tries<110) setTimeout(tick,75);
  };
  tick();
})();


/* ---------- account menu ---------- */
const acctBtn=document.getElementById('acctBtn'),acctMenu=document.getElementById('acctMenu');
function closeAcct(){acctMenu.classList.remove('on');acctBtn.setAttribute('aria-expanded','false')}
acctBtn.addEventListener('click',e=>{
  e.stopPropagation();
  const open=!acctMenu.classList.contains('on');
  acctMenu.classList.toggle('on',open);acctBtn.setAttribute('aria-expanded',String(open));
});
acctMenu.addEventListener('click',e=>{ if(e.target.closest('.acct-i,[data-goto]')) closeAcct(); });
document.addEventListener('click',e=>{ if(!e.target.closest('.acct-wrap')) closeAcct(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAcct(); });

/* ---------- search scope menu + live results ---------- */
const schBtn=document.getElementById('schBtn'),schMenu=document.getElementById('schMenu');
const schInput=document.querySelector('.search input');
let SCH_SCOPE='All';
let schRes=null;
if(schMenu&&schMenu.parentElement){
  schRes=document.createElement('div');
  schRes.className='search-menu'; schRes.id='schRes';
  schMenu.parentElement.appendChild(schRes);
}
function closeSch(){ if(schMenu){schMenu.classList.remove('on'); schBtn.setAttribute('aria-expanded','false');} }
function closeSchRes(){ if(schRes) schRes.classList.remove('on'); }
function searchIndex(){
  const out=[];
  PROP_TREE.forEach((p,pi)=>{
    out.push({kind:'Properties',ic:'map-pin',t:p.address,s:p.has_dna?'DNA Locked':'No DNA yet',pi,pri:0});
    p.projects.forEach((pr,pri)=>{
      pr.rooms.forEach(r=>{
        out.push({kind:'Rooms',ic:'sofa',t:r.name,s:p.address+' \u00b7 '+pr.name,pi,pri});
        out.push({kind:'Designs',ic:'images',t:r.name+' v'+(r.version_no||1),s:(r.status==='approved'?'Approved':'Draft')+' \u00b7 '+pr.name,pi,pri,design:true});
      });
    });
  });
  (typeof PRES_ROWS!=='undefined'?PRES_ROWS:[]).forEach(pr=>{
    out.push({kind:'Presentations',ic:'presentation',t:pr.title||'Client link',
      s:(pr.status==='approved'?'Approved':pr.status==='viewed'?'Opened':pr.status==='changes'?'Changes requested':'Sent'),view:'present',pres:pr.id});
  });
  SAVED_EST.forEach(e=>{
    out.push({kind:'Scopes',ic:'calculator',t:(e.name||'Saved room')+' scope',
      s:(e.grade?e.grade[0].toUpperCase()+e.grade.slice(1)+' grade':'Scope')+(e.total_low?' \u00b7 $'+Math.round(e.total_low/1000)+'k+':''),view:'scope'});
    out.push({kind:'Products',ic:'shopping-bag',t:(e.name||'Saved room')+' product board',
      s:'Allowances from the saved scope',view:'products'});
  });
  return out;
}
function runSearch(){
  if(!schRes) return;
  const q=(schInput&&schInput.value||'').trim().toLowerCase();
  if(!q){ closeSchRes(); return; }
  let rows=searchIndex().filter(r=>(SCH_SCOPE==='All'||r.kind===SCH_SCOPE)&&(r.t+' '+r.s).toLowerCase().includes(q)).slice(0,8);
  schRes.innerHTML=rows.length
    ? '<div class="acct-group">Results</div>'+rows.map((r,i)=>`<button class="acct-i" data-r="${i}"><i data-lucide="${r.ic}"></i>${r.t}<span class="mv">${r.s}</span></button>`).join('')
    : '<div class="acct-group">Results</div><div class="acct-i" style="pointer-events:none;color:var(--mute-2)">Nothing matches that search.</div>';
  schRes.classList.add('on');
  lucide.createIcons();
  schRes.querySelectorAll('[data-r]').forEach(btn=>btn.addEventListener('click',()=>{
    const r=rows[+btn.dataset.r]; if(!r) return;
    if(r.pi!=null) SEL={p:r.pi,pr:r.pri};
    closeSchRes(); if(schInput) schInput.value='';
    go(r.view||(r.design?'designs':'props')); paintTree();
    if(r.pres) setTimeout(()=>{ try{ focusPresentation(r.pres); }catch(_){} },60);
  }));
}
function updateSearchMeta(){
  if(!schMenu) return;
  const rooms=PROP_TREE.reduce((n,p)=>n+p.projects.reduce((m,pr)=>m+pr.rooms.length,0),0);
  const designs=PROP_TREE.reduce((n,p)=>n+p.projects.reduce((m,pr)=>m+pr.rooms.reduce((k,r)=>k+r.versions,0),0),0);
  const set=(sc,v)=>{const b=schMenu.querySelector('[data-scope="'+sc+'"] .mv'); if(b) b.textContent=String(v);};
  set('Properties',PROP_TREE.length); set('Rooms',rooms); set('Designs',designs);
  set('Presentations',(typeof PRES_ROWS!=='undefined'?PRES_ROWS:[]).length);
  set('Scopes',SAVED_EST.length); set('Products',SAVED_EST.length);
  const recents=searchIndex().filter(r=>r.kind==='Designs').slice(0,3);
  const groups=schMenu.querySelectorAll('.acct-group');
  const recHead=groups[groups.length-1];
  if(recHead){
    let n=recHead.nextElementSibling;
    while(n){ const nx=n.nextElementSibling; n.remove(); n=nx; }
    recHead.insertAdjacentHTML('afterend', recents.length
      ? recents.map(r=>`<button class="acct-i" data-rec="${r.pi}:${r.pri}"><i data-lucide="history"></i>${r.t}</button>`).join('')
      : '<div class="acct-i" style="pointer-events:none;color:var(--mute-2)">Nothing saved yet</div>');
    schMenu.querySelectorAll('[data-rec]').forEach(b=>b.addEventListener('click',()=>{
      const [pi,pri]=b.dataset.rec.split(':').map(Number);
      SEL={p:pi,pr:pri}; closeSch(); go('props'); paintTree();
    }));
    lucide.createIcons();
  }
}
if(schBtn&&schMenu){
  schBtn.addEventListener('click',e=>{
    e.stopPropagation(); closeAcct(); closeSchRes();
    const open=!schMenu.classList.contains('on');
    schMenu.classList.toggle('on',open); schBtn.setAttribute('aria-expanded',String(open));
  });
  schMenu.addEventListener('click',e=>{
    const it=e.target.closest('.acct-i'); if(!it) return;
    const sc=it.dataset.scope;
    if(sc){ SCH_SCOPE=sc==='All'?'All':sc;
      if(schInput) schInput.setAttribute('placeholder', sc==='All'?'Search properties, rooms, designs':'Search '+sc.toLowerCase()); }
    closeSch(); runSearch();
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.search-wrap')){ closeSch(); closeSchRes(); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeSch(); closeSchRes(); } });
}
if(schInput){
  schInput.addEventListener('input',()=>{ closeSch(); runSearch(); });
  schInput.addEventListener('focus',()=>{ if(schInput.value.trim()) runSearch(); });
  schInput.addEventListener('keydown',e=>{
    if(!schRes||!schRes.classList.contains('on')) return;
    const items=[...schRes.querySelectorAll('[data-r]')]; if(!items.length) return;
    const cur=items.findIndex(x=>x.classList.contains('sel'));
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      const nx=e.key==='ArrowDown'?(cur+1)%items.length:(cur<=0?items.length-1:cur-1);
      items.forEach((x,i)=>x.classList.toggle('sel',i===nx));
      items[nx].scrollIntoView({block:'nearest'});
    } else if(e.key==='Enter'){ e.preventDefault(); (items[cur>=0?cur:0]).click(); }
  });
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); schInput.focus(); schInput.select(); }
  });
}




/* ---------- account page ---------- */
const NOTIF_PREFS=[['designs','Saved And Approved Designs','Shows in your in app notification feed'],
['approvals','Client Approvals','When a client approves a presentation link'],
['team','Team And Invites','Invites you receive and teammates who join your workspace'],
['billing','Credits And Billing','Credit spend, refunds and low balance warnings']];
let PREFS=null;
function paintNotifPrefs(){
  if(!PREFS) return;
  const body=NOTIF_PREFS.map(([k,n,d])=>{
    const on=PREFS.notifs[k]!==false;
    return `<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div>
      <button class="pill ${on?'p-ok':'p-gray'}" data-npref="${k}">${on?'On':'Off'}</button></div>`;
  }).join('')+'<div class="note"><i data-lucide="info"></i><span>These control the in app feed. We do not send marketing email, and account email is limited to security messages.</span></div>';
  ['notifRows','notifPrefs'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=body; });
  lucide.createIcons();
}
document.addEventListener('click',async(e)=>{
  const b=e.target.closest('[data-npref]'); if(!b||!PREFS) return;
  const k=b.getAttribute('data-npref'); const next=PREFS.notifs[k]===false;
  PREFS.notifs[k]=next; paintNotifPrefs();
  try{ await savePrefs({notifs:{[k]:next}}); }catch(_){}
  try{ window.dispatchEvent(new CustomEvent('rd:prefs')); }catch(_){}
});



document.getElementById('invRows').innerHTML=
'<tr><td colspan="4" style="padding:18px 12px;color:var(--mute-2);font-size:.82rem">'+
'No invoices yet. Receipts appear here after your first paid plan or credit top up.</td></tr>';


const PANE_META={profile:['Profile','How you appear to teammates and clients'],
security:['Security','Password, two factor and active sessions'],
notifs:['Notifications','What we email and push to you'],
billing:['Subscription','Plan, usage and payment method'],
invoices:['Invoices','Receipts for paid plans and credit top ups'],
team:['Team','Members, roles and seat usage'],
brand:['Brand Kit','Applied to exports, decks and client links'],
defaults:['Defaults','Applied to every new design'],
api:['API & White Label','Business plan feature'],
danger:['Data & Privacy','Export or permanently remove your data']};
function acctPane(k){
  if(!PANE_META[k]) k='profile';
  document.querySelectorAll('.arail-i').forEach(b=>b.classList.toggle('on',b.dataset.pane===k));
  document.querySelectorAll('.apane').forEach(x=>x.classList.toggle('on',x.id==='p-'+k));
  const t=document.getElementById('acctPaneTitle'),su=document.getElementById('acctPaneSub');
  if(t) t.textContent=PANE_META[k][0];
  if(su) su.textContent=PANE_META[k][1];
}
document.querySelectorAll('.arail-i').forEach(b=>b.addEventListener('click',()=>acctPane(b.dataset.pane)));



/* ---------- dashboard: real data for the signed-in account ---------- */
const kfmt=(n)=>n>=1000?'$'+(Math.round(n/100)/10)+'K':'$'+Math.round(n).toLocaleString('en-US');
const empty=(t,s)=>'<div class="rowi"><div class="rowt"><b>'+t+'</b><span>'+s+'</span></div></div>';

/* First run checklist on the dashboard, driven by real workspace data. */
function paintOnboarding(s,pres){
  const view=document.getElementById('v-dash'); if(!view) return;
  let card=document.getElementById('obCard');
  const done=[
    ['Save Your First Room','Upload a photo in Studio and save it to a property.', (s.counts.designs||0)>0, 'studio','Open Studio'],
    ['Price A Scope','Turn an approved room into a line by line planning range.', (s.counts.priced||0)>0, 'scope','Open Scope'],
    ['Set A Budget Target','Give a project a target so the dashboard can flag overruns.', s.projects.some(p=>p.budget_target), 'scope','Open Scope'],
    ['Send A Client Presentation','Share a branded approval link and track the decision.', (pres||[]).length>0, 'present','Open Presentations'],
  ];
  const left=done.filter(d=>!d[2]).length;
  /* the first run Get Started card covers the same ground, never show both */
  if(!left||localStorage.getItem('rd.obDone')==='1'||document.getElementById('onbCard')){ if(card) card.remove(); return; }
  if(!card){
    card=document.createElement('div');
    card.id='obCard'; card.className='card ob-card';
    view.prepend(card);
  }
  card.innerHTML='<div class="card-h"><div><h3>Get Set Up</h3><div class="sub">'+(4-left)+' Of 4 Done</div></div>'
    +'<button class="btn btn-ghost btn-xs" id="obHide">Hide</button></div>'
    +'<div class="card-b ob-steps">'+done.map(([t,sub,ok,dest,lab])=>
      '<div class="ob-step'+(ok?' ok':'')+'"><i data-lucide="'+(ok?'check-circle-2':'circle')+'"></i>'
      +'<div class="rowt"><b>'+t+'</b><span>'+sub+'</span></div>'
      +(ok?'<span class="pill p-ok">Done</span>':'<button class="btn btn-ghost btn-xs" data-goto="'+dest+'">'+lab+'</button>')
      +'</div>').join('')+'</div>';
  try{ lucide.createIcons(); }catch(_){}
  const hide=document.getElementById('obHide');
  if(hide) hide.addEventListener('click',()=>{ localStorage.setItem('rd.obDone','1'); card.remove(); });
  card.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
}



/* ---------- sample workspace ---------- */
let SAMPLE_BUSY=false;
async function paintSample(s){
  const host=document.getElementById('v-dash'); if(!host) return;
  let bar=document.getElementById('sampleBar');
  let present=false;
  try{ present=(await hasSampleWorkspace()).present; }catch(_){ }
  const wanted = present || !s.counts.properties;
  if(!wanted){ if(bar) bar.remove(); return; }
  if(!bar){
    bar=document.createElement('div');
    bar.id='sampleBar'; bar.className='note';
    bar.style.margin='0 0 16px';
    host.insertBefore(bar,host.firstChild);
  }
  bar.innerHTML = present
    ? '<i data-lucide="flask-conical"></i><span><b>Sample Property Loaded.</b> 1420 Bayshore Boulevard is example data for exploring Properties, Scope and Reports.</span>'
      +'<button class="btn btn-ghost btn-xs" id="sampleGo" style="margin-left:auto"><i data-lucide="map-pin"></i>Open It</button>'
      +'<button class="btn btn-ghost btn-xs" id="sampleOff"><i data-lucide="trash-2"></i>Remove Sample</button>'
    : '<i data-lucide="flask-conical"></i><span><b>Nothing Saved Yet.</b> Load a sample property with three rooms and a budget target to see how the workspace fits together. No credits are used.</span>'
      +'<button class="btn btn-primary btn-xs" id="sampleOn" style="margin-left:auto"><i data-lucide="download"></i>Load Sample Property</button>';
  try{ lucide.createIcons(); }catch(_){}

  const on=document.getElementById('sampleOn');
  const off=document.getElementById('sampleOff');
  const goP=document.getElementById('sampleGo');
  if(goP) goP.onclick=()=>go('props');
  const run=async(fn,btn,label)=>{
    if(SAMPLE_BUSY) return; SAMPLE_BUSY=true;
    if(btn){ btn.classList.add('is-busy'); btn.textContent=label; }
    try{ await fn(); }catch(e){ try{ showAlert(e.message||'That did not work. Try again.'); }catch(_){} }
    SAMPLE_BUSY=false;
    await loadDashboard();
    try{ window.dispatchEvent(new Event('rd:saved')); }catch(_){}
  };
  if(on) on.onclick=()=>run(()=>loadSampleWorkspace({data:{photos:{
    livingBefore:PHOTOS.before, livingAfter:PHOTOS.after,
    kitchenBefore:PHOTOS.kitchenBefore, kitchenAfter:PHOTOS.kitchenAfter,
    bathBefore:PHOTOS.bathBefore }}}), on, 'Loading Sample');
  if(off) off.onclick=()=>run(()=>removeSampleWorkspace(), off, 'Removing');
}

async function loadDashboard(){
  const rl=document.getElementById('recentList'), al=document.getElementById('attnList'), bt=document.getElementById('budgetTable');
  if(!rl||!al||!bt) return;
  let s;
  try{ s=await getWorkspaceSummary(); }
  catch(e){
    rl.innerHTML=empty('Could Not Load Your Workspace','Sign in again, then refresh this page');
    al.innerHTML=''; bt.innerHTML='';
    return;
  }

  const kpis=document.querySelectorAll('#v-dash .grid.g4 .kpi');
  const setKpi=(i,val,note)=>{ const k=kpis[i]; if(!k) return;
    const b=k.querySelector('b'); if(b) b.textContent=val;
    const d=k.querySelector('.d'); if(d){ d.textContent=note; d.classList.remove('up'); } };
  setKpi(0,String(s.counts.designs),s.counts.designs?s.counts.priced+' priced with a scope':'Save a room to get started');
  setKpi(1,String(s.counts.properties),s.counts.properties?'Saved to your account':'No properties yet');
  setKpi(2,s.counts.scopedTotal?kfmt(s.counts.scopedTotal):'—',s.counts.priced+' priced '+(s.counts.priced===1?'room':'rooms'));
  setKpi(3,String(s.counts.drafts),s.counts.drafts?'Rooms not approved yet':'Nothing pending');

  /* recent rooms */
  if(!s.recent.length){
    rl.innerHTML=empty('No Designs Yet','Upload a photo in Studio, price it, then save it');
  }else{
    rl.innerHTML=s.recent.map(r=>`
<div class="rowi"><div class="thumb"><img data-photo="${r.before_path||''}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px" hidden></div>
<div class="rowt"><b>${r.room_name}</b><span>${r.address} &middot; ${r.project_name}</span></div>
<span class="pill ${r.total_low!=null?'p-ok':'p-gray'}">${r.total_low!=null?'Priced':'Draft'}</span></div>`).join('');
    rl.querySelectorAll('[data-photo]').forEach(async(img)=>{
      const p=img.getAttribute('data-photo'); if(!p) return;
      const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
      if(url){ img.src=url; img.hidden=false; }
    });
  }

  /* needs attention */
  const attn=[];
  s.projects.forEach(p=>{
    if(p.priced<p.rooms) attn.push([p.rooms-p.priced+' '+(p.rooms-p.priced===1?'room needs':'rooms need')+' pricing',p.address+' &middot; '+p.project_name,'p-amb','Price It','scope']);
    if(p.budget_target&&p.high>p.budget_target) attn.push(['Scope exceeds target by '+kfmt(p.high-p.budget_target),p.address+' &middot; '+p.project_name,'p-red','Review','scope']);
  });
  let pres=[];
  try{
    pres=await listPresentations()||[];
    const hrs=(d)=>d?(Date.now()-new Date(d).getTime())/36e5:null;
    pres.forEach(p=>{
      const who=p.client_name||p.client_email||'Client';
      const where=(p.address?p.address+' &middot; ':'')+p.room_name;
      if(p.status==='changes') attn.unshift([who+' requested changes on '+p.title, where,'p-red','Review','present',p.id]);
      else if(p.status==='viewed'&&hrs(p.last_viewed_at)>48) attn.push([who+' viewed but has not decided', where+' &middot; '+Math.round(hrs(p.last_viewed_at)/24)+' days ago','p-amb','Follow Up','present',p.id]);
      else if(p.status==='sent'&&hrs(p.created_at)>72) attn.push([p.title+' has not been opened', where+' &middot; sent '+Math.round(hrs(p.created_at)/24)+' days ago','p-amb','Resend','present',p.id]);
    });
  }catch(e){}

  /* first run checklist: shown until every step is done or the user dismisses it */
  paintOnboarding(s,pres);
  paintSample(s);


  al.innerHTML=attn.length?attn.slice(0,5).map(([t,sub,cls,lab,dest,pid])=>`
<div class="rowi"${dest?` data-goto="${dest}"${pid?` data-focus-pres="${pid}"`:''} role="button" tabindex="0" style="cursor:pointer"`:''}><div class="rowt"><b>${t}</b><span>${sub}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('')
    :empty('Nothing Needs Your Attention','Priced rooms inside target will stay quiet here');

  /* budget vs scope */
  bt.innerHTML=s.projects.length?s.projects.map(p=>{
    const t=p.budget_target;
    const fit=!p.priced?['p-gray','Not Priced']:!t?['p-ink','No Target']:p.high<=t?['p-ok','Within']:p.low<=t?['p-amb','Tight']:['p-red','Over'];
    return `<tr><td><b>${p.address}</b></td><td>${p.project_name}</td><td>${p.rooms}</td>
<td class="n">${t?kfmt(t):'—'}</td><td class="n">${p.priced?kfmt(p.low)+' to '+kfmt(p.high):'—'}</td>
<td style="text-align:right"><span class="pill ${fit[0]}">${fit[1]}</span></td></tr>`;
  }).join('')
    :'<tr><td colspan="6">No saved projects yet. Price a scope in Studio, then use Save To My Projects.</td></tr>';
}
document.getElementById('attnList')?.addEventListener('click',(e)=>{
  const r=e.target.closest('[data-goto]'); if(!r) return;
  go(r.dataset.goto);
  const pid=r.dataset.focusPres;
  if(pid) setTimeout(()=>{ try{ focusPresentation(pid); }catch(_){} },60);
});
loadDashboard();
window.addEventListener('rd:saved', loadDashboard);


/* ---------- properties: real owned hierarchy ---------- */
const RT_ICON=(t)=>{const s=String(t||'').toLowerCase();
  if(s.includes('kitchen'))return 'chef-hat'; if(s.includes('bath'))return 'bath';
  if(s.includes('bed'))return 'bed'; if(s.includes('exterior')||s.includes('elevation')||s.includes('yard'))return 'home';
  if(s.includes('office'))return 'lamp-desk'; return 'sofa';};
let PROP_TREE=[], SEL={p:0,pr:0};
let SAVED_EST=[];

async function paintRooms(){
  const rc=document.getElementById('roomCards'); if(!rc) return;
  const prop=PROP_TREE[SEL.p]||null, proj=prop?(prop.projects[SEL.pr]||null):null;
  const t=document.getElementById('propTitle'), sub=document.getElementById('propSub'), rs=document.getElementById('roomsSub');
  if(t) t.textContent=prop?prop.address:'No property selected';
  if(sub) sub.textContent=prop&&proj
    ? proj.name+' \u00b7 '+proj.rooms.length+(proj.rooms.length===1?' room':' rooms')+' \u00b7 '+proj.rooms.reduce((n,r)=>n+r.versions,0)+' versions'
    : 'Save a room in Studio to build your property tree';
  if(rs) rs.textContent=proj?('Rooms saved under '+proj.name):'Rooms saved under the selected project';
  const dnaPill=document.getElementById('dnaPill');
  if(dnaPill){
    const n=((prop&&prop.dna)||[]).length;
    dnaPill.className='pill '+(n?'p-ink':'p-gray');
    dnaPill.innerHTML='<i data-lucide="dna"></i>'+(n?'Design DNA Locked':'No Design DNA Yet');
  }
  const dna=document.getElementById('dnaRow');
  if(dna){
    const items=(prop&&prop.dna)||[];
    dna.innerHTML=items.length
      ? items.map(it=>`<span class="dna-i"><span class="sw" style="background:${it.color}"></span>${it.label}</span>`).join('')
      :'<span style="font-size:.79rem;color:var(--mute-2)">No Design DNA locked for this property yet. Use Edit DNA to set the palette and finishes every room should follow.</span>';
  }


  const rooms=proj?proj.rooms:[];
  if(!rooms.length){
    rc.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No rooms here yet. Price a room in Studio, then use Save To My Projects.</p>';
    return;
  }
  rc.innerHTML=rooms.map(r=>{
    const priced=r.total_low!=null;
    const cls=priced?'p-ok':'p-gray';
    const cost=priced?kfmt(r.total_low)+' to '+kfmt(r.total_high):'Not priced yet';
    const st=(r.status==='approved'?'Approved':(r.status?'Draft':'\u2014'));
    return `<div class="card"><div style="aspect-ratio:8/5;background:#EFEDE8;border-radius:7px 7px 0 0;overflow:hidden">
<img data-photo="${r.after_path||r.before_path||''}" alt="${r.name}" style="width:100%;height:100%;object-fit:cover" hidden></div>
<div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
<b style="font-size:.87rem">${r.name}</b><span class="pill ${cls}">v${r.version_no||1} ${st}</span></div>
<div class="mono" style="font-size:.71rem;color:var(--mute-2);margin-top:5px">${cost}</div></div></div>`;
  }).join('');
  rc.querySelectorAll('[data-photo]').forEach(async(img)=>{
    const p=img.getAttribute('data-photo'); if(!p) return;
    const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
    if(url){ img.src=url; img.hidden=false; }
  });
  lucide.createIcons();
}

function paintStudioSub(){
  const el=document.getElementById('studioSub'); if(!el) return;
  const prop=PROP_TREE[SEL.p]||null, proj=prop?(prop.projects[SEL.pr]||null):null;
  const roomSel=document.getElementById('fRoom');
  const room=roomSel?roomSel.value:'New room';
  el.textContent=prop?(prop.address+(proj?' \u00b7 '+proj.name:'')+' \u00b7 '+room):('New room \u00b7 '+room);
}

function paintTree(){
  const el=document.getElementById('tree'); if(!el) return;
  if(!PROP_TREE.length){
    el.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No properties yet. Saving a room in Studio creates one.</p>';
    paintRooms(); paintStudioSub(); return;
  }
  const rows=[];
  PROP_TREE.forEach((p,pi)=>{
    rows.push(`<div class="tr l1 ${pi===SEL.p?'on':''}" data-pi="${pi}" data-pri="0"><i data-lucide="map-pin"></i>${p.address}<span class="meta">${p.has_dna?'DNA Locked':'No DNA'}</span></div>`);
    p.projects.forEach((pr,pri)=>{
      rows.push(`<div class="tr l2 ${pi===SEL.p&&pri===SEL.pr?'on':''}" data-pi="${pi}" data-pri="${pri}"><i data-lucide="folder"></i>${pr.name}<span class="meta">${pr.rooms.length} ${pr.rooms.length===1?'room':'rooms'}</span></div>`);
      pr.rooms.forEach(r=>{
        rows.push(`<div class="tr l3" data-pi="${pi}" data-pri="${pri}"><i data-lucide="${RT_ICON(r.room_type)}"></i>${r.name}<span class="meta">v${r.version_no||1}</span></div>`);
      });
    });
  });
  el.innerHTML=rows.join('');
  el.querySelectorAll('.tr').forEach(tr=>tr.addEventListener('click',()=>{
    SEL={p:+tr.dataset.pi,pr:+tr.dataset.pri}; paintTree();
  }));
  lucide.createIcons();
  paintRooms();
  paintStudioSub();
}

async function loadProperties(){
  if(!document.getElementById('tree')) return;
  try{ PROP_TREE=await getPropertyTree(); }
  catch(e){ PROP_TREE=[]; }
  if(SEL.p>=PROP_TREE.length) SEL={p:0,pr:0};
  const cp=document.getElementById('cntProps'), cd=document.getElementById('cntDesigns');
  if(cp) cp.textContent=String(PROP_TREE.length);
  if(cd) cd.textContent=String(PROP_TREE.reduce((n,p)=>n+p.projects.reduce((m,pr)=>m+pr.rooms.reduce((k,r)=>k+r.versions,0),0),0));
  paintTree();
  paintDesigns();
  updateSearchMeta();
  try{ paintBatch(); }catch(_){}

}
loadProperties();
window.addEventListener('rd:saved', loadProperties);


/* ---------- studio ---------- */
document.getElementById('cBefore').innerHTML=room('before');
document.getElementById('cAfter').innerHTML=room('after');
const cRng=document.getElementById('cRng'),cAfter=document.getElementById('cAfter'),cHnd=document.getElementById('cHnd');
function setC(v){cAfter.style.clipPath=`inset(0 0 0 ${v}%)`;cHnd.style.left=v+'%'}
cRng.addEventListener('input',e=>setC(e.target.value));setC(50);

const VAR=[['warm','Warm Minimal'],['farm','Modern Farm'],['coastal','Coastal'],['green','Deep Green']];
document.getElementById('vars').innerHTML=VAR.map(([p,n],i)=>`
<div class="var ${i===0?'on':''}" data-p="${p}"><div style="aspect-ratio:8/5">${room('after',PALS[p])}</div><div class="vl">${n}</div></div>`).join('');
document.querySelectorAll('.var').forEach(v=>v.addEventListener('click',()=>{
  document.querySelectorAll('.var').forEach(x=>x.classList.remove('on'));v.classList.add('on');
  cAfter.innerHTML=room('after',PALS[v.dataset.p]);
}));

/* object locks */
let mode='keep';
const locks={};
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on'));b.classList.add('on');mode=b.dataset.mode;
}));
function drawLocks(){
  const k=Object.keys(locks);
  document.getElementById('lockCount').textContent=k.length?`${k.length} object${k.length>1?'s':''} locked`:'No objects locked';
  document.getElementById('lockList').innerHTML=k.length?k.map(o=>{
    const cls={keep:'p-ok',replace:'p-blue',remove:'p-red'}[locks[o]];
    return `<div class="rowi" style="padding:9px 0"><div class="rowt"><b>${o}</b></div>
    <span class="pill ${cls}">${locks[o]}</span>
    <button class="icon-btn" data-rm="${o}" style="width:24px;height:24px"><i data-lucide="x" style="width:13px;height:13px"></i></button></div>`;
  }).join(''):'<p style="font-size:.79rem;color:var(--mute-2)">Nothing locked yet. Every object is fair game for the next generation.</p>';
  lucide.createIcons();
  document.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();const o=b.dataset.rm;delete locks[o];
    document.querySelectorAll('.hot').forEach(h=>{if(h.dataset.o===o)h.className='hot'});drawLocks();
  }));
}
document.querySelectorAll('.hot').forEach(h=>h.addEventListener('click',()=>{
  const o=h.dataset.o;
  if(locks[o]===mode){delete locks[o];h.className='hot'}
  else{locks[o]=mode;h.className='hot set '+mode}
  drawLocks();
}));
document.getElementById('clearLocks').addEventListener('click',()=>{
  Object.keys(locks).forEach(k=>delete locks[k]);
  document.querySelectorAll('.hot').forEach(h=>h.className='hot');drawLocks();
});
drawLocks();

/* budget bands */
const BANDS=[{lo:3200,hi:5000,fit:'Well Within Target',c:'c-hi'},{lo:11400,hi:14900,fit:'Within Target',c:'c-hi'},
{lo:26000,hi:35000,fit:'Within Target',c:'c-hi'},{lo:41000,hi:62000,fit:'Above Band, Review',c:'c-md'}];
const m=n=>'$'+n.toLocaleString();
document.querySelectorAll('.bchip').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.bchip').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const d=BANDS[+b.dataset.b];
  document.getElementById('estVal').textContent=`${m(d.lo)} to ${m(d.hi)}`;
  const f=document.getElementById('fitVal');f.textContent=d.fit;f.className=d.c;
}));
document.querySelectorAll('#gradeChips .chip, #spChips .chip').forEach(c=>c.addEventListener('click',()=>{
  c.parentElement.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');
}));

const gsteps=['Reading room geometry','Applying object locks','Fitting design to budget band','Selecting retail grade finishes','Rendering the space','Finishing the image'];
let busy=false, lastRender=null, lastRenderPath=null;
document.getElementById('genBtn').addEventListener('click',async ()=>{
  if(busy)return;
  if(!ensureCredits(1,'A Design Render')) return;
  busy=true;
  const btn=document.getElementById('genBtn'); btn.disabled=true;
  const ov=document.getElementById('cGen'),bar=document.getElementById('cBar'),st=document.getElementById('cStep');
  ov.classList.add('on');bar.style.width='0%';st.textContent=gsteps[0];
  let p=0,i=0;
  const t=setInterval(()=>{
    p=Math.min(p+Math.random()*7+2,94);
    bar.style.width=p+'%';
    if(p>(i+1)*(94/gsteps.length)&&i<gsteps.length-1){i++;st.textContent=gsteps[i]}
  },240);
  const finish=()=>{ clearInterval(t); bar.style.width='100%';
    setTimeout(()=>{ov.classList.remove('on');busy=false;btn.disabled=false;},320); };
  try{
    const srcImg=document.querySelector('#cBefore img');
    const image=await toDataUrl(srcImg?srcImg.src:PHOTOS.before,1100);
    const band=document.querySelector('.bchip.on'), grade=document.querySelector('#gradeChips .chip.on');
    const groups={keep:[],replace:[],remove:[]};
    Object.keys(locks).forEach(o=>{ (groups[locks[o]]||groups.keep).push(o); });
    const r=await renderDesign({data:{
      image,
      room_type:currentRoomType(),
      direction:(document.getElementById('fStyle')||{}).value||'Warm Minimal',
      intensity:band?band.querySelector('b').textContent:'Makeover',
      grade:grade?grade.textContent:'Retail Grade',
      notes:(document.getElementById('agentNote')||{}).value||null,
      keep:groups.keep, replace:groups.replace, remove:groups.remove
    }});
    lastRender=r.image; lastRenderPath=null;
    try{ lastRenderPath=await uploadRenderDataUrl(r.image); }catch(e0){ lastRenderPath=null; }
    cAfter.innerHTML=photo(r.image,'Redesigned space, AI render');
    addRenderVariant(r.image,(document.getElementById('fStyle')||{}).value||'Your Render',lastRenderPath);
    window.dispatchEvent(new Event('rd:credits-changed'));
    window.dispatchEvent(new Event('rd:photo'));
    finish();
    cRng.value=100;setC(100);
    setTimeout(()=>{let v=100;const b2=setInterval(()=>{v-=2.6;cRng.value=v;setC(v);if(v<=44)clearInterval(b2)},20)},600);
  }catch(e){
    finish();
    if(!creditGate(e)) showAlert('Could not render this design. '+((e&&e.message)||'Try again in a moment.'));
  }
});

function addRenderVariant(src,label,path){
  const wrap=document.getElementById('vars'); if(!wrap) return;
  const d=document.createElement('div');
  d.className='var on'; d.dataset.src=src; if(path) d.dataset.path=path;
  d.innerHTML=`<div style="aspect-ratio:8/5">${photo(src,label+' render')}</div><div class="vl">${label}</div>`;
  wrap.querySelectorAll('.var').forEach(x=>x.classList.remove('on'));
  wrap.prepend(d);
  d.addEventListener('click',()=>{
    wrap.querySelectorAll('.var').forEach(x=>x.classList.remove('on'));d.classList.add('on');
    cAfter.innerHTML=photo(src,label+' render');
    lastRender=src; lastRenderPath=d.dataset.path||null;
  });
}

/* ---------- studio tools: 3D plan and walkthrough video ---------- */
function toolOverlay(steps){
  const ov=document.getElementById('cGen'),bar=document.getElementById('cBar'),st=document.getElementById('cStep');
  let p=0,i=0;
  ov.classList.add('on'); bar.style.width='0%'; st.textContent=steps[0];
  const t=setInterval(()=>{
    p=Math.min(p+Math.random()*4+1,92); bar.style.width=p+'%';
    if(p>(i+1)*(92/steps.length)&&i<steps.length-1){i++;st.textContent=steps[i]}
  },600);
  return {
    say:(m)=>{ st.textContent=m; },
    at:(pct)=>{ p=Math.max(p,Math.min(pct,96)); bar.style.width=p+'%'; },
    done:()=>{ clearInterval(t); bar.style.width='100%'; setTimeout(()=>ov.classList.remove('on'),320); }
  };
}

async function run3dPlan(){
  if(busy) return;
  if(!ensureCredits(6,'A 3D Plan')) return;
  busy=true;
  const ui=toolOverlay(['Reading the room geometry','Building the floor plate','Placing the furniture','Rendering the 3D plan']);
  try{
    const image=await toDataUrl(lastRender||studioSrc('after'),1100);
    const r=await renderPlan3d({data:{
      image,
      room_type:currentRoomType(),
      direction:(document.getElementById('fStyle')||{}).value||'Warm Minimal',
      floor_area_sf:parseFloat((document.getElementById('scFloor')||{}).value)||null
    }});
    lastRender=r.image; lastRenderPath=null;
    try{ lastRenderPath=await uploadRenderDataUrl(r.image); }catch(e0){ lastRenderPath=null; }
    cAfter.innerHTML=photo(r.image,'Furnished 3D plan of the same room');
    addRenderVariant(r.image,'3D Plan',lastRenderPath);
    window.dispatchEvent(new Event('rd:credits-changed'));
    ui.done();
  }catch(e){
    ui.done();
    if(!creditGate(e)) showToolError('Could not build the 3D plan. '+((e&&e.message)||''));
  }finally{ busy=false; }
}

async function runWalkthrough(){
  if(busy) return;
  if(!ensureCredits(40,'A Walkthrough Video')) return;
  busy=true;
  const ui=toolOverlay(['Locking the finished render','Queuing the camera move','Rendering the walkthrough']);
  try{
    const image=await toDataUrl(lastRender||studioSrc('after'),1100);
    const job=await startWalkthrough({data:{
      image,
      room_type:currentRoomType(),
      direction:(document.getElementById('fStyle')||{}).value||'Warm Minimal'
    }});
    window.dispatchEvent(new Event('rd:credits-changed'));
    ui.say('Rendering the walkthrough, this takes a minute or two');
    let url=null;
    for(let i=0;i<50;i++){
      await new Promise(res=>setTimeout(res,6000));
      const s=await pollWalkthrough({data:{id:job.id}});
      if(s.progress) ui.at(Math.max(20,s.progress));
      if(s.status==='completed'&&s.url){ url=s.url; break; }
    }
    ui.done();
    if(!url) throw new Error('The video is taking longer than usual. Check back in a moment.');
    videoModal(url);
  }catch(e){
    ui.done();
    if(!creditGate(e)) showToolError('Could not render the walkthrough. '+((e&&e.message)||''));
  }finally{ busy=false; }
}

const ROOM_TOOL_STEPS={
  stage:['Reading the empty room','Choosing furniture that fits','Placing and lighting the set','Rendering the staged room'],
  declutter:['Reading the room','Marking clutter and personal items','Filling the space naturally','Rendering the clean room'],
  materials:['Reading surfaces and finishes','Selecting the new materials','Matching light and reflection','Rendering the swap'],
  sketch:['Reading the sketch lines','Building the geometry','Applying real materials','Rendering the photo'],
  angle:['Reading room geometry','Moving the virtual camera','Keeping the design consistent','Rendering the new angle']
};

/** Run one of the one-credit Studio room tools against the current canvas image. */
async function runRoomToolFlow(tool,label,useRender){
  if(busy) return;
  if(!ensureCredits(1,label)) return;
  busy=true;
  const ui=toolOverlay(ROOM_TOOL_STEPS[tool]||['Working on the image']);
  try{
    const base=useRender?(lastRender||studioSrc('after')):studioSrc('before');
    const image=await toDataUrl(base,1100);
    const grade=document.querySelector('#gradeChips .chip.on');
    const r=await runRoomTool({data:{
      tool,
      image,
      room_type:currentRoomType(),
      direction:(document.getElementById('fStyle')||{}).value||'Warm Minimal',
      grade:grade?grade.textContent:'Retail Grade',
      notes:(document.getElementById('agentNote')||{}).value||null
    }});
    lastRender=r.image; lastRenderPath=null;
    try{ lastRenderPath=await uploadRenderDataUrl(r.image); }catch(e0){ lastRenderPath=null; }
    cAfter.innerHTML=photo(r.image,label+' result');
    addRenderVariant(r.image,label,lastRenderPath);
    window.dispatchEvent(new Event('rd:credits-changed'));
    ui.done();
    cRng.value=100;setC(100);
    setTimeout(()=>{let v=100;const b2=setInterval(()=>{v-=2.6;cRng.value=v;setC(v);if(v<=44)clearInterval(b2)},20)},600);
  }catch(e){
    ui.done();
    if(!creditGate(e)) showToolError('Could not finish '+label+'. '+((e&&e.message)||''));
  }finally{ busy=false; }
}

function showToolError(msg){
  const i=document.getElementById('toolInfo'); if(!i){ alert(msg); return; }
  document.getElementById('toolInfoName').textContent='That Did Not Finish';
  document.getElementById('toolInfoDesc').textContent=msg;
  i.hidden=false;
}

function videoModal(url){
  let m=document.getElementById('vidModal');
  if(!m){
    m=document.createElement('div'); m.id='vidModal'; m.className='up-modal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="width:min(720px,calc(100vw - 32px))">'+
      '<h3>Walkthrough Video</h3><p>Eight seconds, dolly in, built from your finished render.</p>'+
      '<video id="vidPlayer" controls playsinline style="width:100%;border-radius:12px;background:#111"></video>'+
      '<a class="btn btn-primary btn-block" id="vidDl" style="margin-top:12px" download="walkthrough.mp4"><i data-lucide="download"></i>Download MP4</a>'+
      '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
    (document.querySelector(".rd-app")||document.body).appendChild(m);
    m.addEventListener('click',(e)=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')){ m.classList.remove('on'); m.querySelector('#vidPlayer').pause(); } });
  }
  m.querySelector('#vidPlayer').src=url;
  m.querySelector('#vidDl').href=url;
  m.classList.add('on');
  lucide.createIcons();
}




async function openInStudio(r){
  try{
    const beforeUrl=r.before_path?(isStoredPhoto(r.before_path)?await roomPhotoUrl(r.before_path):r.before_path):PHOTOS.before;
    const afterUrl=r.after_path?(isStoredPhoto(r.after_path)?await roomPhotoUrl(r.after_path):r.after_path):null;
    const cB=document.getElementById('cBefore');
    if(cB&&beforeUrl) cB.innerHTML=photo(beforeUrl,'Original space before redesign');
    if(afterUrl){
      cAfter.innerHTML=photo(afterUrl,'Redesigned space, AI render');
      lastRender=null; lastRenderPath=r.after_path||null;
      addRenderVariant(afterUrl,(r.name||'Saved')+' v'+(r.version_no||1),r.after_path||null);
    }
    cRng.value=44; setC(44);
  }catch(e){}
  go('studio');
}

async function paintVersions(){
  const el=document.getElementById('verList'); if(!el) return;
  let list=[];
  try{ list=await listSavedEstimates(); }catch(e){ list=[]; }
  SAVED_EST=list; updateSearchMeta();
  list=list.slice(0,6);
  if(!list.length){
    el.innerHTML='<p style="font-size:.78rem;color:var(--mute-2);padding:6px 0">No versions yet. Save a design to start the history.</p>';
    return;
  }
  const ago=(iso)=>{const s=(Date.now()-new Date(iso).getTime())/1000;
    if(s<90)return'just now';if(s<5400)return Math.round(s/60)+'m ago';
    if(s<172800)return Math.round(s/3600)+'h ago';return Math.round(s/86400)+'d ago';};
  el.innerHTML=list.map((v,i)=>{
    const st=v.status==='approved'?['p-ok','Live']:v.status==='review'?['p-amb','Review']:['p-gray',i===0?'Latest':'Past'];
    const lab=(v.status||'draft').charAt(0).toUpperCase()+(v.status||'draft').slice(1);
    return `<div class="rowi" style="padding:9px 0"><div class="rowt"><b>${v.room_name} v${v.version_no||1}</b><span>${lab} &middot; ${ago(v.created_at)}</span></div><span class="pill ${st[0]}">${st[1]}</span></div>`;
  }).join('');
}
paintVersions();
window.addEventListener('rd:saved', paintVersions);

/* ---------- designs: real saved versions ---------- */
let DESIGN_FILTER='all';
const ST_PILL=(s)=>s==='approved'?['p-ok','Approved']:s==='review'?['p-amb','In Review']:s==='archived'?['p-gray','Archived']:['p-gray','Draft'];

function paintDesigns(){
  const g=document.getElementById('designGrid'); if(!g) return;
  const all=[];
  PROP_TREE.forEach(p=>p.projects.forEach(pr=>pr.rooms.forEach(r=>all.push({...r,address:p.address,project:pr.name}))));
  const list=all.filter(r=>{
    const s=r.status||'draft';
    if(DESIGN_FILTER==='all') return true;
    if(DESIGN_FILTER==='approved') return s==='approved';
    if(DESIGN_FILTER==='review') return s==='review';
    return s==='archived';
  });
  if(!list.length){
    g.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">'+(all.length?'No Designs In This Tab Yet.':'No Designs Yet. Upload a photo in Studio, price it, then save it.')+'</p>';
    return;
  }
  g.innerHTML=list.map(r=>{
    const s=ST_PILL(r.status||'draft');
    const cost=r.total_low!=null?kfmt(r.total_low)+' to '+kfmt(r.total_high):'Not priced yet';
    return `<div class="card"><div style="aspect-ratio:8/5;overflow:hidden;border-radius:7px 7px 0 0;background:#EFEDE8">
<img data-photo="${r.after_path||r.before_path||''}" alt="${r.name}" style="width:100%;height:100%;object-fit:cover" hidden></div>
<div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
<b style="font-size:.86rem">${r.name} v${r.version_no||1}</b><span class="pill ${s[0]}">${s[1]}</span></div>
<div class="mono" style="font-size:.7rem;color:var(--mute-2);margin-top:5px">${r.address} &middot; ${cost}</div>
<div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-ghost btn-xs" style="flex:1" data-open="${r.id}">Open</button>
<button class="btn btn-ghost btn-xs" data-hist="${r.id}" title="Version history"><i data-lucide="history"></i></button>
<button class="btn btn-ghost btn-xs" data-goto="scope"><i data-lucide="calculator"></i></button></div></div></div>`;
  }).join('');
  lucide.createIcons();
  g.querySelectorAll('[data-photo]').forEach(async(img)=>{
    const p=img.getAttribute('data-photo'); if(!p) return;
    const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
    if(url){ img.src=url; img.hidden=false; }
  });
  g.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
  g.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{
    const r=list.find(x=>String(x.id)===b.getAttribute('data-open'));
    if(r) openInStudio(r);
  }));
  g.querySelectorAll('[data-hist]').forEach(b=>b.addEventListener('click',()=>{
    const r=list.find(x=>String(x.id)===b.getAttribute('data-hist'));
    if(r) openHistory(r);
  }));
}

/* ---------- version history for one room ---------- */
let HIST_ROOM=null, HIST_LIST=[];
function histModal(){
  let m=document.getElementById('histModal');
  if(!m){
    m=document.createElement('div'); m.id='histModal'; m.className='up-modal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="max-width:560px">'
      +'<h3 id="hmTitle">Version History</h3><p id="hmSub"></p><div id="hmBody"></div>'
      +'<button class="btn btn-ghost btn-block" style="margin-top:10px" data-close>Close</button></div>';
    (document.querySelector('.rd-app')||document.body).appendChild(m);
    m.addEventListener('click',e=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
  }
  return m;
}
let HIST_SEL=[];
async function openHistory(r){
  HIST_ROOM=r; HIST_SEL=[];
  const m=histModal();
  m.querySelector('#hmTitle').textContent=r.name+' \u2014 Version History';
  m.querySelector('#hmSub').textContent=r.address+' \u00b7 '+r.project;
  m.querySelector('#hmBody').innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">Loading versions\u2026</p>';
  m.classList.add('on');
  try{ HIST_LIST=await listRoomVersions({data:{room_id:r.id}}); }
  catch(e){ HIST_LIST=[]; }
  paintHistory();
}
function paintHistory(){
  const m=histModal(), body=m.querySelector('#hmBody');
  if(!HIST_LIST.length){ body.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No saved versions on this room yet.</p>'; return; }
  body.innerHTML=HIST_LIST.map((v,i)=>{
    const st=ST_PILL(v.status);
    const cost=v.total_low!=null?kfmt(v.total_low)+' to '+kfmt(v.total_high):'Not priced';
    const when=new Date(v.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
    return `<div class="rowi" style="padding:10px 0;align-items:center;gap:10px">
<img data-hphoto="${v.after_path||v.before_path||''}" alt="" style="width:52px;height:38px;object-fit:cover;border-radius:6px;background:#EFEDE8" hidden>
<div class="rowt" style="flex:1"><b>v${v.version_no}${i===0?' \u00b7 Latest':''}</b><span class="mono">${cost} \u00b7 ${when}${v.style?' \u00b7 '+v.style:''}</span></div>
<span class="pill ${st[0]}">${st[1]}</span>
<button class="btn btn-ghost btn-xs" data-hopen="${v.id}">Open</button>
<button class="btn btn-ghost btn-xs" data-happ="${v.id}">${v.status==='approved'?'Unapprove':'Approve'}</button>
<label style="display:flex;align-items:center;gap:4px;font-size:.72rem;color:var(--mute-2)"><input type="checkbox" data-hcmp="${v.id}" ${HIST_SEL.indexOf(v.id)>-1?'checked':''}>Compare</label></div>`;
  }).join('')
  +`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px">
<span style="font-size:.75rem;color:var(--mute-2)">${HIST_SEL.length} of 2 selected</span>
<button class="btn btn-primary btn-xs" id="hmCmp" ${HIST_SEL.length===2?'':'disabled'}>Compare Versions</button></div>`;
  body.querySelectorAll('[data-hphoto]').forEach(async(img)=>{
    const p=img.getAttribute('data-hphoto'); if(!p) return;
    const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
    if(url){ img.src=url; img.hidden=false; }
  });
  body.querySelectorAll('[data-hopen]').forEach(b=>b.addEventListener('click',()=>{
    const v=HIST_LIST.find(x=>x.id===b.getAttribute('data-hopen')); if(!v||!HIST_ROOM) return;
    m.classList.remove('on');
    openInStudio({...HIST_ROOM,before_path:v.before_path,after_path:v.after_path,version_no:v.version_no});
  }));
  body.querySelectorAll('[data-happ]').forEach(b=>b.addEventListener('click',async()=>{
    const v=HIST_LIST.find(x=>x.id===b.getAttribute('data-happ')); if(!v) return;
    b.disabled=true;
    try{
      const next=v.status==='approved'?'draft':'approved';
      await setVersionStatus({data:{version_id:v.id,status:next}});
      v.status=next; paintHistory();
      window.dispatchEvent(new Event('rd:saved'));
    }catch(e){ b.disabled=false; }
  }));
  body.querySelectorAll('[data-hcmp]').forEach(cb=>cb.addEventListener('change',()=>{
    const id=cb.getAttribute('data-hcmp');
    const i=HIST_SEL.indexOf(id);
    if(i>-1) HIST_SEL.splice(i,1);
    else { HIST_SEL.push(id); if(HIST_SEL.length>2) HIST_SEL.shift(); }
    paintHistory();
  }));
  const cmpBtn=body.querySelector('#hmCmp');
  if(cmpBtn) cmpBtn.addEventListener('click',paintCompare);
  lucide.createIcons();
}
async function paintCompare(){
  const m=histModal(), body=m.querySelector('#hmBody');
  const picks=HIST_SEL.map(id=>HIST_LIST.find(v=>v.id===id)).filter(Boolean);
  if(picks.length!==2){ paintHistory(); return; }
  picks.sort((a,b)=>a.version_no-b.version_no);
  const [a,b]=picks;
  const money=v=>v.total_low!=null?kfmt(v.total_low)+' to '+kfmt(v.total_high):'Not priced';
  const delta=(a.total_low!=null&&b.total_low!=null)
    ? (()=>{ const d=Number(b.total_low)-Number(a.total_low); const sign=d>0?'+':d<0?'\u2212':''; return sign+kfmt(Math.abs(d))+' on the low end'; })()
    : 'Only one of these versions is priced';
  body.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
${picks.map(v=>`<div><img data-cphoto="${v.after_path||v.before_path||''}" alt="Version ${v.version_no}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#EFEDE8" hidden>
<div style="margin-top:6px"><b style="font-size:.82rem">v${v.version_no}</b>
<div class="mono" style="font-size:.75rem;color:var(--mute-2)">${money(v)}</div>
<div style="font-size:.75rem;color:var(--mute-2)">${v.style||'No style noted'} \u00b7 ${new Date(v.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</div></div></div>`).join('')}
</div>
<div class="rowi" style="margin-top:10px"><div class="rowt"><b>Difference</b><span class="mono">v${a.version_no} to v${b.version_no}: ${delta}</span></div></div>
<button class="btn btn-ghost btn-block" style="margin-top:10px" id="hmBack">Back To History</button>`;
  body.querySelectorAll('[data-cphoto]').forEach(async(img)=>{
    const p=img.getAttribute('data-cphoto'); if(!p) return;
    const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
    if(url){ img.src=url; img.hidden=false; }
  });
  const bk=body.querySelector('#hmBack'); if(bk) bk.addEventListener('click',paintHistory);
  lucide.createIcons();
}
const DFILT=['all','approved','review','archived'];
document.querySelectorAll('#designTabs button').forEach((b,i)=>b.addEventListener('click',()=>{
  document.querySelectorAll('#designTabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  DESIGN_FILTER=DFILT[i]||'all'; paintDesigns();
}));


/* ---------- batch ---------- */
let BATCH_ROOMS=[];
let batchBusy=false;
function batchStateEl(){ return document.getElementById('batchState'); }
function paintBatch(){
  const sel=document.getElementById('batchProp'), list=document.getElementById('batchList');
  if(!sel||!list) return;
  const runBtn=document.getElementById('batchRun');
  if(!PROP_TREE.length){
    sel.innerHTML='<option value="">No properties yet</option>';
    list.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">Add a property and upload room photos to build a batch.</p>';
    BATCH_ROOMS=[];
    const st0=batchStateEl(); if(st0){ st0.className='pill p-gray'; st0.textContent='Nothing To Run'; }
    if(runBtn) runBtn.disabled=true;
    return;
  }
  const keep=sel.value;
  sel.innerHTML=PROP_TREE.map(p=>`<option value="${p.id}">${p.address}</option>`).join('');
  if(keep) sel.value=keep;
  const prop=PROP_TREE.find(p=>p.id===sel.value)||PROP_TREE[0];
  sel.value=prop.id;
  const rooms=[]; prop.projects.forEach(pr=>pr.rooms.forEach(r=>rooms.push(r)));
  BATCH_ROOMS=rooms.filter(r=>!!r.before_path);
  const sub=document.getElementById('batchSub');
  if(sub) sub.textContent=rooms.length?(rooms.length+(rooms.length===1?' room':' rooms')+' on file, '+BATCH_ROOMS.length+' with a photo'):'No rooms on this property yet';
  const st=batchStateEl();
  if(st){ st.className='pill '+(BATCH_ROOMS.length?'p-ok':'p-gray'); st.textContent=BATCH_ROOMS.length?(BATCH_ROOMS.length+' Ready · '+BATCH_ROOMS.length+' Credits'):'Nothing To Run'; }
  if(runBtn) runBtn.disabled=!BATCH_ROOMS.length||batchBusy;
  list.innerHTML=rooms.length
    ? rooms.map(r=>{
        const done=(r.versions||0)>0;
        const ready=!!r.before_path;
        return `<div class="rowi" data-broom="${r.id}"><div class="rowt"><b>${r.name}</b><span data-bmsg>${ready?(done?('v'+(r.version_no||1)+' saved'):'ready to stage'):'no photo on file'}</span></div>
          <span class="pill ${ready?(done?'p-ok':'p-gray'):'p-amb'}" data-bpill>${ready?(done?'Designed':'Queued'):'No Photo'}</span></div>`;
      }).join('')
    : '<p style="font-size:.79rem;color:var(--mute-2)">No rooms on this property yet.</p>';
}
const batchProp=document.getElementById('batchProp');
if(batchProp) batchProp.addEventListener('change',paintBatch);

function batchRowSet(roomId,pillCls,pillText,msg){
  const row=document.querySelector(`[data-broom="${roomId}"]`); if(!row) return;
  const pill=row.querySelector('[data-bpill]'), m=row.querySelector('[data-bmsg]');
  if(pill){ pill.className='pill '+pillCls; pill.textContent=pillText; }
  if(m&&msg) m.textContent=msg;
}

async function runBatch(){
  if(batchBusy||!BATCH_ROOMS.length) return;
  batchBusy=true;
  const runBtn=document.getElementById('batchRun');
  const dirSel=document.querySelector('#v-listings select:not(#batchProp)');
  const direction=((dirSel&&dirSel.value)||'Warm Minimal').replace(/,.*$/,'');
  const st=batchStateEl();
  if(runBtn){ runBtn.disabled=true; runBtn.innerHTML='<i data-lucide="loader"></i>Running Batch'; lucide.createIcons(); }
  let done=0,failed=0;
  const queue=BATCH_ROOMS.slice();
  for(const room of queue){
    if(st){ st.className='pill p-amb'; st.textContent='Staging '+(done+failed+1)+' Of '+queue.length; }
    batchRowSet(room.id,'p-amb','Staging','rendering in '+direction);
    try{
      const src=isStoredPhoto(room.before_path)?await roomPhotoUrl(room.before_path):room.before_path;
      const image=await toDataUrl(src,1100);
      const r=await renderDesign({data:{
        image,
        room_type:room.room_type||'living room',
        direction,
        intensity:'Makeover',
        grade:'Retail Grade',
        notes:null, keep:[], replace:[], remove:[]
      }});
      const afterPath=await uploadRenderDataUrl(r.image);
      const v=await saveRoomVersion({data:{room_id:room.id,before_path:room.before_path,after_path:afterPath,style:direction}});
      done++;
      batchRowSet(room.id,'p-ok','Designed','v'+v.version_no+' saved · '+direction);
      window.dispatchEvent(new Event('rd:credits-changed'));
    }catch(e){
      failed++;
      const gated=creditGate(e);
      batchRowSet(room.id,'p-amb',gated?'Paused':'Failed',(e&&e.message)||'could not render this room');
      if(gated) break;
    }
  }
  if(st){ st.className='pill '+(failed?'p-amb':'p-ok'); st.textContent=done+' Staged'+(failed?', '+failed+' Skipped':''); }
  if(runBtn){ runBtn.disabled=false; runBtn.innerHTML='<i data-lucide="play"></i>Run Batch'; lucide.createIcons(); }
  batchBusy=false;
  try{ window.dispatchEvent(new CustomEvent('rd:saved')); }catch(e){}
  try{ PROP_TREE=await getPropertyTree(); }catch(e){}
}
const batchRun=document.getElementById('batchRun');
if(batchRun) batchRun.addEventListener('click',runBatch);

/* ---------- scope: live pricing from the cost database ---------- */
const SCOPE_ITEMS=[{label:'demolition'},{label:'flooring',material:'lvp'},{label:'wall_paint',material:'paint'},
{label:'baseboard'},{label:'recessed_light',qty:6},{label:'light_fixture',qty:2},{label:'interior_door',qty:2}];
const money=(n)=>'$'+Math.round(n).toLocaleString('en-US');
const scopeRowsEl=document.getElementById('scopeRows');
let scopeMarkets=[];
(function(){ const rs=document.getElementById('fRoom'); if(rs) rs.addEventListener('change',paintStudioSub); })();
function scopeContext(){
  const sp=PROP_TREE[SEL.p]||null, sj=sp?(sp.projects[SEL.pr]||null):null;
  const roomSel=document.getElementById('fRoom');
  const room=roomSel?roomSel.value:'Room';
  return (sp?sp.address+(sj?' \u00b7 '+sj.name:''):'Unsaved room')+' \u00b7 '+room;
}
let lastScope=null;


const K=(n)=>'$'+(n>=1000?(n/1000).toFixed(n>=10000?0:1)+'K':Math.round(n));
function fitClass(f){ if(!f) return 'p-gray'; const s=f.toLowerCase();
  return s.indexOf('within')>=0?'p-ok':(s.indexOf('over')>=0?'p-red':'p-amb'); }

function renderScope(r){
  lastScope=r;
  try{ window.dispatchEvent(new CustomEvent('rd:priced')); }catch(e){}
  showAlert('');
  /* group priced lines by trade, with a subtotal per trade */
  const groups=[]; const idx={};
  r.lines.forEach(l=>{ if(idx[l.trade]===undefined){ idx[l.trade]=groups.length; groups.push({trade:l.trade,lines:[]}); }
    groups[idx[l.trade]].lines.push(l); });
  scopeRowsEl.innerHTML=groups.map(g=>{
    const low=g.lines.reduce((a,l)=>a+l.line_low,0), high=g.lines.reduce((a,l)=>a+l.line_high,0);
    return `<tr class="trade-h"><td colspan="3">${g.trade}</td><td class="n">${money(low)}</td><td class="n">${money(high)}</td></tr>`
    +g.lines.map(l=>`<tr><td><b>${l.description}</b>${l.is_fallback?' <span class="pill p-amb">Fallback</span>':''}<span class="src">${l.price_source}</span></td>
<td>${l.trade}</td><td class="n">${l.qty} ${l.uom}</td><td class="n">${money(l.line_low)}</td><td class="n">${money(l.line_high)}</td></tr>`).join('');
  }).join('')
  +`<tr><td><b>Contingency At ${r.contingency_pct}%</b></td><td>General</td><td class="n">1 ls</td>
<td class="n">${money(r.contingency_low)}</td><td class="n">${money(r.contingency_high)}</td></tr>`;
  document.getElementById('scopeTotLow').textContent=money(r.total_low);
  document.getElementById('scopeTotHigh').textContent=money(r.total_high);
  document.getElementById('scopeTotLab').textContent='Estimated Total'+(r.budget_fit?' · '+r.budget_fit:'');
  const _sp=PROP_TREE[SEL.p], _sj=_sp?_sp.projects[SEL.pr]:null;
  const _scx=_sp?(_sp.address+(_sj?' · '+_sj.name:'')):'Unsaved room';
  document.getElementById('scopeSub').textContent=`${_scx} · ${r.grade[0].toUpperCase()+r.grade.slice(1)} Grade · ${r.market.name}`;
  document.getElementById('scopeNote').textContent=`${r.disclaimer} Quantities are derived from the measurements above and should be field verified.`;

  /* summary header */
  document.getElementById('esRange').textContent=money(r.total_low)+' to '+money(r.total_high);
  const fit=document.getElementById('esFit');
  fit.className='pill '+fitClass(r.budget_fit); fit.textContent=r.budget_fit||'No Target Set';
  const target=parseFloat(document.getElementById('scBudget').value);
  const wrap=document.getElementById('esMeterWrap');
  if(Number.isFinite(target)&&target>0){
    wrap.style.display='';
    const pct=Math.max(4,Math.min(100,(r.total_high/target)*100));
    const bar=document.getElementById('esMeter');
    bar.style.width=pct+'%';
    bar.className=r.total_high<=target?'ok':(r.total_low>target?'over':'near');
    document.getElementById('esTarget').textContent='Target '+K(target);
  } else { wrap.style.display='none'; }
  const dims=dimsProposal?(dimsConfirmed?'Dimensions Confirmed':'Dimensions Proposed, Not Confirmed'):'Dimensions Entered By You';
  document.getElementById('esChips').innerHTML=[
    ['Layout Confidence',r.layout_conf],['Pricing Confidence',r.pricing_conf],
    ['Cost Records Matched',r.matched_pct+'%'],['Material',money(r.material_low)+' to '+money(r.material_high)],
    ['Labor',money(r.labor_low)+' to '+money(r.labor_high)],['Measurements',dims]
  ].map(([k,v])=>`<span class="es-chip"><span>${k}</span><b>${v}</b></span>`).join('');
  const dm=document.getElementById('dmRehab'); if(dm) dm.textContent=K(r.total_low)+' to '+K(r.total_high);
  const brief=document.getElementById('scBrief'); if(brief) brief.disabled=false;
  renderAllowance(r);
}

function showAlert(msg){
  const a=document.getElementById('estAlert'); if(!a) return;
  a.style.display=msg?'':'none'; a.textContent=msg||'';
}


/* ---------- phase 5: materials allowance list, derived from the priced scope ---------- */
function renderAllowance(r){
  const rows=document.getElementById('allowRows'); if(!rows) return;
  const note=document.getElementById('allowNote'), sub=document.getElementById('allowSub');
  if(!r){ rows.innerHTML='<tr><td colspan="5">No priced scope yet.</td></tr>';
    note.textContent='Open Scope & Budget and price a scope to build the allowance list.'; return; }
  const mat=r.lines.filter(l=>l.material_high>0);
  if(!mat.length){ rows.innerHTML='<tr><td colspan="5">This scope is labor only, so there is no material allowance.</td></tr>';
    note.textContent='No material lines in the current scope.'; return; }
  rows.innerHTML=mat.map(l=>`<tr><td><b>${l.description}</b>${l.is_fallback?' <span class="pill p-amb">Fallback</span>':''}<div class="sub">${l.price_source}</div></td>
<td>${l.trade}</td><td class="n">${l.qty} ${l.uom}</td><td class="n">${money(l.material_low)}</td><td class="n">${money(l.material_high)}</td></tr>`).join('')
  +`<tr><td colspan="3"><b>Material Allowance Total</b></td><td class="n"><b>${money(r.material_low)}</b></td><td class="n"><b>${money(r.material_high)}</b></td></tr>`;
  sub.textContent=`${mat.length} material lines · ${r.market.name} · ${r.grade[0].toUpperCase()+r.grade.slice(1)} grade`;
  note.textContent='Planning allowances per line, not product prices. Fit to your space is not asserted until dimensions are confirmed.';
}
function allowanceCsv(){
  const r=lastScope; if(!r) return;
  const rows=[['Material Line','Trade','Qty','UOM','Allowance Low','Allowance High','Price Source']]
    .concat(r.lines.filter(l=>l.material_high>0).map(l=>[l.description,l.trade,l.qty,l.uom,l.material_low,l.material_high,l.price_source]));
  const csv=rows.map(r2=>r2.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='real-designs-materials-allowance.csv'; a.click(); URL.revokeObjectURL(a.href);
}

let scopeBusy=false;
async function runScope(){
  if(scopeBusy) return;
  scopeBusy=true;
  const sel=document.getElementById('scMarket');
  const runBtn=document.getElementById('scRun');
  const val=(id,d)=>{const v=parseFloat((document.getElementById(id)||{}).value);return Number.isFinite(v)&&v>0?v:d;};
  runBtn.disabled=true; runBtn.classList.add('is-busy');
  document.getElementById('estSum').classList.add('is-loading');
  scopeRowsEl.innerHTML=Array.from({length:5}).map(()=>
    '<tr class="sk"><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td></tr>').join('');
  try{
    const r=await priceScopePreview({data:{
      market_id: sel && sel.value ? sel.value : undefined,
      grade: document.getElementById('scGrade').value,
      floor_area_sf: val('scFloor',340), wall_area_sf: val('scWall',780), perimeter_lf: val('scPerim',76),
      dims_source: dimsProposal ? (dimsConfirmed?'user':'depth_estimate') : 'user',
      budget_target: val('scBudget',null),
      items: scopeItems,
    }});
    if(scopeMarkets.length!==r.markets.length){
      scopeMarkets=r.markets;
      sel.innerHTML=r.markets.map(m=>`<option value="${m.id}"${m.id===r.market.id?' selected':''}>${m.name}</option>`).join('');
    }
    renderScope(r);
  }catch(e){
    scopeRowsEl.innerHTML='<tr><td colspan="5">No priced lines.</td></tr>';
    if(!creditGate(e)) showAlert('Could not price this scope. '+((e&&e.message)||'Try again in a moment.'));
  }finally{
    scopeBusy=false; runBtn.disabled=false; runBtn.classList.remove('is-busy');
    document.getElementById('estSum').classList.remove('is-loading');
  }
}


let scopeItems=SCOPE_ITEMS.slice();

function currentRoomType(){
  const el=document.getElementById('svType');
  const v=el&&el.value?el.value.trim():'';
  return v||'living room';
}

function studioSrc(which){
  const el=document.querySelector(which==='after'?'#cAfter img':'#cBefore img');
  if(el&&el.src) return el.src;
  return which==='after'?(lastRender||PHOTOS.after):PHOTOS.before;
}

async function toDataUrl(src,max){
  const img=new Image(); img.crossOrigin='anonymous'; img.src=src;
  await img.decode();
  const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');
  c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.72);
}

async function detectScopeChanges(){
  const btn=document.getElementById('scDetect');
  const note=document.getElementById('scopeNote');
  btn.disabled=true; const lab=btn.innerHTML; btn.textContent='Reading Photos\u2026';
  try{
    const [before,after]=await Promise.all([toDataUrl(studioSrc('before'),900),toDataUrl(lastRender||studioSrc('after'),900)]);
    const r=await detectChanges({data:{before,after,grade:document.getElementById('scGrade').value}});
    window.dispatchEvent(new Event('rd:credits-changed'));
    if(r.priceable.length){ scopeItems=r.priceable; }
    await runScope();
    if(r.summary) note.textContent=r.summary+' '+note.textContent;
  }catch(e){
    if(!creditGate(e)) showAlert('Could not read the photos. '+((e&&e.message)||''));
  }finally{ btn.disabled=false; btn.innerHTML=lab; }
}

/* ---------- phase 3: dimensions proposed by AI, confirmed by a person ---------- */
let dimsConfirmed=false, dimsProposal=null;
function setDimsSource(){
  const b=document.getElementById('scDimsBadge');
  if(!dimsProposal){ b.style.display='none'; return; }
  b.style.display='';
  b.className='pill '+(dimsConfirmed?'p-ok':'p-amb');
  b.textContent=(dimsConfirmed?'Dimensions Confirmed':'Proposed \u00b7 '+dimsProposal.confidence[0].toUpperCase()+dimsProposal.confidence.slice(1)+' Confidence');
  document.getElementById('scDimsOk').style.display=dimsConfirmed?'none':'';
}
async function runDims(){
  const btn=document.getElementById('scDims'); const note=document.getElementById('scopeNote');
  btn.disabled=true; const lab=btn.innerHTML; btn.textContent='Measuring\u2026';
  try{
    const image=await toDataUrl(studioSrc('before'),900);
    const r=await estimateDimensions({data:{image,room_type:currentRoomType()}});
    dimsProposal=r; dimsConfirmed=false;
    document.getElementById('scFloor').value=r.floor_area_sf;
    document.getElementById('scWall').value=r.wall_area_sf;
    document.getElementById('scPerim').value=r.perimeter_lf;
    setDimsSource();
    await runScope();
    note.textContent=r.basis+' '+r.disclaimer+' '+note.textContent;
  }catch(e){
    if(!creditGate(e)) showAlert('Could not measure this photo. '+((e&&e.message)||''));
  }finally{ btn.disabled=false; btn.innerHTML=lab; }
}

/* ---------- phase 4: contractor brief, rendered from the priced scope ---------- */
function briefHtml(r){
  const esc=(s)=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const divs={};
  r.lines.forEach(l=>{ (divs[l.csi_division]=divs[l.csi_division]||{trade:l.trade,lines:[]}).lines.push(l); });
  const groups=Object.keys(divs).sort().map(d=>{
    const g=divs[d];
    const low=g.lines.reduce((a,l)=>a+l.line_low,0), high=g.lines.reduce((a,l)=>a+l.line_high,0);
    return `<h3>${esc(d)} &middot; ${esc(g.trade)}</h3>
<table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Material</th><th class="n">Labor</th><th style="text-align:right">Low</th><th style="text-align:right">High</th></tr></thead><tbody>
${g.lines.map(l=>`<tr><td>${esc(l.description)}${l.is_fallback?' <em>(fallback cost record)</em>':''}<br><span class="src">${esc(l.price_source)}</span></td>
<td class="n">${l.qty} ${esc(l.uom)}</td><td class="n">${money(l.material_low)}&ndash;${money(l.material_high)}</td>
<td class="n">${money(l.labor_low)}&ndash;${money(l.labor_high)}</td><td class="n">${money(l.line_low)}</td><td class="n">${money(l.line_high)}</td></tr>`).join('')}
<tr class="sub"><td colspan="4">Division Subtotal</td><td class="n">${money(low)}</td><td class="n">${money(high)}</td></tr>
</tbody></table>`;
  }).join('');
  const dimLine=`${document.getElementById('scFloor').value} SF floor &middot; ${document.getElementById('scWall').value} SF wall &middot; ${document.getElementById('scPerim').value} LF perimeter`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Contractor Brief &middot; REAL DESIGNS</title>
<style>
*{box-sizing:border-box}body{font:13px/1.5 'DM Sans',system-ui,sans-serif;color:#141414;margin:0;padding:36px 44px;background:#fff}
h1{font-size:22px;margin:0 0 2px}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a;margin:26px 0 8px}
h3{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #e6e6e6;padding-bottom:5px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #CC0000;padding-bottom:12px}
.meta{color:#6b6b6b;font-size:12px}
.photos{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.photos figure{margin:0}.photos img{width:100%;border:1px solid #e0e0e0;display:block}
figcaption{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a;margin-top:5px}
table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;text-align:left;vertical-align:top;border-bottom:1px solid #efefef}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8a8a}
.n{text-align:right;font-family:'DM Mono',ui-monospace,monospace;white-space:nowrap}
.src{font-size:10px;color:#a0a0a0;font-family:ui-monospace,monospace}
tr.sub td{font-weight:700;background:#fafafa}
.totals{margin-top:18px;border:1px solid #e0e0e0;padding:14px}
.totals .row{display:flex;justify-content:space-between;padding:4px 0}
.totals .grand{border-top:1px solid #e0e0e0;margin-top:6px;padding-top:10px;font-size:16px;font-weight:700}
.note{margin-top:18px;font-size:11.5px;color:#5c5c5c;border-left:3px solid #CC0000;padding-left:12px}
.sig{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:34px}
.sig div{border-top:1px solid #141414;padding-top:6px;font-size:11px;color:#6b6b6b}
@media print{body{padding:0}}
</style></head><body>
<div class="head"><div><h1>Contractor Brief</h1><div class="meta">${esc(scopeContext())} &middot; ${esc(r.grade[0].toUpperCase()+r.grade.slice(1))} Grade</div></div>
<div class="meta" style="text-align:right">REAL DESIGNS<br>${esc(r.market.name)}<br>${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>
<div class="photos"><figure><img src="${PHOTOS.before}" alt="Existing condition of the space"><figcaption>Existing Condition</figcaption></figure>
<figure><img src="${PHOTOS.after}" alt="Proposed design for the space"><figcaption>Proposed Design</figcaption></figure></div>
<h2>Room Measurements</h2><div class="meta">${esc(dimLine)} &middot; Layout confidence ${esc(r.layout_conf)}${dimsProposal&&!dimsConfirmed?' &middot; dimensions proposed from a photo and not yet confirmed':''}</div>
<h2>Scope Of Work By Trade</h2>${groups}
<div class="totals">
<div class="row"><span>Material</span><b class="n">${money(r.material_low)} &ndash; ${money(r.material_high)}</b></div>
<div class="row"><span>Labor</span><b class="n">${money(r.labor_low)} &ndash; ${money(r.labor_high)}</b></div>
<div class="row"><span>Subtotal</span><b class="n">${money(r.subtotal_low)} &ndash; ${money(r.subtotal_high)}</b></div>
<div class="row"><span>Contingency At ${r.contingency_pct}%</span><b class="n">${money(r.contingency_low)} &ndash; ${money(r.contingency_high)}</b></div>
<div class="row grand"><span>Estimated Planning Range${r.budget_fit?' &middot; '+esc(r.budget_fit):''}</span><span class="n">${money(r.total_low)} &ndash; ${money(r.total_high)}</span></div>
</div>
<div class="note"><b>Confidence Statement.</b> Layout confidence ${esc(r.layout_conf)}. Pricing confidence ${esc(r.pricing_conf)}, with ${r.matched_pct}% of lines matched to an exact cost record for this market and finish grade. Costs are adjusted to ${esc(r.market.name)} labor and material factors.<br><br>
<b>Disclosure.</b> ${esc(r.disclaimer)} Quantities derive from the measurements above; verify in the field before ordering material or committing to a schedule. Line items exclude permits, structural work, abatement, and any condition not visible in the photographs.</div>
<div class="sig"><div>Contractor Signature &amp; Date</div><div>Owner Signature &amp; Date</div></div>
</body></html>`;
}
function exportBrief(){
  if(!lastScope){ return; }
  const w=window.open('','_blank');
  if(!w){ showAlert('Allow pop-ups to open the contractor brief.'); return; }
  w.document.write(briefHtml(lastScope));
  w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} },600);
}
document.getElementById('scBrief').addEventListener('click',exportBrief);
document.getElementById('scBrief').disabled=true;
document.getElementById('allowBuild').addEventListener('click',()=>{ lastScope?renderAllowance(lastScope):runScope(); });
document.getElementById('allowCsv').addEventListener('click',allowanceCsv);
renderAllowance(null);
document.getElementById('scDims').addEventListener('click',runDims);

document.getElementById('scDimsOk').addEventListener('click',async()=>{ dimsConfirmed=true; setDimsSource(); await runScope(); });
['scFloor','scWall','scPerim'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{
  if(dimsProposal){ dimsConfirmed=false; setDimsSource(); }
}));
document.getElementById('scDetect').addEventListener('click',detectScopeChanges);
document.getElementById('scRun').addEventListener('click',runScope);
['scGrade','scMarket'].forEach(id=>document.getElementById(id).addEventListener('change',runScope));
let bTimer=null;
document.getElementById('scBudget').addEventListener('input',()=>{ clearTimeout(bTimer); bTimer=setTimeout(runScope,500); });
runScope();


/* ---------- budget bands: each one reprices the same room ---------- */
const BAND_ITEMS={
  refresh:[{label:'wall_paint',material:'paint'},{label:'light_fixture',qty:2}],
  makeover:SCOPE_ITEMS.slice(),
  renovation:SCOPE_ITEMS.concat([{label:'base_cabinet'},{label:'countertop',material:'quartz'}]),
  remodel:SCOPE_ITEMS.concat([{label:'base_cabinet'},{label:'countertop',material:'quartz'},
    {label:'wall_tile',material:'ceramic'},{label:'vanity',qty:1},{label:'sink_faucet',qty:1}])
};
const bands=[['refresh','Refresh','Paint And Lighting Only','rental',5000],
['makeover','Makeover','Adds Flooring, Casing, Doors','retail',15000],
['renovation','Renovation','Adds Cabinetry And Countertops','retail',35000],
['remodel','Full Remodel','Adds Tile, Vanity, Plumbing Fixtures','premium',62000]];
let bandOn='makeover';
function paintBands(){
  document.getElementById('bandList').innerHTML=bands.map(([k,n,d])=>`
<button class="rowi band-row${k===bandOn?' on':''}" data-band="${k}"><div class="rowt"><b>${n}</b><span>${d}</span></div>
<div style="text-align:right">${k===bandOn?'<span class="pill p-ink">Selected</span>':'<span class="pill p-gray">Price It</span>'}</div></button>`).join('');
  document.querySelectorAll('#bandList .band-row').forEach(b=>b.addEventListener('click',async()=>{
    const k=b.getAttribute('data-band'); if(k===bandOn||scopeBusy) return;
    bandOn=k; paintBands();
    const row=bands.find(x=>x[0]===k);
    scopeItems=BAND_ITEMS[k].slice();
    document.getElementById('scGrade').value=row[3];
    document.getElementById('scBudget').value=row[4];
    document.getElementById('bandSub').textContent='Same Room, Same Photo · '+row[1]+' Priced';
    await runScope();
  }));
}
paintBands();


/* ---------- product board ---------- */
const RETAIL=[
  [/floor|tile|carpet|lvp|hardwood/i,'Home Depot','https://www.homedepot.com/s/'],
  [/paint|drywall|texture|primer/i,'Home Depot','https://www.homedepot.com/s/'],
  [/light|fixture|sconce|recessed|electrical/i,'Lowes','https://www.lowes.com/search?searchTerm='],
  [/cabinet|counter|vanity|door|casing|baseboard|trim|hardware/i,'Home Depot','https://www.homedepot.com/s/'],
  [/sink|faucet|toilet|shower|plumb/i,'Ferguson','https://www.ferguson.com/search/'],
  [/sofa|chair|rug|table|bed|lamp|art|decor|furnish|stag/i,'Wayfair','https://www.wayfair.com/keyword.php?keyword=']
];
function boardSearch(desc,grade){
  const q=String(desc||'').replace(/,\s*installed/i,'').trim();
  const term=(grade&&grade!=='retail'?grade+' ':'')+q;
  for(const [re,name,base] of RETAIL){ if(re.test(q)) return {name,url:base+encodeURIComponent(term)}; }
  return {name:'Google Shopping',url:'https://www.google.com/search?tbm=shop&q='+encodeURIComponent(term)};
}
function boardLines(r){ return r?r.lines.filter(l=>l.material_high>0):[]; }

/* purchase tracking, per material line, saved on this device */
const BUY_KEY='rd.board.buy';
const BUY_STATES=[['todo','To Buy','p-gray'],['ordered','Ordered','p-amb'],['received','Received','p-ok']];
function buyMap(){ try{ return JSON.parse(localStorage.getItem(BUY_KEY)||'{}')||{}; }catch(e){ return {}; } }
function buyKey(l){ return (l.trade+'|'+l.description).toLowerCase().replace(/[^a-z0-9|]+/g,'-'); }
function buyStatus(l){ const v=buyMap()[buyKey(l)]; return v==='ordered'||v==='received'?v:'todo'; }
function buySet(k,v){ const m=buyMap(); if(v==='todo') delete m[k]; else m[k]=v; try{ localStorage.setItem(BUY_KEY,JSON.stringify(m)); }catch(e){} }
function buyLabel(s){ const f=BUY_STATES.find(x=>x[0]===s)||BUY_STATES[0]; return f[1]; }
function buyPill(s){ const f=BUY_STATES.find(x=>x[0]===s)||BUY_STATES[0]; return f[2]; }
let BOARD_FILTER='all';

function renderProductBoard(r){
  const g=document.getElementById('prodGrid'); if(!g) return;
  const sub=document.getElementById('shopSub');
  const mat=boardLines(r);
  const bar=document.getElementById('boardTrack');
  if(!mat.length){
    g.innerHTML='<div class="card" style="grid-column:1/-1"><div class="card-b">'+
      '<b style="display:block;margin-bottom:5px">No Material Lines Yet</b>'+
      '<span style="font-size:.8rem;color:var(--mute-2)">Price a scope in Scope &amp; Budget and every material line lands here as a shoppable card with its allowance.</span>'+
      '</div></div>';
    if(sub) sub.textContent='Price a scope to build the board';
    if(bar) bar.remove();
    return;
  }
  renderBoardTrack(mat);
  const shown=mat.filter(l=>BOARD_FILTER==='all'||buyStatus(l)===BOARD_FILTER);
  g.innerHTML=(shown.length?shown:[]).map(l=>{
    const s=boardSearch(l.description,r.grade);
    const st=buyStatus(l), k=buyKey(l);
    return `<div class="card"><div class="card-b">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mute-2)">${esc(l.trade)}</div>
        <span class="pill ${buyPill(st)}">${buyLabel(st)}</span></div>
      <b style="display:block;margin:4px 0 6px">${esc(l.description)}</b>
      <div style="font-size:.78rem;color:var(--mute-2);margin-bottom:10px">${l.qty} ${esc(l.uom)} &middot; ${esc(l.price_source)}</div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:11px">
        <span style="font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mute-2)">Allowance</span>
        <b style="font-family:'DM Mono',monospace">${money(l.material_low)} to ${money(l.material_high)}</b></div>
      <div class="notif-tabs" style="margin:0 0 9px">${BUY_STATES.map(([v,lab])=>
        `<button class="notif-tab${st===v?' on':''}" data-buy="${k}" data-buyv="${v}">${lab}</button>`).join('')}</div>
      <a class="btn btn-ghost btn-xs" style="width:100%;justify-content:center" href="${s.url}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Shop On ${esc(s.name)}</a>
    </div></div>`;
  }).join('')||'<div class="card" style="grid-column:1/-1"><div class="card-b"><b>Nothing In This Status</b><div class="sub">Switch the filter to see the rest of the board.</div></div></div>';
  if(sub) sub.textContent=`${mat.length} shoppable lines · ${r.market.name} · ${r.grade[0].toUpperCase()+r.grade.slice(1)} grade allowances`;
  lucide.createIcons();
}

function renderBoardTrack(mat){
  const g=document.getElementById('prodGrid'); if(!g) return;
  let bar=document.getElementById('boardTrack');
  if(!bar){ bar=document.createElement('div'); bar.className='card'; bar.id='boardTrack';
    bar.style.marginBottom='16px'; g.parentNode.insertBefore(bar,g); }
  const counts={todo:0,ordered:0,received:0};
  mat.forEach(l=>{ counts[buyStatus(l)]++; });
  const done=counts.received, pct=Math.round((done/mat.length)*100);
  const tabs=[['all','All',mat.length]].concat(BUY_STATES.map(([v,lab])=>[v,lab,counts[v]]));
  bar.innerHTML=`<div class="card-h"><div><h3>Purchase Tracking</h3>
      <div class="sub">${done} of ${mat.length} lines received &middot; ${counts.ordered} ordered &middot; saved on this device</div></div>
      <button class="btn btn-ghost btn-xs" id="boardReset"><i data-lucide="rotate-ccw"></i>Reset Statuses</button></div>
    <div class="card-b" style="padding-top:2px">
      <div class="meter" style="margin-bottom:10px"><i style="width:${Math.max(2,pct)}%"></i></div>
      <div class="notif-tabs" id="boardTabs">${tabs.map(([v,lab,n])=>
        `<button class="notif-tab${BOARD_FILTER===v?' on':''}" data-bf="${v}">${lab} ${n}</button>`).join('')}</div>
    </div>`;
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-buy]');
  if(b){ buySet(b.getAttribute('data-buy'),b.getAttribute('data-buyv')); renderProductBoard(lastScope); return; }
  const f=e.target.closest('[data-bf]');
  if(f){ BOARD_FILTER=f.getAttribute('data-bf'); renderProductBoard(lastScope); return; }
  if(e.target.closest('#boardReset')){ try{ localStorage.removeItem(BUY_KEY); }catch(_){} renderProductBoard(lastScope); }
});

function boardCsv(){
  const r=lastScope; if(!r) return;
  const rows=[['Item','Trade','Qty','UOM','Allowance Low','Allowance High','Status','Retailer','Search Link']]
    .concat(boardLines(r).map(l=>{const s=boardSearch(l.description,r.grade);
      return [l.description,l.trade,l.qty,l.uom,l.material_low,l.material_high,buyLabel(buyStatus(l)),s.name,s.url];}));

  const csv=rows.map(r2=>r2.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='real-designs-product-board.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function boardPrintHtml(title,sub,grade,lines,totals){
  const rows=lines.map(l=>{const s=boardSearch(l.description,grade);
    return `<tr><td><b>${esc(l.description)}</b><div class="s">${esc(l.price_source||'')}</div></td><td>${esc(l.trade)}</td>
<td class="n">${l.qty} ${esc(l.uom)}</td><td class="n">${presMoney(l.material_low)} &ndash; ${presMoney(l.material_high)}</td>
<td>${esc(buyLabel(buyStatus(l)))}</td>
<td><a href="${s.url}">${esc(s.name)}</a></td></tr>`;}).join('')||'<tr><td colspan="6">No material lines.</td></tr>';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — Product Board</title><style>
@page{size:letter;margin:14mm}body{font:13px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#141414;margin:0}
.mast{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #CC0000;padding-bottom:10px;margin-bottom:16px}
.brand{font-weight:800;letter-spacing:.16em;font-size:12px;text-transform:uppercase}.brand b{color:#CC0000}
h1{font-size:20px;margin:0 0 4px}.sub{color:#6b6b6b;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #ececec;vertical-align:top}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b}td.n,th.n{text-align:right}
td .s{color:#8a8a8a;font-size:10px}a{color:#CC0000}
.note{margin-top:16px;font-size:10.5px;color:#6b6b6b;border-top:1px solid #ececec;padding-top:10px}
</style></head><body><div class="mast"><div><div class="brand">REAL<b>&nbsp;DESIGNS</b></div><h1>${esc(title)}</h1>
<div class="sub">${esc(sub)}</div></div><div class="sub" style="text-align:right">Product Board<br>${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div></div>
<table><thead><tr><th>Item</th><th>Trade</th><th class="n">Quantity</th><th class="n">Allowance</th><th>Status</th><th>Where To Buy</th></tr></thead><tbody>${rows}</tbody>
${totals?`<tfoot><tr><td colspan="3"><b>Material Allowance Total</b></td><td class="n"><b>${presMoney(totals[0])} &ndash; ${presMoney(totals[1])}</b></td><td></td><td></td></tr></tfoot>`:''}</table>

<div class="note">Allowances are planning figures per line at the selected finish grade, not quoted product prices. Retailer links are searches, not endorsements or reserved stock.</div>
</body></html>`;
}
function boardPrint(){
  const r=lastScope; if(!r){ showAlert('Price a scope first, then print the board.'); return; }
  const sp=PROP_TREE[SEL.p], sj=sp?sp.projects[SEL.pr]:null;
  const w=window.open('','_blank'); if(!w) return;
  w.document.write(boardPrintHtml('Product Board',
    (sp?sp.address+(sj?' · '+sj.name:''):'Unsaved room')+' · '+r.market.name+' · '+r.grade+' grade',
    r.grade, boardLines(r), [r.material_low,r.material_high]));
  w.document.close(); w.focus(); setTimeout(()=>{try{w.print();}catch(_){}} ,600);
}
renderProductBoard(lastScope);
window.addEventListener('rd:priced',()=>renderProductBoard(lastScope));
const boardCsvBtn=document.getElementById('boardCsv');
if(boardCsvBtn) boardCsvBtn.addEventListener('click',boardCsv);
const boardPrintBtn=document.getElementById('boardPrint');
if(boardPrintBtn) boardPrintBtn.addEventListener('click',boardPrint);

/* ---------- presentations ---------- */
const pkg=[['Before And After Slider','In the client approval link','p-ok','Live'],
['Scope Of Work And Budget','Line items and range in the link','p-ok','Live'],
['Client Decision Capture','Approve or request changes, tracked','p-ok','Live'],
['Branded PDF Export','Print ready package from any link','p-ok','Live'],
['Walkthrough Video','Dolly in, eight seconds, from Studio','p-ok','Live'],
['Product Board','Allowance per item with a buy search','p-ok','Live'],
['Social Reel, 9x16','Cross fade before to after, 12 seconds','p-ok','Live']];
document.getElementById('pkgList').innerHTML=pkg.map(([n,d,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div><span class="${cls.startsWith('plan-pill')?cls:'pill '+cls}">${lab}</span></div>`).join('');

const PRES_STATUS={sent:['p-gray','Sent'],viewed:['p-blue','Opened'],approved:['p-ok','Approved'],changes:['p-amb','Changes Requested']};
let PRES_ROWS=[];

function presAgo(iso){
  if(!iso) return 'never';
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60) return 'just now';
  if(d<3600) return Math.floor(d/60)+'m ago';
  if(d<86400) return Math.floor(d/3600)+'h ago';
  return Math.floor(d/86400)+'d ago';
}

function presLink(token){ return location.origin+'/p/'+token; }

let PRES_FILTER='all';
const PRES_TABS=[['all','All'],['sent','Awaiting'],['viewed','Opened'],['approved','Approved'],['changes','Changes']];

function presMatch(r){
  if(PRES_FILTER==='all') return true;
  return (r.status||'sent')===PRES_FILTER;
}

function renderPresRows(){
  const el=document.getElementById('linkList'); if(!el) return;
  const counts=PRES_TABS.map(([k])=>k==='all'?PRES_ROWS.length:PRES_ROWS.filter(r=>(r.status||'sent')===k).length);
  const tabs=`<div class=\"notif-tabs\" id=\"presTabs\" style=\"margin:0 0 10px\">`+
    PRES_TABS.map(([k,l],i)=>`<button class=\"notif-tab${PRES_FILTER===k?' on':''}\" data-pf=\"${k}\">${l} ${counts[i]}</button>`).join('')+`</div>`;
  const rows=PRES_ROWS.filter(presMatch);
  const body=rows.length?rows.map(r=>{
    const [cls,lab]=PRES_STATUS[r.status]||PRES_STATUS.sent;
    const who=r.client_name?('Sent to '+esc(r.client_name)):'No recipient named';
    const seen=r.view_count?(r.view_count===1?'opened once':'opened '+r.view_count+' times'):'not opened';
    const ctx=[r.address,r.room_name].filter(Boolean).map(esc).join(' &middot; ');
    const dropped=(r.excluded_count||0)?`<span class="pill warn" style="margin-left:6px">${r.excluded_count} Line${r.excluded_count===1?'':'s'} Removed</span>`:'';
    const note=(r.decision_note||r.excluded_count)?`<div class=\"rowi\" style=\"border-top:0;padding-top:0\"><div class=\"rowt\" style=\"padding-left:2px\"><span style=\"color:var(--mute-2)\">${r.decision_note?`<i>&ldquo;${esc(r.decision_note)}&rdquo;</i> &mdash; ${esc(r.client_name||'client')}`:`${esc(r.client_name||'The client')} trimmed the scope`}</span>${dropped}</div></div>`:'';
    return `<div class=\"rowi\" data-pid=\"${r.id}\" data-tok=\"${r.token}\">
      <div class=\"rowt\"><b>${esc(r.title)}</b><span>${ctx?ctx+' &middot; ':''}${who} &middot; ${seen} &middot; ${presAgo(r.last_viewed_at||r.created_at)}</span></div>
      <span class="pill ${cls}">${lab}</span>
      <button class="icon-btn" data-send title="Send to client"><i data-lucide="send"></i></button>
      <button class="icon-btn" data-copy title="Copy link"><i data-lucide="copy"></i></button>
      <button class="icon-btn" data-pdf title="Branded PDF"><i data-lucide="file-text"></i></button>
      <button class="icon-btn" data-board title="Product board"><i data-lucide="shopping-bag"></i></button>
      <button class="icon-btn" data-reel title="Social reel, 9x16"><i data-lucide="clapperboard"></i></button>
      <button class="icon-btn" data-del title="Delete link"><i data-lucide="trash-2"></i></button></div>${note}`;
  }).join(''):'<p style="font-size:.79rem;color:var(--mute-2)">No links with that status yet.</p>';
  el.innerHTML=tabs+body;
  lucide.createIcons();
}

async function paintPresentations(){
  const el=document.getElementById('linkList'); if(!el) return;
  try{ PRES_ROWS=await listPresentations(); }
  catch(e){ PRES_ROWS=[]; }
  updateSearchMeta();
  if(!PRES_ROWS.length){
    el.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No client links yet. Save a room in Studio, then use New Link to share it for approval.</p>';
    return;
  }
  renderPresRows();
}

/* jump to one client link from the dashboard attention list */
async function focusPresentation(pid){
  if(!PRES_ROWS.length) await paintPresentations();
  if(PRES_FILTER!=='all'){ PRES_FILTER='all'; renderPresRows(); }
  const row=document.querySelector('#linkList [data-pid="'+pid+'"]');
  if(!row) return;
  row.scrollIntoView({block:'center',behavior:'smooth'});
  row.classList.remove('rd-flash'); void row.offsetWidth; row.classList.add('rd-flash');
  setTimeout(()=>row.classList.remove('rd-flash'),2400);
}



const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const presMoney=(n)=>'$'+Math.round(n||0).toLocaleString('en-US');

/* ---------- reports ---------- */
let REPORT=null, REPORT_LOADING=false;
const FIT_PILL={under:['p-ok','Under Budget'],at:['p-amb','At Budget'],over:['p-red','Over Budget'],unknown:['p-gray','No Target']};
const ACT_LABEL={design:'Designs',scope:'Scope Runs',plan_3d:'3D Plans',video:'Walkthrough Videos',topup:'Top Ups',grant:'Grants',refund:'Refunds'};

function reportKpis(r){
  const el=document.getElementById('repKpis'); if(!el) return;
  const cards=[
    ['map-pin','Properties',String(r.totals.properties),'Across the workspace'],
    ['images','Designs Saved',String(r.totals.designs),r.totals.approved+' approved'],
    ['calculator','Scope Range',presMoney(r.totals.low)+' &ndash; '+presMoney(r.totals.high),'Planning estimate, not a bid'],
    ['coins','Credits Spent',String(r.credits.spent30),'Last 30 days']
  ];
  el.innerHTML=cards.map(c=>`<div class="kpi"><div class="t"><i data-lucide="${c[0]}"></i>${c[1]}</div><b>${c[2]}</b><div class="d">${c[3]}</div></div>`).join('');
}

function reportRows(r){
  const tb=document.getElementById('repRows'); if(!tb) return;
  if(!r.rows.length){
    tb.innerHTML='<tr><td colspan="9" style="color:var(--mute-2);font-size:.79rem">No properties yet. Save a room in Studio to start the rollup.</td></tr>';
    return;
  }
  tb.innerHTML=r.rows.map(x=>{
    const fit=FIT_PILL[x.budget_fit]||FIT_PILL.unknown;
    const range=x.priced?presMoney(x.low)+' &ndash; '+presMoney(x.high):'<span style="color:var(--mute-2)">Not Priced</span>';
    const when=x.last_activity?new Date(x.last_activity).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'&mdash;';
    return `<tr><td><b>${esc(x.address)}</b></td><td class="n">${x.projects}</td><td class="n">${x.rooms}</td><td class="n">${x.designs}</td><td class="n">${x.approved}</td><td>${range}</td><td>${x.budget_target!=null?presMoney(x.budget_target):'&mdash;'}</td><td><span class="pill ${fit[0]}">${fit[1]}</span></td><td>${when}</td></tr>`;
  }).join('');
}

function reportPanels(r){
  const c=document.getElementById('repCredits');
  if(c){
    const entries=Object.keys(r.credits.byAction).map(k=>[k,r.credits.byAction[k]]).sort((a,b)=>b[1]-a[1]);
    const max=entries.length?entries[0][1]:0;
    c.innerHTML=entries.length?entries.map(e=>`<div style="margin-bottom:12px"><div class="lab" style="display:flex;justify-content:space-between;font-size:.79rem;margin-bottom:5px"><span>${ACT_LABEL[e[0]]||esc(e[0])}</span><b>${e[1]}</b></div><div class="meter"><i style="width:${max?Math.round(e[1]/max*100):0}%"></i></div></div>`).join(''):'<p style="font-size:.79rem;color:var(--mute-2)">No credits spent in the last 30 days.</p>';
  }
  const p=document.getElementById('repPres');
  if(p){
    const s=r.presentations;
    const rate=s.total?Math.round(s.approved/s.total*100):0;
    p.innerHTML=`<div class="grid g3" style="gap:12px">
      <div><div class="lab" style="font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mute-2);margin-bottom:6px">Links Sent</div><b style="font-size:1.4rem">${s.total}</b></div>
      <div><div class="lab" style="font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mute-2);margin-bottom:6px">Approved</div><b style="font-size:1.4rem">${s.approved}</b></div>
      <div><div class="lab" style="font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mute-2);margin-bottom:6px">Client Views</div><b style="font-size:1.4rem">${s.views}</b></div>
    </div>
    <div style="margin-top:14px"><div class="lab" style="display:flex;justify-content:space-between;font-size:.79rem;margin-bottom:5px"><span>Approval Rate</span><b>${rate}%</b></div><div class="meter"><i style="width:${rate}%"></i></div></div>`;
  }
}

async function paintReports(force){
  const tb=document.getElementById('repRows'); if(!tb) return;
  if(REPORT&&!force){ reportKpis(REPORT); reportRows(REPORT); reportPanels(REPORT); lucide.createIcons(); return; }
  if(REPORT_LOADING) return;
  REPORT_LOADING=true;
  tb.innerHTML='<tr><td colspan="9" style="color:var(--mute-2);font-size:.79rem">Loading&hellip;</td></tr>';
  try{ REPORT=await getPortfolioReport(); }
  catch(e){ REPORT_LOADING=false; tb.innerHTML='<tr><td colspan="9" style="color:var(--mute-2);font-size:.79rem">Could not load reports. Try Refresh.</td></tr>'; return; }
  REPORT_LOADING=false;
  reportKpis(REPORT); reportRows(REPORT); reportPanels(REPORT);
  lucide.createIcons();
}

function reportsCsv(){
  if(!REPORT) return;
  const head=['Property','Projects','Rooms','Designs','Approved','Scope Low','Scope High','Budget Target','Budget Fit','Last Activity'];
  const q=(v)=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const lines=[head.map(q).join(',')].concat(REPORT.rows.map(x=>[x.address,x.projects,x.rooms,x.designs,x.approved,Math.round(x.low),Math.round(x.high),x.budget_target==null?'':Math.round(x.budget_target),FIT_PILL[x.budget_fit][1],x.last_activity||''].map(q).join(',')));
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='real-designs-portfolio-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

document.getElementById('repRefresh')?.addEventListener('click',()=>paintReports(true));
document.getElementById('repCsv')?.addEventListener('click',reportsCsv);


function presPdfHtml(p){
  const when=new Date(p.created_at||Date.now()).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const rows=(p.lines||[]).map(l=>`<tr><td>${esc(l.description)}</td><td>${esc(l.trade)}</td><td class="n">${l.qty} ${esc(l.uom)}</td><td class="n">${presMoney(l.low)} &ndash; ${presMoney(l.high)}</td></tr>`).join('')
    ||'<tr><td colspan="4">No priced line items on this version yet.</td></tr>';
  const range=p.total_low!=null?presMoney(p.total_low)+' &ndash; '+presMoney(p.total_high):'Not priced yet';
  const img=(u,l)=>u?`<figure><img src="${esc(u)}" alt="${l}"><figcaption>${l}</figcaption></figure>`:`<figure class="ph"><div>${l} not available</div></figure>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.title)} — REAL DESIGNS</title>
<style>
@page{size:letter;margin:14mm}
*{box-sizing:border-box}
body{font:13px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#141414;margin:0}
.mast{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #CC0000;padding-bottom:10px;margin-bottom:18px}
.brand{font-weight:800;letter-spacing:.16em;font-size:12px;text-transform:uppercase}
.brand b{color:#CC0000}
h1{font-size:22px;margin:0 0 4px}
.sub{color:#6b6b6b;font-size:12px}
.figs{display:flex;gap:12px;margin:0 0 18px}
figure{margin:0;flex:1}
figure img{width:100%;height:210px;object-fit:cover;border-radius:8px;border:1px solid #e4e4e4}
figure.ph div{height:210px;display:flex;align-items:center;justify-content:center;border:1px dashed #ccc;border-radius:8px;color:#8a8a8a;font-size:12px}
figcaption{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b;margin-top:6px}
.range{border:1px solid #e4e4e4;border-radius:10px;padding:12px 14px;margin-bottom:18px}
.range b{display:block;font-size:20px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #ececec}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b}
td.n,th.n{text-align:right}
.note{margin-top:16px;font-size:10.5px;color:#6b6b6b;border-top:1px solid #ececec;padding-top:10px}
</style></head><body>
<div class="mast"><div><div class="brand">REAL<b>&nbsp;DESIGNS</b></div><h1>${esc(p.title)}</h1>
<div class="sub">${esc(p.address)} &middot; ${esc(p.project_name)} &middot; ${esc(p.room_name)} &middot; v${p.version_no}</div></div>
<div class="sub" style="text-align:right">${when}<br>${esc(p.client_name||'Client copy')}</div></div>
<div class="figs">${img(p.before_url,'Before')}${img(p.after_url,'After')}</div>
<div class="range"><div class="sub">Estimated Planning Range</div><b>${range}</b>
<div class="sub">${esc((p.style||'Direction on file'))} &middot; ${esc(p.grade)} grade finishes</div></div>
<table><thead><tr><th>Scope Item</th><th>Trade</th><th class="n">Quantity</th><th class="n">Range</th></tr></thead><tbody>${rows}</tbody></table>
<div class="note">Planning estimates derived from the approved design and local cost data. Not a construction bid, subcontractor pricing governs. Rendered images are design visualisations of the same space.</div>
</body></html>`;
}

async function exportPresentationPdf(id,btn){
  const old=btn?btn.innerHTML:null;
  if(btn){ btn.disabled=true; btn.innerHTML='<i data-lucide="loader"></i>'; lucide.createIcons(); }
  try{
    const p=await getPresentationPackage({data:{id}});
    const w=window.open('','_blank');
    if(!w) throw new Error('Allow pop-ups to export the PDF.');
    w.document.write(presPdfHtml(p));
    w.document.close();
    w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(_){} },700);
  }catch(e){
    showAlert('Could not build that PDF. '+((e&&e.message)||''));
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML=old; lucide.createIcons(); }
  }
}

async function exportPresentationBoard(id,btn){
  const old=btn?btn.innerHTML:null;
  if(btn){ btn.disabled=true; btn.innerHTML='<i data-lucide="loader"></i>'; lucide.createIcons(); }
  try{
    const p=await getPresentationPackage({data:{id}});
    const lines=(p.lines||[]).map(l=>({description:l.description,trade:l.trade,qty:l.qty,uom:l.uom,
      material_low:l.low,material_high:l.high,price_source:'From the approved scope'}));
    const tl=lines.reduce((a,l)=>a+l.material_low,0), th=lines.reduce((a,l)=>a+l.material_high,0);
    const w=window.open('','_blank');
    if(!w) throw new Error('Allow pop-ups to open the board.');
    w.document.write(boardPrintHtml(p.title,
      [p.address,p.project_name,p.room_name,(p.grade||'retail')+' grade'].filter(Boolean).join(' \u00b7 '),
      p.grade, lines, lines.length?[tl,th]:null));
    w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(_){} },700);
  }catch(e){
    showAlert('Could not build that board. '+((e&&e.message)||''));
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML=old; lucide.createIcons(); }
  }
}

async function exportSocialReel(id,btn){
  const old=btn?btn.innerHTML:null;
  const setLab=(t)=>{ if(btn) btn.innerHTML='<span style="font-size:.66rem;font-weight:700">'+t+'</span>'; };
  if(btn) btn.disabled=true;
  setLab('0%');
  try{
    const p=await getPresentationPackage({data:{id}});
    if(!p.before_url||!p.after_url) throw new Error('This version needs both a before photo and a finished render.');
    const range=p.total_low!=null?(presMoney(p.total_low)+' \u2013 '+presMoney(p.total_high)):null;
    const {blob,ext}=await buildSocialReel(p.before_url,p.after_url,{
      room:p.room_name, address:p.address,
      style:p.style?(p.style+' \u00b7 '+(p.grade||'retail')+' grade'):null, range
    },(pct)=>setLab(Math.round(pct*100)+'%'));
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=String(p.room_name||'real-designs').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-reel.'+ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }catch(e){
    showAlert('Could not build that reel. '+((e&&e.message)||''));
  }finally{
    if(btn){ btn.disabled=false; btn.innerHTML=old; lucide.createIcons(); }
  }
}

const linkList=document.getElementById('linkList');
if(linkList) linkList.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-pf]');
  if(tab){ PRES_FILTER=tab.getAttribute('data-pf'); renderPresRows(); return; }
  const row=e.target.closest('[data-pid]'); if(!row) return;
  if(e.target.closest('[data-send]')){
    presSendModal(PRES_ROWS.find(x=>x.id===row.dataset.pid));
    return;
  }
  if(e.target.closest('[data-copy]')){
    const url=presLink(row.dataset.tok);
    try{ await navigator.clipboard.writeText(url); }catch(_){}
    const pill=row.querySelector('.pill'); const old=pill.textContent;
    pill.textContent='Link Copied'; setTimeout(()=>{pill.textContent=old;},1400);
    return;
  }
  if(e.target.closest('[data-pdf]')){
    exportPresentationPdf(row.dataset.pid,e.target.closest('[data-pdf]'));
    return;
  }
  if(e.target.closest('[data-board]')){
    exportPresentationBoard(row.dataset.pid,e.target.closest('[data-board]'));
    return;
  }
  if(e.target.closest('[data-reel]')){
    exportSocialReel(row.dataset.pid,e.target.closest('[data-reel]'));
    return;
  }
  if(e.target.closest('[data-del]')){
    try{ await deletePresentation({data:{id:row.dataset.pid}}); }catch(_){}
    paintPresentations();
  }
});

/* ---------- send a client link ----------
   No mail server is wired up, so we hand the pro a finished message they can
   send from their own inbox. Wording changes with the status of the link so a
   follow up never reads like the first email. */
function presMessage(r){
  const url=presLink(r.token);
  const who=r.client_name||'there';
  const what=r.title||'your design';
  const place=[r.address,r.room_name].filter(Boolean).join(', ');
  const st=r.status||'sent';
  const opened=(r.view_count||0)>0;
  if(st==='changes'){
    return {subject:'Updated: '+what,
      body:'Hi '+who+',\n\nI made the changes you asked for on '+(place||what)+'. Same link, updated design and budget range:\n\n'+url+'\n\nTake a look and approve it there, or tell me what to adjust next.\n\nThank you'};
  }
  if(opened&&st!=='approved'){
    return {subject:'Following Up On '+what,
      body:'Hi '+who+',\n\nJust checking in on the design I sent for '+(place||what)+'. Everything you need is on one page, the before and after, the scope and the budget range:\n\n'+url+'\n\nApprove it there when you are ready, or leave a note with what you want changed.\n\nThank you'};
  }
  if(st==='approved'){
    return {subject:'Approved: '+what,
      body:'Hi '+who+',\n\nThanks for approving '+(place||what)+'. Here is the page again for your records:\n\n'+url+'\n\nI will get the next steps moving and follow up with timing.\n\nThank you'};
  }
  return {subject:'Your Design Is Ready: '+what,
    body:'Hi '+who+',\n\nHere is the design for '+(place||what)+'. One page, no login. You will see the before and after photo, what is being changed and a planning budget range:\n\n'+url+'\n\nApprove it right on the page, or leave a note with anything you want changed.\n\nThank you'};
}

function presSendModal(r){
  if(!r) return;
  const msg=presMessage(r);
  let m=document.getElementById('sendModal');
  if(!m){ m=document.createElement('div'); m.id='sendModal'; m.className='up-modal'; (document.querySelector('.rd-app')||document.body).appendChild(m); }
  m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="width:min(560px,calc(100vw - 32px))">'
    +'<h3>Send To Client</h3>'
    +'<p>Edit anything you like, then send it from your own inbox so the reply comes back to you. The link works without a login and updates as you change the design.</p>'
    +'<div class="field"><label>To</label><input id="sndTo" type="email" placeholder="client@email.com" value="'+esc(r.client_email||'')+'"></div>'
    +'<div class="field"><label>Subject</label><input id="sndSub" type="text" value="'+esc(msg.subject)+'"></div>'
    +'<div class="field"><label>Message</label><textarea id="sndBody" rows="9">'+esc(msg.body)+'</textarea></div>'
    +'<div class="up-act"><button class="btn btn-ghost btn-sm" data-close>Cancel</button>'
    +'<button class="btn btn-ghost btn-sm" id="sndCopy"><i data-lucide="copy"></i>Copy Message</button>'
    +'<button class="btn btn-primary btn-sm" id="sndMail"><i data-lucide="send"></i>Open In Email App</button></div></div>';
  m.classList.add('on');
  lucide.createIcons();
  const close=()=>m.classList.remove('on');
  m.addEventListener('click',e=>{ if(e.target.closest('[data-close]')) close(); });
  const vals=()=>({to:(document.getElementById('sndTo')||{value:''}).value.trim(),
    sub:(document.getElementById('sndSub')||{value:''}).value,
    body:(document.getElementById('sndBody')||{value:''}).value});
  document.getElementById('sndCopy').addEventListener('click',async ev=>{
    const v=vals();
    try{ await navigator.clipboard.writeText(v.sub+'\n\n'+v.body); }catch(_){}
    const b=ev.currentTarget; const old=b.innerHTML; b.textContent='Copied';
    setTimeout(()=>{ b.innerHTML=old; lucide.createIcons(); },1400);
  });
  document.getElementById('sndMail').addEventListener('click',()=>{
    const v=vals();
    window.location.href='mailto:'+encodeURIComponent(v.to)+'?subject='+encodeURIComponent(v.sub)+'&body='+encodeURIComponent(v.body);
    close();
  });
}


function presModal(){
  let m=document.getElementById('presModal');
  if(!m){
    m=document.createElement('div'); m.id='presModal'; m.className='up-modal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">'+
      '<h3>New Client Approval Link</h3>'+
      '<p>Pick a saved design. The client opens a branded page with the before and after, the scope and a budget range, then approves or asks for changes. No login needed.</p>'+
      '<div class="field"><label>Design</label><select id="plVer"></select></div>'+
      '<div class="field"><label>Title</label><input id="plTitle" type="text" placeholder="Living Room Refresh"></div>'+
      '<div class="field"><label>Client Name</label><input id="plName" type="text" placeholder="Keisha C."></div>'+
      '<div class="field"><label>Client Email (Optional)</label><input id="plMail" type="email" placeholder="client@email.com"></div>'+
      '<div id="plErr" style="display:none;font-size:.78rem;color:var(--red);margin-bottom:8px"></div>'+
      '<div id="plOut" style="display:none;margin-bottom:10px"><div class="rowi"><div class="rowt"><b>Link Ready</b><span id="plUrl" style="word-break:break-all"></span></div></div></div>'+
      '<button class="btn btn-primary btn-block" id="plGo"><i data-lucide="link"></i>Create Link</button>'+
      '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
    (document.querySelector(".rd-app")||document.body).appendChild(m);
    m.addEventListener('click',e=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
    m.querySelector('#plGo').addEventListener('click',async ()=>{
      const err=m.querySelector('#plErr'), out=m.querySelector('#plOut'), go=m.querySelector('#plGo');
      const version_id=m.querySelector('#plVer').value;
      const title=(m.querySelector('#plTitle').value||'').trim();
      if(!version_id){ err.style.display='block'; err.textContent='Save a room in Studio first, then come back.'; return; }
      if(!title){ err.style.display='block'; err.textContent='Give the package a title your client will recognise.'; return; }
      err.style.display='none'; go.disabled=true;
      try{
        const bk=(PREFS&&PREFS.brand)||{};
        const accent=/^#[0-9a-f]{6}$/i.test(bk.color||'')?bk.color:undefined;
        const res=await createPresentation({data:{version_id,title,
          client_name:(m.querySelector('#plName').value||'').trim()||undefined,
          client_email:(m.querySelector('#plMail').value||'').trim()||undefined,
          brand_name:(bk.company||'').trim()||undefined,
          brand_accent:accent}});
        const url=presLink(res.token);
        out.style.display='block'; m.querySelector('#plUrl').textContent=url;
        try{ await navigator.clipboard.writeText(url); }catch(_){}
        paintPresentations();
      }catch(e){ err.style.display='block'; err.textContent=(e&&e.message)||'Could not create the link.'; }
      go.disabled=false;
    });
  }
  const sel=m.querySelector('#plVer');
  const versions=[];
  PROP_TREE.forEach(p=>p.projects.forEach(pr=>pr.rooms.forEach(r=>{
    if(r.version_id) versions.push({id:r.version_id,label:p.address+' \u00b7 '+r.name});
  })));
  sel.innerHTML=versions.length
    ? versions.map(v=>`<option value="${v.id}">${v.label}</option>`).join('')
    : '<option value="">No saved designs yet</option>';
  m.querySelector('#plErr').style.display='none';
  m.querySelector('#plOut').style.display='none';
  m.classList.add('on');
  lucide.createIcons();
}

const newLinkBtn=document.getElementById('newLinkBtn');
if(newLinkBtn) newLinkBtn.addEventListener('click',presModal);
paintPresentations();
window.addEventListener('rd:saved',()=>paintPresentations());

/* ---------- team ---------- */
async function paintTeam(){
  const list=document.getElementById('teamList'); if(!list) return;
  let name='You', mail='', av='YOU';
  try{
    const { data:{ user } }=await supabase.auth.getUser();
    if(user){
      mail=user.email||'';
      name=(user.user_metadata&&(user.user_metadata.full_name||user.user_metadata.name))||mail.split('@')[0]||'You';
      av=name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'YOU';
    }
  }catch(_){}
  let team={sent:[],received:[]};
  try{ team=await listTeam(); }catch(_){}
  const esc=s=>String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const invites=(team.sent||[]).map(i=>`<div class="seat"><span class="av">${esc((i.email||'?')[0].toUpperCase())}</span>
      <div class="rowt"><b>${esc(i.email)}</b><span>${i.status==='accepted'?'Accepted':(i.status==='declined'?'Declined':'Invite pending')} \u00b7 ${esc(i.role)}</span></div>
      <span class="pill ${i.status==='accepted'?'p-green':'p-gray'}">${i.status==='accepted'?'Active':(i.status==='declined'?'Declined':'Pending')}</span>
      ${i.status==='pending'?`<button class="btn btn-g" data-copyinv="${esc(i.email)}" style="margin-left:8px">Copy Invite Link</button>`:''}
      <button class="btn btn-g" data-revoke="${i.id}" style="margin-left:8px">Remove</button></div>`).join('');

  const inbound=(team.received||[]).map(i=>`<div class="seat"><span class="av">IN</span>
      <div class="rowt"><b>You Were Invited To Another Workspace</b><span>Role: ${esc(i.role)}</span></div>
      <button class="btn btn-g" data-decline="${i.id}">Decline</button>
      <button class="btn btn-p" data-accept="${i.id}" style="margin-left:8px">Accept</button></div>`).join('');
  list.innerHTML=`<div class="seat"><span class="av">${av}</span><div class="rowt"><b>${name}</b><span>${mail||'Signed in'}</span></div>
    <span class="pill p-ink">Owner</span></div>${invites}${inbound}
    ${invites?'':'<p style="font-size:.79rem;color:var(--mute-2);margin:10px 0 0">No teammates yet. Invite one below. They sign in with that email, accept the invite, and then share this workspace with you.</p>'}`;
  const seatEl=document.getElementById('seatCount');
  if(seatEl){ const n=1+(team.sent||[]).length; seatEl.textContent=n+(n===1?' Seat':' Seats'); }
  list.querySelectorAll('[data-copyinv]').forEach(b=>b.addEventListener('click',async()=>{
    const link=window.location.origin+'/app?invite='+encodeURIComponent(b.dataset.copyinv);
    try{ await navigator.clipboard.writeText(link); }catch(_){}
    const t=b.textContent; b.textContent='Link Copied'; setTimeout(()=>{ b.textContent=t; },1600);
  }));
  list.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',async()=>{
    b.disabled=true; try{ await revokeInvite({data:{id:b.dataset.revoke}}); }catch(_){}
    paintTeam();
  }));

  list.querySelectorAll('[data-accept]').forEach(b=>b.addEventListener('click',async()=>{
    b.disabled=true; try{ await acceptInvite({data:{id:b.dataset.accept}}); }catch(_){}
    paintTeam(); paintInviteBanner(); setTimeout(()=>window.location.reload(),400);
  }));
  list.querySelectorAll('[data-decline]').forEach(b=>b.addEventListener('click',async()=>{
    b.disabled=true; try{ await declineInvite({data:{id:b.dataset.decline}}); }catch(_){}
    paintTeam(); paintInviteBanner();
  }));

  const rows=document.getElementById('usageRows');
  if(rows){
    let designs=0, scopes=0;
    try{
      const hist=await listCreditHistory();
      hist.forEach(h=>{ if(h.action==='design') designs++; if(h.action==='scope') scopes++; });
    }catch(_){}
    rows.innerHTML=`<tr><td><b>${name}</b></td><td>Owner</td><td class="n">${designs}</td><td class="n">${scopes}</td><td class="n">Now</td></tr>`
      +(team.sent||[]).map(i=>`<tr><td><b>${esc(i.email)}</b></td><td>${esc(i.role)}</td><td class="n">0</td><td class="n">0</td><td class="n">${i.status==='accepted'?'Joined':'Pending'}</td></tr>`).join('');
  }
  lucide.createIcons();
}
paintTeam();
window.addEventListener('rd:credits-changed',()=>paintTeam());

/* Pending workspace invites: shown at the top of the app until answered. */
async function paintInviteBanner(){
  const host=document.querySelector('.content')||document.querySelector('.main'); if(!host) return;
  let team={received:[]};
  try{ team=await listTeam(); }catch(_){ return; }
  const inv=(team.received||[]);
  let bar=document.getElementById('inviteBar');
  if(!inv.length){ if(bar) bar.remove(); return; }
  if(!bar){ bar=document.createElement('div'); bar.id='inviteBar'; bar.className='invite-bar'; host.prepend(bar); }
  const i=inv[0];
  bar.innerHTML='<i data-lucide="user-plus"></i><div class="ib-t"><b>You Have Been Invited To Join A Workspace</b>'
    +'<span>Accept to share their properties, designs, scopes and presentations. Role: '+String(i.role||'member')+'</span></div>'
    +'<button class="btn btn-ghost btn-xs" id="ibNo">Decline</button>'
    +'<button class="btn btn-primary btn-xs" id="ibYes">Accept Invite</button>';
  lucide.createIcons();
  const done=()=>{ paintInviteBanner(); paintTeam(); setTimeout(()=>window.location.reload(),400); };
  const yes=document.getElementById('ibYes'), no=document.getElementById('ibNo');
  if(yes) yes.addEventListener('click',async()=>{ yes.disabled=true; try{ await acceptInvite({data:{id:i.id}}); }catch(_){} done(); });
  if(no) no.addEventListener('click',async()=>{ no.disabled=true; try{ await declineInvite({data:{id:i.id}}); }catch(_){} paintInviteBanner(); });
}
paintInviteBanner();

const tmSend=document.getElementById('tmSend');
if(tmSend) tmSend.addEventListener('click',async()=>{
  const em=document.getElementById('tmEmail'), rl=document.getElementById('tmRole'), msg=document.getElementById('tmMsg');
  const email=(em&&em.value||'').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ if(msg){ msg.textContent='Enter a valid email address.'; msg.style.color='var(--red)'; } return; }
  tmSend.disabled=true; if(msg){ msg.textContent='Sending'; msg.style.color='var(--mute)'; }
  try{
    const r=await inviteMember({data:{email,role:(rl&&rl.value)||'member'}});
    if(r&&r.ok){ if(msg){ msg.textContent='Invite added. '+email+' can accept it after signing in.'; msg.style.color='var(--mute-2)'; } if(em) em.value=''; paintTeam(); }
    else if(msg){ msg.textContent=(r&&r.error)||'Could not send that invite.'; msg.style.color='var(--red)'; }
  }catch(e){ if(msg){ msg.textContent='Could not send that invite.'; msg.style.color='var(--red)'; } }
  tmSend.disabled=false;
});


/* ---------- workspace preferences ---------- */
function pfSet(id,v){ const el=document.getElementById(id); if(el&&v!=null) el.value=v; }
async function loadPrefs(){
  try{ PREFS=await getPrefs(); }catch(_){ PREFS={...DEFAULT_PREFS}; }
  paintNotifPrefs();
  pfSet('bkCompany',PREFS.brand.company); pfSet('bkColor',PREFS.brand.color); pfSet('bkMark',PREFS.brand.watermark);
  pfSet('dfMarket',PREFS.defaults.market); pfSet('dfGrade',PREFS.defaults.grade);
  pfSet('dfBand',PREFS.defaults.band); pfSet('dfDisc',PREFS.defaults.disclosure);
  try{ buildNotifs(); }catch(_){}
}
function wireSave(btnId,msgId,collect,key){
  const btn=document.getElementById(btnId); if(!btn) return;
  btn.addEventListener('click',async()=>{
    const msg=document.getElementById(msgId);
    btn.disabled=true; if(msg){ msg.textContent='Saving'; msg.style.color='var(--mute)'; }
    try{
      PREFS=await savePrefs({[key]:collect()});
      if(msg){ msg.textContent='Saved'; msg.style.color='var(--ok,#0a7b3e)'; }
    }catch(err){
      if(msg){ msg.textContent=(err&&err.message)||'Could not save'; msg.style.color='var(--red,#CC0000)'; }
    }
    btn.disabled=false;
  });
}
const val=(id)=>{ const el=document.getElementById(id); return el?el.value:''; };
wireSave('bkSave','bkMsg',()=>({company:val('bkCompany'),color:val('bkColor'),watermark:val('bkMark')}),'brand');
wireSave('dfSave','dfMsg',()=>({market:val('dfMarket'),grade:val('dfGrade'),band:val('dfBand'),disclosure:val('dfDisc')}),'defaults');
loadPrefs();


/* ---------- collapse the left menu ----------
   The rail keeps the icons visible and only then shows tooltips, since the
   labels are already on screen when the menu is open. */
(function(){
  const shell=document.querySelector('.rd-app .app');
  const tog=document.getElementById('sideToggle');
  if(!shell||!tog) return;
  const KEY='rd.sidemin';
  // Studio needs the canvas width, so the rail is forced closed there and the
  // user's own preference comes back on every other view.
  const FORCED=['studio'];
  function apply(min){
    shell.classList.toggle('sidemin',min);
    tog.setAttribute('aria-label',min?'Expand menu':'Collapse menu');
    tog.title=min?'':'Collapse menu';
    tog.innerHTML='<i data-lucide="'+(min?'chevrons-right':'chevrons-left')+'"></i>';
    try{ lucide.createIcons(); }catch(_){}
  }
  let min=false;
  try{ min=localStorage.getItem(KEY)==='1'; }catch(_){}
  function currentView(){
    const on=document.querySelector('.rd-app .view.on');
    return on?on.id.replace(/^v-/,''):'';
  }
  function applyForView(v){ apply(FORCED.indexOf(v||currentView())>=0 ? true : min); }
  window.__rdRailForView=applyForView;
  applyForView('');
  tog.addEventListener('click',()=>{
    min=!shell.classList.contains('sidemin');
    try{ localStorage.setItem(KEY,min?'1':'0'); }catch(_){}
    apply(min);
  });
})();



/* ---------- help menu ---------- */
const helpBtn=document.getElementById('helpBtn'),helpMenu=document.getElementById('helpMenu');
function closeHelp(){ if(helpMenu){helpMenu.classList.remove('on');helpBtn.setAttribute('aria-expanded','false');} }
if(helpBtn&&helpMenu){
  helpBtn.addEventListener('click',e=>{e.stopPropagation();closeAcct();closeSch();
    const open=!helpMenu.classList.contains('on');helpMenu.classList.toggle('on',open);helpBtn.setAttribute('aria-expanded',String(open));});
  helpMenu.addEventListener('click',e=>{ if(e.target.closest('.acct-i')) closeHelp(); });
  document.addEventListener('click',e=>{ if(!e.target.closest('.help-wrap')) closeHelp(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeHelp(); });
}

/* ---------- help center ---------- */
const HELP_POP=['Getting Started','Photos','Reality Lock','Credits','Scope','Client Links'];
document.getElementById('helpPop').innerHTML=HELP_POP.map(t=>`<span class="chip">${t}</span>`).join('');
document.getElementById('helpQuick').innerHTML=[
 ['1','Add Your First Property','Open Studio, upload a room photo, and save the version to create the property and room record.'],
 ['2','Design A Room','Pick a direction and intensity, generate a version for 1 credit, and keep the one that lands.'],
 ['3','Send A Client Link','Package approved rooms with the priced scope and share one link for approval.']]
 .map(([n,t,b])=>`<div class="qs-card"><span class="n">STEP ${n}</span><b>${t}</b><span>${b}</span></div>`).join('');

/* Each article is real written help. [icon, title, body, optional view to open] */
const HELP_CATS=[
 ['rocket','Getting Started',[
  ['image-up','Upload Room Photos','Use a straight-on shot of the room with the widest angle you can get, taken in daylight if possible. JPG or PNG up to about 10MB. Photos are stored privately against your account and are only visible to you until you share a client link.','studio'],
  ['map-pin','Add A Property','Properties are created from the work you save. Save a room version in Studio with an address and the property, project and room records appear in the Properties tree.','props'],
  ['wand-sparkles','Your First Design','In Studio choose a style direction and an intensity (Refresh, Makeover, Renovation, Reimagine), then generate. Each design render costs 1 credit and lands beside the original photo.','studio'],
  ['coins','How Credits Work','One balance covers everything: a design render is 1 credit, a priced scope is 3, a 2D to 3D plan is 6 and a walkthrough video is 40. If a job fails, the credits are returned automatically. Your balance and every charge are listed in Billing And Credits.','billing']]],
 ['palette','Designing',[
  ['lock','Reality Lock Explained','Reality Lock holds the walls, window and door openings, ceiling line and floor plane from your photo in place, so a version is a redesign of the same room rather than a new room. Finishes, fixtures, furniture and paint change; the building does not.'],
  ['layers','Style Directions And Intensity','Direction sets the look (for example Japandi, Coastal, Midcentury). Intensity sets how far the work goes, from a Refresh that is paint and styling through a Reimagine that assumes full replacement. Intensity is what moves the budget most.','studio'],
  ['history','Versions','Every generation is saved as a numbered version on the room, so you can compare, keep several options alive, and send the one the client approved.','designs'],
  ['images','Listing Batch','Listing Batch runs every room on a property through the same direction in one pass, one credit per room, and saves each result to its room.','listings']]],
 ['calculator','Scope & Budget',[
  ['dollar-sign','How Pricing Is Built','A scope compares the original photo to the approved version, lists what actually changed, then prices those lines by trade at your market and finish grade. It returns a low to high planning range with a contingency, not a bid.','scope'],
  ['sliders-horizontal','Budget Bands And Grades','Finish grade (rental, retail, premium) and budget band set the allowance level used for every line. Change either and the range recalculates against the same change list.','scope'],
  ['shopping-bag','Product Board','The Products board turns each material line into a card with quantity, allowance range and a search link at the right retailer for that trade. Links are searches, not quoted prices.','products'],
  ['triangle-alert','What A Scope Is Not','Every figure is a planning estimate. Subcontractor pricing governs. Always confirm with a bid before committing a client to a number.']]],
 ['share-2','Client Delivery',[
  ['presentation','Building A Presentation','Pick a version, add a title and the client name, and generate a link. The client sees the before and after, the change list and the planning range on a branded page.','present'],
  ['link','Approval Links','Links are read-only for the client and can be opened without an account. Approvals and decision notes come back into Presentations, and view counts update as the link is opened.','present'],
  ['printer','PDF And Board Exports','Presentations export a print-ready branded PDF, and the product board prints separately for a contractor or supplier.','present'],
  ['palette','Brand Kit','Company name, accent color and watermark from Account, Brand Kit are applied to client pages and exports.','account']]],
 ['user-round','Account & Workspace',[
  ['bell','Notifications','Notifications are in-app. The three toggles in Account, Notifications control which categories reach your feed. We do not send marketing email.','notifications'],
  ['sliders-horizontal','Defaults','Market, finish grade, budget band and disclosure ruleset set the starting point for every new scope. They are saved to your account.','account'],
  ['users','Team Seats','Invite teammates from Account, Team. They accept the invite with their own login and then share your properties, designs, scopes and presentations. You can copy an invite link to send it yourself, and revoke access at any time.','team'],
  ['download','Export And Delete','You can download a JSON of every property, room, version, scope and credit entry, or delete the account and all of its data, from Account, Data And Privacy.','account']]]];

const helpCatsEl=document.getElementById('helpCats');
function renderCats(q){
  const s=(q||'').trim().toLowerCase();
  const match=(a,name)=>!s||name.toLowerCase().includes(s)||(a[1]+' '+a[2]).toLowerCase().includes(s);
  const list=HELP_CATS.map(([ic,name,arts])=>[ic,name,arts.filter(a=>match(a,name))]).filter(c=>c[2].length);
  helpCatsEl.innerHTML=list.length?list.map(([ic,name,arts])=>`<div class="card"><div class="card-b">
    <div class="help-cat"><i data-lucide="${ic}"></i>${name}</div>
    ${arts.map(([ai,label,body,view])=>`<button class="help-a" type="button"><i data-lucide="${ai}"></i>${label}</button>
      <div class="help-ans" style="padding:0 8px 10px">${body}${view?`<div style="margin-top:8px"><button class="btn btn-ghost btn-xs" data-open="${view}"><i data-lucide="arrow-right"></i>Open</button></div>`:''}</div>`).join('')}
  </div></div>`).join(''):`<div class="card"><div class="card-b sub">No articles match that search.</div></div>`;
  lucide.createIcons();
}
document.addEventListener('click',e=>{
  if(e.__rdHelpHandled) return; // init can run twice (StrictMode); handle each click once
  if(!e.target.closest||!e.target.closest('#helpCats,#tutGrid,#tutPaths')) return;
  e.__rdHelpHandled=true;
  const open=e.target.closest('[data-open]');
  if(open){ go(open.dataset.open); return; }
  const b=e.target.closest('.help-a'); if(!b) return;
  const ans=b.nextElementSibling;
  if(ans&&ans.classList.contains('help-ans')) ans.classList.toggle('on');
});
const HELP_FAQ=[
 ['Do The Designs Change The Structure Of The Room?','No. Reality Lock holds walls, windows, ceiling lines and the floor plane in place, so every version is a redesign of the same space.'],
 ['How Accurate Is The Scope?','A scope is a planning range built from the change list, your market and your finish grade. It is not a bid, and subcontractor pricing governs.'],
 ['Can I Upload My Own Photos?','Yes. Any straight-on room photo works. Better light and a wider angle produce better versions.'],
 ['What Does Each Action Cost?','Design render 1 credit, priced scope 3, 2D to 3D plan 6, walkthrough video 40. Failed jobs are refunded automatically.'],
 ['What Happens When I Run Out Of Credits?','Nothing is deleted. New generations pause until your allowance resets or you top up, and all existing work stays available.'],
 ['Can Clients See My Work Before I Share It?','No. Photos, versions and scopes are private to your account until you create a client link for a specific version.']];
const helpFaqEl=document.getElementById('helpFaq');
function renderFaq(q){
  const s=(q||'').trim().toLowerCase();
  const list=HELP_FAQ.filter(f=>!s||(f[0]+f[1]).toLowerCase().includes(s));
  helpFaqEl.innerHTML=list.length?list.map(([q2,a],i)=>`<button class="help-q" data-f="${i}">${q2}<i data-lucide="chevron-down"></i></button><div class="help-ans" data-a="${i}">${a}</div>`).join(''):`<div class="sub">Nothing matches that search.</div>`;
  lucide.createIcons();
}
helpFaqEl.addEventListener('click',e=>{
  const b=e.target.closest('.help-q'); if(!b) return;
  const a=helpFaqEl.querySelector(`[data-a="${b.dataset.f}"]`);
  b.classList.toggle('on'); a.classList.toggle('on');
});
renderCats(''); renderFaq('');
const helpQ=document.getElementById('helpQ');
helpQ.addEventListener('input',()=>{renderCats(helpQ.value);renderFaq(helpQ.value)});
document.getElementById('helpPop').addEventListener('click',e=>{
  const c=e.target.closest('.chip'); if(!c) return; helpQ.value=c.textContent; renderCats(helpQ.value); renderFaq(helpQ.value);
});

/* ---------- walkthroughs ---------- */
/* Written step-by-step guides that open the matching view. No video library yet. */
const TUTS=[
 ['Add Your First Property','Getting Started','studio',['Open Studio and upload a straight-on photo of the room.','Enter the address so the room is filed under a property.','Generate a version and save it. The property, project and room appear in Properties.']],
 ['Photos That Render Well','Getting Started','studio',['Shoot from a doorway or corner so two walls and the floor are visible.','Turn on the lights and open the blinds. Avoid heavy backlight.','Keep the camera level. Tilted shots distort the ceiling line.']],
 ['Reality Lock In Practice','Designing','studio',['Generate a version, then flip between before and after.','Check the window and door openings line up. They should not move.','If a version drifts, regenerate. Only finishes and furnishings should change.']],
 ['Choosing Direction And Intensity','Designing','studio',['Pick a style direction for the look.','Pick an intensity: Refresh, Makeover, Renovation or Reimagine.','Intensity drives the budget more than direction does, so set it against the money first.']],
 ['Staging A Whole Listing','Listing Batch','listings',['Open Listing Batch and select the property.','Choose one direction for the whole listing.','Run the batch. Each room costs 1 credit and saves to its own room record.']],
 ['Building A Scope And Budget','Scope','scope',['Open a saved version and request a scope for 3 credits.','Set market, finish grade and budget band.','Review the change list and the low to high planning range, then export or share it.']],
 ['Working The Product Board','Products','products',['Open Products after a scope has been priced.','Each material line becomes a card with quantity and allowance range.','Use Shop On to search the right retailer, or export the board as CSV or print.']],
 ['Sending A Client Link','Delivery','present',['Open Presentations and pick an approved version.','Add a title and the client name, then generate the link.','Share the link. Views, approvals and notes come back into the same row.']],
 ['Tracking Approvals','Delivery','present',['Watch the status pill on each presentation row.','View counts update as the client opens the link.','Approval decisions and client notes appear inline and in your notification feed.']]];
document.getElementById('tutGrid').innerHTML=TUTS.map(([t,tag,view,steps],i)=>`<div class="card"><div class="card-b">
  <div class="help-cat"><i data-lucide="list-checks"></i>${t}</div>
  <div class="sub" style="margin:-4px 0 8px">${tag}</div>
  <ol style="margin:0 0 10px 18px;padding:0;list-style:decimal;font-size:.83rem;color:var(--mute);line-height:1.55">${steps.map(s=>`<li style="margin-bottom:4px">${s}</li>`).join('')}</ol>
  <button class="btn btn-ghost btn-xs" data-open="${view}"><i data-lucide="arrow-right"></i>Open ${tag==='Getting Started'?'Studio':''}</button>
</div></div>`).join('');
document.getElementById('tutPaths').innerHTML=[
 ['Agent Fast Track','Photo to client link for one listing','studio'],
 ['Investor Scope Deep Dive','Version to priced scope to product board','scope'],
 ['Delivery And Approvals','Presentations, PDF export and approval tracking','present']]
 .map(([n,m,v])=>`<div class="rowi"><div class="rowt"><b>${n}</b><span>${m}</span></div>
<button class="btn btn-ghost btn-xs" data-open="${v}"><i data-lucide="arrow-right"></i>Start</button></div>`).join('');


/* ---------- feedback modal ---------- */
const FB_CATS=['Bug','Design Quality','Scope Accuracy','Feature Request','Billing','Something Else'];
const fbModal=document.getElementById('fbModal');
document.getElementById('fbCats').innerHTML=FB_CATS.map(c=>`<span class="fb-cat">${c}</span>`).join('');
document.getElementById('fbCats').addEventListener('click',e=>{
  const c=e.target.closest('.fb-cat'); if(!c) return;
  const on=c.classList.contains('on');
  document.querySelectorAll('#fbCats .fb-cat').forEach(x=>x.classList.remove('on'));
  if(!on) c.classList.add('on');
});
let fbAttachPath=null;
function openFb(){ document.getElementById('fbForm').hidden=false; document.getElementById('fbDone').hidden=true;
  document.getElementById('fbBody').value=''; const ff=document.getElementById('fbFile'); ff.hidden=true; ff.textContent='';
  fbAttachPath=null;
  const send=document.getElementById('fbSend'); send.disabled=false; send.textContent='Send Feedback';
  document.querySelectorAll('#fbCats .fb-cat').forEach(x=>x.classList.remove('on'));
  fbModal.classList.add('on'); lucide.createIcons(); }
function closeFb(){ fbModal.classList.remove('on'); }
document.getElementById('fbBtn').addEventListener('click',()=>{closeHelp();openFb()});
document.getElementById('helpFbBtn').addEventListener('click',openFb);
document.getElementById('fbClose').addEventListener('click',closeFb);
document.getElementById('fbDoneClose').addEventListener('click',closeFb);
fbModal.addEventListener('click',e=>{ if(e.target===fbModal) closeFb(); });
document.getElementById('fbAttach').addEventListener('click',()=>{
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.addEventListener('change',async()=>{
    const file=inp.files&&inp.files[0]; if(!file) return;
    const f=document.getElementById('fbFile'); f.hidden=false; f.textContent='Uploading '+file.name+'…';
    try{ fbAttachPath=await uploadRoomPhoto(file); f.textContent=file.name; }
    catch(err){ fbAttachPath=null; f.textContent=(err&&err.message)||'Could not attach that file.'; }
  });
  inp.click();
});
document.getElementById('fbPolish').addEventListener('click',async()=>{
  const b=document.getElementById('fbBody');
  const f=document.getElementById('fbFile');
  if(b.value.trim().length<3){ b.focus(); b.style.borderColor='var(--red)'; return; }
  b.style.borderColor='';
  const btn=document.getElementById('fbPolish'); const prev=btn.innerHTML;
  btn.disabled=true; btn.textContent='Improving…';
  const cat=(document.querySelector('#fbCats .fb-cat.on')||{}).textContent||null;
  try{
    const res=await polishFeedback({data:{body:b.value,category:cat}});
    if(res&&res.text){ b.value=res.text; }
    else { f.hidden=false; f.textContent="Couldn't improve that right now."; }
  }catch(err){
    f.hidden=false; f.textContent=(err&&err.message)||"Couldn't improve that right now.";
  }finally{
    btn.disabled=false; btn.innerHTML=prev; lucide.createIcons();
  }
});
document.getElementById('fbSend').addEventListener('click',async()=>{
  const b=document.getElementById('fbBody');
  if(b.value.trim().length<3){ b.focus(); b.style.borderColor='var(--red)'; return; }
  b.style.borderColor='';
  const send=document.getElementById('fbSend'); send.disabled=true; send.textContent='Sending…';
  const cat=(document.querySelector('#fbCats .fb-cat.on')||{}).textContent||'Something Else';
  const view=(document.querySelector('.view.on')||{}).id||'';
  try{
    await submitFeedback({category:cat,body:b.value,viewContext:view.replace(/^v-/,''),attachmentPath:fbAttachPath});
    document.getElementById('fbForm').hidden=true; document.getElementById('fbDone').hidden=false; lucide.createIcons();
  }catch(err){
    send.disabled=false; send.textContent='Send Feedback';
    b.style.borderColor='var(--red)';
    const f=document.getElementById('fbFile'); f.hidden=false; f.textContent=(err&&err.message)||'Could not send feedback.';
  }
});


/* ---------- product tour ---------- */
const TOUR=[['.sidebar .nav-i','Navigation','Every part of the workspace lives here, from properties through client presentations.'],
['.search-wrap','Search Anything','Find a property, room, design or scope. The caret narrows the search or filters it.'],
['#helpBtn','Help Is Here','Help center, tutorials and feedback, always one click away.'],
['.acct-wrap','Your Account','Profile, team, billing and preferences moved into this menu.'],
['.topbar .btn-primary','Start Designing','New Design takes a room from photo to buildable version in a couple of minutes.']];
let ti=-1, tEl=null;
const veil=document.getElementById('tourVeil'),pop=document.getElementById('tourPop');
function clearHi(){ if(tEl){tEl.classList.remove('tour-hi');tEl=null;} }
function endTour(){ clearHi(); veil.classList.remove('on'); pop.classList.remove('on'); ti=-1; }
function showStep(i){
  clearHi();
  if(i>=TOUR.length){ endTour(); return; }
  ti=i; const [sel,title,body]=TOUR[i];
  const el=document.querySelector(sel);
  document.getElementById('tourStep').textContent=`STEP ${i+1} OF ${TOUR.length}`;
  document.getElementById('tourTitle').textContent=title;
  document.getElementById('tourBody').textContent=body;
  document.getElementById('tourNext').textContent=i===TOUR.length-1?'Done':'Next';
  veil.classList.add('on'); pop.classList.add('on');
  if(el){ el.classList.add('tour-hi'); tEl=el;
    const r=el.getBoundingClientRect();
    let top=r.bottom+12, left=r.left;
    if(top+180>window.innerHeight) top=Math.max(12,r.top-180);
    left=Math.min(Math.max(12,left),window.innerWidth-274);
    pop.style.top=top+'px'; pop.style.left=left+'px';
  } else { pop.style.top='50%'; pop.style.left='50%'; }
}
function startTour(){ closeHelp(); showStep(0); }
document.getElementById('tourBtn').addEventListener('click',startTour);
document.getElementById('helpTourBtn').addEventListener('click',startTour);
document.getElementById('apiFbBtn').addEventListener('click',openFb);
document.querySelectorAll('[data-pane-go]').forEach(b=>b.addEventListener('click',()=>acctPane(b.dataset.paneGo)));
document.getElementById('tourNext').addEventListener('click',()=>showStep(ti+1));
document.getElementById('tourSkip').addEventListener('click',endTour);
veil.addEventListener('click',endTour);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ endTour(); closeFb(); } });

/* ---------- notifications (derived from real account activity) ---------- */
let NOTIFS=[];
const NOTIF_READ_KEY='rd.notif.read';
function notifRead(){ try{ return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY)||'[]')); }catch(e){ return new Set(); } }
function notifMarkRead(ids){
  const s=notifRead(); ids.forEach(i=>s.add(i));
  try{ localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...s])); }catch(e){}
  NOTIFS.forEach(n=>{ if(s.has(n.id)) n.unread=false; });
}
function nAgo(iso){
  const s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<90) return 'now'; if(s<5400) return Math.round(s/60)+'m';
  if(s<172800) return Math.round(s/3600)+'h'; return Math.round(s/86400)+'d';
}
const ACTION_LABEL={design:'Design',scope:'Scope',plan_3d:'3D Plan',video:'Video',topup:'Top Up',grant:'Credits Granted',refund:'Refund'};
async function buildNotifs(){
  const read=notifRead(); const out=[];
  try{
    const vers=await listSavedEstimates();
    (vers||[]).slice(0,10).forEach(v=>{
      out.push({id:'v:'+v.version_id, ic:v.status==='approved'?'check-circle-2':'wand-sparkles', cat:v.status==='approved'?'approvals':'designs',
        t:v.room_name+' v'+(v.version_no||1)+(v.status==='approved'?' Approved':' Saved'),
        b:(v.address?v.address+' \u00b7 ':'')+(v.project_name||'Project'),
        at:v.created_at, tm:nAgo(v.created_at)});
    });
  }catch(e){}
  try{
    const led=await listCreditHistory();
    (led||[]).slice(0,10).forEach(l=>{
      const spent=l.delta<0;
      out.push({id:'c:'+l.id, ic:spent?'gauge':'credit-card', cat:'billing',
        t:(ACTION_LABEL[l.action]||l.action)+(spent?' used '+Math.abs(l.delta)+(Math.abs(l.delta)===1?' credit':' credits'):(l.delta>0?' +'+l.delta+' credits':'')),
        b:(l.note||'Credit activity')+' \u00b7 Balance '+l.balance_after,
        at:l.created_at, tm:nAgo(l.created_at)});
    });
  }catch(e){}
  try{
    const pres=await listPresentations();
    (pres||[]).slice(0,12).forEach(p=>{
      const who=p.client_name||p.client_email||'Your client';
      const where=(p.address?p.address+' \u00b7 ':'')+p.room_name+' v'+(p.version_no||1);
      if(p.status==='approved'){
        out.push({id:'pa:'+p.id, ic:'badge-check', cat:'approvals', go:'present', pres:p.id, t:who+' Approved '+p.title,
          b:(p.decision_note?'\u201c'+p.decision_note+'\u201d \u00b7 ':'')+where,
          at:p.decided_at||p.last_viewed_at||p.created_at, tm:nAgo(p.decided_at||p.created_at)});
      }else if(p.status==='changes'){
        out.push({id:'pc:'+p.id, ic:'message-square-warning', cat:'approvals', go:'present', pres:p.id, t:who+' Requested Changes On '+p.title,
          b:(p.decision_note?'\u201c'+p.decision_note+'\u201d \u00b7 ':'')+where,
          at:p.decided_at||p.created_at, tm:nAgo(p.decided_at||p.created_at)});
      }else if(p.status==='viewed'&&p.last_viewed_at){
        out.push({id:'pv:'+p.id+':'+p.view_count, ic:'eye', cat:'approvals', go:'present', pres:p.id,
          t:who+' Opened '+p.title,
          b:p.view_count+(p.view_count===1?' view':' views')+' \u00b7 no decision yet \u00b7 '+where,
          at:p.last_viewed_at, tm:nAgo(p.last_viewed_at)});
      }
    });
  }catch(e){}
  try{
    const c=await getMyCredits(); CREDITS=c;
    if(c&&c.plan!=='free'&&c.balance<=20)
      out.push({id:'low:'+c.balance, ic:'triangle-alert', cat:'billing', t:'Credits Running Low',
        b:c.balance+' credits left on your '+c.plan+' plan.', at:new Date().toISOString(), tm:'now'});
  }catch(e){}
  try{
    const tm=await listTeam();
    (tm.received||[]).forEach(i=>{
      out.push({id:'ti:'+i.id, ic:'user-plus', cat:'team', go:'account',
        t:'You Were Invited To Another Workspace',
        b:'Accept in Account, Team to share their properties, designs and scopes. Role: '+String(i.role||'member'),
        at:i.created_at, tm:nAgo(i.created_at)});
    });
    (tm.sent||[]).filter(i=>i.status==='accepted').slice(0,8).forEach(i=>{
      out.push({id:'tj:'+i.id, ic:'users', cat:'team', go:'account',
        t:i.email+' Joined Your Workspace',
        b:'Role: '+String(i.role||'member')+' \u00b7 they can now see shared properties and designs.',
        at:i.accepted_at||i.created_at, tm:nAgo(i.accepted_at||i.created_at)});
    });
  }catch(e){}
  out.sort((a,b)=>new Date(b.at)-new Date(a.at));
  const np=(PREFS&&PREFS.notifs)||{};
  const kept=out.filter(n=>np[n.cat]!==false);
  NOTIFS=kept.slice(0,20).map(n=>({...n, unread:!read.has(n.id)}));
  renderNotifs();
}
function notifFilter(tab){ return NOTIFS.filter(n=> tab==='all'?true: tab==='unread'?n.unread: n.cat===tab); }
function notifRow(n){ return `<button class="notif-i${n.unread?' unread':''}" data-nid="${n.id}"${n.go?` data-ngo="${n.go}"`:''}${n.pres?` data-npres="${n.pres}"`:''}>
 <span class="notif-ic"><i data-lucide="${n.ic}"></i></span>
 <span class="tx"><b>${n.t}</b><span>${n.b}</span></span>
 <span class="tm">${n.tm}</span>${n.unread?'<span class="dot"></span>':''}</button>`; }
function renderNotifs(){
  const unread=NOTIFS.filter(n=>n.unread).length;
  const dot=document.getElementById('notifDot'); if(dot) dot.style.display=unread?'block':'none';
  const empty='<div class="notif-empty">Nothing here yet. Save a design to start your activity feed.</div>';
  const list=document.getElementById('notifList');
  if(list){ const t=document.querySelector('#notifTabs .notif-tab.on')?.dataset.t||'all'; const r=notifFilter(t);
    list.innerHTML=r.length?r.map(notifRow).join(''):empty; }
  const page=document.getElementById('notifPage');
  if(page){ const t2=document.querySelector('#notifTabs2 .notif-tab.on')?.dataset.t||'all'; const r2=notifFilter(t2);
    page.innerHTML=r2.length?r2.map(notifRow).join(''):empty; }
  const cnt=document.getElementById('notifCount');
  if(cnt) cnt.textContent=NOTIFS.length?(unread?unread+' unread of '+NOTIFS.length+' notifications':'All caught up, '+NOTIFS.length+' notifications'):'No activity yet';
  lucide.createIcons();
}
const notifBtn=document.getElementById('notifBtn'),notifMenu=document.getElementById('notifMenu');
function closeNotif(){ if(notifMenu){notifMenu.classList.remove('on');notifBtn.setAttribute('aria-expanded','false');} }
if(notifBtn&&notifMenu){
  notifBtn.addEventListener('click',e=>{e.stopPropagation();closeAcct();closeSch();closeHelp();
    const open=!notifMenu.classList.contains('on');notifMenu.classList.toggle('on',open);
    notifBtn.setAttribute('aria-expanded',String(open)); if(open) buildNotifs();});
  document.addEventListener('click',e=>{ if(!e.target.closest('.notif-wrap')) closeNotif(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeNotif(); });
}
document.querySelectorAll('#notifTabs .notif-tab,#notifTabs2 .notif-tab').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('.notif-tab').forEach(x=>x.classList.toggle('on',x===b)); renderNotifs();
}));
document.addEventListener('click',e=>{
  const row=e.target.closest('.notif-i'); if(!row) return;
  const inMenu=!!row.closest('#notifList');
  notifMarkRead([row.dataset.nid]);
  const dest=row.dataset.ngo;
  if(inMenu) closeNotif();
  if(dest) go(dest); else if(inMenu) go('notifications');
  const pid=row.dataset.npres;
  if(pid) setTimeout(()=>{ try{ focusPresentation(pid); }catch(_){} },60);
  renderNotifs();
});
['notifRead','notifReadAll'].forEach(id=>{ const b=document.getElementById(id);
  if(b) b.addEventListener('click',e=>{e.stopPropagation();notifMarkRead(NOTIFS.map(n=>n.id));renderNotifs();}); });
buildNotifs();
window.addEventListener('rd:saved', buildNotifs);
window.addEventListener('rd:credits-changed', buildNotifs);

window.addEventListener('rd:prefs',()=>{ try{ buildNotifs(); }catch(_){} });
try{ paintNotifPrefs(); }catch(_){}

renderNotifs();

/* ---------- studio: tool rows with plan badges ---------- */
const toolRows = Array.from(document.querySelectorAll('.toolrow'));
const toolInfo = document.getElementById('toolInfo');
const LIVE_TOOLS={'2D To 3D Plan':run3dPlan,'Walkthrough Video':runWalkthrough,'Virtual Stage':()=>runRoomToolFlow('stage','Virtual Stage',false),'Declutter':()=>runRoomToolFlow('declutter','Declutter',false),'Material Swap':()=>runRoomToolFlow('materials','Material Swap',true),'Sketch To Render':()=>runRoomToolFlow('sketch','Sketch To Render',false),'Multi Angle':()=>runRoomToolFlow('angle','Multi Angle',true)};
const TOOL_COST={'Redesign':1,'Virtual Stage':1,'Declutter':1,'Material Swap':1,'Sketch To Render':1,'Scope & Budget':3,'Multi Angle':1,'Walkthrough Video':40,'2D To 3D Plan':6};
toolRows.forEach((r)=>{
  const nm=r.getAttribute('data-tool')||'';
  const c=TOOL_COST[nm];
  r.title = nm + (c?(' \u00b7 ' + c + ' credit' + (c>1?'s':'')):'') + '\n' + (r.getAttribute('data-desc')||'');
});
toolRows.forEach((r) => r.addEventListener('click', () => {
  toolRows.forEach((x) => x.classList.remove('on'));
  r.classList.add('on');
  const name = r.getAttribute('data-tool');
  const plan = r.getAttribute('data-plan');
  if (LIVE_TOOLS[name]) {
    if (toolInfo) toolInfo.hidden = true;
    LIVE_TOOLS[name]();
    return;
  }
  if (plan && toolInfo) {
    document.getElementById('toolInfoName').textContent =
      name + ' is on the ' + (plan === 'pro' ? 'Pro' : 'Studio') + ' plan';
    const cst = TOOL_COST[name];
    document.getElementById('toolInfoDesc').textContent =
      (r.getAttribute('data-desc') || '') + (cst ? ' Costs ' + cst + ' credit' + (cst>1?'s':'') + ' per run.' : '');
    toolInfo.hidden = false;
  } else if (toolInfo) {
    toolInfo.hidden = true;
  }
}));


/* ---------- studio: canvas dark / light surround ---------- */
const canvasCard = document.getElementById('canvasCard');
const canvasThemeBtn = document.getElementById('canvasTheme');
if (canvasCard && canvasThemeBtn) {
  const CT_KEY='rd.canvasTheme';
  const applyCanvasTheme=(mode)=>{
    const dark = mode !== 'light';
    canvasCard.classList.toggle('dark', dark);
    canvasThemeBtn.querySelectorAll('[data-ctheme]').forEach(b=>{
      const on = b.getAttribute('data-ctheme') === (dark?'dark':'light');
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    try{ localStorage.setItem(CT_KEY, dark?'dark':'light'); }catch(e){}
  };
  canvasThemeBtn.querySelectorAll('[data-ctheme]').forEach(b=>b.addEventListener('click',()=>{
    applyCanvasTheme(b.getAttribute('data-ctheme'));
    lucide.createIcons();
  }));
  let saved='dark';
  try{ saved = localStorage.getItem(CT_KEY) || 'dark'; }catch(e){}
  applyCanvasTheme(saved);
}

/* ---------- accounts: signed-in identity + saved projects ---------- */
const initials=(s)=>s.split(/[.@\s_-]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'RD';
const AV_TONES=['#2563eb','#059669','#7c3aed','#64748b','#e11d48','#0d9488'];
function avTone(seed){ let h=0; for(let i=0;i<(seed||'').length;i++) h=(h*31+seed.charCodeAt(i))%9973; return AV_TONES[h%AV_TONES.length]; }
function paintAvatars(av,seed){
  const tone=avTone(seed||av);
  window.__rdAv={av:av,tone:tone};
  if(!window.__rdAvObs){
    window.__rdAvObs=new MutationObserver(()=>{ const a=window.__rdAv; if(!a) return;
      document.querySelectorAll('.av').forEach(e=>{ if(e.dataset.avDone) return; e.dataset.avDone='1';
        if(!e.style.backgroundImage){ e.textContent=a.av; e.style.background=a.tone; } e.style.color='#fff'; });
    });
    window.__rdAvObs.observe(document.body,{childList:true,subtree:true});
  }
  document.querySelectorAll('.av').forEach(e=>{
    e.dataset.avDone='1';
    if(!e.style.backgroundImage){ e.textContent=av; e.style.background=tone; }
    e.style.color='#fff';
  });
}
const $id=(x)=>document.getElementById(x);
supabase.auth.getUser().then(({data})=>{
  const u=data&&data.user; if(!u) return;
  const m=u.user_metadata||{};
  const name=m.full_name||m.name||u.email.split('@')[0];
  const av=initials(name);
  paintAvatars(av,u.email||name);
  const head=document.querySelector('.acct-head b'); if(head) head.textContent=name;
  const mail=document.querySelector('.acct-head div span'); if(mail) mail.textContent=u.email;
  const n=$id('pfName'); if(n) n.value=name;
  const ph=$id('pfPhone'); if(ph) ph.value=m.phone||'';
  const em=$id('pfEmail'); if(em) em.value=u.email;
  const co=$id('pfCompany'); if(co) co.value=m.company||'';
  const ro=$id('pfRole'); if(ro&&m.role) ro.value=m.role;
  const se=$id('secEmail'); if(se) se.textContent=u.email;
}).catch(()=>{});

/* ---------- account side card + data & privacy ---------- */
async function paintAcctSide(){
  try{
    const { data } = await supabase.auth.getUser();
    const u=data&&data.user; if(!u) return;
    const m=u.user_metadata||{};
    const name=m.full_name||m.name||u.email.split('@')[0];
    const sn=$id('sideName'); if(sn) sn.textContent=name;
    const sm=$id('sideMail'); if(sm) sm.textContent=u.email;
    const sr=$id('sideRole'); if(sr) sr.textContent=m.role||'Owner';
    const sv=$id('sideVerified');
    if(sv){ const ok=!!u.email_confirmed_at; sv.textContent=ok?'Verified':'Unverified'; sv.className='pill '+(ok?'p-ok':'p-amb'); }
  }catch(_){}
  try{
    const c=await getMyCredits(); if(!c) return;
    const sp=$id('sidePlan'); if(sp) sp.textContent=c.plan==='free'?'Free':c.plan.charAt(0).toUpperCase()+c.plan.slice(1);
    const sc=$id('sideCredit'), sb=$id('sideCreditBar'), ss=$id('sideCreditSub');
    if(c.plan==='free'){
      const left=Math.max(0,5-(c.free_used_today||0));
      if(sc) sc.textContent=left+' of 5 free designs left today';
      if(sb) sb.style.width=(left/5*100)+'%';
      if(ss) ss.textContent='Free plan resets every day';
    } else {
      if(sc) sc.textContent=c.balance+(c.balance===1?' credit':' credits')+' available';
      if(sb) sb.style.width=Math.min(100,(c.balance/200)*100)+'%';
      if(ss) ss.textContent='One balance covers designs, scopes, plans and video';
    }
  }catch(_){}
}
paintAcctSide();
window.addEventListener('rd:credits-changed', paintAcctSide);

const dpExport=$id('dpExport');
if(dpExport) dpExport.addEventListener('click',async()=>{
  const msg=$id('dpMsg'); const set=(t)=>{ if(msg) msg.textContent=t; };
  dpExport.disabled=true; set('Building your export');
  try{
    const payload=await exportMyData();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='real-designs-export-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    set('Export downloaded. It contains every property, room, design, scope and presentation on your account.');
  }catch(e){ set('Could not build the export: '+(e&&e.message?e.message:'unknown error')); }
  dpExport.disabled=false;
});

const dpDelete=$id('dpDelete');
if(dpDelete) dpDelete.addEventListener('click',async()=>{
  const msg=$id('dpMsg'); const set=(t)=>{ if(msg) msg.textContent=t; };
  const typed=window.prompt('This permanently deletes your workspace, every design, scope and client link, and your sign in. Type DELETE to confirm.');
  if((typed||'').trim().toUpperCase()!=='DELETE'){ set('Deletion cancelled. Nothing was removed.'); return; }
  dpDelete.disabled=true; set('Deleting your account');
  try{
    await deleteMyAccount();
    try{ await supabase.auth.signOut(); }catch(_){}
    window.location.href='/';
  }catch(e){ set('Could not delete the account: '+(e&&e.message?e.message:'unknown error')); dpDelete.disabled=false; }
});

const pfSave=$id('pfSave');
if(pfSave) pfSave.addEventListener('click',async()=>{
  const msg=$id('pfMsg'); const name=($id('pfName').value||'').trim();
  if(!name){ if(msg){msg.textContent='Add your name first';msg.style.color='var(--red)';} return; }
  pfSave.disabled=true; if(msg){msg.textContent='Saving';msg.style.color='var(--mute)';}
  const { error } = await supabase.auth.updateUser({ data:{
    full_name:name,
    phone:($id('pfPhone').value||'').trim(),
    company:($id('pfCompany').value||'').trim(),
    role:$id('pfRole')?$id('pfRole').value:'Owner'
  }});
  pfSave.disabled=false;
  if(msg){ msg.textContent=error?('Could not save: '+error.message):'Saved'; msg.style.color=error?'var(--red)':'var(--ok)'; }
  if(!error){
    const av=initials(name);
    paintAvatars(av,u.email||name);
    const head=document.querySelector('.acct-head b'); if(head) head.textContent=name;
    paintAcctSide();
    setTimeout(()=>{ if(msg) msg.textContent=''; },2500);
  }
});

const pwSave=$id('pwSave');
if(pwSave) pwSave.addEventListener('click',async()=>{
  const msg=$id('pwMsg'), a=$id('pwNew').value, b=$id('pwConfirm').value;
  const set=(t,ok)=>{ if(msg){ msg.textContent=t; msg.style.color=ok?'var(--ok)':'var(--red)'; } };
  if(a.length<10) return set('Use at least 10 characters',false);
  if(a!==b) return set('Passwords do not match',false);
  pwSave.disabled=true; if(msg){msg.textContent='Updating';msg.style.color='var(--mute)';}
  const { error } = await supabase.auth.updateUser({ password:a });
  pwSave.disabled=false;
  if(error) return set('Could not update: '+error.message,false);
  $id('pwNew').value=''; $id('pwConfirm').value=''; set('Password updated',true);
  setTimeout(()=>{ if(msg) msg.textContent=''; },2500);
});

document.querySelectorAll('.btn-logout').forEach(b=>b.addEventListener('click',async()=>{
  await supabase.auth.signOut();
  window.location.href='/auth';
}));


// Wrap every table so wide tables scroll horizontally instead of stretching the page.
document.querySelectorAll('.rd-app table, .app table').forEach(t=>{
  if(t.parentElement && t.parentElement.classList.contains('tscroll')) return;
  const w=document.createElement('div'); w.className='tscroll';
  t.parentNode.insertBefore(w,t); w.appendChild(t);
});

// Mobile drawer: hamburger in the topbar toggles the sidebar off-canvas.
(function mobileNav(){
  const bar=document.querySelector('.topbar');
  const side=document.querySelector('.side');
  if(!bar||!side||document.getElementById('navBurger')) return;
  const burger=document.createElement('button');
  burger.className='nav-burger'; burger.id='navBurger';
  burger.setAttribute('aria-label','Open navigation');
  burger.innerHTML='<i data-lucide="menu"></i>';
  bar.insertBefore(burger,bar.firstChild);
  const scrim=document.createElement('div');
  scrim.className='side-scrim';
  (document.querySelector('.rd-app')||document.body).appendChild(scrim);
  const close=()=>{side.classList.remove('open');scrim.classList.remove('on');burger.setAttribute('aria-expanded','false');};
  burger.addEventListener('click',()=>{
    const open=!side.classList.contains('open');
    side.classList.toggle('open',open); scrim.classList.toggle('on',open);
    burger.setAttribute('aria-expanded',String(open));
  });
  scrim.addEventListener('click',close);
  side.querySelectorAll('.nav-i').forEach(b=>b.addEventListener('click',close));
  window.addEventListener('resize',()=>{ if(window.innerWidth>900) close(); });
})();

const scopeGrid=document.getElementById('scopeGrid');
let savedCard=null;
if(scopeGrid && !document.getElementById('scSave')){
  const briefBtn=document.getElementById('scBrief');
  const saveBtn=document.createElement('button');
  saveBtn.className='btn btn-ghost btn-xs'; saveBtn.id='scSave';
  saveBtn.innerHTML='<i data-lucide="save"></i>Save To My Projects';
  briefBtn.parentNode.insertBefore(saveBtn,briefBtn);

  /* remember the last property the user typed so the next save is one click */
  const LS='rd.saveMeta';
  const meta=(()=>{ try{ return JSON.parse(localStorage.getItem(LS)||'{}')||{}; }catch(e){ return {}; } })();
  let uploadPath=null;

  const saveCard=document.createElement('div');
  saveCard.className='card'; saveCard.style.gridColumn='1 / -1';
  saveCard.innerHTML='<div class="card-h"><div><h3>Save This Room</h3><div class="sub">Your photo and priced scope are stored on your account</div></div></div>'
    +'<div class="card-b"><div class="save-form">'
    +'<label>Property Address<input id="svAddress" type="text" placeholder="206 N MacDill Ave, Tampa FL"></label>'
    +'<label>Project Name<input id="svProject" type="text" placeholder="Retail Flip"></label>'
    +'<label>Room Name<input id="svRoom" type="text" placeholder="Living Room"></label>'
    +'<label>Room Type<input id="svType" type="text" placeholder="living room"></label>'
    +'</div>'
    +'<div class="save-photo"><label class="btn btn-ghost btn-xs" for="svPhoto"><i data-lucide="image-up"></i>Upload Room Photo</label>'
    +'<input id="svPhoto" type="file" accept="image/*" hidden>'
    +'<span class="sub" id="svPhotoNote">No photo uploaded yet. The sample room is used until you add one.</span>'
    +'<img id="svThumb" alt="" hidden></div></div>';
  scopeGrid.appendChild(saveCard);

  const $=(id)=>document.getElementById(id);
  $('svAddress').value=meta.address||'';
  $('svProject').value=meta.project||'';
  $('svRoom').value=meta.room||'';
  $('svType').value=meta.type||'';

  $('svPhoto').addEventListener('change',async(e)=>{
    const file=e.target.files&&e.target.files[0];
    if(!file) return;
    const note=$('svPhotoNote'); note.textContent='Uploading…';
    try{
      uploadPath=await uploadRoomPhoto(file);
      const url=await roomPhotoUrl(uploadPath);
      const thumb=$('svThumb');
      if(url){ thumb.src=url; thumb.hidden=false; }
      note.textContent='Photo stored on your account.';
      try{ window.dispatchEvent(new CustomEvent('rd:photo')); }catch(e2){}
    }catch(err){
      uploadPath=null;
      note.textContent=(err&&err.message)||'Could not upload that photo.';
    }
  });

  savedCard=document.createElement('div');
  savedCard.className='card'; savedCard.style.gridColumn='1 / -1';
  savedCard.innerHTML='<div class="card-h"><div><h3>Saved Estimates</h3><div class="sub" id="savedSub">Your saved rooms and priced scopes</div></div>'
    +'<button class="btn btn-ghost btn-xs" id="savedRefresh"><i data-lucide="refresh-cw"></i>Refresh</button></div>'
    +'<div class="card-b"><table><thead><tr><th>Property</th><th>Room</th><th>Grade</th><th style="text-align:right">Low</th><th style="text-align:right">High</th><th></th></tr></thead>'
    +'<tbody id="savedRows"><tr><td colspan="6">Loading…</td></tr></tbody></table></div>';
  scopeGrid.appendChild(savedCard);

  async function loadSaved(){
    const rows=document.getElementById('savedRows');
    try{
      const list=await listSavedEstimates();
      if(!list.length){ rows.innerHTML='<tr><td colspan="6">Nothing saved yet. Price a scope, then use Save To My Projects.</td></tr>'; return; }
      rows.innerHTML=list.map(v=>`<tr><td><div class="saved-prop"><img class="saved-thumb" data-photo="${v.before_path||''}" alt="" hidden><div><b>${v.address}</b><div class="sub">${v.project_name}</div></div></div></td><td>${v.room_name}</td>
<td>${v.grade[0].toUpperCase()+v.grade.slice(1)}</td>
<td class="n">${v.total_low==null?'—':money(v.total_low)}</td>
<td class="n">${v.total_high==null?'—':money(v.total_high)}</td>
<td class="n"><button class="btn btn-ghost btn-xs" data-del="${v.version_id}">Delete</button></td></tr>`).join('');
      document.getElementById('savedSub').textContent=list.length+' saved '+(list.length===1?'room':'rooms');
      rows.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
        b.disabled=true;
        try{ await deleteSavedEstimate({data:{version_id:b.getAttribute('data-del')}}); await loadSaved(); }
        catch(e){ b.disabled=false; }
      }));
      rows.querySelectorAll('.saved-thumb').forEach(async(img)=>{
        const p=img.getAttribute('data-photo');
        if(!p) return;
        const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
        if(url){ img.src=url; img.hidden=false; }
      });
      lucide.createIcons();
    }catch(e){
      rows.innerHTML='<tr><td colspan="6">Could not load saved estimates. '+((e&&e.message)||'')+'</td></tr>';
    }
  }
  document.getElementById('savedRefresh').addEventListener('click',loadSaved);
  loadSaved();

  saveBtn.addEventListener('click',async()=>{
    const note=document.getElementById('scopeNote');
    if(!lastScope){ note.textContent='Price the scope first, then save it.'; return; }
    const address=($('svAddress').value||'').trim();
    const project=($('svProject').value||'').trim()||'Untitled Project';
    const room=($('svRoom').value||'').trim()||'Living Room';
    const type=($('svType').value||'').trim()||'living room';
    if(address.length<3){ note.textContent='Add the property address before saving.'; $('svAddress').focus(); return; }
    const num=(id,d)=>{const v=parseFloat((document.getElementById(id)||{}).value);return Number.isFinite(v)&&v>0?v:d;};
    saveBtn.disabled=true; const lab=saveBtn.innerHTML; saveBtn.textContent='Saving…';
    try{
      await saveEstimate({data:{
        address,
        project_name:project,
        room_name:room,
        room_type:type,
        grade:document.getElementById('scGrade').value,
        market_id:lastScope.market.id,
        budget_target:num('scBudget',null),
        floor_area_sf:num('scFloor',340),
        wall_area_sf:num('scWall',780),
        perimeter_lf:num('scPerim',76),
        ceiling_ht_in:dimsProposal?dimsProposal.ceiling_ht_in:96,
        dims_source:dimsProposal?(dimsConfirmed?'user':'depth_estimate'):'user',
        dims_confirmed:!dimsProposal||dimsConfirmed,
        before_path:uploadPath||window.rdPendingPhotoPath||PHOTOS.before,
        after_path:lastRenderPath||(uploadPath?null:PHOTOS.after),
        items:scopeItems,
      }});
      try{ localStorage.setItem(LS,JSON.stringify({address,project,room,type})); }catch(e){}
      note.textContent='Saved to your projects.';
      try{ window.dispatchEvent(new CustomEvent('rd:saved')); }catch(e2){}
      await loadSaved();
    }catch(e){
      note.textContent='Could not save this estimate. '+((e&&e.message)||'');
    }finally{ saveBtn.disabled=false; saveBtn.innerHTML=lab; lucide.createIcons(); }
  });
}

/* ---------- first run onboarding ---------- */
(async function onboarding(){
  const dash=document.getElementById('v-dash');
  if(!dash) return;
  document.querySelectorAll('#onbCard,#onbModal').forEach(n=>n.remove());

  const STEPS=[
    {k:'photo',t:'Upload A Room Photo',b:'One clear photo of the space you want to redesign.',i:'image-up',cta:'Upload Photo'},
    {k:'priced',t:'Price The Scope',b:'Turn the design into line items and a local planning range.',i:'calculator',cta:'Open Scope'},
    {k:'saved',t:'Save Your First Room',b:'Store the photo, property and priced scope on your account.',i:'save',cta:'Save Room'},
    {k:'brand',t:'Add Your Brand Kit',b:'Your company name and accent colour on every export.',i:'palette',cta:'Set Brand'},
    {k:'shared',t:'Share A Presentation',b:'Send a client a branded link they can approve.',i:'presentation',cta:'Open Presentations'}
  ];
  /* insert synchronously so a double init cannot duplicate the card */
  const card=document.createElement('div');
  card.className='card onb'; card.id='onbCard'; card.style.marginBottom='16px'; card.hidden=true;
  card.innerHTML='<div class="card-h"><div><h3>Get Started</h3><div class="sub" id="onbSub"></div></div>'
    +'<button class="btn btn-ghost btn-xs" id="onbHide"><i data-lucide="x"></i>Dismiss</button></div>'
    +'<div class="card-b"><div class="onb-bar"><i id="onbFill"></i></div><div class="onb-steps" id="onbSteps"></div></div>';
  dash.insertBefore(card,dash.firstChild);

  let uid='anon';
  try{ const {data}=await supabase.auth.getUser(); if(data&&data.user) uid=data.user.id; }catch(e){}
  const KEY='rd.onb.'+uid;
  const readState=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ return {}; } };
  const state=readState();
  /* merge on write so a second init cannot drop flags written by the first */
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(Object.assign(readState(),state))); }catch(e){} };
  if(state.done){ card.remove(); return; }

  /* already worked in this account? then there is nothing to onboard */
  try{
    const list=await listSavedEstimates();
    if(list&&list.length){ state.done=true; save(); card.remove(); return; }
  }catch(e){}
  card.hidden=false;
  const dup=document.getElementById('obCard'); if(dup) dup.remove();


  function act(k){
    if(k==='brand'){ go('branding'); return; }
    if(k==='shared'){ go('present'); return; }
    go('scope');
    setTimeout(()=>{
      if(k==='photo'){ const l=document.querySelector('label[for="svPhoto"]'); if(l){ l.scrollIntoView({behavior:'smooth',block:'center'}); l.click(); } }
      else if(k==='priced'){ const b=document.getElementById('scRun'); if(b){ b.scrollIntoView({behavior:'smooth',block:'center'}); b.click(); } }
      else { const a=document.getElementById('svAddress'); if(a){ a.scrollIntoView({behavior:'smooth',block:'center'}); a.focus(); } }
    },80);
  }

  function render(){
    const done=STEPS.filter(s=>state[s.k]).length;
    document.getElementById('onbSub').textContent=done+' of '+STEPS.length+' complete';
    document.getElementById('onbFill').style.width=Math.round(done/STEPS.length*100)+'%';
    document.getElementById('onbSteps').innerHTML=STEPS.map((s,n)=>
      '<div class="onb-step'+(state[s.k]?' on':'')+'">'
      +'<span class="onb-ic"><i data-lucide="'+(state[s.k]?'check':s.i)+'"></i></span>'
      +'<div class="onb-tx"><b>'+(n+1)+'. '+s.t+'</b><span>'+s.b+'</span></div>'
      +(state[s.k]?'<span class="pill p-ok">Done</span>':'<button class="btn btn-ghost btn-xs" data-onb="'+s.k+'">'+s.cta+'</button>')
      +'</div>').join('');
    document.querySelectorAll('[data-onb]').forEach(b=>b.addEventListener('click',()=>act(b.getAttribute('data-onb'))));
    lucide.createIcons();
    if(done===STEPS.length){
      state.done=true; save();
      setTimeout(()=>{ card.remove(); try{ window.dispatchEvent(new CustomEvent('rd:saved')); }catch(_){} },2400);
    }
  }
  render();

  /* reflect real account state for the two account-level steps */
  (async()=>{
    let changed=false;
    try{ if((await getPrefs()).brand.company.trim() && !state.brand){ state.brand=true; changed=true; } }catch(e){}
    try{ if((await listPresentations()).length && !state.shared){ state.shared=true; changed=true; } }catch(e){}
    if(changed){ save(); render(); }
  })();

  document.getElementById('onbHide').addEventListener('click',()=>{ state.done=true; save(); card.remove(); });
  ['photo','priced','saved','brand','shared'].forEach(k=>window.addEventListener('rd:'+k,()=>{ if(!state[k]){ state[k]=true; save(); render(); } }));

  /* welcome once per account, but never over a photo handed off from the site */
  const pendingHandoff=(()=>{ try{ return !!window.rdHandoffPending||!!localStorage.getItem('rd.handoff'); }catch(e){ return false; } })();
  const alreadyWelcomed=state.welcomed||readState().welcomed||window.__rdWelcomed;
  if(!alreadyWelcomed && !pendingHandoff){
    state.welcomed=true; window.__rdWelcomed=true; save();
    document.querySelectorAll('#onbModal').forEach(n=>n.remove());
    const m=document.createElement('div'); m.className='up-modal on'; m.id='onbModal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">'
      +'<h3>Welcome To REAL DESIGNS</h3>'
      +'<p>Upload one room photo and REAL DESIGNS gives you a redesign, a priced scope and a client ready package. Your '+STEPS.length+' step checklist is waiting on the dashboard.</p>'
      +'<div class="up-act"><button class="btn btn-primary" id="onbStart">Start With A Photo</button>'
      +'<button class="btn btn-ghost" data-close>Look Around First</button></div></div>';
    (document.querySelector(".rd-app")||document.body).appendChild(m);
    const close=()=>m.remove();
    m.addEventListener('click',e=>{ if(e.target.closest('[data-close]')) close(); });
    m.querySelector('#onbStart').addEventListener('click',()=>{ close(); act('photo'); });
    lucide.createIcons();
  }
})();




lucide.createIcons();

/* ---------- live credit meter, billing pane and upgrade prompts ---------- */
const COST_ROWS=[['Design','1 Credit','A photoreal redesign of one photo'],
                 ['Scope','3 Credits','Line items, quantities and local rates'],
                 ['3D Plan','6 Credits','A furnished plan from your photo'],
                 ['Video','40 Credits','A cinematic walkthrough clip']];
const PLAN_NAME={free:'Free',starter:'Starter',pro:'Pro',studio:'Studio'};
const PLAN_CAP={free:5,starter:200,pro:2000,studio:4000};

function upgradeModal(title,body){
  let m=document.getElementById('upModal');
  if(!m){
    m=document.createElement('div'); m.id='upModal'; m.className='up-modal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">'+
      '<h3 id="upTitle"></h3><p id="upBody"></p>'+
      '<div id="upCosts" class="up-costs"></div>'+
      '<button class="btn btn-primary btn-block" id="upGo"><i data-lucide="zap"></i>See Plans And Credits</button>'+
      '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Not Now</button></div>';
    (document.querySelector(".rd-app")||document.body).appendChild(m);
    m.addEventListener('click',(e)=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
    m.querySelector('#upGo').addEventListener('click',()=>{
      m.classList.remove('on');
      try{ go('billing'); }catch(_){ const b=document.querySelector('[data-goto="account"]'); if(b) b.click(); }
      setTimeout(()=>{ const rail=document.querySelector('[data-pane="billing"]'); if(rail) rail.click(); },40);
    });
  }
  m.querySelector('#upTitle').textContent=title;
  m.querySelector('#upBody').textContent=body;
  m.querySelector('#upCosts').innerHTML=COST_ROWS.map(r=>'<div><span>'+r[0]+'</span><b class="mono">'+r[1]+'</b></div>').join('');
  m.classList.add('on');
  lucide.createIcons();
}

/** Turn a server refusal into an upgrade prompt instead of a raw error. */
function creditGate(e){
  const msg=(e&&e.message)||'';
  if(/credit|free designs|paid plan/i.test(msg)){
    upgradeModal(/free designs/i.test(msg)?'You Have Used Today\u2019s Free Designs':'You Need More Credits',msg);
    return true;
  }
  return false;
}
window.rdCreditGate=creditGate;

async function loadCreditHistory(){
  const el=document.getElementById('billHist'); if(!el) return;
  try{
    const rows=await listCreditHistory();
    if(!rows.length) return;
    el.innerHTML=rows.slice(0,15).map(r=>{
      const when=new Date(r.created_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      const label=(r.action||'').replace('plan_3d','3D Plan').replace(/^./,c=>c.toUpperCase());
      const delta=r.delta>0?'+'+r.delta:(r.delta<0?String(r.delta):'Free');
      return '<div class="rowi"><div class="rowt"><b>'+label+'</b><span>'+when+(r.note?' \u00b7 '+r.note:'')+'</span></div>'+
             '<div class="mono" style="font-size:.78rem">'+delta+'</div></div>';
    }).join('');
  }catch(e){ /* signed out */ }
}

function paintBilling(c){
  const sub=document.getElementById('billSub'); if(!sub) return;
  const name=PLAN_NAME[c.plan]||c.plan;
  sub.textContent=c.plan==='free'?'Free plan \u00b7 5 designs a day':name+' plan \u00b7 billed annually';
  const st=document.getElementById('billStatus');
  if(st){ st.textContent=c.plan==='free'?'Free':'Active'; st.className='pill '+(c.plan==='free'?'p-ink':'p-ok'); }
  const lab=document.getElementById('billMeterLab'), val=document.getElementById('billMeterVal'),
        bar=document.getElementById('billMeterBar'), note=document.getElementById('billMeterNote');
  if(c.plan==='free'){
    lab.textContent='Free Designs Left Today';
    val.textContent=(c.remainingToday??0)+' / 5';
    bar.style.width=(((c.remainingToday??0)/5)*100)+'%';
    note.textContent='Resets at midnight. Scopes, 3D plans and video need a paid plan.';
  }else{
    lab.textContent='Credit Balance';
    val.textContent=c.balance.toLocaleString();
    bar.style.width=Math.min(100,(c.balance/(PLAN_CAP[c.plan]||2000))*100)+'%';
    note.textContent='One balance across every tool. Credits refresh each billing cycle.';
  }
  const costs=document.getElementById('billCosts');
  if(costs) costs.innerHTML=COST_ROWS.map(r=>'<div class="rowi"><div class="rowt"><b>'+r[0]+'</b><span>'+r[2]+'</span></div>'+
    '<div class="mono" style="font-size:.78rem">'+r[1]+'</div></div>').join('');
}

let CREDITS=null;
/** Pre-flight credit check so a run is blocked before it starts. */
function ensureCredits(cost,label){
  if(!CREDITS) return true;
  if(CREDITS.plan==='free'){
    if(cost>1){ upgradeModal('Upgrade To Use '+label,label+' costs '+cost+' credits and needs a paid plan. The free plan covers 5 designs a day.'); return false; }
    if((CREDITS.remainingToday??0)<=0){ upgradeModal('You Have Used Today\u2019s Free Designs','Free designs reset at midnight. A paid plan adds a credit balance you can spend on any tool.'); return false; }
    return true;
  }
  if((CREDITS.balance??0)<cost){ upgradeModal('You Need More Credits',label+' costs '+cost+' credits and your balance is '+(CREDITS.balance??0)+'. Top up or move to a bigger plan.'); return false; }
  return true;
}

async function refreshCredits(){
  const lab=document.getElementById('credLab'); if(!lab) return;
  const box=lab.closest('.credit-box'); const bar=box&&box.querySelector('.meter i');
  const foot=box&&box.querySelectorAll('.lab')[1];
  try{
    const c=await getMyCredits();
    const title=box&&box.querySelector('.lab span');
    const gc=document.getElementById('genCost'); if(gc) gc.textContent=c.plan==='free'?'Free':'1';
    if(c.plan==='free'){
      if(title) title.textContent='Free Designs Today';
      lab.textContent=(c.remainingToday??0)+' / 5';
      if(bar) bar.style.width=(((c.remainingToday??0)/5)*100)+'%';
      if(foot) foot.innerHTML='<span>Free Plan</span><b class="cred-up" role="button" tabindex="0">Upgrade For Credits</b>';
    }else{
      if(title) title.textContent='Credit Balance';
      lab.textContent=c.balance.toLocaleString();
      if(bar) bar.style.width=Math.min(100,(c.balance/(PLAN_CAP[c.plan]||2000))*100)+'%';
      if(foot) foot.innerHTML='<span>'+(PLAN_NAME[c.plan]||c.plan)+' Plan</span><b>1 Design &bull; 3 Scope &bull; 40 Video</b>';
    }
    if(box && !box.dataset.wired){
      box.dataset.wired='1';
      box.addEventListener('click',(e)=>{
        if(e.target.classList&&e.target.classList.contains('cred-up'))
          upgradeModal('Upgrade For A Credit Balance','The free plan covers 5 designs a day. Paid plans add scopes, 3D plans and video from one shared balance.');
      });
    }
    paintBilling(c);
    loadCreditHistory();
  }catch(e){ /* signed out or not provisioned yet */ }
}
refreshCredits();
window.addEventListener('rd:credits-changed', refreshCredits);

/* ---------- property Design DNA, scenarios, approval, avatar ---------- */

function miniModal(title,intro,bodyHtml,onGo,goLabel){
  let m=document.getElementById('miniModal');
  if(!m){
    m=document.createElement('div'); m.id='miniModal'; m.className='up-modal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">'
      +'<h3 id="mmTitle"></h3><p id="mmIntro"></p><div id="mmBody"></div>'
      +'<div id="mmErr" style="display:none;font-size:.78rem;color:var(--red);margin-bottom:8px"></div>'
      +'<button class="btn btn-primary btn-block" id="mmGo"></button>'
      +'<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
    (document.querySelector(".rd-app")||document.body).appendChild(m);
    m.addEventListener('click',e=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
  }
  m.querySelector('#mmTitle').textContent=title;
  m.querySelector('#mmIntro').textContent=intro;
  m.querySelector('#mmBody').innerHTML=bodyHtml;
  const err=m.querySelector('#mmErr'); err.style.display='none';
  const go=m.querySelector('#mmGo'); go.textContent=goLabel||'Save';
  const fresh=go.cloneNode(true); go.parentNode.replaceChild(fresh,go);
  fresh.addEventListener('click',async()=>{
    fresh.disabled=true;
    try{ await onGo(m); m.classList.remove('on'); }
    catch(e){ err.style.display='block'; err.textContent=(e&&e.message)||'That did not save.'; }
    fresh.disabled=false;
  });
  m.classList.add('on'); lucide.createIcons();
  return m;
}

function curProp(){ return PROP_TREE[SEL.p]||null; }
async function reloadTree(){ try{ PROP_TREE=await getPropertyTree(); }catch(e){} paintTree(); }

const dnaEditBtn=document.getElementById('dnaEdit');
if(dnaEditBtn) dnaEditBtn.addEventListener('click',()=>{
  const prop=curProp();
  if(!prop){ showAlert('Select a property in the tree first.'); return; }
  const items=(prop.dna&&prop.dna.length?prop.dna:[{label:'',color:'#E8E2D6'}]).slice(0,8);
  const rows=items.concat(Array.from({length:Math.max(0,5-items.length)},()=>({label:'',color:'#E8E2D6'})))
    .map((it,i)=>`<div class="field" style="display:flex;gap:8px;align-items:center">
      <input type="color" data-dnac="${i}" value="${it.color||'#E8E2D6'}" style="width:38px;height:32px;padding:0;border:1px solid var(--line);border-radius:6px">
      <input type="text" data-dnal="${i}" value="${(it.label||'').replace(/"/g,'&quot;')}" placeholder="White Oak LVP" style="flex:1"></div>`).join('');
  miniModal('Design DNA','These finish decisions travel with the property, so every room you design stays in the same language. Leave a line blank to drop it.',rows,async(m)=>{
    const out=[];
    m.querySelectorAll('[data-dnal]').forEach(inp=>{
      const label=(inp.value||'').trim(); if(!label) return;
      const c=m.querySelector('[data-dnac="'+inp.dataset.dnal+'"]');
      out.push({label,color:(c&&c.value)||'#E8E2D6'});
    });
    await setPropertyDna({data:{property_id:prop.id,items:out}});
    await reloadTree();
  },'Lock Design DNA');
});

const dnaCopyBtn=document.getElementById('dnaCopy');
if(dnaCopyBtn) dnaCopyBtn.addEventListener('click',()=>{
  const prop=curProp();
  if(!prop){ return; }
  const others=PROP_TREE.filter(p=>p.id!==prop.id);
  if(!others.length){ miniModal('Copy Design DNA','You only have one property so far. Save a room under a second address and you can copy this DNA onto it.','',async()=>{},'Got It'); return; }
  const body='<div class="field"><label>Copy Onto</label><select id="dnaTo">'
    +others.map(p=>`<option value="${p.id}">${p.address}</option>`).join('')+'</select></div>';
  miniModal('Copy Design DNA','The palette and finish choices locked on '+prop.address+' will replace whatever the other property has.',body,async(m)=>{
    await copyPropertyDna({data:{from_id:prop.id,to_id:m.querySelector('#dnaTo').value}});
    await reloadTree();
  },'Copy DNA');
});

const newScenarioBtn=document.getElementById('newScenario');
if(newScenarioBtn) newScenarioBtn.addEventListener('click',()=>{
  const prop=curProp(); if(!prop) return;
  const body='<div class="field"><label>Scenario Name</label><input id="scnName" type="text" placeholder="Rental Grade Pass"></div>'
    +'<div class="field"><label>Finish Grade</label><select id="scnGrade"><option value="rental">Rental Grade</option><option value="retail" selected>Retail Grade</option><option value="premium">Premium Grade</option></select></div>';
  miniModal('New Scenario','A scenario is a second run at the same property, priced at its own finish grade. Rooms you save can go under either one.',body,async(m)=>{
    const name=(m.querySelector('#scnName').value||'').trim();
    if(!name) throw new Error('Give the scenario a name.');
    await createProject({data:{property_id:prop.id,name,finish_grade:m.querySelector('#scnGrade').value}});
    await reloadTree();
  },'Create Scenario');
});

/* Studio: approve the latest saved version, and download the render on screen. */
function latestRoom(){
  const prop=curProp(); const proj=prop?prop.projects[SEL.pr]:null;
  const rooms=proj?proj.rooms.filter(r=>r.version_id):[];
  return rooms.length?rooms[rooms.length-1]:null;
}
const stApprove=document.getElementById('stApprove');
if(stApprove) stApprove.addEventListener('click',async()=>{
  const room=latestRoom();
  if(!room){ showAlert('Save a room first. Approval applies to a saved version.'); return; }
  const approved=room.status==='approved';
  stApprove.disabled=true;
  try{
    await setVersionStatus({data:{version_id:room.version_id,status:approved?'draft':'approved'}});
    await reloadTree();
    stApprove.innerHTML='<i data-lucide="check"></i>'+(approved?'Approve Latest Version':('v'+(room.version_no||1)+' Approved'));
    lucide.createIcons();
    try{ window.dispatchEvent(new CustomEvent('rd:saved')); }catch(e){}
  }catch(e){ showAlert((e&&e.message)||'Could not update that version.'); }
  stApprove.disabled=false;
});

const stDownload=document.getElementById('stDownload');
if(stDownload) stDownload.addEventListener('click',async()=>{
  const img=document.querySelector('#cAfter img');
  const src=lastRender||(img&&img.src);
  if(!src){ showAlert('Generate a design first, then download it.'); return; }
  try{
    const data=await toDataUrl(src,1600);
    const a=document.createElement('a');
    a.href=data; a.download='real-designs-'+Date.now()+'.jpg';
    document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ showAlert('Could not prepare that image for download.'); }
});

const scSend=document.getElementById('scSend');
if(scSend) scSend.addEventListener('click',()=>{ go('present'); presModal(); });

/* Account: profile photo, stored small on the account and shown on every avatar. */
function paintAvatar(url){
  document.querySelectorAll('.av').forEach(el=>{
    if(url){ el.style.backgroundImage='url('+url+')'; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; el.dataset.hadText=el.dataset.hadText||el.textContent; el.textContent=''; }
    else { el.style.backgroundImage=''; if(el.dataset.hadText) el.textContent=el.dataset.hadText; }
  });
}
(async()=>{
  try{
    const { data:{ user } }=await supabase.auth.getUser();
    const u=user&&user.user_metadata&&user.user_metadata.avatar_data;
    if(u) paintAvatar(u);
  }catch(e){}
})();
const avPhoto=document.getElementById('avPhoto');
if(avPhoto) avPhoto.addEventListener('change',async(e)=>{
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  try{
    const data=await toDataUrl(URL.createObjectURL(file),160);
    const { error }=await supabase.auth.updateUser({ data:{ avatar_data:data } });
    if(error) throw new Error(error.message);
    paintAvatar(data);
  }catch(err){ showAlert((err&&err.message)||'Could not save that photo.'); }
});

/* ---------- website handoff ----------
   A visitor who uploaded a photo on the marketing site and then signed up
   lands here with their photo and builder choices waiting in localStorage.
   Load it straight into Studio so nothing has to be entered twice. */
(async function pickUpHandoff(){
  const KEY='rd.handoff';
  let h=null;
  try{ h=JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){ h=null; }
  try{ localStorage.removeItem(KEY); }catch(e){}
  if(!h||!h.photo) return;
  window.rdHandoffPending=true;
  if(Date.now()-(h.ts||0)>1000*60*60*24*7) return;   // stale, ignore

  try{ go('studio'); }catch(e){}
  const before=document.getElementById('cBefore');
  if(before) before.innerHTML='<img src="'+h.photo+'" alt="The space you uploaded" style="width:100%;height:100%;object-fit:cover;display:block">';

  const sp=document.querySelector('#spChips .chip[data-sp="'+(h.space||'interior')+'"]');
  if(sp){ document.querySelectorAll('#spChips .chip').forEach(x=>x.classList.remove('on')); sp.classList.add('on'); }
  const b=document.querySelector('.bchip[data-b="'+(h.budget??1)+'"]');
  if(b){ document.querySelectorAll('.bchip').forEach(x=>x.classList.remove('on')); b.classList.add('on'); }
  const sel=document.getElementById('fStyle');
  if(sel&&h.style){ const opt=[...sel.options].find(o=>o.text.toLowerCase()===String(h.style).toLowerCase()); if(opt) sel.value=opt.value; }
  const note=document.getElementById('agentNote');
  if(note&&h.notes) note.value=h.notes;

  const card=document.getElementById('canvasCard');
  if(card&&!document.getElementById('hoBanner')){
    const bn=document.createElement('div');
    bn.id='hoBanner'; bn.className='note';
    bn.innerHTML='<i data-lucide="image-up"></i><span>Loaded from the website: <b>'+esc(h.name||'your photo')+'</b>, '+
      esc(h.budgetName||'Makeover')+' intensity'+(h.style?', '+esc(h.style):'')+'. Generate when you are ready.</span>';
    card.appendChild(bn);
    lucide.createIcons();
  }

  /* Store it on the account so Save To My Projects keeps the real photo. */
  try{ window.rdPendingPhotoPath=await uploadRenderDataUrl(h.photo); }catch(e){}
})();

/* ---------- keyboard shortcuts ---------- */
(function(){
  const SC=[
    ['Navigate',[['G then D','Dashboard'],['G then P','Properties'],['G then S','Studio'],['G then I','Designs'],
      ['G then B','Scope & Budget'],['G then R','Reports'],['G then A','Account']]],
    ['Actions',[['⌘ K','Search Workspace'],['⌘ B','Collapse Or Expand Menu'],['N','New Design'],
      ['?','Keyboard Shortcuts'],['Esc','Close Menus And Dialogs']]]
  ];
  const isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
  function key(k){ return isMac?k:k.replace('⌘','Ctrl'); }
  let m=null;
  function build(){
    m=document.createElement('div'); m.id='kbdModal'; m.className='rd-modal';
    m.innerHTML='<div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">'
      +'<button class="rd-modal-x" aria-label="Close"><i data-lucide="x"></i></button>'
      +'<h3 style="margin:0 0 4px">Keyboard Shortcuts</h3>'
      +'<div class="sub" style="margin-bottom:14px">Works anywhere outside a text field.</div>'
      +SC.map(([g,rows])=>'<div class="acct-group">'+g+'</div>'
        +rows.map(([k,l])=>'<div class="rowi"><div class="rowt"><b>'+l+'</b></div><kbd class="kbd">'+key(k)+'</kbd></div>').join('')
      ).join('')
      +'</div>';
    (document.querySelector('.rd-app')||document.body).appendChild(m);
    m.addEventListener('click',e=>{ if(e.target===m||e.target.closest('.rd-modal-x')) close(); });
    try{ lucide.createIcons(); }catch(_){}
  }
  function open(){ if(!m) build(); m.classList.add('on'); }
  function close(){ if(m) m.classList.remove('on'); }
  window.rdShortcuts=open;
  document.querySelectorAll('[data-kbd]').forEach(b=>b.addEventListener('click',()=>{ open(); }));

  let gPending=0;
  const GO={d:'dash',p:'props',s:'studio',i:'designs',b:'scope',r:'reports',a:'account'};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ close(); return; }
    const t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='b'){ e.preventDefault(); const tg=document.getElementById('sideToggle'); if(tg) tg.click(); return; }
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const k=e.key.toLowerCase();
    if(Date.now()<gPending&&GO[k]){ gPending=0; e.preventDefault(); go(GO[k]); return; }
    if(k==='g'){ gPending=Date.now()+1400; return; }
    gPending=0;
    if(e.key==='?'){ e.preventDefault(); open(); return; }
    if(k==='n'){ e.preventDefault(); go('studio'); }
  });
})();

  } catch (e) { console.error(e); }

  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
