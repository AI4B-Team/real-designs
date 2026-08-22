import { describe, expect, it } from "vitest";
import {
  IMAGE_ACTIONS,
  imageActionLog,
  recordImageAction,
  visibleActions,
  type ImageActionContext,
} from "./image-actions";

const ready: ImageActionContext = {
  propertyId: "p1",
  roomId: "r1",
  versionId: "v1",
  versionNo: 3,
  resultPath: "u/1.jpg",
  sourcePath: "u/0.jpg",
  status: "ready",
  shopReady: true,
};

describe("image action registry", () => {
  it("gives every action one icon, label and tooltip", () => {
    for (const [id, spec] of Object.entries(IMAGE_ACTIONS)) {
      expect(spec.id).toBe(id);
      expect(spec.icon).toBeTruthy();
      expect(spec.label).toBeTruthy();
      expect(spec.tooltip).toBeTruthy();
    }
  });

  it("uses the same icon and label whichever surface asks", () => {
    const canvas = visibleActions(["download", "shop"], ready);
    const drawer = visibleActions(["download", "shop"], ready);
    expect(canvas.map((a) => [a.icon, a.label])).toEqual(drawer.map((a) => [a.icon, a.label]));
  });

  it("hides Shop until product detection is ready", () => {
    const ids = visibleActions(["shop", "download"], { ...ready, shopReady: false }).map(
      (a) => a.id,
    );
    expect(ids).toEqual(["download"]);
  });

  it("disables Download until the result has a durable path", () => {
    expect(IMAGE_ACTIONS['download'].enabled({ status: "saving" })).toBe(false);
    expect(IMAGE_ACTIONS['download'].enabled(ready)).toBe(true);
  });

  it("offers Approve only for a persistent version", () => {
    expect(IMAGE_ACTIONS['approve'].eligible({ status: "saving" })).toBe(false);
    expect(IMAGE_ACTIONS['approve'].enabled({ versionId: "v1", status: "saving" })).toBe(false);
    expect(IMAGE_ACTIONS['approve'].enabled(ready)).toBe(true);
  });

  it("hides Compare without an original photo", () => {
    expect(visibleActions(["compare"], { ...ready, sourcePath: null })).toHaveLength(0);
  });

  it("records diagnostics for every dispatched action", () => {
    const ev = recordImageAction("download", "media-card", ready);
    expect(ev).toMatchObject({
      actionId: "download",
      sourceSurface: "media-card",
      roomId: "r1",
      versionId: "v1",
      resultPath: "u/1.jpg",
    });
    expect(imageActionLog().at(-1)?.actionId).toBe("download");
  });
});
