/**
 * Reposition a photo inside its Image Format frame.
 *
 * The frame is fixed and the photograph moves beneath it, so the user always
 * sees exactly what will be generated and empty space is impossible. Every
 * number here comes from the canonical crop model — nothing is measured in
 * rendered pixels, so the result survives a resize, a browser zoom level and
 * a refresh.
 */
/* eslint-disable */
// @ts-nocheck
import { escapeHtml as esc } from "@/lib/safe-html";

import { createIcons, icons } from "lucide";
import {
  MAX_CROP_ZOOM,
  MIN_CROP_ZOOM,
  KEY_PAN_STEP,
  KEY_ZOOM_STEP,
  clampCropModel,
  cropModelCss,
  normalizeCropModel,
  panCropBy,
  ratioAspect,
  resetCropModel,
  commitCrop,
  withSourceSize,
  wheelZoom,
  zoomCropBy,
  zoomCropTo,
} from "@/lib/crop-model";
import { ratioLabel } from "@/lib/output-ratio";
import { modalFooterHtml } from "@/lib/modal-footer";

/**
 * photos: [{ key, name, url, ratio, crop }]
 * onSave(key, crop) is called for every photo whose placement changed.
 * Cancel discards everything; Done commits the current crop revision.
 */
export function openCropDialog(photos, onSave) {
  if (typeof document === "undefined") return;
  const list = (photos || []).filter((p) => p && p.url && ratioAspect(p.ratio));
  if (!list.length) return;
  let i = 0;
  /* Edits live on a working copy so Cancel really discards. */
  const crops = list.map((p) => normalizeCropModel(p.crop, { ratio: String(p.ratio) }));
  const many = list.length > 1;

  const wrap = document.createElement("div");
  wrap.className = "bx-cdlg rdc-dlg";
  wrap.innerHTML = `<div class="bx-cdlg-in rdc-in" role="dialog" aria-modal="true" aria-label="Reposition Photo">
    <div class="rdc-head">
      <h3>Reposition Photo</h3>
      <p class="rdc-sub"></p>
    </div>
    <div class="rdc-work">
      <div class="rdc-stage"><div class="rdc-frame" tabindex="0" role="application"
        aria-label="Drag to reposition. Arrow keys move, plus and minus zoom."
        style="cursor:grab;touch-action:none"><img alt="" draggable="false"><div class="rdc-guides" aria-hidden="true"></div></div></div>
    </div>
    <div class="rdc-controls">
      <div class="rdc-ctl">
        <label><span>Zoom</span>
          <button type="button" class="btn btn-ghost btn-sm" data-rdczout aria-label="Zoom Out"><i data-lucide="minus"></i></button>
          <input type="range" min="${MIN_CROP_ZOOM}" max="${MAX_CROP_ZOOM}" step="0.01" value="1" data-rdczoom aria-label="Zoom">
          <button type="button" class="btn btn-ghost btn-sm" data-rdczin aria-label="Zoom In"><i data-lucide="plus"></i></button>
          <output class="rdc-zval" data-rdczval aria-live="polite">100%</output>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" data-rdcreset><i data-lucide="rotate-ccw"></i>Reset Position</button>
      </div>
      ${
        many
          ? `<div class="rdc-nav">
        <button type="button" class="btn btn-ghost btn-sm" data-rdcprev><i data-lucide="chevron-left"></i>Previous</button>
        <span class="rdc-count"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-rdcnext>Next<i data-lucide="chevron-right"></i></button>
      </div>`
          : ""
      }
    </div>
    ${modalFooterHtml({ primary: { label: "Done", value: "done" }, secondary: { label: "Cancel", value: "cancel" } })}
  </div>`;
  document.body.appendChild(wrap);

  /* The dialog never grows past the viewport, so its footer and source
     controls can't be pushed off screen on a short window. */
  const inner = wrap.querySelector(".rdc-in");
  if (inner) {
    inner.style.maxHeight = "min(92vh, 900px)";
    inner.style.maxWidth = "min(96vw, 880px)";
    inner.style.overflow = "auto";
  }

  const frame = wrap.querySelector(".rdc-frame");
  const img = wrap.querySelector(".rdc-frame img");
  const zoom = wrap.querySelector("[data-rdczoom]");
  const zval = wrap.querySelector("[data-rdczval]");
  const sub = wrap.querySelector(".rdc-sub");
  const count = wrap.querySelector(".rdc-count");

  const aspect = () => ratioAspect(list[i].ratio) || 1;

  function apply() {
    const c = (crops[i] = clampCropModel(crops[i], aspect()));
    img.setAttribute("style", cropModelCss(c));
    zoom.value = String(c.zoom);
    if (zval) zval.textContent = `${Math.round(c.zoom * 100)}%`;
  }

  function edit(next) {
    crops[i] = clampCropModel(next, aspect());
    apply();
  }

  function show() {
    const p = list[i];
    frame.style.aspectRatio = String(p.ratio).replace(":", " / ");
    frame.style.setProperty("--rdc-ar", String(ratioAspect(p.ratio) || 1));
    img.src = p.url;
    img.alt = p.name || "Photo";
    sub.textContent = `${p.name || "Photo"} · ${ratioLabel(p.ratio)}`;
    if (count) count.textContent = `${i + 1} of ${list.length}`;
    const prev = wrap.querySelector("[data-rdcprev]");
    const next = wrap.querySelector("[data-rdcnext]");
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === list.length - 1;
    apply();
  }

  /* The natural size makes the model resolution independent. */
  img.addEventListener("load", () => {
    crops[i] = withSourceSize(crops[i], img.naturalWidth, img.naturalHeight);
    apply();
  });

  /* Dragging moves the photograph beneath the frame; pointer capture keeps the
     gesture alive outside the frame, and touch-action:none stops the page from
     scrolling under a finger drag. */
  let drag = null;
  frame.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, c: crops[i] };
    frame.style.cursor = "grabbing";
    frame.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  frame.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = frame.getBoundingClientRect();
    edit(
      panCropBy(
        drag.c,
        -(e.clientX - drag.x) / Math.max(1, r.width),
        -(e.clientY - drag.y) / Math.max(1, r.height),
        aspect(),
      ),
    );
  });
  const endDrag = (e) => {
    if (!drag) return;
    drag = null;
    frame.style.cursor = "grab";
    frame.releasePointerCapture?.(e?.pointerId);
  };
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);

  /* Wheel and trackpad pinch: bounded, magnitude aware, and the page behind
     the dialog never scrolls. */
  frame.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      edit(wheelZoom(crops[i], e.deltaY, e.deltaMode, aspect()));
    },
    { passive: false },
  );

  /* Keyboard is a first-class alternative to dragging. */
  frame.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? KEY_PAN_STEP * 4 : KEY_PAN_STEP;
    const map = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (map[e.key]) {
      e.preventDefault();
      edit(panCropBy(crops[i], map[e.key][0], map[e.key][1], aspect()));
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      edit(zoomCropBy(crops[i], 1 + KEY_ZOOM_STEP, aspect()));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      edit(zoomCropBy(crops[i], 1 / (1 + KEY_ZOOM_STEP), aspect()));
    } else if (e.key === "0") {
      e.preventDefault();
      edit(resetCropModel(crops[i]));
    }
  });

  zoom.oninput = () => edit(zoomCropTo(crops[i], Number(zoom.value), aspect()));
  wrap.querySelector("[data-rdczin]").onclick = () =>
    edit(zoomCropBy(crops[i], 1 + KEY_ZOOM_STEP, aspect()));
  wrap.querySelector("[data-rdczout]").onclick = () =>
    edit(zoomCropBy(crops[i], 1 / (1 + KEY_ZOOM_STEP), aspect()));
  wrap.querySelector("[data-rdcreset]").onclick = () => edit(resetCropModel(crops[i]));
  const prevBtn = wrap.querySelector("[data-rdcprev]");
  const nextBtn = wrap.querySelector("[data-rdcnext]");
  if (prevBtn)
    prevBtn.onclick = () => {
      if (i > 0) {
        i--;
        show();
      }
    };
  if (nextBtn)
    nextBtn.onclick = () => {
      if (i < list.length - 1) {
        i++;
        show();
      }
    };

  const close = () => wrap.remove();
  wrap.addEventListener("click", (e) => {
    const act = e.target.closest("[data-mfa]");
    if (!act && e.target !== wrap) return;
    const value = act ? act.getAttribute("data-mfa") : "cancel";
    /* Done commits one revision per photo; Cancel writes nothing at all. */
    if (value === "done")
      list.forEach((p, n) => onSave && onSave(p.key, commitCrop(crops[n], ratioAspect(p.ratio))));
    close();
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  try {
    createIcons({ icons });
  } catch (_) {}
  show();
  return wrap;
}
