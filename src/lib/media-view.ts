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
    const cur = map.get(m.propertyId) || {
      id: m.propertyId,
      label: m.property || "Untitled Property",
      count: 0,
    };
    cur.count += 1;
    if (!cur.label && m.property) cur.label = m.property;
    map.set(m.propertyId, cur);
  });
  const list = [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return { properties: list, unassigned };
}

/** Records that belong to one property, split by the tabs the property page shows. */
export function propertyBuckets(items: any[], propertyId: string | null) {
  const mine = (items || []).filter(
    (m) => m.status !== "archived" && (m.propertyId || null) === (propertyId || null),
  );
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

/* ------------------------------------------------------------------ drafts */

export const DRAFT_TYPE_LABEL: Record<string, string> = {
  photo_staging: "Photo Staging",
  photo_redesign: "Image Design",
  property_video: "Property Video",
};

/** Which media group a draft belongs to, expressed as a normal media type. */
const DRAFT_MEDIA_TYPE: Record<string, string> = {
  photo_staging: "uploaded_image",
  photo_redesign: "generated_image",
  property_video: "generated_video",
};

const draftAssets = (d: any) => (Array.isArray(d?.assets) ? d.assets : []);

/** The room a draft is about, when every photo agrees or only one is named. */
function draftRoom(assets: any[]) {
  const names = assets.map((a: any) => a && a.room).filter(Boolean);
  if (!names.length) return null;
  const uniq = Array.from(new Set(names.map((n: any) => String(n))));
  return uniq.length === 1 ? uniq[0] : null;
}

/** One durable draft row becomes exactly one project card, never one per photo. */
export function draftRecord(d: any) {
  const assets = draftAssets(d);
  const preview =
    assets.map((a: any) => a && a.path).find((p: any) => p && !/^(blob:|data:)/i.test(p)) || "";
  const type = DRAFT_MEDIA_TYPE[d.project_type] || "uploaded_image";
  const s = d.settings && typeof d.settings === "object" ? d.settings : {};
  return {
    id: "draft_" + d.id,
    refId: d.id,
    draftId: d.id,
    draft: true,
    draftType: d.project_type,
    draftTypeLabel: DRAFT_TYPE_LABEL[d.project_type] || "Project",
    videoProjectId: d.video_project_id || null,
    type,
    status: "draft",
    title: d.title || DRAFT_TYPE_LABEL[d.project_type] || "Untitled Project",
    propertyId: d.property_id || null,
    property: d.property_address || null,
    address: d.property_address || null,
    room: draftRoom(assets),
    path: preview,
    photoCount: assets.length,
    builderStep: d.builder_step || null,
    createdAt: d.created_at || d.updated_at || null,
    updatedAt: d.updated_at || d.created_at || null,
    settings: {
      style: s.style || null,
      quality: d.quality || null,
      format: d.video_format || null,
      prompt: s.prompt || null,
    },
  };
}

/** What this record actually is, in the user's words. */
export function mediaTypeLabel(m: any) {
  if (!m) return "";
  if (m.draft) return m.draftTypeLabel || DRAFT_TYPE_LABEL[m.draftType] || "Project";
  if (m.type === "generated_video") return "Listing Video";
  if (m.type === "generated_image") return "Generated Design";
  if (m.type === "uploaded_document") return "Document";
  return "Original Upload";
}

/**
 * Fold durable drafts into the canonical records. A video draft already has a
 * `video_projects` row on screen, so it enriches that card instead of adding a
 * second one — one project, one card.
 */
export function mergeDrafts(items: any[], drafts: any[] = []) {
  const out = (items || []).slice();
  const byVideo = new Map<string, any>();
  out.forEach((m) => {
    if (m && m.type === "generated_video" && m.refId) byVideo.set(String(m.refId), m);
  });
  (drafts || []).forEach((d: any) => {
    if (!d || !d.id) return;
    if (d.status && d.status !== "draft" && d.status !== "active") return;
    const linked = d.video_project_id ? byVideo.get(String(d.video_project_id)) : null;
    if (linked) {
      linked.draft = true;
      linked.draftId = d.id;
      linked.draftType = d.project_type;
      linked.draftTypeLabel = DRAFT_TYPE_LABEL[d.project_type] || "Property Video";
      linked.builderStep = d.builder_step || linked.builderStep || null;
      linked.updatedAt = d.updated_at || linked.updatedAt || linked.createdAt;
      if (!linked.propertyId && d.property_id) linked.propertyId = d.property_id;
      return;
    }
    out.push(draftRecord(d));
  });
  return out;
}

/**
 * Render jobs that no longer have a visible project card still need to be
 * visible as processing or failed work.
 */
export function mergeRenderJobs(items: any[], jobs: any[] = []) {
  const out = (items || []).slice();
  const byVideo = new Map<string, any>();
  out.forEach((m) => {
    if (m && m.type === "generated_video" && m.refId) byVideo.set(String(m.refId), m);
  });
  (jobs || []).forEach((j: any) => {
    if (!j || !j.id) return;
    const st = String(j.status || "").toLowerCase();
    const live = st === "queued" || st === "rendering";
    if (!live && st !== "failed") return;
    const card = j.video_project_id ? byVideo.get(String(j.video_project_id)) : null;
    if (card) {
      card.status = live ? "processing" : "failed";
      card.progress = j.progress == null ? card.progress : Math.round(Number(j.progress) * 100);
      card.stage = j.stage || card.stage || (live ? "rendering" : null);
      if (!live) card.error = j.error_message || card.error || null;
      card.jobId = j.id;
      return;
    }
    out.push({
      id: "job_" + j.id,
      refId: j.video_project_id || j.id,
      jobId: j.id,
      type: "generated_video",
      status: live ? "processing" : "failed",
      title: "Video Render",
      propertyId: null,
      property: null,
      path: "",
      progress: j.progress == null ? null : Math.round(Number(j.progress) * 100),
      stage: j.stage || (live ? "rendering" : null),
      error: j.error_message || null,
      createdAt: j.created_at || null,
      settings: {},
    });
  });
  return out;
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

/** Tabs that select by media group rather than by lifecycle state. */
const TAB_GROUPS: Record<string, string[]> = {
  images: ["images", "uploads"],
  uploads: ["uploads"],
  videos: ["videos"],
};

export function matchesTab(m: any, tab: string) {
  if (!tab || tab === "all") return true;
  const groups = TAB_GROUPS[tab];
  if (groups) return groups.indexOf(typeGroup(m.type)) > -1;
  if (tab === "drafts") return m.status === "draft";
  if (tab === "processing") return m.status === "processing" || m.status === "queued";
  if (tab === "completed") return m.status === "ready" || m.status === "shared";
  if (tab === "failed") return m.status === "failed";
  if (tab === "unassigned") return !m.propertyId;
  return true;
}

export function filterMedia(items: any[], f: MediaFilter = {}) {
  const tab = f.tab || "all";
  const status = f.status || "all";
  const property = f.property || "all";
  const q = String(f.q || "")
    .trim()
    .toLowerCase();
  const fav = f.isFav || (() => false);

  let list = (items || []).filter((m) => {
    if (!matchesTab(m, tab)) return false;
    if (status !== "all" && m.status !== status) return false;
    if (status === "all" && m.status === "archived") return false;
    if (property === "none" && m.propertyId) return false;
    if (property !== "all" && property !== "none" && m.propertyId !== property) return false;
    if (f.favOnly && !fav(m.id)) return false;
    if (q) {
      const hay = [
        m.title,
        m.property,
        m.project,
        m.address,
        m.city,
        m.room,
        m.fileName,
        m.type,
        m.status,
        m.draftTypeLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  if (f.sort === "old") list = list.slice().reverse();
  else if (f.sort === "name")
    list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else if (f.sort === "prop")
    list = list
      .slice()
      .sort((a, b) => String(a.property || "zzz").localeCompare(String(b.property || "zzz")));
  return list;
}
