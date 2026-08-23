/**
 * Favorites: one authoritative, durable state for hearts everywhere.
 *
 * Every heart in the app (card, media drawer, detail view, More menu) reads
 * and writes this store. The UI updates optimistically, the record is written
 * to the user's account so it follows them across devices, and a failed write
 * rolls the heart back instead of lying about it. Favoriting never touches
 * the image asset itself.
 */

export type FavoriteKind = "media" | "design" | "version" | "project";

export type FavoriteRef = { kind: FavoriteKind; id: string };

export type FavoriteResult = { ok: boolean; favorite: boolean; error?: string };

export const favoriteKey = (ref: FavoriteRef) => `${ref.kind}:${String(ref.id)}`;

const state = new Set<string>();
const listeners = new Set<(keys: Set<string>) => void>();

type Persist = (ref: FavoriteRef, favorite: boolean) => Promise<void>;
type Load = () => Promise<{ kind: string; id: string }[]>;

let persist: Persist | null = null;
let load: Load | null = null;

/** Wire the durable backend. Tests inject their own. */
export function configureFavorites(opts: { persist?: Persist | null; load?: Load | null }) {
  if ("persist" in opts) persist = opts.persist || null;
  if ("load" in opts) load = opts.load || null;
}

export function resetFavorites() {
  state.clear();
  emit();
}

export function isFavorite(ref: FavoriteRef | string): boolean {
  return state.has(typeof ref === "string" ? ref : favoriteKey(ref));
}

export function favoriteIds(kind?: FavoriteKind): string[] {
  const out: string[] = [];
  state.forEach((k) => {
    const [t, ...rest] = k.split(":");
    if (!kind || t === kind) out.push(rest.join(":"));
  });
  return out;
}

export function subscribeFavorites(fn: (keys: Set<string>) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(new Set(state));
    } catch (_) {
      /* one bad listener never blocks the rest */
    }
  });
}

/** Seed from the server. Replaces the local view of the truth. */
export function setFavorites(list: { kind: string; id: string }[] | string[]) {
  state.clear();
  (list || []).forEach((f: any) => {
    if (typeof f === "string") state.add(f.includes(":") ? f : `media:${f}`);
    else if (f && f.id) state.add(`${f.kind || "media"}:${f.id}`);
  });
  emit();
}

export async function loadFavorites(): Promise<boolean> {
  if (!load) return false;
  try {
    setFavorites(await load());
    return true;
  } catch (_) {
    return false;
  }
}

/** Labels stay in lockstep with the state so a heart is never mislabeled. */
export function favoriteLabel(on: boolean): string {
  return on ? "Remove From Favorites" : "Add To Favorites";
}

export function favoriteToast(on: boolean): string {
  return on ? "Added to Favorites" : "Removed from Favorites";
}

/** The filled red heart is the "on" state; the outline heart is "off". */
export function heartHtml(ref: FavoriteRef, extraClass = ""): string {
  const on = isFavorite(ref);
  return (
    '<button type="button" class="rd-fav' +
    (on ? " on" : "") +
    (extraClass ? " " + extraClass : "") +
    '" data-fav-kind="' +
    ref.kind +
    '" data-fav-id="' +
    String(ref.id).replace(/"/g, "&quot;") +
    '" aria-pressed="' +
    (on ? "true" : "false") +
    '" aria-label="' +
    favoriteLabel(on) +
    '" title="' +
    favoriteLabel(on) +
    '"><i data-lucide="heart"></i></button>'
  );
}

/** Repaint every heart bound to this ref, wherever it lives. */
export function paintHearts(root: ParentNode | null = typeof document === "undefined" ? null : document) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[data-fav-id]").forEach((el) => {
    const kind = (el.dataset["favKind"] || "media") as FavoriteKind;
    const on = isFavorite({ kind, id: el.dataset["favId"] || "" });
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.setAttribute("aria-label", favoriteLabel(on));
    el.setAttribute("title", favoriteLabel(on));
  });
}

/**
 * Optimistic toggle. The heart flips immediately; if the durable write fails
 * the previous state is restored and the caller is told so it can offer Retry.
 */
export async function toggleFavorite(
  ref: FavoriteRef,
  opts?: { onChange?: (favorite: boolean) => void },
): Promise<FavoriteResult> {
  const key = favoriteKey(ref);
  const was = state.has(key);
  const next = !was;
  if (next) state.add(key);
  else state.delete(key);
  emit();
  opts?.onChange?.(next);
  if (!persist) return { ok: true, favorite: next };
  try {
    await persist(ref, next);
    return { ok: true, favorite: next };
  } catch (e: any) {
    if (was) state.add(key);
    else state.delete(key);
    emit();
    opts?.onChange?.(was);
    return { ok: false, favorite: was, error: e?.message || "Favorite could not be saved" };
  }
}
