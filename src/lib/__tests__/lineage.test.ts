// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  ancestry,
  buildLineage,
  classifyObjects,
  deletionVerdict,
  downloadRef,
  durableVersions,
  handoffRef,
  isPreviewRef,
  lineageOf,
  resolveActive,
  saveActionFor,
  saveLabelFor,
  withLineage,
  type AssetRow,
  type VersionRow,
} from "@/lib/lineage";
import {
  buildReferenceIndex,
  deleteVersionSafely,
  orphanDiagnostic,
  readLineage,
  recordDerivedVersion,
  saveAsCopy,
} from "@/lib/lineage.server";

/* ------------------------------------------------------------------ *
 * A small in-memory stand-in for the tables the repository touches.
 * ------------------------------------------------------------------ */

type Row = Record<string, any>;

function fakeDb(tables: Record<string, Row[]>) {
  const get = (t: string) => (tables[t] ??= []);
  return {
    tables,
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let mode: "select" | "insert" | "update" | "delete" = "select";
      let payload: Row | Row[] | null = null;
      const rows = () => get(table).filter((r) => filters.every((f) => f(r)));
      const api: any = {
        select: () => api,
        order: () => api,
        limit: () => Promise.resolve({ data: rows(), error: null }),
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
        neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), api),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
        insert: (p: Row | Row[]) => ((mode = "insert"), (payload = p), api),
        update: (p: Row) => ((mode = "update"), (payload = p), api),
        delete: () => ((mode = "delete"), api),
        maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
        single: () => api.then((r: any) => ({ data: r.data?.[0] ?? null, error: null })),
        then: (resolve: (v: any) => unknown) => {
          if (mode === "insert") {
            const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
            const made = list.map((r) => ({ id: r["id"] ?? crypto.randomUUID(), ...r }));
            get(table).push(...made);
            return Promise.resolve(resolve({ data: made, error: null }));
          }
          if (mode === "update") {
            const hit = rows();
            hit.forEach((r) => Object.assign(r, payload));
            return Promise.resolve(resolve({ data: hit, error: null }));
          }
          if (mode === "delete") {
            const keep = get(table).filter((r) => !filters.every((f) => f(r)));
            const gone = rows();
            tables[table] = keep;
            return Promise.resolve(resolve({ data: gone, error: null }));
          }
          return Promise.resolve(resolve({ data: rows(), error: null }));
        },
      };
      return api;
    },
  } as any;
}

const USER = "11111111-1111-1111-1111-111111111111";
const ASSET = "22222222-2222-2222-2222-222222222222";

const asset = (over: Row = {}): AssetRow =>
  ({
    id: ASSET,
    user_id: USER,
    storage_path: `${USER}/original.jpg`,
    property_id: null,
    approved_version_id: null,
    ...over,
  }) as AssetRow;

const version = (over: Row = {}): VersionRow =>
  ({
    id: "v1",
    asset_id: ASSET,
    user_id: USER,
    label: "Enhanced",
    kind: "enhanced",
    storage_path: `${USER}/v1.jpg`,
    ops: {},
    approved: false,
    archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as VersionRow;

function baseDb() {
  return fakeDb({
    property_media_assets: [{ ...asset(), room_group: "Kitchen", room_confidence: 0.9 }],
    property_media_versions: [],
    photo_edits: [],
    versions: [],
    presentation_assets: [],
    video_scenes: [],
    scene_clips: [],
    scene_start_end: [],
    video_projects: [],
    video_audio: [],
    motion_clip_jobs: [],
    video_render_jobs: [],
  });
}

describe("lineage rules", () => {
  it("treats the uploaded source as immutable and only offers a new version", () => {
    expect(saveActionFor({ role: "source", asset: asset() })).toBe("save_as_new_version");
    expect(saveLabelFor({ role: "source", asset: asset() })).toBe("Save as New Version");
  });

  it("allows Save Changes on a working version but not on a frozen one", () => {
    const working = { role: "version", asset: asset(), version: version() } as const;
    expect(saveLabelFor(working)).toBe("Save Changes");
    expect(saveLabelFor({ ...working, version: version({ approved: true }) })).toBe(
      "Save as New Version",
    );
    expect(saveLabelFor({ ...working, published: true })).toBe("Save as New Version");
  });

  it("refuses to build lineage that would overwrite the source", () => {
    expect(() =>
      buildLineage({
        sourceAssetId: ASSET,
        parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
        operation: "edit",
        outputAssetId: ASSET,
        outputPath: `${USER}/original.jpg`,
        userId: USER,
      }),
    ).toThrow(/can't be overwritten/i);
  });

  it("never lets a preview become a durable version", () => {
    expect(isPreviewRef("blob:http://x/1")).toBe(true);
    expect(isPreviewRef("")).toBe(true);
    expect(isPreviewRef(`${USER}/v1.jpg`)).toBe(false);
    expect(() =>
      buildLineage({
        sourceAssetId: ASSET,
        parent: null,
        operation: "edit",
        outputAssetId: ASSET,
        outputPath: "blob:http://x/1",
        userId: USER,
      }),
    ).toThrow(/preview/i);
  });

  it("resolves the exact active version, not the newest one", () => {
    const a = asset();
    const list = [
      version({ id: "v1", created_at: "2026-01-01T00:00:00.000Z" }),
      version({ id: "v2", storage_path: `${USER}/v2.jpg`, created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(resolveActive(a, list, "v1").versionId).toBe("v1");
    expect(resolveActive(a, list, null).role).toBe("source");
    expect(resolveActive(asset({ approved_version_id: "v2" }), list, null).versionId).toBe("v2");
    expect(() => resolveActive(a, list, "gone")).toThrow(/no longer available/i);
  });

  it("downloads and hands off the visible persisted version", () => {
    const list = [version({ id: "v2", storage_path: `${USER}/v2.jpg` })];
    expect(downloadRef(asset(), list, "v2").path).toBe(`${USER}/v2.jpg`);
    expect(handoffRef(asset(), list, "v2")).toEqual({
      kind: "version",
      id: "v2",
      path: `${USER}/v2.jpg`,
    });
    expect(() => downloadRef(asset(), [version({ storage_path: "blob:x" })], "v1")).toThrow(
      /save this photo first/i,
    );
  });

  it("keeps Version History to durable rows", () => {
    const list = [version({ id: "v1" }), version({ id: "vp", storage_path: "blob:x" })];
    expect(durableVersions(list).map((v) => v.id)).toEqual(["v1"]);
  });

  it("adapts a legacy version row without losing its payload", () => {
    const legacy = version({ ops: { strength: 40 }, kind: "design" });
    const rec = lineageOf(legacy);
    expect(rec.adapted).toBe(true);
    expect(rec.operation).toBe("generate");
    expect(rec.sourceAssetId).toBe(ASSET);
    expect(rec.settings).toEqual({ strength: 40 });
  });

  it("walks ancestry back to the source", () => {
    const v1 = version({
      id: "v1",
      ops: withLineage(
        {},
        buildLineage({
          sourceAssetId: ASSET,
          parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
          operation: "enhance",
          outputAssetId: ASSET,
          outputVersionId: "v1",
          outputPath: `${USER}/v1.jpg`,
          userId: USER,
        }),
      ),
    });
    const v2 = version({
      id: "v2",
      storage_path: `${USER}/v2.jpg`,
      ops: withLineage(
        {},
        buildLineage({
          sourceAssetId: ASSET,
          parent: { kind: "version", id: "v1", path: `${USER}/v1.jpg` },
          operation: "generate",
          outputAssetId: ASSET,
          outputVersionId: "v2",
          outputPath: `${USER}/v2.jpg`,
          userId: USER,
        }),
      ),
    });
    expect(ancestry(v2, [v1, v2]).map((r) => r.id)).toEqual(["v1", ASSET]);
  });

  it("explains why a referenced file cannot be deleted", () => {
    const v = deletionVerdict([
      { kind: "presentation", id: "p1" },
      { kind: "video", id: "vd1" },
    ]);
    expect(v.allowed).toBe(false);
    expect(v.message).toMatch(/shared presentation and a video/);
    expect(deletionVerdict([]).allowed).toBe(true);
  });

  it("classifies orphans without deleting anything", () => {
    const now = Date.parse("2026-03-01T00:00:00.000Z");
    const report = classifyObjects(
      [
        { path: "u/used.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
        { path: "u/failed.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
        { path: "u/fresh.jpg", createdAt: "2026-02-28T23:00:00.000Z" },
        { path: "u/orphan.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      new Set(["u/used.jpg"]),
      new Set(["u/failed.jpg"]),
      { now },
    );
    expect(report.deleted).toBe(0);
    expect(report.referenced).toBe(1);
    expect(report.recent).toBe(1);
    expect(report.failedArtifacts).toBe(1);
    expect(report.orphans).toBe(1);
    expect(report.rows.filter((r) => r.safeToDelete).map((r) => r.path)).toEqual([
      "u/failed.jpg",
      "u/orphan.jpg",
    ]);
  });
});

describe("lineage repository", () => {
  let db: ReturnType<typeof baseDb>;
  beforeEach(() => {
    db = baseDb();
  });

  it("edits the source into a new version and leaves the source untouched", async () => {
    const v = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      operation: "edit",
      outputPath: `${USER}/edit-1.jpg`,
      label: "Edited",
    });
    expect(v.storage_path).toBe(`${USER}/edit-1.jpg`);
    const rec = lineageOf(v);
    expect(rec.parent).toEqual({ kind: "asset", id: ASSET, path: `${USER}/original.jpg` });
    expect(rec.persistence).toBe("durable");
    expect(db.tables["property_media_assets"][0].storage_path).toBe(`${USER}/original.jpg`);
  });

  it("refuses to write a version over the original file", async () => {
    await expect(
      recordDerivedVersion(db, {
        userId: USER,
        assetId: ASSET,
        parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
        operation: "edit",
        outputPath: `${USER}/original.jpg`,
        label: "Nope",
      }),
    ).rejects.toThrow(/can't be overwritten/i);
  });

  it("records a generation from an edited version with full lineage", async () => {
    const v1 = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      operation: "edit",
      outputPath: `${USER}/edit-1.jpg`,
      label: "Edited",
    });
    const v2 = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "version", id: v1.id, path: v1.storage_path },
      operation: "generate",
      outputPath: `${USER}/design-1.jpg`,
      label: "Modern Coastal",
      kind: "design",
      jobId: "job-77",
      settings: { style: "modern-coastal" },
      approve: true,
    });
    const rec = lineageOf(v2);
    expect(rec.parent?.id).toBe(v1.id);
    expect(rec.jobId).toBe("job-77");
    expect(rec.settings).toEqual({ style: "modern-coastal" });
    expect(rec.sourceAssetId).toBe(ASSET);
    expect(rec.userId).toBe(USER);
    expect(rec.createdAt).toBeTruthy();
    expect(db.tables["property_media_assets"][0].approved_version_id).toBe(v2.id);
  });

  it("Save as Copy creates a separate asset with its own lineage branch", async () => {
    const { asset: copy, version: cv } = await saveAsCopy(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      outputPath: `${USER}/copy-1.jpg`,
      label: "Copy for listing",
    });
    expect(copy.id).not.toBe(ASSET);
    expect(cv.asset_id).toBe(copy.id);
    expect(lineageOf(cv).settings["copiedFromAssetId"]).toBe(ASSET);
    /* The original asset and its history are untouched. */
    expect(db.tables["property_media_assets"].some((a: Row) => a["id"] === ASSET)).toBe(true);
  });

  it("reads Version History and the exact active version from durable rows", async () => {
    const v1 = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      operation: "enhance",
      outputPath: `${USER}/v1.jpg`,
      label: "Enhanced",
    });
    const view = await readLineage(db, ASSET, v1.id);
    expect(view.versions.map((v) => v.id)).toEqual([v1.id]);
    expect(view.active.versionId).toBe(v1.id);
    expect(view.active.ref.path).toBe(`${USER}/v1.jpg`);

    const fresh = await readLineage(db, ASSET, null);
    expect(fresh.active.role).toBe("source");
  });

  it("indexes references from versions, presentations, videos, media and jobs", async () => {
    db.tables["property_media_versions"].push(version({ storage_path: `${USER}/v1.jpg` }));
    db.tables["presentation_assets"].push({ id: "pa1", url: `${USER}/shared.jpg` });
    db.tables["video_scenes"].push({ id: "s1", source_path: `${USER}/scene.jpg` });
    db.tables["motion_clip_jobs"].push({
      id: "j1",
      user_id: USER,
      status: "failed",
      output_path: `${USER}/failed.mp4`,
    });
    const index = await buildReferenceIndex(db, USER);
    expect(index.incomplete).toEqual([]);
    expect(index.paths.has(`${USER}/original.jpg`)).toBe(true);
    expect(index.paths.has(`${USER}/v1.jpg`)).toBe(true);
    expect(index.paths.has(`${USER}/shared.jpg`)).toBe(true);
    expect(index.paths.has(`${USER}/scene.jpg`)).toBe(true);
    expect(index.failedPaths.has(`${USER}/failed.mp4`)).toBe(true);
  });

  it("deletes an unreferenced version", async () => {
    const v = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      operation: "enhance",
      outputPath: `${USER}/v1.jpg`,
      label: "Enhanced",
    });
    const res = await deleteVersionSafely(db, USER, v.id);
    expect(res.deleted).toBe(true);
    expect(db.tables["property_media_versions"]).toHaveLength(0);
  });

  it("refuses to delete a version a presentation still shows", async () => {
    const v = await recordDerivedVersion(db, {
      userId: USER,
      assetId: ASSET,
      parent: { kind: "asset", id: ASSET, path: `${USER}/original.jpg` },
      operation: "generate",
      outputPath: `${USER}/design.jpg`,
      label: "Design",
    });
    db.tables["presentation_assets"].push({ id: "pa1", url: `${USER}/design.jpg` });
    const res = await deleteVersionSafely(db, USER, v.id);
    expect(res.deleted).toBe(false);
    expect(res.message).toMatch(/shared presentation/);
    expect(db.tables["property_media_versions"]).toHaveLength(1);
  });

  it("produces an orphan diagnostic and deletes nothing", async () => {
    db.tables["property_media_versions"].push(version({ storage_path: `${USER}/v1.jpg` }));
    const report = await orphanDiagnostic(
      db,
      {
        list: async () => [
          { path: `${USER}/v1.jpg`, createdAt: "2026-01-01T00:00:00.000Z" },
          { path: `${USER}/nobody.jpg`, createdAt: "2026-01-01T00:00:00.000Z" },
        ],
      },
      USER,
      ["room-photos"],
    );
    expect(report.deleted).toBe(0);
    expect(report.referenced).toBe(1);
    expect(report.orphans).toBe(1);
    expect(db.tables["property_media_versions"]).toHaveLength(1);
  });

  it("stops instead of guessing when the reference index is incomplete", async () => {
    const broken = {
      from: (t: string) => ({
        select: () => ({
          limit: async () =>
            t === "presentation_assets"
              ? { data: null, error: { message: "boom" } }
              : { data: [], error: null },
          eq: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        }),
      }),
    } as any;
    await expect(
      orphanDiagnostic(broken, { list: async () => [] }, USER, ["room-photos"]),
    ).rejects.toThrow(/no orphan report/i);
  });
});
