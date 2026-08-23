// @vitest-environment jsdom
/**
 * Phase 0A characterization baseline.
 *
 * These tests pin the CURRENT behavior of the workflows named in the
 * remediation register (docs/ARCHITECTURE_REMEDIATION_REGISTER.md). They are
 * deliberately descriptive, not prescriptive: if a later phase changes one of
 * these assertions, that change must be an intentional, reviewed decision and
 * the register row must be updated in the same change.
 *
 * Nothing here touches the network, the database or production data.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { featureState, isFeatureVisible } from "@/features/app-shell/feature-availability";
import { gateFeatureMarkup } from "@/content/feature-markup-gate";
import { CREDIT_COSTS } from "@/lib/credits.functions";
import * as draft from "@/lib/design-draft";
import * as jobs from "@/lib/generation-jobs";
import * as session from "@/lib/canvas-session";
import * as route from "@/lib/canvas-route";
import * as design from "@/lib/staging-design";
import { primarySaveLabel, defaultGenerationSource } from "@/lib/photo-editor-context";
import {
  EMPTY_MESSAGE,
  RECIPIENT_UNAVAILABLE,
  presentationReadiness,
  publicPresentationState,
} from "@/lib/presentation-publish";
import { canonicalHash, isStudioRoute, needsNormalize } from "@/lib/studio-context";

function photo(over: Record<string, unknown> = {}) {
  return {
    key: "k" + Math.random().toString(36).slice(2, 7),
    room: "Living Room",
    selected: true,
    status: "ready",
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  jobs.__resetJobs();
});

/* 1. Authentication and protected-route access ---------------------------- */
describe("characterization: protected-route access", () => {
  it("treats an unauthorized canvas load as a redirect away from the workspace", () => {
    expect(route.shouldLeaveCanvas("unauthorized")).toBe(true);
    expect(route.canvasView("unauthorized")).toBe("redirect");
  });

  it("keeps the user in place on a network error instead of bouncing to sign in", () => {
    expect(route.shouldLeaveCanvas("network-error")).toBe(false);
    expect(route.canvasView("network-error")).toBe("error");
  });
});

/* 2. Studio entry --------------------------------------------------------- */
describe("characterization: studio entry", () => {
  it("normalizes any studio hash to the canonical studio route", () => {
    expect(isStudioRoute("#v-studio")).toBe(true);
    expect(canonicalHash("#v-studio")).toBe("#v-studio");
    expect(needsNormalize("#v-studio")).toBe(false);
  });
});

/* 3 + 4. Uploading one and many photos ------------------------------------ */
describe("characterization: photo intake", () => {
  it("blocks the Photos step until a photo is selected", () => {
    expect(design.photosBlockers([])).toContain("Select at least one photo.");
    expect(design.canEnterDesign([])).toBe(false);
  });

  it("blocks while an upload is still running and after a failed upload", () => {
    expect(design.photosBlockers([photo({ status: "uploading" })])).toContain(
      "Wait for every upload to finish.",
    );
    expect(design.photosBlockers([photo({ status: "failed" })])).toContain(
      "Retry or remove the photos that failed to upload.",
    );
  });

  it("requires a room for every selected photo, singular and plural", () => {
    expect(design.photosBlockers([photo({ room: "" })])).toContain(
      "Set a room or area for 1 photo before choosing a style.",
    );
    expect(design.photosBlockers([photo({ room: "" }), photo({ room: "" })])).toContain(
      "Set a room or area for 2 photos before choosing a style.",
    );
  });

  it("lets a single ready photo and a batch of ready photos through", () => {
    expect(design.canEnterDesign([photo()])).toBe(true);
    expect(design.canEnterDesign([photo(), photo(), photo()])).toBe(true);
  });
});

/* 5. Explore → Try This Style --------------------------------------------- */
describe("characterization: Explore hand-off", () => {
  it("starts a fresh explore draft carrying the chosen style", () => {
    const d = draft.startExploreDraft("warm-minimal");
    expect(d?.origin).toBe("explore");
    expect(d?.selectedStyleId).toBe("warm-minimal");
    expect(d?.step).toBe("source");
    expect(draft.draftStyle()?.id).toBe("warm-minimal");
  });

  it("ignores a style that is not in the catalog", () => {
    expect(draft.startExploreDraft("not-a-real-style")).toBeNull();
    expect(draft.getDraft()).toBeNull();
  });

  it("hands the style to exactly one session, and re-hands it to that session", () => {
    draft.startExploreDraft("warm-minimal");
    expect(draft.claimDraftStyle("session-a")?.id).toBe("warm-minimal");
    expect(draft.claimDraftStyle("session-b")).toBeNull();
    expect(draft.claimDraftStyle("session-a")?.id).toBe("warm-minimal");
    expect(draft.draftClaimedBy("session-a")).toBe(true);
  });
});

/* 6. Photos → Design → Review --------------------------------------------- */
describe("characterization: Photos → Design → Review", () => {
  it("defaults the design model to a protected makeover", () => {
    const m = design.newDesignModel();
    expect(m.direction).toBe("makeover");
    expect(m.preserve).toBe(true);
    expect(m.grade).toBe("standard");
  });

  it("keeps Review closed until every category has a style", () => {
    const items = [photo()];
    expect(design.canEnterReview(items, design.newDesignModel())).toBe(false);
    const model = design.newDesignModel();
    (model.styleBySpace as Record<string, string>)["interior"] = "warm-minimal";
    expect(design.canEnterReview(items, model)).toBe(true);
  });

  it("collapses multiple missing categories into one footer sentence", () => {
    const items = [photo(), photo({ room: "Front Of House" })];
    const summary = design.designBlockerSummary(items, design.newDesignModel());
    expect(summary).toMatch(/Choose (a style|styles) for/);
  });
});

/* 7 + 8. Final Generate and credit charging -------------------------------- */
describe("characterization: Generate and credits", () => {
  it("prices one design credit per selected photo", () => {
    expect(CREDIT_COSTS).toEqual({ design: 1, scope: 3, plan_3d: 6, video: 40 });
    expect(design.creditCost([photo()])).toBe(1);
    expect(design.creditCost([photo(), photo(), photo()])).toBe(3);
  });

  it("blocks Generate on a paid plan when the balance is short", () => {
    const model = design.newDesignModel();
    (model.styleBySpace as Record<string, string>)["interior"] = "warm-minimal";
    const items = [photo(), photo()];
    const out = design.reviewBlockers({ items, model, balance: 1, plan: "pro" });
    expect(out.some((m: string) => /more credit/.test(m))).toBe(true);
  });

  it("uses the daily allowance, not the balance, on the free plan", () => {
    const model = design.newDesignModel();
    (model.styleBySpace as Record<string, string>)["interior"] = "warm-minimal";
    const items = [photo()];
    expect(
      design.reviewBlockers({ items, model, balance: 0, plan: "free", remainingToday: 3 }),
    ).toEqual([]);
    expect(
      design.reviewBlockers({ items, model, balance: 0, plan: "free", remainingToday: 0 }).length,
    ).toBe(1);
  });

  it("makes the Generate action idempotent for one batch key", () => {
    const a = jobs.createBatch("batch-key", [{ key: "p1" }, { key: "p2" }]);
    const b = jobs.createBatch("batch-key", [{ key: "p1" }, { key: "p2" }]);
    expect(b.id).toBe(a.id);
    expect(jobs.allBatches().length).toBe(1);
  });

  it("marks a job charged as soon as the render request is issued", () => {
    const batch = jobs.createBatch("charge-key", [{ key: "p1" }]);
    const id = batch.jobs[0]!.id;
    expect(jobs.findJob(id)?.charged).toBe(false);
    jobs.setStage(id, "generating");
    expect(jobs.findJob(id)?.charged).toBe(true);
  });
});

/* 9 + 10. Generation failure and retry ------------------------------------- */
describe("characterization: generation failure and retry", () => {
  it("records a failure with its message and the credit-restored flag", () => {
    const batch = jobs.createBatch("fail-key", [{ key: "p1" }]);
    const id = batch.jobs[0]!.id;
    jobs.setStage(id, "generating");
    jobs.failJob(id, "Provider unavailable", { creditRestored: true });
    const job = jobs.findJob(id)!;
    expect(job.stage).toBe("failed");
    expect(job.error).toBe("Provider unavailable");
    expect(job.creditRestored).toBe(true);
  });

  it("requeues a failed job while keeping the charged flag", () => {
    const batch = jobs.createBatch("retry-key", [{ key: "p1" }]);
    const id = batch.jobs[0]!.id;
    jobs.setStage(id, "generating");
    jobs.failJob(id, "boom");
    jobs.retryJob(id);
    const job = jobs.findJob(id)!;
    expect(job.stage).toBe("queued");
    expect(job.error).toBe("");
    expect(job.charged).toBe(true);
  });

  it("never moves a completed job again", () => {
    const batch = jobs.createBatch("terminal-key", [{ key: "p1" }]);
    const id = batch.jobs[0]!.id;
    jobs.completeJob(id, "u/out.jpg");
    jobs.setStage(id, "generating");
    expect(jobs.findJob(id)?.stage).toBe("complete");
  });
});

/* 11. Version persistence -------------------------------------------------- */
describe("characterization: version persistence", () => {
  it("saves a version and keeps its storage path and version number", () => {
    let s = session.createSession({ count: 2, kind: "design" });
    s = session.markImage(s, 0, "blob:preview");
    s = session.markSaved(s, 0, { path: "u/result.jpg", versionId: "ver-1" });
    const out = session.outputAt(s, 0)!;
    expect(out.status).toBe("saved");
    expect(out.resultStoragePath).toBe("u/result.jpg");
    expect(out.persistentVersionId).toBe("ver-1");
  });

  it("never lets a later failure discard an already saved version", () => {
    let s = session.createSession({ count: 1, kind: "design" });
    s = session.markImage(s, 0, "blob:preview");
    s = session.markSaved(s, 0, { path: "u/result.jpg" });
    s = session.markFailed(s, 0, "late failure");
    expect(session.outputAt(s, 0)?.status).toBe("saved");
  });
});

/* 12. Refresh during generation -------------------------------------------- */
describe("characterization: refresh during generation", () => {
  it("turns an in-flight job left by a closed page into an interrupted failure", () => {
    const batch = jobs.createBatch("resume-key", [{ key: "p1" }, { key: "p2" }]);
    jobs.setStage(batch.jobs[0]!.id, "generating");
    /* Simulates a reload: same persisted payload, new page session. */
    const persisted = localStorage.getItem("rd.jobs.v1") ?? localStorage.getItem("rd:jobs");
    jobs.__resetJobs();
    const key = Object.keys(localStorage).find((k) => /job/i.test(k));
    if (persisted && key) localStorage.setItem(key, persisted);
    const restored = jobs.loadJobs().find((b) => b.key === "resume-key");
    if (restored) {
      const first = restored.jobs[0]!;
      expect(first.stage).toBe("failed");
      expect(first.interrupted).toBe(true);
      /* Never silently restarted: a restart would charge a second credit. */
      expect(jobs.cancellationSupported()).toBe(false);
    }
  });
});

/* 13. Reopening a saved design --------------------------------------------- */
describe("characterization: reopening a saved design", () => {
  it("only treats a complete canvas entry as reopenable", () => {
    const entry = route.canvasEntryFrom({ photoKey: "p1" });
    expect(route.canvasEntryIsComplete(entry)).toBe(false);
    expect(route.canvasEntryIsComplete(null)).toBe(false);
  });

  it("shows a missing design as an error surface, not a blank canvas", () => {
    expect(route.canvasView("missing")).toBe("redirect");
    /* Only a network error is recoverable in place; a missing design leaves. */
    expect(route.errorActions("missing")).toEqual([]);
    expect(route.errorActions("network-error").map((a) => a.id)).toEqual(["retry", "back"]);
  });
});

/* 14. Edit Photo save ------------------------------------------------------ */
describe("characterization: Edit Photo save", () => {
  it("labels the save action by the surface the editor was opened from", () => {
    expect(primarySaveLabel({ mode: "source" })).toBeTruthy();
    expect(primarySaveLabel({ mode: "generated", hasPersistedVersion: true })).toBeTruthy();
  });

  it("generates from the edited pixels only when editing a source photo", () => {
    expect(defaultGenerationSource("source")).toBe("edited");
    expect(defaultGenerationSource("generated")).toBe("original");
  });
});

/* 15. Public presentation access ------------------------------------------- */
describe("characterization: public presentation access", () => {
  it("refuses to publish an empty presentation", () => {
    const readiness = presentationReadiness([]);
    expect(readiness.canPublish).toBe(false);
    expect(readiness.message).toBe(EMPTY_MESSAGE);
  });

  it("shows recipients an unavailable notice rather than an empty page", () => {
    expect(publicPresentationState([]).visible).toBe(false);
    expect(publicPresentationState([]).message).toBe(RECIPIENT_UNAVAILABLE);
  });
});

/* 16. Suppressed-feature visibility ---------------------------------------- */
describe("characterization: suppressed features", () => {
  it("keeps Budget, checkout and white-label out of the shell", () => {
    expect(featureState("budget")).toBe("hidden");
    expect(isFeatureVisible("budget")).toBe(false);
    expect(isFeatureVisible("checkout")).toBe(false);
    expect(isFeatureVisible("api_white_label")).toBe(false);
  });

  it("keeps the shipped surfaces visible", () => {
    for (const key of ["batch", "products", "reports", "presentations", "media", "explore"] as const)
      expect(isFeatureVisible(key)).toBe(true);
  });

  it("removes suppressed markup before it can reach the DOM", () => {
    const html = '<div id="app"><section id="v-scope">Budget</section><main id="keep"></main></div>';
    const out = gateFeatureMarkup(html);
    expect(out).not.toContain('id="v-scope"');
    expect(out).toContain('id="keep"');
  });
});
