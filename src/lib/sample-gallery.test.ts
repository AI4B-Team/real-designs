import { describe, expect, it } from "vitest";
import { HERO_SAMPLES, wrapIndex } from "./sample-gallery";

describe("sample gallery", () => {
  it("wraps forward past the last sample", () => {
    expect(wrapIndex(HERO_SAMPLES.length, HERO_SAMPLES.length)).toBe(0);
  });

  it("wraps backward before the first sample", () => {
    expect(wrapIndex(-1, HERO_SAMPLES.length)).toBe(HERO_SAMPLES.length - 1);
  });

  it("keeps builder indexes aligned with the thumbnail order", () => {
    expect(HERO_SAMPLES.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(HERO_SAMPLES.every((s) => s.name && s.room && s.src && s.alt)).toBe(true);
  });
});
