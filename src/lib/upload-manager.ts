/**
 * App-wide background upload manager.
 *
 * One singleton queue survives view switches inside /app, so a 200-photo
 * property shoot keeps uploading while the user works elsewhere. Files
 * themselves cannot survive a page reload, so a reloaded job is reported as
 * Interrupted with its already-uploaded photos intact — successful uploads are
 * never lost and nothing canceled is silently resumed.
 */

import { uploadRoomPhoto } from "@/lib/room-photos";
import { measureImage, classify, groupSets } from "@/lib/media-analysis";
import { createMediaAssets } from "@/lib/property-media.functions";
import { track } from "@/lib/analytics";

export type JobState =
  | "Preparing"
  | "Uploading"
  | "Processing"
  | "Organizing"
  | "Complete"
  | "Partially Complete"
  | "Failed"
  | "Canceled"
  | "Paused"
  | "Interrupted";

export type JobFile = {
  name: string;
  size: number;
  state: "queued" | "uploading" | "done" | "failed";
  error?: string | undefined;
  file?: File | undefined;
};

export type Job = {
  id: string;
  propertyId: string | null;
  propertyLabel: string;
  source: string;
  state: JobState;
  files: JobFile[];
  uploaded: number;
  failed: number;
  current: string;
  startedAt: number;
  finishedAt: number | null;
  assetIds: string[];
};

type Listener = (jobs: Job[]) => void;

const LS_KEY = "rd.upload.jobs.v1";
const CONCURRENCY = 3;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.heic,.heif";
export const MAX_FILE_MB = 15;

const jobs: Job[] = [];
const listeners = new Set<Listener>();
let paused = false;
let running = 0;
let hydrated = false;

function emit() {
  persist();
  const snapshot = jobs.map((j) => ({
    ...j,
    files: j.files.map((f) => ({ ...f, file: undefined })),
  })) as Job[];
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      /* a bad listener must not stall the queue */
    }
  });
}

function persist() {
  try {
    const slim = jobs.slice(-8).map((j) => ({
      ...j,
      files: j.files.map((f) => ({ name: f.name, size: f.size, state: f.state, error: f.error })),
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(slim));
  } catch {
    /* storage full or blocked — the queue still runs in memory */
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (!Array.isArray(raw)) return;
    for (const j of raw) {
      const active = ["Preparing", "Uploading", "Processing", "Organizing", "Paused"].includes(
        j.state,
      );
      jobs.push({
        ...j,
        state: active ? "Interrupted" : j.state,
        files: (j.files || []).map((f: JobFile) => ({
          ...f,
          state: f.state === "done" ? "done" : "failed",
        })),
      });
    }
  } catch {
    /* ignore unreadable history */
  }
}

export function subscribe(fn: Listener): () => void {
  hydrate();
  listeners.add(fn);
  fn(jobs.slice());
  return () => listeners.delete(fn);
}

export function listJobs(): Job[] {
  hydrate();
  return jobs.slice();
}

export function activeJob(): Job | null {
  return (
    jobs.find((j) =>
      ["Preparing", "Uploading", "Processing", "Organizing", "Paused"].includes(j.state),
    ) ?? null
  );
}

export function rejectReason(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  const okExt = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!ACCEPTED.includes(type) && !okExt) return "Unsupported file type";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `File over ${MAX_FILE_MB} MB`;
  if (file.size === 0) return "Empty file";
  return null;
}

export function startJob(opts: {
  files: File[];
  propertyId: string | null;
  propertyLabel: string;
  source?: string;
}): Job {
  hydrate();
  const job: Job = {
    id: crypto.randomUUID(),
    propertyId: opts.propertyId,
    propertyLabel: opts.propertyLabel || "Unsorted Uploads",
    source: opts.source || "computer",
    state: "Preparing",
    files: opts.files.map((f) => ({ name: f.name, size: f.size, state: "queued", file: f })),
    uploaded: 0,
    failed: 0,
    current: "",
    startedAt: Date.now(),
    finishedAt: null,
    assetIds: [],
  };
  jobs.push(job);
  emit();
  track("property_upload_started", { files: job.files.length, source: job.source });
  void run(job);
  return job;
}

export function pauseAll() {
  paused = true;
  jobs.forEach((j) => {
    if (j.state === "Uploading" || j.state === "Preparing") j.state = "Paused";
  });
  emit();
}

export function resumeAll() {
  paused = false;
  jobs.forEach((j) => {
    if (j.state === "Paused") {
      j.state = "Uploading";
      void run(j);
    }
  });
  emit();
}

export function cancelJob(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  job.state = "Canceled";
  job.files.forEach((f) => {
    if (f.state === "queued") f.state = "failed";
    f.file = undefined;
  });
  job.finishedAt = Date.now();
  emit();
}

export function dismissJob(id: string) {
  const i = jobs.findIndex((j) => j.id === id);
  if (i >= 0) jobs.splice(i, 1);
  emit();
}

export function retryFailed(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  const retryable = job.files.filter((f) => f.state === "failed" && f.file);
  if (!retryable.length) return;
  retryable.forEach((f) => {
    f.state = "queued";
    delete f.error;
  });
  job.failed = job.files.filter((f) => f.state === "failed").length;
  job.state = "Uploading";
  job.finishedAt = null;
  emit();
  void run(job);
}

async function run(job: Job) {
  if (job.state === "Canceled") return;
  job.state = "Uploading";
  emit();

  const pending = () => job.files.filter((f) => f.state === "queued" && f.file);
  const measured: {
    id: string;
    hash: string;
    brightness: number;
    room: string;
    outdoor: boolean;
    payload: any;
  }[] = [];

  const worker = async () => {
    for (;;) {
      if (paused || job.state === "Canceled" || job.state === "Paused") return;
      const entry = pending()[0];
      if (!entry) return;
      entry.state = "uploading";
      job.current = entry.name;
      emit();
      try {
        const file = entry.file!;
        const bad = rejectReason(file);
        if (bad) throw new Error(bad);
        const m = await measureImage(file);
        const c = classify(file.name, m);
        const path = await uploadRoomPhoto(file);
        const localId = crypto.randomUUID();
        measured.push({
          id: localId,
          hash: m.hash,
          brightness: m.brightness,
          room: c.room,
          outdoor: c.outdoor,
          payload: {
            property_id: job.propertyId,
            property_label: job.propertyLabel,
            storage_path: path,
            original_filename: file.name,
            file_type: file.type || "image/jpeg",
            file_size: file.size,
            width: m.width,
            height: m.height,
            source_type: job.source,
            room_group: c.room,
            room_confidence: c.confidence,
            flags: c.flags,
            quality: {
              brightness: m.brightness,
              contrast: m.contrast,
              blur: m.blur,
              warmth: m.warmth,
              clipped: m.clipped,
              outdoor: c.outdoor,
              hash: m.hash,
              width: m.width,
              height: m.height,
            },
          },
        });
        entry.state = "done";
        entry.file = undefined;
        job.uploaded++;
      } catch (err: any) {
        entry.state = "failed";
        entry.error = String(err?.message || err || "Upload failed");
        job.failed++;
      }
      emit();
    }
  };

  running++;
  try {
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, Math.max(1, pending().length)) }, worker),
    );
  } finally {
    running--;
  }

  if ((job.state as JobState) === "Canceled") return;
  if (paused || (job.state as JobState) === "Paused") return;

  if (measured.length) {
    job.state = "Organizing";
    emit();
    const groups = groupSets(
      measured.map((m) => ({
        id: m.id,
        hash: m.hash,
        brightness: m.brightness,
        room: m.room,
        outdoor: m.outdoor,
      })),
    );
    const rows = measured.map((m, i) => ({
      ...m.payload,
      sort_order: i,
      angle_group: groups[m.id]?.angle ?? null,
      hdr_group: groups[m.id]?.hdr ?? null,
      dup_group: groups[m.id]?.dup ?? null,
      quality: { ...m.payload.quality, angle: groups[m.id]?.angle ?? null },
      flags: [
        ...m.payload.flags,
        ...(groups[m.id]?.hdr ? ["bracket"] : []),
        ...(groups[m.id]?.dup ? ["duplicate"] : []),
      ],
    }));
    try {
      for (let i = 0; i < rows.length; i += 40) {
        const out = await createMediaAssets({ data: { assets: rows.slice(i, i + 40) } });
        job.assetIds.push(...(out as any[]).map((r) => r.id));
      }
    } catch (err: any) {
      job.state = "Partially Complete";
      job.current = String(err?.message || "Some photos could not be filed.");
      job.finishedAt = Date.now();
      emit();
      return;
    }
  }

  job.current = "";
  job.finishedAt = Date.now();
  job.state = job.failed > 0 ? (job.uploaded > 0 ? "Partially Complete" : "Failed") : "Complete";
  emit();
  track("property_upload_completed", {
    uploaded: job.uploaded,
    failed: job.failed,
    state: job.state,
  });
}

export function isBusy(): boolean {
  return running > 0;
}
