/**
 * Product sourcing architecture for Shop the Design.
 *
 * This module defines the normalized product record, the provider adapter
 * interfaces (visual search, retailer feeds, object detection) and the
 * ranking/labelling rules used by the shopping workspace.
 *
 * IMPORTANT: no live retailer feed or visual-search provider is configured in
 * this environment. Everything returned by `sampleVisualSearch` is clearly
 * flagged with `sample: true` and `source: "sample"` and must be rendered as
 * SAMPLE DEVELOPMENT DATA, never as live pricing, availability or inventory.
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
  source: "visual_search" | "retailer_feed" | "brand_catalog" | "user_upload" | "sample";
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
 * SAMPLE DEVELOPMENT DATA BELOW
 * Replaced by real adapters once retailer feeds / visual search exist.
 * ------------------------------------------------------------------ */

const SAMPLE_MERCHANTS = [
  { m: "Wayfair", host: "wayfair.com" },
  { m: "West Elm", host: "westelm.com" },
  { m: "Article", host: "article.com" },
  { m: "CB2", host: "cb2.com" },
  { m: "Home Depot", host: "homedepot.com" },
  { m: "Rejuvenation", host: "rejuvenation.com" },
  { m: "Floor & Decor", host: "flooranddecor.com" },
];

type Seed = {
  name: string;
  brand: string;
  price: number;
  was?: number;
  w?: number;
  d?: number;
  h?: number;
  colors: string[];
  materials: string[];
  avail: Availability;
  strength: MatchStrength;
  type: MatchType;
  notes: string[];
};

const SEEDS: Record<string, Seed[]> = {
  Sofa: [
    { name: "Low Profile Track Arm Sofa, 88 Inch", brand: "Halden", price: 1499, was: 1799, w: 88, d: 37, h: 31, colors: ["Oatmeal"], materials: ["Performance Linen", "Kiln Dried Hardwood"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar shape and material", "Within two inches of the detected width"] },
    { name: "Slipcovered Three Seat Sofa", brand: "Marlow", price: 1149, w: 84, d: 38, h: 33, colors: ["Sand"], materials: ["Cotton Blend"], avail: "limited", strength: "good", type: "similar", notes: ["Similar color, different upholstery", "Exact SKU not verified"] },
    { name: "Modular Two Piece Sofa", brand: "Kembi", price: 2290, w: 96, d: 40, h: 30, colors: ["Bone"], materials: ["Boucle"], avail: "in_stock", strength: "alternative", type: "similar", notes: ["Different dimensions", "Similar palette"] },
    { name: "Budget Fabric Sofa, 80 Inch", brand: "Corliving", price: 649, w: 80, d: 35, h: 34, colors: ["Beige"], materials: ["Polyester"], avail: "in_stock", strength: "alternative", type: "similar", notes: ["Lower price tier", "Different leg profile"] },
  ],
  Chair: [
    { name: "Sculpted Oak Lounge Chair", brand: "Norda", price: 899, w: 30, d: 32, h: 29, colors: ["Natural Oak"], materials: ["White Oak", "Wool"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar frame and seat material"] },
    { name: "Upholstered Accent Chair", brand: "Marlow", price: 429, w: 29, d: 31, h: 32, colors: ["Ivory"], materials: ["Linen"], avail: "backorder", strength: "good", type: "similar", notes: ["Similar silhouette", "Backordered at this retailer"] },
  ],
  "Coffee Table": [
    { name: "Round Oak Coffee Table, 42 Inch", brand: "Norda", price: 649, was: 749, w: 42, d: 42, h: 16, colors: ["Natural Oak"], materials: ["Solid Oak"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar shape and material"] },
    { name: "Travertine Plinth Table", brand: "Sable", price: 1195, w: 40, d: 40, h: 14, colors: ["Cream"], materials: ["Travertine"], avail: "limited", strength: "good", type: "inspired", notes: ["Different material", "Similar proportion"] },
    { name: "Value Round Wood Table", brand: "Basics", price: 219, w: 36, d: 36, h: 17, colors: ["Light Wood"], materials: ["Engineered Wood"], avail: "in_stock", strength: "alternative", type: "similar", notes: ["Smaller than detected footprint"] },
  ],
  "Side Table": [
    { name: "Pedestal Side Table", brand: "Sable", price: 279, w: 18, d: 18, h: 22, colors: ["Cream"], materials: ["Stone Composite"], avail: "in_stock", strength: "good", type: "similar", notes: ["Similar color, different base"] },
  ],
  Rug: [
    { name: "Hand Loomed Wool Rug, 8x10", brand: "Loomwell", price: 899, was: 1099, w: 96, d: 120, colors: ["Ivory", "Taupe"], materials: ["Wool"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar pile and palette"] },
    { name: "Flatweave Jute Rug, 8x10", brand: "Loomwell", price: 349, w: 96, d: 120, colors: ["Natural"], materials: ["Jute"], avail: "in_stock", strength: "good", type: "similar", notes: ["Different texture, similar tone"] },
  ],
  Lamp: [
    { name: "Arc Floor Lamp, Brushed Brass", brand: "Rejuv", price: 389, h: 62, colors: ["Brass"], materials: ["Metal", "Linen Shade"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar arm profile and finish"] },
    { name: "Tripod Floor Lamp", brand: "Basics", price: 129, h: 58, colors: ["Black"], materials: ["Metal"], avail: "in_stock", strength: "alternative", type: "similar", notes: ["Different base, similar height"] },
  ],
  Chandelier: [
    { name: "Six Light Linear Chandelier", brand: "Rejuv", price: 749, w: 38, h: 20, colors: ["Aged Brass"], materials: ["Metal", "Glass"], avail: "limited", strength: "good", type: "close", notes: ["Similar fixture family"] },
  ],
  Artwork: [
    { name: "Framed Abstract Print, 36x48", brand: "Studio Co", price: 289, w: 36, h: 48, colors: ["Ochre", "Cream"], materials: ["Paper", "Oak Frame"], avail: "in_stock", strength: "good", type: "inspired", notes: ["Composition inspired by the render, not the same artwork"] },
  ],
  Plant: [
    { name: "Faux Olive Tree, 6 Foot", brand: "Verd", price: 219, h: 72, colors: ["Green"], materials: ["Polyester", "Ceramic Pot"], avail: "in_stock", strength: "good", type: "similar", notes: ["Similar scale and leaf tone"] },
  ],
  Cabinet: [
    { name: "Shaker Base Cabinet, 36 Inch", brand: "Hampton", price: 428, w: 36, d: 24, h: 34, colors: ["Warm White"], materials: ["Plywood", "Painted MDF"], avail: "in_stock", strength: "good", type: "similar", notes: ["Similar door style", "Verify cabinet layout"] },
  ],
  Vanity: [
    { name: "Floating Oak Vanity, 48 Inch", brand: "Hampton", price: 1099, w: 48, d: 21, h: 20, colors: ["Natural Oak"], materials: ["Oak Veneer", "Quartz Top"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar float mount and top"] },
  ],
  Faucet: [
    { name: "Single Handle Bridge Faucet", brand: "Fergus", price: 349, colors: ["Brushed Nickel"], materials: ["Brass"], avail: "in_stock", strength: "good", type: "similar", notes: ["Similar finish family"] },
  ],
  Flooring: [
    { name: "White Oak Engineered Plank, 7.5 Inch", brand: "Timberline", price: 6.29, colors: ["Natural Oak"], materials: ["Engineered Oak"], avail: "in_stock", strength: "strong", type: "close", notes: ["Similar plank width and tone", "Priced per square foot"] },
    { name: "Rigid Core LVP, Oak Look", brand: "Basics", price: 2.99, colors: ["Light Oak"], materials: ["Vinyl"], avail: "in_stock", strength: "alternative", type: "similar", notes: ["Different material", "Priced per square foot"] },
  ],
  Tile: [
    { name: "Matte Porcelain Tile, 12x24", brand: "Timberline", price: 3.49, colors: ["Greige"], materials: ["Porcelain"], avail: "in_stock", strength: "good", type: "similar", notes: ["Priced per square foot"] },
  ],
  Countertop: [
    { name: "Quartz Slab, Soft White", brand: "Stonecraft", price: 62, colors: ["White"], materials: ["Quartz"], avail: "limited", strength: "good", type: "similar", notes: ["Priced per square foot, fabrication not included"] },
  ],
  "Paint Color": [
    { name: "Interior Matte Paint, Warm White", brand: "Hue Co", price: 58, colors: ["Warm White"], materials: ["Acrylic Latex"], avail: "in_stock", strength: "good", type: "inspired", notes: ["Color read from the render, confirm with a sample"] },
  ],
};

const GENERIC: Seed[] = [
  { name: "Coordinating Décor Piece", brand: "Studio Co", price: 149, colors: ["Neutral"], materials: ["Mixed"], avail: "unknown", strength: "alternative", type: "similar", notes: ["Category match only"] },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toProduct(seed: Seed, category: string, i: number, imageUrl: string): NormalizedProduct {
  const merch = SAMPLE_MERCHANTS[(category.length + i) % SAMPLE_MERCHANTS.length]!;
  const id = `sample-${slug(category)}-${i}`;
  return {
    id,
    merchant: merch.m,
    merchantProductId: id.toUpperCase(),
    brand: seed.brand,
    sku: undefined,
    name: seed.name,
    category,
    description:
      "Sample development record used to build the sourcing workflow. Product data, price and availability are placeholders until a retailer feed is connected.",
    images: [imageUrl],
    width: seed.w,
    depth: seed.d,
    height: seed.h,
    unit: "in",
    colors: seed.colors,
    materials: seed.materials,
    finish: seed.materials[0],
    regularPrice: seed.was ?? seed.price,
    salePrice: seed.was ? seed.price : undefined,
    currency: "USD",
    availability: seed.avail,
    delivery: seed.avail === "in_stock" ? "Estimated delivery, 1 to 3 weeks" : undefined,
    productUrl: `https://www.${merch.host}/search?q=${encodeURIComponent(seed.name)}`,
    affiliateUrl: undefined,
    lastVerified: undefined,
    source: "sample",
    matchType: seed.type,
    matchStrength: seed.strength,
    matchNotes: seed.notes,
    verifiedSku: false,
    sample: true,
  };
}

/** SAMPLE provider. Returns clearly flagged development records only. */
export const sampleVisualSearch: VisualSearchProvider = {
  id: "sample",
  name: "Sample Catalog (Development)",
  configured: false,
  async search(req) {
    await new Promise((r) => setTimeout(r, 550));
    const seeds = SEEDS[req.category] ?? GENERIC;
    const list = seeds.map((s, i) => toProduct(s, req.category, i, req.imageUrl));
    if (req.query) {
      const q = req.query.toLowerCase();
      const hit = list.filter((p) => (p.name + " " + p.brand + " " + p.materials.join(" ")).toLowerCase().includes(q));
      if (hit.length) return rankMatches(hit, { category: req.category });
    }
    return rankMatches(list, { category: req.category, colors: req.traits?.colors, materials: req.traits?.materials });
  },
};

/** Active provider. Swap for a live adapter once one is configured. */
export function visualSearchProvider(): VisualSearchProvider {
  return sampleVisualSearch;
}

/* ---------------- object detection (real vision) ---------------- */

export const PRODUCT_CATEGORIES = Object.keys(SEEDS);

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

