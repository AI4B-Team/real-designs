/**
 * Canvas → Video handoff.
 *
 * A generated version that is already in storage must never be re-uploaded to
 * become a video scene. This module builds the one handoff envelope the Video
 * builder consumes, carrying the durable path, the room and the version so the
 * builder opens on the right asset with the right context.
 */
import { setHandoff, type Handoff, type HandoffAsset } from "@/lib/handoff";
import { defaultMotionFor } from "@/lib/video-motion-presets";

export type VideoSource = {
  /** Durable storage path of the image. Blob URLs are rejected. */
  path?: string | null;
  name?: string | null;
  room?: string | null;
  space?: string | null;
  mediaId?: string | null;
  versionId?: string | null;
  propertyId?: string | null;
  propertyAddress?: string | null;
};

export type VideoHandoffResult =
  | { ok: true; handoff: Handoff; motion: string }
  | { ok: false; reason: string };

/** Why a source cannot start a video, in language the user can act on. */
export function videoHandoffIssue(src: VideoSource | null | undefined): string | null {
  if (!src) return "Choose A Photo To Start A Video.";
  const path = String(src.path || "");
  if (!path) return "This Version Has Not Finished Saving Yet.";
  if (/^blob:|^data:/i.test(path)) return "This Photo Is Not Saved Yet. Save It Before Creating A Video.";
  return null;
}

/**
 * Publish the handoff. The Video builder reads it once, pre-selects the
 * recommended camera move for the space and needs no re-upload.
 */
export function startVideoFromCanvas(src: VideoSource, origin: Handoff["origin"] = "studio"): VideoHandoffResult {
  const issue = videoHandoffIssue(src);
  if (issue) return { ok: false, reason: issue };
  const asset: HandoffAsset = {
    path: String(src.path),
    name: src.name || src.room || null,
    room: src.room || null,
    id: src.versionId || src.mediaId || null,
  };
  const handoff = setHandoff({
    target: "video",
    origin,
    propertyId: src.propertyId || null,
    propertyAddress: src.propertyAddress || null,
    assets: [asset],
  });
  if (!handoff) return { ok: false, reason: "That Photo Could Not Be Sent To The Video Builder." };
  return { ok: true, handoff, motion: defaultMotionFor(src.space || "interior") };
}
