// Explore: discover and compare canonical design directions inside the app.
// Studio creates, Designs stores generated output, Design DNA holds property rules.
// This screen only discovers directions and hands them to those existing systems.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";

export { DIRECTIONS } from "@/content/directions";
import { DIRECTIONS } from "@/content/directions";

const SPACES = ["All", "Interior", "Exterior", "Landscape", "Virtual Staging", "Saved"];
// App-facing label: "Landscape" data value is shown as "Garden".
const gtxt = (s) => String(s).replace(/Landscaping/g, "Gardening").replace(/Landscape/g, "Garden");
const spaceLabel = (s) => (String(s) === "Landscape" || String(s) === "Landscaping" ? "Garden" : s);

/** Room filters offered in the UI, mapped onto the canonical room labels. */
const ROOMS = [
  ["Living Room", ["Living Room"]],
  ["Kitchen", ["Kitchen"]],
  ["Bedroom", ["Primary Bedroom", "Guest Bedroom", "Bedroom"]],
  ["Bathroom", ["Primary Bath", "Guest Bath", "Bathroom"]],
  ["Dining Room", ["Dining Room"]],
  ["Office", ["Home Office", "Office"]],
  ["Entry", ["Entry", "Entryway", "Front Elevation"]],
  ["Basement", ["Basement"]],
];

const TRAITS = ["Warm", "Minimal", "Traditional", "Organic", "Bold", "Luxury"];
const GRADES = ["Rental Grade", "Retail Grade", "Premium"];

const LS = { saved: "rd_ex_saved", seen: "rd_ex_seen" };
function read(k, f) { try { return JSON.parse(localStorage.getItem(k) || "") ?? f; } catch (_) { return f; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

let saved = read(LS.saved, []);
let seen = read(LS.seen, []);

function dir(id) { return DIRECTIONS.find((d) => d.id === id); }
function swatches(p) { return '<span class="xp-sw">' + p.map((c) => `<i style="background:${c}"></i>`).join("") + "</span>"; }

const SHELL = `
<div class="xp">
  <header class="xp-head">
    <div class="xp-head-t">
      <h2>Explore</h2>
      <p>Find a direction, preview it across spaces and apply it to your design.</p>
    </div>
    <div class="xp-head-a">
      <span class="xp-prop" id="xpProp" hidden></span>
      <button class="btn btn-ghost btn-sm" id="xpSavedBtn"><i data-lucide="bookmark"></i>Saved Directions<span class="xp-cnt" id="xpSavedCnt">0</span></button>
    </div>
  </header>

  <div class="xp-bar">
    <div class="xp-search"><i data-lucide="search"></i><input id="xpQ" type="text" placeholder="Search directions, materials or rooms"></div>
    <button class="btn btn-ghost btn-sm xp-filter-btn" id="xpFilterBtn" aria-haspopup="dialog"><i data-lucide="sliders-horizontal"></i>Filter<span class="xp-cnt" id="xpFilterCnt" hidden>0</span></button>
  </div>

  <div class="xp-cats" id="xpCats"></div>

  <div class="xp-active" id="xpActive" hidden></div>


  <section class="xp-quiz" id="xpQuiz" hidden>
    <div class="xp-quiz-top">
      <div><h3>Find Your Design Direction</h3><p>Five quick picks. Optional, and you can change it later.</p></div>
    </div>
    <div class="xp-quiz-card" id="xpQuizCard"></div>
  </section>

  <p class="xp-count" id="xpCount"></p>
  <div class="xp-grid" id="xpGrid"></div>
</div>
<div class="xp-drawer" id="xpDrawer" hidden><div class="xp-scrim" id="xpScrim"></div><aside class="xp-dpanel" id="xpDPanel" role="dialog" aria-modal="true"></aside></div>
`;

function exToast(msg) {
  let t = document.querySelector(".rd-app .xp-toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "xp-toast";
    (document.querySelector(".rd-app") || document.body).appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(t._h);
  t._h = window.setTimeout(() => t.classList.remove("on"), 3000);
}

/**
 * @param go router used by the app shell
 * @param ctx { curProp, setPropertyDna, reloadTree } from the existing property/DNA system
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

  let cat = "All";
  let rooms = [];
  let traits = [];
  let grades = [];


  const prop = () => { try { return (api.curProp && api.curProp()) || null; } catch (_) { return null; } };
  /** Direction name a property is currently locked to, stored as the first DNA line. */
  function propDirection() {
    const p = prop();
    const first = p && p.dna && p.dna[0];
    if (!first) return null;
    const hit = DIRECTIONS.find((d) => d.name.toLowerCase() === String(first.label).toLowerCase());
    return hit ? hit.name : null;
  }

  /* ---------- primary categories ---------- */
  $("xpCats").innerHTML = SPACES.map((s) => `<button class="xp-cat${s === cat ? " on" : ""}" data-c="${s}">${spaceLabel(s)}</button>`).join("");

  function matchesSpace(d) {
    if (cat === "All") return true;
    if (cat === "Virtual Staging") return !!d.staging;
    if (cat === "Saved") return saved.indexOf(d.id) > -1;
    return d.spaces.indexOf(cat) > -1;
  }
  function matchesRoom(d) {
    if (!rooms.length) return true;
    return rooms.some((label) => {
      const syn = (ROOMS.find((r) => r[0] === label) || [null, []])[1];
      return d.rooms.some((r) => syn.indexOf(r) > -1);
    });
  }
  function matches(d, q) {
    if (!matchesSpace(d) || !matchesRoom(d)) return false;
    if (traits.length && !traits.every((t) => (d.traits || []).indexOf(t) > -1)) return false;
    if (grades.length && !grades.some((g) => d.grades.indexOf(g) > -1)) return false;
    if (!q) return true;
    return [d.name, d.line, d.about, (d.traits || []).join(" "), d.materials.join(" "), d.rooms.join(" ")]
      .join(" ").toLowerCase().indexOf(q) > -1;
  }
  /** Count of matches for the current selections, used by the drawer button. */
  function resultCount() {
    const q = ($("xpQ").value || "").trim().toLowerCase();
    return DIRECTIONS.filter((d) => matches(d, q)).length;
  }
  function activeFilters() {
    return rooms.map((v) => ["room", v]).concat(traits.map((v) => ["trait", v]), grades.map((v) => ["grade", v]));
  }


  /* ---------- cards ---------- */
  function card(d) {
    const on = saved.indexOf(d.id) > -1;
    const tags = d.spaces.map(spaceLabel).concat(d.staging ? ["Virtual Staging"] : []);
    return `<article class="xp-card" data-d="${d.id}">
      <div class="xp-img"><img src="${d.img}" alt="${esc(d.name)} design direction" loading="lazy">
        <button class="xp-save${on ? " on" : ""}" data-save="${d.id}" aria-label="Save Direction" title="Save Direction"><i data-lucide="bookmark"></i></button>
      </div>
      <div class="xp-body">
        <div class="xp-t"><b>${esc(gtxt(d.name))}</b></div>
        <p class="xp-line">${esc(gtxt(d.line))}</p>
        ${swatches(d.palette)}
        <div class="xp-meta">${tags.map((s) => `<span class="xp-tag">${esc(s)}</span>`).join("")}</div>
        <div class="xp-acts">
          <button class="btn btn-ghost btn-xs" data-open="${d.id}">Preview</button>
          <button class="btn btn-primary btn-xs" data-use="${d.id}">Use This Direction</button>
        </div>
      </div>
    </article>`;
  }

  function paint() {
    const q = ($("xpQ").value || "").trim().toLowerCase();
    const list = DIRECTIONS.filter((d) => matches(d, q));
    const act = activeFilters();
    const fc = $("xpFilterCnt");
    fc.hidden = !act.length; fc.textContent = act.length;
    const bar = $("xpActive");
    bar.hidden = !act.length;
    bar.innerHTML = act.length
      ? act.map(([k, v]) => `<button class="xp-achip" data-off="${k}:${esc(v)}">${esc(v)}<i data-lucide="x"></i></button>`).join("") +
        '<button class="xp-aclear" id="xpClear">Clear All</button>'
      : "";
    $("xpCount").textContent = list.length + " Of " + DIRECTIONS.length + " Directions";
    $("xpGrid").innerHTML = list.length
      ? list.map(card).join("")
      : `<div class="xp-empty"><i data-lucide="compass"></i><b>No Exact Matches Yet.</b><p>Try removing a filter, or start in Studio and describe the direction you want.</p><button class="btn btn-primary btn-sm" id="xpCustom">Start In Studio</button></div>`;
    $("xpSavedCnt").textContent = saved.length;
    syncFilterDrawer();
    icons_();
  }

  /* ---------- filter drawer ---------- */
  function optRow(kind, label, on) {
    return `<label class="xp-opt${on ? " on" : ""}"><input type="checkbox" data-f="${kind}:${esc(label)}"${on ? " checked" : ""}><span class="xp-box"><i data-lucide="check"></i></span><span class="xp-optl">${esc(label)}</span></label>`;
  }
  function filterDrawerHtml() {
    const sec = (title, rowsHtml) => `<div class="xp-fsec"><span class="xp-flab">${title}</span><div class="xp-opts">${rowsHtml}</div></div>`;
    return `
      <div class="xp-dh"><div><span class="xp-eyebrow">Refine</span><h3>Filter Designs</h3><p>Narrow directions by room, character and finish grade.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        ${sec("Room", ROOMS.map(([l]) => optRow("room", l, rooms.indexOf(l) > -1)).join(""))}
        ${sec("Characteristics", TRAITS.map((t) => optRow("trait", t, traits.indexOf(t) > -1)).join(""))}
        ${sec("Finish Grade", GRADES.map((g) => optRow("grade", g, grades.indexOf(g) > -1)).join(""))}
      </div>
      <div class="xp-df"><button class="fb-link" id="xpClear">Clear All</button><button class="btn btn-primary btn-sm" data-close="1" id="xpShow">Show ${resultCount()} Designs</button></div>`;
  }
  /** Keeps drawer checkboxes and the result-count button in sync without a rerender. */
  function syncFilterDrawer() {
    const p = $("xpDPanel");
    if (!p || !p.querySelector(".xp-fsec")) return;
    p.querySelectorAll(".xp-opt input[data-f]").forEach((inp) => {
      const [k, v] = String(inp.dataset.f).split(":");
      const on = (k === "room" ? rooms : k === "trait" ? traits : grades).indexOf(v) > -1;
      inp.checked = on;
      inp.closest(".xp-opt").classList.toggle("on", on);
    });
    const btn = p.querySelector("#xpShow");
    if (btn) btn.textContent = "Show " + resultCount() + " Designs";
  }
  function toggleFilter(kind, value) {
    const has = (a) => a.indexOf(value) > -1;
    if (kind === "room") rooms = has(rooms) ? rooms.filter((x) => x !== value) : rooms.concat([value]);
    else if (kind === "trait") traits = has(traits) ? traits.filter((x) => x !== value) : traits.concat([value]);
    else if (kind === "grade") grades = has(grades) ? grades.filter((x) => x !== value) : grades.concat([value]);
    paint();
  }


  /* ---------- property context ---------- */
  function syncProp() {
    const p = prop();
    const pill = $("xpProp");
    if (!pill) return;
    if (!p) { pill.hidden = true; return; }
    pill.hidden = false;
    const cur = propDirection();
    pill.innerHTML = '<i data-lucide="map-pin"></i>Previewing For ' + esc(p.address) + (cur ? ' <em>&middot; ' + esc(cur) + " DNA</em>" : "");
    icons_();
  }
  host._xpSync = syncProp;

  /* ---------- drawer ---------- */
  function openDrawer(inner) {
    $("xpDPanel").innerHTML = inner;
    $("xpDrawer").hidden = false;
    requestAnimationFrame(() => $("xpDrawer").classList.add("on"));
    icons_();
  }
  function closeDrawer() { $("xpDrawer").classList.remove("on"); setTimeout(() => ($("xpDrawer").hidden = true), 200); }

  function compatLine(d) {
    const p = prop();
    if (!p) return '<div class="xp-note"><i data-lucide="info"></i><span>Choose a direction now. You can apply it to a property when you are ready.</span></div>';
    const cur = propDirection();
    if (cur && cur !== d.name) {
      return `<div class="xp-note warn"><i data-lucide="dna"></i><span>This property currently uses <b>${esc(cur)}</b>. Replacing the Design DNA changes the rules every room follows.</span></div>`;
    }
    if (cur === d.name) return `<div class="xp-note ok"><i data-lucide="check"></i><span>${esc(p.address)} already uses this direction as its Design DNA.</span></div>`;
    return `<div class="xp-note"><i data-lucide="map-pin"></i><span>Previewing For ${esc(p.address)}. No Design DNA locked yet.</span></div>`;
  }

  function directionDrawer(id) {
    const d = dir(id);
    if (!d) return;
    if (seen.indexOf(d.name) === -1) { seen = [d.name].concat(seen).slice(0, 12); write(LS.seen, seen); }
    const shots = (d.examples && d.examples.length ? d.examples : [d.img]).slice(0, 4);
    const p = prop();
    const locked = !!propDirection() && propDirection() !== d.name;
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">Design Direction</span><h3>${esc(gtxt(d.name))}</h3><p>${esc(gtxt(d.line))}</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        <div class="xp-hero"><img src="${shots[0]}" alt="${esc(d.name)}" id="xpHero"></div>
        ${shots.length > 1 ? `<div class="xp-shots">${shots.map((s, i) => `<button class="xp-shot${i === 0 ? " on" : ""}" data-shot="${s}"><img src="${s}" alt="${esc(d.name)} example ${i + 1}" loading="lazy"></button>`).join("")}</div>` : ""}
        ${compatLine(d)}
        <p class="xp-about">${esc(gtxt(d.about))}</p>
        <div class="xp-spec"><b>Color Palette</b><div class="xp-pal">${d.palette.map((c) => `<i style="background:${c}"></i>`).join("")}</div></div>
        <div class="xp-spec"><b>Materials And Finishes</b><div>${d.materials.concat(d.finishes).map((m) => `<span class="xp-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="xp-spec"><b>Finish Grade Compatibility</b><div>${d.grades.map((m) => `<span class="xp-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="xp-spec"><b>Best For</b><div>${d.spaces.map(spaceLabel).concat(d.rooms).map((m) => `<span class="xp-tag">${esc(m)}</span>`).join("")}</div></div>
        <div class="xp-spec"><b>Suggested Budget Bands</b><div>${d.budgets.map((m) => `<span class="xp-tag">${esc(m)}</span>`).join("")}</div></div>
      </div>
      <div class="xp-df">
        <button class="btn btn-primary btn-sm" data-use="${d.id}"><i data-lucide="wand-2"></i>Apply To Current Design</button>
        <button class="btn btn-ghost btn-sm" data-dna="${d.id}"><i data-lucide="dna"></i>${locked ? "Replace Property DNA" : "Set As Property Design DNA"}</button>
        <button class="btn btn-ghost btn-sm" data-save="${d.id}"><i data-lucide="bookmark"></i>${saved.indexOf(d.id) > -1 ? "Saved" : "Save Direction"}</button>
      </div>`);
    if (!p) { /* no property: DNA action still shown, guarded on click */ }
  }

  function savedDrawer() {
    const items = saved.map(dir).filter(Boolean);
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">Collection</span><h3>Saved Directions</h3><p>Directions you kept for later. Generated results stay in Designs.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        ${items.length ? `<div class="xp-saved">${items.map((d) => `<div class="xp-sitem"><img src="${d.img}" alt="${esc(d.name)}"><div><b>${esc(gtxt(d.name))}</b><span>${esc(gtxt(d.line))}</span></div><button class="fb-link" data-open="${d.id}">Preview</button><button class="fb-link" data-save="${d.id}">Remove</button></div>`).join("")}</div>`
        : '<div class="xp-note"><i data-lucide="bookmark"></i><span>Nothing saved yet. Use Save Direction on any preview.</span></div>'}
      </div>
      <div class="xp-df"><button class="btn btn-ghost btn-sm" data-close="1">Close</button></div>`);
  }

  /* ---------- actions ---------- */
  const BANDS = ["Refresh", "Makeover", "Renovation", "Full Remodel"];

  /** Hand the direction to the existing Studio controls. Never generates. */
  function applyToStudio(d) {
    const sel = document.getElementById("fStyle");
    if (sel) {
      if (!Array.from(sel.options).some((o) => o.value === d.name || o.text === d.name)) {
        sel.insertAdjacentHTML("afterbegin", `<option>${esc(d.name)}</option>`);
      }
      sel.value = d.name;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const space = d.spaces[0];
    if (space) {
      const chip = document.querySelector('#spChips [data-sp="' + space.toLowerCase() + '"]');
      if (chip && !chip.classList.contains("on")) chip.click();
    }
    // Preserve the room already chosen for the current property; only fill a blank.
    const rs = document.getElementById("fRoom");
    if (rs && !rs.value && d.rooms[0]) {
      if (!Array.from(rs.options).some((o) => o.text === d.rooms[0])) rs.insertAdjacentHTML("beforeend", `<option>${esc(d.rooms[0])}</option>`);
      rs.value = d.rooms[0];
      rs.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeDrawer();
    go("studio");
    const p = prop();
    note(gtxt(d.name) + " Applied In Studio" + (p ? " For " + p.address : "") + ". Confirm Your Settings, Then Generate.");
  }

  /** Write the direction into the existing property Design DNA system. */
  async function setDna(d) {
    const p = prop();
    if (!p) { note("Select A Property First. Open Properties And Choose One."); return; }
    if (!api.setPropertyDna) { note("Design DNA Is Not Available Right Now."); return; }
    const items = [{ label: d.name, color: d.palette[0] }]
      .concat(d.palette.slice(1, 4).map((c, i) => ({ label: d.materials[i] || "Palette " + (i + 2), color: c })));
    try {
      await api.setPropertyDna({ data: { property_id: p.id, items } });
      if (api.reloadTree) await api.reloadTree();
      syncProp();
      closeDrawer();
      note(gtxt(d.name) + " Is Now The Design DNA For " + p.address + ".");
    } catch (e) {
      note((e && e.message) || "That Did Not Save.");
    }
  }

  function confirmDna(d) {
    const p = prop();
    if (!p) { note("Select A Property First. Open Properties And Choose One."); return; }
    const cur = propDirection();
    if (!cur || cur === d.name) { setDna(d); return; }
    openDrawer(`
      <div class="xp-dh"><div><span class="xp-eyebrow">Design DNA</span><h3>Replace Property DNA?</h3>
        <p>This property currently uses ${esc(cur)}.</p></div>
        <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        <div class="xp-note warn"><i data-lucide="dna"></i><span>Replacing the Design DNA on ${esc(p.address)} changes the palette and finish rules every room inherits. Existing saved designs are not regenerated.</span></div>
        <div class="xp-cmp">
          <div><span class="xp-lab">Current</span><b>${esc(cur)}</b></div>
          <div><span class="xp-lab">New</span><b>${esc(gtxt(d.name))}</b>${swatches(d.palette)}</div>
        </div>
      </div>
      <div class="xp-df">
        <button class="btn btn-ghost btn-sm" data-open="${d.id}">Preview Only</button>
        <button class="btn btn-primary btn-sm" data-dnago="${d.id}"><i data-lucide="dna"></i>Replace Property DNA</button>
      </div>`);
  }

  /* ---------- quick-pick quiz ---------- */
  const QUIZ = [
    { q: "Which Living Room Feels Right?", a: ["warm-minimal", "mid-century"] },
    { q: "Which Kitchen Would You Live In?", a: ["modern-farmhouse", "contemporary"] },
    { q: "Which Palette Reads Best To You?", a: ["japandi", "industrial"] },
    { q: "Which Bedroom Feels Like Home?", a: ["quiet-luxury", "scandinavian"] },
    { q: "Which Exterior Do You Prefer?", a: ["craftsman-revival", "coastal"] },
  ];
  let qStep = 0;
  let qPicks = [];
  const quizDone = () => read("rd_ex_quiz", null);

  function paintQuiz() {
    const wrap = $("xpQuiz");
    const card = $("xpQuizCard");
    if (!wrap || !card) return;
    const done = quizDone();
    wrap.hidden = false;
    if (done && qStep === 0 && !qPicks.length) {
      const d = dir(done);
      if (d) {
        card.innerHTML = `<div class="xp-quiz-head"><b>Your Direction: ${esc(gtxt(d.name))}</b><span class="xp-quiz-step">Result</span></div>
          <div class="xp-quiz-res"><img src="${d.img}" alt="${esc(gtxt(d.name))}"><p>${esc(gtxt(d.line))}</p></div>
          <div class="xp-quiz-foot"><button class="btn btn-primary btn-xs" data-open="${d.id}">Preview Direction</button><button class="fb-link" data-qretake="1">Retake</button></div>`;
        icons_();
        return;
      }
    }
    const step = QUIZ[qStep];
    card.innerHTML = `<div class="xp-quiz-head"><b>${esc(step.q)}</b><span class="xp-quiz-step">${qStep + 1} Of ${QUIZ.length}</span></div>
      <div class="xp-quiz-opts">${step.a.map((id) => { const d = dir(id); return d ? `<button class="xp-quiz-opt" data-qpick="${d.id}"><img src="${d.img}" alt="${esc(d.name)}" loading="lazy"><span>${esc(gtxt(d.name))}</span></button>` : ""; }).join("")}</div>
      <div class="xp-quiz-foot"><button class="fb-link" data-qskip="1">Skip For Now</button></div>`;
    icons_();
  }

  function quizPick(id) {
    qPicks.push(id);
    if (qStep < QUIZ.length - 1) { qStep++; paintQuiz(); return; }
    // Winner: the direction picked most often, falling back to the last pick.
    const tally = {};
    qPicks.forEach((x) => (tally[x] = (tally[x] || 0) + 1));
    const win = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || id;
    write("rd_ex_quiz", win);
    qStep = 0; qPicks = [];
    paintQuiz();
    const d = dir(win);
    if (d) note("Your Direction: " + gtxt(d.name));
  }

  function toggleSave(id) {
    const on = saved.indexOf(id) > -1;
    saved = on ? saved.filter((x) => x !== id) : [id].concat(saved);
    write(LS.saved, saved);
    note(on ? "Removed From Saved Directions" : "Saved To Your Directions");
    paint();
    const open = host.querySelector("#xpDPanel [data-save]");
    if (open && !$("xpDrawer").hidden && open.dataset.save === id) {
      open.innerHTML = '<i data-lucide="bookmark"></i>' + (on ? "Save Direction" : "Saved");
      icons_();
    }
  }

  /* ---------- events ---------- */
  host.addEventListener("click", (e) => {
    const t = e.target;
    const hit = (a) => t.closest("[" + a + "]");
    let el;
    if ((el = hit("data-c"))) {
      cat = el.dataset.c;
      if (cat !== "All" && cat !== "Interior" && cat !== "Virtual Staging") rooms = [];
      host.querySelectorAll(".xp-cat").forEach((b) => b.classList.toggle("on", b === el));
      paint(); return;
    }
    if ((el = hit("data-off"))) {
      const i = String(el.dataset.off).indexOf(":");
      toggleFilter(String(el.dataset.off).slice(0, i), String(el.dataset.off).slice(i + 1));
      return;
    }

    if ((el = hit("data-shot"))) {
      const img = host.querySelector("#xpHero");
      if (img) img.src = el.dataset.shot;
      host.querySelectorAll(".xp-shot").forEach((b) => b.classList.toggle("on", b === el));
      return;
    }
    if ((el = hit("data-save"))) { toggleSave(el.dataset.save); return; }
    if ((el = hit("data-open"))) { directionDrawer(el.dataset.open); return; }
    if ((el = hit("data-use"))) { const d = dir(el.dataset.use); if (d) applyToStudio(d); return; }
    if ((el = hit("data-dnago"))) { const d = dir(el.dataset.dnago); if (d) setDna(d); return; }
    if ((el = hit("data-dna"))) { const d = dir(el.dataset.dna); if (d) confirmDna(d); return; }
    if (t.closest("#xpClear")) { rooms = []; traits = []; grades = []; paint(); return; }
    if (t.closest("[data-close]") || t.closest("#xpScrim")) { closeDrawer(); return; }
    if (t.closest("#xpSavedBtn")) { savedDrawer(); return; }
    if (t.closest("#xpCustom")) { go("studio"); return; }
    if (t.closest("#xpFilterBtn")) { openDrawer(filterDrawerHtml()); return; }
    if ((el = hit("data-qpick"))) { quizPick(el.dataset.qpick); return; }
    if (t.closest("[data-qskip]")) { $("xpQuiz").hidden = true; return; }
    if (t.closest("[data-qretake]")) { write("rd_ex_quiz", null); qStep = 0; qPicks = []; paintQuiz(); return; }
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("xpDrawer").hidden) closeDrawer(); });



  syncProp();
  paintQuiz();
  paint();
  icons_();
}
