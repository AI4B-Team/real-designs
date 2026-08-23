/**
 * Lineage repository — the single server-side way to read and write durable
 * asset versions, to find out what still references a file, and to report
 * orphans without deleting anything.
 *
 * It sits on top of the tables that already exist (`property_media_assets`,
 * `property_media_versions`, `photo_edits`, plus every table that stores a
 * storage path). No table is merged or rewritten in this phase; the canonical
 * lineage envelope rides inside the version row's existing `ops` payload.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertNotOverwritingSource,
  buildLineage,
  classifyObjects,
  deletionVerdict,
  durableVersions,
  isPreviewRef,
  lineageOf,
  resolveActive,
  withLineage,
  type AssetRow,
  type LineageOperation,
  type LineageRef,
  type OrphanReport,
  type Reference,
  type StorageObject,
  type VersionRow,
} from "@/lib/lineage";

type DB = SupabaseClient<any, any, any>;

export type LineageView = {
  asset: AssetRow;
  versions: VersionRow[];
  active: ReturnType<typeof resolveActive>;
  adaptedCount: number;
};

/** Everything Version History renders, read from durable rows only. */
export async function readLineage(
  db: DB,
  assetId: string,
  activeVersionId?: string | null,
): Promise<LineageView> {
  const { data: asset, error } = await db
    .from("property_media_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!asset) throw new Error("That photo is no longer available.");

  const { data: rows, error: ve } = await db
    .from("property_media_versions")
    .select("*")
    .eq("asset_id", assetId)
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (ve) throw new Error(ve.message);

  const versions = durableVersions((rows ?? []) as VersionRow[]);
  const adaptedCount = versions.filter((v) => lineageOf(v).adapted).length;
  return {
    asset: asset as AssetRow,
    versions,
    active: resolveActive(asset as AssetRow, versions, activeVersionId ?? null),
    adaptedCount,
  };
}

export type DeriveInput = {
  userId: string;
  assetId: string;
  /** The exact input, never "the latest version of this asset". */
  parent: LineageRef;
  operation: LineageOperation;
  outputPath: string;
  label: string;
  kind?: string;
  modificationClass?: string;
  jobId?: string | null;
  settings?: Record<string, unknown>;
  approve?: boolean;
  propertyId?: string | null;
  projectId?: string | null;
  roomId?: string | null;
};

/**
 * Writes one durable derived version with complete lineage. The source object
 * is never touched, and a preview can never enter the table.
 */
export async function recordDerivedVersion(db: DB, input: DeriveInput): Promise<VersionRow> {
  const { data: asset, error: ae } = await db
    .from("property_media_assets")
    .select("id, storage_path, property_id")
    .eq("id", input.assetId)
    .maybeSingle();
  if (ae) throw new Error(ae.message);
  if (!asset) throw new Error("That photo is no longer available.");

  if (isPreviewRef(input.outputPath)) {
    throw new Error("A version needs a saved file, not a preview.");
  }
  assertNotOverwritingSource(asset.storage_path, input.outputPath);
  assertNotOverwritingSource(input.parent.path, input.outputPath);

  const versionId = crypto.randomUUID();
  const lineage = buildLineage({
    sourceAssetId: asset.id,
    parent: input.parent,
    operation: input.operation,
    jobId: input.jobId ?? null,
    outputAssetId: asset.id,
    outputVersionId: versionId,
    outputPath: input.outputPath,
    userId: input.userId,
    propertyId: input.propertyId ?? asset.property_id ?? null,
    projectId: input.projectId ?? null,
    roomId: input.roomId ?? null,
    settings: input.settings ?? {},
    persistence: "durable",
  });

  const { data: row, error } = await db
    .from("property_media_versions")
    .insert({
      id: versionId,
      user_id: input.userId,
      asset_id: asset.id,
      label: input.label,
      kind: input.kind ?? "enhanced",
      modification_class: input.modificationClass ?? "Enhanced",
      storage_path: input.outputPath,
      ops: withLineage(input.settings ?? {}, lineage),
      approved: input.approve === true,
      archived: false,
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (input.approve) {
    await db
      .from("property_media_versions")
      .update({ approved: false } as any)
      .eq("asset_id", asset.id)
      .neq("id", versionId);
    await db
      .from("property_media_assets")
      .update({ approved_version_id: versionId } as any)
      .eq("id", asset.id);
  }
  return row as VersionRow;
}

/**
 * "Save as Copy" branches the lineage: a brand-new asset row, so the copy has
 * its own history and deleting either one never disturbs the other.
 */
export async function saveAsCopy(
  db: DB,
  input: { userId: string; assetId: string; parent: LineageRef; outputPath: string; label?: string },
): Promise<{ asset: AssetRow; version: VersionRow }> {
  const { data: src, error } = await db
    .from("property_media_assets")
    .select("*")
    .eq("id", input.assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!src) throw new Error("That photo is no longer available.");
  assertNotOverwritingSource(src.storage_path, input.outputPath);

  const copyId = crypto.randomUUID();
  const { data: copy, error: ce } = await db
    .from("property_media_assets")
    .insert({
      id: copyId,
      user_id: input.userId,
      property_id: src.property_id ?? null,
      property_label: src.property_label ?? null,
      room_group: src.room_group ?? "Needs Review",
      room_confidence: src.room_confidence ?? 0,
      source_type: "copy",
      file_type: src.file_type ?? null,
      original_filename: input.label ?? `Copy of ${src.original_filename ?? "photo"}`,
      storage_path: input.outputPath,
      modification_class: src.modification_class ?? "Unmodified Original",
    } as any)
    .select("*")
    .single();
  if (ce) throw new Error(ce.message);

  /* The copy's own first version is the copied file itself, so this row is
     written directly: the "never overwrite the source" check compares against
     the original, which the copy is a branch of, not a rewrite of. */
  const versionId = crypto.randomUUID();
  const lineage = buildLineage({
    sourceAssetId: copyId,
    parent: input.parent,
    operation: "copy",
    outputAssetId: copyId,
    outputVersionId: versionId,
    outputPath: input.outputPath,
    userId: input.userId,
    propertyId: src.property_id ?? null,
    settings: { copiedFromAssetId: input.assetId },
    persistence: "durable",
  });
  const { data: version, error: ve } = await db
    .from("property_media_versions")
    .insert({
      id: versionId,
      user_id: input.userId,
      asset_id: copyId,
      label: input.label ?? "Copy",
      kind: "enhanced",
      modification_class: src.modification_class ?? "Unmodified Original",
      storage_path: input.outputPath,
      ops: withLineage({ copiedFromAssetId: input.assetId }, lineage),
      approved: true,
      archived: false,
    } as any)
    .select("*")
    .single();
  if (ve) throw new Error(ve.message);
  await db
    .from("property_media_assets")
    .update({ approved_version_id: versionId } as any)
    .eq("id", copyId);
  return { asset: copy as AssetRow, version: version as VersionRow };
}

/* ------------------------------------------------------------------ *
 * References
 * ------------------------------------------------------------------ */

const PATH_SOURCES: Array<{ table: string; columns: string[]; kind: Reference["kind"] }> = [
  { table: "property_media_assets", columns: ["storage_path"], kind: "media" },
  { table: "property_media_versions", columns: ["storage_path"], kind: "version" },
  { table: "photo_edits", columns: ["source_path", "edited_path"], kind: "version" },
  { table: "versions", columns: ["before_path", "after_path"], kind: "property" },
  { table: "presentation_assets", columns: ["url", "compare_url"], kind: "presentation" },
  { table: "video_scenes", columns: ["source_path", "compare_path", "original_path"], kind: "video" },
  { table: "scene_clips", columns: ["storage_path", "source_path", "thumbnail_path"], kind: "video" },
  { table: "scene_start_end", columns: ["start_path", "end_path", "clip_path"], kind: "video" },
  { table: "video_projects", columns: ["cover_path", "output_path"], kind: "video" },
  { table: "video_audio", columns: ["storage_path"], kind: "video" },
  { table: "motion_clip_jobs", columns: ["source_path", "output_path"], kind: "job" },
  { table: "video_render_jobs", columns: ["output_path"], kind: "job" },
];

export type ReferenceIndex = {
  paths: Set<string>;
  byPath: Map<string, Reference[]>;
  /** Paths written by generations that failed — safe to clean up. */
  failedPaths: Set<string>;
};

const isStoragePath = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && !/^(https?:|blob:|data:|\/)/.test(v);

/**
 * Every storage path this user still needs, across versions, presentations,
 * videos, properties, media and jobs. A missing table or column is skipped
 * rather than silently narrowing the index — a narrow index would authorise a
 * deletion, so failures here must never look like "nothing references it".
 */
export async function buildReferenceIndex(
  db: DB,
  userId: string,
): Promise<ReferenceIndex & { incomplete: string[] }> {
  const paths = new Set<string>();
  const byPath = new Map<string, Reference[]>();
  const failedPaths = new Set<string>();
  const incomplete: string[] = [];

  const add = (value: unknown, ref: Reference) => {
    if (!isStoragePath(value)) return;
    paths.add(value);
    const list = byPath.get(value) ?? [];
    list.push(ref);
    byPath.set(value, list);
  };

  await Promise.all(
    PATH_SOURCES.map(async (src) => {
      const select = ["id", ...src.columns].join(", ");
      const { data, error } = await db.from(src.table).select(select).limit(5000);
      if (error) {
        incomplete.push(src.table);
        return;
      }
      for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        for (const col of src.columns) {
          add(row[col], { kind: src.kind, id: String(row["id"] ?? ""), detail: src.table });
        }
      }
    }),
  );

  /* Failed generations leave bytes nobody will ever ask for again. They are
     classified, not quietly deleted. */
  const { data: failed, error: fe } = await db
    .from("motion_clip_jobs")
    .select("output_path, status")
    .eq("user_id", userId)
    .eq("status", "failed")
    .limit(2000);
  if (fe) incomplete.push("motion_clip_jobs:failed");
  for (const row of (failed ?? []) as unknown as Array<Record<string, unknown>>) {
    const p = row["output_path"];
    if (!isStoragePath(p)) continue;
    /* The failed job row itself is not a reason to keep the bytes: only a
       reference from somewhere else counts. */
    const others = (byPath.get(p) ?? []).filter((r) => r.kind !== "job");
    if (others.length) continue;
    byPath.delete(p);
    paths.delete(p);
    failedPaths.add(p);
  }

  return { paths, byPath, failedPaths, incomplete };
}

/** Who still points at these bytes. Empty means deletion is safe. */
export async function referencesTo(
  db: DB,
  userId: string,
  path: string,
  opts?: { ignoreVersionId?: string },
): Promise<Reference[]> {
  const index = await buildReferenceIndex(db, userId);
  if (index.incomplete.length) {
    throw new Error("Couldn't confirm what still uses this file. Nothing was deleted.");
  }
  return (index.byPath.get(path) ?? []).filter(
    (r) => !(opts?.ignoreVersionId && r.id === opts.ignoreVersionId),
  );
}

/** Deletes a version only when nothing else references its bytes. */
export async function deleteVersionSafely(
  db: DB,
  userId: string,
  versionId: string,
): Promise<{ deleted: boolean; reasons: string[]; message: string }> {
  const { data: v, error } = await db
    .from("property_media_versions")
    .select("id, asset_id, storage_path")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!v) return { deleted: false, reasons: [], message: "That version is already gone." };

  const refs = await referencesTo(db, userId, v.storage_path, { ignoreVersionId: versionId });
  const verdict = deletionVerdict(refs);
  if (!verdict.allowed) return { deleted: false, ...verdict };

  const { error: de } = await db.from("property_media_versions").delete().eq("id", versionId);
  if (de) throw new Error(de.message);
  await db
    .from("property_media_assets")
    .update({ approved_version_id: null } as any)
    .eq("approved_version_id", versionId);
  return { deleted: true, reasons: [], message: "" };
}

/* ------------------------------------------------------------------ *
 * Orphan diagnostic
 * ------------------------------------------------------------------ */

/**
 * Reports what is unreferenced in the caller's own storage folder. It is a
 * diagnostic: nothing is removed, and a partial reference index aborts the
 * report rather than labelling still-needed files as orphans.
 */
export async function orphanDiagnostic(
  db: DB,
  storage: { list: (bucket: string, prefix: string) => Promise<StorageObject[]> },
  userId: string,
  buckets: readonly string[] = ["room-photos", "reveal-videos", "user-audio"],
): Promise<OrphanReport & { buckets: string[] }> {
  const index = await buildReferenceIndex(db, userId);
  if (index.incomplete.length) {
    throw new Error("Couldn't read every reference, so no orphan report was produced.");
  }
  const objects: StorageObject[] = [];
  const scannedBuckets: string[] = [];
  for (const bucket of buckets) {
    try {
      objects.push(...(await storage.list(bucket, userId)));
      scannedBuckets.push(bucket);
    } catch (_) {
      /* An unreadable bucket is reported by omission, never as empty. */
    }
  }
  return { ...classifyObjects(objects, index.paths, index.failedPaths), buckets: scannedBuckets };
}
