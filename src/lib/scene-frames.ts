/**
 * Start / End frames — shared capability model.
 *
 * A Start/End scene begins on one frame and ends on another. The standard
 * modes are rendered deterministically in the browser renderer and cost no AI
 * credits. A genuine AI transition needs a provider that accepts BOTH a first
 * and a last frame; the configured clip provider (Veo through the Lovable AI
 * gateway `/v1/videos`) only accepts a single `input_reference` start image, so
 * AI Transition is disclosed as unavailable rather than faked with a crossfade.
 */

export const AI_TRANSITION_AVAILABLE = false;
export const AI_TRANSITION_UNAVAILABLE_REASON =
  "AI Transition needs a provider that accepts both a first and a last frame. The connected video model only accepts a start image, so this stays switched off until a compatible provider is connected.";
export const AI_TRANSITION_CREDITS = 40;

/** Deterministic transitions plus the one AI mode, in menu order. */
export const SE_TRANSITIONS: Array<[string, string, string]> = [
  ["blend", "Smooth Blend", "The start frame dissolves into the end frame."],
  ["push", "Push", "The camera pushes in as the frames change."],
  ["pull", "Pull", "The camera pulls back as the frames change."],
  ["slide_left", "Slide Left", "The end frame slides in from the right."],
  ["slide_right", "Slide Right", "The end frame slides in from the left."],
  ["match", "Match Move", "Both frames share one camera move, so the space appears to change in place."],
  ["ai", "AI Transition", "A model generates a real clip between the two frames."],
];

export const SE_CROPS: Array<[string, string]> = [
  ["center", "Center"],
  ["top", "Top"],
  ["bottom", "Bottom"],
];

export function seTransitionName(id?: string | null): string {
  const hit = SE_TRANSITIONS.find(([i]) => i === (id || "blend"));
  return hit ? hit[1] : "Smooth Blend";
}

export function isAiTransition(row?: { generation_mode?: string | null; transition_type?: string | null } | null) {
  return !!row && (row.generation_mode === "ai" || row.transition_type === "ai");
}

export type SceneFrameRow = {
  id: string;
  video_project_id: string;
  scene_key: string;
  scene_id: string | null;
  start_path: string;
  end_path: string | null;
  start_asset_id: string | null;
  end_asset_id: string | null;
  start_crop: string;
  end_crop: string;
  transition_type: string;
  transition_duration: number;
  generation_mode: string;
  provider_job_id: string | null;
  clip_id: string | null;
  status: string;
  credit_cost: number;
  disclosure: string | null;
};

/** A Start/End scene is only real once both frames exist. */
export function frameConfigured(row?: SceneFrameRow | null): boolean {
  return !!row && !!row.start_path && !!row.end_path;
}

import { listSceneFrames, saveSceneFrames, clearSceneFrames } from "@/lib/scene-frames.functions";

/**
 * Browser cache of the durable rows. Nothing important lives here: every
 * change is written to the database first and the map only mirrors it.
 */
export class SceneFrameStore {
  projectId: string | null = null;
  byKey = new Map<string, SceneFrameRow>();

  setProject(id: string | null) {
    if (this.projectId === id) return;
    this.projectId = id;
    this.byKey.clear();
  }

  get(key?: string | null): SceneFrameRow | null {
    return key ? this.byKey.get(key) || null : null;
  }

  all(): SceneFrameRow[] {
    return [...this.byKey.values()];
  }

  async load(projectId: string | null): Promise<void> {
    this.setProject(projectId);
    if (!projectId) return;
    try {
      const res: any = await listSceneFrames({ data: { video_project_id: projectId } });
      for (const r of res.frames || []) this.byKey.set(r.scene_key, r as SceneFrameRow);
    } catch (_) {
      /* a transient read failure must not wipe what the user configured */
    }
  }

  async save(input: {
    video_project_id: string;
    scene_key: string;
    scene_id?: string | null;
    start_path: string;
    end_path?: string | null;
    start_asset_id?: string | null;
    end_asset_id?: string | null;
    start_crop?: string;
    end_crop?: string;
    transition_type?: string;
    transition_duration?: number;
  }): Promise<SceneFrameRow> {
    const res: any = await saveSceneFrames({ data: input });
    this.byKey.set(res.frame.scene_key, res.frame);
    return res.frame;
  }

  async clear(scene_key: string): Promise<void> {
    if (!this.projectId) {
      this.byKey.delete(scene_key);
      return;
    }
    await clearSceneFrames({ data: { video_project_id: this.projectId, scene_key } });
    this.byKey.delete(scene_key);
  }
}

export const sceneFrames = new SceneFrameStore();
