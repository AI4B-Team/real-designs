/**
 * One authoritative grid collection for the Video Builder.
 *
 * Scenes hydrated from the database carry their own row id as key, and their
 * source photo may come from an upload, a property, a design or the picker.
 * The asset loaders only rebuild what the *current* sources expose, so a saved
 * project could end up with selected scenes and an empty grid
 * ("8 of 0 selected"). Every saved scene is therefore adopted into
 * `available` / `gridOrder`: matched to an existing asset by storage path when
 * possible (the asset takes the scene's identity so clips, frames and
 * transitions keep pointing at the same key), otherwise reconstructed from the
 * scene record. Nothing is filtered out for a missing room type, a custom room
 * type, a missing preview or an unfamiliar source.
 */
export type AdoptAsset = Record<string, any> & { key: string; path?: string };

export function adoptSavedScenes(
  w: any,
  opts: { unsorted?: string; groupFor?: (room: string, type: string) => string } = {},
): boolean {
  if (!w) return false;
  const UNSORTED = opts.unsorted || "Unsorted";
  const groupFor = opts.groupFor || (() => UNSORTED);
  const out: AdoptAsset[] = w.available || [];
  const order: string[] = Array.isArray(w.gridOrder) ? w.gridOrder : [];
  const keys = new Set(out.map((a) => a.key));
  const inOrder = new Set(order);
  const byPath = new Map<string, AdoptAsset>();
  for (const a of out) if (a.path && !byPath.has(a.path)) byPath.set(a.path, a);
  let changed = false;
  const place = (key: string) => {
    if (key && !inOrder.has(key)) { order.push(key); inOrder.add(key); changed = true; }
  };
  for (const s of w.scenes || []) {
    if (!s || !s.key) continue;
    if (keys.has(s.key)) { place(s.key); continue; }
    const hit = s.path ? byPath.get(s.path) : null;
    if (hit) {
      /* Same photo, one card: the grid asset adopts the saved scene identity. */
      const from = hit.key;
      hit.key = s.key;
      keys.delete(from); keys.add(s.key);
      const i = order.indexOf(from);
      if (i >= 0) { order[i] = s.key; inOrder.delete(from); inOrder.add(s.key); }
      place(s.key);
      changed = true;
      continue;
    }
    const room = s.room || UNSORTED;
    const asset: AdoptAsset = {
      key: s.key,
      path: s.path || "",
      compare: s.compare || null,
      room,
      kind: s.kind || (s.scene_type === "design" ? "Design" : "Original"),
      group: groupFor(room === UNSORTED ? "" : room, ""),
      asset_id: s.asset_id || null,
      version_id: s.version_id || null,
      disclosure: s.disclosure || null,
      flags: [],
      saved: true,
    };
    out.push(asset); keys.add(asset.key); if (asset.path) byPath.set(asset.path, asset);
    place(asset.key);
    changed = true;
  }
  w.available = out;
  w.gridOrder = order;
  return changed;
}
