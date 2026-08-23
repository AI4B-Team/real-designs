/**
 * Canonical asset and version lineage — the one application boundary.
 *
 * REAL DESIGNS had several competing ideas of "the image": media assets and
 * their versions, photo-edit rows, room versions, and a pile of ad-hoc
 * "latest result" lookups. This module defines the vocabulary once, in pure
 * code that both the browser and the server import, so that every durable
 * output can say exactly what it came from.
 *
 * Concepts
 * - Source Asset:  an immutable uploaded or imported input. Its bytes are
 *                  never rewritten; the object in storage is the evidence of
 *                  what the user actually gave us.
 * - Derived Asset: a file produced from another asset by an edit, generation,
 *                  crop, enhancement or conversion. Always a new object.
 * - Version:       a durable, user-visible state on an asset's lineage.
 * - Preview:       a temporary representation (blob:, data:, in-flight job
 *                  output). A preview must never be presented as a version,
 *                  shared, downloaded as final, or locked into an approval.
 * - Active Version: the exact version currently displayed. Not "the newest".
 * - Parent Version: the version used as input for a derived result.
 * - Generation Job: the operation that produced a derived asset/version.
 *
 * No schema rewrite happens here. Lineage is written into the existing
 * `ops` payload of a version row under a versioned envelope, and legacy rows
 * without one are adapted on read.
 */

export type AssetRole = "source" | "derived";

export type LineageOperation =
  | "upload"
  | "import"
  | "edit"
  | "crop"
  | "rotate"
  | "enhance"
  | "privacy_blur"
  | "generate"
  | "restyle"
  | "upscale"
  | "convert"
  | "copy";

export type Persistence = "durable" | "preview" | "failed";

/** Points at exactly one thing. Never "the latest of something". */
export type LineageRef = {
  kind: "asset" | "version";
  id: string;
  /** Storage path of the referenced bytes; never a blob:/data: preview. */
  path: string;
};

export type LineageRecord = {
  /** Envelope version so adapters can evolve without a table rewrite. */
  v: 1;
  sourceAssetId: string;
  parent: LineageRef | null;
  operation: LineageOperation;
  jobId: string | null;
  outputAssetId: string;
  outputVersionId: string | null;
  outputPath: string;
  userId: string;
  propertyId: string | null;
  projectId: string | null;
  roomId: string | null;
  /** Exact settings the operation ran with, frozen at creation. */
  settings: Record<string, unknown>;
  createdAt: string;
  persistence: Persistence;
};

export type VersionRow = {
  id: string;
  asset_id: string;
  label: string;
  kind?: string | null;
  modification_class?: string | null;
  storage_path: string;
  ops?: Record<string, unknown> | null;
  approved?: boolean | null;
  archived?: boolean | null;
  created_at?: string | null;
  user_id?: string | null;
};

export type AssetRow = {
  id: string;
  user_id?: string | null;
  storage_path: string;
  property_id?: string | null;
  approved_version_id?: string | null;
  modification_class?: string | null;
  original_filename?: string | null;
  created_at?: string | null;
};

/* ------------------------------------------------------------------ *
 * Preview vs durable
 * ------------------------------------------------------------------ */

const EPHEMERAL = /^(blob:|data:)/i;

/** True when a reference is a temporary picture, not a saved file. */
export function isPreviewRef(path: string | null | undefined): boolean {
  const p = (path ?? "").trim();
  if (!p) return true;
  return EPHEMERAL.test(p);
}

/**
 * A durable reference is required anywhere identity matters: download,
 * approval links, handing an image to another tool, presentation assets.
 */
export function assertDurableRef(ref: LineageRef | null | undefined, what: string): LineageRef {
  if (!ref || !ref.id || isPreviewRef(ref.path)) {
    throw new Error(`${what} needs a saved version. Save this photo first.`);
  }
  return ref;
}

/* ------------------------------------------------------------------ *
 * Immutability
 * ------------------------------------------------------------------ */

/**
 * The uploaded/imported original is immutable, always. A version is mutable
 * only while it is an unshared, unapproved working state — anything approved,
 * archived or already published is frozen too.
 */
export function isImmutableSource(asset: Pick<AssetRow, "id">): boolean {
  return Boolean(asset && asset.id);
}

export function isImmutableVersion(
  v: Pick<VersionRow, "approved" | "archived"> | null | undefined,
  opts?: { published?: boolean },
): boolean {
  if (!v) return true;
  return Boolean(v.approved || v.archived || opts?.published);
}

export type SaveTarget =
  | { role: "source"; asset: AssetRow }
  | { role: "version"; asset: AssetRow; version: VersionRow; published?: boolean };

export type SaveAction = "save_changes" | "save_as_new_version";

/**
 * What the Save button must do — and therefore say. Editing an immutable
 * source or a frozen version can only ever branch; it may never overwrite.
 */
export function saveActionFor(target: SaveTarget): SaveAction {
  if (target.role === "source") return "save_as_new_version";
  return isImmutableVersion(target.version, { published: target.published === true })
    ? "save_as_new_version"
    : "save_changes";
}

export const SAVE_LABEL: Record<SaveAction, string> = {
  save_changes: "Save Changes",
  save_as_new_version: "Save as New Version",
};

export function saveLabelFor(target: SaveTarget): string {
  return SAVE_LABEL[saveActionFor(target)];
}

/**
 * Guard used by every write path. Overwriting the source object is a bug we
 * refuse at the boundary rather than hope no client ever attempts.
 */
export function assertNotOverwritingSource(sourcePath: string, outputPath: string): void {
  if (sourcePath && outputPath && sourcePath === outputPath) {
    throw new Error("The original photo can't be overwritten. Save this as a new version.");
  }
}

/* ------------------------------------------------------------------ *
 * Active version resolution
 * ------------------------------------------------------------------ */

export type ActiveSelection = {
  ref: LineageRef;
  /** The source asset always anchors the lineage, even when a version shows. */
  assetId: string;
  versionId: string | null;
  role: AssetRole;
  label: string;
};

/**
 * The exact thing on screen. Callers pass the id they are displaying; only
 * when nothing is selected do we fall back to the asset's approved version,
 * and then to the original. "Newest" is never used as an identity.
 */
export function resolveActive(
  asset: AssetRow,
  versions: VersionRow[],
  activeVersionId?: string | null,
): ActiveSelection {
  const list = (versions ?? []).filter((v) => v.asset_id === asset.id);
  const pick =
    (activeVersionId && list.find((v) => v.id === activeVersionId)) ||
    (asset.approved_version_id && list.find((v) => v.id === asset.approved_version_id)) ||
    null;
  if (activeVersionId && !pick) {
    throw new Error("That version is no longer available. Refresh the version history.");
  }
  if (pick) {
    return {
      ref: { kind: "version", id: pick.id, path: pick.storage_path },
      assetId: asset.id,
      versionId: pick.id,
      role: "derived",
      label: pick.label || "Version",
    };
  }
  return {
    ref: { kind: "asset", id: asset.id, path: asset.storage_path },
    assetId: asset.id,
    versionId: null,
    role: "source",
    label: "Original",
  };
}

/** What a download writes: the visible persisted version, never "latest". */
export function downloadRef(
  asset: AssetRow,
  versions: VersionRow[],
  activeVersionId?: string | null,
): LineageRef {
  return assertDurableRef(resolveActive(asset, versions, activeVersionId).ref, "Download");
}

/** What another tool receives when the user sends this image onward. */
export function handoffRef(
  asset: AssetRow,
  versions: VersionRow[],
  activeVersionId?: string | null,
): LineageRef {
  return assertDurableRef(resolveActive(asset, versions, activeVersionId).ref, "This tool");
}

/** Durable versions only — Version History never renders working state. */
export function durableVersions(versions: VersionRow[]): VersionRow[] {
  return (versions ?? [])
    .filter((v) => !isPreviewRef(v.storage_path))
    .filter((v) => lineageOf(v).persistence === "durable")
    .sort((a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""));
}

/* ------------------------------------------------------------------ *
 * Lineage envelope: write, read, adapt
 * ------------------------------------------------------------------ */

export type BuildLineageInput = {
  sourceAssetId: string;
  parent: LineageRef | null;
  operation: LineageOperation;
  jobId?: string | null;
  outputAssetId: string;
  outputVersionId?: string | null;
  outputPath: string;
  userId: string;
  propertyId?: string | null;
  projectId?: string | null;
  roomId?: string | null;
  settings?: Record<string, unknown>;
  persistence?: Persistence;
  createdAt?: string;
};

export function buildLineage(input: BuildLineageInput): LineageRecord {
  const persistence = input.persistence ?? "durable";
  if (persistence === "durable" && isPreviewRef(input.outputPath)) {
    throw new Error("A durable version needs a saved file, not a preview.");
  }
  if (input.parent) assertNotOverwritingSource(input.parent.path, input.outputPath);
  return {
    v: 1,
    sourceAssetId: input.sourceAssetId,
    parent: input.parent,
    operation: input.operation,
    jobId: input.jobId ?? null,
    outputAssetId: input.outputAssetId,
    outputVersionId: input.outputVersionId ?? null,
    outputPath: input.outputPath,
    userId: input.userId,
    propertyId: input.propertyId ?? null,
    projectId: input.projectId ?? null,
    roomId: input.roomId ?? null,
    settings: input.settings ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
    persistence,
  };
}

/** Stored inside the row's existing `ops` payload — no new table needed. */
export const LINEAGE_KEY = "lineage";

export function withLineage(
  ops: Record<string, unknown> | null | undefined,
  rec: LineageRecord,
): Record<string, unknown> {
  return { ...(ops ?? {}), [LINEAGE_KEY]: rec };
}

/**
 * Reads the lineage of an existing row, adapting records written before this
 * boundary existed. Legacy rows keep every field they had; we only fill in
 * what can be derived, and mark them so adoption can be measured.
 */
export function lineageOf(v: VersionRow): LineageRecord & { adapted?: boolean } {
  const raw = (v.ops ?? {})[LINEAGE_KEY] as Partial<LineageRecord> | undefined;
  if (raw && raw.v === 1 && raw.sourceAssetId) return raw as LineageRecord;
  return {
    v: 1,
    sourceAssetId: v.asset_id,
    parent: { kind: "asset", id: v.asset_id, path: "" },
    operation: legacyOperation(v),
    jobId: (raw?.jobId as string) ?? null,
    outputAssetId: v.asset_id,
    outputVersionId: v.id,
    outputPath: v.storage_path,
    userId: v.user_id ?? "",
    propertyId: null,
    projectId: null,
    roomId: null,
    settings: (v.ops ?? {}) as Record<string, unknown>,
    createdAt: v.created_at ?? "",
    persistence: isPreviewRef(v.storage_path) ? "preview" : "durable",
    adapted: true,
  };
}

function legacyOperation(v: VersionRow): LineageOperation {
  const k = (v.kind ?? "").toLowerCase();
  if (k === "design") return "generate";
  if (k === "ai_edit") return "edit";
  return "enhance";
}

/** Full ancestry of a version, source last. Cycles cannot hang the walk. */
export function ancestry(version: VersionRow, all: VersionRow[]): LineageRef[] {
  const byId = new Map(all.map((v) => [v.id, v]));
  const chain: LineageRef[] = [];
  const seen = new Set<string>([version.id]);
  let cur: VersionRow | undefined = version;
  while (cur) {
    const parent = lineageOf(cur).parent;
    if (!parent) break;
    chain.push(parent);
    if (parent.kind === "asset" || seen.has(parent.id)) break;
    seen.add(parent.id);
    cur = byId.get(parent.id);
  }
  return chain;
}

/* ------------------------------------------------------------------ *
 * Deletion safety
 * ------------------------------------------------------------------ */

export type ReferenceKind =
  | "version"
  | "presentation"
  | "video"
  | "property"
  | "media"
  | "job"
  | "export";

export type Reference = { kind: ReferenceKind; id: string; detail?: string };

export const REFERENCE_MESSAGE: Record<ReferenceKind, string> = {
  version: "another saved version",
  presentation: "a shared presentation",
  video: "a video",
  property: "a property record",
  media: "your media library",
  job: "a generation still running",
  export: "an export package",
};

/**
 * Deleting is only safe when nothing points at the bytes. The caller gets the
 * reasons, in plain language, rather than a silent refusal.
 */
export function deletionVerdict(refs: Reference[]): {
  allowed: boolean;
  reasons: string[];
  message: string;
} {
  const list = refs ?? [];
  if (!list.length) return { allowed: true, reasons: [], message: "" };
  const reasons = Array.from(new Set(list.map((r) => REFERENCE_MESSAGE[r.kind])));
  return {
    allowed: false,
    reasons,
    message: `This file is still used by ${joinList(reasons)}. Remove it there first.`,
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * Orphan diagnostic (report only — nothing is deleted from here)
 * ------------------------------------------------------------------ */

export type StorageObject = { path: string; createdAt: string; size?: number | null };

export type OrphanClass = "referenced" | "recent" | "failed_artifact" | "orphan";

export type OrphanRow = {
  path: string;
  createdAt: string;
  size: number | null;
  classification: OrphanClass;
  /** Only failed artifacts and confirmed orphans are ever safe to remove. */
  safeToDelete: boolean;
};

export type OrphanReport = {
  scanned: number;
  referenced: number;
  recent: number;
  failedArtifacts: number;
  orphans: number;
  rows: OrphanRow[];
  /** This diagnostic never deletes; that is the whole point of it. */
  deleted: 0;
};

export function classifyObjects(
  objects: StorageObject[],
  referenced: Set<string>,
  failedPaths: Set<string>,
  opts?: { now?: number; graceMs?: number },
): OrphanReport {
  const now = opts?.now ?? Date.now();
  const grace = opts?.graceMs ?? 24 * 60 * 60 * 1000;
  const rows: OrphanRow[] = (objects ?? []).map((o) => {
    const age = now - (Date.parse(o.createdAt) || now);
    let classification: OrphanClass;
    if (referenced.has(o.path)) classification = "referenced";
    else if (failedPaths.has(o.path)) classification = "failed_artifact";
    else if (age < grace) classification = "recent";
    else classification = "orphan";
    return {
      path: o.path,
      createdAt: o.createdAt,
      size: o.size ?? null,
      classification,
      safeToDelete: classification === "failed_artifact" || classification === "orphan",
    };
  });
  const count = (c: OrphanClass) => rows.filter((r) => r.classification === c).length;
  return {
    scanned: rows.length,
    referenced: count("referenced"),
    recent: count("recent"),
    failedArtifacts: count("failed_artifact"),
    orphans: count("orphan"),
    rows,
    deleted: 0,
  };
}
