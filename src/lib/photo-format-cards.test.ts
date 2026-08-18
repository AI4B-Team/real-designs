// @vitest-environment jsdom
/**
 * Photo Design cards must preview the shape they will be generated at.
 *
 * These tests mount the real staging module and assert on the visible grid:
 * choosing a Photo Format reshapes every photo frame and the Add More Photos
 * frame, in place, with no re-navigation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide", () => ({ createIcons: () => {}, icons: {} }));
vi.mock("@/lib/room-photos", () => ({
  uploadRoomPhoto: vi.fn(async () => "u/1.jpg"),
  roomPhotoUrl: vi.fn(async () => "https://cdn.test/1.jpg"),
}));
vi.mock("@/lib/photo-classify.functions", () => ({
  classifyPhotoRooms: vi.fn(async ({ data }: any) => ({
    results: (data.images || []).map((i: any) => ({ id: i.id, label: "kitchen", confidence: 0.95 })),
  })),
}));
vi.mock("@/lib/photo-classify", async (orig) => {
  const real: any = await (orig as any)();
  return { ...real, thumbDataUrl: async () => "data:image/jpeg;base64,AA" };
});

const jpeg = (name: string) => new File([new Uint8Array(1024)], name, { type: "image/jpeg" });
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

beforeEach(() => {
  (document.querySelector("#rdsClose") as HTMLElement | null)?.click();
  document.body.innerHTML = "";
  (globalThis as any).URL.createObjectURL = () => "blob:mock";
  (globalThis as any).URL.revokeObjectURL = () => {};
  (globalThis as any).crypto ||= {} as any;
  if (!(globalThis as any).crypto.randomUUID) {
    (globalThis as any).crypto.randomUUID = () => "id-" + Math.random().toString(36).slice(2);
  }
});

const stagingHost = () => document.querySelector("#v-staging") as HTMLElement;

async function openReviewWith(names: string[]) {
  const mod: any = await import("@/content/rd-staging");
  document.body.innerHTML = '<div class="rd-app"><div class="content"></div></div>';
  mod.openStagingReview({});
  await settle(10);
  const input = stagingHost().querySelector("input[type=file]") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: names.map(jpeg), configurable: true });
  input.dispatchEvent(new Event("change"));
  await settle(40);
  return mod;
}

const chooseFormat = async (ratio: string) => {
  const btn = stagingHost().querySelector(`[data-ratio="${ratio}"]`) as HTMLElement;
  btn.click();
  await settle(20);
};

const tileClasses = () =>
  [...stagingHost().querySelectorAll(".rv-tile")].map((t) =>
    ["rt-916", "rt-169", "rt-11"].find((c) => t.classList.contains(c)) || "none",
  );

const addClass = () => {
  const a = stagingHost().querySelector(".rv-addcard") as HTMLElement;
  return ["rt-916", "rt-169", "rt-11"].find((c) => a.classList.contains(c)) || "none";
};

describe("photo format reshapes the review grid", () => {
  it("defaults to landscape and switches every frame immediately", async () => {
    await openReviewWith(["a.jpg", "b.jpg", "c.jpg"]);
    expect(tileClasses()).toEqual(["rt-169", "rt-169", "rt-169"]);
    expect(addClass()).toBe("rt-169");

    await chooseFormat("9:16");
    expect(tileClasses()).toEqual(["rt-916", "rt-916", "rt-916"]);
    expect(addClass()).toBe("rt-916");

    await chooseFormat("1:1");
    expect(tileClasses()).toEqual(["rt-11", "rt-11", "rt-11"]);
    expect(addClass()).toBe("rt-11");
  });

  it("keeps the selected button and the card shapes in agreement", async () => {
    await openReviewWith(["a.jpg"]);
    await chooseFormat("1:1");
    const on = stagingHost().querySelector(".bx-fmtseg button.on") as HTMLElement;
    expect(on.getAttribute("data-ratio")).toBe("1:1");
    expect(tileClasses()).toEqual(["rt-11"]);
  });

  it("puts the room selector outside the ratio frame", async () => {
    await openReviewWith(["a.jpg"]);
    await chooseFormat("9:16");
    const tile = stagingHost().querySelector(".rv-tile") as HTMLElement;
    expect(tile.querySelector(".rv-tile-th .rv-room")).toBeNull();
    expect(tile.querySelector(".rv-tile-foot .rv-room")).toBeTruthy();
    /* Overlays stay anchored to the image frame, never the card wrapper. */
    expect(tile.querySelector(".rv-tile-th .rv-tile-check")).toBeTruthy();
  });

  it("does not navigate away when the format changes", async () => {
    await openReviewWith(["a.jpg"]);
    const before = location.hash;
    await chooseFormat("9:16");
    expect(location.hash).toBe(before);
    expect(stagingHost().textContent).toContain("Review Rooms");
  });

  it("shows the Add More Photos card without a room selector", async () => {
    await openReviewWith(["a.jpg"]);
    const add = stagingHost().querySelector(".rv-addcard") as HTMLElement;
    expect(add.querySelector(".rv-room")).toBeNull();
    expect(add.querySelector(".rv-addcard-pad")).toBeTruthy();
  });
});
