/**
 * Declutter controls.
 *
 * One section inside the existing Canvas settings panel owns everything the
 * Declutter tool needs: the mode picker, the free detection list with Keep /
 * Remove decisions, the brush-and-erase mask with undo and redo, the Empty
 * Room confirmation, the review screen shown before any credit is spent, the
 * post-generation report and the property-wide batch dialog.
 *
 * Nothing here decides money or prompts: it only reads and writes the state
 * that @/lib/declutter-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  CLUTTER_CATEGORIES,
  DECLUTTER_MODES,
  EMPTY_ROOM_CONFIRM,
  EMPTY_ROOM_WARNING,
  MASK_SUPPORT,
  applyModeSelection,
  categoryLabel,
  declutterCostSentence,
  declutterMode,
  emptyMask,
  maskRegions,
  pushStroke,
  redoStroke,
  restoreItem,
  undoStroke,
  type DeclutterBrief,
  type DeclutterModeId,
  type Detection,
  type MaskState,
  type QualityReport,
  type RoomRead,
  type StrokeKind,
} from "@/lib/declutter-brief";

const byId = (id: string) => document.getElementById(id);

function icons() {
  try {
    createIcons({ icons: lucideIcons });
  } catch (_) {
    /* icons are cosmetic */
  }
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

/* --------------------------------------------------------------- state */

const state = {
  detections: [] as Detection[],
  room: null as RoomRead | null,
  detecting: false,
  error: null as string | null,
  mask: emptyMask() as MaskState,
  brush: "remove" as StrokeKind,
  brushSize: 0.06,
  painting: false,
  /** Keep decisions the user made by hand, reused across variations. */
  keepLocked: new Set<string>(),
};

let onChangeCb: (() => void) | null = null;
let onDetectCb: (() => void) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints on its own next tick */
  }
}

export function declutterDetections(): Detection[] {
  return state.detections.map((d) => ({ ...d }));
}

export function declutterMask(): MaskState {
  return { ...state.mask, strokes: state.mask.strokes.slice(), redo: state.mask.redo.slice() };
}

export function declutterRoomRead(): RoomRead | null {
  return state.room;
}

export function hasDeclutterDetections(): boolean {
  return state.detections.length > 0;
}

export function resetDeclutter() {
  state.detections = [];
  state.room = null;
  state.detecting = false;
  state.error = null;
  state.mask = emptyMask();
  state.keepLocked.clear();
  paintDetections();
  paintMask();
  paintSummary();
}

export function setDeclutterDetecting(on: boolean, error?: string | null) {
  state.detecting = on;
  state.error = error ?? null;
  paintDetections();
}

export function setDeclutterDetections(detections: Detection[], room: RoomRead | null) {
  state.room = room;
  state.detecting = false;
  state.error = null;
  state.detections = applyModeSelection(detections, readDeclutterMode(), Array.from(state.keepLocked));
  paintDetections();
  paintMask();
  change();
}

/* --------------------------------------------------------------- panel */

export function mountDeclutterPanel(opts?: { onChange?: () => void; onDetect?: () => void }) {
  onChangeCb = opts?.onChange || null;
  onDetectCb = opts?.onDetect || null;
  if (byId("rdDeclSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdDeclSec";
  sec.className = "rd-decl";
  sec.hidden = true;
  sec.innerHTML =
    /* mode */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Declutter Mode</b></div>' +
    '<div class="rd-decl-modes" id="rdDeclModes">' +
    DECLUTTER_MODES.map(
      (m, i) =>
        '<button type="button" class="rd-decl-mode' +
        (i === 0 ? " on" : "") +
        (m.removesFurniture ? " is-danger" : "") +
        '" data-mode="' +
        m.id +
        '"><b>' +
        esc(m.label) +
        "</b><span>" +
        esc(m.blurb) +
        "</span></button>",
    ).join("") +
    "</div>" +
    '<div class="rd-decl-danger" id="rdDeclDanger" hidden>' +
    "<p>" +
    esc(EMPTY_ROOM_WARNING) +
    "</p>" +
    '<label class="rd-decl-lab">Type ' +
    EMPTY_ROOM_CONFIRM +
    " To Confirm</label>" +
    '<input type="text" id="rdDeclConfirm" class="rd-decl-input" placeholder="' +
    EMPTY_ROOM_CONFIRM +
    '" aria-label="Type ' +
    EMPTY_ROOM_CONFIRM +
    ' to confirm emptying the room">' +
    "</div>" +
    "</div>" +
    /* detection */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Items Found</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdDeclDetect">Detect Clutter</button></div>' +
    '<p class="rd-decl-free">Detecting and selecting items is free. Credits are only used when you confirm.</p>' +
    '<div class="rd-decl-bulk" id="rdDeclBulk" hidden>' +
    '<button type="button" class="rd-decl-chip" data-bulk="all">Select All</button>' +
    '<button type="button" class="rd-decl-chip" data-bulk="none">Deselect All</button>' +
    '<button type="button" class="rd-decl-chip" data-bulk="privacy">Privacy Items Only</button>' +
    "</div>" +
    '<div class="rd-decl-list" id="rdDeclList"></div>' +
    '<p class="rd-decl-privacy" id="rdDeclPrivacy" hidden></p>' +
    "</div>" +
    /* mask */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Removal Mask</b><span class="rd-decl-note">' +
    esc(MASK_SUPPORT.label) +
    "</span></div>" +
    '<div class="rd-decl-tools">' +
    '<button type="button" class="rd-decl-chip on" data-brush="remove"><i data-lucide="brush"></i>Brush Remove</button>' +
    '<button type="button" class="rd-decl-chip" data-brush="keep"><i data-lucide="shield"></i>Brush Keep</button>' +
    '<button type="button" class="rd-decl-chip" id="rdDeclUndo"><i data-lucide="undo-2"></i>Undo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdDeclRedo"><i data-lucide="redo-2"></i>Redo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdDeclErase"><i data-lucide="eraser"></i>Clear Marks</button>' +
    "</div>" +
    '<label class="rd-decl-lab">Brush Size</label>' +
    '<input type="range" id="rdDeclBrushSize" min="2" max="18" value="6" class="rd-decl-range" aria-label="Brush size">' +
    '<div class="rd-decl-canvas" id="rdDeclCanvasWrap">' +
    '<img id="rdDeclThumb" alt="Source photo with your removal mask">' +
    '<canvas id="rdDeclCanvas" width="600" height="400"></canvas>' +
    "</div>" +
    '<p class="rd-decl-muted">' +
    esc(MASK_SUPPORT.note) +
    "</p>" +
    "</div>" +
    /* results */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Results</b></div>' +
    '<div class="rd-decl-chips" id="rdDeclResults">' +
    [1, 2, 3, 4]
      .map(
        (n) =>
          '<button type="button" class="rd-decl-chip' +
          (n === 1 ? " on" : "") +
          '" data-results="' +
          n +
          '">' +
          n +
          "</button>",
      )
      .join("") +
    "</div>" +
    '<p class="rd-decl-cost" id="rdDeclCost"></p>' +
    '<button type="button" class="btn btn-ghost btn-xs rd-decl-batch" id="rdDeclBatch">' +
    '<i data-lucide="images"></i>Declutter All Photos In This Room</button>' +
    '<button type="button" class="btn btn-ghost btn-xs rd-decl-batch" id="rdDeclToObject">' +
    '<i data-lucide="mouse-pointer-square-dashed"></i>Edit One Object Instead</button>' +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  wire(sec);
  paintDetections();
  paintMask();
  paintSummary();
  icons();
}

export function setDeclutterPanelVisible(on: boolean) {
  const sec = byId("rdDeclSec");
  if (sec) sec.hidden = !on;
  if (on) {
    paintMask();
    paintSummary();
  }
}

let batchCb: (() => void) | null = null;
export function onDeclutterBatch(cb: () => void) {
  batchCb = cb;
}

function wire(sec: HTMLElement) {
  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    const mode = t.closest("[data-mode]") as HTMLElement | null;
    if (mode) {
      sec.querySelectorAll(".rd-decl-mode").forEach((x) => x.classList.remove("on"));
      mode.classList.add("on");
      const id = (mode.getAttribute("data-mode") || "auto") as DeclutterModeId;
      const danger = byId("rdDeclDanger");
      if (danger) danger.hidden = !declutterMode(id).needsConfirm;
      /* A mode change re-applies its default selection but never overrides a
         Keep the user chose by hand. */
      state.detections = applyModeSelection(state.detections, id, Array.from(state.keepLocked));
      paintDetections();
      paintMask();
      change();
      return;
    }

    const bulk = t.closest("[data-bulk]") as HTMLElement | null;
    if (bulk) {
      const kind = bulk.getAttribute("data-bulk");
      state.detections = state.detections.map((d) => {
        if (kind === "none") return { ...d, decision: "keep" as const };
        if (kind === "privacy")
          return { ...d, decision: d.personal && !d.protectedItem ? ("remove" as const) : ("keep" as const) };
        /* Select All still refuses to tick furniture and fixtures. */
        return { ...d, decision: d.protectedItem ? ("keep" as const) : ("remove" as const) };
      });
      if (kind === "none") state.keepLocked = new Set(state.detections.map((d) => d.id));
      else state.keepLocked.clear();
      paintDetections();
      paintMask();
      change();
      return;
    }

    const row = t.closest("[data-det]") as HTMLElement | null;
    if (row) {
      const id = row.getAttribute("data-det") || "";
      const want = t.closest("[data-decide]")?.getAttribute("data-decide");
      state.detections = state.detections.map((d) => {
        if (d.id !== id) return d;
        const next = want === "keep" || want === "remove" ? want : d.decision === "remove" ? "keep" : "remove";
        return { ...d, decision: next as Detection["decision"] };
      });
      const now = state.detections.find((d) => d.id === id);
      if (now?.decision === "keep") state.keepLocked.add(id);
      else state.keepLocked.delete(id);
      paintDetections();
      paintMask();
      change();
      return;
    }

    const brush = t.closest("[data-brush]") as HTMLElement | null;
    if (brush) {
      state.brush = (brush.getAttribute("data-brush") || "remove") as StrokeKind;
      sec
        .querySelectorAll<HTMLElement>("[data-brush]")
        .forEach((b) => b.classList.toggle("on", b.getAttribute("data-brush") === state.brush));
      return;
    }
    if (t.closest("#rdDeclUndo")) {
      state.mask = undoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdDeclRedo")) {
      state.mask = redoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdDeclErase")) {
      state.mask = emptyMask();
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdDeclDetect")) {
      onDetectCb?.();
      return;
    }
    if (t.closest("#rdDeclBatch")) {
      batchCb?.();
      return;
    }
    /* One shared Object Edit: Declutter never grows its own targeted editor. */
    if (t.closest("#rdDeclToObject")) {
      (window as any).rdOpenObjectEdit?.({ action: "remove" });
      return;
    }
    const res = t.closest("[data-results]") as HTMLElement | null;
    if (res) {
      sec.querySelectorAll("#rdDeclResults .rd-decl-chip").forEach((x) => x.classList.remove("on"));
      res.classList.add("on");
      change();
      return;
    }
  });

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "rdDeclBrushSize") state.brushSize = Number((t as HTMLInputElement).value) / 100;
    if (t.id === "rdDeclConfirm") change();
  });

  /* brush painting on the mask canvas */
  const wrap = byId("rdDeclCanvasWrap");
  if (wrap) {
    const paintAt = (ev: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      state.mask = pushStroke(state.mask, {
        x: (ev.clientX - rect.left) / rect.width,
        y: (ev.clientY - rect.top) / rect.height,
        r: state.brushSize,
        kind: state.brush,
      });
      paintMask();
    };
    wrap.addEventListener("pointerdown", (ev) => {
      state.painting = true;
      (ev.target as HTMLElement).setPointerCapture?.((ev as PointerEvent).pointerId);
      paintAt(ev as PointerEvent);
      ev.preventDefault();
    });
    wrap.addEventListener("pointermove", (ev) => {
      if (state.painting) paintAt(ev as PointerEvent);
    });
    const stop = () => {
      if (!state.painting) return;
      state.painting = false;
      change();
    };
    wrap.addEventListener("pointerup", stop);
    wrap.addEventListener("pointerleave", stop);
  }
}

/* ------------------------------------------------------------ painters */

function sourceUrl(): string {
  const img = document.querySelector("#cBefore img") as HTMLImageElement | null;
  return img?.currentSrc || img?.src || "";
}

function paintDetections() {
  const host = byId("rdDeclList");
  const bulk = byId("rdDeclBulk");
  const btn = byId("rdDeclDetect") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.detecting;
    btn.textContent = state.detecting
      ? "Detecting…"
      : state.detections.length
        ? "Detect Again"
        : "Detect Clutter";
  }
  if (!host) return;
  if (bulk) bulk.hidden = !state.detections.length;

  if (state.detecting) {
    host.innerHTML = '<p class="rd-decl-muted">Looking for clutter, personal items and loose objects…</p>';
    return;
  }
  if (state.error) {
    host.innerHTML = '<p class="rd-decl-warn">' + esc(state.error) + "</p>";
    return;
  }
  if (!state.detections.length) {
    host.innerHTML =
      '<p class="rd-decl-muted">Nothing detected yet. Run Detect Clutter to see every removable object before anything is generated, or brush the areas you want cleaned.</p>';
    return;
  }

  host.innerHTML = state.detections
    .map(
      (d) =>
        '<div class="rd-decl-row' +
        (d.decision === "remove" ? " is-remove" : "") +
        (d.protectedItem ? " is-protected" : "") +
        '" data-det="' +
        d.id +
        '">' +
        '<span class="rd-decl-rowmain"><b>' +
        esc(d.label) +
        "</b><em>" +
        esc(categoryLabel(d.category)) +
        (d.protectedItem ? " · Furniture Or Fixture" : "") +
        (d.personal ? " · Personal" : "") +
        "</em></span>" +
        '<span class="rd-decl-seg">' +
        '<button type="button" class="' +
        (d.decision === "keep" ? "on" : "") +
        '" data-decide="keep">Keep</button>' +
        '<button type="button" class="' +
        (d.decision === "remove" ? "on" : "") +
        '" data-decide="remove">Remove</button>' +
        "</span></div>",
    )
    .join("");

  const privacy = byId("rdDeclPrivacy");
  if (privacy) {
    const left = state.detections.filter((d) => d.personal && d.decision === "keep");
    privacy.hidden = !left.length;
    privacy.innerHTML = left.length
      ? '<i data-lucide="shield-alert"></i> Privacy suggestion: ' +
        esc(left.map((d) => d.label).join(", ")) +
        " can identify the owner. Consider removing " +
        (left.length > 1 ? "them" : "it") +
        " before publishing."
      : "";
  }
  icons();
}

function paintMask() {
  const img = byId("rdDeclThumb") as HTMLImageElement | null;
  const canvas = byId("rdDeclCanvas") as HTMLCanvasElement | null;
  if (!img || !canvas) return;
  const src = sourceUrl();
  if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  state.detections
    .filter((d) => d.decision === "remove")
    .forEach((d) => {
      ctx.fillStyle = "rgba(255,0,170,0.34)";
      ctx.strokeStyle = "rgba(255,0,170,0.95)";
      ctx.lineWidth = 2;
      ctx.fillRect(d.box.x * W, d.box.y * H, d.box.w * W, d.box.h * H);
      ctx.strokeRect(d.box.x * W, d.box.y * H, d.box.w * W, d.box.h * H);
    });
  state.detections
    .filter((d) => d.decision === "keep" && d.protectedItem)
    .forEach((d) => {
      ctx.strokeStyle = "rgba(0,200,120,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.box.x * W, d.box.y * H, d.box.w * W, d.box.h * H);
    });
  state.mask.strokes.forEach((s) => {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r * Math.min(W, H), 0, Math.PI * 2);
    ctx.fillStyle = s.kind === "remove" ? "rgba(255,0,170,0.38)" : "rgba(0,200,120,0.32)";
    ctx.fill();
  });

  const undo = byId("rdDeclUndo") as HTMLButtonElement | null;
  const redo = byId("rdDeclRedo") as HTMLButtonElement | null;
  if (undo) undo.disabled = !state.mask.strokes.length;
  if (redo) redo.disabled = !state.mask.redo.length;
}

function paintSummary() {
  const cost = byId("rdDeclCost");
  if (cost) cost.textContent = declutterCostSentence(readDeclutterResults());
}

/* ------------------------------------------------------------- readers */

export function readDeclutterMode(): DeclutterModeId {
  const on = document.querySelector("#rdDeclModes .rd-decl-mode.on") as HTMLElement | null;
  return ((on?.getAttribute("data-mode") as DeclutterModeId) || "auto") as DeclutterModeId;
}

export function readDeclutterResults(): number {
  const on = document.querySelector("#rdDeclResults .rd-decl-chip.on") as HTMLElement | null;
  return Number(on?.getAttribute("data-results") || 1) || 1;
}

export function readDeclutterSettings() {
  return {
    mode: readDeclutterMode(),
    detections: declutterDetections(),
    mask: declutterMask(),
    results: readDeclutterResults(),
    emptyConfirm: (byId("rdDeclConfirm") as HTMLInputElement | null)?.value || null,
    roomRead: state.room,
  };
}

/** Moves one object back under protection and repaints, without a restart. */
export function restoreDeclutterItem(id: string) {
  state.detections = restoreItem(state.detections, id);
  state.keepLocked.add(id);
  paintDetections();
  paintMask();
  change();
}

/** Rehydrates the panel from a saved version's metadata. */
export function loadDeclutterState(input: {
  mode: DeclutterModeId;
  detections: Detection[];
  mask: MaskState;
}) {
  state.detections = input.detections;
  state.mask = input.mask;
  state.keepLocked = new Set(input.detections.filter((d) => d.decision === "keep").map((d) => d.id));
  const modeBtn = document.querySelector('#rdDeclModes [data-mode="' + input.mode + '"]');
  if (modeBtn) {
    document.querySelectorAll("#rdDeclModes .rd-decl-mode").forEach((x) => x.classList.remove("on"));
    modeBtn.classList.add("on");
  }
  paintDetections();
  paintMask();
  change();
}

/* -------------------------------------------------------- mask overlay */

/**
 * Renders the mask the backend receives: the source photograph with removal
 * regions filled magenta and protected regions outlined green. The mask the
 * user painted is the mask that is sent — nothing is discarded here.
 */
export function buildMaskOverlay(
  src: string,
  detections: Detection[],
  mask: MaskState,
  maxW = 1600,
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
          const W = Math.max(16, Math.round((img.naturalWidth || maxW) * scale));
          const H = Math.max(16, Math.round((img.naturalHeight || maxW) * scale));
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, W, H);
          const regions = maskRegions(detections, mask);
          regions.remove.forEach((r) => {
            ctx.fillStyle = "rgba(255,0,170,0.72)";
            ctx.fillRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
          });
          mask.strokes
            .filter((s) => s.kind === "remove")
            .forEach((s) => {
              ctx.beginPath();
              ctx.arc(s.x * W, s.y * H, s.r * Math.min(W, H), 0, Math.PI * 2);
              ctx.fillStyle = "rgba(255,0,170,0.72)";
              ctx.fill();
            });
          regions.keep.forEach((r) => {
            ctx.strokeStyle = "rgba(0,220,130,0.95)";
            ctx.lineWidth = Math.max(2, Math.round(W / 320));
            ctx.strokeRect(r.box.x * W, r.box.y * H, r.box.w * W, r.box.h * H);
          });
          mask.strokes
            .filter((s) => s.kind === "keep")
            .forEach((s) => {
              ctx.beginPath();
              ctx.arc(s.x * W, s.y * H, s.r * Math.min(W, H), 0, Math.PI * 2);
              ctx.strokeStyle = "rgba(0,220,130,0.95)";
              ctx.lineWidth = Math.max(2, Math.round(W / 320));
              ctx.stroke();
            });
          resolve(c.toDataURL("image/jpeg", 0.9));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch (_) {
      resolve(null);
    }
  });
}

/* --------------------------------------------------------- brief review */

export type DeclutterAnswer = "confirm" | "cancel";

/** The last screen before any credit is spent. */
export function openDeclutterReview(
  brief: DeclutterBrief,
  opts: { costLabel: string; sourceLabel: string; balanceNote?: string | null; overlay?: string | null },
): Promise<DeclutterAnswer> {
  return new Promise((resolve) => {
    byId("rdDeclBrief")?.remove();
    const m = document.createElement("div");
    m.id = "rdDeclBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Declutter">' +
      "<h3>Review This Cleanup</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      (opts.overlay
        ? '<img class="rd-decl-preview" src="' + esc(opts.overlay) + '" alt="Your removal mask over the source photo">'
        : "") +
      '<div class="rd-brief-list">' +
      brief.lines
        .map(
          (l) =>
            '<div class="rd-brief-row"><span class="k">' +
            esc(l.k) +
            '</span><span class="v">' +
            esc(l.v) +
            "</span></div>",
        )
        .join("") +
      '<div class="rd-brief-row"><span class="k">Source</span><span class="v">' +
      esc(opts.sourceLabel) +
      "</span></div>" +
      "</div>" +
      (brief.warnings.length
        ? '<div class="rd-brief-warn"><b>Check This First</b><ul>' +
          brief.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
          "</ul></div>"
        : "") +
      '<p class="rd-brief-note">' +
      esc(brief.costSentence) +
      "</p>" +
      '<p class="rd-brief-note">' +
      esc(brief.disclosure) +
      "</p>" +
      '<div class="up-act"><button class="btn btn-primary" id="rdDeclGo" type="button">Declutter · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Selection</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: DeclutterAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdDeclGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* -------------------------------------------------------- quality panel */

/** Honest reporting of the automatic post-generation checks. */
export function showDeclutterQuality(
  report: QualityReport | null,
  handlers: { onRegenerate?: () => void; onRestore?: () => void; onDismiss?: () => void } = {},
) {
  byId("rdDeclQa")?.remove();
  if (!report || !report.issues.length) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdDeclQa";
  el.className = "rd-stage-qa" + (report.rejected ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><div><b>' +
    esc(report.headline) +
    "</b><ul>" +
    report.issues.map((i) => "<li>" + esc(i.detail) + "</li>").join("") +
    "</ul>" +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdDeclRestore">Restore An Item</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdDeclRegen">Tighter Mask And Retry</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdDeclQaClose">Keep This Result</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdDeclRestore")?.addEventListener("click", () => {
    el.remove();
    handlers.onRestore?.();
  });
  byId("rdDeclRegen")?.addEventListener("click", () => {
    el.remove();
    handlers.onRegenerate?.();
  });
  byId("rdDeclQaClose")?.addEventListener("click", () => {
    el.remove();
    handlers.onDismiss?.();
  });
}

/* ------------------------------------------------------- restore picker */

/** Puts one removed object back and re-runs, without rebuilding the brief. */
export function openRestorePicker(onRestore: (id: string) => void) {
  const removed = state.detections.filter((d) => d.decision === "remove");
  byId("rdDeclRestoreM")?.remove();
  const m = document.createElement("div");
  m.id = "rdDeclRestoreM";
  m.className = "up-modal on rd-brief";
  m.innerHTML =
    '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Restore An Item">' +
    "<h3>Restore An Item</h3>" +
    '<p class="rd-brief-sub">Pick anything that should not have been removed. It is protected and the cleanup runs again with a tighter mask.</p>' +
    (removed.length
      ? '<div class="rd-decl-restore">' +
        removed
          .map(
            (d) =>
              '<button type="button" class="rd-decl-chip" data-restore="' +
              d.id +
              '">' +
              esc(d.label) +
              "</button>",
          )
          .join("") +
        "</div>"
      : '<p class="rd-brief-note">Nothing was removed from a detected list, so there is nothing to restore. Brush a Keep region over the area instead.</p>') +
    '<div class="up-act"><button class="btn btn-ghost" type="button" data-close>Close</button></div></div>';
  (document.querySelector(".rd-app") || document.body).appendChild(m);
  icons();
  m.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest("[data-restore]") as HTMLElement | null;
    if (pick) {
      const id = pick.getAttribute("data-restore") || "";
      m.remove();
      restoreDeclutterItem(id);
      onRestore(id);
      return;
    }
    if (t.closest("[data-close]")) m.remove();
  });
}

/* ---------------------------------------------------------------- batch */

export type BatchPhoto = { id: string; label: string; url: string };

export type BatchRow = {
  photo: BatchPhoto;
  detections: Detection[];
  approved: boolean;
  status: "pending" | "detecting" | "ready" | "running" | "done" | "failed";
  note: string | null;
};

/**
 * Property-wide cleanup.
 *
 * Detection runs free for every photo and each photo must be approved on its
 * own before anything is generated: a batch never charges for a photo the user
 * has not explicitly ticked.
 */
export function openDeclutterBatch(opts: {
  photos: BatchPhoto[];
  detect: (photo: BatchPhoto) => Promise<Detection[]>;
  run: (photo: BatchPhoto, detections: Detection[]) => Promise<void>;
  costPerPhoto: number;
}) {
  byId("rdDeclBatchM")?.remove();
  const rows: BatchRow[] = opts.photos.map((p) => ({
    photo: p,
    detections: [],
    approved: false,
    status: "pending",
    note: null,
  }));

  const m = document.createElement("div");
  m.id = "rdDeclBatchM";
  m.className = "up-modal on rd-brief";
  m.innerHTML =
    '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card rd-decl-batchcard" role="dialog" aria-modal="true" aria-label="Declutter All Photos">' +
    "<h3>Declutter All Photos In This Room</h3>" +
    '<p class="rd-brief-sub">Detection is free. Approve each photo you want cleaned — only approved photos are generated and charged.</p>' +
    '<div class="rd-decl-batchlist" id="rdDeclBatchList"></div>' +
    '<p class="rd-brief-note" id="rdDeclBatchCost"></p>' +
    '<div class="up-act"><button class="btn btn-primary" id="rdDeclBatchGo" type="button">Declutter Approved Photos</button>' +
    '<button class="btn btn-ghost" type="button" data-close>Close</button></div></div>';
  (document.querySelector(".rd-app") || document.body).appendChild(m);

  const list = byId("rdDeclBatchList")!;
  const costEl = byId("rdDeclBatchCost")!;
  const goBtn = byId("rdDeclBatchGo") as HTMLButtonElement;

  const paint = () => {
    list.innerHTML = rows
      .map((r, i) => {
        const removals = r.detections.filter((d) => d.decision === "remove").length;
        return (
          '<div class="rd-decl-batchrow' +
          (r.approved ? " on" : "") +
          '" data-row="' +
          i +
          '">' +
          '<img src="' +
          esc(r.photo.url) +
          '" alt="' +
          esc(r.photo.label) +
          '">' +
          "<span><b>" +
          esc(r.photo.label) +
          "</b><em>" +
          (r.status === "detecting"
            ? "Detecting…"
            : r.status === "running"
              ? "Cleaning…"
              : r.status === "done"
                ? "Cleaned"
                : r.status === "failed"
                  ? esc(r.note || "Failed")
                  : r.status === "ready"
                    ? removals + " item" + (removals === 1 ? "" : "s") + " to remove"
                    : "Not detected yet") +
          "</em></span>" +
          '<button type="button" class="rd-decl-chip' +
          (r.approved ? " on" : "") +
          '" data-approve="' +
          i +
          '"' +
          (r.status === "ready" || r.approved ? "" : " disabled") +
          ">" +
          (r.approved ? "Approved" : "Approve") +
          "</button></div>"
        );
      })
      .join("");
    const n = rows.filter((r) => r.approved && r.status !== "done").length;
    costEl.textContent = n
      ? n + " photo" + (n === 1 ? "" : "s") + " approved · " + n * opts.costPerPhoto + " credits."
      : "Approve at least one photo. Detection has cost nothing so far.";
    goBtn.disabled = !n;
  };

  paint();

  /* Detection is free, so it runs for every photo up front. */
  (async () => {
    for (const r of rows) {
      r.status = "detecting";
      paint();
      try {
        r.detections = await opts.detect(r.photo);
        r.status = "ready";
      } catch (e) {
        r.status = "failed";
        r.note = (e as Error)?.message || "Could not read this photo.";
      }
      paint();
    }
  })();

  m.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    const app = t.closest("[data-approve]") as HTMLElement | null;
    if (app) {
      const i = Number(app.getAttribute("data-approve"));
      const row = rows[i];
      if (row && (row.status === "ready" || row.approved)) row.approved = !row.approved;
      paint();
      return;
    }
    if (t.closest("[data-close]")) {
      m.remove();
      return;
    }
    if (t.closest("#rdDeclBatchGo")) {
      goBtn.disabled = true;
      for (const r of rows) {
        if (!r.approved || r.status === "done") continue;
        r.status = "running";
        paint();
        try {
          await opts.run(r.photo, r.detections);
          r.status = "done";
        } catch (err) {
          r.status = "failed";
          r.note = (err as Error)?.message || "That photo did not finish.";
        }
        paint();
      }
    }
  });
}

export const DECLUTTER_CATEGORY_LABELS = CLUTTER_CATEGORIES.map((c) => c.label);
