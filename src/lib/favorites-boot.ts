/**
 * Connects the favorites store to its durable backend, once per session.
 * Kept apart from the store itself so tests can exercise the state machine
 * without a server round trip.
 */
import { configureFavorites, loadFavorites } from "@/lib/favorites";
import { listFavorites, setFavorite } from "@/lib/favorites.functions";

let booted: Promise<boolean> | null = null;

export function bootFavorites(): Promise<boolean> {
  if (booted) return booted;
  configureFavorites({
    load: () => listFavorites(),
    persist: async (ref, favorite) => {
      await setFavorite({ data: { kind: ref.kind, id: String(ref.id), favorite } });
    },
  });
  booted = loadFavorites();
  return booted;
}
