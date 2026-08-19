/**
 * Canvas style selection: which tools need a style, and where that choice lives.
 *
 * Three scopes stack, narrowest first: a per-photo override, then the project
 * direction, then the property Design DNA. Writing an override never rewrites
 * the wider scopes — a single photo can differ without changing what every
 * other room inherits. Redesign and Stage keep separate selections, because a
 * staging style furnishes a room while a design direction restyles it.
 *
 * Everything here is pure apart from the two localStorage helpers at the end,
 * so the resolution rules can be tested without a DOM.
 */

import { styleById, type StyleRecord } from "@/lib/style-catalog";

/** Which kind of style a tool requires, or null when it needs none. */
export type StyleNeed = "design" | "stage";

/** Narrowest scope wins. */
export type StyleScope = "photo" | "project" | "property";

export type DirectionStore = {
  photo: Record<string, string>;
  project: Record<string, string>;
  property: Record<string, string>;
};

export type DirectionContext = {
  need: StyleNeed;
  draftId?: string | null;
  photoKey?: string | null;
  propertyId?: string | null;
};

export type ResolvedDirection = { styleId: string; scope: StyleScope };

export const STORAGE_KEY = "rd_canvas_direction";

/** Tools that restyle a space need a direction; utility tools do not. */
export function styleNeedForTool(tool?: string | null): StyleNeed | null {
  const t = String(tool || "")
    .trim()
    .toLowerCase();
  if (t === "redesign") return "design";
  if (t === "virtual stage" || t === "stage") return "stage";
  /* Declutter, Multi Angle and the other utility tools change the photo
     without choosing a look, and Materials has its own material controls. */
  return null;
}

export function sectionTitle(need: StyleNeed): string {
  return need === "stage" ? "Staging Style" : "Design Direction";
}

export function browserTitle(need: StyleNeed): string {
  return need === "stage" ? "Choose A Staging Style" : "Choose A Design Direction";
}

export function browserSubtitle(need: StyleNeed, room?: string | null): string {
  const where = room ? `this ${String(room).toLowerCase()}` : "the room on the canvas";
  return need === "stage"
    ? `Furniture and decor only — the selected style is adapted to ${where}, and walls, windows and permanent architecture stay exactly as photographed.`
    : `Finishes, colors and architectural styling — the selected direction is adapted to ${where} rather than copied onto it.`;
}

export function emptyStore(): DirectionStore {
  return { photo: {}, project: {}, property: {} };
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Keys carry the need so a photo can hold a design direction and a staging style. */
export function photoDirectionKey(
  need: StyleNeed,
  draftId?: string | null,
  photoKey?: string | null,
): string {
  return `${need}|${clean(draftId) || "-"}|${clean(photoKey) || "-"}`;
}
export function projectDirectionKey(need: StyleNeed, draftId?: string | null): string {
  return `${need}|${clean(draftId) || "-"}`;
}
export function propertyDirectionKey(need: StyleNeed, propertyId?: string | null): string {
  return `${need}|${clean(propertyId) || "-"}`;
}

function keyFor(store: DirectionStore, scope: StyleScope, ctx: DirectionContext): string {
  void store;
  if (scope === "photo") return photoDirectionKey(ctx.need, ctx.draftId, ctx.photoKey);
  if (scope === "project") return projectDirectionKey(ctx.need, ctx.draftId);
  return propertyDirectionKey(ctx.need, ctx.propertyId);
}

/** A stored id is only honoured while the catalog still knows it. */
function validId(id?: string | null): string {
  const rec = styleById(clean(id));
  return rec ? rec.id : "";
}

/**
 * Narrowest confirmed selection for this context, or null.
 *
 * A per-photo override is only consulted when there is a photo to key it to,
 * so the generic canvas never inherits another photo's override.
 */
export function resolveDirection(
  store: DirectionStore,
  ctx: DirectionContext,
): ResolvedDirection | null {
  const s = store || emptyStore();
  const order: StyleScope[] = ["photo", "project", "property"];
  for (const scope of order) {
    if (scope === "photo" && !clean(ctx.photoKey)) continue;
    if (scope === "property" && !clean(ctx.propertyId)) continue;
    const id = validId(s[scope]?.[keyFor(s, scope, ctx)]);
    if (id) return { styleId: id, scope };
  }
  return null;
}

/** The property Design DNA on its own, so the UI can offer keep-or-override. */
export function propertyDirection(store: DirectionStore, ctx: DirectionContext): string {
  if (!clean(ctx.propertyId)) return "";
  return validId(store?.property?.[propertyDirectionKey(ctx.need, ctx.propertyId)]);
}

export function setDirection(
  store: DirectionStore,
  scope: StyleScope,
  ctx: DirectionContext,
  styleId: string,
): DirectionStore {
  const id = validId(styleId);
  const next: DirectionStore = {
    photo: { ...(store?.photo || {}) },
    project: { ...(store?.project || {}) },
    property: { ...(store?.property || {}) },
  };
  if (!id) return next;
  next[scope][keyFor(next, scope, ctx)] = id;
  return next;
}

export function clearDirection(
  store: DirectionStore,
  scope: StyleScope,
  ctx: DirectionContext,
): DirectionStore {
  const next: DirectionStore = {
    photo: { ...(store?.photo || {}) },
    project: { ...(store?.project || {}) },
    property: { ...(store?.property || {}) },
  };
  delete next[scope][keyFor(next, scope, ctx)];
  return next;
}

/** "Apply this direction to all selected photos" — only the keys passed in. */
export function applyToPhotos(
  store: DirectionStore,
  need: StyleNeed,
  draftId: string | null | undefined,
  photoKeys: string[],
  styleId: string,
): DirectionStore {
  const id = validId(styleId);
  const next: DirectionStore = {
    photo: { ...(store?.photo || {}) },
    project: { ...(store?.project || {}) },
    property: { ...(store?.property || {}) },
  };
  if (!id) return next;
  (photoKeys || [])
    .filter((k) => clean(k))
    .forEach((k) => {
      next.photo[photoDirectionKey(need, draftId, k)] = id;
    });
  return next;
}

/** Human label for where a selection came from. */
export function scopeLabel(scope: StyleScope): string {
  if (scope === "photo") return "This Photo";
  if (scope === "project") return "This Project";
  return "Property Direction";
}

/** Styles that make sense for the current tool and space, catalog order. */
export function stylesForNeed(
  all: StyleRecord[],
  need: StyleNeed,
  projectType: string,
): StyleRecord[] {
  const wanted = need === "stage" ? "virtual-staging" : projectType || "interior";
  const pool = all.filter((s) => s.isActive && !s.isAuto);
  const fit = pool.filter((s) => s.compatibleProjectTypes.indexOf(wanted as any) > -1);
  return fit.length ? fit : pool;
}

/** Free text search over name, description, category, materials and mood. */
export function searchStyles(list: StyleRecord[], q: string): StyleRecord[] {
  const term = clean(q).toLowerCase();
  if (!term) return list;
  return list.filter((s) =>
    [
      s.displayName,
      s.shortDescription,
      s.category,
      ...(s.materials || []),
      ...(s.mood || []),
      ...(s.definingFeatures || []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}

/**
 * A style is only locked when the catalog genuinely marks it as plan-gated.
 * Nothing in the shipped catalog is, so no badge is invented.
 */
export function styleRequiredPlan(rec: StyleRecord): string {
  return clean((rec as any).requiredPlan);
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

export function parseStore(raw: unknown): DirectionStore {
  const base = emptyStore();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;
  (["photo", "project", "property"] as StyleScope[]).forEach((scope) => {
    const bag = src[scope];
    if (!bag || typeof bag !== "object") return;
    Object.entries(bag as Record<string, unknown>).forEach(([k, v]) => {
      const id = clean(v);
      if (k && id) base[scope][k] = id;
    });
  });
  return base;
}

export function loadDirections(): DirectionStore {
  try {
    return parseStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch (_) {
    return emptyStore();
  }
}

export function saveDirections(store: DirectionStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store || emptyStore()));
  } catch (_) {
    /* storage may be blocked; the in-memory selection still works this session */
  }
}
