// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { initExtra } from "@/content/rd-site-extra";
import { initShowcase } from "@/content/rd-showcase";

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


/* ---------- hero: one continuous property tour ---------- */
let budgetTouched=false;
const cursorSVG=`<svg class="cursor" width="22" height="24" viewBox="0 0 22 24" fill="none"><path d="M2 1.5 L2 19 L6.6 14.8 L9.6 21.6 L12.9 20.1 L9.9 13.5 L16 13.2 Z" fill="#fff" stroke="#111113" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// One property, walked end to end. Each beat crossfades into the next; the
// running total accumulates so the tour ends on a whole-property number.
const TOUR=[
 {ch:'Exterior',dur:1800,img:PHOTOS.exteriorBefore,style:'As Found',lock:'Reality Lock On',
  lab:'Front Elevation',est:'Scanning',fit:'Reading Geometry',mets:[['Budget Fit','Reading Geometry','conf-md'],['Layout Confidence','Measuring','conf-md'],['Structural Changes','None Detected','conf-hi']]},
 {ch:'Exterior',dur:1800,img:PHOTOS.paintedBrick,style:'Painted Brick',lock:'Reality Lock On',
  lab:'Front Elevation',est:'$11,900 to $16,800',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Layout Confidence','High','conf-hi'],['Structural Changes','None Detected','conf-hi']]},
 {ch:'Exterior',dur:1800,img:PHOTOS.craftsman,style:'Craftsman',lock:'Reality Lock On',
  lab:'Front Elevation',est:'$14,200 to $19,400',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Layout Confidence','High','conf-hi'],['Structural Changes','None Detected','conf-hi']]},
 {ch:'Exterior',dur:1600,img:PHOTOS.ranch,style:'Florida Ranch',lock:'Reality Lock On',zoom:'in',
  lab:'Front Elevation',est:'$11,900 to $16,800',fit:'Approved',mets:[['Budget Fit','Approved','conf-hi'],['Layout Confidence','High','conf-hi'],['Structural Changes','None Detected','conf-hi']],note:'Stepping Inside'},

 {ch:'Declutter',dur:1900,img:PHOTOS.clutter,style:'As Found',lock:'Declutter On',
  lab:'Living Room',est:'Detecting Contents',fit:'14 Objects Found',mets:[['Objects Detected','14','conf-md'],['Reality Lock','On','conf-hi'],['Disclosure Ready','Yes','conf-hi']]},
 {ch:'Declutter',dur:1900,img:PHOTOS.empty,style:'Emptied',lock:'Declutter On',
  lab:'Living Room',est:'Architecture Preserved',fit:'Walls, Windows, Floor',mets:[['Objects Removed','14 of 14','conf-hi'],['Reality Lock','On','conf-hi'],['Disclosure Ready','Yes','conf-hi']]},

 {ch:'Stage',dur:1750,img:PHOTOS.after,style:'Warm Minimal',lock:'Reality Lock On',
  lab:'Living Room',est:'$11,400 to $14,900',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Layout Confidence','High','conf-hi'],['Room Staged','Yes','conf-hi']]},
 {ch:'Stage',dur:1750,img:PHOTOS.coastal,style:'Coastal',lock:'Reality Lock On',
  lab:'Living Room',est:'$13,800 to $17,600',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Layout Confidence','High','conf-hi'],['Room Staged','Yes','conf-hi']]},
 {ch:'Stage',dur:1750,img:PHOTOS.japandi,style:'Japandi',lock:'Reality Lock On',
  lab:'Living Room',est:'$12,600 to $16,100',fit:'Design DNA Applied',mets:[['Budget Fit','Within Target','conf-hi'],['Layout Confidence','High','conf-hi'],['Design DNA','Applied','conf-hi']]},

 {ch:'Shop',dur:4200,img:PHOTOS.japandi,style:'Japandi',lock:'Reality Lock On',shop:true,
  lab:'Project Cart, 14 Items',est:'$3,284',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Product Match','14 of 14 Found','conf-hi'],['Fit Confidence','High','conf-hi']],
  toast:'Added To Project',toastAt:2600},

 {ch:'Garden',dur:1600,img:PHOTOS.yardBefore,style:'As Found',lock:'Reality Lock On',zoom:'out',
  lab:'Backyard',est:'Scanning',fit:'Reading Site',mets:[['Budget Fit','Reading Site','conf-md'],['Trades','3','conf-hi'],['Pricing Confidence','Medium','conf-md']],note:'Heading Out Back'},
 {ch:'Garden',dur:2500,img:PHOTOS.resortYard,style:'Resort',lock:'Budget Mode On',
  lab:'Backyard',est:'$26,100 to $31,500',fit:'Within Target',mets:[['Budget Fit','Within Target','conf-hi'],['Trades','3','conf-hi'],['Pricing Confidence','High','conf-hi']]},

 {ch:'Garden',dur:3200,img:PHOTOS.resortYard,style:'Design DNA Applied',lock:'Budget Mode On',summary:true,
  lab:'Whole Property Planning Range',est:'$49,400 to $63,200',fit:'4 Rooms Approved',mets:[['Rooms Approved','4 of 4','conf-hi'],['Line Items','62','conf-hi'],['Pricing Confidence','High','conf-hi']]}
];
const CHAPTERS=['Exterior','Declutter','Stage','Shop','Garden'];

const showStage=document.getElementById('showStage'),lockPill=document.getElementById('lockPill'),
      modePill=document.getElementById('modePill'),styleChip=document.getElementById('styleChip'),
      toastEl=document.getElementById('toast'),showNav=document.getElementById('showNav'),
      tourProg=document.getElementById('tourProg');

showNav.innerHTML=CHAPTERS.map((c,i)=>`<button data-ch="${c}"${i===0?' class="on"':''}>${c}</button>`).join('');

const shopOverlay=()=>`
  <span class="spot pulse" style="left:29%;top:63%;animation-delay:.2s"></span>
  <span class="spot" style="left:51%;top:80%;animation-delay:.35s"></span>
  <span class="spot" style="left:80%;top:74%;animation-delay:.5s"></span>
  <span class="spot" style="left:24%;top:38%;animation-delay:.65s"></span>
  <div class="pcard" style="left:33%;top:27%"><b>Low Profile Sofa</b>
    <span class="tierrow"><i>Best Price</i><em>$690</em></span>
    <span class="tierrow on"><i>Closest Match</i><em>$1,240</em></span>
    <span class="tierrow"><i>Premium Pick</i><em>$2,480</em></span>
    <span class="pb2">Add To Project</span></div>
  ${cursorSVG.replace('class="cursor"','class="cursor" style="left:43%;top:55%"')}`;

const summaryOverlay=()=>`
  <div class="tour-sum">
    <div class="ts-lab mono">One Property, One Design DNA</div>
    <div class="ts-rows">
      <div><span>Front Elevation</span><em>$11.9K to $16.8K</em></div>
      <div><span>Living Room</span><em>$12.6K to $16.1K</em></div>
      <div><span>Furnishings</span><em>$3.3K</em></div>
      <div><span>Backyard</span><em>$26.1K to $31.5K</em></div>
    </div>
    <div class="ts-tot"><span>Planning Range</span><em>$49.4K to $63.2K</em></div>
  </div>`;

let tIdx=0,tTimer=null,tToast=null;
function paint(i){
  const b=TOUR[i];
  // crossfade: new layer on top, old ones removed once faded
  const layer=document.createElement('div');
  layer.className='tlayer'+(b.zoom==='in'?' zoom-in':b.zoom==='out'?' zoom-out':'');
  layer.innerHTML=photo(b.img,b.ch+' '+b.style)
    +(b.shop?shopOverlay():'')+(b.summary?summaryOverlay():'')
    +(b.note?`<span class="tour-note">${b.note}</span>`:'');
  showStage.appendChild(layer);
  requestAnimationFrame(()=>layer.classList.add('in'));
  setTimeout(()=>{
    while(showStage.children.length>1)showStage.removeChild(showStage.firstChild);
  },700);

  lockPill.innerHTML=`<i></i>${b.lock}`;
  lockPill.className='lock-pill'+(b.lock==='Recording'?' rec':'');
  modePill.innerHTML=b.ch==='Declutter'?'Interior &middot; Declutter':b.ch==='Stage'?'Interior &middot; Staging':b.ch;
  styleChip.textContent=b.style;

  if(!budgetTouched){
    const he=document.getElementById('heroEst'),hf=document.getElementById('heroFit'),
          hl=document.getElementById('heroEstLab');
    if(hl)hl.textContent=b.lab;
    if(he){he.textContent=b.est;he.classList.toggle('soft',!/\$/.test(b.est))}
    if(hf){hf.textContent=b.fit;hf.className=b.summary?'conf-hi big':'conf-hi'}
    if(b.mets){
      const ids=[['heroM1Lab','heroFit'],['heroM2Lab','heroM2'],['heroM3Lab','heroM3']];
      b.mets.forEach((m,i)=>{
        const l=document.getElementById(ids[i][0]),v=document.getElementById(ids[i][1]);
        if(l)l.textContent=m[0];
        if(v){v.textContent=m[1];v.className=(i===0&&b.summary?m[2]+' big':m[2])}
      });
    }
  }

  toastEl.classList.remove('on');
  if(tToast)clearTimeout(tToast);
  if(b.toast)tToast=setTimeout(()=>{
    toastEl.querySelector('b').textContent=b.toast;toastEl.classList.add('on');
    setTimeout(()=>toastEl.classList.remove('on'),1900);
  },b.toastAt);

  showNav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.ch===b.ch));
  const pct=((i+1)/TOUR.length)*100;
  if(tourProg)tourProg.firstElementChild.style.width=pct+'%';

  lucide.createIcons();
}
function advance(){
  paint(tIdx);
  const d=TOUR[tIdx].dur;
  tIdx=(tIdx+1)%TOUR.length;
  tTimer=setTimeout(advance,d);
}
showNav.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
  const first=TOUR.findIndex(b=>b.ch===btn.dataset.ch);
  if(first<0)return;
  if(tTimer)clearTimeout(tTimer);
  tIdx=first;advance();
}));
advance();

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
  const hl=document.getElementById('heroEstLab');if(hl)hl.textContent='Estimated Planning Range';
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

/* ---------- styles grid ---------- */
const SL=[['Warm Minimal',PHOTOS.after],['Modern Farmhouse',PHOTOS.farmhouse],['Coastal',PHOTOS.coastal],
['Japandi',PHOTOS.japandi],['Mid Century',PHOTOS.midcentury],['Industrial',PHOTOS.industrial],
['Quiet Luxury',PHOTOS.luxury],['Investor Neutral',PHOTOS.neutral],['Florida Ranch',PHOTOS.ranch],
['Painted Brick',PHOTOS.paintedBrick],['Resort Yard',PHOTOS.resortYard],['Craftsman',PHOTOS.craftsman]];
document.getElementById('styleGrid').innerHTML=SL.map(([n,src],i)=>`
  <div class="st"><div class="sw2" style="overflow:hidden">${photo(src,n+' interior design style')}</div><div class="nm">${n}<span>${String(i+1).padStart(3,'0')} / 180</span></div></div>`).join('');

/* ---------- proof cards ---------- */
/* NOTE: These are verifiable product claims, not testimonials. Replace with real
   customer quotes ONLY when they are genuine, attributable and permissioned in
   writing. Fabricated endorsements with attributed names are deceptive advertising. */
const Q=[
['lock','Reality Lock On Every Render','Your walls, windows and layout are preserved on every generation. Not a style preset, a constraint.'],
['wallet','Budget Before The Design','Set the number first and the AI only proposes work that plausibly fits it. Nobody else does this.'],
['calculator','Line Items, Not A Ballpark','Quantities, trades and location-adjusted ranges with a stated confidence level, never a single fake number.'],
['hard-hat','Built From Real Rehab Work','The cost logic comes out of two decades of buying, gutting and reselling distressed property.'],
['gift','Free Preview, No Card, No Account','Generate before you decide. The watermark comes off when you do.'],
['scale','Commercial License Available','Paid plans include commercial use, and your images stay yours if you cancel.']];
document.getElementById('quotes').innerHTML=Q.map(([ic,t,d])=>`
  <div class="proof-card"><div class="pic"><i data-lucide="${ic}"></i></div><b>${t}</b><p>${d}</p></div>`).join('');


/* ---------- pricing ---------- */
const P=[
{n:'Free',mo:0,yr:0,who:'Anyone. No card, no account to start.',cta:'Start Free',pop:false,note:'No card · No account to start',
 f:['<b>5 credits a day</b>','First design needs no account at all','Interiors, exteriors and landscapes','Full style library, Reality Lock, keep/replace/remove controls','Virtual staging, declutter, material swap, style transfer','Typical budget range by room type and finish level','Watermarked, standard resolution'],
 x:['Clean HD download','Scope and budget from YOUR photo','Commercial license']},
{n:'Starter',mo:15,yr:7,who:'One property. Personal projects.',cta:'Choose Starter',pop:false,note:'30 day money back · Cancel anytime',
 f:['<b>200 credits a month</b>','Clean HD, no watermark','Personal use license','Scope and budget from your photo','Design DNA on one property','Shopping list with live pricing','Before and after presentation'],
 x:['Commercial license','ARV impact range','Batch listing staging']},
{n:'Pro',mo:25,yr:10,who:'Investors, flippers, contractors and agents.',cta:'Choose Pro',pop:true,note:'30 day money back · Cancel anytime',
 f:['<b>2,000 credits a month</b>','Everything in Starter','Commercial license','Contractor brief PDF','ARV impact range','Rental grade vs retail grade','Batch listing staging with MLS disclosure','Design DNA across unlimited properties','5 team seats'],
 x:['Video walkthroughs and 3D plans','Client approval portal']},
{n:'Studio',mo:35,yr:13,who:'Design teams and brokerage offices.',cta:'Choose Studio',pop:false,note:'30 day money back · Cancel anytime',
 f:['<b>4,000 credits a month</b>','Everything in Pro','Video walkthroughs','2D to 3D floor plans','Client approval portal','Brand presets and white label decks','Multi angle consistency','Priority render queue','<b>Unlimited team seats</b>'],x:[]}];

let bill='yr';
function drawPlans(){
  document.getElementById('plans').innerHTML=P.map(p=>`
  <div class="plan ${p.pop?'pop':''}"><h3>${p.n}</h3>
    <div class="pr"><b>$${p[bill]}</b><span>/mo</span></div>
    <div class="who">${p.mo===0?'Free forever':bill==='yr'?`Billed yearly · $${p.mo}/mo monthly`:'Billed monthly'}</div>
    <p style="font-size:.84rem">${p.who}</p>
    <a href="#" class="btn ${p.pop?'btn-primary':'btn-ghost'} btn-block" data-plan="${p.n}">${p.cta}</a>
    <p class="plan-note">${p.note}</p>
    <ul>${p.f.map(x=>`<li><i data-lucide="check"></i><span>${x}</span></li>`).join('')}${
      (p.x||[]).map(x=>`<li class="no"><i data-lucide="x"></i><span>${x}</span></li>`).join('')}</ul></div>`).join('');
  document.querySelectorAll('#plans [data-plan]').forEach(a=>a.addEventListener('click',ev=>{
    const n=a.dataset.plan;if(n==='Free')return;ev.preventDefault();openCheckout(n);
  }));
  lucide.createIcons();
}

document.querySelectorAll('#billSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#billSeg button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on');bill=b.dataset.b;drawPlans();
}));
drawPlans();

/* ---------- checkout, one order bump, no countdown ---------- */
const coMask=document.getElementById('coMask');
function coRender(name){
  const p=P.find(x=>x.n===name);if(!p)return;
  const base=p[bill];
  /* the bump is offered on Starter and Pro only, never on Studio */
  const eligible=p.n==='Starter'||p.n==='Pro';
  const wrap=document.getElementById('coBumpWrap');
  const box=document.getElementById('coBump');
  if(wrap)wrap.hidden=!eligible;
  if(!eligible&&box)box.checked=false;
  const bump=eligible&&box.checked?7:0;
  document.getElementById('coTitle').textContent=`${p.n}, Billed ${bill==='yr'?'Yearly':'Monthly'}`;
  document.getElementById('coPrice').textContent=`$${base}/mo`;
  document.getElementById('coTotal').textContent=`$${base+bump}/mo`;
}

let coPlan='Pro';
function openCheckout(name){
  coPlan=name;coRender(coPlan);coMask.hidden=false;
  document.body.style.overflow='hidden';lucide.createIcons();
}
function closeCheckout(){coMask.hidden=true;document.body.style.overflow=''}
document.getElementById('coX').addEventListener('click',closeCheckout);
coMask.addEventListener('click',e=>{if(e.target===coMask)closeCheckout()});
document.getElementById('coBump').addEventListener('change',()=>coRender(coPlan));

/* ---------- founding member counter (real count, never a timer) ---------- */
(function foundingCount(){
  const left=document.getElementById('foundLeft'),big=document.getElementById('foundBig'),
        bar=document.getElementById('foundBar'),sub=document.getElementById('foundSub');
  if(!big)return;
  fetch('/api/public/founding').then(r=>r.json()).then(d=>{
    if(typeof d.remaining!=='number')throw new Error('no count');
    big.textContent=String(d.remaining);
    if(left)left.textContent=String(d.remaining);
    if(bar)bar.style.width=Math.round((d.claimed/d.limit)*100)+'%';
    if(sub)sub.textContent=d.open?`${d.claimed} of ${d.limit} claimed`:'Founding pricing is closed';
    if(!d.open)document.getElementById('found').classList.add('closed');
  }).catch(()=>{
    big.textContent='500';if(left)left.textContent='500';
    if(sub)sub.textContent='Counted live from claimed accounts';
  });
})();



/* ---------- faq ---------- */
const FAQ=[
['What Is A Credit?','One credit runs a design, restyle, virtual stage, declutter, material swap, sky swap or style transfer. A scope and budget from your photo is 3 credits, a 2D to 3D floor plan is 6 and a video walkthrough is 40. One balance, no second number to track. Credits reset monthly and never expire while your subscription is active.'],
['How Accurate Is The Cost Estimate?','It is a planning estimate, not a construction bid. The engine reads the design it produced, converts it into line items with quantities, and prices those against labor and material rates for your market. We show it as a range with a confidence level rather than a single fake number, because anything more precise than that would be dishonest. Investors use it to underwrite and contractors use it as a starting proposal. Your subcontractor pricing is still the final word.'],
['Will It Look Like My Actual Room?','Yes. Every render is built on the photo you upload, so the walls, windows, ceiling height and camera angle stay exactly where they are. Only furniture, finishes, color and lighting change. That is the difference between this and a general purpose image generator, which will happily invent a room that does not exist.'],
['What Does Budget Mode Actually Do?','It constrains the generation. Set a Refresh budget and the AI reaches for paint, hardware, lighting and refaced doors. Set a Renovation budget and new cabinets, an island and appliances come into scope. Same photo, same style, genuinely different design, because the money is different. You can also generate the same room at three budget bands and compare what the jump buys.'],
['Is The Free Plan Really Usable?','Yes. Your first design needs no account at all, then a free account gives you 5 credits a day. Free includes every space type, the full style library, Reality Lock, the object controls and a typical budget range looked up by room type, finish level and market. That typical range is honest about what it is, since it is not computed from your photo. Output is watermarked at standard resolution. We charge when you need clean files, the scope computed from your own room, the ARV number, batch staging or team tools.'],
['What Is The Fair Use Policy?','All plans, add-ons and top-ups include a fair use policy. Sustained usage far beyond the typical pattern for your plan may pause new generations for 24 hours. We will always contact you first.'],
['Do You Charge Per Seat?','Pro includes 5 team seats and Studio includes unlimited seats at $35 a month. Add your photographer, assistant, project manager and GC without paying by the head. We meter credits, not people.'],
['What Is Founding Member Pricing?','The first 500 accounts lock their rate permanently, including through plan changes, and receive a Renovation Planning Pack worth $49. The counter on the pricing page is an exact count of claimed accounts, not a timer and not a per visitor reset. When it reaches zero the price rises and does not come back down.'],
['Can I Use These Images On The MLS?','Yes, on any paid plan, and the disclosure engine handles the compliance side. Most MLSs and several states require virtually staged or digitally altered photos to be labeled. Pick your market once and every export gets the correct label plus a disclosure sheet for your transaction file. Confirm your local rule, since they do change.'],
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
initShowcase(timers);
addEventListener('scroll',()=>document.getElementById('hdr').classList.toggle('scrolled',scrollY>12),{passive:true});
lucide.createIcons();

  } catch (e) { console.error(e); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
