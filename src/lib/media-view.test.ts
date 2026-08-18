import { describe, expect, it } from "vitest";
import { assignKind, draftRecord, filterMedia, mergeDrafts, mergeRenderJobs, propertyBuckets, propertyOptions } from "@/lib/media-view";

const items = [
  { id: "a", refId: "u1", type: "uploaded_image", status: "ready", title: "Front", propertyId: "p1", property: "12 Oak" },
  { id: "b", refId: "v1", type: "generated_video", status: "draft", title: "Tour", propertyId: "p1", property: "12 Oak" },
  { id: "c", refId: "u2", type: "uploaded_image", status: "ready", title: "Loose Shot", propertyId: null, property: null },
  { id: "d", refId: "x1", type: "generated_image", status: "archived", title: "Old", propertyId: "p1", property: "12 Oak" },
];

describe("media view model", () => {
  it("maps records to the canonical row that owns the property link", () => {
    expect(assignKind(items[0])).toBe("upload");
    expect(assignKind(items[1])).toBe("video");
    expect(assignKind(items[3])).toBeNull();
    expect(assignKind({ type: "uploaded_image", job: {} })).toBeNull();
  });

  it("counts properties and the unassigned bucket without archived rows", () => {
    const { properties, unassigned } = propertyOptions(items, [{ id: "p1", address: "12 Oak" }]);
    expect(properties).toEqual([{ id: "p1", label: "12 Oak", count: 2 }]);
    expect(unassigned).toBe(1);
  });

  it("filters by property, including unassigned", () => {
    expect(filterMedia(items, { property: "p1" }).map((m) => m.id)).toEqual(["a", "b"]);
    expect(filterMedia(items, { property: "none" }).map((m) => m.id)).toEqual(["c"]);
    expect(filterMedia(items, {}).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("buckets one property's work by tab", () => {
    const b = propertyBuckets(items, "p1");
    expect(b.photos.map((m) => m.id)).toEqual(["a"]);
    expect(b.videos.map((m) => m.id)).toEqual(["b"]);
    expect(b.drafts.map((m) => m.id)).toEqual(["b"]);
    expect(propertyBuckets(items, null).all.map((m: any) => m.id)).toEqual(["c"]);
  });
});

/* ------------------------------------------------------------------ drafts */

const stagingDraft = {
  id: "11111111-1111-4111-8111-111111111111",
  project_type: "photo_staging",
  status: "draft",
  title: "Oak Street Shoot",
  property_id: "p1",
  property_address: "12 Oak",
  builder_step: "review",
  assets: [{ path: "u/1.jpg" }, { path: "u/2.jpg" }, { path: "blob:tmp" }],
  updated_at: "2026-08-10T00:00:00Z",
  created_at: "2026-08-09T00:00:00Z",
};
const designDraft = {
  id: "22222222-2222-4222-8222-222222222222",
  project_type: "photo_redesign",
  status: "draft",
  title: "Living Room Restyle",
  property_id: null,
  assets: [{ path: "u/3.jpg" }],
  updated_at: "2026-08-11T00:00:00Z",
};
const videoDraft = {
  id: "33333333-3333-4333-8333-333333333333",
  project_type: "property_video",
  status: "draft",
  title: "Tour Draft",
  property_id: "p1",
  video_project_id: "v1",
  builder_step: "scenes",
  assets: [{ path: "u/4.jpg" }],
  updated_at: "2026-08-12T00:00:00Z",
};

/** Merges mutate the records they enrich, so each case starts from a copy. */
const fresh = () => items.map((m) => ({ ...m }));

describe("durable drafts in media", () => {
  it("builds one project card per draft, not one per photo", () => {
    const rec = draftRecord(stagingDraft);
    expect(rec.id).toBe("draft_" + stagingDraft.id);
    expect(rec.photoCount).toBe(3);
    expect(rec.path).toBe("u/1.jpg"); // never a blob preview
    expect(rec.draftTypeLabel).toBe("Photo Staging");
    expect(rec.status).toBe("draft");
    expect(rec.updatedAt).toBe("2026-08-10T00:00:00Z");
  });

  it("merges a video draft into its existing project card instead of duplicating it", () => {
    const merged = mergeDrafts(fresh(), [stagingDraft, designDraft, videoDraft]);
    expect(merged.filter((m: any) => m.refId === "v1")).toHaveLength(1);
    const video = merged.find((m: any) => m.refId === "v1") as any;
    expect(video.draft).toBe(true);
    expect(video.draftId).toBe(videoDraft.id);
    expect(video.builderStep).toBe("scenes");
    expect(merged).toHaveLength(items.length + 2);
  });

  it("routes each draft type to the tab that owns it", () => {
    const merged = mergeDrafts(fresh(), [stagingDraft, designDraft, videoDraft]);
    expect(filterMedia(merged, { tab: "drafts" }).map((m: any) => m.id).sort()).toEqual(
      ["b", "draft_" + designDraft.id, "draft_" + stagingDraft.id].sort(),
    );
    expect(filterMedia(merged, { tab: "images" }).map((m: any) => m.id)).toContain("draft_" + designDraft.id);
    expect(filterMedia(merged, { tab: "images" }).map((m: any) => m.id)).toContain("draft_" + stagingDraft.id);
    expect(filterMedia(merged, { tab: "videos" }).map((m: any) => m.id)).toEqual(["b"]);
    expect(filterMedia(merged, { tab: "unassigned" }).map((m: any) => m.id).sort()).toEqual(
      ["c", "draft_" + designDraft.id].sort(),
    );
  });

  it("keeps completed and failed work on their own filters", () => {
    const merged = mergeDrafts(fresh(), [stagingDraft]);
    expect(filterMedia(merged, { tab: "completed" }).map((m: any) => m.id)).toEqual(["a", "c"]);
    expect(filterMedia(merged, { tab: "failed" })).toHaveLength(0);
    expect(filterMedia(merged, { tab: "processing" })).toHaveLength(0);
  });

  it("shows persisted render jobs as processing or failed work", () => {
    const jobs = [
      { id: "j1", video_project_id: "v1", status: "rendering", progress: 0.4, stage: "rendering" },
      { id: "j2", video_project_id: "v9", status: "failed", error_message: "Render timed out" },
      { id: "j3", video_project_id: "v8", status: "completed" },
    ];
    const merged = mergeRenderJobs(fresh(), jobs);
    const live = merged.find((m: any) => m.refId === "v1") as any;
    expect(live.status).toBe("processing");
    expect(live.progress).toBe(40);
    expect(filterMedia(merged, { tab: "processing" }).map((m: any) => m.id)).toEqual(["b"]);
    const failed = filterMedia(merged, { tab: "failed" });
    expect(failed.map((m: any) => m.id)).toEqual(["job_j2"]);
    expect((failed[0] as any).error).toBe("Render timed out");
    expect(merged.some((m: any) => m.jobId === "j3")).toBe(false); // finished jobs add no card
  });

  it("files drafts and completed work under the right property tabs", () => {
    const merged = mergeRenderJobs(mergeDrafts(fresh(), [stagingDraft, designDraft, videoDraft]), []);
    const b = propertyBuckets(merged, "p1");
    expect(b.photos.map((m: any) => m.id)).toEqual(["a", "draft_" + stagingDraft.id]);
    expect(b.videos.map((m: any) => m.id)).toEqual(["b"]);
    expect(b.drafts.map((m: any) => m.id).sort()).toEqual(["b", "draft_" + stagingDraft.id].sort());
    // the unassigned image draft stays reachable and assignable later
    const un = propertyBuckets(merged, null);
    expect(un.all.map((m: any) => m.id).sort()).toEqual(["c", "draft_" + designDraft.id].sort());
  });
});
