/**
 * Redesign controls: intensity, Reality Lock advanced unlocks and the
 * generation brief the user confirms before a credit is spent.
 *
 * Every control here is wired to real state read by the generation handler —
 * nothing is decorative.
 */

import { createIcons, icons as lucideIcons } from "lucide";
import {
  INTENSITY_LEVELS,
  LOCK_ELEMENTS,
  REALITY_LOCK_DISCLOSURE,
  STRUCTURE_DRIFT_WARNING,
  type Brief,
  type IntensityId,
  type ItemMap,
  type ItemState,
  setItemState,
} from "@/lib/redesign-brief";

const byId = (id: string) => document.getElementById(id);

function icons() {
  try {
    createIcons({ icons: lucideIcons });
  } catch (_) {
    /* icons are cosmetic */
  }
}

/* ----------------------------------------------------------- intensity */

/** Rebuilds the legacy three-way "Redesign Level" as the four real levels. */
export function upgradeIntensityControl() {
  const field = byId("rdwLevelField");
  if (!field || field.getAttribute("data-intensity") === "1") return;
  field.setAttribute("data-intensity", "1");
  const label = field.querySelector("label") as HTMLElement | null;
  if (label) label.textContent = "Design Intensity";
  const host = byId("rdwLevel");
  if (!host) return;
  host.innerHTML = INTENSITY_LEVELS.map(
    (l, i) =>
      '<button class="rdw-opt' +
      (l.id === "makeover" ? " on" : "") +
      '" type="button" data-int="' +
      l.id +
      '" data-b="' +
      i +
      '"><b>' +
      l.label +
      "</b><span>" +
      l.blurb +
      "</span></button>",
  ).join("");
  host.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement)?.closest?.(".rdw-opt") as HTMLElement | null;
    if (!b) return;
    host.querySelectorAll(".rdw-opt").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
  });
}

export function readIntensity(): IntensityId {
  const on = document.querySelector("#rdwLevel .rdw-opt.on") as HTMLElement | null;
  return ((on?.getAttribute("data-int") as IntensityId) || "makeover") as IntensityId;
}

export function setIntensity(id: IntensityId) {
  document.querySelectorAll("#rdwLevel .rdw-opt").forEach((x) => x.classList.remove("on"));
  const el = document.querySelector('#rdwLevel .rdw-opt[data-int="' + id + '"]');
  el?.classList.add("on");
}

/* -------------------------------------------------------- reality lock */

/** Adds the honest disclosure plus per-element unlock toggles. */
export function upgradeRealityLock(space: string = "interior") {
  const field = byId("rdwLockField");
  if (!field) return;
  const hint = field.querySelector(".rdw-hint") as HTMLElement | null;
  if (hint) hint.textContent = REALITY_LOCK_DISCLOSURE;
  /* Reality Lock is always on: the vague off / balanced / strong chips are
     replaced by explicit per-element unlocks. */
  const oldChips = document.getElementById("rdwLock");
  if (oldChips) oldChips.hidden = true;
  let adv = byId("rdwLockAdv");
  if (!adv) {
    adv = document.createElement("div");
    adv.id = "rdwLockAdv";
    adv.className = "rdw-lock-adv";
    adv.innerHTML =
      '<button type="button" class="fb-link" id="rdwLockAdvToggle" aria-expanded="false">Advanced: Unlock Specific Elements</button>' +
      '<div class="rdw-lock-list" id="rdwLockList" hidden></div>';
    field.appendChild(adv);
    byId("rdwLockAdvToggle")?.addEventListener("click", () => {
      const list = byId("rdwLockList");
      if (!list) return;
      list.hidden = !list.hidden;
      byId("rdwLockAdvToggle")?.setAttribute("aria-expanded", list.hidden ? "false" : "true");
    });
  }
  const list = byId("rdwLockList");
  if (!list) return;
  const sp = space === "exterior" ? "exterior" : space === "garden" || space === "landscape" ? "garden" : "interior";
  const prev = readUnlocked();
  list.innerHTML = LOCK_ELEMENTS.filter((e) => e.spaces.includes(sp as any))
    .map(
      (e) =>
        '<label class="rdw-lock-row' +
        (e.unlockable ? "" : " is-fixed") +
        '"><input type="checkbox" data-unlock="' +
        e.id +
        '"' +
        (e.unlockable ? "" : " disabled") +
        (e.unlockable && prev.includes(e.id) ? " checked" : "") +
        "><span>" +
        e.label +
        "</span><em>" +
        (e.unlockable ? "Locked" : "Always Locked") +
        "</em></label>",
    )
    .join("");
  list.querySelectorAll<HTMLInputElement>("input[data-unlock]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const em = cb.parentElement?.querySelector("em");
      if (em) em.textContent = cb.checked ? "Unlocked" : "Locked";
    });
  });
}

export function readUnlocked(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>("#rdwLockList input[data-unlock]:checked"),
  ).map((i) => i.getAttribute("data-unlock") || "");
}

/* ------------------------------------------------------- text-entry items */

/**
 * Text entry for keep/replace/remove, alongside the canvas click selection.
 * Both write into the same map so an item can only hold one state.
 */
export function mountItemTextEntry(
  get: () => ItemMap,
  set: (m: ItemMap) => void,
  render: () => void,
) {
  const host = byId("rdwObjSec");
  if (!host || byId("rdwItemEntry")) return;
  const wrap = document.createElement("div");
  wrap.id = "rdwItemEntry";
  wrap.className = "rdw-item-entry";
  wrap.innerHTML =
    '<div class="rdw-item-row"><input type="text" id="rdwItemInput" placeholder="Name an item, for example: kitchen island" aria-label="Item name">' +
    '<button type="button" class="btn btn-ghost btn-xs" id="rdwItemAdd">Add</button></div>';
  host.appendChild(wrap);
  const add = () => {
    const input = byId("rdwItemInput") as HTMLInputElement | null;
    const val = (input?.value || "").trim();
    if (!val) return;
    const mode =
      (document.querySelector("#rdwObjSec .chip.on") as HTMLElement | null)?.getAttribute("data-mode") ||
      "keep";
    set(setItemState(get(), val, mode as ItemState, "text"));
    if (input) input.value = "";
    render();
  };
  byId("rdwItemAdd")?.addEventListener("click", add);
  byId("rdwItemInput")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      add();
    }
  });
}

/* ------------------------------------------------------------ the brief */

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export type BriefReviewResult = "confirm" | "cancel";

/**
 * The last screen before any credit is spent. Resolves only on an explicit
 * click, so simply opening Redesign can never generate.
 */
export function openBriefReview(
  brief: Brief,
  opts: { costLabel: string; balanceNote?: string | null },
): Promise<BriefReviewResult> {
  return new Promise((resolve) => {
    document.getElementById("rdBriefModal")?.remove();
    const m = document.createElement("div");
    m.id = "rdBriefModal";
    m.className = "up-modal on rd-brief";
    const rows = brief.lines
      .map(
        (l) =>
          '<div class="rd-brief-row"><span class="k">' +
          esc(l.k) +
          '</span><span class="v">' +
          esc(l.v) +
          "</span></div>",
      )
      .join("");
    const conflicts = brief.conflicts.length
      ? '<div class="rd-brief-warn"><b>Check These Conflicts</b><ul>' +
        brief.conflicts.map((c) => "<li>" + esc(c.message) + "</li>").join("") +
        "</ul></div>"
      : "";
    m.innerHTML =
      '<div class="up-scrim" data-close></div><div class="up-card rd-brief-card" role="dialog" aria-modal="true" aria-label="Review Generation Brief">' +
      "<h3>Review Your Generation Brief</h3>" +
      '<p class="rd-brief-sub">Nothing is generated and no credits are used until you confirm.</p>' +
      '<div class="rd-brief-list">' +
      rows +
      "</div>" +
      conflicts +
      '<p class="rd-brief-note">' +
      esc(brief.lockDisclosure) +
      "</p>" +
      '<div class="up-act"><button class="btn btn-primary" id="rdBriefGo" type="button">Generate · ' +
      esc(opts.costLabel) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" data-close>Back To Settings</button></div>' +
      (opts.balanceNote ? '<p class="rd-brief-bal">' + esc(opts.balanceNote) + "</p>" : "") +
      "</div>";
    (document.querySelector(".rd-app") || document.body).appendChild(m);
    icons();
    const done = (r: BriefReviewResult) => {
      m.remove();
      resolve(r);
    };
    m.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-close]")) done("cancel");
    });
    const go = byId("rdBriefGo") as HTMLButtonElement | null;
    go?.addEventListener("click", () => {
      /* One confirmation per brief: the button cannot start a second job. */
      if (go.disabled) return;
      go.disabled = true;
      done("confirm");
    });
    setTimeout(() => go?.focus(), 20);
  });
}

/* ------------------------------------------------------- drift warning */

/** Shown on the Canvas when before/after analysis suggests structural drift. */
export function showDriftWarning(show: boolean, detail?: string | null) {
  const stage = byId("rdwStage");
  if (!stage) return;
  let el = byId("rdwDrift");
  if (!show) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "rdwDrift";
    el.className = "rdw-drift";
    stage.appendChild(el);
  }
  el.innerHTML =
    '<i data-lucide="triangle-alert"></i><span><b>' +
    STRUCTURE_DRIFT_WARNING +
    "</b>" +
    (detail ? " — " + esc(detail) : "") +
    " Always verify critical construction details.</span>";
  icons();
}
