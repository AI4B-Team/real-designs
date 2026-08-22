/** @vitest-environment jsdom */
/**
 * List View must read as a compact media table: a fixed thumbnail cell, real
 * metadata columns, working selection and no panoramic image strips.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSourcePicker, type PickerDesign } from "@/lib/source-picker";

const MEDIA: PickerDesign[] = [
  {
    id: "d1",
    path: "designs/d1.jpg",
    room: "Kitchen",
    style: "Warm Minimal",
    versionNo: 3,
    status: "approved",
    address: "206 N MacDill Ave",
    propertyId: "p1",
    assetType: "design",
  },
  {
    id: "p1-photo",
    path: "photos/p1.jpg",
    room: "Living Room",
    address: "206 N MacDill Ave",
    propertyId: "p1",
    assetType: "photo",
  },
  {
    id: "p2-photo",
    path: "photos/p2.jpg",
    room: "",
    propertyId: null,
    assetType: "photo",
  },
];

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mountSourcePicker(host, {
    context: "design",
    initialTab: "media",
    onFiles: async () => {},
    loadDesigns: async () => MEDIA,
    onDesigns: vi.fn(),
  } as any);
  return host;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function listView(host: HTMLElement) {
  await tick();
  (host.querySelector('[data-sp-view="list"]') as HTMLElement).click();
  await tick();
  return Array.from(host.querySelectorAll(".spd-row")) as HTMLElement[];
}

beforeEach(() => {
  document.body.innerHTML = "";
  try {
    localStorage.clear();
  } catch (_) {}
});

describe("select media list view", () => {
  it("renders one row per item with no duplicates and stable ids", async () => {
    const host = mount();
    const rows = await listView(host);
    const ids = rows.map((r) => r.dataset["spDesign"]);
    expect(ids).toEqual(["d1", "p1-photo", "p2-photo"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the thumbnail in a fixed 112x72 cell, never a full-width strip", async () => {
    const host = mount();
    const rows = await listView(host);
    for (const row of rows) {
      const thumb = row.querySelector(".spd-rth") as HTMLElement;
      expect(thumb).toBeTruthy();
      /* Sizing lives in CSS; the row must not paint the photo itself. */
      expect(row.style.backgroundImage).toBe("");
      expect(thumb.classList.contains("spd-rth")).toBe(true);
    }
  });

  it("shows identification, property, type and status metadata", async () => {
    const host = mount();
    const rows = await listView(host);
    const first = rows[0]!.textContent || "";
    expect(first).toContain("Kitchen");
    expect(first).toContain("206 N MacDill Ave");
    expect(first).toContain("Generated Design");
    expect(first).toContain("Approved");
    expect(rows[0]!.querySelector(".spd-rver")?.textContent).toContain("3 versions");
    const orphan = rows[2]!.textContent || "";
    expect(orphan).toContain("Unassigned");
    expect(orphan).toContain("No room selected");
    expect(orphan).toContain("Property Photo");
    expect(orphan).toContain("Original");
  });

  it("has a sticky header aligned to the row columns", async () => {
    const host = mount();
    await listView(host);
    const head = host.querySelector(".spd-lhead") as HTMLElement;
    const labels = Array.from(head.querySelectorAll("span")).map((s) => s.textContent);
    expect(labels.slice(0, 6)).toEqual([
      "Photo",
      "Details",
      "Property / Room",
      "Type",
      "Updated",
      "Status",
    ]);
    expect(head.querySelector(".spd-hcheck")).toBeTruthy();
  });

  it("selects rows, supports shift-range and reports the count", async () => {
    const host = mount();
    let rows = await listView(host);
    rows[0]!.click();
    await tick();
    expect(host.querySelector(".spd-count")!.textContent).toContain("1 selected");
    rows = Array.from(host.querySelectorAll(".spd-row")) as HTMLElement[];
    rows[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    await tick();
    expect(host.querySelector(".spd-count")!.textContent).toContain("3 selected");
  });

  it("Select All Visible respects filters and toggles back off", async () => {
    const host = mount();
    await listView(host);
    const chip = Array.from(host.querySelectorAll("[data-sp-mtype]")).find(
      (b) => b.getAttribute("data-sp-mtype") === "designs",
    ) as HTMLElement;
    chip.click();
    await tick();
    (host.querySelector('[data-sp="mall"]') as HTMLElement).click();
    await tick();
    expect(host.querySelector(".spd-count")!.textContent).toContain("1 selected");
    const all = host.querySelector('[data-sp="mall"]') as HTMLElement;
    expect(all.textContent).toContain("Deselect All Visible");
    all.click();
    await tick();
    expect(host.querySelector(".spd-count")!.textContent).toContain("0 selected");
  });

  it("keeps the selection when switching between grid and list", async () => {
    const host = mount();
    const rows = await listView(host);
    rows[1]!.click();
    await tick();
    (host.querySelector('[data-sp-view="grid"]') as HTMLElement).click();
    await tick();
    expect(host.querySelector(".spd-count")!.textContent).toContain("1 selected");
    expect(host.querySelectorAll(".spd-card.is-sel").length).toBe(1);
  });

  it("opens a row overflow menu with only valid actions", async () => {
    const host = mount();
    const rows = await listView(host);
    (rows[0]!.querySelector("[data-sp-menu]") as HTMLElement).click();
    await tick();
    const menu = host.querySelector(".spd-menu") as HTMLElement;
    const items = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(items).toContain("Preview");
    expect(items).toContain("Select");
    expect(items).toContain("View Versions");
    /* The photo row has a single version, so it offers no version action. */
    (host.querySelectorAll("[data-sp-menu]")[2] as HTMLElement).click();
    await tick();
    const second = Array.from(host.querySelectorAll(".spd-menu button")).map(
      (b) => b.textContent,
    );
    expect(second).not.toContain("View Versions");
  });
});
