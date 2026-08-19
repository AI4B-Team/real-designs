/**
 * Selected / saved product store for Shop the Design.
 *
 * Products chosen in the shopping workspace are stored here and surfaced by
 * the existing Products page and Scope & Budget rollups. No parallel products
 * page is created; this is the record layer behind the existing one.
 *
 * Storage is per device (localStorage) until a products table is provisioned.
 */

import { isSampleRecord, type NormalizedProduct, type ProductStatus } from "@/lib/product-catalog";

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
  /** Renamed from budgetCategory: shopping price tier, not a renovation budget line. */
  priceTier: string;
  notes: string;
  dnaScope: "none" | "property" | "rooms" | "room";
  addedAt: string;
  priceHistory: Array<{ at: string; price: number | null }>;
  availabilityHistory: Array<{ at: string; availability: string }>;
}

const KEY = "rd.projectProducts.v1";

function read(): ProjectProduct[] {
  let v: unknown = [];
  try {
    v = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  // Legacy records used budgetCategory; sample/mock records must never surface.
  return (v as Array<ProjectProduct & { budgetCategory?: string }>)
    .filter((r) => r && !isSampleRecord(r as never))
    .map((r) => (r.priceTier ? r : { ...r, priceTier: r.budgetCategory || "" }));
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
  /** Renamed from budgetCategory: shopping price tier, not a renovation budget line. */
  priceTier: string;
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
    existing.priceTier = input.priceTier;
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
    priceTier: input.priceTier,
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

export interface ShoppingTotal {
  subtotal: number;
  count: number;
  /** products with no known price, excluded from the subtotal */
  unpriced: number;
}

/**
 * Shopping total only: the sum of real prices the user actually saved.
 * No invented tax, delivery or contingency, and never presented as a
 * renovation budget.
 */
export function shoppingTotal(filter?: (r: ProjectProduct) => boolean): ShoppingTotal {
  const list = read()
    .filter((r) => (filter ? filter(r) : true))
    .filter((r) => r.status !== "saved");
  let subtotal = 0;
  let unpriced = 0;
  list.forEach((r) => {
    const price = r.salePrice ?? r.regularPrice;
    if (typeof price === "number") subtotal += price * (r.quantity || 1);
    else unpriced++;
  });
  return { subtotal, count: list.length, unpriced };
}

export const STATUS_LABEL: Record<ProductStatus, string> = {
  saved: "Saved",
  selected: "Selected",
  approved: "Approved",
  needs_replacement: "Needs Replacement",
  unavailable: "Unavailable",
};

/* ------------------------------------------------------------------ *
 * Manually saved product links (used until a provider is connected)
 * ------------------------------------------------------------------ */

const MANUAL_KEY = "rd.manualProducts.v1";

interface ManualEntry {
  roomId: string;
  product: NormalizedProduct;
  savedAt: string;
}

function readManual(): ManualEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(MANUAL_KEY) || "[]");
    return Array.isArray(v) ? v.filter((e) => e && e.product && !isSampleRecord(e.product)) : [];
  } catch {
    return [];
  }
}

function writeManual(list: ManualEntry[]) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent("rd:products"));
  } catch {
    /* no window */
  }
}

/** Real retailer links the user saved for a room, before any provider exists. */
export function listManualProducts(roomId: string): NormalizedProduct[] {
  return readManual()
    .filter((e) => e.roomId === roomId)
    .map((e) => e.product);
}

export function saveManualProducts(roomId: string, products: NormalizedProduct[]): number {
  const list = readManual();
  const known = new Set(list.filter((e) => e.roomId === roomId).map((e) => e.product.productUrl));
  let added = 0;
  products.forEach((product) => {
    if (isSampleRecord(product) || known.has(product.productUrl)) return;
    known.add(product.productUrl);
    list.push({ roomId, product, savedAt: new Date().toISOString() });
    added++;
  });
  writeManual(list);
  return added;
}

export function removeManualProduct(roomId: string, productId: string) {
  writeManual(readManual().filter((e) => !(e.roomId === roomId && e.product.id === productId)));
}
