import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  RealDesignsLogo,
  RealDesignsLogoResponsive,
} from "@/components/brand/RealDesignsLogo";
import {
  approvalScopeMessage,
  buildItems,
  canRequestChanges,
  commentsFor,
  gateMessage,
  permissionsFrom,
  preparedByLine,
  presentationTitle,
  presentationVersion,
  recipientLine,
} from "@/lib/share-presentation";

const sections = [
  { key: "kitchen", title: "Kitchen" },
  { key: "bath", title: "Primary Bath" },
];
const assets = [
  {
    id: "a1",
    section_key: "kitchen",
    kind: "image",
    title: "Kitchen Redesign",
    url: "u1",
    compare_url: "b1",
    meta: { style: "Modern Farmhouse", version: "2" },
    sort_order: 0,
  },
  { id: "a2", section_key: "bath", kind: "image", title: "Bath", url: "u2", sort_order: 0 },
  { id: "a3", section_key: "hidden", kind: "image", title: "Excluded", url: "u3", sort_order: 0 },
];

describe("canonical logo", () => {
  it("renders the official mark", () => {
    const html = renderToStaticMarkup(<RealDesignsLogo />);
    expect(html).toContain('data-logo="real-designs"');
    expect(html).toContain('aria-label="REAL DESIGNS"');
  });

  it("offers a compact variant for mobile", () => {
    const html = renderToStaticMarkup(<RealDesignsLogoResponsive />);
    expect(html).toContain('data-variant="compact"');
    expect(html).toContain('data-variant="horizontal"');
  });

  it("never emits a typed imitation wordmark", () => {
    const html = renderToStaticMarkup(<RealDesignsLogo />);
    expect(html).not.toContain("letter-spacing");
    expect(html.match(/data-logo="real-designs"/g)).toHaveLength(1);
  });
});

describe("presentation model", () => {
  it("replaces internal placeholder names", () => {
    expect(presentationTitle("Test Pkg")).toBe("Design Presentation");
    expect(presentationTitle("7006 Orveti Court Reveal")).toBe("7006 Orveti Court Reveal");
  });

  it("never says prepared for you without a recipient", () => {
    expect(recipientLine(null)).toBe("Prepared for your review");
    expect(recipientLine("Taylor Adams")).toBe("Prepared for Taylor Adams");
  });

  it("shows sender context", () => {
    expect(preparedByLine({ sender_name: "Dolmar Cross", brand_name: "3Day Cash Buyers" })).toBe(
      "Prepared by Dolmar Cross · 3Day Cash Buyers",
    );
    expect(preparedByLine({})).toBeNull();
  });

  it("shows every included design and hides excluded ones", () => {
    const items = buildItems(sections, assets as never);
    expect(items.map((i) => i.id)).toEqual(["a1", "a2"]);
    expect(items[0]!.roomName).toBe("Kitchen");
    expect(items[0]!.style).toBe("Modern Farmhouse");
  });

  it("exposes before and after sources for comparison", () => {
    const item = buildItems(sections, assets as never)[0]!;
    expect(item.url).toBe("u1");
    expect(item.compareUrl).toBe("b1");
  });

  it("fingerprints the exact reviewed version", () => {
    const items = buildItems(sections, assets as never);
    expect(presentationVersion(items)).toBe("a1:2|a2:1");
  });

  it("keeps comments tied to their design", () => {
    const items = buildItems(sections, assets as never);
    const list = [
      { id: "c1", section_key: items[0]!.commentKey, body: "Love it", created_at: "" },
      { id: "c2", section_key: items[1]!.commentKey, body: "Change tile", created_at: "" },
    ];
    expect(commentsFor(list, items[0]!.commentKey).map((c) => c.id)).toEqual(["c1"]);
    expect(items[0]!.commentKey.length).toBeLessThanOrEqual(40);
  });

  it("states the approval scope precisely", () => {
    expect(approvalScopeMessage(6)).toBe("You are approving all 6 designs in this presentation.");
    expect(approvalScopeMessage(1)).toBe("You are approving the 1 design in this presentation.");
  });

  it("requires usable feedback before requesting changes", () => {
    expect(canRequestChanges("", [])).toBe(false);
    expect(canRequestChanges("Swap the counters", [])).toBe(true);
    expect(
      canRequestChanges("", [{ id: "c", section_key: "a:1", body: "Too dark", created_at: "" }]),
    ).toBe(true);
  });

  it("follows sender permissions", () => {
    const p = permissionsFrom({ allow_comments: false, allow_changes: false, mode: "scroll" });
    expect(p.comments).toBe(false);
    expect(p.changes).toBe(false);
    expect(p.approve).toBe(true);
    expect(p.download).toBe(false);
    expect(p.mode).toBe("scroll");
    expect(permissionsFrom(null).mode).toBe("slideshow");
  });

  it("hides approval controls for an empty presentation", () => {
    expect(buildItems(sections, [] as never)).toHaveLength(0);
  });

  it("does not leak whether a private presentation exists", () => {
    expect(gateMessage("not_found")).toBe("This presentation is no longer available.");
    expect(gateMessage("expired")).toBe(
      "This presentation link has expired. Contact the sender for a new link.",
    );
  });
});
