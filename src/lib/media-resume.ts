/**
 * Turns one Media library record into the durable resume envelope its owning
 * workflow understands. Nothing here guesses a destination: the workflow type
 * is derived from what the record actually is.
 */
import type { ResumeInput, WorkflowType } from "@/lib/resume";

export type MediaLike = {
  id?: string | null;
  type?: string | null;
  draft?: boolean;
  draftType?: string | null;
  draftId?: string | null;
  status?: string | null;
  path?: string | null;
  sourcePath?: string | null;
  sourceId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
  refId?: string | null;
  roomId?: string | null;
  versionId?: string | null;
  builderStep?: string | null;
  room?: string | null;
  style?: string | null;
  settings?: Record<string, any> | null;
};

export function workflowForMedia(m: MediaLike): WorkflowType {
  const t = String(m?.draftType || "");
  if (t === "photo_staging") return "photo_staging";
  if (t === "photo_redesign") return "photo_redesign";
  if (t === "concept" || m?.type === "concept" || m?.type === "generated_concept") return "concept";
  if (t === "property_video" || String(m?.type || "").includes("video")) return "video";
  if (t === "image_edit" || m?.type === "photo_edit") return "image_edit";
  return "image_edit";
}

export function resumeInputForMedia(m: MediaLike): ResumeInput {
  const settings = (m?.settings || {}) as Record<string, any>;
  return {
    workflowType: workflowForMedia(m),
    projectDraftId: m?.draftId || null,
    propertyId: m?.propertyId || settings["propertyId"] || null,
    projectId: m?.projectId || settings["projectId"] || m?.refId || null,
    roomId: m?.roomId || settings["roomId"] || null,
    sourceAssetId: m?.sourceId || null,
    activeVersionId: m?.versionId || null,
    currentStep: m?.builderStep || null,
    sourceStoragePath: m?.sourcePath || null,
    generatedStoragePath: m?.path || null,
    prompt: settings["prompt"] || null,
    selectedStyleId: settings["styleId"] || m?.style || null,
    settings,
  };
}
