/**
 * Durable preview photograph for every room / area choice.
 *
 * Keys match the ids in `src/lib/space-datasets.ts`. Every entry is a distinct
 * CDN asset: no icon placeholders, no shared image across room types.
 * Generated pointers are filled in by the room preview upload step.
 */

export const ROOM_PHOTOS: Record<string, string> = {};
