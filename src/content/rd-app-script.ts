// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { priceScopePreview } from "@/lib/estimator-preview.functions";
import { detectChanges } from "@/lib/change-detect.functions";
import { estimateDimensions } from "@/lib/dimensions.functions";
import { getMyCredits, listCreditHistory } from "@/lib/credits.functions";
import { saveEstimate, listSavedEstimates, deleteSavedEstimate } from "@/lib/workspace.functions";
import { supabase } from "@/integrations/supabase/client";
import { uploadRoomPhoto, roomPhotoUrl, isStoredPhoto } from "@/lib/room-photos";

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
const titles={dash:['Dashboard','Real Advisors &middot; 6 active properties'],props:['Properties','Property, project, room, version'],
studio:['Studio','206 N MacDill Ave &middot; Living Room &middot; v5 draft'],designs:['Designs','248 designs across 6 properties'],
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

/* ---------- search scope menu ---------- */
const schBtn=document.getElementById('schBtn'),schMenu=document.getElementById('schMenu');
const schInput=document.querySelector('.search input');
function closeSch(){ if(schMenu){schMenu.classList.remove('on'); schBtn.setAttribute('aria-expanded','false');} }
if(schBtn&&schMenu){
  schBtn.addEventListener('click',e=>{
    e.stopPropagation(); closeAcct();
    const open=!schMenu.classList.contains('on');
    schMenu.classList.toggle('on',open); schBtn.setAttribute('aria-expanded',String(open));
  });
  schMenu.addEventListener('click',e=>{
    const it=e.target.closest('.acct-i'); if(!it) return;
    const sc=it.dataset.scope;
    if(sc&&schInput) schInput.setAttribute('placeholder', sc==='All'?'Search properties, rooms, designs':'Search '+sc.toLowerCase());
    closeSch();
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.search-wrap')) closeSch(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSch(); });
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



/* ---------- dashboard ---------- */
const recent=[['Living Room v4','206 N MacDill &middot; Warm Minimal','after','warm','p-ok','Approved'],
['Kitchen v7','206 N MacDill &middot; Warm Minimal','after','kitchen','p-ok','Approved'],
['Primary Bath v2','206 N MacDill &middot; Warm Minimal','after','coastal','p-amb','In Review'],
['Backyard v1','1412 E Idlewild &middot; Resort','after','green','p-blue','New'],
['Front Elevation v3','8809 N Ola Ave &middot; Painted Brick','before','warm','p-gray','Draft']];
document.getElementById('recentList').innerHTML=recent.map(([t,s,m,p,cls,lab])=>`
<div class="rowi"><div class="thumb">${room(m,PALS[p])}</div>
<div class="rowt"><b>${t}</b><span>${s}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('');

const attn=[['Client Link Opened 3 Times, No Decision','Keisha C. &middot; 1412 E Idlewild &middot; 2 days','p-amb','Follow Up'],
['Kitchen v7 Scope Exceeds Target By $4.2K','206 N MacDill &middot; Renovation band','p-red','Review'],
['4 Photos Missing Disclosure Label','8809 N Ola Ave &middot; batch paused','p-red','Fix'],
['Comp Set Is 94 Days Old','1412 E Idlewild &middot; ARV confidence dropped','p-amb','Refresh'],
['Primary Bath v2 Awaiting Your Approval','206 N MacDill &middot; 5 hours','p-blue','Open']];
document.getElementById('attnList').innerHTML=attn.map(([t,s,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${t}</b><span>${s}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('');

const budgets=[['206 N MacDill Ave','Retail Flip',4,'$62,000','$58.4K to $71.2K','p-amb','Tight'],
['206 N MacDill Ave','Rental Scenario',4,'$38,000','$29.1K to $34.8K','p-ok','Within'],
['1412 E Idlewild Ave','Retail Flip',6,'$104,000','$96.2K to $118.4K','p-amb','Tight'],
['8809 N Ola Ave','Wholetail',3,'$21,000','$14.8K to $19.6K','p-ok','Within'],
['3320 W Cypress St','Retail Flip',5,'$88,000','$102.4K to $126.9K','p-red','Over']];
document.getElementById('budgetTable').innerHTML=budgets.map(([p,s,r,t,rg,cls,lab])=>`
<tr><td><b>${p}</b></td><td>${s}</td><td>${r}</td><td class="n">${t}</td><td class="n">${rg}</td>
<td style="text-align:right"><span class="pill ${cls}">${lab}</span></td></tr>`).join('');

/* ---------- properties ---------- */
const tree=[[1,'map-pin','206 N MacDill Ave','DNA Locked',true],[2,'folder','Retail Flip, Q3','4 rooms',false],
[3,'sofa','Living Room','v4',false],[3,'chef-hat','Kitchen','v7',false],[3,'bath','Primary Bath','v2',false],
[3,'home','Front Elevation','v1',false],[2,'folder','Rental Scenario','4 rooms',false],[3,'sofa','Living Room','v2',false],
[1,'map-pin','1412 E Idlewild Ave','DNA Locked',false],[2,'folder','Retail Flip','6 rooms',false],
[1,'map-pin','8809 N Ola Ave','No DNA',false],[1,'map-pin','3320 W Cypress St','DNA Locked',false]];
document.getElementById('tree').innerHTML=tree.map(([l,ic,n,m,on])=>`
<div class="tr l${l} ${on?'on':''}"><i data-lucide="${ic}"></i>${n}<span class="meta">${m}</span></div>`).join('');

const rooms=[['Living Room','v4 Approved','after','warm','p-ok','$11.4K to $14.9K'],
['Kitchen','v7 Approved','after','farm','p-ok','$26.2K to $34.1K'],
['Primary Bath','v2 In Review','after','coastal','p-amb','$8.9K to $12.4K'],
['Front Elevation','v1 Approved','before','warm','p-ok','$11.9K to $16.8K']];
document.getElementById('roomCards').innerHTML=rooms.map(([n,v,m,p,cls,cost])=>`
<div class="card"><div style="aspect-ratio:8/5;background:#EFEDE8;border-radius:7px 7px 0 0;overflow:hidden">${room(m,PALS[p])}</div>
<div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
<b style="font-size:.87rem">${n}</b><span class="pill ${cls}">${v}</span></div>
<div class="mono" style="font-size:.71rem;color:var(--mute-2);margin-top:5px">${cost}</div></div></div>`).join('');

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

const vers=[['v5','Draft &middot; just now','p-gray'],['v4','Approved &middot; 2 days ago','p-ok'],
['v3','Superseded &middot; 3 days ago','p-gray'],['v2','Rejected by client &middot; 5 days','p-red'],['v1','Superseded &middot; 6 days','p-gray']];
document.getElementById('verList').innerHTML=vers.map(([v,s,cls])=>`
<div class="rowi" style="padding:9px 0"><div class="rowt"><b>${v}</b><span>${s}</span></div><span class="pill ${cls}">${cls==='p-ok'?'Live':'Past'}</span></div>`).join('');

/* ---------- designs ---------- */
const DG=[];
const rns=['Living Room','Kitchen','Primary Bath','Front Elevation','Backyard','Dining Room','Primary Bedroom','Guest Bath','Patio'];
const prs=['206 N MacDill','1412 E Idlewild','8809 N Ola','3320 W Cypress'];
const sts=[['p-ok','Approved'],['p-amb','In Review'],['p-gray','Draft']];
const pk=['warm','farm','coastal','green'];
for(let i=0;i<9;i++){
  const s=sts[i%3];
  DG.push(`<div class="card"><div style="aspect-ratio:8/5;overflow:hidden;border-radius:7px 7px 0 0;background:#EFEDE8">${room(i%4===3?'before':'after',PALS[pk[i%4]])}</div>
  <div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
  <b style="font-size:.86rem">${rns[i]} v${(i%6)+1}</b><span class="pill ${s[0]}">${s[1]}</span></div>
  <div class="mono" style="font-size:.7rem;color:var(--mute-2);margin-top:5px">${prs[i%4]} &middot; ${['$11.4K to $14.9K','$26.2K to $34.1K','$8.9K to $12.4K','$4.1K to $6.2K'][i%4]}</div>
  <div style="display:flex;gap:6px;margin-top:10px"><button class="btn btn-ghost btn-xs" style="flex:1" data-goto="studio">Open</button>
  <button class="btn btn-ghost btn-xs" data-goto="scope"><i data-lucide="calculator"></i></button></div></div></div>`);
}
document.getElementById('designGrid').innerHTML=DG.join('');
document.querySelectorAll('#designTabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#designTabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
}));

/* ---------- batch ---------- */
const batch=[['Kitchen','IMG_0412.jpg','after','kitchen','p-ok','Staged'],['Living Room','IMG_0418.jpg','after','warm','p-ok','Staged'],
['Dining Room','IMG_0422.jpg','after','warm','p-ok','Staged'],['Primary Bedroom','IMG_0427.jpg','after','coastal','p-red','Rendering'],
['Bathroom 2','IMG_0431.jpg','after','bath','p-gray','Queued'],['Backyard','IMG_0440.jpg','after','yard','p-gray','Queued']];
document.getElementById('batchList').innerHTML=batch.map(([r,f,mo,p,cls,lab])=>`
<div class="rowi"><div class="thumb">${room(mo,PALS[p])}</div><div class="rowt"><b>${r}</b><span>${f}</span></div>
<span class="pill ${cls}">${lab}</span></div>`).join('');

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
  document.getElementById('scopeSub').textContent=`206 N MacDill · Living Room v4 · ${r.grade[0].toUpperCase()+r.grade.slice(1)} Grade · ${r.market.name}`;
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
const prods=[['Low Profile Sofa, 88in','Seating','sofa','#3D4A45',['$690','$1,240','$2,480']],
['Wool Blend Area Rug, 8x10','Rugs','grip','#EAE5DB',['$210','$430','$980']],
['White Oak Coffee Table','Tables','table-2','#8A6A47',['$180','$340','$720']],
['Arc Floor Lamp, Matte Black','Lighting','lamp','#2A2A2E',['$95','$185','$420']],
['Framed Abstract, 40x30','Wall Art','frame','#C4B7A2',['$70','$145','$390']],
['Fiddle Leaf Fig, 6ft','Greenery','leaf','#4F6B4A',['$45','$110','$260']]];
document.getElementById('prodGrid').innerHTML=prods.map(([n,c,ic,bg,t])=>`
<div class="prod"><div class="im" style="background:${bg}22"><i data-lucide="${ic}"></i></div>
<div class="bd"><b>${n}</b><div class="cat">${c}</div></div>
<div class="tiers">
<button class="tier"><small>Lowest</small><b>${t[0]}</b></button>
<button class="tier on"><small>Closest</small><b>${t[1]}</b></button>
<button class="tier"><small>Premium</small><b>${t[2]}</b></button></div></div>`).join('');
document.querySelectorAll('.tier').forEach(t=>t.addEventListener('click',()=>{
  t.parentElement.querySelectorAll('.tier').forEach(x=>x.classList.remove('on'));t.classList.add('on');
}));

/* ---------- presentations ---------- */
const pkg=[['Before And After Slider','Interactive, embeds anywhere','p-ok','Ready'],
['Side By Side Comparison','PNG and PDF, branded','p-ok','Ready'],
['Color And Material Palette','One page, with product codes','p-ok','Ready'],
['Product Board','Every item with price and link','p-ok','Ready'],
['Scope Of Work And Budget','Contractor brief with signature line','p-ok','Ready'],
['Social Reel, 9x16','Cross fade before to after, 12 seconds','plan-pill lvl-pro','PRO'],
['Walkthrough Video','Dolly in, 20 seconds','plan-pill lvl-studio','STUDIO']];
document.getElementById('pkgList').innerHTML=pkg.map(([n,d,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div><span class="${cls.startsWith('plan-pill')?cls:'pill '+cls}">${lab}</span></div>`).join('');

const links=[['206 N MacDill, Full Package','Sent to Keisha C. &middot; opened 6 times','p-ok','2 Approved'],
['1412 E Idlewild, Living Room','Sent to J. Alvarez &middot; opened 3 times','p-amb','No Decision'],
['8809 N Ola, Exterior Options','Sent to M. Reyes &middot; not opened','p-gray','Pending'],
['3320 W Cypress, Kitchen','Sent to T. Boone &middot; commented twice','p-blue','Feedback']];
document.getElementById('linkList').innerHTML=links.map(([n,d,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('');

/* ---------- team ---------- */
const team=[['Dolmar Cross','Owner','DC','p-ink','Owner'],['Keisha Cross','Project Manager','KC','p-blue','Admin'],
['Marcus Tate','Acquisitions','MT','p-gray','Member'],['Ray Gutierrez','General Contractor','RG','p-gray','Member'],
['Priya Nair','Listing Agent','PN','p-gray','Member'],['Alex Boone','Photographer','AB','p-amb','Viewer']];
document.getElementById('teamList').innerHTML=team.map(([n,r,i,cls,role])=>`
<div class="seat"><span class="av">${i}</span><div class="rowt"><b>${n}</b><span>${r}</span></div>
<span class="pill ${cls}">${role}</span><button class="icon-btn"><i data-lucide="ellipsis"></i></button></div>`).join('');
document.getElementById('usageRows').innerHTML=[['Dolmar Cross','Owner',412,28,'2 min ago'],['Keisha Cross','Admin',388,19,'1 hour ago'],
['Marcus Tate','Member',201,11,'Yesterday'],['Ray Gutierrez','Member',144,22,'Yesterday'],
['Priya Nair','Member',69,3,'3 days ago'],['Alex Boone','Viewer',0,0,'2 weeks ago']]
.map(([n,r,d,s,l])=>`<tr><td><b>${n}</b></td><td>${r}</td><td class="n">${d}</td><td class="n">${s}</td><td class="n">${l}</td></tr>`).join('');

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

/* ---------- notifications ---------- */
const NOTIFS=[
 {id:1,ic:'check-circle-2',cat:'approvals',t:'Living Room v5 approved',b:'Keisha Cross approved the design for 206 N MacDill Ave.',tm:'2m',unread:true},
 {id:2,ic:'message-square',cat:'approvals',t:'Client comment on Kitchen v7',b:'"Can we see the same layout with lighter cabinets?"',tm:'18m',unread:true},
 {id:3,ic:'wand-sparkles',cat:'designs',t:'Batch render finished',b:'8 rooms staged in Warm Minimal for 1420 Bayshore Blvd.',tm:'1h',unread:true},
 {id:4,ic:'calculator',cat:'designs',t:'Scope updated',b:'Bathroom 2 estimate moved to $18,400 after tier change.',tm:'3h',unread:false},
 {id:5,ic:'user-plus',cat:'team',t:'Marcus Tate joined your workspace',b:'Invitation accepted, seat assigned as Member.',tm:'Yesterday',unread:false},
 {id:6,ic:'credit-card',cat:'billing',t:'Invoice #4192 paid',b:'Pro Plan monthly, $249.00 charged to Visa ending 4242.',tm:'2d',unread:false},
 {id:7,ic:'share-2',cat:'approvals',t:'Presentation link opened',b:'Bayshore package viewed 4 times by the client.',tm:'3d',unread:false},
 {id:8,ic:'triangle-alert',cat:'billing',t:'Credits at 61%',b:'1,214 of 2,000 credits used this cycle.',tm:'4d',unread:false}
];
function notifFilter(tab){ return NOTIFS.filter(n=> tab==='all'?true: tab==='unread'?n.unread: n.cat===tab); }
function notifRow(n){ return `<button class="notif-i${n.unread?' unread':''}" data-nid="${n.id}">
 <span class="notif-ic"><i data-lucide="${n.ic}"></i></span>
 <span class="tx"><b>${n.t}</b><span>${n.b}</span></span>
 <span class="tm">${n.tm}</span>${n.unread?'<span class="dot"></span>':''}</button>`; }
function renderNotifs(){
  const unread=NOTIFS.filter(n=>n.unread).length;
  const dot=document.getElementById('notifDot'); if(dot) dot.style.display=unread?'block':'none';
  const list=document.getElementById('notifList');
  if(list){ const t=document.querySelector('#notifTabs .notif-tab.on')?.dataset.t||'all'; const r=notifFilter(t);
    list.innerHTML=r.length?r.map(notifRow).join(''):'<div class="notif-empty">Nothing here right now.</div>'; }
  const page=document.getElementById('notifPage');
  if(page){ const t2=document.querySelector('#notifTabs2 .notif-tab.on')?.dataset.t||'all'; const r2=notifFilter(t2);
    page.innerHTML=r2.length?r2.map(notifRow).join(''):'<div class="notif-empty">Nothing here right now.</div>'; }
  const cnt=document.getElementById('notifCount');
  if(cnt) cnt.textContent=unread?unread+' unread of '+NOTIFS.length+' notifications':'All caught up, '+NOTIFS.length+' notifications';
  lucide.createIcons();
}
const notifBtn=document.getElementById('notifBtn'),notifMenu=document.getElementById('notifMenu');
function closeNotif(){ if(notifMenu){notifMenu.classList.remove('on');notifBtn.setAttribute('aria-expanded','false');} }
if(notifBtn&&notifMenu){
  notifBtn.addEventListener('click',e=>{e.stopPropagation();closeAcct();closeSch();closeHelp();
    const open=!notifMenu.classList.contains('on');notifMenu.classList.toggle('on',open);
    notifBtn.setAttribute('aria-expanded',String(open)); if(open) renderNotifs();});
  document.addEventListener('click',e=>{ if(!e.target.closest('.notif-wrap')) closeNotif(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeNotif(); });
}
document.querySelectorAll('#notifTabs .notif-tab,#notifTabs2 .notif-tab').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('.notif-tab').forEach(x=>x.classList.toggle('on',x===b)); renderNotifs();
}));
document.addEventListener('click',e=>{
  const row=e.target.closest('.notif-i'); if(!row) return;
  const inMenu=!!row.closest('#notifList');
  const n=NOTIFS.find(x=>String(x.id)===row.dataset.nid); if(n) n.unread=false;
  if(inMenu){ closeNotif(); go('notifications'); }
  renderNotifs();
});
['notifRead','notifReadAll'].forEach(id=>{ const b=document.getElementById(id);
  if(b) b.addEventListener('click',e=>{e.stopPropagation();NOTIFS.forEach(n=>n.unread=false);renderNotifs();}); });
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
supabase.auth.getUser().then(({data})=>{
  const u=data&&data.user; if(!u) return;
  const name=(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||u.email.split('@')[0];
  const av=initials(name);
  document.querySelectorAll('.acct-btn .av,.acct-head .av').forEach(e=>e.textContent=av);
  const head=document.querySelector('.acct-head b'); if(head) head.textContent=name;
  const mail=document.querySelector('.acct-head div span'); if(mail) mail.textContent=u.email;
}).catch(()=>{});
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
      await loadSaved();
    }catch(e){
      note.textContent='Could not save this estimate. '+((e&&e.message)||'');
    }finally{ saveBtn.disabled=false; saveBtn.innerHTML=lab; lucide.createIcons(); }
  });
}


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
