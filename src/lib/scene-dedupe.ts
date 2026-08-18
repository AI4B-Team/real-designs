/**
 * One authoritative scene collection for the video builder.
 *
 * Every ingestion boundary (property picker, uploads, designs handoff, draft
 * rehydration, "Select All") funnels through these pure helpers, so the same
 * source asset can never occupy two ordinary photo scenes in one project.
 *
 * Identity is the stable asset id when the asset came from the database, and
 * the grid key otherwise — never the URL, filename or array position, because
 * signed URLs rotate and object URLs die with the tab.
 */

export type SceneLike = {
  key?: string | null;
  asset_id?: string | null;
  version_id?: string | null;
  path?: string | null;
  scene_type?: string | null;
  [k: string]: any;
};

/** Grid keys the builder mints for real, resolvable assets. */
const ASSET_KEY = /^(u|m|o|d|sd)-/;

/**
 * Scenes that legitimately reuse one asset (a deliberate duplicate, or the
 * two halves of a Start/End pair) declare a role, and keep their own identity.
 */
export function sceneIdentity(scene: SceneLike | null | undefined): string {
  if (!scene) return "";
  const role = scene['scene_role'] || scene['duplicate_of'] ? String(scene['scene_role'] ?? scene['duplicate_of']) : "";
  const base = scene.asset_id || scene.key || scene.path || "";
  return role ? `${base}::${role}` : String(base);
}

/** Unique ids, order preserved. Equivalent to [...new Set(ids)] with blanks dropped. */
export function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Keep the first occurrence of each identity, with its settings and order. */
export function dedupeScenes<T extends SceneLike>(scenes: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of scenes || []) {
    if (!s) continue;
    const id = sceneIdentity(s);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(s);
  }
  return out;
}

/** Append only genuinely new assets; existing scenes keep order and settings. */
export function mergeScenes<T extends SceneLike>(existing: T[], incoming: T[]): T[] {
  const have = new Set((existing || []).map(sceneIdentity).filter(Boolean));
  const out = (existing || []).slice();
  for (const s of dedupeScenes(incoming || [])) {
    const id = sceneIdentity(s);
    if (id && have.has(id)) continue;
    if (id) have.add(id);
    out.push(s);
  }
  return out;
}

/**
 * The authoritative list: deduplicated, free of scenes whose asset no longer
 * exists in the grid, and ordered by the grid.
 *
 * Orphan pruning only applies to grid-keyed scenes once the grid has actually
 * loaded — scenes rehydrated from the database (keyed by their row id) are
 * never dropped just because assets are still in flight.
 */
export function reconcileScenes<T extends SceneLike>(
  scenes: T[],
  available: Array<{ key?: string | null }> = [],
  gridOrder: string[] = [],
): T[] {
  const keys = new Set((available || []).map((a) => a?.key).filter(Boolean) as string[]);
  let out = dedupeScenes(scenes || []);
  if (keys.size) {
    out = out.filter((s) => {
      const k = s?.key ? String(s.key) : "";
      if (!k || !ASSET_KEY.test(k)) return true;
      return keys.has(k);
    });
  }
  const pos = new Map((gridOrder || []).map((k, i) => [k, i] as const));
  return out
    .map((s, i) => ({ s, i }))
    .sort((a, b) =>
      (pos.get(String(a.s?.key)) ?? 1e9) - (pos.get(String(b.s?.key)) ?? 1e9) || a.i - b.i,
    )
    .map((x) => x.s);
}

/** Selection as unique asset ids: clicking a selected tile toggles it off. */
export function toggleId(selected: Iterable<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "Select All" replaces the selection; it never appends to it. */
export function selectAllIds(visibleIds: Array<string | null | undefined>): Set<string> {
  return new Set(uniqueIds(visibleIds));
}
