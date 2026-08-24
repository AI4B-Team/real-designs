// @vitest-environment jsdom
(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;
/** Owner preview must render the recipient view read-only. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/presentation-packages.functions", () => ({
  commentOnPackage: vi.fn(),
  decideOnPackage: vi.fn(),
  getSharedPackage: vi.fn(),
}));

import { PackageReport } from "./PackageReport";

const pack = {
  title: "Maple Street Renovation",
  property_label: "18 Maple St",
  client_name: "Dana",
  accent: "#CC0000",
  settings: {},
  created_at: new Date().toISOString(),
  sections: [{ key: "designs", title: "Design Concepts" }],
  assets: [
    {
      id: "a1",
      section_key: "designs",
      kind: "image",
      title: "Kitchen",
      url: "https://cdn.test/a.jpg",
    },
  ],
  comments: [],
  decision: null,
};

let host: HTMLDivElement | null = null;

async function draw(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return host.textContent ?? "";
}

afterEach(() => {
  host?.remove();
  host = null;
});

describe("PackageReport", () => {
  it("shows the owner banner and no comment box in preview mode", async () => {
    const text = await draw(<PackageReport pack={pack} preview />);
    expect(text).toContain("Owner Preview");
    expect(text).toContain("Maple Street Renovation");
    expect(host!.querySelector("textarea")).toBeNull();
  });

  it("renders the same designs for a recipient, without the owner banner", async () => {
    const text = await draw(<PackageReport token="abcdef0123456789" pack={pack} />);
    expect(text).not.toContain("Owner Preview");
    expect(text).toContain("Kitchen");
  });

  it("treats an empty presentation as unavailable in both modes", async () => {
    const empty = { ...pack, assets: [] };
    expect(await draw(<PackageReport pack={empty} preview />)).toContain(
      "temporarily unavailable",
    );
    host?.remove();
    expect(await draw(<PackageReport token="abcdef0123456789" pack={empty} />)).toContain(
      "temporarily unavailable",
    );
  });
});
