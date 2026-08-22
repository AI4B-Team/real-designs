// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
describe("tdz", () => {
  it("imports describe-composer", async () => {
    const m = await import("@/lib/describe-composer");
    expect(typeof m.createDescribeComposer).toBe("function");
  });
  it("mounts source picker", async () => {
    const { mountSourcePicker } = await import("@/lib/source-picker");
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountSourcePicker(host, { context: "design", esc: (s: string) => s, onPick: () => {} } as any);
    expect(host.innerHTML.length).toBeGreaterThan(10);
  });
  it("mounts studio start", async () => {
    const m = await import("@/content/rd-studio-start");
    expect(m).toBeTruthy();
  });
});
