/**
 * The Property Markup interaction controller.
 *
 * It attaches to an overlay that already sits exactly over the photograph, so
 * it never resizes the Canvas, never moves the image and never replaces the
 * image node. Coordinates are read from the overlay box and stored normalized,
 * which keeps every layer welded to the source image through Canvas zoom, pan
 * and any later export size.
 *
 * Drawing is a deliberate mode. While "Navigate Image" is active the overlay is
 * transparent to pointer events, so panning a zoomed photograph can never drop
 * stray points into a polygon.
 */

import {
  closesOnFirstPoint,
  createLayer,
  clampPoint,
  deletePoint,
  hitTest,
  insertPoint,
  labelAnchor,
  markupType,
  minPoints,
  moveLayer,
  movePoint,
  nextMarkerNumber,
  toNormalized,
  type MarkupDoc,
  type MarkupLayer,
  type MarkupTypeId,
  type Point,
} from "@/lib/markup";
import { drawMarkup } from "@/lib/markup-render";
import { refreshMeasurements } from "@/lib/markup";
import { calibrateScale, type MeasureUnit } from "@/lib/markup-measure";
import { reproject, type ParcelOverlay } from "@/lib/parcel";

/**
 * Drawing, calibrating and aligning a parcel are three separate deliberate
 * modes. Nothing is ever drawn, measured or nudged while the user is simply
 * looking at the photograph.
 */
export type MarkupMode = "navigate" | "draw" | "calibrate" | "parcel";

export type MarkupEditorApi = {
  doc: () => MarkupDoc;
  setDoc: (doc: MarkupDoc, record?: boolean) => void;
  mode: () => MarkupMode;
  activeType: () => MarkupTypeId;
  selected: () => string | null;
  select: (id: string | null) => void;
  /** Ask the host to repaint its panel (layer list, style controls). */
  onChange: () => void;
  /** Text for a new Label layer. Returns null when the user cancels. */
  askLabel?: (suggestion: string) => Promise<string | null>;
  /** Real length for a drawn reference line. Returns null when cancelled. */
  askScale?: (pixels: number) => Promise<{ length: number; unit: MeasureUnit } | null>;
  /** Source pixel size, so one calibration holds at every preview size. */
  imageSize?: () => { width: number; height: number };
  /** Report a refused calibration or alignment in the panel. */
  notify?: (message: string) => void;
};

export type MarkupEditor = {
  repaint(): void;
  destroy(): void;
  cancelDraft(): void;
  hasDraft(): boolean;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Commit the drafted polygon, as Enter and double-click do. */
  closeDraft(): void;
  removeLastPoint(): void;
  /** Discard a half-drawn calibration line. */
  cancelCalibration(): void;
  /** Nudge, rotate, scale or fade the parcel overlay by keyboard or buttons. */
  adjustParcel(delta: Partial<{ tx: number; ty: number; rotation: number; scale: number; opacity: number }>): void;
};

type Drag =
  | { kind: "vertex"; layerId: string; index: number }
  | { kind: "layer"; layerId: string; last: Point }
  | { kind: "label"; layerId: string; start: Point; base: Point }
  | null;

export function attachMarkupEditor(host: HTMLElement, api: MarkupEditorApi): MarkupEditor {
  const canvas =
    (host.querySelector("canvas") as HTMLCanvasElement | null) ||
    host.appendChild(document.createElement("canvas"));

  let draft: Point[] = [];
  let draftType: MarkupTypeId | null = null;
  let pointer: Point | null = null;
  let drag: Drag = null;
  let calib: Point[] = [];
  let parcelDrag: { last: Point } | null = null;
  /* Undo history for markup only: the photo's own history is untouched. */
  const past: MarkupDoc[] = [];
  const future: MarkupDoc[] = [];

  const snapshot = () => JSON.parse(JSON.stringify(api.doc())) as MarkupDoc;

  function commit(doc: MarkupDoc) {
    past.push(snapshot());
    if (past.length > 60) past.shift();
    future.length = 0;
    api.setDoc(doc);
    repaint();
    api.onChange();
  }

  function live(doc: MarkupDoc) {
    /* Mid-drag updates do not each become an undo step. */
    api.setDoc(doc, false);
    repaint();
  }

  function at(ev: PointerEvent | MouseEvent): Point {
    const r = host.getBoundingClientRect();
    return toNormalized(ev.clientX - r.left, ev.clientY - r.top, r.width || 1, r.height || 1);
  }

  /* ------------------------------------------------------------- painting */

  function repaint() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawMarkup(ctx, api.doc(), w, h, {
      interactive: true,
      selectedId: api.selected(),
      draft: draft.length
        ? { type: draftType || "custom_area", points: draft, pointer, color: markupType(draftType || "custom_area").color }
        : null,
      calibration: calib.length ? { points: calib, pointer } : null,
    });
  }

  /* -------------------------------------------------------------- drawing */

  function finishDraft(points: Point[], closed: boolean) {
    const type = draftType || api.activeType();
    const spec = markupType(type);
    if (points.length < minPoints(spec.shape)) return;
    const doc = api.doc();
    const layer = createLayer(type, points, {
      closed: spec.shape === "polygon" ? closed : false,
      ...(spec.shape === "marker" ? { number: nextMarkerNumber(doc.layers) } : {}),
    });
    draft = [];
    draftType = null;
    pointer = null;
    commit({ ...doc, layers: [...doc.layers, layer] });
    api.select(layer.id);
    api.onChange();
  }

  function closeDraft() {
    if (draft.length >= 3) finishDraft(draft.slice(), true);
  }

  function cancelDraft() {
    draft = [];
    draftType = null;
    pointer = null;
    repaint();
    api.onChange();
  }

  function removeLastPoint() {
    if (!draft.length) return;
    draft = draft.slice(0, -1);
    repaint();
  }

  /* -------------------------------------------------------------- pointer */

  async function placeSinglePoint(type: MarkupTypeId, p: Point) {
    const spec = markupType(type);
    const doc = api.doc();
    let label = spec.suggestion || "";
    if (spec.shape === "label" && api.askLabel) {
      const answer = await api.askLabel(label);
      if (answer === null) return;
      label = answer;
    }
    const layer = createLayer(type, [p], {
      label,
      ...(spec.shape === "marker" ? { number: nextMarkerNumber(doc.layers) } : {}),
    });
    commit({ ...api.doc(), layers: [...api.doc().layers, layer] });
    api.select(layer.id);
  }

  function sourceSize() {
    const s = api.imageSize?.();
    if (s && s.width > 0 && s.height > 0) return s;
    const r = host.getBoundingClientRect();
    return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
  }

  /* ----------------------------------------------------------- calibration */

  async function calibrationPoint(p: Point) {
    if (!calib.length) {
      calib = [p];
      return repaint();
    }
    const a = calib[0] as Point;
    calib = [];
    repaint();
    const size = sourceSize();
    const answer = await api.askScale?.(
      Math.hypot((p.x - a.x) * size.width, (p.y - a.y) * size.height),
    );
    if (!answer) return;
    const result = calibrateScale({
      a,
      b: p,
      realLength: answer.length,
      unit: answer.unit,
      imageWidth: size.width,
      imageHeight: size.height,
      source: "manual",
      perspective: api.doc().scale?.perspective ?? "unknown",
    });
    if (!result.ok) {
      api.notify?.(result.error);
      return;
    }
    /* A new scale re-states every measurement already on the photograph. */
    commit(refreshMeasurements({ ...api.doc(), scale: result.calibration }));
  }

  function cancelCalibration() {
    if (!calib.length) return;
    calib = [];
    repaint();
  }

  /* -------------------------------------------------------------- parcel */

  function setParcel(overlay: ParcelOverlay, record = true) {
    const doc = { ...api.doc(), parcel: overlay };
    if (record) commit(doc);
    else live(doc);
  }

  function adjustParcel(delta: Partial<{ tx: number; ty: number; rotation: number; scale: number; opacity: number }>) {
    const parcel = api.doc().parcel;
    if (!parcel) return;
    const a = parcel.alignment;
    setParcel(
      reproject(parcel, {
        ...a,
        tx: a.tx + (delta.tx ?? 0),
        ty: a.ty + (delta.ty ?? 0),
        rotation: a.rotation + (delta.rotation ?? 0),
        scale: Math.max(0.1, a.scale * (delta.scale ?? 1)),
        opacity: delta.opacity ?? a.opacity,
      }),
    );
  }

  function onPointerDown(ev: PointerEvent) {
    if (api.mode() === "calibrate") {
      ev.preventDefault();
      void calibrationPoint(at(ev));
      return;
    }
    if (api.mode() === "parcel") {
      if (!api.doc().parcel) return;
      ev.preventDefault();
      parcelDrag = { last: at(ev) };
      past.push(snapshot());
      future.length = 0;
      host.setPointerCapture?.(ev.pointerId);
      return;
    }
    if (api.mode() !== "draw") return;
    /* Touch and pen behave exactly like the mouse: the browser must not pan
       or long-press-select the photograph while a shape is being drawn. */
    ev.preventDefault();
    const p = at(ev);
    const type = api.activeType();
    const spec = markupType(type);

    /* An in-progress shape owns the pointer until it closes or cancels. */
    if (draft.length) {
      if (closesOnFirstPoint(draft, p)) return finishDraft(draft.slice(), true);
      const next = [...draft, p];
      if (spec.shape !== "polygon" && next.length >= 2) return finishDraft(next, false);
      draft = next;
      return repaint();
    }

    const hit = hitTest(api.doc().layers, p);
    if (hit) {
      api.select(hit.layerId);
      const layer = api.doc().layers.find((l) => l.id === hit.layerId)!;
      if (hit.kind === "vertex") {
        if (ev.altKey) {
          commit({
            ...api.doc(),
            layers: api.doc().layers.map((l) => (l.id === layer.id ? deletePoint(l, hit.index) : l)),
          });
          return;
        }
        drag = { kind: "vertex", layerId: layer.id, index: hit.index };
      } else if (hit.kind === "edge" && ev.altKey) {
        /* Alt-click an edge adds a point between the two it sits between. */
        commit({
          ...api.doc(),
          layers: api.doc().layers.map((l) => (l.id === layer.id ? insertPoint(l, hit.index, p) : l)),
        });
        drag = { kind: "vertex", layerId: layer.id, index: hit.index + 1 };
      } else if (hit.kind === "label") {
        drag = { kind: "label", layerId: layer.id, start: p, base: labelAnchor({ ...layer, labelOffset: null }) };
      } else {
        drag = { kind: "layer", layerId: layer.id, last: p };
      }
      past.push(snapshot());
      future.length = 0;
      host.setPointerCapture?.(ev.pointerId);
      api.onChange();
      return repaint();
    }

    if (spec.shape === "label" || spec.shape === "marker") {
      void placeSinglePoint(type, p);
      return;
    }
    api.select(null);
    draftType = type;
    draft = [p];
    repaint();
  }

  function onPointerMove(ev: PointerEvent) {
    if (api.mode() === "calibrate") {
      if (!calib.length) return;
      pointer = at(ev);
      return repaint();
    }
    if (parcelDrag) {
      const q = at(ev);
      const parcel = api.doc().parcel;
      if (!parcel) return;
      const a = parcel.alignment;
      setParcel(
        reproject(parcel, { ...a, tx: a.tx + (q.x - parcelDrag.last.x), ty: a.ty + (q.y - parcelDrag.last.y) }),
        false,
      );
      parcelDrag = { last: q };
      return;
    }
    if (api.mode() !== "draw") return;
    const p = at(ev);
    if (drag) {
      const doc = api.doc();
      const layers = doc.layers.map((l) => {
        if (l.id !== drag!.layerId) return l;
        if (drag!.kind === "vertex") return movePoint(l, drag!.index, p);
        if (drag!.kind === "label")
          return {
            ...l,
            labelOffset: {
              x: (l.labelOffset?.x ?? 0) + (p.x - drag!.start.x),
              y: (l.labelOffset?.y ?? 0) + (p.y - drag!.start.y),
            },
          };
        const d = drag as { kind: "layer"; layerId: string; last: Point };
        const moved = moveLayer(l, p.x - d.last.x, p.y - d.last.y);
        return moved;
      });
      if (drag.kind === "label") drag = { ...drag, start: p };
      if (drag.kind === "layer") drag = { ...drag, last: p };
      live({ ...doc, layers });
      return;
    }
    if (draft.length) {
      pointer = p;
      repaint();
    }
  }

  function onPointerUp(ev: PointerEvent) {
    if (parcelDrag) {
      parcelDrag = null;
      host.releasePointerCapture?.(ev.pointerId);
      api.onChange();
      return repaint();
    }
    if (!drag) return;
    drag = null;
    host.releasePointerCapture?.(ev.pointerId);
    api.onChange();
    repaint();
  }

  function onDoubleClick(ev: MouseEvent) {
    if (api.mode() !== "draw") return;
    if (draft.length >= 3) {
      ev.preventDefault();
      finishDraft(draft.slice(), true);
    }
  }

  function onKey(ev: KeyboardEvent) {
    const target = ev.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (api.mode() === "calibrate") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancelCalibration();
      }
      return;
    }
    if (api.mode() === "parcel") {
      const step = ev.shiftKey ? 0.01 : 0.002;
      const moves: Record<string, () => void> = {
        ArrowLeft: () => adjustParcel({ tx: -step }),
        ArrowRight: () => adjustParcel({ tx: step }),
        ArrowUp: () => adjustParcel({ ty: -step }),
        ArrowDown: () => adjustParcel({ ty: step }),
      };
      const move = moves[ev.key];
      if (move) {
        ev.preventDefault();
        move();
      }
      return;
    }
    if (api.mode() !== "draw") return;
    if (ev.key === "Escape" && draft.length) {
      ev.preventDefault();
      return cancelDraft();
    }
    if (ev.key === "Enter" && draft.length >= 3) {
      ev.preventDefault();
      return closeDraft();
    }
    if (ev.key === "Backspace" && draft.length) {
      ev.preventDefault();
      return removeLastPoint();
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      return ev.shiftKey ? redo() : undo();
    }
  }

  /* --------------------------------------------------------------- history */

  function undo() {
    const prev = past.pop();
    if (!prev) return;
    future.push(snapshot());
    api.setDoc(prev);
    repaint();
    api.onChange();
  }

  function redo() {
    const next = future.pop();
    if (!next) return;
    past.push(snapshot());
    api.setDoc(next);
    repaint();
    api.onChange();
  }

  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerUp);
  host.addEventListener("pointercancel", onPointerUp);
  host.addEventListener("dblclick", onDoubleClick);
  document.addEventListener("keydown", onKey);

  repaint();

  return {
    repaint,
    cancelDraft,
    cancelCalibration,
    adjustParcel,
    closeDraft,
    removeLastPoint,
    hasDraft: () => draft.length > 0,
    undo,
    redo,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    destroy() {
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("dblclick", onDoubleClick);
      document.removeEventListener("keydown", onKey);
    },
  };
}

/** Layers a shared/interactive viewer can toggle. */
export function toggleLayerVisibility(doc: MarkupDoc, id: string): MarkupDoc {
  return {
    ...doc,
    layers: doc.layers.map((l: MarkupLayer) => (l.id === id ? { ...l, visible: !l.visible } : l)),
  };
}
