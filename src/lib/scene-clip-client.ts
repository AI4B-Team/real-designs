/**
 * Browser-side clip store.
 *
 * The provider job lives on the server, so this is only a cache plus a poller:
 * it never decides prices, never invents statuses, and survives a refresh by
 * re-reading the project's clips instead of trusting anything in memory.
 */
import {
  startSceneClip,
  getSceneClip,
  listProjectSceneClips,
  retrySceneClip,
  cancelSceneClip,
  selectSceneClip,
  deleteSceneClip,
} from "@/lib/scene-clips.functions";
import type { ClipView } from "@/lib/scene-clip-ui";

type Clip = ClipView & { scene_key?: string | null; video_project_id?: string | null };

const POLL_MS = 7000;

export class SceneClipStore {
  projectId: string | null = null;
  byKey = new Map<string, Clip>();
  byId = new Map<string, Clip>();
  urls = new Map<string, string>();
  onChange: () => void = () => {};
  private timer: any = null;

  setProject(id: string | null) {
    if (this.projectId === id) return;
    this.projectId = id;
    this.byKey.clear();
    this.byId.clear();
    this.urls.clear();
  }

  get(key: string): Clip | null {
    return this.byKey.get(key) || null;
  }

  url(clip?: Clip | null): string | null {
    return clip ? this.urls.get(clip.id) || clip.url || null : null;
  }

  /** Newest clip wins per scene, so a regenerate replaces the old card state. */
  private absorb(clip: Clip | null | undefined, url?: string | null) {
    if (!clip) return;
    this.byId.set(clip.id, clip);
    if (url) this.urls.set(clip.id, url);
    const key = clip.scene_key || "";
    if (!key) return;
    const cur = this.byKey.get(key);
    if (!cur || cur.id === clip.id || String((clip as any).created_at || "") >= String((cur as any).created_at || ""))
      this.byKey.set(key, clip);
  }

  private active(): Clip[] {
    return [...this.byKey.values()].filter((c) => c.status === "queued" || c.status === "processing");
  }

  private schedule() {
    if (this.timer || !this.active().length) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      for (const c of this.active()) {
        try {
          const res: any = await getSceneClip({ data: { id: c.id } });
          this.absorb(res.clip, res.url);
        } catch (_) {
          /* a transient failure must not clear the card */
        }
      }
      this.onChange();
      this.schedule();
    }, POLL_MS);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Load (and reconcile) every clip of a project. Safe on every builder open. */
  async load(projectId: string | null): Promise<void> {
    this.setProject(projectId);
    if (!projectId) return;
    try {
      const res: any = await listProjectSceneClips({ data: { video_project_id: projectId, reconcile: true } });
      for (const c of res.clips || []) this.absorb(c, res.urls?.[c.id] || null);
    } catch (_) {
      return;
    }
    this.onChange();
    this.schedule();
  }

  async start(params: {
    video_project_id: string;
    scene_key: string;
    scene_id?: string | null;
    animate_id: string;
    source_path: string;
    source_version: string;
    orientation: string;
    room_name?: string | null;
    style?: string | null;
  }): Promise<Clip> {
    const idempotency_key = `${params.video_project_id}:${params.scene_key}:${params.animate_id}:${params.source_version}`;
    const res: any = await startSceneClip({ data: { ...params, idempotency_key } });
    this.absorb(res.clip, res.url);
    this.onChange();
    this.schedule();
    return res.clip;
  }

  async retry(id: string): Promise<Clip> {
    const res: any = await retrySceneClip({ data: { id } });
    this.absorb(res.clip, res.url);
    this.onChange();
    this.schedule();
    return res.clip;
  }

  async cancel(id: string): Promise<void> {
    const res: any = await cancelSceneClip({ data: { id } });
    this.absorb(res.clip);
    this.onChange();
  }

  async use(id: string, use: boolean): Promise<Clip> {
    const res: any = await selectSceneClip({ data: { id, use } });
    this.absorb(res.clip, res.url);
    this.onChange();
    return res.clip;
  }

  async remove(id: string): Promise<void> {
    await deleteSceneClip({ data: { id } });
    const clip = this.byId.get(id);
    this.byId.delete(id);
    this.urls.delete(id);
    if (clip?.scene_key && this.byKey.get(clip.scene_key)?.id === id) this.byKey.delete(clip.scene_key);
    this.onChange();
  }
}

export const sceneClips = new SceneClipStore();
