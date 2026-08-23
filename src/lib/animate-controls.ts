/**
 * Animate controls.
 *
 * The Studio settings panel for the motion-clip tool: which saved image the
 * clip animates, what kind of clip it is, the camera move, only the formats
 * and lengths the provider will actually accept, and the durable jobs already
 * running or finished.
 *
 * Nothing here prices or prompts anything: @/lib/animate-brief owns that.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  ASPECT_OPTIONS,
  CLIP_KINDS,
  DURATION_OPTIONS,
  MOTIONS,
  NOT_A_WALKTHROUGH,
  SOURCE_LABELS,
  TOOL_EXPLAINER,
  buildAnimateBrief,
  clipKind,
  defaultSettings,
  motion,
  statusLine,
  type AnimateBrief,
  type AnimateSettings,
  type Aspect,
  type ClipKindId,
  type ClipSource,
  type MotionId,
  type MotionJob,
  type SourceKindId,
} from "@/lib/animate-brief";

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

/* -------------------------------------------------------------- state */

const state = {
  settings: defaultSettings() as AnimateSettings,
  sources: [] as ClipSource[],
  sourceKind: "current" as SourceKindId,
  originalPath: null as string | null,
  jobs: [] as MotionJob[],
};

let onChangeCb: (() => void) | null = null;
let onOpenJobCb: ((id: string) => void) | null = null;
let onRetryCb: ((id: string) => void) | null = null;

function change() {
  paintSummary();
  try {
    onChangeCb?.();
  } catch (_) {
    /* the panel repaints next tick */
  }
}

/* ---------------------------------------------------------- accessors */

export function animateSettings(): AnimateSettings {
  return { ...state.settings };
}

export function animateSource(): ClipSource | null {
  return state.sources.find((s) => s.kind === state.sourceKind) || state.sources[0] || null;
}

/** Studio hands over every source the user may animate, newest state first. */
export function setAnimateSources(sources: ClipSource[], originalPath?: string | null) {
  state.sources = sources.filter(Boolean);
  state.originalPath = originalPath ?? null;
  if (!state.sources.some((s) => s.kind === state.sourceKind))
    state.sourceKind = state.sources[0]?.kind || "current";
  paintSources();
  change();
}

export function animateBrief(): AnimateBrief {
  return buildAnimateBrief({
    settings: state.settings,
    source: animateSource(),
    originalPath: state.originalPath,
  });
}

export function animateCredits(): number {
  return animateBrief().credits;
}

export function applyAnimateSettings(patch: Partial<AnimateSettings>) {
  state.settings = { ...state.settings, ...patch };
  paintAll();
  change();
}

export function resetAnimate() {
  state.settings = defaultSettings();
  paintAll();
  change();
}

export function setAnimateJobs(jobs: MotionJob[]) {
  state.jobs = jobs.slice(0, 8);
  paintJobs();
}

/* -------------------------------------------------------------- mount */

export function mountAnimatePanel(opts?: {
  onChange?: () => void;
  onOpenJob?: (id: string) => void;
  onRetry?: (id: string) => void;
}) {
  onChangeCb = opts?.onChange || null;
  onOpenJobCb = opts?.onOpenJob || null;
  onRetryCb = opts?.onRetry || null;
  if (byId("rdAnimSec")) return;
  const body = byId("rdwPanelBody");
  if (!body) return;

  const sec = document.createElement("div");
  sec.id = "rdAnimSec";
  sec.className = "rd-stage rd-animate";
  sec.hidden = true;
  sec.innerHTML =
    '<p class="rd-stage-muted">' +
    esc(TOOL_EXPLAINER) +
    " " +
    esc(NOT_A_WALKTHROUGH) +
    "</p>" +
    /* source */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Source</b></div>' +
    '<div class="rd-stage-chips" id="rdAnimSrc"></div>' +
    '<div class="rd-anim-src" id="rdAnimSrcCard"></div>' +
    "</div>" +
    /* clip kind */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Clip Type</b></div>' +
    '<div class="rd-stage-modes" id="rdAnimKinds"></div>' +
    "</div>" +
    /* motion */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Camera Move</b></div>' +
    '<div class="rd-anim-grid" id="rdAnimMotions"></div>' +
    '<div id="rdAnimCustomWrap" hidden>' +
    '<label class="rd-stage-lab" for="rdAnimCustom">Describe The Move</label>' +
    '<textarea id="rdAnimCustom" rows="3" maxlength="400" placeholder="The camera drifts slowly along the kitchen island"></textarea>' +
    "</div>" +
    "</div>" +
    /* format */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Length</b></div>' +
    '<div class="rd-stage-chips" id="rdAnimSecs"></div>' +
    '<div class="rd-stage-h" style="margin-top:10px"><b>Format</b></div>' +
    '<div class="rd-stage-chips" id="rdAnimAspects"></div>' +
    '<p class="rd-stage-muted" id="rdAnimCapNote"></p>' +
    "</div>" +
    /* motion feel */
    '<div class="rd-stage-block">' +
    '<div class="rd-stage-h"><b>Motion</b></div>' +
    '<label class="rd-stage-lab">Strength <span id="rdAnimStrVal">50</span></label>' +
    '<input type="range" id="rdAnimStr" min="0" max="100" step="5" value="50" aria-label="Motion strength">' +
    '<label class="rd-stage-lab">Camera Speed <span id="rdAnimSpdVal">40</span></label>' +
    '<input type="range" id="rdAnimSpd" min="0" max="100" step="5" value="40" aria-label="Camera speed">' +
    '<label class="rd-anim-tog"><input type="checkbox" id="rdAnimLock" checked><span>Keep Architecture Locked</span></label>' +
    '<label class="rd-anim-tog"><input type="checkbox" id="rdAnimPeople"><span>Allow People In Frame</span></label>' +
    "</div>" +
    /* extras */
    '<details class="rd-stage-block" id="rdAnimMore">' +
    "<summary><b>Advanced</b><span>Optional</span></summary>" +
    '<label class="rd-stage-lab" for="rdAnimNeg">Negative Instructions</label>' +
    '<textarea id="rdAnimNeg" rows="2" maxlength="300" placeholder="reflections on the television, lens flare"></textarea>' +
    '<label class="rd-anim-tog"><input type="checkbox" id="rdAnimEndCard"><span>Add Logo End Card</span></label>' +
    '<label class="rd-anim-tog"><input type="checkbox" id="rdAnimDisc"><span>Add Disclosure Overlay</span></label>' +
    "</details>" +
    /* jobs */
    '<div class="rd-stage-block" id="rdAnimJobsBlock" hidden>' +
    '<div class="rd-stage-h"><b>Your Clips</b></div>' +
    '<div class="rd-anim-jobs" id="rdAnimJobs"></div>' +
    "</div>" +
    '<p class="rd-stage-muted" id="rdAnimSummary"></p>';

  body.appendChild(sec);

  sec.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    const src = t.closest("[data-anim-src]") as HTMLElement | null;
    if (src) {
      state.sourceKind = (src.dataset["animSrc"] || "current") as SourceKindId;
      /* An angle set only makes sense as a sequence, and vice versa. */
      if (state.sourceKind === "angle_set") state.settings.clipKind = "angle_sequence";
      else if (state.settings.clipKind === "angle_sequence") state.settings.clipKind = "single";
      paintSources();
      paintKinds();
      change();
      return;
    }

    const kind = t.closest("[data-anim-kind]") as HTMLElement | null;
    if (kind) {
      state.settings.clipKind = (kind.dataset["animKind"] || "single") as ClipKindId;
      paintKinds();
      change();
      return;
    }

    const mv = t.closest("[data-anim-motion]") as HTMLElement | null;
    if (mv) {
      state.settings.motionId = (mv.dataset["animMotion"] || "dolly_in") as MotionId;
      const m = motion(state.settings.motionId);
      state.settings.strength = m.defaultStrength;
      paintMotions();
      paintSliders();
      change();
      return;
    }

    const sec2 = t.closest("[data-anim-sec]") as HTMLElement | null;
    if (sec2) {
      if (sec2.hasAttribute("disabled")) return;
      state.settings.seconds = Number(sec2.dataset["animSec"]);
      paintFormats();
      change();
      return;
    }

    const asp = t.closest("[data-anim-aspect]") as HTMLElement | null;
    if (asp) {
      if (asp.hasAttribute("disabled")) return;
      state.settings.aspect = (asp.dataset["animAspect"] || "16:9") as Aspect;
      paintFormats();
      change();
      return;
    }

    const open = t.closest("[data-anim-open]") as HTMLElement | null;
    if (open) {
      onOpenJobCb?.(open.dataset["animOpen"] || "");
      return;
    }
    const retry = t.closest("[data-anim-retry]") as HTMLElement | null;
    if (retry) onRetryCb?.(retry.dataset["animRetry"] || "");
  });

  sec.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "rdAnimStr") state.settings.strength = Number(t.value);
    else if (t.id === "rdAnimSpd") state.settings.speed = Number(t.value);
    else if (t.id === "rdAnimCustom") state.settings.customPrompt = t.value;
    else if (t.id === "rdAnimNeg") state.settings.negative = t.value;
    else return;
    paintSliderReadout();
    change();
  });

  sec.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === "rdAnimLock") state.settings.lockArchitecture = t.checked;
    else if (t.id === "rdAnimPeople") state.settings.allowPeople = t.checked;
    else if (t.id === "rdAnimEndCard") state.settings.endCard = t.checked;
    else if (t.id === "rdAnimDisc") state.settings.disclosure = t.checked;
    else return;
    change();
  });

  paintAll();
  icons();
}

export function setAnimatePanelVisible(on: boolean) {
  const sec = byId("rdAnimSec");
  if (sec) sec.hidden = !on;
}

/* -------------------------------------------------------------- paint */

function paintAll() {
  paintSources();
  paintKinds();
  paintMotions();
  paintFormats();
  paintSliders();
  paintJobs();
  paintSummary();
  icons();
}

function paintSources() {
  const host = byId("rdAnimSrc");
  if (!host) return;
  const kinds: SourceKindId[] = ["current", "original", "version", "angle_set"];
  host.innerHTML = kinds
    .map((k) => {
      const found = state.sources.find((s) => s.kind === k);
      const on = k === state.sourceKind;
      return (
        '<button type="button" class="rd-stage-chip' +
        (on ? " on" : "") +
        '"' +
        (found ? "" : " disabled") +
        ' data-anim-src="' +
        k +
        '" title="' +
        esc(found ? found.label : "Not available for this room yet") +
        '">' +
        esc(SOURCE_LABELS[k]) +
        "</button>"
      );
    })
    .join("");

  const card = byId("rdAnimSrcCard");
  const src = animateSource();
  if (!card) return;
  if (!src) {
    card.innerHTML = '<p class="rd-stage-muted">Save a design first, then animate it.</p>';
    return;
  }
  const count = src.members?.length || 0;
  card.innerHTML =
    '<div class="rd-anim-srcrow">' +
    (src.thumbUrl
      ? '<img src="' + esc(src.thumbUrl) + '" alt="' + esc(src.label) + '">'
      : '<span class="rd-anim-srcph"><i data-lucide="image"></i></span>') +
    "<div><b>" +
    esc(src.label) +
    "</b><span>" +
    esc(SOURCE_LABELS[src.kind]) +
    (count ? " \u00b7 " + count + " Views" : "") +
    "</span></div></div>";
  icons();
}

function paintKinds() {
  const host = byId("rdAnimKinds");
  if (!host) return;
  const src = animateSource();
  host.innerHTML = CLIP_KINDS.map((k) => {
    const blocked =
      (k.id === "angle_sequence" && !(src && src.members && src.members.length)) ||
      (k.id === "before_after" && !state.originalPath);
    return (
      '<button type="button" class="rd-stage-mode' +
      (state.settings.clipKind === k.id ? " on" : "") +
      '"' +
      (blocked ? " disabled" : "") +
      ' data-anim-kind="' +
      k.id +
      '" title="' +
      Esc(blocked ? K.requires ||"Not available yet" : k.blurb) +
      '"><b>' +
      esc(k.label) +
      "</b><span>" +
      esc(k.blurb) +
      "</span></button>"
    );
  }).join("");
}

function paintMotions() {
  const host = byId("rdAnimMotions");
  if (!host) return;
  host.innerHTML = MOTIONS.map(
    (m) =>
      '<button type="button" class="rd-anim-move' +
      (state.settings.motionId === m.id ? " on" : "") +
      '" data-anim-motion="' +
      m.id +
      '" title="' +
      Esc(m.blurb) +
      '"><i data-lucide="' +
      m.icon +
      '"></i><b>' +
      esc(m.label) +
      "</b></button>",
  ).join("");
  const wrap = byId("rdAnimCustomWrap");
  if (wrap) wrap.hidden = state.settings.motionId !== "custom";
  icons();
}

function paintFormats() {
  const secs = byId("rdAnimSecs");
  if (secs)
    secs.innerHTML = DURATION_OPTIONS.map(
      (d) =>
        '<button type="button" class="rd-stage-chip' +
        (state.settings.seconds === d.seconds ? " on" : "") +
        '"' +
        (d.supported ? "" : " disabled") +
        ' data-anim-sec="' +
        d.seconds +
        '" title="' +
        esc(d.reason || `${d.label} clip`) +
        '">' +
        esc(d.label) +
        "</button>",
    ).join("");

  const asp = byId("rdAnimAspects");
  if (asp)
    asp.innerHTML = ASPECT_OPTIONS.map(
      (a) =>
        '<button type="button" class="rd-stage-chip' +
        (state.settings.aspect === a.id ? " on" : "") +
        '"' +
        (a.supported ? "" : " disabled") +
        ' data-anim-aspect="' +
        a.id +
        '" title="' +
        Esc(a.reason || A.label) +
        '">' +
        esc(a.label) +
        "</button>",
    ).join("");

  const note = byId("rdAnimCapNote");
  if (note)
    note.textContent =
      "Only the lengths and formats the video model can actually render are selectable.";
}

function paintSliders() {
  const str = byId("rdAnimStr") as HTMLInputElement | null;
  const spd = byId("rdAnimSpd") as HTMLInputElement | null;
  if (str) str.value = String(state.settings.strength);
  if (spd) spd.value = String(state.settings.speed);
  const lock = byId("rdAnimLock") as HTMLInputElement | null;
  if (lock) lock.checked = !!state.settings.lockArchitecture;
  paintSliderReadout();
}

function paintSliderReadout() {
  const a = byId("rdAnimStrVal");
  const b = byId("rdAnimSpdVal");
  if (a) a.textContent = String(state.settings.strength);
  if (b) b.textContent = String(state.settings.speed);
}

function paintJobs() {
  const block = byId("rdAnimJobsBlock");
  const host = byId("rdAnimJobs");
  if (!block || !host) return;
  block.hidden = state.jobs.length === 0;
  host.innerHTML = state.jobs
    .map(
      (j) =>
        '<div class="rd-anim-job" data-status="' +
        esc(j.status) +
        '"><div><b>' +
        esc(j.title) +
        "</b><span>" +
        esc(statusLine(j)) +
        "</span></div>" +
        (j.status === "completed"
          ? '<button type="button" class="btn btn-ghost btn-xs" data-anim-open="' +
            esc(j.id) +
            '">Open</button>'
          : j.status === "failed"
            ? '<button type="button" class="btn btn-ghost btn-xs" data-anim-retry="' +
              esc(j.id) +
              '">Retry</button>'
            : '<span class="rd-anim-spin"><i data-lucide="loader"></i></span>') +
        "</div>",
    )
    .join("");
  icons();
}

function paintSummary() {
  const el = byId("rdAnimSummary");
  if (!el) return;
  const brief = animateBrief();
  if (!brief.valid) {
    el.textContent = brief.missing[0] || "Choose a saved image to animate.";
    return;
  }
  const k = clipKind(state.settings.clipKind);
  el.textContent =
    `${k.label} \u00b7 ${motion(state.settings.motionId).label} \u00b7 ${state.settings.seconds}s ` +
    `${state.settings.aspect} \u00b7 ${brief.credits} credits`;
}
