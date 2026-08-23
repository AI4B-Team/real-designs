import { describe, expect, it } from "vitest";
import {
  DuplicateRequestError,
  isCreditRefusal,
  runGeneration,
  runGenerationItem,
  stageMessage,
  type JobStage,
  type RunDeps,
} from "@/lib/generation-run.server";

/**
 * A tiny in-memory stand-in for the idempotency table, the job table and the
 * credit ledger. It lets the tests assert the only guarantee that matters:
 * one request, at most one charge, at most one refund, one durable result.
 */
function harness(opts: { balance?: number; allow?: boolean } = {}) {
  const records = new Map<string, any>();
  const claims = new Set<string>();
  const jobs: Array<{ id: string; stage: JobStage; note?: string }> = [];
  const ledger: Array<{ kind: "charge" | "refund"; amount: number }> = [];
  let balance = opts.balance ?? 100;
  let n = 0;

  const deps: RunDeps = {
    async claim(key) {
      if (claims.has(key)) return { claimed: false, jobId: records.get(key)?.job_id ?? null } as any;
      claims.add(key);
      records.set(key, { key, state: "running", job_id: null, result: null, credit_state: null, charged: null });
      return { claimed: true, jobId: null } as any;
    },
    async release(key) {
      claims.delete(key);
    },
    async readRecord(key) {
      return records.get(key) ?? null;
    },
    async saveRecord(key, patch) {
      records.set(key, { ...(records.get(key) ?? { key }), ...patch });
    },
    async startJob() {
      const id = `job-${++n}`;
      jobs.push({ id, stage: "queued" });
      return id;
    },
    async setJobStage(jobId, stage, note) {
      jobs.push({ id: jobId, stage, ...(note ? { note } : {}) });
    },
    async charge(_u, _a) {
      if (opts.allow === false) return { ok: false, reason: "insufficient_credits", cost: 1, balance };
      balance -= 1;
      ledger.push({ kind: "charge", amount: 1 });
      return { ok: true, charged: 1, balance, remainingToday: 4 };
    },
    async refund(_u, amount) {
      balance += amount;
      ledger.push({ kind: "refund", amount });
    },
    chargeErrorMessage: () => "Not enough credits.",
    sleep: async () => {},
    waitMs: 5,
  };

  return { deps, ledger, jobs, records, charges: () => ledger.filter((l) => l.kind === "charge").length };
}

const req = (extra: Partial<Parameters<typeof runGeneration>[0]> = {}) => ({
  userId: "u1",
  action: "design" as const,
  kind: "design.render",
  parts: ["photo-a", "modern"],
  ...extra,
});

describe("runGeneration", () => {
  it("charges once and returns the result with its job and credit state", async () => {
    const h = harness();
    const out = await runGeneration(req(), async () => ({ image: "data:image/png;base64,x" }), h.deps);

    expect(out.image).toBe("data:image/png;base64,x");
    expect(out.stage).toBe("succeeded");
    expect(out.credit_state).toBe("charged");
    expect(out.credits_charged).toBe(1);
    expect(h.charges()).toBe(1);
  });

  it("replays the first result for an identical repeat request, without charging again", async () => {
    const h = harness();
    let calls = 0;
    const work = async () => {
      calls++;
      return { image: "img" };
    };

    const first = await runGeneration(req(), work, h.deps);
    const second = await runGeneration(req(), work, h.deps);

    expect(calls).toBe(1);
    expect(h.charges()).toBe(1);
    expect(second.image).toBe(first.image);
    expect(second.replayed).toBe(true);
  });

  it("treats a different photo as a different request", async () => {
    const h = harness();
    await runGeneration(req(), async () => ({ image: "a" }), h.deps);
    await runGeneration(req({ parts: ["photo-b", "modern"] }), async () => ({ image: "b" }), h.deps);
    expect(h.charges()).toBe(2);
  });

  it("refunds exactly once when the work fails", async () => {
    const h = harness();
    await expect(
      runGeneration(req(), async () => {
        throw new Error("model timed out");
      }, h.deps),
    ).rejects.toThrow("model timed out");

    expect(h.ledger).toEqual([
      { kind: "charge", amount: 1 },
      { kind: "refund", amount: 1 },
    ]);
  });

  it("lets a retry after a failure start a fresh attempt", async () => {
    const h = harness();
    await expect(
      runGeneration(req(), async () => {
        throw new Error("nope");
      }, h.deps),
    ).rejects.toThrow();

    const out = await runGeneration(req(), async () => ({ image: "ok" }), h.deps);
    expect(out.image).toBe("ok");
    expect(h.charges()).toBe(2);
  });

  it("never charges when the credit refusal happens first", async () => {
    const h = harness({ allow: false });
    await expect(runGeneration(req(), async () => ({ image: "x" }), h.deps)).rejects.toThrow(
      "Not enough credits.",
    );
    expect(h.ledger).toHaveLength(0);
  });

  it("raises a duplicate error rather than a second charge while the first attempt runs", async () => {
    const h = harness();
    let resolveWork: (() => void) | null = null;
    const gate = new Promise<void>((r) => (resolveWork = r));

    const first = runGeneration(req(), async () => {
      await gate;
      return { image: "slow" };
    }, h.deps);

    await expect(runGeneration(req(), async () => ({ image: "second" }), h.deps)).rejects.toBeInstanceOf(
      DuplicateRequestError,
    );

    resolveWork!();
    await first;
    expect(h.charges()).toBe(1);
  });

  it("does not charge when the action is free", async () => {
    const h = harness();
    const out = await runGeneration(
      req({ action: null }),
      async () => ({ ok: true }),
      h.deps,
    );
    expect(out.credit_state).toBe("not_required");
    expect(h.ledger).toHaveLength(0);
  });
});

describe("runGenerationItem", () => {
  it("returns a failure instead of throwing so the rest of a batch survives", async () => {
    const h = harness();
    const bad = await runGenerationItem(req({ parts: ["p1"] }), async () => {
      throw new Error("that photo did not finish");
    }, h.deps);
    const good = await runGenerationItem(req({ parts: ["p2"] }), async () => "image", h.deps);

    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.blocked).toBe(false);
    expect(good.ok && good.value).toBe("image");
    /* The failed item was refunded; the successful one stayed charged. */
    expect(h.ledger).toEqual([
      { kind: "charge", amount: 1 },
      { kind: "refund", amount: 1 },
      { kind: "charge", amount: 1 },
    ]);
  });

  it("flags a credit refusal so the caller can stop the batch", async () => {
    const h = harness({ allow: false });
    const out = await runGenerationItem(req(), async () => "x", h.deps);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.blocked).toBe(true);
  });
});

describe("stage wording", () => {
  it("describes progress in plain words, never a fake percentage", () => {
    expect(stageMessage("processing")).toBe("Designing Your Space");
    expect(stageMessage("finalizing")).toBe("Saving Your Result");
    expect(stageMessage("queued")).toBe("Queued");
  });

  it("recognises the credit refusals that should halt a batch", () => {
    expect(isCreditRefusal("Not enough credits.")).toBe(true);
    expect(isCreditRefusal("The model did not return an image.")).toBe(false);
  });
});
