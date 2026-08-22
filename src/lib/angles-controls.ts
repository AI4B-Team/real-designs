/**
 * Angles controls.
 *
 * One section inside the Canvas settings panel owns the whole workflow: what
 * the source is and how honest it has to be, which cameras were selected, the
 * custom camera, the output set, the continuity signals being reused, the
 * brief the user confirms before any credit is spent, and the contact sheet
 * shown afterwards.
 *
 * Nothing here decides money or prompts: it reads and writes the state that
 * @/lib/angles-brief turns into a brief.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  ANGLE_SOURCES,
  CAMERA_PRESETS,
  CONTINUITY_LOCK,
  CONTINUITY_SIGNALS,
  DEFAULT_CUSTOM_CAMERA,
  FOV_CHOICES,
  INFERENCE_DISCLOSURE,
  OUTPUT_SETS,
  angleCredits,
  angleSource,
  buildRuns,
  continuitySignal,
  costSentence,
  customCameraLabel,
  emptyContinuity,
  hasContinuity,
  newAngleSetId,
  normalizeCustomCamera,
  outputSet,
  reorderResults,
  renameResult,
  sourceQualityNote,
  toggleVideoSelection,
  type AngleBrief,
  type AngleResult,
  type AngleSourceId,
  type CameraPresetId,
  type ConsistencyReport,
  type ContinuitySignalId,
  type CustomCamera,
  type OutputSetId,
  type RestoredAngles,
  type RoomContinuity,
} from "@/lib/angles-brief";

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
  setId: null as string | null,
  sourceKind: "photograph" as AngleSourceId,
  continuity: emptyContinuity() as RoomContinuity,
  reading: false,
  readError: null as string | null,
  selected: ["slight_left"] as CameraPresetId[],
  customCameras: [] as CustomCamera[],
  draft: { ...DEFAULT_CUSTOM_CAMERA } as CustomCamera,
  outputSet: "single" as OutputSetId,
  signals: [] as ContinuitySignalId[],
  results: [] as AngleResult[],
};

let onChangeCb: (() => void) | null = null;
let onReadCb: (() => void) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints itself next tick */
  }
}

/* ---------------------------------------------------------- accessors */

export function angleSetId(): string {
  if (!state.setId) state.setId = newAngleSetId();
  return state.setId;
}

export function angleContinuity(): RoomContinuity | null {
  return hasContinuity(state.continuity) ? state.continuity : null;
}

export function angleSourceKind(): AngleSourceId {
  return state.sourceKind;
}

export function setAngleSourceKind(id: AngleSourceId, signals: ContinuitySignalId[] = []) {
  state.sourceKind = angleSource(id).id;
  signals.forEach((s) => {
    if (continuitySignal(s) && !state.signals.includes(s)) state.signals.push(s);
  });
  paintSource();
  paintSignals();
  change();
}

export function setAngleReading(on: boolean, error?: string | null) {
  state.reading = on;
  state.readError = error ?? null;
  paintSource();
}

export function setAngleContinuity(c: RoomContinuity | null) {
  state.continuity = c || emptyContinuity();
  state.reading = false;
  state.readError = null;
  if (hasContinuity(state.continuity) && !state.signals.includes("segmentation"))
    state.signals.push("segmentation");
  paintSource();
  paintSignals();
  change();
}

export function noteAngleSignal(id: ContinuitySignalId) {
  if (continuitySignal(id) && !state.signals.includes(id)) {
    state.signals.push(id);
    paintSignals();
  }
}

export function resetAngles() {
  state.setId = null;
  state.continuity = emptyContinuity();
  state.reading = false;
  state.readError = null;
  state.selected = ["slight_left"];
  state.customCameras = [];
  state.outputSet = "single";
  state.signals = [];
  state.results = [];
  paintAll();
  change();
}

/** How many images this run will produce, for the cost chip. */
export function readAngleResults(): number {
  return buildRuns({
    selected: state.selected,
    customCameras: state.customCameras,
    outputSet: state.outputSet,
  }).length;
}

export function readAngleSettings() {
  return {
    setId: angleSetId(),
    sourceKind: state.sourceKind,
    selected: state.selected.slice(),
    customCameras: state.customCameras.slice(),
    outputSet: state.outputSet,
    continuity: angleContinuity(),
    signals: state.signals.slice(),
  };
}

export function angleResults(): AngleResult[] {
  return state.results.slice().sort((a, b) => a.order - b.order);
}

export function setAngleResults(list: AngleResult[]) {
  state.results = list.slice();
}

export function loadAngleState(r: RestoredAngles) {
  state.setId = r.setId;
  state.sourceKind = r.sourceKind;
  state.outputSet = r.outputSet;
  state.selected = r.selected.length ? r.selected : ["slight_left"];
  state.customCameras = r.customCameras.slice();
  state.continuity = r.continuity;
  state.signals = r.signals.slice();
  paintAll();
  change();
}

/* -------------------------------------------------------------- mount */

export function mountAnglesPanel(opts?: { onChange?: () => void; onRead?: () => void }) {
  onChangeCb = opts?.onChange || null;
  onReadCb = opts?.onRead || null;
  if (byId("rdAngleSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdAngleSec";
  sec.className = "rd-stage rd-angles";
  sec.hidden = true;
  sec.innerHTML =
    /* source */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Your Source</b>' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdAngleRead">Read The Room</button></div>' +
    '<div class="rd-stage-chips" id="rdAngleSrc"></div>' +
    '<div id="rdAngleSrcNote"></div>' +
    "</div>" +
    /* output set */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Output</b></div>' +
    '<div class="rd-stage-modes" id="rdAngleSets"></div>' +
    "</div>" +
    /* cameras */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Camera Angles</b><span class="rd-stage-note" id="rdAngleCount"></span></div>' +
    '<div class="rd-angle-grid" id="rdAngleCams"></div>' +
    "</div>" +
    /* custom camera */
    '<details class="rd-stage-block rd-angle-custom" id="rdAngleCustomBlock">' +
    "<summary><b>Custom Camera</b><span>Optional</span></summary>" +
    '<label class="rd-stage-lab">Direction</label>' +
    '<div class="rd-stage-chips" data-group="dir">' +
    [
      ["left", "Left"],
      ["right", "Right"],
      ["up", "Up"],
      ["down", "Down"],
    ]
      .map(
        ([id, label], i) =>
          '<button type="button" class="rd-stage-chip' +
          (i === 0 ? " on" : "") +
          '" data-dir="' +
          id +
          '">' +
          label +
          "</button>",
      )
      .join("") +
    "</div>" +
    '<label class="rd-stage-lab">Rotation <span id="rdAngleRotVal">30\u00b0</span></label>' +
    '<input type="range" id="rdAngleRot" min="0" max="180" step="5" value="30" aria-label="Rotation amount">' +
    '<label class="rd-stage-lab">Position <span id="rdAngleDollyVal">Same Spot</span></label>' +
    '<input type="range" id="rdAngleDolly" min="-12" max="12" step="0.5" value="0" aria-label="Forward or backward position">' +
    '<label class="rd-stage-lab">Eye Height <span id="rdAngleHeightVal">5.4 ft</span></label>' +
    '<input type="range" id="rdAngleHeight" min="1" max="12" step="0.1" value="5.4" aria-label="Approximate eye height">' +
    '<label class="rd-stage-lab">Field Of View</label>' +
    '<div class="rd-stage-chips" data-group="fov">' +
    FOV_CHOICES.map(
      (f, i) =>
        '<button type="button" class="rd-stage-chip' +
        (f.fov === DEFAULT_CUSTOM_CAMERA.fov ? " on" : "") +
        '" data-fov="' +
        f.fov +
        '" title="' +
        esc(f.blurb) +
        '">' +
        esc(f.label) +
        "</button>",
    ).join("") +
    "</div>" +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdAngleAddCustom">Add This Camera</button>' +
    '<div class="rd-angle-customs" id="rdAngleCustoms"></div>' +
    "</details>" +
    /* continuity */
    '<details class="rd-stage-block" id="rdAngleLockBlock">' +
    "<summary><b>Continuity Lock</b><span>Always On</span></summary>" +
    '<ul class="rd-angle-lock">' +
    CONTINUITY_LOCK.map((l) => "<li>" + esc(l) + "</li>").join("") +
    "</ul>" +
    '<label class="rd-stage-lab">Reused Signals</label>' +
    '<div class="rd-stage-chips" id="rdAngleSignals"></div>' +
    "</details>" +
    /* summary */
    '<p class="rd-stage-muted" id="rdAngleSummary"></p>';

  body.appendChild(sec);

  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const src = t.closest("[data-src]") as HTMLElement | null;
    if (src) {
      state.sourceKind = angleSource(src.dataset["src"]).id;
      paintSource();
      change();
      return;
    }
    const set = t.closest("[data-set]") as HTMLElement | null;
    if (set) {
      const id = (set.dataset["set"] || "single") as OutputSetId;
      state.outputSet = id;
      const angles = outputSet(id).angles;
      if (angles.length) state.selected = angles.slice();
      paintSets();
      paintCameras();
      change();
      return;
    }
    const cam = t.closest("[data-cam]") as HTMLElement | null;
    if (cam) {
      const id = cam.dataset["cam"] as CameraPresetId;
      if (id === "custom") {
        const block = byId("rdAngleCustomBlock") as HTMLDetailsElement | null;
        if (block) block.open = true;
        return;
      }
      /* Hand-picking angles turns the run into a custom selection. */
      state.outputSet = "single";
      state.selected = state.selected.includes(id)
        ? state.selected.filter((s) => s !== id)
        : state.selected.concat(id);
      paintSets();
      paintCameras();
      change();
      return;
    }
    const dir = t.closest("[data-dir]") as HTMLElement | null;
    if (dir) {
      state.draft = normalizeCustomCamera({ ...state.draft, direction: dir.dataset["dir"] as any });
      paintDraft();
      return;
    }
    const fov = t.closest("[data-fov]") as HTMLElement | null;
    if (fov) {
      state.draft = normalizeCustomCamera({ ...state.draft, fov: Number(fov.dataset["fov"]) });
      paintDraft();
      return;
    }
    const del = t.closest("[data-delcustom]") as HTMLElement | null;
    if (del) {
      const i = Number(del.dataset["delcustom"]);
      state.customCameras.splice(i, 1);
      paintCustoms();
      paintCameras();
      change();
      return;
    }
    if (t.closest("#rdAngleAddCustom")) {
      if (state.customCameras.length >= 4) return;
      state.customCameras.push(normalizeCustomCamera(state.draft));
      state.outputSet = "single";
      paintCustoms();
      paintSets();
      paintCameras();
      change();
      return;
    }
    if (t.closest("#rdAngleRead")) {
      try {
        onReadCb?.();
      } catch (_) {
        /* reading is optional */
      }
    }
  });

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "rdAngleRot")
      state.draft = normalizeCustomCamera({ ...state.draft, rotation: Number(t.value) });
    else if (t.id === "rdAngleDolly")
      state.draft = normalizeCustomCamera({ ...state.draft, dolly: Number(t.value) });
    else if (t.id === "rdAngleHeight")
      state.draft = normalizeCustomCamera({ ...state.draft, height: Number(t.value) });
    else return;
    paintDraftReadout();
  });

  paintAll();
  icons();
}

export function setAnglesPanelVisible(on: boolean) {
  const sec = byId("rdAngleSec");
  if (sec) sec.hidden = !on;
}

/* -------------------------------------------------------------- paint */

function paintAll() {
  paintSource();
  paintSets();
  paintCameras();
  paintCustoms();
  paintDraft();
  paintSignals();
  paintSummary();
  icons();
}

function paintSource() {
  const wrap = byId("rdAngleSrc");
  if (wrap)
    wrap.innerHTML = ANGLE_SOURCES.map(
      (s) =>
        '<button type="button" class="rd-stage-chip' +
        (s.id === state.sourceKind ? " on" : "") +
        '" data-src="' +
        s.id +
        '" title="' +
        esc(s.blurb) +
        '">' +
        esc(s.label) +
        "</button>",
    ).join("");

  const note = byId("rdAngleSrcNote");
  if (!note) return;
  const s = angleSource(state.sourceKind);
  const read = state.reading
    ? '<p class="rd-stage-muted">Reading the room\u2026</p>'
    : state.readError
      ? '<p class="rd-stage-muted">' + esc(state.readError) + "</p>"
      : hasContinuity(state.continuity)
        ? '<p class="rd-stage-muted"><b>Room read.</b> ' + esc(state.continuity.summary || "") + "</p>"
        : '<p class="rd-stage-muted">Read The Room so every angle is locked to the same description.</p>';
  note.innerHTML =
    '<p class="rd-stage-muted">' +
    esc(sourceQualityNote(s.id)) +
    "</p>" +
    read +
    (s.infers
      ? '<div class="rd-angle-warn"><i data-lucide="triangle-alert"></i><span>' +
        esc(INFERENCE_DISCLOSURE) +
        "</span></div>"
      : "");
  icons();
}

function paintSets() {
  const wrap = byId("rdAngleSets");
  if (!wrap) return;
  wrap.innerHTML = OUTPUT_SETS.map(
    (s) =>
      '<button type="button" class="rd-stage-mode' +
      (s.id === state.outputSet ? " on" : "") +
      '" data-set="' +
      s.id +
      '"><b>' +
      esc(s.label) +
      "</b><span>" +
      esc(s.blurb) +
      "</span></button>",
  ).join("");
}

function paintCameras() {
  const wrap = byId("rdAngleCams");
  if (wrap)
    wrap.innerHTML = CAMERA_PRESETS.map((c) => {
      const on = c.id === "custom" ? state.customCameras.length > 0 : state.selected.includes(c.id);
      return (
        '<button type="button" class="rd-angle-card' +
        (on ? " on" : "") +
        '" data-cam="' +
        c.id +
        '" title="' +
        esc(c.blurb) +
        '"><i data-lucide="' +
        c.icon +
        '"></i><b>' +
        esc(c.label) +
        "</b></button>"
      );
    }).join("");
  const count = byId("rdAngleCount");
  const n = readAngleResults();
  if (count) count.textContent = n + (n === 1 ? " Output" : " Outputs");
  icons();
}

function paintCustoms() {
  const wrap = byId("rdAngleCustoms");
  if (!wrap) return;
  wrap.innerHTML = state.customCameras.length
    ? state.customCameras
        .map(
          (c, i) =>
            '<div class="rd-angle-customrow"><span>' +
            esc(customCameraLabel(c)) +
            " \u00b7 " +
            c.height +
            "ft \u00b7 " +
            c.fov +
            '\u00b0</span><button type="button" class="btn btn-ghost btn-xs" data-delcustom="' +
            i +
            '">Remove</button></div>',
        )
        .join("")
    : '<p class="rd-stage-muted">No custom cameras added.</p>';
}

function paintDraft() {
  const sec = byId("rdAngleSec");
  if (!sec) return;
  sec.querySelectorAll("[data-dir]").forEach((b) => {
    b.classList.toggle("on", (b as HTMLElement).dataset["dir"] === state.draft.direction);
  });
  sec.querySelectorAll("[data-fov]").forEach((b) => {
    b.classList.toggle("on", Number((b as HTMLElement).dataset["fov"]) === state.draft.fov);
  });
  const rot = byId("rdAngleRot") as HTMLInputElement | null;
  if (rot) rot.value = String(state.draft.rotation);
  const dolly = byId("rdAngleDolly") as HTMLInputElement | null;
  if (dolly) dolly.value = String(state.draft.dolly);
  const h = byId("rdAngleHeight") as HTMLInputElement | null;
  if (h) h.value = String(state.draft.height);
  paintDraftReadout();
}

function paintDraftReadout() {
  const rv = byId("rdAngleRotVal");
  if (rv) rv.textContent = state.draft.rotation + "\u00b0";
  const dv = byId("rdAngleDollyVal");
  if (dv)
    dv.textContent =
      state.draft.dolly === 0
        ? "Same Spot"
        : state.draft.dolly > 0
          ? state.draft.dolly + " ft Forward"
          : Math.abs(state.draft.dolly) + " ft Back";
  const hv = byId("rdAngleHeightVal");
  if (hv) hv.textContent = state.draft.height + " ft";
}

function paintSignals() {
  const wrap = byId("rdAngleSignals");
  if (!wrap) return;
  wrap.innerHTML = CONTINUITY_SIGNALS.map(
    (s) =>
      '<span class="rd-stage-chip' +
      (state.signals.includes(s.id) ? " on" : " is-off") +
      '" title="' +
      esc(s.blurb) +
      '">' +
      esc(s.label) +
      "</span>",
  ).join("");
}

function paintSummary() {
  const el = byId("rdAngleSummary");
  if (!el) return;
  const n = readAngleResults();
  el.textContent = costSentence(n);
  const count = byId("rdAngleCount");
  if (count) count.textContent = n + (n === 1 ? " Output" : " Outputs");
}

/* --------------------------------------------------------- brief modal */

export type AngleBriefAnswer = "confirm" | "cancel";

/** The last screen before any credit is spent. */
export function openAngleBriefReview(
  brief: AngleBrief,
  opts: { costLabel: string; balanceNote?: string | null },
): Promise<AngleBriefAnswer> {
  return new Promise((resolve) => {
    byId("rdAngleBrief")?.remove();
    const m = document.createElement("div");
    m.id = "rdAngleBrief";
    m.className = "up-modal on rd-brief";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Angle Set">' +
      "<h3>Review Your Angle Set</h3>" +
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
      '<div class="up-act"><button class="btn btn-primary" id="rdAngleGo" type="button">Generate ' +
      brief.runs.length +
      (brief.runs.length === 1 ? " Angle \u00b7 " : " Angles \u00b7 ") +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Settings</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: AngleBriefAnswer) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-close]")) done("cancel");
    });
    const go = byId("rdAngleGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* -------------------------------------------------------- contact sheet */

export type ContactSheetHandlers = {
  onOpen?: (r: AngleResult) => void;
  onRegenerate?: (r: AngleResult) => void;
  onReuseReference?: (r: AngleResult) => void;
  onSendToVideo?: (list: AngleResult[]) => void;
  onChange?: (list: AngleResult[]) => void;
};

/**
 * The whole set on one screen: rename, reorder, pick the ones that go to
 * Video, retry only the angles that failed or drifted, and promote a good
 * angle to the reference every later angle is matched against.
 */
export function openAngleContactSheet(
  results: AngleResult[],
  report: ConsistencyReport | null,
  handlers: ContactSheetHandlers = {},
) {
  state.results = results.slice();
  byId("rdAngleSheet")?.remove();
  const m = document.createElement("div");
  m.id = "rdAngleSheet";
  m.className = "up-modal on rd-sheet";
  m.innerHTML =
    '<div class="up-scrim" data-close></div><div class="up-card rd-sheet-card" role="dialog" aria-modal="true" aria-label="Angle Set"></div>';
  (document.querySelector(".rd-app") || document.body).appendChild(m);
  const card = m.querySelector(".rd-sheet-card") as HTMLElement;

  const paint = () => {
    const list = angleResults();
    const disclosure = report?.disclosure || null;
    card.innerHTML =
      "<h3>Your Angle Set</h3>" +
      '<p class="rd-brief-sub">' +
      esc(report ? report.headline : "Every angle in this set shares one source room.") +
      (report ? " Consistency score " + report.score + "/100." : "") +
      "</p>" +
      (disclosure
        ? '<div class="rd-angle-warn"><i data-lucide="triangle-alert"></i><span>' +
          esc(disclosure) +
          "</span></div>"
        : "") +
      '<div class="rd-sheet-grid">' +
      list
        .map((r, i) => {
          const bad = !r.image || (r.score !== null && r.score < 70);
          return (
            '<div class="rd-sheet-cell' +
            (bad ? " is-bad" : "") +
            '" data-cell="' +
            esc(r.runId) +
            '">' +
            (r.image
              ? '<img src="' + esc(r.image) + '" alt="' + esc(r.label) + '" data-open="' + esc(r.runId) + '">'
              : '<div class="rd-sheet-fail"><i data-lucide="image-off"></i><span>' +
                esc(r.error || "This angle did not finish.") +
                "</span></div>") +
            '<div class="rd-sheet-meta">' +
            '<input type="text" class="rd-sheet-name" data-name="' +
            esc(r.runId) +
            '" value="' +
            esc(r.label) +
            '" aria-label="Angle name">' +
            (r.score !== null ? '<span class="rd-sheet-score">' + r.score + "</span>" : "") +
            "</div>" +
            (r.issues.length
              ? '<ul class="rd-sheet-issues">' +
                r.issues.map((x) => "<li>" + esc(x.detail) + "</li>").join("") +
                "</ul>"
              : "") +
            '<div class="rd-sheet-act">' +
            '<button type="button" class="btn btn-ghost btn-xs" data-up="' +
            esc(r.runId) +
            '" ' +
            (i === 0 ? "disabled" : "") +
            ' aria-label="Move Earlier"><i data-lucide="arrow-up"></i></button>' +
            '<button type="button" class="btn btn-ghost btn-xs" data-down="' +
            esc(r.runId) +
            '" ' +
            (i === list.length - 1 ? "disabled" : "") +
            ' aria-label="Move Later"><i data-lucide="arrow-down"></i></button>' +
            '<button type="button" class="btn btn-ghost btn-xs' +
            (r.videoSelected ? " on" : "") +
            '" data-vid="' +
            esc(r.runId) +
            '">' +
            (r.videoSelected ? "In Video" : "Add To Video") +
            "</button>" +
            (r.image
              ? '<button type="button" class="btn btn-ghost btn-xs" data-ref="' +
                esc(r.runId) +
                '">Use As Reference</button>'
              : "") +
            '<button type="button" class="btn btn-ghost btn-xs" data-regen="' +
            esc(r.runId) +
            '">Regenerate</button>' +
            "</div></div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="up-act">' +
      '<button class="btn btn-primary" type="button" id="rdAngleToVideo">Send Selected To Video</button>' +
      '<button class="btn btn-ghost" type="button" data-close>Close</button></div>';
    icons();
  };

  card.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const id = (sel: string) => (t.closest("[" + sel + "]") as HTMLElement | null)?.dataset;
    const up = id("data-up");
    if (up?.["up"]) {
      state.results = reorderResults(state.results, up["up"], -1);
      handlers.onChange?.(angleResults());
      paint();
      return;
    }
    const down = id("data-down");
    if (down?.["down"]) {
      state.results = reorderResults(state.results, down["down"], 1);
      handlers.onChange?.(angleResults());
      paint();
      return;
    }
    const vid = id("data-vid");
    if (vid?.["vid"]) {
      state.results = toggleVideoSelection(state.results, vid["vid"]);
      handlers.onChange?.(angleResults());
      paint();
      return;
    }
    const ref = id("data-ref");
    if (ref?.["ref"]) {
      const r = state.results.find((x) => x.runId === ref["ref"]);
      if (r) {
        noteAngleSignal("reference_view");
        handlers.onReuseReference?.(r);
      }
      return;
    }
    const regen = id("data-regen");
    if (regen?.["regen"]) {
      const r = state.results.find((x) => x.runId === regen["regen"]);
      if (r) {
        m.remove();
        handlers.onRegenerate?.(r);
      }
      return;
    }
    const open = id("data-open");
    if (open?.["open"]) {
      const r = state.results.find((x) => x.runId === open["open"]);
      if (r) handlers.onOpen?.(r);
      return;
    }
    if (t.closest("#rdAngleToVideo")) {
      handlers.onSendToVideo?.(angleResults().filter((r) => r.videoSelected && r.image));
      return;
    }
    if (t.closest("[data-close]")) m.remove();
  });

  card.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.dataset["name"]) return;
    state.results = renameResult(state.results, t.dataset["name"], t.value);
    handlers.onChange?.(angleResults());
  });

  m.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("up-scrim")) m.remove();
  });

  paint();
}

/** Small stage banner summarising the automatic cross-view scoring. */
export function showAngleQa(
  report: ConsistencyReport | null,
  handlers: { onOpenSheet?: () => void; onRetryFailed?: () => void } = {},
) {
  byId("rdAngleQa")?.remove();
  if (!report) return;
  const stage = byId("rdwStage") || document.querySelector(".rdw-stage");
  if (!stage) return;
  const el = document.createElement("div");
  el.id = "rdAngleQa";
  el.className = "rd-stage-qa" + (report.failing.length ? " is-bad" : "");
  el.innerHTML =
    '<i data-lucide="' +
    (report.failing.length ? "triangle-alert" : "check") +
    '"></i><div><b>' +
    esc(report.headline) +
    "</b>" +
    (report.angles.length
      ? "<ul>" +
        report.angles
          .map((a) => "<li>" + esc(a.label) + " \u00b7 " + a.score + "/100</li>")
          .join("") +
        "</ul>"
      : "") +
    (report.disclosure ? '<p class="rd-stage-muted">' + esc(report.disclosure) + "</p>" : "") +
    '<div class="rd-stage-qa-act">' +
    '<button type="button" class="btn btn-primary btn-xs" id="rdAngleSheetOpen">Open Contact Sheet</button>' +
    (report.failing.length
      ? '<button type="button" class="btn btn-ghost btn-xs" id="rdAngleRetry">Regenerate Failed Angles</button>'
      : "") +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdAngleQaClose">Dismiss</button>' +
    "</div></div>";
  stage.appendChild(el);
  icons();
  byId("rdAngleSheetOpen")?.addEventListener("click", () => {
    el.remove();
    handlers.onOpenSheet?.();
  });
  byId("rdAngleRetry")?.addEventListener("click", () => {
    el.remove();
    handlers.onRetryFailed?.();
  });
  byId("rdAngleQaClose")?.addEventListener("click", () => el.remove());
}

export function angleCostPreview(): number {
  return angleCredits(readAngleResults());
}
