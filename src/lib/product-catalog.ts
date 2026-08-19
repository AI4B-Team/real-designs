/**
 * Product sourcing architecture for Shop the Design.
 *
 * This module defines the normalized product record, the provider adapter
 * interfaces (visual search, retailer feeds, object detection) and the
 * ranking/labelling rules used by the shopping workspace.
 *
 * IMPORTANT: no live retailer feed or visual-search provider is configured in
 * this environment. There is NO sample catalog: the provider returns nothing
 * and the workspace shows an honest empty state where users save real
 * retailer links or import a CSV of real products.
 */

export type MatchType = "similar" | "close" | "inspired" | "exact";
export type MatchStrength = "strong" | "good" | "alternative";
export type Availability = "in_stock" | "limited" | "backorder" | "unavailable" | "unknown";
export type ProductStatus =
  | "saved"
  | "selected"
  | "approved"
  | "needs_replacement"
  | "unavailable";

/** Normalized internal product record. Every provider adapter maps into this. */
export interface NormalizedProduct {
  id: string;
  merchant: string;
  merchantProductId: string;
  brand: string;
  sku?: undefined | string;
  gtin?: undefined | string;
  name: string;
  category: string;
  description: string;
  images: string[];
  width?: undefined | number;
  depth?: undefined | number;
  height?: undefined | number;
  unit: "in" | "cm";
  colors: string[];
  materials: string[];
  finish?: undefined | string;
  regularPrice?: undefined | number;
  salePrice?: undefined | number;
  currency: string;
  availability: Availability;
  delivery?: undefined | string;
  productUrl: string;
  affiliateUrl?: undefined | string;
  lastVerified?: undefined | string;
  source: "visual_search" | "retailer_feed" | "brand_catalog" | "user_upload" | "manual_link" | "csv_import";
  /** provider id the record came from (e.g. "manual_link", "csv_import", a feed id) */
  provider?: string | undefined;
  /** provider-scoped product id */
  externalId?: string | undefined;
  matchType: MatchType;
  matchStrength: MatchStrength;
  matchNotes: string[];
  verifiedSku: boolean;
  /** true when the record is development sample data, not a live retailer record */
  sample: boolean;
}

export interface DetectedObject {
  id: string;
  category: string;
  label: string;
  /** normalized 0-1 box over the design image */
  box: { x: number; y: number; w: number; h: number };
  origin: "auto" | "manual";
  /** 0-1 model confidence for auto objects */
  confidence?: number | undefined;
  traits?: { colors?: string[] | undefined; materials?: string[] | undefined; shape?: string | undefined } | undefined;
}

export interface VisualSearchRequest {
  imageUrl: string;
  crop: DetectedObject["box"];
  category: string;
  traits?: DetectedObject["traits"] | undefined;
  budgetBand?: string | undefined;
  deliveryTo?: string | undefined;
  query?: string | undefined;
}

/** Adapter contract for a visual-product-search provider. */
export interface VisualSearchProvider {
  id: string;
  name: string;
  configured: boolean;
  search(req: VisualSearchRequest): Promise<NormalizedProduct[]>;
}

/** Adapter contract for a retailer / affiliate-network product feed. */
export interface RetailerFeedProvider {
  id: string;
  name: string;
  configured: boolean;
  lookup(merchantProductId: string): Promise<NormalizedProduct | null>;
}

/** Adapter contract for the object-detection service. */
export interface ObjectDetectionProvider {
  id: string;
  configured: boolean;
  detect(imageUrl: string, roomType?: string, opts?: { force?: boolean }): Promise<DetectedObject[]>;
}

export function isProductSearchConfigured(): boolean {
  // Flipped on once a real visual-search provider and retailer feeds are wired.
  return false;
}

export function matchTypeLabel(t: MatchType): string {
  return t === "exact"
    ? "Exact Product"
    : t === "close"
      ? "Close Match"
      : t === "inspired"
        ? "Product-Inspired"
        : "Similar Match";
}

export function matchStrengthLabel(s: MatchStrength): string {
  return s === "strong" ? "Strong Match" : s === "good" ? "Good Match" : "Similar Alternative";
}

export function availabilityLabel(a: Availability): string {
  return a === "in_stock"
    ? "In Stock"
    : a === "limited"
      ? "Limited Stock"
      : a === "backorder"
        ? "Backordered"
        : a === "unavailable"
          ? "No Longer Available"
          : "Availability Unknown";
}

/**
 * A product may only be labelled Exact Product when it carries a verified SKU
 * asset. Anything else is downgraded, so a visually similar item is never
 * presented as the item used in the generation.
 */
export function safeMatchType(p: NormalizedProduct): MatchType {
  if (p.matchType === "exact" && !(p.verifiedSku && (p.sku || p.gtin))) return "close";
  return p.matchType;
}

export function priceOf(p: NormalizedProduct): number | null {
  const v = p.salePrice ?? p.regularPrice;
  return typeof v === "number" ? v : null;
}

const STRENGTH_RANK: Record<MatchStrength, number> = { strong: 3, good: 2, alternative: 1 };

export interface RankContext {
  budgetMax?: number | null | undefined;
  category?: string | undefined;
  colors?: string[] | undefined;
  materials?: string[] | undefined;
}

/** Ranks normalized results by match strength, category fit, price and stock. */
export function rankMatches(list: NormalizedProduct[], ctx: RankContext = {}): NormalizedProduct[] {
  return list.slice().sort((a, b) => score(b, ctx) - score(a, ctx));
}

function score(p: NormalizedProduct, ctx: RankContext): number {
  let s = STRENGTH_RANK[p.matchStrength] * 100;
  if (ctx.category && p.category === ctx.category) s += 40;
  if (ctx.colors?.some((c) => p.colors.includes(c))) s += 18;
  if (ctx.materials?.some((m) => p.materials.includes(m))) s += 18;
  if (p.availability === "in_stock") s += 14;
  if (p.availability === "unavailable") s -= 60;
  const price = priceOf(p);
  if (ctx.budgetMax && price && price > ctx.budgetMax) s -= 25;
  if (p.verifiedSku) s += 10;
  return s;
}

/* ------------------------------------------------------------------ *
 * MANUAL / IMPORTED PRODUCT SOURCES
 * There is no sample catalog. Until a real provider is connected the
 * workspace shows an honest empty state and users add real retailer links.
 * ------------------------------------------------------------------ */

export const PRODUCT_CATEGORIES: string[] = [
  "Sofa",
  "Chair",
  "Coffee Table",
  "Side Table",
  "Rug",
  "Lamp",
  "Chandelier",
  "Artwork",
  "Plant",
  "Cabinet",
  "Vanity",
  "Faucet",
  "Flooring",
  "Tile",
  "Countertop",
  "Paint Color",
];

export const PRICE_TIERS = ["Furniture", "Lighting", "Textiles", "Décor", "Fixtures", "Finishes", "Appliances", "Outdoor"];

/** No provider is connected: return nothing rather than invented inventory. */
export const unconnectedVisualSearch: VisualSearchProvider = {
  id: "none",
  name: "No Product Provider Connected",
  configured: false,
  async search() {
    return [];
  },
};

/** Active provider. Swap for a live adapter once one is configured. */
export function visualSearchProvider(): VisualSearchProvider {
  return unconnectedVisualSearch;
}

/** True when a record is development sample/mock data and must never render. */
export function isSampleRecord(p: Partial<NormalizedProduct> | null | undefined): boolean {
  if (!p) return false;
  if (p.sample === true) return true;
  const src = String(p.source ?? "");
  return src === "sample" || src === "mock" || src === "demo" || src === "placeholder";
}

/** Production guard: strips any sample/mock record before it reaches the UI. */
export function productionProducts<T extends Partial<NormalizedProduct>>(list: T[]): T[] {
  return (list || []).filter((p) => !isSampleRecord(p as never));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isValidProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export interface ManualProductInput {
  url: string;
  title?: string | undefined;
  image?: string | undefined;
  price?: number | null | undefined;
  currency?: string | undefined;
  merchant?: string | undefined;
  category?: string | undefined;
  externalId?: string | undefined;
  provider?: string | undefined;
}

/**
 * Builds a normalized record from a real retailer link the user supplied.
 * Nothing is invented: no availability, no discount, no delivery estimate,
 * and price stays null unless the user typed one.
 */
export function createManualProduct(input: ManualProductInput): NormalizedProduct {
  const url = String(input.url || "").trim();
  if (!isValidProductUrl(url)) throw new Error("Enter a valid product link starting with https://");
  const merchant = (input.merchant || hostOf(url) || "Retailer").trim();
  const price = typeof input.price === "number" && isFinite(input.price) && input.price >= 0 ? input.price : undefined;
  return {
    id: "manual-" + Math.random().toString(36).slice(2, 10),
    merchant,
    merchantProductId: String(input.externalId || url),
    brand: merchant,
    name: (input.title || "").trim() || url,
    category: input.category || "Other",
    description: "",
    images: input.image ? [input.image] : [],
    unit: "in",
    colors: [],
    materials: [],
    regularPrice: price,
    salePrice: undefined,
    currency: (input.currency || "USD").toUpperCase(),
    availability: "unknown",
    productUrl: url,
    affiliateUrl: undefined,
    lastVerified: price != null ? new Date().toISOString() : undefined,
    source: input.provider === "csv_import" ? "csv_import" : "manual_link",
    provider: input.provider || "manual_link",
    externalId: input.externalId || "",
    matchType: "similar",
    matchStrength: "alternative",
    matchNotes: ["Added manually from a retailer link."],
    verifiedSku: false,
    sample: false,
  };
}

export interface CsvParseResult {
  products: NormalizedProduct[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** Parses a user CSV of real products. Header: url,title,price,currency,image,category,merchant */
export function parseProductCsv(text: string): CsvParseResult {
  const rows = String(text || "")
    .split(/\r?\n/)
    .filter((r) => r.trim().length);
  const products: NormalizedProduct[] = [];
  const errors: string[] = [];
  if (!rows.length) return { products, errors: ["The file is empty."] };
  const header = splitCsvLine(rows[0]!).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  if (idx("url") < 0) return { products, errors: ["The CSV needs a url column."] };
  rows.slice(1).forEach((raw, i) => {
    const cells = splitCsvLine(raw);
    const at = (n: string) => (idx(n) >= 0 ? cells[idx(n)] : undefined);
    const rawPrice = at("price");
    const price = rawPrice && rawPrice.replace(/[^0-9.]/g, "") ? Number(rawPrice.replace(/[^0-9.]/g, "")) : undefined;
    try {
      products.push(
        createManualProduct({
          url: String(at("url") || ""),
          title: at("title"),
          image: at("image"),
          price,
          currency: at("currency"),
          merchant: at("merchant"),
          category: at("category"),
          provider: "csv_import",
        }),
      );
    } catch (e) {
      errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  });
  return { products, errors };
}

/** Human label for when price and availability were last checked. */
export function lastCheckedLabel(iso?: string | null): string {
  if (!iso) return "Price And Availability Not Checked Yet";
  const t = Date.parse(iso);
  if (!isFinite(t)) return "Price And Availability Not Checked Yet";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `Price Checked ${mins || 1} Minute${mins === 1 ? "" : "s"} Ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Price Checked ${hrs} Hour${hrs === 1 ? "" : "s"} Ago`;
  const days = Math.round(hrs / 24);
  return `Price Checked ${days} Day${days === 1 ? "" : "s"} Ago`;
}

const STALE_HOURS = 24;

/** Price data older than a day is not presented as current. */
export function isPriceStale(iso?: string | null, now: number = Date.now()): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (!isFinite(t)) return true;
  return now - t > STALE_HOURS * 3600 * 1000;
}

export function isUnavailable(p: Pick<NormalizedProduct, "availability">): boolean {
  return p.availability === "unavailable";
}

export const AFFILIATE_DISCLOSURE =
  "Some retailer links may be affiliate links. REAL DESIGNS can earn a commission at no extra cost to you.";

/* ---------------- object detection (real vision) ---------------- */

/** Lucide glyph per category, used for product image empty states. */
export const CATEGORY_ICON: Record<string, string> = {
  Sofa: "sofa",
  Chair: "armchair",
  "Coffee Table": "table",
  "Side Table": "table-2",
  Rug: "grid-2x2",
  Lamp: "lamp",
  Chandelier: "lightbulb",
  Artwork: "image",
  Plant: "leaf",
  Cabinet: "archive",
  Vanity: "bath",
  Faucet: "droplet",
  Flooring: "layers",
  Tile: "grid-3x3",
  Countertop: "square",
  "Paint Color": "paint-bucket",
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICON[category] || "package";
}

const detectCache = new Map<string, DetectedObject[]>();

/**
 * Vision detection. Sends the real design image through the AI gateway and
 * returns boxes derived from THAT image. There is deliberately no coordinate
 * fallback: a failed or low-confidence scan produces no hotspots at all.
 */
export const visionDetection: ObjectDetectionProvider = {
  id: "vision",
  configured: true,
  async detect(imageUrl: string, roomType?: string, opts?: { force?: boolean }): Promise<DetectedObject[]> {
    const key = String(imageUrl || "") + "::" + String(roomType || "");
    if (!opts?.force && detectCache.has(key)) return detectCache.get(key)!.map((o) => ({ ...o, box: { ...o.box } }));
    const { detectShopObjects } = await import("@/lib/shop-detect.functions");
    const res = await detectShopObjects({
      data: { image: imageUrl, roomType: roomType || "Living Room", categories: PRODUCT_CATEGORIES },
    });
    const objects: DetectedObject[] = (res.objects || []).map((o, i) => ({
      id: "auto-" + i,
      category: o.category,
      label: o.label,
      box: o.box,
      origin: "auto" as const,
      confidence: o.confidence,
    }));
    detectCache.set(key, objects.map((o) => ({ ...o, box: { ...o.box } })));
    return objects;
  },
};

export function objectDetectionProvider(): ObjectDetectionProvider {
  return visionDetection;
}

