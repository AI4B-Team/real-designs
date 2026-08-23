/**
 * The Image Format control for the Photos step.
 *
 * Image Format is the aspect ratio a design is generated at. It is chosen
 * here — visibly, before the grid — never invented later by Review. Original
 * is the canonical default; anything else can crop a photo, so the control
 * says so and offers per-photo positioning.
 */
/* eslint-disable */
// @ts-nocheck

import {
  IMAGE_FORMAT_CARDS,
  OUTPUT_RATIOS,
  isPrimaryRatio,
  normalizeOutputRatio,
  normalizeOverride,
  ratioLabel,
  effectiveRatio,
} from "@/lib/output-ratio";
import { isCustomCrop } from "@/lib/photo-crop";
import { escapeHtml as esc } from "@/lib/safe-html";


export const CROP_WARNING =
  "This format may crop parts of your photos. You can reposition each photo before generation.";

const shapeStyle = (id) =>
  id === "original"
    ? "width:26px;height:20px"
    : (() => {
        const [w, h] = String(id).split(":").map(Number);
        const long = 24;
        const ww = w >= h ? long : Math.round((long * w) / h);
        const hh = h >= w ? long : Math.round((long * h) / w);
        return `width:${ww}px;height:${hh}px`;
      })();

/** Every card is one radio in the same group, and every card is the same box. */
function cardHtml(o, value) {
  const on = o.id === value;
  return `<button type="button" class="rif-card${on ? " on" : ""}" role="radio" data-ratio="${esc(o.id)}"
    aria-checked="${on ? "true" : "false"}" aria-pressed="${on ? "true" : "false"}" tabindex="${on ? "0" : "-1"}">
    <span class="rif-shape"><i style="${shapeStyle(o.id)}"></i></span>
    <span class="rif-t"><b>${esc(o.label)}</b><em>${esc(o.note || (o.id === "original" ? "Keep Current Shape" : o.id))}</em></span>
    <span class="rif-ck" aria-hidden="true">${on ? '<i data-lucide="check"></i>' : ""}</span>
  </button>`;
}

/** One photo row inside "Customize Per Photo". */
function perPhotoRow(it, project) {
  const override = normalizeOverride(it.ratio);
  const eff = effectiveRatio(project, it.ratio);
  const custom = isCustomCrop(it.crop);
  return `<div class="rif-row" data-fmtrow="${esc(it.key)}">
    <span class="rif-row-n">${esc(it.label || it.room || "Photo")}</span>
    <label class="rif-row-s"><span class="sr-only">Image Format For ${esc(it.label || "Photo")}</span>
      <select data-photoratio="${esc(it.key)}">
        <option value=""${override ? "" : " selected"}>Group Image Format · ${esc(ratioLabel(project))}</option>
        ${OUTPUT_RATIOS.map(
          (o) =>
            `<option value="${esc(o.id)}"${override === o.id ? " selected" : ""}>${esc(ratioLabel(o.id))}</option>`,
        ).join("")}
      </select>
    </label>
    ${override ? '<span class="rif-row-b">Override</span>' : ""}
    ${
      eff === "original"
        ? '<span class="rif-row-q">No Cropping</span>'
        : `<button type="button" class="btn btn-ghost btn-sm" data-photocrop="${esc(it.key)}"><i data-lucide="move"></i>${custom ? "Custom Position" : "Reposition"}</button>`
    }
  </div>`;
}

/** "Review Crop Position" for one photo, "Review 4 Crop Positions" for many. */
export function cropReviewLabel(count) {
  const n = Number(count) || 0;
  return n <= 1 ? "Review Crop Position" : `Review ${n} Crop Positions`;
}

/**
 * ctx: { value, items, id, selected }
 */
export function imageFormatSectionHtml(ctx = {}) {
  const value = normalizeOutputRatio(ctx.value);
  const items = ctx.items || [];
  const selected = Number(ctx.selected) || items.length;
  const fixed = value !== "original" || items.some((i) => normalizeOverride(i.ratio) && i.ratio !== "original");
  const cards = IMAGE_FORMAT_CARDS.map((o) => cardHtml(o, value)).join("");
  const customCard = isPrimaryRatio(value)
    ? ""
    : `<button type="button" class="rif-card on" role="radio" data-ratiomore aria-checked="true" aria-pressed="true">
        <span class="rif-shape"><i style="${shapeStyle(value)}"></i></span>
        <span class="rif-t"><b>Custom</b><em>${esc(ratioLabel(value))}</em></span>
        <span class="rif-ck" aria-hidden="true"><i data-lucide="check"></i></span>
      </button>`;
  return `<section class="rif" id="rdsFormat" tabindex="-1" aria-labelledby="rifLbl">
    <div class="rif-h">
      <h3 id="rifLbl">Image Format</h3>
      <p>The shape every design is generated at. Original keeps each photo exactly as shot.</p>
    </div>
    <div class="rif-cards" role="radiogroup" aria-labelledby="rifLbl">
      ${cards}${customCard}
      <button type="button" class="rif-card rif-more" data-ratiomore>
        <span class="rif-shape"><i data-lucide="frame"></i></span>
        <span class="rif-t"><b>More Formats</b><em>4:3, 3:2, 4:5 And More</em></span>
        <span class="rif-ck" aria-hidden="true"></span>
      </button>
    </div>
    ${
      fixed
        ? `<p class="rif-warn"><i data-lucide="crop"></i><span>${CROP_WARNING}</span>
           <button type="button" class="btn btn-secondary btn-sm rif-cropall" data-cropall><i data-lucide="move"></i>${esc(cropReviewLabel(selected))}</button></p>`
        : ""
    }
    <details class="rif-per"${ctx.open ? " open" : ""}>
      <summary>Customize Per Photo</summary>
      <div class="rif-rows">${items.map((i) => perPhotoRow(i, value)).join("")}</div>
    </details>
  </section>`;
}

/**
 * ctx: { onRatio, onMore, onPhotoRatio, onCrop, onCropAll }
 */
export function bindImageFormat(root, ctx = {}) {
  const sec = root.querySelector("#rdsFormat");
  if (!sec) return;
  sec.querySelectorAll("[data-ratio]").forEach((b) =>
    b.addEventListener("click", () => ctx.onRatio && ctx.onRatio(b.getAttribute("data-ratio"))),
  );
  sec.querySelectorAll("[data-ratiomore]").forEach((b) =>
    b.addEventListener("click", () => ctx.onMore && ctx.onMore()),
  );
  sec.querySelectorAll("[data-photoratio]").forEach((s) => {
    s.onchange = () =>
      ctx.onPhotoRatio && ctx.onPhotoRatio(s.getAttribute("data-photoratio"), s.value || null);
  });
  sec.querySelectorAll("[data-photocrop]").forEach((b) =>
    b.addEventListener("click", () => ctx.onCrop && ctx.onCrop(b.getAttribute("data-photocrop"))),
  );
  const all = sec.querySelector("[data-cropall]");
  if (all) all.onclick = () => ctx.onCropAll && ctx.onCropAll();
}

/** Focus and highlight the section — used by Review's Edit action. */
export function focusImageFormat(root) {
  const sec = (root || document).querySelector("#rdsFormat");
  if (!sec) return false;
  try {
    sec.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (_) {}
  sec.classList.add("rif-flash");
  setTimeout(() => sec.classList.remove("rif-flash"), 1600);
  const btn = sec.querySelector(".rif-card.on") || sec.querySelector(".rif-card");
  if (btn && btn.focus) btn.focus({ preventScroll: true });
  return true;
}
