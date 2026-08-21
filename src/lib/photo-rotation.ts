/**
 * Non-destructive photo rotation.
 *
 * A rotation is metadata on the project's reference to a photo: the stored
 * media file is never re-uploaded, never duplicated and never replaced. The
 * preview rotates with a transform, and the corrected orientation is baked in
 * only at the moment a rotated pixel buffer is actually needed — generation,
 * download or a video handoff.
 *
 * EXIF orientation is corrected on the way in (see bakeExifOrientation) so a
 * "rotate" click always means the same thing on every device.
 */
/* eslint-disable */
// @ts-nocheck

export const ROTATION_STEPS = [0, 90, 180, 270];

/** Any stored value folds onto one of the four quarter turns. */
export function normalizeRotation(v) {
  const n = Math.round(Number(v) || 0);
  const q = ((Math.round(n / 90) % 4) + 4) % 4;
  return q * 90;
}

export function nextRotation(v) {
  return normalizeRotation(normalizeRotation(v) + 90);
}

export function rotationLabel(v) {
  const d = normalizeRotation(v);
  return d ? d + "°" : "";
}

/**
 * Rotate one preview image inside its frame. A quarter turn swaps the axes, so
 * the element is sized to the frame's opposite dimension and pivoted from its
 * centre — the photo keeps filling the card instead of leaving gutters.
 */
export function applyRotationTo(img) {
  if (!img || !img.parentElement) return;
  const deg = normalizeRotation(img.getAttribute("data-rot"));
  const box = img.parentElement;
  if (!deg) {
    img.style.position = "";
    img.style.left = "";
    img.style.top = "";
    img.style.width = "";
    img.style.height = "";
    img.style.transform = "";
    return;
  }
  if (deg === 180) {
    img.style.position = "";
    img.style.left = "";
    img.style.top = "";
    img.style.width = "";
    img.style.height = "";
    img.style.transform = "rotate(180deg)";
    return;
  }
  const w = box.clientWidth || 0;
  const h = box.clientHeight || 0;
  if (!w || !h) return;
  img.style.position = "absolute";
  img.style.left = "50%";
  img.style.top = "50%";
  img.style.width = h + "px";
  img.style.height = w + "px";
  img.style.transform = "translate(-50%, -50%) rotate(" + deg + "deg)";
}

let rotationResizeBound = false;

/** Apply every stored rotation in a subtree, and keep them correct on resize. */
export function mountRotations(root) {
  if (!root || typeof document === "undefined") return;
  const run = () =>
    root.querySelectorAll?.("img[data-rot]").forEach((img) => applyRotationTo(img));
  run();
  /* The frame is measured, so images that arrive later re-apply on load. */
  root.querySelectorAll?.("img[data-rot]").forEach((img) => {
    if (img.__rdRotBound) return;
    img.__rdRotBound = true;
    img.addEventListener("load", () => applyRotationTo(img));
  });
  if (!rotationResizeBound && typeof window !== "undefined") {
    rotationResizeBound = true;
    window.addEventListener("resize", () => {
      document.querySelectorAll("img[data-rot]").forEach((img) => applyRotationTo(img));
    });
  }
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read that photo."));
    i.src = src;
  });
}

/** Draw a source image onto a canvas with a quarter turn applied. */
export function rotateToCanvas(img, deg, max = 0) {
  const d = normalizeRotation(deg);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = max ? Math.min(1, max / Math.max(iw, ih)) : 1;
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const c = document.createElement("canvas");
  c.width = d === 90 || d === 270 ? h : w;
  c.height = d === 90 || d === 270 ? w : h;
  const ctx = c.getContext("2d");
  ctx.translate(c.width / 2, c.height / 2);
  if (d) ctx.rotate((d * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

/** A rotated copy of a displayable URL, as a JPEG data URL. Quality preserved
    unless a max edge is requested by the caller. */
export async function rotatedDataUrl(url, deg, max = 0, quality = 0.95) {
  const d = normalizeRotation(deg);
  const img = await loadImage(url);
  if (!d && !max) return url;
  return rotateToCanvas(img, d, max).toDataURL("image/jpeg", quality);
}

/** A rotated copy as an object URL, for downloads and exports. */
export async function rotatedBlobUrl(url, deg) {
  const d = normalizeRotation(deg);
  if (!d) return url;
  const img = await loadImage(url);
  const canvas = rotateToCanvas(img, d);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
  return blob ? URL.createObjectURL(blob) : url;
}

/**
 * Bake EXIF orientation into the pixels once, on intake. Browsers disagree on
 * whether a decoded <img> honours EXIF, so correcting here means every later
 * rotation, crop and render agrees about which way is up.
 */
export async function bakeExifOrientation(file) {
  if (!file || typeof createImageBitmap !== "function") return file;
  if (!/^image\/(jpeg|jpg|tiff)$/i.test(file.type || "")) return file;
  try {
    const raw = await createImageBitmap(file);
    const fixed = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    /* Orientation 1: nothing to correct, so the original file is kept intact. */
    if (raw.width === fixed.width && raw.height === fixed.height) {
      raw.close?.();
      fixed.close?.();
      return file;
    }
    const c = document.createElement("canvas");
    c.width = fixed.width;
    c.height = fixed.height;
    c.getContext("2d").drawImage(fixed, 0, 0);
    raw.close?.();
    fixed.close?.();
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.95));
    if (!blob) return file;
    return new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
  } catch (_) {
    return file;
  }
}
