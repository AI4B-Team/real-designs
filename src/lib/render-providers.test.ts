import { describe, expect, it, beforeEach } from "vitest";
import {
  RENDER_PROVIDERS,
  activeRenderProvider,
  creditRelease,
  isJobStale,
  jobStatusLabel,
  registerRenderProvider,
  renderProvider,
  runsInBackground,
} from "@/lib/render-providers";

const reset = () => {
  Object.keys(RENDER_PROVIDERS).forEach((k) => {
    if (k !== "browser") delete RENDER_PROVIDERS[k];
  });
};

describe("render providers", () => {
  beforeEach(reset);

  it("ships only the in-browser renderer, which never survives a closed tab", () => {
    expect(Object.keys(RENDER_PROVIDERS)).toEqual(["browser"]);
    expect(activeRenderProvider().id).toBe("browser");
    expect(runsInBackground()).toBe(false);
    expect(renderProvider("browser").runningNotice).toMatch(/keep this tab open/i);
  });

  it("lets a configured server-side provider take over without other changes", () => {
    registerRenderProvider({
      id: "shotstack",
      label: "Shotstack",
      serverSide: true,
      survivesTabClose: true,
      reportsProgress: true,
      configured: true,
      runningNotice: "Rendering continues after you close this tab.",
    });
    expect(activeRenderProvider().id).toBe("shotstack");
    expect(runsInBackground()).toBe(true);
  });

  it("refuses to claim background rendering for an unconfigured provider", () => {
    registerRenderProvider({
      id: "lambda",
      label: "Remotion Lambda",
      serverSide: true,
      survivesTabClose: true,
      reportsProgress: true,
      configured: false,
      runningNotice: "…",
    });
    expect(activeRenderProvider().id).toBe("browser");
    expect(runsInBackground("lambda")).toBe(false);
  });

  it("never lets a browser provider claim it survives a closed tab", () => {
    const p = registerRenderProvider({
      id: "wasm",
      label: "WASM Encoder",
      serverSide: false,
      survivesTabClose: true,
      reportsProgress: true,
      configured: true,
      runningNotice: "…",
    });
    expect(p.survivesTabClose).toBe(false);
    expect(runsInBackground("wasm")).toBe(false);
  });
});

describe("job liveness and honest status", () => {
  const beat = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("treats a job with no recent heartbeat as interrupted", () => {
    expect(isJobStale({ status: "rendering", heartbeat_at: beat(5_000) })).toBe(false);
    expect(isJobStale({ status: "rendering", heartbeat_at: beat(300_000) })).toBe(true);
    expect(isJobStale({ status: "completed", heartbeat_at: beat(300_000) })).toBe(false);
    expect(jobStatusLabel({ status: "rendering", heartbeat_at: beat(300_000) } as any)).toBe("Render Interrupted");
  });

  it("shows real progress only, straight from the job row", () => {
    expect(jobStatusLabel({ status: "rendering", progress: 0.42, heartbeat_at: beat(1000) } as any)).toBe("Rendering 42%");
    expect(jobStatusLabel({ status: "queued", heartbeat_at: beat(1000) } as any)).toBe("Queued");
    expect(jobStatusLabel({ status: "failed" })).toBe("Failed");
    expect(jobStatusLabel({ status: "cancelled" })).toBe("Cancelled");
    expect(jobStatusLabel({ status: "rendering", cancel_requested: true, heartbeat_at: beat(1000) } as any)).toBe("Stopping…");
  });
});

describe("credit release", () => {
  it("returns the full charge on a failed render, once", () => {
    const job = { status: "rendering", credits_charged: 46, credits_refunded: 0 };
    const first = creditRelease(job, "failed");
    expect(first).toEqual({ release: true, amount: 46, reason: "failed" });
    const after = { ...job, status: "failed", credits_refunded: 46 };
    expect(creditRelease(after, "failed").release).toBe(false);
    expect(creditRelease(after, "failed").reason).toBe("already_released");
  });

  it("returns credits when the user stops the render", () => {
    expect(creditRelease({ status: "rendering", credits_charged: 40 }, "cancelled")).toEqual({
      release: true,
      amount: 40,
      reason: "cancelled",
    });
  });

  it("keeps the charge for a completed render and never invents a refund", () => {
    expect(creditRelease({ status: "rendering", credits_charged: 40 }, "completed").release).toBe(false);
    expect(creditRelease({ status: "failed", credits_charged: 0 }, "failed")).toEqual({
      release: false,
      amount: 0,
      reason: "nothing_charged",
    });
    expect(creditRelease(null, "failed").release).toBe(false);
  });

  it("releases only the unreturned remainder of a partly refunded job", () => {
    expect(creditRelease({ status: "rendering", credits_charged: 52, credits_refunded: 12 }, "failed").amount).toBe(40);
  });
});
