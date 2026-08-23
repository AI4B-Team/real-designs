// @vitest-environment jsdom
/**
 * Generation must never lie about state or charge twice, so these tests treat
 * the job store as the single source of truth and assert the guarantees the
 * UI depends on: idempotent batches, independent jobs, honest progress.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetJobs,
  allBatches,
  announce,
  batchTitle,
  cancellationSupported,
  completeJob,
  countBatch,
  countsText,
  createBatch,
  failJob,
  findJob,
  historicalEstimate,
  isTerminal,
  markCreditRestored,
  progressText,
  retryJob,
  setStage,
  stepText,
} from "@/lib/generation-jobs";
import { batchDoneMessage, statusText, thumbClass, rowHtml } from "@/lib/batch-progress";

const seeds = [
  { key: "a", label: "Kitchen · Photo 1", room: "Kitchen", style: "Organic Modern" },
  { key: "b", label: "Kitchen · Photo 2", room: "Kitchen", style: "Organic Modern" },
];

beforeEach(() => {
  localStorage.clear();
  __resetJobs();
});

describe("batch creation", () => {
  it("creates one batch per idempotency key, however many times it is called", () => {
    const a = createBatch("press-1", seeds);
    const b = createBatch("press-1", seeds);
    const c = createBatch("press-1", seeds);
    expect(b.id).toBe(a.id);
    expect(c.id).toBe(a.id);
    expect(allBatches()).toHaveLength(1);
    expect(a.jobs).toHaveLength(2);
  });

  it("starts every job queued and independent", () => {
    const b = createBatch("k", seeds);
    expect(b.jobs.map((j) => j.stage)).toEqual(["queued", "queued"]);
    setStage(b.jobs[0]!.id, "generating");
    expect(findJob(b.jobs[1]!.id)!.stage).toBe("queued");
  });
});

describe("stages and progress", () => {
  it("reports real step numbers and never a percentage", () => {
    expect(stepText("analyzing")).toBe("Step 1 of 4");
    expect(stepText("generating")).toBe("Step 3 of 4");
    expect(progressText({ stage: "generating" })).toBe("Step 3 of 4");
    expect(progressText({ stage: "generating" })).not.toMatch(/%/);
    expect(progressText({ stage: "complete" })).toBe("");
  });

  it("offers no time estimate until enough real runs have finished", () => {
    expect(historicalEstimate()).toBeNull();
    const b = createBatch("k", seeds);
    for (const key of ["x", "y", "z"]) {
      const one = createBatch(key, [{ key }]);
      const id = one.jobs[0]!.id;
      setStage(id, "analyzing");
      findJob(id)!.startedAt = Date.now() - 20000;
      completeJob(id, "p");
    }
    expect(historicalEstimate()).toMatch(/about \d+ seconds/);
    expect(b.jobs[0]!.stage).toBe("queued");
  });

  it("never moves a terminal job again", () => {
    const b = createBatch("k", seeds);
    const id = b.jobs[0]!.id;
    completeJob(id, "path/one.png");
    setStage(id, "generating");
    expect(findJob(id)!.stage).toBe("complete");
    expect(isTerminal("complete")).toBe(true);
  });
});

describe("failure, retry and credits", () => {
  it("fails one job without failing the batch", () => {
    const b = createBatch("k", seeds);
    completeJob(b.jobs[0]!.id, "p");
    failJob(b.jobs[1]!.id, "The model was busy.");
    const c = countBatch(b);
    expect(c.complete).toBe(1);
    expect(c.failed).toBe(1);
    expect(c.active).toBe(0);
    expect(batchDoneMessage(b)).toContain("1 design are ready".replace("are", "are"));
  });

  it("keeps the charged flag across a retry so the same failure is not billed twice", () => {
    const b = createBatch("k", seeds);
    const id = b.jobs[0]!.id;
    setStage(id, "analyzing");
    setStage(id, "generating");
    expect(findJob(id)!.charged).toBe(true);
    failJob(id, "Timed out");
    retryJob(id);
    const j = findJob(id)!;
    expect(j.stage).toBe("queued");
    expect(j.charged).toBe(true);
  });

  it("only reports a restored credit once the backend confirms it", () => {
    const b = createBatch("k", seeds);
    const id = b.jobs[0]!.id;
    failJob(id, "Nope");
    expect(rowHtml(findJob(id)!)).not.toContain("Credit restored");
    markCreditRestored(id);
    expect(rowHtml(findJob(id)!)).toContain("Credit restored");
  });

  it("does not retry completed jobs", () => {
    const b = createBatch("k", seeds);
    completeJob(b.jobs[0]!.id, "p");
    retryJob(b.jobs[0]!.id);
    expect(findJob(b.jobs[0]!.id)!.stage).toBe("complete");
  });
});

describe("persistence and reconnect", () => {
  it("reconnects to existing jobs after a reload instead of starting new ones", () => {
    const b = createBatch("press-1", seeds);
    completeJob(b.jobs[0]!.id, "p");
    setStage(b.jobs[1]!.id, "generating");

    /* Simulate a page reload: same storage, new module session. */
    vi.resetModules();
    return import("@/lib/generation-jobs").then((mod) => {
      const reloaded = mod.allBatches();
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0]!.key).toBe("press-1");
      const jobs = reloaded[0]!.jobs;
      expect(jobs[0]!.stage).toBe("complete");
      /* A job whose page died is recoverable, never silently re-run. */
      expect(jobs[1]!.stage).toBe("failed");
      expect(jobs[1]!.interrupted).toBe(true);
      expect(jobs[1]!.charged).toBe(true);
      /* And the same key still returns that batch rather than a new one. */
      expect(mod.createBatch("press-1", seeds).id).toBe(reloaded[0]!.id);
    });
  });
});

describe("summaries and accessibility", () => {
  it("counts each photo independently", () => {
    const four = createBatch("k4", [
      { key: "1", room: "Kitchen" },
      { key: "2", room: "Kitchen" },
      { key: "3", room: "Kitchen" },
      { key: "4", room: "Kitchen" },
    ]);
    completeJob(four.jobs[0]!.id, "p");
    setStage(four.jobs[1]!.id, "generating");
    setStage(four.jobs[2]!.id, "analyzing");
    const c = countBatch(four);
    expect(countsText(c)).toBe("1 complete · 2 generating · 1 queued");
    expect(batchTitle(c)).toBe("Creating 4 Designs");
    expect(statusText(four.jobs[2]!)).toBe("Analyzing Space…");
  });

  it("announces completion and failure as text, not colour", () => {
    const b = createBatch("k", seeds);
    completeJob(b.jobs[0]!.id, "p");
    failJob(b.jobs[1]!.id, "The photo was too small.");
    expect(announce(findJob(b.jobs[0]!.id)!)).toBe("Kitchen design complete.");
    expect(announce(findJob(b.jobs[1]!.id)!)).toContain("failed");
  });

  it("marks thumbnails distinctly and stops animating finished ones", () => {
    expect(thumbClass({ stage: "generating" })).toBe("rd-thumb-gen");
    expect(thumbClass({ stage: "queued" })).toBe("rd-thumb-gen");
    expect(thumbClass({ stage: "complete" })).toBe("rd-thumb-done");
    expect(thumbClass({ stage: "failed" })).toBe("rd-thumb-failed");
  });

  it("does not offer cancel while the backend cannot stop a render", () => {
    expect(cancellationSupported()).toBe(false);
  });
});
