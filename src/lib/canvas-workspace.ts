/**
 * Room Canvas workspace wiring: the compact tool rail, the contextual
 * settings panel, the canvas overlay controls and the version rail.
 *
 * Every generation control the app script already owns keeps its original id,
 * so this module only arranges and mirrors state - it never generates.
 */
import { ROOM_OPTIONS, type RoomOption } from "@/lib/staging-rooms";
import {
  areaByLabel,
  areaFitsSpace,
  areaPreview,
  areasForSpace,
  type CanvasSpace,
} from "@/lib/space-datasets";
import { normalizeSpace, toolDescription, toolLabel } from "@/lib/space-tools";
import { capabilitiesFor } from "@/lib/canvas-capabilities";
import { openAreaPicker } from "@/lib/room-picker-modal";
import { buildCanvasPanel, refreshCanvasPanel } from "@/lib/canvas-panel";
import { ensureNotEmpty } from "@/lib/route-states";
import { initAutoRoom, markManualRoom } from "@/lib/canvas-autoroom";
import { mountStudioResultActions } from "@/lib/canvas-actions";


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

/** The four choices offered inline for each space. */
const POPULAR: Record<CanvasSpace, string[]> = {
  interior: ["Living Room", "Kitchen", "Bedroom", "Bathroom"],
  exterior: ["Front Of House", "Back Of House", "Side Of House", "Porch"],
  garden: ["Front Yard", "Backyard", "Patio", "Pool Area"],
};

/** Open once a choice exists: the section otherwise shows a summary row. */
let roomsExpanded = false;

export function setRoomsExpanded(open: boolean) {
  roomsExpanded = open;
  paintRoomCards();
}

/** Four inline cards: the current choice first, then popular ones. */
export function inlineAreas(space: CanvasSpace, active: string) {
  const list = areasForSpace(space);
  const out: typeof list = [];
  const cur = list.find((r) => r.label === active);
  if (cur) out.push(cur);
  for (const label of POPULAR[space] || []) {
    if (out.length >= 4) break;
    const rec = list.find((r) => r.label === label);
    if (rec && !out.some((x) => x.id === rec.id)) out.push(rec);
  }
  for (const rec of list) {
    if (out.length >= 4) break;
    if (!out.some((x) => x.id === rec.id)) out.push(rec);
  }
  return out;
}

export function paintRoomCards() {
  const host = document.getElementById("rdwRooms");
  const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
  const field = document.getElementById("rdwRoomField");
  if (!host || !sel) return;
  const space = currentSpace() as CanvasSpace;
  const list = areasForSpace(space);
  /* A selection from another space is never carried over. */
  if (sel.value && !areaFitsSpace(sel.value, space)) {
    sel.value = "";
  }
  const active = areaByLabel(sel.value)?.label || "";
  const label = field?.querySelector("label") as HTMLElement | null;
  const sectionName =
    space === "interior" ? "Room" : space === "exterior" ? "Exterior Area" : "Garden Area";
  if (label && label.firstChild && label.firstChild.nodeType === 3)
    label.firstChild.nodeValue = sectionName;
  const viewAll = document.getElementById("rdwRoomAll");
  if (viewAll) viewAll.textContent = "View All";

  /* Completed selection collapses into one compact summary row. */
  if (active && !roomsExpanded) {
    if (label) label.hidden = true;
    host.innerHTML =
      '<div class="rdw-sum"><span><b>' +
      esc(sectionName) +
      "</b> &middot; " +
      esc(active) +

      '</span><button type="button" class="fb-link" data-room-change>Change</button></div>';
    ensureNotEmpty(host, "empty", "This Space");
    const ctxRoomA = document.getElementById("setupCtxRoom");
    if (ctxRoomA) ctxRoomA.textContent = active;
    icons();
    return;
  }
  if (label) label.hidden = false;

  const shown = inlineAreas(space, active);
  host.innerHTML = shown
    .map((r) => {
      const img = areaPreview(r.id);
      const thumb = img
        ? '<img class="rdw-card-img" src="' +
          esc(img) +
          '" alt="' +
          esc(r.label) +
          '" loading="lazy" decoding="async">'
        : '<i data-lucide="' + esc(r.icon) + '"></i>';
      return (
        '<button type="button" class="rdw-card' +
        (r.label === active ? " on" : "") +
        (img ? " has-img" : "") +
        '" data-room="' +
        esc(r.label) +
        '" data-room-id="' +
        esc(r.id) +
        '" title="' +
        esc(r.label) +
        '"><span class="rdw-card-th">' +
        thumb +
        '<span class="rdw-card-check"><i data-lucide="check"></i></span></span><span class="rdw-card-n">' +
        esc(r.label) +
        "</span></button>"
      );
    })
    .join("");
  /* A preview that cannot load never leaves an empty rectangle: the card falls
     back to its icon and offers a retry on the next repaint. */
  host.querySelectorAll<HTMLImageElement>("img.rdw-card-img").forEach((im) => {
    im.addEventListener(
      "error",
      () => {
        const card = im.closest(".rdw-card") as HTMLElement | null;
        const id = card?.dataset["roomId"] || "";
        const rec = list.find((r) => r.id === id);
        card?.classList.remove("has-img");
        card?.classList.add("img-failed");
        const glyph = document.createElement("i");
        glyph.setAttribute("data-lucide", rec?.icon || "image-off");
        im.replaceWith(glyph);

        icons();
      },
      { once: true },
    );
  });
  ensureNotEmpty(host, "empty", "This Space");
  const ctxRoom = document.getElementById("setupCtxRoom");

  if (ctxRoom && active) ctxRoom.textContent = active;
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
  paintCapabilities(tool);
}

/**
 * Specialized features live inside their parent tool, never as separate
 * destinations. Choosing one only prepares the instruction — it never starts
 * a generation and never spends credits.
 */
function paintCapabilities(tool: string) {
  const desc = document.getElementById("rdwToolDesc");
  if (!desc || !desc.parentElement) return;
  let host = document.getElementById("rdwCaps");
  if (!host) {
    host = document.createElement("div");
    host.id = "rdwCaps";
    host.className = "rdw-caps";
    desc.parentElement.insertBefore(host, desc.nextSibling);
  }
  const caps = capabilitiesFor(tool);
  host.hidden = !caps.length;
  host.innerHTML = caps
    .map(
      (c) =>
        '<button type="button" class="rdw-cap" data-cap="' +
        esc(c.id) +
        '" title="' +
        esc(c.blurb) +
        '"><i data-lucide="' +
        esc(c.icon) +
        '"></i>' +
        esc(c.label) +
        "</button>",
    )
    .join("");
  icons();
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
  if (versToggle) versToggle.setAttribute("aria-expanded", s.versionsOpen ? "true" : "false");
  const versOpen = document.getElementById("rdwVersOpen") as HTMLElement | null;
  if (versOpen) versOpen.hidden = s.versionsOpen;

  buildCanvasPanel();
  initAutoRoom();
  paintRoomCards();
  paintPanelHeader();
  refreshCanvasPanel();

  b.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t || !t.closest) return;

    const room = t.closest("[data-room]") as HTMLElement | null;
    if (room && room.closest("#rdwRooms")) {
      e.preventDefault();
      roomsExpanded = false;
      /* A hand-picked room is final: detection never overwrites it. */
      markManualRoom();
      pickRoom(room.dataset["room"] || "");
      return;
    }
    if (t.closest("[data-room-change]")) {
      e.preventDefault();
      setRoomsExpanded(true);
      return;
    }
    if (t.closest("#rdwRoomAll")) {
      e.preventDefault();
      const sel = document.getElementById("fRoom") as HTMLSelectElement | null;
      openAreaPicker({
        space: currentSpace() as CanvasSpace,
        current: sel?.value || null,
        onApply: (label) => {
          roomsExpanded = false;
          markManualRoom();
          pickRoom(label);
        },
      });
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
    const cap = t.closest("#rdwCaps .rdw-cap") as HTMLElement | null;
    if (cap) {
      e.preventDefault();
      cap.parentElement
        ?.querySelectorAll(".rdw-cap")
        .forEach((x) => x.classList.toggle("on", x === cap));
      const note = document.getElementById("agentNote") as HTMLTextAreaElement | null;
      if (note) {
        const label = cap.textContent?.trim() || "";
        note.value = note.value ? note.value.replace(/\s*$/, " ") + label : label;
        note.dispatchEvent(new Event("input", { bubbles: true }));
        note.focus();
      }
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
      if (versToggle) versToggle.setAttribute("aria-expanded", open ? "true" : "false");
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
