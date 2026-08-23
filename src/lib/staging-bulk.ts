/**
 * Bulk design engine for the Photo Design workflow.
 *
 * Setup lives in the inline Design and Review steps (see staging-design.ts):
 * this module only runs the batch.
 *
 * A bulk run is one shared direction applied to several photos. It is NOT a
 * single render copied across rooms: every photo is its own render, with its
 * own room type, so the model adapts the same direction to a Kitchen and a
 * Bedroom correctly. Each photo is charged individually (1 design credit),
 * each failure is isolated and retryable, and nothing is charged for a photo
 * that never ran.
 */
/* eslint-disable */
// @ts-nocheck
import { renderDesign } from "@/lib/design-render.functions";
import { clampCrop, ratioValue } from "@/lib/photo-crop";
import { effectiveRatio } from "@/lib/output-ratio";
import { uploadRenderDataUrl, roomPhotoUrl } from "@/lib/room-photos";
import { roomSpace } from "@/lib/staging-rooms";
import { STYLES } from "@/lib/style-catalog";


const SPACE_LABEL = {
  interior: "Interior",
  exterior: "Exterior",
  landscape: "Garden",
  unassigned: "Unassigned",
};
const PROJECT_TYPE = { interior: "interior", exterior: "exterior", landscape: "garden" };

export const BULK_CREDIT_PER_PHOTO = 1;

/**
 * Groups photos by space type so incompatible spaces are never mixed silently.
 * A photo with no confirmed room type is NOT assumed to be an interior: it
 * lands in its own "Room type needed" group so the label can never contradict
 * the thumbnails underneath it.
 */
export function groupBySpace(items) {
  const out = new Map();
  items.forEach((it) => {
    const s = it.room ? roomSpace(it.room) : "unassigned";
    if (!out.has(s)) out.set(s, []);
    out.get(s).push(it);
  });
  return Array.from(out.entries()).map(([space, list]) => ({
    space,
    label: space === "unassigned" ? "Room type needed" : SPACE_LABEL[space] || "Interior",
    items: list,
  }));
}

/**
 * Three-level style guidance.
 *
 * "compatible"  — the style adapts cleanly to that space.
 * "unusual"     — technically possible, just an unconventional look. Advisory
 *                 only: the user keeps creative control.
 * "unsupported" — the operation itself cannot run on that space (a landscaping
 *                 style has no ground plane indoors, an empty-room staging
 *                 style has no room to stage on a facade).
 */
export function styleCompatibility(styleId, space) {
  if (!space || space === "unassigned") return "compatible";
  const rec = STYLES.find((s) => s.id === styleId);
  if (!rec) return "compatible";
  const types = (rec.compatibleProjectTypes || []).filter((t) => t !== "concept");
  const want = PROJECT_TYPE[space] || "interior";
  const only = (t) => types.every((x) => x === t);
  /* Operation-bound styles: genuinely impossible, not merely unusual. */
  if (types.length && only("garden") && want !== "garden") return "unsupported";
  if (types.length && only("virtual-staging") && want !== "interior") return "unsupported";
  /* Advisories only exist where the catalog declares them. A style that is
     simply catalogued for interiors still adapts to an exterior through its
     materials and palette, so it earns no warning. */
  if ((rec.uncommonProjectTypes || []).indexOf(want) !== -1) return "unusual";
  return "compatible";
}

/** Only a genuine technical limitation blocks a run. */
export function styleFitsSpace(styleId, space) {
  return styleCompatibility(styleId, space) !== "unsupported";
}

/** Styles that can carry a given space, for the per-group fallback picker. */
export function stylesForSpace(space) {
  return STYLES.filter((s) => s.isActive !== false && styleFitsSpace(s.id, space));
}



/** Downscaled data URL for the render call. */
async function toDataUrl(src, max = 1100) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read that photo."));
    i.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
  const c = document.createElement("canvas");
  c.width = Math.round((img.naturalWidth || max) * scale);
  c.height = Math.round((img.naturalHeight || max) * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/**
 * Bake the chosen Image Format and focal point into the pixels we send, so
 * the generated design matches the framing previewed on the card exactly.
 */
async function cropToRatio(dataUrl, ratio, crop) {
  const frame = ratioValue(ratio);
  if (!frame) return dataUrl;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read that photo."));
    i.src = dataUrl;
  });
  const sw = img.naturalWidth || 1;
  const sh = img.naturalHeight || 1;
  const c = clampCrop(crop, sw / sh, frame);
  /* The visible slice of the source, at the requested zoom. */
  const cover = Math.max(frame / (sw / sh), 1) && sw / sh > frame ? sh : sw / frame;
  const baseH = sw / sh > frame ? sh : sw / frame;
  const baseW = baseH * frame;
  const w = baseW / c.scale;
  const h = baseH / c.scale;
  const x = Math.max(0, Math.min(sw - w, c.x * sw - w / 2));
  const y = Math.max(0, Math.min(sh - h, c.y * sh - h / 2));
  const out = document.createElement("canvas");
  out.width = Math.round(w);
  out.height = Math.round(h);
  out.getContext("2d").drawImage(img, x, y, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.92);
}

async function sourceUrl(it) {
  if (it.signed) return it.signed;
  if (it.path) {
    try {
      const u = await roomPhotoUrl(it.path);
      if (u) return u;
    } catch (_) {}
  }
  return it.previewUrl;
}

/**
 * Runs a bulk batch. Each photo is independent: a failure never stops the
 * batch, and a photo already marked complete is skipped on a retry.
 */
export async function runBulkDesign(items, direction, hooks = {}) {
  const queue = items.filter((i) => i.state !== "complete");
  let done = 0;
  const total = queue.length;
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift();
      it.state = "generating";
      it.err = "";
      hooks.onUpdate && hooks.onUpdate(it);
      try {
        /* Project default unless this photo carries its own override. */
        const ratio = effectiveRatio(direction.outputRatio, it.ratio);
        const image = await cropToRatio(await toDataUrl(await sourceUrl(it)), ratio, it.crop);
        const space = it.room ? roomSpace(it.room) : "interior";
        /* A space the shared style cannot carry uses the style the user picked
           for that group, so an exterior never gets an interior-only look. */
        const perSpace = (direction.styleBySpace || {})[space];
        /* A photo may override its group style; the override always wins. */
        const perPhoto = (direction.styleByPhoto || {})[it.key];
        const note =
          ((direction.notesByPhoto || {})[it.key] || "").trim() || direction.notes || null;
        const r = await renderDesign({
          data: {
            image,
            room_type: it.room || "living room",
            direction: (perPhoto && perPhoto.name) || (perSpace && perSpace.name) || direction.direction,
            style_id: (perPhoto && perPhoto.id) || (perSpace && perSpace.id) || direction.styleId || null,
            project_type: PROJECT_TYPE[space] || "interior",
            intensity: direction.intensity,
            grade: direction.grade,
            notes: note,
            preserve_architecture: direction.preserve !== false,
            aspect_ratio: ratio,
          },
        });
        let path = null;
        try {
          path = await uploadRenderDataUrl(r.image);
        } catch (_) {}
        it.resultPath = path;
        it.resultRatio = ratio;
        it.resultUrl = r.image;
        it.state = "complete";
        it.done = true;
      } catch (e) {
        it.state = "failed";
        it.err = (e && e.message) || "That design did not render.";
      }
      done++;
      hooks.onUpdate && hooks.onUpdate(it);
      hooks.onProgress && hooks.onProgress(done, total);
    }
  };
  await Promise.all([worker(), worker()]);
  hooks.onDone && hooks.onDone(items);
  try {
    window.dispatchEvent(new Event("rd:credits-changed"));
  } catch (_) {}
  return items;
}
