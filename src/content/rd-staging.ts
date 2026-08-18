/**
 * Multi-photo staging workflow.
 *
 * Uploading several photos into Studio used to keep the first file and drop
 * the rest. This is the same shape that works in the property-video builder:
 *
 *   1. Add Photos      — the shared source picker, many files at once
 *   2. Review Rooms    — one grid, AI room detection, fast manual correction
 *   3. Studio Canvas   — open any photo in the existing canvas, with a strip
 *                        to move through the set without losing the review
 *   4. Results         — each photo returns to the grid marked as designed
 *
 * The transition into Review Rooms is immediate: previews are local object
 * URLs, uploads and classification run in the background and only ever add
 * information to a card that is already on screen.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { mountSourcePicker } from "@/lib/source-picker";
import { uploadRoomPhoto, roomPhotoUrl } from "@/lib/room-photos";
import { classifyPhotoRooms } from "@/lib/photo-classify.functions";
import { thumbDataUrl, ACCEPT_CONFIDENCE, REVIEW_CONFIDENCE } from "@/lib/photo-classify";
import {
  ROOM_OPTIONS,
  UNASSIGNED_LABEL,
  groupRooms,
  roomFromCategory,
  roomIcon,
  roomRank,
  roomSpace,
  searchRooms,
} from "@/lib/staging-rooms";
import { DraftAutosaver, newDraftId, migrateLegacyStagingDraft } from "@/lib/project-draft";
import {
  saveProjectDraft as _saveProjectDraft,
  listProjectDrafts as _listProjectDrafts,
  getProjectDraft as _getProjectDraft,
} from "@/lib/drafts.functions";

const saveProjectDraft = (d) => _saveProjectDraft(d);
const listProjectDrafts = (d) => _listProjectDrafts({ data: d || {} });
const getProjectDraft = (d) => _getProjectDraft({ data: d });

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};
let S = null; /* live session */
let wrap = null;
let strip = null;
let popover = null;
let saver = null; /* DraftAutosaver, created with the first stored photo */

/* ------------------------------------------------------------------ state */

function newSession(seed = {}) {
  return {
    step: "add",
    items: [],
    address: seed.address || "",
    title: seed.title || "",
    propertyId: seed.propertyId || null,
    draftId: seed.draftId || null,
    saveState: "idle",
    group: true,
    detect: "pending",
    current: -1,
    busy: false,
  };
}

function mkItem(file) {
  return {
    key: "p" + Math.random().toString(36).slice(2, 9),
    name: file.name || "Photo",
    file,
    previewUrl: URL.createObjectURL(file),
    path: null,
    signed: null,
    status: "uploading",
    error: "",
    room: "",
    roomSource: "none",
    confidence: 0,
    detect: "pending",
    selected: true,
    done: false,
  };
}

/* ------------------------------------------------------------- persistence
   The draft is a database row, not a browser cache. It is created as soon as
   the first photo is safely in private storage, then autosaved on every
   meaningful change with a short debounce. */

function draftPayload() {
  return {
    id: S.draftId,
    project_type: "photo_staging",
    status: "draft",
    builder_step: S.step === "add" ? "add" : S.current ? "canvas" : "review",
    property_id: S.propertyId || null,
    property_address: S.address || null,
    title: S.title || null,
    assets: S.items
      .filter((i) => i.path)
      .map((i) => ({
        key: i.key,
        path: i.path,
        name: i.name,
        room: i.room || null,
        room_source: i.roomSource === "manual" ? "manual" : i.roomSource === "ai" ? "ai" : "none",
        confidence: Number(i.confidence || 0),
        selected: !!i.selected,
        done: !!i.done,
        status: i.status || "ready",
      })),
    selected: S.items.filter((i) => i.selected && i.path).map((i) => i.key),
    item_order: ordered().filter((i) => i.path).map((i) => i.key),
    settings: { group: !!S.group, current: S.current || null },
  };
}

function setSaveState(state) {
  if (!S) return;
  S.saveState = state;
  patchStatus();
}

function ensureSaver() {
  if (saver) return saver;
  if (!S.draftId) S.draftId = newDraftId();
  saver = new DraftAutosaver(S.draftId, {
    save: (payload) => saveProjectDraft({ data: payload }),
    debounceMs: 700,
    onState: (state) => setSaveState(state),
  });
  return saver;
}

function saveDraft() {
  if (!S) return;
  /* Nothing durable to write until at least one photo has a storage path. */
  if (!S.items.some((i) => i.path)) return;
  ensureSaver().queue(draftPayload());
}

export function retryDraftSave() {
  if (saver) void saver.retryNow();
}

/* ------------------------------------------------------------------ shell */

function host() {
  if (wrap && document.body.contains(wrap)) return wrap;
  wrap = document.createElement("div");
  /* The overlay lives on <body>, so it must carry the app scope itself or
     every .rd-app .btn / token rule silently drops out. */
  wrap.className = "rd-app rds-wrap";
  wrap.id = "rdStagingWrap";
  document.body.appendChild(wrap);
  return wrap;
}

function show() {
  host().classList.add("on");
  document.body.style.overflow = "hidden";
  render();
}

function hide() {
  if (wrap) wrap.classList.remove("on");
  document.body.style.overflow = "";
  closePopover();
}

function exitAll() {
  hide();
  /* Leaving the screen is not losing the work: flush whatever is queued. */
  if (saver) { void saver.flush(); saver.destroy(); saver = null; }
  if (S) S.items.forEach((i) => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
  S = null;
  removeStrip();
}

/* ------------------------------------------------------------------ entry */

export function openStagingReview(seed = {}) {
  const files = (seed.files || []).filter(Boolean);
  if (!S) S = newSession(seed);
  if (seed.address) S.address = seed.address;
  if (seed.propertyId) S.propertyId = seed.propertyId;
  if (files.length) {
    addFiles(files);
  } else {
    S.step = S.items.length ? "review" : "add";
  }
  show();
}

/** Rebuild a session from a saved database draft. */
function hydrate(draft) {
  S = newSession({
    address: draft.property_address || "",
    title: draft.title || "",
    propertyId: draft.property_id || null,
    draftId: draft.id,
  });
  S.group = draft.settings?.group !== false;
  const order = Array.isArray(draft.item_order) ? draft.item_order : [];
  const assets = (draft.assets || []).slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  S.items = assets.map((a) => ({
    key: a.key,
    name: a.name || "Photo",
    file: null,
    previewUrl: "",
    path: a.path,
    signed: null,
    status: "ready",
    error: "",
    room: a.room || "",
    roomSource: a.room_source || "none",
    confidence: Number(a.confidence || 0),
    detect: "done",
    selected: a.selected !== false,
    done: !!a.done,
  }));
  S.step = draft.builder_step === "add" ? "add" : "review";
  ensureSaver();
  /* Signed URLs are minted per session; the row only ever stores paths. */
  S.items.forEach(async (it) => {
    if (!it.path) return;
    try {
      it.signed = await roomPhotoUrl(it.path);
      patchCard(it);
    } catch (_) {}
  });
}

/**
 * Reopen the most recent staging draft for this account. Called after sign-in
 * and on app boot, so a refresh, a new browser or another device all land back
 * on the same work.
 */
export async function resumeStagingDraft(id) {
  try {
    /* One-time lift of any legacy browser-only draft, server-confirmed first. */
    await migrateLegacyStagingDraft({ save: (payload) => saveProjectDraft({ data: payload }) });
  } catch (_) {}
  try {
    let draft = null;
    if (id) draft = (await getProjectDraft({ id })).draft;
    else {
      const res = await listProjectDrafts({ project_type: "photo_staging", scope: "drafts", limit: 1 });
      draft = (res.drafts || [])[0] || null;
    }
    if (!draft || !(draft.assets || []).length) return false;
    hydrate(draft);
    show();
    return true;
  } catch (_) {
    return false;
  }
}

/** Reopen the review grid from the canvas strip. */
export function reopenStaging() {
  if (!S || !S.items.length) return false;
  S.step = "review";
  show();
  return true;
}

export function hasStagingSession() {
  return !!(S && S.items.length);
}

/* ------------------------------------------------------- intake and async */

function addFiles(files) {
  const fresh = files.map(mkItem);
  S.items = S.items.concat(fresh);
  /* The grid appears before a single byte is uploaded. */
  S.step = "review";
  render();
  fresh.forEach(uploadOne);
  detectRooms(fresh);
  saveDraft();
}

async function uploadOne(item) {
  try {
    const path = await uploadRoomPhoto(item.file);
    item.path = path;
    item.status = "ready";
    try {
      item.signed = await roomPhotoUrl(path);
    } catch (_) {}
  } catch (e) {
    item.status = "failed";
    item.error = (e && e.message) || "That photo did not upload.";
  }
  patchCard(item);
  saveDraft();
}

/** Background room detection. Never blocks the grid, never blocks an edit. */
async function detectRooms(list) {
  const pending = list.filter((i) => i.detect === "pending");
  if (!pending.length) return;
  S.detect = "running";
  pending.forEach((i) => (i.detect = "running"));
  patchStatus();
  for (let n = 0; n < pending.length; n += 6) {
    const batch = pending.slice(n, n + 6);
    try {
      const images = [];
      for (const it of batch) {
        try {
          images.push({ id: it.key, image: await thumbDataUrl(it.file) });
        } catch (_) {}
      }
      if (!images.length) throw new Error("unreadable");
      const res = await classifyPhotoRooms({ data: { images } });
      const map = new Map((res.results || []).map((r) => [r.id, r]));
      for (const it of batch) {
        const g = map.get(it.key);
        const room = g ? roomFromCategory(g.label) : null;
        const conf = g ? Number(g.confidence || 0) : 0;
        it.detect = "done";
        it.confidence = conf;
        /* A manual choice made while the request was in flight always wins. */
        if (it.roomSource !== "manual") {
          if (room && conf >= REVIEW_CONFIDENCE) {
            it.room = room.label;
            it.roomSource = "ai";
          } else {
            it.room = "";
            it.roomSource = "none";
          }
        }
        patchCard(it);
      }
    } catch (_) {
      batch.forEach((it) => {
        it.detect = "failed";
        patchCard(it);
      });
    }
  }
  S.detect = S.items.some((i) => i.detect === "running") ? "running" : "completed";
  patchStatus();
  saveDraft();
}

/* --------------------------------------------------------------- renderers */

function stateOf(it) {
  if (it.roomSource === "manual") return { cls: "ok", label: "Confirmed" };
  if (it.detect === "running" || it.detect === "pending") return { cls: "wait", label: "Detecting" };
  if (it.roomSource === "ai" && it.confidence >= ACCEPT_CONFIDENCE) return { cls: "ok", label: "Detected" };
  if (it.roomSource === "ai") return { cls: "warn", label: "Needs Review" };
  return { cls: "warn", label: "Unassigned" };
}

function ordered() {
  const list = S.items.slice();
  if (!S.group) return list;
  return list.sort((a, b) => roomRank(a.room) - roomRank(b.room));
}

function cardHtml(it) {
  const st = stateOf(it);
  const label = it.room || UNASSIGNED_LABEL;
  return `<article class="rds-card${it.selected ? " sel" : ""}${it.done ? " done" : ""}" data-k="${it.key}">
    <label class="rds-pick"><input type="checkbox" data-sel="${it.key}" ${it.selected ? "checked" : ""} aria-label="Select ${esc(it.name)}"></label>
    <button class="rds-thumb" data-open="${it.key}" aria-label="Open ${esc(it.name)} in the canvas">
      <img src="${esc(it.signed || it.previewUrl)}" alt="${esc(it.name)}" loading="lazy">
      ${it.status === "uploading" ? '<span class="rds-up"><i data-lucide="loader"></i>Uploading</span>' : ""}
      ${it.status === "failed" ? '<span class="rds-up bad"><i data-lucide="alert-triangle"></i>Upload Failed</span>' : ""}
      ${it.done ? '<span class="rds-done"><i data-lucide="check"></i>Designed</span>' : ""}
    </button>
    <div class="rds-meta">
      <button class="rds-room" data-room="${it.key}" aria-haspopup="listbox">
        <i data-lucide="${roomIcon(it.room)}"></i><span>${esc(label)}</span><i data-lucide="chevron-down" class="rds-caret"></i>
      </button>
      <div class="rds-row">
        <span class="rds-badge ${st.cls}">${st.label}</span>
        <span class="rds-name" title="${esc(it.name)}">${esc(it.name)}</span>
      </div>
    </div>
    <div class="rds-act">
      <button class="rds-mini" data-open="${it.key}"><i data-lucide="wand-2"></i>Design</button>
      <button class="rds-mini ghost" data-del="${it.key}" aria-label="Remove ${esc(it.name)}"><i data-lucide="trash-2"></i></button>
    </div>
  </article>`;
}

function gridHtml() {
  const list = ordered();
  if (!S.group) return `<div class="rds-grid">${list.map(cardHtml).join("")}</div>`;
  const groups = [];
  list.forEach((it) => {
    const key = it.room || UNASSIGNED_LABEL;
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(it);
    else groups.push({ key, items: [it] });
  });
  return groups
    .map(
      (g) =>
        `<section class="rds-group"><h3><i data-lucide="${roomIcon(g.key === UNASSIGNED_LABEL ? "" : g.key)}"></i>${esc(g.key)}<b>${g.items.length}</b></h3>
        <div class="rds-grid">${g.items.map(cardHtml).join("")}</div></section>`,
    )
    .join("");
}

function statusText() {
  const total = S.items.length;
  const sel = S.items.filter((i) => i.selected).length;
  const need = S.items.filter((i) => stateOf(i).cls === "warn").length;
  const detecting = S.items.some((i) => i.detect === "running" || i.detect === "pending");
  const parts = [`${total} Photo${total === 1 ? "" : "s"}`, `${sel} Selected`];
  if (detecting) parts.push("Detecting Rooms…");
  else if (need) parts.push(`${need} Need${need === 1 ? "s" : ""} A Room`);
  else parts.push("All Rooms Confirmed");
  const save = { saving: "Saving…", saved: "Saved", error: "Couldn't Save" }[S.saveState];
  if (save) parts.push(save);
  return parts.join(" · ");
}

function render() {
  const el = host();
  if (!S) return;
  if (S.step === "add") {
    el.innerHTML = `<div class="rds" role="dialog" aria-label="Add photos">
      <header class="rds-h">
        <div><b>Add Photos</b><span>Add every photo you want to design. We'll sort them by room on the next screen.</span></div>
        <button class="icon-btn" id="rdsClose" aria-label="Close"><i data-lucide="x"></i></button>
      </header>
      <div class="rds-add"><div id="rdsPicker"></div></div>
    </div>`;
    paint();
    el.querySelector("#rdsClose").onclick = exitAll;
    mountPicker(el.querySelector("#rdsPicker"));
    return;
  }

  el.innerHTML = `<div class="rds" role="dialog" aria-label="Review rooms">
    <header class="rds-h">
      <div class="rds-title">
        <button class="icon-btn" id="rdsBack" aria-label="Back to add photos"><i data-lucide="arrow-left"></i></button>
        <div><b>Review Rooms</b><span id="rdsStatus">${esc(statusText())}</span></div>
      </div>
      <button class="icon-btn" id="rdsClose" aria-label="Close"><i data-lucide="x"></i></button>
    </header>
    <div class="rds-bar">
      <div class="rds-bar-l">
        <button class="btn btn-ghost btn-sm" id="rdsAll"><i data-lucide="check-square"></i>Select All</button>
        <button class="btn btn-ghost btn-sm" id="rdsNone"><i data-lucide="square"></i>Clear</button>
        <button class="btn btn-ghost btn-sm" id="rdsSetRoom"><i data-lucide="tag"></i>Set Room For Selected</button>
        <button class="btn btn-ghost btn-sm" id="rdsDel"><i data-lucide="trash-2"></i>Remove Selected</button>
      </div>
      <div class="rds-bar-r">
        <label class="rds-toggle"><input type="checkbox" id="rdsGroup" ${S.group ? "checked" : ""}>Group By Room</label>
        <button class="btn btn-ghost btn-sm" id="rdsMore"><i data-lucide="plus"></i>Add More Photos</button>
        <button class="btn btn-primary btn-sm" id="rdsGo"><i data-lucide="wand-2"></i>Start Designing</button>
      </div>
    </div>
    <div class="rds-b" id="rdsBody">${gridHtml()}</div>
  </div>`;
  paint();
  bindReview(el);
}

function patchCard(it) {
  if (!wrap || !S || S.step !== "review") return;
  const el = wrap.querySelector('.rds-card[data-k="' + it.key + '"]');
  if (!el) return;
  const next = document.createElement("div");
  next.innerHTML = cardHtml(it);
  el.replaceWith(next.firstElementChild);
  paint();
  patchStatus();
}

function patchStatus() {
  const s = wrap && wrap.querySelector("#rdsStatus");
  if (s && S) s.textContent = statusText();
}

/* ------------------------------------------------------------------ wiring */

function mountPicker(slot) {
  if (!slot) return;
  mountSourcePicker(slot, {
    context: "design",
    esc,
    lucide: { createIcons: () => paint() },
    onPick: (picked) => addFiles(picked.map((p) => p.file)),
  });
}

function bindReview(el) {
  el.querySelector("#rdsClose").onclick = exitAll;
  el.querySelector("#rdsBack").onclick = () => {
    S.step = "add";
    render();
  };
  el.querySelector("#rdsAll").onclick = () => {
    S.items.forEach((i) => (i.selected = true));
    render();
  };
  el.querySelector("#rdsNone").onclick = () => {
    S.items.forEach((i) => (i.selected = false));
    render();
  };
  el.querySelector("#rdsDel").onclick = () => {
    const keep = S.items.filter((i) => !i.selected);
    if (keep.length === S.items.length) return;
    S.items.filter((i) => i.selected).forEach((i) => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
    S.items = keep;
    if (!S.items.length) S.step = "add";
    saveDraft();
    render();
  };
  el.querySelector("#rdsGroup").onchange = (e) => {
    S.group = !!e.target.checked;
    render();
  };
  el.querySelector("#rdsMore").onclick = () => {
    S.step = "add";
    render();
  };
  el.querySelector("#rdsSetRoom").onclick = (e) => {
    const sel = S.items.filter((i) => i.selected);
    if (!sel.length) return;
    openRoomPopover(e.currentTarget, (label) => {
      sel.forEach((i) => {
        i.room = label;
        i.roomSource = "manual";
      });
      saveDraft();
      render();
    });
  };
  el.querySelector("#rdsGo").onclick = () => {
    const first = ordered().find((i) => i.selected && !i.done) || ordered().find((i) => i.selected) || S.items[0];
    if (first) openInCanvas(first.key);
  };

  el.querySelectorAll("[data-sel]").forEach((c) =>
    c.addEventListener("change", () => {
      const it = S.items.find((i) => i.key === c.getAttribute("data-sel"));
      if (!it) return;
      it.selected = c.checked;
      c.closest(".rds-card")?.classList.toggle("sel", c.checked);
      patchStatus();
    }),
  );
  el.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => openInCanvas(b.getAttribute("data-open"))),
  );
  el.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-del");
      const it = S.items.find((i) => i.key === k);
      if (it) { try { URL.revokeObjectURL(it.previewUrl); } catch (_) {} }
      S.items = S.items.filter((i) => i.key !== k);
      if (!S.items.length) S.step = "add";
      saveDraft();
      render();
    }),
  );
  el.querySelectorAll("[data-room]").forEach((b) =>
    b.addEventListener("click", () => {
      const it = S.items.find((i) => i.key === b.getAttribute("data-room"));
      if (!it) return;
      openRoomPopover(b, (label) => {
        it.room = label;
        it.roomSource = "manual";
        saveDraft();
        if (S.group) render();
        else patchCard(it);
      });
    }),
  );
}

/* ------------------------------------------------------- room combobox */

function closePopover() {
  if (popover) popover.remove();
  popover = null;
}

function openRoomPopover(anchor, onPick) {
  closePopover();
  popover = document.createElement("div");
  popover.className = "rds-pop";
  popover.innerHTML = `<div class="rds-pop-s"><i data-lucide="search"></i><input id="rdsSearch" placeholder="Search Rooms" aria-label="Search rooms"></div><div class="rds-pop-l" id="rdsList"></div>`;
  document.body.appendChild(popover);
  const r = anchor.getBoundingClientRect();
  const top = Math.min(r.bottom + 6, window.innerHeight - 340);
  popover.style.top = Math.max(12, top) + "px";
  popover.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 300)) + "px";

  const list = popover.querySelector("#rdsList");
  const input = popover.querySelector("#rdsSearch");
  const draw = () => {
    const q = input.value;
    const found = searchRooms(q);
    const groups = groupRooms(found);
    const custom =
      q.trim() && !found.some((f) => f.label.toLowerCase() === q.trim().toLowerCase())
        ? `<button class="rds-opt custom" data-label="${esc(q.trim())}"><i data-lucide="plus"></i>Use "${esc(q.trim())}"</button>`
        : "";
    list.innerHTML =
      custom +
      (groups.length
        ? groups
            .map(
              (g) =>
                `<div class="rds-pop-g">${esc(g.group)}</div>` +
                g.rooms
                  .map((r2) => `<button class="rds-opt" data-label="${esc(r2.label)}"><i data-lucide="${r2.icon}"></i>${esc(r2.label)}</button>`)
                  .join(""),
            )
            .join("")
        : custom
          ? ""
          : '<p class="rds-pop-e">No Rooms Match That Search.</p>');
    paint();
    list.querySelectorAll("[data-label]").forEach((b) =>
      b.addEventListener("click", () => {
        onPick(b.getAttribute("data-label"));
        closePopover();
      }),
    );
  };
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
    if (e.key === "Enter") {
      const first = list.querySelector("[data-label]");
      if (first) first.click();
    }
  });
  draw();
  paint();
  input.focus();
  setTimeout(() => {
    const away = (e) => {
      if (popover && !popover.contains(e.target)) {
        closePopover();
        document.removeEventListener("mousedown", away);
      }
    };
    document.addEventListener("mousedown", away);
  }, 0);
}

/* --------------------------------------------------------- canvas handoff */

function idxOf(key) {
  return ordered().findIndex((i) => i.key === key);
}

async function openInCanvas(key) {
  const list = ordered();
  const it = list.find((i) => i.key === key);
  if (!it) return;
  S.current = key;
  hide();

  /* Mark the previous photo designed if the canvas produced a result. */
  try {
    if (window.rdStudioSourceState && window.rdStudioSourceState() === "generated") {
      const prev = S.items.find((i) => i.key === S.lastOpened);
      if (prev) prev.done = true;
    }
  } catch (_) {}
  S.lastOpened = key;

  let url = it.signed || it.previewUrl;
  if (!it.signed && it.path) {
    try {
      it.signed = await roomPhotoUrl(it.path);
      url = it.signed || url;
    } catch (_) {}
  }
  try {
    window.rdPendingPhotoPath = it.path || null;
  } catch (_) {}
  try {
    window.rdSetStudioSource &&
      window.rdSetStudioSource("user_upload", url, it.room || "Your uploaded source", {
        caption: "Set your direction, then press Generate. Nothing has been generated yet.",
      });
  } catch (_) {}
  applyRoom(it);
  try {
    if (location.hash !== "#studio") location.hash = "#studio";
  } catch (_) {}
  mountStrip();
  saveDraft();
}

/** Mirror the reviewed room onto the existing Studio controls. */
function applyRoom(it) {
  if (!it.room) return;
  try {
    const chip = document.querySelector('#spChips .chip[data-sp="' + roomSpace(it.room) + '"]');
    if (chip) chip.click();
    const sel = document.getElementById("fRoom");
    if (sel) {
      if (!Array.from(sel.options).some((o) => o.value === it.room || o.text === it.room)) {
        const opt = document.createElement("option");
        opt.textContent = it.room;
        sel.appendChild(opt);
      }
      sel.value = it.room;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch (_) {}
}

function removeStrip() {
  if (strip) strip.remove();
  strip = null;
}

function mountStrip() {
  if (!S || !S.items.length) return;
  removeStrip();
  strip = document.createElement("div");
  strip.className = "rd-app rds-strip";
  document.body.appendChild(strip);
  drawStrip();
  window.addEventListener("hashchange", stripGuard);
}

function stripGuard() {
  if (!strip) return;
  const onStudio = (location.hash || "").replace(/^#/, "") === "studio";
  strip.classList.toggle("hide", !onStudio);
}

function drawStrip() {
  if (!strip || !S) return;
  const list = ordered();
  const i = list.findIndex((x) => x.key === S.current);
  strip.innerHTML = `<button class="rds-strip-b" id="rdsRooms"><i data-lucide="layout-grid"></i>Back To Rooms</button>
    <button class="rds-strip-i" id="rdsPrev" aria-label="Previous photo" ${i <= 0 ? "disabled" : ""}><i data-lucide="chevron-left"></i></button>
    <div class="rds-strip-l">${list
      .map(
        (x) =>
          `<button class="rds-strip-t${x.key === S.current ? " on" : ""}${x.done ? " done" : ""}" data-go="${x.key}" title="${esc(x.room || x.name)}">
            <img src="${esc(x.signed || x.previewUrl)}" alt="${esc(x.name)}">${x.done ? '<i data-lucide="check"></i>' : ""}</button>`,
      )
      .join("")}</div>
    <button class="rds-strip-i" id="rdsNext" aria-label="Next photo" ${i < 0 || i >= list.length - 1 ? "disabled" : ""}><i data-lucide="chevron-right"></i></button>
    <span class="rds-strip-c">${i < 0 ? "" : `Photo ${i + 1} Of ${list.length}`}</span>
    <button class="rds-strip-i" id="rdsStripX" aria-label="Close the photo set"><i data-lucide="x"></i></button>`;
  paint();
  strip.querySelector("#rdsRooms").onclick = () => {
    markCurrentDone();
    reopenStaging();
  };
  strip.querySelector("#rdsStripX").onclick = exitAll;
  strip.querySelector("#rdsPrev").onclick = () => {
    markCurrentDone();
    const l = ordered();
    const n = l.findIndex((x) => x.key === S.current);
    if (n > 0) openInCanvas(l[n - 1].key);
  };
  strip.querySelector("#rdsNext").onclick = () => {
    markCurrentDone();
    const l = ordered();
    const n = l.findIndex((x) => x.key === S.current);
    if (n >= 0 && n < l.length - 1) openInCanvas(l[n + 1].key);
  };
  strip.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => {
      markCurrentDone();
      openInCanvas(b.getAttribute("data-go"));
    }),
  );
  stripGuard();
}

function markCurrentDone() {
  try {
    if (window.rdStudioSourceState && window.rdStudioSourceState() === "generated") {
      const cur = S.items.find((i) => i.key === S.current);
      if (cur) cur.done = true;
      saveDraft();
    }
  } catch (_) {}
}

/* Keep the strip honest when the canvas produces a result. */
try {
  window.addEventListener("rd:credits-changed", () => {
    markCurrentDone();
    drawStrip();
  });
} catch (_) {}

try {
  window.rdStaging = { open: openStagingReview, reopen: reopenStaging, has: hasStagingSession, resume: resumeStagingDraft };
} catch (_) {}
