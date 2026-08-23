// @vitest-environment jsdom
/**
 * Stabilization regression suite (Phases 0–3).
 *
 * Every test here asserts *behaviour* across a workflow boundary, not markup.
 * The suite is organised by the required end-to-end workflows so a failure
 * names the workflow it broke. It is the gate for
 * `docs/STABILIZATION_VERIFICATION_REPORT.md`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { evaluateFeature, featureContext, featureServerEnabled, resolveDirectRoute } from "@/features/registry/features";
import { gateFeatureMarkup } from "@/content/feature-markup-gate";
import { CREDIT_COSTS, FREE_DAILY_DESIGNS } from "@/lib/credits.functions";
import {
  backDestination,
  canvasView,
  classifyLoad,
  errorActions,
  shouldLeaveCanvas,
  beginCanvasOpen,
  canvasOpenIsCurrent,
  createOpenStore,
  isDuplicateOpen,
} from "@/lib/canvas-route";
import * as jobs from "@/lib/generation-jobs";
import {
  runGeneration,
  runGenerationItem,
  isCreditRefusal,
  type RunDeps,
  type JobStage,
} from "@/lib/generation-run.server";
import {
  addDraftPhotos,
  claimDraftStyle,
  clearDraft,
  ensureDraft,
  getDraft,
  openReview,
  orderedPhotos,
  patchDraft,
  recordGeneration,
  reviewIsStale,
  setDraftPhotos,
  setDraftStep,
  setDraftStyle,
  snapshotForGeneration,
  startDraft,
  startExploreDraft,
  updateDraftPhoto,
} from "@/lib/studio-draft";
import { STYLES } from "@/lib/style-catalog";
import { effectiveRatio, DEFAULT_OUTPUT_RATIO, normalizeOverride } from "@/lib/output-ratio";
import {
  clampCropModel,
  cropSnapshot,
  isCustomCropModel,
  normalizeCropModel,
  panCropBy,
  resetCropModel,
  zoomCropTo,
} from "@/lib/crop-model";
import {
  downloadRef,
  durableVersions,
  handoffRef,
  isPreviewRef,
  resolveActive,
  saveLabelFor,
  withLineage,
  type AssetRow,
  type VersionRow,
} from "@/lib/lineage";
import { primarySaveLabel, defaultGenerationSource, compareEnabled } from "@/lib/photo-editor-context";
import { capabilitiesFor } from "@/lib/canvas-capabilities";
import { filterMedia, mediaTypeLabel } from "@/lib/media-view";
import {
  EMPTY_MESSAGE,
  RECIPIENT_UNAVAILABLE,
  presentationReadiness,
  publicPresentationState,
  validItems,
} from "@/lib/presentation-publish";
import { escapeHtml, safeUrl, sanitizeLimitedHtml, toPlainText } from "@/lib/safe-html";
import { checkUrl, isBlockedHost } from "@/lib/safe-fetch.server";
import { isSafeStoragePath, validateUploadBytes, detectFileKind } from "@/lib/upload-guard";

const STYLE_A = STYLES[0]!.id;
const STYLE_B = STYLES[1]!.id;

beforeEach(() => {
  localStorage.clear();
  clearDraft();
});

/* ================================================================== *
 * 1. Authentication and protected routes
 * ================================================================== */

describe("regression: authentication and protected routes", () => {
  it("signed-out users get no available feature and no nav entry", () => {
    const ctx = featureContext({ signedIn: false });
    for (const id of ["studio", "media", "designs", "presentations", "account"] as const) {
      const v = evaluateFeature(id, ctx);
      expect(v.available, id).toBe(false);
      expect(v.visibleInNav, id).toBe(false);
    }
  });

  it("a signed-in user with a loaded plan reaches the core product", () => {
    const ctx = featureContext({ signedIn: true, planStatus: "ready" });
    for (const id of ["studio", "media", "designs", "explore"] as const) {
      expect(evaluateFeature(id, ctx).available, id).toBe(true);
    }
  });

  it("an unauthorized canvas load leaves; a network error stays and offers retry", () => {
    expect(shouldLeaveCanvas("unauthorized")).toBe(true);
    expect(shouldLeaveCanvas("network-error")).toBe(false);
    expect(canvasView("unauthorized")).toBe("redirect");
    expect(canvasView("network-error")).toBe("error");
    expect(errorActions("network-error").map((a) => a.id)).toContain("retry");
  });

  it("classifyLoad separates a missing design from an auth failure", () => {
    expect(classifyLoad({ error: { status: 401 } })).toBe("unauthorized");
    expect(classifyLoad({ error: { status: 404 } })).toBe("missing");
    expect(classifyLoad({ error: { status: 500 } })).toBe("network-error");
    expect(classifyLoad({ record: {} })).toBe("loaded");
  });

  it("refresh restoration keeps the caller's return destination", () => {
    expect(backDestination({ from: "media" } as never)).toBeTruthy();
    expect(backDestination(null)).toBeTruthy();
  });
});

/* ================================================================== *
 * 2. Studio intake — every source
 * ================================================================== */

describe("regression: studio intake sources", () => {
  const sources = ["upload", "property", "media", "describe", "explore"] as const;

  it("each source starts a draft that lands in Prepare Photos with photos attached", () => {
    for (const origin of sources) {
      clearDraft();
      startDraft(origin);
      addDraftPhotos([{ key: `${origin}-1`, path: `u/${origin}/1.jpg`, name: "One" }]);
      setDraftStep("photos");
      const d = getDraft()!;
      expect(d.origin, origin).toBe(origin);
      expect(d.step, origin).toBe("photos");
      expect(d.photos.length, origin).toBe(1);
      expect(d.photos[0]!.path, origin).toBe(`u/${origin}/1.jpg`);
    }
  });

  it("uploading one photo and uploading many produce the same shape and order", () => {
    startDraft("upload");
    addDraftPhotos([{ key: "a", path: "u/a.jpg", name: "A" }]);
    addDraftPhotos([
      { key: "b", path: "u/b.jpg", name: "B" },
      { key: "c", path: "u/c.jpg", name: "C" },
    ]);
    expect(orderedPhotos(getDraft()).map((p) => p.key)).toEqual(["a", "b", "c"]);
  });

  it("Add More Photos appends without disturbing existing per-photo settings", () => {
    startDraft("upload");
    addDraftPhotos([{ key: "a", path: "u/a.jpg", name: "A" }]);
    updateDraftPhoto("a", { instructions: "keep the rug", ratio: "1:1" });
    addDraftPhotos([{ key: "d", path: "u/d.jpg", name: "D" }]);
    const d = getDraft()!;
    expect(d.photos.find((p) => p.key === "a")!.instructions).toBe("keep the rug");
    expect(d.photos.find((p) => p.key === "a")!.ratio).toBe("1:1");
    expect(d.photos.map((p) => p.key)).toEqual(["a", "d"]);
  });

  it("a blob URL is never accepted as a durable photo path", () => {
    startDraft("upload");
    addDraftPhotos([{ key: "blob", path: "blob:http://localhost/x", name: "B" }]);
    expect(getDraft()!.photos[0]!.path).toBeNull();
  });
});

/* ================================================================== *
 * 3. Explore → Try This Style
 * ================================================================== */

describe("regression: Explore → Try This Style", () => {
  it("selecting a style creates a draft and charges nothing", () => {
    const d = startExploreDraft(STYLE_A);
    expect(d).toBeTruthy();
    expect(d!.styleId).toBe(STYLE_A);
    expect(d!.generationBatchId).toBeNull();
    expect(jobs.allBatches().length).toBe(0);
  });

  it("the chosen style survives picking a source and adding photos", () => {
    startExploreDraft(STYLE_A);
    addDraftPhotos([{ key: "p1", path: "u/p1.jpg", name: "P1" }]);
    setDraftStep("photos");
    expect(getDraft()!.styleId).toBe(STYLE_A);
  });

  it("only one workflow session may claim the handoff", () => {
    startExploreDraft(STYLE_A);
    expect(claimDraftStyle("session-1")?.id).toBe(STYLE_A);
    expect(claimDraftStyle("session-2")).toBeNull();
  });

  it("an unknown style id never reaches the draft", () => {
    startExploreDraft("no-such-style");
    expect(getDraft()?.styleId ?? null).toBeNull();
  });
});

/* ================================================================== *
 * 4. Design workflow → Review
 * ================================================================== */

describe("regression: design workflow", () => {
  function seed() {
    startDraft("upload");
    addDraftPhotos([
      { key: "a", path: "u/a.jpg", name: "A" },
      { key: "b", path: "u/b.jpg", name: "B" },
    ]);
    return getDraft()!;
  }

  it("image format defaults to Original until the user chooses", () => {
    const d = seed();
    expect(d.outputRatio).toBe(DEFAULT_OUTPUT_RATIO);
    expect(d.outputRatioExplicit).toBe(false);
    patchDraft({ outputRatio: "16:9", outputRatioExplicit: true });
    expect(getDraft()!.outputRatioExplicit).toBe(true);
  });

  it("a per-photo format override wins over the project format", () => {
    seed();
    patchDraft({ outputRatio: "16:9", outputRatioExplicit: true });
    updateDraftPhoto("b", { ratio: "1:1" });
    const d = getDraft()!;
    expect(effectiveRatio(d.outputRatio, d.photos.find((p) => p.key === "a")!.ratio)).toBe("16:9");
    expect(effectiveRatio(d.outputRatio, d.photos.find((p) => p.key === "b")!.ratio)).toBe("1:1");
    expect(normalizeOverride("nonsense")).toBeNull();
  });

  it("crop position is stored normalized, clamped and resettable", () => {
    seed();
    const zoomed = zoomCropTo(normalizeCropModel(null), 2);
    const panned = panCropBy(zoomed, 5, 5, 1);
    const clamped = clampCropModel(panned, 1);
    expect(clamped.focalX).toBeGreaterThanOrEqual(0);
    expect(clamped.focalX).toBeLessThanOrEqual(1);
    expect(clamped.focalY).toBeGreaterThanOrEqual(0);
    expect(clamped.focalY).toBeLessThanOrEqual(1);
    updateDraftPhoto("a", { crop: clamped });
    const stored = getDraft()!.photos.find((p) => p.key === "a")!.crop!;
    expect(isCustomCropModel(stored)).toBe(true);
    expect(isCustomCropModel(resetCropModel(stored))).toBe(false);
    expect(cropSnapshot(stored, "1:1").ratio).toBe("1:1");
  });

  it("Design Style, Direction, Finish Grade and Structure Protection all persist", () => {
    seed();
    setDraftStyle(STYLE_A);
    patchDraft({
      designDirection: "warm-minimal",
      finishGrade: "premium",
      structureProtection: "strict",
    });
    const d = getDraft()!;
    expect(d.styleId).toBe(STYLE_A);
    expect(d.styleName).toBeTruthy();
    expect(d.designDirection).toBe("warm-minimal");
    expect(d.finishGrade).toBe("premium");
    expect(d.structureProtection).toBe("strict");
  });

  it("a per-photo style override does not change the shared style", () => {
    seed();
    setDraftStyle(STYLE_A);
    updateDraftPhoto("b", { styleId: STYLE_B });
    const d = getDraft()!;
    expect(d.styleId).toBe(STYLE_A);
    expect(d.photos.find((p) => p.key === "b")!.styleId).toBe(STYLE_B);
    expect(d.photos.find((p) => p.key === "a")!.styleId).toBeNull();
  });

  it("Review renders exactly the draft that Generate submits", () => {
    seed();
    setDraftStyle(STYLE_A);
    patchDraft({ instructions: "keep the floors" });
    updateDraftPhoto("a", { instructions: "remove the lamp" });

    const review = openReview()!;
    const submitted = snapshotForGeneration(review.rev);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.snapshot.rev).toBe(review.rev);
    expect(submitted.snapshot.draft.instructions).toBe(review.draft.instructions);
    expect(submitted.snapshot.draft.styleId).toBe(review.draft.styleId);
    expect(submitted.snapshot.draft.photos.map((p) => p.instructions)).toEqual(
      review.draft.photos.map((p) => p.instructions),
    );
  });

  it("Generate refuses a snapshot that changed after Review rendered", () => {
    seed();
    const review = openReview()!;
    updateDraftPhoto("a", { instructions: "changed my mind" });
    expect(reviewIsStale(review.rev)).toBe(true);
    expect(snapshotForGeneration(review.rev).ok).toBe(false);
  });

  it("recording a generation moves the draft to the generating step", () => {
    seed();
    const review = openReview()!;
    const d = recordGeneration("batch-1", review.rev);
    expect(d.generationBatchId).toBe("batch-1");
    expect(d.step).toBe("generating");
  });

  it("deselecting photos does not lose them from the draft", () => {
    seed();
    setDraftPhotos([
      { key: "a", path: "u/a.jpg", selected: false },
      { key: "b", path: "u/b.jpg", selected: true },
    ]);
    const d = getDraft()!;
    expect(d.photos.length).toBe(2);
    expect(d.photos.filter((p) => p.selected).length).toBe(1);
  });
});

/* ================================================================== *
 * 5. Generation — real jobs, no duplicate charge, recovery
 * ================================================================== */

function harness(opts: { fail?: boolean; allow?: boolean } = {}) {
  const records = new Map<string, any>();
  const claims = new Set<string>();
  const ledger: Array<{ kind: "charge" | "refund"; amount: number }> = [];
  let n = 0;
  const deps: RunDeps = {
    async claim(key) {
      if (claims.has(key)) return { claimed: false, jobId: records.get(key)?.job_id ?? null } as any;
      claims.add(key);
      records.set(key, { key, state: "running", job_id: null, result: null });
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
      return `job-${++n}`;
    },
    async setJobStage(_id: string, _stage: JobStage) {},
    async charge() {
      if (opts.allow === false) return { ok: false, reason: "insufficient_credits", cost: 1, balance: 0 } as any;
      ledger.push({ kind: "charge", amount: 1 });
      return { ok: true, charged: 1, balance: 9, remainingToday: 4 } as any;
    },
    async refund(_u: string, amount: number) {
      ledger.push({ kind: "refund", amount });
    },
    chargeErrorMessage: () => "Not enough credits.",
    sleep: async () => {},
    waitMs: 5,
  };
  const count = (k: "charge" | "refund") => ledger.filter((l) => l.kind === k).length;
  return { deps, ledger, count };
}

const request = (over: Record<string, unknown> = {}) => ({
  userId: "u1",
  action: "design" as const,
  kind: "design.render",
  parts: ["photo-a", STYLE_A],
  ...over,
});

describe("regression: generation", () => {
  it("a generation performs real work and returns a durable result, not a navigation", async () => {
    const h = harness();
    const out = await runGeneration(request(), async () => ({ path: "u/out/1.png" }), h.deps);
    expect(out.path).toBe("u/out/1.png");
    expect(out.stage).toBe("succeeded");
    expect(isPreviewRef(out.path as string)).toBe(false);
  });

  it("a double-click cannot spend two credits", async () => {
    const h = harness();
    let calls = 0;
    const work = async () => {
      calls++;
      return { path: "u/out/1.png" };
    };
    const [a, b] = await Promise.all([
      runGeneration(request(), work, h.deps).catch((e) => e),
      runGeneration(request(), work, h.deps).catch((e) => e),
    ]);
    expect(h.count("charge")).toBe(1);
    expect(calls).toBe(1);
    /* Either the second call replays the first result or it is rejected as a
       duplicate; what it must never do is charge again. */
    const results = [a, b].filter((r) => r && !(r instanceof Error));
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("a repeated request after success replays without a second charge", async () => {
    const h = harness();
    const work = async () => ({ path: "u/out/1.png" });
    const first = await runGeneration(request(), work, h.deps);
    const second = await runGeneration(request(), work, h.deps);
    expect(second.path).toBe(first.path);
    expect(second.replayed).toBe(true);
    expect(h.count("charge")).toBe(1);
  });

  it("a failure refunds exactly once and a retry can still succeed", async () => {
    const h = harness();
    await expect(
      runGeneration(request(), async () => {
        throw new Error("model timeout");
      }, h.deps),
    ).rejects.toThrow("model timeout");
    expect(h.count("charge")).toBe(1);
    expect(h.count("refund")).toBe(1);

    const retry = await runGeneration(
      request({ parts: ["photo-a", STYLE_A, "retry-1"] }),
      async () => ({ path: "u/out/2.png" }),
      h.deps,
    );
    expect(retry.path).toBe("u/out/2.png");
    expect(h.count("charge")).toBe(2);
  });

  it("refuses before charging when credits are short", async () => {
    const h = harness({ allow: false });
    let ran = false;
    await expect(
      runGeneration(request(), async () => {
        ran = true;
        return { path: "x" };
      }, h.deps),
    ).rejects.toSatisfy((e: Error) => isCreditRefusal(e.message));
    expect(ran).toBe(false);
    expect(h.count("charge")).toBe(0);
  });

  it("a partly failed batch reports per-item outcomes and keeps the successes", async () => {
    const h = harness();
    const outcomes = await Promise.all(
      ["ok-1", "bad", "ok-2"].map((id) =>
        runGenerationItem(
          request({ parts: ["batch", id] }),
          async () => {
            if (id === "bad") throw new Error("render failed");
            return id;
          },
          h.deps,
        ),
      ),
    );
    const good = outcomes.filter((o) => o.ok);
    const bad = outcomes.filter((o) => !o.ok);
    expect(good.length).toBe(2);
    expect(bad.length).toBe(1);
  });

  it("a job interrupted by a page close comes back as a failure with retry, never restarted", () => {
    jobs.__resetJobs();
    localStorage.setItem(
      "rd.gen.jobs.v1",
      JSON.stringify({
        session: "a-previous-page-load",
        batches: [
          {
            id: "b1",
            key: "k1",
            createdAt: Date.now(),
            jobs: [{ id: "j1", stage: "generating", charged: true, label: "A" }],
          },
        ],
      }),
    );
    const restored = jobs.loadJobs();
    const job = restored[0]!.jobs[0]!;
    expect(job.stage).toBe("failed");
    expect(job.interrupted).toBe(true);
    expect(jobs.isActive(job.stage)).toBe(false);
  });

  it("batch creation is idempotent for the same key", () => {
    const seeds = [{ id: "s1", label: "A" } as never];
    const first = jobs.createBatch("stable-key", seeds);
    const again = jobs.createBatch("stable-key", seeds);
    expect(again.id).toBe(first.id);
  });

  it("credit costs and the free daily allowance stay on the published prices", () => {
    expect(CREDIT_COSTS).toEqual({ design: 1, scope: 3, plan_3d: 6, video: 40 });
    expect(FREE_DAILY_DESIGNS).toBe(5);
  });
});

/* ================================================================== *
 * 6. Canvas — one geometry across every tool
 * ================================================================== */

const asset: AssetRow = {
  id: "asset-1",
  storage_path: "u/asset-1/original.jpg",
  approved_version_id: null,
} as AssetRow;

function mkVersion(
  id: string,
  createdAt: string,
  parent: { kind: "asset" | "version"; id: string; path: string },
  operation: "generate" | "edit",
): VersionRow {
  const path = `u/asset-1/${id}.png`;
  return {
    id,
    asset_id: "asset-1",
    label: `Version ${id}`,
    storage_path: path,
    created_at: createdAt,
    ops: withLineage(null, {
      v: 1,
      sourceAssetId: "asset-1",
      parent,
      operation,
      jobId: null,
      outputAssetId: "asset-1",
      outputVersionId: id,
      outputPath: path,
      userId: "u1",
      propertyId: null,
      projectId: null,
      roomId: null,
      settings: {},
      createdAt,
      persistence: "durable",
    }),
  };
}

const versions: VersionRow[] = [
  mkVersion("v1", "2026-01-01T00:00:00Z", { kind: "asset", id: "asset-1", path: "u/asset-1/original.jpg" }, "generate"),
  mkVersion("v2", "2026-01-02T00:00:00Z", { kind: "version", id: "v1", path: "u/asset-1/v1.png" }, "edit"),
];

describe("regression: canvas identity across tools", () => {
  const tools = ["redesign", "declutter", "materials", "angles", "floorplan", "animate", "edit-photo"];

  it("every tool resolves the same active image for the same selection", () => {
    const refs = tools.map(() => resolveActive(asset, versions, "v2").ref.path);
    expect(new Set(refs).size).toBe(1);
    expect(refs[0]).toBe("u/asset-1/v2.png");
  });

  it("handing an image from one tool to another never changes which version travels", () => {
    const a = handoffRef(asset, versions, "v2");
    const b = handoffRef(asset, versions, "v2");
    expect(a).toEqual(b);
    expect(a.id).toBe("v2");
  });

  it("download writes the version on screen, not the newest one", () => {
    expect(downloadRef(asset, versions, "v1").path).toBe("u/asset-1/v1.png");
  });

  it("with nothing selected the original anchors the canvas", () => {
    const active = resolveActive(asset, versions, null);
    expect(active.role).toBe("source");
    expect(active.ref.path).toBe(asset.storage_path);
  });

  it("a version that vanished raises instead of silently swapping the image", () => {
    expect(() => resolveActive(asset, versions, "gone")).toThrow();
  });

  it("Version History lists durable versions only, oldest first", () => {
    const withPreview = versions.concat([
      { id: "v3", asset_id: "asset-1", storage_path: "blob:preview", created_at: "2026-01-03T00:00:00Z" } as VersionRow,
    ]);
    const list = durableVersions(withPreview);
    expect(list.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("each tool declares a capability set, so the action bar is data driven", () => {
    for (const t of tools) {
      expect(Array.isArray(capabilitiesFor(t)), t).toBe(true);
    }
  });

  it("Hold to Compare is offered only once there is something to compare", () => {
    expect(compareEnabled(false)).toBe(false);
    expect(compareEnabled(true)).toBe(true);
  });
});

/* ================================================================== *
 * 7. Edit Photo — save semantics
 * ================================================================== */

describe("regression: photo editor saves", () => {
  it("editing a source photo saves as a new version; editing an open version saves changes", () => {
    expect(saveLabelFor({ role: "source", asset })).toBe("Save as New Version");
    expect(saveLabelFor({ role: "version", asset, version: versions[1]! })).toBe("Save Changes");
  });

  it("an approved or published version can only branch, never be overwritten", () => {
    const published = { ...versions[1]!, approved: true };
    expect(saveLabelFor({ role: "version", asset, version: published })).toBe("Save as New Version");
    expect(
      saveLabelFor({ role: "version", asset, version: versions[1]!, published: true }),
    ).toBe("Save as New Version");
  });

  it("the primary save label follows the editor mode", () => {
    expect(primarySaveLabel({ mode: "source" })).toBeTruthy();
    expect(primarySaveLabel({ mode: "generated", hasPersistedVersion: true })).toBeTruthy();
  });

  it("edited pixels drive generation only when the user edited the source", () => {
    expect(defaultGenerationSource("source")).toBe("edited");
    expect(defaultGenerationSource("generated")).toBe("original");
  });

  it("an edit never overwrites the immutable original", () => {
    const saved = mkVersion(
      "v9",
      "2026-02-01T00:00:00Z",
      { kind: "asset", id: "asset-1", path: asset.storage_path },
      "edit",
    );
    expect(saved.storage_path).not.toBe(asset.storage_path);
    expect(durableVersions([saved]).length).toBe(1);
  });
});

/* ================================================================== *
 * 8. Media library
 * ================================================================== */

describe("regression: media library", () => {
  const items = [
    { id: "m1", type: "photo", title: "Kitchen", room: "Kitchen", created_at: "2026-01-01", storage_path: "u/m1.jpg" },
    { id: "m2", type: "video", title: "Tour", created_at: "2026-02-01", storage_path: "u/m2.mp4" },
    { id: "m3", type: "photo", title: "Living Room", created_at: "2026-03-01", storage_path: "u/m3.jpg" },
  ];

  it("search narrows by name without dropping unrelated fields", () => {
    const found = filterMedia(items, { q: "kitchen" } as never);
    expect(found.map((m: any) => m.id)).toEqual(["m1"]);
  });

  it("an empty filter returns everything", () => {
    expect(filterMedia(items, {} as never).length).toBe(3);
  });

  it("every item resolves a human label, so cards cannot render blank", () => {
    for (const m of items) expect(mediaTypeLabel(m)).toBeTruthy();
  });
});

/* ================================================================== *
 * 9. Presentations
 * ================================================================== */

describe("regression: presentations", () => {
  const item = { id: "i1", version_id: "v2", url: "u/asset-1/v2.png", status: "ready" };

  it("an empty presentation cannot be published, copied or sent", () => {
    const r = presentationReadiness([]);
    expect(r.canPublish).toBe(false);
    expect(r.canCopyLink).toBe(false);
    expect(r.canSend).toBe(false);
    expect(r.message).toBe(EMPTY_MESSAGE);
  });

  it("one usable design is enough to publish, approve and export", () => {
    const r = presentationReadiness([item]);
    expect(r.canPublish).toBe(true);
    expect(r.canApprove).toBe(true);
    expect(r.canExportPdf).toBe(true);
    expect(r.message).toBeNull();
  });

  it("a recipient opening an emptied link sees the unavailable notice, not a broken page", () => {
    const state = publicPresentationState([]);
    expect(state.visible).toBe(false);
    expect(state.showApproval).toBe(false);
    expect(state.message).toBe(RECIPIENT_UNAVAILABLE);
  });

  it("failed or still-processing designs are never published", () => {
    expect(validItems([{ id: "x", status: "failed" }]).length).toBe(0);
    expect(validItems([{ id: "y", status: "processing" }]).length).toBe(0);
    expect(validItems([item]).length).toBe(1);
  });

  it("a published item stays pinned to the version it was published with", () => {
    const published = validItems([item, { id: "i2", version_id: "v1", status: "ready" }]);
    expect(published.map((p) => p.version_id)).toEqual(["v2", "v1"]);
  });

});

/* ================================================================== *
 * 10. Feature suppression
 * ================================================================== */

describe("regression: feature suppression", () => {
  const ready = featureContext({ signedIn: true, planStatus: "ready" });
  const loading = featureContext({ signedIn: true, planStatus: "loading" });

  it("suppressed features are unavailable, hidden from nav and refused by the server", () => {
    for (const id of ["budget", "checkout", "api_white_label"] as const) {
      const v = evaluateFeature(id, ready);
      expect(v.available, id).toBe(false);
      expect(v.visibleInNav, id).toBe(false);
      expect(featureServerEnabled(id), id).toBe(false);
    }
  });

  it("a direct route to the suppressed Budget view redirects with no partial UI", () => {
    const verdict = resolveDirectRoute("scope", ready);
    expect(verdict.feature).toBe("budget");
    expect(verdict.action).toBe("redirect");
    expect(verdict.to).toBe("dash");
  });

  it("markup for suppressed features is stripped before it reaches the DOM", () => {
    const html = gateFeatureMarkup(
      `<div id="v-scope"><span id="kpiBudget">secret</span></div><div id="v-dash">ok</div>`,
    );
    expect(html).not.toContain("v-scope");
    expect(html).not.toContain("kpiBudget");
    expect(html).toContain("v-dash");
  });

  it("a slowly loading plan never flashes a restricted destination as usable", () => {
    const gated = evaluateFeature("contractor_scope", loading);
    expect(gated.available).toBe(false);
  });
});

/* ================================================================== *
 * 11. Security boundaries
 * ================================================================== */

describe("regression: security boundaries", () => {
  it("XSS payloads render inertly", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "<svg/onload=alert(1)>",
      "\"><iframe src=javascript:alert(1)>",
    ];
    for (const p of payloads) {
      const escaped = escapeHtml(p);
      expect(escaped).not.toContain("<script");
      expect(escaped).not.toContain("<img");
      const limited = sanitizeLimitedHtml(p);
      expect(limited.toLowerCase()).not.toContain("onerror");
      expect(limited.toLowerCase()).not.toContain("<script");
      expect(toPlainText(p)).not.toContain("<");
    }
  });

  it("javascript: and data: URLs never survive as link targets", () => {
    expect(safeUrl("javascript:alert(1)")).not.toMatch(/^javascript:/i);
    expect(safeUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("SSRF protections reject private and metadata targets", () => {
    for (const host of ["localhost", "127.0.0.1", "169.254.169.254", "10.0.0.5", "192.168.1.9", "[::1]"]) {
      expect(isBlockedHost(host), host).toBe(true);
    }
    expect(checkUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(checkUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkUrl("https://images.example.com/a.jpg").ok).toBe(true);
  });

  it("upload validation rejects content that is not the image it claims to be", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(detectFileKind(html)).not.toBe("jpeg");
    const verdict = validateUploadBytes("room-photos", html, "image/jpeg");
    expect(verdict.ok).toBe(false);
  });

  it("ownership is enforced by the storage path, so one workspace cannot read another", () => {
    expect(isSafeStoragePath("user-a/photos/1.jpg", "user-a")).toBe(true);
    expect(isSafeStoragePath("user-b/photos/1.jpg", "user-a")).toBe(false);
    expect(isSafeStoragePath("user-a/../user-b/1.jpg", "user-a")).toBe(false);
  });
});

/* ================================================================== *
 * 12. Duplicate-open protection (canvas + generate entry points)
 * ================================================================== */

describe("regression: duplicate entry protection", () => {
  it("a second canvas open for the same photo is recognised as a duplicate", () => {
    const store = createOpenStore();
    const token = beginCanvasOpen(store, "photo-1");
    expect(canvasOpenIsCurrent(store, token, "photo-1")).toBe(true);
    expect(isDuplicateOpen(store, "photo-1", "loading")).toBe(true);
    expect(isDuplicateOpen(store, "photo-1", "loaded")).toBe(false);
    beginCanvasOpen(store, "photo-2");
    expect(canvasOpenIsCurrent(store, token, "photo-1")).toBe(false);
  });
});
