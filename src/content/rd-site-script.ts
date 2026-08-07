// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { initExtra } from "@/content/rd-site-extra";

export function initSite(): () => void {
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => { const id = window.setInterval(fn, ms); timers.push(id); return id; };
  const setTimeout = (fn: any, ms?: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {

/* ---------- room photos ---------- */
function room(mode,pal){
  const src = mode==='after' ? (pal || PHOTOS.after) : PHOTOS.before;
  return photo(src, mode==='after' ? 'Redesigned space, AI render' : 'Original space before redesign');
}
function wire(){return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#CC0000" stroke-width="2.5" stroke-dasharray="7 5" opacity=".95">
    <polyline points="0,34 190,72 800,66"/><polyline points="0,430 190,375 800,368"/>
    <line x1="190" y1="72" x2="190" y2="375"/><rect x="614" y="94" width="88" height="242"/>
    <line x1="614" y1="212" x2="702" y2="212"/></g>
  <g font-family="DM Mono, monospace" font-size="12">
    <rect x="196" y="80" width="120" height="20" rx="10" fill="#CC0000"/><text x="206" y="94" fill="#fff">CEILING LINE</text>
    <rect x="576" y="344" width="126" height="20" rx="10" fill="#CC0000"/><text x="586" y="358" fill="#fff">WINDOW FIXED</text>
    <rect x="200" y="350" width="106" height="20" rx="10" fill="#CC0000"/><text x="210" y="364" fill="#fff">WALL BASE</text></g></svg>`;}

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
document.querySelectorAll('.samp').forEach((s,i)=>{
  const pals=[PHOTOS.before,PALS.coastal,PALS.farm,PALS.green];
  s.innerHTML=room(i===0?'before':'after',pals[i]);
});

/* ---------- proof strip ---------- */
const PROOF=[['Kitchen','kitchen','$26.2K to $34.1K'],['Primary Bath','bath','$8.9K to $12.4K'],['Front Elevation','exterior','$11.9K to $16.8K']];
document.getElementById('proofStrip').innerHTML=PROOF.map(([n,p,c])=>`
  <div class="proof"><div class="im">${room('after',PALS[p])}</div>
  <div class="tx"><b>${n}</b><span>${c}</span></div></div>`).join('');

/* ---------- hero showcase ---------- */
let budgetTouched=false;
const cursorSVG=`<svg class="cursor" width="22" height="24" viewBox="0 0 22 24" fill="none"><path d="M2 1.5 L2 19 L6.6 14.8 L9.6 21.6 L12.9 20.1 L9.9 13.5 L16 13.2 Z" fill="#fff" stroke="#111113" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const SCENES=[
 {tab:'Redesign',name:'Interior',lock:'Reality Lock On',est:'$11,400 to $14,900',fit:'Within Target',
  build:()=>`<div class="art">${photo(PHOTOS.before,'Living room before')}</div>
    <div class="wipe">${photo(PHOTOS.after,'Living room after')}</div><div class="wipe-edge"></div>`},
 {tab:'Empty & Stage',name:'Interior &middot; Declutter To Staged',lock:'Declutter On',
  est:'$11,400 to $14,900',fit:'Within Target',
  build:()=>`<div class="art">${photo(PHOTOS.after,'Room restaged')}</div>
    <div class="art fade-out-2">${photo(PHOTOS.empty,'Room emptied')}</div>
    <div class="art fade-out">${photo(PHOTOS.clutter,'Room with clutter')}</div>
    <span class="beat b1">Cluttered</span><span class="beat b2">Emptied</span><span class="beat b3">Restaged</span>`},
 {tab:'Shop',name:'Interior &middot; Shop The Design',lock:'Reality Lock On',toast:'Added To Project',toastAt:2700,
  estLab:'Project Cart, 14 Items',est:'$3,284',fit:'Fits The Room',
  build:()=>`<div class="art">${photo(PHOTOS.after,'Staged living room')}</div>
    <span class="spot pulse" style="left:29%;top:63%;animation-delay:.2s"></span>
    <span class="spot" style="left:51%;top:80%;animation-delay:.35s"></span>
    <span class="spot" style="left:80%;top:74%;animation-delay:.5s"></span>
    <span class="spot" style="left:24%;top:38%;animation-delay:.65s"></span>
    <div class="pcard" style="left:34%;top:30%"><b>Low Profile Sofa</b>
      <span class="tierrow"><i>Best Price</i><em>$690</em></span>
      <span class="tierrow on"><i>Closest Match</i><em>$1,240</em></span>
      <span class="tierrow"><i>Premium Pick</i><em>$2,480</em></span>
      <span class="pb2">Add To Project</span></div>
    ${cursorSVG.replace('class="cursor"','class="cursor" style="left:44%;top:56%"')}`},
 {tab:'Exterior',name:'Exterior',lock:'Reality Lock On',est:'$11,900 to $16,800',fit:'Within Target',
  build:()=>`<div class="art">${photo(PHOTOS.exteriorBefore,'Exterior before')}</div>
    <div class="wipe">${photo(PHOTOS.paintedBrick,'Exterior after')}</div><div class="wipe-edge"></div>`},
 {tab:'Plan',name:'Garden &middot; Scope And Budget',lock:'Budget Mode On',toast:'Scope Sent',toastAt:3100,
  est:'$26,100 to $31,500',fit:'Within Target',
  build:()=>`<div class="art">${photo(PHOTOS.resortYard,'Backyard redesign')}</div>
    <div class="scope-card"><h4>Backyard Redesign</h4><div class="sub2">Planning range &middot; Tampa FL labor</div>
      <div class="li"><span>In Ground Pool And Install</span><span>$18,500</span></div>
      <div class="li"><span>Concrete Deck And Coping</span><span>$5,200</span></div>
      <div class="li"><span>Planting And Landscaping</span><span>$2,600</span></div>
      <div class="li"><span>Outdoor Lighting</span><span>$690</span></div>
      <div class="tot"><span>Planning Range</span><span>$26.1K to $31.5K</span></div>
      <span class="act">Send Scope To Contractor</span></div>
    ${cursorSVG.replace('class="cursor"','class="cursor" style="left:55%;top:77%"')}`},
 {tab:'Video',name:'Exterior &middot; Walkthrough',lock:'Recording',rec:true,
  estLab:'Clip Length',est:'20 Seconds',fit:'Ready To Post',
  build:()=>`<div class="ken">${photo(PHOTOS.paintedBrick,'Exterior walkthrough')}</div>`}
];
const showStage=document.getElementById('showStage'),lockPill=document.getElementById('lockPill'),
      modePill=document.getElementById('modePill'),toastEl=document.getElementById('toast'),
      showNav=document.getElementById('showNav');
let sIdx=0,sTimer=null;
showNav.innerHTML=SCENES.map((s,i)=>`<button data-i="${i}"${i===0?' class="on"':''}>${s.tab}</button>`).join('');
function playScene(i){
  toastEl.classList.remove('on');
  const s=SCENES[i];
  showStage.innerHTML=`<div class="sc on">${s.build()}</div>`;
  lockPill.className='lock-pill'+(s.rec?' rec':'');
  lockPill.innerHTML=`<i></i>${s.lock}`;
  modePill.innerHTML=s.name;
  if(!budgetTouched){
    const he=document.getElementById('heroEst'),hf=document.getElementById('heroFit'),
          hl=document.getElementById('heroEstLab');
    if(he&&s.est)he.textContent=s.est;
    if(hf&&s.fit){hf.textContent=s.fit;hf.className='conf-hi'}
    if(hl)hl.textContent=s.estLab||'Estimated Project Range';
  }
  if(s.toast)setTimeout(()=>{toastEl.querySelector('b').textContent=s.toast;toastEl.classList.add('on');
    setTimeout(()=>toastEl.classList.remove('on'),2200)},s.toastAt);
  showNav.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.i===i));
  lucide.createIcons();
}
function startShow(){if(sTimer)clearInterval(sTimer);sTimer=setInterval(()=>{sIdx=(sIdx+1)%SCENES.length;playScene(sIdx)},5400)}
showNav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
  sIdx=+b.dataset.i;playScene(sIdx);startShow();
}));
playScene(0);startShow();

/* ---------- builder ---------- */
const styleSets={
  interior:['Warm Minimal','Modern Farmhouse','Coastal','Transitional','Investor Neutral','Surprise Me'],
  exterior:['Modern Farmhouse','Craftsman','Painted Brick','Florida Ranch','Coastal','Surprise Me'],
  landscape:['Florida Tropical','Low Maintenance','Resort','Modern Hardscape','Cottage Garden','Surprise Me']
};
const budgets=[
  {lo:3200,hi:5000,fit:'Well Within Target'},
  {lo:11400,hi:14900,fit:'Within Target'},
  {lo:26000,hi:35000,fit:'Within Target'},
  {lo:41000,hi:62000,fit:'Above Band, Review'}
];
let sp='interior',bi=1,st='Warm Minimal';
function drawStyles(){
  document.getElementById('styleChips').innerHTML=styleSets[sp].map((s,i)=>
    `<button class="chip ${i===0?'on':''}" data-st="${s}">${s}</button>`).join('');
  st=styleSets[sp][0];
  document.querySelectorAll('#styleChips .chip').forEach(c=>c.addEventListener('click',()=>{
    document.querySelectorAll('#styleChips .chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');st=c.dataset.st;
  }));
}
drawStyles();
document.querySelectorAll('#spaceChips .chip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('#spaceChips .chip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');sp=c.dataset.sp;drawStyles();
}));
function money(n){return '$'+n.toLocaleString()}
function setBudget(i){
  bi=i;const b=budgets[i];
  const txt=`${money(b.lo)} to ${money(b.hi)}`;
  document.getElementById('estVal').textContent=txt;
  const f=document.getElementById('fitVal');f.textContent=b.fit;
  f.className=i===3?'conf-md':'conf-hi';
  // hero number bar mirrors the builder so the two never disagree
  const he=document.getElementById('heroEst'),hf=document.getElementById('heroFit');
  if(he)he.textContent=txt;
  if(hf){hf.textContent=b.fit;hf.className=i===3?'conf-md':'conf-hi';}
}
document.querySelectorAll('#budgetChips .chip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('#budgetChips .chip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');budgetTouched=true;
  const hl=document.getElementById('heroEstLab');if(hl)hl.textContent='Estimated Project Range';
  setBudget(+c.dataset.b);
}));
function unlock(){
  document.getElementById('more').classList.add('open');
  document.getElementById('hint').classList.add('gone');
}
document.querySelectorAll('.samp').forEach(s=>s.addEventListener('click',()=>{
  document.querySelectorAll('.samp').forEach(x=>x.classList.remove('on'));s.classList.add('on');unlock();
}));

const steps=['Reading room geometry','Locking walls and windows','Fitting the design to your budget','Selecting materials and finishes','Rendering at full resolution','Pricing the scope'];
const OUTPAL=['warm','coastal','farm','green'];
let busy=false;
document.getElementById('genBtn').addEventListener('click',()=>{
  if(busy)return;busy=true;unlock();
  const out=document.getElementById('out'),ov=document.getElementById('genOv'),
        bar=document.getElementById('barFill'),gs=document.getElementById('genStep');
  const si=+(document.querySelector('.samp.on')||{dataset:{s:0}}).dataset.s;
  document.getElementById('outImg').innerHTML=room('after',PALS[OUTPAL[si]]);
  out.classList.add('on');ov.classList.add('on');
  bar.style.width='0%';gs.textContent=steps[0];
  out.scrollIntoView({block:'center',behavior:'smooth'});
  let p=0,i=0;
  const t=setInterval(()=>{
    p+=Math.random()*12+5;
    if(p>=100){p=100;clearInterval(t);setTimeout(()=>{ov.classList.remove('on');busy=false},380)}
    bar.style.width=Math.min(p,100)+'%';
    if(p>(i+1)*(100/steps.length)&&i<steps.length-1){i++;gs.textContent=steps[i]}
  },220);
});
document.getElementById('drop').addEventListener('click',unlock);
document.getElementById('genBtn').addEventListener('click',unlock);

/* ---------- marquee ---------- */
const mqI=[['sofa','Interior Redesign'],['home','Exterior Redesign'],['trees','Landscape Design'],['bed-double','Virtual Staging'],
['eraser','Declutter & Empty'],['pen-tool','Sketch To Render'],['paintbrush','Material Swap'],['wallet','Budget Mode'],
['calculator','Scope & Budget'],['shopping-bag','Shop The Design'],['video','Walkthrough Video'],['box','2D To 3D Plan'],
['copy','Style Transfer'],['shield-check','MLS Disclosure'],['trending-up','ARV Impact']];
document.getElementById('mq').innerHTML=[...mqI,...mqI].map(([i,t])=>`<span class="mq-item"><i data-lucide="${i}"></i>${t}</span>`).join('');

/* ---------- features ---------- */
const F=[
['wallet','Budget Mode','Set the number before you generate. The AI proposes only what plausibly fits it.','Only Here'],
['sliders-horizontal','Keep, Replace, Remove','Tap any object or surface and tell the AI what it may touch. No reprompting from scratch.','Only Here'],
['dna','Design DNA','One palette, flooring, metal and cabinet style locked across every room in the property.','Only Here'],
['calculator','Scope & Budget','Itemized line items with quantities, priced to your local labor market.','Only Here'],
['trending-up','ARV Impact Range','What the finished look supports against recent comps in your market.','Only Here'],
['sofa','Interior Redesign','Dated room to designer finish in one pass, built on your real walls.',''],
['home','Exterior Redesign','Test siding, paint, roofing and curb appeal before a contractor quotes it.',''],
['trees','Landscape Design','Patio, pool, fire pit or fresh planting. See it before you dig.',''],
['bed-double','Virtual Staging','Furnish a vacant listing in seconds. No rental furniture, no reshoot.',''],
['eraser','Declutter & Empty','Strip furniture, clutter and people out of an occupied photo.',''],
['pen-tool','Sketch To Render','Napkin drawing, blueprint or CAD export in. Client ready render out.',''],
['paintbrush','Material Swap','Change flooring, counters, cabinets, tile or paint on real surfaces.',''],
['copy','Style Transfer','Drop in a photo you love and your space gets that exact look.',''],
['shopping-bag','Shop The Design','Every item matched to real products. Closest match, lowest price or premium.',''],
['shield-check','Disclosure Engine','Auto label staged photos to MLS and state rules, with an audit trail.','Only Here'],
['users','Client Approval Links','Share a branded link. Clients favorite, comment and approve.',''],
['video','Walkthrough Video','Turn any still into a cinematic camera move in one click.','Phase 2'],
['box','2D To 3D Floor Plan','Flat plan in, furnished 3D walkthrough out. Sell before framing.','Phase 2'],
['scan','Multi Angle Consistency','Four views of one room, same sofa and layout in all four.','Phase 2'],
['plug','API & White Label','Drop the whole engine into your site with your logo on it.','Phase 2']];
document.getElementById('featGrid').innerHTML=F.map(([i,t,d,g])=>`
  <div class="feat">${g?`<span class="tg ${g==='Phase 2'?'soon':''}">${g}</span>`:''}
  <div class="ic"><i data-lucide="${i}"></i></div><h3>${t}</h3><p>${d}</p></div>`).join('');

/* ---------- styles grid ---------- */
const SL=[['Warm Minimal',PHOTOS.after],['Modern Farmhouse',PHOTOS.farmhouse],['Coastal',PHOTOS.coastal],
['Japandi',PHOTOS.japandi],['Mid Century',PHOTOS.midcentury],['Industrial',PHOTOS.industrial],
['Quiet Luxury',PHOTOS.luxury],['Investor Neutral',PHOTOS.neutral],['Florida Ranch',PHOTOS.ranch],
['Painted Brick',PHOTOS.paintedBrick],['Resort Yard',PHOTOS.resortYard],['Craftsman',PHOTOS.craftsman]];
document.getElementById('styleGrid').innerHTML=SL.map(([n,src],i)=>`
  <div class="st"><div class="sw2" style="overflow:hidden">${photo(src,n+' interior design style')}</div><div class="nm">${n}<span>${String(i+1).padStart(3,'0')} / 180</span></div></div>`).join('');

/* ---------- quotes ---------- */
const Q=[
['I set the budget to $18,000 and it actually designed to it. Every other tool was showing me a kitchen I would have had to sell a car for.','Marcus T.','Flipper, 14 Doors A Year'],
['I show the homeowner the finished exterior on my tablet in the driveway, swap the siding color while we talk, and print the scope before I leave. I close on the spot now.','Ray G.','Exterior Contractor'],
['Design DNA is the whole thing for me. My photo sets used to look like five different houses. One direction across the property and the listing finally reads as one home.','Priya N.','Team Lead, 40 Listings A Year'],
['Being able to lock the floors we were not replacing saved me three days of arguing with an AI that kept ripping them out.','Danielle R.','Listing Agent, Tampa FL'],
['We run the rental scenario and the retail scenario on the same property and compare the numbers before we commit. That is underwriting, not decorating.','Chris B.','Multifamily PM'],
['The free version told me what my living room would cost before I called a single contractor. That alone was worth the signup.','Alanna W.','Homeowner']];
document.getElementById('quotes').innerHTML=Q.map(([q,n,r])=>`
  <div class="quote"><div class="stars">${'<i data-lucide="star"></i>'.repeat(5)}</div><p>${q}</p>
  <footer><span class="av">${n.split(' ').map(x=>x[0]).join('')}</span><div><b>${n}</b><span>${r}</span></div></footer></div>`).join('');

/* ---------- pricing ---------- */
const P=[
{n:'Free',mo:0,yr:0,who:'Anyone. No card, no account to start.',cta:'Start Free',pop:false,
 f:['Generous daily renders','All spaces and full style library','Structure Lock and object controls','Budget Mode with cost range','Watermarked, standard resolution']},
{n:'Home',mo:19,yr:13,who:'One property, personal projects.',cta:'Choose Home',pop:false,
 f:['Clean HD, no watermark','Personal use license','Design DNA on one property','Shopping list with live pricing','Presentation package and before/after']},
{n:'Pro',mo:59,yr:41,who:'Investors, flippers, contractors and agents.',cta:'Choose Pro',pop:true,
 f:['Everything in Home','Commercial license','Itemized scope and contractor brief','ARV impact range','Rental grade vs retail grade','Batch listing staging and disclosure','Unlimited team seats']},
{n:'Studio',mo:119,yr:83,who:'Design teams and brokerage offices.',cta:'Choose Studio',pop:false,
 f:['Everything in Pro','Client approval portal','Brand presets and white label decks','Multi angle consistency','Video walkthroughs and 3D plans','Priority render queue']},
{n:'Business',mo:null,yr:null,who:'Builders, brokerages and platforms.',cta:'Talk To Us',pop:false,
 f:['Everything in Studio','API access and webhooks','White label widget on your site','Org wide locked brand kit','Usage reporting by seat','Dedicated onboarding']}];
let bill='mo';
function drawPlans(){
  document.getElementById('plans').innerHTML=P.map(p=>`
  <div class="plan ${p.pop?'pop':''}"><h3>${p.n}</h3>
    <div class="pr">${p[bill]===null?'<b style="font-size:1.5rem">Custom</b>':`<b>$${p[bill]}</b><span>/mo</span>`}</div>
    <div class="who">${p[bill]===null?'Volume pricing':bill==='yr'&&p.yr>0?'Billed yearly':p.mo===0?'Free forever':'Billed monthly'}</div>
    <p style="font-size:.84rem">${p.who}</p>
    <a href="#" class="btn ${p.pop?'btn-primary':'btn-ghost'} btn-block">${p.cta}</a>
    <ul>${p.f.map(x=>`<li><i data-lucide="check"></i>${x}</li>`).join('')}</ul></div>`).join('');
  lucide.createIcons();
}
document.querySelectorAll('#billSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#billSeg button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');bill=b.dataset.b;drawPlans();
}));
drawPlans();

/* ---------- faq ---------- */
const FAQ=[
['How Accurate Is The Cost Estimate?','It is a planning estimate, not a construction bid. The engine reads the design it produced, converts it into line items with quantities, and prices those against labor and material rates for your market. We show it as a range with a confidence level rather than a single fake number, because anything more precise than that would be dishonest. Investors use it to underwrite and contractors use it as a starting proposal. Your subcontractor pricing is still the final word.'],
['Will It Look Like My Actual Room?','Yes. Every render is built on the photo you upload, so the walls, windows, ceiling height and camera angle stay exactly where they are. Only furniture, finishes, color and lighting change. That is the difference between this and a general purpose image generator, which will happily invent a room that does not exist.'],
['What Does Budget Mode Actually Do?','It constrains the generation. Set a Refresh budget and the AI reaches for paint, hardware, lighting and refaced doors. Set a Renovation budget and new cabinets, an island and appliances come into scope. Same photo, same style, genuinely different design, because the money is different. You can also generate the same room at three budget bands and compare what the jump buys.'],
['Is The Free Plan Really Usable?','Yes, and that is deliberate. Rendering is becoming a commodity, so we give it away rather than pretend otherwise. Free includes every space type, the full style library, Structure Lock, the object controls and Budget Mode with a live cost range. Output is watermarked at standard resolution and resets daily. We charge when you need clean files, the scope, the ARV number, batch staging or team tools.'],
['Can I Use These Images On The MLS?','Yes, on any paid plan, and the disclosure engine handles the compliance side. Most MLSs and several states require virtually staged or digitally altered photos to be labeled. Pick your market once and every export gets the correct label plus a disclosure sheet for your transaction file. Confirm your local rule, since they do change.'],
['Do You Charge Per Seat?','No. Every paid plan from Pro up includes unlimited team seats. Add your photographer, assistant, project manager and GC at no extra cost. We meter designs, not people.'],
['I Only Have One Kitchen To Do. Do I Need A Subscription?','No. Buy a Single Room Pack at $12 or a Renovation Planning Pack at $49, keep everything you generate, and walk away. A homeowner doing one project should not end up with a monthly bill following them around.'],
['Who Owns The Images?','You do. Every paid plan includes a license on everything you generate, commercial from Pro up, and the images stay yours even if you cancel or request a refund.']];
document.getElementById('faq').innerHTML=FAQ.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('');

/* ---------- motion ---------- */
const io=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.1});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));
const co=new IntersectionObserver(e=>e.forEach(x=>{
  if(!x.isIntersecting)return;const el=x.target,end=+el.dataset.c,s=el.dataset.sfx||'';let c=0;const inc=end/45;
  const t=setInterval(()=>{c+=inc;if(c>=end){c=end;clearInterval(t)}el.textContent=Math.round(c)+s},26);co.unobserve(el);
}),{threshold:.5});
document.querySelectorAll('[data-c]').forEach(el=>co.observe(el));
initExtra(timers, lucide);
addEventListener('scroll',()=>document.getElementById('hdr').classList.toggle('scrolled',scrollY>12),{passive:true});
lucide.createIcons();

  } catch (e) { console.error(e); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
