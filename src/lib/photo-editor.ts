/**
 * REAL DESIGNS — full-screen Photo Editor.
 *
 * A separate, focused workspace for preparing source and listing photographs.
 * It is deliberately NOT part of the Canvas generation panel: nothing here
 * generates a new design, everything here corrects or improves the photo that
 * was actually shot.
 *
 * Non-destructive by construction: the original object in storage is never
 * overwritten. Adjustments, crop, rotation and applied AI operations are held
 * as state, rendered on demand, and persisted through `photo_edits`.
 */

import { createIcons, icons } from "lucide";
import { openDisclosureExport } from "@/lib/disclosure-export";
import { rdToast } from "@/lib/rd-toast";
import { applyCanvasBadge, resolveCanvasBadge, showCompareControl } from "@/lib/canvas-badge";
import { confirmDialog } from "@/lib/builder-card-menu";
import { roomPhotoUrl, uploadRenderDataUrl } from "@/lib/room-photos";
import { listPhotoEdits, savePhotoEdit, resetPhotoEdit } from "@/lib/photo-edits.functions";
import { runPhotoEdit } from "@/lib/photo-edit.functions";
import {
  type EditorMode,
  compareEnabled,
  continueWithTools,
  defaultGenerationSource,
  defaultOpenSections,
  detectPhotoTraits,
  editedFromLabel,
  enhancementByOp,
  footerLayout,
  photoEnhancements,
  primarySaveLabel,
} from "@/lib/photo-editor-context";
import {
  applyDetailPass,
  detailKey,
  detailOf,
  needsPixelPass,
} from "@/lib/photo-pixels";
import {
  type Box as CropBox,
  type CropState,
  MAX_CROP_ZOOM,
  clampOffset,
  createCrop,
  cropRect,
  focalOf,
  minCoverScale,
  refit,
  resizeFrame,
  wheelScale,
  zoomTo,
} from "./crop-frame";
import { saveBatch } from "@/lib/batch-edit.functions";
import {
  APPLY_MODES,
  PASTE_CATEGORIES,
  type ApplyMode,
  type BatchRecord,
  type CopiedAdjustments,
  type PasteCategory,
  applyCopied,
  batchAutoEnhance,
  batchProgress,
  changedPhotos,
  clippingNotice,
  copyAdjustments,
  defaultPasteCategories,
  latestUnfinishedBatch,
  markPhoto,
  markUndone,
  mixedValues,
  newBatch,
  saveBatchLocal,
} from "@/lib/batch-edit";
import {
  CROP_PRESETS,
  classifyEdits,
  cropPreset,
  deletePreset as removePreset,
  exportSize,
  listPresets,
  mergeBundle,
  qualityReview,
  savePreset,
  type AdjustmentBundle,
} from "@/lib/photo-editor-presets";
import {
  BLUR_TYPES,
  BRUSH_MAX,
  BRUSH_MIN,
  DEFAULT_PRIVACY_SETTINGS,
  PRIVACY_CATEGORIES,
  bakeFromState,
  batchBlocked,
  blurTypeNote,
  brushFraction,
  categoryLabel,
  clampPrivacySettings,
  deselectAll,
  exportWarning,
  hasPrivacySelection,
  privacyMetadata,
  safeDetections,
  selectAll,
  selectGroup,
  type PrivacyDetection,
  type PrivacyMetadata,
  type PrivacySettings,
} from "@/lib/privacy-blur";
import {
  bindStrokePainting,
  clearStrokes,
  createMaskState,
  paintFromState,
  paintMaskLayer,
  redoStroke,
  toggleSelectedRegion,
  undoStroke,
  type MaskState,
} from "@/lib/mask-engine";
import { scanPrivacy } from "@/lib/privacy.functions";
import {
  LABEL_SUGGESTIONS,
  MARKUP_COLORS,
  MARKUP_TYPES,
  MARKUP_WARNING,
  bringForward,
  duplicateLayer,
  emptyDoc,
  markupType as markupTypeSpec,
  parseMarkup,
  removeLayer,
  sendBackward,
  updateLayer,
  updateStyle,
  warningRequired,
  type MarkupDoc,
  type MarkupTypeId,
} from "@/lib/markup";
import { flattenMarkup } from "@/lib/markup-render";
import { attachMarkupEditor, type MarkupEditor, type MarkupMode } from "@/lib/markup-editor";
import { listMarkups, saveMarkup } from "@/lib/markup.functions";
import {
  CALLOUT_TYPES,
  MEASURED_TYPES,
  canMeasure,
  layerMeasurement,
  refreshMeasurements,
} from "@/lib/markup";
import {
  BUDGET_CATEGORIES,
  PRIORITIES,
  SURFACES,
  calloutComplete,
  calloutDetails,
  emptyCallout,
  type CalloutMeta,
} from "@/lib/markup-callouts";
import { PERSPECTIVE_WARNING, NO_SCALE_MESSAGE, type ImagePerspective, type MeasureUnit } from "@/lib/markup-measure";
import {
  PARCEL_WARNING,
  auditEvent,
  buildOverlay,
  confidenceLabel,
  confirmAlignment,
  requiresManualAlignment,
  resetAlignment,
  reproject,
} from "@/lib/parcel";
import { lookupParcel, parcelProviderStatus, saveParcelAlignment } from "@/lib/parcel.functions";
import { chipList, chipValues, formDialog } from "@/lib/photo-editor-dialogs";
import {
  type PhotoStats,
  type Strength,
  STRENGTHS,
  analyzeImageData,
  autoEnhanceAdjustments,
  clippingWarning,
} from "@/lib/photo-auto-enhance";

/* ------------------------------------------------------------------ model */

import { returnLabel, type ReturnDestination } from "@/lib/active-image";

export type EditorPhoto = {
  key: string;
  name?: string;
  room?: string;
  src?: string;
  path?: string;
  property?: string;
  rotation?: number;
  /* Shared entry contract — every "Edit Photo" surface passes the durable ids. */
  assetId?: string;
  assetType?: string;
  storagePath?: string;
  propertyId?: string;
  roomId?: string;
  versionId?: string;
  parentVersionId?: string;
  versionNumber?: number;
  space?: string;
  editorMode?: EditorMode;
};

type Adj = Record<string, number>;

type Crop = { x: number; y: number; w: number; h: number; ratio: string } | null;

type AutoState = { strength: Strength; values: Adj } | null;

type PhotoState = {
  adj: Adj;
  rotation: number;
  straighten: number;
  /** Keystone correction, in degrees. Perspective, not a canvas resize. */
  vertical: number;
  horizontal: number;
  flipH: boolean;
  flipV: boolean;
  crop: Crop;
  aiOps: string[];
  base: string | null; // current image (original or AI result)
  original: string | null; // untouched source in storage — never overwritten
  entry: string | null; // the image as it looked when the editor opened
  dirty: boolean;
  saving: boolean;
  history: string[];
  future: string[];
  /** Applied Auto Enhance, and the adjustments it was layered on top of. */
  auto: AutoState;
  autoBase: Adj | null;
};

const ADJUSTMENTS = [
  { group: "light", key: "exposure", label: "Exposure", min: -100, max: 100 },
  { group: "light", key: "contrast", label: "Contrast", min: -100, max: 100 },
  { group: "light", key: "highlights", label: "Highlights", min: -100, max: 100 },
  { group: "light", key: "shadows", label: "Shadows", min: -100, max: 100 },
  { group: "light", key: "whites", label: "Whites", min: -100, max: 100 },
  { group: "light", key: "blacks", label: "Blacks", min: -100, max: 100 },
  { group: "color", key: "temperature", label: "Temperature", min: -100, max: 100 },
  { group: "color", key: "tint", label: "Tint", min: -100, max: 100 },
  { group: "color", key: "vibrance", label: "Vibrance", min: -100, max: 100 },
  { group: "color", key: "saturation", label: "Saturation", min: -100, max: 100 },
  { group: "detail", key: "sharpen", label: "Sharpen", min: 0, max: 100 },
  { group: "detail", key: "denoise", label: "Denoise", min: 0, max: 100 },
  { group: "detail", key: "clarity", label: "Clarity", min: -100, max: 100 },
  { group: "detail", key: "dehaze", label: "Dehaze", min: -100, max: 100 },
  { group: "lens", key: "lens", label: "Lens Correction", min: -100, max: 100 },
] as const;

const RATIOS = CROP_PRESETS;

const GEOMETRY = [
  { key: "straighten", label: "Straighten", min: -15, max: 15, step: 0.5 },
  { key: "vertical", label: "Vertical Correction", min: -12, max: 12, step: 0.5 },
  { key: "horizontal", label: "Horizontal Correction", min: -12, max: 12, step: 0.5 },
] as const;

function blankState(): PhotoState {
  return {
    adj: {},
    rotation: 0,
    straighten: 0,
    vertical: 0,
    horizontal: 0,
    flipH: false,
    flipV: false,
    crop: null,
    aiOps: [],
    base: null,
    original: null,
    entry: null,
    dirty: false,
    saving: false,
    history: [],
    future: [],
    auto: null,
    autoBase: null,
  };
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as any)[c] as string,
  );
}

function n(v: unknown, d = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

/** CSS/canvas filter string for the current adjustments. */
export function filterString(adj: Adj): string {
  const a = (k: string) => n(adj[k], 0);
  const brightness = 1 + a("exposure") / 200 + a("whites") / 500 - a("blacks") / 600;
  const contrast = 1 + a("contrast") / 160 - a("shadows") / 600 + a("highlights") / 900;
  const saturate = 1 + a("saturation") / 140 + a("vibrance") / 220;
  const warm = a("temperature") / 100;
  const parts = [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${Math.max(0, saturate).toFixed(3)})`,
  ];
  if (warm) parts.push(`sepia(${Math.min(0.5, Math.abs(warm) * 0.35).toFixed(3)})`);
  if (warm < 0) parts.push(`hue-rotate(${(warm * 22).toFixed(1)}deg)`);
  if (a("tint")) parts.push(`hue-rotate(${(a("tint") / 8).toFixed(1)}deg)`);
  return parts.join(" ");
}

function hasGeometry(st: PhotoState): boolean {
  return (
    st.rotation !== 0 ||
    st.straighten !== 0 ||
    st.vertical !== 0 ||
    st.horizontal !== 0 ||
    st.flipH ||
    st.flipV ||
    !!st.crop
  );
}

function hasEdits(st: PhotoState): boolean {
  return (
    Object.values(st.adj).some((v) => n(v) !== 0) || hasGeometry(st) || st.aiOps.length > 0
  );
}

/** CSS transform for the stage image: rotation, flips and keystone. */
export function transformString(st: PhotoState): string {
  const parts = [`rotate(${st.rotation + st.straighten}deg)`];
  if (st.vertical || st.horizontal) {
    parts.unshift("perspective(1400px)");
    if (st.vertical) parts.push(`rotateX(${(-st.vertical).toFixed(2)}deg)`);
    if (st.horizontal) parts.push(`rotateY(${st.horizontal.toFixed(2)}deg)`);
  }
  parts.push(`scaleX(${st.flipH ? -1 : 1})`, `scaleY(${st.flipV ? -1 : 1})`);
  return parts.join(" ");
}

/* -------------------------------------------------------------- rendering */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That photo could not be loaded."));
    img.src = src;
  });
}

/**
 * Keystone correction. A 2D context has no true perspective transform, so the
 * image is drawn as a stack of slices whose width tapers — visually identical
 * to the CSS preview at the small angles this control allows.
 */
function drawKeystone(
  c: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  vertical: number,
  horizontal: number,
) {
  if (!vertical && !horizontal) {
    c.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    return;
  }
  const kv = vertical * 0.012;
  const kh = horizontal * 0.012;
  const steps = 240;
  if (vertical) {
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const sy = (ih * i) / steps;
      const sh = ih / steps + 1;
      const scale = 1 + kv * (1 - 2 * t);
      const w = iw * scale;
      c.drawImage(img as any, 0, sy, iw, sh, -w / 2, -ih / 2 + sy, w, sh);
    }
    return;
  }
  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    const sx = (iw * i) / steps;
    const sw = iw / steps + 1;
    const scale = 1 + kh * (1 - 2 * t);
    const h = ih * scale;
    c.drawImage(img as any, sx, 0, sw, ih, -iw / 2 + sx, -h / 2, sw, h);
  }
}

/* ------------------------------------------------------- detail pipeline */

const detailCache = new Map<string, string>();

/**
 * Detail and lens correction are real pixel work, so they run once here and
 * feed BOTH the live preview and the saved render. Nothing in the inspector is
 * a CSS-only illusion that vanishes from the exported file.
 */
export async function detailedSource(src: string, adj: Adj, maxEdge = 0): Promise<string> {
  const d = detailOf(adj);
  if (!needsPixelPass(d)) return src;
  const key = `${maxEdge}|${detailKey(src, d)}`;
  const hit = detailCache.get(key);
  if (hit) return hit;
  try {
    const img = await loadImage(src);
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (maxEdge && Math.max(w, h) > maxEdge) {
      const k = maxEdge / Math.max(w, h);
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d", { willReadFrequently: true });
    if (!c) return src;
    c.drawImage(img, 0, 0, w, h);
    const id = c.getImageData(0, 0, w, h);
    applyDetailPass({ data: id.data, width: w, height: h }, d);
    c.putImageData(id, 0, 0);
    const out = cv.toDataURL("image/jpeg", 0.95);
    detailCache.set(key, out);
    if (detailCache.size > 10) detailCache.delete(detailCache.keys().next().value as string);
    return out;
  } catch {
    return src;
  }
}

export type ExportOptions = { maxEdge?: number; quality?: number; disclosure?: string | null };

/** Flatten the current state into a JPEG data URL. */
export async function renderPhoto(st: PhotoState, ex: ExportOptions = {}): Promise<string> {
  const src = st.base || st.original;
  if (!src) throw new Error("Nothing to render.");
  const img = await loadImage(await detailedSource(src, st.adj));
  const quarter = ((st.rotation % 360) + 360) % 360;
  const swap = quarter === 90 || quarter === 270;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const stage = document.createElement("canvas");
  stage.width = swap ? ih : iw;
  stage.height = swap ? iw : ih;
  const c = stage.getContext("2d");
  if (!c) throw new Error("Rendering is unavailable in this browser.");
  c.save();
  c.translate(stage.width / 2, stage.height / 2);
  c.rotate(((quarter + st.straighten) * Math.PI) / 180);
  if (st.flipH || st.flipV) c.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1);
  (c as any).filter = filterString(st.adj);
  drawKeystone(c, img, iw, ih, st.vertical, st.horizontal);
  c.restore();

  let out = stage;
  if (st.crop) {
    const cw = Math.max(8, Math.round(stage.width * st.crop.w));
    const ch = Math.max(8, Math.round(stage.height * st.crop.h));
    const cx = Math.round(stage.width * st.crop.x);
    const cy = Math.round(stage.height * st.crop.y);
    const cut = document.createElement("canvas");
    cut.width = cw;
    cut.height = ch;
    cut.getContext("2d")?.drawImage(stage, cx, cy, cw, ch, 0, 0, cw, ch);
    out = cut;
  }

  /* Export sizing, then the disclosure caption, so the caption is never
     resampled into mush. */
  const size = exportSize(out.width, out.height, ex.maxEdge || 0);
  if (size.w !== out.width || size.h !== out.height) {
    const scaled = document.createElement("canvas");
    scaled.width = size.w;
    scaled.height = size.h;
    const sc = scaled.getContext("2d");
    if (sc) {
      sc.imageSmoothingQuality = "high";
      sc.drawImage(out, 0, 0, size.w, size.h);
      out = scaled;
    }
  }
  if (ex.disclosure) {
    const c2 = out.getContext("2d");
    if (c2) {
      const pad = Math.round(out.width * 0.02);
      const fs = Math.max(12, Math.round(out.width * 0.026));
      c2.font = `600 ${fs}px "DM Sans", system-ui, sans-serif`;
      const tw = c2.measureText(ex.disclosure).width;
      c2.fillStyle = "rgba(0,0,0,.62)";
      c2.fillRect(pad, out.height - pad - fs * 1.9, tw + fs, fs * 1.9);
      c2.fillStyle = "#fff";
      c2.textBaseline = "middle";
      c2.fillText(ex.disclosure, pad + fs / 2, out.height - pad - fs * 0.95);
    }
  }
  return out.toDataURL("image/jpeg", ex.quality ?? 0.94);
}

/* ------------------------------------------------------------------- view */

let HOST: HTMLElement | null = null;

export async function openPhotoEditor(opts: {
  photos: EditorPhoto[];
  startKey?: string;
  property?: string;
  editorMode?: EditorMode;
  /* Where closing returns the user. The editor is one screen reached from
     several places, so the close control has to name the way back. */
  returnDestination?: ReturnDestination;
  /* When present the editor is a tool inside the Design Canvas: it mounts in
     the given host, keeps both rails and the Canvas headers on screen, and
     never renders a page-level header or a "Return To Canvas" control. */
  mount?: HTMLElement | null;
  /* Label of the image the Canvas is showing, e.g. "Source Photo". */
  contextLabel?: string;
  onSaved?: (r: {
    key: string;
    path: string;
    dataUrl: string;
    copy: boolean;
    useEdited?: boolean;
  }) => void;
}): Promise<void> {

  const photos = (opts.photos || []).filter((p) => p && p.key);
  if (!photos.length) return void rdToast("There Are No Photos To Edit.", "error");

  closePhotoEditor();
  const states = new Map<string, PhotoState>();
  let index = Math.max(
    0,
    photos.findIndex((p) => p.key === opts.startKey),
  );
  let comparing = false;
  let cropMode = false;
  /* Auto Enhance and the live histogram. Neither ever runs on open. */
  let autoStrength: Strength = "balanced";
  let autoBusy = false;
  let autoPreview = false;
  let cropBackup: Crop = null;
  /* The crop frame is stationary; this is the photograph's placement behind it. */
  let cropView: CropState | null = null;
  let cropHinted = false;
  let stats: PhotoStats | null = null;
  let sourceStats: { src: string; stats: PhotoStats } | null = null;
  let previewAdj: Adj | null = null;
  let aiPreview: { op: string; label: string; image: string } | null = null;
  let aiBusy = "";
  let saveFailed = false;
  /* Detail and lens run as a real pixel pass; the preview shows that pass. */
  let detailPreview: { key: string; url: string } | null = null;
  let detailPending = "";
  /* Privacy Blur. Local, deterministic and free: the scan only locates
     sensitive content, the pixels are baked here in the browser. */
  type PrivacyEdit = {
    open: boolean;
    mask: MaskState;
    detections: PrivacyDetection[];
    settings: PrivacySettings;
    tool: "brush" | "erase";
    showMask: boolean;
    scanning: boolean;
    scanned: boolean;
    scanError: string | null;
    baking: boolean;
  };
  const privacies = new Map<string, PrivacyEdit>();
  const privacyMeta = new Map<string, PrivacyMetadata>();
  let privacyPreview: string | null = null;
  let privacyTimer: ReturnType<typeof setTimeout> | null = null;
  let clipboard: AdjustmentBundle | null = null;
  let copied: CopiedAdjustments | null = null;
  let lastBatch: BatchRecord | null = null;
  /* Property Markup. Vector layers drawn over the photograph: they never touch
     the source pixels, and only an export flattens them in. */
  const markupDocs = new Map<string, MarkupDoc>();
  let markupOpen = false;
  let markupMode: MarkupMode = "draw";
  let markupActiveType: MarkupTypeId = "boundary";
  let markupSelected: string | null = null;
  let markupCtl: MarkupEditor | null = null;
  /* A refused calibration or a failed parcel lookup is shown, never swallowed. */
  let markupNotice = "";
  let parcelImportId: string | null = null;
  let parcelBusy = false;

  const embedded = !!opts.mount;
  const host = document.createElement("div");
  host.className = embedded ? "rdpe rdpe-embed" : "rdpe";
  if (!embedded) {
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
  }
  host.setAttribute("aria-label", "Photo Editor");
  host.innerHTML = embedded
    ? embeddedShellHtml(opts.contextLabel || "Source Photo")
    : shellHtml(returnLabel(opts.returnDestination));
  if (embedded) opts.mount!.appendChild(host);
  else {
    document.body.appendChild(host);
    document.body.classList.add("rdpe-open");
  }
  HOST = host;
  /* A batch survives a refresh: restore the last unfinished one so its undo
     and its per-photo progress are still available. */
  lastBatch = latestUnfinishedBatch();


  /* Some nodes (the image, the crop box, the badge, Hold To Compare) are
     adopted by the permanent Canvas while Edit is the active tool, so they can
     live outside the editor host. Lookups fall back to the document. */
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
    (host.querySelector(sel) || document.querySelector(sel)) as T;

  /* -------------------------------------------------------- state helpers */

  const cur = (): EditorPhoto => photos[index] as EditorPhoto;
  function st(key = cur().key): PhotoState {
    let s = states.get(key);
    if (!s) {
      s = blankState();
      const p = photos.find((x) => x.key === key);
      s.rotation = n(p?.rotation, 0);
      states.set(key, s);
    }
    return s;
  }

  function snapshot(s: PhotoState) {
    return JSON.stringify({
      adj: s.adj,
      rotation: s.rotation,
      straighten: s.straighten,
      vertical: s.vertical,
      horizontal: s.horizontal,
      flipH: s.flipH,
      flipV: s.flipV,
      crop: s.crop,
      aiOps: s.aiOps,
      base: s.base,
      auto: s.auto,
      autoBase: s.autoBase,
    });
  }

  function push() {
    const s = st();
    s.history.push(snapshot(s));
    if (s.history.length > 40) s.history.shift();
    s.future = [];
    saveFailed = false;
    s.dirty = true;
  }

  function restore(s: PhotoState, snap: string) {
    const o = JSON.parse(snap);
    s.adj = o.adj || {};
    s.rotation = o.rotation || 0;
    s.straighten = o.straighten || 0;
    s.vertical = o.vertical || 0;
    s.horizontal = o.horizontal || 0;
    s.flipH = !!o.flipH;
    s.flipV = !!o.flipV;
    s.crop = o.crop || null;
    s.aiOps = o.aiOps || [];
    s.base = o.base ?? s.base;
    s.auto = o.auto ?? null;
    s.autoBase = o.autoBase ?? null;
  }

  function undo() {
    const s = st();
    if (!s.history.length) return;
    s.future.push(snapshot(s));
    restore(s, s.history.pop() as string);
    saveFailed = false;
    s.dirty = true;
    paint();
  }

  function redo() {
    const s = st();
    if (!s.future.length) return;
    s.history.push(snapshot(s));
    restore(s, s.future.pop() as string);
    saveFailed = false;
    s.dirty = true;
    paint();
  }

  /* --------------------------------------------------------------- source */

  /** Which context this photograph is being edited in. */
  function modeFor(p: EditorPhoto): EditorMode {
    return (p.editorMode || opts.editorMode || (p.assetType === "generated_image" ? "generated" : "source")) as EditorMode;
  }

  async function ensureSource(p: EditorPhoto) {
    const s = st(p.key);
    if (s.original) return;
    const src =
      p.src || ((p.path || p.storagePath) ? await roomPhotoUrl((p.path || p.storagePath) as string, 3600) : null);
    if (!src) {
      rdToast("That Photo Could Not Be Opened.", "error");
      return;
    }
    s.original = src;
    if (!s.base) s.base = src;
    /* Hold To Compare is always "editor original vs current edit". */
    if (!s.entry) s.entry = s.base;
    paint();
  }

  /* ------------------------------------------------------------- painting */

  function previewKey(s: PhotoState): string | null {
    const base = s.base || s.original;
    if (!base || !needsPixelPass(detailOf(s.adj))) return null;
    return detailKey(base, detailOf(s.adj));
  }

  /** Keep the on-screen photo in step with the detail pass, off the main path. */
  function syncDetail(s: PhotoState) {
    const key = previewKey(s);
    if (!key || detailPreview?.key === key || detailPending === key) return;
    detailPending = key;
    void detailedSource((s.base || s.original) as string, s.adj, 1400).then((url) => {
      detailPending = "";
      detailPreview = { key, url };
      paint();
    });
  }


  /* ------------------------------------------------------------- privacy */

  function pv(key = cur().key): PrivacyEdit {
    let v = privacies.get(key);
    if (!v) {
      v = {
        open: false,
        mask: createMaskState({ assetId: key }),
        detections: [],
        settings: { ...DEFAULT_PRIVACY_SETTINGS },
        tool: "brush",
        showMask: true,
        scanning: false,
        scanned: false,
        scanError: null,
        baking: false,
      };
      privacies.set(key, v);
    }
    return v;
  }

  /** The image Privacy Blur reads from and bakes into. Never the original file. */
  const privacySource = (s: PhotoState) => (s.base || s.original) as string;

  function privacyActive(): boolean {
    const v = pv();
    return v.open && !cropMode;
  }

  /** Debounced live preview. The preview and the saved file share one baker. */
  function refreshPrivacyPreview(immediate = false) {
    if (privacyTimer) clearTimeout(privacyTimer);
    const run = async () => {
      const v = pv();
      const s = st();
      if (!v.open || !hasPrivacySelection(v.mask, v.detections)) {
        privacyPreview = null;
        paint();
        return;
      }
      const out = await bakeFromState(privacySource(s), v.mask, v.detections, v.settings, {
        maxEdge: 1600,
        quality: 0.9,
      });
      privacyPreview = out;
      paint();
    };
    if (immediate) void run();
    else privacyTimer = setTimeout(run, 160);
  }

  function privacyChanged() {
    refreshPrivacyPreview();
    paintPanel();
    syncPrivacyOverlay();
  }

  /** Keeps the mask canvas exactly over the photograph through zoom and pan. */
  function syncPrivacyOverlay() {
    const wrap = $("#rdpePriv") as HTMLElement;
    if (!wrap) return;
    const on = privacyActive();
    wrap.hidden = !on;
    if (!on) return;
    const img = $("#rdpeImg") as HTMLImageElement;
    const stage = $("#rdpeStage") as HTMLElement;
    if (!img || !stage) return;
    const ir = img.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    wrap.style.left = `${ir.left - sr.left}px`;
    wrap.style.top = `${ir.top - sr.top}px`;
    wrap.style.width = `${ir.width}px`;
    wrap.style.height = `${ir.height}px`;
    if (!wrap.dataset['bound']) {
      wrap.dataset['bound'] = "1";
      bindStrokePainting(wrap, {
        enabled: () => privacyActive(),
        mode: () => (pv().tool === "erase" ? "erase" : "add"),
        size: () => brushFraction(pv().settings.brush, Math.min(wrap.clientWidth, wrap.clientHeight)),
        feather: () => pv().settings.feather / 100,
        onChange: (next) => {
          const v = pv();
          v.mask = next(v.mask);
          syncPrivacyOverlay();
        },
        onDone: () => privacyChanged(),
      });
      /* The cursor shows the true brush diameter on the photograph. */
      wrap.addEventListener("pointermove", (ev) => {
        const dot = $("#rdpeBrushDot") as HTMLElement;
        if (!dot) return;
        const r = wrap.getBoundingClientRect();
        const size =
          brushFraction(pv().settings.brush, Math.min(wrap.clientWidth, wrap.clientHeight)) *
          Math.min(r.width, r.height);
        dot.hidden = false;
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.left = `${(ev as PointerEvent).clientX - r.left}px`;
        dot.style.top = `${(ev as PointerEvent).clientY - r.top}px`;
      });
      wrap.addEventListener("pointerleave", () => {
        const dot = $("#rdpeBrushDot") as HTMLElement;
        if (dot) dot.hidden = true;
      });
    }
    const cv = $("#rdpePrivCv") as HTMLCanvasElement;
    if (!cv) return;
    const W = Math.max(2, Math.round(ir.width));
    const H = Math.max(2, Math.round(ir.height));
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const v = pv();
    if (v.showMask) {
      paintMaskLayer(ctx, W, H, paintFromState(v.mask, v.detections), "overlay");
      /* Detected boundaries stay visible whether or not they are selected. */
      const on2 = new Set(v.mask.selectedRegions);
      v.detections.forEach((d) => {
        if (!d.box) return;
        ctx.strokeStyle = on2.has(d.id) ? "rgba(204,0,0,.95)" : "rgba(255,255,255,.75)";
        ctx.setLineDash(on2.has(d.id) ? [] : [5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(d.box.x * W, d.box.y * H, d.box.w * W, d.box.h * H);
      });
      ctx.setLineDash([]);
    }
  }

  async function runPrivacyScan() {
    const v = pv();
    if (v.scanning) return;
    v.scanning = true;
    v.scanError = null;
    paintPanel();
    try {
      const image = await renderPhoto(st());
      const res: any = await scanPrivacy({ data: { image } });
      v.detections = safeDetections((res?.detections || []) as PrivacyDetection[]);
      v.scanned = true;
      v.scanError = res?.error || null;
      if (v.detections.length) {
        v.mask = selectAll(v.mask, v.detections);
        rdToast(`${v.detections.length} Sensitive Area${v.detections.length === 1 ? "" : "s"} Found. Review Before Applying.`);
      } else {
        rdToast("Nothing Sensitive Was Detected. Use Manual Blur If Needed.");
      }
    } catch (err: any) {
      v.scanError = err?.message || "The Scan Failed. Manual Blur Still Works.";
    } finally {
      v.scanning = false;
      privacyChanged();
    }
  }

  /** Done bakes the blur into this session's pixels as an unsaved edit. */
  async function commitPrivacy() {
    const v = pv();
    const s = st();
    const p = cur();
    if (!hasPrivacySelection(v.mask, v.detections)) {
      return void rdToast("Select Or Paint An Area To Blur First.", "error");
    }
    v.baking = true;
    paintPanel();
    try {
      const baked = await bakeFromState(privacySource(s), v.mask, v.detections, v.settings, {
        quality: 0.95,
      });
      if (!baked) throw new Error("The blur could not be applied.");
      push();
      s.base = baked;
      if (!s.aiOps.includes("privacy_blur")) s.aiOps = [...s.aiOps, "privacy_blur"];
      s.dirty = true;
      saveFailed = false;
      privacyMeta.set(p.key, privacyMetadata({
        state: v.mask,
        detections: v.detections,
        settings: v.settings,
        sourceVersion: p.versionId || p.assetId || null,
      }));
      v.open = false;
      v.mask = clearStrokes({ ...v.mask, selectedRegions: [] });
      v.detections = [];
      v.scanned = false;
      privacyPreview = null;
      rdToast("Privacy Blur Applied. Save It As A Version To Keep It.");
    } catch (err: any) {
      rdToast(err?.message || "The Blur Could Not Be Applied.", "error");
    } finally {
      v.baking = false;
      paint();
    }
  }

  function resetPrivacy() {
    const v = pv();
    v.mask = clearStrokes({ ...v.mask, selectedRegions: [] });
    v.settings = { ...DEFAULT_PRIVACY_SETTINGS };
    privacyPreview = null;
    privacyChanged();
  }

  function cancelPrivacy() {
    const v = pv();
    v.open = false;
    v.mask = clearStrokes({ ...v.mask, selectedRegions: [] });
    v.detections = [];
    v.scanned = false;
    v.scanError = null;
    privacyPreview = null;
    paint();
  }

  /** Property-wide review. Nothing is ever blurred and saved without approval. */
  async function batchPrivacy() {
    const others = photos.filter((ph) => ph.key !== cur().key);
    if (!others.length) return void rdToast("There Is Only One Photo Open.", "error");
    const root = await formDialog({
      title: "Batch Privacy Review",
      body: `<p class="rdpe-hint">Each Photo Is Scanned And Opened For Your Review. Nothing Is Blurred Or Saved Until You Approve It Photo By Photo.</p>${chipList(
        others.map((ph, i) => ({ id: ph.key, label: ph.room || ph.name || `Photo ${i + 2}`, on: true })),
      )}`,
      confirmLabel: "Scan Selected Photos",
    });
    if (!root) return;
    const picked = chipValues(root);
    if (!picked.length) return;
    let found = 0;
    for (const key of picked) {
      const target = photos.find((ph) => ph.key === key);
      if (!target) continue;
      try {
        const res: any = await scanPrivacy({ data: { image: st(key).base || st(key).original } });
        const dets = safeDetections((res?.detections || []) as PrivacyDetection[]);
        const v = pv(key);
        v.detections = dets;
        v.scanned = true;
        v.mask = dets.length ? selectAll(v.mask, dets) : v.mask;
        if (dets.length) found += 1;
      } catch (_) {
        /* A failed scan simply leaves that photo to manual review. */
      }
    }
    const pending = batchBlocked(
      picked.map((k) => ({
        key: k,
        label: k,
        detections: pv(k).detections,
        reviewed: false,
        approved: false,
      })),
    );
    rdToast(
      found
        ? `${found} Photo${found === 1 ? "" : "s"} Need Review. Open Each One And Apply Privacy Blur. ${pending} Awaiting Approval.`
        : "No Sensitive Content Was Detected In The Selected Photos.",
    );
    paintPanel();
  }


  /* -------------------------------------------------------------- markup */

  function mk(key = cur().key): MarkupDoc {
    let d = markupDocs.get(key);
    if (!d) {
      const p = photos.find((x) => x.key === key);
      d = emptyDoc(key, p?.versionId || null);
      markupDocs.set(key, d);
    }
    return d;
  }

  function setMarkupDoc(doc: MarkupDoc) {
    markupDocs.set(cur().key, doc);
    st().dirty = true;
    saveFailed = false;
  }

  const markupActive = () => markupOpen && !cropMode && !pv().open;

  function markupChanged() {
    paintPanel();
    syncMarkupOverlay();
  }

  /** Keeps the vector overlay welded to the photograph through zoom and pan. */
  function syncMarkupOverlay() {
    const wrap = $("#rdpeMk") as HTMLElement;
    if (!wrap) return;
    const on = markupActive();
    wrap.hidden = !on;
    wrap.classList.toggle("draw", on && markupMode === "draw");
    if (!on) return;
    const img = $("#rdpeImg") as HTMLImageElement;
    const stage = $("#rdpeStage") as HTMLElement;
    if (!img || !stage) return;
    const ir = img.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    wrap.style.left = `${ir.left - sr.left}px`;
    wrap.style.top = `${ir.top - sr.top}px`;
    wrap.style.width = `${ir.width}px`;
    wrap.style.height = `${ir.height}px`;
    if (!markupCtl) {
      markupCtl = attachMarkupEditor(wrap, {
        doc: () => mk(),
        setDoc: (doc) => setMarkupDoc(doc),
        mode: () => markupMode,
        activeType: () => markupActiveType,
        selected: () => markupSelected,
        select: (id) => {
          markupSelected = id;
        },
        onChange: () => paintPanel(),
        imageSize: () => {
          const img = $("#rdpeImg") as HTMLImageElement | null;
          return {
            width: img?.naturalWidth || 1600,
            height: img?.naturalHeight || 1200,
          };
        },
        notify: (message) => {
          markupNotice = message;
          paintPanel();
        },
        askScale: async (pixels) => askScaleLength(pixels),
        askLabel: async (suggestion) => {
          const out = await formDialog({
            title: "Add Label",
            body: `<div class="rdpe-row"><label>Label Text</label>
              <input type="text" class="rdpe-text" id="rdpeMkLabel" value="${esc(suggestion)}" placeholder="Parking" aria-label="Label Text"></div>`,
            confirmLabel: "Add Label",
          });
          if (!out) return null;
          const field = out.querySelector("#rdpeMkLabel") as HTMLInputElement | null;
          return (field?.value || suggestion).trim() || suggestion;
        },
      });
    }
    markupCtl.repaint();
  }

  function selectedLayer() {
    return mk().layers.find((l) => l.id === markupSelected) || null;
  }


  /* ------------------------------------------- scale, measurement, parcel */

  async function askScaleLength(pixels: number): Promise<{ length: number; unit: MeasureUnit } | null> {
    const root = await formDialog({
      title: "Set Scale",
      body: `<p class="rdpe-note">You Drew A Reference Line ${Math.round(pixels)} Pixels Long. Enter What That Distance Really Measures — A Garage Door, A Driveway Width Or A Known Lot Line.</p>
        <div class="rdpe-row"><label>Real Length</label>
          <input type="number" min="0.1" step="0.1" class="rdpe-text" id="rdpeScaleLen" value="10" aria-label="Real Length"></div>
        <div class="rdpe-row"><label>Units</label>
          <select class="rdpe-text" id="rdpeScaleUnit" aria-label="Units">
            <option value="ft">Feet</option><option value="m">Metres</option>
          </select></div>`,
      confirmLabel: "Set Scale",
    });
    if (!root) return null;
    const length = Number((root.querySelector("#rdpeScaleLen") as HTMLInputElement | null)?.value || 0);
    const unit = ((root.querySelector("#rdpeScaleUnit") as HTMLSelectElement | null)?.value || "ft") as MeasureUnit;
    if (!Number.isFinite(length) || length <= 0) return null;
    return { length, unit };
  }

  function scaleCard(doc: MarkupDoc): string {
    const cal = doc.scale;
    const layer = selectedLayer();
    const measured = layer && MEASURED_TYPES.includes(layer.type) ? layerMeasurement(layer, doc) : null;
    return `
      <p class="rdpe-sub">Scale<span class="rdpe-subv">${cal ? `1 px ≈ ${cal.unitsPerPixel.toFixed(4)} ${cal.unit}` : "Not Calibrated"}</span></p>
      <p class="rdpe-hint">${cal ? "Measurements Are Approximate And Depend On This Calibration." : esc(NO_SCALE_MESSAGE)}</p>
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-ghost btn-sm ${markupMode === "calibrate" ? "on" : ""}" data-mk="calibrate"><i data-lucide="ruler"></i>${cal ? "Recalibrate Scale" : "Calibrate Scale"}</button>
        ${cal ? `<button type="button" class="btn btn-ghost btn-sm" data-mk="clearscale">Clear Scale</button>` : ""}
      </div>
      <div class="rdpe-row"><label>Camera Position</label>
        <select class="rdpe-text" data-mkpersp aria-label="Camera Position">
          ${(["unknown", "aerial", "elevated", "ground"] as ImagePerspective[])
            .map(
              (v) =>
                `<option value="${v}" ${cal?.perspective === v ? "selected" : ""}>${v === "unknown" ? "Not Stated" : v[0]!.toUpperCase() + v.slice(1)}</option>`,
            )
            .join("")}
        </select></div>
      ${cal?.perspective === "ground" ? `<p class="rdpe-clip">${esc(PERSPECTIVE_WARNING)}</p>` : ""}
      ${
        measured
          ? measured.measurements.length
            ? `<p class="rdpe-sub">Selected Measurement<span class="rdpe-subv">${esc(measured.measurements.map((m) => m.text).join(" · "))}</span></p>`
            : `<p class="rdpe-hint">${esc(measured.message || NO_SCALE_MESSAGE)}</p>`
          : ""
      }`;
  }

  function calloutCard(layer: MarkupLayer): string {
    const kind = CALLOUT_TYPES[layer.type];
    if (!kind) return "";
    const meta = (layer.meta && layer.meta.kind === kind ? layer.meta : emptyCallout(kind)) as CalloutMeta;
    const field = (name: string, label: string, value: string, ph = "") =>
      `<div class="rdpe-row"><label>${esc(label)}</label>
        <input type="text" class="rdpe-text" data-mkmeta="${esc(layer.id)}:${name}" value="${esc(value)}" placeholder="${esc(ph)}" aria-label="${esc(label)}"></div>`;
    const select = (name: string, label: string, value: string, options: string[]) =>
      `<div class="rdpe-row"><label>${esc(label)}</label>
        <select class="rdpe-text" data-mkmeta="${esc(layer.id)}:${name}" aria-label="${esc(label)}">
          ${options.map((o) => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}
        </select></div>`;
    let body = "";
    if (meta.kind === "renovation") {
      body =
        field("existingCondition", "Existing Condition", meta.existingCondition, "Worn Carpet") +
        field("proposedChange", "Proposed Change", meta.proposedChange, "Engineered Oak Flooring") +
        `<div class="rdpe-row"><label>Priority</label>
          <select class="rdpe-text" data-mkmeta="${esc(layer.id)}:priority" aria-label="Priority">
            ${PRIORITIES.map((pr) => `<option value="${pr.id}" ${meta.priority === pr.id ? "selected" : ""}>${esc(pr.label)}</option>`).join("")}
          </select></div>` +
        select("budgetCategory", "Budget Category", meta.budgetCategory, BUDGET_CATEGORIES) +
        field("scopeReference", "Scope Reference", meta.scopeReference, "SOW-04");
    } else if (meta.kind === "product") {
      body =
        field("productName", "Product", meta.productName, "Pendant Light") +
        field("retailer", "Retailer", meta.retailer || "") +
        `<div class="rdpe-row"><label>Price</label>
          <input type="number" min="0" step="1" class="rdpe-text" data-mkmeta="${esc(layer.id)}:price" value="${meta.price ?? ""}" aria-label="Price"></div>` +
        field("url", "Product Link", meta.url || "", "https://");
    } else if (meta.kind === "material") {
      body =
        select("surface", "Surface", meta.surface, SURFACES) +
        field("material", "Material", meta.material, "Honed Quartz") +
        field("color", "Colour", meta.color || "") +
        field("finish", "Finish", meta.finish || "");
    } else if (meta.kind === "before_after") {
      body = field("before", "Before", meta.before) + field("after", "After", meta.after);
    } else {
      body =
        field("scopeReference", "Scope Reference", meta.scopeReference, "SOW-04") +
        field("trade", "Trade", meta.trade || "", "Electrical") +
        field("notes", "Notes", meta.notes || "");
    }
    return `<p class="rdpe-sub">Callout Details<span class="rdpe-subv">${calloutComplete(meta) ? `${calloutDetails(meta).length} Fields` : "Empty"}</span></p>
      ${body}
      <p class="rdpe-hint">These Fields Stay Structured, So The Same Callout Feeds The Report, The Scope Export And The Presentation.</p>`;
  }

  function parcelCard(doc: MarkupDoc): string {
    const parcel = doc.parcel;
    if (!parcel) {
      return `<p class="rdpe-sub">Parcel Boundary</p>
        <p class="rdpe-hint">Import An Official Parcel Boundary From A Connected Data Provider. Boundaries Are Never Detected From The Photograph.</p>
        <div class="rdpe-autobtns">
          <button type="button" class="btn btn-ghost btn-sm" data-mk="parcelimport" ${parcelBusy ? "disabled" : ""}><i data-lucide="land-plot"></i>${parcelBusy ? "Retrieving…" : "Import Parcel Boundary"}</button>
        </div>`;
    }
    const needsAlign = requiresManualAlignment(parcel);
    return `<p class="rdpe-sub">Parcel Boundary<span class="rdpe-subv">${esc(confidenceLabel(parcel.confidence))}</span></p>
      <p class="rdpe-hint">${esc(parcel.record.provider)} · Parcel ${esc(parcel.record.parcelId)} · Retrieved ${esc(new Date(parcel.record.retrievedAt).toLocaleDateString())}${parcel.record.jurisdiction ? ` · ${esc(parcel.record.jurisdiction)}` : ""}</p>
      <p class="rdpe-clip">${esc(PARCEL_WARNING)}</p>
      <label class="rdpe-check"><input type="checkbox" data-mk="parcelwarn" ${parcel.warningAccepted ? "checked" : ""}> I Understand This Overlay Is Not A Survey</label>
      ${needsAlign ? `<p class="rdpe-hint">This Photograph Is Not Georeferenced, So The Boundary Must Be Aligned By Hand Before It Can Be Used.</p>` : ""}
      <div class="rdpe-rotrow">
        <button type="button" class="rdpe-ib ${markupMode === "parcel" ? "on" : ""}" data-mk="parcel" title="Align Parcel" aria-label="Align Parcel"><i data-lucide="move"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="rotl" title="Rotate Left" aria-label="Rotate Left"><i data-lucide="rotate-ccw"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="rotr" title="Rotate Right" aria-label="Rotate Right"><i data-lucide="rotate-cw"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="bigger" title="Scale Up" aria-label="Scale Up"><i data-lucide="maximize-2"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="smaller" title="Scale Down" aria-label="Scale Down"><i data-lucide="minimize-2"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="reset" title="Reset Alignment" aria-label="Reset Alignment"><i data-lucide="undo-2"></i></button>
        <button type="button" class="rdpe-ib" data-mkparcel="remove" title="Remove Overlay" aria-label="Remove Overlay"><i data-lucide="trash-2"></i></button>
      </div>
      <div class="rdpe-row"><label>Overlay Opacity</label>
        <input type="range" min="10" max="100" value="${Math.round((parcel.alignment.opacity ?? 0.55) * 100)}" data-mkparcelop aria-label="Overlay Opacity"></div>
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-ghost btn-sm" data-mkparcel="confirm">${parcel.alignedAt ? "Alignment Confirmed" : "Confirm Alignment"}</button>
      </div>`;
  }

  function markupCard(): string {
    const doc = mk();
    if (!markupOpen) {
      return `<p class="rdpe-note">Outline Boundaries, Parking, Access Paths, Footprints And Proposed Improvements Over This Photograph. Drawn Lines Are Visual References Only — Never Verified Legal Boundaries.</p>
        <div class="rdpe-autobtns">
          <button type="button" class="btn btn-primary btn-sm" data-act="markup"><i data-lucide="pen-tool"></i>Add Markup</button>
        </div>
        ${
          doc.layers.length
            ? `<p class="rdpe-hint">${doc.layers.length} Markup Layer${doc.layers.length === 1 ? "" : "s"} Saved On This Photo.</p>`
            : ""
        }`;
    }
    const layer = selectedLayer();
    const warn = warningRequired(doc.layers);
    return `
      <div class="rdpe-rotrow">
        <button type="button" class="rdpe-ib ${markupMode === "draw" ? "on" : ""}" data-mk="draw" title="Draw" aria-label="Draw"><i data-lucide="pen-tool"></i></button>
        <button type="button" class="rdpe-ib ${markupMode === "navigate" ? "on" : ""}" data-mk="navigate" title="Navigate Image" aria-label="Navigate Image"><i data-lucide="hand"></i></button>
        <button type="button" class="rdpe-ib ${markupMode === "calibrate" ? "on" : ""}" data-mk="calibrate" title="Calibrate Scale" aria-label="Calibrate Scale"><i data-lucide="ruler"></i></button>
        <button type="button" class="rdpe-ib" data-mk="undo" title="Undo" aria-label="Undo" ${markupCtl?.canUndo() ? "" : "disabled"}><i data-lucide="undo-2"></i></button>
        <button type="button" class="rdpe-ib" data-mk="redo" title="Redo" aria-label="Redo" ${markupCtl?.canRedo() ? "" : "disabled"}><i data-lucide="redo-2"></i></button>
        <button type="button" class="rdpe-ib" data-mk="clear" title="Clear All Markup" aria-label="Clear All Markup" ${doc.layers.length ? "" : "disabled"}><i data-lucide="trash-2"></i></button>
      </div>
      <p class="rdpe-hint">${
        markupMode === "draw"
          ? "Click To Place Points. Click The First Point Or Press Enter To Close A Shape. Escape Cancels, Backspace Removes The Last Point."
          : markupMode === "calibrate"
            ? "Click The Two Ends Of A Known Dimension, Then Enter Its Real Length."
            : markupMode === "parcel"
              ? "Drag The Parcel Overlay To Place It. Arrow Keys Nudge, Shift Nudges Further."
              : "Drawing Is Paused So You Can Zoom And Pan The Photograph."
      }</p>
      ${markupNotice ? `<p class="rdpe-clip">${esc(markupNotice)}</p>` : ""}

      <p class="rdpe-sub">Markup Type<span class="rdpe-subv">${esc(markupTypeSpec(markupActiveType).label)}</span></p>
      <div class="rdpe-ratios">${MARKUP_TYPES.map(
        (t) => `<button type="button" class="rdpe-chip ${markupActiveType === t.id ? "on" : ""}" data-mktype="${t.id}">${esc(t.label)}</button>`,
      ).join("")}</div>

      ${
        doc.layers.length
          ? `<p class="rdpe-sub">Layers<span class="rdpe-subv">${doc.layers.length}</span></p>
             <div class="rdpe-privlist">${doc.layers
               .slice()
               .reverse()
               .map(
                 (l) => `<div class="rdpe-mkrow ${l.id === markupSelected ? "on" : ""}">
                   <button type="button" class="rdpe-mkname" data-mkpick="${esc(l.id)}" title="${esc(markupTypeSpec(l.type).label)}">
                     <span class="rdpe-mkdot" style="background:${esc(l.style.stroke)}"></span>
                     <span>${esc(l.label || l.name)}</span>
                   </button>
                   <button type="button" class="rdpe-ib sm" data-mklayer="visible:${esc(l.id)}" title="Show Or Hide" aria-label="Show Or Hide"><i data-lucide="${l.visible ? "eye" : "eye-off"}"></i></button>
                   <button type="button" class="rdpe-ib sm ${l.locked ? "on" : ""}" data-mklayer="lock:${esc(l.id)}" title="Lock" aria-label="Lock"><i data-lucide="${l.locked ? "lock" : "unlock"}"></i></button>
                   <button type="button" class="rdpe-ib sm" data-mklayer="up:${esc(l.id)}" title="Bring Forward" aria-label="Bring Forward"><i data-lucide="chevron-up"></i></button>
                   <button type="button" class="rdpe-ib sm" data-mklayer="down:${esc(l.id)}" title="Send Backward" aria-label="Send Backward"><i data-lucide="chevron-down"></i></button>
                   <button type="button" class="rdpe-ib sm" data-mklayer="copy:${esc(l.id)}" title="Duplicate" aria-label="Duplicate"><i data-lucide="copy"></i></button>
                   <button type="button" class="rdpe-ib sm" data-mklayer="del:${esc(l.id)}" title="Delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
                 </div>`,
               )
               .join("")}</div>`
          : `<p class="rdpe-hint">No Markup Yet. Pick A Type And Start Drawing On The Photograph.</p>`
      }

      ${
        layer
          ? `<p class="rdpe-sub">Selected<span class="rdpe-subv">${esc(markupTypeSpec(layer.type).label)}</span></p>
             <div class="rdpe-row">
               <label>Label</label>
               <input type="text" class="rdpe-text" data-mklabel="${esc(layer.id)}" value="${esc(layer.label)}" placeholder="Parking" aria-label="Layer Label">
             </div>
             <div class="rdpe-ratios">${LABEL_SUGGESTIONS.map(
               (t) => `<button type="button" class="rdpe-chip" data-mksugg="${esc(t)}">${esc(t)}</button>`,
             ).join("")}</div>
             <p class="rdpe-sub">Colour</p>
             <div class="rdpe-ratios">${MARKUP_COLORS.map(
               (c) =>
                 `<button type="button" class="rdpe-swatch ${layer.style.stroke.toLowerCase() === c.toLowerCase() ? "on" : ""}" data-mkcolor="${c}" style="background:${c}" title="${c}" aria-label="Colour ${c}"></button>`,
             ).join("")}</div>
             <p class="rdpe-sub">Line Style</p>
             <div class="rdpe-ratios">${["solid", "dashed", "dotted"]
               .map(
                 (d) => `<button type="button" class="rdpe-chip ${layer.style.dash === d ? "on" : ""}" data-mkdash="${d}">${d[0]!.toUpperCase()}${d.slice(1)}</button>`,
               )
               .join("")}</div>
             ${mkSlider(layer.id, "strokeWidth", "Line Weight", layer.style.strokeWidth, 1, 12)}
             ${
               layer.shape === "polygon"
                 ? mkSlider(layer.id, "fillOpacity", "Fill Opacity", Math.round(layer.style.fillOpacity * 100), 0, 80, "%")
                 : ""
             }
             ${mkSlider(layer.id, "fontSize", "Label Size", layer.style.fontSize, 10, 40)}
             <div class="rdpe-rotrow">
               <button type="button" class="rdpe-ib ${layer.style.labelBackground ? "on" : ""}" data-mklayer="labelbg:${esc(layer.id)}" title="Label Background" aria-label="Label Background"><i data-lucide="square"></i></button>
               ${
                 layer.shape === "arrow"
                   ? `<button type="button" class="rdpe-ib ${layer.style.arrowHead === "both" ? "on" : ""}" data-mklayer="arrow:${esc(layer.id)}" title="Arrowheads" aria-label="Arrowheads"><i data-lucide="move-horizontal"></i></button>`
                   : ""
               }
             </div>`
          : ""
      }

      ${layer ? calloutCard(layer) : ""}
      ${scaleCard(doc)}
      ${parcelCard(doc)}

      <label class="rdpe-check"><input type="checkbox" data-mk="disclosure" ${doc.visibleDisclosure ? "checked" : ""}> Show “Approximate Boundary” On The Image</label>
      ${warn ? `<p class="rdpe-clip">${esc(MARKUP_WARNING)}</p>` : ""}
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-primary btn-sm" data-mk="done">Done</button>
        <button type="button" class="btn btn-ghost btn-sm" data-mk="cancel">Hide Markup</button>
      </div>
      <p class="rdpe-hint">0 Credits. Markup Is Kept As Editable Shapes And Only Flattened Into Downloads.</p>`;
  }

  function mkSlider(id: string, key: string, label: string, v: number, min: number, max: number, suffix = ""): string {
    return `<div class="rdpe-row">
      <label>${label}</label>
      <input type="range" data-mkset="${key}" data-mkid="${esc(id)}" min="${min}" max="${max}" step="1" value="${v}" aria-label="${label}">
      <span class="rdpe-num">${v}${suffix}</span>
    </div>`;
  }

  /** Reopen the shapes exactly as they were drawn, never as flat pixels. */
  async function loadMarkups() {
    try {
      const rows = (await listMarkups({ data: { keys: photos.map((p) => p.key).slice(0, 300) } })) as any[];
      let changed = false;
      for (const row of rows || []) {
        if (!row?.asset_key) continue;
        const doc = parseMarkup(row.document, row.asset_key);
        if (doc.layers.length) {
          markupDocs.set(row.asset_key, doc);
          changed = true;
        }
      }
      if (changed) paintPanel();
    } catch {
      /* Markup simply starts empty when the store is unreachable. */
    }
  }

  async function persistMarkup() {
    const p = cur();
    const doc = markupDocs.get(p.key);
    if (!doc) return;
    try {
      await saveMarkup({
        data: {
          asset_key: p.key,
          source_path: p.path || p.src || p.key,
          version_id: p.versionId || null,
          document: doc as any,
        },
      });
    } catch {
      /* A markup save failure must never block the photo save itself. */
    }
  }

  function privacyCard(): string {
    const v = pv();
    const s = st();
    const warn = exportWarning(v.mask, v.detections);
    const groups = [
      { id: "faces", label: "Select All Faces" },
      { id: "plates", label: "Select All Plates" },
      { id: "screens", label: "Select All Screens" },
      { id: "documents", label: "Select All Documents" },
    ];
    if (!v.open) {
      return `<p class="rdpe-note">Find Or Paint Sensitive Details And Blur Them Into A New Version. Runs On This Device — No Credit Is Ever Charged.</p>
        <div class="rdpe-autobtns">
          <button type="button" class="btn btn-primary btn-sm" data-priv="scan"><i data-lucide="scan-search"></i>Scan Photo</button>
          <button type="button" class="btn btn-ghost btn-sm" data-priv="manual"><i data-lucide="brush"></i>Manual Blur</button>
        </div>
        ${s.aiOps.includes("privacy_blur") ? '<p class="rdpe-hint">Privacy Blur Is Applied To The Image On Screen.</p>' : ""}
        <button type="button" class="rdpe-linkbtn" data-priv="batch">Batch Privacy Review…</button>`;
    }
    const sel = new Set(v.mask.selectedRegions);
    return `
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-ghost btn-sm ${v.scanning ? "busy" : ""}" data-priv="scan" ${
          v.scanning ? "disabled" : ""
        }><i data-lucide="scan-search"></i>${v.scanning ? "Scanning…" : v.scanned ? "Scan Again" : "Scan Photo"}</button>
        <button type="button" class="rdpe-linkbtn" data-priv="batch">Batch Review…</button>
      </div>
      ${v.scanError ? `<p class="rdpe-clip">${esc(v.scanError)}</p>` : ""}
      ${
        v.detections.length
          ? `<p class="rdpe-sub">Detected<span class="rdpe-subv">${sel.size} Of ${v.detections.length} Selected</span></p>
             <div class="rdpe-ratios">${groups
               .map((g) => `<button type="button" class="rdpe-chip" data-privgroup="${g.id}">${g.label}</button>`)
               .join("")}
               <button type="button" class="rdpe-chip" data-priv="none">Deselect All</button></div>
             <div class="rdpe-privlist">${v.detections
               .map(
                 (d) => `<button type="button" class="rdpe-privitem ${sel.has(d.id) ? "on" : ""}" data-privdet="${esc(d.id)}">
                   <i data-lucide="${sel.has(d.id) ? "check-square" : "square"}"></i>
                   <span>${esc(categoryLabel(d.category))}</span>
                   <em>${Math.round((d.confidence || 0) * 100)}%</em></button>`,
               )
               .join("")}</div>`
          : v.scanned
            ? '<p class="rdpe-hint">Nothing Was Detected. Paint The Areas You Want Obscured.</p>'
            : ""
      }
      <p class="rdpe-sub">Blur Type<span class="rdpe-subv">${esc(
        BLUR_TYPES.find((b) => b.id === v.settings.type)?.label || "",
      )}</span></p>
      <div class="rdpe-ratios">${BLUR_TYPES.map(
        (b) => `<button type="button" class="rdpe-chip ${v.settings.type === b.id ? "on" : ""}" data-privtype="${b.id}">${b.label}</button>`,
      ).join("")}</div>
      <p class="rdpe-hint">${esc(blurTypeNote(v.settings.type))}</p>

      <p class="rdpe-sub">Brush</p>
      <div class="rdpe-rotrow">
        <button type="button" class="rdpe-ib ${v.tool === "brush" ? "on" : ""}" data-priv="brush" title="Blur Brush" aria-label="Blur Brush"><i data-lucide="brush"></i></button>
        <button type="button" class="rdpe-ib ${v.tool === "erase" ? "on" : ""}" data-priv="erase" title="Eraser" aria-label="Eraser"><i data-lucide="eraser"></i></button>
        <button type="button" class="rdpe-ib ${v.showMask ? "on" : ""}" data-priv="showmask" title="Show Or Hide Mask" aria-label="Show Or Hide Mask"><i data-lucide="${
          v.showMask ? "eye" : "eye-off"
        }"></i></button>
        <button type="button" class="rdpe-ib" data-priv="undo" title="Undo Stroke" aria-label="Undo Stroke" ${
          v.mask.strokes.length ? "" : "disabled"
        }><i data-lucide="undo-2"></i></button>
        <button type="button" class="rdpe-ib" data-priv="redo" title="Redo Stroke" aria-label="Redo Stroke" ${
          v.mask.redo.length ? "" : "disabled"
        }><i data-lucide="redo-2"></i></button>
        <button type="button" class="rdpe-ib" data-priv="clear" title="Clear Mask" aria-label="Clear Mask"><i data-lucide="trash-2"></i></button>
      </div>
      ${privSlider("brush", "Brush Size", v.settings.brush, BRUSH_MIN, BRUSH_MAX, "px")}
      ${privSlider("strength", "Blur Strength", v.settings.strength, 1, 100, "")}
      ${privSlider("feather", "Feather", v.settings.feather, 0, 100, "")}
      ${warn ? `<p class="rdpe-clip">${esc(warn)}</p>` : ""}
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-primary btn-sm" data-priv="done" ${v.baking ? "disabled" : ""}>${
          v.baking ? "Applying…" : "Done"
        }</button>
        <button type="button" class="btn btn-ghost btn-sm" data-priv="reset">Reset</button>
        <button type="button" class="btn btn-ghost btn-sm" data-priv="cancel">Cancel</button>
      </div>
      <p class="rdpe-hint">0 Credits. Hold To Compare Reveals The Unblurred Photo While Held.</p>`;
  }

  function privSlider(key: string, label: string, v: number, min: number, max: number, suffix: string): string {
    return `<div class="rdpe-row">
      <label>${label}</label>
      <input type="range" data-privset="${key}" min="${min}" max="${max}" step="1" value="${v}" aria-label="${label}">
      <span class="rdpe-num">${v}${suffix}</span>
    </div>`;
  }

  function paint() {
    const p = cur();
    const s = st();
    const stage = $("#rdpeImg") as HTMLImageElement;
    const dk = comparing ? null : previewKey(s);
    if (!comparing) syncDetail(s);
    const src =
      dk && detailPreview?.key === dk
        ? detailPreview.url
        : comparing
          ? s.entry || s.original
          : s.base || s.original;
    if (stage && src && stage.getAttribute("src") !== src) stage.setAttribute("src", src);
    if (stage) {
      /* Privacy Blur preview shows real baked pixels, never a CSS filter. */
      const preview = comparing ? null : privacyPreview || (aiPreview ? aiPreview.image : null);
      if (preview && stage.getAttribute("src") !== preview) stage.setAttribute("src", preview);
      /* An Auto Enhance preview is a filter overlay only: the stored
         adjustments stay exactly where the user left them. */
      stage.style.filter = comparing ? "none" : filterString(previewAdj || s.adj);
      paintStageTransform();
      syncPrivacyOverlay();
      syncMarkupOverlay();
    }

    if (embedded) {
      const tag = $("#rdpeCrumb");
      if (tag) tag.textContent = opts.contextLabel || (p.versionNumber ? `Version ${p.versionNumber}` : "Source Photo");
    } else
    $("#rdpeCrumb").innerHTML = [
      esc(p.property || opts.property || "Property"),
      esc(p.room || "Photo"),
      `Photo ${index + 1} Of ${photos.length}`,
    ]
      .map((t) => `<span>${t}</span>`)
      .join('<i data-lucide="chevron-right"></i>');

    $("#rdpeUndo").toggleAttribute("disabled", !s.history.length);
    $("#rdpeRedo").toggleAttribute("disabled", !s.future.length);
    /* A failed save stays actionable: the primary button becomes the retry. */
    $("#rdpeSave").toggleAttribute("disabled", (!s.dirty && !saveFailed) || s.saving);
    $("#rdpeSaveCopy").toggleAttribute("disabled", !hasEdits(s) || s.saving);
    $("#rdpeReset").toggleAttribute("disabled", !hasEdits(s));
    $("#rdpeSave").textContent = s.saving
      ? "Saving…"
      : saveFailed
        ? "Retry Save"
        : primarySaveLabel({ mode: modeFor(p) });
    const edited = hasEdits(s) || !!aiPreview || !!privacyPreview;
    const hold = $("#rdpeHold") as HTMLButtonElement;
    if (hold) {
      /* Nothing to compare against until an edit exists: the control hides
         rather than sitting there disabled. */
      const on = compareEnabled(edited) && showCompareControl(edited);
      hold.hidden = !on;
      hold.toggleAttribute("disabled", !on);
      hold.title = "Hold To Compare With The Editor Original";
    }
    /* The badge names the image on screen, never the selected tool. */
    applyCanvasBadge(
      host.querySelector(".rdpe-badge") || document.querySelector(".rdpe-badge"),
      resolveCanvasBadge({
        comparing,
        saving: s.saving,
        saveFailed,
        hasEdits: edited,
        generated: modeFor(p) === "generated",
      }),
    );
    const prov = $("#rdpeProv");
    if (prov) {
      const line = modeFor(p) === "generated" ? editedFromLabel(p.versionNumber ?? null) : null;
      prov.textContent = line || "";
      prov.classList.toggle("on", !!line);
    }
    host.classList.toggle("rdpe-crop", cropMode);
    host.classList.toggle("rdpe-compare", comparing);

    const strip = $("#rdpeStrip");
    if (strip) strip.innerHTML = photos
      .map((ph, i) => {
        const ps = states.get(ph.key);
        const badge = ps?.dirty ? "unsaved" : ps && hasEdits(ps) ? "edited" : "";
        return `<button type="button" class="rdpe-thumb ${i === index ? "on" : ""} ${badge}"
          data-go="${i}" aria-current="${i === index}" title="${esc(ph.room || ph.name || "Photo " + (i + 1))}">
          <img src="${esc(ps?.base || ph.src || "")}" alt="" loading="lazy">
          <em>${i + 1}</em>${badge ? `<span class="rdpe-dot ${badge}"></span>` : ""}
        </button>`;
      })
      .join("");

    paintPanel();
    try {
      createIcons({ icons, nameAttr: "data-lucide", root: host as any });
    } catch {
      /* noop */
    }
  }

  function sliderRow(o: {
    key: string;
    label: string;
    v: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    attr: string;
  }) {
    const sign = o.v > 0 && o.min < 0 ? "+" : "";
    return `<div class="rdpe-slider">
      <span>${o.label}</span>
      <b class="rdpe-num">${sign}${o.v}${o.suffix || ""}</b>
      <button type="button" class="rdpe-rst" ${o.attr}="${o.key}" aria-label="Reset ${o.label}"
        ${o.v === 0 ? "disabled" : ""}><i data-lucide="rotate-ccw"></i></button>
      <input type="range" min="${o.min}" max="${o.max}" step="${o.step ?? 1}" value="${o.v}"
        data-${o.attr === "data-reset-adj" ? "adj" : "geo"}="${o.key}"
        aria-label="${o.label}" title="Double-Click To Reset">
    </div>`;
  }

  function adjRows(group: string) {
    const s = st();
    return ADJUSTMENTS.filter((a) => a.group === group)
      .map((a) =>
        sliderRow({
          key: a.key,
          label: a.label,
          v: n(s.adj[a.key], 0),
          min: a.min,
          max: a.max,
          attr: "data-reset-adj",
        }),
      )
      .join("");
  }

  function autoCard() {
    const s = st();
    const applied = !!s.auto;
    const chips = STRENGTHS.map(
      (x) =>
        `<button type="button" class="rdpe-chip ${autoStrength === x.id ? "on" : ""}" data-auto-strength="${x.id}"
          ${autoBusy ? "disabled" : ""}>${x.label}</button>`,
    ).join("");
    const status = autoBusy
      ? "Analyzing The Photograph…"
      : applied
        ? `Applied — ${STRENGTHS.find((x) => x.id === s.auto?.strength)?.label} Strength`
        : autoPreview
          ? "Previewing. Apply To Keep It."
          : "";
    return `<div class="rdpe-autocard">
      <p class="rdpe-note">Automatically balance lighting, color, and detail.</p>
      <div class="rdpe-ratios" role="group" aria-label="Auto Enhance Strength">${chips}</div>
      ${status ? `<p class="rdpe-note rdpe-autostate">${status}</p>` : ""}
      <div class="rdpe-autobtns">
        <button type="button" class="btn btn-ghost btn-sm" data-act="autopreview" ${autoBusy ? "disabled" : ""}>
          <i data-lucide="eye"></i>Preview</button>
        <button type="button" class="btn btn-primary btn-sm" data-act="autoapply" ${autoBusy ? "disabled" : ""}>
          <i data-lucide="check"></i>Apply</button>
        ${
          applied
            ? `<button type="button" class="btn btn-ghost btn-sm" data-act="autoundo"><i data-lucide="undo-2"></i>Undo Auto Enhance</button>`
            : ""
        }
      </div>
      <p class="rdpe-note">Bounded, Scene Aware And Free. Windows, White Cabinetry And Reflective Surfaces Are Protected, And Applying It Twice Gives The Same Result.</p>
    </div>`;
  }

  function histogramBlock() {
    const warn = clippingWarning(stats);
    return `<details class="rdpe-hist" data-sec="hist"${OPEN.has("hist") ? " open" : ""}>
      <summary><i data-lucide="bar-chart-3"></i>Histogram<i data-lucide="chevron-down" class="rdpe-caret"></i></summary>
      <div class="rdpe-histb">
        <canvas id="rdpeHistCanvas" width="256" height="64" aria-label="Live Histogram Of The Current Preview"></canvas>
        ${warn ? `<p class="rdpe-clip"><i data-lucide="triangle-alert"></i>${warn}</p>` : ""}
      </div>
    </details>`;
  }

  function paintPanel() {
    const s = st();
    const traits = detectPhotoTraits(cur());
    const ops = photoEnhancements(traits);
    const opBtn = (o: { op: string; label: string; icon: string; credits: number }) =>
      `<button type="button" class="rdpe-aiop ${s.aiOps.includes(o.op) ? "on" : ""} ${
        aiBusy === o.op ? "busy" : ""
      }" data-ai="${o.op}" ${aiBusy ? "disabled" : ""}>
        <i data-lucide="${o.icon}"></i><span>${o.label}</span>
        ${
          aiBusy === o.op
            ? '<em class="rdpe-run">Working…</em>'
            : `<em class="rdpe-cost">${o.credits} Credit${o.credits === 1 ? "" : "s"}</em>`
        }
      </button>`;

    $("#rdpePanelBody").innerHTML = `
      ${section("auto", "Auto Enhance", "wand-sparkles", autoCard())}

      ${section(
        "light",
        "Light & Color",
        "sun",
        `${histogramBlock()}
         <p class="rdpe-sub">Light</p>${adjRows("light")}
         <p class="rdpe-sub">Color</p>${adjRows("color")}`,
      )}

      ${section("detail", "Detail", "focus", adjRows("detail"))}

      ${section(
        "crop",
        "Crop & Geometry",
        "crop",
        `<p class="rdpe-sub">Crop Ratio<span class="rdpe-subv">${esc(
          RATIOS.find((r) => r.id === (s.crop?.ratio || "original"))?.label || "Original",
        )}</span></p>
        <div class="rdpe-ratios">${RATIOS.filter((r) => r.group === "basic")
          .map(
            (r) =>
              `<button type="button" class="rdpe-chip ${
                (s.crop?.ratio || "original") === r.id ? "on" : ""
              }" data-ratio="${r.id}">${r.label}</button>`,
          )
          .join("")}</div>
        <p class="rdpe-sub">MLS Presets</p>
        <div class="rdpe-ratios">${RATIOS.filter((r) => r.group === "mls")
          .map(
            (r) =>
              `<button type="button" class="rdpe-chip ${
                (s.crop?.ratio || "original") === r.id ? "on" : ""
              }" data-ratio="${r.id}" title="${esc(r.note || "")}">${r.label}</button>`,
          )
          .join("")}</div>
        ${
          cropMode && cropView
            ? `<div class="rdpe-zoomrow">
                <div class="rdpe-zoomhead">
                  <span>Crop Zoom</span>
                  <button type="button" class="rdpe-linkbtn" data-act="cropreset">Reset Position</button>
                </div>
                <input type="range" data-cropzoom min="${(cropMinScale() * 100).toFixed(0)}"
                  max="${(MAX_CROP_ZOOM * 100).toFixed(0)}" step="1"
                  value="${(cropView.scale * 100).toFixed(0)}" aria-label="Crop Zoom">
                <span class="rdpe-num">${Math.round(cropView.scale * 100)}%</span>
              </div>
              <p class="rdpe-hint">Drag The Photo To Reposition It Inside The Crop.</p>`
            : ""
        }
        ${
          cropMode
            ? `<div class="rdpe-autobtns">
                <button type="button" class="btn btn-primary btn-sm" data-act="cropapply">Apply Crop</button>
                <button type="button" class="btn btn-ghost btn-sm" data-act="cropcancel">Cancel</button>
               </div>`
            : ""
        }

        <p class="rdpe-sub">Rotate And Flip</p>
        <div class="rdpe-rotrow">
          <button type="button" class="rdpe-ib" data-act="rotl" title="Rotate Left" aria-label="Rotate Left"><i data-lucide="rotate-ccw"></i></button>
          <button type="button" class="rdpe-ib" data-act="rotr" title="Rotate Right" aria-label="Rotate Right"><i data-lucide="rotate-cw"></i></button>
          <button type="button" class="rdpe-ib ${s.flipH ? "on" : ""}" data-act="flip" title="Flip Horizontal" aria-label="Flip Horizontal"><i data-lucide="flip-horizontal"></i></button>
          <button type="button" class="rdpe-ib ${s.flipV ? "on" : ""}" data-act="flipv" title="Flip Vertical" aria-label="Flip Vertical"><i data-lucide="flip-vertical"></i></button>
          <button type="button" class="rdpe-ib ${cropMode ? "on" : ""}" data-act="cropmode" title="Adjust Crop" aria-label="Adjust Crop"><i data-lucide="crop"></i></button>
        </div>
        <p class="rdpe-sub">Perspective</p>
        ${GEOMETRY.map((gm) =>
          sliderRow({
            key: gm.key,
            label: gm.label,
            v: n((s as any)[gm.key], 0),
            min: gm.min,
            max: gm.max,
            step: gm.step,
            suffix: "°",
            attr: "data-reset-geo",
          }),
        ).join("")}
        <p class="rdpe-sub">Lens</p>
        ${adjRows("lens")}
        <button type="button" class="rdpe-reset rdpe-resetgeo" data-act="resetgeo" ${
          hasGeometry(s) ? "" : "disabled"
        }><i data-lucide="rotate-ccw"></i><span>Reset Geometry</span></button>`,
      )}

      ${section(
        "ai",
        "AI Enhancements",
        "sparkles",
        `<p class="rdpe-note">Real Estate Corrections That Run On The Server. Nothing Runs Automatically, And Every Result Is Saved As A New Version.</p>
         <div class="rdpe-ai">${ops.map(opBtn).join("")}</div>
         <button type="button" class="rdpe-cont" data-continue="object">
           <i data-lucide="mouse-pointer-square-dashed"></i>
           <span><b>Continue In Object Edit</b><em>Select, remove, replace, or modify a specific object.</em></span>
           <i data-lucide="arrow-right"></i></button>`,
      )}

      ${section("privacy", "Privacy", "shield", privacyCard())}

      ${section("markup", "Markup", "pen-tool", markupCard())}

      ${section(
        "presets",
        "Presets & Batch",
        "layers",
        presetsCard(),
      )}

      ${section(
        "continue",
        "Continue With",
        "arrow-right-circle",
        `<p class="rdpe-note">Keeps This Photo And Version. Nothing Generates And No Credit Is Spent Until You Review The Settings.</p>
         ${continueWithTools()
           .map(
             (t) => `<button type="button" class="rdpe-cont" data-continue="${esc(t.tool)}">
             <i data-lucide="${t.icon}"></i>
             <span><b>${esc(t.label)}</b><em>${esc(t.blurb)}</em></span>
             <i data-lucide="arrow-right"></i></button>`,
           )
           .join("")}`,
      )}

      ${
        aiPreview
          ? `<div class="rdpe-aipreview"><b>${esc(aiPreview.label)} Preview</b>
              <div class="rdpe-aibtns">
                <button type="button" class="btn btn-primary btn-sm" data-act="aiapply">Apply</button>
                <button type="button" class="btn btn-ghost btn-sm" data-act="aicancel">Discard</button>
              </div></div>`
          : ""
      }`;
    try {
      createIcons({ icons, nameAttr: "data-lucide", root: $("#rdpePanelBody") as any });
    } catch {
      /* noop */
    }
    drawHistogram();
  }

  /* --------------------------------------------- adjustments & presets */

  function bundleOf(s: PhotoState): AdjustmentBundle {
    return {
      adj: { ...s.adj },
      straighten: s.straighten || 0,
      vertical: s.vertical || 0,
      horizontal: s.horizontal || 0,
      flipH: !!s.flipH,
      flipV: !!s.flipV,
      rotation: s.rotation || 0,
      crop: s.crop || null,
    };
  }

  function applyBundle(bundle: AdjustmentBundle, includeGeometry: boolean, includeCrop: boolean) {
    push();
    const s = st();
    const merged = mergeBundle(
      {
        adj: s.adj,
        straighten: s.straighten,
        vertical: s.vertical,
        horizontal: s.horizontal,
        flipH: s.flipH,
        flipV: s.flipV,
        rotation: s.rotation,
        crop: s.crop,
      },
      bundle,
      { includeGeometry, includeCrop },
    ) as any;
    Object.assign(s, merged);
    paint();
    void refreshStats();
  }

  function presetsCard() {
    const saved = listPresets();
    return `
      <div class="rdpe-actions">
        <button type="button" class="rdpe-act" data-act="copyadj"><i data-lucide="copy"></i>Copy Adjustments</button>
        <button type="button" class="rdpe-act" data-act="pasteadj" ${copied ? "" : "disabled"}><i data-lucide="clipboard-paste"></i>Paste Adjustments</button>
        <button type="button" class="rdpe-act" data-act="pastesel" ${copied ? "" : "disabled"}><i data-lucide="list-checks"></i>Paste Selected…</button>
        <button type="button" class="rdpe-act" data-act="savepreset"><i data-lucide="bookmark-plus"></i>Save Preset</button>
        <button type="button" class="rdpe-act" data-act="batch" ${photos.length > 1 ? "" : "disabled"}><i data-lucide="images"></i>Batch Edit…</button>
        <button type="button" class="rdpe-act" data-act="batchauto" ${photos.length > 1 ? "" : "disabled"}><i data-lucide="wand-sparkles"></i>Auto Enhance Photos…</button>
        ${lastBatch && changedPhotos(lastBatch).length ? `<button type="button" class="rdpe-act" data-act="batchundo"><i data-lucide="undo-2"></i>Undo Last Batch</button>` : ""}
      </div>
      ${
        saved.length
          ? `<div class="rdpe-presets">${saved
              .map(
                (r) =>
                  `<div class="rdpe-preset"><button type="button" class="rdpe-chip" data-preset="${esc(r.id)}">${esc(
                    r.name,
                  )}</button><button type="button" class="rdpe-x" data-preset-del="${esc(
                    r.id,
                  )}" aria-label="Delete ${esc(r.name)}"><i data-lucide="x"></i></button></div>`,
              )
              .join("")}</div>`
          : `<p class="rdpe-hint">Save The Current Light, Colour And Detail Settings To Reuse Them On Another Photograph.</p>`
      }`;
  }

  function section(id: string, label: string, icon: string, body: string) {
    const open = OPEN.has(id) ? " open" : "";
    return `<details class="rdpe-sec" data-sec="${id}"${open}>
      <summary><i data-lucide="${icon}"></i>${label}<i data-lucide="chevron-down" class="rdpe-caret"></i></summary>
      <div class="rdpe-secb">${body}</div>
    </details>`;
  }
  const OPEN = new Set<string>(defaultOpenSections());

  /* ------------------------------------------------- analysis & histogram */

  /** Downsample the given image (optionally through a filter) and measure it. */
  async function measure(src: string, adj: Adj | null): Promise<PhotoStats | null> {
    try {
      const img = await loadImage(src);
      const w = 180;
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w)) || 120;
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const c = cv.getContext("2d", { willReadFrequently: true });
      if (!c) return null;
      if (adj) (c as any).filter = filterString(adj);
      c.drawImage(img, 0, 0, w, h);
      return analyzeImageData(c.getImageData(0, 0, w, h).data);
    } catch {
      return null;
    }
  }

  /** Measure the untouched image once per source: keeps Auto Enhance idempotent. */
  async function baseStats(): Promise<PhotoStats | null> {
    const s = st();
    const src = s.base || s.original;
    if (!src) return null;
    if (sourceStats?.src === src) return sourceStats.stats;
    const measured = await measure(src, null);
    if (measured) sourceStats = { src, stats: measured };
    return measured;
  }

  function drawHistogram() {
    const cv = host.querySelector("#rdpeHistCanvas") as HTMLCanvasElement | null;
    if (!cv || !stats) return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#ececed";
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#4a4b52";
    stats.histogram.forEach((v, i) => {
      const bh = Math.round(Math.sqrt(v) * cv.height);
      c.fillRect(i, cv.height - bh, 1, bh);
    });
    if (stats.clippedShadows > 0.02) {
      c.fillStyle = "rgba(204,0,0,.35)";
      c.fillRect(0, 0, 4, cv.height);
    }
    if (stats.clippedHighlights > 0.02) {
      c.fillStyle = "rgba(204,0,0,.35)";
      c.fillRect(cv.width - 4, 0, 4, cv.height);
    }
  }

  let statsTimer: ReturnType<typeof setTimeout> | null = null;
  /** Recompute the histogram from what is actually on screen. Never edits. */
  function refreshStats(immediate = false) {
    if (statsTimer) clearTimeout(statsTimer);
    const run = async () => {
      const s = st();
      const src = (aiPreview?.image || s.base || s.original) as string | null;
      if (!src) return;
      stats = await measure(src, s.adj);
      const warn = clippingWarning(stats);
      const box = host.querySelector(".rdpe-histb");
      const line = box?.querySelector(".rdpe-clip");
      if (box) {
        if (warn && !line) {
          const p = document.createElement("p");
          p.className = "rdpe-clip";
          p.textContent = warn;
          box.appendChild(p);
        } else if (warn && line) line.textContent = warn;
        else line?.remove();
      }
      drawHistogram();
    };
    if (immediate) void run();
    else statsTimer = setTimeout(run, 180);
  }

  /* ----------------------------------------------------------- auto enhance */

  /** Compute the correction for the current photo at the current strength. */
  async function computeAuto(): Promise<Adj | null> {
    autoBusy = true;
    paintPanel();
    try {
      const measured = await baseStats();
      if (!measured) return null;
      return autoEnhanceAdjustments(measured, autoStrength);
    } finally {
      autoBusy = false;
    }
  }

  /**
   * Auto Enhance is layered on the adjustments the user made themselves, so
   * running it twice (or at another strength) replaces its own contribution
   * instead of stacking on top of it.
   */
  function layerAuto(values: Adj) {
    const s = st();
    const base = s.autoBase ?? { ...s.adj };
    s.autoBase = base;
    s.adj = { ...base };
    for (const [k, v] of Object.entries(values)) {
      s.adj[k] = Math.round(clampAdj(k, n(base[k], 0) + v) * 10) / 10;
    }
  }

  function clampAdj(key: string, v: number): number {
    const def = ADJUSTMENTS.find((a) => a.key === key);
    return Math.max(def?.min ?? -100, Math.min(def?.max ?? 100, v));
  }

  async function runAutoEnhance(apply: boolean) {
    const values = await computeAuto();
    if (!values) {
      rdToast("That Photo Could Not Be Analyzed.", "error");
      return paintPanel();
    }
    const s = st();
    if (apply) {
      push();
      layerAuto(values);
      s.auto = { strength: autoStrength, values };
      autoPreview = false;
      rdToast("Auto Enhance Applied.");
    } else {
      /* Preview leaves the saved state alone: nothing is pushed to history. */
      const before = { ...s.adj };
      layerAuto(values);
      autoPreview = true;
      const preview = { ...s.adj };
      s.adj = before;
      s.autoBase = s.auto ? s.autoBase : null;
      previewAdj = preview;
      applyPreviewFilter();
      paintPanel();
      refreshStats();
      return;
    }
    previewAdj = null;
    paint();
    refreshStats();
  }

  /** A preview overlays the filter only — the stored adjustments never move. */
  function applyPreviewFilter() {
    const img = $("#rdpeImg") as HTMLImageElement;
    if (img && previewAdj) img.style.filter = filterString(previewAdj);
  }

  function undoAuto() {
    const s = st();
    if (!s.auto) return;
    push();
    s.adj = { ...(s.autoBase || {}) };
    s.auto = null;
    s.autoBase = null;
    autoPreview = false;
    previewAdj = null;
    paint();
    refreshStats();
  }

  function resetGeometry() {
    const s = st();
    push();
    s.crop = null;
    s.rotation = 0;
    s.straighten = 0;
    s.vertical = 0;
    s.horizontal = 0;
    s.flipH = false;
    s.flipV = false;
    cropMode = false;
    cropView = null;
    paint();
    paintCropBox();
  }


  /* ---------------------------------------------------------------- crop */

  /* The frame is stationary; the photograph is dragged behind it. Everything
     the interaction needs is derived from the viewport, the image's layout box
     and the crop state — never from the live (already transformed) rect. */

  /** The smallest zoom at which the photograph still covers the frame. */
  function cropMinScale(): number {
    return cropView ? minCoverScale(cropView.frame, baseBox()) : 1;
  }

  function viewBox(): CropBox {
    const stageEl = $("#rdpeStage");
    const r = stageEl?.getBoundingClientRect();
    return { w: Math.max(1, r?.width || 1), h: Math.max(1, r?.height || 1) };
  }

  /** The image's untransformed layout box, with quarter rotations swapped. */
  function baseBox(): CropBox {
    const img = $("#rdpeImg") as HTMLImageElement;
    const s = st();
    const w = Math.max(1, img?.offsetWidth || 1);
    const h = Math.max(1, img?.offsetHeight || 1);
    const quarter = ((s.rotation % 360) + 360) % 360;
    return quarter === 90 || quarter === 270 ? { w: h, h: w } : { w, h };
  }

  function ratioAspect(id: string, base: CropBox): number {
    if (id === "original" || id === "free") return base.w / base.h;
    return cropPreset(id)?.v || base.w / base.h;
  }

  function syncCrop(record = true) {
    const s = st();
    if (!cropView) return;
    const base = baseBox();
    const view = viewBox();
    const o = clampOffset(cropView, base, view);
    cropView = { ...cropView, ...o, ...focalOf({ ...cropView, ...o }, base, view) };
    if (record) {
      const rect = cropRect(cropView, base, view);
      s.crop = { ...rect, ratio: cropView.ratio };
      saveFailed = false;
      s.dirty = true;
    }
    paintCropBox();
    paintStageTransform();
  }

  /** The image transform while cropping: the base geometry, then the pan/zoom. */
  function paintStageTransform() {
    const img = $("#rdpeImg") as HTMLImageElement;
    if (!img) return;
    const s = st();
    if (comparing) {
      img.style.transform = "none";
      return;
    }
    const pan =
      cropMode && cropView
        ? `translate(${cropView.offsetX.toFixed(2)}px, ${cropView.offsetY.toFixed(2)}px) scale(${cropView.scale.toFixed(4)}) `
        : "";
    img.style.transform = `${pan}${transformString(s)}`;
  }

  function setRatio(id: string) {
    const s = st();
    push();
    if (id === "original" && !cropMode) {
      s.crop = null;
      cropView = null;
      paint();
      return paintCropBox();
    }
    cropMode = true;
    const base = baseBox();
    const view = viewBox();
    const focal = cropView ? { focalX: cropView.focalX, focalY: cropView.focalY } : undefined;
    cropView = createCrop(id, ratioAspect(id, base), base, view, focal);
    cropHinted = false;
    syncCrop();
    paint();
  }

  function resetCropPosition() {
    if (!cropView) return;
    const base = baseBox();
    const view = viewBox();
    cropView = createCrop(cropView.ratio, ratioAspect(cropView.ratio, base), base, view);
    syncCrop();
    paint();
  }

  function setCropZoom(v: number) {
    if (!cropView) return;
    cropView = zoomTo(cropView, baseBox(), viewBox(), v);
    syncCrop();
  }

  function paintCropBox() {
    const box = $("#rdpeCropBox");
    const stage = $("#rdpeStage");
    if (!box) return;
    stage?.classList.toggle("rdpe-cropping", !!(cropMode && cropView));
    if (!cropMode || !cropView) {
      box.style.display = "none";
      box.classList.remove("acting");
      const hint = $("#rdpeCropHint");
      if (hint) hint.hidden = true;
      return;
    }
    box.style.display = "block";
    box.style.left = `${cropView.frame.x}px`;
    box.style.top = `${cropView.frame.y}px`;
    box.style.width = `${cropView.frame.width}px`;
    box.style.height = `${cropView.frame.height}px`;
    box.classList.toggle("free", cropView.ratio === "free");
    const hint = $("#rdpeCropHint");
    if (hint) hint.hidden = cropHinted;
  }

  /** Drag inside the frame moves the photograph; a handle resizes the frame. */
  function dragCrop(e: PointerEvent) {
    if (!cropMode || !cropView) return;
    const handle = (e.target as HTMLElement).getAttribute("data-h");
    if (handle && cropView.ratio !== "free") return;
    e.preventDefault();
    const box = $("#rdpeCropBox");
    const base = baseBox();
    const view = viewBox();
    const start = { px: e.clientX, py: e.clientY, ...cropView };
    let moved = false;
    push();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer capture is a nicety, not a requirement */
    }
    box?.classList.add("acting");
    const move = (ev: PointerEvent) => {
      if (!cropView) return;
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (handle) {
        cropView = { ...cropView, frame: resizeFrame(start.frame, handle, dx, dy, view) };
        cropView = refit(cropView, 0, base, view);
      } else {
        cropView = { ...cropView, offsetX: start.offsetX + dx, offsetY: start.offsetY + dy };
      }
      syncCrop();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      try {
        (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
      } catch {
        /* noop */
      }
      box?.classList.remove("acting");
      if (moved && !handle) cropHinted = true;
      paint();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }


  /* ------------------------------------------------------------ AI edits */

  async function runAi(op: string) {
    if (aiBusy) return;
    /* Privacy Blur is a local, free tool — it never reaches the credit path. */
    if (op === "privacy_blur") {
      pv().open = true;
      return paintPanel();
    }
    const meta = enhancementByOp(op);
    if (!meta) return;
    /* Nothing that spends a credit or rewrites the scene runs from one click. */
    const ok = await confirmDialog({
      title: meta.requiresTarget ? `Confirm ${meta.label}` : `Run ${meta.label}?`,
      body: meta.requiresTarget
        ? `${meta.label} Works On The Area Currently In View. Confirm The Target Before It Runs. Your Current Image Is Kept If Anything Fails.`
        : `${meta.label} Runs On The Server And Returns A Preview You Can Apply Or Discard.`,
      notes: [`Cost: ${meta.credits} Credit${meta.credits === 1 ? "" : "s"}.`],
      confirmLabel: `Use ${meta.credits} Credit${meta.credits === 1 ? "" : "s"}`,
    });
    if (!ok) return;
    let instruction = "";
    aiBusy = op;
    paint();
    try {
      const image = await renderPhoto(st());
      const res: any = await runPhotoEdit({
        data: {
          family: "property",
          op,
          image,
          room: cur().room || "Living Room",
          direction: "Warm Minimal",
          ...(instruction ? { instruction } : {}),
        },
      });
      aiPreview = { op, label: meta.label, image: res.image };
      rdToast(`${meta.label} Preview Ready. Apply Or Discard.`);
    } catch (err: any) {
      rdToast(err?.message || "That Edit Could Not Be Completed.", "error");
    } finally {
      aiBusy = "";
      paint();
    }
  }

  function applyAi() {
    if (!aiPreview) return;
    const s = st();
    push();
    s.base = aiPreview.image;
    s.aiOps = [...s.aiOps, aiPreview.op];
    s.adj = {};
    s.crop = null;
    s.rotation = 0;
    s.straighten = 0;
    s.flipH = false;
    aiPreview = null;
    paint();
  }

  /* ---------------------------------------------------------------- save */

  /**
   * Render one photograph and write a durable edited version for it. Shared by
   * the single Save button and by Batch Edit, so a batch produces exactly the
   * same kind of version a manual save does — one per photograph.
   */
  async function savePhotoState(
    p: EditorPhoto,
    s: PhotoState,
    asCopy: boolean,
  ): Promise<{ path: string; dataUrl: string; row: any }> {
    const dataUrl = await renderPhoto(s);
    const path = await uploadRenderDataUrl(dataUrl);
    const row = await savePhotoEdit({
      data: {
        asset_key: p.key,
        source_path: p.path || p.src || p.key,
        adjustments: s.adj,
        crop: s.crop,
        rotation: s.rotation,
        flip_h: s.flipH,
        geometry: {
          straighten: s.straighten || 0,
          vertical: s.vertical || 0,
          horizontal: s.horizontal || 0,
          flip_v: !!s.flipV,
        },
        modification_class: classifyEdits({
          aiOps: s.aiOps,
          hasAdjustments:
            Object.values(s.adj || {}).some((v) => Number(v) !== 0) || !!s.crop || !!s.rotation,
        }),
        ai_ops: s.aiOps,
        ...(privacyMeta.get(p.key)
          ? { privacy: { ...privacyMeta.get(p.key)!, result_path: path } }
          : {}),
        edited_path: path,
        label: p.room || p.name || null,
        as_copy: asCopy,
        editor_mode: modeFor(p),
        parent_asset_key: p.versionId || p.parentVersionId || p.assetId || null,
      },
    });
    return { path, dataUrl, row };
  }

  async function save(asCopy: boolean) {
    const p = cur();
    const s = st();
    if (s.saving) return;
    s.saving = true;
    saveFailed = false;
    paint();
    try {
      const { path, dataUrl } = await savePhotoState(p, s, asCopy);
      await persistMarkup();
      s.dirty = false;

      rdToast(
        asCopy
          ? "Saved As A Copy."
          : modeFor(p) === "generated"
            ? "Saved As A New Version."
            : "Photo Saved.",
      );
      /* A prepared source photo asks which image generation should consume. */
      let useEdited = defaultGenerationSource(modeFor(p)) === "edited";
      if (!asCopy && modeFor(p) === "source") {
        useEdited = !!(await confirmDialog({
          title: "Use This Edit For Generation?",
          body: "The Original Upload Is Kept Either Way.",
          confirmLabel: "Use Edited Photo",
          cancelLabel: "Keep Original As Source",
        }));
      }
      opts.onSaved?.({ key: p.key, path, dataUrl, copy: asCopy, useEdited });
    } catch (err: any) {
      saveFailed = true;
      rdToast(err?.message || "That Photo Could Not Be Saved.", "error");
    } finally {
      s.saving = false;
      paint();
    }
  }

  async function download(preview = false) {
    const s0 = st();
    const p = cur();
    /* Never let a photo leave with sensitive content the user hasn't handled. */
    const privWarn = exportWarning(pv().mask, pv().detections);
    if (privWarn) {
      const go = await confirmDialog({
        title: "Unblurred Sensitive Areas",
        body: `${privWarn} They Will Be Visible In The Downloaded File.`,
        confirmLabel: "Download Anyway",
        cancelLabel: "Back To Privacy Blur",
      });
      if (!go) {
        pv().open = true;
        return paintPanel();
      }
    }
    const hasAdjustments =
      Object.values(s0.adj || {}).some((v) => Number(v) !== 0) || !!s0.crop || !!s0.rotation;
    const cropArea = s0.crop ? Math.max(0, s0.crop.w) * Math.max(0, s0.crop.h) : null;
    const review = qualityReview({ stats, adj: s0.adj, cropArea });
    try {
      /* The clean master leaves the editor untouched; the disclosure is baked
         only into the exported copy by the shared export system. */
      const clean0 = await renderPhoto(s0, { quality: 0.96 });
      /* Markup is flattened into the exported copy only; the editor keeps the
         shapes and the clean master untouched. */
      const doc = mk();
      const marked = doc.layers.some((l) => l.visible);
      const clean = marked ? await flattenMarkup(clean0, doc, { quality: 0.96 }) : clean0;
      const ok = await openDisclosureExport({
        items: [
          {
            id: p.key,
            name: p.room || p.name || "photo",
            src: clean,
            operations: [
              ...s0.aiOps,
              ...(hasAdjustments ? ["adjust"] : []),
              ...(s0.crop ? ["crop"] : []),
              ...(marked ? ["markup"] : []),
            ],
            hasAdjustments,
            assetId: p.assetId || p.key || null,
            versionId: p.versionId || null,
          },
        ],
        purpose: "listing",
        scope: "current-photo",
        title: "Download Photo",
        notes: [
          ...review.map((r) => r.message),
          ...(marked && warningRequired(doc.layers) ? [MARKUP_WARNING] : []),
        ],
      });
      if (ok && preview) rdToast("Preview Downloaded.");
    } catch (err: any) {
      rdToast(err?.message || "That Photo Could Not Be Downloaded.", "error");
    }
  }

  /* ------------------------------------------------- copy / paste / batch */

  /** Copy never carries masks, crop position or AI results. */
  function copyCurrentAdjustments() {
    const s = st();
    const p = cur();
    clipboard = bundleOf(s);
    copied = copyAdjustments({
      key: p.key,
      label: p.room || p.name || "Photo",
      adj: s.adj,
      look: null,
      rotation: s.rotation,
      flipH: s.flipH,
      flipV: s.flipV,
      straighten: s.straighten,
      vertical: s.vertical,
      horizontal: s.horizontal,
      crop: s.crop,
      aiOps: s.aiOps,
    });
    paintPanel();
    rdToast("Adjustments Copied. Masks, Crop Position And AI Changes Stay With Their Own Photo.");
  }

  /** Merge a paste result into one photo state. */
  function mergePaste(target: PhotoState, out: ReturnType<typeof applyCopied>) {
    target.adj = { ...out.adj };
    target.rotation = out.rotation;
    target.flipH = out.flipH;
    target.flipV = out.flipV;
    target.straighten = out.straighten;
    target.vertical = out.vertical;
    target.horizontal = out.horizontal;
    if (out.cropRatio && target.crop) target.crop = { ...target.crop, ratio: out.cropRatio };
    target.dirty = true;
  }

  function snapshotBefore(s: PhotoState) {
    return {
      adj: { ...s.adj },
      look: null,
      rotation: s.rotation,
      flipH: s.flipH,
      flipV: s.flipV,
      straighten: s.straighten,
      vertical: s.vertical,
      horizontal: s.horizontal,
      cropRatio: s.crop?.ratio ?? null,
      clipped: [] as string[],
    };
  }

  /** Straight paste: the default categories, onto this photograph. */
  function pasteAdjustments() {
    if (!copied) return;
    push();
    const s = st();
    mergePaste(s, applyCopied(s as any, copied, defaultPasteCategories(), "replace"));
    paint();
    void refreshStats();
    rdToast("Light, Colour And Detail Pasted.");
  }

  function categoryChecklist(): string {
    return PASTE_CATEGORIES.map(
      (c) =>
        `<label class="rdpe-dlg-c"><input type="checkbox" data-cat="${c.id}" ${
          c.default ? "checked" : ""
        } /> <b>${esc(c.label)}</b><em>${esc(c.hint)}</em></label>`,
    ).join("");
  }

  function pickedCategories(root: HTMLElement): PasteCategory[] {
    return Array.from(root.querySelectorAll<HTMLInputElement>("[data-cat]"))
      .filter((i) => i.checked)
      .map((i) => i.getAttribute("data-cat") as PasteCategory);
  }

  /** Selective paste: the user chooses exactly which categories transfer. */
  async function pasteSelected() {
    if (!copied) return;
    const others = photos.filter((x) => x.key !== cur().key);
    const root = await formDialog({
      title: "Paste Selected Adjustments",
      body: `<p class="rdpe-hint">From <b>${esc(copied.sourceLabel)}</b> &middot; ${
        1 + others.length
      } Photo${others.length ? "s Available" : ""} In This Property.</p>
        <div class="rdpe-batch-cats">${categoryChecklist()}</div>
        <label class="rdpe-dlg-c"><input type="checkbox" data-x="others" /> Also Apply To Other Selected Photos Below</label>
        ${others.length ? chipList(others.map((x, i) => ({ id: x.key, label: x.room || x.name || `Photo ${i + 2}` }))) : ""}
        <button type="button" class="rdpe-act" data-x="preview"><i data-lucide="eye"></i>Preview First Photo</button>`,
      confirmLabel: "Apply To Selected",
      cancelLabel: "Cancel",
      onInput: (dlg) => {
        const prev = dlg.querySelector('[data-x="preview"]') as HTMLButtonElement | null;
        if (prev && !prev.dataset["bound"]) {
          prev.dataset["bound"] = "1";
          prev.onclick = () => {
            const out = applyCopied(st() as any, copied!, pickedCategories(dlg), "replace");
            previewAdj = out.adj as Adj;
            const img = $("#rdpeImg") as HTMLElement | null;
            if (img) img.style.filter = filterString(previewAdj);
            rdToast("Previewing The Selected Categories.");
          };
        }
      },
    });
    previewAdj = null;
    paint();
    if (!root) return;
    const cats = pickedCategories(root);
    if (!cats.length) return void rdToast("Nothing Was Selected To Paste.");
    const alsoOthers = !!(root.querySelector('[data-x="others"]') as HTMLInputElement)?.checked;
    const targets = [cur().key, ...(alsoOthers ? chipValues(root) : [])];
    push();
    for (const key of new Set(targets)) {
      const target = states.get(key) || st(key);
      mergePaste(target, applyCopied(target as any, copied, cats, "replace"));
    }
    paint();
    void refreshStats();
    rdToast(`Adjustments Pasted Into ${new Set(targets).size} Photo${targets.length === 1 ? "" : "s"}.`);
  }


  async function savePresetFlow() {
    const root = await formDialog({
      title: "Save Preset",
      body: `<label class="rdpe-dlg-l">Preset Name</label>
        <input class="rdpe-dlg-i" data-x="name" maxlength="40" placeholder="Bright Interior" />`,
      confirmLabel: "Save Preset",
    });
    if (!root) return;
    const name = (root.querySelector('[data-x="name"]') as HTMLInputElement)?.value || "";
    savePreset(name, bundleOf(st()));
    paintPanel();
    rdToast("Preset Saved.");
  }

  /* ------------------------------------------------------ batch workspace */

  const photoLabel = (x: EditorPhoto, i: number) => x.room || x.name || `Photo ${i + 1}`;

  function mixedReadout(keys: string[]): string {
    const list = keys.map((k) => states.get(k)?.adj || {});
    const values = mixedValues(list as any);
    const rows = Object.entries(values)
      .filter(([, v]) => v.mixed || v.value !== 0)
      .slice(0, 8)
      .map(
        ([k, v]) =>
          `<span class="rdpe-mix ${v.mixed ? "is-mixed" : ""}">${esc(k)}<b>${
            v.mixed ? "Mixed" : Math.round(v.value)
          }</b></span>`,
      )
      .join("");
    return rows
      ? `<div class="rdpe-mixrow">${rows}</div>`
      : `<p class="rdpe-hint">The Selected Photographs Share No Adjustments Yet.</p>`;
  }

  /**
   * Batch Edit. Ordinary adjustments only: masks, crops and generative work
   * never travel with a batch, and nothing is saved unless it is confirmed.
   */
  async function batchApply() {
    const here = cur();
    if (photos.length < 2) return void rdToast("This Property Has Only One Photograph.");
    if (!copied) copyCurrentAdjustments();
    const root = await formDialog({
      title: "Batch Edit",
      body: `<p class="rdpe-hint">Source: <b>${esc(copied!.sourceLabel)}</b>. Light, Colour, Detail And Geometry Transfer. Masks, Crop Position, Privacy Blur And AI Generations Stay With Their Own Photograph.</p>
        <div class="rdpe-batch-cats">${categoryChecklist()}</div>
        <label class="rdpe-dlg-l">Photographs</label>
        ${chipList(photos.map((x, i) => ({ id: x.key, label: photoLabel(x, i) + (x.key === here.key ? " (Source)" : "") })))}
        <label class="rdpe-dlg-l">Apply Mode</label>
        <div class="rdpe-batch-modes">${APPLY_MODES.map(
          (m, i) =>
            `<label class="rdpe-dlg-c"><input type="radio" name="rdpeMode" data-mode="${m.id}" ${
              i === 0 ? "checked" : ""
            } /> <b>${esc(m.label)}</b><em>${esc(m.hint)}</em></label>`,
        ).join("")}</div>
        <div data-x="mixed"></div>
        <label class="rdpe-dlg-c"><input type="checkbox" data-x="saveall" /> Save A Version For Each Photograph After Applying</label>`,
      confirmLabel: "Apply To Selected",
      cancelLabel: "Cancel",
      onInput: (dlg) => {
        const box = dlg.querySelector('[data-x="mixed"]');
        if (box) box.innerHTML = mixedReadout(chipValues(dlg));
      },
    });
    if (!root) return;
    const keys = chipValues(root);
    if (!keys.length) return void rdToast("No Photographs Were Selected.");
    const cats = pickedCategories(root);
    if (!cats.length) return void rdToast("No Adjustment Categories Were Selected.");
    const mode = ((root.querySelector("[data-mode]:checked") as HTMLInputElement)?.getAttribute(
      "data-mode",
    ) || "replace") as ApplyMode;
    const saveAll = !!(root.querySelector('[data-x="saveall"]') as HTMLInputElement)?.checked;

    let batch = newBatch({
      kind: "adjustments",
      sourceKey: copied!.sourceKey,
      settings: { categories: cats, mode, source: copied!.sourceLabel },
      photos: keys.map((k) => {
        const i = photos.findIndex((x) => x.key === k);
        return { key: k, label: photoLabel(photos[i] as EditorPhoto, i) };
      }),
    });
    const clipped: string[] = [];
    for (const key of keys) {
      const target = states.get(key) || st(key);
      batch = markPhoto(batch, key, { status: "running", before: snapshotBefore(target) } as any);
      try {
        const out = applyCopied(target as any, copied!, cats, mode);
        mergePaste(target, out);
        clipped.push(...out.clipped);
        batch = markPhoto(batch, key, { status: "done" });
      } catch (err: any) {
        batch = markPhoto(batch, key, { status: "failed", error: err?.message || "Could Not Apply" });
      }
    }
    lastBatch = batch;
    saveBatchLocal(batch);
    paint();
    void refreshStats();
    void persistBatch(batch);

    const note = clippingNotice([...new Set(clipped)]);
    if (note) rdToast(note, "error");
    const prog = batchProgress(batch);
    rdToast(`Batch Applied To ${prog.done} Of ${prog.total} Photographs.`);

    if (saveAll) await saveBatchVersions(batch);
  }

  /** Write one durable version per photograph in the batch. */
  async function saveBatchVersions(batch: BatchRecord) {
    let ok = 0;
    for (const item of batch.photos) {
      if (item.status !== "done") continue;
      const p = photos.find((x) => x.key === item.key);
      const s = states.get(item.key);
      if (!p || !s) continue;
      try {
        await savePhotoState(p, s, false);
        s.dirty = false;
        ok++;
      } catch (err: any) {
        lastBatch = markPhoto(batch, item.key, { status: "failed", error: err?.message || "Save Failed" });
      }
    }
    if (lastBatch) saveBatchLocal(lastBatch);
    paint();
    rdToast(`${ok} Photograph${ok === 1 ? "" : "s"} Saved As New Versions.`);
  }

  async function persistBatch(batch: BatchRecord) {
    try {
      await saveBatch({
        data: {
          batch_id: batch.id,
          kind: batch.kind,
          settings: batch.settings,
          source_key: batch.sourceKey,
          photos: batch.photos,
        },
      });
    } catch {
      /* the local record already survives a refresh */
    }
  }

  /** Analyse each selected photograph on its own and propose a correction. */
  async function batchAutoEnhanceFlow() {
    if (photos.length < 2) return void rdToast("This Property Has Only One Photograph.");
    const root = await formDialog({
      title: "Auto Enhance Photos",
      body: `<p class="rdpe-hint">Each Photograph Is Analysed On Its Own. Nothing Is Applied Until You Approve It.</p>
        ${chipList(photos.map((x, i) => ({ id: x.key, label: photoLabel(x, i) })))}`,
      confirmLabel: "Analyse Selected",
      cancelLabel: "Cancel",
    });
    if (!root) return;
    const keys = chipValues(root);
    if (!keys.length) return;
    rdToast("Analysing Photographs…");

    const inputs: { key: string; label: string; adj: any; stats: any }[] = [];
    for (const key of keys) {
      const i = photos.findIndex((x) => x.key === key);
      const p = photos[i] as EditorPhoto;
      const s = states.get(key) || st(key);
      const src = s.base || s.original || p.src || null;
      const measured = src ? await measure(src, null) : null;
      inputs.push({ key, label: photoLabel(p, i), adj: s.adj, stats: measured });
    }
    const recs = batchAutoEnhance(inputs as any, autoStrength);
    const approve = await formDialog({
      title: "Review Auto Enhance",
      body: `<p class="rdpe-hint">Uncheck Any Photograph You Would Rather Leave Alone.</p>
        ${recs
          .map(
            (r) =>
              `<label class="rdpe-dlg-c"><input type="checkbox" data-rec="${esc(r.key)}" ${
                r.approved ? "checked" : ""
              } ${r.approved ? "" : "disabled"} /> <b>${esc(r.label)}</b><em>${esc(
                r.summary || "Already Well Exposed. Nothing Recommended.",
              )}</em></label>`,
          )
          .join("")}`,
      confirmLabel: "Apply Approved",
      cancelLabel: "Cancel",
    });
    if (!approve) return;
    const picked = Array.from(approve.querySelectorAll<HTMLInputElement>("[data-rec]"))
      .filter((i) => i.checked)
      .map((i) => i.getAttribute("data-rec") as string);
    if (!picked.length) return;

    let batch = newBatch({
      kind: "auto-enhance",
      settings: { strength: autoStrength },
      photos: picked.map((k) => ({
        key: k,
        label: recs.find((r) => r.key === k)?.label || "Photo",
      })),
    });
    for (const key of picked) {
      const target = states.get(key) || st(key);
      const rec = recs.find((r) => r.key === key);
      if (!rec) continue;
      batch = markPhoto(batch, key, { status: "running", before: snapshotBefore(target) } as any);
      target.adj = { ...target.adj, ...rec.adj };
      target.auto = { strength: autoStrength, values: { ...rec.adj } };
      target.dirty = true;
      batch = markPhoto(batch, key, { status: "done" });
    }
    lastBatch = batch;
    saveBatchLocal(batch);
    void persistBatch(batch);
    paint();
    void refreshStats();
    rdToast(`Auto Enhance Applied To ${picked.length} Photograph${picked.length === 1 ? "" : "s"}.`);
  }

  /** Undo a whole batch, or just the photographs the user picks. */
  async function undoBatchFlow() {
    if (!lastBatch) return;
    const changed = changedPhotos(lastBatch);
    if (!changed.length) return void rdToast("There Is Nothing Left To Undo.");
    const root = await formDialog({
      title: "Undo Batch",
      body: `<p class="rdpe-hint">${changed.length} Photograph${
        changed.length === 1 ? " Was" : "s Were"
      } Changed By The Last Batch. Undo Returns Them To Their Previous Settings.</p>
        ${chipList(changed.map((c) => ({ id: c.key, label: c.label, on: true })))}`,
      confirmLabel: "Undo Selected",
      cancelLabel: "Keep Changes",
    });
    if (!root) return;
    const keys = chipValues(root);
    if (!keys.length) return;
    for (const key of keys) {
      const item = lastBatch.photos.find((x) => x.key === key);
      const target = states.get(key);
      if (!item?.before || !target) continue;
      target.adj = { ...item.before.adj };
      target.rotation = item.before.rotation;
      target.flipH = item.before.flipH;
      target.flipV = item.before.flipV;
      target.straighten = item.before.straighten;
      target.vertical = item.before.vertical;
      target.horizontal = item.before.horizontal;
      target.dirty = true;
    }
    lastBatch = markUndone(lastBatch, keys);
    saveBatchLocal(lastBatch);
    void persistBatch(lastBatch);
    paint();
    void refreshStats();
    rdToast(`${keys.length} Photograph${keys.length === 1 ? "" : "s"} Restored.`);
  }


  async function resetPhoto() {
    const ok = await confirmDialog({
      title: "Reset This Photo?",
      body: "Every Adjustment, Crop And AI Enhancement On This Photo Is Removed. The Original Photograph Is Never Changed.",
      confirmLabel: "Reset Photo",
      danger: true,
    });
    if (!ok) return;
    const p = cur();
    const s = st();
    const original = s.original;
    states.set(p.key, { ...blankState(), original, base: s.entry || original, entry: s.entry || original });
    try {
      await resetPhotoEdit({ data: { asset_key: p.key } });
    } catch {
      /* local reset still stands */
    }
    aiPreview = null;
    paint();
  }

  /* --------------------------------------------------------- navigation */

  async function go(i: number) {
    if (i < 0 || i >= photos.length || i === index) return;
    if ((await guardUnsaved("Moving To Another Photo")) === "stay") return;
    aiPreview = null;
    cropMode = false;
    cropView = null;
    index = i;
    await ensureSource(cur());
    paint();
    paintCropBox();
  }

  /** In-app three-way guard. Never the browser's confirm dialog. */
  async function guardUnsaved(reason: string): Promise<"stay" | "go"> {
    const unsaved = [...states.values()].some((x) => x.dirty);
    if (!unsaved) return "go";
    const choice = await unsavedDialog(reason);
    if (choice === "continue") return "stay";
    if (choice === "save") {
      await save(false);
      return st().dirty ? "stay" : "go";
    }
    for (const [, x] of states) x.dirty = false;
    return "go";
  }

  async function close() {
    if ((await guardUnsaved("Closing The Editor")) === "stay") return;
    closePhotoEditor();
  }

  /**
   * Hand the current photo to another Canvas tool. Editing edits are saved
   * first, the tool is only selected, and nothing generates until the user
   * reviews the settings and presses Generate there.
   */
  async function continueWith(tool: string) {
    if ((await guardUnsaved(`Continuing In ${tool === "object" ? "Object Edit" : tool}`)) === "stay") return;
    const target =
      tool === "object"
        ? document.getElementById("rdwObjTool")
        : document.querySelector<HTMLElement>(`#fTool .toolrow[data-tool="${tool}"]`);
    if (!target) {
      rdToast("That Tool Is Not Available Here.", "error");
      return;
    }
    const { closeCanvasPhotoEditor } = await import("@/lib/canvas-workspace");
    closeCanvasPhotoEditor();
    target.click();
  }

  /* ------------------------------------------------------------- events */

  host.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const go1 = t.closest("[data-go]");
    if (go1) return void go(Number(go1.getAttribute("data-go")));
    const ratio = t.closest("[data-ratio]");
    if (ratio) return setRatio(ratio.getAttribute("data-ratio") as string);
    const strength = t.closest("[data-auto-strength]");
    if (strength) {
      autoStrength = strength.getAttribute("data-auto-strength") as Strength;
      paintPanel();
      /* Changing strength while a result is on screen re-derives it in place. */
      if (autoPreview) return void runAutoEnhance(false);
      if (st().auto) return void runAutoEnhance(true);
      return;
    }
    const rst = t.closest("[data-reset-adj]");
    if (rst) {
      push();
      st().adj[rst.getAttribute("data-reset-adj") as string] = 0;
      paint();
      return refreshStats();
    }
    const rgeo = t.closest("[data-reset-geo]");
    if (rgeo) {
      push();
      (st() as any)[rgeo.getAttribute("data-reset-geo") as string] = 0;
      return paint();
    }
    const cont = t.closest("[data-continue]");
    if (cont) return void continueWith(cont.getAttribute("data-continue") as string);
    const ai = t.closest("[data-ai]");
    if (ai) return void runAi(ai.getAttribute("data-ai") as string);
    const pdel = t.closest("[data-preset-del]");
    if (pdel) {
      removePreset(pdel.getAttribute("data-preset-del") as string);
      return paintPanel();
    }
    const pset = t.closest("[data-preset]");
    if (pset) {
      const found = listPresets().find((r) => r.id === pset.getAttribute("data-preset"));
      if (found) {
        applyBundle(found.bundle, false, false);
        rdToast(`Preset “${found.name}” Applied.`);
      }
      return;
    }
    const act = t.closest("[data-act]")?.getAttribute("data-act");
    if (!act) return;
    const s = st();
    if (act === "close") return void close();
    if (act === "prev") return void go(index - 1);
    if (act === "next") return void go(index + 1);
    if (act === "undo") return undo();
    if (act === "redo") return redo();
    if (act === "download") return void download(false);
    if (act === "downloadpreview") return void download(true);
    if (act === "save") return void save(false);
    if (act === "savecopy") return void save(true);
    if (act === "reset") return void resetPhoto();
    if (act === "panel") {
      host.classList.toggle("rdpe-panel-off");
      return void paintCropBox();
    }
    if (act === "aiapply") return applyAi();
    if (act === "aicancel") {
      aiPreview = null;
      return paint();
    }
    if (act === "autopreview") return void runAutoEnhance(false);
    if (act === "privacy") {
      pv().open = true;
      return paintPanel();
    }
    if (act === "markup") {
      markupOpen = true;
      return markupChanged();
    }
    if (act === "autoapply") return void runAutoEnhance(true);
    if (act === "autoundo") return undoAuto();
    if (act === "resetgeo") return resetGeometry();
    if (act === "retrysave") return void save(false);
    if (act === "copyadj") return copyCurrentAdjustments();
    if (act === "pasteadj") return pasteAdjustments();
    if (act === "pastesel") return void pasteSelected();
    if (act === "batchauto") return void batchAutoEnhanceFlow();
    if (act === "batchundo") return void undoBatchFlow();
    if (act === "savepreset") return void savePresetFlow();
    if (act === "batch") return void batchApply();
    if (act === "rotl" || act === "rotr") {
      push();
      s.rotation = (((s.rotation + (act === "rotr" ? 90 : -90)) % 360) + 360) % 360;
      return paint();
    }
    if (act === "flip") {
      push();
      s.flipH = !s.flipH;
      return paint();
    }
    if (act === "flipv") {
      push();
      s.flipV = !s.flipV;
      return paint();
    }
    if (act === "cropapply") {
      cropMode = false;
      cropBackup = null;
      paint();
      return paintCropBox();
    }
    if (act === "cropcancel") {
      s.crop = cropBackup;
      cropBackup = null;
      cropMode = false;
      cropView = null;
      paint();
      return paintCropBox();
    }
    if (act === "cropreset") return resetCropPosition();
    if (act === "cropmode") {
      cropMode = !cropMode;
      cropBackup = cropMode ? (s.crop ? { ...s.crop } : null) : null;
      if (cropMode) return setRatio(s.crop?.ratio || "1:1");
      cropView = null;
      paint();
      return paintCropBox();
    }

  });

  /* Privacy Blur controls. Everything here is local and costs nothing. */
  host.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-priv],[data-privgroup],[data-privdet],[data-privtype]") as HTMLElement | null;
    if (!el) return;
    const v = pv();
    const det = el.getAttribute("data-privdet");
    if (det) {
      v.mask = toggleSelectedRegion(v.mask, det);
      return privacyChanged();
    }
    const group = el.getAttribute("data-privgroup");
    if (group) {
      v.mask = selectGroup(v.mask, v.detections, group);
      return privacyChanged();
    }
    const type = el.getAttribute("data-privtype");
    if (type) {
      v.settings = clampPrivacySettings({ ...v.settings, type: type as PrivacySettings["type"] });
      return privacyChanged();
    }
    const pick = el.getAttribute("data-mkpick");
    if (pick) {
      markupSelected = pick;
      return markupChanged();
    }
    const mtype = el.getAttribute("data-mktype");
    if (mtype) {
      markupActiveType = mtype as MarkupTypeId;
      markupMode = "draw";
      markupCtl?.cancelDraft();
      return markupChanged();
    }
    const mcolor = el.getAttribute("data-mkcolor");
    if (mcolor && markupSelected) {
      setMarkupDoc({ ...mk(), layers: updateStyle(mk().layers, markupSelected, { stroke: mcolor, fill: mcolor }) });
      return markupChanged();
    }
    const mdash = el.getAttribute("data-mkdash");
    if (mdash && markupSelected) {
      setMarkupDoc({ ...mk(), layers: updateStyle(mk().layers, markupSelected, { dash: mdash as any }) });
      return markupChanged();
    }
    const msugg = el.getAttribute("data-mksugg");
    if (msugg && markupSelected) {
      setMarkupDoc({ ...mk(), layers: updateLayer(mk().layers, markupSelected, { label: msugg }) });
      return markupChanged();
    }
    const mlayer = el.getAttribute("data-mklayer");
    if (mlayer) {
      const [op, id] = mlayer.split(":") as [string, string];
      const doc = mk();
      const target = doc.layers.find((l) => l.id === id);
      if (!target) return;
      if (op === "visible") setMarkupDoc({ ...doc, layers: updateLayer(doc.layers, id, { visible: !target.visible }) });
      else if (op === "lock") setMarkupDoc({ ...doc, layers: updateLayer(doc.layers, id, { locked: !target.locked }) });
      else if (op === "up") setMarkupDoc({ ...doc, layers: bringForward(doc.layers, id) });
      else if (op === "down") setMarkupDoc({ ...doc, layers: sendBackward(doc.layers, id) });
      else if (op === "copy") setMarkupDoc({ ...doc, layers: duplicateLayer(doc.layers, id) });
      else if (op === "del") {
        setMarkupDoc({ ...doc, layers: removeLayer(doc.layers, id) });
        if (markupSelected === id) markupSelected = null;
      } else if (op === "labelbg")
        setMarkupDoc({ ...doc, layers: updateStyle(doc.layers, id, { labelBackground: !target.style.labelBackground }) });
      else if (op === "arrow")
        setMarkupDoc({
          ...doc,
          layers: updateStyle(doc.layers, id, { arrowHead: target.style.arrowHead === "both" ? "end" : "both" }),
        });
      return markupChanged();
    }
    const mact = el.getAttribute("data-mk");
    if (mact === "draw" || mact === "navigate") {
      markupMode = mact;
      markupCtl?.cancelDraft();
      return markupChanged();
    }
    if (mact === "undo") {
      markupCtl?.undo();
      return markupChanged();
    }
    if (mact === "redo") {
      markupCtl?.redo();
      return markupChanged();
    }
    if (mact === "clear") {
      markupCtl?.cancelDraft();
      setMarkupDoc({ ...mk(), layers: [] });
      markupSelected = null;
      return markupChanged();
    }
    if (mact === "done" || mact === "cancel") {
      markupCtl?.cancelDraft();
      markupOpen = false;
      return markupChanged();
    }
    const act = el.getAttribute("data-priv");
    if (act === "scan") {
      v.open = true;
      return void runPrivacyScan();
    }
    if (act === "manual") {
      v.open = true;
      return privacyChanged();
    }
    if (act === "batch") return void batchPrivacy();
    if (act === "brush" || act === "erase") {
      v.tool = act;
      return paintPanel();
    }
    if (act === "showmask") {
      v.showMask = !v.showMask;
      return privacyChanged();
    }
    if (act === "undo") {
      v.mask = undoStroke(v.mask);
      return privacyChanged();
    }
    if (act === "redo") {
      v.mask = redoStroke(v.mask);
      return privacyChanged();
    }
    if (act === "clear") {
      v.mask = clearStrokes(v.mask);
      return privacyChanged();
    }
    if (act === "none") {
      v.mask = deselectAll(v.mask);
      return privacyChanged();
    }
    if (act === "reset") return resetPrivacy();
    if (act === "cancel") return cancelPrivacy();
    if (act === "done") return void commitPrivacy();
  });

  host.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const s = st();
    if (t.hasAttribute("data-cropzoom")) {
      setCropZoom(n(t.value, 100) / 100);
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out && cropView) out.textContent = `${Math.round(cropView.scale * 100)}%`;
      return;
    }
    if (t.hasAttribute("data-mkset")) {
      const id = t.getAttribute("data-mkid") as string;
      const key = t.getAttribute("data-mkset") as string;
      const raw = n(t.value);
      const value = key === "fillOpacity" ? raw / 100 : raw;
      setMarkupDoc({ ...mk(), layers: updateStyle(mk().layers, id, { [key]: value } as any) });
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${raw}${key === "fillOpacity" ? "%" : ""}`;
      syncMarkupOverlay();
      return;
    }
    if (t.hasAttribute("data-mklabel")) {
      setMarkupDoc({ ...mk(), layers: updateLayer(mk().layers, t.getAttribute("data-mklabel") as string, { label: t.value }) });
      syncMarkupOverlay();
      return;
    }
    if (t.getAttribute("data-mk") === "disclosure") {
      setMarkupDoc({ ...mk(), visibleDisclosure: t.checked });
      syncMarkupOverlay();
      return;
    }
    if (t.hasAttribute("data-privset")) {
      const key = t.getAttribute("data-privset") as keyof PrivacySettings;
      const v = pv();
      v.settings = clampPrivacySettings({ ...v.settings, [key]: n(t.value) });
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${n(t.value)}${key === "brush" ? "px" : ""}`;
      refreshPrivacyPreview();
      syncPrivacyOverlay();
      return;
    }
    if (t.hasAttribute("data-adj")) {
      if (!t.dataset['pushed']) {
        push();
        t.dataset['pushed'] = "1";
      }
      s.adj[t.getAttribute("data-adj") as string] = n(t.value);
      saveFailed = false;
    s.dirty = true;
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${n(t.value) > 0 ? "+" : ""}${t.value}`;
      const img = $("#rdpeImg") as HTMLImageElement;
      img.style.filter = filterString(s.adj);
      refreshStats();
    }
    if (t.hasAttribute("data-geo")) {
      if (!t.dataset['pushed']) {
        push();
        t.dataset['pushed'] = "1";
      }
      (s as any)[t.getAttribute("data-geo") as string] = n(t.value);
      saveFailed = false;
      s.dirty = true;
      paintStageTransform();
      if (cropView) syncCrop();
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${n(t.value) > 0 ? "+" : ""}${t.value}°`;
    }
  });

  /* Double-click a slider to return that single control to zero. */
  host.addEventListener("dblclick", (e) => {
    const t = e.target as HTMLInputElement;
    const s = st();
    if (t.hasAttribute("data-adj")) {
      push();
      s.adj[t.getAttribute("data-adj") as string] = 0;
      paint();
      refreshStats();
    } else if (t.hasAttribute("data-geo")) {
      push();
      (s as any)[t.getAttribute("data-geo") as string] = 0;
      paint();
    }
  });

  host.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset) delete t.dataset['pushed'];
    if (t.tagName === "INPUT") paint();
  });


  host.addEventListener("toggle", (e) => {
    const d = e.target as HTMLDetailsElement;
    const id = d.getAttribute?.("data-sec");
    if (!id) return;
    d.open ? OPEN.add(id) : OPEN.delete(id);
  }, true);

  // Hold To Compare: pointer hold on the button or on the photo, plus the \ key.
  const holdOn = () => {
    if (comparing) return;
    if (!compareEnabled(hasEdits(st()) || !!aiPreview)) return;
    comparing = true;
    paint();
  };
  const holdOff = () => {
    if (!comparing) return;
    comparing = false;
    paint();
  };
  host.querySelectorAll("[data-hold]").forEach((el) => {
    el.addEventListener("pointerdown", holdOn);
    el.addEventListener("pointerup", holdOff);
    el.addEventListener("pointerleave", holdOff);
    el.addEventListener("pointercancel", holdOff);
    el.addEventListener("blur", holdOff);
    /* Keyboard parity: hold Space or Enter to see the original. */
    el.addEventListener("keydown", (ev) => {
      const k = (ev as KeyboardEvent).key;
      if (k === " " || k === "Enter") {
        ev.preventDefault();
        holdOn();
      }
    });
    el.addEventListener("keyup", (ev) => {
      const k = (ev as KeyboardEvent).key;
      if (k === " " || k === "Enter") holdOff();
    });
  });
  $("#rdpeCropBox").addEventListener("pointerdown", (e) => dragCrop(e as PointerEvent));

  /* Wheel and trackpad pinch zoom the crop, but only while cropping — the
     inspector keeps its own scrolling. React's passive onWheel cannot
     preventDefault, so this is a native non-passive listener. */
  const stageEl = $("#rdpeStage");
  const onWheel = (ev: WheelEvent) => {
    if (!cropMode || !cropView) return;
    ev.preventDefault();
    setCropZoom(wheelScale(cropView, ev.deltaY, ev.deltaMode));
    paintPanel();
  };
  stageEl?.addEventListener("wheel", onWheel, { passive: false });


  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT" && e.key !== "Escape") return;
    if (e.key === "Escape") return void close();
    if (e.key === "ArrowRight") return void go(index + 1);
    if (e.key === "ArrowLeft") return void go(index - 1);
    if (e.key === "\\") return holdOn();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return e.shiftKey ? redo() : undo();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "\\") holdOff();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  /* The frame is recomputed whenever the viewport can have changed: window
     resize, browser zoom, or the inspector changing the stage's width. */
  const onResize = () => {
    if (cropMode && cropView) {
      const base = baseBox();
      const view = viewBox();
      cropView = refit(cropView, cropView.ratio === "free" ? 0 : ratioAspect(cropView.ratio, base), base, view);
      syncCrop(false);
    } else paintCropBox();
  };
  window.addEventListener("resize", onResize);
  const stageRo =
    typeof ResizeObserver !== "undefined" && stageEl ? new ResizeObserver(() => onResize()) : null;
  if (stageRo && stageEl) stageRo.observe(stageEl);


  /* Double-click a slider to return it to neutral. */
  host.addEventListener("dblclick", (e) => {
    const t = e.target as HTMLInputElement;
    if (t?.tagName !== "INPUT") return;
    push();
    if (t.hasAttribute("data-adj")) st().adj[t.getAttribute("data-adj") as string] = 0;
    if (t.hasAttribute("data-straighten")) st().straighten = 0;
    paint();
  });

  /* The footer wraps on the panel's own width, so the primary action is never
     pushed past the edge of the viewport. */
  const panelEl = $("#rdpePanel");
  const applyFooter = (w: number) => {
    host.classList.toggle("rdpe-footer-stack", footerLayout(w) === "stack");
  };
  applyFooter(panelEl?.getBoundingClientRect().width || 360);
  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => applyFooter(entries[0]?.contentRect.width || 360))
      : null;
  if (ro && panelEl) ro.observe(panelEl);

  (host as any).__teardown = () => {
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    stageEl?.removeEventListener("wheel", onWheel);
    stageRo?.disconnect();
    ro?.disconnect();
  };

  /* -------------------------------------------------------------- start */

  await ensureSource(cur());
  paint();
  void hydrate();
  void loadMarkups();

  async function hydrate() {
    try {
      const rows: any[] = (await listPhotoEdits({
        data: { keys: photos.map((p) => p.key) },
      })) as any;
      for (const row of rows || []) {
        if (row.is_copy) continue;
        const p = photos.find((x) => x.key === row.asset_key);
        if (!p) continue;
        const s = st(p.key);
        s.adj = row.adjustments || {};
        s.crop = row.crop || null;
        s.rotation = n(row.rotation, 0);
        s.flipH = !!row.flip_h;
        const g = row.geometry || {};
        s.straighten = n(g.straighten, 0);
        s.vertical = n(g.vertical, 0);
        s.horizontal = n(g.horizontal, 0);
        s.flipV = !!g.flip_v;
        s.aiOps = row.ai_ops || [];
        if (row.edited_path && row.ai_ops?.length) {
          const url = await roomPhotoUrl(row.edited_path, 3600);
          if (url) s.base = url;
        }
        s.dirty = false;
      }
      paint();
    } catch {
      /* editing still works without saved state */
    }
  }
}

export function closePhotoEditor() {
  if (!HOST) return;
  /* Anything the Canvas lent to the editor column is reclaimed before the
     host is removed, so the permanent Canvas chrome is never destroyed. */
  document.dispatchEvent(new CustomEvent("rdpe:closing"));
  (HOST as any).__teardown?.();
  HOST.remove();
  HOST = null;
  document.body.classList.remove("rdpe-open");
  document.dispatchEvent(new CustomEvent("rdpe:closed"));
}


/**
 * The editor as a Canvas tool: no page header, no "Return To Canvas", no
 * breadcrumb. Only a compact contextual toolbar inside the dark wrapper.
 */
function embeddedShellHtml(label: string): string {
  return `
  <div class="rdpe-body">
    <section class="rdpe-main">
      <div class="rdpe-stage" id="rdpeStage">
        <img id="rdpeImg" alt="Photo being edited" data-hold>
        <div class="rdpe-cropbox" id="rdpeCropBox" style="display:none">
          <span class="rdpe-cropgrid" aria-hidden="true"></span>
          <i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i>
        </div>
        <div class="rdpe-priv" id="rdpePriv" hidden><canvas id="rdpePrivCv"></canvas><span class="rdpe-brushdot" id="rdpeBrushDot" hidden></span></div>
        <div class="rdpe-mk" id="rdpeMk" hidden><canvas id="rdpeMkCv"></canvas></div>
        <p class="rdpe-crophint" id="rdpeCropHint" hidden>Drag The Photo To Reposition It Inside The Crop.</p>
        <span class="rdpe-badge">Original</span>
      </div>
      <div class="rdpe-underbar">
        <button type="button" class="rdpe-hold" id="rdpeHold" data-hold><i data-lucide="eye"></i>Hold To Compare</button>
        <span class="rdpe-prov" id="rdpeProv"></span>
      </div>
    </section>

    <aside class="rdpe-panel" id="rdpePanel">
      <header class="rdpe-panelh">
        <div class="rdpe-ctxl"><b>Edit</b><span class="rdpe-ctxtag" id="rdpeCrumb">${esc(label)}</span></div>
        <div class="rdpe-topr">
          <button type="button" class="rdpe-ib" id="rdpeUndo" data-act="undo" title="Undo" aria-label="Undo"><i data-lucide="undo-2"></i></button>
          <button type="button" class="rdpe-ib" id="rdpeRedo" data-act="redo" title="Redo" aria-label="Redo"><i data-lucide="redo-2"></i></button>
          <button type="button" class="rdpe-ib" data-act="download" title="Download" aria-label="Download"><i data-lucide="download"></i></button>
        </div>
      </header>
      <div class="rdpe-panelb" id="rdpePanelBody"></div>
      <footer class="rdpe-panelf" id="rdpeFooter">
        <div class="rdpe-fr1">
          <button type="button" class="rdpe-reset" id="rdpeReset" data-act="reset" title="Reset Photo">
            <i data-lucide="rotate-ccw"></i><span>Reset</span></button>
          <button type="button" class="btn btn-ghost btn-sm" id="rdpeSaveCopy" data-act="savecopy">Save As Copy</button>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="rdpeSave" data-act="save">Save Changes</button>
      </footer>
    </aside>
  </div>`;
}

function shellHtml(back: string): string {
  return `
  <header class="rdpe-top">
    <button type="button" class="rdpe-back" data-act="close" aria-label="${back}"><i data-lucide="x"></i><span>${back}</span></button>
    <nav class="rdpe-crumb" id="rdpeCrumb"></nav>
    <div class="rdpe-topr">
      <button type="button" class="rdpe-ib" id="rdpeUndo" data-act="undo" title="Undo"><i data-lucide="undo-2"></i></button>
      <button type="button" class="rdpe-ib" id="rdpeRedo" data-act="redo" title="Redo"><i data-lucide="redo-2"></i></button>
      <button type="button" class="btn btn-ghost btn-sm" data-act="download"><i data-lucide="download"></i>Download</button>
      <button type="button" class="rdpe-ib rdpe-paneltoggle" data-act="panel" aria-label="Show Or Hide Settings"><i data-lucide="sliders-horizontal"></i></button>
    </div>
  </header>

  <div class="rdpe-body">
    <section class="rdpe-main">
      <div class="rdpe-stage" id="rdpeStage">
        <button type="button" class="rdpe-nav l" data-act="prev" aria-label="Previous Photo"><i data-lucide="chevron-left"></i></button>
        <img id="rdpeImg" alt="Photo being edited" data-hold>
        <div class="rdpe-cropbox" id="rdpeCropBox" style="display:none">
          <span class="rdpe-cropgrid" aria-hidden="true"></span>
          <i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i>
        </div>
        <div class="rdpe-priv" id="rdpePriv" hidden><canvas id="rdpePrivCv"></canvas><span class="rdpe-brushdot" id="rdpeBrushDot" hidden></span></div>
        <div class="rdpe-mk" id="rdpeMk" hidden><canvas id="rdpeMkCv"></canvas></div>
        <p class="rdpe-crophint" id="rdpeCropHint" hidden>Drag The Photo To Reposition It Inside The Crop.</p>
        <button type="button" class="rdpe-nav r" data-act="next" aria-label="Next Photo"><i data-lucide="chevron-right"></i></button>
        <span class="rdpe-badge">Original</span>
      </div>
      <div class="rdpe-underbar">
        <button type="button" class="rdpe-hold" id="rdpeHold" data-hold><i data-lucide="eye"></i>Hold To Compare</button>
        <span class="rdpe-prov" id="rdpeProv"></span>
      </div>
      <div class="rdpe-strip" id="rdpeStrip"></div>
    </section>

    <button type="button" class="rdpe-grip" data-act="panel" aria-label="Collapse Settings Panel"><i data-lucide="chevron-right"></i></button>

    <aside class="rdpe-panel" id="rdpePanel">
      <div class="rdpe-panelb" id="rdpePanelBody"></div>
      <footer class="rdpe-panelf" id="rdpeFooter">
        <div class="rdpe-fr1">
          <button type="button" class="rdpe-reset" id="rdpeReset" data-act="reset" title="Reset Photo">
            <i data-lucide="rotate-ccw"></i><span>Reset</span></button>
          <button type="button" class="btn btn-ghost btn-sm" id="rdpeSaveCopy" data-act="savecopy">Save As Copy</button>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="rdpeSave" data-act="save">Save Changes</button>
      </footer>
    </aside>
  </div>`;
}

/**
 * The unsaved-work guard. Three deliberate outcomes, rendered in the product's
 * own dialog language — never the browser's confirm().
 */
function unsavedDialog(reason: string): Promise<"continue" | "discard" | "save"> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "bx-cdlg rdpe-unsaved";
    wrap.innerHTML = `<div class="bx-cdlg-in" role="dialog" aria-modal="true" aria-label="Unsaved Changes">
      <h3>Unsaved Changes</h3>
      <p>${esc(reason)} Discards Edits That Have Not Been Saved Yet.</p>
      <div class="rdpe-udlg">
        <button type="button" class="btn btn-ghost btn-sm" data-u="continue">Continue Editing</button>
        <button type="button" class="btn btn-ghost btn-sm" data-u="discard">Discard Changes</button>
        <button type="button" class="btn btn-primary btn-sm" data-u="save">Save</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const done = (v: "continue" | "discard" | "save") => {
      wrap.remove();
      resolve(v);
    };
    wrap.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-u]");
      if (b) return done(b.getAttribute("data-u") as any);
      if (e.target === wrap) done("continue");
    });
    wrap.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") done("continue");
    });
    (wrap.querySelector('[data-u="continue"]') as HTMLElement)?.focus();
  });
}
