/**
 * Room Canvas workspace wiring: the compact tool rail, the contextual
 * settings panel, the canvas overlay controls and the version rail.
 *
 * Every generation control the app script already owns keeps its original id,
 * so this module only arranges and mirrors state - it never generates.
 */
import { ROOM_OPTIONS, roomByLabel, type RoomOption } from "@/lib/staging-rooms";
import { normalizeSpace, toolDescription, toolLabel } from "@/lib/space-tools";

const SETTINGS_KEY = "rd_canvas_workspace";

export type WorkspaceSettings = {
  level: number;
  lock: "off" | "balanced" | "strong";
  strength: number;
  options: number;
  versionsOpen: boolean;
};

const DEFAULTS: WorkspaceSettings = {
  level: 1,
  lock: "balanced",
  strength: 1,
  options: 1,
  versionsOpen: true,
};

export function loadWorkspaceSettings(): WorkspaceSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      level: Number.isFinite(raw.level) ? Number(raw.level) : DEFAULTS.level,
      lock: ["off", "balanced", "strong"].includes(raw.lock) ? raw.lock : DEFAULTS.lock,
      strength: Number.isFinite(raw.strength) ? Number(raw.strength) : DEFAULTS.strength,
      options: Number.isFinite(raw.options) ? Number(raw.options) : DEFAULTS.options,
      versionsOpen: raw.versionsOpen !== false,
    };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function save(next: Partial<WorkspaceSettings>) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadWorkspaceSettings(), ...next }));
  } catch (_) {
    /* settings are a convenience */
  }
}

/** Rooms offered for a space, most common first. */
export function roomsForSpace(space: string): RoomOption[] {
  const s = normalizeSpace(space);
  return ROOM_OPTIONS.filter((r) => r.space === s);
}

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function icons() {
  try {
    (window as any).lucide?.createIcons({});
  } catch (_) {
    /* icons are cosmetic */
  }
}

function board(): HTMLElement | null {
  return document.querySelector("#v-studio .studio.rdw");
}

function currentSpace(): string {
  const on = document.querySelector("#spChips .chip.on") as HTMLElement | null;
  return normalizeSpace(on?.dataset["sp"] || "interior");
}

function currentTool(): string {
  const on = document.querySelector("#fTool .toolrow.on") as HTMLElement | null;
  return on?.dataset["tool"] || "Redesign";
}

/* ------------------------------------------------------------------ */
/* room cards                                                          */
/* ------------------------------------------------------------------ */

let roomsExpanded = false;

export function paintRoomCards() {
  const host = document.getElementById("rdwRooms");
  const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
  if (!host || !sel) return;
  const list = roomsForSpace(currentSpace());
  const shown = roomsExpanded ? list : list.slice(0, 8);
  const active = roomByLabel(sel.value)?.label || "";
  if (active && !shown.some((r) => r.label === active)) {
    const rec = list.find((r) => r.label === active);
    if (rec) shown.unshift(rec);
  }
  host.innerHTML = shown
    .map(
      (r) =>
        '<button type="button" class="rdw-card' +
        (r.label === active ? " on" : "") +
        '" data-room="' +
        esc(r.label) +
        '" title="' +
        esc(r.label) +
        '"><span class="rdw-card-th"><i data-lucide="' +
        esc(r.icon) +
        '"></i></span><span class="rdw-card-n">' +
        esc(r.label) +
        "</span></button>",
    )
    .join("");
  const ctxRoom = document.getElementById("setupCtxRoom");
  if (ctxRoom && active) ctxRoom.textContent = active;
  const all = document.getElementById("rdwRoomAll");
  if (all) all.textContent = roomsExpanded ? "Show Less" : "View All";
  icons();
}

/** Keeps the select (the source of truth for the app script) in sync. */
function pickRoom(label: string) {
  const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
  if (!sel) return;
  if (!Array.from(sel.options).some((o) => o.value === label || o.text === label)) {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
  }
  sel.value = label;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  paintRoomCards();
}

/* ------------------------------------------------------------------ */
/* panel header + tool driven fields                                   */
/* ------------------------------------------------------------------ */

export function paintPanelHeader() {
  const tool = currentTool();
  const space = currentSpace();
  const name = document.getElementById("rdwToolName");
  const desc = document.getElementById("rdwToolDesc");
  if (name) name.textContent = toolLabel(tool, space);
  if (desc) desc.textContent = toolDescription(tool, space);
  const levelOnly = tool === "Redesign" || tool === "Virtual Stage";
  const lvl = document.getElementById("rdwLevelField");
  if (lvl) lvl.hidden = !levelOnly;
  const lock = document.getElementById("rdwLockField");
  if (lock) lock.hidden = tool === "Sketch To Render" || tool === "2D To 3D Plan";
}

/* ------------------------------------------------------------------ */
/* canvas overlay                                                      */
/* ------------------------------------------------------------------ */

let zoom = 1;

function applyZoom() {
  const stage = document.getElementById("rdwStage");
  if (!stage) return;
  stage.style.setProperty("--rdw-zoom", String(zoom));
  stage.classList.toggle("zoomed", zoom !== 1);
}

function setCompare(mode: string) {
  const rng = document.getElementById("cRng") as HTMLInputElement | null;
  if (!rng) return;
  rng.value = mode === "before" ? "0" : mode === "after" ? "100" : "50";
  rng.dispatchEvent(new Event("input", { bubbles: true }));
  document
    .querySelectorAll<HTMLElement>("#rdwCmp .rdw-cmpb")
    .forEach((b) => b.classList.toggle("on", b.dataset["cmp"] === mode));
}

/* ------------------------------------------------------------------ */
/* init                                                                */
/* ------------------------------------------------------------------ */

export function initCanvasWorkspace() {
  const b = board();
  if (!b || (b as any).__rdw) return;
  (b as any).__rdw = true;

  const s = loadWorkspaceSettings();

  const setOn = (sel: string, match: (el: HTMLElement) => boolean) =>
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => el.classList.toggle("on", match(el)));

  setOn("#rdwLevel .rdw-opt", (el) => Number(el.dataset["b"]) === s.level);
  setOn("#rdwLock .chip", (el) => el.dataset["lock"] === s.lock);
  setOn("#rdwOpts .chip", (el) => Number(el.dataset["n"]) === s.options);
  const strength = document.getElementById("rdwStrength") as HTMLInputElement | null;
  if (strength) strength.value = String(s.strength);
  b.classList.toggle("vers-off", !s.versionsOpen);
  const versToggle = document.getElementById("rdwVersToggle");
  if (versToggle) versToggle.textContent = s.versionsOpen ? "Hide" : "Show";
  const versOpen = document.getElementById("rdwVersOpen") as HTMLElement | null;
  if (versOpen) versOpen.hidden = s.versionsOpen;

  paintRoomCards();
  paintPanelHeader();

  b.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t || !t.closest) return;

    const room = t.closest("[data-room]") as HTMLElement | null;
    if (room && room.closest("#rdwRooms")) {
      e.preventDefault();
      pickRoom(room.dataset["room"] || "");
      return;
    }
    if (t.closest("#rdwRoomAll")) {
      e.preventDefault();
      roomsExpanded = !roomsExpanded;
      paintRoomCards();
      return;
    }
    const lvl = t.closest("#rdwLevel .rdw-opt") as HTMLElement | null;
    if (lvl) {
      setOn("#rdwLevel .rdw-opt", (el) => el === lvl);
      save({ level: Number(lvl.dataset["b"]) || 0 });
      return;
    }
    const lock = t.closest("#rdwLock .chip") as HTMLElement | null;
    if (lock) {
      setOn("#rdwLock .chip", (el) => el === lock);
      save({ lock: (lock.dataset["lock"] as WorkspaceSettings["lock"]) || "balanced" });
      return;
    }
    const opt = t.closest("#rdwOpts .chip") as HTMLElement | null;
    if (opt) {
      setOn("#rdwOpts .chip", (el) => el === opt);
      save({ options: Number(opt.dataset["n"]) || 1 });
      return;
    }
    const sugg = t.closest("#rdwSugg button") as HTMLElement | null;
    if (sugg) {
      const note = document.getElementById("agentNote") as HTMLTextAreaElement | null;
      if (note) {
        note.value = note.value ? note.value.replace(/\s*$/, " ") + sugg.textContent : sugg.textContent || "";
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.focus();
      }
      return;
    }
    const cmp = t.closest("#rdwCmp .rdw-cmpb") as HTMLElement | null;
    if (cmp) {
      setCompare(cmp.dataset["cmp"] || "after");
      return;
    }
    if (t.closest("#rdwZoomIn")) {
      zoom = Math.min(3, zoom + 0.25);
      applyZoom();
      return;
    }
    if (t.closest("#rdwZoomOut")) {
      zoom = Math.max(1, zoom - 0.25);
      applyZoom();
      return;
    }
    if (t.closest("#rdwFit")) {
      zoom = 1;
      applyZoom();
      return;
    }
    if (t.closest("#rdwFull")) {
      const stage = document.getElementById("rdwStage");
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void stage?.requestFullscreen();
      } catch (_) {
        /* full screen is best effort */
      }
      return;
    }
    if (t.closest("#rdwVersToggle") || t.closest("#rdwVersOpen")) {
      const open = b.classList.contains("vers-off");
      b.classList.toggle("vers-off", !open);
      save({ versionsOpen: open });
      if (versToggle) versToggle.textContent = open ? "Hide" : "Show";
      if (versOpen) versOpen.hidden = open;
      return;
    }
    if (t.closest("#rdwObjTool")) {
      const sec = document.getElementById("rdwObjSec");
      const btn = document.getElementById("rdwObjTool");
      if (sec) {
        sec.hidden = !sec.hidden;
        btn?.classList.toggle("on", !sec.hidden);
        if (!sec.hidden) sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }
    if (t.closest("#fTool .toolrow") || t.closest("#spChips .chip")) {
      /* the app script owns the state change; repaint after it settles */
      setTimeout(() => {
        paintPanelHeader();
        paintRoomCards();
      }, 0);
    }
  });

  document.getElementById("rdwSettingsBtn")?.addEventListener("click", () => {
    b.classList.toggle("panel-on");
  });

  strength?.addEventListener("change", () => save({ strength: Number(strength.value) || 0 }));

  document.getElementById("fRoom")?.addEventListener("change", paintRoomCards);

  (window as any).rdwRefresh = () => {
    paintPanelHeader();
    paintRoomCards();
  };
}
