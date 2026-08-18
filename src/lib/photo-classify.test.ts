import { describe, expect, it } from "vitest";
import {
  ACCEPT_CONFIDENCE, arrangeRank, missingRecommendation, normalizeCategory,
  noticeSignature, recommendationCopy, resolvePhoto, UNCONFIRMED_COPY,
} from "@/lib/photo-classify";

const p = (id: string, label: string | null, confidence = 0.95, manual: string | null = null) =>
  resolvePhoto({ id, label, confidence, manual });

describe("label normalization", () => {
  it("folds front-exterior synonyms", () => {
    for (const s of ["Front Exterior", "exterior front", "Front Elevation", "Facade", "Front View", "Curb View", "Street View", "House Exterior"]) {
      expect(normalizeCategory(s)).toBe("Front Exterior");
    }
  });
  it("folds living-room synonyms", () => {
    for (const s of ["Living Room", "Family Room", "Great Room", "Lounge", "Main Living Area", "Open Living Area"]) {
      expect(normalizeCategory(s)).toBe("Living Room");
    }
  });
  it("never turns an unsorted placeholder into a category", () => {
    for (const s of ["Unsorted", "Needs Review", "Uncertain", "", null, "Other"]) {
      expect(normalizeCategory(s)).toBeNull();
    }
  });
});

describe("confidence bands", () => {
  it("accepts at or above 0.70, reviews from 0.45, drops below", () => {
    expect(p("a", "Kitchen", ACCEPT_CONFIDENCE).state).toBe("confirmed");
    expect(p("a", "Kitchen", 0.6).state).toBe("review");
    expect(p("a", "Kitchen", 0.44).state).toBe("unsorted");
    expect(p("a", "Kitchen", 0.44).label).toBe("Unsorted");
  });
  it("lets a manual label override the classifier", () => {
    const r = p("a", "Kitchen", 0.99, "Living Room");
    expect(r.category).toBe("Living Room");
    expect(r.source).toBe("manual");
    expect(r.state).toBe("confirmed");
  });
});

describe("missing-photo recommendation", () => {
  const full = [p("1", "Front Exterior"), p("2", "Living Room"), p("3", "Kitchen")];

  it("stays silent while analysis is pending or running", () => {
    const pend = [p("1", null, 0), p("2", null, 0)];
    expect(missingRecommendation(pend, "pending").show).toBe(false);
    expect(missingRecommendation(pend, "running").show).toBe(false);
  });

  it("never claims a room is missing when classification failed", () => {
    const r = missingRecommendation([p("1", null, 0)], "failed");
    expect(r.kind).toBe("unconfirmed");
    expect(r.missing).toEqual([]);
    expect(r.message).toBe(UNCONFIRMED_COPY);
  });

  it("uses neutral wording while any photo is unresolved", () => {
    const mixed = [p("1", "Kitchen"), p("2", null, 0.2)];
    const r = missingRecommendation(mixed, "completed");
    expect(r.reason).toBe("unresolved");
    expect(r.kind).toBe("unconfirmed");
    expect(r.message).toBe(UNCONFIRMED_COPY);
  });

  it("treats a low-confidence guess as Needs Review, not as absence", () => {
    const low = [p("1", "Front Exterior"), p("2", "Living Room", 0.5)];
    expect(low[1].label).toBe("Needs Review");
    const r = missingRecommendation(low, "completed");
    expect(r.kind).toBe("unconfirmed");
    expect(r.missing).toEqual([]);
  });

  it("accepts synonyms as satisfying the recommendation", () => {
    const syn = [p("1", "Facade"), p("2", "Great Room")];
    expect(missingRecommendation(syn, "completed").show).toBe(false);
    const syn2 = [p("1", "Front Elevation"), p("2", "Family Room")];
    expect(missingRecommendation(syn2, "completed").show).toBe(false);
  });

  it("offers selection when the photo exists but is unchecked", () => {
    const sel = [
      resolvePhoto({ id: "1", label: "Front Exterior", confidence: 0.95, selected: true }),
      resolvePhoto({ id: "2", label: "Living Room", confidence: 0.95, selected: false }),
    ];
    const r = missingRecommendation(sel, "completed");
    expect(r.kind).toBe("unselected");
    expect(r.unselected).toEqual(["Living Room"]);
    expect(r.missing).toEqual([]);

    const both = sel.map((x) => ({ ...x, selected: true }));
    expect(missingRecommendation(both, "completed").show).toBe(false);
  });

  it("reopens a dismissal when selection changes", () => {
    const on = resolvePhoto({ id: "1", label: "Kitchen", confidence: 0.9, selected: true });
    const off = { ...on, selected: false };
    expect(noticeSignature([on])).not.toBe(noticeSignature([off]));
  });

  it("says nothing when both recommended spaces are present", () => {
    expect(missingRecommendation(full, "completed").show).toBe(false);
  });

  it("names only the category that is actually missing", () => {
    const noLiving = [p("1", "Front Exterior"), p("2", "Kitchen")];
    const r = missingRecommendation(noLiving, "completed");
    expect(r.missing).toEqual(["Living Room"]);
    expect(r.message).toBe("Consider adding a living-room photo for a more complete tour.");

    const noFront = [p("1", "Living Room"), p("2", "Kitchen")];
    expect(missingRecommendation(noFront, "completed").missing).toEqual(["Front Exterior"]);
  });

  it("combines only when both are missing", () => {
    const neither = [p("1", "Kitchen"), p("2", "Bedroom")];
    const r = missingRecommendation(neither, "completed");
    expect(r.missing).toEqual(["Front Exterior", "Living Room"]);
    expect(r.message).toBe("Consider adding front exterior and living-room photos for a more complete tour.");
  });

  it("clears as soon as a manual label supplies the space", () => {
    const before = [p("1", "Kitchen"), p("2", "Bedroom")];
    expect(missingRecommendation(before, "completed").show).toBe(true);
    const after = [p("1", "Kitchen", 0.9, "Front Exterior"), p("2", "Bedroom", 0.9, "Great Room")];
    expect(missingRecommendation(after, "completed").show).toBe(false);
  });

  it("changes signature when photos or labels change, so a dismissal reopens", () => {
    const a = noticeSignature([p("1", "Kitchen")]);
    expect(noticeSignature([p("1", "Kitchen")])).toBe(a);
    expect(noticeSignature([p("1", "Kitchen"), p("2", "Bedroom")])).not.toBe(a);
    expect(noticeSignature([p("1", "Living Room")])).not.toBe(a);
  });

  it("writes no copy for an empty list", () => {
    expect(recommendationCopy([])).toBe("");
  });
});

describe("auto arrange order", () => {
  it("walks the home front to back", () => {
    const order = ["Kitchen", "Front Exterior", "Bedroom", "Living Room", "Rear Exterior", "Entry"];
    const sorted = order.slice().sort((x, y) => arrangeRank(x) - arrangeRank(y));
    expect(sorted).toEqual(["Front Exterior", "Entry", "Living Room", "Kitchen", "Bedroom", "Rear Exterior"]);
  });
  it("puts unknown rooms last", () => {
    expect(arrangeRank("Unsorted")).toBeGreaterThan(arrangeRank("Rear Exterior"));
  });
});
