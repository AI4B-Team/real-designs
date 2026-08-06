// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";


export function initSite(): () => void {
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => { const id = window.setInterval(fn, ms); timers.push(id); return id; };
  const setTimeout = (fn: any, ms?: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {

/* ---------- room art ---------- */
const PHOTO={before:roomBefore,after:roomAfter};
function room(mode,pal){
  const src = mode==='after'?PHOTO.after:PHOTO.before;
  const f = pal?`filter:${pal};`:'';
  return `<img src="${src}" alt="${mode==='after'?'Redesigned living room after AI render':'Original living room before redesign'}" style="width:100%;height:100%;object-fit:cover;display:block;${f}">`;
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

document.getElementById('lBefore').innerHTML=room('before');
document.getElementById('lAfter').innerHTML=room('after');
document.getElementById('lWire').innerHTML=wire();
document.querySelectorAll('.samp').forEach((s,i)=>{
  const pals=[null,'saturate(.75) hue-rotate(180deg)','sepia(.35) saturate(1.2)','saturate(1.15) hue-rotate(-18deg)'];
  s.innerHTML=room(i===0?'before':'after',pals[i]);
});

/* ---------- comparator ---------- */
const rng=document.getElementById('rng'),lAfter=document.getElementById('lAfter'),hnd=document.getElementById('hnd');
function setC(v){lAfter.style.clipPath=`inset(0 0 0 ${v}%)`;hnd.style.left=v+'%';}
rng.addEventListener('input',e=>setC(e.target.value));setC(50);
let auto=true,dir=1,pos=50;
const drift=setInterval(()=>{if(!auto)return clearInterval(drift);pos+=dir*.5;if(pos>65||pos<35)dir*=-1;rng.value=pos;setC(pos);},42);
rng.addEventListener('pointerdown',()=>auto=false);
const wb=document.getElementById('wireBtn'),panel=document.getElementById('panel');
wb.addEventListener('click',()=>{const on=panel.classList.toggle('wire-on');wb.classList.toggle('on',on);
  wb.setAttribute('aria-pressed',on);document.getElementById('wireTxt').textContent=on?'Hide Structure Lock':'Show Structure Lock';});

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
  document.getElementById('estVal').textContent=`${money(b.lo)} to ${money(b.hi)}`;
  const f=document.getElementById('fitVal');f.textContent=b.fit;
  f.className=i===3?'conf-md':'conf-hi';
}
document.querySelectorAll('#budgetChips .chip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('#budgetChips .chip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');setBudget(+c.dataset.b);
}));
function unlock(){
  document.getElementById('more').classList.add('open');
  document.getElementById('hint').classList.add('gone');
}
document.querySelectorAll('.samp').forEach(s=>s.addEventListener('click',()=>{
  document.querySelectorAll('.samp').forEach(x=>x.classList.remove('on'));s.classList.add('on');unlock();
}));

const steps=['Reading room geometry','Locking walls and windows','Fitting the design to your budget','Selecting materials and finishes','Rendering at full resolution','Pricing the scope'];
let busy=false;
document.getElementById('genBtn').addEventListener('click',()=>{
  if(busy)return;busy=true;auto=false;
  const ov=document.getElementById('genOv'),bar=document.getElementById('barFill'),gs=document.getElementById('genStep');
  ov.classList.add('on');bar.style.width='0%';gs.textContent=steps[0];
  let p=0,i=0;
  const t=setInterval(()=>{
    p+=Math.random()*12+5;
    if(p>=100){p=100;clearInterval(t);
      setTimeout(()=>{
        ov.classList.remove('on');busy=false;
        document.getElementById('wm').classList.add('on');
        document.getElementById('mStyle').textContent=st==='Surprise Me'?'Warm Minimal':st;
        rng.value=100;setC(100);
        setTimeout(()=>{let v=100;const back=setInterval(()=>{v-=2.4;rng.value=v;setC(v);if(v<=42)clearInterval(back)},22)},700);
      },380);}
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
const SL=[['Warm Minimal','#E8E2D6','#3D4A45'],['Modern Farmhouse','#F2EFE9','#4A4239'],['Coastal','#E4EDF0','#2F5A6B'],
['Japandi','#EAE4D9','#5A4A3A'],['Mid Century','#E9DCC9','#A0522D'],['Industrial','#DCD9D4','#41403E'],
['Quiet Luxury','#E7E2DA','#7A6A54'],['Investor Neutral','#F0EEEA','#8C8C88'],['Florida Ranch','#EFE7D8','#B07A4B'],
['Painted Brick','#EDEAE4','#5E5A54'],['Resort Yard','#DFE9DB','#3F6B44'],['Craftsman','#E6DED0','#6B4A2F']];
document.getElementById('styleGrid').innerHTML=SL.map(([n,bg,ac],i)=>`
  <div class="st"><div class="sw2" style="background:${bg}">
    <div style="position:absolute;left:12px;bottom:0;width:46%;height:38%;background:${ac};border-radius:5px 5px 0 0"></div>
    <div style="position:absolute;right:14px;top:14px;width:26%;height:34%;background:${ac};opacity:.3;border-radius:4px"></div>
    <div style="position:absolute;right:18px;bottom:0;width:12%;height:24%;background:${ac};opacity:.6;border-radius:50% 50% 3px 3px"></div>
  </div><div class="nm">${n}<span>${String(i+1).padStart(3,'0')} / 180</span></div></div>`).join('');

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
addEventListener('scroll',()=>document.getElementById('hdr').classList.toggle('scrolled',scrollY>12),{passive:true});
lucide.createIcons();

  } catch (e) { console.error(e); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
