// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";

export function initApp(): () => void {
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => { const id = window.setInterval(fn, ms); timers.push(id); return id; };
  const setTimeout = (fn: any, ms?: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {

/* ---------- room svg ---------- */
function room(mode,pal){
  const A={ceil:'#F7F5F1',back:'#EFECE6',side:'#E5E1D9',floor:'#C6AF8F',plank:'#B99F7C',sofa:'#3D4A45',sofa2:'#33403C',
    pil1:'#D9C7A8',pil2:'#B9C4BC',rug:'#EAE5DB',rug2:'#DCD5C7',tbl:'#8A6A47',art:'#D8D2C6',plant:'#4F6B4A',pot:'#C9B99F',lamp:'#2A2A2E',win:'#DCE7EC',frame:'#FFF'};
  const B={ceil:'#E7E1D4',back:'#D9CFBB',side:'#CDC2AC',floor:'#A98F6F',plank:'#98805F',sofa:'#9C8B76',sofa2:'#8C7C69',
    pil1:'#B7A78F',pil2:'#A2917A',rug:'#8E7B60',rug2:'#83704F',tbl:'#6E5638',art:'#C6BBA4',plant:'#6E7A56',pot:'#A08D70',lamp:'#5A5346',win:'#CBD5D9',frame:'#EDE7DA'};
  let P=mode==='after'?{...A}:{...B};
  if(pal){P.sofa=pal[0];P.sofa2=pal[1];P.back=pal[2];P.floor=pal[3];P.rug=pal[4]}
  const a=mode==='after';
  return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="500" fill="${P.back}"/><polygon points="0,0 800,0 800,88 0,60" fill="${P.ceil}"/>
  <polygon points="0,60 90,88 90,410 0,455" fill="${P.side}"/><polygon points="0,455 90,410 800,410 800,500 0,500" fill="${P.floor}"/>
  <g stroke="${P.plank}" stroke-width="2" opacity=".5"><line x1="120" y1="440" x2="800" y2="440"/><line x1="150" y1="470" x2="800" y2="470"/>
  <line x1="300" y1="410" x2="300" y2="500"/><line x1="520" y1="410" x2="520" y2="500"/></g>
  <rect x="520" y="120" width="220" height="185" fill="${P.win}"/>
  <rect x="520" y="120" width="220" height="185" fill="none" stroke="${P.frame}" stroke-width="10"/>
  <line x1="630" y1="120" x2="630" y2="305" stroke="${P.frame}" stroke-width="8"/>
  <line x1="520" y1="212" x2="740" y2="212" stroke="${P.frame}" stroke-width="8"/>
  ${a?`<rect x="500" y="108" width="24" height="210" fill="#E8E2D6"/><rect x="736" y="108" width="24" height="210" fill="#E8E2D6"/>`:''}
  <rect x="180" y="${a?130:150}" width="${a?170:96}" height="${a?118:74}" fill="${P.art}" stroke="${a?'#B9B0A0':'#B0A48C'}" stroke-width="4"/>
  ${a?`<rect x="196" y="146" width="138" height="86" fill="#C4B7A2"/><circle cx="252" cy="182" r="22" fill="#8A9B8C"/>`:''}
  <ellipse cx="420" cy="452" rx="${a?250:150}" ry="${a?48:32}" fill="${P.rug}"/>
  <ellipse cx="420" cy="452" rx="${a?214:120}" ry="${a?36:23}" fill="${P.rug2}" opacity=".7"/>
  <rect x="230" y="${a?318:305}" width="300" height="${a?70:92}" rx="${a?10:4}" fill="${P.sofa}"/>
  <rect x="230" y="${a?300:288}" width="300" height="${a?28:34}" rx="${a?10:4}" fill="${P.sofa2}"/>
  <rect x="252" y="${a?306:296}" width="52" height="${a?30:34}" rx="6" fill="${P.pil1}"/>
  <rect x="452" y="${a?306:296}" width="52" height="${a?30:34}" rx="6" fill="${P.pil2}"/>
  <rect x="250" y="${a?388:397}" width="10" height="${a?20:8}" fill="${P.tbl}"/><rect x="500" y="${a?388:397}" width="10" height="${a?20:8}" fill="${P.tbl}"/>
  <rect x="330" y="${a?404:408}" width="${a?170:110}" height="12" rx="4" fill="${P.tbl}"/>
  <rect x="345" y="416" width="8" height="26" fill="${P.tbl}"/><rect x="${a?480:430}" y="416" width="8" height="26" fill="${P.tbl}"/>
  <rect x="640" y="378" width="46" height="52" rx="${a?6:2}" fill="${P.pot}"/>
  <path d="M663 378 C 630 340, 636 300, 662 286 C 690 300, 694 340, 663 378 Z" fill="${P.plant}"/>
  ${a?`<path d="M663 378 C 700 350, 716 318, 706 300 C 682 302, 664 340, 663 378 Z" fill="#5E7C57"/>
      <path d="M150 400 L150 250 Q150 200 210 198" stroke="${P.lamp}" stroke-width="6" fill="none"/>
      <ellipse cx="214" cy="206" rx="26" ry="16" fill="${P.lamp}"/><ellipse cx="150" cy="402" rx="26" ry="8" fill="${P.lamp}"/>
      <rect x="556" y="360" width="120" height="10" rx="3" fill="#8A6A47"/>`
    :`<rect x="140" y="330" width="20" height="76" fill="${P.lamp}"/><polygon points="126,330 174,330 182,290 118,290" fill="#C4B79E"/>
      <rect x="560" y="352" width="86" height="58" fill="#8A7256"/><rect x="572" y="336" width="62" height="18" fill="#7A6248"/>
      <rect x="600" y="330" width="52" height="34" fill="#6B5B47"/>`}</svg>`;
}
const PALS={
  warm:null,
  coastal:['#5A6B7A','#4A5A68','#EDEAE4','#C9BBA6','#E3E0D8'],
  farm:['#7A5C46','#6A4E3B','#F0EBE1','#BFA482','#E8E0D2'],
  green:['#4F6B4A','#41573D','#EDEFE8','#C2B296','#E4E7DE']
};

/* ---------- nav ---------- */
const titles={dash:['Dashboard','Real Advisors &middot; 6 active properties'],props:['Properties','Property, project, room, version'],
studio:['Studio','206 N MacDill Ave &middot; Living Room &middot; v5 draft'],designs:['Designs','248 designs across 6 properties'],
listings:['Listing Batch','Stage a whole property in one direction'],scope:['Scope &amp; Budget','Planning estimates from approved designs'],
products:['Products','Shop the design, three price tiers per item'],present:['Presentations','Client ready packages and approval links'],
team:['Team','Unlimited seats on Pro and above'],settings:['Settings','Brand kit, defaults and integrations']};
function go(v){
  document.querySelectorAll('.nav-i').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
  document.getElementById('pgTitle').innerHTML=titles[v][0];
  document.getElementById('pgCrumb').innerHTML=titles[v][1];
  window.scrollTo({top:0});
}
document.querySelectorAll('.nav-i').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));

/* ---------- dashboard ---------- */
const recent=[['Living Room v4','206 N MacDill &middot; Warm Minimal','after','warm','p-ok','Approved'],
['Kitchen v7','206 N MacDill &middot; Warm Minimal','after','farm','p-ok','Approved'],
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
const batch=[['Kitchen','IMG_0412.jpg','after','farm','p-ok','Staged'],['Living Room','IMG_0418.jpg','after','warm','p-ok','Staged'],
['Dining Room','IMG_0422.jpg','after','warm','p-ok','Staged'],['Primary Bedroom','IMG_0427.jpg','after','coastal','p-red','Rendering'],
['Bathroom 2','IMG_0431.jpg','before','warm','p-gray','Queued'],['Backyard','IMG_0440.jpg','before','green','p-gray','Queued']];
document.getElementById('batchList').innerHTML=batch.map(([r,f,mo,p,cls,lab])=>`
<div class="rowi"><div class="thumb">${room(mo,PALS[p])}</div><div class="rowt"><b>${r}</b><span>${f}</span></div>
<span class="pill ${cls}">${lab}</span></div>`).join('');

/* ---------- scope ---------- */
const scope=[['LVP Flooring, Installed','Flooring','340 sf','$1,700','$2,100'],
['Paint, Walls And Ceiling','Paint','1 rm','$580','$760'],
['Recessed Lighting, 6 Cans','Electrical','6 ea','$1,020','$1,380'],
['Baseboard And Casing','Carpentry','76 lf','$430','$620'],
['Drywall Repair And Texture','Drywall','1 rm','$340','$520'],
['Ceiling Fan, Replace','Electrical','1 ea','$260','$380'],
['Window Casing And Sill','Carpentry','2 ea','$310','$460'],
['Furnishing Package','Furnishings','1 set','$2,900','$3,800'],
['Debris Haul And Final Clean','General','1 ls','$310','$440'],
['Contingency At 10%','General','1 ls','$1,040','$1,360']];
document.getElementById('scopeRows').innerHTML=scope.map(([i,t,q,l,h])=>`
<tr><td><b>${i}</b></td><td>${t}</td><td class="n">${q}</td><td class="n">${l}</td><td class="n">${h}</td></tr>`).join('');

const bands=[['Refresh','Paint, hardware, lighting','$3.2K to $5K','p-ok'],
['Makeover','Adds flooring, casing, furnishings','$11.4K to $14.9K','p-ink'],
['Renovation','Adds built ins, ceiling detail','$26K to $35K','p-gray'],
['Full Remodel','Adds wall removal, structural','$41K to $62K','p-gray']];
document.getElementById('bandList').innerHTML=bands.map(([n,d,r,cls])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div>
<div style="text-align:right"><div class="mono" style="font-size:.75rem">${r}</div>
${cls==='p-ink'?'<span class="pill p-ink" style="margin-top:4px">Selected</span>':''}</div></div>`).join('');

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
['Social Reel, 9x16','Cross fade before to after, 12 seconds','p-amb','Rendering'],
['Walkthrough Video','Dolly in, 20 seconds','p-gray','Studio Plan']];
document.getElementById('pkgList').innerHTML=pkg.map(([n,d,cls,lab])=>`
<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div><span class="pill ${cls}">${lab}</span></div>`).join('');

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

lucide.createIcons();

  } catch (e) { console.error(e); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
