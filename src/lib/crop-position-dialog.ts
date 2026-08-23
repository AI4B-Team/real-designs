/**
 * Reposition a photo inside its Image Format frame.
 *
 * A fixed format crops, so the user always sees exactly what will be
 * generated and can drag and zoom until the framing is right. The frame is
 * never allowed to show empty space.
 */
/* eslint-disable */
// @ts-nocheck
import { escapeHtml as esc } from "@/lib/safe-html";

import { createIcons, icons } from "lucide";
import { clampCrop, normalizeCrop, ratioValue, DEFAULT_CROP, MAX_CROP_SCALE } from "@/lib/photo-crop";
import { ratioLabel } from "@/lib/output-ratio";
import { modalFooterHtml } from "@/lib/modal-footer";


/**
 * photos: [{ key, name, url, ratio, crop }]
 * onSave(key, crop) is called for every photo whose placement changed.
 */
export function openCropDialog(photos, onSave) {
  if (typeof document === "undefined") return;
  const list = (photos || []).filter((p) => p && p.url && ratioValue(p.ratio));
  if (!list.length) return;
  let i = 0;
  const crops = list.map((p) => normalizeCrop(p.crop));

  const wrap = document.createElement("div");
  wrap.className = "bx-cdlg rdc-dlg";
  wrap.innerHTML = `<div class="bx-cdlg-in rdc-in" role="dialog" aria-modal="true" aria-label="Reposition Photo">
    <div class="rdc-head">
      <h3>Reposition Photo</h3>
      <p class="rdc-sub"></p>
    </div>
    <div class="rdc-work">
      <div class="rdc-stage"><div class="rdc-frame"><img alt="" draggable="false"><div class="rdc-guides" aria-hidden="true"></div></div></div>
    </div>
    <div class="rdc-controls">
      <div class="rdc-ctl">
        <label><span>Zoom</span><input type="range" min="1" max="${MAX_CROP_SCALE}" step="0.01" value="1" data-rdczoom></label>
        <button type="button" class="btn btn-ghost btn-sm" data-rdcreset><i data-lucide="rotate-ccw"></i>Reset Position</button>
      </div>
      <div class="rdc-nav">
        <button type="button" class="btn btn-ghost btn-sm" data-rdcprev><i data-lucide="chevron-left"></i>Previous</button>
        <span class="rdc-count"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-rdcnext>Next<i data-lucide="chevron-right"></i></button>
      </div>
    </div>
    ${modalFooterHtml({ primary: { label: "Done", value: "done" }, secondary: { label: "Cancel", value: "cancel" } })}
  </div>`;
  document.body.appendChild(wrap);

  const frame = wrap.querySelector(".rdc-frame");
  const img = wrap.querySelector(".rdc-frame img");
  const zoom = wrap.querySelector("[data-rdczoom]");
  const sub = wrap.querySelector(".rdc-sub");
  const count = wrap.querySelector(".rdc-count");

  const srcRatio = () => (img.naturalWidth || 4) / (img.naturalHeight || 3);
  const frameRatio = () => ratioValue(list[i].ratio) || 1;

  function apply() {
    const c = (crops[i] = clampCrop(crops[i], srcRatio(), frameRatio()));
    img.style.objectFit = "cover";
    img.style.objectPosition = `${(c.x * 100).toFixed(2)}% ${(c.y * 100).toFixed(2)}%`;
    img.style.transform = `scale(${c.scale.toFixed(3)})`;
    zoom.value = String(c.scale);
  }

  function show() {
    const p = list[i];
    frame.style.aspectRatio = String(p.ratio).replace(":", " / ");
    frame.style.setProperty("--rdc-ar", String(ratioValue(p.ratio) || 1));
    img.src = p.url;
    img.alt = p.name || "Photo";
    sub.textContent = `${p.name || "Photo"} · ${ratioLabel(p.ratio)}`;
    count.textContent = `${i + 1} of ${list.length}`;
    wrap.querySelector("[data-rdcprev]").disabled = i === 0;
    wrap.querySelector("[data-rdcnext]").disabled = i === list.length - 1;
    apply();
  }

  img.addEventListener("load", apply);

  /* Dragging moves the focal point; one frame width equals the full range. */
  let drag = null;
  frame.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, c: { ...crops[i] } };
    frame.setPointerCapture?.(e.pointerId);
  });
  frame.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = frame.getBoundingClientRect();
    crops[i] = clampCrop(
      {
        ...drag.c,
        x: drag.c.x - (e.clientX - drag.x) / Math.max(1, r.width),
        y: drag.c.y - (e.clientY - drag.y) / Math.max(1, r.height),
      },
      srcRatio(),
      frameRatio(),
    );
    apply();
  });
  const endDrag = () => (drag = null);
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);
  frame.addEventListener("pointerleave", endDrag);

  zoom.oninput = () => {
    crops[i] = clampCrop({ ...crops[i], scale: Number(zoom.value) }, srcRatio(), frameRatio());
    apply();
  };
  wrap.querySelector("[data-rdcreset]").onclick = () => {
    crops[i] = { ...DEFAULT_CROP };
    apply();
  };
  wrap.querySelector("[data-rdcprev]").onclick = () => {
    if (i > 0) {
      i--;
      show();
    }
  };
  wrap.querySelector("[data-rdcnext]").onclick = () => {
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
    if (value === "done") list.forEach((p, n) => onSave && onSave(p.key, crops[n]));
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
