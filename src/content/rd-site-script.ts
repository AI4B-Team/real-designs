// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";

export function initSite(): () => void {
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => { const id = window.setInterval(fn, ms); timers.push(id); return id; };
  const setTimeout = (fn: any, ms?: number) => { const id = window.setTimeout(fn, ms); timers.push(id); return id; };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {

/* ---------- room art ---------- */
function room(mode,pal){
  const A={ceil:'#F7F5F1',back:'#EFECE6',side:'#E5E1D9',floor:'#C6AF8F',plank:'#B99F7C',sofa:'#3D4A45',sofa2:'#33403C',
    pil1:'#D9C7A8',pil2:'#B9C4BC',rug:'#EAE5DB',rug2:'#DCD5C7',tbl:'#8A6A47',art:'#D8D2C6',plant:'#4F6B4A',pot:'#C9B99F',
    lamp:'#2A2A2E',win:'#DCE7EC',frame:'#FFFFFF'};
  const B={ceil:'#E7E1D4',back:'#D9CFBB',side:'#CDC2AC',floor:'#A98F6F',plank:'#98805F',sofa:'#9C8B76',sofa2:'#8C7C69',
    pil1:'#B7A78F',pil2:'#A2917A',rug:'#8E7B60',rug2:'#83704F',tbl:'#6E5638',art:'#C6BBA4',plant:'#6E7A56',pot:'#A08D70',
    lamp:'#5A5346',win:'#CBD5D9',frame:'#EDE7DA'};
  let P = mode==='after'?{...A}:{...B};
  if(pal){P.sofa=pal[0];P.sofa2=pal[1];P.back=pal[2];P.floor=pal[3];P.rug=pal[4]}
  const a = mode==='after';
  return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="500" fill="${P.back}"/>
  <polygon points="0,0 800,0 800,88 0,60" fill="${P.ceil}"/>
  <polygon points="0,60 90,88 90,410 0,455" fill="${P.side}"/>
  <polygon points="0,455 90,410 800,410 800,500 0,500" fill="${P.floor}"/>
  <g stroke="${P.plank}" stroke-width="2" opacity=".5">
    <line x1="120" y1="440" x2="800" y2="440"/><line x1="150" y1="470" x2="800" y2="470"/>
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
  <rect x="250" y="${a?388:397}" width="10" height="${a?20:8}" fill="${P.tbl}"/>
  <rect x="500" y="${a?388:397}" width="10" height="${a?20:8}" fill="${P.tbl}"/>
  <rect x="330" y="${a?404:408}" width="${a?170:110}" height="12" rx="4" fill="${P.tbl}"/>
  <rect x="345" y="416" width="8" height="26" fill="${P.tbl}"/>
  <rect x="${a?480:430}" y="416" width="8" height="26" fill="${P.tbl}"/>
  <rect x="640" y="378" width="46" height="52" rx="${a?6:2}" fill="${P.pot}"/>
  <path d="M663 378 C 630 340, 636 300, 662 286 C 690 300, 694 340, 663 378 Z" fill="${P.plant}"/>
  ${a?`<path d="M663 378 C 700 350, 716 318, 706 300 C 682 302, 664 340, 663 378 Z" fill="#5E7C57"/>`:''}
  ${a?`<path d="M150 400 L150 250 Q150 200 210 198" stroke="${P.lamp}" stroke-width="6" fill="none"/>
      <ellipse cx="214" cy="206" rx="26" ry="16" fill="${P.lamp}"/><ellipse cx="150" cy="402" rx="26" ry="8" fill="${P.lamp}"/>
      <rect x="556" y="360" width="120" height="10" rx="3" fill="#8A6A47"/>`
     :`<rect x="140" y="330" width="20" height="76" fill="${P.lamp}"/><polygon points="126,330 174,330 182,290 118,290" fill="#C4B79E"/>
      <rect x="560" y="352" width="86" height="58" fill="#8A7256"/><rect x="572" y="336" width="62" height="18" fill="#7A6248"/>
      <rect x="600" y="330" width="52" height="34" fill="#6B5B47"/>`}
</svg>`;
}
function wire(){return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#CC0000" stroke-width="2.5" stroke-dasharray="7 5" opacity=".95">
    <polyline points="0,60 90,88 800,88"/><polyline points="0,455 90,410 800,410"/>
    <line x1="90" y1="88" x2="90" y2="410"/><rect x="520" y="120" width="220" height="185"/>
    <line x1="630" y1="120" x2="630" y2="305"/><line x1="520" y1="212" x2="740" y2="212"/></g>
  <g font-family="DM Mono, monospace" font-size="12">
    <rect x="92" y="94" width="120" height="20" rx="10" fill="#CC0000"/><text x="102" y="108" fill="#fff">CEILING LINE</text>
    <rect x="524" y="312" width="126" height="20" rx="10" fill="#CC0000"/><text x="534" y="326" fill="#fff">WINDOW FIXED</text>
    <rect x="96" y="384" width="106" height="20" rx="10" fill="#CC0000"/><text x="106" y="398" fill="#fff">WALL BASE</text></g></svg>`;}

document.getElementById('lBefore').innerHTML=room('before');
document.getElementById('lAfter').innerHTML=room('after');
document.getElementById('lWire').innerHTML=wire();
document.querySelectorAll('.samp').forEach((s,i)=>{
  const pals=[null,['#5A6B7A','#4A5A68','#EDEAE4','#C9BBA6','#E3E0D8'],['#7A5C46','#6A4E3B','#F0EBE1','#BFA482','#E8E0D2'],['#4F6B4A','#41573D','#EDEFE8','#C2B296','#E4E7DE']];
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
document.querySelectorAll('.samp').forEach(s=>s.addEventListener('click',()=>{
  document.querySelectorAll('.samp').forEach(x=>x.classList.remove('on'));s.classList.add('on');
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
document.getElementById('drop').addEventListener('click',()=>document.getElementById('genBtn').scrollIntoView({block:'center'}));

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

  } catch (err) { console.error(err); }
  return () => { timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); }); };
}
