/**
 * REAL DESIGNS — Structured markup callouts.
 *
 * A callout is not a sentence painted on a photograph: it is a record. A
 * renovation note keeps its existing condition, proposed change, priority,
 * budget category and scope reference as separate fields, so the same markup
 * can drive a contractor-scope export, a budget line and a presentation slide
 * without anyone retyping it. The drawn label is only a rendering of the record.
 */

export type CalloutKind = "renovation" | "product" | "material" | "before_after" | "scope";

export type Priority = "must" | "should" | "nice";

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "must", label: "Must Do" },
  { id: "should", label: "Should Do" },
  { id: "nice", label: "Nice To Have" },
];

export const BUDGET_CATEGORIES = [
  "Structural",
  "Kitchen",
  "Bathroom",
  "Flooring",
  "Paint & Finishes",
  "Lighting",
  "Landscaping",
  "Exterior",
  "Staging",
  "Other",
];

export type RenovationCallout = {
  kind: "renovation";
  existingCondition: string;
  proposedChange: string;
  priority: Priority;
  budgetCategory: string;
  scopeReference: string;
  /** Linked record in the Budget module, when one exists. */
  budgetItemId?: string | null;
};

export type ProductCallout = {
  kind: "product";
  productName: string;
  productImage?: string | null;
  retailer?: string | null;
  price?: number | null;
  currency?: string;
  /** Linked record in the Products module / product board. */
  productId?: string | null;
  productBoardId?: string | null;
  url?: string | null;
};

export type MaterialCallout = {
  kind: "material";
  surface: string;
  material: string;
  color?: string | null;
  finish?: string | null;
  materialBoardId?: string | null;
};

export type BeforeAfterCallout = {
  kind: "before_after";
  before: string;
  after: string;
  /** Asset keys of the two versions being compared, when known. */
  beforeAssetKey?: string | null;
  afterAssetKey?: string | null;
};

export type ScopeCallout = {
  kind: "scope";
  scopeReference: string;
  trade?: string | null;
  notes?: string | null;
  /** Presentation slide this callout appears on, when linked. */
  presentationId?: string | null;
};

export type CalloutMeta =
  | RenovationCallout
  | ProductCallout
  | MaterialCallout
  | BeforeAfterCallout
  | ScopeCallout;

export const SURFACES = [
  "Floor",
  "Wall",
  "Ceiling",
  "Countertop",
  "Backsplash",
  "Cabinetry",
  "Roof",
  "Siding",
  "Driveway",
  "Deck",
];

/* --------------------------------------------------------------- creation */

export function emptyCallout(kind: CalloutKind): CalloutMeta {
  switch (kind) {
    case "renovation":
      return {
        kind,
        existingCondition: "",
        proposedChange: "",
        priority: "should",
        budgetCategory: "Other",
        scopeReference: "",
        budgetItemId: null,
      };
    case "product":
      return {
        kind,
        productName: "",
        productImage: null,
        retailer: null,
        price: null,
        currency: "USD",
        productId: null,
        productBoardId: null,
        url: null,
      };
    case "material":
      return { kind, surface: "Floor", material: "", color: null, finish: null, materialBoardId: null };
    case "before_after":
      return { kind, before: "", after: "", beforeAssetKey: null, afterAssetKey: null };
    default:
      return { kind: "scope", scopeReference: "", trade: null, notes: null, presentationId: null };
  }
}

/* ------------------------------------------------------------- rendering */

function money(v: number | null | undefined, currency = "USD"): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  try {
    return v.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(v).toLocaleString()}`;
  }
}

/** The single line drawn on the photograph for a structured callout. */
export function calloutLabel(meta: CalloutMeta | null | undefined, fallback = ""): string {
  if (!meta) return fallback;
  switch (meta.kind) {
    case "renovation":
      return meta.proposedChange || meta.existingCondition || fallback || "Renovation Note";
    case "product": {
      const price = money(meta.price ?? null, meta.currency || "USD");
      return [meta.productName || fallback || "Product", price].filter(Boolean).join(" · ");
    }
    case "material":
      return [meta.surface, meta.material].filter(Boolean).join(": ") || fallback || "Material";
    case "before_after":
      return meta.after ? `Before: ${meta.before} → After: ${meta.after}` : fallback || "Before / After";
    default:
      return meta.scopeReference || fallback || "Scope Reference";
  }
}

/** The multi-line body a report, slide or contractor export prints. */
export function calloutDetails(meta: CalloutMeta): { label: string; value: string }[] {
  switch (meta.kind) {
    case "renovation":
      return [
        { label: "Existing Condition", value: meta.existingCondition },
        { label: "Proposed Change", value: meta.proposedChange },
        { label: "Priority", value: PRIORITIES.find((p) => p.id === meta.priority)?.label || "" },
        { label: "Budget Category", value: meta.budgetCategory },
        { label: "Scope Reference", value: meta.scopeReference },
      ].filter((r) => r.value);
    case "product":
      return [
        { label: "Product", value: meta.productName },
        { label: "Retailer", value: meta.retailer || "" },
        { label: "Price", value: money(meta.price ?? null, meta.currency || "USD") },
        { label: "Link", value: meta.url || "" },
      ].filter((r) => r.value);
    case "material":
      return [
        { label: "Surface", value: meta.surface },
        { label: "Material", value: meta.material },
        { label: "Colour", value: meta.color || "" },
        { label: "Finish", value: meta.finish || "" },
      ].filter((r) => r.value);
    case "before_after":
      return [
        { label: "Before", value: meta.before },
        { label: "After", value: meta.after },
      ].filter((r) => r.value);
    default:
      return [
        { label: "Scope Reference", value: meta.scopeReference },
        { label: "Trade", value: meta.trade || "" },
        { label: "Notes", value: meta.notes || "" },
      ].filter((r) => r.value);
  }
}

/* ---------------------------------------------------------------- linking */

export type CalloutLink = {
  module: "products" | "budget" | "presentations";
  id: string;
};

/** Which existing record this callout points at, if any. */
export function calloutLink(meta: CalloutMeta | null | undefined): CalloutLink | null {
  if (!meta) return null;
  if (meta.kind === "product" && meta.productId) return { module: "products", id: meta.productId };
  if (meta.kind === "renovation" && meta.budgetItemId)
    return { module: "budget", id: meta.budgetItemId };
  if (meta.kind === "scope" && meta.presentationId)
    return { module: "presentations", id: meta.presentationId };
  return null;
}

/** A callout with no content is not saved: an empty pin helps nobody. */
export function calloutComplete(meta: CalloutMeta): boolean {
  return calloutDetails(meta).length > 0;
}
