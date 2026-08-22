/**
 * The one image-to-video handoff contract.
 *
 * Every "Create Video" button in the app — Canvas, Media, Designs, Property,
 * Photo Design, Explore, Presentation — publishes the same typed envelope and
 * the Video builder consumes exactly that envelope. Selected images travel as
 * durable storage paths, never as re-uploads and never as blob URLs, so the
 * builder always opens on the photos the user picked.
 *
 * The envelope is persisted for the session, so a navigation, a slow builder
 * boot or a refresh mid-handoff cannot silently drop the selection.
 */
import { defaultMotionFor } from "@/lib/video-motion-presets";

export type VideoHandoffSourceType =
  | "source-photo"
  | "generated-version"
  | "media-asset"
  | "property-photo";

export type VideoHandoffOrigin =
  | "canvas"
  | "media"
  | "designs"
  | "property"
  | "photo-design"
  | "explore"
  | "presentation"
  | "studio"
  | "batch"
  | "app";

export type VideoHandoffAsset = {
  assetId: string | null;
  mediaId: string | null;
  versionId: string | null;
  /** Durable storage path. Blob and data URLs are rejected. */
  storagePath: string;
  displayUrl?: string | null;
  fileName: string;
  roomId: string | null;
  roomName: string | null;
  propertyId: string | null;
  projectId: string | null;
  sortOrder: number;
  sourceType: VideoHandoffSourceType;
};

export type VideoBuilderHandoff = {
  handoffId: string;
  videoDraftId: string;
  origin: VideoHandoffOrigin;
  propertyId: string | null;
  projectId: string | null;
  roomId: string | null;
  propertyAddress: string | null;
  assets: VideoHandoffAsset[];
  requestedFormat?: "9:16" | "16:9" | "1:1";
  recommendedMotion?: string | null;
  createdAt: string;
  expiresAt: string;
};

/** Anything a surface already holds: media rows, versions, room records. */
export type LooseVideoAsset = Record<string, any>;

export type VideoHandoffInput = {
  origin?: VideoHandoffOrigin;
  propertyId?: string | null;
  projectId?: string | null;
  roomId?: string | null;
  propertyAddress?: string | null;
  assets: LooseVideoAsset[];
  requestedFormat?: "9:16" | "16:9" | "1:1";
  recommendedMotion?: string | null;
  videoDraftId?: string | null;
  /** Space hint ("interior"/"exterior") used to recommend a camera move. */
  space?: string | null;
};

const KEY = "rd.video.handoff.v2";
const TTL_MS = 30 * 60 * 1000;

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "h-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
}

function durable(path: unknown): path is string {
  return typeof path === "string" && !!path && !/^(blob:|data:)/i.test(path);
}

function pick(src: LooseVideoAsset, keys: string[]): any {
  for (const k of keys) {
    const v = src[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function sourceTypeOf(src: LooseVideoAsset): VideoHandoffSourceType {
  const raw = String(src.sourceType || src.source_type || "");
  if (
    raw === "source-photo" ||
    raw === "generated-version" ||
    raw === "media-asset" ||
    raw === "property-photo"
  )
    return raw;
  if (pick(src, ["versionId", "version_id"])) return "generated-version";
  if (pick(src, ["assetId", "asset_id", "mediaId", "media_id"])) return "media-asset";
  if (pick(src, ["propertyId", "property_id"])) return "property-photo";
  return "source-photo";
}

/**
 * Accept whatever shape a surface already has and produce canonical assets.
 * Anything without a durable storage path is dropped: it cannot become a
 * scene, and passing it on would only make the builder open empty.
 */
export function normalizeVideoAssets(
  list: LooseVideoAsset[] | null | undefined,
  fallback: { propertyId?: string | null; projectId?: string | null; roomId?: string | null } = {},
): VideoHandoffAsset[] {
  const out: VideoHandoffAsset[] = [];
  const seen = new Set<string>();
  (Array.isArray(list) ? list : []).forEach((raw, i) => {
    if (!raw) return;
    const storagePath = pick(raw, [
      "storagePath",
      "storage_path",
      "assetPath",
      "asset_path",
      "path",
      "after_path",
      "before_path",
    ]);
    if (!durable(storagePath)) return;
    /* The same stored object twice is one scene. */
    if (seen.has(storagePath)) return;
    seen.add(storagePath);
    const roomName = pick(raw, ["roomName", "room_group", "room", "room_type"]);
    const name = pick(raw, ["fileName", "file_name", "original_filename", "name", "title"]);
    out.push({
      assetId: pick(raw, ["assetId", "asset_id", "refId", "ref_id"]) || null,
      mediaId: pick(raw, ["mediaId", "media_id", "id"]) || null,
      versionId: pick(raw, ["versionId", "version_id"]) || null,
      storagePath,
      displayUrl: pick(raw, ["displayUrl", "display_url", "url", "src"]) || null,
      fileName: String(name || roomName || "Photo"),
      roomId: pick(raw, ["roomId", "room_id"]) || fallback.roomId || null,
      roomName: roomName ? String(roomName) : null,
      propertyId: pick(raw, ["propertyId", "property_id"]) || fallback.propertyId || null,
      projectId: pick(raw, ["projectId", "project_id"]) || fallback.projectId || null,
      sortOrder: Number.isFinite(raw.sortOrder)
        ? Number(raw.sortOrder)
        : Number.isFinite(raw.sort_order)
          ? Number(raw.sort_order)
          : i,
      sourceType: sourceTypeOf(raw),
    });
  });
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  return out.map((a, i) => ({ ...a, sortOrder: i }));
}

/** Build the envelope. Returns null when nothing usable was selected. */
export function makeVideoHandoff(input: VideoHandoffInput): VideoBuilderHandoff | null {
  if (!input) return null;
  const assets = normalizeVideoAssets(input.assets, {
    propertyId: input.propertyId ?? null,
    projectId: input.projectId ?? null,
    roomId: input.roomId ?? null,
  });
  if (!assets.length) return null;
  const now = Date.now();
  const first = assets[0]!;
  return {
    handoffId: uuid(),
    videoDraftId: input.videoDraftId || uuid(),
    origin: input.origin || "app",
    propertyId: input.propertyId ?? first.propertyId ?? null,
    projectId: input.projectId ?? first.projectId ?? null,
    roomId: input.roomId ?? first.roomId ?? null,
    propertyAddress: input.propertyAddress ?? null,
    assets,
    ...(input.requestedFormat ? { requestedFormat: input.requestedFormat } : {}),
    recommendedMotion: input.recommendedMotion ?? defaultMotionFor(input.space || "interior"),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
}

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

let mem: VideoBuilderHandoff | null = null;

/** Publish the envelope. Only the newest handoff lives. */
export function publishVideoHandoff(input: VideoHandoffInput): VideoBuilderHandoff | null {
  const h = makeVideoHandoff(input);
  if (!h) return null;
  mem = h;
  try {
    store()?.setItem(KEY, JSON.stringify(h));
  } catch {
    /* private mode: the in-memory copy still serves this navigation */
  }
  return h;
}

function fresh(h: VideoBuilderHandoff | null): VideoBuilderHandoff | null {
  if (!h || !Array.isArray(h.assets) || !h.assets.length) return null;
  const exp = Date.parse(h.expiresAt || "");
  if (Number.isFinite(exp) && exp < Date.now()) return null;
  return h;
}

/** Read without consuming. */
export function peekVideoHandoff(): VideoBuilderHandoff | null {
  let h = mem;
  if (!h) {
    try {
      const raw = store()?.getItem(KEY);
      h = raw ? (JSON.parse(raw) as VideoBuilderHandoff) : null;
    } catch {
      h = null;
    }
  }
  const ok = fresh(h);
  if (!ok && h) clearVideoHandoff();
  return ok;
}

/** Read once: a refresh must never re-apply the same handoff twice. */
export function consumeVideoHandoff(): VideoBuilderHandoff | null {
  const h = peekVideoHandoff();
  if (h) clearVideoHandoff();
  return h;
}

export function clearVideoHandoff() {
  mem = null;
  try {
    store()?.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}

/* ------------------------------------------------------------------ */
/* entry points                                                        */
/* ------------------------------------------------------------------ */

export type VideoSource = {
  /** Durable storage path of the image. Blob URLs are rejected. */
  path?: string | null;
  name?: string | null;
  room?: string | null;
  roomId?: string | null;
  space?: string | null;
  mediaId?: string | null;
  versionId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
  propertyAddress?: string | null;
};

export type VideoHandoffResult =
  | { ok: true; handoff: VideoBuilderHandoff; motion: string }
  | { ok: false; reason: string };

/** Why a source cannot start a video, in language the user can act on. */
export function videoHandoffIssue(src: VideoSource | null | undefined): string | null {
  if (!src) return "Choose A Photo To Start A Video.";
  const path = String(src.path || "");
  if (!path) return "This Version Has Not Finished Saving Yet.";
  if (/^blob:|^data:/i.test(path))
    return "This Photo Is Not Saved Yet. Save It Before Creating A Video.";
  return null;
}

/** Publish a single-image handoff (Canvas result, concept, media tile). */
export function startVideoFromCanvas(
  src: VideoSource,
  origin: VideoHandoffOrigin = "canvas",
): VideoHandoffResult {
  const issue = videoHandoffIssue(src);
  if (issue) return { ok: false, reason: issue };
  const handoff = publishVideoHandoff({
    origin,
    propertyId: src.propertyId || null,
    projectId: src.projectId || null,
    roomId: src.roomId || null,
    propertyAddress: src.propertyAddress || null,
    space: src.space || null,
    assets: [
      {
        storagePath: src.path,
        fileName: src.name || src.room || "Photo",
        roomName: src.room || null,
        roomId: src.roomId || null,
        versionId: src.versionId || null,
        mediaId: src.mediaId || null,
        propertyId: src.propertyId || null,
        sourceType: src.versionId ? "generated-version" : "media-asset",
      },
    ],
  });
  if (!handoff) return { ok: false, reason: "That Photo Could Not Be Sent To The Video Builder." };
  return { ok: true, handoff, motion: handoff.recommendedMotion || defaultMotionFor("interior") };
}

/**
 * The seed the Video builder consumes. Legacy fields stay for the existing
 * builder plumbing; `handoff` and `assets` are the contract.
 */
export function videoBuilderSeed(handoff: VideoBuilderHandoff, extra: Record<string, any> = {}) {
  return {
    from: handoff.origin,
    handoff,
    videoDraftId: handoff.videoDraftId,
    propertyId: handoff.propertyId,
    propertyAddress: handoff.propertyAddress,
    propertyLabel: handoff.propertyAddress,
    roomId: handoff.roomId,
    motion: handoff.recommendedMotion || null,
    assets: handoff.assets,
    ...extra,
  };
}

/**
 * Publish and open in one call. Every "Create Video" button should use this so
 * no surface can invent its own payload again.
 */
export function startVideoBuilder(
  input: VideoHandoffInput,
  extra: Record<string, any> = {},
): VideoHandoffResult {
  const handoff = publishVideoHandoff(input);
  if (!handoff)
    return {
      ok: false,
      reason: "Select At Least One Saved Photo To Create A Video.",
    };
  openVideoBuilder(handoff, extra);
  return { ok: true, handoff, motion: handoff.recommendedMotion || defaultMotionFor("interior") };
}

/** Navigate into the builder with an already published handoff. */
export function openVideoBuilder(handoff: VideoBuilderHandoff, extra: Record<string, any> = {}) {
  try {
    (window as any).__rdAllowReveal && (window as any).__rdAllowReveal();
  } catch {
    /* reveal gate is optional */
  }
  void import("@/content/rd-media-lib")
    .then((m) => m.openVideoWorkflow(videoBuilderSeed(handoff, extra)))
    .catch(() => {});
}
