import { describe, expect, it } from "vitest";
import {
  activeImageKind,
  activePath,
  canOpenCanvas,
  canvasRequirement,
  editorEntry,
  editorModeFor,
  generationSourcePath,
  lineageLabel,
  openCanvasContext,
  returnLabel,
  saveActionLabel,
  type ActiveImage,
} from "@/lib/active-image";

const base: ActiveImage = {
  assetId: "a1",
  assetType: "uploaded_image",
  sourceAssetId: "a1",
  activeSourcePath: "u/orig.jpg",
  activeVersionId: null,
  activeVersionPath: null,
  roomId: "r1",
  propertyId: "p1",
  draftId: "d1",
  returnDestination: "prepare-photos",
};

describe("active image contract", () => {
  it("names the four states the editor must tell apart", () => {
    expect(activeImageKind(base)).toBe("original-source");
    expect(activeImageKind({ ...base, editedSource: true, activeSourcePath: "u/edit.jpg" })).toBe(
      "edited-source",
    );
    const gen = { ...base, activeVersionId: "v7", activeVersionPath: "g/7.jpg", assetType: "generated_image" as const };
    expect(activeImageKind(gen)).toBe("generated-version");
    expect(activeImageKind({ ...gen, assetType: "edited_image" })).toBe("edited-generated");
  });

  it("edits the visible image, not an older one", () => {
    expect(activePath(base)).toBe("u/orig.jpg");
    const gen = { ...base, activeVersionId: "v7", activeVersionPath: "g/7.jpg" };
    expect(activePath(gen)).toBe("g/7.jpg");
    expect(editorModeFor(base)).toBe("source");
    expect(editorModeFor(gen)).toBe("generated");
  });

  it("generates from the active source, so an edited source wins", () => {
    expect(generationSourcePath({ ...base, editedSource: true, activeSourcePath: "u/edit.jpg" })).toBe(
      "u/edit.jpg",
    );
  });

  it("never offers Save Changes over a persisted version", () => {
    expect(saveActionLabel(base)).toBe("Save Changes");
    expect(saveActionLabel({ ...base, activeVersionId: "v7" })).toBe("Save As New Version");
    expect(lineageLabel(7)).toBe("Edited From Version 7");
    expect(lineageLabel(null)).toBe("");
  });

  it("hands every entry point the same durable payload", () => {
    const e = editorEntry({ ...base, activeVersionId: "v7", activeVersionPath: "g/7.jpg" });
    expect(e).toMatchObject({
      assetId: "a1",
      storagePath: "g/7.jpg",
      versionId: "v7",
      parentVersionId: "v7",
      roomId: "r1",
      propertyId: "p1",
      editorMode: "generated",
      returnDestination: "prepare-photos",
    });
  });

  it("labels the close control by where the editor was opened from", () => {
    expect(returnLabel("canvas")).toBe("Return To Canvas");
    expect(returnLabel("prepare-photos")).toBe("Return To Prepare Photos");
    expect(returnLabel("media")).toBe("Return To Media");
  });

  it("builds Open Canvas context without any temporary URL", () => {
    const c = openCanvasContext({
      draftId: "d1",
      assetId: "k3",
      storagePath: "u/3.jpg",
      propertyId: "p1",
      roomTypeId: "kitchen",
      index: 2,
    });
    expect(c).toMatchObject({
      draftId: "d1",
      assetId: "k3",
      storagePath: "u/3.jpg",
      roomTypeId: "kitchen",
      selectedPhotoIndex: 2,
      returnDestination: "prepare-photos",
    });
    expect(JSON.stringify(c)).not.toContain("blob:");
  });

  it("only opens healthy cards and asks for a room before generating", () => {
    expect(canOpenCanvas({ status: "ready", path: "u/1.jpg" })).toBe(true);
    expect(canOpenCanvas({ status: "failed", path: "u/1.jpg" })).toBe(false);
    expect(canOpenCanvas({ status: "uploading", previewUrl: "blob:x" })).toBe(false);
    expect(canvasRequirement({ room: "Kitchen" })).toBe("");
    expect(canvasRequirement({ room: "" })).toBe("Choose A Room Type Before Generating.");
  });
});
