// @vitest-environment jsdom
/**
 * Existing-property source: cards, address lines, photo selection.
 */
import { describe, it, expect, vi } from "vitest";
import { mountSourcePicker } from "@/lib/source-picker";
import { splitAddressLines, photoCountLabel } from "@/lib/property-address";

function mount(opts: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mountSourcePicker(host, {
    context: "design",
    esc: (s: string) => s,
    onPick: () => {},
    initialTab: "property",
    ...opts,
  } as any);
  return host;
}

const props = [
  { id: "a", address: "7006 Orvicti Court, Wesley Chapel, FL 33544", count: 12, thumb: "u/1.jpg" },
  { id: "b", address: "1420 Bayshore Boulevard, Tampa, FL 33606", count: 1 },
  { id: "c", address: "Empty Place, Tampa, FL 33606", count: 0 },
  { id: "d", address: "Unsorted Uploads", count: 9 },
];

describe("property address lines", () => {
  it("splits structured fields into street and city/state/ZIP", () => {
    expect(
      splitAddressLines("", {
        address_line_1: "7006 Orvicti Court",
        address_line_2: "Apt 4",
        city: "Wesley Chapel",
        state: "fl",
        postal_code: "33544",
      }),
    ).toEqual({ line1: "7006 Orvicti Court Apt 4", line2: "Wesley Chapel, FL 33544" });
  });
  it("splits an unstructured string on its own commas only", () => {
    expect(splitAddressLines("1420 Bayshore Boulevard, Tampa, FL 33606")).toEqual({
      line1: "1420 Bayshore Boulevard",
      line2: "Tampa, FL 33606",
    });
  });
  it("parses a comma-free address that clearly ends in City ST ZIP", () => {
    expect(splitAddressLines("1420 Bayshore Blvd Tampa FL 33606")).toEqual({
      line1: "1420 Bayshore Boulevard",
      line2: "Tampa, FL 33606",
    });
    expect(splitAddressLines("7006 Orvicti Ct New Port Richey FL 34652")).toEqual({
      line1: "7006 Orvicti Court",
      line2: "New Port Richey, FL 34652",
    });
  });
  it("never guesses when there is no recognisable suffix", () => {
    expect(splitAddressLines("Some Place Nobody Knows")).toEqual({
      line1: "Some Place Nobody Knows",
      line2: "",
    });
  });

  it("counts photos without ever saying 0 Photos", () => {
    expect(photoCountLabel(0)).toBe("No Photos");
    expect(photoCountLabel(1)).toBe("1 Photo");
    expect(photoCountLabel(12)).toBe("12 Photos");
  });
});

describe("property cards", () => {
  it("renders two-line addresses, counts and a distinct unassigned card", () => {
    const host = mount({ properties: () => props });
    const cards = host.querySelectorAll(".sp-prop");
    /* Zero-photo properties are hidden until asked for. */
    expect(cards.length).toBe(3);
    expect(cards[0]!.querySelector("b")!.textContent).toBe("7006 Orvicti Court");
    expect(cards[0]!.querySelector(".sp-prop-b > span")!.textContent).toBe(
      "Wesley Chapel, FL 33544",
    );
    expect(cards[1]!.textContent).toContain("1 Photo");
    expect(cards[2]!.className).toContain("is-util");
    expect(cards[2]!.querySelector("b")!.textContent).toBe("Unassigned Photos");
    /* Selection control lives on the thumbnail, not beside the count. */
    expect(cards[0]!.querySelector(".sp-pick")).toBeTruthy();
    expect(cards[0]!.querySelector(".sp-prop-c i")).toBe(null);
  });

  it("reveals zero-photo properties only through the quiet toggle", () => {
    const host = mount({ properties: () => props });
    const toggle = host.querySelector('[data-sp="emptytoggle"]') as HTMLElement;
    expect(toggle.textContent).toContain("Show Properties Without Photos");
    toggle.click();
    const cards = host.querySelectorAll(".sp-prop");
    expect(cards.length).toBe(4);
    const empty = host.querySelector(".sp-prop.is-empty")!;
    expect(empty.getAttribute("data-sp-prop")).toBe(null);
    expect(empty.textContent).toContain("Upload Photos");
  });

  it("opens a photo selection panel and hands back only the checked photos", async () => {
    const onPropertyPhotos = vi.fn();
    const host = mount({
      properties: () => props,
      loadPropertyPhotos: async () => [
        { id: "p1", path: "u/1.jpg" },
        { id: "p2", path: "u/2.jpg" },
      ],
      onPropertyPhotos,
    });
    (host.querySelector('[data-sp-prop="a"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(host.querySelectorAll(".sp-photo").length).toBe(2);
    (host.querySelector('[data-sp-photo="p2"]') as HTMLElement).click();
    expect(host.querySelector(".sp-photos-h b")!.textContent).toBe("1 Of 2 Selected");
    (host.querySelector('[data-sp="padd"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(onPropertyPhotos).toHaveBeenCalled();
    expect(onPropertyPhotos.mock.calls[0]![1]).toEqual([{ id: "p1", path: "u/1.jpg" }]);
  });

  it("falls back to the legacy property callback when no photo loader exists", () => {
    const onProperty = vi.fn();
    const host = mount({ properties: () => props, onProperty });
    (host.querySelector('[data-sp-prop="b"]') as HTMLElement).click();
    expect(onProperty).toHaveBeenCalledWith("1420 Bayshore Boulevard, Tampa, FL 33606");
  });
});
