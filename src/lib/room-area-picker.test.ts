/** @vitest-environment jsdom */
/**
 * The consolidated Room / Area picker. Every workflow opens this one modal,
 * so its contract — space-correct options, search, cancel-restores,
 * apply-returns-a-stable-id, no side effects — is covered directly, plus
 * source-level proof that the old parallel implementations are gone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { openRoomAreaPicker, roomPickerTitle } from "@/lib/room-area-picker";
import { isCatalogPickerOpen, openCatalogPicker } from "@/lib/catalog-picker";
import { ROOM_CATALOG, resolveRoom, roomPreview, roomsForSpace } from "@/lib/room-catalog";
import { ROOM_OPTIONS, roomByLabel, searchRooms } from "@/lib/staging-rooms";
import { areasForSpace } from "@/lib/space-datasets";

const modal = () => document.querySelector(".rdcat") as HTMLElement | null;
const cards = () => Array.from(document.querySelectorAll("[data-pick]")) as HTMLElement[];
const cardFor = (label: string) => cards().find((c) => c.textContent?.includes(label))!;
const search = () => document.querySelector("[data-q]") as HTMLInputElement;
const apply = () => document.querySelector("[data-use]") as HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("room catalog", () => {
  it("keeps interior, exterior and garden options separate", () => {
    const interior = roomsForSpace("interior").map((r) => r.label);
    const exterior = roomsForSpace("exterior").map((r) => r.label);
    const garden = roomsForSpace("garden").map((r) => r.label);
    expect(interior).toContain("Kitchen");
    expect(exterior).not.toContain("Kitchen");
    expect(garden).not.toContain("Kitchen");
    expect(exterior).toContain("Front Exterior");
    expect(garden).toContain("Backyard");
  });

  it("gives every option a preview image and never an interior photo outdoors", () => {
    for (const space of ["interior", "exterior", "garden"] as const) {
      for (const r of roomsForSpace(space)) {
        const img = roomPreview(r.id);
        expect(img, r.label).toBeTruthy();
        const prefix = space === "interior" ? "i-" : space === "exterior" ? "e-" : "g-";
        expect((r.previewId || r.id).startsWith(prefix), r.label).toBe(true);
      }
    }
  });

  it("resolves legacy labels to the same stable id", () => {
    expect(resolveRoom("Front Of House")?.id).toBe("e-front-of-house");
    expect(resolveRoom("Home Office")?.id).toBe("i-home-office");
    expect(resolveRoom("Front Yard")?.id).toBe("g-front-yard");
    expect(resolveRoom("i-kitchen")?.label).toBe("Kitchen");
  });

  it("is the only dataset: staging and canvas views derive from it", () => {
    expect(ROOM_OPTIONS.length).toBe(ROOM_CATALOG.length);
    expect(roomByLabel("Kitchen")?.id).toBe("i-kitchen");
    expect(areasForSpace("garden").map((a) => a.id)).toEqual(
      roomsForSpace("garden").map((r) => r.id),
    );
    expect(searchRooms("kitchen")[0]?.id).toBe("i-kitchen");
  });
});

describe("room / area picker", () => {
  it("titles itself for the active space and lists only that space", () => {
    expect(roomPickerTitle("exterior")).toBe("Choose an exterior area");
    openRoomAreaPicker({ space: "exterior", onApply: () => {} });
    expect(modal()!.textContent).toContain("Choose an exterior area");
    const labels = cards().map((c) => c.textContent);
    expect(labels.some((l) => l?.includes("Front Exterior"))).toBe(true);
    expect(labels.some((l) => l?.includes("Kitchen"))).toBe(false);
  });

  it("searches consistently across labels and aliases", () => {
    openRoomAreaPicker({ space: "interior", onApply: () => {} });
    search().value = "office";
    search().dispatchEvent(new Event("input"));
    expect(cards().map((c) => c.textContent!.trim())).toEqual(["Office"]);
    search().value = "zzz";
    search().dispatchEvent(new Event("input"));
    expect(document.querySelector(".cs-empty")).toBeTruthy();
  });

  it("selects on click but only commits on Apply, returning the stable id", () => {
    const onApply = vi.fn();
    openRoomAreaPicker({ space: "interior", onApply });
    cardFor("Kitchen").click();
    expect(onApply).not.toHaveBeenCalled();
    expect(cardFor("Kitchen").classList.contains("on")).toBe(true);
    apply().click();
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ id: "i-kitchen", label: "Kitchen", space: "interior" }),
    );
    expect(modal()).toBeNull();
  });

  it("cancel, Escape and the backdrop all leave the selection untouched", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    openRoomAreaPicker({ space: "interior", currentLabel: "Kitchen", onApply, onCancel });
    cardFor("Bedroom").click();
    (document.querySelector("[data-close]") as HTMLElement).click();
    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    openRoomAreaPicker({ space: "interior", onApply });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal()).toBeNull();

    openRoomAreaPicker({ space: "interior", onApply });
    (document.querySelector(".up-scrim") as HTMLElement).click();
    expect(modal()).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows workflow-only states only when the caller allows them", () => {
    openRoomAreaPicker({ space: "interior", onApply: () => {} });
    expect(document.body.textContent).not.toContain("Needs Review");
    (document.querySelector("[data-close]") as HTMLElement).click();

    const onApply = vi.fn();
    openRoomAreaPicker({
      space: "interior",
      allowUnassigned: true,
      allowNeedsReview: true,
      onApply,
    });
    const extra = Array.from(document.querySelectorAll(".cs-extra")).find((e) =>
      e.textContent?.includes("Needs Review"),
    ) as HTMLElement;
    expect(extra).toBeTruthy();
    extra.click();
    apply().click();
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Needs Review", workflowOnly: true }),
    );
  });

  it("returns focus to the opener and never stacks or duplicates handlers", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    const onApply = vi.fn();
    openRoomAreaPicker({ space: "interior", opener, onApply });
    expect(isCatalogPickerOpen("room-area")).toBe(true);
    openRoomAreaPicker({ space: "interior", opener, onApply });
    expect(document.querySelectorAll(".rdcat").length).toBe(1);
    (document.querySelector("[data-close]") as HTMLElement).click();
    expect(document.activeElement).toBe(opener);
    expect(isCatalogPickerOpen("room-area")).toBe(false);

    /* Reopening applies exactly once — no listener left over from before. */
    openRoomAreaPicker({ space: "interior", opener, onApply });
    cardFor("Kitchen").click();
    apply().click();
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("fits the viewport: only the grid scrolls", () => {
    openRoomAreaPicker({ space: "interior", onApply: () => {} });
    const card = document.querySelector(".cs-card") as HTMLElement;
    expect(card.querySelector(".cs-head")).toBeTruthy();
    expect(card.querySelector(".cs-foot")).toBeTruthy();
    expect(card.querySelector(".cs-grid")).toBeTruthy();
  });
});

describe("catalog picker shell", () => {
  it("supports multi-select and category filtering for other catalogs", () => {
    const onApply = vi.fn();
    openCatalogPicker({
      key: "media",
      title: "Choose photos",
      multiple: true,
      categories: ["All", "Kitchen"],
      items: [
        { id: "a", label: "A", category: "Kitchen" },
        { id: "b", label: "B", category: "Bath" },
      ],
      onApply,
    });
    cards().forEach((c) => c.click());
    apply().click();
    expect(onApply.mock.calls[0]![0]).toEqual(["a", "b"]);
  });
});

describe("no parallel room implementations remain", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("every room entry point opens the shared picker", () => {
    for (const file of [
      "src/lib/canvas-workspace.ts", // Canvas "View all"
      "src/lib/source-picker.ts", // Describe "View all"
      "src/content/rd-reveal.ts", // Video Builder
      "src/content/rd-staging.ts", // Photo Design
      "src/lib/save-room.ts", // Save Room "View all"
    ]) {
      expect(read(file), file).toContain("room-area-picker");
    }
  });

  it("the old room modal, popover and duplicated arrays are gone", () => {
    expect(read("src/content/rd-reveal.ts")).not.toContain("roomPickerHtml");
    expect(read("src/content/rd-staging.ts")).not.toContain("rds-pop");
    expect(read("src/lib/staging-rooms.ts")).not.toContain('group: "Living Spaces"');
    expect(read("src/lib/space-datasets.ts")).not.toContain('label: "Kitchen"');
    expect(() => read("src/lib/room-picker-modal.ts")).toThrow();
  });

  it("style browsing goes through the one shared style picker", () => {
    expect(read("src/lib/source-picker.ts")).toContain("openStyleBrowser");
    expect(read("src/lib/canvas-panel.ts")).not.toContain("csBrowse");
  });
});
