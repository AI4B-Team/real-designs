import { describe, expect, it } from "vitest";

import { brandingPreviewLine, isInventedBrand, resolveShareBranding } from "@/lib/share-branding";
import {
  applyShareEvent,
  countsAsPublicView,
  emptyViewStats,
  isBotAgent,
  recordView,
  STATUS_LABEL,
} from "@/lib/share-status";
import {
  approvalUrl,
  buildApprovalEmail,
  buildApprovalRecord,
  canSubmitCreate,
  existingLinkFor,
  isShareableTarget,
  productionSafeOrigin,
  supersede,
  visibleUrl,
  type ApprovalTarget,
} from "@/lib/approval-link";
import {
  addItem,
  presentationReadiness,
  publicPresentationState,
  reorder,
} from "@/lib/presentation-publish";

const target: ApprovalTarget = {
  design_id: "d1",
  version_id: "v2",
  version_no: 2,
  asset_ref: "designs/d1/v2.jpg",
  asset_checksum: "sha256:abc",
  room_name: "Kitchen",
  address: "123 Apple Ln",
  style: "Modern Farmhouse",
  status: "saved",
};

describe("branding resolver", () => {
  it("falls back to the official mark when no workspace brand is configured", () => {
    const b = resolveShareBranding(null);
    expect(b.kind).toBe("official");
    expect(b.name).toBeNull();
    expect(b.poweredBy).toBe(false);
  });

  it("never shows an unverified workspace name", () => {
    expect(resolveShareBranding({ name: "Real Realty" }).kind).toBe("official");
  });

  it("shows a verified workspace brand with a powered-by line", () => {
    const b = resolveShareBranding({ name: "Real Realty", verified: true });
    expect(b.kind).toBe("workspace");
    expect(b.poweredBy).toBe(true);
    expect(brandingPreviewLine({ name: "Real Realty", verified: true })).toContain("Real Realty");
  });

  it("flags a brand derived from unrelated property data", () => {
    expect(isInventedBrand("Apple", { address: "123 Apple Ln" })).toBe(true);
    expect(isInventedBrand("Real Realty", { address: "123 Apple Ln" })).toBe(false);
  });
});

describe("quick approval link creation", () => {
  it("shows no URL before creation succeeds", () => {
    expect(visibleUrl({ phase: "idle", url: null })).toBeNull();
    expect(visibleUrl({ phase: "creating", url: null })).toBeNull();
    expect(visibleUrl({ phase: "created", url: "https://realdesigns.ai/p/tok" })).toBe(
      "https://realdesigns.ai/p/tok",
    );
  });

  it("prevents duplicate submission while creating", () => {
    expect(canSubmitCreate({ phase: "idle", url: null }, target)).toBe(true);
    expect(canSubmitCreate({ phase: "creating", url: null }, target)).toBe(false);
  });

  it("refuses unsaved, processing and failed designs", () => {
    expect(isShareableTarget({ ...target, status: "processing" })).toBe(false);
    expect(isShareableTarget({ ...target, status: "failed" })).toBe(false);
    expect(isShareableTarget({ ...target, asset_ref: "blob:xyz" })).toBe(false);
    expect(isShareableTarget(target)).toBe(true);
  });

  it("finds an existing live link for the same version", () => {
    const links = [
      { id: "l1", version_id: "v1", revoked: false },
      { id: "l2", version_id: "v2", revoked: false },
    ];
    expect(existingLinkFor(links, "v2")?.id).toBe("l2");
    expect(existingLinkFor(links, "v9")).toBeNull();
  });

  it("uses the production domain for copied links", () => {
    expect(productionSafeOrigin("http://localhost:8080")).toBe("https://realdesigns.ai");
    expect(productionSafeOrigin("https://id-preview--x.lovable.app")).toBe(
      "https://realdesigns.ai",
    );
    expect(approvalUrl("tok", "https://realdesigns.ai")).toBe("https://realdesigns.ai/p/tok");
  });
});

describe("version locking", () => {
  it("records the exact reviewed version", () => {
    const rec = buildApprovalRecord({
      target,
      link_id: "l2",
      recipient_name: "Keisha",
      decision: "approved",
    });
    expect(rec.version_id).toBe("v2");
    expect(rec.asset_checksum).toBe("sha256:abc");
    expect(rec.superseded).toBe(false);
  });

  it("supersedes rather than mutates when a new version is issued", () => {
    const rec = buildApprovalRecord({ target, link_id: "l2", decision: "approved" });
    const after = supersede(rec, "v3");
    expect(after.version_id).toBe("v2");
    expect(after.superseded).toBe(true);
    expect(rec.superseded).toBe(false);
  });
});

describe("email draft", () => {
  const mail = buildApprovalEmail({
    target,
    token: "tok",
    origin: "http://localhost:8080",
    recipient_name: "Keisha",
    sender_name: "Dolmar Cross",
  });

  it("uses the recipient, room and property", () => {
    expect(mail.subject).toBe("Your Kitchen Design Is Ready for Review");
    expect(mail.body).toContain("Hi Keisha,");
    expect(mail.body).toContain("123 Apple Ln");
  });

  it("never promises live updating and never leaks internal ids", () => {
    expect(mail.body).not.toMatch(/updates as you change/i);
    expect(mail.body).not.toContain("v2");
    expect(mail.body).toContain("https://realdesigns.ai/p/tok");
    expect(mail.html).toContain('<a href="https://realdesigns.ai/p/tok">Review Kitchen Design</a>');
  });
});

describe("status accuracy", () => {
  it("does not mark a link sent when the message is copied", () => {
    expect(applyShareEvent("created", "message_copied")).toBe("created");
  });

  it("does not mark a link sent when the email app opens", () => {
    expect(applyShareEvent("created", "email_app_opened")).toBe("email_opened");
    expect(STATUS_LABEL.email_opened).toBe("Email Opened");
  });

  it("marks sent only when REAL DESIGNS delivers the email", () => {
    expect(applyShareEvent("created", "email_sent_by_app")).toBe("sent");
  });

  it("marks opened on a genuine public open and never regresses a decision", () => {
    expect(applyShareEvent("created", "public_opened")).toBe("opened");
    expect(applyShareEvent("approved", "public_opened")).toBe("approved");
    expect(applyShareEvent("revoked", "public_opened")).toBe("revoked");
  });
});

describe("view counting", () => {
  it("ignores creator previews, bots and renderers", () => {
    expect(countsAsPublicView({ isCreator: true })).toBe(false);
    expect(countsAsPublicView({ isEditorPreview: true })).toBe(false);
    expect(countsAsPublicView({ isBot: true })).toBe(false);
    expect(countsAsPublicView({ isPdfRenderer: true })).toBe(false);
    expect(countsAsPublicView({ alreadyCountedInSession: true })).toBe(false);
    expect(countsAsPublicView({})).toBe(true);
    expect(isBotAgent("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
  });

  it("tracks creator previews separately from public opens", () => {
    let s = emptyViewStats();
    s = recordView(s, { isCreator: true });
    expect(s.publicOpens).toBe(0);
    expect(s.creatorPreviews).toBe(1);
    s = recordView(s, { at: "2026-08-23T00:00:00.000Z" });
    expect(s.publicOpens).toBe(1);
    expect(s.uniquePublicOpens).toBe(1);
    expect(s.lastOpenedAt).toBe("2026-08-23T00:00:00.000Z");
  });
});

describe("presentations", () => {
  const item = { id: "i1", version_id: "v1", url: "u" };

  it("keeps an empty presentation as an unshareable draft", () => {
    const r = presentationReadiness([]);
    expect(r.isDraft).toBe(true);
    expect(r.canPublish).toBe(false);
    expect(r.canCopyLink).toBe(false);
    expect(r.canSend).toBe(false);
    expect(r.canExportPdf).toBe(false);
    expect(r.canApprove).toBe(false);
    expect(r.canPreview).toBe(true);
    expect(r.message).toBe("Add at least one design before sharing.");
  });

  it("becomes shareable with at least one item", () => {
    const r = presentationReadiness([item]);
    expect(r.isDraft).toBe(false);
    expect(r.canPublish).toBe(true);
    expect(r.canExportPdf).toBe(true);
  });

  it("hides approval when a published presentation becomes empty", () => {
    const s = publicPresentationState([]);
    expect(s.visible).toBe(false);
    expect(s.showApproval).toBe(false);
    expect(s.message).toBe("This presentation is temporarily unavailable.");
  });

  it("prevents duplicate designs and keeps the saved order", () => {
    const first = addItem([], item);
    expect(first.added).toBe(true);
    expect(addItem(first.items, item).added).toBe(false);
    const two = addItem(first.items, { id: "i2", version_id: "v2" }).items;
    expect(reorder(two, 1, 0).map((i) => i.id)).toEqual(["i2", "i1"]);
    expect(reorder(two, 1, 0)[0]!.sort_order).toBe(0);
  });

  it("excludes failed and deleted assets", () => {
    expect(presentationReadiness([{ id: "x", status: "failed" }]).itemCount).toBe(0);
  });
});
