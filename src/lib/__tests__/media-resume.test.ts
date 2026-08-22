import { describe, it, expect } from "vitest";
import { workflowForMedia, resumeInputForMedia } from "@/lib/media-resume";

describe("media resume mapping", () => {
  it("routes each draft type to its own workflow", () => {
    expect(workflowForMedia({ draftType: "photo_staging" })).toBe("photo_staging");
    expect(workflowForMedia({ draftType: "photo_redesign" })).toBe("photo_redesign");
    expect(workflowForMedia({ type: "concept" })).toBe("concept");
    expect(workflowForMedia({ type: "generated_video" })).toBe("video");
    expect(workflowForMedia({ type: "photo_edit" })).toBe("image_edit");
  });

  it("carries the durable identifiers the destination needs", () => {
    const input = resumeInputForMedia({
      draftType: "photo_redesign",
      draftId: "d1",
      propertyId: "p1",
      roomId: "r1",
      path: "gen/a.jpg",
      sourcePath: "src/a.jpg",
      settings: { prompt: "warmer", styleId: "modern" },
    });
    expect(input.projectDraftId).toBe("d1");
    expect(input.propertyId).toBe("p1");
    expect(input.roomId).toBe("r1");
    expect(input.generatedStoragePath).toBe("gen/a.jpg");
    expect(input.sourceStoragePath).toBe("src/a.jpg");
    expect(input.prompt).toBe("warmer");
    expect(input.selectedStyleId).toBe("modern");
  });
});
