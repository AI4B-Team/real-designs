/**
 * Floorplan controls.
 *
 * One section inside the Canvas settings panel owns the whole workflow: the
 * plan-type confirmation, the interpretation review (with corrections), the
 * floor switcher for multi-level plans, dimension entry and scale calibration,
 * the output type, camera placement, room selection, the look settings, the
 * brief the user confirms before any credit is spent, and the drift report
 * shown afterwards.
 *
 * Nothing here decides money or prompts: it reads and writes the state that
 * @/lib/floorplan-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  CONCEPT_DISCLAIMER,
  DEFAULT_EYE_HEIGHT_FT,
  FINISH_GRADES,
  FURNITURE_LEVELS,
  OUTPUT_TYPES,
  PLAN_ELEMENT_KINDS,
  SUPPORTED_SOURCES,
  addElement,
  calibrateScale,
  cameraMarker,
  cameraSentence,
  classificationWarning,
  correctElement,
  costSentence,
  dimensionStatement,
  elementsOnFloor,
  emptyGeometry,
  exportPlanData,
  exportPlanText,
  floorplanCredits,
  geometryConfidence,
  geometryCounts,
  materialSchedule,
  newPlanId,
  outputType,
  planRooms,
  planSourceLabel,
  rejectionMessage,
  removeElement,
  scaleStatement,
  type CameraMarker,
  type DimensionEntry,
  type DriftReport,
  type FloorplanBrief,
  type FloorplanSettings,
  type InterpretedPlan,
  type OutputTypeId,
  type PlanClassification,
  type PlanElementKind,
  type PlanGeometry,
  type PlanSourceId,
  type RestoredFloorplan,
  type UnitId,
} from "@/lib/floorplan-brief";

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
  classification: null as PlanClassification | null,
  classifying: false,
  classifyError: null as string | null,
  geometry: emptyGeometry() as PlanGeometry,
  detecting: false,
  detectError: null as string | null,
  removed: new Set<string>(),
  floorId: "floor-1",
  output: "furnished_3d" as OutputTypeId,
  units: "ft" as UnitId,
  dimensions: [] as DimensionEntry[],
  cameras: [] as CameraMarker[],
  activeCameraId: null as string | null,
  placing: false,
  roomIds: [] as string[],
  reviewed: false,
  planId: null as string | null,
};

let onChangeCb: (() => void) | null = null;
let classifyCb: (() => void) | null = null;
let detectCb: (() => void) | null = null;
let styleReader: (() => { id: string | null; name: string | null }) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints itself next tick */
  }
}

/* ----------------------------------------------------------- accessors */

export function floorplanClassification(): PlanClassification | null {
  return state.classification;
}

export function floorplanGeometry(): PlanGeometry {
  return {
    ...state.geometry,
    elements: state.geometry.elements.filter((e) => !state.removed.has(e.id)),
  };
}

export function hasFloorplanGeometry(): boolean {
  return state.geometry.elements.length > 0;
}

export function floorplanPlanId(): string {
  if (!state.planId) state.planId = newPlanId();
  return state.planId;
}

export function activeFloorplanCamera(): CameraMarker | null {
  return activeCamera();
}

/** The interpreted plan other tools reuse. */
export function interpretedPlan(): InterpretedPlan {
  return exportPlanData({
    planId: floorplanPlanId(),
    sourceKind: (state.classification?.kind || "floor_plan_image") as PlanSourceId,
    geometry: floorplanGeometry(),
    dimensions: state.dimensions,
    cameras: state.cameras,
  });
}

export function resetFloorplan() {
  state.classification = null;
  state.classifyError = null;
  state.geometry = emptyGeometry();
  state.detectError = null;
  state.removed.clear();
  state.floorId = "floor-1";
  state.dimensions = [];
  state.cameras = [];
  state.activeCameraId = null;
  state.roomIds = [];
  state.reviewed = false;
  state.planId = null;
  paintAll();
}

export function setFloorplanClassifying(on: boolean, error?: string | null) {
  state.classifying = on;
  state.classifyError = error ?? null;
  paintClassify();
}

export function setFloorplanClassification(c: PlanClassification | null) {
  state.classification = c;
  state.classifying = false;
  state.classifyError = null;
  paintAll();
}

export function setFloorplanDetecting(on: boolean, error?: string | null) {
  state.detecting = on;
  state.detectError = error ?? null;
  paintGeometry();
}

export function setFloorplanGeometry(g: PlanGeometry | null) {
  state.geometry = g || emptyGeometry();
  state.detecting = false;
  state.detectError = null;
  state.removed.clear();
  state.reviewed = false;
  if (!state.geometry.floors.some((f) => f.id === state.floorId))
    state.floorId = state.geometry.floors[0]?.id || "floor-1";
  if (state.geometry.units !== "unknown") state.units = state.geometry.units;
  /* Every room starts selected, so Individual Room Views is one tap away. */
  state.roomIds = planRooms(state.geometry, state.floorId).map((r) => r.id);
  paintAll();
}

/* ---------------------------------------------------------------- mount */

export function mountFloorplanPanel(opts?: {
  onChange?: () => void;
  onClassify?: () => void;
  onDetect?: () => void;
  readStyle?: () => { id: string | null; name: string | null };
}) {
  onChangeCb = opts?.onChange || null;
  classifyCb = opts?.onClassify || null;
  detectCb = opts?.onDetect || null;
  styleReader = opts?.readStyle || null;
  if (byId("rdPlanSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdPlanSec";
  sec.className = "rd-stage rd-plan";
  sec.hidden = true;
  sec.innerHTML =
    /* what was uploaded */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Your Floor Plan</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanClassify">Read Plan</button></div>' +
    '<div id="rdPlanClass"></div>' +
    "</div>" +
    /* interpretation */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Interpretation Review</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanDetect">Read Geometry</button></div>' +
    '<div id="rdPlanFloors"></div>' +
    '<div id="rdPlanGeo"></div>' +
    '<div class="rd-plan-addgeo">' +
    '<select class="rd-stage-sel" id="rdPlanAddKind">' +
    PLAN_ELEMENT_KINDS.map((k) => '<option value="' + k.id + '">' + esc(k.label) + "</option>").join("") +
    "</select>" +
    '<input type="text" id="rdPlanAddLabel" placeholder="Example: missing hall closet" aria-label="Element the reader missed">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanAdd">Add</button>' +
    "</div>" +
    '<div class="rd-plan-actions">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanExport">Export Interpreted Plan</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanAccept">Accept Interpretation</button>' +
    "</div>" +
    "</div>" +
    /* dimensions and scale */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Dimensions &amp; Scale</b><span class="rd-stage-note">Optional</span></div>' +
    '<div class="rd-plan-units">' +
    '<button type="button" class="rd-stage-chip on" data-unit="ft">Feet</button>' +
    '<button type="button" class="rd-stage-chip" data-unit="m">Meters</button>' +
    "</div>" +
    '<div class="rd-plan-dims" id="rdPlanDims"></div>' +
    '<div class="rd-plan-addgeo">' +
    '<input type="text" id="rdPlanDimLabel" placeholder="What you measured" aria-label="Dimension label">' +
    '<input type="number" id="rdPlanDimValue" min="0" step="0.1" placeholder="0" aria-label="Dimension value">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanDimAdd">Add</button>' +
    "</div>" +
    '<label class="rd-stage-lab">Scale Calibration</label>' +
    '<div class="rd-plan-addgeo">' +
    '<input type="text" id="rdPlanScaleRef" placeholder="Known length, e.g. front wall" aria-label="Scale reference">' +
    '<input type="number" id="rdPlanScaleLen" min="0" step="0.1" placeholder="0" aria-label="Scale length">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanScaleSet">Calibrate</button>' +
    "</div>" +
    '<p class="rd-stage-muted" id="rdPlanScaleNote"></p>' +
    "</div>" +
    /* output */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Output Type</b></div>' +
    '<div class="rd-stage-modes" id="rdPlanOutputs"></div>' +
    "</div>" +
    /* camera */
    '<div class="rd-stage-block" id="rdPlanCamBlock" hidden>' +
    '<div class="rd-stage-h"><b>Camera</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanPlace">Place Camera</button></div>' +
    '<div class="rd-plan-map" id="rdPlanMap"></div>' +
    '<div class="rd-plan-cams" id="rdPlanCams"></div>' +
    '<div id="rdPlanCamCtl"></div>' +
    "</div>" +
    /* rooms */
    '<div class="rd-stage-block" id="rdPlanRoomBlock" hidden>' +
    '<div class="rd-stage-h"><b>Rooms</b><span class="rd-stage-note">One View Each</span></div>' +
    '<div class="rd-stage-chips" id="rdPlanRooms"></div>' +
    "</div>" +
    /* look */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Look</b></div>' +
    '<label class="rd-stage-lab">Furnishing</label>' +
    '<div class="rd-stage-chips" data-group="furn">' +
    FURNITURE_LEVELS.map(
      (f) =>
        '<button type="button" class="rd-stage-chip' +
        (f.id === "full" ? " on" : "") +
        '" data-furn="' +
        f.id +
        '" title="' +
        esc(f.rule) +
        '">' +
        esc(f.label) +
        "</button>",
    ).join("") +
    "</div>" +
    '<label class="rd-stage-lab">Finish Level</label>' +
    '<div class="rd-stage-chips" data-group="finish">' +
    FINISH_GRADES.map(
      (f) =>
        '<button type="button" class="rd-stage-chip' +
        (f.id === "mid" ? " on" : "") +
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
    /* cost */
    '<div class="rd-stage-block">' +
    '<p class="rd-stage-cost" id="rdPlanCost"></p>' +
    '<p class="rd-stage-muted">' +
    esc(CONCEPT_DISCLAIMER) +
    "</p>" +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  paintAll();

  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("#rdPlanClassify")) return void classifyCb?.();
    if (t.closest("#rdPlanDetect")) return void detectCb?.();
    if (t.closest("#rdPlanExport")) return void downloadPlan();
    if (t.closest("#rdPlanAccept")) {
      state.reviewed = true;
      paintGeometry();
      change();
      return;
    }

    const kindBtn = t.closest("[data-src]") as HTMLElement | null;
    if (kindBtn) {
      const id = kindBtn.getAttribute("data-src") as PlanSourceId;
      state.classification = {
        ...(state.classification || {
          confidence: 1,
          summary: null,
          reason: null,
          alternatives: [],
          levels: 1,
        }),
        kind: id,
        label: planSourceLabel(id),
        supported: true,
        confidence: 1,
      } as PlanClassification;
      paintAll();
      change();
      return;
    }

    const floor = t.closest("[data-floor]") as HTMLElement | null;
    if (floor) {
      state.floorId = floor.getAttribute("data-floor") || "floor-1";
      state.roomIds = planRooms(state.geometry, state.floorId).map((r) => r.id);
      paintAll();
      change();
      return;
    }

    const del = t.closest("[data-geodel]") as HTMLElement | null;
    if (del) {
      const id = del.getAttribute("data-geodel") || "";
      if (state.removed.has(id)) state.removed.delete(id);
      else state.removed.add(id);
      state.roomIds = state.roomIds.filter((r) => !state.removed.has(r));
      paintGeometry();
      paintRooms();
      change();
      return;
    }
    const rename = t.closest("[data-georen]") as HTMLElement | null;
    if (rename) {
      renameElement(rename.getAttribute("data-georen") || "");
      return;
    }
    if (t.closest("#rdPlanAdd")) return void addGeometryElement();
    if (t.closest("#rdPlanDimAdd")) return void addDimension();

    const dimDel = t.closest("[data-dimdel]") as HTMLElement | null;
    if (dimDel) {
      const id = dimDel.getAttribute("data-dimdel") || "";
      state.dimensions = state.dimensions.filter((d) => d.id !== id);
      paintDimensions();
      change();
      return;
    }
    if (t.closest("#rdPlanScaleSet")) return void setScale();

    const unit = t.closest("[data-unit]") as HTMLElement | null;
    if (unit) {
      state.units = (unit.getAttribute("data-unit") as UnitId) || "ft";
      sec.querySelectorAll<HTMLElement>("[data-unit]").forEach((b) => b.classList.toggle("on", b === unit));
      paintDimensions();
      paintCameraControls();
      change();
      return;
    }

    const out = t.closest("[data-output]") as HTMLElement | null;
    if (out) {
      state.output = (out.getAttribute("data-output") as OutputTypeId) || "furnished_3d";
      paintOutputs();
      paintCameraBlock();
      paintRooms();
      change();
      return;
    }

    if (t.closest("#rdPlanPlace")) {
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

    const room = t.closest("[data-room]") as HTMLElement | null;
    if (room) {
      const id = room.getAttribute("data-room") || "";
      state.roomIds = state.roomIds.includes(id)
        ? state.roomIds.filter((r) => r !== id)
        : state.roomIds.concat(id);
      paintRooms();
      change();
      return;
    }

    const chip = t.closest(".rd-stage-chip[data-furn],.rd-stage-chip[data-finish]") as HTMLElement | null;
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
      paintMap();
      paintCameraReadout();
      change();
    }
  });

  sec.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e as KeyboardEvent).key !== "Enter") return;
    if (t.id === "rdPlanAddLabel") {
      e.preventDefault();
      addGeometryElement();
    }
    if (t.id === "rdPlanDimLabel" || t.id === "rdPlanDimValue") {
      e.preventDefault();
      addDimension();
    }
  });

  icons();
}

export function setFloorplanPanelVisible(on: boolean) {
  const sec = byId("rdPlanSec");
  if (sec) sec.hidden = !on;
}

/* -------------------------------------------------------------- editing */

function addGeometryElement() {
  const kindSel = byId("rdPlanAddKind") as HTMLSelectElement | null;
  const labelEl = byId("rdPlanAddLabel") as HTMLInputElement | null;
  const label = (labelEl?.value || "").trim();
  if (!label) return;
  state.geometry = addElement(state.geometry, {
    kind: (kindSel?.value as PlanElementKind) || "room",
    label,
    floor: state.floorId,
  });
  if (labelEl) labelEl.value = "";
  if ((kindSel?.value || "") === "room")
    state.roomIds = planRooms(state.geometry, state.floorId).map((r) => r.id);
  paintGeometry();
  paintRooms();
  change();
}

function renameElement(id: string) {
  const el = state.geometry.elements.find((e) => e.id === id);
  if (!el) return;
  const next = window.prompt("Rename this " + el.kind.replace(/_/g, " "), el.label);
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) {
    state.geometry = removeElement(state.geometry, id);
  } else {
    state.geometry = correctElement(state.geometry, id, { label: trimmed });
  }
  paintGeometry();
  paintRooms();
  change();
}

function addDimension() {
  const labelEl = byId("rdPlanDimLabel") as HTMLInputElement | null;
  const valEl = byId("rdPlanDimValue") as HTMLInputElement | null;
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

function setScale() {
  const refEl = byId("rdPlanScaleRef") as HTMLInputElement | null;
  const lenEl = byId("rdPlanScaleLen") as HTMLInputElement | null;
  const reference = (refEl?.value || "").trim();
  const length = parseFloat(lenEl?.value || "");
  if (!reference || !Number.isFinite(length) || length <= 0) return;
  state.geometry = {
    ...state.geometry,
    scale: calibrateScale({ reference, length, units: state.units }),
  };
  paintScale();
  change();
}

function downloadPlan() {
  const text = exportPlanText({
    planId: floorplanPlanId(),
    sourceKind: (state.classification?.kind || "floor_plan_image") as PlanSourceId,
    geometry: floorplanGeometry(),
    dimensions: state.dimensions,
    cameras: state.cameras,
  });
  try {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "interpreted-floor-plan.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (_) {
    /* export is a convenience, never a blocker */
  }
}

function activeCamera(): CameraMarker | null {
  return state.cameras.find((c) => c.id === state.activeCameraId) || state.cameras[0] || null;
}

/* ------------------------------------------------------------- painting */

function paintAll() {
  paintClassify();
  paintFloors();
  paintGeometry();
  paintDimensions();
  paintScale();
  paintOutputs();
  paintCameraBlock();
  paintRooms();
  paintSummary();
}

function paintClassify() {
  const host = byId("rdPlanClass");
  if (!host) return;
  const btn = byId("rdPlanClassify") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.classifying;
    btn.textContent = state.classifying ? "Reading…" : state.classification ? "Read Again" : "Read Plan";
  }
  if (state.classifying) {
    host.innerHTML = '<p class="rd-stage-muted">Working out whether this is a floor plan…</p>';
    return;
  }
  if (state.classifyError) {
    host.innerHTML = '<p class="rd-stage-warn">' + esc(state.classifyError) + "</p>";
    return;
  }
  const c = state.classification;
  if (!c) {
    host.innerHTML =
      '<p class="rd-stage-muted">Upload a floor plan, blueprint, PDF page, scanned plan or dimensioned sketch. Nothing generates until the plan has been read and you have checked it.</p>';
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
    (c.levels > 1
      ? '<p class="rd-stage-muted">' + c.levels + " levels appear to be drawn on this page.</p>"
      : "") +
    (warn ? '<p class="rd-stage-warn">' + esc(warn) + "</p>" : "") +
    '<label class="rd-stage-lab">This Plan Is</label>' +
    '<div class="rd-stage-chips">' +
    SUPPORTED_SOURCES.map(
      (s) =>
        '<button type="button" class="rd-stage-chip' +
        (s.id === c.kind ? " on" : "") +
        '" data-src="' +
        s.id +
        '" title="' +
        esc(s.blurb) +
        '">' +
        esc(s.label) +
        "</button>",
    ).join("") +
    "</div>";
}

function paintFloors() {
  const host = byId("rdPlanFloors");
  if (!host) return;
  if (state.geometry.floors.length < 2) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML =
    '<label class="rd-stage-lab">Level</label><div class="rd-stage-chips">' +
    state.geometry.floors
      .map(
        (f) =>
          '<button type="button" class="rd-stage-chip' +
          (f.id === state.floorId ? " on" : "") +
          '" data-floor="' +
          esc(f.id) +
          '">' +
          esc(f.label) +
          "</button>",
      )
      .join("") +
    "</div><p class=\"rd-stage-muted\">Each level is generated on its own.</p>";
}

function paintGeometry() {
  const host = byId("rdPlanGeo");
  if (!host) return;
  const btn = byId("rdPlanDetect") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.detecting;
    btn.textContent = state.detecting
      ? "Reading…"
      : state.geometry.elements.length
        ? "Read Again"
        : "Read Geometry";
  }
  const accept = byId("rdPlanAccept") as HTMLButtonElement | null;
  if (accept) {
    accept.disabled = !state.geometry.elements.length;
    accept.textContent = state.reviewed ? "Interpretation Accepted" : "Accept Interpretation";
    accept.classList.toggle("on", state.reviewed);
  }
  if (state.detecting) {
    host.innerHTML = '<p class="rd-stage-muted">Tracing walls, rooms, doors, windows, stairs and fixtures…</p>';
    return;
  }
  if (state.detectError) {
    host.innerHTML = '<p class="rd-stage-warn">' + esc(state.detectError) + "</p>";
    return;
  }
  if (!state.geometry.elements.length) {
    host.innerHTML =
      '<p class="rd-stage-muted">Nothing has been read yet. Generation stays disabled until the plan has been read and you have accepted the interpretation.</p>';
    return;
  }
  const g = floorplanGeometry();
  const counts = geometryCounts(g, state.floorId);
  const report = geometryConfidence(g, state.floorId);
  const groups = PLAN_ELEMENT_KINDS.map((k) => {
    const items = elementsOnFloor(state.geometry, state.floorId).filter((e) => e.kind === k.id);
    if (!items.length) return "";
    return (
      '<div class="rd-plan-group"><span class="rd-plan-gh">' +
      esc(k.plural) +
      " · " +
      items.filter((e) => !state.removed.has(e.id)).length +
      "</span>" +
      items
        .map(
          (e) =>
            '<span class="rd-plan-el' +
            (state.removed.has(e.id) ? " off" : "") +
            (e.origin === "detected" && e.confidence < 0.55 ? " low" : "") +
            '"><button type="button" data-georen="' +
            esc(e.id) +
            '" title="Rename or Correct This Element"><b>' +
            esc(e.label) +
            "</b>" +
            (e.dimension ? '<em class="dim">' + esc(e.dimension) + "</em>" : "") +
            "<em>" +
            (e.origin === "user" ? "corrected" : Math.round(e.confidence * 100) + "%") +
            '</em></button><button type="button" class="x" data-geodel="' +
            esc(e.id) +
            '" aria-label="Remove ' +
            esc(e.label) +
            '"><i data-lucide="x"></i></button></span>',
        )
        .join("") +
      "</div>"
    );
  }).join("");

  host.innerHTML =
    '<p class="rd-stage-muted">' +
    esc(
      (counts.room || 0) +
        " rooms, " +
        (counts.wall || 0) +
        " walls, " +
        (counts.door || 0) +
        " doors, " +
        (counts.window || 0) +
        " windows, " +
        (counts.stair || 0) +
        " stairs, " +
        (counts.fixture || 0) +
        " fixtures.",
    ) +
    "</p>" +
    (state.geometry.summary ? '<p class="rd-stage-muted">' + esc(state.geometry.summary) + "</p>" : "") +
    '<div class="rd-plan-conf is-' +
    report.band +
    '"><b>Interpretation Confidence · ' +
    report.score +
    "%</b><span>" +
    esc(report.sentence) +
    "</span></div>" +
    (report.missing.length
      ? '<ul class="rd-plan-warns">' + report.missing.map((m) => "<li>" + esc(m) + "</li>").join("") + "</ul>"
      : "") +
    (state.geometry.warnings.length
      ? '<ul class="rd-plan-warns">' +
        state.geometry.warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
        "</ul>"
      : "") +
    '<div class="rd-plan-groups">' +
    groups +
    "</div>" +
    '<p class="rd-stage-muted">Tap a name to correct it, or the cross to drop it. Add whatever the reader missed below, then accept the interpretation.</p>';
  icons();
  paintMap();
}

function paintDimensions() {
  const host = byId("rdPlanDims");
  if (!host) return;
  const read = state.geometry.elements.filter((e) => e.dimension);
  host.innerHTML =
    (read.length
      ? '<p class="rd-stage-muted">Read from the plan: ' +
        esc(
          read
            .slice(0, 8)
            .map((r) => r.label + " " + r.dimension)
            .join(", "),
        ) +
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
    esc(dimensionStatement(floorplanGeometry(), state.dimensions)) +
    "</p>";
  icons();
}

function paintScale() {
  const note = byId("rdPlanScaleNote");
  if (note) note.textContent = scaleStatement(state.geometry.scale);
}

function paintOutputs() {
  const host = byId("rdPlanOutputs");
  if (!host) return;
  host.innerHTML = OUTPUT_TYPES.map(
    (o) =>
      '<button type="button" class="rd-stage-mode' +
      (o.id === state.output ? " on" : "") +
      '" data-output="' +
      o.id +
      '"><b>' +
      esc(o.label) +
      "</b><span>" +
      esc(o.blurb) +
      "</span></button>",
  ).join("");
}

function paintCameraBlock() {
  const block = byId("rdPlanCamBlock");
  const type = outputType(state.output);
  if (block) block.hidden = !type.needsCamera;
  const place = byId("rdPlanPlace");
  if (place) {
    place.textContent = state.placing ? "Done Placing" : "Place Camera";
    place.classList.toggle("on", state.placing);
  }
  const cams = byId("rdPlanCams");
  if (cams)
    cams.innerHTML = state.cameras.length
      ? state.cameras
          .map(
            (c) =>
              '<span class="rd-plan-cam' +
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
      : '<p class="rd-stage-muted">No camera placed yet. An eye-level view cannot render until you place one on the plan.</p>';
  paintCameraControls();
  paintMap();
  icons();
}

function paintCameraControls() {
  const host = byId("rdPlanCamCtl");
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
    '<input type="range" class="rd-plan-range" data-camfield="direction" min="0" max="359" step="1" value="' +
    Math.round(cam.direction) +
    '">' +
    '<label class="rd-stage-lab">Approximate Eye Height · ' +
    cam.height +
    u +
    "</label>" +
    '<input type="range" class="rd-plan-range" data-camfield="height" min="' +
    (state.units === "m" ? "0.8" : "3") +
    '" max="' +
    (state.units === "m" ? "5" : "16") +
    '" step="0.1" value="' +
    cam.height +
    '">' +
    '<label class="rd-stage-lab">Field Of View · ' +
    Math.round(cam.fov) +
    "°</label>" +
    '<input type="range" class="rd-plan-range" data-camfield="fov" min="20" max="120" step="1" value="' +
    Math.round(cam.fov) +
    '">' +
    '<p class="rd-stage-muted" id="rdPlanCamRead">' +
    esc(cameraSentence(cam, state.units)) +
    "</p>";
}

function paintCameraReadout() {
  const el = byId("rdPlanCamRead");
  const cam = activeCamera();
  if (el && cam) el.textContent = cameraSentence(cam, state.units);
}

function paintMap() {
  const host = byId("rdPlanMap");
  if (!host) return;
  const img = document.querySelector("#cBefore img") as HTMLImageElement | null;
  const src = img?.currentSrc || img?.src || "";
  host.style.backgroundImage = src ? 'url("' + src + '")' : "none";
  host.classList.toggle("placing", state.placing);
  host.innerHTML = state.cameras
    .filter((c) => c.floor === state.floorId)
    .map(
      (c) =>
        '<span class="rd-plan-pin' +
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
          floor: state.floorId,
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

function paintRooms() {
  const block = byId("rdPlanRoomBlock");
  const type = outputType(state.output);
  if (block) block.hidden = !type.needsRooms;
  const host = byId("rdPlanRooms");
  if (!host) return;
  const rooms = planRooms(floorplanGeometry(), state.floorId);
  host.innerHTML = rooms.length
    ? rooms
        .map(
          (r) =>
            '<button type="button" class="rd-stage-chip' +
            (state.roomIds.includes(r.id) ? " on" : "") +
            '" data-room="' +
            esc(r.id) +
            '">' +
            esc(r.label) +
            "</button>",
        )
        .join("")
    : '<p class="rd-stage-muted">No rooms were identified on this level yet.</p>';
}

function paintSummary() {
  const cost = byId("rdPlanCost");
  if (!cost) return;
  const s = readFloorplanSettings();
  const runs =
    outputType(s.output).needsRooms
      ? Math.max(1, s.roomIds.length)
      : 1;
  cost.textContent = costSentence({
    credits: floorplanCredits(runs),
    runs: new Array(runs).fill(null).map((_, i) => ({
      id: String(i),
      label: "",
      directive: "",
      roomId: null,
    })),
  });
}

/* -------------------------------------------------------------- readers */

function readChip(group: string, fallback: string): string {
  const on = document.querySelector('#rdPlanSec .rd-stage-chips[data-group="' + group + '"] .rd-stage-chip.on');
  return on?.getAttribute("data-" + group) || fallback;
}

/** Everything the panel holds, ready for buildFloorplanBrief(). */
export function readFloorplanSettings(): FloorplanSettings {
  const style = styleReader?.() || { id: null, name: null };
  const type = outputType(state.output);
  const notesEl = document.getElementById("rdwNotes") as HTMLTextAreaElement | null;
  return {
    hasSource: true,
    classification: state.classification,
    geometry: floorplanGeometry(),
    floorId: state.floorId,
    output: state.output,
    furniture: readChip("furn", "full"),
    finish: readChip("finish", "mid"),
    dimensions: state.dimensions.slice(),
    camera: type.needsCamera ? activeCamera() : null,
    roomIds: state.roomIds.slice(),
    styleId: style.id,
    styleName: style.name,
    notes: (notesEl?.value || "").trim() || null,
    planId: floorplanPlanId(),
    reviewed: state.reviewed,
  };
}

/** Rehydrates the panel from a saved version. */
export function loadFloorplanState(r: RestoredFloorplan) {
  state.classification = r.classification;
  state.geometry = r.geometry;
  state.removed.clear();
  state.floorId = r.floorId;
  state.output = r.output;
  state.dimensions = r.dimensions;
  state.cameras = r.camera ? [r.camera] : [];
  state.activeCameraId = r.camera?.id || null;
  state.units = r.geometry.units === "unknown" ? state.units : r.geometry.units;
  state.planId = r.planId;
  state.roomIds = planRooms(r.geometry, r.floorId).map((x) => x.id);
  state.reviewed = true;
  paintAll();
  const set = (group: string, value: string) => {
    document
      .querySelectorAll<HTMLElement>('#rdPlanSec .rd-stage-chips[data-group="' + group + '"] .rd-stage-chip')
      .forEach((b) => b.classList.toggle("on", b.getAttribute("data-" + group) === value));
  };
  set("furn", r.furniture);
  set("finish", r.finish);
  change();
}

/* ---------------------------------------------------------- brief review */

export type FloorplanBriefAnswer = "confirm" | "cancel";

function briefLines(brief: FloorplanBrief): Array<{ k: string; v: string }> {
  const p = brief.payload;
  const lines: Array<{ k: string; v: string }> = [
    { k: "Source", v: p.source_label },
    { k: "Output", v: p.output_label },
    { k: "Level", v: p.floor_label + (p.floors_total > 1 ? " of " + p.floors_total : "") },
    {
      k: "Geometry Locked",
      v:
        p.geometry.length +
        " elements, " +
        p.rooms.length +
        " rooms, " +
        p.confidence +
        "% confidence",
    },
    { k: "Scale", v: p.scale_statement },
    { k: "Dimensions", v: p.dimension_statement },
    { k: "Furnishing", v: p.furniture_label },
    { k: "Finish", v: p.finish_label },
  ];
  if (p.style_name) lines.push({ k: "Design Style", v: p.style_name });
  if (p.camera) lines.push({ k: "Camera", v: cameraSentence(p.camera, p.units) });
  if (brief.runs.length > 1)
    lines.push({ k: "Views", v: brief.runs.map((r) => r.label).join(", ") });
  if (p.notes) lines.push({ k: "Your Instructions", v: p.notes });
  return lines;
}

/**
 * The last screen before any credit is spent. It states the exact geometry
 * being locked, the exact cost, and that the output is a concept.
 */
export function openFloorplanBriefReview(
  brief: FloorplanBrief,
  opts: { costLabel: string; balanceNote?: string | null },
): Promise<FloorplanBriefAnswer> {
  return new Promise((resolve) => {
    byId("rdPlanBrief")?.remove();
    const warnings = brief.payload.uncertain.length
      ? [
          brief.payload.uncertain.length +
            " element" +
            (brief.payload.uncertain.length > 1 ? "s were" : " was") +
            " read with low confidence: " +
            brief.payload.uncertain.join(", ") +
            ".",
        ]
      : [];
    if (!brief.payload.dimensions_known)
      warnings.push("No dimensions are confirmed, so proportions follow the drawing only.");
    if (!brief.payload.scale.known) warnings.push("No scale was calibrated.");

    const m = document.createElement("div");
    m.id = "rdPlanBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Plan Brief">' +
      "<h3>Review Your Plan Brief</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      '<div class="rd-brief-list">' +
      briefLines(brief)
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
      (warnings.length
        ? '<div class="rd-brief-warn"><b>Check This First</b><ul>' +
          warnings.map((w) => "<li>" + esc(w) + "</li>").join("") +
          "</ul></div>"
        : "") +
      '<p class="rd-brief-note">' +
      esc(costSentence(brief)) +
      "</p>" +
      '<p class="rd-brief-note">' +
      esc(brief.disclaimer) +
      "</p>" +
      '<div class="up-act"><button class="btn btn-primary" id="rdPlanGo" type="button">Build 3D Concept · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Settings</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: FloorplanBriefAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdPlanGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* ----------------------------------------------------------- drift panel */

/** Honest reporting of the automatic plan comparison. */
export function showFloorplanDrift(
  report: DriftReport | null,
  handlers: { onRegenerate?: () => void; onDismiss?: () => void } = {},
) {
  byId("rdPlanQa")?.remove();
  if (!report || !report.issues.length) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdPlanQa";
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
    '<button type="button" class="btn btn-primary btn-xs" id="rdPlanRegen">Build Again</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdPlanQaClose">Keep This Concept</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdPlanRegen")?.addEventListener("click", () => {
    el.remove();
    handlers.onRegenerate?.();
  });
  byId("rdPlanQaClose")?.addEventListener("click", () => {
    el.remove();
    handlers.onDismiss?.();
  });
}

/* ------------------------------------------------------ material schedule */

/** An indicative schedule of what the concept shows, never a specification. */
export function openMaterialSchedule(brief: FloorplanBrief) {
  byId("rdPlanSched")?.remove();
  const sched = materialSchedule(brief.payload);
  const m = document.createElement("div");
  m.id = "rdPlanSched";
  m.className = "up-modal on rd-brief";
  m.innerHTML =
    '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Material Schedule">' +
    "<h3>Indicative Material Schedule</h3>" +
    '<p class="rd-brief-sub">' +
    esc(sched.note) +
    "</p>" +
    '<div class="rd-brief-list">' +
    sched.rows
      .map(
        (r) =>
          '<div class="rd-brief-row"><span class="k">' +
          esc(r.area) +
          '</span><span class="v">' +
          esc(r.surface + " — " + r.note) +
          "</span></div>",
      )
      .join("") +
    "</div>" +
    '<p class="rd-brief-note">' +
    esc(sched.disclaimer) +
    "</p>" +
    '<div class="up-act"><button class="btn btn-primary" type="button" data-close>Close</button></div>' +
    "</div>";
  (document.querySelector(".rd-app") || document.body).appendChild(m);
  icons();
  m.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close]")) m.remove();
  });
}
