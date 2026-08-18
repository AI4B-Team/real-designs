// Unified media library service. One read path for every visual asset in
import { resolveProjectTitle } from "@/lib/property-address";
// REAL DESIGNS: generated design images, generated listing videos, uploaded
// source photos and documents, plus in-flight generations that have not been
// written to the database yet.
/* eslint-disable */
// @ts-nocheck
import { getPropertyTree } from "@/lib/workspace.functions";
import { listVideos } from "@/lib/reveal.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
import { listProjectDrafts } from "@/lib/drafts.functions";
import { listRenderJobs } from "@/lib/reveal.functions";
import { mergeDrafts, mergeRenderJobs } from "@/lib/media-view";
import * as UM from "@/lib/upload-manager";
import { propLabel } from "@/lib/property-label";

export type MediaType = "uploaded_image" | "uploaded_document" | "generated_image" | "generated_video";
export type MediaStatus = "draft" | "queued" | "processing" | "ready" | "failed" | "shared" | "archived";

const EVT = "rd:media-change";

/* ---------------- pending registry (survives navigation) ---------------- */

const pending = new Map<string, any>();

export function emitMediaChange() {
  try {
    window.dispatchEvent(new Event(EVT));
  } catch (_) {}
}

export function onMediaChange(fn: () => void) {
  window.addEventListener(EVT, fn);
  const off = UM.subscribe(() => fn());
  return () => {
    window.removeEventListener(EVT, fn);
    try {
      off();
    } catch (_) {}
  };
}

/** Register a generation the moment it starts so Media shows it immediately. */
export function addPendingMedia(rec: any) {
  const id = rec.id || "pending_" + Math.random().toString(36).slice(2);
  pending.set(id, {
    id,
    type: rec.type || "generated_image",
    status: rec.status || "processing",
    title: rec.title || "Untitled",
    propertyId: rec.propertyId || null,
    projectId: rec.projectId || null,
    property: rec.property || null,
    room: rec.room || null,
    thumbnailUrl: rec.thumbnailUrl || null,
    assetUrl: rec.assetUrl || null,
    progress: rec.progress == null ? null : rec.progress,
    stage: rec.stage || null,
    error: rec.error || null,
    retry: rec.retry || null,
    createdAt: rec.createdAt || new Date().toISOString(),
  });
  emitMediaChange();
  return id;
}

export function updatePendingMedia(id: string, patch: any) {
  const cur = pending.get(id);
  if (!cur) return;
  pending.set(id, { ...cur, ...patch, updatedAt: new Date().toISOString() });
  emitMediaChange();
}

export function removePendingMedia(id: string) {
  if (pending.delete(id)) emitMediaChange();
}

export function listPendingMedia() {
  return [...pending.values()];
}

try {
  (window as any).rdMedia = { addPendingMedia, updatePendingMedia, removePendingMedia, emitMediaChange };
} catch (_) {}

/* ---------------- helpers ---------------- */

const STAGE_LABEL: Record<string, string> = {
  uploading: "Uploading",
  analyzing: "Analyzing",
  generating: "Generating",
  rendering: "Rendering Video",
  finalizing: "Finalizing",
};

export function stageLabel(stage?: string | null) {
  if (!stage) return "";
  return STAGE_LABEL[String(stage).toLowerCase()] || String(stage);
}

function versionStatus(s: string | null): MediaStatus {
  const v = String(s || "draft").toLowerCase();
  if (v === "archived") return "archived";
  if (v === "draft") return "draft";
  return "ready";
}

function videoStatus(project: any, variants: any[]): MediaStatus {
  const s = String(project.status || "draft").toLowerCase();
  if (s === "archived") return "archived";
  if (s === "shared") return "shared";
  if (s === "failed") return "failed";
  const rs = variants.map((v) => String(v.render_status || "").toLowerCase());
  if (rs.some((x) => x === "failed")) return "failed";
  if (rs.some((x) => x === "queued" || x === "rendering" || x === "processing")) return "processing";
  if (rs.some((x) => x === "done" || x === "complete" || x === "ready")) return "ready";
  if (s === "ready" || s === "complete") return "ready";
  if (s === "processing" || s === "rendering") return "processing";
  if (s === "queued") return "queued";
  return "draft";
}

/* ---------------- unified read ---------------- */

export async function loadMediaLibrary() {
  const [tree, videos, assets, drafts, jobs] = await Promise.all([
    getPropertyTree().catch(() => []),
    listVideos().catch(() => ({ projects: [], variants: [], scenes: [], shares: [] })),
    listMediaAssets({ data: { property_id: null } }).catch(() => ({ assets: [], versions: [] })),
    listProjectDrafts({ data: { scope: "all", limit: 100 } }).then((r: any) => r.drafts || []).catch(() => []),
    listRenderJobs().catch(() => []),
  ]);

  const out: any[] = [];

  /* generated design images -------------------------------------------- */
  (tree || []).forEach((p: any) =>
    (p.projects || []).forEach((pr: any) =>
      (pr.rooms || []).forEach((r: any) => {
        if (!r.version_id) return;
        out.push({
          id: "ver_" + r.version_id,
          refId: r.version_id,
          roomId: r.id,
          type: "generated_image",
          status: versionStatus(r.status),
          title: r.name + (r.version_no ? " v" + r.version_no : ""),
          propertyId: p.id,
          projectId: pr.id,
          property: p.address,
          project: pr.name,
          room: r.name,
          path: r.after_path || r.before_path || "",
          sourcePath: r.before_path || null,
          createdAt: r.created_at || null,
          versions: r.versions || 1,
          settings: { style: r.style || null, grade: pr.grade || null },
          costLow: r.total_low,
          costHigh: r.total_high,
        });
      }),
    ),
  );

  /* generated listing videos ------------------------------------------- */
  const variantsBy = new Map<string, any[]>();
  (videos.variants || []).forEach((v: any) => {
    const arr = variantsBy.get(v.video_project_id) || [];
    arr.push(v);
    variantsBy.set(v.video_project_id, arr);
  });
  const scenesBy = new Map<string, any[]>();
  (videos.scenes || []).forEach((s: any) => {
    const arr = scenesBy.get(s.video_project_id) || [];
    arr.push(s);
    scenesBy.set(s.video_project_id, arr);
  });
  (videos.projects || []).forEach((p: any) => {
    const vs = variantsBy.get(p.id) || [];
    const sc = (scenesBy.get(p.id) || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const done = vs.find((v) => ["done", "complete", "ready"].includes(String(v.render_status || "").toLowerCase()));
    const dur = done?.duration || sc.reduce((n, s) => n + Number(s.duration || 0), 0);
    const shared = (videos.shares || []).some((s: any) => s.video_project_id === p.id);
    const st = videoStatus(p, vs);
    out.push({
      id: "vid_" + p.id,
      refId: p.id,
      type: "generated_video",
      status: shared && st === "ready" ? "shared" : st,
      title: resolveProjectTitle({ kind: "video", title: p.title ?? null, titleTouched: !!p.title_touched, address: p.property_address || p.property_label }),
      propertyId: p.property_id || null,
      property: p.property_label ? propLabel(p.property_label) : null,
      address: p.property_address || null,
      city: p.city || null,
      room: null,
      path: done?.thumbnail_path || sc[0]?.source_path || "",
      assetPath: done?.output_path || null,
      createdAt: p.created_at || null,
      duration: dur ? Math.round(Number(dur)) : null,
      aspect: (Array.isArray(p.formats) ? p.formats[0] : null) || done?.aspect_ratio || "9:16",
      scenes: sc,
      error: p.error_message || null,
      settings: { videoType: p.video_type, length: p.length_preset, transition: p.transition, motion: p.motion, sourceType: p.source_type, builder: (p.settings || {}).builder || null },
      progress: null,
      stage: st === "processing" ? "rendering" : null,
    });
  });

  /* uploaded source images --------------------------------------------- */
  (assets.assets || []).forEach((a: any) => {
    out.push({
      id: "ast_" + a.id,
      refId: a.id,
      type: "uploaded_image",
      status: a.hidden ? "archived" : "ready",
      title: a.original_filename || a.file_name || a.room_group || "Uploaded Photo",
      fileName: a.original_filename || a.file_name || null,
      propertyId: a.property_id || null,
      property: a.property_label ? propLabel(a.property_label) : null,
      address: a.property_label || null,
      room: a.room_group || null,
      path: a.storage_path || "",
      createdAt: a.created_at || null,
      flags: a.flags || [],
      settings: {},
    });
  });

  /* in-flight uploads --------------------------------------------------- */
  UM.listJobs()
    .filter((j) => !["Complete", "Canceled"].includes(j.state))
    .forEach((j) => {
      const total = j.files.length || 1;
      out.push({
        id: "job_" + j.id,
        refId: j.id,
        type: "uploaded_image",
        status: j.state === "Failed" ? "failed" : "processing",
        title: j.files.length + " Photo" + (j.files.length === 1 ? "" : "s") + " Uploading",
        property: j.propertyLabel ? propLabel(j.propertyLabel) : null,
        propertyId: j.propertyId || null,
        path: "",
        createdAt: new Date(j.startedAt).toISOString(),
        progress: Math.round((j.uploaded / total) * 100),
        stage: j.state === "Organizing" ? "analyzing" : "uploading",
        error: j.state === "Failed" ? "Some photos did not finish uploading." : null,
        job: j,
      });
    });

  /* pending generations -------------------------------------------------- */
  listPendingMedia().forEach((p) => out.push({
    ...p,
    refId: p.projectId || p.refId,
    path: p.thumbnailUrl || "",
    pending: true,
  }));

  /* Durable drafts and persisted render jobs: one card per project, never one
     per photo, and never a duplicate of a card that already exists. */
  const merged = mergeRenderJobs(mergeDrafts(out, drafts), jobs);

  merged.sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")),
  );
  return merged;
}

export function typeGroup(t: MediaType) {
  if (t === "generated_video") return "videos";
  if (t === "generated_image") return "images";
  return "uploads";
}
