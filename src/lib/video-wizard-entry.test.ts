import { describe, it, expect, vi } from "vitest";
import {
  initialWizardStep,
  hydrateSeededWizard,
  ensureStepInvariant,
  acceptVideoPhotos,
  attachUploadAssets,
} from "./video-upload-intake";

const mkFile = (n: string) => new File([new Uint8Array([1, 2, 3])], n, { type: "image/jpeg" });
const selectUploads = (w: any) => {
  w.scenes = (w.gridOrder || []).map((k: string) => ({ key: k }));
};
const blank = (over: any = {}) => ({
  step: 1,
  uploads: [],
  scenes: [],
  available: [],
  gridOrder: [],
  ...over,
});

function deps(w: any, render = vi.fn()) {
  return {
    rejectReason: () => null,
    createUrl: (f: File) => "blob:" + f.name,
    uuid: () => Math.random().toString(36).slice(2),
    advance: async (x: any) => {
      x.step = 2;
      attachUploadAssets(x);
      selectUploads(x);
      render();
    },
    loadAssets: async () => {},
    isCurrent: (x: any) => x === w,
    attachUploads: attachUploadAssets,
    selectUploads,
    selectKeys: (x: any, keys: string[]) => {
      const have = new Set((x.scenes || []).map((s: any) => s.key));
      x.scenes = x.scenes.concat(keys.filter((k) => !have.has(k)).map((k) => ({ key: k })));
    },
    render,
  };
}

describe("initial step resolution", () => {
  it("opens scenes whenever uploads exist", () => {
    expect(initialWizardStep({}, [{ id: "a" }])).toBe(2);
    expect(initialWizardStep({ propertyId: "p" }, [])).toBe(2);
    expect(initialWizardStep({ versionId: "v" }, [])).toBe(2);
    expect(initialWizardStep({}, [])).toBe(2);
  });
  it("keeps a restored draft on its saved later step", () => {
    expect(initialWizardStep({ step: 5 }, [{ id: "a" }])).toBe(5);
  });
});

describe("seeded uploads (Studio / Create Media handoff)", () => {
  it("hydrates to step 2 with all photos selected before first paint", () => {
    const w: any = blank({
      uploads: Array.from({ length: 6 }, (_, i) => ({ id: "s" + i, url: "blob:" + i })),
    });
    w.step = initialWizardStep({}, w.uploads);
    hydrateSeededWizard(w, { attachUploads: attachUploadAssets, selectUploads });
    expect(w.step).toBe(2);
    expect(w.gridOrder).toHaveLength(6);
    expect(w.scenes).toHaveLength(6);
  });
});

describe("acceptVideoPhotos", () => {
  it("advances a direct picker upload of six files to step 2", async () => {
    const w: any = blank();
    const render = vi.fn();
    await acceptVideoPhotos({
      wizard: w,
      files: Array.from({ length: 6 }, (_, i) => mkFile(`p${i}.jpg`)),
      source: "picker",
      deps: deps(w, render) as any,
    });
    expect(w.step).toBe(2);
    expect(w.uploads).toHaveLength(6);
    expect(w.scenes).toHaveLength(6);
    expect(render).toHaveBeenCalled();
  });

  it("appends from step 2 and stays on step 2 with new photos selected", async () => {
    const w: any = blank({ step: 2, uploads: [{ id: "a", url: "blob:a" }] });
    attachUploadAssets(w);
    selectUploads(w);
    await acceptVideoPhotos({
      wizard: w,
      files: [mkFile("n1.jpg"), mkFile("n2.jpg")],
      source: "step2",
      deps: deps(w) as any,
    });
    expect(w.step).toBe(2);
    expect(w.uploads).toHaveLength(3);
    expect(w.scenes).toHaveLength(3);
  });
});

describe("step invariant", () => {
  it("never leaves a wizard with photos on step 1", () => {
    const w: any = blank({ uploads: [{ id: "a", url: "blob:a" }] });
    expect(ensureStepInvariant(w, { attachUploads: attachUploadAssets, selectUploads })).toBe(true);
    expect(w.step).toBe(2);
    expect(ensureStepInvariant(blank(), {})).toBe(false);
  });
});
