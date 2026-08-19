import { describe, expect, it } from "vitest";

import {
  backDestination,
  beginCanvasOpen,
  cancelModal,
  canvasEntryFrom,
  canvasEntryIsComplete,
  canvasOpenIsCurrent,
  canvasView,
  classifyLoad,
  createOpenStore,
  errorActions,
  isDuplicateOpen,
  shouldLeaveCanvas,
} from "./canvas-route";

const cardEntry = () =>
  canvasEntryFrom({
    photoKey: "p3",
    draftId: "d1",
    propertyId: "prop-9",
    roomType: "Kitchen",
    sourcePath: "u/1.jpg",
    sourceUrl: "https://x/1.jpg?sig=a",
    workflow: "photo-design",
    returnTo: "staging",
  });

describe("opening the canvas from a card", () => {
  it("preserves every piece of workflow context", () => {
    const e = cardEntry();
    expect(e).toMatchObject({
      photoKey: "p3",
      draftId: "d1",
      propertyId: "prop-9",
      roomType: "Kitchen",
      sourcePath: "u/1.jpg",
      workflow: "photo-design",
      returnTo: "staging",
    });
    expect(canvasEntryIsComplete(e)).toBe(true);
    expect(backDestination(e)).toBe("staging");
  });
  it("defaults the return destination per workflow", () => {
    expect(canvasEntryFrom({ photoKey: "s1", workflow: "video" }).returnTo).toBe("reveal");
    expect(canvasEntryFrom({ photoKey: "s1" }).returnTo).toBe("staging");
    expect(backDestination(null)).toBe("staging");
  });
  it("treats an entry with no source as incomplete", () => {
    expect(canvasEntryIsComplete(canvasEntryFrom({ photoKey: "p3" }))).toBe(false);
    expect(canvasEntryIsComplete(null)).toBe(false);
  });
});

describe("direct URL and refresh", () => {
  it("renders a skeleton while the record loads, never an invalid screen", () => {
    expect(classifyLoad({ pending: true })).toBe("loading");
    expect(canvasView("loading")).toBe("skeleton");
    expect(shouldLeaveCanvas("loading")).toBe(false);
  });
  it("shows the canvas once the record is loaded", () => {
    expect(classifyLoad({ record: { id: "p3" } })).toBe("loaded");
    expect(canvasView("loaded")).toBe("canvas");
  });
});

describe("slow and temporarily empty data", () => {
  it("does not redirect while data is still arriving", () => {
    for (const s of ["loading", "network-error", "loaded"] as const) {
      expect(shouldLeaveCanvas(s)).toBe(false);
    }
  });
  it("only calls a record missing after loading finished", () => {
    expect(classifyLoad({ pending: true, record: null })).toBe("loading");
    expect(classifyLoad({ record: null })).toBe("missing");
  });
});

describe("definitive failures", () => {
  it("redirects for a missing record", () => {
    expect(classifyLoad({ error: { status: 404 } })).toBe("missing");
    expect(canvasView("missing")).toBe("redirect");
  });
  it("redirects for expired authentication", () => {
    expect(classifyLoad({ error: { status: 401 } })).toBe("unauthorized");
    expect(classifyLoad({ error: { kind: "auth" } })).toBe("unauthorized");
    expect(canvasView("unauthorized")).toBe("redirect");
  });
  it("keeps a network failure recoverable", () => {
    expect(classifyLoad({ error: { status: 500 } })).toBe("network-error");
    expect(canvasView("network-error")).toBe("error");
    expect(errorActions("network-error").map((a) => a.label)).toEqual(["Retry", "Back To Photos"]);
    expect(errorActions("loaded")).toEqual([]);
  });
});

describe("rapid navigation between photos", () => {
  it("drops a stale open instead of overwriting newer state", () => {
    const store = createOpenStore();
    const first = beginCanvasOpen(store, "p1");
    const second = beginCanvasOpen(store, "p2");
    expect(canvasOpenIsCurrent(store, first, "p1")).toBe(false);
    expect(canvasOpenIsCurrent(store, second, "p2")).toBe(true);
    expect(canvasOpenIsCurrent(store, second, "p1")).toBe(false);
  });
  it("ignores a duplicate open of the photo already loading", () => {
    const store = createOpenStore();
    beginCanvasOpen(store, "p1");
    expect(isDuplicateOpen(store, "p1", "loading")).toBe(true);
    expect(isDuplicateOpen(store, "p2", "loading")).toBe(false);
    expect(isDuplicateOpen(store, "p1", "loaded")).toBe(false);
  });
});

describe("canceling a modal", () => {
  it("closes without navigating or saving", () => {
    const state = { style: "Modern" };
    const out = cancelModal(state);
    expect(out.state).toBe(state);
    expect(out.navigate).toBeNull();
    expect(out.persist).toBe(false);
  });
});

describe("browser back", () => {
  it("returns to the exact previous builder step", () => {
    expect(backDestination(cardEntry())).toBe("staging");
    expect(backDestination(canvasEntryFrom({ photoKey: "s2", workflow: "video" }))).toBe("reveal");
  });
});
