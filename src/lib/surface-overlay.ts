/**
 * The canonical on-image surface overlay.
 *
 * One record per detected surface is shared by the image and the right-hand
 * inspector, so hovering a shape highlights its row, hovering a row previews
 * its mask on the photo, and selecting from either place selects the same
 * surface everywhere. The geometry drawn here is the same polygon the mask
 * engine rasterizes for the backend — this is never a decorative overlay.
 */
import { escapeHtml as esc } from "@/lib/safe-html";

import {
  polygonBox,
  polygonCentroid,
  type Box,
  type Point,
} from "@/lib/selection-mask";

export type SurfaceCategory =
  | "floor"
  | "wall"
  | "ceiling"
  | "cabinet"
  | "countertop"
  | "backsplash"
  | "tile"
  | "door"
  | "trim"
  | "roof"
  | "siding"
  | "lawn"
  | "paving"
  | "other";

/** The one canonical record every surface in the app is described by. */
export type DetectedSurface = {
  id: string;
  label: string;
  category: SurfaceCategory;
  location?: string;
  currentMaterial?: string;
  confidence: number;
  polygon?: Point[];
  box?: Box;
  centroid?: Point;
  selected: boolean;
};

type Handlers = {
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
};

const state = {
  surfaces: [] as DetectedSurface[],
  hoverId: null as string | null,
  visible: false,
  /** Surfaces that have already played their one selection animation. */
  animated: new Set<string>(),
};

let handlers: Handlers = {};

const HOST_ID = "rdSurfOverlay";


function stage(): HTMLElement | null {
  return document.getElementById("cBefore");
}

/** Shapes without a traced polygon still get one, from their bounding box. */
export function surfacePolygon(s: DetectedSurface): Point[] {
  if (s.polygon && s.polygon.length >= 3) return s.polygon;
  const b = s.box || { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}

export function surfaceCentroid(s: DetectedSurface): Point {
  if (s.centroid) return s.centroid;
  return polygonCentroid(surfacePolygon(s));
}

export function surfaceBox(s: DetectedSurface): Box {
  return s.box || polygonBox(surfacePolygon(s));
}

function host(): HTMLElement | null {
  const st = stage();
  if (!st) return null;
  let el = document.getElementById(HOST_ID);
  if (!el || el.parentElement !== st) {
    el?.remove();
    el = document.createElement("div");
    el.id = HOST_ID;
    el.className = "rd-so";
    el.setAttribute("aria-hidden", "false");
    st.appendChild(el);
    wire(el);
  }
  return el;
}

function wire(el: HTMLElement) {
  el.addEventListener("click", (e) => {
    const shape = (e.target as HTMLElement)?.closest?.("[data-surf]") as HTMLElement | null;
    if (!shape) return;
    e.preventDefault();
    e.stopPropagation();
    const id = shape.getAttribute("data-surf") || "";
    if (id) handlers.onSelect?.(id);
  });
  el.addEventListener("pointermove", (e) => {
    const shape = (e.target as HTMLElement)?.closest?.("[data-surf]") as HTMLElement | null;
    const id = shape?.getAttribute("data-surf") || null;
    if (id !== state.hoverId) hoverSurface(id, "image");
  });
  el.addEventListener("pointerleave", () => hoverSurface(null, "image"));
}

/* ------------------------------------------------------------- public */

export function mountSurfaceOverlay(opts: Handlers) {
  handlers = opts || {};
  host();
  paintSurfaceOverlay();
}

export function setSurfaceOverlayVisible(on: boolean) {
  state.visible = !!on;
  paintSurfaceOverlay();
}

/**
 * Replaces the canonical list. Surfaces that are newly selected animate once;
 * anything already animated stays static, so the image never keeps pulsing.
 */
export function setSurfaceOverlayData(surfaces: DetectedSurface[]) {
  const known = new Set(surfaces.map((s) => s.id));
  state.animated.forEach((id) => {
    if (!known.has(id)) state.animated.delete(id);
  });
  surfaces.forEach((s) => {
    if (!s.selected) state.animated.delete(s.id);
  });
  state.surfaces = surfaces.map((s) => ({ ...s }));
  paintSurfaceOverlay();
}

export function hoveredSurface(): string | null {
  return state.hoverId;
}

/** The single hover channel: the panel and the image both call this. */
export function hoverSurface(id: string | null, source: "image" | "panel" = "panel") {
  if (state.hoverId === id) return;
  state.hoverId = id;
  paintSurfaceOverlay();
  if (source === "image") handlers.onHover?.(id);
  else applyHoverClasses();
}

function applyHoverClasses() {
  document.querySelectorAll<HTMLElement>("[data-surface]").forEach((row) => {
    row.classList.toggle("is-hot", row.getAttribute("data-surface") === state.hoverId);
  });
}

export function paintSurfaceOverlay() {
  const el = host();
  if (!el) return;
  const on = state.visible && state.surfaces.length > 0;
  el.hidden = !on;
  el.classList.toggle("is-on", on);
  if (!on) {
    el.innerHTML = "";
    return;
  }

  const shapes = state.surfaces
    .map((s) => {
      const pts = surfacePolygon(s)
        .map((p) => (p.x * 100).toFixed(2) + "," + (p.y * 100).toFixed(2))
        .join(" ");
      const cls =
        "rd-so-shape" +
        (s.selected ? " is-sel" : "") +
        (s.id === state.hoverId ? " is-hot" : "") +
        (s.selected && !state.animated.has(s.id) ? " is-new" : "");
      return (
        '<polygon class="' +
        cls +
        '" points="' +
        pts +
        '" data-surf="' +
        esc(s.id) +
        '"><title>' +
        esc(s.label) +
        "</title></polygon>"
      );
    })
    .join("");

  /* Labels only appear for the surface in play: hovered or selected. */
  const labels = state.surfaces
    .filter((s) => s.selected || s.id === state.hoverId)
    .map((s) => {
      const c = surfaceCentroid(s);
      return (
        '<span class="rd-so-tag' +
        (s.selected ? " is-sel" : "") +
        '" data-surf="' +
        esc(s.id) +
        '" style="left:' +
        (c.x * 100).toFixed(2) +
        "%;top:" +
        (c.y * 100).toFixed(2) +
        '%">' +
        esc(s.label) +
        (s.currentMaterial ? '<em>' + esc(s.currentMaterial) + "</em>" : "") +
        "</span>"
      );
    })
    .join("");

  el.innerHTML =
    '<svg class="rd-so-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    shapes +
    "</svg>" +
    labels;

  /* Mark the animation as spent so it plays exactly once per selection. */
  state.surfaces.forEach((s) => {
    if (s.selected) state.animated.add(s.id);
  });
  applyHoverClasses();
}

export function resetSurfaceOverlay() {
  state.surfaces = [];
  state.hoverId = null;
  state.animated.clear();
  const el = document.getElementById(HOST_ID);
  if (el) {
    el.innerHTML = "";
    el.hidden = true;
  }
}
