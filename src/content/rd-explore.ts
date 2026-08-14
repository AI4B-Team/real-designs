// Explore: the REAL DESIGNS style catalog inside the app.
// Styles come from the canonical catalog in src/lib/style-catalog.ts so a
// selection here always reaches the generation payload.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import {
  STYLES, STYLE_CATEGORIES, AUTO_STYLE, styleById, resolveStyle, recommendStyles, buildStylePayload,
} from "@/lib/style-catalog";
import { setStudioStyle, applyStudioStyleToControls } from "@/lib/studio-style";

export { DIRECTIONS } from "@/content/directions";

const TABS = ["Featured", "Interior", "Exterior", "Garden", "Virtual Staging", "Saved"];
const TAB_TYPE = { Interior: "interior", Exterior: "exterior", Garden: "garden", "Virtual Staging": "virtual-staging" };
const SORTS = [["popular", "Popular"], ["newest", "Newest"], ["az", "A–Z"]];

const ROOMS = ["Living Room", "Kitchen", "Bedroom", "Bathroom", "Dining Room", "Office", "Entry", "Yard", "Front Elevation"];
const PALETTES = ["Warm Neutral", "Cool Neutral", "Earth Tone", "Bright And Light", "Dark And Moody", "Bold Color"];
const FINISHES = ["Rental Grade", "Retail Grade", "Premium"];
const MOODS = ["Calm", "Minimal", "Warm", "Natural", "Refined", "Formal", "Bold", "Playful", "Homely", "Classic", "Curb Appeal"];

const LS = { saved: "rd_ex_saved", quiz: "rd_ex_quiz_v2", choice: "rd_style_choice", src: "rd_last_source" };
function read(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (_) { return f; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let saved = read(LS.saved, []);
if (!Array.isArray(saved)) saved = [];

/** Coarse palette bucket used by the filter drawer. */
function paletteBucket(s) {
  const n = s.palette.join(" ").toLowerCase();
  if (/black|onyx|soot|ink|near black|tobacco/.test(n) && /forest|jet|charcoal|espresso|sumi|shadow/.test(n)) return "Dark And Moody";
  if (/gold|emerald|cobalt|orange|avocado|teal|primary/.test(n)) return "Bold Color";
  if (/terracotta|clay|olive|rust|sandstone|ochre|cocoa|bark/.test(n)) return "Earth Tone";
  if (/mist|slate|grey|graphite|gunmetal|concrete/.test(n)) return "Cool Neutral";
  if (/white|chalk|bone|ivory|snow|shell|rice/.test(n)) return "Bright And Light";
  return "Warm Neutral";
}

function swatches(s) { return '<span class="xp-sw">' + s.swatches.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("") + "</span>"; }

function exToast(msg) {
  let t = document.querySelector(".rd-app .xp-toast");
  if (!t) { t = document.createElement("div"); t.className = "xp-toast"; (document.querySelector(".rd-app") || document.body).appendChild(t); }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(t._h);
  t._h = window.setTimeout(() => t.classList.remove("on"), 3000);
}

const SHELL = `
<div class="xp">
  <header class="xp-head">
    <div class="xp-head-t">
      <h2>Explore</h2>
      <p>Browse the REAL DESIGNS style catalog and send any style straight into Studio.</p>
    </div>
    <div class="xp-head-a">
      <span class="xp-prop" id="xpProp" hidden></span>
      <button class="btn btn-ghost btn-sm" id="xpAdminBtn" hidden><i data-lucide="settings-2"></i>Style Library</button>
      <button class="btn btn-ghost btn-sm" id="xpSavedBtn"><i data-lucide="bookmark"></i>Saved Styles<span class="xp-cnt" id="xpSavedCnt">0</span></button>
    </div>
  </header>

  <div class="xp-bar">
    <div class="xp-search"><i data-lucide="search"></i><input id="xpQ" type="text" placeholder="Search styles" aria-label="Search styles"></div>
    <button class="btn btn-ghost btn-sm xp-filter-btn" id="xpFilterBtn" aria-haspopup="dialog"><i data-lucide="sliders-horizontal"></i>Filters<span class="xp-cnt" id="xpFilterCnt" hidden>0</span></button>
    <div class="xp-sortwrap">
      <button class="btn btn-ghost btn-sm" id="xpSortBtn" aria-haspopup="menu" aria-expanded="false"><i data-lucide="arrow-up-down"></i><span id="xpSortLab">Popular</span><i data-lucide="chevron-down"></i></button>
      <div class="xp-sortmenu" id="xpSortMenu" role="menu" hidden></div>
    </div>
  </div>

  <div class="xp-cats" id="xpCats" role="tablist"></div>
  <div class="xp-active" id="xpActive" hidden></div>

  <section class="xp-rec" id="xpRec" hidden></section>

  <section class="xp-quiz" id="xpQuiz" hidden>
    <div class="xp-quiz-top"><div><h3>Find Your Style</h3><p>Five quick comparisons and we shortlist your best matches.</p></div></div>
    <div class="xp-quiz-card" id="xpQuizCard"></div>
  </section>

  <p class="xp-count" id="xpCount"></p>
  <div id="xpBody"></div>
</div>
<div class="xp-drawer" id="xpDrawer" hidden><div class="xp-scrim" id="xpScrim"></div><aside class="xp-dpanel" id="xpDPanel" role="dialog" aria-modal="true"></aside></div>
`;

/**
 * @param go router used by the app shell
 * @param ctx { curProp, setPropertyDna, reloadTree }
 */
export function mountExplore(go, ctx) {
  const host = document.getElementById("v-explore");
  if (!host) return;
  const api = ctx || {};
  if (host.dataset["ready"] === "1") { host._xpSync && host._xpSync(); return; }
  host.dataset["ready"] = "1";
  host.innerHTML = SHELL;

  const $ = (id) => host.querySelector("#" + id);
  const note = (m) => { try { exToast(m); } catch (_) {} };
  const icons_ = () => { try { createIcons({ icons }); } catch (_) {} };

  let tab = "Featured";
  let sort = "popular";
  let f = { family: [], type: [], room: [], palette: [], finish: [], mood: [] };
  const expanded = {};

  const prop = () => { try { return (api.curProp && api.curProp()) || null; } catch (_) { return null; } };
  function propStyleName() {
    const p = prop();
    const first = p && p.dna && p.dna[0];
    if (!first) return null;
    const rec = resolveStyle(first.label);
    return rec && !rec.isAuto ? rec.displayName : null;
  }

  /* ---------- tabs ---------- */
  $("xpCats").innerHTML = TABS.map((s) => `<button class="xp-cat${s === tab ? " on" : ""}" role="tab" aria-selected="${s === tab}" data-c="${s}">${s}</button>`).join("");
  $("xpSortMenu").innerHTML = SORTS.map(([v, l]) => `<button class="xp-sortopt${v === sort ? " on" : ""}" role="menuitem" data-sort="${v}">${l}</button>`).join("");

  /* ---------- filtering ---------- */
  function matchesTab(s) {
    if (tab === "Saved") return saved.indexOf(s.id) > -1;
    if (tab === "Featured") return true;
    const t = TAB_TYPE[tab];
    return !t || s.compatibleProjectTypes.indexOf(t) > -1;
  }
  function matchesFilters(s) {
    if (f.family.length && f.family.indexOf(s.category) < 0) return false;
    if (f.type.length && !f.type.some((t) => s.compatibleProjectTypes.indexOf(t) > -1)) return false;
    if (f.room.length && !f.room.some((r) => s.compatibleRoomTypes.indexOf(r) > -1)) return false;
    if (f.palette.length && f.palette.indexOf(paletteBucket(s)) < 0) return false;
    if (f.finish.length && !f.finish.some((x) => s.finishLevel.indexOf(x) > -1)) return false;
    if (f.mood.length && !f.mood.some((x) => s.mood.indexOf(x) > -1)) return false;
    return true;
  }
  function matches(s, q) {
    if (!s.isActive || !matchesTab(s) || !matchesFilters(s)) return false;
    if (!q) return true;
    return [s.displayName, s.shortDescription, s.category, s.aliases.join(" "), s.materials.join(" "), s.definingFeatures.join(" "), s.palette.join(" ")]
      .join(" ").toLowerCase().indexOf(q) > -1;
  }
  function sorted(list) {
    const a = list.slice();
    if (sort === "az") a.sort((x, y) => x.displayName.localeCompare(y.displayName));
    else if (sort === "newest") a.sort((x, y) => STYLES.indexOf(y) - STYLES.indexOf(x));
    else a.sort((x, y) => x.featuredRank - y.featuredRank || x.displayName.localeCompare(y.displayName));
    return a;
  }
  function current() {
    const q = ($("xpQ").value || "").trim().toLowerCase();
    return sorted(STYLES.filter((s) => matches(s, q)));
  }
  function activeChips() {
    return Object.keys(f).reduce((acc, k) => acc.concat(f[k].map((v) => [k, v])), []);
  }

  /* ---------- cards ---------- */
  function card(s) {
    const on = saved.indexOf(s.id) > -1;
    return `<article class="xp-card" data-d="${s.id}" tabindex="0">
      <div class="xp-img"><img src="${s.previewImage}" alt="${esc(s.displayName)} design style preview" loading="lazy">
        <button class="xp-save${on ? " on" : ""}" data-save="${s.id}" aria-pressed="${on}" aria-label="${on ? "Remove From Saved" : "Save Style"}" title="${on ? "Saved" : "Save Style"}"><i data-lucide="bookmark"></i></button>
      </div>
      <div class="xp-body">
        <div class="xp-t"><b>${esc(s.displayName)}</b></div>
        <p class="xp-line">${esc(s.shortDescription)}</p>
        ${swatches(s)}
        <div class="xp-acts">
          <button class="btn btn-ghost btn-xs" data-open="${s.id}">Preview</button>
          <button class="btn btn-primary btn-xs" data-use="${s.id}">Try This Style</button>
        </div>
      </div>
    </article>`;
  }
  const grid = (list) => `<div class="xp-grid">${list.map(card).join("")}</div>`;

  function emptyState(msg) {
    return `<div class="xp-empty"><i data-lucide="compass"></i><b>No Exact Matches Yet.</b><p>${esc(msg)}</p>
      <button class="btn btn-ghost btn-sm" id="xpClear">Clear Filters</button>
      <button class="btn btn-primary btn-sm" id="xpCustom">Start In Studio</button></div>`;
  }

  function paint() {
    const list = current();
    const chips = activeChips();
    const fc = $("xpFilterCnt");
    fc.hidden = !chips.length; fc.textContent = chips.length;
    const bar = $("xpActive");
    bar.hidden = !chips.length;
    bar.innerHTML = chips.length
      ? chips.map(([k, v]) => `<button class="xp-achip" data-off="${k}:${esc(v)}">${esc(v)}<i data-lucide="x"></i></button>`).join("") +
        '<button class="xp-aclear" id="xpClear">Clear All</button>'
      : "";
    $("xpCount").textContent = list.length + " Of " + STYLES.length + " Styles";
    $("xpSavedCnt").textContent = saved.length;
    $("xpSortLab").textContent = (SORTS.find((x) => x[0] === sort) || [, "Popular"])[1];

    const body = $("xpBody");
    if (!list.length) {
      body.innerHTML = emptyState(tab === "Saved" ? "Save a style from any card and it lands here." : "Try removing a filter, or describe the style you want in Studio.");
    } else if (tab === "Featured" && !($("xpQ").value || "").trim() && !chips.length) {
      const popular = list.filter((s) => s.isFeatured);
      const groups = STYLE_CATEGORIES.filter((c) => c !== "Most Popular")
        .map((c) => [c, list.filter((s) => s.category === c)])
        .filter(([, arr]) => arr.length);
      body.innerHTML =
        section("Popular Styles", "popular", popular, false) +
        groups.map(([c, arr]) => section(c, c, arr, true)).join("");
    } else {
      body.innerHTML = grid(list);
    }
    syncFilterDrawer();
    icons_();
  }

  function section(title, key, list, collapsible) {
    const open = expanded[key] || !collapsible;
    const shown = open ? list : list.slice(0, 4);
    const more = collapsible && list.length > 4;
    return `<section class="xp-sec">
      <div class="xp-sec-h"><h3>${esc(title)}</h3><span>${list.length} Styles</span>
        ${more ? `<button class="fb-link" data-more="${esc(key)}">${open ? "Show Less" : "View All"}</button>` : ""}</div>
      ${grid(shown)}
    </section>`;
  }

  /* ---------- filter drawer ---------- */
  function optRow(kind, label, value, on) {
    return `<label class="xp-opt${on ? " on" : ""}"><input type="checkbox" data-f="${kind}:${esc(value)}"${on ? " checked" : ""}><span class="xp-box"><i data-lucide="check"></i></span><span class="xp-optl">${esc(label)}</span></label>`;
  }
  function filterDrawerHtml() {
    const sec = (t, rows) => `<div class="xp-fsec"><span class="xp-flab">${t}</span><div class="xp-opts">${rows}</div></div>`;
    const types = [["interior", "Interior"], ["exterior", "Exterior"], ["garden", "Garden"], ["virtual-staging", "Virtual Staging"], ["concept", "Written Concept"]];
    return `
      <div class="xp-dh"><div><span class="xp-eyebrow">Refine</span><h3>Filters</h3><p>Narrow the catalog without leaving the page.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        ${sec("Style Family", STYLE_CATEGORIES.map((c) => optRow("family", c, c, f.family.indexOf(c) > -1)).join(""))}
        ${sec("Project Type", types.map(([v, l]) => optRow("type", l, v, f.type.indexOf(v) > -1)).join(""))}
        ${sec("Room Type", ROOMS.map((r) => optRow("room", r, r, f.room.indexOf(r) > -1)).join(""))}
        ${sec("Color Palette", PALETTES.map((p) => optRow("palette", p, p, f.palette.indexOf(p) > -1)).join(""))}
        ${sec("Finish Level", FINISHES.map((x) => optRow("finish", x, x, f.finish.indexOf(x) > -1)).join(""))}
        ${sec("Mood", MOODS.map((x) => optRow("mood", x, x, f.mood.indexOf(x) > -1)).join(""))}
      </div>
      <div class="xp-df"><button class="fb-link" id="xpClear">Clear All</button><button class="btn btn-primary btn-sm" data-close="1" id="xpShow">Show ${current().length} Styles</button></div>`;
  }
  function syncFilterDrawer() {
    const p = $("xpDPanel");
    if (!p || !p.querySelector(".xp-fsec")) return;
    p.querySelectorAll(".xp-opt input[data-f]").forEach((inp) => {
      const raw = String(inp.dataset.f);
      const i = raw.indexOf(":");
      const k = raw.slice(0, i), v = raw.slice(i + 1);
      const on = (f[k] || []).indexOf(v) > -1;
      inp.checked = on;
      inp.closest(".xp-opt").classList.toggle("on", on);
    });
    const btn = p.querySelector("#xpShow");
    if (btn) btn.textContent = "Show " + current().length + " Styles";
  }
  function toggleFilter(kind, value) {
    const arr = f[kind];
    if (!arr) return;
    f[kind] = arr.indexOf(value) > -1 ? arr.filter((x) => x !== value) : arr.concat([value]);
    paint();
  }
  function clearFilters() { Object.keys(f).forEach((k) => (f[k] = [])); paint(); }

  /* ---------- drawer ---------- */
  function openDrawer(inner) {
    $("xpDPanel").innerHTML = inner;
    $("xpDrawer").hidden = false;
    requestAnimationFrame(() => $("xpDrawer").classList.add("on"));
    icons_();
  }
  function closeDrawer() { $("xpDrawer").classList.remove("on"); setTimeout(() => ($("xpDrawer").hidden = true), 200); }

  function compatLine(s) {
    const p = prop();
    if (!p) return '<div class="xp-note"><i data-lucide="info"></i><span>Choose a style now. You can apply it to a property when you are ready.</span></div>';
    const cur = propStyleName();
    if (cur && cur !== s.displayName)
      return `<div class="xp-note warn"><i data-lucide="dna"></i><span>This property currently uses <b>${esc(cur)}</b>. Replacing the Design DNA changes the rules every room follows.</span></div>`;
    if (cur === s.displayName) return `<div class="xp-note ok"><i data-lucide="check"></i><span>${esc(p.address)} already uses this style as its Design DNA.</span></div>`;
    return `<div class="xp-note"><i data-lucide="map-pin"></i><span>Previewing For ${esc(p.address)}. No Design DNA locked yet.</span></div>`;
  }

  function styleDrawer(id) {
    const s = styleById(id);
    if (!s) return;
    const locked = !!propStyleName() && propStyleName() !== s.displayName;
    const tags = (arr) => arr.map((m) => `<span class="xp-tag">${esc(m)}</span>`).join("");
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">${esc(s.category)}</span><h3>${esc(s.displayName)}</h3><p>${esc(s.shortDescription)}</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        <div class="xp-hero"><img src="${s.previewImage}" alt="${esc(s.displayName)} preview" id="xpHero"></div>
        ${compatLine(s)}
        <div class="xp-spec"><b>Color Palette</b><div class="xp-pal">${s.swatches.map((c) => `<i style="background:${c}"></i>`).join("")}</div><div>${tags(s.palette)}</div></div>
        <div class="xp-spec"><b>Materials</b><div>${tags(s.materials)}</div></div>
        <div class="xp-spec"><b>Defining Features</b><div>${tags(s.definingFeatures)}</div></div>
        <div class="xp-spec"><b>Works With</b><div>${tags(s.compatibleProjectTypes.map((t) => t.replace("-", " ")).concat(s.compatibleRoomTypes.slice(0, 4)))}</div></div>
        <div class="xp-spec"><b>Finish Levels</b><div>${tags(s.finishLevel)}</div></div>
        ${s.aliases.length ? `<div class="xp-spec"><b>Also Known As</b><div>${tags(s.aliases)}</div></div>` : ""}
      </div>
      <div class="xp-df">
        <button class="btn btn-primary btn-sm" data-use="${s.id}"><i data-lucide="wand-2"></i>Try This Style</button>
        <button class="btn btn-ghost btn-sm" data-dna="${s.id}"><i data-lucide="dna"></i>${locked ? "Replace Property DNA" : "Set As Property Design DNA"}</button>
        <button class="btn btn-ghost btn-sm" data-save="${s.id}"><i data-lucide="bookmark"></i>${saved.indexOf(s.id) > -1 ? "Saved" : "Save Style"}</button>
      </div>`);
  }

  function savedDrawer() {
    const items = saved.map(styleById).filter(Boolean);
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">Collection</span><h3>Saved Styles</h3><p>Styles you kept for later. Generated results stay in Designs.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        ${items.length ? `<div class="xp-saved">${items.map((s) => `<div class="xp-sitem"><img src="${s.previewImage}" alt="${esc(s.displayName)}"><div><b>${esc(s.displayName)}</b><span>${esc(s.shortDescription)}</span></div><button class="fb-link" data-open="${s.id}">Preview</button><button class="fb-link" data-save="${s.id}">Remove</button></div>`).join("")}</div>`
        : '<div class="xp-note"><i data-lucide="bookmark"></i><span>Nothing saved yet. Use the bookmark on any style card.</span></div>'}
      </div>
      <div class="xp-df"><button class="btn btn-ghost btn-sm" data-close="1">Close</button></div>`);
  }

  /* ---------- apply a style ---------- */
  /** Store the canonical selection and hand it to Studio. Never generates, never charges. */
  let applying = false;
  function applyToStudio(s, btn) {
    if (applying) return;
    const choice = setStudioStyle(s && s.id);
    if (!choice) { note("This Style Could Not Be Loaded. Please Choose Another Style."); return; }
    applying = true;
    let restore = null;
    if (btn) {
      restore = btn.innerHTML;
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = "Opening Studio…";
    }
    applyStudioStyleToControls(choice);
    closeDrawer();
    try {
      go("studio");
      note(choice.name + " Selected. Add A Source If You Need One, Then Generate.");
    } catch (err) {
      note("Studio Could Not Be Opened. Please Try Again.");
    } finally {
      window.setTimeout(() => {
        applying = false;
        if (btn && restore != null) { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.innerHTML = restore; icons_(); }
      }, 500);
    }
  }


  async function setDna(s) {
    const p = prop();
    if (!p) { note("Select A Property First. Open Properties And Choose One."); return; }
    if (!api.setPropertyDna) { note("Design DNA Is Not Available Right Now."); return; }
    const items = [{ label: s.displayName, color: s.swatches[0] }]
      .concat(s.swatches.slice(1, 4).map((c, i) => ({ label: s.materials[i] || "Palette " + (i + 2), color: c })));
    try {
      await api.setPropertyDna({ data: { property_id: p.id, items } });
      if (api.reloadTree) await api.reloadTree();
      syncProp();
      closeDrawer();
      note(s.displayName + " Is Now The Design DNA For " + p.address + ".");
    } catch (e) { note((e && e.message) || "That Did Not Save."); }
  }

  function confirmDna(s) {
    const p = prop();
    if (!p) { note("Select A Property First. Open Properties And Choose One."); return; }
    const cur = propStyleName();
    if (!cur || cur === s.displayName) { setDna(s); return; }
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">Design DNA</span><h3>Replace Property DNA?</h3><p>This property currently uses ${esc(cur)}.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db"><div class="xp-note warn"><i data-lucide="dna"></i><span>Replacing the Design DNA on ${esc(p.address)} changes the palette and finish rules every room inherits.</span></div>
        <div class="xp-cmp"><div><span class="xp-lab">Current</span><b>${esc(cur)}</b></div><div><span class="xp-lab">New</span><b>${esc(s.displayName)}</b>${swatches(s)}</div></div></div>
      <div class="xp-df"><button class="btn btn-ghost btn-sm" data-open="${s.id}">Preview Only</button>
        <button class="btn btn-primary btn-sm" data-dnago="${s.id}"><i data-lucide="dna"></i>Replace Property DNA</button></div>`);
  }

  /* ---------- recommendations ---------- */
  function paintRec() {
    const sec = $("xpRec");
    const src = read(LS.src, null);
    if (!src) { sec.hidden = true; return; }
    const recs = recommendStyles({
      projectType: src.projectType || "interior",
      roomType: src.roomType,
      brightness: src.brightness,
      woodTones: src.woodTones,
      text: src.text,
    }, 4);
    if (!recs.length) { sec.hidden = true; return; }
    sec.hidden = false;
    sec.innerHTML = `<div class="xp-sec-h"><h3>Recommended For Your Space</h3><span>Based On Your Last Upload</span></div>
      <div class="xp-recrow">${recs.map(({ style, reason }) => `
        <article class="xp-reccard" data-d="${style.id}">
          <img src="${style.previewImage}" alt="${esc(style.displayName)}" loading="lazy">
          <div><b>${esc(style.displayName)}</b><p>${esc(reason)}</p>
            <div class="xp-acts"><button class="btn btn-ghost btn-xs" data-open="${style.id}">Preview</button>
              <button class="btn btn-primary btn-xs" data-use="${style.id}">Try This Style</button></div></div>
        </article>`).join("")}</div>`;
  }

  /* ---------- five step style finder ---------- */
  const QUIZ = [
    { key: "aesthetic", q: "Which Overall Aesthetic Feels Right?", opts: ["warm-minimal", "traditional", "industrial", "bohemian"] },
    { key: "warmth", q: "Which Color And Warmth Do You Prefer?", opts: ["organic-modern", "coastal", "dark-academia"] },
    { key: "shape", q: "Which Furniture Shape Appeals More?", opts: ["soft-contemporary", "mid-century-modern", "neoclassical"] },
    { key: "material", q: "Which Materials And Texture Do You Like?", opts: ["japandi", "quiet-luxury", "rustic", "modern"] },
    { key: "detail", q: "How Much Detail Do You Want?", opts: ["minimalist", "transitional", "maximalist"] },
  ];
  let q = read(LS.quiz, null) || { step: 0, picks: [], done: false };
  if (!Array.isArray(q.picks)) q = { step: 0, picks: [], done: false };
  let qBusy = false;
  const qSave = () => write(LS.quiz, q);

  function qResults() {
    const picks = q.picks.filter(Boolean).map(styleById).filter(Boolean);
    const score = {};
    picks.forEach((s) => {
      score[s.id] = (score[s.id] || 0) + 4;
      STYLES.forEach((o) => {
        if (o.id === s.id) return;
        let pts = 0;
        if (o.category === s.category) pts += 2;
        if (o.mood.some((m) => s.mood.indexOf(m) > -1)) pts += 1;
        if (o.materials.some((m) => s.materials.indexOf(m) > -1)) pts += 1;
        if (pts) score[o.id] = (score[o.id] || 0) + pts;
      });
    });
    return Object.keys(score)
      .sort((a, b) => score[b] - score[a])
      .slice(0, 3)
      .map(styleById)
      .filter(Boolean);
  }

  const MATCH_LABEL = ["Best Match", "Strong Match", "Also Recommended"];
  function paintQuiz() {
    const wrap = $("xpQuiz"), cardEl = $("xpQuizCard");
    if (!wrap || !cardEl) return;
    wrap.hidden = false;
    if (q.done) {
      const res = qResults();
      cardEl.innerHTML = res.length
        ? `<div class="xp-quiz-head"><b>Your Style Matches</b></div>
        <div class="xp-quiz-res-grid">${res.map((s, i) => `
          <div class="xp-quiz-res-card">
            <img src="${s.previewImage}" alt="${esc(s.displayName)}" loading="lazy">
            <div class="xp-quiz-res-body"><span class="xp-quiz-badge">${MATCH_LABEL[i] || "Also Recommended"}</span>
              <b>${esc(s.displayName)}</b><p>${esc(s.shortDescription)}</p>
              <div class="xp-quiz-res-act">
                <button class="btn btn-primary btn-xs" data-use="${s.id}">Try This Style</button>
                <button class="btn btn-ghost btn-xs" data-save="${s.id}"><i data-lucide="bookmark"></i>${saved.indexOf(s.id) > -1 ? "Saved" : "Save Style"}</button>
              </div></div></div>`).join("")}</div>
        <div class="xp-quiz-foot"><button class="fb-link" data-qretake="1">Retake</button><button class="btn btn-ghost btn-xs" data-qbrowse="1">Browse All Styles</button></div>`
        : `<div class="xp-quiz-head"><b>No Answers Yet</b></div><p class="xp-line">You skipped every step. Retake it whenever you like.</p>
           <div class="xp-quiz-foot"><button class="fb-link" data-qretake="1">Retake</button></div>`;
      icons_();
      return;
    }
    const i = Math.max(0, Math.min(q.step, QUIZ.length - 1));
    const step = QUIZ[i];
    const chosen = q.picks[i] || "";
    cardEl.innerHTML = `<div class="xp-quiz-head"><b>${esc(step.q)}</b><span class="xp-quiz-step">${i + 1} Of ${QUIZ.length}</span></div>
      <div class="xp-quiz-prog"><span style="width:${((i + 1) / QUIZ.length) * 100}%"></span></div>
      <div class="xp-quiz-opts">${step.opts.map((id) => { const s = styleById(id); return s ? `<button class="xp-quiz-opt${chosen === s.id ? " on" : ""}" data-qpick="${s.id}" aria-pressed="${chosen === s.id}"><img src="${s.previewImage}" alt="${esc(s.displayName)}" loading="lazy"><span>${esc(s.displayName)}</span></button>` : ""; }).join("")}</div>
      <div class="xp-quiz-foot">
        <div class="xp-quiz-nav">${i > 0 ? '<button class="fb-link" data-qback="1"><i data-lucide="chevron-left"></i>Back</button>' : ""}<button class="fb-link" data-qskip="1">Skip For Now</button></div>
        <button class="btn btn-primary btn-xs" data-qnext="1"${chosen ? "" : " disabled"}>${i === QUIZ.length - 1 ? "See Matches" : "Next"}</button>
      </div>`;
    icons_();
  }
  function quizAdvance() {
    if (q.step < QUIZ.length - 1) q.step++;
    else q.done = true;
    qSave();
    paintQuiz();
    if (q.done) note("Your Style Matches Are Ready");
  }
  function quizPick(id) {
    if (qBusy) return;
    qBusy = true;
    q.picks[q.step] = id;
    qSave();
    paintQuiz();
    window.setTimeout(() => { qBusy = false; quizAdvance(); }, 300);
  }

  /* ---------- saving ---------- */
  function toggleSave(id) {
    const on = saved.indexOf(id) > -1;
    saved = on ? saved.filter((x) => x !== id) : [id].concat(saved);
    write(LS.saved, saved);
    note(on ? "Removed From Saved Styles" : "Saved To Your Styles");
    paint();
    if (q.done) paintQuiz();
    if (!$("xpDrawer").hidden) {
      const btn = host.querySelector('#xpDPanel [data-save="' + id + '"]');
      if (btn && btn.classList.contains("btn")) { btn.innerHTML = '<i data-lucide="bookmark"></i>' + (on ? "Save Style" : "Saved"); icons_(); }
    }
  }

  /* ---------- property context ---------- */
  function syncProp() {
    const p = prop();
    const pill = $("xpProp");
    if (!pill) return;
    if (!p) { pill.hidden = true; return; }
    pill.hidden = false;
    const cur = propStyleName();
    pill.innerHTML = '<i data-lucide="map-pin"></i>Previewing For ' + esc(p.address) + (cur ? ' <em>&middot; ' + esc(cur) + " DNA</em>" : "");
    icons_();
  }
  host._xpSync = () => { syncProp(); paintRec(); };

  /* ---------- admin style library ---------- */
  async function openAdmin() {
    const mod = await import("@/content/rd-style-admin");
    mod.openStyleAdmin(openDrawer, closeDrawer, note, icons_, host);
  }
  (async () => {
    try {
      const { isStyleAdmin } = await import("@/lib/style-admin.functions");
      const ok = await isStyleAdmin();
      if (ok && ok.admin) { $("xpAdminBtn").hidden = false; icons_(); }
    } catch (_) {}
  })();

  /* ---------- events ---------- */
  host.addEventListener("click", (e) => {
    const t = e.target;
    const hit = (a) => t.closest("[" + a + "]");
    let el;
    if ((el = hit("data-c"))) {
      tab = el.dataset.c;
      host.querySelectorAll(".xp-cat").forEach((b) => { const on = b === el; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
      paint(); return;
    }
    if ((el = hit("data-sort"))) { sort = el.dataset.sort; $("xpSortMenu").hidden = true; $("xpSortBtn").setAttribute("aria-expanded", "false");
      host.querySelectorAll(".xp-sortopt").forEach((b) => b.classList.toggle("on", b === el)); paint(); return; }
    if (t.closest("#xpSortBtn")) { const m = $("xpSortMenu"); m.hidden = !m.hidden; $("xpSortBtn").setAttribute("aria-expanded", String(!m.hidden)); return; }
    if ((el = hit("data-more"))) { const k = el.dataset.more; expanded[k] = !expanded[k]; paint(); return; }
    if ((el = hit("data-off"))) { const raw = String(el.dataset.off); const i = raw.indexOf(":"); toggleFilter(raw.slice(0, i), raw.slice(i + 1)); return; }
    if ((el = hit("data-save"))) { toggleSave(el.dataset.save); return; }
    if ((el = hit("data-open"))) { styleDrawer(el.dataset.open); return; }
    if ((el = hit("data-use"))) { e.preventDefault(); const s = styleById(el.dataset.use); if (!s) { note("This Style Could Not Be Loaded. Please Choose Another Style."); return; } applyToStudio(s, el); return; }
    if ((el = hit("data-dnago"))) { const s = styleById(el.dataset.dnago); if (s) setDna(s); return; }
    if ((el = hit("data-dna"))) { const s = styleById(el.dataset.dna); if (s) confirmDna(s); return; }
    if (t.closest("#xpClear")) { clearFilters(); return; }
    if (t.closest("[data-close]") || t.closest("#xpScrim")) { closeDrawer(); return; }
    if (t.closest("#xpSavedBtn")) { savedDrawer(); return; }
    if (t.closest("#xpAdminBtn")) { openAdmin(); return; }
    if (t.closest("#xpCustom")) { go("studio"); return; }
    if (t.closest("#xpFilterBtn")) { openDrawer(filterDrawerHtml()); return; }
    if ((el = hit("data-qpick"))) { quizPick(el.dataset.qpick); return; }
    if (t.closest("[data-qnext]")) { if (!qBusy) quizAdvance(); return; }
    if (t.closest("[data-qback]")) { if (q.done) { q.done = false; q.step = QUIZ.length - 1; } else if (q.step > 0) q.step--; qSave(); paintQuiz(); return; }
    if (t.closest("[data-qskip]")) { if (!qBusy) { q.picks[q.step] = null; qSave(); quizAdvance(); } return; }
    if (t.closest("[data-qbrowse]")) { const b = $("xpBody"); if (b) b.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (t.closest("[data-qretake]")) { q = { step: 0, picks: [], done: false }; qSave(); paintQuiz(); return; }
  });

  host.addEventListener("keydown", (e) => {
    const cardEl = e.target.closest && e.target.closest(".xp-card");
    if (cardEl && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); styleDrawer(cardEl.dataset.d); }
  });

  host.addEventListener("change", (e) => {
    const inp = e.target.closest && e.target.closest("input[data-f]");
    if (!inp) return;
    const raw = String(inp.dataset.f);
    const i = raw.indexOf(":");
    toggleFilter(raw.slice(0, i), raw.slice(i + 1));
  });

  let qt;
  $("xpQ").addEventListener("input", () => { clearTimeout(qt); qt = window.setTimeout(paint, 160); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("xpDrawer").hidden) closeDrawer();
    if (!$("xpSortMenu").hidden) $("xpSortMenu").hidden = true;
  });
  document.addEventListener("click", (e) => {
    if (!host.contains(e.target) || !e.target.closest(".xp-sortwrap")) {
      const m = $("xpSortMenu");
      if (m && !m.hidden) { m.hidden = true; $("xpSortBtn").setAttribute("aria-expanded", "false"); }
    }
  }, true);

  syncProp();
  paintRec();
  paintQuiz();
  paint();
  icons_();
}
