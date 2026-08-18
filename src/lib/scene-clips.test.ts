import { describe, it, expect } from "vitest";
import { clipCardHtml, animateModalHtml, clipReviewHtml, ARCHITECTURE_NOTICE, LIFESTYLE_NOTICE } from "@/lib/scene-clip-ui";
import { ANIMATE_CREDITS_PER_CLIP, ANIMATE_OPTIONS, animateCategory, animatePrompt } from "@/lib/scene-enhancement";
import { clipSize, clipStoragePath, clipPrice } from "@/lib/scene-clips.server";

const clip = (over: Record<string, unknown> = {}) =>
  ({ id: "c1", status: "completed", animate_id: "dolly_in", ...over }) as any;

describe("clip card states", () => {
  it("shows nothing when the scene has no clip", () => {
    expect(clipCardHtml("k", null)).toBe("");
  });

  it("offers cancel while generating and never offers use", () => {
    const html = clipCardHtml("k", clip({ status: "processing", progress: 40 }));
    expect(html).toContain('data-clip="cancel"');
    expect(html).not.toContain('data-clip="use"');
  });

  it("offers review and use once the clip is ready but unapproved", () => {
    const html = clipCardHtml("k", clip());
    expect(html).toContain('data-clip="review"');
    expect(html).toContain('data-clip="use"');
    expect(html).not.toContain("Using AI Clip");
  });

  it("shows the approved state with a way back to the photo", () => {
    const html = clipCardHtml("k", clip({ approved: true }));
    expect(html).toContain("Using AI Clip");
    expect(html).toContain('data-clip="revert"');
  });

  it("explains a failure and offers a retry", () => {
    const html = clipCardHtml("k", clip({ status: "failed", error_message: "Safety filters blocked it." }));
    expect(html).toContain("Safety filters blocked it.");
    expect(html).toContain('data-clip="retry"');
  });
});

describe("animate modal", () => {
  const base = { key: "k", balance: 500, orientation: "landscape" as const };

  it("disables generation until an animation is chosen", () => {
    expect(animateModalHtml({ ...base }).includes('id="rvAnimGo" disabled')).toBe(true);
  });

  it("states the real price from the capability model", () => {
    const html = animateModalHtml({ ...base, selected: "dolly_in" });
    expect(html).toContain(`${ANIMATE_CREDITS_PER_CLIP} Credits`);
    expect(html).toContain(ARCHITECTURE_NOTICE);
  });

  it("blocks generation and says why when credits are short", () => {
    const html = animateModalHtml({ ...base, balance: 3, selected: "dolly_in" });
    expect(html).toContain('id="rvAnimGo" disabled');
    expect(html).toContain("Not Enough Credits");
  });

  it("discloses added people for lifestyle animation", () => {
    expect(animateModalHtml({ ...base, selected: "lifestyle" })).toContain(LIFESTYLE_NOTICE);
  });

  it("makes every animation option reachable through its category tab", () => {
    for (const o of ANIMATE_OPTIONS) {
      const html = animateModalHtml({ ...base, cat: animateCategory(o.id) });
      expect(html).toContain(`data-animate="${o.id}"`);
    }
  });
});

describe("clip review", () => {
  it("cannot approve a clip with no playable media", () => {
    expect(clipReviewHtml({ clip: clip(), url: null }).includes('id="rvClipUse" disabled')).toBe(true);
  });
  it("offers keeping the photo instead", () => {
    expect(clipReviewHtml({ clip: clip(), url: "https://x/y.mp4" })).toContain("Keep Photo Instead");
  });
});

describe("server helpers", () => {
  it("maps orientation to a supported provider size", () => {
    expect(clipSize("portrait")).toBe("720x1280");
    expect(clipSize("landscape")).toBe("1280x720");
  });

  it("prices a clip from the capability model, never the client", () => {
    expect(clipPrice()).toBe(ANIMATE_CREDITS_PER_CLIP);
  });

  it("stores clips under the owner's folder", () => {
    const path = clipStoragePath("user-1", "proj-1", "user-1/rooms/a.jpg", "clip-1");
    expect(path.startsWith("user-1/projects/proj-1/scenes/")).toBe(true);
    expect(path.endsWith("clip-1.mp4")).toBe(true);
  });

  it("guards the prompt against inventing architecture", () => {
    const prompt = animatePrompt("dolly_in", { room: "Kitchen", style: null });
    expect(prompt.toLowerCase()).toContain("kitchen");
    expect(prompt.length).toBeGreaterThan(40);
  });
});
