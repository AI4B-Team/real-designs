import { describe, it, expect, vi } from "vitest";
import { runAdvanceToGrid, attachUploadAssets, ENRICH_NOTICE } from "./video-upload-intake";

function wizard() {
  return {
    step: 1,
    uploads: [{ id: "a", url: "blob:a" }, { id: "b", url: "blob:b" }],
    scenes: [] as any[],
    available: [] as any[],
    gridOrder: [] as string[],
  } as any;
}

describe("runAdvanceToGrid", () => {
  it("renders step 2 before the asset load resolves", async () => {
    const w = wizard();
    let resolveLoad: () => void = () => {};
    const seen: number[] = [];
    const render = vi.fn(() => seen.push(w.step));
    const p = runAdvanceToGrid(w, {
      loadAssets: () => new Promise<void>((r) => { resolveLoad = () => r(); }),
      isCurrent: () => true,
      selectUploads: (x) => { x.scenes = x.gridOrder.map((k: string) => ({ key: k })); },
      attachUploads: attachUploadAssets,
      autoArrange: () => {},
      render,
    });
    await Promise.resolve();
    expect(seen).toEqual([2]);
    expect(w.step).toBe(2);
    expect(w.available).toHaveLength(2);
    expect(w.gridOrder).toEqual(["u-a", "u-b"]);
    expect(w.scenes).toHaveLength(2);
    expect(w.selectGridLoading).toBe(true);
    resolveLoad();
    await p;
    expect(w.selectGridLoading).toBe(false);
  });

  it("keeps photos on step 2 when enrichment fails", async () => {
    const w = wizard();
    await runAdvanceToGrid(w, {
      loadAssets: () => Promise.reject(new Error("boom")),
      isCurrent: () => true,
      selectUploads: (x) => { x.scenes = x.gridOrder.map((k: string) => ({ key: k })); },
      render: () => {},
    });
    expect(w.step).toBe(2);
    expect(w.scenes).toHaveLength(2);
    expect(w.enrichNotice).toBe(ENRICH_NOTICE);
    expect(w.selectGridLoading).toBe(false);
  });

  it("stops the loading state when enrichment times out", async () => {
    const w = wizard();
    await runAdvanceToGrid(w, {
      loadAssets: () => new Promise<void>(() => {}),
      isCurrent: () => true,
      selectUploads: (x) => { x.scenes = x.gridOrder.map((k: string) => ({ key: k })); },
      render: () => {},
      timeoutMs: 10,
    });
    expect(w.step).toBe(2);
    expect(w.available).toHaveLength(2);
    expect(w.enrichNotice).toBe(ENRICH_NOTICE);
  });

  it("does not duplicate uploads when attached twice", () => {
    const w = wizard();
    attachUploadAssets(w);
    attachUploadAssets(w);
    expect(w.gridOrder).toEqual(["u-a", "u-b"]);
    expect(w.available).toHaveLength(2);
  });
});
