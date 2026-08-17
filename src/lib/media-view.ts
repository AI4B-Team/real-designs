// Shared view-model helpers for the unified media records. Media (global) and
// the property page (contextual) both read the same canonical records, so the
// filtering and counting rules live here once instead of twice.
import { typeGroup } from "@/lib/media-library";

export type Assignable = "upload" | "video" | "presentation";

/** Which canonical row a media record maps to when it is re-assigned. */
export function assignKind(m: any): Assignable | null {
  if (!m || m.job || m.pending || !m.refId) return null;
  if (m.type === "generated_video") return "video";
  if (m.type === "uploaded_image" || m.type === "uploaded_document") return "upload";
  if (m.type === "presentation") return "presentation";
  return null; // generated designs follow their room's property
}

export const isAssignable = (m: any) => assignKind(m) !== null;

export const normalizeAddress = (s: any) =>
  String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every property that owns at least one record, plus the unassigned bucket. */
export function propertyOptions(items: any[], properties: any[] = []) {
  const map = new Map<string, { id: string; label: string; count: number }>();
  (properties || []).forEach((p: any) => {
    if (p && p.id) map.set(p.id, { id: p.id, label: p.address || "Untitled Property", count: 0 });
  });
  let unassigned = 0;
  (items || []).forEach((m) => {
    if (m.status === "archived") return;
    if (!m.propertyId) {
      unassigned += 1;
      return;
    }
    const cur = map.get(m.propertyId) || { id: m.propertyId, label: m.property || "Untitled Property", count: 0 };
    cur.count += 1;
    if (!cur.label && m.property) cur.label = m.property;
    map.set(m.propertyId, cur);
  });
  const list = [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return { properties: list, unassigned };
}

/** Records that belong to one property, split by the tabs the property page shows. */
export function propertyBuckets(items: any[], propertyId: string | null) {
  const mine = (items || []).filter((m) => m.status !== "archived" && (m.propertyId || null) === (propertyId || null));
  return {
    all: mine,
    photos: mine.filter((m) => typeGroup(m.type) === "uploads"),
    designs: mine.filter((m) => typeGroup(m.type) === "images"),
    videos: mine.filter((m) => typeGroup(m.type) === "videos"),
    drafts: mine.filter((m) => m.status === "draft"),
    failed: mine.filter((m) => m.status === "failed"),
    working: mine.filter((m) => m.status === "processing" || m.status === "queued"),
  };
}

export type MediaFilter = {
  tab?: string;
  status?: string;
  property?: string; // "all" | "none" | property id
  q?: string;
  favOnly?: boolean;
  sort?: string;
  isFav?: (id: string) => boolean;
};

export function filterMedia(items: any[], f: MediaFilter = {}) {
  const tab = f.tab || "all";
  const status = f.status || "all";
  const property = f.property || "all";
  const q = String(f.q || "").trim().toLowerCase();
  const fav = f.isFav || (() => false);

  let list = (items || []).filter((m) => {
    if (tab !== "all" && typeGroup(m.type) !== tab) return false;
    if (status !== "all" && m.status !== status) return false;
    if (status === "all" && m.status === "archived") return false;
    if (property === "none" && m.propertyId) return false;
    if (property !== "all" && property !== "none" && m.propertyId !== property) return false;
    if (f.favOnly && !fav(m.id)) return false;
    if (q) {
      const hay = [m.title, m.property, m.project, m.room, m.type, m.status].filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  if (f.sort === "old") list = list.slice().reverse();
  else if (f.sort === "name") list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else if (f.sort === "prop")
    list = list.slice().sort((a, b) => String(a.property || "zzz").localeCompare(String(b.property || "zzz")));
  return list;
}
