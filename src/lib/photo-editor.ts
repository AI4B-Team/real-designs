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

import { rdToast } from "@/lib/rd-toast";
import { confirmDialog } from "@/lib/builder-card-menu";
import { roomPhotoUrl, uploadRenderDataUrl } from "@/lib/room-photos";
import { listPhotoEdits, savePhotoEdit, resetPhotoEdit } from "@/lib/photo-edits.functions";
import { runPhotoEdit } from "@/lib/photo-edit.functions";
import {
  type EditorMode,
  compareEnabled,
  defaultGenerationSource,
  defaultOpenSections,
  detectPhotoTraits,
  editedFromLabel,
  enhancementByOp,
  footerLayout,
  generativeEdits,
  photoEnhancements,
  primarySaveLabel,
} from "@/lib/photo-editor-context";

/* ------------------------------------------------------------------ model */

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

type PhotoState = {
  adj: Adj;
  rotation: number;
  straighten: number;
  flipH: boolean;
  crop: Crop;
  aiOps: string[];
  base: string | null; // current image (original or AI result)
  original: string | null; // untouched source in storage — never overwritten
  entry: string | null; // the image as it looked when the editor opened
  dirty: boolean;
  saving: boolean;
  history: string[];
  future: string[];
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
  { group: "color", key: "saturation", label: "Saturation", min: -100, max: 100 },
  { group: "color", key: "vibrance", label: "Vibrance", min: -100, max: 100 },
  { group: "detail", key: "sharpen", label: "Sharpen", min: 0, max: 100 },
  { group: "detail", key: "denoise", label: "Noise Reduction", min: 0, max: 100 },
] as const;

const RATIOS: { id: string; label: string; v: number | null }[] = [
  { id: "original", label: "Original", v: null },
  { id: "1:1", label: "1:1", v: 1 },
  { id: "4:3", label: "4:3", v: 4 / 3 },
  { id: "3:2", label: "3:2", v: 3 / 2 },
  { id: "16:9", label: "16:9", v: 16 / 9 },
  { id: "4:5", label: "4:5", v: 4 / 5 },
  { id: "9:16", label: "9:16", v: 9 / 16 },
];

const AUTO_ENHANCE: Adj = {
  exposure: 8,
  contrast: 12,
  shadows: 14,
  highlights: -10,
  saturation: 8,
  vibrance: 10,
  sharpen: 20,
};

function blankState(): PhotoState {
  return {
    adj: {},
    rotation: 0,
    straighten: 0,
    flipH: false,
    crop: null,
    aiOps: [],
    base: null,
    original: null,
    entry: null,
    dirty: false,
    saving: false,
    history: [],
    future: [],
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
  if (a("denoise")) parts.push(`blur(${(a("denoise") / 140).toFixed(2)}px)`);
  return parts.join(" ");
}

function hasEdits(st: PhotoState): boolean {
  return (
    Object.values(st.adj).some((v) => n(v) !== 0) ||
    st.rotation !== 0 ||
    st.straighten !== 0 ||
    st.flipH ||
    !!st.crop ||
    st.aiOps.length > 0
  );
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

/** Flatten the current state into a JPEG data URL. */
export async function renderPhoto(st: PhotoState): Promise<string> {
  const src = st.base || st.original;
  if (!src) throw new Error("Nothing to render.");
  const img = await loadImage(src);
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
  if (st.flipH) c.scale(-1, 1);
  (c as any).filter = filterString(st.adj);
  c.drawImage(img, -iw / 2, -ih / 2, iw, ih);
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
  return out.toDataURL("image/jpeg", 0.94);
}

/* ------------------------------------------------------------------- view */

let HOST: HTMLElement | null = null;

export async function openPhotoEditor(opts: {
  photos: EditorPhoto[];
  startKey?: string;
  property?: string;
  editorMode?: EditorMode;
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
  let aiPreview: { op: string; label: string; image: string } | null = null;
  let aiBusy = "";

  const host = document.createElement("div");
  host.className = "rdpe";
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-label", "Photo Editor");
  host.innerHTML = shellHtml();
  document.body.appendChild(host);
  document.body.classList.add("rdpe-open");
  HOST = host;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => host.querySelector(sel) as T;

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
      flipH: s.flipH,
      crop: s.crop,
      aiOps: s.aiOps,
      base: s.base,
    });
  }

  function push() {
    const s = st();
    s.history.push(snapshot(s));
    if (s.history.length > 40) s.history.shift();
    s.future = [];
    s.dirty = true;
  }

  function restore(s: PhotoState, snap: string) {
    const o = JSON.parse(snap);
    s.adj = o.adj || {};
    s.rotation = o.rotation || 0;
    s.straighten = o.straighten || 0;
    s.flipH = !!o.flipH;
    s.crop = o.crop || null;
    s.aiOps = o.aiOps || [];
    s.base = o.base ?? s.base;
  }

  function undo() {
    const s = st();
    if (!s.history.length) return;
    s.future.push(snapshot(s));
    restore(s, s.history.pop() as string);
    s.dirty = true;
    paint();
  }

  function redo() {
    const s = st();
    if (!s.future.length) return;
    s.history.push(snapshot(s));
    restore(s, s.future.pop() as string);
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

  function paint() {
    const p = cur();
    const s = st();
    const stage = $("#rdpeImg") as HTMLImageElement;
    const src = comparing ? s.entry || s.original : s.base || s.original;
    if (stage && src && stage.getAttribute("src") !== src) stage.setAttribute("src", src);
    if (stage) {
      const preview = aiPreview && !comparing ? aiPreview.image : null;
      if (preview && stage.getAttribute("src") !== preview) stage.setAttribute("src", preview);
      stage.style.filter = comparing ? "none" : filterString(s.adj);
      stage.style.transform = comparing
        ? "none"
        : `rotate(${s.rotation + s.straighten}deg) scaleX(${s.flipH ? -1 : 1})`;
    }

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
    const hold = $("#rdpeHold") as HTMLButtonElement;
    if (hold) {
      const on = compareEnabled(hasEdits(s) || !!aiPreview);
      hold.toggleAttribute("disabled", !on);
      hold.title = on ? "Hold To Compare With The Editor Original" : "Make An Adjustment To Compare";
    }
    const prov = $("#rdpeProv");
    if (prov) {
      const line = modeFor(p) === "generated" ? editedFromLabel(p.versionNumber ?? null) : null;
      prov.textContent = line || "";
      prov.classList.toggle("on", !!line);
    }
    host.classList.toggle("rdpe-crop", cropMode);
    host.classList.toggle("rdpe-compare", comparing);

    $("#rdpeStrip").innerHTML = photos
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
    (window as any).lucide?.createIcons?.({ nameAttr: "data-lucide" });
  }

  function sliderRow(a: (typeof ADJUSTMENTS)[number], v: number) {
    return `<label class="rdpe-slider">
      <span>${a.label}</span>
      <input type="range" min="${a.min}" max="${a.max}" step="1" value="${v}" data-adj="${a.key}"
        aria-label="${a.label}" title="Double-Click To Reset">
      <b class="rdpe-num">${v > 0 && a.min < 0 ? "+" : ""}${v}</b>
      <button type="button" class="rdpe-rst" data-reset-adj="${a.key}" aria-label="Reset ${a.label}"
        ${v === 0 ? "hidden" : ""}><i data-lucide="rotate-ccw"></i></button>
    </label>`;
  }

  function paintPanel() {
    const s = st();
    const g = (grp: string) =>
      ADJUSTMENTS.filter((a) => a.group === grp)
        .map((a) => sliderRow(a, n(s.adj[a.key], 0)))
        .join("");

    const traits = detectPhotoTraits(cur());
    const ops = photoEnhancements(traits);
    const gens = generativeEdits();
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
      <button type="button" class="rdpe-auto" data-act="auto"><i data-lucide="wand-sparkles"></i>
        <span><b>Quick Enhance</b><em>One-Click Exposure, Contrast And Color — No Credits</em></span></button>

      ${section("light", "Light", "sun", g("light"))}
      ${section("color", "Color", "palette", g("color"))}
      ${section("detail", "Detail", "focus", g("detail"))}
      ${section(
        "crop",
        "Crop & Rotate",
        "crop",
        `<div class="rdpe-ratios">${RATIOS.map(
          (r) =>
            `<button type="button" class="rdpe-chip ${
              (s.crop?.ratio || "original") === r.id ? "on" : ""
            }" data-ratio="${r.id}">${r.label}</button>`,
        ).join("")}</div>
        <div class="rdpe-rotrow">
          <button type="button" class="rdpe-ib" data-act="rotl" title="Rotate Left"><i data-lucide="rotate-ccw"></i></button>
          <button type="button" class="rdpe-ib" data-act="rotr" title="Rotate Right"><i data-lucide="rotate-cw"></i></button>
          <button type="button" class="rdpe-ib ${s.flipH ? "on" : ""}" data-act="flip" title="Flip Horizontal"><i data-lucide="flip-horizontal"></i></button>
          <button type="button" class="rdpe-ib ${cropMode ? "on" : ""}" data-act="cropmode" title="Adjust Crop"><i data-lucide="crop"></i></button>
        </div>
        <label class="rdpe-slider"><span>Straighten</span>
          <input type="range" min="-15" max="15" step="0.5" value="${s.straighten}" data-straighten aria-label="Straighten">
          <b class="rdpe-num">${s.straighten}°</b></label>`,
      )}
      ${section(
        "enhance",
        "Photo Enhancements",
        "sparkles",
        `<p class="rdpe-note">These Correct The Photograph. They Never Restage Or Redesign The Space.</p>
         <div class="rdpe-ai">${ops.map(opBtn).join("")}</div>`,
      )}
      ${section(
        "generative",
        "Generative Edits",
        "wand",
        `<p class="rdpe-note">These Change What Is In The Scene. You Mark The Target And Confirm The Credit Cost First.</p>
         <div class="rdpe-ai">${gens.map(opBtn).join("")}</div>`,
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
  }

  function section(id: string, label: string, icon: string, body: string) {
    const open = OPEN.has(id) ? " open" : "";
    return `<details class="rdpe-sec" data-sec="${id}"${open}>
      <summary><i data-lucide="${icon}"></i>${label}<i data-lucide="chevron-down" class="rdpe-caret"></i></summary>
      <div class="rdpe-secb">${body}</div>
    </details>`;
  }
  const OPEN = new Set<string>(defaultOpenSections());

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

  /* ------------------------------------------------------------- events */

  host.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const go1 = t.closest("[data-go]");
    if (go1) return void go(Number(go1.getAttribute("data-go")));
    const ratio = t.closest("[data-ratio]");
    if (ratio) return setRatio(ratio.getAttribute("data-ratio") as string);
    const rst = t.closest("[data-reset-adj]");
    if (rst) {
      push();
      st().adj[rst.getAttribute("data-reset-adj") as string] = 0;
      return paint();
    }
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
    if (act === "auto") {
      push();
      s.adj = { ...s.adj, ...AUTO_ENHANCE };
      return paint();
    }
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
    if (act === "cropmode") {
      cropMode = !cropMode;
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
      s.dirty = true;
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${n(t.value) > 0 ? "+" : ""}${t.value}`;
      const img = $("#rdpeImg") as HTMLImageElement;
      img.style.filter = filterString(s.adj);
    }
    if (t.hasAttribute("data-straighten")) {
      if (!t.dataset['pushed']) {
        push();
        t.dataset['pushed'] = "1";
      }
      s.straighten = n(t.value);
      s.dirty = true;
      const img = $("#rdpeImg") as HTMLImageElement;
      img.style.transform = `rotate(${s.rotation + s.straighten}deg) scaleX(${s.flipH ? -1 : 1})`;
      const out = t.parentElement?.querySelector(".rdpe-num");
      if (out) out.textContent = `${t.value}°`;
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
  (HOST as any).__teardown?.();
  HOST.remove();
  HOST = null;
  document.body.classList.remove("rdpe-open");
}

function shellHtml(): string {
  return `
  <header class="rdpe-top">
    <button type="button" class="rdpe-ib" data-act="close" aria-label="Close Photo Editor"><i data-lucide="x"></i></button>
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
