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
  const GAL = [
    ["Interior", PHOTOS.before, PHOTOS.after, "Living Room · Warm Minimal · $11.4K to $14.9K"],
    ["Exterior", PHOTOS.exteriorBefore, PHOTOS.paintedBrick, "Front Elevation · Painted Brick · $11.9K to $16.8K"],
    ["Landscape", PHOTOS.yardBefore, PHOTOS.resortYard, "Backyard · Resort · $18.4K to $24.2K"],
    ["Virtual Staging", PHOTOS.empty, PHOTOS.japandi, "Vacant Listing · Japandi · Staged in 40 seconds"],
    ["Kitchen", PHOTOS.kitchenBefore, PHOTOS.kitchen, "Kitchen · Renovation Band · $26.2K to $34.1K"],
    ["Bath", PHOTOS.clutter, PHOTOS.bath, "Primary Bath · Quiet Luxury · $8.9K to $12.4K"],
  ];
  const gt = $("galTabs");
  function setGal(i: number) {
    const [n, b, a, cap] = GAL[i] as any;
    const gb = $("gsBefore"), ga = $("gsAfter"), gc = $("galCap");
    if (gb) gb.innerHTML = photo(b, n + " before");
    if (ga) ga.innerHTML = photo(a, n + " after, AI render");
    if (gc) gc.innerHTML = `<b>${n}</b><span class="mono">${cap}</span>`;
  }
  if (gt) {
    gt.innerHTML = GAL.map(([n], i) => `<button class="gtab ${i === 0 ? "on" : ""}" data-g="${i}">${n}</button>`).join("");
    gt.querySelectorAll(".gtab").forEach((b: any) =>
      b.addEventListener("click", () => {
        gt.querySelectorAll(".gtab").forEach((x: any) => x.classList.remove("on"));
        b.classList.add("on"); setGal(+b.dataset.g);
      })
    );
    setGal(0);
  }
  const grng = $("galRng") as any, gaf = $("gsAfter"), ghn = $("galHnd");
  function setGC(v: number) {
    if (gaf) (gaf as any).style.clipPath = `inset(0 0 0 ${v}%)`;
    if (ghn) (ghn as any).style.left = v + "%";
  }
  if (grng) { grng.addEventListener("input", (e: any) => setGC(e.target.value)); setGC(50); }

  /* ---------- workflow ---------- */
  const FLOW = [
    ["image-up", "Upload", "One photo, a listing shot, a plan or a sketch."],
    ["wand-2", "Redesign", "Budget-guided generation on your real walls."],
    ["sliders-horizontal", "Refine", "Keep, replace, remove and lock any object."],
    ["calculator", "Estimate", "Line items, quantities, trades, local rates."],
    ["shopping-bag", "Shop", "Real products at three price points."],
    ["hammer", "Build", "Contractor brief, approvals, task list."],
  ];
  const fr = $("flowRow");
  if (fr) fr.innerHTML = FLOW.map(([i, t, d], n) =>
    `<div class="fstep"><span class="fnum mono">${String(n + 1).padStart(2, "0")}</span>
     <div class="fic"><i data-lucide="${i}"></i></div><b>${t}</b><p>${d}</p></div>`).join("");

  const PROG = [
    ["Original", PHOTOS.clutter], ["Empty", PHOTOS.empty], ["Designed", PHOTOS.after],
    ["Budgeted", PHOTOS.neutral], ["Shopped", PHOTOS.luxury], ["Approved", PHOTOS.japandi],
  ];
  const ps = $("progStrip");
  if (ps) ps.innerHTML = PROG.map(([n, src], i) =>
    `<div class="pnode"><div class="pim">${photo(src, n + " stage")}</div><span class="mono">${String(i + 1).padStart(2, "0")} ${n}</span></div>`
  ).join('<span class="parrow"><i data-lucide="chevron-right"></i></span>');

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
  const dr = $("dnaRing");
  if (dr) dr.innerHTML = DNA.map(([n, src]) =>
    `<div class="dnode"><div class="dim">${photo(src, n + " in the property Design DNA")}</div><span>${n}</span></div>`).join("");

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
  const PRO = [
    ["Investor", PHOTOS.neutral, "Underwrite the design, not just admire it.",
      ["Rental grade versus retail grade on the same room", "ARV impact range against recent comps", "Parallel scenarios with side by side numbers", "Whole property budget rolled up"]],
    ["Agent", PHOTOS.coastal, "Batch stage a listing without a rental truck.",
      ["Batch staging across every photo in one direction", "MLS and state disclosure labeling applied automatically", "Originals retained with an audit trail", "Branded client and seller presentations"]],
    ["Designer", PHOTOS.japandi, "Concept time cut in half, approvals in one place.",
      ["Mood boards and version approvals per room", "Brand presets and white label decks", "Comments and tracked client activity", "Product boards with live pricing"]],
    ["Contractor", PHOTOS.kitchen, "Close in the driveway, quote before you leave.",
      ["Line item scope with quantities and trades", "Location adjusted labor assumptions", "Bid ready proposal with a signature line", "Change tracking between versions"]],
    ["Builder", PHOTOS.craftsman, "Sell the spec before you frame it.",
      ["Floor plan to furnished 3D visualization", "Design DNA across an entire community", "Org wide locked brand kit", "API and white label widget"]],
    ["Landscaper", PHOTOS.resortYard, "Show the yard before you break ground.",
      ["Hardscape, planting, pool and lighting passes", "Material quantities and coverage", "Seasonal and day to dusk previews", "Neighbor friendly before and after boards"]],
  ];
  const pt = $("proTabs");
  function setPro(i: number) {
    const [n, src, lede, list] = PRO[i] as any;
    pt?.querySelectorAll(".ptab").forEach((x: any, j: number) => x.classList.toggle("on", j === i));
    const pp = $("proPanel");
    if (pp) pp.innerHTML = `
      <div class="pro-im">${photo(src, n + " workflow preview")}<span class="stamp">${n.toUpperCase()}</span></div>
      <div class="pro-tx"><h3>${lede}</h3><ul class="checks">${
        list.map((l: string) => `<li><i data-lucide="check"></i><span>${l}</span></li>`).join("")
      }</ul></div>`;
    lucide.createIcons();
  }
  if (pt) {
    pt.innerHTML = PRO.map(([n], i) => `<button class="ptab ${i === 0 ? "on" : ""}" data-p="${i}">${n}</button>`).join("");
    pt.querySelectorAll(".ptab").forEach((b: any) => b.addEventListener("click", () => setPro(+b.dataset.p)));
    setPro(0);
  }

  /* ---------- categorized feature explorer ---------- */
  const FEATS: any = {
    Create: [
      ["sofa", "Interior Redesign", "Dated room to designer finish in one pass, built on your real walls.", ""],
      ["home", "Exterior Redesign", "Test siding, paint, roofing and curb appeal before a contractor quotes it.", ""],
      ["trees", "Landscape Design", "Patio, pool, fire pit or fresh planting. See it before you dig.", ""],
      ["bed-double", "Virtual Staging", "Furnish a vacant listing in seconds. No rental furniture, no reshoot.", ""],
      ["pen-tool", "Sketch To Render", "Napkin drawing, blueprint or CAD export in. Client ready render out.", ""],
      ["box", "Floor Plan To 3D", "Flat plan in, furnished 3D visualization out, tied to rooms and budget.", "Phase 2"],
    ],
    Refine: [
      ["lock", "Reality Lock", "Preserve space, structure, layout or just the objects you picked.", "Only Here"],
      ["sliders-horizontal", "Keep, Replace, Remove", "Tap any object or surface and tell the AI what it may touch.", "Only Here"],
      ["paintbrush", "Material Swap", "Flooring, counters, cabinets, tile, roofing, siding and hardscape.", ""],
      ["eraser", "Declutter & Empty", "Strip furniture, clutter and people out of an occupied photo.", ""],
      ["copy", "Inspiration Match", "Drop in a photo you love and transfer the palette, materials or one item.", "Only Here"],
      ["wand-2", "Smart Enhancement", "Sky replacement, day to dusk, straighten verticals, remove bins and debris.", ""],
    ],
    Plan: [
      ["wallet", "Budget Bands", "Set the number before you generate. The AI proposes what fits it.", "Only Here"],
      ["calculator", "Scope Of Work", "Line items, quantities and trades priced to your local labor market.", "Only Here"],
      ["scale", "Cost Comparison", "The same room at three budgets, with what the jump actually buys.", "Only Here"],
      ["file-signature", "Contractor Brief", "Before, after, scope and price on one branded, signable PDF.", ""],
      ["git-branch", "Project Versions", "Every generation is a version on the room, with change tracking.", ""],
      ["dna", "Design DNA", "One palette, flooring, metal and cabinet style across the property.", "Only Here"],
    ],
    Present: [
      ["git-compare", "Before / After", "The reveal wipe, branded or clean, in every aspect ratio.", ""],
      ["video", "Walkthrough Video", "Turn any still into a cinematic camera move in one click.", "Phase 2"],
      ["clapperboard", "Social Reel", "Transformation, product highlights and project range in one cut.", "Phase 2"],
      ["shopping-bag", "Product Board", "Best price, closest match or premium pick with fit checks.", ""],
      ["users", "Client Approval", "Share a branded link. Clients favorite, comment and approve.", ""],
      ["shield-check", "Listing Disclosure", "Auto label staged photos to MLS and state rules, with an audit trail.", "Only Here"],
    ],
  };
  const fxt = $("fxTabs"), fg = $("featGrid");
  function setFx(k: string) {
    fxt?.querySelectorAll(".fxtab").forEach((x: any) => x.classList.toggle("on", x.dataset.k === k));
    if (fg) fg.innerHTML = FEATS[k].map(([i, t, d, g]: any) => `
      <div class="feat">${g ? `<span class="tg ${g === "Phase 2" ? "soon" : ""}">${g}</span>` : ""}
      <div class="ic"><i data-lucide="${i}"></i></div><h3>${t}</h3><p>${d}</p></div>`).join("");
    lucide.createIcons();
  }
  if (fxt) {
    const keys = Object.keys(FEATS);
    fxt.innerHTML = keys.map((k, i) => `<button class="fxtab ${i === 0 ? "on" : ""}" data-k="${k}">${k}</button>`).join("");
    fxt.querySelectorAll(".fxtab").forEach((b: any) => b.addEventListener("click", () => setFx(b.dataset.k)));
    setFx(keys[0]);
  }

  /* ---------- reveal + icons for everything above ---------- */
  const io = new IntersectionObserver(
    (e) => e.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }),
    { threshold: 0.08 }
  );
  document.querySelectorAll(".rv:not(.in)").forEach((el) => io.observe(el));
  after(() => lucide.createIcons(), 0);
  lucide.createIcons();
}
