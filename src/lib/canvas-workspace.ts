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
  defaultRoomForSpace,
  type CanvasSpace,
} from "@/lib/space-datasets";
import { normalizeSpace, toolDescription, toolLabel } from "@/lib/space-tools";
import { capabilitiesFor } from "@/lib/canvas-capabilities";
import { openRoomAreaPicker } from "@/lib/room-area-picker";
import { buildCanvasPanel, refreshCanvasPanel } from "@/lib/canvas-panel";
import { ensureNotEmpty } from "@/lib/route-states";
import { initAutoRoom, markManualRoom } from "@/lib/canvas-autoroom";
import { mountStudioResultActions } from "@/lib/canvas-actions";
import { editorEntry, type ActiveImage } from "@/lib/active-image";


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

/**
 * The image the Canvas is showing right now, described with the shared active
 * image contract. Never the latest room, the newest Media asset or a global
 * `lastRender` — only what the version model says is active.
 */
function canvasActiveImage(): ActiveImage | null {
  const w = window as any;
  const r = (typeof w.rdActiveCanvasResult === "function" && w.rdActiveCanvasResult()) || null;
  const entry = w.__rdCanvasEntry || {};
  const sourcePath = r?.sourcePath || entry.sourcePath || w.rdPendingPhotoPath || null;
  const versionPath = r?.resultPath || null;
  const versionId = r?.versionId || null;
  if (!sourcePath && !versionPath) return null;
  return {
    assetId: versionId || entry.photoKey || sourcePath || "",
    assetType: versionId ? "generated_image" : "uploaded_image",
    sourceAssetId: entry.photoKey || sourcePath || null,
    activeSourcePath: sourcePath,
    activeVersionId: versionId,
    activeVersionPath: versionPath,
    roomId: r?.roomId || entry.roomId || null,
    propertyId: entry.propertyId || null,
    draftId: entry.draftId || null,
    returnDestination: "canvas",
    editedSource: !!entry.editedSourcePath,
  };
}

/* ------------------------------------------------------------------ */
/* Edit Photo as a Canvas tool                                         */
/* ------------------------------------------------------------------ */

/**
 * Where the editor mounts: as a direct child of the Designer grid, so its
 * stage takes the middle Canvas column and its inspector takes the right
 * panel column. The editor is never nested inside the image viewport.
 */
function editorMountHost(): HTMLElement | null {
  return board();
}

/* ------------------------------------------------------------------ */
/* one permanent Canvas: the chrome below the image never unmounts      */
/* ------------------------------------------------------------------ */

function canvasBody(): HTMLElement | null {
  return document.querySelector("#canvasCard > .card-b");
}

/** Nodes borrowed from the Canvas card while the editor owns the column. */
let borrowed: HTMLElement[] = [];

/**
 * The Canvas is one stage in every tool. The editor column reproduces the card
 * exactly and takes the *same* chrome nodes (save warning, result actions,
 * Version History) below its stage, so the reserved height - and therefore the
 * image rectangle - is byte for byte the same as in Redesign. Nothing is
 * recreated, so no state is lost when the tool changes.
 */
function borrowCanvasChrome(main: HTMLElement) {
  const body = canvasBody();
  if (!body || borrowed.length) return;
  Array.from(body.children).forEach((el) => {
    if (el.classList.contains("rdw-stage")) return;
    borrowed.push(el as HTMLElement);
  });
  borrowed.forEach((el) => main.appendChild(el));
}

/** Puts the borrowed chrome back in its original order under the stage. */
function returnCanvasChrome() {
  const body = canvasBody();
  if (body) borrowed.forEach((el) => body.appendChild(el));
  borrowed = [];
}


/** The generation tool that was selected before Edit took over the rail. */
let toolBeforeEdit = "";

/**
 * Edit Photo is Canvas state, never navigation. Exactly one Designer tool is
 * selected at a time: turning Edit on clears every generation tool, turning it
 * off restores the one that was selected before.
 */
export function setCanvasTool(tool: "edit-photo" | null) {
  const b = board();
  const btn = document.getElementById("rdwEditPhotoTool");
  const on = tool === "edit-photo";
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>("#fTool .toolrow:not(.rdw-phototool)"),
  );
  if (on) {
    const prev = rows.find((r) => r.classList.contains("on"));
    if (prev) toolBeforeEdit = prev.dataset["tool"] || "";
    rows.forEach((r) => {
      r.classList.remove("on");
      r.setAttribute("aria-pressed", "false");
    });
  } else if (!rows.some((r) => r.classList.contains("on"))) {
    const back =
      rows.find((r) => r.dataset["tool"] === toolBeforeEdit) ||
      rows.find((r) => r.dataset["tool"] === "Redesign") ||
      rows[0];
    back?.classList.add("on");
    back?.setAttribute("aria-pressed", "true");
  }
  rows.forEach((r) => r.setAttribute("aria-pressed", r.classList.contains("on") ? "true" : "false"));
  b?.classList.toggle("editing-photo", on);
  if (b) b.dataset["activeTool"] = on ? "edit-photo" : toolBeforeEdit || "redesign";
  btn?.classList.toggle("on", on);
  btn?.setAttribute("aria-pressed", on ? "true" : "false");
  paintPanelHeader();
}

/** Closes the embedded editor and restores the normal Canvas stage. */
export function closeCanvasPhotoEditor() {
  returnCanvasChrome();
  void import("@/lib/photo-editor").then((m) => m.closePhotoEditor());
  setCanvasTool(null);
  applyZoom();
}


/** Mounts the ONE shared editor inside the Canvas on the visible image. */
async function openCanvasPhotoEditor(): Promise<void> {
  const active = canvasActiveImage();
  if (!active) {
    (window as any).rdToast?.("Open A Photo On The Canvas First.");
    return;
  }
  const mount = editorMountHost();
  if (!mount) return;
  const e = editorEntry(active);
  const [{ openPhotoEditor }] = await Promise.all([import("@/lib/photo-editor")]);
  const versionTag = document.getElementById("rdwVerTag")?.textContent?.trim();
  setCanvasTool("edit-photo");
  const room =
    (document.getElementById("fRoom") as HTMLSelectElement | null)?.value || "Photo";
  await openPhotoEditor({
    editorMode: e.editorMode,
    returnDestination: "canvas",
    mount,
    contextLabel: versionTag || "Source Photo",
    startKey: e.assetId,
    photos: [
      {
        key: e.assetId,
        name: room,
        room,
        space: currentSpace(),
        assetId: e.assetId,
        assetType: e.assetType,
        storagePath: e.storagePath,
        path: e.storagePath,
        src: "",
        ...(e.propertyId ? { propertyId: e.propertyId } : {}),
        ...(e.roomId ? { roomId: e.roomId } : {}),
        ...(e.versionId ? { versionId: e.versionId } : {}),
        ...(e.parentVersionId ? { parentVersionId: e.parentVersionId } : {}),
        editorMode: e.editorMode,
      },
    ],
  });
  /* The permanent Canvas chrome moves with the column, so the stage keeps the
     exact same height and the image never shifts. */
  const main = document.querySelector<HTMLElement>(".rdpe-embed .rdpe-main");
  if (main) borrowCanvasChrome(main);
  applyZoom();
}



/* ------------------------------------------------------------------ */
/* room cards                                                          */
/* ------------------------------------------------------------------ */

/** The four choices offered inline for each space. Labels must match the
    room catalog exactly (legacy aliases are not matched here), so the most
    common area always leads — Front Exterior first for exterior photos. */
const POPULAR: Record<CanvasSpace, string[]> = {
  interior: ["Living Room", "Kitchen", "Bedroom", "Bathroom"],
  exterior: ["Front Exterior", "Rear Exterior", "Side Exterior", "Porch"],
  garden: ["Front Garden", "Backyard", "Garden Patio", "Pool Area"],
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
  /* When nothing is chosen for this space, pre-select the default area so the
     panel always shows a sensible first option (Front Exterior for exterior
     photos, etc.). This is a soft default: photo detection may still replace
     it, and a manual pick is always final. */
  if (sel && !(sel.value || "").trim()) {
    const def = defaultRoomForSpace(space);
    if (def) {
      if (!Array.from(sel.options).some((o) => o.value === def || o.text === def)) {
        const opt = document.createElement("option");
        opt.value = def;
        opt.textContent = def;
        sel.appendChild(opt);
      }
      sel.value = def;
    }
  }
  const active = areaByLabel(sel?.value || "")?.label || "";
  const label = field?.querySelector("label") as HTMLElement | null;
  const sectionName =
    space === "interior" ? "Room" : space === "exterior" ? "Exterior Area" : "Garden Area";
  if (label && label.firstChild && label.firstChild.nodeType === 3)
    label.firstChild.nodeValue = sectionName;
  const viewAll = document.getElementById("rdwRoomAll");
  if (viewAll) viewAll.textContent = "View All";

  /* The visual selector always stays on screen: a chosen room is simply the
     card that reads as selected, never a text summary the user must reopen. */
  void roomsExpanded;
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
  /* Reality Lock only means something when the result is anchored to a real
     photo. A text concept has no geometry to hold, so the control is hidden. */
  const mode = (document.getElementById("canvas") as HTMLElement | null)?.dataset["mode"] || "";
  const noGeometry = mode === "concept-only" || mode === "reference-guided";
  if (lock) lock.hidden = noGeometry || tool === "Sketch To Render" || tool === "2D To 3D Plan";
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
  if (versOpen) {
    versOpen.hidden = s.versionsOpen;
    versOpen.setAttribute("aria-expanded", s.versionsOpen ? "true" : "false");
  }

  buildCanvasPanel();
  initAutoRoom();
  paintRoomCards();
  paintPanelHeader();
  refreshCanvasPanel();
  /* A finished render is actionable where it is shown. */
  mountStudioResultActions();

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
      openRoomAreaPicker({
        space: currentSpace() as CanvasSpace,
        currentLabel: sel?.value || null,
        opener: t.closest("#rdwRoomAll") as HTMLElement,
        onApply: (sel2) => {
          roomsExpanded = false;
          markManualRoom();
          pickRoom(sel2.label);
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
      if (versOpen) {
        versOpen.hidden = open;
        versOpen.setAttribute("aria-expanded", open ? "true" : "false");
      }
      return;
    }
    /* Photo finishing, not generation: the editor opens on exactly the image
       the canvas is showing and never starts a redesign or spends a credit. */
    if (t.closest("#rdwEditPhotoTool")) {
      if (b.classList.contains("editing-photo")) closeCanvasPhotoEditor();
      else void openCanvasPhotoEditor();
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
    if (t.closest("#fTool .toolrow:not(.rdw-phototool)") || t.closest("#spChips .chip")) {
      /* Switching tools is a Canvas state change, never navigation. */
      if (b.classList.contains("editing-photo")) closeCanvasPhotoEditor();

      /* the app script owns the state change; repaint after it settles */
      setTimeout(() => {
        paintPanelHeader();
        paintRoomCards();
      }, 0);
    }
  });

  document.addEventListener("rdpe:closed", () => setCanvasTool(null));

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
