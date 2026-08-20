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
import { mountSourcePicker, normalizeImageFile } from "@/lib/source-picker";
import { rejectReason } from "@/lib/upload-manager";
import { uploadRoomPhoto, roomPhotoUrl, deleteRoomPhoto } from "@/lib/room-photos";
import { mountPhotoImages, photoSrc, photoSrcStale } from "@/lib/photo-src";
import {
  photoFailPanelHtml,
  mountRenderedFailures,
  syncFailures,
  photoFailureKind,
  failedCardMenuGroups,
  failureDetailRows,
  retryPhotoCard,
} from "@/lib/photo-fail";
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
import {
  builderRailHtml,
  roomSelectHtml,
  roomBadge,
  selectCheckHtml,
  saveLabel,
  imageToolbarHtml,
  sceneNumberHtml,
} from "@/lib/builder-ui";
import { modalFooterHtml } from "@/lib/modal-footer";
import { addressBarHtml, applyAddress, cleanAddressText } from "@/lib/address-field";
import {
  cardMenuButtonHtml,
  runCardAction,
  registerCardMenu,
  confirmDialog,
  detailsDialog,
  undoToast,
  downloadOriginal,
  pickOneImage,
} from "@/lib/builder-card-menu";
import { cardStatusHtml, registerCardStatus } from "@/lib/builder-card-status";
import { formatSelectorHtml } from "@/lib/builder-format-selector";
import {
  OUTPUT_RATIOS,
  PRIMARY_OUTPUT_RATIOS,
  MORE_OUTPUT_RATIOS,
  DEFAULT_OUTPUT_RATIO,
  isPrimaryRatio,
  normalizeOutputRatio,
  normalizeOverride,
  ratioLabel,
  effectiveRatio,
  ratioClass,
  ratioAspect,
  RATIO_CLASSES,
} from "@/lib/output-ratio";
import { setHandoff } from "@/lib/handoff";
import {
  beginCanvasOpen,
  canvasEntryFrom,
  canvasOpenIsCurrent,
  createOpenStore,
  type CanvasEntry,
} from "@/lib/canvas-route";
import {
  startOverModalHtml,
  resetStudioSurface,
  trackBuilderStep,
  endBuilderHistory,
} from "@/lib/builder-exit";
import { durableStep, navigateTo, restoreStep } from "@/lib/builder-step";
import { PHOTO_RAIL, backFromPhotoStep, normalizePhotoStep } from "@/lib/builder-nav";
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
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
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
    step: "review",
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
    /* Project-level Photo Design output ratio. "original" keeps every photo's
       native aspect; a photo may still carry its own override. */
    outputRatio: normalizeOutputRatio(seed.outputRatio),
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
    /* null = follow the project default. */
    ratio: null,
    /* The ratio a finished design was actually rendered at. */
    resultRatio: null,
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
          i.roomSource === "manual" || i.roomSource === "ai" || i.roomSource === "library"
            ? i.roomSource
            : "none",
        confidence: Number(i.confidence || 0),
        selected: !!i.selected,
        done: !!i.done,
        status: i.status || "ready",
      })),
    selected: S.items.filter((i) => i.selected && i.path).map((i) => i.key),
    item_order: ordered()
      .filter((i) => i.path)
      .map((i) => i.key),
    /* Per-room work survives a refresh: state, result and the direction that
       produced it, keyed by photo. */
    settings: {
      current: S.current || null,
      direction: S.direction || null,
      output_ratio: normalizeOutputRatio(S.outputRatio),
      rooms: S.items.reduce((m, i) => {
        m[i.key] = {
          room: i.room || null,
          state: i.state || (i.done ? "complete" : "none"),
          result_path: i.resultPath || null,
          error: i.err || "",
          ratio: normalizeOverride(i.ratio),
          result_ratio: i.resultRatio || null,
        };
        return m;
      }, {}),
    },
  };
}

function setSaveState(state) {
  if (!S) return;
  S.saveState = state;
  paintCanvasSave();
  S.addressSaveState =
    state === "saving" ? "saving" : state === "error" ? "error" : state === "saved" ? "saved" : "";
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
  if (existing) {
    wrap = existing;
    return wrap;
  }
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
  try {
    window.__rdGo && window.__rdGo("staging");
  } catch (_) {}
  render();
  railForStep();
}

function hide() {
  closePopover();
  try {
    window.__rdRailBorrow && window.__rdRailBorrow.release();
  } catch (_) {}
}

/** Make sure the page container exists before the router toggles views. */
export function ensureStagingView() {
  return !!host();
}

/* Every mount of the staging view gets a generation. Restoration started
   under an older generation may not move the user: by the time it resolves
   they may be in Media, Properties or the video builder. */
let mountGen = 0;
let restoring: Promise<"restored" | "none" | "error"> | null = null;

/** True while the canonical Photo Design route is still the visible page. */
function onStagingRoute() {
  try {
    const isView = (window as any).__rdIsView;
    if (typeof isView === "function") return !!isView("staging");
  } catch (_) {}
  const raw = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
  return raw === "staging";
}

/** Router hook: the staging view became visible again (back button, refresh). */
export function mountStagingView() {
  const gen = ++mountGen;
  if (!S) {
    /* Nothing in flight: try the saved draft, otherwise hand the user back.
       Only one restoration runs at a time, and only a confirmed "no draft
       exists while Photo Design is still the active page" returns to Studio.
       A network or auth failure leaves the user exactly where they are. */
    if (!restoring)
      restoring = resumeStagingDraftResult().finally(() => {
        restoring = null;
      });
    void restoring.then((result) => {
      if (result !== "none") return;
      if (gen !== mountGen) return;
      if (hasStagingSession()) return;
      if (!onStagingRoute()) return;
      try {
        window.__rdGo && window.__rdGo("studio");
      } catch (_) {}
    });
    return;
  }
  render();
  railForStep();
  restoreScroll();
}

export function detachStagingView() {
  /* Anything restoring for the page we are leaving is now stale. */
  mountGen++;
  closePopover();
  try {
    window.__rdRailBorrow && window.__rdRailBorrow.release();
  } catch (_) {}
}

/* Scroll position survives a trip into the canvas and back. */
let scrollY = 0;
function scroller() {
  return (
    document.querySelector(".rd-app .content") ||
    document.scrollingElement ||
    document.documentElement
  );
}
function rememberScroll() {
  const el = scroller();
  scrollY = el ? el.scrollTop || window.scrollY || 0 : 0;
}
function restoreScroll() {
  const el = scroller();
  if (!el) return;
  requestAnimationFrame(() => {
    try {
      el.scrollTop = scrollY;
    } catch (_) {}
  });
}

/* Leaving the builder never loses work: the draft is flushed first, then the
   session is torn down and Studio is returned to its starting page. */
function leaveStaging() {
  hide();
  endBuilderHistory("design");
  if (saver) {
    void saver.flush();
    saver.destroy();
    saver = null;
  }
  if (S)
    S.items.forEach((i) => {
      try {
        URL.revokeObjectURL(i.previewUrl);
      } catch (_) {}
    });
  S = null;
  removeStrip();
  resetStudioSurface();
  try {
    window.__rdGo && window.__rdGo("studio");
  } catch (_) {}
}

let exiting = false;
/** "Save & Exit": persist the draft and its step, then return to Studio. */
async function saveExit() {
  if (exiting) return;
  exiting = true;
  try {
    saveDraft();
  } catch (_) {}
  try {
    if (saver) await saver.flush();
  } catch (_) {}
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
    if (S) {
      void saveExit();
      return true;
    }
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
  return startOverModalHtml({
    wrap: "rdsSoWrap",
    keep: "rdsSoKeep",
    go: "rdsSoGo",
    busy: !!S.startOver.busy,
  });
}

function bindStartOver(el) {
  const keep = el.querySelector("#rdsSoKeep");
  if (keep)
    keep.onclick = () => {
      if (S) {
        S.startOver = null;
        render();
      }
    };
  const go = el.querySelector("#rdsSoGo");
  if (go)
    go.onclick = () => {
      void confirmStartOver();
    };
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
    /* Studio owns photo selection, so the builder always opens on Rooms. */
    S.step = "review";
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
  const assets = (draft.assets || [])
    .slice()
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const rooms = (draft.settings && draft.settings.rooms) || {};
  S.direction = (draft.settings && draft.settings.direction) || null;
  S.outputRatio = normalizeOutputRatio(draft.settings && draft.settings.output_ratio);
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
      state:
        saved.state === "generating" ? "failed" : saved.state || (a.done ? "complete" : "none"),
      resultPath: saved.result_path || null,
      resultUrl: null,
      ratio: normalizeOverride(saved.ratio),
      resultRatio: saved.result_ratio || null,
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
  /* Add Photos is no longer a builder step: a saved "add" draft opens Rooms.
     The canvas is reopened separately through resumeKey. */
  S.step = "review";
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
 *
 * The result distinguishes the three outcomes that matter to routing:
 *   "restored" — a draft was hydrated and is on screen
 *   "none"     — the server answered and there is genuinely no draft
 *   "error"    — network/auth failure; nothing is known, so nothing may move
 */
export async function resumeStagingDraftResult(id?): Promise<"restored" | "none" | "error"> {
  try {
    /* One-time lift of any legacy browser-only draft, server-confirmed first. */
    await migrateLegacyStagingDraft({ save: (payload) => saveProjectDraft({ data: payload }) });
  } catch (_) {}
  let draft = null;
  try {
    if (id) draft = (await getProjectDraft({ id })).draft;
    else {
      const res = await listProjectDrafts({
        project_type: "photo_staging",
        scope: "drafts",
        limit: 1,
      });
      draft = (res.drafts || [])[0] || null;
    }
  } catch (_) {
    return "error";
  }
  if (!draft || !(draft.assets || []).length) return "none";
  try {
    hydrate(draft);
    show();
    /* A draft saved on the canvas reopens on that exact photo. */
    if (S && S.resumeKey) {
      const key = S.resumeKey;
      S.resumeKey = null;
      void openInCanvas(key);
    }
    return "restored";
  } catch (_) {
    return "error";
  }
}

export async function resumeStagingDraft(id?) {
  return (await resumeStagingDraftResult(id)) === "restored";
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

/**
 * An upload failure is a different problem from a display failure: the stored
 * asset never arrived, so the retry re-uploads the local file we still hold.
 * Nothing about the card - room, order, selection - is touched.
 */
function mountUploadRetries(root) {
  mountRenderedFailures(root, async (key) => {
    const it = itemAt(key);
    if (!it || !it.file) return false;
    it.status = "uploading";
    await uploadOne(it);
    syncFailures();
    return it.status === "ready";
  });
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

/* Active design settings for one photo. Passive metadata — room type, the
   property it belongs to, the selection state — is never counted here; only
   things the user actually applied show up. */
function designFeatures(it) {
  if (!it) return [];
  const d = S.direction || null;
  const touched = !!(
    it.resultPath ||
    it.state === "generating" ||
    it.state === "complete" ||
    it.done
  );
  const out = [];
  if (d && touched && d.direction)
    out.push({
      id: "style",
      icon: "palette",
      label: "Style",
      value: d.direction,
      removable: false,
    });
  if (d && touched && d.notes)
    out.push({
      id: "notes",
      icon: "pencil-line",
      label: "Design Instructions",
      value: d.notes,
      removable: false,
    });
  if (it.ratio)
    out.push({
      id: "ratio",
      icon: "crop",
      label: "Photo Format",
      value: ratioLabel(it.ratio),
      removable: false,
    });
  if (it.resultPath)
    out.push({
      id: "version",
      icon: "layers",
      label: "Generated Version",
      value: "Ready",
      removable: false,
    });
  else if (it.state === "generating")
    out.push({
      id: "version",
      icon: "loader",
      label: "Design",
      value: "Generating",
      removable: false,
    });
  return out;
}

registerCardStatus("photo", {
  title: "Design Settings",
  features(key) {
    return designFeatures(itemAt(key));
  },
  edit(key) {
    openCanvasFor(key);
  },
});

function openCanvasFor(key) {
  const el = document.querySelector(`[data-open="${CSS.escape(String(key))}"]`);
  if (el) el.click();
}

/**
 * Every card previews the shape it will actually be generated at. The class
 * lands on the tile and only the image frame inside it carries the aspect
 * ratio, so the room selector always stays beneath a correctly shaped photo.
 */
function tileRatio(it) {
  return effectiveRatio(S && S.outputRatio, it && it.ratio);
}
function tileRatioClass(it) {
  return ratioClass(tileRatio(it));
}

/**
 * Attributes for a card image. The storage path is always the canonical
 * reference — a signed URL is only ever a cached hint — so every frame stays
 * bound to a path and can re-sign itself instead of going gray.
 */
function imgAttrs(it) {
  const bind = it.resultUrl || it.resultPath ? it.resultPath || it.path || "" : it.path || "";
  const url = it.resultUrl || it.signed || it.previewUrl || "";
  const src = url ? ` src="${esc(url)}"` : "";
  const bound = bind ? ` data-photo-path="${esc(bind)}"` : "";
  return src + bound;
}

function cardHtml(it, seq) {
  const st = stateOf(it);
  const ws = workState(it);
  const label = it.room || "Choose Room";
  const n = Number(seq) || ordered().findIndex((x) => x.key === it.key) + 1;
  /* Same tile as the video builder's Scenes grid: image, selection tile in the
     upper-left, a hover toolbar for the optional actions, and the shared room
     control underneath. Clicking the photo opens it in the Design canvas. */
  const rc = tileRatioClass(it);
  const override = normalizeOverride(it.ratio);
  const failed = it.status === "failed";
  return `<div class="rv-tile ${rc} ${it.selected ? "on" : ""}${ws ? " ws-" + ws.cls : ""}${failed ? " rd-fail" : ""}" data-k="${it.key}">
    <div class="rv-tile-th${failed ? " rd-img-fail" : ""}"${failed ? ' data-photo-fail="upload"' : ""} data-open="${it.key}" role="button" tabindex="0" aria-label="Photo ${n}: open ${esc(it.name)} in the design canvas">

      <img${imgAttrs(it)} alt="${esc(it.name)}" loading="lazy">
      <span class="rv-tile-check" role="checkbox" tabindex="0" aria-checked="${it.selected ? "true" : "false"}" aria-label="Design ${esc(it.name)}" data-sel="${it.key}"><i data-lucide="check"></i></span>
      ${sceneNumberHtml(n)}
      ${cardStatusHtml({ flow: "photo", key: it.key, noun: "design settings", features: designFeatures(it) })}
      ${cardMenuButtonHtml({ flow: "photo", key: it.key, label: it.room ? it.room + " photo" : "Photo " + n })}
      ${it.status === "uploading" ? '<span class="rds-up"><i data-lucide="loader"></i>Uploading</span>' : ""}
      ${it.status === "failed" ? photoFailPanelHtml("upload") : ""}
      ${it.state === "generating" ? '<span class="rds-run"><i data-lucide="loader"></i>Generating</span>' : ""}
      ${override ? `<span class="rv-tile-fmt" title="Custom format: ${esc(ratioLabel(override))}"><i data-lucide="crop"></i>${esc(ratioLabel(override))}</span>` : ""}
      ${imageToolbarHtml(
        [
          { label: "Design", icon: "wand-sparkles", attrs: { "data-open": it.key } },
          it.state === "failed"
            ? { label: "Retry", icon: "rotate-ccw", attrs: { "data-retry": it.key } }
            : null,
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

/* A permanent action card closes the grid. It is not a room: no number, no
   selector, no menu, no credits — it only opens the existing Add Photos
   picker, and it always stays the final grid item. */
function addCardHtml() {
  return `<div class="rv-addcard ${ratioClass(S && S.outputRatio)}">
    <button type="button" class="rv-addcard-b" id="rdsAddCard" aria-label="Add More Photos">
      <i data-lucide="image-plus"></i>
      <b>Add More Photos</b>
      <em>Upload, Import, or Use Media</em>
      <small class="rv-addcard-types">JPG · PNG · WebP · HEIC</small>
    </button>
    <div class="rv-addcard-pad" aria-hidden="true"></div>
  </div>`;
}

function gridHtml() {
  return `<div class="rv-grid" id="rdsBody">${ordered()
    .map((it, i) => cardHtml(it, i + 1))
    .join("")}${addCardHtml()}</div>`;
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
  const extra = {
    review: { ready: has, badge: has ? String(selectedCount()) : "" },
    design: { ready: has, done: !!done },
    final: { ready: !!done, badge: done ? String(done) : "" },
  };
  const steps = PHOTO_RAIL.map((s) => ({ ...s, ...(extra[s.key] || {}) }));
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
  /* Add Photos is not a builder step any more: Studio is the shared photo
     source, so any legacy "add" state resolves to Rooms (or back to Studio
     when the project holds no photos at all). */
  if (S.step === "add") {
    if (!S.items.length) {
      leaveStaging();
      return;
    }
    S.step = "review";
  }
  /* Browser Back walks the builder steps; Back from the first step asks
     before leaving instead of quietly dropping the project. */
  trackBuilderStep("design", S.step, {
    onStep: (step) => {
      if (!S) return;
      S.step = normalizePhotoStep(step);
      render();
    },
    onExit: () => {
      if (!S) return false;
      /* First builder step: Back means "leave for Studio", and the draft is
         saved on the way out — work is never silently discarded. */
      void saveExit();
      return false;
    },
  });

  const sel = selectedCount();
  const all = S.items.length > 0 && sel === S.items.length;
  el.innerHTML = `<section class="rds-page">
    <div class="rv-head">
      <div>
        <h2>Prepare Your Photos</h2>
        <p>Choose the photos you want to design, confirm their room types, and select an output format.</p>
      </div>
      <div class="rv-head-tools">
        ${formatSelectorHtml({
          label: "Photo Format",
          options: PRIMARY_OUTPUT_RATIOS,
          value: normalizeOutputRatio(S.outputRatio),
          attr: "ratio",
          id: "rds-ratio",
          more: { label: "More Ratios", value: "__more" },
          customLabel: ratioLabel(S.outputRatio),
        })}
        <button class="btn btn-ghost btn-sm" id="rdsMore"><i data-lucide="plus"></i>Add Photos</button>
        <input type="file" id="rdsFile" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif" multiple hidden>
        <details class="rv-more rv-headmore"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
          <div class="rv-more-m">
            <button data-act="moreratios">More Ratios</button>
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
            <button class="btn btn-primary btn-sm" id="rdsBulk"${sel > 0 ? "" : " disabled"}><i data-lucide="wand-sparkles"></i>Set Design Direction · ${sel}</button>
            <button class="btn btn-ghost btn-sm" id="rdsSetRoom"${sel > 0 ? "" : " disabled"} title="${sel > 1 ? `Applies one room type to all ${sel} selected photos` : "Sets the room type for the selected photo"}"><i data-lucide="tag"></i>Set Room Type${sel > 1 ? ` · ${sel}` : ""}</button>
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
          <div class="rv-count"><span id="rdsFootCount">${sel} ${sel === 1 ? "photo" : "photos"} selected</span></div>
          <div class="rv-gridfoot-a">
            <button class="btn btn-ghost" id="rdsBack">Back</button>
            <button class="btn btn-primary" id="rdsGo">Next: Design Direction</button>
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
  /* Card images are bound to their storage path, so an expiring signed URL is
     refreshed in place instead of leaving a blank frame behind. */
  mountPhotoImages(el);
  mountUploadRetries(el);
}

/* Every rail step is a real destination: nothing in the rail is decorative. */
function bindRail(el) {
  el.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.getAttribute("data-step");
      if (k === S.step && k !== "design") return;
      if (k === "design") {
        /* The Design step is the bulk direction interface for the current
           selection, not the single-photo canvas. */
        const sel = ordered().filter((i) => i.selected);
        startBulkDesign(sel.length ? sel : designSet());
        return;
      }
      if (k === "final") {
        /* Finished designs live in Media, where they can be shared and reused. */
        saveDraft();
        try {
          window.__rdGo && window.__rdGo("media");
        } catch (_) {}
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
  mountPhotoImages(wrap);
  mountUploadRetries(wrap);
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
  if (set) {
    /* The label carries its own scope: bulk edits always show the count. */
    set.disabled = !sel;
    const lab = set.lastChild;
    if (lab && lab.nodeType === 3) lab.textContent = `Set Room Type${sel > 1 ? ` · ${sel}` : ""}`;
    set.title =
      sel > 1
        ? `Applies one room type to all ${sel} selected photos`
        : "Sets the room type for the selected photo";
  }

  const bulk = wrap.querySelector("#rdsBulk");
  if (bulk) {
    bulk.disabled = sel < 1 || S.busy;
    const lab = bulk.lastChild;
    if (lab && lab.nodeType === 3) lab.textContent = `Set Design Direction · ${sel}`;
  }
  const count = wrap.querySelector("#rdsSelCount");
  if (count) count.textContent = `${sel} of ${S.items.length} selected`;
  const foot = wrap.querySelector("#rdsFootCount");
  if (foot) foot.textContent = `${sel} ${sel === 1 ? "photo" : "photos"} selected`;
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
  const holder =
    wrap.querySelector(".rv-utility-m .rv-addr") || wrap.querySelector(".rv-utility-m");
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

/* --------------------------------------------------- output ratio control */

/** Photos that carry their own ratio, i.e. ignore the project default. */
function overriddenItems() {
  return S.items.filter((i) => normalizeOverride(i.ratio));
}

/** Small three-action sheet built from the shared modal footer. */
function ratioChoiceDialog(opts) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve("cancel");
    const wrap = document.createElement("div");
    wrap.className = "bx-cdlg";
    wrap.innerHTML = `<div class="bx-cdlg-in" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <h3>${esc(opts.title)}</h3>
      <p>${esc(opts.body)}</p>
      ${modalFooterHtml({
        extra: { label: "Cancel", value: "cancel" },
        secondary: { label: "Apply To Photos Without Overrides", value: "keep" },
        primary: { label: "Apply To All Photos", value: "all" },
      })}
    </div>`;
    document.body.appendChild(wrap);
    paint();
    const done = (v) => {
      wrap.remove();
      resolve(v);
    };
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mfa]");
      if (b) return done(b.getAttribute("data-mfa"));
      if (e.target === wrap) done("cancel");
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape") done("cancel");
    });
    wrap.querySelector('[data-mfa="cancel"]')?.focus();
  });
}

/** Change the project default; never silently discard a per-photo override. */
async function setProjectRatio(next) {
  if (next === "__more") {
    openProjectRatioMore();
    return;
  }
  const ratio = normalizeOutputRatio(next);
  if (ratio === normalizeOutputRatio(S.outputRatio)) return;
  const overrides = overriddenItems();
  if (overrides.length) {
    const choice = await ratioChoiceDialog({
      title: "Update Photo Format?",
      body: "Some photos use a custom output ratio.",
    });
    if (choice === "cancel") return;
    if (choice === "all") overrides.forEach((i) => (i.ratio = null));
  }
  S.outputRatio = ratio;
  saveDraft();
  applyRatiosLive();
}

/**
 * Reshape the grid in place.
 *
 * A format change is a local visual update: no navigation, no remount, no
 * draft restoration, no scroll jump. Only the ratio classes, the header
 * selected state and the custom-format badges change.
 */
function applyRatiosLive() {
  if (typeof document === "undefined") return;
  const el = host();
  if (!el || !S) return;
  const project = normalizeOutputRatio(S.outputRatio);

  el.querySelectorAll(".rv-tile[data-k]").forEach((tile) => {
    const it = itemAt(tile.getAttribute("data-k"));
    if (!it) return;
    const want = tileRatioClass(it);
    RATIO_CLASSES.forEach((c) => tile.classList.toggle(c, c === want));
    /* The badge only exists while the photo genuinely overrides the project. */
    const frame = tile.querySelector(".rv-tile-th");
    const badge = tile.querySelector(".rv-tile-fmt");
    const override = normalizeOverride(it.ratio);
    if (override && !badge && frame) {
      const b = document.createElement("span");
      b.className = "rv-tile-fmt";
      b.title = "Custom format: " + ratioLabel(override);
      b.innerHTML = '<i data-lucide="crop"></i>' + esc(ratioLabel(override));
      frame.appendChild(b);
    } else if (override && badge) {
      badge.title = "Custom format: " + ratioLabel(override);
      badge.innerHTML = '<i data-lucide="crop"></i>' + esc(ratioLabel(override));
    } else if (!override && badge) {
      badge.remove();
    }
  });

  const add = el.querySelector(".rv-addcard");
  if (add) {
    const want = ratioClass(project);
    RATIO_CLASSES.forEach((c) => add.classList.toggle(c, c === want));
  }

  /* Header: the selected button can never disagree with the card shapes. */
  el.querySelectorAll("[data-ratio]").forEach((b) => {
    const on = b.getAttribute("data-ratio") === project;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const sel = el.querySelector("[data-ratiosel]");
  if (sel && sel.value !== project) sel.value = project;
  /* A ratio outside the three primaries shows as the compact custom chip. */
  if (!isPrimaryRatio(project)) renderHeaderFormat(el, project);
  paint();
}

/** Every entry point into the format control, rebound after a header swap. */
function bindRatioControls(el) {
  el.querySelectorAll("[data-ratio]").forEach((b) =>
    b.addEventListener("click", () => void setProjectRatio(b.getAttribute("data-ratio"))),
  );
  el.querySelectorAll("[data-ratiomore]").forEach((b) =>
    b.addEventListener("click", () => openProjectRatioMore()),
  );
  const ratioSel = el.querySelector("[data-ratiosel]");
  if (ratioSel) ratioSel.onchange = () => void setProjectRatio(ratioSel.value);
}

/** Re-render only the header format control (custom chip appears/disappears). */
function renderHeaderFormat(el, project) {
  const host_ = el.querySelector(".bx-fmtsel");
  if (!host_ || !host_.parentElement) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = formatSelectorHtml({
    label: "Photo Format",
    options: PRIMARY_OUTPUT_RATIOS,
    value: project,
    attr: "ratio",
    id: "rds-ratio",
    more: { label: "More Ratios", value: "__more" },
    customLabel: ratioLabel(project),
  });
  const next = wrap.firstElementChild;
  if (!next) return;
  host_.replaceWith(next);
  bindRatioControls(el);
}

/**
 * The ratios that stay out of the header: Original and the classic print
 * shapes. Chosen here, the header shows a compact "Custom:" chip instead of a
 * fourth button.
 */
function openProjectRatioMore() {
  if (typeof document === "undefined") return;
  const cur = normalizeOutputRatio(S.outputRatio);
  const wrap = document.createElement("div");
  wrap.className = "bx-cdlg";
  wrap.innerHTML = `<div class="bx-cdlg-in" role="dialog" aria-modal="true" aria-label="More Ratios">
    <h3>More Ratios</h3>
    <p>These apply to every photo that has no override of its own.</p>
    <div class="rv-seg wrap" style="margin:10px 0 4px">${MORE_OUTPUT_RATIOS.concat(
      PRIMARY_OUTPUT_RATIOS,
    )
      .map(
        (o) =>
          `<button type="button" class="${cur === o.id ? "on" : ""}" data-rdsmoreratio="${o.id}">${esc(
            o.note ? o.label + " " + o.note : o.label,
          )}</button>`,
      )
      .join("")}</div>
    ${modalFooterHtml({ primary: { label: "Done", value: "done" } })}
  </div>`;
  document.body.appendChild(wrap);
  paint();
  const close = () => wrap.remove();
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rdsmoreratio]");
    if (b) {
      close();
      void setProjectRatio(b.getAttribute("data-rdsmoreratio"));
      return;
    }
    if (e.target.closest("[data-mfa]") || e.target === wrap) {
      close();
      applyRatiosLive();
    }
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      applyRatiosLive();
    }
  });
}

/** Per-photo override, offered from the card menu and the canvas. */
function openRatioOverride(it) {
  if (typeof document === "undefined") return;
  const project = normalizeOutputRatio(S.outputRatio);
  const initial = normalizeOverride(it.ratio) || "";
  let pick = initial;
  const opts = [
    {
      id: "",
      label: "Use Project Format",
      note: "Currently " + ratioLabel(project),
      ratio: project,
    },
  ].concat(
    OUTPUT_RATIOS.map((o) => ({
      id: o.id,
      label: o.label,
      note: o.note || "Intrinsic",
      ratio: o.id,
    })),
  );
  const shape = (id) => {
    const a = ratioAspect(id);
    return `<span class="rdof-shape" aria-hidden="true"><span style="aspect-ratio:${a || "4 / 3"}"></span></span>`;
  };
  const cardHtml = (o) => {
    const on = pick === o.id;
    return `<button type="button" role="radio" aria-checked="${on ? "true" : "false"}" tabindex="${
      on ? "0" : "-1"
    }" class="rdof-card${on ? " on" : ""}" data-rdsratio="${esc(o.id)}">
      ${shape(o.ratio)}
      <span class="rdof-name">${esc(o.label)}</span>
      <span class="rdof-note">${esc(o.note)}</span>
      <i class="rdof-tick" data-lucide="check"></i>
    </button>`;
  };
  const wrap = document.createElement("div");
  wrap.className = "bx-cdlg";
  wrap.innerHTML = `<div class="bx-cdlg-in rdof-dlg" role="dialog" aria-modal="true" aria-labelledby="rdofTitle">
    <h3 id="rdofTitle">Override Photo Format</h3>
    <p>Use the project format or choose a different format for this photo.</p>
    <p class="rdof-meta">${esc(roomLabel(it) || "Photo")}${it.name ? " · " + esc(it.name) : ""}</p>
    <div class="rdof-grid" role="radiogroup" aria-label="Photo Format">${opts.map(cardHtml).join("")}</div>
    ${modalFooterHtml({
      extra: initial
        ? { label: "Reset To Project Format", value: "reset", variant: "ghost" }
        : null,
      secondary: { label: "Cancel", value: "cancel" },
      primary: { label: "Save Format", value: "save", disabled: true },
      alignment: initial ? "between" : "end",
    })}
  </div>`;
  document.body.appendChild(wrap);
  paint();
  const saveBtn = wrap.querySelector('[data-mfa="save"]');
  const close = () => wrap.remove();
  const commit = (v) => {
    it.ratio = v ? v : null;
    saveDraft();
    close();
    applyRatiosLive();
  };
  const syncPick = () => {
    wrap.querySelectorAll("[data-rdsratio]").forEach((b) => {
      const on = b.getAttribute("data-rdsratio") === pick;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    if (saveBtn) {
      const dirty = pick !== initial;
      saveBtn.disabled = !dirty;
      saveBtn.setAttribute("aria-disabled", dirty ? "false" : "true");
    }
  };
  syncPick();
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rdsratio]");
    if (b) {
      pick = b.getAttribute("data-rdsratio");
      syncPick();
      return;
    }
    const act = e.target.closest("[data-mfa]");
    if (act) {
      const v = act.getAttribute("data-mfa");
      if (v === "save") return commit(pick);
      if (v === "reset") return commit("");
      return close();
    }
    /* Outside click only closes when nothing is pending. */
    if (e.target === wrap && pick === initial) close();
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    const cards = Array.from(wrap.querySelectorAll("[data-rdsratio]"));
    const i = cards.indexOf(document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % cards.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + cards.length) % cards.length;
    if (next >= 0) {
      e.preventDefault();
      pick = cards[next].getAttribute("data-rdsratio");
      syncPick();
      cards[next].focus();
    }
  });
  const first = wrap.querySelector(".rdof-card.on") || wrap.querySelector(".rdof-card");
  if (first) first.focus();
}

function bindReview(el) {
  el.querySelectorAll("#rdsClose").forEach((b) => (b.onclick = exitAll));
  el.querySelector("#rdsBack").onclick = () => {
    /* Rooms is the first builder step, so Back returns to Studio. The draft,
       its photos, rooms and selections are saved on the way out. */
    const back = backFromPhotoStep(S.step);
    if (back.exit) {
      void saveExit();
      return;
    }
    saveDraft();
    S.step = back.step;
    render();
  };
  /* Same overflow menus as the video builder: a native <details> popover. */
  el.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      const act = b.getAttribute("data-act");
      el.querySelectorAll("details.rv-more[open]").forEach((d) => d.removeAttribute("open"));
      if (act === "all") {
        S.items.forEach((i) => (i.selected = true));
        saveDraft();
        syncSelection();
        return;
      }
      if (act === "none") {
        S.items.forEach((i) => (i.selected = false));
        saveDraft();
        syncSelection();
        return;
      }
      if (act === "room") {
        applyRoomToSelected(el.querySelector("#rdsSetRoom") || b);
        return;
      }
      if (act === "del") {
        removeSelected();
        return;
      }
      if (act === "moreratios") {
        openProjectRatioMore();
        return;
      }
    }),
  );
  bindRatioControls(el);
  bindAddress(el);

  /* Add Photos stays on this page: the picker adds straight into the grid. */
  const file = el.querySelector("#rdsFile");
  el.querySelector("#rdsMore").onclick = () => file && file.click();
  const addCard = el.querySelector("#rdsAddCard");
  if (addCard) addCard.onclick = () => file && file.click();
  if (file) {
    file.onchange = async () => {
      const raw = Array.from(file.files || []);
      file.value = "";
      /* Same validation the Studio picker applies: unsupported or oversized
         files never reach the grid. */
      const picked = [];
      for (const f of raw) {
        try {
          const norm = await normalizeImageFile(f);
          const why = typeof rejectReason === "function" ? rejectReason(norm) : null;
          if (why) {
            alert(norm.name + ": " + why);
            continue;
          }
          picked.push(norm);
        } catch (error) {
          alert(
            error instanceof Error ? error.message : f.name + ": This Photo Could Not Be Added.",
          );
        }
      }
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
    if (del) {
      e.stopPropagation();
      removeOne(del.getAttribute("data-del"));
      return;
    }
    const room = t.closest("[data-room]");
    if (room) {
      const it = S.items.find((i) => i.key === room.getAttribute("data-room"));
      if (!it) return;
      openRoomPopover(
        room,
        (label) => {
          it.room = label;
          it.roomSource = "manual";
          saveDraft();
          patchCard(it);
        },
        it.key,
      );
      return;
    }
    const open = t.closest("[data-open]");
    if (open) {
      openInCanvas(open.getAttribute("data-open"));
      return;
    }
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
    if (open) {
      e.preventDefault();
      openInCanvas(open.getAttribute("data-open"));
    }
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
  runBulkDesign(
    batch,
    { ...direction, outputRatio: normalizeOutputRatio(S.outputRatio) },
    {
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
            window.rdToast &&
              window.rdToast(
                `${failed} photo${failed === 1 ? "" : "s"} did not render. Retry them from the card.`,
              );
          } catch (_) {}
        }
      },
    },
  );
}

function startBulkDesign(list, reuseDirection) {
  if (!S || S.busy) return;
  const chosen = list && list.length ? list : S.items.filter((i) => i.selected);
  const items = chosen.filter((i) => i.status !== "uploading");
  if (!items.length) {
    /* Silently doing nothing looked like a broken button while photos saved. */
    cmToast(
      chosen.length
        ? "Still Saving Your Photos. Try Again In A Moment."
        : "Select At Least One Photo First.",
    );
    return;
  }
  if (reuseDirection && S.direction) {
    runBatch(items, S.direction);
    return;
  }
  openBulkDesign({
    items,
    /* Read live, so the confirmation summary always shows what will render. */
    ratio: () => normalizeOutputRatio(S.outputRatio),
    /* Only what the user chose in this project, never a demo default. */
    settings: S.bulkSettings || null,
    onSettingsChange: (s) => {
      S.bulkSettings = s;
    },
    onEdit: () => {
      S.step = "review";
      render();
    },
    /* Inline three-option format control inside the modal — no stacked modal. */
    onRatioChange: (id) => {
      void setProjectRatio(id);
    },
    onStart: (batch, direction) => runBatch(batch, direction),
  });
}

function applyRoomToSelected(anchor) {
  const sel = S.items.filter((i) => i.selected);
  if (!sel.length || !anchor) return;
  openRoomPopover(
    anchor,
    (label) => {
      /* Several photos change at once, so the user confirms the scope first. */
      if (
        sel.length > 1 &&
        !window.confirm(`Apply “${label}” to ${sel.length} selected photos?`)
      )
        return;
      sel.forEach((i) => {
        i.room = label;
        i.roomSource = "manual";
      });
      saveDraft();
      sel.forEach(patchCard);
      syncSelection();
      try {
        window.rdToast &&
          window.rdToast(
            sel.length > 1
              ? `${label} Applied To ${sel.length} Photos`
              : `${label} Applied To 1 Photo`,
          );
      } catch (_) {}
    },
    null,
    sel.length > 1
      ? `Applies to ${sel.length} selected photos`
      : "Applies to the selected photo",
  );
}


function removeOne(key) {
  const it = S.items.find((i) => i.key === key);
  if (!it) return;
  if (
    !window.confirm(
      "Remove “" + it.name + "” from this project? The original photo stays in your library.",
    )
  )
    return;
  try {
    URL.revokeObjectURL(it.previewUrl);
  } catch (_) {}
  S.items = S.items.filter((i) => i.key !== key);
  if (!S.items.length) S.step = "add";
  saveDraft();
  render();
}

/* ------------------------------------------------- shared card overflow menu
   Photo Design cards and Video scene cards use the same component; only the
   action list and these handlers differ. Every action here works on the
   project's reference to a photo — the uploaded media file itself is only ever
   touched by "Delete From Media". */

const cmToast = (m) => {
  try {
    window.rdToast ? window.rdToast(m) : console.log(m);
  } catch (_) {}
};

function itemAt(key) {
  return S && S.items ? S.items.find((i) => i.key === key) : null;
}

function insertAfter(it, clone) {
  const i = S.items.findIndex((x) => x.key === it.key);
  S.items.splice(i < 0 ? S.items.length : i + 1, 0, clone);
}

/** A duplicate is a second project reference to the same stored photo. */
function duplicateItem(it, extra) {
  const clone = {
    ...it,
    ...(extra || {}),
    key: "p" + Math.random().toString(36).slice(2, 9),
    file: null,
    selected: true,
    done: false,
    state: "none",
    resultPath: null,
    resultUrl: null,
    err: "",
  };
  insertAfter(it, clone);
  saveDraft();
  render();
  return clone;
}

async function originalUrl(it) {
  if (!it) return null;
  try {
    return await resolveItemUrl(it);
  } catch (_) {}
  return it.signed || it.previewUrl || null;
}

function dropItem(key) {
  const i = S.items.findIndex((x) => x.key === key);
  if (i < 0) return null;
  const [gone] = S.items.splice(i, 1);
  if (!S.items.length) S.step = "add";
  saveDraft();
  render();
  return { gone, i };
}

/* A card whose image cannot be resolved offers "Replace Photo"; route that
   straight into the existing replace flow. */
if (typeof document !== "undefined" && !window.__rdPhotoReplaceBound) {
  window.__rdPhotoReplaceBound = true;
  document.addEventListener("rd-photo-replace", (e) => {
    const key = e?.detail?.key;
    if (!key) return;
    /* The card's own menu button records which builder owns the card. */
    const card = e.target?.closest?.("[data-k],[data-key],[data-asset]");
    const flow = card?.querySelector?.("[data-cardflow]")?.getAttribute("data-cardflow") || "photo";
    runCardAction(flow, "replace", key);
  });
}

registerCardMenu("photo", {
  items(key) {
    const it = itemAt(key);
    if (!it) return [];
    const stored = !!it.path;
    /* An unavailable photo only offers the actions that do not need a usable
       image; everything else returns automatically once it loads. */
    if (photoFailureKind(key))
      return failedCardMenuGroups({ flow: "photo", key, hasMedia: stored });

    const hasOriginal = stored || !!it.previewUrl;
    const hasDesign = !!it.resultPath;
    const dl = hasDesign
      ? {
          action: "download",
          label: "Download",
          icon: "download",
          children: [
            { action: "download", label: "Download Original", icon: "image" },
            { action: "downloadlatest", label: "Download Latest Design", icon: "sparkles" },
          ],
        }
      : { action: "download", label: "Download", icon: "download", hidden: !hasOriginal };
    return [
      { items: [{ action: "open", label: "Open Canvas", icon: "wand-sparkles" }] },
      {
        items: [
          {
            action: "duplicate",
            label: "Duplicate",
            icon: "copy",
            disabled: !stored,
            note: stored ? "" : "Saving…",
          },
          { action: "replace", label: "Replace Photo", icon: "image-plus" },
          { action: "room", label: "Change Room Type", icon: "door-open" },
          {
            action: "ratio",
            label: normalizeOverride(it.ratio)
              ? "Override Format · " + ratioLabel(it.ratio)
              : "Override Format",
            icon: "crop",
          },
        ],
      },
      {
        items: [
          {
            action: "tovideo",
            label: "Create Video",
            icon: "clapperboard",
            disabled: !stored,
            note: stored ? "" : "Saving…",
          },
          dl,
        ],
      },
      { items: [{ action: "removeproj", label: "Remove From Project", icon: "circle-minus" }] },
      {
        danger: true,
        items: [
          {
            action: "deletemedia",
            label: "Delete From Media",
            icon: "trash-2",
            danger: true,
            disabled: !stored,
            note: stored ? "" : "Saving…",
          },
        ],
      },
    ];
  },

  async run(action, key) {
    const it = itemAt(key);
    if (!it) return;
    if (action === "retryload") {
      if (!retryPhotoCard(key)) render();
      return;
    }
    if (action === "faildetails")
      return void detailsDialog({
        title: "Photo Details",
        rows: failureDetailRows({ key, name: it.name, hasMedia: !!it.path }),
      });
    if (action === "open") return void openInCanvas(key);

    if (action === "duplicate") {
      duplicateItem(it);
      return cmToast("Photo Duplicated In This Project.");
    }
    if (action === "variation") {
      const clone = duplicateItem(it, {
        variationOf: it.key,
        room: it.room,
        roomSource: it.roomSource,
      });
      cmToast("New Variation Added. Your Saved Versions Are Untouched.");
      return void openInCanvas(clone.key);
    }
    if (action === "ratio") return void openRatioOverride(it);
    if (action === "room") {
      const btn = document.querySelector(
        '.rv-tile[data-k="' + (window.CSS?.escape ? CSS.escape(key) : key) + '"] [data-room]',
      );
      if (btn) btn.click();
      return;
    }
    if (action === "tovideo") {
      setHandoff({
        target: "video",
        origin: "studio",
        propertyId: S.propertyId || null,
        propertyAddress: S.address || null,
        assets: [{ path: it.path, name: it.name, room: it.room || null }],
      });
      /* Route through the shell so this counts as one intentional
         navigation instead of a raw hash write the router has to react to. */
      try {
        (window as any).__rdNewVideo && (window as any).__rdNewVideo();
      } catch (_) {}
      goApp("lvideo");
      return void cmToast("Sent To The Video Builder.");
    }
    if (action === "versions") {
      await openInCanvas(key);
      return void cmToast("Version History Is In The Canvas Panel.");
    }
    if (action === "download") {
      const url = await originalUrl(it);
      return void downloadOriginal(url, it.name || "photo.jpg");
    }
    if (action === "downloadlatest") {
      let url = it.resultUrl || null;
      if (!url && it.resultPath) url = await photoSrc(it.resultPath).catch(() => null);
      if (!url) return void cmToast("That Design Is Not Ready Yet.");
      return void downloadOriginal(url, "design-" + (it.name || "photo.jpg"));
    }

    if (action === "details") {
      const url = await originalUrl(it);
      const dims = await new Promise((res) => {
        if (!url) return res("");
        const img = new Image();
        img.onload = () => res(img.naturalWidth + " x " + img.naturalHeight + " px");
        img.onerror = () => res("");
        img.src = url;
      });
      return void detailsDialog({
        title: "Photo Details",
        rows: [
          ["File", it.name || "Photo"],
          ["Property", S.address || "Not Assigned"],
          ["Room Type", it.room || "Not Set"],
          ["Added", new Date(it.addedAt || Date.now()).toLocaleString()],
          ["Dimensions", dims],
          ["Versions", it.resultPath ? "1 Saved Design" : "No Saved Designs Yet"],
        ],
      });
    }
    if (action === "replace") {
      const ok = await confirmDialog({
        title: "Replace This Photo?",
        body: "This card keeps its position and property, but points at a new source photo.",
        notes: it.resultPath
          ? [
              "Designs already generated from the old photo stay in Media and are no longer shown on this card.",
            ]
          : [],
        confirmLabel: "Choose Photo",
      });
      if (!ok) return;
      const file = await pickOneImage();
      if (!file) return;
      try {
        const norm = await normalizeImageFile(file);
        const path = await uploadRoomPhoto(norm || file);
        it.path = path;
        it.name = (norm || file).name || it.name;
        it.signed = await roomPhotoUrl(path).catch(() => null);
        it.previewUrl = it.signed || it.previewUrl;
        it.status = "ready";
        it.state = "none";
        it.resultPath = null;
        it.resultUrl = null;
        saveDraft();
        render();
        cmToast("Photo Replaced.");
      } catch (e) {
        cmToast(e?.message || "That photo could not be replaced.");
      }
      return;
    }
    if (action === "removeproj") {
      const res = dropItem(key);
      if (!res) return;
      return void undoToast("Removed From This Project. The Photo Stays In Media.", () => {
        S.items.splice(Math.min(res.i, S.items.length), 0, res.gone);
        if (S.step === "add" && S.items.length) S.step = "review";
        saveDraft();
        render();
      });
    }
    if (action === "deletemedia") {
      const uses = S.items.filter((x) => x.path && x.path === it.path).length;
      const ok = await confirmDialog({
        title: "Delete This Photo From Media?",
        body: "This permanently removes the source photo from Media. It may also become unavailable in other drafts. Completed exports will remain unchanged.",
        notes:
          uses > 1
            ? [
                "This photo is used by " +
                  uses +
                  " cards in this project. All of them will be removed.",
              ]
            : [],
        confirmLabel: "Delete Photo",
        danger: true,
      });
      if (!ok) return;
      const path = it.path;
      try {
        await deleteRoomPhoto(path);
      } catch (e) {
        return void cmToast(e?.message || "That photo could not be deleted.");
      }
      S.items = S.items.filter((x) => x.path !== path);
      if (!S.items.length) S.step = "add";
      saveDraft();
      render();
      cmToast("Photo Deleted From Media.");
    }
  },
});

function removeSelected() {
  const gone = S.items.filter((i) => i.selected);
  if (!gone.length) return;
  const msg =
    gone.length === 1
      ? "Remove 1 photo from this project? The original photo stays in your library."
      : "Remove " + gone.length + " photos from this project? The originals stay in your library.";
  if (!window.confirm(msg)) return;
  gone.forEach((i) => {
    try {
      URL.revokeObjectURL(i.previewUrl);
    } catch (_) {}
  });
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
  /* stateOf() returns null once a room is settled, so read it defensively and
     treat a missing room type as the real blocker. */
  const unsure = sel.filter((i) => !String(i.room || "").trim() || stateOf(i)?.cls === "warn");
  if (unsure.length) {
    window.alert(
      "Set a room type for every selected photo first. " + unsure.length + " still need one.",
    );
    return;
  }
  saveDraft();
  /* Continue advances the bulk workflow: it opens the shared design-direction
     interface for every selected photo. It never routes into the single-photo
     Studio canvas — that is an explicit per-result action. */
  startBulkDesign(sel);
}

/* ------------------------------------------------------ property address
   Optional on every staging project. The address never renames the project
   and can be cleared again from the same modal. */
let PROPS = null;
let addrTimer = null;

/** Load the workspace's properties once so the field can suggest addresses. */
async function loadProps() {
  if (PROPS) return PROPS;
  try {
    PROPS = await listMediaProperties();
  } catch (_) {
    PROPS = [];
  }
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
      addrTimer = setTimeout(() => {
        saveDraft();
        void lookupAddress();
      }, 700);
    });
  }
  el.querySelectorAll("[data-addr-use]").forEach(
    (b) =>
      (b.onclick = () => {
        S.propertyId = b.getAttribute("data-addr-use");
        S.address = (S.addressMatch && S.addressMatch.address) || S.address;
        applyAddress(S, S.address, "existing_property");
        S.addressMatch = null;
        saveDraft();
        render();
      }),
  );
  el.querySelectorAll("[data-addr-sep]").forEach(
    (b) =>
      (b.onclick = () => {
        S.addressMatchDismissed = true;
        S.propertyId = null;
        saveDraft();
        render();
      }),
  );
  el.querySelectorAll("[data-addr-retry]").forEach((b) => (b.onclick = () => retryDraftSave()));
}

/** Offer the existing property instead of quietly creating a duplicate. */
async function lookupAddress() {
  const text = cleanAddressText(S.address);
  if (text.length < 8 || S.propertyId) {
    S.addressMatch = null;
    return;
  }
  try {
    const res = await matchPropertyAddress({ data: { address: text } });
    if (!S) return;
    S.addressMatch = (res && res.match) || null;
    if (S.addressMatch) render();
  } catch (_) {}
}
async function openAddressEditor() {
  if (!PROPS) {
    try {
      PROPS = await listMediaProperties();
    } catch (_) {
      PROPS = [];
    }
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
        return (PROPS || []).filter(
          (p) =>
            !q ||
            String(p.address || "")
              .toLowerCase()
              .includes(String(q).toLowerCase()),
        );
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
  document
    .querySelectorAll('.bx-room[aria-expanded="true"]')
    .forEach((b) => b.setAttribute("aria-expanded", "false"));
  if (S && S.activeKey) {
    const prev = S.activeKey;
    S.activeKey = null;
    const it = S.items.find((i) => i.key === prev);
    if (it) syncCard(it);
  }
}

function openRoomPopover(anchor, onPick, key, scopeHint) {
  closePopover();
  if (anchor && anchor.setAttribute) anchor.setAttribute("aria-expanded", "true");
  popover = document.createElement("div");
  popover.className = "rds-pop";
  popover.innerHTML =
    (scopeHint ? `<div class="rds-pop-scope">${esc(scopeHint)}</div>` : "") +
    `<div class="rds-pop-s"><i data-lucide="search"></i><input id="rdsSearch" placeholder="Search Rooms" aria-label="Search rooms"></div><div class="rds-pop-l" id="rdsList"></div>`;

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
                  .map(
                    (r2) =>
                      `<button class="rds-opt" data-label="${esc(r2.label)}"><i data-lucide="${r2.icon}"></i>${esc(r2.label)}</button>`,
                  )
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

export type StudioContext =
  { type: "generic" } | { type: "photo-design-canvas"; draftId: string; photoKey: string };

export type PhotoCanvasHandoff = {
  draftId: string;
  photoKey: string;
  assetPath?: string | null;
  roomType?: string | null;
  propertyId?: string | null;
  propertyAddress?: string | null;
};

/**
 * The one way into a Photo Design Canvas. It sets an explicit Studio context
 * and routes through the shell's navigation on the canonical #v-studio route,
 * so no generic Studio startup logic (source chooser, new project, source
 * reset) can run against the photo the user just opened.
 */
export function openPhotoDesignCanvas(ctx: PhotoCanvasHandoff): StudioContext {
  const open = (window as any).__rdOpenPhotoCanvas;
  if (typeof open === "function") {
    return open({ draftId: ctx.draftId, photoKey: ctx.photoKey }) as StudioContext;
  }
  /* No shell yet (tests, cold boot): still land on the canonical route. */
  try {
    if (location.hash !== "#v-studio") location.hash = "#v-studio";
  } catch (_) {}
  return { type: "photo-design-canvas", draftId: ctx.draftId, photoKey: ctx.photoKey };
}

/** The canvas only walks the photos the user chose on Review Rooms. */
function designSet() {
  const sel = ordered().filter((i) => i.selected);
  return sel.length ? sel : ordered();
}

function idxOf(key) {
  return designSet().findIndex((i) => i.key === key);
}

/**
 * Resolve a photo to a currently valid URL. The storage path is the source of
 * truth: a remembered signed URL is only reused while it is still fresh.
 */
export async function resolveItemUrl(it: any): Promise<string | null> {
  if (!it) return null;
  if (it.path) {
    if (it.signed && !photoSrcStale(it.path)) return it.signed;
    const url = await photoSrc(it.path);
    if (url) {
      it.signed = url;
      return url;
    }
    return it.previewUrl || null;
  }
  return it.signed || it.previewUrl || null;
}

/** Loading / failure feedback on the card the user just clicked. */
function markCardLoading(key, state: "loading" | "failed" | "") {
  const card = document.querySelector('.rv-tile[data-k="' + key + '"]') as HTMLElement | null;
  if (!card) return;
  card.classList.toggle("is-loading", state === "loading");
  card.classList.toggle("is-failed", state === "failed");
  card.querySelector(".rv-tile-fail")?.remove();
  if (state === "failed") {
    card.insertAdjacentHTML(
      "beforeend",
      `<span class="rv-tile-fail" role="status">Image unavailable — <button type="button" data-tile-retry>Retry</button></span>`,
    );
    const retry = card.querySelector("[data-tile-retry]") as HTMLButtonElement | null;
    if (retry)
      retry.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        void openInCanvas(key);
      };
  }
}

/* One open at a time: a slower earlier resolve can never overwrite the photo
   the user has since clicked, and re-clicking the same photo does nothing. */
const canvasOpens = createOpenStore();
let canvasEntry: CanvasEntry | null = null;

/** The context of the photo currently on the Canvas, for Back and refresh. */
export function currentCanvasEntry(): CanvasEntry | null {
  return canvasEntry;
}

async function openInCanvas(key) {
  const it = S.items.find((i) => i.key === key);
  if (!it) return;
  const token = beginCanvasOpen(canvasOpens, key);

  /* Resolve first: the Photos page stays visible until a real source exists,
     so the Canvas never opens onto an empty gray frame. */
  markCardLoading(key, "loading");
  const url = await resolveItemUrl(it);
  /* A newer photo won this race — drop this result silently. */
  if (!canvasOpenIsCurrent(canvasOpens, token, key)) return;
  markCardLoading(key, url ? "" : "failed");
  /* A failed resolve is recoverable: stay on Photos, offer Retry. Never
     redirect and never clear the stored path. */
  if (!url) return;

  S.current = key;
  rememberCanvasOpen(key);
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

  try {
    window.rdPendingPhotoPath = it.path || null;
  } catch (_) {}
  try {
    window.rdSetStudioSource &&
      window.rdSetStudioSource("user_upload", url, it.room || "Your uploaded source", {
        caption: "Set your direction, then press Generate. Nothing has been generated yet.",
        srcPath: it.path || null,
        ratio: tileRatio(it),
      });
  } catch (_) {}
  applyRoom(it);
  /* Everything the Canvas needs to survive a refresh or a Back trip. */
  canvasEntry = canvasEntryFrom({
    photoKey: key,
    draftId: (S && S.id) || "",
    propertyId: (S && S.propertyId) || null,
    roomType: it.room || null,
    sourcePath: it.path || null,
    sourceUrl: url,
    workflow: "photo-design",
    returnTo: "staging",
  });
  try {
    (window as any).__rdCanvasEntry = canvasEntry;
  } catch (_) {}
  /* Never touch location.hash here. A raw hash write routes through the
     generic Studio branch, which re-initialises a blank session and throws
     the Canvas away. Open an explicit Photo Design Canvas context instead. */
  openPhotoDesignCanvas({
    draftId: (S && S.id) || "",
    photoKey: key,
    assetPath: it.path || null,
    roomType: it.room || null,
    propertyId: (S && S.propertyId) || null,
    propertyAddress: (S && S.address) || null,
  });
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

/**
 * One shared source of truth for a photo's room, keyed by its stable id.
 * Changing the room inside Canvas updates the header, the filmstrip label,
 * the Photos card, the bulk grouping and the saved draft in one pass.
 */
export function setPhotoRoom(key: string, room: string) {
  if (!S) return;
  const it = S.items.find((i) => i.key === key);
  if (!it || !room) return;
  if (it.room === room) return;
  it.room = room;
  it.space = roomSpace(room);
  try {
    drawStrip();
  } catch (_) {}
  try {
    saveDraft();
  } catch (_) {}
}

/** Canvas room / space controls write straight back to the shared item. */
function bindCanvasRoomSync() {
  const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
  if (!sel || (sel as any).__rdRoomSync) return;
  (sel as any).__rdRoomSync = true;
  sel.addEventListener("change", () => {
    if (!S || !S.current) return;
    const room = (sel.value || sel.options[sel.selectedIndex]?.text || "").trim();
    if (!room) return;
    setPhotoRoom(S.current, room);
    /* Space Type follows the room, so Exterior + Kitchen can never happen. */
    try {
      const chip = document.querySelector(
        '#spChips .chip[data-sp="' + roomSpace(room) + '"]',
      ) as HTMLElement | null;
      if (chip && !chip.classList.contains("on")) chip.click();
    } catch (_) {}
  });
}

function removeStrip() {
  if (strip) strip.remove();
  strip = null;
  /* Every listener the canvas adds has a matching removal, so re-opening
     photo after photo can never stack duplicates. */
  try {
    window.removeEventListener("hashchange", stripGuard);
  } catch (_) {}
  try {
    closeCanvasMenu?.();
  } catch (_) {}
  closeCanvasMenu = null;
  /* Defensive: only ever one header in the document. */
  document.querySelectorAll("#rdsCanvasHead").forEach((n) => n.remove());
  document.querySelectorAll(".rds-strip").forEach((n) => n.remove());
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
  head.innerHTML = `<div class="rds-chead-l">
      <button class="rds-chead-b" id="rdsAllRooms"><i data-lucide="chevron-left"></i>Back to All Photos</button>
    </div>
    <span class="rds-chead-div" aria-hidden="true"></span>
    <div class="rds-chead-c">
      <span class="rds-chead-t" id="rdsCanvasTitle"></span>
      <span class="rds-chead-s" id="rdsCanvasPos"></span>
      <span class="rds-chead-save" id="rdsCanvasSave"></span>
    </div>
    <div class="rds-chead-r">
      <button class="rds-chead-i" id="rdsHeadPrev" title="Previous Photo" aria-label="Previous Photo"><i data-lucide="chevron-left"></i></button>
      <button class="rds-chead-i" id="rdsHeadNext" title="Next Photo" aria-label="Next Photo"><i data-lucide="chevron-right"></i></button>
      <div class="rds-cmenu-wrap">
        <button class="rds-chead-i" id="rdsCanvasMore" title="More Options" aria-label="More Options" aria-haspopup="menu" aria-expanded="false"><i data-lucide="ellipsis-vertical"></i></button>
        <div class="rds-cmenu" id="rdsCanvasMenu" role="menu" hidden>
          <button role="menuitem" id="rdsClose"><i data-lucide="arrow-left"></i>Return to Photos</button>
          <button role="menuitem" class="danger" id="rdsResetDesign"><i data-lucide="rotate-ccw"></i>Reset This Design…</button>
        </div>
      </div>
    </div>`;
  if (view && board) view.insertBefore(head, board);

  strip = document.createElement("div");
  strip.className = "rds-strip";
  if (view && board && board.nextSibling) view.insertBefore(strip, board.nextSibling);
  else if (view) view.appendChild(strip);
  else document.body.appendChild(strip);

  /* Autosave already persists every edit, so the menu only navigates. */
  const backToPhotos = () => {
    markCurrentDone();
    saveDraft();
    reopenStaging();
  };
  bindCanvasMenu(head, backToPhotos);
  const back = head.querySelector("#rdsAllRooms");
  if (back) (back as HTMLButtonElement).onclick = backToPhotos;
  paintCanvasSave();
  bindCanvasRoomSync();

  drawStrip();
  window.addEventListener("hashchange", stripGuard);
}

/** Mirror the autosave state next to the canvas header. */
function paintCanvasSave() {
  const node = document.getElementById("rdsCanvasSave");
  if (!node || !S) return;
  const st = S.saveState;
  /* "Saved" must say WHAT is saved: an uploaded source is not a design. */
  const cur = S.items.find((i) => i.key === S.current);
  const hasDesign = !!(cur && (cur.resultPath || cur.resultUrl));
  const designStored = !!(cur && cur.resultPath);
  const label =
    st === "saving"
      ? hasDesign
        ? "Saving Design…"
        : "Saving…"
      : st === "error"
        ? (hasDesign ? "Design Not Saved" : "Save Failed") + " — Retry Save"
        : st === "saved"
          ? hasDesign
            ? designStored
              ? "Design Saved"
              : "Design Not Saved"
            : "Source Saved"
          : "";
  const bad = st === "error" || (st === "saved" && hasDesign && !designStored);
  node.textContent = label;
  node.className = "rds-chead-save" + (bad ? " bad" : st === "saved" ? " ok" : "");
  node.style.display = label ? "" : "none";
  (node as HTMLElement).onclick = bad ? () => retryDraftSave() : null;
}

/* The canvas overflow menu: anchored under its trigger, right aligned, and
   dismissed by outside click, Escape, a route change or any chosen action.
   Every document listener is removed the moment the menu closes. */
let closeCanvasMenu: ((focus?: boolean) => void) | null = null;

function bindCanvasMenu(head, backToPhotos) {
  const trigger = head.querySelector("#rdsCanvasMore") as HTMLButtonElement | null;
  const menu = head.querySelector("#rdsCanvasMenu") as HTMLElement | null;
  if (!trigger || !menu) return;
  const onDoc = (e) => {
    if (!head.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close(true);
  };
  const onHash = () => close();
  const detach = () => {
    document.removeEventListener("click", onDoc);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", onHash);
  };
  const close = (focus?: boolean) => {
    detach();
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focus) trigger.focus();
  };
  closeCanvasMenu = close;
  trigger.onclick = (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    detach();
    if (open) {
      document.addEventListener("click", onDoc);
      document.addEventListener("keydown", onKey);
      window.addEventListener("hashchange", onHash);
    }
  };
  const ret = head.querySelector("#rdsClose") as HTMLButtonElement | null;
  if (ret)
    ret.onclick = () => {
      close();
      backToPhotos();
    };
  const reset = head.querySelector("#rdsResetDesign") as HTMLButtonElement | null;
  if (reset)
    reset.onclick = () => {
      close(true);
      openResetDesign(trigger);
    };
}

/** Reset only the photo currently on the canvas — never the whole project. */
function openResetDesign(returnFocusTo?: HTMLElement | null) {
  const host = document.querySelector(".rd-app") || document.body;
  let m = document.getElementById("rdsResetModal");
  if (m) m.remove();
  m = document.createElement("div");
  m.id = "rdsResetModal";
  m.className = "up-modal on";
  m.innerHTML = `<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" aria-labelledby="rdsResetTitle" aria-describedby="rdsResetDesc">
    <h3 id="rdsResetTitle">Reset This Design?</h3>
    <p id="rdsResetDesc">This removes the current photo’s unsaved design settings and generated drafts. The original uploaded photo and the other photos will remain unchanged.</p>
    <div class="up-act">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-danger" id="rdsResetGo"><i data-lucide="rotate-ccw"></i>Reset Design</button>
    </div></div>`;
  host.appendChild(m);
  const focusables = () =>
    Array.from(
      m!.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      shut();
      return;
    }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const shut = () => {
    document.removeEventListener("keydown", onKey, true);
    m && m.remove();
    try {
      returnFocusTo?.focus();
    } catch (_) {}
  };
  document.addEventListener("keydown", onKey, true);
  m.addEventListener("click", (e: any) => {
    if (e.target.closest && e.target.closest("[data-close]")) shut();
  });
  try {
    (m.querySelector("#rdsResetGo") as HTMLElement | null)?.focus();
  } catch (_) {}
  const go = m.querySelector("#rdsResetGo") as HTMLButtonElement | null;
  if (go)
    go.onclick = () => {
      shut();
      try {
        (window as any).rdResetCanvasDesign && (window as any).rdResetCanvasDesign();
      } catch (_) {}
      const cur = S && S.items.find((i) => i.key === S.current);
      if (cur) {
        cur.state = "none";
        cur.done = false;
        cur.err = "";
        cur.resultUrl = null;
        cur.resultPath = null;
        saveDraft();
        drawStrip();
      }
    };
  paint();
}

/** Navigate through the app shell; a bare hash write is the fallback only. */
function goApp(view) {
  try {
    const fn = (window as any).__rdGo;
    if (typeof fn === "function") {
      fn(view);
      return;
    }
  } catch (_) {}
  try {
    location.hash = "#v-" + view;
  } catch (_) {}
}

/** True while the canonical Studio route is showing this Photo Design Canvas. */
function onCanvasRoute() {
  try {
    const isView = (window as any).__rdIsView;
    if (typeof isView === "function") return !!isView("studio");
  } catch (_) {}
  /* Migration fallback: accept both the canonical and the legacy hash. */
  const raw = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
  return raw === "studio";
}

function stripGuard() {
  if (!strip) return;
  const onStudio = onCanvasRoute();
  strip.classList.toggle("hide", !onStudio);
  const head = document.getElementById("rdsCanvasHead");
  if (head) head.classList.toggle("hide", !onStudio);
}

/** Human room label for a photo; raw filenames never reach the canvas UI. */
function roomLabel(it) {
  const r = String((it && it.room) || "").trim();
  return r || "Unassigned Room";
}

function drawStrip() {
  if (!strip || !S) return;
  const list = designSet();
  const i = list.findIndex((x) => x.key === S.current);
  const cur = i >= 0 ? list[i] : null;
  const nxt = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const title = document.getElementById("rdsCanvasTitle");
  if (title) title.textContent = cur ? roomLabel(cur) : "";
  const pos = document.getElementById("rdsCanvasPos");
  if (pos) pos.textContent = cur && list.length > 1 ? `Photo ${i + 1} of ${list.length}` : "";

  strip.innerHTML = `<button class="rds-strip-i" id="rdsPrev" aria-label="Previous room" ${i <= 0 ? "disabled" : ""}><i data-lucide="chevron-left"></i></button>
    <div class="rds-strip-l">${list
      .map((x) => {
        const ws = workState(x);
        return `<button class="rds-strip-t${x.key === S.current ? " on" : ""}${ws ? " ws-" + ws.cls : ""}" data-go="${x.key}" title="${esc(x.room || x.name)}">
            <img${imgAttrs(x)} alt="${esc(x.name)}">
            ${ws ? `<i data-lucide="${ws.icon}"></i>` : ""}
            <em>${esc(roomLabel(x))}</em></button>`;
      })
      .join("")}</div>
    <button class="rds-strip-i" id="rdsNext" aria-label="Next room" ${i < 0 || i >= list.length - 1 ? "disabled" : ""}><i data-lucide="chevron-right"></i></button>
    ${cur && cur.done && nxt ? `<button class="rds-strip-n" id="rdsNextRoom">Next Room<i data-lucide="arrow-right"></i></button>` : ""}
    <button class="rds-strip-i" id="rdsStripX" aria-label="Close the photo set"><i data-lucide="x"></i></button>`;

  paint();
  /* Thumbnails follow their storage path, so an expired signed URL re-signs
     in place instead of leaving blank frames in the filmstrip. */
  mountPhotoImages(strip);
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
  /* Same in-place photo switch from the page-level header toolbar. */
  const hp = document.getElementById("rdsHeadPrev") as HTMLButtonElement | null;
  const hn = document.getElementById("rdsHeadNext") as HTMLButtonElement | null;
  if (hp) {
    hp.disabled = i <= 0;
    hp.onclick = () => step(-1);
  }
  if (hn) {
    hn.disabled = i < 0 || i >= list.length - 1;
    hn.onclick = () => step(1);
  }
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
  window.rdStaging = {
    open: openStagingReview,
    reopen: reopenStaging,
    has: hasStagingSession,
    resume: resumeStagingDraft,
    ensure: ensureStagingView,
    mount: mountStagingView,
    detach: detachStagingView,
  };
} catch (_) {}
