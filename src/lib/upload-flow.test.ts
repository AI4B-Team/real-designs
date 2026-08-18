// @vitest-environment jsdom
/**
 * Mounted-flow integration coverage for the two upload entry points.
 *
 * These tests mount the real source picker and the real staging module into a
 * document and assert on the *visible page*, not on helper return values:
 * after a valid pick the user must already be looking at the next page.
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
vi.mock("heic2any", () => ({
  default: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
}));

import { mountSourcePicker } from "@/lib/source-picker";
import { attachUploadAssets, acceptVideoPhotos, initialWizardStep } from "@/lib/video-upload-intake";

const jpeg = (name = "a.jpg", mb = 1) =>
  new File([new Uint8Array(mb * 1024)], name, { type: "image/jpeg" });
const heic = (name = "IMG_0001.HEIC") => new File([new Uint8Array(1024)], name, { type: "image/heic" });
const bad = (name = "notes.txt") => new File([new Uint8Array(16)], name, { type: "text/plain" });

let host: HTMLElement;
beforeEach(() => {
  /* Modules keep one live session: close any overlay before wiping the DOM. */
  (document.querySelector("#rdsClose") as HTMLElement | null)?.click();
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as any).URL.createObjectURL = () => "blob:mock";
  (globalThis as any).URL.revokeObjectURL = () => {};
  (globalThis as any).crypto ||= {} as any;
  if (!(globalThis as any).crypto.randomUUID) {
    (globalThis as any).crypto.randomUUID = () => "id-" + Math.random().toString(36).slice(2);
  }
});

const settle = async (n = 6) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

/** Drive the picker exactly as a user does: click Browse, set files, change. */
async function browse(files: File[]) {
  const input = host.querySelector("input[type=file]") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  input.dispatchEvent(new Event("change"));
  await settle(30);
}

async function drop(files: File[]) {
  const zone = host.querySelector("[data-sp-drop]") as HTMLElement;
  const ev: any = new Event("drop", { bubbles: true, cancelable: true });
  ev.dataTransfer = { files };
  zone.dispatchEvent(ev);
  await settle(30);
}

/* ------------------------------------------------- A. Property video flow */

/** Minimal mounted video view: the real intake pipeline drives the markup. */
function mountVideoFlow() {
  const w: any = { step: 1, uploads: [], available: [], gridOrder: [], scenes: [] };
  const view = document.createElement("div");
  document.body.appendChild(view);
  const render = () => {
    view.innerHTML =
      w.step === 1
        ? `<h1>Add Photos</h1><div id="sp"></div>`
        : `<h1>Select &amp; Order Photos</h1><button id="more">Add Photos</button>` +
          (w.gridOrder || []).map((k: string) => `<div class="tile" data-k="${k}"></div>`).join("");
    if (w.step === 1) view.querySelector("#sp")!.appendChild(host);
    if (w.uploadFails?.length) view.insertAdjacentHTML("beforeend", `<p class="err">${w.uploadFails.length} could not be added</p>`);
  };
  const deps: any = {
    rejectReason: (f: File) => (/\.(jpg|jpeg|png|webp)$/i.test(f.name) ? null : "Unsupported File Type"),
    createUrl: () => "blob:mock",
    uuid: () => "id-" + Math.random().toString(36).slice(2),
    advance: async (x: any) => { x.step = 2; attachUploadAssets(x); render(); },
    loadAssets: async () => {},
    isCurrent: () => true,
    attachUploads: attachUploadAssets,
    render,
  };
  const accept = (files: File[]) => acceptVideoPhotos({ wizard: w, files, source: "picker", deps });
  mountSourcePicker(host, { context: "video", esc: (s: string) => s, onPick: (p) => accept(p.map((x) => x.file)) });
  render();
  return { w, view, accept };
}

describe("property video: add photos -> scenes", () => {
  it("advances on a single browsed photo", async () => {
    const { view, w } = mountVideoFlow();
    expect(view.querySelector("h1")!.textContent).toBe("Add Photos");
    await browse([jpeg("living.jpg")]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(1);
    expect(w.step).toBe(2);
  });

  it("advances with multiple photos and renders the whole grid", async () => {
    const { view } = mountVideoFlow();
    await browse([jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg"), jpeg("d.jpg")]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(4);
  });

  it("advances on drag and drop", async () => {
    const { view } = mountVideoFlow();
    await drop([jpeg("drop-1.jpg"), jpeg("drop-2.jpg")]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(2);
  });

  it("converts HEIC on intake and still advances", async () => {
    const { view } = mountVideoFlow();
    await browse([heic()]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(1);
  });

  it("keeps valid photos and reports invalid ones", async () => {
    const { view, w } = mountVideoFlow();
    await browse([jpeg("ok.jpg"), bad()]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(1);
    expect(w.uploads).toHaveLength(1);
  });

  it("never navigates when every file is invalid", async () => {
    const { view, w } = mountVideoFlow();
    await browse([bad("a.txt"), bad("b.txt")]);
    expect(view.querySelector("h1")!.textContent).toBe("Add Photos");
    expect(w.step).toBe(1);
  });

  it("stays on scenes when a background upload fails after the preview", async () => {
    const { view, w, accept } = mountVideoFlow();
    await browse([jpeg("a.jpg")]);
    w.uploads[0].uploadError = "network";
    await accept([]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(1);
  });

  it("adds more photos from page 2 without restarting", async () => {
    const { view, accept } = mountVideoFlow();
    await browse([jpeg("a.jpg")]);
    await accept([jpeg("b.jpg"), jpeg("c.jpg")]);
    expect(view.querySelector("h1")!.textContent).toBe("Select & Order Photos");
    expect(view.querySelectorAll(".tile")).toHaveLength(3);
    expect(view.querySelector("#more")).toBeTruthy();
  });

  it("opens a seeded wizard directly on scenes", () => {
    expect(initialWizardStep({}, [{ id: "1" }])).toBe(2);
    expect(initialWizardStep({}, [])).toBe(1);
  });
});

/* ------------------------------------------------------ B. Photo staging */

describe("photo staging: add photos -> review rooms", () => {
  const openStaging = async () => {
    const mod = await import("@/content/rd-staging");
    document.body.innerHTML = '<div class="rd-app"><div class="content"></div></div>';
    mod.openStagingReview({});
    await settle(10);
    return mod;
  };
  const stagingHost = () => document.querySelector("#v-staging") as HTMLElement;
  const pickerInput = () => stagingHost().querySelector("input[type=file]") as HTMLInputElement;

  const pick = async (files: File[]) => {
    const input = pickerInput();
    Object.defineProperty(input, "files", { value: files, configurable: true });
    input.dispatchEvent(new Event("change"));
    await settle(30);
  };

  it("advances to Review Rooms and shows every photo", async () => {
    await openStaging();
    expect(stagingHost().textContent).toContain("Add Photos");
    await pick([jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")]);
    expect(stagingHost().textContent).toContain("Review Rooms");
    expect(stagingHost().querySelectorAll(".rv-tile")).toHaveLength(3);
  });

  it("advances on a single photo and keeps Add More Photos available", async () => {
    await openStaging();
    await pick([jpeg("only.jpg")]);
    expect(stagingHost().textContent).toContain("Review Rooms");
    expect(stagingHost().querySelector("#rdsMore")).toBeTruthy();
    expect(stagingHost().querySelectorAll(".rv-tile")).toHaveLength(1);
  });

  it("renders Review Rooms as a page, not a modal", async () => {
    await openStaging();
    await pick([jpeg("a.jpg")]);
    const hostEl = stagingHost();
    /* In the content area, no dialog role, no locked document scrolling. */
    expect(hostEl.closest(".content")).toBeTruthy();
    expect(hostEl.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(hostEl.querySelector(".rds-rail")).toBeTruthy();
    expect(hostEl.querySelector(".rv-gridfoot")).toBeTruthy();
    expect(hostEl.textContent).toContain("Confirm the room type for each photo.");
    /* Bulk actions collapse into a More menu. */
    expect(hostEl.querySelector("#rdsMoreMenu")).toBeTruthy();
    expect(hostEl.textContent).not.toContain("Remove All Items");
  });

  it("keeps the grid visible when an upload fails", async () => {
    const rp: any = await import("@/lib/room-photos");
    rp.uploadRoomPhoto.mockRejectedValueOnce(new Error("upload failed"));
    await openStaging();
    await pick([jpeg("a.jpg")]);
    await settle(30);
    expect(stagingHost().textContent).toContain("Review Rooms");
    expect(stagingHost().querySelectorAll(".rv-tile")).toHaveLength(1);
  });

  it("stays on Add Photos when the only file is invalid", async () => {
    await openStaging();
    await pick([bad()]);
    expect(stagingHost().textContent).toContain("Add Photos");
    expect(stagingHost().querySelectorAll(".rv-tile")).toHaveLength(0);
  });
});
