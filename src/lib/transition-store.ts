/**
 * Browser mirror of the durable transition rows. The database is the truth:
 * every change writes first and the map only reflects what came back.
 */
import {
  connectionKey,
  connectionsFor,
  reconcileTransitions,
  transitionDurationMs,
  type TransitionRow,
} from "@/lib/transitions";
import {
  listTransitions,
  saveTransition,
  deleteTransition,
  applyTransitions,
  pruneTransitions,
  startAiTransition,
} from "@/lib/transitions.functions";

export class TransitionStore {
  projectId: string | null = null;
  byConn = new Map<string, TransitionRow>();

  setProject(id: string | null) {
    if (this.projectId === id) return;
    this.projectId = id;
    this.byConn.clear();
  }

  get(fromKey?: string | null, toKey?: string | null): TransitionRow | null {
    if (!fromKey || !toKey) return null;
    return this.byConn.get(connectionKey(fromKey, toKey)) || null;
  }

  all(): TransitionRow[] {
    return [...this.byConn.values()];
  }

  /**
   * The project row is created lazily, after a user may already have picked
   * transitions. Adopting the new id keeps those choices and writes them out
   * instead of dropping them on the floor.
   */
  async adopt(projectId: string | null): Promise<void> {
    if (!projectId || this.projectId === projectId) return;
    if (this.projectId) {
      this.setProject(projectId);
      await this.load(projectId);
      return;
    }
    const pending = this.all();
    this.projectId = projectId;
    for (const r of pending) {
      try {
        const res: any = await saveTransition({
          data: {
            video_project_id: projectId,
            from_key: r.from_key,
            to_key: r.to_key,
            type: r.type as any,
            duration_ms: r.duration_ms,
            settings: r.settings ?? undefined,
          },
        });
        if (res?.transition) this.byConn.set(connectionKey(r.from_key, r.to_key), res.transition);
      } catch (_) {
        /* the local choice stays; the next save re-syncs it */
      }
    }
  }

  async load(projectId: string | null): Promise<void> {
    this.setProject(projectId);
    if (!projectId) return;
    try {
      const res: any = await listTransitions({ data: { video_project_id: projectId } });
      for (const r of res.transitions || [])
        this.byConn.set(connectionKey(r.from_key, r.to_key), r);
    } catch (_) {
      /* a transient read failure must never wipe configured transitions */
    }
  }

  /** Optimistic local write so the badge updates instantly, then persist. */
  async set(
    fromKey: string,
    toKey: string,
    type: string,
    durationMs?: number,
    settings?: Record<string, any>,
  ): Promise<TransitionRow> {
    const ms = transitionDurationMs(type, durationMs);
    const prev = this.get(fromKey, toKey);
    const merged = { ...(prev?.settings || {}), ...(settings || {}) };
    const local: TransitionRow = {
      ...(prev || {}),
      from_key: fromKey,
      to_key: toKey,
      type,
      duration_ms: ms,
      settings: merged,
      status: "configured",
    };
    this.byConn.set(connectionKey(fromKey, toKey), local);
    if (!this.projectId) return local;
    const res: any = await saveTransition({
      data: {
        video_project_id: this.projectId,
        from_key: fromKey,
        to_key: toKey,
        type: type as any,
        duration_ms: ms,
        settings: merged,
      },
    });
    this.byConn.set(connectionKey(fromKey, toKey), res.transition);
    return res.transition;
  }

  async clear(fromKey: string, toKey: string): Promise<void> {
    this.byConn.delete(connectionKey(fromKey, toKey));
    if (!this.projectId) return;
    await deleteTransition({
      data: { video_project_id: this.projectId, from_key: fromKey, to_key: toKey },
    });
  }

  /** Apply one style to every live connection. */
  async applyAll(
    scenes: Array<{ key: string }>,
    type: string,
    durationMs?: number,
    settings?: Record<string, any>,
  ): Promise<void> {
    const conns = connectionsFor(scenes);
    const ms = transitionDurationMs(type, durationMs);
    const st = settings || {};
    for (const c of conns) {
      this.byConn.set(c.key, {
        from_key: c.from,
        to_key: c.to,
        type,
        duration_ms: ms,
        settings: st,
        status: "configured",
      });
    }
    if (!this.projectId || !conns.length) return;
    const res: any = await applyTransitions({
      data: {
        video_project_id: this.projectId,
        connections: conns.map((c) => ({ from_key: c.from, to_key: c.to })),
        type: type as any,
        duration_ms: ms,
        settings: st,
      },
    });
    for (const r of res.transitions || []) this.byConn.set(connectionKey(r.from_key, r.to_key), r);
  }

  async removeAll(scenes: Array<{ key: string }>): Promise<void> {
    await this.applyAll(scenes, "cut", 0, { mode: "manual" });
  }

  /** After a reorder or deletion: keep configured pairs, drop stale ones. */
  async reconcile(scenes: Array<{ key: string }>): Promise<void> {
    const { keep, stale } = reconcileTransitions(scenes, this.all());
    if (!stale.length) return;
    this.byConn = new Map(keep.map((r) => [connectionKey(r.from_key, r.to_key), r]));
    if (!this.projectId) return;
    try {
      await pruneTransitions({
        data: {
          video_project_id: this.projectId,
          keep: keep.map((r) => ({ from_key: r.from_key, to_key: r.to_key })),
        },
      });
    } catch (_) {
      /* the local map is already correct; the next load re-syncs */
    }
  }

  async startAi(input: {
    fromKey: string;
    toKey: string;
    template: string;
    prompt?: string;
    seconds?: number;
    orientation?: "landscape" | "portrait";
    startPath?: string;
    endPath?: string;
  }): Promise<{ ok: boolean; reason?: string; row: TransitionRow | null }> {
    if (!this.projectId) return { ok: false, reason: "Save this project first.", row: null };
    const previous = this.get(input.fromKey, input.toKey);
    const res: any = await startAiTransition({
      data: {
        video_project_id: this.projectId,
        from_key: input.fromKey,
        to_key: input.toKey,
        type: "ai",
        template: input.template,
        prompt: input.prompt ?? "",
        seconds: input.seconds ?? 4,
        orientation: input.orientation ?? "landscape",
        start_path: input.startPath ?? "",
        end_path: input.endPath ?? "",
        duration_ms: 600,
        /* On failure the connection keeps the transition it already had. */
        settings: { previous_type: previous?.type || "auto" },
      },
    });
    if (res.transition) this.byConn.set(connectionKey(input.fromKey, input.toKey), res.transition);
    return { ok: !!res.ok, reason: res.reason, row: res.transition ?? null };
  }
}

export const transitions = new TransitionStore();
