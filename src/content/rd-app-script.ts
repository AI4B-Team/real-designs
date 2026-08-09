// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { priceScopePreview } from "@/lib/estimator-preview.functions";
import { detectChanges } from "@/lib/change-detect.functions";
import { estimateDimensions } from "@/lib/dimensions.functions";
import { getMyCredits, listCreditHistory } from "@/lib/credits.functions";
import { saveEstimate, listSavedEstimates, deleteSavedEstimate, getWorkspaceSummary, getPropertyTree } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { uploadRoomPhoto, roomPhotoUrl, isStoredPhoto } from "@/lib/room-photos";
import { listPresentations, createPresentation, deletePresentation } from "@/lib/presentations.functions";

export function initApp(): () => void {
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
team:['Team','Unlimited seats on Pro and above'],settings:['Settings','Brand kit, defaults and integrations'],
account:['Account','Profile, security, subscription and billing'],
help:['Help Center','Guides, answers and support'],
tutorials:['Tutorials','Short walkthroughs, five minutes or less'],
notifications:['Notifications','Activity, mentions and alerts']};
const ACCT_ALIAS={team:'team',settings:'brand',billing:'billing',invoices:'invoices'};
function go(v){
  if(ACCT_ALIAS[v]){ const pane=ACCT_ALIAS[v]; v='account'; setTimeout(()=>acctPane(pane),0); }
  document.querySelectorAll('.nav-i').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  if(!titles[v]) return;
  const t1=document.getElementById('pgTitle'); if(t1) t1.innerHTML=titles[v][0];
  const t2=document.getElementById('pgCrumb'); if(t2) t2.innerHTML=titles[v][1];

  window.scrollTo({top:0});
}


document.querySelectorAll('.nav-i').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));

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
    SEL={p:r.pi,pr:r.pri};
    closeSchRes(); if(schInput) schInput.value='';
    go(r.design?'designs':'props'); paintTree();
  }));
}
function updateSearchMeta(){
  if(!schMenu) return;
  const rooms=PROP_TREE.reduce((n,p)=>n+p.projects.reduce((m,pr)=>m+pr.rooms.length,0),0);
  const designs=PROP_TREE.reduce((n,p)=>n+p.projects.reduce((m,pr)=>m+pr.rooms.reduce((k,r)=>k+r.versions,0),0),0);
  const set=(sc,v)=>{const b=schMenu.querySelector('[data-scope="'+sc+'"] .mv'); if(b) b.textContent=String(v);};
  set('Properties',PROP_TREE.length); set('Rooms',rooms); set('Designs',designs);
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
}




/* ---------- account page ---------- */
const notifs=[['Client Opens A Presentation Link','Email and in app','On'],
['Design Finishes Rendering','In app only','On'],
['Scope Exceeds The Target Band','Email and in app','On'],
['Teammate Comments On A Design','Email','On'],
['Monthly Usage Report','Email, first of the month','On'],
['Product And Feature Updates','Email','Off']];
document.getElementById('notifRows').innerHTML=notifs.map(([n,d,st])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div>
<span class="pill ${st==='On'?'p-ok':'p-gray'}">${st}</span></div>`).join('');

const invoices=[['Jul 28, 2026','Pro Monthly','$25.00'],['Jun 28, 2026','Pro Monthly','$25.00'],
['May 28, 2026','Pro Monthly','$25.00'],['Apr 28, 2026','Pro Monthly','$25.00'],
['Mar 28, 2026','Starter Monthly','$79.00'],['Feb 28, 2026','Starter Monthly','$79.00']];
document.getElementById('invRows').innerHTML=invoices.map(([d,p,a])=>`
<tr><td><b>${d}</b></td><td>${p}</td><td class="n">${a}</td>
<td style="text-align:right"><button class="btn btn-ghost btn-xs">PDF</button></td></tr>`).join('');

const PANE_META={profile:['Profile','How you appear to teammates and clients'],
security:['Security','Password, two factor and active sessions'],
notifs:['Notifications','What we email and push to you'],
billing:['Subscription','Plan, usage and payment method'],
invoices:['Invoices','Receipts for the last six months'],
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

async function loadDashboard(){
  const rl=document.getElementById('recentList'), al=document.getElementById('attnList'), bt=document.getElementById('budgetTable');
  if(!rl||!al||!bt) return;
  let s;
  try{ s=await getWorkspaceSummary(); }
  catch(e){
    rl.innerHTML=empty('Could not load your workspace','Sign in again, then refresh this page');
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
    rl.innerHTML=empty('No designs yet','Upload a photo in Studio, price it, then save it');
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
    if(p.priced<p.rooms) attn.push([p.rooms-p.priced+' '+(p.rooms-p.priced===1?'room needs':'rooms need')+' pricing',p.address+' &middot; '+p.project_name,'p-amb','Price It']);
    if(p.budget_target&&p.high>p.budget_target) attn.push(['Scope exceeds target by '+kfmt(p.high-p.budget_target),p.address+' &middot; '+p.project_name,'p-red','Review']);
  });
  al.innerHTML=attn.length?attn.slice(0,5).map(([t,sub,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${t}</b><span>${sub}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('')
    :empty('Nothing needs your attention','Priced rooms inside target will stay quiet here');

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
loadDashboard();
window.addEventListener('rd:saved', loadDashboard);


/* ---------- properties: real owned hierarchy ---------- */
const RT_ICON=(t)=>{const s=String(t||'').toLowerCase();
  if(s.includes('kitchen'))return 'chef-hat'; if(s.includes('bath'))return 'bath';
  if(s.includes('bed'))return 'bed'; if(s.includes('exterior')||s.includes('elevation')||s.includes('yard'))return 'home';
  if(s.includes('office'))return 'lamp-desk'; return 'sofa';};
let PROP_TREE=[], SEL={p:0,pr:0};

async function paintRooms(){
  const rc=document.getElementById('roomCards'); if(!rc) return;
  const prop=PROP_TREE[SEL.p]||null, proj=prop?(prop.projects[SEL.pr]||null):null;
  const t=document.getElementById('propTitle'), sub=document.getElementById('propSub'), rs=document.getElementById('roomsSub');
  if(t) t.textContent=prop?prop.address:'No property selected';
  if(sub) sub.textContent=prop&&proj
    ? proj.name+' \u00b7 '+proj.rooms.length+(proj.rooms.length===1?' room':' rooms')+' \u00b7 '+proj.rooms.reduce((n,r)=>n+r.versions,0)+' versions'
    : 'Save a room in Studio to build your property tree';
  if(rs) rs.textContent=proj?('Rooms saved under '+proj.name):'Rooms saved under the selected project';
  const dna=document.getElementById('dnaRow');
  if(dna){
    if(dna.dataset.orig===undefined) dna.dataset.orig=dna.innerHTML;
    dna.innerHTML=(prop&&prop.has_dna)?dna.dataset.orig
      :'<span style="font-size:.79rem;color:var(--mute-2)">No Design DNA locked for this property yet.</span>';
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
}

function paintTree(){
  const el=document.getElementById('tree'); if(!el) return;
  if(!PROP_TREE.length){
    el.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No properties yet. Saving a room in Studio creates one.</p>';
    paintRooms(); return;
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

const gsteps=['Reading room geometry','Applying object locks','Fitting design to budget band','Selecting retail grade finishes','Rendering variants','Pricing the scope'];
let busy=false;
document.getElementById('genBtn').addEventListener('click',()=>{
  if(busy)return;busy=true;
  const ov=document.getElementById('cGen'),bar=document.getElementById('cBar'),st=document.getElementById('cStep');
  ov.classList.add('on');bar.style.width='0%';st.textContent=gsteps[0];
  let p=0,i=0;
  const t=setInterval(()=>{
    p+=Math.random()*12+6;
    if(p>=100){p=100;clearInterval(t);setTimeout(()=>{ov.classList.remove('on');busy=false;
      cRng.value=100;setC(100);
      setTimeout(()=>{let v=100;const b2=setInterval(()=>{v-=2.6;cRng.value=v;setC(v);if(v<=44)clearInterval(b2)},20)},600);
    },340)}
    bar.style.width=Math.min(p,100)+'%';
    if(p>(i+1)*(100/gsteps.length)&&i<gsteps.length-1){i++;st.textContent=gsteps[i]}
  },210);
});

async function paintVersions(){
  const el=document.getElementById('verList'); if(!el) return;
  let list=[];
  try{ list=await listSavedEstimates(); }catch(e){ list=[]; }
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
    g.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">'+(all.length?'No designs in this tab yet.':'No designs yet. Upload a photo in Studio, price it, then save it.')+'</p>';
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
<div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-ghost btn-xs" style="flex:1" data-goto="studio">Open</button>
<button class="btn btn-ghost btn-xs" data-goto="scope"><i data-lucide="calculator"></i></button></div></div></div>`;
  }).join('');
  lucide.createIcons();
  g.querySelectorAll('[data-photo]').forEach(async(img)=>{
    const p=img.getAttribute('data-photo'); if(!p) return;
    const url=isStoredPhoto(p)?await roomPhotoUrl(p):p;
    if(url){ img.src=url; img.hidden=false; }
  });
  g.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
}
const DFILT=['all','approved','review','archived'];
document.querySelectorAll('#designTabs button').forEach((b,i)=>b.addEventListener('click',()=>{
  document.querySelectorAll('#designTabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  DESIGN_FILTER=DFILT[i]||'all'; paintDesigns();
}));


/* ---------- batch ---------- */
function paintBatch(){
  const sel=document.getElementById('batchProp'), list=document.getElementById('batchList');
  if(!sel||!list) return;
  if(!PROP_TREE.length){
    sel.innerHTML='<option value="">No properties yet</option>';
    list.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">Add a property and upload room photos to build a batch.</p>';
    return;
  }
  const keep=sel.value;
  sel.innerHTML=PROP_TREE.map(p=>`<option value="${p.id}">${p.address}</option>`).join('');
  if(keep) sel.value=keep;
  const prop=PROP_TREE.find(p=>p.id===sel.value)||PROP_TREE[0];
  sel.value=prop.id;
  const rooms=[]; prop.projects.forEach(pr=>pr.rooms.forEach(r=>rooms.push(r)));
  const sub=document.getElementById('batchSub');
  if(sub) sub.textContent=rooms.length?(rooms.length+(rooms.length===1?' room':' rooms')+' on file'):'No rooms on this property yet';
  list.innerHTML=rooms.length
    ? rooms.map(r=>{
        const done=(r.versions||0)>0;
        return `<div class="rowi"><div class="rowt"><b>${r.name}</b><span>${done?('v'+(r.version_no||1)+' saved'):'no design yet'}</span></div>
          <span class="pill ${done?'p-ok':'p-gray'}">${done?'Designed':'Not Started'}</span></div>`;
      }).join('')
    : '<p style="font-size:.79rem;color:var(--mute-2)">No rooms on this property yet.</p>';
}
const batchProp=document.getElementById('batchProp');
if(batchProp) batchProp.addEventListener('change',paintBatch);
const batchRun=document.getElementById('batchRun');
if(batchRun) batchRun.addEventListener('click',()=>upgradeModal('Batch Runs Are Not Live Yet',
  'Batch staging runs every room of a property through one locked direction. It is in development. For now, design rooms one at a time in Studio.'));

/* ---------- scope: live pricing from the cost database ---------- */
const SCOPE_ITEMS=[{label:'demolition'},{label:'flooring',material:'lvp'},{label:'wall_paint',material:'paint'},
{label:'baseboard'},{label:'recessed_light',qty:6},{label:'light_fixture',qty:2},{label:'interior_door',qty:2}];
const money=(n)=>'$'+Math.round(n).toLocaleString('en-US');
const scopeRowsEl=document.getElementById('scopeRows');
let scopeMarkets=[];
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
    const [before,after]=await Promise.all([toDataUrl(PHOTOS.before,900),toDataUrl(PHOTOS.after,900)]);
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
    const image=await toDataUrl(PHOTOS.before,900);
    const r=await estimateDimensions({data:{image,room_type:'living room'}});
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
<div class="head"><div><h1>Contractor Brief</h1><div class="meta">206 N MacDill Ave &middot; Living Room v4 &middot; ${esc(r.grade[0].toUpperCase()+r.grade.slice(1))} Grade</div></div>
<div class="meta" style="text-align:right">REAL DESIGNS<br>${esc(r.market.name)}<br>${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>
<div class="photos"><figure><img src="${PHOTOS.before}"><figcaption>Existing Condition</figcaption></figure>
<figure><img src="${PHOTOS.after}"><figcaption>Proposed Design</figcaption></figure></div>
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


/* ---------- products ---------- */
const prodGridEl=document.getElementById('prodGrid');
if(prodGridEl) prodGridEl.innerHTML='<div class="card" style="grid-column:1/-1"><div class="card-b">'+
  '<b style="display:block;margin-bottom:5px">Item Level Product Matching Is In Development</b>'+
  '<span style="font-size:.8rem;color:var(--mute-2)">Until it ships, the materials allowance above is built from your priced scope, so the money side stays real. Shoppable furniture and fixture matches will land here.</span>'+
  '</div></div>';

/* ---------- presentations ---------- */
const pkg=[['Before And After Slider','In the client approval link','p-ok','Live'],
['Scope Of Work And Budget','Line items and range in the link','p-ok','Live'],
['Client Decision Capture','Approve or request changes, tracked','p-ok','Live'],
['Product Board','Every item with price and link','p-gray','Planned'],
['Branded PDF Export','Print ready package','p-gray','Planned'],
['Social Reel, 9x16','Cross fade before to after, 12 seconds','plan-pill lvl-pro','PRO'],
['Walkthrough Video','Dolly in, 20 seconds','plan-pill lvl-studio','STUDIO']];
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

async function paintPresentations(){
  const el=document.getElementById('linkList'); if(!el) return;
  try{ PRES_ROWS=await listPresentations(); }
  catch(e){ PRES_ROWS=[]; }
  if(!PRES_ROWS.length){
    el.innerHTML='<p style="font-size:.79rem;color:var(--mute-2)">No client links yet. Save a room in Studio, then use New Link to share it for approval.</p>';
    return;
  }
  el.innerHTML=PRES_ROWS.map(r=>{
    const [cls,lab]=PRES_STATUS[r.status]||PRES_STATUS.sent;
    const who=r.client_name?('Sent to '+r.client_name):'No recipient named';
    const seen=r.view_count?(r.view_count===1?'opened once':'opened '+r.view_count+' times'):'not opened';
    return `<div class="rowi" data-pid="${r.id}" data-tok="${r.token}">
      <div class="rowt"><b>${r.title}</b><span>${who} &middot; ${seen} &middot; ${presAgo(r.last_viewed_at||r.created_at)}</span></div>
      <span class="pill ${cls}">${lab}</span>
      <button class="icon-btn" data-copy title="Copy link"><i data-lucide="copy"></i></button>
      <button class="icon-btn" data-del title="Delete link"><i data-lucide="trash-2"></i></button></div>`;
  }).join('');
  lucide.createIcons();
}

const linkList=document.getElementById('linkList');
if(linkList) linkList.addEventListener('click',async e=>{
  const row=e.target.closest('[data-pid]'); if(!row) return;
  if(e.target.closest('[data-copy]')){
    const url=presLink(row.dataset.tok);
    try{ await navigator.clipboard.writeText(url); }catch(_){}
    const pill=row.querySelector('.pill'); const old=pill.textContent;
    pill.textContent='Link Copied'; setTimeout(()=>{pill.textContent=old;},1400);
    return;
  }
  if(e.target.closest('[data-del]')){
    try{ await deletePresentation({data:{id:row.dataset.pid}}); }catch(_){}
    paintPresentations();
  }
});

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
    document.body.appendChild(m);
    m.addEventListener('click',e=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
    m.querySelector('#plGo').addEventListener('click',async ()=>{
      const err=m.querySelector('#plErr'), out=m.querySelector('#plOut'), go=m.querySelector('#plGo');
      const version_id=m.querySelector('#plVer').value;
      const title=(m.querySelector('#plTitle').value||'').trim();
      if(!version_id){ err.style.display='block'; err.textContent='Save a room in Studio first, then come back.'; return; }
      if(!title){ err.style.display='block'; err.textContent='Give the package a title your client will recognise.'; return; }
      err.style.display='none'; go.disabled=true;
      try{
        const res=await createPresentation({data:{version_id,title,
          client_name:(m.querySelector('#plName').value||'').trim()||undefined,
          client_email:(m.querySelector('#plMail').value||'').trim()||undefined}});
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
  list.innerHTML=`<div class="seat"><span class="av">${av}</span><div class="rowt"><b>${name}</b><span>${mail||'Signed in'}</span></div>
    <span class="pill p-ink">Owner</span></div>
    <p style="font-size:.79rem;color:var(--mute-2);margin:10px 0 0">Extra seats and invitations are in development. Everything in this workspace belongs to your account today.</p>`;

  const rows=document.getElementById('usageRows');
  if(rows){
    let designs=0, scopes=0;
    try{
      const hist=await listCreditHistory();
      hist.forEach(h=>{ if(h.action==='design') designs++; if(h.action==='scope') scopes++; });
    }catch(_){}
    rows.innerHTML=`<tr><td><b>${name}</b></td><td>Owner</td><td class="n">${designs}</td><td class="n">${scopes}</td><td class="n">Now</td></tr>`;
  }
  lucide.createIcons();
}
paintTeam();
window.addEventListener('rd:credits-changed',()=>paintTeam());

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
const HELP_POP=['Getting Started','Uploading Photos','Reality Lock','Scope Accuracy','Client Links','Billing'];
document.getElementById('helpPop').innerHTML=HELP_POP.map(t=>`<span class="chip">${t}</span>`).join('');
document.getElementById('helpQuick').innerHTML=[
 ['1','Add Your First Property','Drop in an address, upload room photos, and we build the room list for you.'],
 ['2','Design A Room','Pick a direction, lock the structure, and generate versions until one lands.'],
 ['3','Send A Client Link','Package approved rooms with the scope and share one link for approval.']]
 .map(([n,t,b])=>`<div class="qs-card"><span class="n">STEP ${n}</span><b>${t}</b><span>${b}</span></div>`).join('');

const HELP_CATS=[
 ['rocket','Getting Started',[['image-up','Upload Room Photos'],['map-pin','Add A Property'],['wand-sparkles','Your First Design'],['list-checks','Room Checklist']]],
 ['palette','Designing',[['lock','Reality Lock Explained'],['layers','Style Directions'],['history','Version History'],['images','Listing Batch Mode']]],
 ['calculator','Scope & Budget',[['dollar-sign','How Pricing Is Built'],['sliders-horizontal','Budget Bands'],['shopping-bag','Product Tiers'],['map','Market Labor Rates']]],
 ['share-2','Client Delivery',[['presentation','Building Presentations'],['link','Client Approval Links'],['bell','Open And View Alerts'],['download','Exports And Watermarks']]],
 ['users','Team & Workspace',[['user-plus','Inviting Members'],['shield','Roles And Permissions'],['building','Brand Kit'],['plug','Integrations']]],
 ['credit-card','Billing',[['gauge','Design Credits'],['credit-card','Plans And Pricing'],['receipt','Invoices And Receipts'],['refresh-ccw','Upgrades And Downgrades']]]];
const helpCatsEl=document.getElementById('helpCats');
function renderCats(q){
  const s=(q||'').trim().toLowerCase();
  const list=HELP_CATS.map(([ic,name,arts])=>[ic,name,arts.filter(a=>!s||a[1].toLowerCase().includes(s)||name.toLowerCase().includes(s))]).filter(c=>c[2].length);
  helpCatsEl.innerHTML=list.length?list.map(([ic,name,arts])=>`<div class="card"><div class="card-b">
    <div class="help-cat"><i data-lucide="${ic}"></i>${name}</div>
    ${arts.map(([ai,label])=>`<button class="help-a"><i data-lucide="${ai}"></i>${label}</button>`).join('')}
  </div></div>`).join(''):`<div class="card"><div class="card-b sub">No articles match that search.</div></div>`;
  lucide.createIcons();
}
const HELP_FAQ=[
 ['Do The Designs Change The Structure Of The Room?','No. Reality Lock holds walls, windows, ceiling lines and floor plane in place, so every version is buildable in the same space.'],
 ['How Accurate Is The Scope?','Scopes are built from approved designs using current market labor rates and real product pricing, and land inside the stated band on most projects.'],
 ['Can I Upload My Own Photos?','Yes. Any straight-on room photo works. Better light and a wider angle produce better versions.'],
 ['Can Clients Comment Instead Of Approving?','Yes. Client links accept comments per room, and you get notified the moment a link is opened.'],
 ['What Happens When I Hit My Design Limit?','Nothing is deleted. New generations pause until the cycle resets or you upgrade, and existing work stays available.'],
 ['Can I Remove The Watermark?','Paid plans export without a watermark, or you can swap it for your own logo in Settings.']];
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

/* ---------- tutorials ---------- */
const TUTS=[['Add Your First Property','2 Minutes',PHOTOS.craftsman,'Getting Started'],
['Upload Photos That Render Well','3 Minutes',PHOTOS.before,'Getting Started'],
['Reality Lock In Practice','4 Minutes',PHOTOS.after,'Designing'],
['Choosing A Style Direction','3 Minutes',PHOTOS.japandi,'Designing'],
['Staging A Whole Listing','5 Minutes',PHOTOS.neutral,'Listing Batch'],
['Building A Scope And Budget','4 Minutes',PHOTOS.kitchen,'Scope'],
['Swapping Product Tiers','2 Minutes',PHOTOS.luxury,'Products'],
['Sending A Client Link','3 Minutes',PHOTOS.coastal,'Delivery'],
['Reading Approval Analytics','90 Seconds',PHOTOS.midcentury,'Delivery']];
document.getElementById('tutGrid').innerHTML=TUTS.map(([t,len,img,tag])=>`<div class="tut-card">
  <div class="tut-thumb">${photo(img,t)}<div class="tut-play"><span><i data-lucide="play"></i></span></div><div class="tut-len">${len}</div></div>
  <div class="tut-b"><b>${t}</b><span>${tag}</span></div></div>`).join('');
document.getElementById('tutPaths').innerHTML=[['Agent Fast Track','4 videos &middot; 11 minutes'],['Investor Scope Deep Dive','5 videos &middot; 18 minutes'],
['Team Lead Setup','3 videos &middot; 9 minutes']].map(([n,m])=>`<div class="rowi"><div class="rowt"><b>${n}</b><span>${m}</span></div>
<button class="btn btn-ghost btn-xs"><i data-lucide="play"></i>Start</button></div>`).join('');

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
function openFb(){ document.getElementById('fbForm').hidden=false; document.getElementById('fbDone').hidden=true;
  document.getElementById('fbBody').value=''; document.getElementById('fbFile').hidden=true;
  document.querySelectorAll('#fbCats .fb-cat').forEach(x=>x.classList.remove('on'));
  fbModal.classList.add('on'); lucide.createIcons(); }
function closeFb(){ fbModal.classList.remove('on'); }
document.getElementById('fbBtn').addEventListener('click',()=>{closeHelp();openFb()});
document.getElementById('helpFbBtn').addEventListener('click',openFb);
document.getElementById('fbClose').addEventListener('click',closeFb);
document.getElementById('fbDoneClose').addEventListener('click',closeFb);
fbModal.addEventListener('click',e=>{ if(e.target===fbModal) closeFb(); });
document.getElementById('fbAttach').addEventListener('click',()=>{
  const f=document.getElementById('fbFile'); f.hidden=false; f.textContent='screenshot-2026-08-06.png';
});
document.getElementById('fbSend').addEventListener('click',()=>{
  const b=document.getElementById('fbBody');
  if(b.value.trim().length<3){ b.focus(); b.style.borderColor='var(--red)'; return; }
  b.style.borderColor=''; document.getElementById('fbForm').hidden=true; document.getElementById('fbDone').hidden=false; lucide.createIcons();
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
        t:v.room_name+' v'+(v.version_no||1)+(v.status==='approved'?' approved':' saved'),
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
    const c=await getMyCredits();
    if(c&&c.plan!=='free'&&c.balance<=20)
      out.push({id:'low:'+c.balance, ic:'triangle-alert', cat:'billing', t:'Credits running low',
        b:c.balance+' credits left on your '+c.plan+' plan.', at:new Date().toISOString(), tm:'now'});
  }catch(e){}
  out.sort((a,b)=>new Date(b.at)-new Date(a.at));
  NOTIFS=out.slice(0,20).map(n=>({...n, unread:!read.has(n.id)}));
  renderNotifs();
}
function notifFilter(tab){ return NOTIFS.filter(n=> tab==='all'?true: tab==='unread'?n.unread: n.cat===tab); }
function notifRow(n){ return `<button class="notif-i${n.unread?' unread':''}" data-nid="${n.id}">
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
  if(inMenu){ closeNotif(); go('notifications'); }
  renderNotifs();
});
['notifRead','notifReadAll'].forEach(id=>{ const b=document.getElementById(id);
  if(b) b.addEventListener('click',e=>{e.stopPropagation();notifMarkRead(NOTIFS.map(n=>n.id));renderNotifs();}); });
buildNotifs();
window.addEventListener('rd:saved', buildNotifs);
window.addEventListener('rd:credits-changed', buildNotifs);

const prefsEl=document.getElementById('notifPrefs');
if(prefsEl) prefsEl.innerHTML=[['Design approvals','Email + In app'],['Client comments','Email + In app'],['Batch renders','In app'],
 ['Scope changes','In app'],['Team activity','Weekly digest'],['Billing and invoices','Email']]
 .map(([t,v])=>`<div class="seat"><div class="rowt"><b>${t}</b><span>${v}</span></div><span class="pill">On</span></div>`).join('');
renderNotifs();

/* ---------- studio: tool rows with plan badges ---------- */
const toolRows = Array.from(document.querySelectorAll('.toolrow'));
const toolInfo = document.getElementById('toolInfo');
toolRows.forEach((r) => r.addEventListener('click', () => {
  toolRows.forEach((x) => x.classList.remove('on'));
  r.classList.add('on');
  const plan = r.getAttribute('data-plan');
  if (plan && toolInfo) {
    document.getElementById('toolInfoName').textContent =
      r.getAttribute('data-tool') + ' is on the ' + (plan === 'pro' ? 'Pro' : 'Studio') + ' plan';
    document.getElementById('toolInfoDesc').textContent = r.getAttribute('data-desc');
    toolInfo.hidden = false;
  } else if (toolInfo) {
    toolInfo.hidden = true;
  }
}));

/* ---------- studio: canvas dark / light surround ---------- */
const canvasCard = document.getElementById('canvasCard');
const canvasThemeBtn = document.getElementById('canvasTheme');
if (canvasCard && canvasThemeBtn) {
  canvasThemeBtn.addEventListener('click', () => {
    const dark = canvasCard.classList.toggle('dark');
    canvasThemeBtn.setAttribute('aria-pressed', String(dark));
    canvasThemeBtn.querySelector('b').textContent = dark ? 'Dark' : 'Light';
  });
}

/* ---------- accounts: signed-in identity + saved projects ---------- */
const initials=(s)=>s.split(/[.@\s_-]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'RD';
const $id=(x)=>document.getElementById(x);
supabase.auth.getUser().then(({data})=>{
  const u=data&&data.user; if(!u) return;
  const m=u.user_metadata||{};
  const name=m.full_name||m.name||u.email.split('@')[0];
  const av=initials(name);
  document.querySelectorAll('.acct-btn .av,.acct-head .av,.apane .av').forEach(e=>e.textContent=av);
  const head=document.querySelector('.acct-head b'); if(head) head.textContent=name;
  const mail=document.querySelector('.acct-head div span'); if(mail) mail.textContent=u.email;
  const n=$id('pfName'); if(n) n.value=name;
  const ph=$id('pfPhone'); if(ph) ph.value=m.phone||'';
  const em=$id('pfEmail'); if(em) em.value=u.email;
  const co=$id('pfCompany'); if(co) co.value=m.company||'';
  const ro=$id('pfRole'); if(ro&&m.role) ro.value=m.role;
  const se=$id('secEmail'); if(se) se.textContent=u.email;
}).catch(()=>{});

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
    document.querySelectorAll('.acct-btn .av,.acct-head .av,.apane .av').forEach(e=>e.textContent=av);
    const head=document.querySelector('.acct-head b'); if(head) head.textContent=name;
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
        before_path:uploadPath||PHOTOS.before,
        after_path:uploadPath?null:PHOTOS.after,
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
    {k:'saved',t:'Save Your First Room',b:'Store the photo, property and priced scope on your account.',i:'save',cta:'Save Room'}
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
  const state=(()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ return {}; } })();
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} };
  if(state.done){ card.remove(); return; }

  /* already worked in this account? then there is nothing to onboard */
  try{
    const list=await listSavedEstimates();
    if(list&&list.length){ state.done=true; save(); card.remove(); return; }
  }catch(e){}
  card.hidden=false;


  function act(k){
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
      setTimeout(()=>{ card.remove(); },2400);
    }
  }
  render();

  document.getElementById('onbHide').addEventListener('click',()=>{ state.done=true; save(); card.remove(); });
  ['photo','priced','saved'].forEach(k=>window.addEventListener('rd:'+k,()=>{ if(!state[k]){ state[k]=true; save(); render(); } }));

  /* welcome once per account */
  if(!state.welcomed){
    state.welcomed=true; save();
    document.querySelectorAll('#onbModal').forEach(n=>n.remove());
    const m=document.createElement('div'); m.className='up-modal on'; m.id='onbModal';
    m.innerHTML='<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">'
      +'<h3>Welcome To REAL DESIGNS</h3>'
      +'<p>Three steps take you from a room photo to a priced, contractor ready scope. Your checklist is on the dashboard.</p>'
      +'<div class="up-costs">'+STEPS.map((s,n)=>'<div class="up-cost"><b>'+(n+1)+'. '+s.t+'</b><span>'+s.b+'</span></div>').join('')+'</div>'
      +'<div class="up-act"><button class="btn btn-primary" id="onbStart">Start With A Photo</button>'
      +'<button class="btn btn-ghost" data-close>Look Around First</button></div></div>';
    document.body.appendChild(m);
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
    document.body.appendChild(m);
    m.addEventListener('click',(e)=>{ if(e.target.hasAttribute&&e.target.hasAttribute('data-close')) m.classList.remove('on'); });
    m.querySelector('#upGo').addEventListener('click',()=>{
      m.classList.remove('on');
      const b=document.querySelector('[data-goto="account"]'); if(b) b.click();
      const rail=document.querySelector('[data-pane="billing"]'); if(rail) rail.click();
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

async function refreshCredits(){
  const lab=document.getElementById('credLab'); if(!lab) return;
  const box=lab.closest('.credit-box'); const bar=box&&box.querySelector('.meter i');
  const foot=box&&box.querySelectorAll('.lab')[1];
  try{
    const c=await getMyCredits();
    const title=box&&box.querySelector('.lab span');
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


  } catch (e) { console.error(e); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
