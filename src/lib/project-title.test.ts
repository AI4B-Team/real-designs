import { describe, expect, it } from "vitest";
import {
  fallbackTitle,
  isGenericTitle,
  resolveProjectTitle,
  sanitizeTitle,
  suggestDesignTitle,
  suggestVideoTitle,
} from "@/lib/property-address";

const ADDR = "456 Lakeview Ln, Tahoe City, CA 96145";

describe("project titles", () => {
  it("falls back when there is no address", () => {
    expect(resolveProjectTitle({ kind: "video" })).toBe("Untitled Video");
    expect(resolveProjectTitle({ kind: "design" })).toBe("Untitled Design");
    expect(fallbackTitle("project")).toBe("Untitled Project");
  });

  it("suggests a street-only title once an address exists", () => {
    expect(suggestVideoTitle(ADDR)).toBe("456 Lakeview Ln Property Video");
    expect(suggestDesignTitle(ADDR, "Living Room")).toBe("456 Lakeview Ln Living Room Design");
    expect(resolveProjectTitle({ kind: "video", address: ADDR })).toBe("456 Lakeview Ln Property Video");
  });

  it("never overwrites a user-edited title", () => {
    const title = "Instagram Reel";
    expect(resolveProjectTitle({ kind: "video", title, titleTouched: true, address: ADDR })).toBe(title);
    expect(
      resolveProjectTitle({ kind: "video", title, titleTouched: true, address: "9 Other St, Reno, NV" }),
    ).toBe(title);
  });

  it("keeps meaningful legacy titles but re-suggests for generic ones", () => {
    expect(resolveProjectTitle({ kind: "video", title: "MLS Listing Video", address: ADDR })).toBe("MLS Listing Video");
    expect(resolveProjectTitle({ kind: "video", title: "Untitled Video", address: ADDR })).toBe(
      "456 Lakeview Ln Property Video",
    );
    expect(isGenericTitle("Untitled Reveal")).toBe(true);
    expect(isGenericTitle("Client Revision 2")).toBe(false);
  });

  it("trims, collapses and caps titles", () => {
    expect(sanitizeTitle("   Lakeview   Listing  Reel  ")).toBe("Lakeview Listing Reel");
    expect(sanitizeTitle("x".repeat(300)).length).toBe(160);
    expect(sanitizeTitle("   ")).toBe("");
  });

  it("allows many projects to share one address and one title", () => {
    const one = resolveProjectTitle({ kind: "video", title: "Investor Walkthrough", titleTouched: true, address: ADDR });
    const two = resolveProjectTitle({ kind: "video", title: "Investor Walkthrough", titleTouched: true, address: ADDR });
    expect(one).toBe(two);
  });
});
