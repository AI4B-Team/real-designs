import { describe, expect, it } from "vitest";
import {
  AFFILIATE_DISCLOSURE,
  createManualProduct,
  isPriceStale,
  isSampleRecord,
  lastCheckedLabel,
  parseProductCsv,
  productionProducts,
  visualSearchProvider,
  PRODUCT_CATEGORIES,
  PRICE_TIERS,
} from "@/lib/product-catalog";

describe("no sample product data reaches customers", () => {
  it("ships no configured product provider and returns no invented inventory", async () => {
    const provider = visualSearchProvider();
    expect(provider.configured).toBe(false);
    await expect(provider.search({ imageUrl: "x", crop: { x: 0, y: 0, w: 1, h: 1 }, category: "Sofa" })).resolves.toEqual([]);
  });

  it("flags sample, mock, demo and placeholder records", () => {
    expect(isSampleRecord({ sample: true } as never)).toBe(true);
    expect(isSampleRecord({ source: "sample" } as never)).toBe(true);
    expect(isSampleRecord({ source: "mock" } as never)).toBe(true);
    expect(isSampleRecord({ source: "demo" } as never)).toBe(true);
    expect(isSampleRecord({ source: "placeholder" } as never)).toBe(true);
    expect(isSampleRecord({ source: "manual_link", sample: false } as never)).toBe(false);
  });

  it("strips sample records from any list before render", () => {
    const real = createManualProduct({ url: "https://westelm.com/p/1", title: "Sofa" });
    const list = [real, { id: "s1", sample: true } as never, { id: "s2", source: "sample" } as never];
    expect(productionProducts(list).map((p) => p.id)).toEqual([real.id]);
  });

  it("keeps no sample seed catalog in the module", () => {
    expect(PRODUCT_CATEGORIES.length).toBeGreaterThan(0);
    expect(PRICE_TIERS).toContain("Furniture");
  });
});

describe("manual product links", () => {
  it("invents no price, discount, availability or shipping", () => {
    const p = createManualProduct({ url: "https://article.com/p/9" });
    expect(p.sample).toBe(false);
    expect(p.regularPrice).toBeUndefined();
    expect(p.salePrice).toBeUndefined();
    expect(p.availability).toBe("unknown");
    expect(p.delivery).toBeUndefined();
    expect(p.lastVerified).toBeUndefined();
  });

  it("stores provider, external id, title, image, price, currency, url and checked time", () => {
    const p = createManualProduct({
      url: "https://cb2.com/p/7",
      title: "Oak Table",
      image: "https://cb2.com/i.jpg",
      price: 649,
      currency: "usd",
      externalId: "cb2-7",
      merchant: "CB2",
    });
    expect(p.provider).toBe("manual_link");
    expect(p.externalId).toBe("cb2-7");
    expect(p.name).toBe("Oak Table");
    expect(p.images).toEqual(["https://cb2.com/i.jpg"]);
    expect(p.regularPrice).toBe(649);
    expect(p.currency).toBe("USD");
    expect(p.productUrl).toBe("https://cb2.com/p/7");
    expect(typeof p.lastVerified).toBe("string");
  });

  it("rejects invalid links", () => {
    expect(() => createManualProduct({ url: "not-a-url" })).toThrow();
  });
});

describe("csv import", () => {
  it("imports real rows and reports bad ones", () => {
    const res = parseProductCsv('url,title,price\nhttps://wayfair.com/a,"Chair, Oak",129.99\nnope,Bad,10');
    expect(res.products).toHaveLength(1);
    expect(res.products[0]!.name).toBe("Chair, Oak");
    expect(res.products[0]!.regularPrice).toBeCloseTo(129.99);
    expect(res.products[0]!.source).toBe("csv_import");
    expect(res.errors).toHaveLength(1);
  });

  it("requires a url column", () => {
    expect(parseProductCsv("title,price\nChair,10").products).toHaveLength(0);
  });
});

describe("freshness and disclosure", () => {
  it("says when price was last checked", () => {
    expect(lastCheckedLabel(null)).toMatch(/Not Checked Yet/);
    expect(lastCheckedLabel(new Date(Date.now() - 2 * 3600_000).toISOString())).toMatch(/2 Hours Ago/);
  });

  it("treats day-old prices as stale", () => {
    expect(isPriceStale(undefined)).toBe(true);
    expect(isPriceStale(new Date().toISOString())).toBe(false);
    expect(isPriceStale(new Date(Date.now() - 48 * 3600_000).toISOString())).toBe(true);
  });

  it("exposes an affiliate disclosure string", () => {
    expect(AFFILIATE_DISCLOSURE.toLowerCase()).toContain("affiliate");
  });
});
