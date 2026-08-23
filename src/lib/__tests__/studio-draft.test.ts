// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { STYLES } from "@/lib/style-catalog";
import {
  addDraftPhotos,
  adaptLegacyDraft,
  claimDraftStyle,
  clearDraft,
  commitDraft,
  ensureDraft,
  getDraft,
  openReview,
  orderedPhotos,
  patchDraft,
  recordGeneration,
  removeDraftPhoto,
  reviewIsStale,
  setDraftOrder,
  setDraftStep,
  snapshotForGeneration,
  startDraft,
  startExploreDraft,
  styleForPhoto,
  updateDraftPhoto,
  type DraftStep,
} from "@/lib/studio-draft";
import { getStudioStyle, setStudioStyle, clearStudioStyle } from "@/lib/studio-style";

const STYLE = STYLES[0]!;
const OTHER = STYLES.find((s) => s.id !== STYLE.id)!;

function photo(over: Record<string, unknown> = {}) {
  return { key: "p1", path: "u/1.jpg", name: "Kitchen.jpg", room: "Kitchen", ...over };
}

describe("canonical studio draft", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDraft();
  });

  it("uses one workflow for a one-photo draft", () => {
    startDraft("upload");
    addDraftPhotos([photo()]);
    const d = getDraft()!;
    expect(d.photos).toHaveLength(1);
    expect(d.order).toEqual(["p1"]);
    expect(d.step).toBe("source");
  });

  it("uses the same model for a multi-photo draft", () => {
    startDraft("upload");
    addDraftPhotos([photo(), photo({ key: "p2", path: "u/2.jpg" }), photo({ key: "p3", path: "u/3.jpg" })]);
    const d = getDraft()!;
    expect(d.photos.map((p) => p.key)).toEqual(["p1", "p2", "p3"]);
    expect(d.origin).toBe("upload");
  });

  it("creates an Explore-origin draft that never generates or charges", () => {
    const d = startExploreDraft(STYLE.id)!;
    expect(d.origin).toBe("explore");
    expect(d.step).toBe("source");
    expect(d.styleId).toBe(STYLE.id);
    expect(d.generationBatchId).toBeNull();
  });

  it("keeps the Explore style after photos are added", () => {
    startExploreDraft(STYLE.id);
    addDraftPhotos([photo(), photo({ key: "p2", path: "u/2.jpg" })]);
    setDraftStep("design");
    expect(getDraft()!.styleId).toBe(STYLE.id);
    expect(styleForPhoto("p2")).toBe(STYLE.id);
  });

  it("creates property- and media-origin drafts", () => {
    startDraft("property", { propertyId: "11111111-1111-1111-1111-111111111111" });
    expect(getDraft()!.origin).toBe("property");
    expect(getDraft()!.propertyId).toBe("11111111-1111-1111-1111-111111111111");
    startDraft("media");
    expect(getDraft()!.origin).toBe("media");
    expect(getDraft()!.propertyId).toBeNull();
  });

  it("restores the exact step and settings on every step after a refresh", () => {
    startDraft("studio");
    addDraftPhotos([photo()]);
    patchDraft({ outputRatio: "4:5", outputRatioExplicit: true, instructions: "Keep the rug." });
    const steps: DraftStep[] = ["source", "photos", "design", "review", "generating", "complete"];
    for (const step of steps) {
      setDraftStep(step);
      /* A refresh is just another read of the persisted record. */
      const restored = getDraft()!;
      expect(restored.step).toBe(step);
      expect(restored.outputRatio).toBe("4:5");
      expect(restored.outputRatioExplicit).toBe(true);
      expect(restored.instructions).toBe("Keep the rug.");
      expect(restored.photos).toHaveLength(1);
    }
  });

  it("preserves valid inputs across back and forward navigation", () => {
    startDraft("studio");
    addDraftPhotos([photo(), photo({ key: "p2", path: "u/2.jpg" })]);
    setDraftStep("design");
    patchDraft({ designDirection: "warm-modern", finishGrade: "premium" });
    setDraftStep("review");
    setDraftStep("design"); /* Back */
    expect(getDraft()!.designDirection).toBe("warm-modern");
    setDraftStep("review"); /* Forward */
    const d = getDraft()!;
    expect(d.finishGrade).toBe("premium");
    expect(d.photos).toHaveLength(2);
  });

  it("refuses a stale write from a second tab", () => {
    startDraft("studio");
    const tabA = getDraft()!;
    patchDraft({ instructions: "tab B wrote this" }); /* other tab */
    const res = commitDraft({ instructions: "tab A wrote this" }, { expectedRev: tabA.rev });
    expect(res.ok).toBe(false);
    expect(getDraft()!.instructions).toBe("tab B wrote this");
  });

  it("recovers a legacy draft and keeps unmapped fields", () => {
    localStorage.setItem(
      "rd_design_draft_v1",
      JSON.stringify({
        id: "old1",
        origin: "explore",
        step: "photos",
        selectedStyleId: STYLE.id,
        claimedBy: "s9",
        mysteryField: 42,
      }),
    );
    const d = getDraft()!;
    expect(d.id).toBe("old1");
    expect(d.styleId).toBe(STYLE.id);
    expect(d.step).toBe("photos");
    expect(d.legacyExtras).toEqual({ mysteryField: 42 });
    /* Consumed: the legacy key must not be adapted twice. */
    expect(localStorage.getItem("rd_design_draft_v1")).toBeNull();
    expect(adaptLegacyDraft(null)).toBeNull();
  });

  it("consumes the legacy style handoff key once", () => {
    localStorage.setItem("rd_style_choice", JSON.stringify({ styleId: STYLE.id }));
    const d = ensureDraft("studio");
    expect(d.styleId).toBe(STYLE.id);
    expect(localStorage.getItem("rd_style_choice")).toBeNull();
  });

  it("persists the style through the whole workflow and hands it over once", () => {
    startExploreDraft(STYLE.id);
    expect(claimDraftStyle("s1")!.id).toBe(STYLE.id);
    expect(claimDraftStyle("s1")!.id).toBe(STYLE.id);
    expect(claimDraftStyle("s2")).toBeNull();
    setDraftStep("review");
    expect(getDraft()!.styleId).toBe(STYLE.id);
  });

  it("persists crops, rotation and per-photo overrides", () => {
    startDraft("studio");
    addDraftPhotos([photo()]);
    updateDraftPhoto("p1", {
      crop: { x: 0.2, y: 0.4 },
      ratio: "1:1",
      rotation: 90,
      styleId: OTHER.id,
      instructions: "Leave the window bare.",
    });
    const p = getDraft()!.photos[0]!;
    expect(p.crop).toEqual({ x: 0.2, y: 0.4 });
    expect(p.ratio).toBe("1:1");
    expect(p.rotation).toBe(90);
    expect(styleForPhoto("p1")).toBe(OTHER.id);
    expect(p.instructions).toBe("Leave the window bare.");
  });

  it("persists photo order and drops removed photos from it", () => {
    startDraft("studio");
    addDraftPhotos([photo(), photo({ key: "p2", path: "u/2.jpg" }), photo({ key: "p3", path: "u/3.jpg" })]);
    setDraftOrder(["p3", "p1", "p2"]);
    expect(orderedPhotos().map((p) => p.key)).toEqual(["p3", "p1", "p2"]);
    removeDraftPhoto("p1");
    expect(getDraft()!.order).toEqual(["p3", "p2"]);
  });

  it("gives Review the exact draft values", () => {
    startExploreDraft(STYLE.id);
    addDraftPhotos([photo({ room: "Living Room" })]);
    patchDraft({ outputRatio: "16:9", outputRatioExplicit: true, instructions: "No plants." });
    const snap = openReview()!;
    expect(snap.draft.styleId).toBe(STYLE.id);
    expect(snap.draft.outputRatio).toBe("16:9");
    expect(snap.draft.instructions).toBe("No plants.");
    expect(snap.draft.photos[0]!.room).toBe("Living Room");
    expect(reviewIsStale(snap.rev)).toBe(false);
  });

  it("generates the exact reviewed snapshot and refuses a changed draft", () => {
    startDraft("studio");
    addDraftPhotos([photo()]);
    const snap = openReview()!;
    const ok = snapshotForGeneration(snap.rev);
    expect(ok.ok).toBe(true);

    /* The user changes something after Review loaded. */
    updateDraftPhoto("p1", { room: "Bedroom" });
    expect(reviewIsStale(snap.rev)).toBe(true);
    const stale = snapshotForGeneration(snap.rev);
    expect(stale.ok).toBe(false);

    const fresh = openReview()!;
    const retry = snapshotForGeneration(fresh.rev);
    expect(retry.ok).toBe(true);
    if (retry.ok) {
      expect(retry.snapshot.draft.photos[0]!.room).toBe("Bedroom");
      recordGeneration("batch-1", retry.snapshot.rev);
    }
    expect(getDraft()!.generationBatchId).toBe("batch-1");
    expect(getDraft()!.step).toBe("generating");
  });

  it("starts an unrelated new draft without stale values", () => {
    startExploreDraft(STYLE.id);
    addDraftPhotos([photo()]);
    patchDraft({ instructions: "old project", propertyId: null });
    recordGeneration("batch-old");

    const next = startDraft("upload");
    expect(next.styleId).toBeNull();
    expect(next.photos).toHaveLength(0);
    expect(next.instructions).toBe("");
    expect(next.generationBatchId).toBeNull();
    expect(next.claimedBy).toBeNull();
    expect(claimDraftStyle("s3")).toBeNull();
  });

  it("keeps the Studio style helper scoped to the draft", () => {
    startDraft("studio");
    expect(setStudioStyle(STYLE.id)!.styleId).toBe(STYLE.id);
    expect(getStudioStyle()!.styleId).toBe(STYLE.id);
    expect(getDraft()!.styleId).toBe(STYLE.id);
    clearStudioStyle();
    expect(getStudioStyle()).toBeNull();
    /* A brand new project never inherits it. */
    setStudioStyle(OTHER.id);
    startDraft("studio");
    expect(getStudioStyle()).toBeNull();
  });
});
