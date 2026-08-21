import { describe, expect, it } from "vitest";

import { QUICK_STYLE_IDS, quickStyles } from "@/lib/canvas-style-ui";
import { STYLES } from "@/lib/style-catalog";
import { stylesForNeed } from "@/lib/canvas-style";

const pool = stylesForNeed(STYLES, "design", "interior");

describe("quickStyles", () => {
  it("offers six popular interior styles with preview images", () => {
    const list = quickStyles(pool, null);
    expect(list).toHaveLength(4);
    list.forEach((s) => {
      expect(s.displayName.length).toBeGreaterThan(0);
      expect(s.previewImage).toBeTruthy();
    });
    /* No two cards may share the same image: distinct styles, distinct art. */
    const imgs = new Set(list.map((s) => s.previewImage));
    expect(imgs.size).toBe(list.length);
  });

  it("always includes the active selection first", () => {
    const target = pool[pool.length - 1]!;
    const list = quickStyles(pool, target.id);
    expect(list[0]?.id).toBe(target.id);
    expect(list).toHaveLength(4);
  });

  it("names only styles that exist in the catalog", () => {
    const known = new Set(STYLES.map((s) => s.id));
    QUICK_STYLE_IDS.forEach((id) => expect(known.has(id)).toBe(true));
  });
});
