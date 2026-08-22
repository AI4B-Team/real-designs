import { describe, it, expect } from "vitest";
import { mountSourcePicker } from "@/lib/source-picker";
describe("dbg", () => {
  it("state", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountSourcePicker(host, { mode: "design" } as never);
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const ta = host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement;
    ta.value = "A warm modern living room";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    const r = host.querySelector("[data-sp-room]") as HTMLElement;
    const s = host.querySelector("[data-sp-style]") as HTMLElement;
    r?.click(); s?.click();
    console.log("room", r?.getAttribute("data-sp-room"), "style", s?.getAttribute("data-sp-style"));
    console.log("meta", host.querySelector(".sp-describe-foot .sp-meta")?.textContent);
    expect(true).toBe(true);
  });
});
