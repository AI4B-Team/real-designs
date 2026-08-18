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
  groupRooms,
  roomFromCategory,
  roomIcon,
  roomSpace,
  searchRooms,
} from "@/lib/staging-rooms";
import { DraftAutosaver, newDraftId, migrateLegacyStagingDraft } from "@/lib/project-draft";
import { openBulkDesign, runBulkDesign } from "@/lib/staging-bulk";
import { openAddressModal } from "@/lib/address-modal";
import { builderRailHtml, roomSelectHtml, roomBadge, selectCheckHtml, saveLabel, imageToolbarHtml, sceneNumberHtml } from "@/lib/builder-ui";
import { addressBarHtml, applyAddress, cleanAddressText } from "@/lib/address-field";
import { startOverModalHtml, resetStudioSurface, trackBuilderStep, endBuilderHistory } from "@/lib/builder-exit";
import { durableStep, restoreStep } from "@/lib/builder-step";
import { matchPropertyAddress } from "@/lib/property-address.functions";
import { suggestAddresses } from "@/lib/property-address.functions";
import { listMediaProperties } from "@/lib/property-media.functions";
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
    addressSource: seed.addressSource || "unknown",
    addressStructured: null,
    addressMatch: null,
    addressMatchDismissed: false,
    addressSaveState: "",
    draftId: seed.draftId || null,
    saveState: "idle",
    detect: "pending",
    /* The key of the photo open on the canvas — never an index sentinel. */
    current: null,
    lastOpened: null,
    activeKey: null,
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
    /* Design work state, independent of the upload state. */
    state: "none",
    resultPath: null,
    resultUrl: null,
    err: "",
  };
}

/* One restrained status per card, shown in the card footer and the filmstrip. */
const WORK_STATES = {
  generating: { label: "Generating", cls: "run", icon: "loader" },
  complete: { label: "Complete", cls: "ok", icon: "check" },
  failed: { label: "Failed", cls: "bad", icon: "alert-triangle" },
  draft: { label: "Draft", cls: "dim", icon: "pencil-line" },
};

function workState(it) {
  if (it.state && WORK_STATES[it.state]) return WORK_STATES[it.state];
  if (it.done) return WORK_STATES.complete;
  return null;
}


/* ------------------------------------------------------------- persistence
   The draft is a database row, not a browser cache. It is created as soon as
   the first photo is safely in private storage, then autosaved on every
   meaningful change with a short debounce. */

/* One description of "where am I", shared by the rail, the draft row and the
   restore path, so the three can never disagree. */
function stepState() {
  return {
    keys: S.items.filter((i) => i.path).map((i) => i.key),
    activeKey: S.current || null,
    lastOpened: S.lastOpened || null,
    adding: S.step === "add",
    reviewing: S.step === "final",
    completed: S.items.filter((i) => i.state === "complete" || i.done).map((i) => i.key),
  };
}

function draftPayload() {
  return {
    id: S.draftId,
    project_type: "photo_staging",
    status: "draft",
    builder_step: durableStep(stepState()),
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
        room_source:
          i.roomSource === "manual" || i.roomSource === "ai" || i.roomSource === "library" ? i.roomSource : "none",
        confidence: Number(i.confidence || 0),
        selected: !!i.selected,
        done: !!i.done,
        status: i.status || "ready",
      })),
    selected: S.items.filter((i) => i.selected && i.path).map((i) => i.key),
    item_order: ordered().filter((i) => i.path).map((i) => i.key),
    /* Per-room work survives a refresh: state, result and the direction that
       produced it, keyed by photo. */
    settings: {
      current: S.current || null,
      direction: S.direction || null,
      rooms: S.items.reduce((m, i) => {
        m[i.key] = {
          room: i.room || null,
          state: i.state || (i.done ? "complete" : "none"),
          result_path: i.resultPath || null,
          error: i.err || "",
        };
        return m;
      }, {}),
    },

  };
}

function setSaveState(state) {
  if (!S) return;
  S.saveState = state;
  S.addressSaveState = state === "saving" ? "saving" : state === "error" ? "error" : state === "saved" ? "saved" : "";
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

/* Review Rooms is an ordinary application page: it lives in the content
   area next to every other view, keeps the top bar and the app rail, and
   never locks document scrolling or claims a dialog role. */

function host() {
  const existing = document.getElementById("v-staging");
  if (existing) { wrap = existing; return wrap; }
  const content = document.querySelector(".rd-app .content") || document.querySelector(".content");
  if (!content) return null;
  wrap = document.createElement("div");
  wrap.className = "view";
  wrap.id = "v-staging";
  content.appendChild(wrap);
  return wrap;
}

/** Collapse the global menu from Review Rooms onward, release it on exit. */
function railForStep() {
  try {
    const rail = window.__rdRailBorrow;
    if (!rail) return;
    if (S && S.step === "review") rail.collapse();
    else rail.release();
  } catch (_) {}
}

function show() {
  host();
  /* Navigating through the router keeps the hash, the browser history and a
     refresh all pointing at the same page. */
  try { window.__rdGo && window.__rdGo("staging"); } catch (_) {}
  render();
  railForStep();
}

function hide() {
  closePopover();
  try { window.__rdRailBorrow && window.__rdRailBorrow.release(); } catch (_) {}
}

/** Make sure the page container exists before the router toggles views. */
export function ensureStagingView() {
  return !!host();
}

/** Router hook: the staging view became visible again (back button, refresh). */
export function mountStagingView() {
  if (!S) {
    /* Nothing in flight: try the saved draft, otherwise hand the user back. */
    void resumeStagingDraft().then((ok) => {
      if (!ok) { try { window.__rdGo && window.__rdGo("studio"); } catch (_) {} }
    });
    return;
  }
  render();
  railForStep();
  restoreScroll();
}

export function detachStagingView() {
  closePopover();
  try { window.__rdRailBorrow && window.__rdRailBorrow.release(); } catch (_) {}
}

/* Scroll position survives a trip into the canvas and back. */
let scrollY = 0;
function scroller() {
  return document.querySelector(".rd-app .content") || document.scrollingElement || document.documentElement;
}
function rememberScroll() {
  const el = scroller();
  scrollY = el ? el.scrollTop || window.scrollY || 0 : 0;
}
function restoreScroll() {
  const el = scroller();
  if (!el) return;
  requestAnimationFrame(() => { try { el.scrollTop = scrollY; } catch (_) {} });
}

/* Leaving the builder never loses work: the draft is flushed first, then the
   session is torn down and Studio is returned to its starting page. */
function leaveStaging() {
  hide();
  endBuilderHistory("design");
  if (saver) { void saver.flush(); saver.destroy(); saver = null; }
  if (S) S.items.forEach((i) => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
  S = null;
  removeStrip();
  resetStudioSurface();
  try { window.__rdGo && window.__rdGo("studio"); } catch (_) {}
}

let exiting = false;
/** "Save & Exit": persist the draft and its step, then return to Studio. */
async function saveExit() {
  if (exiting) return;
  exiting = true;
  try { saveDraft(); } catch (_) {}
  try { if (saver) await saver.flush(); } catch (_) {}
  exiting = false;
  leaveStaging();
}

function exitAll() {
  void saveExit();
}

/* The global Studio navigation must behave like "Save & Exit" while a
   project is open, so the shell asks the builder to handle the jump. */
try {
  (window as any).__rdBuilderSaveExit = ((prev) => () => {
    if (S) { void saveExit(); return true; }
    return typeof prev === "function" ? !!prev() : false;
  })((window as any).__rdBuilderSaveExit);
} catch (_) {}

/** "Start Over": the draft is kept, only the live session ends. */
function openStartOver() {
  if (!S) return;
  S.startOver = { busy: false };
  render();
}
async function confirmStartOver() {
  if (!S || (S.startOver && S.startOver.busy)) return;
  S.startOver = { busy: true };
  render();
  await saveExit();
}

function startOverLayer() {
  if (!S || !S.startOver) return "";
  return startOverModalHtml({ wrap: "rdsSoWrap", keep: "rdsSoKeep", go: "rdsSoGo", busy: !!S.startOver.busy });
}

function bindStartOver(el) {
  const keep = el.querySelector("#rdsSoKeep");
  if (keep) keep.onclick = () => { if (S) { S.startOver = null; render(); } };
  const go = el.querySelector("#rdsSoGo");
  if (go) go.onclick = () => { void confirmStartOver(); };
  el.querySelectorAll("#rdsStartOver").forEach((b) => (b.onclick = openStartOver));
}

/* ------------------------------------------------------------------ entry */

export function openStagingReview(seed = {}) {
  const files = (seed.files || []).filter(Boolean);
  const existing = (seed.photos || []).filter((p) => p && p.path);
  if (!S) S = newSession(seed);
  if (seed.address) S.address = seed.address;
  if (seed.propertyId) S.propertyId = seed.propertyId;
  if (files.length) {
    addFiles(files);
  } else if (existing.length) {
    addExisting(existing);
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
  const order = Array.isArray(draft.item_order) ? draft.item_order : [];
  const assets = (draft.assets || []).slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const rooms = (draft.settings && draft.settings.rooms) || {};
  S.direction = (draft.settings && draft.settings.direction) || null;
  S.items = assets.map((a) => {
    const saved = rooms[a.key] || {};
    return {
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
      /* A run that was interrupted comes back as a retryable failure, never
         as a phantom "generating" that can never finish. */
      state: saved.state === "generating" ? "failed" : saved.state || (a.done ? "complete" : "none"),
      resultPath: saved.result_path || null,
      resultUrl: null,
      err: saved.state === "generating" ? "That render was interrupted." : saved.error || "",
    };
  });
  /* Where the user left off, validated against the photos that still exist. */
  const back = restoreStep({
    builder_step: draft.builder_step,
    keys: S.items.map((i) => i.key),
    activeKey: (draft.settings && draft.settings.current) || null,
    completed: S.items.filter((i) => i.state === "complete" || i.done).map((i) => i.key),
  });
  S.step = back.step === "add" ? "add" : "review";
  S.current = null;
  S.lastOpened = back.activeKey;
  S.resumeKey = back.step === "design" ? back.activeKey : null;

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
    /* A draft saved on the canvas reopens on that exact photo. */
    if (S && S.resumeKey) {
      const key = S.resumeKey;
      S.resumeKey = null;
      void openInCanvas(key);
    }
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
  restoreScroll();
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

/** Photos already stored for a property: no upload, no re-detection. */
function addExisting(photos) {
  const fresh = photos.map((p, i) => ({
    key: "x" + Date.now().toString(36) + i,
    name: p.name || "Photo",
    file: null,
    previewUrl: "",
    path: p.path,
    signed: null,
    status: "ready",
    error: "",
    room: p.room || "",
    roomSource: p.roomSource || p.room_source || (p.room ? "library" : "none"),
    confidence: 0,
    detect: "done",
    selected: true,
    done: false,
  }));
  const have = new Set(S.items.map((i) => i.path).filter(Boolean));
  const add = fresh.filter((i) => !have.has(i.path));
  S.items = S.items.concat(add);
  S.step = "review";
  render();
  add.forEach(async (it) => {
    try {
      it.signed = await roomPhotoUrl(it.path);
      patchCard(it);
    } catch (_) {}
  });
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
  /* Wording lives in the shared builder chrome so both builders agree. */
  return roomBadge({
    detect: it.roomSource === "manual" || it.roomSource === "library" ? "done" : it.detect,
    source: it.roomSource,
    confident: Number(it.confidence || 0) >= ACCEPT_CONFIDENCE,
    custom: !!it.room && !ROOM_OPTIONS.some((r) => r.label === it.room),
  });
}

/* Review Rooms is one continuous grid in upload order. Detection writes a
   label under a photo and never moves it, so the row a user was looking at
   stays where they left it. */
function ordered() {
  return S.items.slice();
}

function cardHtml(it, seq) {
  const st = stateOf(it);
  const ws = workState(it);
  const label = it.room || "Choose Room";
  const n = Number(seq) || ordered().findIndex((x) => x.key === it.key) + 1;
  /* Same tile as the video builder's Scenes grid: image, selection tile in the
     upper-left, a hover toolbar for the optional actions, and the shared room
     control underneath. Clicking the photo opens it in the Design canvas. */
  return `<div class="rv-tile ${it.selected ? "on" : ""}${ws ? " ws-" + ws.cls : ""}" data-k="${it.key}">
    <div class="rv-tile-th" data-open="${it.key}" role="button" tabindex="0" aria-label="Photo ${n}: open ${esc(it.name)} in the design canvas">
      <img src="${esc(it.resultUrl || it.signed || it.previewUrl)}" alt="${esc(it.name)}" loading="lazy">
      <span class="rv-tile-check" role="checkbox" tabindex="0" aria-checked="${it.selected ? "true" : "false"}" aria-label="Select ${esc(it.name)}" data-sel="${it.key}"><i data-lucide="check"></i></span>
      ${sceneNumberHtml(n)}
      ${it.status === "uploading" ? '<span class="rds-up"><i data-lucide="loader"></i>Uploading</span>' : ""}
      ${it.status === "failed" ? '<span class="rds-up bad"><i data-lucide="alert-triangle"></i>Upload Failed</span>' : ""}
      ${it.state === "generating" ? '<span class="rds-run"><i data-lucide="loader"></i>Generating</span>' : ""}
      ${imageToolbarHtml(
        [
          { label: "Design", icon: "wand-sparkles", attrs: { "data-open": it.key } },
          it.state === "failed" ? { label: "Retry", icon: "rotate-ccw", attrs: { "data-retry": it.key } } : null,
          { label: "Remove", icon: "trash-2", attrs: { "data-del": it.key } },
        ],
        { label: "Photo Actions" },
      )}
    </div>

    <div class="rv-tile-foot">
      ${roomSelectHtml({
        attr: "room",
        key: it.key,
        label,
        icon: roomIcon(it.room),
        unknown: !it.room,
        manual: it.roomSource === "manual",
        variant: "inline",
        className: "rv-room",
      })}
      ${
        ws
          ? `<em class="rv-tile-kind rds-work ${ws.cls}" title="${esc(it.err || ws.label)}"><i data-lucide="${ws.icon}"></i>${ws.label}</em>`
          : st
            ? `<em class="rv-tile-kind rds-state ${st.cls}">${st.label}</em>`
            : ""
      }
    </div>
  </div>`;
}


function gridHtml() {
  return `<div class="rv-grid" id="rdsBody">${ordered().map((it, i) => cardHtml(it, i + 1)).join("")}</div>`;
}

/* The counts live in the selection bar and the footer, so the only thing left
   to say beside the address is whether the work is safely stored. */
function statusText() {
  const uploading = S.items.some((i) => i.status === "uploading");
  if (S.saveState === "saving" || uploading) return saveLabel("saving");
  if (S.saveState === "error") return saveLabel("error");
  if (S.items.some((i) => i.status === "failed")) return "Some Uploads Failed";
  if (S.saveState === "saved") return saveLabel("saved");
  return "";
}

function selectedCount() {
  return S.items.filter((i) => i.selected).length;
}

/* The one builder rail, shared with the video builder (same component, same
   classes, same collapse behaviour) — only the step data differs. */
function stepRailHtml(active) {
  const has = S.items.length > 0;
  const st = stepState();
  const done = st.completed.length;
  const steps = [
    { key: "add", label: "Add Photos", icon: "image-plus", done: has },
    { key: "review", label: "Rooms", icon: "layout-grid", ready: has, badge: has ? String(selectedCount()) : "" },
    { key: "design", label: "Design", icon: "wand-sparkles", ready: has, done: !!done },
    { key: "final", label: "Review", icon: "circle-check", ready: !!done, badge: done ? String(done) : "" },
  ];
  return builderRailHtml({
    steps,
    active,
    attr: "step",
    variant: "col",
    label: "Photo staging steps",
    navClass: "rv-rail",
    itemClass: "rv-rail-i",
  });
}

function render() {
  const el = host();
  if (!el || !S) return;
  /* Browser Back walks the builder steps; Back from the first step asks
     before leaving instead of quietly dropping the project. */
  trackBuilderStep("design", S.step, {
    onStep: (step) => {
      if (!S) return;
      S.step = step === "add" ? "add" : "review";
      render();
    },
    onExit: () => {
      if (!S) return false;
      if (!S.startOver) openStartOver();
      return true;
    },
  });
  if (S.step === "add") {
    /* Step 1 runs full width in both builders: the picker is the whole job. */
    el.innerHTML = `<section class="rds-page">
      <div class="rv-head">
        <div><h2>Add Photos</h2><p>Add every photo you want to design. We'll sort them by room on the next screen.</p></div>
        <details class="rv-more rv-headmore"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
          <div class="rv-more-m">
            <button id="rdsClose">Save &amp; Exit</button>
            <button id="rdsStartOver">Start Over</button>
          </div>
        </details>
      </div>
      <div class="rds-add"><div id="rdsPicker"></div></div>
      ${startOverLayer()}
    </section>`;
    paint();
    el.querySelectorAll("#rdsClose").forEach((b) => (b.onclick = exitAll));
    bindStartOver(el);
    bindRail(el);
    mountPicker(el.querySelector("#rdsPicker"));
    railForStep();
    return;
  }

  const sel = selectedCount();
  const all = S.items.length > 0 && sel === S.items.length;
  el.innerHTML = `<section class="rds-page">
    <div class="rv-head">
      <div>
        <h2>Review Rooms</h2>
        <p>Confirm the room type for each photo.</p>
      </div>
      <div class="rv-head-tools">
        <button class="btn btn-ghost btn-sm" id="rdsMore"><i data-lucide="plus"></i>Add Photos</button>
        <input type="file" id="rdsFile" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden>
        <details class="rv-more rv-headmore"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
          <div class="rv-more-m">
            <button data-act="all">Select All</button>
            <button data-act="none">Clear Selection</button>
            <button data-act="del">Remove Selected</button>
            <button id="rdsClose">Save &amp; Exit</button>
            <button id="rdsStartOver">Start Over</button>
          </div>
        </details>
      </div>
    </div>
    <div class="rv-layout rv-railed">
      ${stepRailHtml("review")}
      <div class="rv-wiz bx-work">
        <div class="rv-utility">
          <label class="rv-selall"><input type="checkbox" id="rdsSelAll" ${all ? "checked" : ""}><b id="rdsSelCount">${sel} of ${S.items.length} selected</b></label>
          <div class="rv-utility-m">${addressBarHtml(S, PROPS || [], "rdsAddr")}</div>
          <div class="rv-utility-a">
            <button class="btn btn-primary btn-sm" id="rdsBulk"${sel > 1 ? "" : " disabled"}><i data-lucide="wand-sparkles"></i>Design Selected</button>
            <button class="btn btn-ghost btn-sm" id="rdsSetRoom"><i data-lucide="tag"></i>Set Room</button>
            <details class="rv-more"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
              <div class="rv-more-m">
                <button data-act="all">Select All</button>
                <button data-act="none">Clear Selection</button>
                <button data-act="room">Apply Room Type</button>
                <button data-act="del">Remove Selected</button>
              </div>
            </details>
          </div>
        </div>
        ${gridHtml()}
        <div class="rv-gridfoot">
          <div class="rv-count"><span id="rdsFootCount">${sel} ${sel === 1 ? "room" : "rooms"} selected</span></div>
          <div class="rv-gridfoot-a">
            <button class="btn btn-ghost" id="rdsBack">Back</button>
            <button class="btn btn-primary" id="rdsGo">Continue</button>
          </div>
        </div>
      </div>
    </div>
    ${startOverLayer()}
  </section>`;

  paint();
  bindReview(el);
  bindStartOver(el);
  bindRail(el);
  syncSelection();
  railForStep();

}

/* Every rail step is a real destination: nothing in the rail is decorative. */
function bindRail(el) {
  el.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-step");
      if (k === S.step && k !== "design") return;
      if (k === "design") {
        const st = stepState();
        const next = navigateTo("design", st);
        if (next.step === "design" && next.activeKey) { void openInCanvas(next.activeKey); return; }
        const first = designSet()[0];
        if (first) { void openInCanvas(first.key); return; }
        return;
      }
      if (k === "final") {
        /* Finished designs live in Media, where they can be shared and reused. */
        saveDraft();
        try { window.__rdGo && window.__rdGo("media"); } catch (_) {}
        return;
      }
      S.step = k;
      render();
    }),
  );
}

function patchCard(it) {
  if (!wrap || !S || S.step !== "review") return;
  const el = wrap.querySelector('.rv-tile[data-k="' + it.key + '"]');
  if (!el) return;
  const next = document.createElement("div");
  next.innerHTML = cardHtml(it);
  el.replaceWith(next.firstElementChild);
  paint();
  syncCard(it);
  patchStatus();
}

/** One authoritative selection state: the item drives the box and the border. */
function syncCard(it) {
  if (!wrap) return;
  const card = wrap.querySelector('.rv-tile[data-k="' + it.key + '"]');
  if (!card) return;
  card.classList.toggle("on", !!it.selected);
  card.classList.toggle("active", S.activeKey === it.key);
  const box = card.querySelector('[data-sel="' + it.key + '"]');
  if (box) box.setAttribute("aria-checked", it.selected ? "true" : "false");
}

function syncSelection() {
  if (!S || !wrap) return;
  S.items.forEach(syncCard);
  const sel = selectedCount();
  const set = wrap.querySelector("#rdsSetRoom");
  if (set) set.disabled = !sel;
  /* Bulk design is a real batch: it only makes sense from two photos up. */
  const bulk = wrap.querySelector("#rdsBulk");
  if (bulk) {
    bulk.disabled = sel < 2 || S.busy;
    const lab = bulk.lastChild;
    if (lab && lab.nodeType === 3) lab.textContent = sel > 1 ? `Design Selected · ${sel}` : "Design Selected";
  }
  const count = wrap.querySelector("#rdsSelCount");
  if (count) count.textContent = `${sel} of ${S.items.length} selected`;
  const foot = wrap.querySelector("#rdsFootCount");
  if (foot) foot.textContent = `${sel} ${sel === 1 ? "room" : "rooms"} selected`;
  const all = wrap.querySelector("#rdsSelAll");
  if (all) all.checked = S.items.length > 0 && sel === S.items.length;
  const badge = wrap.querySelector('.rv-rail-i[data-step="review"] .bx-badge');
  if (badge) badge.textContent = String(sel);
  patchStatus();
}

/* The shared address bar owns the autosave wording, so refreshing it in place
   keeps a single "Saving…/Saved" indicator on the page. */
function patchStatus() {
  if (!wrap || !S) return;
  const holder = wrap.querySelector(".rv-utility-m .rv-addr") || wrap.querySelector(".rv-utility-m");
  const node = holder && holder.querySelector(".rv-save");
  const label = statusText();
  if (node) {
    node.textContent = label;
    node.classList.toggle("ok", S.saveState === "saved");
    node.classList.toggle("bad", S.saveState === "error");
    node.style.display = label ? "" : "none";
  }
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
  el.querySelectorAll("#rdsClose").forEach((b) => (b.onclick = exitAll));
  el.querySelector("#rdsBack").onclick = () => {
    /* Back keeps every photo, room and selection: only the step changes. */
    saveDraft();
    S.step = "add";
    render();
  };
  /* Same overflow menus as the video builder: a native <details> popover. */
  el.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      const act = b.getAttribute("data-act");
      el.querySelectorAll("details.rv-more[open]").forEach((d) => d.removeAttribute("open"));
      if (act === "all") { S.items.forEach((i) => (i.selected = true)); saveDraft(); syncSelection(); return; }
      if (act === "none") { S.items.forEach((i) => (i.selected = false)); saveDraft(); syncSelection(); return; }
      if (act === "room") { applyRoomToSelected(el.querySelector("#rdsSetRoom") || b); return; }
      if (act === "del") { removeSelected(); return; }
    }),
  );
  bindAddress(el);

  /* Add Photos stays on this page: the picker adds straight into the grid. */
  const file = el.querySelector("#rdsFile");
  el.querySelector("#rdsMore").onclick = () => file && file.click();
  if (file) {
    file.onchange = () => {
      const picked = Array.from(file.files || []);
      file.value = "";
      if (picked.length) addFiles(picked);
    };
  }

  const selAll = el.querySelector("#rdsSelAll");
  if (selAll) {
    selAll.onchange = () => {
      S.items.forEach((i) => (i.selected = selAll.checked));
      saveDraft();
      syncSelection();
    };
  }

  el.querySelector("#rdsSetRoom").onclick = (e) => applyRoomToSelected(e.currentTarget);
  el.querySelector("#rdsGo").onclick = startDesigning;
  const bulk = el.querySelector("#rdsBulk");
  if (bulk) bulk.onclick = () => startBulkDesign();


  /* Cards are re-rendered in place as uploads and detection land, so the card
     controls are delegated from the page instead of bound per element. The
     page element survives re-renders, so delegation is attached only once. */
  if (el.__rdsDelegated) return;
  el.__rdsDelegated = true;
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    /* The check tile owns selection; the photo itself opens the canvas. */
    const pick = t.closest("[data-sel]");
    if (pick) {
      e.preventDefault();
      e.stopPropagation();
      const it = S.items.find((i) => i.key === pick.getAttribute("data-sel"));
      if (it) toggleSelect(it, !it.selected);
      return;
    }
    const more = t.closest("[data-toolsmore]");
    if (more) {
      e.preventDefault();
      e.stopPropagation();
      const tile = more.closest(".rv-tile");
      if (tile) tile.classList.toggle("tools-open");
      return;
    }
    const retry = t.closest("[data-retry]");
    if (retry) {
      e.stopPropagation();
      const it = S.items.find((i) => i.key === retry.getAttribute("data-retry"));
      if (it) startBulkDesign([it], true);
      return;
    }
    const del = t.closest("[data-del]");
    if (del) { e.stopPropagation(); removeOne(del.getAttribute("data-del")); return; }
    const room = t.closest("[data-room]");
    if (room) {
      const it = S.items.find((i) => i.key === room.getAttribute("data-room"));
      if (!it) return;
      openRoomPopover(room, (label) => {
        it.room = label;
        it.roomSource = "manual";
        saveDraft();
        patchCard(it);
      }, it.key);
      return;
    }
    const open = t.closest("[data-open]");
    if (open) { openInCanvas(open.getAttribute("data-open")); return; }
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t || !t.closest) return;
    const pick = t.closest("[data-sel]");
    if (pick) {
      e.preventDefault();
      const it = S.items.find((i) => i.key === pick.getAttribute("data-sel"));
      if (it) toggleSelect(it, !it.selected);
      return;
    }
    const open = t.closest(".rv-tile-th[data-open]");
    if (open) { e.preventDefault(); openInCanvas(open.getAttribute("data-open")); }
  });
}

function toggleSelect(it, next) {
  it.selected = !!next;
  syncCard(it);
  syncSelection();
  saveDraft();
}

/* -------------------------------------------------------- bulk designing
   One shared direction, one render per photo. Every photo is charged on its
   own and a failure only ever fails that photo, so the rest of the batch
   still finishes and only the failed ones offer a retry. */

function runBatch(batch, direction) {
  S.busy = true;
  S.direction = direction;
  syncSelection();
  batch.forEach((it) => {
    it.state = "generating";
    it.err = "";
    patchCard(it);
  });
  runBulkDesign(batch, direction, {
    onUpdate: (it) => {
      patchCard(it);
      saveDraft();
    },
    onDone: () => {
      S.busy = false;
      syncSelection();
      saveDraft();
      const failed = batch.filter((i) => i.state === "failed").length;
      if (failed) {
        try {
          window.rdToast && window.rdToast(`${failed} photo${failed === 1 ? "" : "s"} did not render. Retry them from the card.`);
        } catch (_) {}
      }
    },
  });
}

function startBulkDesign(list, reuseDirection) {
  if (!S || S.busy) return;
  const items = (list && list.length ? list : S.items.filter((i) => i.selected)).filter(
    (i) => i.status !== "uploading",
  );
  if (!items.length) return;
  if (reuseDirection && S.direction) {
    runBatch(items, S.direction);
    return;
  }
  openBulkDesign({
    items,
    onEdit: () => {
      S.step = "review";
      render();
    },
    onStart: (batch, direction) => runBatch(batch, direction),
  });
}


function applyRoomToSelected(anchor) {
  const sel = S.items.filter((i) => i.selected);
  if (!sel.length || !anchor) return;
  openRoomPopover(anchor, (label) => {
    sel.forEach((i) => {
      i.room = label;
      i.roomSource = "manual";
    });
    saveDraft();
    sel.forEach(patchCard);
    syncSelection();
  });
}

function removeOne(key) {
  const it = S.items.find((i) => i.key === key);
  if (!it) return;
  if (!window.confirm("Remove “" + it.name + "” from this project? The original photo stays in your library.")) return;
  try { URL.revokeObjectURL(it.previewUrl); } catch (_) {}
  S.items = S.items.filter((i) => i.key !== key);
  if (!S.items.length) S.step = "add";
  saveDraft();
  render();
}

function removeSelected() {
  const gone = S.items.filter((i) => i.selected);
  if (!gone.length) return;
  const msg =
    gone.length === 1
      ? "Remove 1 photo from this project? The original photo stays in your library."
      : "Remove " + gone.length + " photos from this project? The originals stay in your library.";
  if (!window.confirm(msg)) return;
  gone.forEach((i) => { try { URL.revokeObjectURL(i.previewUrl); } catch (_) {} });
  S.items = S.items.filter((i) => !i.selected);
  if (!S.items.length) S.step = "add";
  saveDraft();
  render();
}

/** Step 3 takes only the selected photos, and only once their rooms are set. */
function startDesigning() {
  const sel = ordered().filter((i) => i.selected);
  if (!sel.length) {
    window.alert("Select at least one photo to design.");
    return;
  }
  const unsure = sel.filter((i) => stateOf(i).cls === "warn");
  if (unsure.length) {
    window.alert("Set a room type for every selected photo first. " + unsure.length + " still need one.");
    return;
  }
  saveDraft();
  const first = sel.find((i) => !i.done) || sel[0];
  openInCanvas(first.key);
}


/* ------------------------------------------------------ property address
   Optional on every staging project. The address never renames the project
   and can be cleared again from the same modal. */
let PROPS = null;
let addrTimer = null;

/** Load the workspace's properties once so the field can suggest addresses. */
async function loadProps() {
  if (PROPS) return PROPS;
  try { PROPS = await listMediaProperties(); } catch (_) { PROPS = []; }
  if (S && S.step === "review") render();
  return PROPS;
}

/** Inline, autosaved property address — the same control the video builder uses. */
function bindAddress(el) {
  void loadProps();
  const input = el.querySelector("#rdsAddr");
  if (input) {
    input.addEventListener("input", (ev) => {
      applyAddress(S, ev.target.value, "manual");
      S.addressMatchDismissed = false;
      clearTimeout(addrTimer);
      addrTimer = setTimeout(() => { saveDraft(); void lookupAddress(); }, 700);
    });
  }
  el.querySelectorAll("[data-addr-use]").forEach((b) => (b.onclick = () => {
    S.propertyId = b.getAttribute("data-addr-use");
    S.address = (S.addressMatch && S.addressMatch.address) || S.address;
    applyAddress(S, S.address, "existing_property");
    S.addressMatch = null;
    saveDraft();
    render();
  }));
  el.querySelectorAll("[data-addr-sep]").forEach((b) => (b.onclick = () => {
    S.addressMatchDismissed = true;
    S.propertyId = null;
    saveDraft();
    render();
  }));
  el.querySelectorAll("[data-addr-retry]").forEach((b) => (b.onclick = () => retryDraftSave()));
}

/** Offer the existing property instead of quietly creating a duplicate. */
async function lookupAddress() {
  const text = cleanAddressText(S.address);
  if (text.length < 8 || S.propertyId) { S.addressMatch = null; return; }
  try {
    const res = await matchPropertyAddress({ data: { address: text } });
    if (!S) return;
    S.addressMatch = (res && res.match) || null;
    if (S.addressMatch) render();
  } catch (_) {}
}
async function openAddressEditor() {
  if (!PROPS) {
    try { PROPS = await listMediaProperties(); } catch (_) { PROPS = []; }
  }
  openAddressModal({
    address: S.address || "",
    propertyId: S.propertyId || null,
    properties: PROPS || [],
    subtitle: "Optional. Adding an address never renames your project.",
    suggest: async (q) => {
      try {
        const res = await suggestAddresses({ data: { q } });
        return (res && res.suggestions) || [];
      } catch (_) {
        return (PROPS || []).filter((p) => !q || String(p.address || "").toLowerCase().includes(String(q).toLowerCase()));
      }
    },
    onSave: async (r) => {
      S.address = r.address || "";
      if (r.assignmentChanged) S.propertyId = r.propertyId || null;
      saveDraft();
    },
    onDone: () => {
      const txt = wrap && wrap.querySelector("#rdsAddrTxt");
      if (txt) txt.textContent = S.address || "Add Property Address";
    },
  });
}

/* ------------------------------------------------------- room combobox */

function closePopover() {
  if (popover) popover.remove();
  popover = null;
  document.querySelectorAll('.bx-room[aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (S && S.activeKey) {
    const prev = S.activeKey;
    S.activeKey = null;
    const it = S.items.find((i) => i.key === prev);
    if (it) syncCard(it);
  }
}

function openRoomPopover(anchor, onPick, key) {
  closePopover();
  if (anchor && anchor.setAttribute) anchor.setAttribute("aria-expanded", "true");
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
  if (key && S) {
    S.activeKey = key;
    const it = S.items.find((i) => i.key === key);
    if (it) syncCard(it);
  }
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

/** The canvas only walks the photos the user chose on Review Rooms. */
function designSet() {
  const sel = ordered().filter((i) => i.selected);
  return sel.length ? sel : ordered();
}

function idxOf(key) {
  return designSet().findIndex((i) => i.key === key);
}

async function openInCanvas(key) {
  const it = S.items.find((i) => i.key === key);
  if (!it) return;

  S.current = key;
  rememberScroll();
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
  const head = document.getElementById("rdsCanvasHead");
  if (head) head.remove();
}

/* The canvas belongs to the same builder as the grid, so its navigation lives
   inside the Studio view: a compact "All Rooms" control in the header and the
   room filmstrip directly beneath the canvas — not a floating bar. */
function mountStrip() {
  if (!S || !S.items.length) return;
  removeStrip();
  const view = document.getElementById("v-studio");
  const board = view && view.querySelector(".studio");

  const head = document.createElement("div");
  head.id = "rdsCanvasHead";
  head.className = "rds-chead";
  head.innerHTML = `<button class="rds-chead-b" id="rdsAllRooms"><i data-lucide="chevron-left"></i>All Rooms</button>
    <span class="rds-chead-t" id="rdsCanvasTitle"></span>
    <details class="rv-more rv-headmore"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
      <div class="rv-more-m">
        <button id="rdsClose">Save &amp; Exit</button>
        <button id="rdsStartOver">Start Over</button>
      </div>
    </details>`;
  if (view && board) view.insertBefore(head, board);

  strip = document.createElement("div");
  strip.className = "rds-strip";
  if (view && board && board.nextSibling) view.insertBefore(strip, board.nextSibling);
  else if (view) view.appendChild(strip);
  else document.body.appendChild(strip);

  head.querySelectorAll("#rdsClose").forEach((b) => (b.onclick = exitAll));
  head.querySelectorAll("#rdsStartOver").forEach((b) => (b.onclick = () => {
    /* The confirmation lives in the builder screen, so go back to it first. */
    markCurrentDone();
    reopenStaging();
    openStartOver();
  }));
  const back = head.querySelector("#rdsAllRooms");
  if (back)
    back.onclick = () => {
      markCurrentDone();
      reopenStaging();
    };

  drawStrip();
  window.addEventListener("hashchange", stripGuard);
}

function stripGuard() {
  if (!strip) return;
  const onStudio = (location.hash || "").replace(/^#/, "") === "studio";
  strip.classList.toggle("hide", !onStudio);
  const head = document.getElementById("rdsCanvasHead");
  if (head) head.classList.toggle("hide", !onStudio);
}

function drawStrip() {
  if (!strip || !S) return;
  const list = designSet();
  const i = list.findIndex((x) => x.key === S.current);
  const cur = i >= 0 ? list[i] : null;
  const nxt = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const title = document.getElementById("rdsCanvasTitle");
  if (title)
    title.textContent = cur
      ? `${cur.room || cur.name}${list.length > 1 ? ` · ${i + 1} of ${list.length}` : ""}`
      : "";

  strip.innerHTML = `<button class="rds-strip-i" id="rdsPrev" aria-label="Previous room" ${i <= 0 ? "disabled" : ""}><i data-lucide="chevron-left"></i></button>
    <div class="rds-strip-l">${list
      .map((x) => {
        const ws = workState(x);
        return `<button class="rds-strip-t${x.key === S.current ? " on" : ""}${ws ? " ws-" + ws.cls : ""}" data-go="${x.key}" title="${esc(x.room || x.name)}">
            <img src="${esc(x.resultUrl || x.signed || x.previewUrl)}" alt="${esc(x.name)}">
            ${ws ? `<i data-lucide="${ws.icon}"></i>` : ""}
            <em>${esc(x.room || x.name)}</em></button>`;
      })
      .join("")}</div>
    <button class="rds-strip-i" id="rdsNext" aria-label="Next room" ${i < 0 || i >= list.length - 1 ? "disabled" : ""}><i data-lucide="chevron-right"></i></button>
    <span class="rds-strip-c">${i < 0 ? "" : `Room ${i + 1} Of ${list.length}`}</span>
    ${cur && cur.done && nxt ? `<button class="rds-strip-n" id="rdsNextRoom">Next Room<i data-lucide="arrow-right"></i></button>` : ""}
    <button class="rds-strip-i" id="rdsStripX" aria-label="Close the photo set"><i data-lucide="x"></i></button>`;

  paint();
  strip.querySelector("#rdsStripX").onclick = exitAll;
  const step = (dir) => {
    markCurrentDone();
    const l = designSet();
    const n = l.findIndex((x) => x.key === S.current);
    const t = n + dir;
    if (n >= 0 && t >= 0 && t < l.length) openInCanvas(l[t].key);
  };
  strip.querySelector("#rdsPrev").onclick = () => step(-1);
  strip.querySelector("#rdsNext").onclick = () => step(1);
  const nextRoom = strip.querySelector("#rdsNextRoom");
  if (nextRoom) nextRoom.onclick = () => step(1);

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
      if (cur) {
        cur.done = true;
        cur.state = "complete";
      }
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
  window.rdStaging = { open: openStagingReview, reopen: reopenStaging, has: hasStagingSession, resume: resumeStagingDraft, ensure: ensureStagingView, mount: mountStagingView, detach: detachStagingView };
} catch (_) {}
