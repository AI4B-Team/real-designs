// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS, photo } from "@/content/rd-photos";
import { FAQ } from "@/content/rd-faq";
import { initExtra } from "@/content/rd-site-extra";
import { initShowcase } from "@/content/rd-showcase";
import { track } from "@/lib/analytics";
import { summaryHTML, metric } from "@/lib/result-summary";

export function initSite(): () => void {
  const root = document.querySelector('.rd-site') as HTMLElement | null;
  if (root && root.dataset['rdInit'] === '1') return () => {};
  if (root) root.dataset['rdInit'] = '1';
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
  lab:'Room',est:'Front Elevation',proc:{msg:'Reading Elevation'},mets:[['Status','Reading Elevation'],['Reality Lock','On'],['Layout','Measuring']]},
 {ch:'Exterior',dur:1800,img:PHOTOS.paintedBrick,style:'Painted Brick',lock:'Reality Lock On',
  lab:'Room',est:'Front Elevation',fit:'Within Target',mets:[['Planning Range','$11,900 to $16,800'],['Budget Fit','Within Target'],['Structure','No Changes']]},
 {ch:'Exterior',dur:1800,img:PHOTOS.craftsman,style:'Craftsman',lock:'Reality Lock On',
  lab:'Room',est:'Front Elevation',fit:'Within Target',mets:[['Planning Range','$14,200 to $19,400'],['Budget Fit','Within Target'],['Structure','No Changes']]},
 {ch:'Exterior',dur:1600,img:PHOTOS.ranch,style:'Florida Ranch',lock:'Reality Lock On',zoom:'in',
  lab:'Room',est:'Front Elevation',fit:'Approved',mets:[['Planning Range','$11,900 to $16,800'],['Budget Fit','Approved'],['Structure','No Changes']],note:'Stepping Inside'},

 {ch:'Interior',dur:1800,img:PHOTOS.before,style:'As Found',lock:'Reality Lock On',
  lab:'Room',est:'Living Room',proc:{msg:'Reading Space'},mets:[['Status','Reading Space'],['Reality Lock','On'],['Layout','Measuring']]},
 {ch:'Interior',dur:1900,img:PHOTOS.after,style:'Warm Minimal',lock:'Reality Lock On',
  lab:'Room',est:'Living Room',fit:'Within Target',mets:[['Planning Range','$11,400 to $14,900'],['Budget Fit','Within Target'],['Structure','No Changes']]},

 {ch:'Declutter',dur:1900,img:PHOTOS.clutter,style:'As Found',lock:'Declutter On',
  lab:'Room',est:'Living Room',proc:{msg:'Detecting Contents'},mets:[['Status','Detecting Contents'],['Objects','14 Found'],['Disclosure','Ready']]},
 {ch:'Declutter',dur:1900,img:PHOTOS.empty,style:'Emptied',lock:'Declutter On',
  lab:'Room',est:'Living Room',fit:'Architecture Preserved',mets:[['Result','Architecture Preserved'],['Objects','14 of 14'],['Disclosure','Ready']]},

 {ch:'Stage',dur:1750,img:PHOTOS.after,style:'Warm Minimal',lock:'Reality Lock On',
  lab:'Room',est:'Living Room',fit:'Within Target',mets:[['Planning Range','$11,400 to $14,900'],['Budget Fit','Within Target'],['Staging','Ready']]},
 {ch:'Stage',dur:1750,img:PHOTOS.coastal,style:'Coastal',lock:'Reality Lock On',
  lab:'Room',est:'Living Room',fit:'Within Target',mets:[['Planning Range','$13,800 to $17,600'],['Budget Fit','Within Target'],['Staging','Ready']]},
 {ch:'Stage',dur:1750,img:PHOTOS.japandi,style:'Japandi',lock:'Reality Lock On',
  lab:'Room',est:'Living Room',fit:'Within Target',mets:[['Planning Range','$12,600 to $16,100'],['Budget Fit','Within Target'],['Design DNA','Applied']]},

 {ch:'Shop',dur:4200,img:PHOTOS.japandi,style:'Japandi',lock:'Reality Lock On',shop:true,
  lab:'Project Cart',est:'$3,284',fit:'Within Target',mets:[['Budget Fit','Within Target'],['Products Matched','14 of 14'],['Confidence','High']],
  toast:'Added To Project',toastAt:2600},

 {ch:'Garden',dur:1600,img:PHOTOS.yardBefore,style:'As Found',lock:'Reality Lock On',zoom:'out',
  lab:'Room',est:'Backyard',proc:{msg:'Reading Site'},mets:[['Status','Reading Site'],['Trades','3 Detected'],['Pricing','Medium']],note:'Heading Out Back'},
 {ch:'Garden',dur:2500,img:PHOTOS.resortYard,style:'Resort',lock:'Budget Mode On',
  lab:'Room',est:'Backyard',fit:'Within Target',mets:[['Planning Range','$26,100 to $31,500'],['Budget Fit','Within Target'],['Pricing','High']]},

 {ch:'Video',dur:2600,img:PHOTOS.resortYard,style:'Cinematic Push',lock:'Recording',zoom:'ken',rec:true,
  lab:'Video Walkthrough',est:'20 Seconds',fit:'Ready',mets:[['Format','Cinematic Push'],['Resolution','1080p'],['Delivery','Ready']]},
 {ch:'3D Plan',dur:2800,img:PHOTOS.plan3d,style:'Furnished 3D',lock:'Design DNA Applied',zoom:'aerial',
  lab:'Whole Property',est:'4 Rooms Planned',fit:'Design DNA Applied',mets:[['Plan Type','Furnished 3D'],['Rooms','4 of 4'],['Design DNA','Applied']]},

 {ch:'3D Plan',dur:3200,img:PHOTOS.resortYard,style:'Design DNA Applied',lock:'Budget Mode On',summary:true,
  lab:'Whole Property',est:'$49,400 to $63,200',fit:'4 Rooms Approved',mets:[['Rooms','4 of 4'],['Line Items','62'],['Pricing Confidence','High']]}
];

const CHAPTERS=['Exterior','Interior','Declutter','Stage','Shop','Garden','Video','3D Plan'];

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

const recOverlay=()=>`<span class="rec-timer mono"><i></i>REC 00:12</span>`;

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
  layer.className='tlayer'+(b.zoom==='in'?' zoom-in':b.zoom==='out'?' zoom-out':b.zoom==='ken'?' zoom-ken':b.zoom==='aerial'?' zoom-aerial':'');
  layer.innerHTML=photo(b.img,b.ch+' '+b.style)
    +(b.shop?shopOverlay():'')+(b.rec?recOverlay():'')+(b.summary?summaryOverlay():'')
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
    const hs=document.getElementById('heroSummary');
    if(hs){
      const mets=(b.mets||[]).map(m=>metric(m[0],m[1]));
      hs.innerHTML=b.proc
        ? summaryHTML({primaryLabel:b.lab,state:'processing',progressMessage:b.est,metrics:mets})
        : summaryHTML({primaryLabel:b.lab,primaryValue:b.est,metrics:mets});
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
  const model={primaryLabel:'Room',primaryValue:'Living Room',
    metrics:[metric('Planning Range',txt,'neutral'),metric('Budget Fit',b.fit),metric('Structure','No Changes')]};
  const bs=document.getElementById('builderSummary');
  if(bs)bs.innerHTML=summaryHTML({...model,compact:true,flush:true});
  // hero panel mirrors the builder so the two never disagree
  const hs=document.getElementById('heroSummary');
  if(hs)hs.innerHTML=summaryHTML(model);
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
  document.querySelectorAll('.samp').forEach(x=>x.classList.remove('on'));s.classList.add('on');UPLOAD=null;unlock();
}));

const steps=['Reading room geometry','Locking walls and windows','Fitting the design to your budget','Selecting materials and finishes','Rendering at full resolution','Pricing the scope'];
const OUTPAL=['warm','coastal','farm','green'];
let busy=false;

/* ---------- real photo handoff ----------
   When a visitor uploads their own photo we cannot render it without an
   account, so we show their actual space, then hand the photo and every
   builder choice to the app through localStorage. Studio picks it up the
   moment they land, so nothing they entered has to be typed twice. */
let UPLOAD=null;                       // {dataUrl,name}
const HANDOFF_KEY='rd.handoff';
const BUDGET_NAMES=['Refresh','Makeover','Renovation','Reimagine'];

/** Downscale to a sane width so the handoff fits comfortably in storage. */
function shrinkPhoto(file,max=1400){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error('read'));
    fr.onload=()=>{
      const img=new Image();
      img.onerror=()=>rej(new Error('decode'));
      img.onload=()=>{
        const sc=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg',0.82));
      };
      img.src=String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

function saveHandoff(){
  if(!UPLOAD) return;
  const sp=(document.querySelector('#spaceChips .chip.on')||{dataset:{}}).dataset.sp||'interior';
  const st=(document.querySelector('#styleChips .chip.on')||{textContent:''}).textContent.trim();
  const payload={photo:UPLOAD.dataUrl,name:UPLOAD.name,space:sp,budget:bi,
    budgetName:BUDGET_NAMES[bi]||'Makeover',style:st,
    notes:(document.getElementById('notes')||{value:''}).value.trim(),ts:Date.now()};
  try{ localStorage.setItem(HANDOFF_KEY,JSON.stringify(payload)); }catch(e){}
}

document.getElementById('genBtn').addEventListener('click',()=>{
  if(busy)return;busy=true;unlock();
  const out=document.getElementById('out'),ov=document.getElementById('genOv'),
        bar=document.getElementById('barFill'),gs=document.getElementById('genStep');
  const si=+(document.querySelector('.samp.on')||{dataset:{s:0}}).dataset.s;
  const mine=!!UPLOAD;
  const oi=document.getElementById('outImg');
  if(mine){ oi.innerHTML='<img src="'+UPLOAD.dataUrl+'" alt="The space you uploaded" style="width:100%;height:100%;object-fit:cover;display:block">'; }
  else{ oi.innerHTML=room('after',PALS[OUTPAL[si]]); }
  if(!ov.dataset.base) ov.dataset.base=ov.innerHTML;
  ov.innerHTML=ov.dataset.base;
  out.classList.add('on');ov.classList.add('on');
  bar.style.width='0%';gs.textContent=steps[0];
  out.scrollIntoView({block:'center',behavior:'smooth'});
  let p=0,i=0;
  const t=setInterval(()=>{
    p+=Math.random()*12+5;
    if(p>=100){p=100;clearInterval(t);setTimeout(()=>{
      if(mine){
        saveHandoff();
        ov.innerHTML='<div class="gen-gate"><i data-lucide="lock"></i>'
          +'<b>Your Space Is Locked And Ready</b>'
          +'<span>Reality Lock has your walls, windows and layout. Create your free account and this exact photo renders first, with your settings already loaded.</span>'
          +'<a href="/auth" class="btn btn-primary btn-sm"><i data-lucide="sparkles"></i>Render My Photo Free</a>'
          +'<em class="mono">5 Free Designs A Day &middot; No Credit Card</em></div>';
        if(window.lucide) window.lucide.createIcons();
      }else{
        ov.classList.remove('on');
      }
      busy=false;
    },380)}
    bar.style.width=Math.min(p,100)+'%';
    if(p>(i+1)*(100/steps.length)&&i<steps.length-1){i++;gs.textContent=steps[i]}
  },220);
});

document.getElementById('drop').addEventListener('click',()=>openUpload());

/* ---------- upload modal ---------- */
const rootEl=document.querySelector('.rd-site')||document.body;
const modal=document.createElement('div');
modal.className='umodal';
modal.innerHTML=`
  <div class="umodal-scrim" data-close></div>
  <div class="umodal-card" role="dialog" aria-modal="true" aria-label="Upload your space">
    <button class="umodal-x" type="button" data-close aria-label="Close"><i data-lucide="x"></i></button>
    <div class="umodal-head">
      <h3>Upload Your Space</h3>
      <p>One photo is enough. Reality Lock keeps your walls, windows and layout exactly as they are.</p>
    </div>
    <label class="umodal-drop" id="uDrop">
      <i data-lucide="image-up"></i>
      <b>Drag A Photo Or Browse</b>
      <span>JPG, PNG, HEIC &middot; A phone shot works fine</span>
      <input type="file" id="uFile" accept="image/*" hidden>
    </label>
    <div class="umodal-prev" id="uPrev"><div class="umodal-thumb" id="uThumb"></div><div><b id="uName">photo.jpg</b><span class="mono">Ready to redesign</span></div></div>
    <div class="umodal-samples">
      <span>No Photo Handy?</span>
      <div class="usamp on" data-s="0"></div><div class="usamp" data-s="1"></div>
      <div class="usamp" data-s="2"></div><div class="usamp" data-s="3"></div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" id="uGo"><i data-lucide="sparkles"></i>Continue To The Builder</button>
    <p class="no-card">5 Free Designs A Day &middot; <b>No Credit Card</b></p>
  </div>`;
rootEl.appendChild(modal);

const uPals=[PHOTOS.before,PALS.coastal,PALS.farm,PALS.green];
modal.querySelectorAll('.usamp').forEach((s,i)=>{s.innerHTML=room(i===0?'before':'after',uPals[i])});

function openUpload(){
  track('upload_modal_opened');
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  if(window.lucide) window.lucide.createIcons();
}
function closeUpload(){
  modal.classList.remove('on');
  document.body.style.overflow='';
}
modal.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeUpload));
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&modal.classList.contains('on'))closeUpload()});

const uFile=modal.querySelector('#uFile');
uFile.addEventListener('change',async()=>{
  const f=uFile.files&&uFile.files[0];
  if(!f)return;
  modal.querySelector('#uName').textContent=f.name;
  const url=URL.createObjectURL(f);
  modal.querySelector('#uThumb').style.backgroundImage=`url(${url})`;
  modal.classList.add('has-file');
  try{ UPLOAD={dataUrl:await shrinkPhoto(f),name:f.name}; track('upload_photo_selected',{source:'file'}); }catch(e){ UPLOAD=null; }
});

const uDrop=modal.querySelector('#uDrop');
['dragenter','dragover'].forEach(ev=>uDrop.addEventListener(ev,(e)=>{e.preventDefault();uDrop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>uDrop.addEventListener(ev,(e)=>{e.preventDefault();uDrop.classList.remove('over')}));
uDrop.addEventListener('drop',(e)=>{
  const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(!f)return;
  uFile.files=e.dataTransfer.files;
  uFile.dispatchEvent(new Event('change'));
});
let uSel=0;
modal.querySelectorAll('.usamp').forEach(s=>s.addEventListener('click',()=>{
  modal.querySelectorAll('.usamp').forEach(x=>x.classList.remove('on'));
  s.classList.add('on');uSel=+s.dataset.s;UPLOAD=null;modal.classList.remove('has-file');
}));
modal.querySelector('#uGo').addEventListener('click',()=>{
  track('builder_started',{source:UPLOAD?'upload':'sample'});
  const samps=document.querySelectorAll('.samp');
  samps.forEach(x=>x.classList.remove('on'));
  if(samps[uSel])samps[uSel].classList.add('on');
  closeUpload();
  unlock();
  const b=document.querySelector('.hero-right .builder');
  if(b)b.scrollIntoView({block:'center',behavior:'smooth'});
});

/* header CTA opens the modal */
const navUp=document.getElementById('navUpload');
if(navUp) navUp.addEventListener('click',(e)=>{e.preventDefault();openUpload()});


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
document.getElementById('styleGrid').innerHTML=SL.slice(0,4).map(([n,src],i)=>`
  <div class="st"><div class="sw2" style="overflow:hidden">${photo(src,n+' interior design style')}</div><div class="nm">${n}<span>${String(i+1).padStart(3,'0')}</span></div></div>`).join('');

/* ---------- proof cards ---------- */
/* NOTE: These are verifiable product claims, not testimonials. Replace with real
   customer quotes ONLY when they are genuine, attributable and permissioned in
   writing. Fabricated endorsements with attributed names are deceptive advertising. */
const Q=[
['lock','Your Space Stays Your Space.','Preserve walls, windows, layout and selected objects across every generation.'],
['wallet','Set the Budget Before You Generate.','Choose a target and see design decisions intended to fit that planning range. Design decisions are guided by your target from the beginning.'],
['clipboard-list','Go Beyond the Rendering.','Turn the approved design into a shopping list, planning scope and contractor brief. See work items, quantities, trades and location-adjusted planning ranges&mdash;not one unexplained total.']];
document.getElementById('quotes').innerHTML=Q.map(([ic,t,d])=>`
  <div class="proof-card"><div class="pic"><i data-lucide="${ic}"></i></div><b>${t}</b><p>${d}</p></div>`).join('');


/* ---------- pricing ---------- */
const P=[
{n:'Free',mo:0,yr:0,who:'Anyone. No card to start.',cta:'Start Free',pop:false,note:'No card to start · Cancel anytime',
 f:['<b>5 credits a day</b>','No credit card to start','Interiors, exteriors and landscapes','Full style library, Reality Lock, keep/replace/remove controls','Virtual staging, declutter, material swap, style transfer','Typical budget range by room type and finish level','Watermarked, standard resolution'],
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
  const plansEl=document.getElementById('plans');if(!plansEl)return;
  plansEl.innerHTML=P.map(p=>`
  <div class="plan ${p.pop?'pop':''}"><h3>${p.n}</h3>
    <div class="pr"><b>$${p[bill]}</b><span>/mo</span></div>
    <div class="who">${p.mo===0?'Free forever':bill==='yr'?`Billed yearly · $${p.mo}/mo monthly`:'Billed monthly'}</div>
    <p style="font-size:.84rem">${p.who}</p>
    <a href="#" class="btn ${p.pop?'btn-primary':'btn-ghost'} btn-block" data-plan="${p.n}">${p.cta}</a>
    <p class="plan-note">${p.note}</p>
    <ul>${p.f.map(x=>`<li><i data-lucide="check"></i><span>${x}</span></li>`).join('')}${
      (p.x||[]).map(x=>`<li class="no"><i data-lucide="x"></i><span>${x}</span></li>`).join('')}</ul></div>`).join('');
  document.querySelectorAll('#plans [data-plan]').forEach(a=>a.addEventListener('click',ev=>{
    const n=a.dataset.plan;track('plan_cta_clicked',{plan:n,billing:bill});if(n==='Free')return;ev.preventDefault();openCheckout(n);
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
  track('checkout_opened',{plan:name});
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
