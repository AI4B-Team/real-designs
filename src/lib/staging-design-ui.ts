/**
 * Inline Design and Review pages for the multi-photo Photo Design workflow.
 *
 * These are full pages inside the builder, never a modal: style choice needs
 * room to breathe, and the credit-spending decision belongs on a real Review
 * step the user can leave and come back to.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { openStyleBrowser } from "@/lib/canvas-style-ui";
import {
  DESIGN_DIRECTIONS,
  categoryStatus,
  clearCategoryStyle,
  designBlockerSummary,
  FINISH_GRADES,
  compatibleStyles,
  creditCost,
  designBlockers,
  assertDesignState,
  readDesignSelection,
  designGroups,
  directionLabel,
  effectiveStyleId,
  gradeLabel,
  hasOverride,
  hasCustomization,
  photoNote,

  spaceOf,
  styleName,
} from "@/lib/staging-design";
import { styleById } from "@/lib/style-catalog";

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/**
 * One card shape for every Design Direction and Finish Grade option.
 *
 * Every option is a full, equal-height card with a real border and a full-card
 * click target, so an unselected option never reads as plain text. Radio
 * semantics keep exactly one selection per group and make the group keyboard
 * navigable.
 */
export function optionCardHtml(attr, o, value) {
  const on = o.id === value;
  return `<button type="button" class="design-option-card${on ? " on" : ""}" role="radio"
    tabindex="${on ? "0" : "-1"}" aria-checked="${on ? "true" : "false"}" data-${attr}="${esc(o.id)}">
    <span class="doc-h"><b>${esc(o.label)}</b>${o.badge ? `<em class="doc-badge">${esc(o.badge)}</em>` : ""}</span>
    <span class="doc-n">${esc(o.note)}</span>
    <span class="doc-ck" aria-hidden="true"><i data-lucide="check"></i></span>
  </button>`;
}

export function paintIcons(root) {
  try {
    createIcons({ icons, ...(root ? { root } : {}) });
  } catch (_) {}
}

const PROJECT_TYPE = {
  interior: "interior",
  exterior: "exterior",
  landscape: "garden",
  unassigned: "interior",
};

/** How many style cards are shown before "View All Styles". */
export const QUICK_CARDS = 8;

/**
 * The cards offered inline for one space. The active selection is always
 * included so a chosen style can never scroll out of the visible set.
 */
export function quickCards(space, selectedId, max = QUICK_CARDS) {
  const pool = compatibleStyles(space);
  const out = [];
  const seen = new Set();
  const take = (rec) => {
    if (!rec || seen.has(rec.id) || out.length >= max) return;
    seen.add(rec.id);
    out.push(rec);
  };
  const sel = selectedId ? pool.find((s) => s.id === selectedId) : null;
  take(sel);
  pool
    .slice()
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || a.featuredRank - b.featuredRank)
    .forEach(take);
  return out;
}

/**
 * One style card. The selected indicator is rendered ONLY for the selected
 * style — it is never a decorative element present on every card, so the
 * visual state, the draft and the canonical style id always agree.
 */
function cardHtml(rec, on, scope) {
  const locked = rec.plan && rec.plan !== "free" ? String(rec.plan) : "";
  return `<button type="button" class="rdd-card${on ? " on" : ""}" role="radio"
    aria-checked="${on ? "true" : "false"}" aria-selected="${on ? "true" : "false"}"
    title="${esc(rec.displayName)}" data-style="${esc(rec.id)}" data-scope="${esc(scope)}">
    <span class="rdd-card-th">${
      rec.previewImage
        ? `<img src="${esc(rec.previewImage)}" alt="${esc(rec.displayName)} example" loading="lazy">`
        : ""
    }${
      on
        ? `<span class="rdd-card-ck" aria-hidden="true"><i data-lucide="check"></i></span>`
        : ""
    }${locked ? `<span class="rdd-card-plan">${esc(locked.toUpperCase())}</span>` : ""}</span>
    <span class="rdd-card-t">${esc(rec.displayName)}</span>
  </button>`;
}

/** "Kitchen ×4 · Entry ×1" — exactly which photos a category style covers. */
function appliesToHtml(cat) {
  return `<p class="rdd-applies"><b>Applies To:</b> ${cat.rooms
    .map((r) => `${esc(r.room)} &times;${r.count}`)
    .join(" &middot; ")}</p>`;
}

function groupHtml(model, cat) {
  const selected = cat.styleId;
  const cards = cat.space === "unassigned" ? [] : quickCards(cat.space, selected);
  return `<section class="rdd-group" data-space="${esc(cat.space)}">
    <header class="rdd-group-h">
      <h3>${esc(cat.label)} &middot; ${cat.count} Photo${cat.count === 1 ? "" : "s"}</h3>
      <span class="rdd-group-a">${
        cat.space === "unassigned"
          ? `<span class="rdd-warn"><i data-lucide="alert-circle"></i>Set a room or area on the Photos step first.</span>`
          : `${
              selected
                ? `<button type="button" class="fb-link rdd-clear" data-clear="${esc(cat.space)}" aria-label="Clear the ${esc(cat.label)} style">Clear Selection</button>`
                : ""
            }<button type="button" class="fb-link rdd-all" data-viewall="${esc(cat.space)}">View All Styles</button>`
      }</span>
    </header>
    ${
      cat.space === "unassigned"
        ? ""
        : `<div class="rdd-cards" role="radiogroup" aria-label="${esc(cat.label)} styles">${cards
            .map((rec) => cardHtml(rec, rec.id === selected, cat.space))
            .join("")}</div>`
    }
    ${appliesToHtml(cat)}
  </section>`;
}

/** Compact per-category completion status shown above the style grids. */
function statusHtml(cats) {
  return `<div class="rdd-status">${cats
    .map(
      (c) =>
        `<span class="rdd-chip${c.complete ? " ok" : ""}" data-space="${esc(c.space)}">
          <i data-lucide="${c.complete ? "check-circle-2" : "circle-alert"}"></i>
          <b>${esc(c.label)}:</b> ${esc(c.complete ? c.styleName || "Mixed Styles" : "Style Needed")}</span>`,
    )
    .join("")}</div>`;
}

/** Per-photo overrides live in one collapsed section, never clipped rows. */
function overridesHtml(model, cats) {
  const rows = [];
  cats.forEach((cat) => {
    cat.items.forEach((it) => {
      const own = hasOverride(model, it);
      const id = effectiveStyleId(model, it);
      const note = photoNote(model, it);
      const state = own
        ? `Custom Style: ${styleName(id) || "Not chosen"}`
        : id
          ? `Uses ${cat.label} Style: ${styleName(id)}`
          : `No ${cat.label} style chosen yet`;
      rows.push(`<div class="rdd-photo${own || note ? " own" : ""}">
        <span class="rdd-photo-th"><img src="${esc(it.signed || it.previewUrl || "")}" alt="${esc(it.room || "Photo")}" loading="lazy"></span>
        <span class="rdd-photo-m"><b>${esc(it.room || "Room Type Needed")}</b><em>${esc(state)}</em></span>
        <span class="rdd-photo-a">
          <button type="button" class="fb-link" data-photostyle="${esc(it.key)}">Customize</button>
          ${own ? `<button type="button" class="fb-link" data-photoreset="${esc(it.key)}">Use Group Style</button>` : ""}
        </span>
        <label class="rdd-photo-note">
          <span>Instructions For This Photo</span>
          <textarea rows="2" data-photonote="${esc(it.key)}" placeholder="Example: Leave the fireplace exactly as it is.">${esc(note)}</textarea>
        </label>
      </div>`);
    });
  });
  return `<details class="rdd-ovr">
    <summary><i data-lucide="chevron-right"></i><b>Customize Individual Photos</b>
      <em>Assign a different style or instructions to a specific photo.</em></summary>
    <div class="rdd-photos">${rows.join("")}</div>
  </details>`;
}


/** The full Design page body. */
export function designStepHtml(ctx) {
  const items = ctx.items || [];
  const model = ctx.model;
  const cats = categoryStatus(items, model);
  const summary = designBlockerSummary(items, model);
  const blocked = designBlockers(items, model).length > 0;
  return `<div class="rdd-page rdd-design">
    <div class="rdd-scroll">
    ${statusHtml(cats)}
    <div class="rdd-groups">${cats.map((c) => groupHtml(model, c)).join("")}</div>
    ${overridesHtml(model, cats)}

    <section class="rdd-shared">
      <div class="rdd-block-s">
        <h3>Design Direction</h3>
        <div class="design-option-grid" role="radiogroup" aria-label="Design Direction">
          ${DESIGN_DIRECTIONS.map((d) => optionCardHtml("dir", d, model.direction)).join("")}
        </div>
      </div>

      <div class="rdd-block-s">
        <h3>Structure Protection</h3>
        <label class="design-option-card design-toggle-card${model.preserve !== false ? " on" : ""}">
          <input type="checkbox" id="rddPreserve"${model.preserve !== false ? " checked" : ""}>
          <span class="doc-h"><b>Keep Walls, Windows, Doors and Layout Unchanged</b></span>
          <span class="doc-n">Recommended for listing photos: the room stays the same space, only its design changes.</span>
        </label>
      </div>

      <div class="rdd-block-s">
        <h3>Finish Grade</h3>
        <div class="design-option-grid" role="radiogroup" aria-label="Finish Grade">
          ${FINISH_GRADES.map((g) => optionCardHtml("grade", g, model.grade)).join("")}
        </div>
      </div>

      <div class="rdd-block-s">
        <h3>Shared Instructions <em class="rdd-optional">Optional</em></h3>
        <textarea id="rddNotes" rows="3" placeholder="Example: Warm oak floors, neutral colors, matte black fixtures.">${esc(model.notes || "")}</textarea>
      </div>
    </section>
    </div>

    <div class="rv-gridfoot rdd-foot">
      <div class="rv-count">${
        summary
          ? `<span class="rdd-block"><i data-lucide="alert-circle"></i>${esc(summary)}</span>`
          : `<span>${items.length} photo${items.length === 1 ? "" : "s"} · ${creditCost(items)} credit${creditCost(items) === 1 ? "" : "s"} at Review</span>`
      }</div>
      <div class="rv-gridfoot-a">
        <button class="btn btn-ghost" id="rddBack">Back</button>
        <button class="btn btn-primary" id="rddNext"${blocked ? ' disabled aria-disabled="true"' : ""}>Next: Review</button>
      </div>
    </div>
  </div>`;
}


/** Wire the Design page. `ctx.onChange` re-renders through the caller. */
export function bindDesignStep(root, ctx) {
  const model = ctx.model;
  const changed = () => ctx.onChange && ctx.onChange(model);

  root.querySelectorAll("[data-style]").forEach((b) => {
    b.onclick = () => {
      model.styleBySpace[b.getAttribute("data-scope")] = b.getAttribute("data-style");
      changed();
    };
  });
  root.querySelectorAll("[data-clear]").forEach((b) => {
    b.onclick = () => {
      /* Scope-bound: only this category loses its style. */
      const next = clearCategoryStyle(model, b.getAttribute("data-clear"));
      model.styleBySpace = next.styleBySpace;
      changed();
    };
  });
  root.querySelectorAll("[data-viewall]").forEach((b) => {
    b.onclick = () => {
      const space = b.getAttribute("data-viewall");
      openStyleBrowser({
        projectType: PROJECT_TYPE[space] || "interior",
        currentId: model.styleBySpace[space] || "",
        onPick: (id) => {
          model.styleBySpace[space] = id;
          changed();
        },
      });
    };
  });
  root.querySelectorAll("[data-photostyle]").forEach((b) => {
    b.onclick = () => {
      const key = b.getAttribute("data-photostyle");
      const it = (ctx.items || []).find((i) => i.key === key);
      if (!it) return;
      const space = spaceOf(it);
      openStyleBrowser({
        projectType: PROJECT_TYPE[space] || "interior",
        room: it.room || null,
        currentId: effectiveStyleId(model, it),
        onPick: (id) => {
          model.overrides[key] = id;
          changed();
        },
      });
    };
  });
  root.querySelectorAll("[data-photoreset]").forEach((b) => {
    b.onclick = () => {
      delete model.overrides[b.getAttribute("data-photoreset")];
      changed();
    };
  });
  /* Notes save in place: repainting on every keystroke would steal focus. */
  root.querySelectorAll("[data-photonote]").forEach((t) => {
    t.oninput = () => {
      const key = t.getAttribute("data-photonote");
      if (!model.notesByPhoto) model.notesByPhoto = {};
      const value = t.value.trim();
      if (value) model.notesByPhoto[key] = t.value;
      else delete model.notesByPhoto[key];
      ctx.onNotes && ctx.onNotes(model);
    };
  });

  const bindRadioGroup = (attr, apply) => {
    const cards = [...root.querySelectorAll(`[data-${attr}]`)];
    cards.forEach((b, i) => {
      b.onclick = () => {
        apply(b.getAttribute(`data-${attr}`));
        changed();
      };
      /* Arrow keys move between options the way a radio group should. */
      b.onkeydown = (e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = cards[(i + step + cards.length) % cards.length];
        next.focus();
        apply(next.getAttribute(`data-${attr}`));
        changed();
      };
    });
  };
  bindRadioGroup("dir", (v) => (model.direction = v));
  bindRadioGroup("grade", (v) => (model.grade = v));
  /* The rendered selection and the draft must never drift apart. */
  assertDesignState("the Design page", model, readDesignSelection(root));
  const pres = root.querySelector("#rddPreserve");
  if (pres) pres.onchange = () => {
    model.preserve = pres.checked;
    changed();
  };
  const notes = root.querySelector("#rddNotes");
  if (notes)
    notes.oninput = () => {
      model.notes = notes.value;
      ctx.onNotes && ctx.onNotes(model);
    };
  const back = root.querySelector("#rddBack");
  if (back) back.onclick = () => ctx.onBack && ctx.onBack();
  const next = root.querySelector("#rddNext");
  if (next)
    next.onclick = () => {
      if (next.disabled) return;
      ctx.onNext && ctx.onNext();
    };
}

/* ------------------------------------------------------------------ review */

function reviewGroupHtml(ctx, model, group) {
  return `<section class="rdd-rgroup">
    <h3>${esc(group.label)} · ${group.items.length} Photo${group.items.length === 1 ? "" : "s"}</h3>
    <p class="rdd-rstyle">Style: <b>${esc(styleName(model.styleBySpace[group.space]) || "Not chosen")}</b></p>
    <div class="rdd-rlist">${group.items
      .map((it) => {
        const id = effectiveStyleId(model, it);
        const own = hasOverride(model, it);
        const n = (ctx.items || []).indexOf(it) + 1;
        const label = (ctx.photoLabel && ctx.photoLabel(it, n)) || `${it.room || "Photo"} · Photo ${n}`;
        const fmt = (ctx.photoFormat && ctx.photoFormat(it)) || "";
        const custom = ctx.photoCustomCrop && ctx.photoCustomCrop(it);
        const note = photoNote(model, it);
        return `<div class="rdd-rrow">
          <span class="rdd-rn">${n}</span>
          <span class="rdd-photo-th"><img src="${esc(it.signed || it.previewUrl || "")}" alt="${esc(label)}" loading="lazy"></span>
          <span class="rdd-photo-m"><b>${esc(label)}</b>
            <em>${esc(styleName(id) || "No style")}${own ? " · Own Style" : ""}${fmt ? " · " + esc(fmt) : ""}${custom ? " · Custom Position" : ""}</em>
            ${note ? `<em class="rdd-rnote"><b>Photo Instructions</b> ${esc(note)}</em>` : ""}</span>
        </div>`;

      })
      .join("")}</div>
  </section>`;
}

function factHtml(term, value, edit) {
  return `<div><dt>${esc(term)}${
    edit ? `<button type="button" class="rdd-factedit" data-reviewedit="${esc(edit)}">Edit</button>` : ""
  }</dt><dd>${esc(value)}</dd></div>`;
}

/** The full Review page body. */
export function reviewStepHtml(ctx) {
  const items = ctx.items || [];
  const model = ctx.model;
  const cost = creditCost(items);
  const blockers = ctx.blockers || [];
  const groups = designGroups(items);
  const overrides = items.filter((it) => hasOverride(model, it)).length;
  const balance = typeof ctx.balance === "number" ? ctx.balance : null;
  const freePlan = ctx.plan === "free";
  const remainingToday = typeof ctx.remainingToday === "number" ? ctx.remainingToday : null;
  /* Free plan draws on the daily design allowance, not the credit balance. */
  const short = freePlan
    ? remainingToday !== null && remainingToday < cost
      ? cost - remainingToday
      : 0
    : balance !== null && balance < cost
      ? cost - balance
      : 0;

  return `<div class="rdd-page rdd-review">
    <dl class="rdd-facts">
      ${ctx.address ? factHtml("Property", ctx.address) : ""}
      ${factHtml("Image Format", ctx.ratioLabel || "Original · Keep Source Proportions", "format")}
      ${ctx.cropCount ? factHtml("Crop Positions", `${ctx.cropCount} confirmed`, "format") : ""}
      ${factHtml("Photos", String(items.length), "photos")}
      ${factHtml("Design Direction", directionLabel(model.direction), "design")}
      ${factHtml("Finish Grade", gradeLabel(model.grade), "design")}
      ${factHtml(
        "Structure Protection",
        model.preserve !== false
          ? "On · Preserve walls, windows, doors, and layout"
          : "Off · Structure may change",
        "design",
      )}
      ${factHtml("Shared Instructions", (model.notes || "").trim() || "None", "design")}
      ${factHtml("Individual Overrides", overrides ? `${overrides} photo${overrides === 1 ? "" : "s"}` : "None", "design")}
      ${factHtml(freePlan ? "Free Designs Used" : "Credit Cost", freePlan ? `${cost} of 5 today` : `${cost} credit${cost === 1 ? "" : "s"}`)}
      ${
        freePlan
          ? factHtml(
              "Free Designs Left Today",
              remainingToday === null ? "Checking…" : `${remainingToday} of 5`,
            )
          : factHtml(
              "Available Balance",
              balance === null ? "Checking…" : `${balance} credit${balance === 1 ? "" : "s"}`,
            )
      }
    </dl>
    ${
      short
        ? `<p class="rdd-short"><i data-lucide="alert-circle"></i>${
            freePlan
              ? `You have ${remainingToday ?? 0} free design${remainingToday === 1 ? "" : "s"} left today and these need ${cost}. Remove ${short} photo${short === 1 ? "" : "s"} or upgrade.`
              : `You need ${short} more credit${short === 1 ? "" : "s"} to generate these ${items.length} design${items.length === 1 ? "" : "s"}.`
          }</p>`
        : ""
    }

    ${
      (model.notes || "").trim()
        ? `<p class="rdd-rnotes"><b>Shared Instructions</b><span>${esc(model.notes)}</span></p>`
        : ""
    }

    <div class="rdd-rgroups">${groups.map((g) => reviewGroupHtml(ctx, model, g)).join("")}</div>

    <div class="rv-gridfoot">
      <div class="rv-count">${
        blockers.length
          ? `<ul class="rdd-blocks">${blockers.map((b) => `<li><i data-lucide="alert-circle"></i>${esc(b)}</li>`).join("")}</ul>`
          : `<span>Generates one design for each of ${items.length} photo${items.length === 1 ? "" : "s"} · ${cost} credit${cost === 1 ? "" : "s"}</span>`
      }</div>
      <div class="rv-gridfoot-a">
        <button class="btn btn-ghost" id="rddEditPhotos">Edit Photos</button>
        <button class="btn btn-ghost" id="rddEditDesign">Edit Design</button>
        <button class="btn btn-primary" id="rddGenerate"${blockers.length ? ' disabled aria-disabled="true"' : ""}>Generate ${items.length} Design${items.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  </div>`;
}

export function bindReviewStep(root, ctx) {
  const p = root.querySelector("#rddEditPhotos");
  if (p) p.onclick = () => ctx.onEditPhotos && ctx.onEditPhotos();
  const d = root.querySelector("#rddEditDesign");
  if (d) d.onclick = () => ctx.onEditDesign && ctx.onEditDesign();
  root.querySelectorAll("[data-reviewedit]").forEach((b) => {
    b.onclick = () => {
      const what = b.getAttribute("data-reviewedit");
      if (what === "design") ctx.onEditDesign && ctx.onEditDesign();
      else if (what === "format") ctx.onEditFormat && ctx.onEditFormat();
      else ctx.onEditPhotos && ctx.onEditPhotos();
    };
  });
  const g = root.querySelector("#rddGenerate");
  if (g)
    g.onclick = () => {
      if (g.disabled) return;
      g.disabled = true;
      ctx.onGenerate && ctx.onGenerate();
    };
}

