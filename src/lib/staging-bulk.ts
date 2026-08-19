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
import { getMyCredits } from "@/lib/credits.functions";
import { setModalButtonLoading } from "@/lib/modal-footer";
import { PRIMARY_OUTPUT_RATIOS, effectiveRatio, normalizeOutputRatio, ratioLabel } from "@/lib/output-ratio";
import { openUpgrade } from "@/lib/rd-upgrade";
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

const SPACE_LABEL = { interior: "Interior", exterior: "Exterior", landscape: "Garden", unassigned: "Unassigned" };
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
  if (!types.length || types.indexOf(want) !== -1) return "compatible";
  const only = (t) => types.every((x) => x === t);
  /* Operation-bound styles: genuinely impossible, not merely unusual. */
  if (only("garden") && want !== "garden") return "unsupported";
  if (only("virtual-staging") && want !== "interior") return "unsupported";
  return "unusual";
}

/** Only a genuine technical limitation blocks a run. */
export function styleFitsSpace(styleId, space) {
  return styleCompatibility(styleId, space) !== "unsupported";
}

/** Styles that can carry a given space, for the per-group fallback picker. */
export function stylesForSpace(space) {
  return STYLES.filter((s) => s.isActive !== false && styleFitsSpace(s.id, space));
}

/** Why an operation cannot run on that space, in plain terms. */
function unsupportedNote(styleName, space) {
  if (space === "interior")
    return `${styleName} is a landscaping direction — it works on outdoor ground, so it cannot be applied to an indoor room. Choose an interior direction for this group.`;
  if (space === "exterior")
    return `${styleName} is an empty-room staging direction — there is no room to furnish on a building exterior. Choose an exterior direction for this group.`;
  return `${styleName} cannot be applied to these photos. Choose a compatible direction for this group.`;
}


/** How the shared direction is described for each space type. */
function groupNote(space) {
  if (space === "unassigned") return "These photos still need a room type before they can be designed.";
  if (space === "exterior")
    return "The shared direction is adapted to the exterior — materials, paint and curb appeal, not indoor furniture.";
  if (space === "landscape")
    return "The shared direction is adapted to the outdoor space — planting, hardscape and lighting.";
  return "These photos share the direction, adapted to each room and its layout.";
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
        const space = it.room ? roomSpace(it.room) : "interior";
        /* A space the shared style cannot carry uses the style the user picked
           for that group, so an exterior never gets an interior-only look. */
        const perSpace = (direction.styleBySpace || {})[space];
        const r = await renderDesign({
          data: {
            image,
            room_type: it.room || "living room",
            direction: (perSpace && perSpace.name) || direction.direction,
            style_id: (perSpace && perSpace.id) || direction.styleId || null,
            project_type: PROJECT_TYPE[space] || "interior",
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

/**
 * Style options for the shared picker. Nothing is preselected: the first entry
 * is a placeholder so the modal never invents a creative choice for the user.
 * When `spaces` is given, only styles that can carry every selected space are
 * offered, so a mixed interior/exterior batch cannot start out incompatible.
 */
function styleOptions(selected, spaces) {
  const list = STYLES.filter(
    (s) => s.isActive !== false && (!spaces || spaces.every((sp) => styleFitsSpace(s.id, sp))),
  );
  return (
    `<option value=""${!selected ? " selected" : ""}>Choose a style</option>` +
    list
      .map((s) => `<option value="${esc(s.id)}"${s.id === selected ? " selected" : ""}>${esc(s.displayName)}</option>`)
      .join("")
  );
}

/** Placeholder-first options for a plain text choice (intensity, grade). */
function pickOptions(list, selected, placeholder) {
  return (
    `<option value=""${!selected ? " selected" : ""}>${esc(placeholder)}</option>` +
    list.map((o) => `<option${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("")
  );
}

/**
 * Bulk setup drawer: one shared direction, the exact credit cost, the photos
 * that will run (each removable), and an escape hatch back to the grid.
 *
 * The modal is the last thing a user sees before credits are spent, so what it
 * shows has to be exactly what runs: the same output format, the same room
 * types, the same photo count. Unassigned photos block the run rather than
 * being quietly rendered as generic interiors.
 */
export function openBulkDesign(opts) {
  const items = opts.items.slice();
  const readRatio = () => normalizeOutputRatio(typeof opts.ratio === "function" ? opts.ratio() : opts.ratio);
  let allowGeneric = false;
  /* Advisory recommendations the user has explicitly accepted (styleId:space). */
  const ackUnusual = {};
  let submitted = false;
  let credits = null; // { balance } once the account answers
  const returnFocus = document.activeElement;

  /* Distinct from the page's #rdsBulk action button: reusing that id used to
     delete "Set Design Direction" from the page the first time this opened. */
  let fmtOpen = false;
  let node = document.getElementById("rdsBulkModal");
  if (node) node.remove();
  node = document.createElement("div");
  node.id = "rdsBulkModal";
  node.className = "rd-app up-modal on";
  document.body.appendChild(node);

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    node.remove();
    /* Draft settings live in the caller's state, so closing loses nothing. */
    try {
      returnFocus && returnFocus.focus && returnFocus.focus();
    } catch (_) {}
  };

  /* Nothing creative is chosen for the user. Every field starts null and only
     holds a value the user picked, or one they picked earlier in this same
     session (the caller hands it back through opts.settings). Preserve walls
     is the one default, because it is a safety constraint, not a look. */
  const saved = (opts.settings && typeof opts.settings === "object" && opts.settings) || {};
  const form = {
    styleId: saved.styleId || null,
    intensity: saved.intensity || null,
    grade: saved.grade || null,
    preserve: saved.preserve !== false,
    notes: saved.notes || "",
    spaceStyles: Object.assign({}, saved.spaceStyles || {}),
  };
  /* Session memory: reopening the modal for this project restores what the
     user actually chose, never a demo or another project's direction. */
  const remember = () => opts.onSettingsChange && opts.onSettingsChange(Object.assign({}, form));
  const readForm = () => {
    const q = (id) => node.querySelector(id);
    if (!q("#rdsbStyle")) return;
    form.styleId = q("#rdsbStyle").value || null;
    form.intensity = q("#rdsbInt").value || null;
    form.grade = q("#rdsbGrade").value || null;
    form.preserve = q("#rdsbPreserve").checked;
    form.notes = q("#rdsbNotes").value;
    node.querySelectorAll("[data-spacestyle]").forEach((el) => {
      form.spaceStyles[el.getAttribute("data-spacestyle")] = el.value || "";
    });
    remember();
  };

  const styleName = () => {
    const rec = STYLES.find((s) => s.id === form.styleId);
    return rec ? rec.displayName : "";
  };

  const draw = () => {
    const groups = groupBySpace(items);
    const n = items.length;
    const cost = n * BULK_CREDIT_PER_PHOTO;
    const ratio = readRatio();
    const missing = items.filter((i) => !i.room).length;
    const bal = credits && !credits.unavailable ? credits.balance : null;
    const short = bal != null && cost > bal ? cost - bal : 0;

    /* Spaces actually present. Only a genuinely unsupported operation removes
       a style from the shared picker — an unusual look stays available. */
    const spaces = groups.map((g) => g.space).filter((s) => s && s !== "unassigned");
    const universal = STYLES.filter(
      (s) => s.isActive !== false && spaces.every((sp) => styleFitsSpace(s.id, sp)),
    );
    const mixed = spaces.filter((s, i) => spaces.indexOf(s) === i).length > 1;
    /* No universal look for this mix: fall back to a style per space group. */
    const perSpaceMode = mixed && !universal.length;

    /* The style that actually drives each group. */
    const styleFor = (g) => form.spaceStyles[g.space] || (perSpaceMode ? "" : form.styleId || "");
    const levelFor = (g) => (styleFor(g) ? styleCompatibility(styleFor(g), g.space) : "compatible");
    const unsupported = groups.filter((g) => levelFor(g) === "unsupported");
    const unusual = groups.filter(
      (g) => levelFor(g) === "unusual" && !ackUnusual[styleFor(g) + ":" + g.space],
    );

    let block = "";
    let blockField = "";
    if (!n) block = "Add at least one photo to generate a design.";
    else if (!form.styleId && !perSpaceMode) {
      block = "Choose a style to continue.";
      blockField = "style";
    } else if (perSpaceMode && groups.some((g) => g.space !== "unassigned" && !form.spaceStyles[g.space])) {
      block = "Choose a style for each group to continue.";
    } else if (!form.intensity) {
      block = "Choose an intensity to continue.";
      blockField = "intensity";
    } else if (!form.grade) {
      block = "Choose a finish grade to continue.";
      blockField = "grade";
    } else if (missing && !allowGeneric) block = "Assign a room type to every selected photo before generating.";
    else if (unsupported.length) {
      block = "STYLE_UNFIT";
    } else if (unusual.length) {
      block = "STYLE_UNUSUAL";
    } else if (short)
      block = `You need ${short} more credit${short === 1 ? "" : "s"} to generate ${n} design${n === 1 ? "" : "s"}.`;

    /* Style feedback is explained once, inside the group that needs it. */
    const barMsg = block === "STYLE_UNFIT" || block === "STYLE_UNUSUAL" || blockField ? "" : block;
    const hint =
      block === "STYLE_UNFIT"
        ? `${styleName()} cannot be applied to ${unsupported.map((g) => g.label.toLowerCase()).join(" and ")} photos. Choose a compatible style for that group.`
        : block === "STYLE_UNUSUAL"
          ? `Review the recommendation on the ${unusual.map((g) => g.label.toLowerCase()).join(" and ")} group.`
          : block;
    /* One concise message, shown under the field that needs attention. */
    const fieldMsg = (name) =>
      blockField === name ? `<p class="rdsb-fielderr"><i data-lucide="alert-circle"></i>${esc(block)}</p>` : "";


    /* Group summary for the collapsed photo section: "1 Exterior · 7 Interior". */
    const groupSummary = groups.map((g) => `${g.items.length} ${g.label}`).join(" · ");
    /* The photo list only opens itself when a group genuinely needs attention. */
    const photosOpen = !!(missing || perSpaceMode || unsupported.length || unusual.length);

    /* One source of truth for the format: the project ratio chosen on Prepare
       Your Photos, edited inline here — never in a second stacked modal. */
    const remaining = bal == null ? null : Math.max(bal - cost, 0);
    const fmtBlock = `<div class="rdsb-out">
      <div class="rdsb-out-row">
        <div class="rdsb-out-c">
          <span>Output</span>
          <b>${esc(ratioLabel(ratio))}</b>
          <button type="button" class="rdsb-fmt-x" id="rdsbFmt">${fmtOpen ? "Done" : "Change"}</button>
        </div>
        <div class="rdsb-out-c right">
          <span>Generation Cost</span>
          <b>${cost} credit${cost === 1 ? "" : "s"}</b>
        </div>
      </div>
      ${
        fmtOpen
          ? `<div class="rdsb-fmt-seg">${PRIMARY_OUTPUT_RATIOS.map(
              (o) =>
                `<button type="button" class="${ratio === o.id ? "on" : ""}" data-rdsbratio="${esc(o.id)}">${esc(
                  o.note ? o.label + " " + o.note : o.label,
                )}</button>`,
            ).join("")}</div>`
          : ""
      }
      <p class="rdsb-out-n" role="status" aria-live="polite">${
        bal == null
          ? "Failed generations are not charged."
          : `${bal} credit${bal === 1 ? "" : "s"} available · ${remaining} remaining after generation`
      }</p>
    </div>`;

    node.innerHTML = `<div class="up-scrim" data-close></div>
      <div class="up-card rdsb" role="dialog" aria-modal="true" aria-labelledby="rdsbTitle">
        <div class="rdsb-head">
          <h3 id="rdsbTitle">Design ${n} Photo${n === 1 ? "" : "s"}</h3>
          <p>Choose one design direction for the selected photos. We’ll adapt it to each room and space.</p>
        </div>
        <div class="rdsb-body">
          ${
            perSpaceMode
              ? `<p class="rdsb-mixed">Your selection contains interior and exterior photos, so you can choose a direction for each.</p>`
              : `<div class="rdsb-f">
            <label for="rdsbStyle">Style</label>
            <select id="rdsbStyle">${styleOptions(form.styleId, spaces)}</select>
            ${mixed && form.styleId ? `<em class="rdsb-help">Adapted to each space — modern finishes indoors, modern materials and landscaping outdoors.</em>` : ""}
            ${fieldMsg("style")}
          </div>`
          }
          ${perSpaceMode ? `<select id="rdsbStyle" class="rdsb-hidden" aria-hidden="true" tabindex="-1"><option value=""></option></select>` : ""}
          <div class="rdsb-row">
            <div class="rdsb-f"><label for="rdsbInt">Intensity</label>
              <select id="rdsbInt">${pickOptions(["Refresh", "Makeover", "Full Remodel"], form.intensity, "Choose intensity")}</select>${fieldMsg("intensity")}</div>
            <div class="rdsb-f"><label for="rdsbGrade">Finish Grade</label>
              <select id="rdsbGrade">${pickOptions(["Rental Grade", "Retail Grade", "Luxury Grade"], form.grade, "Choose finish grade")}</select>${fieldMsg("grade")}</div>
          </div>
          <label class="rdsb-chk"><input type="checkbox" id="rdsbPreserve"${form.preserve ? " checked" : ""}> Keep walls, windows, and layout exactly as they are</label>
          <div class="rdsb-f"><label for="rdsbNotes">Shared Instructions <em>Optional</em></label>
            <textarea id="rdsbNotes" rows="2" placeholder="Example: Light oak floors, warm neutral palette, no bold colors">${esc(form.notes)}</textarea></div>

          <details class="rdsb-photos"${photosOpen ? " open" : ""}>
            <summary>
              <span class="rdsb-photos-t">Selected Photos · ${n}</span>
              <span class="rdsb-photos-s">${esc(groupSummary)}</span>
              <i data-lucide="chevron-down"></i>
            </summary>
            <div class="rdsb-groups">
            ${groups
              .map((g) => {
                const level = levelFor(g);
                const needsOwn = perSpaceMode && g.space !== "unassigned";
                const pick = form.spaceStyles[g.space] || "";
                const acked = !!ackUnusual[styleFor(g) + ":" + g.space];
                const name = STYLES.find((s) => s.id === styleFor(g));
                const label = name ? name.displayName : styleName();
                const bad = g.space === "unassigned" || level === "unsupported";
                const advise = level === "unusual" && !acked;
                return `<div class="rdsb-g${bad ? " warn" : ""}${advise ? " advise" : ""}">
                <b>${esc(g.label)} · ${g.items.length}</b>
                <span>${esc(
                  needsOwn
                    ? `Choose the direction for these ${g.label.toLowerCase()} photos.`
                    : level === "unsupported"
                      ? unsupportedNote(label, g.space)
                      : groupNote(g.space),
                )}</span>
                ${
                  advise
                    ? `<div class="rdsb-advise" role="status">
                        <p><i data-lucide="info"></i>${esc(label)} is an unconventional choice for this ${esc(g.label.toLowerCase())}, but it can still be applied.</p>
                        <div class="rdsb-advise-a">
                          <button type="button" class="rdsb-ab primary" data-ack="${esc(g.space)}">Use Anyway</button>
                          <button type="button" class="rdsb-ab" data-restyle="${esc(g.space)}">Choose Another Style</button>
                        </div>
                      </div>`
                    : ""
                }
                ${
                  level !== "unsupported" && !needsOwn
                    ? ""
                    : `<select class="rdsb-gstyle" data-spacestyle="${esc(g.space)}" aria-label="Style for ${esc(g.label)} photos">
                        <option value="">${needsOwn ? esc(`Choose ${g.label} Style…`) : "Choose A Compatible Style…"}</option>
                        ${stylesForSpace(g.space)
                          .filter((s) => styleCompatibility(s.id, g.space) === "compatible")
                          .map(
                            (s) =>
                              `<option value="${esc(s.id)}"${s.id === pick ? " selected" : ""}>${esc(s.displayName)}</option>`,
                          )
                          .join("")}
                      </select>`
                }
                <div class="rdsb-th">${g.items
                  .map(
                    (it) => `<span class="rdsb-t">
                      <img src="${esc(it.signed || it.previewUrl)}" alt="${esc(it.name)}">
                      <button type="button" data-drop="${esc(it.key)}" title="Remove from this batch"
                        aria-label="Remove ${esc(it.name)} from this batch. The photo stays in Media."><i data-lucide="x"></i></button>
                      <em title="${esc(it.room || "Room type needed")}">${esc(it.room || "Room type needed")}</em></span>`,
                  )
                  .join("")}</div>
              </div>`;
              })
              .join("")}
            </div>
          </details>


          ${
            missing
              ? `<label class="rdsb-chk gen"><input type="checkbox" id="rdsbGeneric"${allowGeneric ? " checked" : ""}> Generate as generic interior <em>Uses a neutral interior direction for the ${missing} unassigned photo${missing === 1 ? "" : "s"}</em></label>`
              : ""
          }

          ${fmtBlock}
        </div>
        <div class="rdsb-foot">
          ${
            barMsg
              ? `<div class="rdsb-blockbar"><p class="rdsb-block"><i data-lucide="alert-circle"></i>${esc(barMsg)}</p>${
                  short ? `<button type="button" class="rdsb-addc" id="rdsbAdd"><i data-lucide="zap"></i>Add credits</button>` : ""
                }</div>`
              : ""
          }
          <div class="rdsb-foot-row">
            <p class="rdsb-foot-cost">${n} selected</p>
            <div class="rdsb-foot-a">
              <button type="button" class="rdm-btn rdm-ghost" data-mfa="cancel">Cancel</button>
              <button type="button" class="rdm-btn rdm-outline" data-mfa="edit">Edit Room Types</button>
              <button type="button" class="rdm-btn rdm-primary" data-mfa="go"${block || submitted ? ' disabled aria-disabled="true"' : ""}${hint ? ` title="${esc(hint)}"` : ""}>Generate ${n} Design${n === 1 ? "" : "s"}</button>
            </div>
          </div>
        </div>
      </div>`;
    paint();

    node.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    node.querySelector('[data-mfa="cancel"]').onclick = close;
    node.querySelectorAll("[data-ack]").forEach(
      (b) =>
        (b.onclick = () => {
          readForm();
          const space = b.getAttribute("data-ack");
          const id = form.spaceStyles[space] || form.styleId || "";
          /* Acknowledged once: the same recommendation never returns. */
          ackUnusual[id + ":" + space] = true;
          draw();
        }),
    );
    node.querySelectorAll("[data-restyle]").forEach(
      (b) =>
        (b.onclick = () => {
          readForm();
          const space = b.getAttribute("data-restyle");
          const sel = node.querySelector(
            form.spaceStyles[space] ? `[data-spacestyle="${space}"]` : "#rdsbStyle",
          );
          if (sel && sel.focus) sel.focus();
        }),
    );

    node.querySelectorAll("#rdsbStyle,#rdsbInt,#rdsbGrade,#rdsbPreserve,[data-spacestyle]").forEach(
      (el) =>
        (el.onchange = () => {
          readForm();
          draw();
        }),
    );
    const notes = node.querySelector("#rdsbNotes");
    if (notes) notes.oninput = () => (form.notes = notes.value);
    const generic = node.querySelector("#rdsbGeneric");
    if (generic)
      generic.onchange = () => {
        readForm();
        allowGeneric = generic.checked;
        draw();
      };
    node.querySelectorAll("[data-drop]").forEach(
      (b) =>
        (b.onclick = () => {
          readForm();
          const k = b.getAttribute("data-drop");
          const i = items.findIndex((x) => String(x.key) === k);
          /* Selection only. The source photo and its Media entry are untouched. */
          if (i >= 0) items.splice(i, 1);
          draw();
        }),
    );
    const addc = node.querySelector("#rdsbAdd");
    if (addc) addc.onclick = () => openUpgrade(block, "Add Credits To Design These Photos");
    node.querySelector("#rdsbFmt").onclick = () => {
      readForm();
      fmtOpen = !fmtOpen;
      draw();
    };
    node.querySelectorAll("[data-rdsbratio]").forEach(
      (b) =>
        (b.onclick = () => {
          readForm();
          /* Immediately updates the shared project format — one source of truth. */
          opts.onRatioChange && opts.onRatioChange(b.getAttribute("data-rdsbratio"));
          draw();
        }),
    );
    node.querySelector('[data-mfa="edit"]').onclick = () => {
      close();
      opts.onEdit && opts.onEdit();
    };
    const go = node.querySelector('[data-mfa="go"]');
    go.onclick = () => {
      if (submitted || go.disabled) return;
      readForm();
      submitted = true;
      setModalButtonLoading(go, true, `Generating ${items.length} Design${items.length === 1 ? "" : "s"}…`);
      const rec = STYLES.find((s) => s.id === form.styleId);
      /* Per-space fallbacks travel with the direction, so an exterior group
         renders with the style the user chose for it. */
      const styleBySpace = {};
      Object.keys(form.spaceStyles || {}).forEach((space) => {
        const id = form.spaceStyles[space];
        const sr = id && STYLES.find((s) => s.id === id);
        if (sr) styleBySpace[space] = { id: sr.id, name: sr.displayName };
      });
      const direction = {
        styleId: rec ? rec.id : null,
        direction: rec ? rec.displayName : null,
        styleBySpace,
        intensity: form.intensity,
        grade: form.grade,
        preserve: form.preserve,
        notes: (form.notes || "").trim() || null,
        /* Exactly the format the summary just showed. */
        outputRatio: readRatio(),
      };
      close();
      opts.onStart && opts.onStart(items, direction);
    };
  };

  draw();
  /* Balance arrives after first paint so the modal never blocks on the network. */
  getMyCredits()
    .then((c) => {
      credits = c;
      if (document.body.contains(node) && !submitted) draw();
    })
    .catch(() => {});
  return { close, refresh: () => draw() };
}
