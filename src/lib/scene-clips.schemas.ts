import { z } from "zod";

/**
 * Client-safe input shapes for the scene-clip (AI Animate) service.
 *
 * Anything the price, the prompt or the storage path depends on is derived on
 * the server: the client may only say *which* scene and *which* animation.
 */

export const StartSceneClipInput = z.object({
  video_project_id: z.string().uuid(),
  /** Durable per-scene identity inside a project (the asset storage path/key). */
  scene_key: z.string().min(1).max(600),
  scene_id: z.string().uuid().nullable().optional(),
  animate_id: z.string().min(2).max(60),
  /** Storage path of the exact image version shown on the card. */
  source_path: z.string().min(1).max(600),
  source_version: z.enum(["original", "staged", "redesigned"]).default("original"),
  orientation: z.enum(["portrait", "landscape"]).default("landscape"),
  room_name: z.string().max(120).nullable().optional(),
  style: z.string().max(120).nullable().optional(),
  /** Client-generated key so a double click or a refresh cannot double charge. */
  idempotency_key: z.string().min(8).max(120),
});

export const ClipIdInput = z.object({ id: z.string().uuid() });

export const ProjectClipsInput = z.object({
  video_project_id: z.string().uuid(),
  reconcile: z.boolean().default(true),
});

export const SelectClipInput = z.object({
  id: z.string().uuid(),
  use: z.boolean(),
});

export type StartSceneClip = z.infer<typeof StartSceneClipInput>;
