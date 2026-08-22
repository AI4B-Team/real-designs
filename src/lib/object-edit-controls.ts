/**
 * Object Edit controls.
 *
 * One section inside the Canvas settings panel owns everything the tool
 * needs: the free detection list, the brush selection with undo, redo,
 * expand, contract, feather and invert, the action picker with its
 * per-action input, the review screen shown before any credit is spent, and
 * the preservation report shown afterwards.
 *
 * This is the single Object Edit surface: the rail tool, the Photo Editor
 * hand-off, Declutter and Materials all open this same panel.
 *
 * Nothing here decides money or prompts — it only reads and writes the state
 * that @/lib/object-edit-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  TOOL_EXPLAINER,
  actionsFor,
  emptyMask,
  growMask,
  invertMask,
  maskRegions,
  maskSummary,
  matchingTargets,
  objectAction,
  pushStroke,
  redoStroke,
  replacementFrom,
  REPLACEMENT_STORE_KEY,
  setFeather,
  undoStroke,
  defaultSettings,
  type ActionId,
  type Detection,
  type MaskState,
  type ObjectEditBrief,
  type ObjectEditSettings,
  type PreservationReport,
  type SavedReplacement,
  type StrokeKind,
} from "@/lib/object-edit-brief";
import { strokeIntent } from "@/lib/object-edit-brief";
import {
  bindMaskPainting,
  paintFromLegacy,
  paintMaskLayer,
  renderMaskAssets,
  type MaskAssets,
} from "@/lib/mask-engine";
import { materialGroups, surfacesForSpace, surfaceLabel } from "@/lib/materials-catalog";


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

const COLORS = [
  "Warm White",
  "Soft Gray",
  "Charcoal",
  "Matte Black",
  "Navy",
  "Sage Green",
  "Terracotta",
  "Natural Oak",
  "Walnut",
  "Brushed Brass",
];

/* --------------------------------------------------------------- state */

const state = {
  detections: [] as Detection[],
  room: null as { roomType: string; surfaces: string[] } | null,
  detecting: false,
  error: null as string | null,
  mask: emptyMask() as MaskState,
  brush: "add" as StrokeKind,
  brushSize: 0.05,
  painting: false,
  settings: defaultSettings() as ObjectEditSettings,
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

export function objectDetections(): Detection[] {
  return state.detections.map((d) => ({ ...d }));
}

export function objectMask(): MaskState {
  return { ...state.mask, strokes: state.mask.strokes.slice(), redo: state.mask.redo.slice() };
}

export function objectRoomRead() {
  return state.room;
}

export function hasObjectDetections(): boolean {
  return state.detections.length > 0;
}

export function objectSettings(): ObjectEditSettings {
  return { ...state.settings };
}

export function setObjectSpace(space: string) {
  state.space = space || "interior";
}

export function resetObjectEdit() {
  state.detections = [];
  state.room = null;
  state.detecting = false;
  state.error = null;
  state.mask = emptyMask();
  state.settings = defaultSettings();
  paintDetections();
  paintMask();
  paintAction();
  paintSummary();
}

export function setObjectDetecting(on: boolean, error?: string | null) {
  state.detecting = on;
  state.error = error ?? null;
  paintDetections();
}

export function setObjectDetections(detections: Detection[], room: { roomType: string; surfaces: string[] } | null) {
  state.room = room;
  state.detecting = false;
  state.error = null;
  const keep = new Set(state.detections.filter((d) => d.selected).map((d) => d.label));
  state.detections = detections.map((d) => ({ ...d, selected: keep.has(d.label) }));
  paintDetections();
  paintMask();
  paintAction();
  change();
}

/** Pre-selects an action and target when another tool hands work over. */
export function presetObjectEdit(preset: { action?: ActionId; instruction?: string | null; surfaceKind?: string | null }) {
  state.settings = {
    ...state.settings,
    action: preset.action || state.settings.action,
    instruction: preset.instruction ?? state.settings.instruction,
    surfaceKind: preset.surfaceKind ?? state.settings.surfaceKind,
  };
  paintAction();
  change();
}

function primaryTarget(): Detection | null {
  return state.detections.find((d) => d.selected) || null;
}

/* -------------------------------------------------- saved replacements */

function savedReplacements(): SavedReplacement[] {
  try {
    const raw = localStorage.getItem(REPLACEMENT_STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as SavedReplacement[]).slice(0, 12) : [];
  } catch (_) {
    return [];
  }
}

function saveReplacement(rep: SavedReplacement) {
  try {
    const list = [rep].concat(savedReplacements().filter((r) => r.label !== rep.label)).slice(0, 12);
    localStorage.setItem(REPLACEMENT_STORE_KEY, JSON.stringify(list));
  } catch (_) {
    /* saving a favourite is best effort */
  }
}

/** Called after an accepted result so the choice can be reused next time. */
export function rememberObjectEdit(targetLabel: string) {
  const s = state.settings;
  if (!s.instruction && !s.materialId && !s.color) return;
  saveReplacement(replacementFrom(s, targetLabel));
  paintAction();
}

/* --------------------------------------------------------------- panel */

export function mountObjectPanel(opts?: { onChange?: () => void; onDetect?: () => void }) {
  onChangeCb = opts?.onChange || null;
  onDetectCb = opts?.onDetect || null;
  if (byId("rdObjSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdObjSec";
  sec.className = "rd-decl rd-obj";
  sec.hidden = true;
  sec.innerHTML =
    /* selection */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Select The Target</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdObjDetect">Detect Objects</button></div>' +
    '<p class="rd-decl-free">Detecting, selecting and refining are free. Credits are only used when you confirm.</p>' +
    '<div class="rd-decl-list" id="rdObjList"></div>' +
    "</div>" +
    /* mask */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>Selection Mask</b><span class="rd-decl-note" id="rdObjMaskSum"></span></div>' +
    '<div class="rd-decl-tools">' +
    '<button type="button" class="rd-decl-chip on" data-brush="add"><i data-lucide="brush"></i>Brush Target</button>' +
    '<button type="button" class="rd-decl-chip" data-brush="protect"><i data-lucide="shield"></i>Brush Protect</button>' +
    '<button type="button" class="rd-decl-chip" id="rdObjUndo"><i data-lucide="undo-2"></i>Undo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdObjRedo"><i data-lucide="redo-2"></i>Redo</button>' +
    '<button type="button" class="rd-decl-chip" id="rdObjClear"><i data-lucide="eraser"></i>Clear</button>' +
    "</div>" +
    '<div class="rd-decl-tools">' +
    '<button type="button" class="rd-decl-chip" data-grow="0.01"><i data-lucide="maximize-2"></i>Expand Edge</button>' +
    '<button type="button" class="rd-decl-chip" data-grow="-0.01"><i data-lucide="minimize-2"></i>Contract Edge</button>' +
    '<button type="button" class="rd-decl-chip" id="rdObjInvert"><i data-lucide="flip-horizontal-2"></i>Invert</button>' +
    "</div>" +
    '<label class="rd-decl-lab">Brush Size</label>' +
    '<input type="range" id="rdObjBrushSize" min="2" max="18" value="5" class="rd-decl-range" aria-label="Brush size">' +
    '<label class="rd-decl-lab">Edge Feather</label>' +
    '<input type="range" id="rdObjFeather" min="0" max="6" value="1" class="rd-decl-range" aria-label="Edge feather">' +
    '<div class="rd-decl-canvas" id="rdObjCanvasWrap">' +
    '<img id="rdObjThumb" alt="Source photo with your selection">' +
    '<canvas id="rdObjCanvas" width="600" height="400"></canvas>' +
    "</div>" +
    '<p class="rd-decl-muted">' +
    esc(TOOL_EXPLAINER) +
    "</p>" +
    "</div>" +
    /* action */
    '<div class="rd-decl-block">' +
    '<div class="rd-decl-h"><b>What Should Happen</b></div>' +
    '<div class="rd-decl-modes rd-obj-actions" id="rdObjActions"></div>' +
    '<div id="rdObjInput"></div>' +
    '<label class="rd-obj-match"><input type="checkbox" id="rdObjMatch"> Apply To Matching Objects</label>' +
    '<p class="rd-decl-cost" id="rdObjCost"></p>' +
    "</div>";

  const anchor = byId("rdwCustomize");
  if (anchor && anchor.parentElement === body) body.insertBefore(sec, anchor);
  else body.appendChild(sec);

  wire(sec);
  paintDetections();
  paintMask();
  paintAction();
  paintSummary();
  icons();
}

export function setObjectPanelVisible(on: boolean) {
  const sec = byId("rdObjSec");
  if (sec) sec.hidden = !on;
  if (on) {
    paintMask();
    paintAction();
    paintSummary();
  }
}

/* --------------------------------------------------------------- wiring */

function wire(sec: HTMLElement) {
  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    if (t.closest("#rdObjDetect")) {
      onDetectCb?.();
      return;
    }

    const row = t.closest("[data-det]") as HTMLElement | null;
    if (row) {
      const id = row.getAttribute("data-det") || "";
      const single = !t.closest("[data-add]");
      state.detections = state.detections.map((d) => {
        if (d.id === id) return { ...d, selected: single ? !d.selected : !d.selected };
        return single ? { ...d, selected: false } : d;
      });
      paintDetections();
      paintMask();
      paintAction();
      change();
      return;
    }

    const prot = t.closest("[data-protect]") as HTMLElement | null;
    if (prot) {
      const id = prot.getAttribute("data-protect") || "";
      state.detections = state.detections.map((d) =>
        d.id === id ? { ...d, protectedItem: !d.protectedItem, selected: false } : d,
      );
      paintDetections();
      paintMask();
      change();
      return;
    }

    const brush = t.closest("[data-brush]") as HTMLElement | null;
    if (brush) {
      state.brush = (brush.getAttribute("data-brush") || "add") as StrokeKind;
      sec
        .querySelectorAll<HTMLElement>("[data-brush]")
        .forEach((b) => b.classList.toggle("on", b.getAttribute("data-brush") === state.brush));
      return;
    }
    const grow = t.closest("[data-grow]") as HTMLElement | null;
    if (grow) {
      state.mask = growMask(state.mask, Number(grow.getAttribute("data-grow")) || 0);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdObjInvert")) {
      state.mask = invertMask(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdObjUndo")) {
      state.mask = undoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdObjRedo")) {
      state.mask = redoStroke(state.mask);
      paintMask();
      change();
      return;
    }
    if (t.closest("#rdObjClear")) {
      state.mask = emptyMask();
      paintMask();
      change();
      return;
    }

    const act = t.closest("[data-action]") as HTMLElement | null;
    if (act) {
      if (act.hasAttribute("disabled")) return;
      state.settings.action = (act.getAttribute("data-action") || "remove") as ActionId;
      paintAction();
      change();
      return;
    }

    const color = t.closest("[data-color]") as HTMLElement | null;
    if (color) {
      state.settings.color = color.getAttribute("data-color");
      paintAction();
      change();
      return;
    }

    const saved = t.closest("[data-saved]") as HTMLElement | null;
    if (saved) {
      const rep = savedReplacements().find((r) => r.id === saved.getAttribute("data-saved"));
      if (rep) {
        state.settings = {
          ...state.settings,
          action: rep.action,
          instruction: rep.instruction,
          materialId: rep.materialId,
          materialLabel: rep.materialLabel,
          color: rep.color,
        };
        paintAction();
        change();
      }
      return;
    }
  });

  sec.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "rdObjMatch") {
      state.settings.applyToMatching = (t as HTMLInputElement).checked;
      change();
      return;
    }
    if (t.id === "rdObjSurface") {
      state.settings.surfaceKind = (t as HTMLSelectElement).value || null;
      state.settings.materialId = null;
      state.settings.materialLabel = null;
      state.settings.materialPrompt = null;
      paintAction();
      change();
      return;
    }
    if (t.id === "rdObjMaterial") {
      const opt = (t as HTMLSelectElement).selectedOptions[0];
      state.settings.materialId = (t as HTMLSelectElement).value || null;
      state.settings.materialLabel = opt?.textContent || null;
      state.settings.materialPrompt = opt?.getAttribute("data-prompt") || null;
      change();
      return;
    }
  });

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "rdObjBrushSize") state.brushSize = Number((t as HTMLInputElement).value) / 100;
    if (t.id === "rdObjFeather") {
      state.mask = setFeather(state.mask, Number((t as HTMLInputElement).value) / 200);
      change();
    }
    if (t.id === "rdObjInstruction") {
      state.settings.instruction = (t as HTMLTextAreaElement).value.trim() || null;
      change();
    }
  });

  /* brush painting on the mask canvas — the shared engine owns the behaviour */
  const wrap = byId("rdObjCanvasWrap");
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

function paintDetections() {
  const host = byId("rdObjList");
  const btn = byId("rdObjDetect") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = state.detecting;
    btn.textContent = state.detecting ? "Detecting…" : state.detections.length ? "Detect Again" : "Detect Objects";
  }
  if (!host) return;

  if (state.detecting) {
    host.innerHTML = '<p class="rd-decl-muted">Looking for objects and surfaces you can edit…</p>';
    return;
  }
  if (state.error) {
    host.innerHTML = '<p class="rd-decl-warn">' + esc(state.error) + "</p>";
    return;
  }
  if (!state.detections.length) {
    host.innerHTML =
      '<p class="rd-decl-muted">Nothing detected yet. Run Detect Objects to pick a named target, or brush the exact area you want to change.</p>';
    return;
  }

  host.innerHTML = state.detections
    .map(
      (d) =>
        '<div class="rd-decl-row' +
        (d.selected ? " is-remove" : "") +
        (d.protectedItem ? " is-protected" : "") +
        '" data-det="' +
        d.id +
        '">' +
        '<span class="rd-decl-rowmain"><b>' +
        esc(d.label) +
        "</b><em>" +
        esc(d.category) +
        (d.architectural ? " · Architecture" : d.movable ? " · Free Standing" : "") +
        "</em></span>" +
        '<span class="rd-decl-seg">' +
        '<button type="button" class="' +
        (d.selected ? "on" : "") +
        '" data-add="1">' +
        (d.selected ? "Selected" : "Select") +
        "</button>" +
        '<button type="button" class="' +
        (d.protectedItem ? "on" : "") +
        '" data-protect="' +
        d.id +
        '">Protect</button>' +
        "</span></div>",
    )
    .join("");
}

function paintMask() {
  const img = byId("rdObjThumb") as HTMLImageElement | null;
  const canvas = byId("rdObjCanvas") as HTMLCanvasElement | null;
  const sum = byId("rdObjMaskSum");
  if (sum) sum.textContent = maskSummary(state.detections, state.mask);
  if (!img || !canvas) return;
  const src = sourceUrl();
  if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const regions = maskRegions(state.detections, state.mask);
  paintMaskLayer(
    ctx,
    W,
    H,
    paintFromLegacy<StrokeKind>({
      edit: regions.edit,
      protect: regions.protect,
      strokes: state.mask.strokes,
      intent: strokeIntent,
      feather: state.mask.feather,
    }),
    "overlay",
  );


  const undo = byId("rdObjUndo") as HTMLButtonElement | null;
  const redo = byId("rdObjRedo") as HTMLButtonElement | null;
  if (undo) undo.disabled = !state.mask.strokes.length;
  if (redo) redo.disabled = !state.mask.redo.length;
}

function instructionField(label: string, placeholder: string): string {
  return (
    '<label class="rd-decl-lab">' +
    esc(label) +
    "</label>" +
    '<textarea id="rdObjInstruction" class="rd-decl-input rd-obj-text" rows="3" placeholder="' +
    esc(placeholder) +
    '">' +
    esc(state.settings.instruction || "") +
    "</textarea>"
  );
}

function paintAction() {
  const host = byId("rdObjActions");
  const input = byId("rdObjInput");
  const target = primaryTarget();
  if (host) {
    host.innerHTML = actionsFor(target)
      .map(
        (a) =>
          '<button type="button" class="rd-decl-mode' +
          (a.id === state.settings.action ? " on" : "") +
          '" data-action="' +
          a.id +
          '"' +
          (a.supported ? "" : " disabled") +
          '><b><i data-lucide="' +
          a.icon +
          '"></i>' +
          esc(a.label) +
          "</b><span>" +
          esc(a.supported ? a.hint : a.reason || a.hint) +
          "</span></button>",
      )
      .join("");
  }
  if (input) {
    const def = objectAction(state.settings.action);
    let html = "";
    if (def.needs === "replacement") html = instructionField("Replace It With", "A low-profile walnut sideboard, same width");
    else if (def.needs === "style") html = instructionField("New Style", "Same sofa, restyled as a modern boucle piece");
    else if (def.needs === "instruction")
      html = instructionField(
        def.id === "move" ? "Where Should It Go" : def.id === "duplicate" ? "Where Should The Copy Go" : "Your Instruction",
        def.id === "custom" ? "Describe exactly what should change" : "Against the left wall, under the window",
      );
    else if (def.needs === "color")
      html =
        '<label class="rd-decl-lab">New Color</label><div class="rd-decl-chips">' +
        COLORS.map(
          (c) =>
            '<button type="button" class="rd-decl-chip' +
            (state.settings.color === c ? " on" : "") +
            '" data-color="' +
            esc(c) +
            '">' +
            esc(c) +
            "</button>",
        ).join("") +
        "</div>";
    else if (def.needs === "material") {
      const surfaces = surfacesForSpace(state.space);
      const kind = state.settings.surfaceKind || surfaces[0]?.id || null;
      if (kind !== state.settings.surfaceKind) state.settings.surfaceKind = kind;
      html =
        '<label class="rd-decl-lab">Surface</label><select id="rdObjSurface" class="rd-decl-input">' +
        surfaces
          .map(
            (s) =>
              '<option value="' +
              s.id +
              '"' +
              (s.id === kind ? " selected" : "") +
              ">" +
              esc(surfaceLabel(s.id)) +
              "</option>",
          )
          .join("") +
        "</select>" +
        '<label class="rd-decl-lab">Material</label><select id="rdObjMaterial" class="rd-decl-input">' +
        '<option value="">Choose A Material</option>' +
        materialGroups(kind)
          .map(
            (g) =>
              '<optgroup label="' +
              esc(g.label) +
              '">' +
              g.items
                .map(
                  (m) =>
                    '<option value="' +
                    m.id +
                    '" data-prompt="' +
                    esc(m.spec || "") +
                    '"' +
                    (state.settings.materialId === m.id ? " selected" : "") +
                    ">" +
                    esc(m.name) +
                    "</option>",
                )
                .join("") +
              "</optgroup>",
          )
          .join("") +
        "</select>";
    }

    const matches = matchingTargets(state.detections, target);
    const saved = savedReplacements();
    html +=
      matches.length
        ? '<p class="rd-decl-muted">' +
          matches.length +
          " matching object" +
          (matches.length === 1 ? "" : "s") +
          " found in this photo. Tick Apply To Matching Objects to change " +
          (matches.length === 1 ? "it" : "them") +
          " too."
        : "";
    if (saved.length)
      html +=
        '<label class="rd-decl-lab">Saved Replacements</label><div class="rd-decl-chips">' +
        saved
          .map((r) => '<button type="button" class="rd-decl-chip" data-saved="' + r.id + '">' + esc(r.label) + "</button>")
          .join("") +
        "</div>";
    input.innerHTML = html;
  }
  const match = byId("rdObjMatch") as HTMLInputElement | null;
  if (match) match.checked = state.settings.applyToMatching;
  icons();
}

let costSentenceText = "";
export function setObjectCostSentence(text: string) {
  costSentenceText = text;
  paintSummary();
}

function paintSummary() {
  const cost = byId("rdObjCost");
  if (cost) cost.textContent = costSentenceText || "One credit per edit. Nothing runs until you confirm.";
}

/* -------------------------------------------------------- mask overlay */

/**
 * Renders the mask the backend receives: the source photograph with the
 * target filled magenta and protected regions outlined green. What the user
 * painted is what is sent — nothing is discarded here.
 */
export function buildObjectMaskAssets(
  src: string,
  detections: Detection[],
  mask: MaskState,
  maxW = 1600,
): Promise<MaskAssets> {
  const regions = maskRegions(detections, mask);
  const paint = paintFromLegacy<StrokeKind>({
    edit: regions.edit,
    protect: regions.protect,
    strokes: mask.strokes,
    intent: strokeIntent,
    feather: mask.feather,
  });
  return renderMaskAssets(src, paint, { overlayMaxW: maxW });
}


/* --------------------------------------------------------- review modal */

export type ObjectAnswer = "confirm" | "cancel";

/** The last screen before any credit is spent. */
export function openObjectReview(
  brief: ObjectEditBrief,
  opts: { costLabel: string; sourceLabel: string; balanceNote?: string | null; overlay?: string | null },
): Promise<ObjectAnswer> {
  return new Promise((resolve) => {
    byId("rdObjBrief")?.remove();
    const p = brief.payload;
    const rows: Array<{ k: string; v: string }> = [
      { k: "Action", v: brief.actionLabel },
      { k: "Target", v: brief.targetLabel },
      { k: "Protected", v: p.protect.length ? p.protect.map((x) => x.label).join(", ") : "Everything outside your selection" },
      { k: "Source", v: opts.sourceLabel },
      { k: "Cost", v: opts.costLabel },
    ];
    if (p.instruction) rows.splice(2, 0, { k: "Instruction", v: p.instruction });
    if (p.color) rows.splice(2, 0, { k: "Color", v: p.color });
    if (p.material_label) rows.splice(2, 0, { k: "Material", v: p.material_label });

    const m = document.createElement("div");
    m.id = "rdObjBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Object Edit">' +
      "<h3>Review This Edit</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      (opts.overlay
        ? '<img class="rd-decl-preview" src="' + esc(opts.overlay) + '" alt="Your selection over the source photo">'
        : "") +
      '<div class="rd-brief-list">' +
      rows
        .map((l) => '<div class="rd-brief-row"><span class="k">' + esc(l.k) + '</span><span class="v">' + esc(l.v) + "</span></div>")
        .join("") +
      "</div>" +
      (brief.missing.length
        ? '<div class="rd-brief-warn"><b>Check This First</b><ul>' +
          brief.missing.map((w) => "<li>" + esc(w) + "</li>").join("") +
          "</ul></div>"
        : "") +
      '<p class="rd-brief-note">' +
      esc(TOOL_EXPLAINER) +
      "</p>" +
      (opts.balanceNote ? '<p class="rd-brief-note">' + esc(opts.balanceNote) + "</p>" : "") +
      '<div class="up-act"><button class="btn btn-primary" id="rdObjGo" type="button"' +
      (brief.valid ? "" : " disabled") +
      ">Apply Edit · " +
      esc(opts.costLabel) +
      '</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></div>';
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();

    const done = (answer: ObjectAnswer) => {
      m.remove();
      resolve(answer);
    };
    m.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close]")) done("cancel");
    });
    const go = byId("rdObjGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* ------------------------------------------------------- result review */

/** Honest reporting of the automatic preservation check. */
export function showObjectPreservation(
  report: PreservationReport | null,
  handlers: { onRetry?: () => void; onDiscard?: () => void; onKeep?: () => void } = {},
) {
  byId("rdObjQa")?.remove();
  if (!report || (!report.issues.length && !report.rejected)) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdObjQa";
  el.className = "rd-stage-qa" + (report.rejected ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><div><b>' +
    esc(report.headline) +
    "</b><ul>" +
    report.issues.map((i) => "<li>" + esc(i.detail) + "</li>").join("") +
    "</ul>" +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdObjRetry">Tighter Mask And Retry</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdObjDiscard">Discard This Result</button>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdObjKeep">Keep This Result</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdObjRetry")?.addEventListener("click", () => {
    el.remove();
    /* A tighter mask is the honest first fix for drift. */
    state.mask = growMask(state.mask, -0.01);
    paintMask();
    handlers.onRetry?.();
  });
  byId("rdObjDiscard")?.addEventListener("click", () => {
    el.remove();
    handlers.onDiscard?.();
  });
  byId("rdObjKeep")?.addEventListener("click", () => {
    el.remove();
    handlers.onKeep?.();
  });
}

/** Rehydrates the panel from a saved version's Object Edit metadata. */
export function loadObjectState(input: { detections: Detection[]; mask: MaskState; settings: ObjectEditSettings }) {
  state.detections = input.detections;
  state.mask = input.mask;
  state.settings = input.settings;
  paintDetections();
  paintMask();
  paintAction();
  change();
}
