/**
 * Selected / saved product store for Shop the Design.
 *
 * Products chosen in the shopping workspace are stored here and surfaced by
 * the existing Products page and Scope & Budget rollups. No parallel products
 * page is created; this is the record layer behind the existing one.
 *
 * Storage is per device (localStorage) until a products table is provisioned.
 */

import type { NormalizedProduct, ProductStatus } from "@/lib/product-catalog";

export interface ProjectProduct extends NormalizedProduct {
  recordId: string;
  status: ProductStatus;
  quantity: number;
  propertyId: string;
  propertyLabel: string;
  roomId: string;
  roomLabel: string;
  designId: string;
  designLabel: string;
  hotspotId: string;
  detectedCategory: string;
  phase: string;
  budgetCategory: string;
  notes: string;
  dnaScope: "none" | "property" | "rooms" | "room";
  addedAt: string;
  priceHistory: Array<{ at: string; price: number | null }>;
  availabilityHistory: Array<{ at: string; availability: string }>;
}

const KEY = "rd.projectProducts.v1";

function read(): ProjectProduct[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(list: ProjectProduct[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent("rd:products"));
  } catch {
    /* no window */
  }
}

export function listProducts(): ProjectProduct[] {
  return read();
}

export interface AddInput {
  product: NormalizedProduct;
  status: ProductStatus;
  quantity: number;
  propertyId: string;
  propertyLabel: string;
  roomId: string;
  roomLabel: string;
  designId: string;
  designLabel: string;
  hotspotId: string;
  detectedCategory: string;
  phase: string;
  budgetCategory: string;
  notes: string;
  dnaScope: ProjectProduct["dnaScope"];
}

function dedupeKey(p: { roomId: string; designId: string; merchant: string; merchantProductId: string }) {
  return [p.roomId, p.designId, p.merchant, p.merchantProductId].join("|").toLowerCase();
}

/** Adds or updates a product on the project. Never duplicates the same SKU on the same room + design. */
export function addProduct(input: AddInput): { record: ProjectProduct; duplicate: boolean } {
  const list = read();
  const price = input.product.salePrice ?? input.product.regularPrice ?? null;
  const now = new Date().toISOString();
  const key = dedupeKey({
    roomId: input.roomId,
    designId: input.designId,
    merchant: input.product.merchant,
    merchantProductId: input.product.merchantProductId,
  });
  const existing = list.find((r) => dedupeKey(r) === key);
  if (existing) {
    existing.quantity = input.quantity;
    existing.status = input.status;
    existing.notes = input.notes || existing.notes;
    existing.phase = input.phase;
    existing.budgetCategory = input.budgetCategory;
    existing.dnaScope = input.dnaScope;
    existing.priceHistory.push({ at: now, price });
    write(list);
    return { record: existing, duplicate: true };
  }
  const record: ProjectProduct = {
    ...input.product,
    recordId: "pp-" + Math.random().toString(36).slice(2, 10),
    status: input.status,
    quantity: input.quantity,
    propertyId: input.propertyId,
    propertyLabel: input.propertyLabel,
    roomId: input.roomId,
    roomLabel: input.roomLabel,
    designId: input.designId,
    designLabel: input.designLabel,
    hotspotId: input.hotspotId,
    detectedCategory: input.detectedCategory,
    phase: input.phase,
    budgetCategory: input.budgetCategory,
    notes: input.notes,
    dnaScope: input.dnaScope,
    addedAt: now,
    priceHistory: [{ at: now, price }],
    availabilityHistory: [{ at: now, availability: input.product.availability }],
  };
  list.push(record);
  write(list);
  return { record, duplicate: false };
}

export function setStatus(recordId: string, status: ProductStatus) {
  const list = read();
  const rec = list.find((r) => r.recordId === recordId);
  if (!rec) return;
  rec.status = status;
  rec.availabilityHistory.push({ at: new Date().toISOString(), availability: rec.availability });
  write(list);
}

export function removeProduct(recordId: string) {
  write(read().filter((r) => r.recordId !== recordId));
}

/** Product selections for one room, shared across every photo/angle of that room. */
export function roomSelections(roomId: string): ProjectProduct[] {
  return read().filter((r) => r.roomId === roomId);
}

/** Category selections already locked for a room, used for multi-view consistency. */
export function lockedCategories(roomId: string): string[] {
  return Array.from(new Set(roomSelections(roomId).map((r) => r.detectedCategory)));
}

export interface BudgetRollup {
  subtotal: number;
  tax: number;
  delivery: number;
  contingency: number;
  total: number;
  count: number;
}

/** Estimated rollup. Tax and delivery are estimates until a retailer quote exists. */
export function budgetRollup(filter?: (r: ProjectProduct) => boolean): BudgetRollup {
  const list = read().filter((r) => (filter ? filter(r) : true)).filter((r) => r.status !== "saved");
  const subtotal = list.reduce((n, r) => n + (r.salePrice ?? r.regularPrice ?? 0) * (r.quantity || 1), 0);
  const tax = subtotal * 0.08;
  const delivery = list.length ? Math.min(750, 45 * list.length) : 0;
  const contingency = subtotal * 0.1;
  return { subtotal, tax, delivery, contingency, total: subtotal + tax + delivery + contingency, count: list.length };
}

export const STATUS_LABEL: Record<ProductStatus, string> = {
  saved: "Saved",
  selected: "Selected",
  approved: "Approved",
  needs_replacement: "Needs Replacement",
  unavailable: "Unavailable",
};
