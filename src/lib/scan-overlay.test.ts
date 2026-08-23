// @vitest-environment jsdom
/**
 * The scan overlay must be exactly that: a layer. These tests hold the line
 * on the two things that made older loaders feel broken — a replaced source
 * image and a shifting canvas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVEAL_MS, clearScanOverlay, mountScanOverlay } from "@/lib/scan-overlay";

function stage() {
  document.body.innerHTML = `<div id="canvas" style="width:600px;height:400px">
    <div id="cBefore"><img id="src" src="photo.jpg" alt="Kitchen"></div>
  </div>`;
  return document.getElementById("cBefore") as HTMLElement;
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("scan overlay", () => {
  it("keeps the original image mounted and untouched", () => {
    const host = stage();
    const img = document.getElementById("src")!;
    const ov = mountScanOverlay(host, { stage: "analyzing" });
    expect(document.getElementById("src")).toBe(img); // same node, never remounted
    expect(host.contains(img)).toBe(true);
    expect(img.getAttribute("src")).toBe("photo.jpg");
    expect(ov.el.parentElement).toBe(host);
    expect(ov.el.className).toContain("rd-scan");
  });

  it("does not change canvas or image geometry", () => {
    const host = stage();
    const canvas = document.getElementById("canvas") as HTMLElement;
    const before = canvas.getAttribute("style");
    const imgStyle = document.getElementById("src")!.getAttribute("style");
    const ov = mountScanOverlay(host);
    expect(canvas.getAttribute("style")).toBe(before);
    expect(document.getElementById("src")!.getAttribute("style")).toBe(imgStyle);
    /* Only the host's positioning context is established. */
    expect(host.style.width).toBe("");
    expect(host.style.height).toBe("");
    ov.destroy();
  });

  it("shows real stage text with a step, and never a percentage", () => {
    const host = stage();
    const ov = mountScanOverlay(host, { stage: "analyzing" });
    const pill = ov.el.querySelector(".rd-scan-pill")!;
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.textContent).toContain("Analyzing Space");
    expect(pill.textContent).toContain("Step 1 of 4");
    ov.setStage("generating", "Applying Organic Modern with a Makeover direction…");
    expect(pill.textContent).toContain("Generating Design");
    expect(pill.textContent).toContain("Organic Modern");
    expect(pill.textContent).toContain("Step 3 of 4");
    expect(pill.textContent).not.toMatch(/\d+%/);
  });

  it("runs the completion reveal exactly once and then removes itself", async () => {
    vi.useFakeTimers();
    const host = stage();
    const ov = mountScanOverlay(host, { stage: "generating" });
    const onRevealed = vi.fn();
    ov.complete({ onRevealed });
    expect(ov.el.className).toContain("rd-scan--reveal");
    ov.complete({ onRevealed }); // a second call must not animate again
    vi.advanceTimersByTime(REVEAL_MS + 20);
    expect(onRevealed).toHaveBeenCalledTimes(1);
    expect(host.querySelector(".rd-scan")).toBeNull();
    vi.useRealTimers();
  });

  it("keeps the photo and stops all motion on failure", () => {
    const host = stage();
    const ov = mountScanOverlay(host, { stage: "generating" });
    ov.fail("The model was busy. Try again in a moment.");
    expect(document.getElementById("src")).not.toBeNull();
    expect(ov.el.className).toContain("rd-scan--failed");
    expect(ov.el.querySelector(".rd-scan-pill")!.textContent).toContain("The model was busy");
  });

  it("drops moving effects under reduced motion but keeps the text status", () => {
    const host = stage();
    const ov = mountScanOverlay(host, { stage: "analyzing", reducedMotion: true });
    expect(ov.el.className).toContain("rd-scan--static");
    expect(ov.el.querySelector(".rd-scan-grid")).not.toBeNull(); // static blueprint stays
    expect(ov.el.querySelector(".rd-scan-pill")!.textContent).toContain("Analyzing Space");
    const onRevealed = vi.fn();
    ov.complete({ onRevealed }); // no animation to wait for
    expect(onRevealed).toHaveBeenCalledTimes(1);
    expect(host.querySelector(".rd-scan")).toBeNull();
  });

  it("removes every overlay when the canvas is cleared", () => {
    const host = stage();
    mountScanOverlay(host);
    mountScanOverlay(host); // remount replaces rather than stacks
    expect(host.querySelectorAll(".rd-scan")).toHaveLength(1);
    clearScanOverlay(host);
    expect(host.querySelectorAll(".rd-scan")).toHaveLength(0);
    expect(document.getElementById("src")).not.toBeNull();
  });
});
