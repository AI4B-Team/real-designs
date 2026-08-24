/** Owner preview must render the recipient view read-only. */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

describe("PackageReport", () => {
  it("shows the owner banner and no comment box in preview mode", () => {
    render(<PackageReport pack={pack} preview />);
    expect(screen.getByText(/Owner Preview/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Comment on/i)).toBeNull();
    expect(screen.getByText("Maple Street Renovation")).toBeTruthy();
  });

  it("renders the same designs for a recipient, with commenting enabled", () => {
    render(<PackageReport token="abcdef0123456789" pack={pack} />);
    expect(screen.queryByText(/Owner Preview/i)).toBeNull();
    expect(screen.getByText("Kitchen")).toBeTruthy();
  });

  it("treats an empty presentation as unavailable in both modes", () => {
    const empty = { ...pack, assets: [] };
    const { unmount } = render(<PackageReport pack={empty} preview />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
    unmount();
    render(<PackageReport token="abcdef0123456789" pack={empty} />);
    expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy();
  });
});
