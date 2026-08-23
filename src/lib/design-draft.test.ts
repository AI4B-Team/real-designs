// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { STYLES } from "@/lib/style-catalog";
import {
  startExploreDraft,
  getDraft,
  draftStyle,
  claimDraftStyle,
  removeDraftStyle,
  setDraftStep,
  patchDraft,
  clearDraft,
} from "@/lib/design-draft";

const STYLE = STYLES[0]!;

describe("canonical design draft", () => {
  beforeEach(() => {
    clearDraft();
  });

  it("stores the canonical style id and Explore origin without generating", () => {
    const d = startExploreDraft(STYLE.id)!;
    expect(d.origin).toBe("explore");
    expect(d.step).toBe("source");
    expect(d.selectedStyleId).toBe(STYLE.id);
    expect(d.selectedStyleName).toBe(STYLE.displayName);
    expect(d.generationBatchId).toBeNull();
  });

  it("rejects a style that is not in the catalog", () => {
    expect(startExploreDraft("not-a-style")).toBeNull();
    expect(getDraft()).toBeNull();
  });

  it("survives a reload and keeps the step", () => {
    startExploreDraft(STYLE.id);
    setDraftStep("photos");
    expect(getDraft()!.step).toBe("photos");
    expect(draftStyle()!.id).toBe(STYLE.id);
  });

  it("hands the style to exactly one workflow session", () => {
    startExploreDraft(STYLE.id);
    expect(claimDraftStyle("s1")!.id).toBe(STYLE.id);
    /* Same session may re-read it (refresh, Back), another one may not. */
    expect(claimDraftStyle("s1")!.id).toBe(STYLE.id);
    expect(claimDraftStyle("s2")).toBeNull();
  });

  it("does not leak an old style into a brand new Explore pick", () => {
    startExploreDraft(STYLE.id);
    claimDraftStyle("s1");
    const other = STYLES.find((s) => s.id !== STYLE.id)!;
    const next = startExploreDraft(other.id)!;
    expect(next.selectedStyleId).toBe(other.id);
    expect(next.claimedBy).toBeNull();
    expect(claimDraftStyle("s2")!.id).toBe(other.id);
  });

  it("removes the style without destroying the draft", () => {
    const d = startExploreDraft(STYLE.id)!;
    removeDraftStyle();
    expect(getDraft()!.id).toBe(d.id);
    expect(draftStyle()).toBeNull();
  });

  it("records the generation batch once", () => {
    startExploreDraft(STYLE.id);
    patchDraft({ generationBatchId: "b1", step: "generating" });
    expect(getDraft()!.generationBatchId).toBe("b1");
    expect(getDraft()!.step).toBe("generating");
  });
});
