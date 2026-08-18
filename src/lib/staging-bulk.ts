/**
 * Bulk design for the Photo Staging grid.
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
import { createIcons, icons } from "lucide";
import { renderDesign } from "@/lib/design-render.functions";
import { effectiveRatio } from "@/lib/output-ratio";
import { uploadRenderDataUrl, roomPhotoUrl } from "@/lib/room-photos";
import { roomSpace } from "@/lib/staging-rooms";
import { STYLES } from "@/lib/style-catalog";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};

const SPACE_LABEL = { interior: "Interior", exterior: "Exterior", landscape: "Garden" };
const PROJECT_TYPE = { interior: "interior", exterior: "exterior", landscape: "garden" };

export const BULK_CREDIT_PER_PHOTO = 1;

/** Groups photos by space type so incompatible spaces are never mixed silently. */
export function groupBySpace(items) {
  const out = new Map();
  items.forEach((it) => {
    const s = it.room ? roomSpace(it.room) : "interior";
    if (!out.has(s)) out.set(s, []);
    out.get(s).push(it);
  });
  return Array.from(out.entries()).map(([space, list]) => ({
    space,
    label: SPACE_LABEL[space] || "Interior",
    items: list,
  }));
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
        const image = await toDataUrl(await sourceUrl(it));
        /* Project default unless this photo carries its own override. */
        const ratio = effectiveRatio(direction.outputRatio, it.ratio);
        const r = await renderDesign({
          data: {
            image,
            room_type: it.room || "living room",
            direction: direction.direction,
            style_id: direction.styleId || null,
            project_type: PROJECT_TYPE[it.room ? roomSpace(it.room) : "interior"] || "interior",
            intensity: direction.intensity,
            grade: direction.grade,
            notes: direction.notes || null,
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

/* ----------------------------------------------------------------- modal */

function styleOptions() {
  return STYLES.map((s) => `<option value="${esc(s.id)}">${esc(s.displayName)}</option>`).join("");
}

/**
 * Bulk setup drawer: one shared direction, the exact credit cost, the photos
 * that will run (each removable), and an escape hatch back to the grid.
 */
export function openBulkDesign(opts) {
  const items = opts.items.slice();
  let node = document.getElementById("rdsBulk");
  if (node) node.remove();
  node = document.createElement("div");
  node.id = "rdsBulk";
  node.className = "rd-app up-modal on";
  document.body.appendChild(node);

  const close = () => {
    node.remove();
  };

  const draw = () => {
    const groups = groupBySpace(items);
    const cost = items.length * BULK_CREDIT_PER_PHOTO;
    node.innerHTML = `<div class="up-scrim" data-close></div>
      <div class="up-card rdsb" role="dialog" aria-modal="true" aria-label="Design Selected Photos">
        <h3>Design ${items.length} Photo${items.length === 1 ? "" : "s"}</h3>
        <p>One shared direction, applied photo by photo. Each room keeps its own layout and gets furniture and finishes that suit it.</p>
        <div class="rdsb-f">
          <label>Style</label>
          <select id="rdsbStyle">${styleOptions()}</select>
        </div>
        <div class="rdsb-row">
          <div class="rdsb-f"><label>Intensity</label>
            <select id="rdsbInt"><option>Refresh</option><option selected>Makeover</option><option>Full Remodel</option></select></div>
          <div class="rdsb-f"><label>Finish Grade</label>
            <select id="rdsbGrade"><option>Rental Grade</option><option selected>Retail Grade</option><option>Luxury Grade</option></select></div>
        </div>
        <label class="rdsb-chk"><input type="checkbox" id="rdsbPreserve" checked> Keep Walls, Windows And Layout Exactly As They Are</label>
        <div class="rdsb-f"><label>Shared Instructions <em>Optional</em></label>
          <textarea id="rdsbNotes" rows="2" placeholder="Light oak floors, warm neutral palette, no bold colour"></textarea></div>
        <div class="rdsb-groups">
          ${groups
            .map(
              (g) => `<div class="rdsb-g">
              <b>${esc(g.label)} · ${g.items.length}</b>
              <span>These photos share the direction, adapted to each space.</span>
              <div class="rdsb-th">${g.items
                .map(
                  (it) => `<span class="rdsb-t" title="${esc(it.room || it.name)}">
                    <img src="${esc(it.signed || it.previewUrl)}" alt="${esc(it.name)}">
                    <button data-drop="${it.key}" aria-label="Remove ${esc(it.name)} from this batch"><i data-lucide="x"></i></button>
                    <em>${esc(it.room || "Unassigned")}</em></span>`,
                )
                .join("")}</div>
            </div>`,
            )
            .join("")}
        </div>
        <div class="rdsb-cost"><i data-lucide="zap"></i><b>${cost} Credit${cost === 1 ? "" : "s"}</b><span>1 credit per photo. Failed photos are never charged.</span></div>
        <div class="up-act">
          <button class="btn btn-primary" id="rdsbGo"${items.length ? "" : " disabled"}>Generate ${items.length} Design${items.length === 1 ? "" : "s"} · ${cost} Credit${cost === 1 ? "" : "s"}</button>
          <button class="btn btn-dark" id="rdsbEdit">Edit Rooms</button>
          <button class="btn btn-ghost" data-close>Cancel</button>
        </div>
      </div>`;
    paint();
    node.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    node.querySelectorAll("[data-drop]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.getAttribute("data-drop");
          const i = items.findIndex((x) => x.key === k);
          if (i >= 0) items.splice(i, 1);
          draw();
        }),
    );
    node.querySelector("#rdsbEdit").onclick = () => {
      close();
      opts.onEdit && opts.onEdit();
    };
    node.querySelector("#rdsbGo").onclick = () => {
      const styleSel = node.querySelector("#rdsbStyle");
      const rec = STYLES.find((s) => s.id === styleSel.value);
      const direction = {
        styleId: rec ? rec.id : null,
        direction: rec ? rec.displayName : "Warm Minimal",
        intensity: node.querySelector("#rdsbInt").value,
        grade: node.querySelector("#rdsbGrade").value,
        preserve: node.querySelector("#rdsbPreserve").checked,
        notes: node.querySelector("#rdsbNotes").value.trim() || null,
      };
      close();
      opts.onStart && opts.onStart(items, direction);
    };
  };

  draw();
  return { close };
}
