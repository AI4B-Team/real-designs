/**
 * Automatic room selection for the Canvas settings panel.
 *
 * The user should never have to tell REAL DESIGNS what kind of space they
 * uploaded. Priority:
 *   1. A room carried over from the photo/import flow (already mirrored onto
 *      #fRoom by the staging handoff) — nothing else runs.
 *   2. Otherwise the source image is classified once and, when the guess is
 *      confident, the matching space chip and room are pre-selected.
 *
 * A manual pick is final: once the user chooses a room themselves, detection
 * never overwrites it, not even after the source photo changes.
 */

import { classifyPhotoRooms } from "@/lib/photo-classify.functions";
import { ACCEPT_CONFIDENCE } from "@/lib/photo-classify";
import { roomFromCategory, roomSpace } from "@/lib/staging-rooms";

let manual = false;
let running = false;
let lastSrc = "";

/** Called when the user picks a room by hand; detection stands down. */
export function markManualRoom() {
  manual = true;
}

function roomSelect(): HTMLSelectElement | null {
  return document.getElementById("fRoom") as HTMLSelectElement | null;
}

function sourceImage(): HTMLImageElement | null {
  return document.querySelector("#cBefore img") as HTMLImageElement | null;
}

/** Downscale to keep the request small; never sends the original upload. */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch (_) {
    /* detection is advisory: a source we cannot read simply stays unlabeled */
    return null;
  }
}

function applyRoom(label: string) {
  const space = roomSpace(label);
  const chip = document.querySelector(
    '#spChips .chip[data-sp="' + space + '"]',
  ) as HTMLElement | null;
  if (chip && !chip.classList.contains("on")) chip.click();
  const sel = roomSelect();
  if (!sel) return;
  if (!Array.from(sel.options).some((o) => o.value === label || o.text === label)) {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
  }
  sel.value = label;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    (window as any).rdwRefresh?.();
  } catch (_) {
    /* the panel repaints on its own next tick */
  }
}

/** One detection pass for the current source photo. */
export async function detectRoomFromSource() {
  if (manual || running) return;
  const sel = roomSelect();
  if (!sel) return;
  /* Anything already known — carried over or previously detected — wins. */
  if ((sel.value || "").trim()) return;
  const img = sourceImage();
  const src = img?.currentSrc || img?.src || "";
  if (!src || src === lastSrc) return;
  lastSrc = src;
  running = true;
  try {
    const dataUrl = await toDataUrl(src);
    if (!dataUrl) return;
    if (manual || (roomSelect()?.value || "").trim()) return;
    const out = await classifyPhotoRooms({ data: { images: [{ id: "source", image: dataUrl }] } });
    const guess = out?.results?.[0];
    if (!guess || guess.confidence < ACCEPT_CONFIDENCE) return;
    const room = roomFromCategory(guess.label);
    if (!room) return;
    if (manual || (roomSelect()?.value || "").trim()) return;
    applyRoom(room.label);
  } catch (_) {
    /* the user can always pick a room manually */
  } finally {
    running = false;
  }
}

/** Watch the canvas source and detect whenever a new photo appears. */
export function initAutoRoom() {
  const before = document.getElementById("cBefore");
  if (!before || (before as any).__rdAuto) return;
  (before as any).__rdAuto = true;
  let timer: any = null;
  const kick = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void detectRoomFromSource(), 400);
  };
  new MutationObserver(kick).observe(before, { childList: true, subtree: true });
  kick();
}
