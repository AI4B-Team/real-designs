/**
 * Materials controls.
 *
 * One section inside the Canvas settings panel owns everything the Materials
 * tool needs: the free surface detection list, the manual surface fallback,
 * the include / exclude refinement brush, the compatible material catalog with
 * finish, colour, pattern, scale and grout choices, the option count, the
 * review screen shown before any credit is spent and the post-generation
 * report.
 *
 * Nothing here decides money or prompts: it only reads and writes the state
 * that @/lib/materials-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  BAND_NOTE,
  FAMILY_LABELS,
  isCompatible,
  material,
  materialGroups,
  materialsForSurface,
  surfaceKind,
  surfacesForSpace,
  type Material,
  type SurfaceKindId,
} from "@/lib/materials-catalog";
import {
  bindMaskPainting,
  paintFromLegacy,
  paintMaskLayer,
  renderMaskAssets,
  type MaskAssets,
} from "@/lib/mask-engine";
import {
  GROUT_OPTIONS,
  MASK_SUPPORT,
  emptyMask,
  maskRegions,
  materialsCostSentence,
  pushStroke,
  strokeIntent,
  redoStroke,
  undoStroke,
  type MaskState,
  type MaterialsBrief,
  type QualityReport,
  type RoomRead,
  type StrokeKind,
  type SurfaceDetection,
} from "@/lib/materials-brief";

import {
  hoverSurface,
  mountSurfaceOverlay,
  resetSurfaceOverlay,
  setSurfaceOverlayData,
  setSurfaceOverlayVisible,
  type DetectedSurface,
  type SurfaceCategory,
} from "@/lib/surface-overlay";

const byId = (id: string) => document.getElementById(id);

/* One canonical vocabulary: the catalog's surface kinds map to the shared
   overlay categories, so the image, the rows and the brief agree. */
const CATEGORY: Record<string, SurfaceCategory> = {
  flooring: "floor",
  wall_paint: "wall",
  wall_tile: "tile",
  backsplash: "backsplash",
  countertop: "countertop",
  cabinetry: "cabinet",
  island: "cabinet",
  ceiling: "ceiling",
  trim_doors: "trim",
  fireplace: "wall",
  siding: "siding",
  roofing: "roof",
  exterior_trim: "trim",
  front_door: "door",
  paving: "paving",
  decking: "paving",
  fencing: "other",
  gravel_bed: "lawn",
};

/** The detections rendered as canonical surface records for the overlay. */
export function canonicalSurfaces(): DetectedSurface[] {
  return state.detections.map((d) => ({
    id: d.id,
    label: d.label,
    category: CATEGORY[d.kind] || "other",
    currentMaterial: d.current,
    confidence: d.confidence,
    ...(d.polygon ? { polygon: d.polygon } : {}),
    box: d.box,
    ...(d.centroid ? { centroid: d.centroid } : {}),
    selected: d.id === state.surfaceId,
  }));
}

/** Pushes the current selection onto the photo. */
function paintOverlay() {
  try {
    setSurfaceOverlayData(canonicalSurfaces());
  } catch (_) {
    /* the overlay is a view of state, never its owner */
  }
}

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
  detections: [] as SurfaceDetection[],
  room: null as RoomRead | null,
  detecting: false,
  error: null as string | null,
  surfaceId: null as string | null,
  surfaceKind: null as SurfaceKindId | null,
  materialId: null as string | null,
  finishId: null as string | null,
  colorId: null as string | null,
  patternId: null as string | null,
  scaleId: null as string | null,
  groutId: "match" as string | null,
  mask: emptyMask() as MaskState,
  brush: "include" as StrokeKind,
  brushSize: 0.06,
  painting: false,
  space: "interior" as string,
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

export function materialsDetections(): SurfaceDetection[] {
  return state.detections.map((d) => ({ ...d }));
}

export function hasMaterialsDetections(): boolean {
  return state.detections.length > 0;
}

export function materialsRoomRead(): RoomRead | null {
  return state.room;
}

export function resetMaterials() {
  state.detections = [];
  state.room = null;
  state.detecting = false;
  state.error = null;
  state.surfaceId = null;
  state.surfaceKind = null;
  state.materialId = null;
  state.finishId = null;
  state.colorId = null;
  state.patternId = null;
  state.scaleId = null;
  state.mask = emptyMask();
  try {
    resetSurfaceOverlay();
  } catch (_) {}
  paintSurfaces();
  paintMaterials();
  paintMask();
  paintSummary();
}

export function setMaterialsDetecting(on: boolean, error?: string | null) {
  state.detecting = on;
  state.error = error ?? null;
  paintSurfaces();
}

export function setMaterialsDetections(detections: SurfaceDetection[], room: RoomRead | null) {
  state.room = room;
  state.detecting = false;
  state.error = null;
  state.detections = detections;
  /* Preselect the largest confident surface so the tool is never empty. */
  if (!state.surfaceId && detections.length) selectSurface(detections[0]!.id, false);
  paintSurfaces();
  paintMaterials();
  paintMask();
  paintOverlay();
  change();
}

/** The space drives which surfaces can be picked by hand. */
export function setMaterialsSpace(space: string) {
  state.space = space || "interior";
  paintManualSurfaces();
}

/* --------------------------------------------------------------- panel */

export function mountMaterialsPanel(opts?: { onChange?: () => void; onDetect?: () => void }) {
  onChangeCb = opts?.onChange || null;
  onDetectCb = opts?.onDetect || null;
  if (byId("rdMatSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdMatSec";
  sec.className = "rd-decl rd-mat";
  sec.hidden = true;
  sec.innerHTML =
    /* step 1 — surface */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>1 · Select A Surface</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdMatDetect">Detect Surfaces</button></div>' +
    '<p class="rd-decl-free">Detecting surfaces and browsing materials is free. Credits are only used when you confirm.</p>' +
    '<div class="rd-decl-list" id="rdMatList"></div>' +
    '<label class="rd-decl-lab">Or Pick The Surface Yourself</label>' +
    '<div class="rd-decl-chips" id="rdMatManual"></div>' +
    "</div>" +
    /* step 2 — refine */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>2 · Refine The Edges</b><span class="rd-decl-note">' +
    esc(MASK_SUPPORT.label) +
    "</span></div>" +
    '<div class="rd-decl-tools">' +
    '<button type="button" class="rd-decl-chip on" data-brush="include"><i data-lucide="brush"></i>Add To Surface</button>' +
    '<button type="button" class="rd-decl-chip" data-brush="exclude"><i data-lucide="shield"></i>Protect Area</button>' +
    '<button type="button" class="rd-decl-chip" id="rdMatUndo"><i data-lucide="undo-2"></i>Undo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdMatRedo"><i data-lucide="redo-2"></i>Redo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdMatErase"><i data-lucide="eraser"></i>Clear Marks</button>' +
    "</div>" +
    '<label class="rd-decl-lab">Brush Size</label>' +
    '<input type="range" id="rdMatBrushSize" min="2" max="18" value="6" class="rd-decl-range" aria-label="Brush size">' +
    '<div class="rd-decl-canvas" id="rdMatCanvasWrap">' +
    '<img id="rdMatThumb" alt="Source photo with the selected surface highlighted">' +
    '<canvas id="rdMatCanvas" width="600" height="400"></canvas>' +
    "</div>" +
    '<p class="rd-decl-muted">' +
    esc(MASK_SUPPORT.note) +
    "</p>" +
    "</div>" +
    /* step 3 — material */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>3 · Choose The Material</b><span class="rd-decl-note" id="rdMatFor"></span></div>' +
    '<div class="rd-mat-grid" id="rdMatCatalog"></div>' +
    '<div id="rdMatOptions"></div>' +
    "</div>" +
    /* step 4 — options */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>4 · Options To Generate</b></div>' +
    '<div class="rd-decl-chips" id="rdMatResults">' +
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
    '<p class="rd-decl-cost" id="rdMatCost"></p>' +
    '<p class="rd-decl-muted" id="rdMatBand"></p>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdMatToObject">' +
    '<i data-lucide="mouse-pointer-square-dashed"></i>Edit One Object Instead</button>' +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  wire(sec);
  try {
    mountSurfaceOverlay({
      onHover: (id) => highlightRow(id),
      onSelect: (id) => selectSurface(id),
    });
  } catch (_) {}
  paintManualSurfaces();
  paintSurfaces();
  paintMaterials();
  paintMask();
  paintSummary();
  icons();
}

export function setMaterialsPanelVisible(on: boolean) {
  const sec = byId("rdMatSec");
  if (sec) sec.hidden = !on;
  try {
    setSurfaceOverlayVisible(on);
    if (on) paintOverlay();
  } catch (_) {}
  if (on) {
    paintMask();
    paintSummary();
  }
}

/** Image hover reaching the inspector: one row lights up, nothing scrolls away. */
function highlightRow(id: string | null) {
  const host = byId("rdMatList");
  if (!host) return;
  host.querySelectorAll<HTMLElement>("[data-surface]").forEach((row) => {
    row.classList.toggle("is-hot", !!id && row.getAttribute("data-surface") === id);
  });
}

function selectSurface(id: string | null, repaint = true) {
  const det = state.detections.find((d) => d.id === id) || null;
  state.surfaceId = det ? det.id : null;
  if (det) state.surfaceKind = det.kind;
  ensureMaterialForSurface();
  if (repaint) {
    paintSurfaces();
    paintMaterials();
    paintMask();
    paintOverlay();
    change();
  }
}

function selectKind(kind: SurfaceKindId) {
  state.surfaceKind = kind;
  const det = state.detections.find((d) => d.kind === kind) || null;
  state.surfaceId = det ? det.id : null;
  ensureMaterialForSurface();
  paintSurfaces();
  paintMaterials();
  paintMask();
  paintOverlay();
  change();
}

/** A material is never left selected for a surface it cannot go on. */
function ensureMaterialForSurface() {
  if (state.materialId && isCompatible(state.surfaceKind, state.materialId)) return;
  const first = materialsForSurface(state.surfaceKind)[0] || null;
  setMaterial(first ? first.id : null, false);
}

function setMaterial(id: string | null, repaint = true) {
  state.materialId = id;
  const m = material(id);
  state.finishId = m?.finishes[0]?.id || null;
  state.colorId = m?.colors[0]?.id || null;
  state.patternId = m?.patterns?.[0]?.id || null;
  state.scaleId = m?.scales?.[0]?.id || null;
  if (repaint) {
    paintMaterials();
    change();
  }
}

function wire(sec: HTMLElement) {
  sec.addEventListener("click", (e) => {
    /* One shared Object Edit: Materials never grows its own targeted editor. */
    if ((e.target as HTMLElement).closest("#rdMatToObject")) {
      (window as any).rdOpenObjectEdit?.({ action: "material", surfaceKind: state.surfaceKind || null });
      return;
    }
    const t = e.target as HTMLElement;

    const row = t.closest("[data-surface]") as HTMLElement | null;
    if (row) {
      selectSurface(row.getAttribute("data-surface"));
      return;
    }
    const manual = t.closest("[data-kind]") as HTMLElement | null;
    if (manual) {
      selectKind((manual.getAttribute("data-kind") || "flooring") as SurfaceKindId);
      return;
    }
    const mat = t.closest("[data-material]") as HTMLElement | null;
    if (mat) {
      setMaterial(mat.getAttribute("data-material"));
      return;
    }
    const opt = t.closest("[data-opt]") as HTMLElement | null;
    if (opt) {
      const group = opt.getAttribute("data-opt") || "";
      const value = opt.getAttribute("data-val") || "";
      if (group === "finish") state.finishId = value;
      if (group === "color") state.colorId = value;
      if (group === "pattern") state.patternId = value;
      if (group === "scale") state.scaleId = value;
      if (group === "grout") state.groutId = value;
      paintMaterials();
      change();
      return;
    }
    const brush = t.closest("[data-brush]") as HTMLElement | null;
    if (brush) {
      state.brush = (brush.getAttribute("data-brush") || "include") as StrokeKind;
      sec
        .querySelectorAll<HTMLElement>("[data-brush]")
        .forEach((b) => b.classList.toggle("on", b.getAttribute("data-brush") === state.brush));
      return;
    }
    if (t.closest("#rdMatUndo")) {
      state.mask = undoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdMatRedo")) {
      state.mask = redoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdMatErase")) {
      state.mask = emptyMask();
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdMatDetect")) {
      onDetectCb?.();
      return;
    }
    const res = t.closest("[data-results]") as HTMLElement | null;
    if (res) {
      sec.querySelectorAll("#rdMatResults .rd-decl-chip").forEach((x) => x.classList.remove("on"));
      res.classList.add("on");
      change();
      return;
    }
  });

  /* Row hover previews that surface's mask and label on the image. */
  sec.addEventListener("pointerover", (e) => {
    const row = (e.target as HTMLElement)?.closest?.("[data-surface]") as HTMLElement | null;
    if (row) hoverSurface(row.getAttribute("data-surface"), "panel");
  });
  sec.addEventListener("pointerleave", () => hoverSurface(null, "panel"));

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "rdMatBrushSize") state.brushSize = Number((t as HTMLInputElement).value) / 100;
  });

  /* brush painting on the mask canvas — the shared engine owns the behaviour */
  const wrap = byId("rdMatCanvasWrap");
  if (wrap) {
    bindMaskPainting<StrokeKind>(wrap, {
      brush: () => state.brush,
      size: () => state.brushSize,
      onDab: (dab) => {
        state.mask = pushStroke(state.mask, dab);
      },
      onPaint: paintMask,
      onDone: change,
    });
  }
}

/* ------------------------------------------------------------ painters */

function sourceUrl(): string {
  const img = document.querySelector("#cBefore img") as HTMLImageElement | null;
  return img?.currentSrc || img?.src || "";
}

function paintManualSurfaces() {
  const host = byId("rdMatManual");
  if (!host) return;
  host.innerHTML = surfacesForSpace(state.space)
    .map(
      (k) =>
        '<button type="button" class="rd-decl-chip' +
        (state.surfaceKind === k.id ? " on" : "") +
        '" data-kind="' +
        k.id +
        '" title="' +
        esc(k.blurb) +
        '">' +
        esc(k.label) +
        "</button>",
    )
    .join("");
}

function paintSurfaces() {
  const host = byId("rdMatList");
  const btn = byId("rdMatDetect") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.detecting;
    btn.textContent = state.detecting
      ? "Detecting…"
      : state.detections.length
        ? "Detect Again"
        : "Detect Surfaces";
  }
  paintManualSurfaces();
  if (!host) return;

  if (state.detecting) {
    host.innerHTML = '<p class="rd-decl-muted">Reading the real surfaces in this photo…</p>';
    return;
  }
  if (state.error) {
    host.innerHTML = '<p class="rd-decl-warn">' + esc(state.error) + "</p>";
    return;
  }
  if (!state.detections.length) {
    host.innerHTML =
      '<p class="rd-decl-muted">No surfaces read yet. Run Detect Surfaces to see every finish in the photo, or pick the surface yourself and brush its exact area.</p>';
    return;
  }

  host.innerHTML = state.detections
    .map(
      (d) =>
        '<div class="rd-decl-row' +
        (d.id === state.surfaceId ? " is-remove" : "") +
        '" data-surface="' +
        d.id +
        '">' +
        '<span class="rd-decl-rowmain"><b>' +
        esc(d.label) +
        "</b><em>Currently " +
        esc(d.current) +
        (d.confidence < 0.55 ? " · Low Confidence" : "") +
        "</em></span>" +
        '<span class="rd-decl-seg"><button type="button" class="' +
        (d.id === state.surfaceId ? "on" : "") +
        '">' +
        (d.id === state.surfaceId ? "Selected" : "Select") +
        "</button></span></div>",
    )
    .join("");
  icons();
}

function optionRow(title: string, group: string, items: Array<{ id: string; label: string }>, current: string | null) {
  if (!items.length) return "";
  return (
    '<label class="rd-decl-lab">' +
    esc(title) +
    "</label>" +
    '<div class="rd-decl-chips">' +
    items
      .map(
        (o) =>
          '<button type="button" class="rd-decl-chip' +
          ((current || items[0]!.id) === o.id ? " on" : "") +
          '" data-opt="' +
          group +
          '" data-val="' +
          o.id +
          '">' +
          esc(o.label) +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}

function paintMaterials() {
  const forEl = byId("rdMatFor");
  const kind = surfaceKind(state.surfaceKind);
  if (forEl) forEl.textContent = kind ? "For " + kind.label : "Pick A Surface First";

  const host = byId("rdMatCatalog");
  if (host) {
    const groups = materialGroups(state.surfaceKind);
    host.innerHTML = !kind
      ? '<p class="rd-decl-muted">Select a surface and only the materials that can physically go on it are offered.</p>'
      : groups
          .map(
            (g) =>
              '<div class="rd-mat-group"><span class="rd-mat-fam">' +
              esc(g.label) +
              "</span>" +
              g.items
                .map(
                  (m: Material) =>
                    '<button type="button" class="rd-mat-card' +
                    (m.id === state.materialId ? " on" : "") +
                    '" data-material="' +
                    m.id +
                    '" title="' +
                    esc(m.blurb) +
                    '"><span class="rd-mat-sw" style="background:' +
                    esc(m.swatch) +
                    '"></span><b>' +
                    esc(m.name) +
                    "</b><em>" +
                    esc(m.blurb) +
                    "</em></button>",
                )
                .join("") +
              "</div>",
          )
          .join("");
  }

  const opts = byId("rdMatOptions");
  const m = material(state.materialId);
  if (opts) {
    if (!m) {
      opts.innerHTML = "";
    } else {
      const joints = m.family === "tile" || m.family === "stone" || m.family === "brick" || m.family === "paving";
      opts.innerHTML =
        optionRow("Colour", "color", m.colors, state.colorId) +
        optionRow("Finish", "finish", m.finishes, state.finishId) +
        (m.scales ? optionRow("Scale", "scale", m.scales, state.scaleId) : "") +
        (m.patterns ? optionRow("Layout", "pattern", m.patterns, state.patternId) : "") +
        (joints ? optionRow("Grout", "grout", GROUT_OPTIONS, state.groutId) : "");
    }
  }

  const band = byId("rdMatBand");
  if (band) band.textContent = m ? m.name + " · " + BAND_NOTE[m.band] + " Indicative only, not a quote." : "";
  icons();
}

function paintMask() {
  const img = byId("rdMatThumb") as HTMLImageElement | null;
  const canvas = byId("rdMatCanvas") as HTMLCanvasElement | null;
  if (!img || !canvas) return;
  const src = sourceUrl();
  if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const sel = state.detections.find((d) => d.id === state.surfaceId) || null;
  const regions = maskRegions(sel, state.detections, state.mask);
  paintMaskLayer(
    ctx,
    W,
    H,
    paintFromLegacy<StrokeKind>({
      edit: regions.target,
      protect: regions.keep,
      strokes: state.mask.strokes,
      intent: strokeIntent,
      feather: state.mask.feather,
    }),
    "overlay",
  );

  const undo = byId("rdMatUndo") as HTMLButtonElement | null;
  const redo = byId("rdMatRedo") as HTMLButtonElement | null;
  if (undo) undo.disabled = !state.mask.strokes.length;
  if (redo) redo.disabled = !state.mask.redo.length;
}

function paintSummary() {
  const cost = byId("rdMatCost");
  if (cost) cost.textContent = materialsCostSentence(readMaterialsResults());
}

/* ------------------------------------------------------------- readers */

export function readMaterialsResults(): number {
  const on = document.querySelector("#rdMatResults .rd-decl-chip.on") as HTMLElement | null;
  return Number(on?.getAttribute("data-results") || 1) || 1;
}

export function readMaterialsSettings() {
  return {
    surfaceId: state.surfaceId,
    surfaceKind: state.surfaceKind,
    detections: materialsDetections(),
    mask: { ...state.mask, strokes: state.mask.strokes.slice(), redo: state.mask.redo.slice() },
    materialId: state.materialId,
    finishId: state.finishId,
    colorId: state.colorId,
    patternId: state.patternId,
    scaleId: state.scaleId,
    groutId: state.groutId,
    results: readMaterialsResults(),
    notes: null as string | null,
    roomRead: state.room,
  };
}

/** Rehydrates the panel from a saved version's metadata. */
export function loadMaterialsState(input: {
  surfaceId: string | null;
  surfaceKind: SurfaceKindId;
  detections: SurfaceDetection[];
  mask: MaskState;
  materialId: string | null;
  finishId: string | null;
  colorId: string | null;
  patternId: string | null;
  scaleId: string | null;
  groutId: string | null;
}) {
  state.detections = input.detections;
  state.surfaceId = input.surfaceId;
  state.surfaceKind = input.surfaceKind;
  state.materialId = input.materialId;
  state.finishId = input.finishId;
  state.colorId = input.colorId;
  state.patternId = input.patternId;
  state.scaleId = input.scaleId;
  state.groutId = input.groutId || "match";
  state.mask = input.mask;
  paintSurfaces();
  paintMaterials();
  paintMask();
  change();
}

/* -------------------------------------------------------- mask overlay */

/**
 * Renders the mask the backend receives: the source photograph with the target
 * surface filled magenta and every protected surface outlined green.
 */
export function buildMaterialsMaskAssets(
  src: string,
  detections: SurfaceDetection[],
  selectedId: string | null,
  mask: MaskState,
  maxW = 1600,
): Promise<MaskAssets> {
  const sel = detections.find((d) => d.id === selectedId) || null;
  const regions = maskRegions(sel, detections, mask);
  const paint = paintFromLegacy<StrokeKind>({
    edit: regions.target,
    protect: regions.keep,
    strokes: mask.strokes,
    intent: strokeIntent,
    feather: mask.feather,
  });
  return renderMaskAssets(src, paint, { overlayMaxW: maxW });
}

/* --------------------------------------------------------- brief review */

export type MaterialsAnswer = "confirm" | "cancel";

/** The last screen before any credit is spent. */
export function openMaterialsReview(
  brief: MaterialsBrief,
  opts: { costLabel: string; sourceLabel: string; balanceNote?: string | null; overlay?: string | null },
): Promise<MaterialsAnswer> {
  return new Promise((resolve) => {
    byId("rdMatBrief")?.remove();
    const m = document.createElement("div");
    m.id = "rdMatBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Material Change">' +
      "<h3>Review This Material Change</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      (opts.overlay
        ? '<img class="rd-decl-preview" src="' + esc(opts.overlay) + '" alt="The selected surface highlighted on the source photo">'
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
      '<div class="up-act"><button class="btn btn-primary" id="rdMatGo" type="button">Apply Material · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Selection</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: MaterialsAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdMatGo") as HTMLButtonElement | null;
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
export function showMaterialsQuality(
  report: QualityReport | null,
  handlers: { onRegenerate?: () => void; onTryAnother?: () => void; onDismiss?: () => void } = {},
) {
  byId("rdMatQa")?.remove();
  if (!report || !report.issues.length) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdMatQa";
  el.className = "rd-stage-qa" + (report.rejected ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><div><b>' +
    esc(report.headline) +
    "</b><ul>" +
    report.issues.map((i) => "<li>" + esc(i.detail) + "</li>").join("") +
    "</ul>" +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdMatRegen">Tighter Mask And Retry</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdMatAnother">Try Another Material</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdMatQaClose">Keep This Result</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdMatRegen")?.addEventListener("click", () => {
    el.remove();
    handlers.onRegenerate?.();
  });
  byId("rdMatAnother")?.addEventListener("click", () => {
    el.remove();
    handlers.onTryAnother?.();
  });
  byId("rdMatQaClose")?.addEventListener("click", () => {
    el.remove();
    handlers.onDismiss?.();
  });
}

export { FAMILY_LABELS };
