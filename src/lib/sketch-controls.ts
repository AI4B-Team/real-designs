/**
 * Sketch To Render controls.
 *
 * One section inside the Canvas settings panel owns the whole workflow:
 * the drawing-type confirmation, the geometry review (with corrections),
 * dimension entry and scale calibration, camera placement, the render mode and
 * look settings, the brief the user confirms before any credit is spent, and
 * the drift report shown afterwards.
 *
 * Nothing here decides money or prompts: it reads and writes the state that
 * @/lib/sketch-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  CONCEPT_DISCLAIMER,
  DEFAULT_EYE_HEIGHT_FT,
  FINISH_GRADES,
  FOV_CHOICES,
  FURNITURE_LEVELS,
  GEOMETRY_KINDS,
  MATERIAL_DIRECTIONS,
  RENDER_MODES,
  SUPPORTED_KINDS,
  cameraMarker,
  cameraSentence,
  classificationWarning,
  costSentence,
  dimensionStatement,
  emptyGeometry,
  exportPlanText,
  geometryCounts,
  geometryKindLabel,
  modesForKind,
  newSceneId,
  rejectionMessage,
  renderMode,
  scaleStatement,
  sketchKindLabel,
  uncertainItems,
  type CameraMarker,
  type DimensionEntry,
  type DriftReport,
  type GeometryItem,
  type GeometryKind,
  type RenderModeId,
  type RestoredSketch,
  type ScaleCalibration,
  type SketchBrief,
  type SketchGeometry,
  type SketchKindId,
  type SourceClassification,
  type UnitId,
} from "@/lib/sketch-brief";

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

/* ------------------------------------------------------------- state */

const state = {
  classification: null as SourceClassification | null,
  classifying: false,
  classifyError: null as string | null,
  geometry: emptyGeometry() as SketchGeometry,
  detecting: false,
  detectError: null as string | null,
  removed: new Set<string>(),
  mode: "interior_perspective" as RenderModeId,
  cameras: [] as CameraMarker[],
  activeCameraId: null as string | null,
  placing: false,
  units: "ft" as UnitId,
  dimensions: [] as DimensionEntry[],
  scale: {
    known: false,
    reference: null,
    length: null,
    units: "unknown",
    source: null,
  } as ScaleCalibration,
  sceneId: null as string | null,
  continuity: [] as Array<{ mode: RenderModeId; label: string; camera: string | null }>,
};

let onChangeCb: (() => void) | null = null;
let classifyCb: (() => void) | null = null;
let detectCb: (() => void) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints itself next tick */
  }
}

/* ------------------------------------------------------------ accessors */

export function sketchClassification(): SourceClassification | null {
  return state.classification;
}

export function sketchGeometry(): SketchGeometry {
  return { ...state.geometry, items: state.geometry.items.filter((i) => !state.removed.has(i.id)) };
}

export function hasSketchGeometry(): boolean {
  return state.geometry.items.length > 0;
}

export function sketchSceneId(): string {
  if (!state.sceneId) state.sceneId = newSceneId();
  return state.sceneId;
}

export function resetSketch() {
  state.classification = null;
  state.classifyError = null;
  state.geometry = emptyGeometry();
  state.detectError = null;
  state.removed.clear();
  state.cameras = [];
  state.activeCameraId = null;
  state.dimensions = [];
  state.scale = { known: false, reference: null, length: null, units: "unknown", source: null };
  state.sceneId = null;
  state.continuity = [];
  paintAll();
}

export function setSketchClassifying(on: boolean, error?: string | null) {
  state.classifying = on;
  state.classifyError = error ?? null;
  paintClassify();
}

export function setSketchClassification(c: SourceClassification | null) {
  state.classification = c;
  state.classifying = false;
  state.classifyError = null;
  if (c && c.supported) {
    const allowed = modesForKind(c.kind);
    if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
  }
  paintAll();
}

export function setSketchDetecting(on: boolean, error?: string | null) {
  state.detecting = on;
  state.detectError = error ?? null;
  paintGeometry();
}

export function setSketchGeometry(g: SketchGeometry | null) {
  state.geometry = g || emptyGeometry();
  state.detecting = false;
  state.detectError = null;
  state.removed.clear();
  if (state.geometry.units !== "unknown") state.units = state.geometry.units;
  if (state.geometry.scale.known) state.scale = state.geometry.scale;
  /* Camera markers drawn on the plan become real, movable cameras. */
  state.geometry.items
    .filter((i) => i.kind === "camera")
    .forEach((i, idx) => {
      if (state.cameras.some((c) => c.id === "drawn-" + i.id)) return;
      state.cameras.push(
        cameraMarker({
          id: "drawn-" + i.id,
          x: i.box.x + i.box.w / 2,
          y: i.box.y + i.box.h / 2,
          label: i.label || "Drawn View " + (idx + 1),
        }),
      );
    });
  if (!state.activeCameraId && state.cameras.length) state.activeCameraId = state.cameras[0]!.id;
  paintAll();
}

/** Records a finished view so later views of the same scene stay consistent. */
export function noteSketchView(label: string, mode: RenderModeId, camera: CameraMarker | null) {
  state.continuity.push({ mode, label, camera: camera ? camera.label : null });
  if (state.continuity.length > 8) state.continuity.shift();
  paintSummary();
}

export function sketchContinuity() {
  return state.continuity.slice();
}

/* --------------------------------------------------------------- mount */

export function mountSketchPanel(opts?: {
  onChange?: () => void;
  onClassify?: () => void;
  onDetect?: () => void;
}) {
  onChangeCb = opts?.onChange || null;
  classifyCb = opts?.onClassify || null;
  detectCb = opts?.onDetect || null;
  if (byId("rdSketchSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdSketchSec";
  sec.className = "rd-stage rd-sketch";
  sec.hidden = true;
  sec.innerHTML =
    /* what was uploaded */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Your Drawing</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchClassify">Read Drawing</button></div>' +
    '<div id="rdSketchClass"></div>' +
    "</div>" +
    /* geometry */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Geometry Review</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchDetect">Detect Geometry</button></div>' +
    '<div id="rdSketchGeo"></div>' +
    '<div class="rd-sketch-addgeo">' +
    '<select class="rd-stage-sel" id="rdSketchAddKind">' +
    GEOMETRY_KINDS.map((k) => '<option value="' + k.id + '">' + esc(k.label) + "</option>").join("") +
    "</select>" +
    '<input type="text" id="rdSketchAddLabel" placeholder="Example: missing hallway door" aria-label="Element the detector missed">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchAdd">Add</button>' +
    "</div>" +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchExport">Export Interpreted Plan</button>' +
    "</div>" +
    /* dimensions and scale */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Dimensions &amp; Scale</b><span class="rd-stage-note">Optional</span></div>' +
    '<div class="rd-sketch-units">' +
    '<button type="button" class="rd-stage-chip on" data-unit="ft">Feet</button>' +
    '<button type="button" class="rd-stage-chip" data-unit="m">Meters</button>' +
    "</div>" +
    '<div class="rd-sketch-dims" id="rdSketchDims"></div>' +
    '<div class="rd-sketch-addgeo">' +
    '<input type="text" id="rdSketchDimLabel" placeholder="What you measured" aria-label="Dimension label">' +
    '<input type="number" id="rdSketchDimValue" min="0" step="0.1" placeholder="0" aria-label="Dimension value">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchDimAdd">Add</button>' +
    "</div>" +
    '<label class="rd-stage-lab">Scale Calibration</label>' +
    '<div class="rd-sketch-addgeo">' +
    '<input type="text" id="rdSketchScaleRef" placeholder="Known length, e.g. front wall" aria-label="Scale reference">' +
    '<input type="number" id="rdSketchScaleLen" min="0" step="0.1" placeholder="0" aria-label="Scale length">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchScaleSet">Calibrate</button>' +
    "</div>" +
    '<p class="rd-stage-muted" id="rdSketchScaleNote"></p>' +
    "</div>" +
    /* render mode */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Render Mode</b></div>' +
    '<div class="rd-stage-modes" id="rdSketchModes"></div>' +
    "</div>" +
    /* camera */
    '<div class="rd-stage-block" id="rdSketchCamBlock">' +
    '<div class="rd-stage-h"><b>Camera</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchPlace">Place Camera</button></div>' +
    '<div class="rd-sketch-plan" id="rdSketchPlan"></div>' +
    '<div class="rd-sketch-cams" id="rdSketchCams"></div>' +
    '<div id="rdSketchCamCtl"></div>' +
    "</div>" +
    /* look */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Look</b></div>' +
    '<label class="rd-stage-lab">Material Direction</label>' +
    '<div class="rd-stage-chips" data-group="matdir">' +
    MATERIAL_DIRECTIONS.map(
      (m, i) =>
        '<button type="button" class="rd-stage-chip' +
        (i === 0 ? " on" : "") +
        '" data-matdir="' +
        m.id +
        '" title="' +
        esc(m.rule) +
        '">' +
        esc(m.label) +
        "</button>",
    ).join("") +
    "</div>" +
    '<label class="rd-stage-lab">Furniture Level</label>' +
    '<div class="rd-stage-chips" data-group="furn">' +
    FURNITURE_LEVELS.map(
      (f) =>
        '<button type="button" class="rd-stage-chip' +
        (f.id === "balanced" ? " on" : "") +
        '" data-furn="' +
        f.id +
        '" title="' +
        esc(f.rule) +
        '">' +
        esc(f.label) +
        "</button>",
    ).join("") +
    "</div>" +
    '<label class="rd-stage-lab">Finish Grade</label>' +
    '<div class="rd-stage-chips" data-group="finish">' +
    FINISH_GRADES.map(
      (f) =>
        '<button type="button" class="rd-stage-chip' +
        (f.id === "retail" ? " on" : "") +
        '" data-finish="' +
        f.id +
        '" title="' +
        esc(f.rule) +
        '">' +
        esc(f.label) +
        "</button>",
    ).join("") +
    "</div>" +
    "</div>" +
    /* results */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Results</b></div>' +
    '<div class="rd-stage-chips" data-group="res">' +
    [1, 2, 3, 4]
      .map(
        (n) =>
          '<button type="button" class="rd-stage-chip' +
          (n === 1 ? " on" : "") +
          '" data-res="' +
          n +
          '">' +
          n +
          "</button>",
      )
      .join("") +
    "</div>" +
    '<p class="rd-stage-cost" id="rdSketchCost"></p>' +
    '<p class="rd-stage-muted" id="rdSketchDisc">' +
    esc(CONCEPT_DISCLAIMER) +
    "</p>" +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  paintAll();

  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("#rdSketchClassify")) return void classifyCb?.();
    if (t.closest("#rdSketchDetect")) return void detectCb?.();
    if (t.closest("#rdSketchExport")) return void downloadPlan();

    const kindBtn = t.closest("[data-kind]") as HTMLElement | null;
    if (kindBtn) {
      const id = kindBtn.getAttribute("data-kind") as SketchKindId;
      if (state.classification) {
        state.classification = { ...state.classification, kind: id, label: sketchKindLabel(id), supported: true, confirmed: true, confidence: 1 };
        const allowed = modesForKind(id);
        if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
      }
      paintAll();
      change();
      return;
    }
    if (t.closest("#rdSketchConfirmKind")) {
      if (state.classification) state.classification = { ...state.classification, confirmed: true };
      paintAll();
      change();
      return;
    }
    const del = t.closest("[data-geodel]") as HTMLElement | null;
    if (del) {
      const id = del.getAttribute("data-geodel") || "";
      if (state.removed.has(id)) state.removed.delete(id);
      else state.removed.add(id);
      paintGeometry();
      change();
      return;
    }
    if (t.closest("#rdSketchAdd")) {
      addGeometryItem();
      return;
    }
    if (t.closest("#rdSketchDimAdd")) {
      addDimension();
      return;
    }
    const dimDel = t.closest("[data-dimdel]") as HTMLElement | null;
    if (dimDel) {
      const id = dimDel.getAttribute("data-dimdel") || "";
      state.dimensions = state.dimensions.filter((d) => d.id !== id);
      paintDimensions();
      change();
      return;
    }
    if (t.closest("#rdSketchScaleSet")) {
      calibrateScale();
      return;
    }
    const unit = t.closest("[data-unit]") as HTMLElement | null;
    if (unit) {
      state.units = (unit.getAttribute("data-unit") as UnitId) || "ft";
      sec.querySelectorAll<HTMLElement>("[data-unit]").forEach((b) => b.classList.toggle("on", b === unit));
      paintDimensions();
      paintCameraControls();
      change();
      return;
    }
    const mode = t.closest("[data-mode]") as HTMLElement | null;
    if (mode) {
      state.mode = (mode.getAttribute("data-mode") as RenderModeId) || "interior_perspective";
      paintModes();
      paintCameraBlock();
      change();
      return;
    }
    if (t.closest("#rdSketchPlace")) {
      state.placing = !state.placing;
      paintCameraBlock();
      return;
    }
    const cam = t.closest("[data-cam]") as HTMLElement | null;
    if (cam) {
      state.activeCameraId = cam.getAttribute("data-cam");
      paintCameraBlock();
      change();
      return;
    }
    const camDel = t.closest("[data-camdel]") as HTMLElement | null;
    if (camDel) {
      const id = camDel.getAttribute("data-camdel");
      state.cameras = state.cameras.filter((c) => c.id !== id);
      if (state.activeCameraId === id) state.activeCameraId = state.cameras[0]?.id || null;
      paintCameraBlock();
      change();
      return;
    }
    const chip = t.closest(
      '.rd-stage-chip[data-matdir],.rd-stage-chip[data-furn],.rd-stage-chip[data-finish],.rd-stage-chip[data-res]',
    ) as HTMLElement | null;
    if (chip) {
      chip.parentElement?.querySelectorAll(".rd-stage-chip").forEach((x) => x.classList.remove("on"));
      chip.classList.add("on");
      change();
      return;
    }
  });

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("[data-camfield]")) {
      const field = t.getAttribute("data-camfield") || "";
      const cam = activeCamera();
      if (!cam) return;
      const v = parseFloat((t as HTMLInputElement).value);
      if (!Number.isFinite(v)) return;
      const next = cameraMarker({ ...cam, [field]: v } as any);
      state.cameras = state.cameras.map((c) => (c.id === cam.id ? next : c));
      paintPlan();
      paintCameraReadout();
      change();
    }
  });

  sec.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e as KeyboardEvent).key !== "Enter") return;
    if (t.id === "rdSketchAddLabel") {
      e.preventDefault();
      addGeometryItem();
    }
    if (t.id === "rdSketchDimLabel" || t.id === "rdSketchDimValue") {
      e.preventDefault();
      addDimension();
    }
  });

  icons();
}

export function setSketchPanelVisible(on: boolean) {
  const sec = byId("rdSketchSec");
  if (sec) sec.hidden = !on;
}

/* ------------------------------------------------------------- editing */

function addGeometryItem() {
  const kindSel = byId("rdSketchAddKind") as HTMLSelectElement | null;
  const labelEl = byId("rdSketchAddLabel") as HTMLInputElement | null;
  const label = (labelEl?.value || "").trim();
  if (!label) return;
  const kind = (kindSel?.value as GeometryKind) || "wall";
  const item: GeometryItem = {
    id: "user-" + Math.random().toString(36).slice(2, 8),
    kind,
    label,
    box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
    confidence: 1,
    detail: "Added by the user because the reader missed it.",
    dimension: null,
    origin: "user",
  };
  state.geometry = { ...state.geometry, items: state.geometry.items.concat(item) };
  if (labelEl) labelEl.value = "";
  paintGeometry();
  change();
}

function addDimension() {
  const labelEl = byId("rdSketchDimLabel") as HTMLInputElement | null;
  const valEl = byId("rdSketchDimValue") as HTMLInputElement | null;
  const label = (labelEl?.value || "").trim();
  const value = parseFloat(valEl?.value || "");
  if (!label || !Number.isFinite(value) || value <= 0) return;
  state.dimensions.push({
    id: "dim-" + Math.random().toString(36).slice(2, 8),
    label,
    value,
    units: state.units,
    entered: true,
  });
  if (labelEl) labelEl.value = "";
  if (valEl) valEl.value = "";
  paintDimensions();
  change();
}

function calibrateScale() {
  const refEl = byId("rdSketchScaleRef") as HTMLInputElement | null;
  const lenEl = byId("rdSketchScaleLen") as HTMLInputElement | null;
  const reference = (refEl?.value || "").trim();
  const length = parseFloat(lenEl?.value || "");
  if (!reference || !Number.isFinite(length) || length <= 0) return;
  state.scale = { known: true, reference, length, units: state.units, source: "user" };
  paintScale();
  change();
}

function downloadPlan() {
  const text = exportPlanText(sketchGeometry(), {
    kind: state.classification?.kind || "hand_sketch",
    dimensions: state.dimensions,
    cameras: state.cameras,
    units: state.units,
  });
  try {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "interpreted-plan.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (_) {
    /* export is a convenience, never a blocker */
  }
}

function activeCamera(): CameraMarker | null {
  return state.cameras.find((c) => c.id === state.activeCameraId) || state.cameras[0] || null;
}

/* ------------------------------------------------------------ painting */

function paintAll() {
  paintClassify();
  paintGeometry();
  paintDimensions();
  paintScale();
  paintModes();
  paintCameraBlock();
  paintSummary();
}

function paintClassify() {
  const host = byId("rdSketchClass");
  if (!host) return;
  const btn = byId("rdSketchClassify") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.classifying;
    btn.textContent = state.classifying ? "Reading…" : state.classification ? "Read Again" : "Read Drawing";
  }
  if (state.classifying) {
    host.innerHTML = '<p class="rd-stage-muted">Working out what kind of drawing this is…</p>';
    return;
  }
  if (state.classifyError) {
    host.innerHTML = '<p class="rd-stage-warn">' + esc(state.classifyError) + "</p>";
    return;
  }
  const c = state.classification;
  if (!c) {
    host.innerHTML =
      '<p class="rd-stage-muted">Upload a hand sketch, floor plan, blueprint, elevation, line drawing or annotated concept drawing, then read it. Nothing renders until the drawing type is confirmed.</p>';
    return;
  }
  if (!c.supported) {
    host.innerHTML = '<p class="rd-stage-warn">' + esc(rejectionMessage(c) || "") + "</p>";
    return;
  }
  const warn = classificationWarning(c);
  host.innerHTML =
    '<div class="rd-stage-drow"><span class="k">Read As</span><span class="v">' +
    esc(c.label) +
    " · " +
    Math.round(c.confidence * 100) +
    "% sure</span></div>" +
    (c.summary ? '<p class="rd-stage-muted">' + esc(c.summary) + "</p>" : "") +
    (warn ? '<p class="rd-stage-warn">' + esc(warn) + "</p>" : "") +
    '<label class="rd-stage-lab">This Drawing Is</label>' +
    '<div class="rd-stage-chips">' +
    SUPPORTED_KINDS.map(
      (k) =>
        '<button type="button" class="rd-stage-chip' +
        (k.id === c.kind ? " on" : "") +
        '" data-kind="' +
        k.id +
        '" title="' +
        esc(k.blurb) +
        '">' +
        esc(k.label) +
        "</button>",
    ).join("") +
    "</div>" +
    (c.confirmed
      ? '<p class="rd-stage-muted">Confirmed as ' + esc(c.label) + ".</p>"
      : '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchConfirmKind">Confirm ' +
        esc(c.label) +
        "</button>");
}

function paintGeometry() {
  const host = byId("rdSketchGeo");
  if (!host) return;
  const btn = byId("rdSketchDetect") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.detecting;
    btn.textContent = state.detecting
      ? "Reading…"
      : state.geometry.items.length
        ? "Detect Again"
        : "Detect Geometry";
  }
  if (state.detecting) {
    host.innerHTML = '<p class="rd-stage-muted">Tracing walls, openings, rooms and fixtures…</p>';
    return;
  }
  if (state.detectError) {
    host.innerHTML = '<p class="rd-stage-warn">' + esc(state.detectError) + "</p>";
    return;
  }
  if (!state.geometry.items.length) {
    host.innerHTML =
      '<p class="rd-stage-muted">No geometry has been read yet. Rendering stays disabled until the drawing has been traced and you have checked it.</p>';
    return;
  }
  const counts = geometryCounts(sketchGeometry());
  const uncertain = uncertainItems(sketchGeometry());
  const groups = GEOMETRY_KINDS.map((k) => {
    const items = state.geometry.items.filter((i) => i.kind === k.id);
    if (!items.length) return "";
    return (
      '<div class="rd-sketch-group"><span class="rd-sketch-gh">' +
      esc(k.plural) +
      " · " +
      items.filter((i) => !state.removed.has(i.id)).length +
      "</span>" +
      items
        .map(
          (i) =>
            '<button type="button" class="rd-sketch-el' +
            (state.removed.has(i.id) ? " off" : "") +
            (i.origin === "detected" && i.confidence < 0.55 ? " low" : "") +
            '" data-geodel="' +
            esc(i.id) +
            '" title="Tap to Remove or Restore This Element">' +
            "<b>" +
            esc(i.label) +
            "</b>" +
            (i.dimension ? '<em class="dim">' + esc(i.dimension) + "</em>" : "") +
            "<em>" +
            (i.origin === "user" ? "added by you" : Math.round(i.confidence * 100) + "%") +
            "</em></button>",
        )
        .join("") +
      "</div>"
    );
  }).join("");
  host.innerHTML =
    '<p class="rd-stage-muted">' +
    esc(
      (counts.wall || 0) +
        " walls, " +
        (counts.room || 0) +
        " rooms, " +
        ((counts.door || 0) + (counts.window || 0) + (counts.opening || 0)) +
        " openings, " +
        (counts.fixture || 0) +
        " fixtures.",
    ) +
    "</p>" +
    (state.geometry.summary ? '<p class="rd-stage-muted">' + esc(state.geometry.summary) + "</p>" : "") +
    (uncertain.length
      ? '<p class="rd-stage-warn">' +
        uncertain.length +
        " element" +
        (uncertain.length > 1 ? "s were" : " was") +
        " read with low confidence. Check the highlighted items before rendering.</p>"
      : "") +
    (state.geometry.warnings.length
      ? '<ul class="rd-sketch-warns">' +
        state.geometry.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
        "</ul>"
      : "") +
    '<div class="rd-sketch-groups">' +
    groups +
    "</div>" +
    '<p class="rd-stage-muted">Tap anything the reader got wrong to drop it, and add whatever it missed below.</p>';
  paintPlan();
}

function paintDimensions() {
  const host = byId("rdSketchDims");
  if (!host) return;
  const read = state.geometry.items.filter((i) => i.kind === "dimension" && i.dimension);
  host.innerHTML =
    (read.length
      ? '<p class="rd-stage-muted">Read from the drawing: ' +
        esc(read.map((r) => r.label + " " + r.dimension).join(", ")) +
        "</p>"
      : "") +
    (state.dimensions.length
      ? state.dimensions
          .map(
            (d) =>
              '<button type="button" class="rd-stage-tag" data-dimdel="' +
              esc(d.id) +
              '">' +
              esc(d.label + " · " + d.value + (d.units === "m" ? "m" : "ft")) +
              '<i data-lucide="x"></i></button>',
          )
          .join("")
      : "") +
    '<p class="rd-stage-muted">' +
    esc(dimensionStatement(sketchGeometry(), state.dimensions)) +
    "</p>";
  icons();
}

function paintScale() {
  const note = byId("rdSketchScaleNote");
  if (note) note.textContent = scaleStatement(state.scale);
}

function paintModes() {
  const host = byId("rdSketchModes");
  if (!host) return;
  const allowed = modesForKind(state.classification?.kind || "hand_sketch");
  const ordered = RENDER_MODES.slice().sort(
    (a, b) => (allowed.indexOf(a.id) + 99 * (allowed.indexOf(a.id) < 0 ? 1 : 0)) - (allowed.indexOf(b.id) + 99 * (allowed.indexOf(b.id) < 0 ? 1 : 0)),
  );
  host.innerHTML = ordered
    .map(
      (m) =>
        '<button type="button" class="rd-stage-mode' +
        (m.id === state.mode ? " on" : "") +
        '" data-mode="' +
        m.id +
        '"><b>' +
        esc(m.label) +
        "</b><span>" +
        esc(m.blurb + (allowed.includes(m.id) ? "" : " Unusual for this drawing type.")) +
        "</span></button>",
    )
    .join("");
}

function paintCameraBlock() {
  const block = byId("rdSketchCamBlock");
  const mode = renderMode(state.mode);
  if (block) block.hidden = !mode.needsCamera;
  const place = byId("rdSketchPlace");
  if (place) {
    place.textContent = state.placing ? "Done Placing" : "Place Camera";
    place.classList.toggle("on", state.placing);
  }
  const cams = byId("rdSketchCams");
  if (cams)
    cams.innerHTML = state.cameras.length
      ? state.cameras
          .map(
            (c) =>
              '<span class="rd-sketch-cam' +
              (c.id === activeCamera()?.id ? " on" : "") +
              '"><button type="button" data-cam="' +
              esc(c.id) +
              '">' +
              esc(c.label) +
              '</button><button type="button" class="x" data-camdel="' +
              esc(c.id) +
              '" aria-label="Remove ' +
              esc(c.label) +
              '"><i data-lucide="x"></i></button></span>',
          )
          .join("")
      : '<p class="rd-stage-muted">No camera placed yet. This view cannot render until you place one on the drawing.</p>';
  paintCameraControls();
  paintPlan();
  icons();
}

function paintCameraControls() {
  const host = byId("rdSketchCamCtl");
  if (!host) return;
  const cam = activeCamera();
  if (!cam) {
    host.innerHTML = "";
    return;
  }
  const u = state.units === "m" ? "m" : "ft";
  host.innerHTML =
    '<label class="rd-stage-lab">Direction · ' +
    Math.round(cam.direction) +
    "°</label>" +
    '<input type="range" class="rd-sketch-range" data-camfield="direction" min="0" max="359" step="1" value="' +
    Math.round(cam.direction) +
    '">' +
    '<label class="rd-stage-lab">Approximate Eye Height · ' +
    cam.height +
    u +
    "</label>" +
    '<input type="range" class="rd-sketch-range" data-camfield="height" min="' +
    (state.units === "m" ? "0.8" : "3") +
    '" max="' +
    (state.units === "m" ? "5" : "16") +
    '" step="0.1" value="' +
    cam.height +
    '">' +
    '<label class="rd-stage-lab">Field Of View · ' +
    Math.round(cam.fov) +
    "°</label>" +
    '<input type="range" class="rd-sketch-range" data-camfield="fov" min="20" max="120" step="1" value="' +
    Math.round(cam.fov) +
    '">' +
    '<p class="rd-stage-muted" id="rdSketchCamRead">' +
    esc(cameraSentence(cam, state.units)) +
    "</p>" +
    '<p class="rd-stage-muted">Common lenses: ' +
    FOV_CHOICES.map((f) => f.label + " ≈ " + f.fov + "°").join(", ") +
    ". Eye height is approximate by definition.</p>";
}

function paintCameraReadout() {
  const el = byId("rdSketchCamRead");
  const cam = activeCamera();
  if (el && cam) el.textContent = cameraSentence(cam, state.units);
}

function paintPlan() {
  const host = byId("rdSketchPlan");
  if (!host) return;
  const img = document.querySelector("#cBefore img") as HTMLImageElement | null;
  const src = img?.currentSrc || img?.src || "";
  host.style.backgroundImage = src ? 'url("' + src + '")' : "none";
  host.classList.toggle("placing", state.placing);
  host.innerHTML = state.cameras
    .map(
      (c) =>
        '<span class="rd-sketch-pin' +
        (c.id === activeCamera()?.id ? " on" : "") +
        '" style="left:' +
        (c.x * 100).toFixed(1) +
        "%;top:" +
        (c.y * 100).toFixed(1) +
        "%;--rd-cam-dir:" +
        Math.round(c.direction) +
        'deg" title="' +
        esc(c.label) +
        '"><i></i></span>',
    )
    .join("");
  if (!host.dataset["wired"]) {
    host.dataset["wired"] = "1";
    host.addEventListener("click", (e) => {
      const rect = host.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      if (state.placing) {
        const cam = cameraMarker({
          id: "cam-" + Math.random().toString(36).slice(2, 8),
          x,
          y,
          height: state.units === "m" ? 1.6 : DEFAULT_EYE_HEIGHT_FT,
          label: "View " + (state.cameras.length + 1),
        });
        state.cameras.push(cam);
        state.activeCameraId = cam.id;
        state.placing = false;
        paintCameraBlock();
        change();
        return;
      }
      const cam = activeCamera();
      if (!cam) return;
      /* Clicking with a camera selected aims it at the point you clicked. */
      const dir = (Math.atan2(x - cam.x, cam.y - y) * 180) / Math.PI;
      const next = cameraMarker({ ...cam, direction: (dir + 360) % 360 });
      state.cameras = state.cameras.map((c) => (c.id === cam.id ? next : c));
      paintCameraBlock();
      change();
    });
  }
}

function paintSummary() {
  const cost = byId("rdSketchCost");
  if (cost) cost.textContent = costSentence(readSketchResults());
}

/* ------------------------------------------------------------- readers */

function readChip(group: string, fallback: string): string {
  const on = document.querySelector('#rdSketchSec .rd-stage-chips[data-group="' + group + '"] .rd-stage-chip.on');
  return on?.getAttribute("data-" + group) || fallback;
}

export function readSketchResults(): number {
  return parseInt(readChip("res", "1"), 10) || 1;
}

export function readSketchMode(): RenderModeId {
  return state.mode;
}

export function activeSketchCamera(): CameraMarker | null {
  return activeCamera();
}

/** Everything the panel holds, ready for buildSketchBrief(). */
export function readSketchSettings() {
  return {
    classification: state.classification,
    geometry: sketchGeometry(),
    mode: state.mode,
    cameras: state.cameras.slice(),
    activeCameraId: activeCamera()?.id || null,
    materialDirection: readChip("matdir", "auto"),
    furnitureLevel: readChip("furn", "balanced"),
    finishGrade: readChip("finish", "retail"),
    units: state.units,
    dimensions: state.dimensions.slice(),
    scale: state.scale,
    results: readSketchResults(),
    sceneId: sketchSceneId(),
    continuity: state.continuity.slice(),
  };
}

/** Rehydrates the panel from a saved version. */
export function loadSketchState(r: RestoredSketch) {
  state.classification = r.classification;
  state.geometry = r.geometry;
  state.removed.clear();
  state.mode = r.mode;
  state.cameras = r.cameras;
  state.activeCameraId = r.activeCameraId;
  state.units = r.units;
  state.dimensions = r.dimensions;
  state.scale = r.scale;
  state.sceneId = r.sceneId;
  state.continuity = r.continuity as any;
  paintAll();
  const set = (group: string, value: string) => {
    document
      .querySelectorAll<HTMLElement>('#rdSketchSec .rd-stage-chips[data-group="' + group + '"] .rd-stage-chip')
      .forEach((b) => b.classList.toggle("on", b.getAttribute("data-" + group) === value));
  };
  set("matdir", r.materialDirection);
  set("furn", r.furnitureLevel);
  set("finish", r.finishGrade);
  change();
}

/* --------------------------------------------------------- brief review */

export type SketchBriefAnswer = "confirm" | "cancel";

/**
 * The last screen before any credit is spent. It states the exact geometry
 * being locked, the exact cost, and that the output is a concept.
 */
export function openSketchBriefReview(
  brief: SketchBrief,
  opts: { costLabel: string; balanceNote?: string | null },
): Promise<SketchBriefAnswer> {
  return new Promise((resolve) => {
    byId("rdSketchBrief")?.remove();
    const m = document.createElement("div");
    m.id = "rdSketchBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Render Brief">' +
      "<h3>Review Your Render Brief</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
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
      esc(brief.disclaimer) +
      "</p>" +
      '<div class="up-act"><button class="btn btn-primary" id="rdSketchGo" type="button">Render Sketch · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Settings</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: SketchBriefAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdSketchGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* ---------------------------------------------------------- drift panel */

/** Honest reporting of the automatic geometry comparison. */
export function showSketchDrift(
  report: DriftReport | null,
  handlers: { onRegenerate?: () => void; onDismiss?: () => void } = {},
) {
  byId("rdSketchQa")?.remove();
  if (!report || !report.issues.length) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdSketchQa";
  el.className = "rd-stage-qa" + (report.major ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><div><b>' +
    esc(report.headline) +
    "</b><ul>" +
    report.issues.map((i) => "<li>" + esc(i.detail) + "</li>").join("") +
    "</ul>" +
    '<p class="rd-stage-muted">' +
    esc(report.disclaimer) +
    "</p>" +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdSketchRegen">Render Again</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdSketchQaClose">Keep This Render</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdSketchRegen")?.addEventListener("click", () => {
    el.remove();
    handlers.onRegenerate?.();
  });
  byId("rdSketchQaClose")?.addEventListener("click", () => {
    el.remove();
    handlers.onDismiss?.();
  });
}
