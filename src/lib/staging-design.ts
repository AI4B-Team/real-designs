/**
 * Multi-photo Design step model.
 *
 * The Photos -> Design -> Review workflow is a real three-page flow, not a
 * modal: this module owns everything the Design and Review pages need to
 * decide, so the pages themselves stay presentation only and the whole draft
 * survives navigation and a refresh.
 *
 * One canonical style catalog is used here, in Explore and in the Studio
 * Redesign panel — styles are always referenced by catalog id, never by a
 * second parallel list.
 */
/* eslint-disable */
// @ts-nocheck
import { roomSpace } from "@/lib/staging-rooms";
import { STYLES, styleById } from "@/lib/style-catalog";
import { BULK_CREDIT_PER_PHOTO, styleFitsSpace } from "@/lib/staging-bulk";

export const SPACE_LABEL = {
  interior: "Interior",
  exterior: "Exterior",
  landscape: "Garden",
  unassigned: "Room Type Needed",
};

const SPACE_ORDER = { interior: 0, exterior: 1, landscape: 2, unassigned: 3 };

/** How much of the space may change. Plain language, never jargon. */
export const DESIGN_DIRECTIONS = [
  {
    id: "refresh",
    label: "Refresh",
    badge: "Light Changes",
    note: "Keep the existing layout and major finishes while updating furniture, styling, décor and paint.",
  },
  {
    id: "makeover",
    label: "Makeover",
    badge: "Recommended",
    note: "Keep walls and layout while allowing furniture, colors, fixtures and surface finishes to change.",
  },
  {
    id: "renovation",
    label: "Renovation",
    badge: "Major Changes",
    note: "Allow cabinetry, counters, fixtures, flooring and materials to be replaced while preserving the basic room structure.",
  },
  {
    id: "reimagine",
    label: "Reimagine",
    badge: "Full Concept",
    note: "Create a substantially new concept within the property's existing structural shell.",
  },
];

/**
 * Finish grade. "Budget" wording is intentionally avoided app-wide, so the
 * entry level reads as "Essential" — this is not the suppressed Budget
 * planning feature.
 */
export const FINISH_GRADES = [
  { id: "essential", label: "Essential", note: "Clean, practical, cost-conscious materials." },
  {
    id: "standard",
    label: "Standard",
    badge: "Most Popular",
    note: "Mainstream retail finishes with broad availability.",
  },
  { id: "premium", label: "Premium", note: "Designer finishes and higher-quality materials." },
  { id: "luxury", label: "Luxury", note: "High-end, custom-grade finishes and details." },
];

/** Render-payload wording for each choice. */
const INTENSITY_TEXT = {
  refresh: "Refresh",
  makeover: "Makeover",
  renovation: "Full Remodel",
  reimagine: "Reimagine",
};
const GRADE_TEXT = {
  essential: "Rental Grade",
  standard: "Retail Grade",
  premium: "Premium Grade",
  luxury: "Luxury Grade",
};

export function newDesignModel() {
  return {
    styleBySpace: {},
    overrides: {},
    direction: "makeover",
    /* Structure protection is a safety constraint, so it defaults on. */
    preserve: true,
    grade: "standard",
    notes: "",
    notesByPhoto: {},
  };
}

/** Accepts anything a stored draft may hold and returns a usable model. */
export function normalizeDesignModel(raw) {
  const base = newDesignModel();
  if (!raw || typeof raw !== "object") return base;
  const dir = DESIGN_DIRECTIONS.some((d) => d.id === raw.direction) ? raw.direction : base.direction;
  const grade = FINISH_GRADES.some((g) => g.id === raw.grade) ? raw.grade : base.grade;
  return {
    styleBySpace: Object.assign({}, raw.styleBySpace || {}),
    overrides: Object.assign({}, raw.overrides || {}),
    direction: dir,
    preserve: raw.preserve !== false,
    grade,
    notes: String(raw.notes || ""),
    notesByPhoto: Object.assign({}, raw.notesByPhoto || {}),
  };
}

export function spaceOf(item) {
  const room = String((item && item.room) || "").trim();
  return room ? roomSpace(room) : "unassigned";
}

/** Selected photos grouped by space category, in a stable order. */
export function designGroups(items) {
  const map = new Map();
  (items || []).forEach((it) => {
    const s = spaceOf(it);
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(it);
  });
  return Array.from(map.entries())
    .map(([space, list]) => ({
      space,
      label: SPACE_LABEL[space] || "Interior",
      items: list,
    }))
    .sort((a, b) => (SPACE_ORDER[a.space] ?? 9) - (SPACE_ORDER[b.space] ?? 9));
}

/** The style that actually drives one photo: its override, else its group. */
export function effectiveStyleId(model, item) {
  const m = model || {};
  const own = (m.overrides || {})[item && item.key];
  if (own) return own;
  return (m.styleBySpace || {})[spaceOf(item)] || "";
}

export function hasOverride(model, item) {
  return !!((model && model.overrides) || {})[item && item.key];
}

/** The free-text instruction written for one specific photo, if any. */
export function photoNote(model, item) {
  const map = (model && model.notesByPhoto) || {};
  return String(map[item && item.key] || "").trim();
}

/** A photo is customized when it has its own style, its own note, or both. */
export function hasCustomization(model, item) {
  return hasOverride(model, item) || !!photoNote(model, item);
}


/** Styles offered for a space, compatible ones only. */
export function compatibleStyles(space) {
  return STYLES.filter((s) => s.isActive !== false && styleFitsSpace(s.id, space));
}

/**
 * Drop only the style choices a room-type change made impossible. Everything
 * else — direction, grade, protection, instructions, other groups — is kept,
 * and the caller is told exactly what has to be picked again.
 */
export function pruneIncompatible(model, items) {
  const next = normalizeDesignModel(model);
  const cleared = [];
  const spaces = new Set((items || []).map(spaceOf));
  Object.keys(next.styleBySpace).forEach((space) => {
    const id = next.styleBySpace[space];
    if (!id) return;
    if (!spaces.has(space)) return; /* group no longer present: harmless */
    if (!styleFitsSpace(id, space)) {
      delete next.styleBySpace[space];
      const rec = styleById(id);
      cleared.push(
        `${(rec && rec.displayName) || "That style"} cannot be used on ${(SPACE_LABEL[space] || space).toLowerCase()} photos. Choose a ${(SPACE_LABEL[space] || space).toLowerCase()} style again.`,
      );
    }
  });
  (items || []).forEach((it) => {
    const id = next.overrides[it.key];
    if (!id) return;
    if (!styleFitsSpace(id, spaceOf(it))) {
      delete next.overrides[it.key];
      cleared.push(
        `${it.room || "A photo"} no longer matches its own style, so it uses the group style again.`,
      );
    }
  });
  return { model: next, cleared };
}

export function creditCost(items) {
  return (items || []).length * BULK_CREDIT_PER_PHOTO;
}

/** Everything that stops the Photos step from advancing, in plain words. */
export function photosBlockers(items) {
  const out = [];
  const sel = (items || []).filter((i) => i.selected);
  if (!sel.length) out.push("Select at least one photo.");
  if (sel.some((i) => i.status === "uploading")) out.push("Wait for every upload to finish.");
  if (sel.some((i) => i.status === "failed"))
    out.push("Retry or remove the photos that failed to upload.");
  const missing = sel.filter((i) => !String(i.room || "").trim()).length;
  if (missing)
    out.push(
      `Set a room or area for ${missing} photo${missing === 1 ? "" : "s"} before choosing a style.`,
    );
  return out;
}

/** Everything that stops the Design step from advancing. */
export function designBlockers(items, model) {
  const out = [];
  const groups = designGroups(items || []);
  if (!groups.length) return ["Select at least one photo."];
  groups.forEach((g) => {
    if (g.space === "unassigned") {
      out.push(`Set a room or area for ${g.items.length} photo${g.items.length === 1 ? "" : "s"}.`);
      return;
    }
    const missing = g.items.filter((it) => !effectiveStyleId(model, it));
    if (missing.length)
      out.push(
        `Choose a style for ${missing.length} ${g.label} photo${missing.length === 1 ? "" : "s"}.`,
      );
    const unfit = g.items.filter((it) => {
      const id = effectiveStyleId(model, it);
      return id && !styleFitsSpace(id, g.space);
    });
    if (unfit.length) out.push(`Choose a compatible style for the ${g.label} photos.`);
  });
  return out;
}

/**
 * Per-category completion, the applies-to breakdown and the canonical style
 * id. The Design page renders straight from this, so what the user sees, the
 * draft and the id sent to generation can never drift apart.
 */
export function categoryStatus(items, model) {
  const m = normalizeDesignModel(model);
  return designGroups(items || []).map((g) => {
    const styleId = g.space === "unassigned" ? "" : m.styleBySpace[g.space] || "";
    const rooms = [];
    g.items.forEach((it) => {
      const room = String(it.room || "").trim() || "Room Type Needed";
      const hit = rooms.find((r) => r.room === room);
      if (hit) hit.count += 1;
      else rooms.push({ room, count: 1 });
    });
    const missing = g.items.filter((it) => !effectiveStyleId(m, it)).length;
    return {
      space: g.space,
      label: g.label,
      items: g.items,
      count: g.items.length,
      styleId,
      styleName: styleName(styleId),
      rooms,
      missing,
      complete: g.space !== "unassigned" && missing === 0,
    };
  });
}

/**
 * One readable sentence for the footer. Several missing categories collapse
 * into a single "Choose styles for Interior and Exterior photos." line.
 */
export function designBlockerSummary(items, model) {
  const cats = categoryStatus(items, model);
  if (!cats.length) return "Select at least one photo.";
  const unassigned = cats.find((c) => c.space === "unassigned");
  if (unassigned)
    return `Set a room or area for ${unassigned.count} photo${unassigned.count === 1 ? "" : "s"}.`;
  const need = cats.filter((c) => !c.complete);
  if (!need.length) return null;
  if (need.length === 1) {
    const c = need[0];
    return `Choose a style for ${c.missing} ${c.label} photo${c.missing === 1 ? "" : "s"}.`;
  }
  const names = need.map((c) => c.label);
  const list = names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  return `Choose styles for ${list} photos.`;
}

/** Removes the style for exactly one category; other categories are untouched. */
export function clearCategoryStyle(model, space) {
  const next = normalizeDesignModel(model);
  delete next.styleBySpace[space];
  return next;
}



/**
 * Everything that keeps the final Generate action disabled. Every entry is
 * shown beside the button, so a disabled state is never unexplained.
 */
export function reviewBlockers(input) {
  const { items, model, balance, uploading, plan, remainingToday } = input || {};
  const out = photosBlockers((items || []).map((i) => ({ ...i, selected: true })));
  designBlockers(items, model).forEach((m) => {
    if (out.indexOf(m) === -1) out.push(m);
  });
  if (uploading) out.push("Wait for every upload to finish.");
  const cost = creditCost(items);
  /* The free plan spends a daily design allowance, not the credit balance, so
     a zero balance is not a blocker there — running out of the day's designs is. */
  if (plan === "free") {
    if (typeof remainingToday === "number" && remainingToday < cost) {
      out.push(
        remainingToday > 0
          ? `Only ${remainingToday} free design${remainingToday === 1 ? "" : "s"} left today. Remove ${cost - remainingToday} photo${cost - remainingToday === 1 ? "" : "s"} or upgrade.`
          : "You've used all 5 free designs for today. They reset tomorrow, or upgrade for a credit balance.",
      );
    }
  } else if (typeof balance === "number" && balance < cost) {
    const short = cost - balance;
    out.push(`You need ${short} more credit${short === 1 ? "" : "s"} to generate ${cost === 1 ? "this design" : cost + " designs"}.`);
  }
  return out.filter((m, i) => out.indexOf(m) === i);
}


export function canEnterDesign(items) {
  return photosBlockers(items).length === 0;
}

export function canEnterReview(items, model) {
  const sel = (items || []).filter((i) => i.selected);
  return canEnterDesign(items) && designBlockers(sel, model).length === 0;
}

/**
 * The exact render direction the batch will run with. Per-space and per-photo
 * style choices both travel with it, so the chosen styles always reach the
 * backend generation request.
 */
export function toDirection(model, items, outputRatio) {
  const m = normalizeDesignModel(model);
  const styleBySpace = {};
  Object.keys(m.styleBySpace).forEach((space) => {
    const rec = styleById(m.styleBySpace[space]);
    if (rec) styleBySpace[space] = { id: rec.id, name: rec.displayName };
  });
  const styleByPhoto = {};
  Object.keys(m.overrides).forEach((key) => {
    const rec = styleById(m.overrides[key]);
    if (rec) styleByPhoto[key] = { id: rec.id, name: rec.displayName };
  });
  /* A single shared style is still sent as the top-level direction so the
     payload reads the same as a one-photo Studio render. */
  const ids = Array.from(
    new Set((items || []).map((it) => effectiveStyleId(m, it)).filter(Boolean)),
  );
  const shared = ids.length === 1 ? styleById(ids[0]) : null;
  return {
    styleId: shared ? shared.id : null,
    direction: shared ? shared.displayName : null,
    styleBySpace,
    styleByPhoto,
    intensity: INTENSITY_TEXT[m.direction] || "Makeover",
    grade: GRADE_TEXT[m.grade] || "Retail Grade",
    preserve: m.preserve !== false,
    notes: (m.notes || "").trim() || null,
    notesByPhoto: m.notesByPhoto || {},
    outputRatio: outputRatio || null,
  };
}

export function directionLabel(id) {
  const hit = DESIGN_DIRECTIONS.find((d) => d.id === id);
  return hit ? hit.label : "Makeover";
}

export function gradeLabel(id) {
  const hit = FINISH_GRADES.find((g) => g.id === id);
  return hit ? hit.label : "Standard";
}

export function styleName(id) {
  const rec = styleById(id);
  return rec ? rec.displayName : "";
}

/* ------------------------------------------------------- state assertions
   Design Direction and Finish Grade are single canonical fields on the draft
   model (`direction`, `grade`). Everything — the selected card, the saved
   draft, the Review summary and the generation request — reads from them.
   In development a disagreement is reported loudly instead of shipping a
   screen that says "Makeover" while it renders "Refresh". */

const DEV = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export function assertDesignState(where, model, observed = {}) {
  if (!DEV) return true;
  const m = normalizeDesignModel(model);
  const bad = [];
  if (observed.direction != null && observed.direction !== m.direction)
    bad.push(`direction: ${where} shows "${observed.direction}", draft holds "${m.direction}"`);
  if (observed.grade != null && observed.grade !== m.grade)
    bad.push(`grade: ${where} shows "${observed.grade}", draft holds "${m.grade}"`);
  if (observed.preserve != null && observed.preserve !== (m.preserve !== false))
    bad.push(`structure protection: ${where} disagrees with the draft`);
  if (bad.length) console.warn("[design-state]", bad.join(" · "));
  return bad.length === 0;
}

/** What the rendered radio groups currently claim, for the assertion above. */
export function readDesignSelection(root) {
  const on = (sel) => {
    const el = root && root.querySelector(sel);
    return el ? el.getAttribute(sel.includes("dir") ? "data-dir" : "data-grade") : null;
  };
  const pres = root && root.querySelector("#rddPreserve");
  return {
    direction: on('[data-dir][aria-checked="true"]'),
    grade: on('[data-grade][aria-checked="true"]'),
    preserve: pres ? !!pres.checked : null,
  };
}

/** The direction/grade a payload from `toDirection` encodes, mapped back. */
export function directionFromPayload(payload) {
  const inv = (map) =>
    Object.keys(map).find((k) => map[k] === (payload || {})[map === INTENSITY_TEXT ? "intensity" : "grade"]) || null;
  return { direction: inv(INTENSITY_TEXT), grade: inv(GRADE_TEXT) };
}

/**
 * Shared instructions and a per-photo instruction are additive: the photo note
 * refines the shared one instead of silently replacing it.
 */
export function combineNotes(shared, perPhoto) {
  const parts = [shared, perPhoto].map((v) => String(v || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}
