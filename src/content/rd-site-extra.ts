// Extended marketing-page sections: gallery, workflow, control, empty-room,
// Design DNA, shop, present, pro workflows and the categorized feature explorer.
/* eslint-disable */
// @ts-nocheck
import { PHOTOS, photo } from "@/content/rd-photos";

const $ = (id: string) => document.getElementById(id);

export function initExtra(timers: number[], lucide: any) {
  const every = (fn: any, ms: number) => timers.push(window.setInterval(fn, ms));
  const after = (fn: any, ms: number) => timers.push(window.setTimeout(fn, ms));

  /* ---------- trust ribbon ---------- */
  const AUD = [
    ["home", "Homeowners"], ["trending-up", "Investors"], ["key-round", "Agents"],
    ["palette", "Designers"], ["hammer", "Contractors"], ["hard-hat", "Builders"],
    ["trees", "Landscapers"], ["building-2", "Property Managers"],
  ];
  const rr = $("ribbonRow");
  if (rr) rr.innerHTML = AUD.map(([i, t]) => `<span class="rb"><i data-lucide="${i}"></i>${t}</span>`).join("");

  /* ---------- hero demo tabs ---------- */
  const DEMOS: any = {
    redesign: {
      before: PHOTOS.before, after: PHOTOS.after,
      cap: ["Reality Lock On", "Walls, windows and layout preserved"],
      est: "$11,400 to $14,900",
      meta: [["Room", "Living Room"], ["Direction", "Warm Minimal"], ["Intensity", "Makeover"]],
      tags: ["Before", "After"],
    },
    empty: {
      before: PHOTOS.clutter, after: PHOTOS.empty,
      cap: ["Declutter to Empty", "Architecture kept, contents removed"],
      est: "$0 to $340",
      meta: [["Room", "Living Room"], ["Step", "Declutter, Empty"], ["Next", "Stage"]],
      tags: ["Occupied", "Emptied"],
    },
    shop: {
      before: PHOTOS.empty, after: PHOTOS.after,
      cap: ["14 Items Matched", "Best price, closest match or premium"],
      est: "Cart $6,240",
      meta: [["Matched", "14 Items"], ["Fit Checks", "Passed"], ["Cart", "$6,240"]],
      tags: ["Staged", "Shoppable"],
    },
    plan: {
      before: PHOTOS.kitchenBefore, after: PHOTOS.kitchen,
      cap: ["Scope Of Work Built", "18 line items, 6 trades, local rates"],
      est: "$26,200 to $34,100",
      meta: [["Room", "Kitchen"], ["Band", "Renovation"], ["Trades", "6"]],
      tags: ["Before", "Planned"],
    },
  };
  const dTabs = $("demoTabs");
  if (dTabs) {
    dTabs.querySelectorAll(".dtab").forEach((b: any) =>
      b.addEventListener("click", () => {
        dTabs.querySelectorAll(".dtab").forEach((x: any) => x.classList.remove("on"));
        b.classList.add("on");
        const d = DEMOS[b.dataset.d];
        const lb = $("lBefore"), la = $("lAfter");
        if (lb) lb.innerHTML = photo(d.before, "Original space before redesign");
        if (la) la.innerHTML = photo(d.after, "Redesigned space, AI render");
        const cap = $("sceneCap");
        if (cap) cap.innerHTML = `<b>${d.cap[0]}</b><span>${d.cap[1]}</span>`;
        const est = $("heroEst"); if (est) est.textContent = d.est;
        const meta = $("heroMeta");
        if (meta) meta.innerHTML = d.meta.map(([k, v]: any) => `<span>${k} <b>${v}</b></span>`).join("");
        const tl = $("tagL"), tr2 = $("tagR");
        if (tl) tl.textContent = d.tags[0];
        if (tr2) tr2.textContent = d.tags[1];
        const hl = $("hotLayer");
        if (hl) {
          hl.classList.toggle("on", b.dataset.d === "shop");
          hl.innerHTML = b.dataset.d === "shop"
            ? [["36%", "62%", "Sofa · $1,240"], ["66%", "48%", "Floor Lamp · $180"], ["18%", "78%", "Rug · $410"]]
                .map(([l, t, lab]) => `<span class="hs" style="left:${l};top:${t}"><i></i><b>${lab}</b></span>`).join("")
            : "";
        }
        const scan = $("scanLine");
        if (scan) { scan.classList.remove("run"); void (scan as any).offsetWidth; scan.classList.add("run"); }
      })
    );
  }

  /* ---------- gallery tabs ---------- */
  type GView = {
    name: string; before: string; after: string; cap: string;
    bl: string; al: string; stamp: string; chips: string[]; strength: [string, string, string][];
  };
  const V = (
    name: string, before: string, after: string, cap: string,
    bl: string, al: string, stamp: string, chips: string[],
    strength: [string, string, string][]
  ): GView => ({ name, before, after, cap, bl, al, stamp, chips, strength });

  const ARCH: [string,string,string] = ["ruler","Architecture Preserved","Windows, ceiling and perspective unchanged"];

  const INTERIOR_SUBS: [string, GView][] = [
    ["Living Room", V("Living Room", PHOTOS.wfOriginal, PHOTOS.wfDesigned,
      "Warm Minimal \u00b7 $11.4K to $14.9K", "Before", "After", "Within Target",
      ["Reality Lock On", "Makeover \u00b7 Under $15K", "Design DNA \u00b7 Warm Minimal"],
      [ARCH,
       ["paintbrush", "Finishes Updated", "Flooring, paint, furniture, drapery and lighting"],
       ["wallet", "Planning Range", "$11,400 to $14,900 \u00b7 within target"]])],
    ["Kitchen", V("Kitchen", PHOTOS.kitchenBefore, PHOTOS.kitchenAfter,
      "Warm Shaker \u00b7 $26.2K to $34.1K", "Before", "After", "Within Target",
      ["Reality Lock On", "Renovation \u00b7 Under $35K", "Design DNA \u00b7 Warm Shaker"],
      [["ruler", "Architecture Preserved", "Same footprint, appliance and window locations"],
       ["paintbrush", "Finishes Updated", "Cabinet fronts, counters, backsplash, flooring"],
       ["wallet", "Planning Range", "$26,200 to $34,100 \u00b7 cabinetry led"]])],
    ["Bathroom", V("Bathroom", PHOTOS.bathBefore, PHOTOS.bath,
      "Quiet Luxury \u00b7 $8.9K to $12.4K", "Before", "After", "Within Target",
      ["Reality Lock On", "Renovation \u00b7 Under $15K", "Design DNA \u00b7 Quiet Luxury"],
      [["ruler", "Architecture Preserved", "Tub, toilet and vanity stay exactly where they are"],
       ["paintbrush", "Finishes Updated", "Tile, vanity, mirror, lighting and flooring"],
       ["wallet", "Planning Range", "$8,900 to $12,400 \u00b7 no wall moves"]])],
    ["Bedroom", V("Bedroom", PHOTOS.bedroomBefore, PHOTOS.bedroomAfter,
      "Warm Minimal \u00b7 $7.8K to $10.6K", "Before", "After", "Within Target",
      ["Reality Lock On", "Makeover \u00b7 Under $15K", "Design DNA \u00b7 Warm Minimal"],
      [["ruler", "Architecture Preserved", "Window, closet doors and ceiling unchanged"],
       ["paintbrush", "Finishes Updated", "Carpet to oak, paint, bed, case goods, drapery"],
       ["wallet", "Planning Range", "$7,800 to $10,600 \u00b7 furniture led"]])],
    ["Office", V("Office", PHOTOS.officeBefore, PHOTOS.officeAfter,
      "Quiet Modern \u00b7 $5.2K to $7.4K", "Before", "After", "Within Target",
      ["Reality Lock On", "Refresh \u00b7 Under $8K", "Design DNA \u00b7 Quiet Modern"],
      [["ruler", "Architecture Preserved", "Window, door and outlet positions unchanged"],
       ["paintbrush", "Finishes Updated", "Flooring, paint, desk, seating and shelving"],
       ["wallet", "Planning Range", "$5,200 to $7,400 \u00b7 light scope"]])],
  ];

  const EXT = (name: string, cap: string, budget: string, strength: [string,string,string][]): [string, GView] =>
    [name, V(name, PHOTOS.exteriorBefore, PHOTOS.exteriorAfter, cap, "Before", "After", "Within Target",
      ["Reality Lock On", budget, "Design DNA \u00b7 Modern Classic"], strength)];

  const EXTERIOR_SUBS: [string, GView][] = [
    EXT("Front Elevation", "Front Elevation \u00b7 Modern Classic \u00b7 $11.9K to $16.8K", "Makeover \u00b7 Under $20K",
      [["ruler", "Architecture Preserved", "Rooflines, windows and perspective unchanged"],
       ["paintbrush", "Finishes Updated", "Siding color, trim, door, porch light"],
       ["wallet", "Planning Range", "$11,900 to $16,800 \u00b7 within target"]]),
    EXT("Rear Elevation", "Rear Elevation \u00b7 Modern Classic \u00b7 $9.4K to $13.2K", "Makeover \u00b7 Under $15K",
      [["ruler", "Architecture Preserved", "Door and window openings stay exactly as built"],
       ["paintbrush", "Finishes Updated", "Paint, deck stain, railings and rear lighting"],
       ["wallet", "Planning Range", "$9,400 to $13,200 \u00b7 within target"]]),
    EXT("Siding", "Siding \u00b7 Warm White Lap \u00b7 $7.6K to $10.9K", "Refresh \u00b7 Under $12K",
      [["ruler", "Architecture Preserved", "Same lap profile, same wall planes"],
       ["layers", "Finishes Updated", "Repaint in warm white with black trim"],
       ["wallet", "Planning Range", "$7,600 to $10,900 \u00b7 paint led"]]),
    EXT("Roofing", "Roofing \u00b7 Charcoal Architectural \u00b7 $14.2K to $19.5K", "Renovation \u00b7 Under $20K",
      [["ruler", "Architecture Preserved", "Same pitch, ridge height and roofline"],
       ["home", "Finishes Updated", "Architectural shingle in charcoal, new drip edge"],
       ["wallet", "Planning Range", "$14,200 to $19,500 \u00b7 tear-off included"]]),
    EXT("Curb Appeal", "Curb Appeal \u00b7 Modern Classic \u00b7 $5.8K to $8.3K", "Refresh \u00b7 Under $9K",
      [["ruler", "Architecture Preserved", "House footprint and driveway untouched"],
       ["sprout", "Finishes Updated", "Front beds, walkway, house numbers and lighting"],
       ["wallet", "Planning Range", "$5,800 to $8,300 \u00b7 highest resale return"]]),
  ];

  const LND = (name: string, cap: string, budget: string, strength: [string,string,string][]): [string, GView] =>
    [name, V(name, PHOTOS.yardBefore, PHOTOS.yardAfter, cap, "Before", "After", "Within Target",
      ["Reality Lock On", budget, "Design DNA \u00b7 Layered Modern"], strength)];

  const LANDSCAPE_SUBS: [string, GView][] = [
    LND("Front Yard", "Front Yard \u00b7 Layered Modern \u00b7 $8.9K to $12.6K", "Makeover \u00b7 Under $15K",
      [["ruler", "Architecture Preserved", "Property lines, walkway and grade unchanged"],
       ["sprout", "Planting Updated", "Ornamental grasses, boxwood and lawn repair"],
       ["wallet", "Planning Range", "$8,900 to $12,600 \u00b7 within target"]]),
    LND("Backyard", "Backyard \u00b7 Layered Modern \u00b7 $18.4K to $24.2K", "Renovation \u00b7 Under $25K",
      [["ruler", "Architecture Preserved", "House, fence line and grade unchanged"],
       ["squircle", "Hardscape Updated", "Concrete paver patio and connecting path"],
       ["wallet", "Planning Range", "$18,400 to $24,200 \u00b7 pergola included"]]),
    LND("Pool Area", "Pool Area \u00b7 Resort Calm \u00b7 $22.8K to $31.4K", "Renovation \u00b7 Under $35K",
      [["ruler", "Architecture Preserved", "Pool shell, coping line and setbacks unchanged"],
       ["squircle", "Hardscape Updated", "Deck resurfacing, planters and shade structure"],
       ["wallet", "Planning Range", "$22,800 to $31,400 \u00b7 surround only"]]),
    LND("Patio", "Patio \u00b7 Layered Modern \u00b7 $11.2K to $15.7K", "Makeover \u00b7 Under $16K",
      [["ruler", "Architecture Preserved", "Rear wall openings and grade unchanged"],
       ["squircle", "Hardscape Updated", "Paver terrace, edging, low seat wall"],
       ["wallet", "Planning Range", "$11,200 to $15,700 \u00b7 furniture excluded"]]),
    LND("Garden", "Garden \u00b7 Layered Modern \u00b7 $6.4K to $9.1K", "Refresh \u00b7 Under $10K",
      [["ruler", "Architecture Preserved", "Bed locations and mature trees retained"],
       ["sprout", "Planting Updated", "Perennial layers, mulch, drip irrigation"],
       ["wallet", "Planning Range", "$6,400 to $9,100 \u00b7 planting led"]]),
  ];

  const GAL: [string, GView | null][] = [
    ["Interior", null],
    ["Exterior", null],
    ["Landscape", null],
    ["Virtual Staging", V("Virtual Staging", PHOTOS.wfEmpty, PHOTOS.wfDesigned,
      "Vacant Listing \u00b7 Japandi \u00b7 Staged in 40 seconds", "Empty", "Staged", "Design Complete",
      ["Reality Lock On", "Listing Ready \u00b7 MLS Safe", "Design DNA \u00b7 Japandi"],
      [["sofa", "Empty To Furnished", "Furniture added, nothing structural altered"],
       ["camera", "Same Frame", "Identical perspective, walls, windows and light"],
       ["badge-info", "Disclosure Ready", "Virtually staged label and clean export included"]])],
    ["Floor Plan", V("Floor Plan", PHOTOS.plan2d, PHOTOS.plan3d,
      "2D Plan to 3D Visualization \u00b7 28' x 24' footprint", "2D Plan", "3D View", "Design Complete",
      ["Reality Lock On", "Plan Accurate \u00b7 To Scale", "Design DNA \u00b7 Warm Minimal"],
      [["ruler", "Dimensions Held", "Every wall, opening and room size matches the plan"],
       ["box", "Consistent 3D", "Same layout rendered room by room, not reinvented"],
       ["list-checks", "Plan To Scope", "Room areas feed material takeoffs and quantities"]])],
    ["Sketch to Render", V("Sketch to Render", PHOTOS.sketchHand, PHOTOS.sketchRender,
      "Hand Sketch \u00b7 Photoreal Concept \u00b7 Warm Minimal", "Sketch", "Render", "Design Complete",
      ["Reality Lock On", "Concept \u00b7 Under $15K", "Design DNA \u00b7 Warm Minimal"],
      [["pencil", "Sketch Read", "Perspective, window and furniture placement interpreted"],
       ["image", "Photoreal Concept", "Materials and daylight applied to your own drawing"],
       ["wallet", "Costed Concept", "Concept carries straight into a planning range"]])],
  ];

  const SUBS: Record<number, [string, GView][]> = {
    0: INTERIOR_SUBS, 1: EXTERIOR_SUBS, 2: LANDSCAPE_SUBS,
  };

  const gt = $("galTabs"), gsub = $("galSubs"), gtax = $("galTax");
  let gTab = 0;
  const gSubs: Record<number, number> = { 0: 0, 1: 0, 2: 0 };

  function galView(): GView {
    const subs = SUBS[gTab];
    return (subs ? subs[gSubs[gTab]][1] : GAL[gTab][1]) as GView;
  }
  function galPaint() {
    const v = galView();
    const gb = $("gsBefore"), ga = $("gsAfter"), gc = $("galCap");
    if (gb) gb.innerHTML = photo(v.before, v.name + " before");
    if (ga) ga.innerHTML = photo(v.after, v.name + " after, AI render");
    if (gc) gc.innerHTML = `<b>${v.name}</b><span class="mono">${v.cap}</span>`;
    const tl = $("galTagL"), tr = $("galTagR"), st = $("galStamp");
    if (tl) tl.textContent = v.bl;
    if (tr) tr.textContent = v.al;
    if (st) st.textContent = v.stamp;
    const ch = $("galChips");
    if (ch) ch.innerHTML = v.chips.map((c, i) =>
      `<span class="gc${i === 0 ? " lock" : ""}">${i === 0 ? '<i data-lucide="lock"></i>' : ""}${c}</span>`).join("");
    const sr = $("galStrength");
    if (sr) sr.innerHTML = v.strength.map(([ic, t, d]) =>
      `<div class="gstr"><i data-lucide="${ic}"></i><div><b>${t}</b><span>${d}</span></div></div>`).join("");
    lucide?.createIcons?.();
  }
  function galPaintSubs() {
    if (!gsub) return;
    const subs = SUBS[gTab];
    gsub.classList.toggle("on", !!subs);
    gtax?.classList.toggle("nosubs", !subs);
    gsub.innerHTML = !subs ? "" : subs.map(([n], i) =>
      `<button class="gsub ${i === gSubs[gTab] ? "on" : ""}" data-s="${i}">${n}</button>`).join("");
    gsub.querySelectorAll(".gsub").forEach((b: any) =>
      b.addEventListener("click", () => { gSubs[gTab] = +b.dataset.s; galPaintSubs(); galPaint(); }));
  }
  if (gt) {
    gt.innerHTML = GAL.map(([n], i) => `<button class="gtab ${i === 0 ? "on" : ""}" data-g="${i}">${n}</button>`).join("");
    gt.querySelectorAll(".gtab").forEach((b: any) =>
      b.addEventListener("click", () => {
        gt.querySelectorAll(".gtab").forEach((x: any) => x.classList.remove("on"));
        b.classList.add("on"); gTab = +b.dataset.g; galPaintSubs(); galPaint();
      })
    );
    galPaintSubs(); galPaint();
  }
  const grng = $("galRng") as any, gaf = $("gsAfter"), ghn = $("galHnd"), gstage = $("galStage");
  function setGC(v: number) {
    if (gaf) (gaf as any).style.clipPath = `inset(0 0 0 ${v}%)`;
    if (ghn) (ghn as any).style.left = v + "%";
  }
  if (grng) {
    let t = 0;
    const drag = (on: boolean) => {
      const v = galView();
      gstage?.classList.toggle("dragging", on);
      const tl = $("galTagL"), tr = $("galTagR");
      if (tl) tl.textContent = on ? "Original Photo" : v.bl;
      if (tr) tr.textContent = on ? "Reality Lock On" : v.al;
    };
    grng.addEventListener("input", (e: any) => {
      setGC(e.target.value); drag(true);
      window.clearTimeout(t); t = window.setTimeout(() => drag(false), 420); timers.push(t);
    });
    ["pointerup", "pointercancel", "blur"].forEach((ev) => grng.addEventListener(ev, () => drag(false)));
    setGC(50);
  }


  /* ---------- workflow ---------- */
  const FLOW = [
    ["image-up", "Upload", "Start with a room photo, listing image, floor plan or sketch."],
    ["wand-2", "Redesign", "Explore budget-guided designs while preserving the real space."],
    ["sliders-horizontal", "Refine", "Keep, replace, remove and lock any object."],
    ["calculator", "Estimate", "See line items, quantities, trades and location-based planning ranges."],
    ["shopping-bag", "Shop", "Match real products at the best-price, closest-match and premium levels."],
    ["send", "Execute", "Generate the contractor brief, approvals and project checklist."],
  ];
  const fr = $("flowRow");
  if (fr) fr.innerHTML = FLOW.map(([i, t, d], n) =>
    `<button type="button" class="fstep" data-n="${n}" data-step="${n}"><span class="fdot" aria-hidden="true"></span>
     <span class="fnum mono">${String(n + 1).padStart(2, "0")}</span>
     <div class="fic"><i data-lucide="${i}"></i></div><b>${t}</b><p>${d}</p></button>`).join("");

  // Same room, same camera across every stage. 04-06 reuse the designed frame
  // and only layer project information on top.
  const PROG = [
    { n: "Original", src: PHOTOS.wfOriginal, d: "Uploaded Aug 7", ov: "" },
    { n: "Empty", src: PHOTOS.wfEmpty, d: "14 objects removed", ov: "" },
    { n: "Designed", src: PHOTOS.wfDesigned, d: "Organic Modern &middot; Reality Lock On", ov: `<span class="pov lock"><i data-lucide="lock"></i>Reality Lock On</span>` },
    {
      n: "Budgeted", src: PHOTOS.wfDesigned, d: "$11.4K&ndash;$14.9K &middot; Within Target",
      ov: `<span class="pov cost"><b>$11,400&ndash;$14,900</b><i>Within Target</i></span>`,
    },
    {
      n: "Shopped", src: PHOTOS.wfDesigned, d: "8 products matched &middot; $3,284 selected",
      ov: `<span class="pshop" style="left:24%;top:62%"></span><span class="pshop" style="left:56%;top:70%"></span>
           <span class="pshop" style="left:76%;top:52%"></span><span class="pov shop">8 of 11 products matched</span>`,
    },
    {
      n: "Approved", src: PHOTOS.wfDesigned, d: "Approved by Keisha &middot; Version 4",
      ov: `<span class="pov appr"><i data-lucide="check"></i>Approved</span><span class="pav">K</span>`,
    },
  ];
  const ps = $("progStrip");
  if (ps) {
    ps.innerHTML = PROG.map((s, i) =>
      `<div class="pnode" data-n="${i}" data-step="${i}" tabindex="0"><div class="pim">${photo(s.src, s.n + " stage")}${s.ov}</div>
       <span class="mono">${String(i + 1).padStart(2, "0")} ${s.n}</span>
       <span class="pdet mono">${s.d}</span></div>`
    ).join('<span class="parrow"><i data-lucide="chevron-right"></i></span>');
  }

  /* activation: hover/click a card or node lights up the matching pair */
  const steps = () => Array.from(document.querySelectorAll(".rd-site .fstep, .rd-site .pnode"));
  function activate(n: number) {
    steps().forEach((el: any) => el.classList.toggle("on", +el.dataset.step === n));
    const fill = $("flowFill");
    if (fill) (fill as any).style.width = ((n + 1) / FLOW.length) * 100 + "%";
  }
  steps().forEach((el: any) => {
    el.addEventListener("mouseenter", () => activate(+el.dataset.step));
    el.addEventListener("focus", () => activate(+el.dataset.step));
    el.addEventListener("click", () => activate(+el.dataset.step));
  });
  activate(0);


  /* scroll-triggered walkthrough */
  const wf = document.getElementById("workflow");
  if (wf && "IntersectionObserver" in window) {
    let played = false;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting || played) return;
        played = true; io.disconnect();
        FLOW.forEach((_, i) => after(() => activate(i), 420 * i + 300));
      });
    }, { threshold: 0.28 });
    io.observe(wf);
  }


  /* ---------- precision control hotspots ---------- */
  const hi = $("hotImg");
  if (hi) hi.innerHTML = photo(PHOTOS.before, "Living room before redesign");
  const ha = $("hotAfter");
  if (ha) ha.innerHTML = photo(PHOTOS.after, "Living room after redesign with windows preserved");

  const HOTS = [
    { l: "32%", t: "64%", n: "Sofa", s: "" },
    { l: "70%", t: "34%", n: "Windows", s: "" },
    { l: "50%", t: "86%", n: "Flooring", s: "" },
    { l: "84%", t: "52%", n: "Lighting", s: "" },
    { l: "12%", t: "44%", n: "Wall Color", s: "" },
  ];
  const ICO: any = { keep: "lock", rep: "refresh-cw", rm: "x" };
  const VERB: any = { keep: "Keep", rep: "Replace", rm: "Remove" };
  const hd = $("hotDots"), hp = $("hotPop"), hpn = $("hotPopName");
  const hprompt = $("hotPrompt"), hmem = $("hotMem"), hroom = $("hotRoom");
  let active = -1;

  function decided() { return HOTS.filter((h) => h.s); }
  function syncMem() {
    const d = decided();
    if (hmem) {
      hmem.classList.toggle("on", d.length > 0);
      const b = hmem.querySelector("b");
      if (b) b.textContent = d.length + (d.length === 1 ? " decision remembered" : " decisions remembered");
    }
    if (hprompt) {
      const sp = hprompt.querySelector("span");
      if (sp) {
        const parts = d.map((h) => (h.s === "keep" ? "Do not change the " + h.n.toLowerCase() : VERB[h.s] + " the " + h.n.toLowerCase()));
        sp.textContent = parts.length ? parts.join(". ") + "." : "Tap any object to set what the AI may touch";
      }
      hprompt.classList.toggle("on", d.length > 0);
    }
    hroom?.classList.toggle("show-after", d.length >= 2);
    const ps = $("presStamp");
    ps?.classList.toggle("on", HOTS.some((h) => h.n === "Windows" && h.s === "keep"));
  }
  function paint() {
    hd?.querySelectorAll(".hdot").forEach((b: any, i: number) => {
      const st = HOTS[i].s;
      b.className = "hdot" + (st ? " " + st : "") + (i === active ? " sel" : "");
      b.innerHTML = st ? `<i data-lucide="${ICO[st]}"></i>` : "<i></i>";
    });
    lucide?.createIcons?.();
  }
  function openPop(i: number) {
    active = i;
    if (hp) {
      const h = HOTS[i];
      if (hpn) hpn.textContent = h.n;
      hp.style.left = h.l; hp.style.top = h.t;
      hp.classList.add("on");
      hp.querySelectorAll("button").forEach((x: any) => x.classList.toggle("on", x.dataset.a === h.s));
    }
    paint();
  }
  function choose(a: string) {
    if (active < 0) return;
    HOTS[active].s = a;
    hp?.classList.remove("on");
    paint(); syncMem();
  }
  if (hd) {
    hd.innerHTML = HOTS.map((h, i) =>
      `<button class="hdot" data-h="${i}" style="left:${h.l};top:${h.t}" aria-label="${h.n}"><i></i></button>`).join("");
    hd.querySelectorAll(".hdot").forEach((b: any) =>
      b.addEventListener("click", (e: any) => { e.stopPropagation(); openPop(+b.dataset.h); }));
  }
  hp?.querySelectorAll("button").forEach((b: any) =>
    b.addEventListener("click", (e: any) => { e.stopPropagation(); choose(b.dataset.a); }));
  hroom?.addEventListener("click", () => { hp?.classList.remove("on"); active = -1; paint(); });
  syncMem(); paint();

  /* scroll-triggered demo: cursor picks Replace on sofa, Keep on windows */
  if (hroom && hd) {
    const cur = document.createElement("span");
    cur.className = "hot-cursor";
    hroom.appendChild(cur);
    const moveTo = (i: number) => { cur.style.left = HOTS[i].l; cur.style.top = HOTS[i].t; cur.classList.add("on"); };
    let played = false;
    const play = () => {
      if (played) return; played = true;
      after(() => moveTo(0), 400);
      after(() => { cur.classList.add("tap"); openPop(0); }, 1300);
      after(() => cur.classList.remove("tap"), 1600);
      after(() => choose("rep"), 2100);
      after(() => moveTo(1), 2600);
      after(() => { cur.classList.add("tap"); openPop(1); }, 3400);
      after(() => cur.classList.remove("tap"), 3700);
      after(() => choose("keep"), 4200);
      after(() => cur.classList.remove("on"), 4700);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { play(); io.disconnect(); } }), { threshold: 0.4 });
      io.observe(hroom);
    } else play();
  }

  /* ---------- reality lock rows ---------- */
  const LOCKS = [
    ["arch", "Architecture", "Walls, windows, doors and fixed openings", true],
    ["layout", "Layout", "Room geometry and camera perspective", true],
    ["objects", "Selected Objects", 'Anything marked "Keep"', true],
  ];
  const lr = $("lockRows");
  if (lr) lr.innerHTML = LOCKS.map(([k, n, d, on]) =>
    `<div class="lrow" data-k="${k}"><div><b>${n}</b><span>${d}</span></div><span class="lsw ${on ? "on" : ""}" role="switch" aria-label="${n}"></span></div>`).join("");
  const master = $("lockMaster"), explore = $("exploreSw");
  const rowSw = (k: string) => lr?.querySelector(`.lrow[data-k="${k}"] .lsw`) as any;
  function syncLocks() {
    const off = !master?.classList.contains("on");
    lr?.querySelectorAll(".lrow").forEach((r: any) => r.classList.toggle("dim", off));
    const ex = explore?.classList.contains("on");
    const ls = rowSw("layout");
    if (ls) { ls.classList.toggle("on", !off && !ex); ls.classList.toggle("locked-off", !!ex); }
    lr?.querySelector('.lrow[data-k="layout"]')?.classList.toggle("overridden", !!ex);
  }
  lr?.querySelectorAll(".lrow .lsw").forEach((sw: any) =>
    sw.addEventListener("click", () => {
      if (sw.classList.contains("locked-off")) return;
      sw.classList.toggle("on");
    }));
  master?.addEventListener("click", () => { master.classList.toggle("on"); syncLocks(); });
  explore?.addEventListener("click", () => { explore.classList.toggle("on"); syncLocks(); });
  syncLocks();

  /* ---------- empty room workflow ---------- */
  const ES = [
    ["Cluttered", PHOTOS.clutter, "Occupied photo, straight off a phone.", "eraser"],
    ["Decluttered", PHOTOS.before, "Boxes, laundry and personal items pulled.", "sparkles"],
    ["Empty", PHOTOS.empty, "Furniture gone, architecture untouched.", "square-dashed"],
    ["Staged", PHOTOS.after, "Restaged in the property Design DNA.", "sofa"],
    ["Shoppable", PHOTOS.luxury, "Every piece matched and added to the budget.", "shopping-bag"],
  ];
  const et = $("estepTabs");
  function setES(i: number) {
    const [n, src, d] = ES[i] as any;
    const im = $("emptyImg"), cp = $("emptyCap");
    if (im) im.innerHTML = photo(src, n + " living room");
    if (cp) cp.innerHTML = `<b>${n}</b><span>${d}</span>`;
    et?.querySelectorAll(".estep").forEach((x: any, n2: number) => x.classList.toggle("on", n2 === i));
  }
  if (et) {
    et.innerHTML = ES.map(([n, , , ic], i) =>
      `<button class="estep ${i === 0 ? "on" : ""}" data-e="${i}"><i data-lucide="${ic}"></i>${n}</button>`).join("");
    et.querySelectorAll(".estep").forEach((b: any) => b.addEventListener("click", () => setES(+b.dataset.e)));
    setES(0);
    let ei = 0, autoES = true;
    et.addEventListener("click", () => (autoES = false));
    every(() => { if (autoES) { ei = (ei + 1) % ES.length; setES(ei); } }, 2600);
  }

  /* ---------- design DNA ring ---------- */
  const DNA = [
    ["Kitchen", PHOTOS.kitchen], ["Living Room", PHOTOS.after], ["Primary Bath", PHOTOS.bath],
    ["Front Elevation", PHOTOS.paintedBrick], ["Backyard", PHOTOS.resortYard], ["Guest Room", PHOTOS.japandi],
  ];
  const dr = $("dnaGrid");
  if (dr) dr.innerHTML = DNA.map(([n, src]) =>
    `<figure class="dcell">${photo(src, n + " in the property Design DNA")}<figcaption>${n}</figcaption></figure>`).join("");

  /* ---------- shop ---------- */
  const si = $("shopImg");
  if (si) si.innerHTML = photo(PHOTOS.after, "Designed living room with matched products");
  const SHOP = [
    ["Low Profile Sofa", "92in · fits 104in wall", [["Best Price", "$690"], ["Closest Match", "$1,240"], ["Premium Pick", "$2,480"]], 1],
    ["Wool Area Rug", "8x10 · fits seating zone", [["Best Price", "$210"], ["Closest Match", "$410"], ["Premium Pick", "$980"]], 1],
    ["Arc Floor Lamp", "68in · matte black", [["Best Price", "$96"], ["Closest Match", "$180"], ["Premium Pick", "$430"]], 2],
  ];
  const sl = $("shopList");
  if (sl) {
    sl.innerHTML = SHOP.map(([n, d, opts, sel]: any, i) => `
      <div class="sitem" data-i="${i}">
        <div class="shead"><div><b>${n}</b><span class="mono">${d}</span></div><span class="match mono">98% match</span></div>
        <div class="sopts">${opts.map(([l, p]: any, j: number) =>
          `<button class="sopt ${j === sel ? "on" : ""}" data-j="${j}" data-p="${p.replace(/[^0-9]/g, "")}"><span>${l}</span><b>${p}</b></button>`).join("")}</div>
      </div>`).join("") + `<div class="scart"><span>Added To Project</span><b id="cartTot">$1,830</b></div>`;
    const recalc = () => {
      let t = 0;
      sl.querySelectorAll(".sopt.on").forEach((o: any) => (t += +o.dataset.p));
      const ct = $("cartTot"); if (ct) ct.textContent = "$" + t.toLocaleString();
    };
    sl.querySelectorAll(".sitem").forEach((it: any) =>
      it.querySelectorAll(".sopt").forEach((o: any) =>
        o.addEventListener("click", () => {
          it.querySelectorAll(".sopt").forEach((x: any) => x.classList.remove("on"));
          o.classList.add("on"); recalc();
        })));
    recalc();
  }

  /* ---------- present ---------- */
  const PRES = [
    ["video", "Walkthrough Video", "5, 10 or 20 second cinematic camera move from a single still.", PHOTOS.luxury, "16:9 · 1:1 · 9:16"],
    ["git-compare", "Before / After Reveal", "The wipe that sells the job, branded or unbranded.", PHOTOS.after, "Social ready"],
    ["clapperboard", "Social Reel", "Original, transformation, product highlights, project range.", PHOTOS.midcentury, "Vertical 9:16"],
    ["layout-grid", "Product Board", "Every matched piece with price, dimensions and availability.", PHOTOS.neutral, "PDF · Link"],
    ["users", "Client Approval Link", "Clients favorite, comment and approve on a branded page.", PHOTOS.japandi, "Tracked activity"],
    ["shield-check", "Listing Disclosure", "Staged photos labeled to MLS and state rules with an audit trail.", PHOTOS.coastal, "Compliance"],
  ];
  const pg = $("presentGrid");
  if (pg) pg.innerHTML = PRES.map(([ic, t, d, src, tag]) => `
    <div class="pcard"><div class="pim">${photo(src, t)}<span class="pplay"><i data-lucide="${ic}"></i></span><span class="ptag mono">${tag}</span></div>
    <h3>${t}</h3><p>${d}</p></div>`).join("");

  /* ---------- pro workflows ---------- */
  type Role = [string, string, string, string, [string, string, string][], string];
  const PRO: Role[] = [
    ["Investor", PHOTOS.neutral, "See The Design And The Deal Before You Commit.",
      "Compare renovation levels, understand the planning range and see how each design direction could affect the property.",
      [["wallet", "Budget Options", "Compare refresh, makeover and renovation scenarios."],
       ["trending-up", "Value Insight", "Review potential ARV impact against recent comps."],
       ["list-checks", "Complete Scope", "Roll every approved room into one property budget."]],
      "Plan An Investment Property"],
    ["Agent", PHOTOS.coastal, "Help Buyers See What The Property Could Become.",
      "Stage every listing photo in one direction, then hand sellers and buyers a presentation that looks like your brand.",
      [["sofa", "Virtual Staging", "Furnish empty rooms across the whole photo set."],
       ["eye", "Buyer-Ready Concepts", "Show the potential without a rental truck."],
       ["presentation", "Branded Presentations", "Send a seller deck with your logo on it."]],
      "Create A Buyer Presentation"],
    ["Designer", PHOTOS.japandi, "Explore Faster Without Losing Creative Control.",
      "Set the palette and materials once, then move through rooms and revisions without redoing the concept every time.",
      [["palette", "Design DNA", "One style system applied across every room."],
       ["mouse-pointer-click", "Object-Level Control", "Keep, swap or restyle individual pieces."],
       ["shopping-bag", "Product Matching", "Real products at three price levels."]],
      "Explore Design Tools"],
    ["Contractor", PHOTOS.kitchen, "Turn The Approved Look Into A Clearer Scope.",
      "Take the design the client signed off on and turn it into work items, quantities and a proposal you can send the same day.",
      [["hammer", "Work Items", "Line item scope built from the room photo."],
       ["ruler", "Quantities And Trades", "Measured quantities with local rate assumptions."],
       ["file-check", "Client Approvals", "Signed off versions with a change log."]],
      "See The Contractor Workflow"],
    ["Builder", PHOTOS.craftsman, "Keep Every Room Consistent Across The Property.",
      "Lock a finish package once and carry it through model homes, whole properties and entire communities.",
      [["layers", "Finish Packages", "One locked package, reused everywhere."],
       ["home", "Multi-Room Consistency", "Every room reads like the same project."],
       ["sliders-horizontal", "Budget Scenarios", "Price good, better and best side by side."]],
      "Plan A Spec Property"],
    ["Landscaper", PHOTOS.resortYard, "Show The Finished Property, Front Yard To Backyard.",
      "Present hardscape, planting and lighting together so the client sees the finished property, not a plant list.",
      [["trees", "Landscape Concepts", "Hardscape, planting, pool and lighting passes."],
       ["house", "Exterior Coordination", "The yard matched to the house design."],
       ["calculator", "Outdoor Planning Ranges", "Material coverage with a planning range."]],
      "Plan An Outdoor Project"],
  ];
  const pt = $("proTabs");
  function setPro(i: number) {
    const [n, src, title, desc, cards, cta] = PRO[i];
    pt?.querySelectorAll(".ptab").forEach((x: any, j: number) => x.classList.toggle("on", j === i));
    const pp = $("proPanel");
    if (pp) pp.innerHTML = `
      <div class="pro-im">${photo(src, n + " project preview")}<span class="stamp">${n.toUpperCase()}</span></div>
      <div class="pro-tx">
        <h3>${title}</h3>
        <p class="pro-desc">${desc}</p>
        <div class="pro-mini">${cards.map(([ic, t, d]) =>
          `<div class="pmini"><i data-lucide="${ic}"></i><b>${t}</b><span>${d}</span></div>`).join("")}</div>
        <a class="pro-cta" href="/auth">${cta}<i data-lucide="arrow-right"></i></a>
      </div>`;
    lucide.createIcons();
  }
  if (pt) {
    pt.innerHTML = PRO.map(([n], i) => `<button class="ptab ${i === 0 ? "on" : ""}" data-p="${i}">${n}</button>`).join("");
    pt.querySelectorAll(".ptab").forEach((b: any) => b.addEventListener("click", () => setPro(+b.dataset.p)));
    setPro(0);
  }



  /* ---------- comparison table ---------- */
  const CMP: [string, string, string, string, string][] = [
    ["Redesign interiors, exteriors and landscapes", "yes", "Varies", "Limited", "yes"],
    ["Preserve architecture and control individual objects", "yes", "Limited", "Usually", "yes"],
    ["Apply one Design DNA across an entire property", "yes", "no", "no", "Manual"],
    ["Design around a target budget", "yes", "no", "no", "yes"],
    ["Generate line item scope and planning ranges", "yes", "Limited", "no", "Varies"],
    ["Track rooms, versions and approvals", "yes", "Limited", "Limited", "Manual"],
    ["Typical first concepts", "Minutes", "Minutes", "Minutes", "Days to weeks"],
    ["Create a contractor ready scope and brief", "yes", "no", "no", "Varies"],
    ["Match real products at three price levels", "yes", "Limited", "Limited", "yes"],
    ["Create listing ready staging in batches", "yes", "Limited", "yes", "Manual"],
    ["Client approval links", "yes", "no", "Limited", "yes"],
    ["Walkthrough videos", "yes", "Limited", "Limited", "Varies"],
    ["Social presentation packages", "yes", "no", "Limited", "Varies"],
    ["Team collaboration", "yes", "Limited", "Limited", "yes"],
    ["Commercial use exports", "yes", "Varies", "yes", "yes"],
  ];

  const cell = (v: string, us = false) =>
    v === "yes"
      ? `<span class="cm ok${us ? " us" : ""}"><i data-lucide="check"></i></span>`
      : v === "no"
        ? `<span class="cm none">&mdash;</span>`
        : `<span class="cm soft">${v}</span>`;
  const cmpBody = $("cmpBody"), cmpMore = $("cmpMore");
  if (cmpBody) {
    cmpBody.innerHTML = CMP.map(([cap, a, b, c, d], i) => `
      <tr class="${i >= 7 ? "cmp-extra" : ""}">
        <th scope="row">${cap}</th>
        <td class="cmp-us">${cell(a, true)}</td>
        <td>${cell(b)}</td><td>${cell(c)}</td><td>${cell(d)}</td>
      </tr>`).join("");
    cmpMore?.addEventListener("click", () => {
      const open = document.getElementById("cmpTable")?.classList.toggle("all");
      cmpMore.innerHTML = open ? "Show Fewer Rows" : "View The Full Comparison &rarr;";
    });
    lucide.createIcons();
  }

  /* ---------- reveal + icons for everything above ---------- */
  const io = new IntersectionObserver(
    (e) => e.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }),
    { threshold: 0.08 }
  );
  document.querySelectorAll(".rv:not(.in)").forEach((el) => io.observe(el));
  after(() => lucide.createIcons(), 0);
  lucide.createIcons();

  /* ---------- sketch to plan to photoreal ---------- */
  const P3: [string, string, string, string, string, boolean][] = [
    ["Source", "file-pen", "Source Sketch", "Hand-drawn walls, doors, windows and kitchen placement.", PHOTOS.sketchHand, true],
    ["Clean Plan", "ruler", "Clean Plan", "The exact same geometry squared into a measured architectural plan.", PHOTOS.plan2d, true],
    ["Furnished Plan", "sofa", "Furnished Plan", "Same walls and openings, furnished in your Design DNA.", PHOTOS.plan3d, true],
    ["Photoreal", "camera", "Photoreal View", "Eye level from the marked camera position, ready to price and present.", PHOTOS.sketchRender, false],
  ];

  const p3n = $("p3Nav"), p3s = $("p3Stage"), p3c = $("p3Cap");
  if (p3n && p3s) {
    p3n.innerHTML = P3.map(([short, ic], i) =>
      `<button class="p3step${i === 0 ? " on" : ""}" data-n="${i}">
         <i class="p3dot"><i data-lucide="${i === 0 ? ic : "check"}"></i></i>
         <span class="mono">0${i + 1}</span><b>${short}</b>
       </button>`).join("");
    let p3i = 0, p3t: any = null;
    const showP3 = (i: number) => {
      p3i = i;
      const [, , t, d, src, contain] = P3[i];
      const cam = i === 2 ? `<span class="p3cam"><i data-lucide="camera"></i></span>` : "";
      const layer = document.createElement("div");
      layer.className = "p3layer" + (contain ? " fit" : "");
      layer.innerHTML = photo(src, t) + cam;
      p3s.appendChild(layer);
      requestAnimationFrame(() => layer.classList.add("on"));
      Array.from(p3s.children).forEach((c: any) => { if (c !== layer) setTimeout(() => c.remove(), 500); });
      if (p3c) p3c.innerHTML = `<b>${t}</b><span>${d}</span>`;
      p3n.querySelectorAll(".p3step").forEach((b: any, j: number) => {
        b.classList.toggle("on", j === i);
        b.classList.toggle("done", j < i);
        const ico = b.querySelector(".p3dot i");
        if (ico) ico.setAttribute("data-lucide", j < i ? "check" : P3[j][1]);
      });
      lucide.createIcons();
    };
    const loop = () => { p3t = setTimeout(() => { showP3((p3i + 1) % P3.length); loop(); }, 3600); };
    p3n.querySelectorAll(".p3step").forEach((b: any) =>
      b.addEventListener("click", () => { clearTimeout(p3t); showP3(Number(b.dataset.n)); loop(); }));
    showP3(0); loop();
  }


  /* ---------- device showcase screens ---------- */
  const devShots: [string, string][] = [
    ["devShotA", PHOTOS.after],
    ["devShotB", PHOTOS.before],
    ["devShotC", PHOTOS.kitchenAfter],
    ["devShotD", PHOTOS.before],
    ["devShotE", PHOTOS.after],
  ];
  devShots.forEach(([id, src]) => {
    const el = $(id);
    if (el) el.style.backgroundImage = `url(${src})`;
  });


  /* ---------- budget bands -> scope of work ---------- */
  const BANDS = [
    { sub: "Living Room &middot; Warm Minimal &middot; Refresh Band", total: "$3.2K to $5K", rows: [
      ["Paint, Walls And Ceiling", "Painter", "1 rm", "$580 to $760"],
      ["Cabinet Refacing, Doors", "Carpentry", "18 ea", "$1,150 to $1,700"],
      ["Hardware And Fixtures", "Carpentry", "22 ea", "$240 to $360"],
      ["Lighting Swap, Surface", "Electrical", "4 ea", "$380 to $560"],
      ["Styling Package", "Furnishings", "1 set", "$850 to $1,120"],
    ]},
    { sub: "Living Room &middot; Warm Minimal &middot; Makeover Band", total: "$11.4K to $14.9K", rows: [
      ["LVP Flooring, Installed", "Flooring", "340 sf", "$1,700 to $2,100"],
      ["Paint, Walls And Ceiling", "Painter", "1 rm", "$580 to $760"],
      ["Recessed Lighting, 6 Cans", "Electrical", "6 ea", "$1,020 to $1,380"],
      ["Baseboard And Casing", "Carpentry", "76 lf", "$430 to $620"],
      ["Drywall Repair And Texture", "Drywall", "1 rm", "$340 to $520"],
      ["Furnishing Package", "Furnishings", "1 set", "$2,900 to $3,800"],
    ]},
    { sub: "Living Room &middot; Warm Minimal &middot; Renovation Band", total: "$26K to $35K", rows: [
      ["Demolition And Haul Off", "General", "1 lot", "$1,200 to $1,800"],
      ["Cabinetry, New Boxes", "Carpentry", "24 lf", "$8,400 to $11,200"],
      ["Island With Counter", "Carpentry", "1 ea", "$3,100 to $4,300"],
      ["Appliance Package", "Appliances", "4 ea", "$4,200 to $6,000"],
      ["Electrical Rough And Trim", "Electrical", "1 lot", "$2,300 to $3,100"],
      ["Flooring And Trim", "Flooring", "340 sf", "$2,600 to $3,400"],
    ]},
  ];
  const BFC = [
    { range: "$3.2K&ndash;$5K", items: "5", status: "Within Target", img: PHOTOS.neutral,
      scope: [["Paint", "1 room"], ["Cabinet Refacing", "18 doors"], ["Lighting Swap", "4 fixtures"]] },
    { range: "$11.4K&ndash;$14.9K", items: "6", status: "Within Target", img: PHOTOS.after,
      scope: [["Flooring", "340 sf"], ["Paint", "1 room"], ["Lighting", "6 cans"]] },
    { range: "$26K&ndash;$35K", items: "6", status: "Within Target", img: PHOTOS.kitchen,
      scope: [["Cabinetry", "24 lf"], ["Appliances", "4 units"], ["Flooring", "340 sf"]] },
    { range: "Your Number", items: "&mdash;", status: "Priced To Fit", img: PHOTOS.luxury,
      scope: [["Flooring", "Optional"], ["Paint", "Optional"], ["Lighting", "Optional"]] },
  ];
  const bfSeg = $("bfSeg"), bfImg = $("bfImg"), bfScope = $("bfScope");
  if (bfSeg && bfImg && bfScope) {
    const paintBFC = (n: number) => {
      const b = BFC[n]; if (!b) return;
      bfImg.innerHTML = photo(b.img, "Room designed to a target budget");
      const r = $("bfRange"), it = $("bfItems"), st = $("bfStatus");
      if (r) r.innerHTML = b.range;
      if (it) it.innerHTML = b.items;
      if (st) st.innerHTML = b.status;
      bfScope.innerHTML = b.scope.map(([n2, q]) =>
        `<li><span>${n2}</span><em class="mono">${q}</em></li>`).join("");
      lucide?.createIcons?.();
    };
    bfSeg.querySelectorAll("button").forEach((b: any) =>
      b.addEventListener("click", () => {
        bfSeg.querySelectorAll("button").forEach((o: any) => o.classList.remove("on"));
        b.classList.add("on");
        paintBFC(Number(b.dataset.b));
      }));
    paintBFC(1);

    /* ----- action footer: outputs + simulated previews ----- */
    const bfBtns = $("bfBtns"), bfPrev = $("bfPrev"), bfView = $("bfView");
    const ACTS: Record<string, [string, string, string][]> = {
      pro: [
        ["brief", "file-text", "Contractor Brief"],
        ["shop", "shopping-bag", "Product Schedule"],
        ["share", "send", "Send To Client"],
      ],
      home: [
        ["brief", "file-text", "Project Checklist"],
        ["shop", "shopping-bag", "Shopping List"],
        ["share", "send", "Share Project"],
      ],
    };
    const PREV: Record<string, string> = {
      brief: `<div class="bfp-head"><b>Contractor Brief</b><span class="mono">Preview</span></div>
        <ul class="bfp-rows">
          <li><span>Project Summary</span><em>Living Room &middot; Warm Minimal</em></li>
          <li><span>Work Items</span><em>6 Items</em></li>
          <li><span>Required Trades</span><em>Flooring, Paint, Electrical</em></li>
          <li><span>Planning Range</span><em>$11.4K&ndash;$14.9K</em></li>
        </ul>
        <a href="/auth" class="btn btn-primary btn-sm"><i data-lucide="download"></i>Download PDF</a>`,
      shop: `<div class="bfp-head"><b>Shopping List</b><span class="mono">8 Of 11 Products Matched</span></div>
        <ul class="bfp-rows">
          <li><span>Sofa</span><em>Closest Match</em></li>
          <li><span>Coffee Table</span><em>Best Price</em></li>
          <li><span>Floor Lamp</span><em>Premium</em></li>
        </ul>
        <a href="/auth" class="btn btn-primary btn-sm"><i data-lucide="shopping-bag"></i>View Shopping List</a>`,
      share: `<div class="bfp-head"><b>Share Project</b><span class="mono ok">Ready To Share</span></div>
        <div class="bfp-link"><i data-lucide="link"></i><span>realdesigns.ai/p/bayshore-living</span></div>
        <ul class="bfp-rows">
          <li><span>View Only</span><em>Anyone With The Link</em></li>
          <li><span>Approval Access</span><em>Client Can Approve Items</em></li>
        </ul>
        <a href="/auth" class="btn btn-primary btn-sm"><i data-lucide="copy"></i>Copy Link</a>`,
    };
    if (bfBtns && bfPrev && bfView) {
      let mode = "pro", open = "";
      const paintPrev = () => {
        if (!open) { bfPrev.className = "bfc-prev"; bfPrev.innerHTML = ""; return; }
        bfPrev.className = "bfc-prev on";
        bfPrev.innerHTML = PREV[open];
        lucide?.createIcons?.();
      };
      const paintBtns = () => {
        bfBtns.innerHTML = ACTS[mode].map(([k, ic, lab]) =>
          `<button class="bfc-out${open === k ? " on" : ""}" data-k="${k}"><i data-lucide="${ic}"></i>${lab}</button>`).join("");
        bfBtns.querySelectorAll("button").forEach((b: any) =>
          b.addEventListener("click", () => {
            open = open === b.dataset.k ? "" : b.dataset.k;
            paintBtns(); paintPrev();
          }));
        lucide?.createIcons?.();
      };
      bfView.querySelectorAll("button").forEach((b: any) =>
        b.addEventListener("click", () => {
          bfView.querySelectorAll("button").forEach((o: any) => o.classList.remove("on"));
          b.classList.add("on"); mode = b.dataset.v; paintBtns();
        }));
      paintBtns();
    }
  }



}
