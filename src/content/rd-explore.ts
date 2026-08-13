// Explore: inspiration library wired into the REAL DESIGNS workflow.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { PHOTOS } from "@/content/rd-photos";

const P = PHOTOS;

export const DIRECTIONS = [
  {
    id: "warm-minimal", name: "Warm Minimal", img: P.after,
    line: "Quiet palette, warm woods, nothing extra.",
    about: "Soft neutrals and oak warmth with very little visual noise. Reads calm on camera and photographs wide, which makes it a safe default for resale and rental listings alike.",
    palette: ["#EFEAE2", "#D9CBB6", "#8C7A63", "#2E2A26"],
    spaces: ["Interior"], materials: ["White oak", "Linen", "Honed quartz", "Matte brass"],
    finishes: ["Wide plank oak floors", "Flat panel cabinetry", "Warm white walls"],
    rooms: ["Living Room", "Primary Bedroom", "Kitchen"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "organic-modern", name: "Organic Modern", img: P.neutral,
    line: "Rounded forms, natural texture, modern lines.",
    about: "Modern geometry softened with plaster, boucle and stone. Works well when the architecture is plain and the space needs character without a renovation.",
    palette: ["#F2EDE6", "#CBB9A3", "#7D7466", "#3A342C"],
    spaces: ["Interior"], materials: ["Limewash plaster", "Boucle", "Travertine", "Blackened steel"],
    finishes: ["Plaster walls", "Stone coffee table", "Curved seating"],
    rooms: ["Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "modern-farmhouse", name: "Modern Farmhouse", img: P.farmhouse,
    line: "Painted millwork, black hardware, honest materials.",
    about: "Shaker millwork and matte black fittings against warm white. Broad buyer appeal in suburban markets and forgiving on mid budgets.",
    palette: ["#FBF8F3", "#DAD2C4", "#4B5D53", "#1C1B19"],
    spaces: ["Interior", "Exterior"], materials: ["Shaker doors", "Butcher block", "Matte black iron", "Shiplap"],
    finishes: ["Painted island", "Apron sink", "Board and batten"],
    rooms: ["Kitchen", "Living Room", "Primary Bath"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "quiet-luxury", name: "Quiet Luxury", img: P.luxury,
    line: "Stone slabs, deep tone, restrained detail.",
    about: "Fewer, better materials. Full slab stone, tailored upholstery and low contrast hardware. Best on properties where the finish grade already supports the price.",
    palette: ["#EDE9E3", "#B9A88F", "#5A5147", "#141210"],
    spaces: ["Interior"], materials: ["Book matched marble", "Walnut", "Bronze", "Wool"],
    finishes: ["Slab backsplash", "Integrated appliance panels", "Concealed lighting"],
    rooms: ["Primary Bath", "Kitchen", "Living Room"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade"],
  },
  {
    id: "japandi", name: "Japandi", img: P.japandi,
    line: "Pale wood, low profiles, disciplined space.",
    about: "Japanese restraint with Scandinavian warmth. Very few objects, strong horizontal lines and matte finishes throughout.",
    palette: ["#F4F1EA", "#CFC5B4", "#7C8579", "#26241F"],
    spaces: ["Interior"], materials: ["Ash", "Paper shades", "Clay plaster", "Rattan"],
    finishes: ["Low bed platform", "Frameless joinery", "Matte black taps"],
    rooms: ["Primary Bedroom", "Living Room"], budgets: ["Refresh", "Makeover"], grades: ["Retail Grade"],
  },
  {
    id: "coastal", name: "Coastal", img: P.coastal,
    line: "Bright whites, soft blues, open light.",
    about: "Light woods and washed blues that make small rooms read larger. Strong performer for short term rental photography.",
    palette: ["#FDFCF9", "#D7E3E6", "#8FA9B4", "#2C3A42"],
    spaces: ["Interior", "Exterior"], materials: ["Whitewashed oak", "Cotton", "Sea grass", "Polished nickel"],
    finishes: ["White trim", "Slat detail", "Woven textures"],
    rooms: ["Living Room", "Primary Bedroom"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "mid-century", name: "Mid-Century", img: P.midcentury,
    line: "Walnut, tapered legs, graphic contrast.",
    about: "Warm walnut, low seating and a tight accent palette. Suits post-war architecture and open plan living rooms.",
    palette: ["#F0E7D8", "#C08A4E", "#3F6152", "#211C17"],
    spaces: ["Interior"], materials: ["Walnut", "Leather", "Terrazzo", "Brass"],
    finishes: ["Slat room divider", "Tapered leg casegoods", "Globe lighting"],
    rooms: ["Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "industrial", name: "Industrial", img: P.industrial,
    line: "Raw brick, steel frames, utility lighting.",
    about: "Exposed structure treated as the finish. Cost efficient when the shell is already interesting and the budget is tight.",
    palette: ["#E8E4DE", "#A2764F", "#585A5C", "#171717"],
    spaces: ["Interior"], materials: ["Brick", "Blackened steel", "Concrete", "Reclaimed oak"],
    finishes: ["Steel framed glazing", "Sealed concrete floors", "Exposed conduit"],
    rooms: ["Living Room", "Kitchen"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "transitional", name: "Transitional", img: P.bedroomAfter,
    line: "Classic bones, current finishes, low risk.",
    about: "The middle lane. Traditional profiles paired with modern hardware and lighting, which appraises well and dates slowly.",
    palette: ["#F6F3EE", "#CFC3B2", "#6D6A64", "#232120"],
    spaces: ["Interior"], materials: ["Painted millwork", "Quartz", "Satin nickel", "Wool blend"],
    finishes: ["Recessed panel doors", "Subtle crown", "Layered lighting"],
    rooms: ["Primary Bedroom", "Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "contemporary", name: "Contemporary", img: P.officeAfter,
    line: "Flat fronts, crisp edges, controlled contrast.",
    about: "Handleless joinery, large format tile and a tight two tone palette. Strong for newer builds and condo interiors.",
    palette: ["#FFFFFF", "#D5D7D8", "#6A6E70", "#101112"],
    spaces: ["Interior"], materials: ["Large format porcelain", "Lacquer", "Glass", "Matte aluminium"],
    finishes: ["Handleless cabinets", "Linear lighting", "Full height tile"],
    rooms: ["Kitchen", "Primary Bath", "Home Office"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade"],
  },
  {
    id: "mediterranean", name: "Mediterranean", img: P.resortYard,
    line: "Warm stucco, terracotta, shaded outdoor rooms.",
    about: "Sun tolerant materials, arched openings and planted courtyards. Best used across exterior and landscape together.",
    palette: ["#F5EDE0", "#D6A97B", "#94743F", "#3B2E22"],
    spaces: ["Exterior", "Landscape"], materials: ["Stucco", "Terracotta", "Limestone", "Olive planting"],
    finishes: ["Arched openings", "Clay tile", "Gravel courtyard"],
    rooms: ["Backyard", "Front Elevation"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade"],
  },
  {
    id: "scandinavian", name: "Scandinavian", img: P.stageStaged,
    line: "Light floors, soft contrast, functional layout.",
    about: "Pale floors, white walls and a small number of well chosen pieces. The most economical direction for virtual staging.",
    palette: ["#FFFFFF", "#E6DED2", "#A9AFA6", "#2B2B2B"],
    spaces: ["Interior"], materials: ["Pale oak", "Wool", "Powder coated steel", "Cotton"],
    finishes: ["White walls", "Light plank floors", "Simple casegoods"],
    rooms: ["Living Room", "Primary Bedroom"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade", "Retail Grade"],
  },
];

const GALLERY = [
  ["Interior", "Living Room", "Warm Minimal", "Makeover", P.after, "kitchens|living"],
  ["Interior", "Kitchen", "Warm Minimal", "Renovation", P.kitchenAfter, "kitchens"],
  ["Interior", "Kitchen", "Modern Farmhouse", "Renovation", P.farmhouse, "kitchens"],
  ["Interior", "Primary Bath", "Quiet Luxury", "Full Remodel", P.bath, "baths"],
  ["Interior", "Guest Bath", "Contemporary", "Renovation", P.luxury, "baths"],
  ["Interior", "Primary Bedroom", "Transitional", "Makeover", P.bedroomAfter, "bedrooms"],
  ["Interior", "Guest Bedroom", "Scandinavian", "Refresh", P.neutral, "bedrooms"],
  ["Interior", "Living Room", "Japandi", "Makeover", P.japandi, "living"],
  ["Interior", "Living Room", "Mid-Century", "Makeover", P.midcentury, "living"],
  ["Interior", "Living Room", "Industrial", "Renovation", P.industrial, "living"],
  ["Interior", "Home Office", "Contemporary", "Refresh", P.officeAfter, "living"],
  ["Interior", "Living Room", "Coastal", "Refresh", P.coastal, "living"],
  ["Interior", "Living Room", "Scandinavian", "Refresh", P.stageStaged, "staging"],
  ["Interior", "Dining Room", "Warm Minimal", "Makeover", P.stageEmpty, "staging"],
  ["Exterior", "Front Elevation", "Modern Farmhouse", "Renovation", P.paintedBrick, "exterior"],
  ["Exterior", "Front Elevation", "Craftsman Revival", "Renovation", P.craftsman, "exterior"],
  ["Exterior", "Front Elevation", "Ranch Refresh", "Makeover", P.ranch, "exterior"],
  ["Exterior", "Front Elevation", "Contemporary", "Full Remodel", P.exteriorAfter, "exterior"],
  ["Landscape", "Backyard", "Mediterranean", "Full Remodel", P.resortYard, "landscape"],
  ["Landscape", "Backyard", "Organic Modern", "Renovation", P.yardAfter, "landscape"],
].map((r, i) => ({
  id: "ex" + i, space: r[0], room: r[1], direction: r[2], budget: r[3], img: r[4], tags: r[5],
  lock: i % 5 === 3 ? "Layout Held" : "Reality Lock On",
  grade: r[3] === "Refresh" || r[3] === "Makeover" ? "Rental Grade" : "Retail Grade",
}));

const CATS = [
  ["for-you", "For You"], ["interior", "Interior"], ["exterior", "Exterior"], ["landscape", "Landscape"],
  ["staging", "Virtual Staging"], ["kitchens", "Kitchens"], ["baths", "Bathrooms"],
  ["bedrooms", "Bedrooms"], ["living", "Living Rooms"], ["saved", "Saved"],
];

const LS = {
  saved: "rd_ex_saved", boards: "rd_ex_boards", seen: "rd_ex_seen", quiz: "rd_ex_quiz",
};
function read(k, f) { try { return JSON.parse(localStorage.getItem(k) || "") ?? f; } catch (_) { return f; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let saved = read(LS.saved, []);
let boards = read(LS.boards, []);
let seen = read(LS.seen, []);

function dir(id) { return DIRECTIONS.find((d) => d.id === id); }
function dirByName(n) { return DIRECTIONS.find((d) => d.name === n); }
function swatches(p) { return '<span class="ex-sw">' + p.map((c) => `<i style="background:${c}"></i>`).join("") + "</span>"; }

const SHELL = `
<div class="ex">
  <header class="ex-head">
    <div class="ex-head-t">
      <span class="ex-eyebrow">Design Discovery</span>
      <h2>Explore What Your Space Could Become.</h2>
      <p>Browse curated design directions for interiors, exteriors and landscapes. Save what you like, preview it in your space or use it to start a new design.</p>
    </div>
    <div class="ex-head-a">
      <button class="btn btn-primary btn-sm" id="exUpload"><i data-lucide="image-up"></i>Upload Your Space</button>
      <button class="btn btn-ghost btn-sm" id="exSavedBtn"><i data-lucide="bookmark"></i>View Saved Ideas</button>
    </div>
  </header>

  <div class="ex-filters">
    <div class="ex-search"><i data-lucide="search"></i><input id="exQ" type="text" placeholder="Search styles, rooms or design ideas"></div>
    <select id="exSpace" aria-label="Space Type"><option value="">Space Type</option><option>Interior</option><option>Exterior</option><option>Landscape</option></select>
    <select id="exRoom" aria-label="Room"><option value="">Room</option></select>
    <select id="exStyle" aria-label="Style"><option value="">Style</option></select>
    <select id="exBudget" aria-label="Budget Band"><option value="">Budget Band</option><option>Refresh</option><option>Makeover</option><option>Renovation</option><option>Full Remodel</option></select>
    <select id="exGrade" aria-label="Finish Grade"><option value="">Finish Grade</option><option>Rental Grade</option><option>Retail Grade</option></select>
    <select id="exSort" aria-label="Sort"><option value="rec">Recommended</option><option value="az">Direction, A To Z</option><option value="budget">Budget, Low To High</option></select>
    <button class="btn btn-ghost btn-xs ex-clear" id="exClear" hidden><i data-lucide="x"></i>Clear Filters</button>
  </div>

  <div class="ex-cats" id="exCats"></div>

  <section class="ex-sec">
    <div class="ex-sec-h">
      <div><h3>Featured Design Directions</h3><div class="sub">Curated looks that carry a palette, materials and finish grade into Studio</div></div>
      <div class="ex-arrows"><button class="icon-btn" id="exPrev" aria-label="Scroll left"><i data-lucide="chevron-left"></i></button><button class="icon-btn" id="exNext" aria-label="Scroll right"><i data-lucide="chevron-right"></i></button></div>
    </div>
    <div class="ex-rail" id="exRail"></div>
  </section>

  <section class="ex-sec" id="exRecSec">
    <div class="ex-sec-h"><div><h3 id="exRecTitle">Recommended For You</h3><div class="sub" id="exRecSub">Based on what you viewed, saved and the Design DNA on your properties</div></div></div>
    <div class="ex-rec" id="exRec"></div>
  </section>

  <section class="ex-sec">
    <div class="ex-sec-h"><div><h3>Explore Real Possibilities</h3><div class="sub" id="exCount">Loading</div></div></div>
    <div class="ex-grid" id="exGrid"></div>
  </section>

  <div class="ex-sticky"><button class="btn btn-primary btn-block" id="exUpload2"><i data-lucide="image-up"></i>Upload Your Space</button></div>
</div>
<div class="ex-drawer" id="exDrawer" hidden><div class="ex-scrim" id="exScrim"></div><aside class="ex-panel" id="exPanel" role="dialog" aria-modal="true"></aside></div>
`;

function exToast(msg) {
  let t = document.querySelector(".rd-app .ex-toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "ex-toast";
    (document.querySelector(".rd-app") || document.body).appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(t._h);
  t._h = window.setTimeout(() => t.classList.remove("on"), 2600);
}

export function mountExplore(go) {
  const host = document.getElementById("v-explore");
  if (!host || host.dataset["ready"] === "1") return;
  host.dataset["ready"] = "1";
  host.innerHTML = SHELL;

  const $ = (id) => host.querySelector("#" + id) || document.getElementById(id);
  const note = (m) => { try { exToast(m); } catch (_) {} };
  const icons_ = () => { try { createIcons({ icons }); } catch (_) {} };

  // filter option lists
  const rooms = Array.from(new Set(GALLERY.map((g) => g.room))).sort();
  $("exRoom").insertAdjacentHTML("beforeend", rooms.map((r) => `<option>${esc(r)}</option>`).join(""));
  const styles = Array.from(new Set(GALLERY.map((g) => g.direction).concat(DIRECTIONS.map((d) => d.name)))).sort();
  $("exStyle").insertAdjacentHTML("beforeend", styles.map((s) => `<option>${esc(s)}</option>`).join(""));

  let cat = "for-you";
  $("exCats").innerHTML = CATS.map(([id, l]) => `<button class="ex-cat${id === cat ? " on" : ""}" data-c="${id}">${l}</button>`).join("");

  /* ---------- featured rail ---------- */
  function railCard(d) {
    const on = saved.includes(d.id);
    return `<article class="ex-card ex-fcard" data-d="${d.id}">
      <div class="ex-img"><img src="${d.img}" alt="${esc(d.name)} design direction" loading="lazy">
        <button class="ex-save${on ? " on" : ""}" data-save="${d.id}" aria-label="Save to Saved Ideas"><i data-lucide="heart"></i></button>
      </div>
      <div class="ex-body">
        <div class="ex-t"><b>${esc(d.name)}</b>${swatches(d.palette)}</div>
        <p>${esc(d.line)}</p>
        <div class="ex-meta">${d.spaces.map((s) => `<span class="ex-tag">${s}</span>`).join("")}</div>
        <div class="ex-acts"><button class="btn btn-ghost btn-xs" data-preview="${d.id}">Preview In My Space</button><button class="btn btn-ghost btn-xs" data-open="${d.id}">View Direction</button></div>
      </div>
    </article>`;
  }
  function paintRail() { $("exRail").innerHTML = DIRECTIONS.map(railCard).join(""); icons_(); }

  /* ---------- gallery ---------- */
  function filters() {
    return {
      q: ($("exQ").value || "").trim().toLowerCase(),
      space: $("exSpace").value, room: $("exRoom").value, style: $("exStyle").value,
      budget: $("exBudget").value, grade: $("exGrade").value, sort: $("exSort").value,
    };
  }
  const BORDER = ["Refresh", "Makeover", "Renovation", "Full Remodel"];
  function matches(g, f) {
    if (f.space && g.space !== f.space) return false;
    if (f.room && g.room !== f.room) return false;
    if (f.style && g.direction !== f.style) return false;
    if (f.budget && g.budget !== f.budget) return false;
    if (f.grade && g.grade !== f.grade) return false;
    if (cat === "saved" && !saved.includes(g.id)) return false;
    if (cat === "interior" && g.space !== "Interior") return false;
    if (cat === "exterior" && g.space !== "Exterior") return false;
    if (cat === "landscape" && g.space !== "Landscape") return false;
    if (["staging", "kitchens", "baths", "bedrooms", "living"].includes(cat) && !g.tags.split("|").includes(cat)) return false;
    if (f.q && !(g.room + " " + g.direction + " " + g.space + " " + g.budget).toLowerCase().includes(f.q)) return false;
    return true;
  }
  function score(g) {
    let s = 0;
    if (seen.includes(g.direction)) s += 3;
    if (saved.some((id) => (dir(id) || {}).name === g.direction)) s += 4;
    if (g.grade === "Retail Grade") s += 1;
    return s;
  }
  function galleryCard(g) {
    const on = saved.includes(g.id);
    return `<article class="ex-card ex-gcard" data-g="${g.id}">
      <div class="ex-img"><img src="${g.img}" alt="${esc(g.direction)} ${esc(g.room)}" loading="lazy">
        <span class="ex-space">${g.space}</span>
        <button class="ex-save${on ? " on" : ""}" data-save="${g.id}" aria-label="Save to Saved Ideas"><i data-lucide="heart"></i></button>
        <div class="ex-hover"><button class="btn btn-primary btn-xs" data-try="${g.id}">Try This Look</button><button class="btn btn-ghost btn-xs" data-details="${g.id}">View Details</button></div>
      </div>
      <div class="ex-body">
        <div class="ex-t"><b>${esc(g.room)}</b><span class="ex-dir">${esc(g.direction)}</span></div>
        <div class="ex-meta"><span class="ex-tag">${g.budget}</span><span class="ex-tag">${g.grade}</span><span class="ex-tag ok"><i data-lucide="lock"></i>${g.lock}</span></div>
      </div>
    </article>`;
  }
  function skeleton(n) {
    return Array.from({ length: n }).map(() => '<div class="ex-skel"></div>').join("");
  }
  let paintToken = 0;
  function paintGrid() {
    const f = filters();
    const dirty = !!(f.q || f.space || f.room || f.style || f.budget || f.grade || cat !== "for-you");
    $("exClear").hidden = !dirty;
    const grid = $("exGrid");
    grid.innerHTML = skeleton(8);
    $("exCount").textContent = "Loading";
    const my = ++paintToken;
    setTimeout(() => {
      if (my !== paintToken) return;
      let list = GALLERY.filter((g) => matches(g, f));
      if (f.sort === "az") list.sort((a, b) => a.direction.localeCompare(b.direction));
      else if (f.sort === "budget") list.sort((a, b) => BORDER.indexOf(a.budget) - BORDER.indexOf(b.budget));
      else list.sort((a, b) => score(b) - score(a));
      $("exCount").textContent = list.length + (list.length === 1 ? " Design Direction" : " Design Directions") + (cat === "saved" ? " Saved" : " Matching Your Filters");
      grid.innerHTML = list.length
        ? list.map(galleryCard).join("")
        : `<div class="ex-empty"><i data-lucide="compass"></i><b>No Exact Matches Yet.</b><p>Try removing a filter or upload your space and describe the direction you want.</p><button class="btn btn-primary btn-sm" id="exCustom">Start A Custom Design</button></div>`;
      icons_();
      requestAnimationFrame(() => grid.querySelectorAll(".ex-card").forEach((c, i) => setTimeout(() => c.classList.add("in"), Math.min(i * 28, 320))));
    }, 220);
  }

  /* ---------- recommendations / quiz ---------- */
  const QUIZ = [
    ["Which Living Room Feels Right?", ["warm-minimal", "mid-century"]],
    ["Pick A Kitchen Direction.", ["modern-farmhouse", "contemporary"]],
    ["Which Bedroom Would You Keep?", ["japandi", "transitional"]],
    ["Choose An Exterior Language.", ["mediterranean", "modern-farmhouse"]],
    ["Last One, Pick A Finish Level.", ["quiet-luxury", "scandinavian"]],
  ];
  let quizStep = 0;
  let quizPicks = read(LS.quiz, []);
  function paintRec() {
    const isNew = !quizPicks.length && !saved.length && !seen.length;
    if (isNew) {
      $("exRecTitle").textContent = "Find Your Design Direction";
      $("exRecSub").textContent = "Five quick picks. Optional, and you can change it later.";
      paintQuiz();
      return;
    }
    $("exRecTitle").textContent = "Recommended For You";
    $("exRecSub").textContent = "Based on what you viewed, saved and the Design DNA on your properties";
    const weight = {};
    quizPicks.forEach((id) => (weight[id] = (weight[id] || 0) + 4));
    seen.forEach((n) => { const d = dirByName(n); if (d) weight[d.id] = (weight[d.id] || 0) + 2; });
    saved.forEach((id) => { if (dir(id)) weight[id] = (weight[id] || 0) + 3; });
    const ranked = DIRECTIONS.slice().sort((a, b) => (weight[b.id] || 0) - (weight[a.id] || 0)).slice(0, 4);
    $("exRec").innerHTML = ranked.map((d) => `<article class="ex-card ex-rcard in" data-d="${d.id}">
      <div class="ex-img"><img src="${d.img}" alt="${esc(d.name)}" loading="lazy"></div>
      <div class="ex-body"><div class="ex-t"><b>${esc(d.name)}</b>${swatches(d.palette)}</div>
      <p>${esc(weight[d.id] ? "Matches your saved and recently viewed directions." : d.line)}</p>
      <div class="ex-acts"><button class="btn btn-ghost btn-xs" data-open="${d.id}">View Direction</button></div></div>
    </article>`).join("");
    icons_();
  }
  function paintQuiz() {
    const [q, pair] = QUIZ[quizStep];
    $("exRec").innerHTML = `<div class="ex-quiz">
      <div class="ex-quiz-h"><b>${esc(q)}</b><span>${quizStep + 1} Of ${QUIZ.length}</span></div>
      <div class="ex-quiz-p">${pair.map((id) => { const d = dir(id); return `<button class="ex-quiz-o" data-pick="${id}"><img src="${d.img}" alt="${esc(d.name)}" loading="lazy"><span>${esc(d.name)}</span></button>`; }).join("")}</div>
      <button class="fb-link" id="exQuizSkip">Skip For Now</button>
    </div>`;
    icons_();
  }

  /* ---------- drawer ---------- */
  function openDrawer(inner) {
    $("exPanel").innerHTML = inner;
    $("exDrawer").hidden = false;
    requestAnimationFrame(() => $("exDrawer").classList.add("on"));
    icons_();
  }
  function closeDrawer() { $("exDrawer").classList.remove("on"); setTimeout(() => ($("exDrawer").hidden = true), 200); }

  function directionDrawer(id) {
    const d = dir(id);
    if (!d) return;
    if (!seen.includes(d.name)) { seen = [d.name].concat(seen).slice(0, 12); write(LS.seen, seen); }
    const related = DIRECTIONS.filter((x) => x.id !== d.id && x.spaces.some((s) => d.spaces.includes(s))).slice(0, 3);
    openDrawer(`
      <div class="ex-panel-h"><div><span class="ex-eyebrow">Design Direction</span><h3>${esc(d.name)}</h3></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="ex-panel-b">
        <div class="ex-hero"><img src="${d.img}" alt="${esc(d.name)}"></div>
        <p class="ex-about">${esc(d.about)}</p>
        <div class="ex-spec"><b>Color Palette</b><div>${swatches(d.palette)}</div></div>
        <div class="ex-spec"><b>Materials</b><div>${d.materials.map((m) => `<span class="ex-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="ex-spec"><b>Typical Finishes</b><div>${d.finishes.map((m) => `<span class="ex-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="ex-spec"><b>Best Fit Rooms</b><div>${d.rooms.map((m) => `<span class="ex-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="ex-spec"><b>Suggested Budget Bands</b><div>${d.budgets.map((m) => `<span class="ex-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="ex-spec"><b>Finish Grade Options</b><div>${d.grades.map((m) => `<span class="ex-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="ex-spec"><b>Related Designs</b><div class="ex-rel">${related.map((r) => `<button data-open="${r.id}"><img src="${r.img}" alt="${esc(r.name)}"><span>${esc(r.name)}</span></button>`).join("")}</div></div>
      </div>
      <div class="ex-panel-f"><button class="btn btn-primary btn-sm" data-apply="${d.id}"><i data-lucide="wand-2"></i>Apply This Direction</button>
        <button class="btn btn-ghost btn-sm" data-save="${d.id}"><i data-lucide="bookmark"></i>${saved.includes(d.id) ? "Saved To Inspiration" : "Save To Inspiration"}</button></div>`);
  }

  function galleryDrawer(gid) {
    const g = GALLERY.find((x) => x.id === gid);
    if (!g) return;
    const d = dirByName(g.direction);
    if (d) return directionDrawer(d.id);
    openDrawer(`<div class="ex-panel-h"><div><span class="ex-eyebrow">Design Direction</span><h3>${esc(g.direction)}</h3></div><button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="ex-panel-b"><div class="ex-hero"><img src="${g.img}" alt="${esc(g.direction)}"></div>
      <div class="ex-spec"><b>Best Fit Rooms</b><div><span class="ex-tag">${esc(g.room)}</span></div></div>
      <div class="ex-spec"><b>Suggested Budget Bands</b><div><span class="ex-tag">${g.budget}</span></div></div>
      <div class="ex-spec"><b>Finish Grade Options</b><div><span class="ex-tag">${g.grade}</span></div></div></div>
      <div class="ex-panel-f"><button class="btn btn-primary btn-sm" data-applyg="${g.id}"><i data-lucide="wand-2"></i>Apply This Direction</button>
      <button class="btn btn-ghost btn-sm" data-save="${g.id}"><i data-lucide="bookmark"></i>Save To Inspiration</button></div>`);
  }

  /* ---------- apply into Studio ---------- */
  function applyToStudio(opts) {
    const sel = document.getElementById("fStyle");
    if (sel && opts.direction) {
      if (!Array.from(sel.options).some((o) => o.value === opts.direction || o.text === opts.direction)) {
        sel.insertAdjacentHTML("afterbegin", `<option>${esc(opts.direction)}</option>`);
      }
      sel.value = opts.direction;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (opts.space) {
      const key = opts.space === "Landscape" ? "landscape" : opts.space.toLowerCase();
      const chip = document.querySelector('#spChips [data-sp="' + key + '"]');
      if (chip) chip.click();
    }
    if (opts.room) {
      const rs = document.getElementById("fRoom");
      if (rs) {
        if (!Array.from(rs.options).some((o) => o.text === opts.room)) rs.insertAdjacentHTML("beforeend", `<option>${esc(opts.room)}</option>`);
        rs.value = opts.room;
        rs.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    if (opts.budget) {
      const i = BORDER.indexOf(opts.budget);
      const b = i >= 0 && document.querySelector('#v-studio [data-b="' + i + '"]');
      if (b) b.click();
    }
    if (opts.grade) {
      const gch = document.querySelector('#gradeChips [data-g="' + (opts.grade === "Rental Grade" ? "rental" : "retail") + '"]');
      if (gch) gch.click();
    }
    closeDrawer();
    go("studio");
    note(opts.direction + " Applied. Choose A Property Or Upload A Photo To Continue.");
  }

  /* ---------- saved ideas ---------- */
  function savedItem(id) {
    const d = dir(id);
    if (d) return { id, img: d.img, title: d.name, sub: d.line };
    const g = GALLERY.find((x) => x.id === id);
    return g ? { id, img: g.img, title: g.direction, sub: g.room + ", " + g.budget } : null;
  }
  function savedDrawer() {
    const items = saved.map(savedItem).filter(Boolean);
    openDrawer(`
      <div class="ex-panel-h"><div><span class="ex-eyebrow">Inspiration</span><h3>Saved Ideas</h3></div><button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="ex-panel-b">
        <div class="ex-spec"><b>Inspiration Boards</b>
          <div class="ex-boards">${boards.length ? boards.map((b, i) => `<div class="ex-board"><div><b>${esc(b.name)}</b><span>${b.items.length} Saved</span></div><div class="ex-board-a"><button class="fb-link" data-share="${i}">Share</button><button class="fb-link" data-applyb="${i}">Apply</button></div></div>`).join("") : '<span class="ex-quiet">No Boards Yet. Name One By Property Or Room.</span>'}</div>
          <div class="ex-newboard"><input id="exBoardName" type="text" placeholder="Board name, such as 42 Oak Street Kitchen"><button class="btn btn-ghost btn-xs" id="exBoardAdd"><i data-lucide="plus"></i>Create Board</button></div>
        </div>
        <div class="ex-spec"><b>Saved Designs</b>
          ${items.length ? `<div class="ex-saved">${items.map((s) => `<div class="ex-sitem"><label class="ex-cmp-check"><input type="checkbox" data-cmp="${s.id}"><span></span></label><img src="${s.img}" alt="${esc(s.title)}"><div><b>${esc(s.title)}</b><span>${esc(s.sub)}</span></div><button class="fb-link" data-unsave="${s.id}">Remove</button></div>`).join("")}</div>
          <span class="ex-quiet">Select Two To Four Saved Directions To Compare Them Side By Side.</span>` : '<span class="ex-quiet">Nothing Saved Yet. Tap The Heart On Any Design.</span>'}
        </div>
      </div>
      <div class="ex-panel-f"><button class="btn btn-primary btn-sm" id="exCompare"><i data-lucide="columns-3"></i>Compare Selected</button></div>`);
  }
  function compareDrawer(ids) {
    const items = ids.map(savedItem).filter(Boolean);
    openDrawer(`<div class="ex-panel-h"><div><span class="ex-eyebrow">Side By Side</span><h3>Compare Directions</h3></div><button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="ex-panel-b"><div class="ex-cmpgrid" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">
      ${items.map((s) => { const d = dir(s.id); return `<div class="ex-cmpcol"><img src="${s.img}" alt="${esc(s.title)}"><b>${esc(s.title)}</b><span>${esc(s.sub)}</span>${d ? swatches(d.palette) : ""}${d ? `<span class="ex-quiet">${d.budgets.join(", ")}</span>` : ""}<button class="btn btn-ghost btn-xs" data-open="${s.id}">View Direction</button></div>`; }).join("")}
      </div></div>
      <div class="ex-panel-f"><button class="btn btn-ghost btn-sm" data-close="1">Close</button></div>`);
  }

  /* ---------- events ---------- */
  function toggleSave(id, el) {
    const on = saved.includes(id);
    saved = on ? saved.filter((x) => x !== id) : [id].concat(saved);
    write(LS.saved, saved);
    host.querySelectorAll('[data-save="' + id + '"]').forEach((b) => {
      b.classList.toggle("on", !on);
      if (b.classList.contains("btn")) b.innerHTML = '<i data-lucide="bookmark"></i>' + (!on ? "Saved To Inspiration" : "Save To Inspiration");
    });
    if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
    icons_();
    note(on ? "Removed From Saved Ideas" : "Saved To Inspiration");
    if (cat === "saved") paintGrid();
  }

  host.addEventListener("click", (e) => {
    const t = e.target;
    const hit = (a) => t.closest("[" + a + "]");
    let el;
    if ((el = hit("data-c"))) { cat = el.dataset.c; host.querySelectorAll(".ex-cat").forEach((b) => b.classList.toggle("on", b === el)); paintGrid(); return; }
    if ((el = hit("data-save"))) { toggleSave(el.dataset.save, el); return; }
    if ((el = hit("data-open"))) { directionDrawer(el.dataset.open); return; }
    if ((el = hit("data-details"))) { galleryDrawer(el.dataset.details); return; }
    if ((el = hit("data-preview"))) { const d = dir(el.dataset.preview); applyToStudio({ direction: d.name, space: d.spaces[0], grade: d.grades[0] }); return; }
    if ((el = hit("data-try"))) {
      const g = GALLERY.find((x) => x.id === el.dataset.try);
      applyToStudio({ direction: g.direction, space: g.space, room: g.room, budget: g.budget, grade: g.grade });
      return;
    }
    if ((el = hit("data-apply"))) { const d = dir(el.dataset.apply); applyToStudio({ direction: d.name, space: d.spaces[0], room: d.rooms[0], budget: d.budgets[0], grade: d.grades[0] }); return; }
    if ((el = hit("data-applyg"))) { const g = GALLERY.find((x) => x.id === el.dataset.applyg); applyToStudio({ direction: g.direction, space: g.space, room: g.room, budget: g.budget, grade: g.grade }); return; }
    if ((el = hit("data-unsave"))) { toggleSave(el.dataset.unsave); savedDrawer(); return; }
    if ((el = hit("data-share"))) { const b = boards[+el.dataset.share]; try { navigator.clipboard.writeText(location.origin + "/app#v-explore?board=" + encodeURIComponent(b.name)); } catch (_) {} note("Board Link Copied"); return; }
    if ((el = hit("data-applyb"))) {
      const b = boards[+el.dataset.applyb];
      const first = (b.items || []).map(savedItem).filter(Boolean)[0];
      if (!first) { note("Add Saved Designs To This Board First"); return; }
      const d = dir(first.id) || dirByName(first.title);
      applyToStudio(d ? { direction: d.name, space: d.spaces[0], room: d.rooms[0], budget: d.budgets[0], grade: d.grades[0] } : { direction: first.title });
      return;
    }
    if ((el = hit("data-pick"))) {
      quizPicks = quizPicks.concat([el.dataset.pick]);
      write(LS.quiz, quizPicks);
      quizStep++;
      if (quizStep >= QUIZ.length) { paintRec(); paintGrid(); note("Your Design Direction Is Set"); }
      else paintQuiz();
      return;
    }
    if (t.closest("#exQuizSkip")) { quizPicks = quizPicks.length ? quizPicks : ["warm-minimal"]; write(LS.quiz, quizPicks); paintRec(); return; }
    if (t.closest("#exBoardAdd")) {
      const inp = host.querySelector("#exBoardName");
      const name = (inp.value || "").trim();
      if (!name) { inp.focus(); return; }
      boards = boards.concat([{ name, items: saved.slice() }]);
      write(LS.boards, boards);
      savedDrawer();
      note("Board Created");
      return;
    }
    if (t.closest("#exCompare")) {
      const picks = Array.from(host.querySelectorAll("[data-cmp]:checked")).map((c) => c.dataset.cmp);
      if (picks.length < 2 || picks.length > 4) { note("Select Two To Four Saved Directions"); return; }
      compareDrawer(picks);
      return;
    }
    if (t.closest("[data-close]") || t.closest("#exScrim")) { closeDrawer(); return; }
    if (t.closest("#exSavedBtn")) { savedDrawer(); return; }
    if (t.closest("#exUpload") || t.closest("#exUpload2") || t.closest("#exCustom")) { go("studio"); note("Upload Your Space In Studio To Start"); return; }
    if (t.closest("#exPrev")) { $("exRail").scrollBy({ left: -560, behavior: "smooth" }); return; }
    if (t.closest("#exNext")) { $("exRail").scrollBy({ left: 560, behavior: "smooth" }); return; }
    if (t.closest("#exClear")) {
      ["exQ", "exSpace", "exRoom", "exStyle", "exBudget", "exGrade"].forEach((id) => ($(id).value = ""));
      $("exSort").value = "rec";
      cat = "for-you";
      host.querySelectorAll(".ex-cat").forEach((b) => b.classList.toggle("on", b.dataset.c === "for-you"));
      paintGrid();
    }
  });

  let qt;
  $("exQ").addEventListener("input", () => { clearTimeout(qt); qt = window.setTimeout(paintGrid, 180); });
  ["exSpace", "exRoom", "exStyle", "exBudget", "exGrade", "exSort"].forEach((id) => $(id).addEventListener("change", paintGrid));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("exDrawer").hidden) closeDrawer(); });

  paintRail();
  paintRec();
  paintGrid();
  icons_();
}
