import { describe, expect, it } from "vitest";
import {
  CANVAS_BADGE_LABEL,
  CANVAS_BADGE_TOKENS,
  applyCanvasBadge,
  badgeIsError,
  resolveCanvasBadge,
  showCompareControl,
} from "@/lib/canvas-badge";

/* --- tiny sRGB contrast helpers so the tokens are checked, not assumed --- */

type RGB = [number, number, number];

function parse(color: string): { rgb: RGB; a: number } {
  if (color.startsWith("#")) {
    const h = color.slice(1);
    return {
      rgb: [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ],
      a: 1,
    };
  }
  const n = color
    .replace(/rgba?\(|\)/g, "")
    .split(",")
    .map((x) => Number(x.trim()));
  return { rgb: [n[0]!, n[1]!, n[2]!], a: n[3] ?? 1 };
}

/** The badge sits on a photo, so its background is composited over it. */
function over(fg: string, backdrop: RGB): RGB {
  const { rgb, a } = parse(fg);
  return [0, 1, 2].map((i) => rgb[i]! * a + backdrop[i]! * (1 - a)) as RGB;
}

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const PHOTOS: Record<string, RGB> = {
  "blown-out white": [255, 255, 255],
  "bright sunlit wall": [242, 240, 230],
  "mid grey": [128, 128, 128],
  "dark interior": [22, 22, 24],
  "pure black": [0, 0, 0],
};

describe("canvas status badge contrast", () => {
  for (const [name, backdrop] of Object.entries(PHOTOS)) {
    it(`meets WCAG AA over a ${name} photo`, () => {
      const bg = over(CANVAS_BADGE_TOKENS.background, backdrop);
      const fg = parse(CANVAS_BADGE_TOKENS.color).rgb;
      /* 13px semibold is normal text: AA requires 4.5:1. */
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`keeps the error state readable over a ${name} photo`, () => {
      const bg = over(CANVAS_BADGE_TOKENS.background, backdrop);
      const fg = parse(CANVAS_BADGE_TOKENS.errorColor).rgb;
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("uses the specified badge geometry", () => {
    expect(CANVAS_BADGE_TOKENS.minHeight).toBe(28);
    expect(CANVAS_BADGE_TOKENS.paddingX).toBe(12);
    expect(CANVAS_BADGE_TOKENS.fontWeight).toBe(600);
    expect(CANVAS_BADGE_TOKENS.letterSpacing).toBe("0.06em");
  });
});

describe("badge states", () => {
  it("labels are Title Case, never shouted", () => {
    expect(CANVAS_BADGE_LABEL.original).toBe("Original");
    expect(CANVAS_BADGE_LABEL.edited).toBe("Edited");
    expect(CANVAS_BADGE_LABEL.generated).toBe("Generated");
    expect(CANVAS_BADGE_LABEL.saving).toBe("Saving…");
    expect(CANVAS_BADGE_LABEL["save-failed"]).toBe("Save Failed");
    for (const label of Object.values(CANVAS_BADGE_LABEL)) {
      expect(label).not.toBe(label.toUpperCase());
    }
  });

  it("describes the displayed image, not the tool", () => {
    expect(resolveCanvasBadge({})).toBe("original");
    expect(resolveCanvasBadge({ hasEdits: true })).toBe("edited");
    expect(resolveCanvasBadge({ generated: true })).toBe("generated");
    expect(resolveCanvasBadge({ generated: true, hasEdits: true })).toBe("edited");
  });

  it("reads Original while comparing and Edited once released", () => {
    expect(resolveCanvasBadge({ hasEdits: true, comparing: true })).toBe("original");
    expect(resolveCanvasBadge({ hasEdits: true, comparing: false })).toBe("edited");
  });

  it("prefers save progress and failure over everything else", () => {
    expect(resolveCanvasBadge({ hasEdits: true, saving: true })).toBe("saving");
    expect(resolveCanvasBadge({ hasEdits: true, saveFailed: true })).toBe("save-failed");
  });

  it("reserves red for failure only", () => {
    expect(badgeIsError("save-failed")).toBe(true);
    for (const s of ["original", "edited", "generated", "saving"] as const) {
      expect(badgeIsError(s)).toBe(false);
    }
  });

  it("hides Hold To Compare until an edit exists", () => {
    expect(showCompareControl(false)).toBe(false);
    expect(showCompareControl(true)).toBe(true);
  });

  it("paints the element without touching its position", () => {
    const el = document.createElement("span");
    applyCanvasBadge(el, "edited");
    expect(el.textContent).toBe("Edited");
    expect(el.getAttribute("data-badge")).toBe("edited");
    expect(el.classList.contains("is-error")).toBe(false);
    applyCanvasBadge(el, "save-failed");
    expect(el.classList.contains("is-error")).toBe(true);
    expect(el.getAttribute("style")).toBeNull();
  });
});
