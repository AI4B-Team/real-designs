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
  FINISH_GRADES,
  compatibleStyles,
  creditCost,
  designBlockers,
  designGroups,
  directionLabel,
  effectiveStyleId,
  gradeLabel,
  hasOverride,
  spaceOf,
  styleName,
} from "@/lib/staging-design";
import { styleById } from "@/lib/style-catalog";

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

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

function cardHtml(rec, on, scope) {
  return `<button type="button" class="rdd-card${on ? " on" : ""}" role="radio" aria-checked="${on ? "true" : "false"}"
    data-style="${esc(rec.id)}" data-scope="${esc(scope)}">
    <span class="rdd-card-th">${
      rec.previewImage
        ? `<img src="${esc(rec.previewImage)}" alt="${esc(rec.displayName)} example" loading="lazy">`
        : ""
    }<i data-lucide="check"></i></span>
    <span class="rdd-card-t">${esc(rec.displayName)}</span>
  </button>`;
}

function photoRowHtml(model, group) {
  return `<div class="rdd-photos">${group.items
    .map((it) => {
      const id = effectiveStyleId(model, it);
      const own = hasOverride(model, it);
      return `<div class="rdd-photo${own ? " own" : ""}">
        <span class="rdd-photo-th"><img src="${esc(it.signed || it.previewUrl || "")}" alt="${esc(it.room || "Photo")}" loading="lazy"></span>
        <span class="rdd-photo-m"><b>${esc(it.room || "Room type needed")}</b>
          <em>${esc(id ? styleName(id) : "No style yet")}${own ? " · Own style" : ""}</em></span>
        <span class="rdd-photo-a">
          <button type="button" class="fb-link" data-photostyle="${esc(it.key)}">Change</button>
          ${own ? `<button type="button" class="fb-link" data-photoreset="${esc(it.key)}">Use Group Style</button>` : ""}
        </span>
      </div>`;
    })
    .join("")}</div>`;
}

function groupHtml(model, group) {
  const selected = group.space === "unassigned" ? "" : model.styleBySpace[group.space] || "";
  const cards = group.space === "unassigned" ? [] : quickCards(group.space, selected);
  return `<section class="rdd-group" data-space="${esc(group.space)}">
    <header class="rdd-group-h">
      <h3>${esc(group.label)} · ${group.items.length} Photo${group.items.length === 1 ? "" : "s"}</h3>
      ${
        group.space === "unassigned"
          ? `<span class="rdd-warn"><i data-lucide="alert-circle"></i>Set a room or area on the Photos step first.</span>`
          : `<button type="button" class="fb-link rdd-all" data-viewall="${esc(group.space)}">View All Styles</button>`
      }
    </header>
    ${
      group.space === "unassigned"
        ? ""
        : `<div class="rdd-cards" role="radiogroup" aria-label="${esc(group.label)} styles">${cards
            .map((rec) => cardHtml(rec, rec.id === selected, group.space))
            .join("")}</div>`
    }
    ${photoRowHtml(model, group)}
  </section>`;
}

/** The full Design page body. */
export function designStepHtml(ctx) {
  const items = ctx.items || [];
  const model = ctx.model;
  const groups = designGroups(items);
  const blockers = designBlockers(items, model);
  return `<div class="rdd-page">
    <div class="rdd-intro">
      <h2>Choose a Design Style</h2>
      <p>Choose one shared direction or customize styles for different spaces.</p>
    </div>
    <div class="rdd-groups">${groups.map((g) => groupHtml(model, g)).join("")}</div>

    <section class="rdd-shared">
      <h3>Design Direction</h3>
      <div class="rdd-opts" role="radiogroup" aria-label="Design direction">
        ${DESIGN_DIRECTIONS.map(
          (d) => `<button type="button" class="rdd-opt${model.direction === d.id ? " on" : ""}" role="radio"
            aria-checked="${model.direction === d.id ? "true" : "false"}" data-dir="${esc(d.id)}">
            <b>${esc(d.label)}</b><em>${esc(d.note)}</em></button>`,
        ).join("")}
      </div>

      <h3>Structure Protection</h3>
      <label class="rdd-chk"><input type="checkbox" id="rddPreserve"${model.preserve !== false ? " checked" : ""}>
        <span>Keep walls, windows, doors, and layout unchanged</span></label>

      <h3>Finish Grade</h3>
      <div class="rdd-opts grade" role="radiogroup" aria-label="Finish grade">
        ${FINISH_GRADES.map(
          (g) => `<button type="button" class="rdd-opt${model.grade === g.id ? " on" : ""}" role="radio"
            aria-checked="${model.grade === g.id ? "true" : "false"}" data-grade="${esc(g.id)}">
            <b>${esc(g.label)}</b><em>${esc(g.note)}</em></button>`,
        ).join("")}
      </div>

      <h3>Shared Instructions <em class="rdd-optional">Optional</em></h3>
      <textarea id="rddNotes" rows="3" placeholder="Example: Warm oak floors, neutral colors, matte black fixtures.">${esc(model.notes || "")}</textarea>
    </section>

    <div class="rv-gridfoot">
      <div class="rv-count">${
        blockers.length
          ? `<span class="rdd-block"><i data-lucide="alert-circle"></i>${esc(blockers[0])}</span>`
          : `<span>${items.length} photo${items.length === 1 ? "" : "s"} · ${creditCost(items)} credit${creditCost(items) === 1 ? "" : "s"} at Review</span>`
      }</div>
      <div class="rv-gridfoot-a">
        <button class="btn btn-ghost" id="rddBack">Back</button>
        <button class="btn btn-primary" id="rddNext"${blockers.length ? ' disabled aria-disabled="true"' : ""}>Next: Review</button>
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
  root.querySelectorAll("[data-dir]").forEach((b) => {
    b.onclick = () => {
      model.direction = b.getAttribute("data-dir");
      changed();
    };
  });
  root.querySelectorAll("[data-grade]").forEach((b) => {
    b.onclick = () => {
      model.grade = b.getAttribute("data-grade");
      changed();
    };
  });
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

function reviewGroupHtml(model, group) {
  return `<section class="rdd-rgroup">
    <h3>${esc(group.label)} · ${group.items.length} Photo${group.items.length === 1 ? "" : "s"}</h3>
    <p class="rdd-rstyle">Style: <b>${esc(styleName(model.styleBySpace[group.space]) || "Not chosen")}</b></p>
    <div class="rdd-rlist">${group.items
      .map((it, i) => {
        const id = effectiveStyleId(model, it);
        const own = hasOverride(model, it);
        return `<div class="rdd-rrow">
          <span class="rdd-rn">${i + 1}</span>
          <span class="rdd-photo-th"><img src="${esc(it.signed || it.previewUrl || "")}" alt="${esc(it.room || "Photo")}" loading="lazy"></span>
          <span class="rdd-photo-m"><b>${esc(it.room || "Room type needed")}</b>
            <em>${esc(styleName(id) || "No style")}${own ? " · Own style" : ""}</em></span>
        </div>`;
      })
      .join("")}</div>
  </section>`;
}

/** The full Review page body. */
export function reviewStepHtml(ctx) {
  const items = ctx.items || [];
  const model = ctx.model;
  const cost = creditCost(items);
  const blockers = ctx.blockers || [];
  const groups = designGroups(items);
  return `<div class="rdd-page rdd-review">
    <div class="rdd-intro">
      <h2>Review and Generate</h2>
      <p>This is exactly what will be generated. Nothing is charged until you generate.</p>
    </div>

    <dl class="rdd-facts">
      ${ctx.address ? `<div><dt>Property Address</dt><dd>${esc(ctx.address)}</dd></div>` : ""}
      <div><dt>Output Format</dt><dd>${esc(ctx.ratioLabel || "Original")}</dd></div>
      <div><dt>Photos</dt><dd>${items.length}</dd></div>
      <div><dt>Design Direction</dt><dd>${esc(directionLabel(model.direction))}</dd></div>
      <div><dt>Finish Grade</dt><dd>${esc(gradeLabel(model.grade))}</dd></div>
      <div><dt>Structure Protection</dt><dd>${model.preserve !== false ? "On — walls, windows and layout kept" : "Off"}</dd></div>
      <div><dt>Total Credit Cost</dt><dd>${cost} credit${cost === 1 ? "" : "s"}</dd></div>
    </dl>
    ${
      (model.notes || "").trim()
        ? `<p class="rdd-rnotes"><b>Shared Instructions</b><span>${esc(model.notes)}</span></p>`
        : ""
    }

    <div class="rdd-rgroups">${groups.map((g) => reviewGroupHtml(model, g)).join("")}</div>

    <div class="rv-gridfoot">
      <div class="rv-count">${
        blockers.length
          ? `<ul class="rdd-blocks">${blockers.map((b) => `<li><i data-lucide="alert-circle"></i>${esc(b)}</li>`).join("")}</ul>`
          : `<span>${items.length} photo${items.length === 1 ? "" : "s"} · ${cost} credit${cost === 1 ? "" : "s"}</span>`
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
  const g = root.querySelector("#rddGenerate");
  if (g)
    g.onclick = () => {
      if (g.disabled) return;
      g.disabled = true;
      ctx.onGenerate && ctx.onGenerate();
    };
}
