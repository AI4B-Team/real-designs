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
  CROP_PRESETS,
  EXPORT_PRESETS,
  classifyEdits,
  cropPreset,
  deletePreset as removePreset,
  disclosureText,
  exportFileName,
  exportPreset,
  exportSize,
  listPresets,
  mergeBundle,
  qualityReview,
  savePreset,
  type AdjustmentBundle,
} from "@/lib/photo-editor-presets";
import {
  PRIVACY_TARGETS,
  privacyInstruction,
} from "@/lib/photo-editor-context";
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
  let stats: PhotoStats | null = null;
  let sourceStats: { src: string; stats: PhotoStats } | null = null;
  let previewAdj: Adj | null = null;
  let aiPreview: { op: string; label: string; image: string } | null = null;
  let aiBusy = "";
  let saveFailed = false;
  /* Detail and lens run as a real pixel pass; the preview shows that pass. */
  let detailPreview: { key: string; url: string } | null = null;
  let detailPending = "";
  let privacyTargets: string[] = ["faces", "plates"];

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
      const preview = aiPreview && !comparing ? aiPreview.image : null;
      if (preview && stage.getAttribute("src") !== preview) stage.setAttribute("src", preview);
      /* An Auto Enhance preview is a filter overlay only: the stored
         adjustments stay exactly where the user left them. */
      stage.style.filter = comparing ? "none" : filterString(previewAdj || s.adj);
      stage.style.transform = comparing ? "none" : transformString(s);
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
    $("#rdpeSave").toggleAttribute("disabled", !s.dirty || s.saving);
    $("#rdpeSaveCopy").toggleAttribute("disabled", !hasEdits(s) || s.saving);
    $("#rdpeReset").toggleAttribute("disabled", !hasEdits(s));
    $("#rdpeSave").textContent = s.saving ? "Saving…" : primarySaveLabel({ mode: modeFor(p) });
    const edited = hasEdits(s) || !!aiPreview;
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
    paint();
    paintCropBox();
  }


  /* ---------------------------------------------------------------- crop */

  function setRatio(id: string) {
    const s = st();
    push();
    if (id === "original") {
      s.crop = null;
      cropMode = false;
    } else {
      const r = RATIOS.find((x) => x.id === id);
      const stageImg = $("#rdpeImg") as HTMLImageElement;
      const iw = stageImg?.naturalWidth || 4;
      const ih = stageImg?.naturalHeight || 3;
      const target = r?.v || iw / ih;
      let w = 1;
      let h = 1;
      if (iw / ih > target) w = (target * ih) / iw;
      else h = iw / target / ih;
      s.crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h, ratio: id };
      cropMode = true;
    }
    paint();
    paintCropBox();
  }

  function paintCropBox() {
    const box = $("#rdpeCropBox");
    const s = st();
    if (!box) return;
    if (!s.crop || !cropMode) {
      box.style.display = "none";
      return;
    }
    const img = $("#rdpeImg") as HTMLImageElement;
    const r = img.getBoundingClientRect();
    const wrap = $("#rdpeStage").getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${r.left - wrap.left + s.crop.x * r.width}px`;
    box.style.top = `${r.top - wrap.top + s.crop.y * r.height}px`;
    box.style.width = `${s.crop.w * r.width}px`;
    box.style.height = `${s.crop.h * r.height}px`;
  }

  function dragCrop(e: PointerEvent) {
    const s = st();
    if (!s.crop || !cropMode) return;
    const handle = (e.target as HTMLElement).getAttribute("data-h");
    const img = $("#rdpeImg") as HTMLImageElement;
    const r = img.getBoundingClientRect();
    const c0 = s.crop;
    const start = { px: e.clientX, py: e.clientY, x: c0.x, y: c0.y, w: c0.w, h: c0.h, ratio: c0.ratio };
    push();
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / r.width;
      const dy = (ev.clientY - start.py) / r.height;
      const c = { ...start } as any;
      if (!handle) {
        c.x = Math.min(1 - start.w, Math.max(0, start.x + dx));
        c.y = Math.min(1 - start.h, Math.max(0, start.y + dy));
      } else {
        if (handle.includes("e")) c.w = Math.min(1 - start.x, Math.max(0.06, start.w + dx));
        if (handle.includes("s")) c.h = Math.min(1 - start.y, Math.max(0.06, start.h + dy));
        if (handle.includes("w")) {
          c.x = Math.min(start.x + start.w - 0.06, Math.max(0, start.x + dx));
          c.w = start.w + (start.x - c.x);
        }
        if (handle.includes("n")) {
          c.y = Math.min(start.y + start.h - 0.06, Math.max(0, start.y + dy));
          c.h = start.h + (start.y - c.y);
        }
      }
      s.crop = { x: c.x, y: c.y, w: c.w, h: c.h, ratio: handle ? "free" : start.ratio };
      saveFailed = false;
    s.dirty = true;
      paintCropBox();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      paint();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /* ------------------------------------------------------------ AI edits */

  async function runAi(op: string) {
    if (aiBusy) return;
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

  async function save(asCopy: boolean) {
    const p = cur();
    const s = st();
    if (s.saving) return;
    s.saving = true;
    saveFailed = false;
    paint();
    try {
      const dataUrl = await renderPhoto(s);
      const path = await uploadRenderDataUrl(dataUrl);
      await savePhotoEdit({
        data: {
          asset_key: p.key,
          source_path: p.path || p.src || p.key,
          adjustments: s.adj,
          crop: s.crop,
          rotation: s.rotation,
          flip_h: s.flipH,
          ai_ops: s.aiOps,
          edited_path: path,
          label: p.room || p.name || null,
          as_copy: asCopy,
          editor_mode: modeFor(p),
          parent_asset_key: p.versionId || p.parentVersionId || p.assetId || null,
        },
      });
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
    if (!preview && s0.dirty) {
      const ok = await confirmDialog({
        title: "Download Preview?",
        body: "This Photo Has Unsaved Edits. Downloading The Preview Does Not Save Them To Your Library.",
        confirmLabel: "Download Preview",
      });
      if (!ok) return;
    }
    try {
      const url = preview || s0.dirty ? await renderPhoto(s0) : s0.base || s0.original || (await renderPhoto(s0));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(cur().room || cur().name || "photo").replace(/\s+/g, "-").toLowerCase()}.jpg`;
      a.click();
    } catch (err: any) {
      rdToast(err?.message || "That Photo Could Not Be Downloaded.", "error");
    }
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
    if (act === "autoapply") return void runAutoEnhance(true);
    if (act === "autoundo") return undoAuto();
    if (act === "resetgeo") return resetGeometry();
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
      paint();
      return paintCropBox();
    }
    if (act === "cropmode") {
      cropMode = !cropMode;
      cropBackup = cropMode ? (s.crop ? { ...s.crop } : null) : null;
      if (cropMode && !s.crop) return setRatio("1:1");
      paint();
      return paintCropBox();
    }
  });

  host.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    const s = st();
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
      const img = $("#rdpeImg") as HTMLImageElement;
      img.style.transform = transformString(s);
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
  const onResize = () => paintCropBox();
  window.addEventListener("resize", onResize);

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
    ro?.disconnect();
  };

  /* -------------------------------------------------------------- start */

  await ensureSource(cur());
  paint();
  void hydrate();

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
          <i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i>
        </div>
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
          <i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i>
        </div>
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
