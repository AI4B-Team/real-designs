/**
 * The Describe result contract: one batch, one slot per requested option, and
 * no result may ever erase another one.
 */
import { describe, it, expect } from "vitest";
import {
  makeBatch,
  addResult,
  failResult,
  markGenerating,
  batchStatus,
  succeeded,
  failedIndexes,
  conceptSummary,
  canvasModeFor,
  overlayPlan,
  comparePairIsValid,
  resolveRoom,
  inferRoom,
  roomLabel,
  costLabel,
  progressLabel,
  batchIdempotencyKey,
  optionIdempotencyKey,
} from "@/lib/concept-batch";

const base = { prompt: "A modern luxury kitchen with warm oak and stone", requestedCount: 1 };

describe("concept batch", () => {
  it("one requested image creates one result", () => {
    const b = makeBatch(base);
    expect(b.results).toHaveLength(1);
    addResult(b, 0, { image: "data:image/png;base64,a" });
    const s = batchStatus(b);
    expect(s.created).toBe(1);
    expect(s.complete).toBe(true);
    expect(s.creditsUsed).toBe(1);
  });

  it("two requested images create two distinct results", () => {
    const b = makeBatch({ ...base, requestedCount: 2 });
    addResult(b, 0, { image: "img-1", durablePath: "p/1", versionId: "v1" });
    addResult(b, 1, { image: "img-2", durablePath: "p/2", versionId: "v2" });
    const ok = succeeded(b) as any[];
    expect(ok).toHaveLength(2);
    expect(ok[0].image).not.toBe(ok[1].image);
    expect(ok[0].durablePath).not.toBe(ok[1].durablePath);
    expect(ok.map((r) => r.label)).toEqual(["Concept 1", "Concept 2"]);
  });

  it("the second result does not erase the first", () => {
    const b = makeBatch({ ...base, requestedCount: 2 });
    addResult(b, 0, { image: "img-1" });
    markGenerating(b, 1);
    expect((b.results as any[])[0].image).toBe("img-1");
    addResult(b, 1, { image: "img-2" });
    expect((b.results as any[])[0].image).toBe("img-1");
    expect(succeeded(b)).toHaveLength(2);
  });

  it("a partial batch is reported honestly with a retry target", () => {
    const b = makeBatch({ ...base, requestedCount: 2 });
    addResult(b, 0, { image: "img-1" });
    failResult(b, 1, "Model error");
    const s = batchStatus(b);
    expect(s.partial).toBe(true);
    expect(s.complete).toBe(false);
    expect(s.message).toBe("1 of 2 images was created");
    expect(s.canRetry).toBe(true);
    expect(failedIndexes(b)).toEqual([1]);
  });

  it("retrying a missing option never touches or recharges the successful one", () => {
    const b = makeBatch({ ...base, requestedCount: 2 });
    addResult(b, 0, { image: "img-1", versionId: "v1" });
    failResult(b, 1, "Model error");
    const before = batchStatus(b).creditsUsed;
    expect(before).toBe(1);
    /* Retry only touches the failed slot. */
    markGenerating(b, 1);
    addResult(b, 1, { image: "img-2", versionId: "v2" });
    expect((b.results as any[])[0].versionId).toBe("v1");
    expect(succeeded(b)).toHaveLength(2);
    expect(batchStatus(b).creditsUsed).toBe(2);
  });

  it("a failure can never discard an image that already exists", () => {
    const b = makeBatch(base);
    addResult(b, 0, { image: "img-1" });
    failResult(b, 0, "late error");
    expect((b.results as any[])[0].status).toBe("done");
    expect((b.results as any[])[0].image).toBe("img-1");
  });

  it("requested count matches created versions and credit usage", () => {
    const b = makeBatch({ ...base, requestedCount: 3 });
    [0, 1, 2].forEach((i) => addResult(b, i, { image: "img-" + i, versionId: "v" + i }));
    const s = batchStatus(b);
    expect(s.created).toBe(b.requestedCount);
    expect(s.creditsUsed).toBe(3);
    expect(new Set(succeeded(b).map((r) => r.versionId)).size).toBe(3);
  });

  it("each option carries a unique idempotency key under one batch key", () => {
    const b = makeBatch({ ...base, requestedCount: 2 });
    expect(optionIdempotencyKey(b.batchId, 0)).not.toBe(optionIdempotencyKey(b.batchId, 1));
    expect(batchIdempotencyKey(b.batchId)).toContain(b.batchId);
  });
});

describe("describe context", () => {
  it("a kitchen prompt never becomes Living Room", () => {
    const b = makeBatch(base);
    expect(b.room).toBe("Kitchen");
    expect(b.roomSource).toBe("inferred");
  });

  it("an explicit selection always wins", () => {
    const r = resolveRoom("Bedroom", "a modern luxury kitchen");
    expect(r).toEqual({ room: "Bedroom", roomSource: "selected" });
  });

  it("an undeterminable space stays unspecified", () => {
    const r = resolveRoom("", "something bright and airy");
    expect(r.room).toBeNull();
    expect(roomLabel(r as any)).toBe("Unspecified Space");
    expect(inferRoom("something bright and airy")).toBeNull();
  });

  it("summarises the real request, not canvas defaults", () => {
    const b = makeBatch({
      ...base,
      requestedCount: 2,
      styleName: "Modern Luxury",
      aspectRatio: "16:9",
    });
    expect(conceptSummary(b, 0)).toBe("Kitchen \u00b7 Modern Luxury \u00b7 16:9 \u00b7 Concept 1 of 2");
    expect(conceptSummary(b, 1)).toContain("Concept 2 of 2");
  });

  it("states cost and progress accurately", () => {
    expect(costLabel(2)).toBe("2 images \u00b7 2 credits");
    expect(progressLabel("creating", 0, 2)).toBe("Creating image 1 of 2\u2026");
    expect(progressLabel("saving", 1, 2)).toBe("Saving image 2 of 2\u2026");
  });
});

describe("canvas result modes", () => {
  it("a text concept is concept-only and has no comparison", () => {
    const mode = canvasModeFor({});
    expect(mode).toBe("concept-only");
    const p = overlayPlan(mode);
    expect(p.compare).toBe(false);
    expect(p.cornerLabels).toBe(false);
    expect(p.realityLock).toBe(false);
    expect(p.editToolbar).toBe("compact");
    expect(p.resultLabel).toBe("Generated Concept");
  });

  it("a photo redesign keeps a working before/after", () => {
    const p = overlayPlan(canvasModeFor({ hasSource: true }));
    expect(p.compare).toBe(true);
    expect(p.cornerLabels).toBe(true);
    expect(p.realityLock).toBe(true);
  });

  it("inspiration images do not become a source photo", () => {
    const mode = canvasModeFor({ hasReferences: true });
    expect(mode).toBe("reference-guided");
    const p = overlayPlan(mode);
    expect(p.compare).toBe(false);
    expect(p.referencesAction).toBe(true);
  });

  it("before and after are never the same asset", () => {
    expect(comparePairIsValid("a", "a")).toBe(false);
    expect(comparePairIsValid(null, "a")).toBe(false);
    expect(comparePairIsValid("a", "b")).toBe(true);
  });

  it("viewer controls live in exactly one cluster", () => {
    for (const m of ["photo-redesign", "concept-only", "reference-guided", "generated-variation"] as const) {
      expect(overlayPlan(m).viewerControls).toBe("top-right");
    }
  });
});
