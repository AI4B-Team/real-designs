// REAL REVEAL — property video and marketing content.
// Library, create wizard, storyboard editor and share settings. Sources come
// from the property tree and media that already exist; nothing is re-uploaded.
/* eslint-disable */
// @ts-nocheck
// TODO: Stabilization section 3. Baseline under tsconfig.legacy.json: 876 errors
// (422 TS2339, 206 TS18047, 203 TS7006). Removal needs a dedicated pass that
// types the module state object first; do not blanket-suppress.
import { createIcons, icons } from "lucide";
import { toggleMusic, stopMusic, playingId, addCustomTrack, getCustomTracks, loadCustomTracks } from "@/lib/rd-music";
import { stopAvatarVoice } from "@/lib/rd-avatar-voice";
import { voiceRequest } from "@/lib/rd-voice";
import { openSocialCopy } from "@/lib/rd-social-copy";
import { myVoiceOption, openVoiceStudio, voiceStudioButton } from "@/lib/rd-voice-ui";
import { supabase } from "@/integrations/supabase/client";
import { resolvePhotoUrl, uploadRoomPhoto, roomPhotoUrl, deleteRoomPhoto } from "@/lib/room-photos";
import {
  sceneFrames,
  SE_TRANSITIONS,
  SE_CROPS,
  seTransitionName,
  frameConfigured,
  AI_TRANSITION_AVAILABLE,
  AI_TRANSITION_UNAVAILABLE_REASON,
} from "@/lib/scene-frames";
import { DraftAutosaver, newDraftId } from "@/lib/project-draft";
import { deleteProjectDraft } from "@/lib/drafts.functions";
import { getPropertyTree } from "@/lib/workspace.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
import { FLAG_LABEL, recommendations } from "@/lib/media-analysis";
import {
  UNSORTED_LABEL, arrangeRank, missingRecommendation, normalizeCategory,
  noticeSignature, resolvePhoto, thumbDataUrl,
} from "@/lib/photo-classify";
import { classifyPhotoRooms } from "@/lib/photo-classify.functions";
import { roomIcon, searchRooms } from "@/lib/staging-rooms";
import { mountSourcePicker } from "@/lib/source-picker";
import { rejectReason } from "@/lib/upload-manager";
import { runAdvanceToGrid, attachUploadAssets, initialWizardStep, hydrateSeededWizard, ensureStepInvariant, acceptVideoPhotos, runEnrichment, logVideoEvent } from "@/lib/video-upload-intake";
import { normalizeImageFile } from "@/lib/source-picker";
import {
  VIDEO_FORMATS,
  DEFAULT_FORMAT,
  formatLabel,
  getOutputFormats,
  normalizeFormats,
  QUALITY_TIERS,
  qualityTierById,
  getQualityCompatibility,
  lowestCompatibleQuality,
} from "@/lib/reveal-format";
import {
  listVideos as _listVideos,
  getVideo as _getVideo,
  saveVideo as _saveVideo,
  deleteVideo as _deleteVideo,
  duplicateVideo as _duplicateVideo,
  setVideoStatus as _setVideoStatus,
  startRender as _startRender,
  finishVariant as _finishVariant,
  listBrandKits as _listBrandKits,
  saveBrandKit as _saveBrandKit,
  saveShareLink as _saveShareLink,
  listRenderJobs as _listRenderJobs,
  updateRenderJob as _updateRenderJob,
  cancelRenderJob as _cancelRenderJob,
} from "@/lib/reveal.functions";
import { jobStatusLabel, isJobStale, renderProvider, activeRenderProvider, runsInBackground } from "@/lib/render-providers";
/* Server functions take a single { data } envelope; these thin wrappers let
   call sites keep passing plain arguments. */
const listVideos = (d) => _listVideos(d === undefined ? undefined : { data: d });
const getVideo = (d) => _getVideo(d === undefined ? undefined : { data: d });
const saveVideo = (d) => _saveVideo(d === undefined ? undefined : { data: d });
const deleteVideo = (d) => _deleteVideo(d === undefined ? undefined : { data: d });
const duplicateVideo = (d) => _duplicateVideo(d === undefined ? undefined : { data: d });
const setVideoStatus = (d) => _setVideoStatus(d === undefined ? undefined : { data: d });
const startRender = (d) => _startRender(d === undefined ? undefined : { data: d });
const finishVariant = (d) => _finishVariant(d === undefined ? undefined : { data: d });
const listBrandKits = (d) => _listBrandKits(d === undefined ? undefined : { data: d });
const saveBrandKit = (d) => _saveBrandKit(d === undefined ? undefined : { data: d });
const saveShareLink = (d) => _saveShareLink(d === undefined ? undefined : { data: d });
const listRenderJobs = (d) => _listRenderJobs(d === undefined ? undefined : { data: d });
const updateRenderJob = (d) => _updateRenderJob(d === undefined ? undefined : { data: d });
const cancelRenderJob = (d) => _cancelRenderJob(d === undefined ? undefined : { data: d });
import {
  renderReveal,
  sceneDurations,
  DISCLOSURE_LABEL,
  STANDARD_MOTIONS,
  IMMERSIVE_EFFECTS,
  EXTERIOR_EFFECTS,
  EXTERIOR_DISCLOSURE,
  IMMERSIVE_CREDITS_PER_SCENE,
  suggestLabels,
  browserRenderSupport,
  isRenderCancelled,
  RENDER_CANCELLED,
} from "@/lib/reveal-render";
import { track } from "@/lib/analytics";
import { avatarSection, bindAvatar, avatarRenderOption, avatarScript, blankAvatarConfig } from "@/lib/rd-avatar-ui";
import { getMyCredits, CREDIT_COSTS } from "@/lib/credits.functions";
import { isPlanBlocked, openUpgrade } from "@/lib/rd-upgrade";
import { lookById, lookOverlayHTML } from "@/lib/rd-vfx-looks";
import { tileById } from "@/lib/rd-vfx-tiles";
import { addressBarHtml, addressColumns, addressFieldHtml, applyAddress } from "@/lib/address-field";
import { cleanAddressText, resolveProjectTitle, sanitizeTitle, suggestVideoTitle } from "@/lib/property-address";
import { matchPropertyAddress, createPropertyFromAddress } from "@/lib/property-address.functions";
import { animateModalHtml, clipCardHtml, clipReviewHtml } from "@/lib/scene-clip-ui";
import { sceneClips } from "@/lib/scene-clip-client";
import { ANIMATE_CREDITS_PER_CLIP } from "@/lib/scene-enhancement";
import { lookCats, fxCats, looksForCat, effectTiles, fxSnap, fxRestore, fxDirty, supportsIntensity, sceneEffectCredits, applyAllPlan, needsDisclosure, intensityWord, DEFAULT_INTENSITY } from "@/lib/rd-vfx-modal";


/** True when a failed render was refused for plan/credit reasons, not a bug. */
function planBlockedMsg(p) {
  return isPlanBlocked((p && p.error_message) || "");
}

function openUpgradeFlow(p) {
  const msg = String((p && p.error_message) || "") || "Video rendering needs a paid plan.";
  openUpgrade(msg);
}

/**
 * Null when the account can pay for this render, otherwise the reason.
 * A video render is metered against the credit balance, never against the
 * free plan's daily design counter.
 */
function videoCreditBlock(cost) {
  const c = S.credits;
  if (!c || c.unavailable) return null;
  const need = cost == null ? CREDIT_COSTS.video : cost;
  if (c.plan === "free")
    return `Video Rendering Is Not Included In The Free Plan. Upgrade Or Add Credits To Render.`;
  if ((c.balance ?? 0) < need)
    return `This Render Costs ${need} Credits And Your Balance Is ${c.balance ?? 0}.`;
  return null;
}


const BUCKET = "reveal-videos";
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const goTo = (v) => { const fn = S.go || (typeof window !== "undefined" && window.__rdGo); if (fn) fn(v); else if (typeof location !== "undefined") location.hash = "#" + v; };
const paint = () => { try { createIcons({ icons }); } catch (_) {} };
const toast = (m) => { try { window.rdToast ? window.rdToast(m) : console.log(m); } catch (_) {} };

export const VIDEO_TYPES = [
  { id: "property_tour", name: "Property Tour", d: "Create a smooth tour using selected property photos and room designs." },
  { id: "before_after", name: "Before & After", d: "Show the original space transitioning into the completed design." },
  { id: "design_reveal", name: "Design Reveal", d: "Present one finished design with cinematic motion and close-up details." },
  { id: "renovation_vision", name: "Renovation Vision", d: "Show current conditions, proposed designs, major changes and estimated budget." },
  { id: "social_reel", name: "Social Reel", d: "Create a faster vertical video designed for social media." },
  { id: "client_presentation", name: "Client Presentation", d: "Create a slower, polished design presentation with project details." },
];

const FORMATS = [
  { id: "9:16", name: "Vertical 9:16", d: "Reels, TikTok and Shorts" },
  { id: "4:5", name: "Portrait 4:5", d: "Instagram and Facebook feeds" },
  { id: "1:1", name: "Square 1:1", d: "Flexible social posting" },
  { id: "16:9", name: "Landscape 16:9", d: "YouTube, websites and presentations" },
];

const LENGTHS = [
  ["quick", "Quick, About 15s"],
  ["standard", "Standard, About 30s"],
  ["full", "Full, About 60s"],
];


const MUSIC = [
  { id: "none", group: "No Music", genre: "all", name: "No Music", dur: "0:00" },
  { id: "modern", group: "Modern", genre: "pop", name: "Clean Modern", dur: "1:48" },
  { id: "luxury", group: "Luxury", genre: "classical", name: "Quiet Luxury", dur: "2:12" },
  { id: "warm", group: "Warm", genre: "indie", name: "Warm Home", dur: "1:56" },
  { id: "cinematic", group: "Cinematic", genre: "classical", name: "Cinematic Sweep", dur: "2:30" },
  { id: "upbeat", group: "Upbeat", genre: "dance", name: "Upbeat Listing", dur: "1:42" },
  { id: "minimal", group: "Minimal", genre: "indie", name: "Minimal Pulse", dur: "2:04" },
  { id: "porchlight", group: "Country", genre: "country", name: "Porch Light", dur: "2:18" },
  { id: "sunroom", group: "Pop", genre: "pop", name: "Sunroom", dur: "1:38" },
  { id: "nightdrive", group: "Dance", genre: "dance", name: "Night Drive", dur: "2:22" },
  { id: "openhouse", group: "Indie", genre: "indie", name: "Open House", dur: "1:50" },
  { id: "stringlight", group: "Classical", genre: "classical", name: "String Light", dur: "2:44" },
];

const MUSIC_GENRES = [["all", "All"], ["dance", "Dance"], ["indie", "Indie"], ["pop", "Pop"], ["classical", "Classical"], ["country", "Country"], ["mine", "My Tracks"]];

function musicList() {
  return MUSIC.concat(getCustomTracks().map((t) => ({ id: t.id, group: "My Tracks", genre: "mine", name: t.name, dur: "" })));
}

/** Browsable music library: search, genre tabs and a play button per track. */
function musicPicker(id, sel) {
  const w = S.wizard || {};
  const g = MUSIC_GENRES.some(([k]) => k === w.musicGenre) ? w.musicGenre : "all";
  const q = (w.musicQ || "").toLowerCase();
  const rows = musicList().filter((m) => (g === "all" ? true : m.genre === g) && (!q || m.name.toLowerCase().includes(q)));
  const cur = playingId();
  return `<div class="rv-music">
    <div class="rv-music-top">
      <span class="rv-music-search"><i data-lucide="search"></i><input id="rvMusicQ" value="${esc(w.musicQ || "")}" placeholder="Search Tracks"></span>
      <button type="button" class="btn btn-ghost btn-sm" data-musicup="${id}"><i data-lucide="upload"></i>Upload Audio</button>
      <input type="file" accept="audio/*" class="rv-music-file" data-musicfile="${id}" hidden>
    </div>
    <div class="rv-seg tiny">${MUSIC_GENRES.map(([k, n]) => `<button type="button" class="${g === k ? "on" : ""}" data-musicgenre="${k}">${n}</button>`).join("")}</div>
    <div class="rv-tracks">${rows.length ? rows.map((m) => {
      const on = cur === m.id;
      return `<div class="rv-track ${sel === m.id ? "on" : ""} ${on ? "playing" : ""}" data-track="${esc(m.id)}">
        <button type="button" class="icon-btn xs" data-trackplay="${esc(m.id)}" title="${on ? "Pause" : "Play"}" ${m.id === "none" ? "disabled" : ""}><i data-lucide="${on ? "pause" : "play"}"></i></button>
        <b>${esc(m.name)}</b>
        <span class="mono">${esc(m.dur || "")}</span>
        ${sel === m.id ? `<em><i data-lucide="check"></i></em>` : ""}
      </div>`;
    }).join("") : `<div class="rv-note sm">No Tracks Match That Search.</div>`}</div>
  </div>`;
}

let musicLoadedOnce = false;
function bindMusicControls(el, setTrack, getTrack) {
  if (!musicLoadedOnce) {
    musicLoadedOnce = true;
    loadCustomTracks().then((list) => { if (list.length) render(); });
  }

  el.querySelectorAll("[data-musicplay]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    const id = getTrack();
    if (!id || id === "none") return toast("Choose A Track First.");
    toggleMusic(id);
    render();
  }));
  el.querySelectorAll("[data-musicup]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    const input = el.querySelector(`[data-musicfile="${b.dataset.musicup}"]`);
    if (input) input.click();
  }));
  el.querySelectorAll("[data-musicfile]").forEach((inp) => inp.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast("Audio Files Must Be Under 20MB.");
    const t = addCustomTrack(f);
    stopMusic();
    setTrack(t.id);
    toast("Track Uploaded.");
  }));
}

const ORDER = [
  "Front Exterior", "Exterior", "Entry", "Living", "Living Areas", "Kitchen", "Dining",
  "Primary Bedroom", "Primary Bathroom", "Bedrooms", "Bathrooms", "Specialty",
  "Outdoor Areas", "Backyard", "Floor Plans", "Concepts", "Unsorted",
];

/* A photo with no confident room stays Unsorted. Quality flags such as
   "Needs Review" describe the picture, never the room, so they are never
   used as a scene name. */
export const UNSORTED = "Unsorted";
const FLAG_NAMES = /^(needs review|unclassified|unknown|other|untitled)$/i;
function roomLabelOf(name) {
  const s = String(name || "").trim();
  if (!s || FLAG_NAMES.test(s)) return UNSORTED;
  return s;
}

function groupFor(name = "", type = "") {
  const s = (name + " " + type).toLowerCase();
  if (/front|facade|exterior|curb/.test(s)) return "Exterior";
  if (/entry|foyer|hall/.test(s)) return "Entry";
  if (/living|family|great/.test(s)) return "Living Areas";
  if (/kitchen/.test(s)) return "Kitchen";
  if (/bed/.test(s)) return "Bedrooms";
  if (/bath|powder/.test(s)) return "Bathrooms";
  if (/yard|patio|deck|pool|garden|landscape/.test(s)) return "Outdoor Areas";
  if (/plan|sketch/.test(s)) return "Floor Plans";
  if (/concept/.test(s)) return "Concepts";
  return UNSORTED;
}
function orderRank(group) {
  const i = ORDER.indexOf(group);
  return i === -1 ? 90 : i;
}

/* ======================= STATE ======================= */
let S = {
  mounted: false,
  go: null,
  loading: false,
  filter: "all",
  q: "",
  projects: [],
  variants: [],
  scenes: [],
  shares: [],
  tree: [],
  kits: [],
  jobs: [],
  renderJobId: null,
  credits: null,

  screen: "library", // library | wizard | design | detail
  detailId: null,
  detailTab: "video",
  detail: null,
  wizard: null,
  dv: null,
};

function host() {
  const v = document.getElementById("v-reveal");
  return v;
}

/* ======================= DATA ======================= */
async function loadLibrary() {
  S.loading = true;
  try {
    const [lib, tree, kits, credits, jobs] = await Promise.all([
      listVideos(),
      getPropertyTree().catch(() => []),
      listBrandKits().catch(() => []),
      getMyCredits().catch(() => null),
      listRenderJobs().catch(() => []),
    ]);
    S.jobs = jobs || [];
    /* A job whose tab went away is not still running. Retire it on sight so the
       library shows the interruption and the held credits come back. */
    for (const j of S.jobs) {
      if (!isJobStale(j) || j.id === S.renderJobId) continue;
      try {
        const fixed = await updateRenderJob({
          id: j.id,
          status: "failed",
          error_message: "The render stopped when its browser tab closed. Your credits were returned.",
        });
        if (fixed) Object.assign(j, fixed);
      } catch (_) {}
    }
    S.credits = credits;
    S.projects = lib.projects;
    S.variants = lib.variants;
    S.scenes = lib.scenes;
    S.shares = lib.shares;
    S.tree = tree || [];
    S.kits = kits || [];
  } catch (e) {
    toast(e?.message || "Could not load your videos.");
  }
  S.loading = false;
}

const fmtDate = (s) => { try { return new Date(s).toLocaleDateString(); } catch (_) { return ""; } };

async function signed(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* ======================= LIBRARY ======================= */
/* Resolved thumbnail URLs are cached so re-renders paint instantly instead of
   blanking the tile while a new signed URL is fetched (visible as a flash). */
const THUMBS = new Map();

function statusOf(p) {
  return p.status === "ready" ? "Ready" : p.status === "processing" ? "Processing" : p.status === "failed" ? "Failed" : p.status === "archived" ? "Archived" : "Draft";
}

function libraryRows() {
  const q = S.q.toLowerCase().trim();
  return S.projects.filter((p) => {
    if (S.filter === "drafts" && p.status !== "draft") return false;
    if (S.filter === "processing" && p.status !== "processing") return false;
    if (S.filter === "ready" && p.status !== "ready") return false;
    if (S.filter === "shared" && !S.shares.some((s) => s.video_project_id === p.id)) return false;
    if (!q) return true;
    return [p.title, p.property_label, p.video_type].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
}

function libraryHtml() {
  const rows = libraryRows();
  const head = `<div class="rv-head">
    <div>
      <h2>Property Videos</h2>
      <p>Create polished videos and marketing content from your properties, photos and designs.</p>
    </div>
    <div class="rv-head-a">
      <button class="btn btn-primary" id="rvNew"><i data-lucide="clapperboard"></i>Create Video</button>
    </div>
  </div>
  <div class="rv-bar">
    <div class="rv-mchips">${["all", "drafts", "processing", "ready", "shared"]
      .map((f) => `<button class="rv-chip ${S.filter === f ? "on" : ""}" data-f="${f}">${f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}</button>`)
      .join("")}</div>
    <div class="rv-search"><i data-lucide="search"></i><input id="rvQ" placeholder="Search Property, Project, Room Or Title" value="${esc(S.q)}"></div>
  </div>`;

  if (!S.projects.length) {
    return head + `<div class="rv-empty">
      <i data-lucide="clapperboard"></i>
      <h3>Turn A Design Into A Video</h3>
      <p>Create a polished property tour, before-and-after reveal or social video from your existing projects.</p>
      <div class="rv-empty-a">
        <button class="btn btn-primary" id="rvNew2">Create Your First Video</button>
        <button class="btn btn-ghost" data-goto="props">Open A Property</button>
      </div>
    </div>`;
  }

  return head + `<div class="rv-list">${cardsHtml(rows)}</div>`;
}

/* Render jobs survive refreshes, so the library reads the job row rather than
   whatever the last open tab happened to remember. */
function jobFor(projectId) {
  return (S.jobs || []).find((j) => j.video_project_id === projectId) || null;
}
function renderJobBadge(projectId) {
  const j = jobFor(projectId);
  if (!j) return "";
  if (j.status === "completed" || j.status === "cancelled") return "";
  const stale = isJobStale(j);
  if (j.status === "failed" && !j.error_message) return "";
  const label = jobStatusLabel(j);
  if (!label) return "";
  const extra = stale ? "" : j.stage ? ` · ${esc(j.stage)}` : "";
  return `<span class="rv-b rv-jobb${stale || j.status === "failed" ? " bad" : ""}">${esc(label)}${extra}</span>`;
}

function cardsHtml(rows) {
  const cards = rows.map((p) => {
    const vs = S.variants.filter((v) => v.video_project_id === p.id);
    const sc = S.scenes.filter((s) => s.video_project_id === p.id);
    const dur = vs[0]?.duration || sc.reduce((a, b) => a + Number(b.duration || 0), 0);
    const shared = S.shares.some((s) => s.video_project_id === p.id);
    const type = VIDEO_TYPES.find((t) => t.id === p.video_type)?.name || "Video";
    const disc = p.disclosure?.mode ? "Disclosure Applied" : "No Disclosure";
    return `<div class="rv-card" data-id="${p.id}">
      <div class="rv-thumb" data-thumb="${p.id}"${THUMBS.get(p.id) ? ` style="background-image:url('${THUMBS.get(p.id)}')"` : ""}><i data-lucide="film"></i></div>
      <div class="rv-meta">
        <b>${esc(p.title)}</b>
        <span>${esc(p.property_label || "No Property Linked")}</span>
        <div class="rv-badges">
          <span class="rv-b">${esc((p.formats || []).join(", ") || "9:16")}</span>
          <span class="rv-b">${esc(type)}</span>
          ${dur ? `<span class="rv-b">${Math.round(dur)}s</span>` : ""}
          <span class="rv-b is-${p.status}">${statusOf(p)}</span>
          ${renderJobBadge(p.id)}
          ${shared ? `<span class="rv-b">Shared</span>` : ""}
          <span class="rv-b">${esc(disc)}</span>
          <span class="rv-b">${fmtDate(p.created_at)}</span>
        </div>
      </div>
      <div class="rv-actions">
        <button class="icon-btn" data-act="open" title="Preview"><i data-lucide="play"></i></button>
        <button class="icon-btn" data-act="edit" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="icon-btn" data-act="dupe" title="Duplicate"><i data-lucide="copy"></i></button>
        <button class="icon-btn" data-act="download" title="Download"><i data-lucide="download"></i></button>
        <button class="icon-btn" data-act="caption" title="Write Social Caption"><i data-lucide="message-square-quote"></i></button>
        <button class="icon-btn" data-act="share" title="Share"><i data-lucide="share-2"></i></button>
        <button class="icon-btn" data-act="del" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`;
  }).join("");

  return cards || `<div class="rv-note">No Videos Match That Filter.</div>`;
}

async function paintThumbs() {
  for (const p of S.projects) {
    const el = host()?.querySelector(`[data-thumb="${p.id}"]`);
    if (!el) continue;
    if (THUMBS.has(p.id)) { el.style.backgroundImage = `url("${THUMBS.get(p.id)}")`; continue; }
    const v = S.variants.find((x) => x.video_project_id === p.id && x.thumbnail_path);
    let url = null;
    if (v?.thumbnail_path) url = await signed(v.thumbnail_path);
    if (!url) {
      const s = S.scenes.filter((x) => x.video_project_id === p.id).sort((a, b) => a.sequence - b.sequence)[0];
      if (s?.source_path) url = await resolvePhotoUrl(s.source_path);
    }
    if (url) { THUMBS.set(p.id, url); el.style.backgroundImage = `url("${url}")`; }
  }
}

/* ======================= WIZARD ======================= */
function seededUploads(files, out = {}) {
  out.fails = out.fails || [];
  out.pending = out.pending || [];
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return [];
  return Array.from(files || []).flatMap((file) => {
    if (!(file instanceof File)) return [];
    const why = rejectReason(file);
    if (why) { out.fails.push({ name: file.name, why, file }); return []; }
    /* HEIC cannot be previewed by non-Safari browsers. Defer it to the same
       conversion the source picker uses, then feed it back through the
       canonical accept pipeline. Never drop it silently. */
    if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type || "")) {
      out.pending.push(file);
      return [];
    }
    return [{
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[a-z0-9]+$/i, ""),
      originalName: file.name,
      url: URL.createObjectURL(file),
      file,
    }];
  });
}

function newWizard(seed = {}) {
  const seedOut = { fails: [], pending: [] };
  const uploads = seededUploads(seed.files, seedOut);
  return {
    /* Photos always win: a wizard holding uploads never opens on Add Photos. */
    step: initialWizardStep(seed, uploads),
    uploadFails: seedOut.fails,
    seedPending: seedOut.pending,
    sourceType: uploads.length ? "upload" : seed.sourceType || (seed.versionId ? "design" : seed.propertyId ? "property" : ""),
    propertyId: seed.propertyId || null,
    propertyLabel: seed.propertyLabel || null,
    /* Only these stored photos should be selected once assets load. */
    seedPaths: Array.isArray(seed.paths) && seed.paths.length ? seed.paths.slice() : null,
    /* Finished designs handed over from Studio, used as scenes directly. */
    seedDesigns: Array.isArray(seed.designs) && seed.designs.length ? seed.designs.slice() : null,
    versionId: seed.versionId || null,
    title: seed.title || "",
    videoType: seed.videoType || "property_tour",
    available: [],
    gridOrder: [],
    scenes: [],
    /* One canonical format, chosen in Select & Order. Extra deliverables live
       in additionalFormats and never overwrite the primary. */
    primaryFormat: DEFAULT_FORMAT,
    additionalFormats: [],
    length: "standard",
    motion: "auto",
    transition: "clean",
    presentation: "music",
    music: "modern",
    volume: 0.6,
    beatSync: true,
    avatar: blankAvatarConfig(),

    narration: "none",
    script: "",
    voice: "professional",
    captions: true,
    brandKitId: S.kits.find((k) => k.is_default)?.id || null,
    branding: { outro: true, watermark: false, contact: true, cta: true, scope: "final" },
    versions: { branded: true, clean: true, disclosure: true },
    outputMode: "both",
    template: "clean",
    introTemplate: "clean",
    outroTemplate: "agent_white",
    tplScope: "intro",
    speedRamps: false,
    logoBranding: false,
    aiDisclaimer: false,
    logoModal: false,
    musicGenre: "all",
    musicQ: "",
    addrTab: "address",
    listingUrl: "",
    /* Optional property address. Never required to save a draft, and never a
       reason to invent a placeholder property. */
    address: seed.address || seed.listingAddress || (seed.propertyId || seed.versionId ? seed.propertyLabel || "" : ""),
    addressSource:
      seed.addressSource ||
      (seed.listingAddress || seed.from === "listing" ? "listing_import"
        : seed.propertyId ? "existing_property"
        : seed.versionId ? "inherited"
        : "unknown"),
    addressStructured: null,
    addressMatch: null,
    addressMatchDismissed: false,
    addressSaveState: "",
    candidates: [],
    pop: null,
    popQ: "",
    popCat: "all",
    lowModal: false,
    lowWarned: false,
    disclosureMode: "altered",
    /* Studio's Make A Video picker hands the selected files to this entry
       point. Seed them synchronously so the first Video Builder paint already
       contains the previews instead of silently discarding the handoff. */
    uploads,
    mode: "auto",
    quality: "standard",
    titles: { property: true, contact: true, custom: [] },
    busy: false,
    progress: 0,
    stage: "",
  };
}

function revokeUploadUrls(wizard) {
  for (const upload of wizard?.uploads || []) {
    if (typeof upload?.url !== "string" || !upload.url.startsWith("blob:")) continue;
    try { URL.revokeObjectURL(upload.url); } catch (_) {}
  }
}

/** Build the available asset list from what the property already holds. */
async function loadWizardAssets() {
  const w = S.wizard;
  if (!w) return;
  const out = [];
  const prop = S.tree.find((p) => p.id === w.propertyId) || null;
  if (prop) {
    w.propertyLabel = prop.address;
    if (!cleanAddressText(w.address)) applyAddress(w, prop.address, "existing_property");
    for (const pr of prop.projects || []) {
      for (const r of pr.rooms || []) {
        if (r.before_path) out.push({ key: "o-" + r.id, path: r.before_path, room: r.name, kind: "Original", group: groupFor(r.name, r.room_type), version_id: r.version_id, disclosure: null });
        if (r.after_path)
          out.push({
            key: "d-" + r.id, path: r.after_path, compare: r.before_path || null, room: r.name, kind: "Design",
            group: groupFor(r.name, r.room_type), version_id: r.version_id, disclosure: "proposed",
          });
      }
    }
    try {
      const media = await listMediaAssets({ property_id: w.propertyId });
      for (const a of media.assets || []) {
        if (a.hidden) continue;
        const room = roomLabelOf(a.room_group);
        out.push({
          key: "m-" + a.id, path: a.storage_path, room, kind: "Original",
          group: groupFor(room === UNSORTED ? "" : room, ""), asset_id: a.id, disclosure: null, recommended: !!a.recommended,
          dup: a.dup_group || null, hdr: a.hdr_group || null, flags: a.flags || [], quality: a.quality || {},
        });
      }
    } catch (_) {}
  }
  for (const u of w.uploads) out.push({ key: "u-" + u.id, path: u.url, room: u.room || UNSORTED, kind: "Original", group: UNSORTED, disclosure: null, uploaded: true, flags: [] });
  /* Designs chosen in Studio are real assets even when no property is set. */
  for (const d of w.seedDesigns || []) {
    if (!d || !d.path) continue;
    if (out.some((a) => a.path === d.path)) continue;
    out.push({
      key: "sd-" + (d.id || d.path), path: d.path, compare: d.beforePath || null,
      room: d.room || UNSORTED, kind: "Design", group: groupFor(d.room || "", ""),
      version_id: d.versionId || null, disclosure: "proposed", flags: [],
    });
  }
  w.available = out;
  /* The grid is the order. Build it in room group order; new uploads append. */
  const keep = new Set(out.map((a) => a.key));
  const prev = (w.gridOrder || []).filter((k) => keep.has(k));
  const seen = new Set(prev);
  const fresh = out.filter((a) => !seen.has(a.key));
  fresh.sort((a, b) => orderRank(a.group) - orderRank(b.group) || String(a.room || "").localeCompare(String(b.room || "")));
  w.gridOrder = prev.concat(fresh.map((a) => a.key));
  if (w.seedPaths && w.seedPaths.length) {
    const want = new Set(w.seedPaths);
    const picks = w.gridOrder
      .map((k) => out.find((a) => a.key === k))
      .filter((a) => a && want.has(a.path));
    if (picks.length) {
      w.scenes = picks.map(assetToScene);
      if (w.step < 2) w.step = 2;
    }
    w.seedPaths = null;
  }
  syncSceneOrder();
}

/* The builder is organised as six named sections in a left rail. Internally
   the wizard still tracks a step number, so every existing deep link, modal
   and shortcut keeps working. */
const WIZ_SECTIONS: Array<[string, string, string, number]> = [
  ["photos", "Add Photos", "image", 1],
  ["scenes", "Scenes", "layout-grid", 2],
  ["titles", "Titles", "type", 5],
  ["audio", "Audio", "music", 6],
  ["brand", "Brand", "palette", 4],
  ["quality", "Review", "circle-check", 7],
];
/* Each step owns the page-level title so the white workspace stays free of
   duplicated headings. */
const STEP_TITLES: Record<number, [string, string]> = {
  1: ["Add Photos", "Upload property photos or choose media you already have."],
  2: ["Select & Order Photos", "Choose what to include, then drag photos into the order viewers should see them."],
  5: ["Add Titles", "Add the text viewers will see throughout the video."],
  6: ["Choose Audio", "Choose the sound that carries the video."],
  4: ["Apply Branding", "Add your brand without overpowering the property."],
  7: ["Review & Generate", "Check the final details before creating your video."],
};

/* Step 3 folded into step 2. Old links resolving to 3 are normalised in render(). */
const FLOW = [1, 2, 5, 6, 4, 7];
function nextStep(n: number) {
  const i = FLOW.indexOf(n);
  return i < 0 || i === FLOW.length - 1 ? n : FLOW[i + 1];
}
function prevStep(n: number) {
  const i = FLOW.indexOf(n);
  return i <= 0 ? 1 : FLOW[i - 1];
}
function sectionOf(step: number) {
  if (step === 1) return "photos";
  if (step === 2 || step === 3) return "scenes";
  if (step === 5) return "titles";
  if (step === 6) return "audio";
  if (step === 4) return "brand";
  return "quality";
}
/** A section is reachable once the user has photos selected. */
function sectionReady(key: string) {
  const w = S.wizard;
  if (key === "photos") return true;
  if (key === "scenes") return (w.uploads || []).length > 0 || !!w.propertyId || !!w.versionId;
  return (w.scenes || []).length > 0;
}
function stepForSection(key: string) {
  if (key === "scenes") return 2;
  return (WIZ_SECTIONS.find((x) => x[0] === key) || [null, null, null, 1])[3];
}

const EDITOR_STEPS = [5, 6, 4];

/* ================= SHARED EDITING CANVAS =================
   One preview and one timeline for Titles, Audio, Brand and Review. Every
   control in the right panel writes to wizard state and repaints this. */
function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function activeIndex() {
  const w = S.wizard;
  const n = (w?.scenes || []).length;
  if (!n) return 0;
  const i = Math.min(Math.max(Number(w.activeIdx) || 0, 0), n - 1);
  w.activeIdx = i;
  return i;
}
function activeScene() {
  const w = S.wizard;
  return (w?.scenes || [])[activeIndex()] || null;
}
function previewBrandOn() {
  const w = S.wizard;
  if (w.previewBrand === false) return false;
  return (w.outputMode || "both") !== "unbranded";
}
function waveBars(seed) {
  let x = seed || 7;
  return Array.from({ length: 60 }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return 18 + (x % 70);
  });
}
function canvasHtml(compact = false) {
  const w = S.wizard;
  const list = w.scenes || [];
  const per = sceneDurations(list.length, w.length);
  const total = Math.round(per * list.length);
  const i = activeIndex();
  const sc = list[i] || null;
  const fmt = w.primaryFormat || DEFAULT_FORMAT;
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const t = w.titles || {};
  const d = titleDefaults();
  const openOn = i === 0 && t.property !== false;
  const closeOn = i === list.length - 1 && !!w.branding?.outro;
  const cap = w.captions && sc ? sc.caption || sc.room : "";
  const brandOn = previewBrandOn();
  const musicOn = w.music && w.music !== "none";
  const narrOn = w.narration && w.narration !== "none";
  const audioOn = musicOn || narrOn || w.avatar?.enabled;

  return `<div class="rv-cv">
    <div class="rv-cv-stage fmt-${fmt.replace(":", "x")}">
      <div class="rv-cv-img" data-img="${esc(sc?.path || "")}">
        ${sc ? "" : `<span class="rv-note sm">No Scenes Selected Yet.</span>`}
        ${(() => {
          /* The storyboard shows the real clip whenever the scene uses one. */
          const c = sc && sc.use_clip ? sceneClips.get(sc.key) : null;
          const u = c && c.status === "completed" ? sceneClips.url(c) : null;
          return u
            ? `<video class="rv-cv-clip" src="${esc(u)}" autoplay muted loop playsinline></video><span class="rv-cv-aitag">AI Clip</span>`
            : "";
        })()}
        ${brandOn && kit?.logo_path && (w.branding?.watermark || w.logoBranding) ? `<span class="rv-ov-logo" data-img="${esc(kit.logo_path)}"></span>` : ""}
        ${openOn ? `<div class="rv-ov-title pos-${esc(w.titlePos || "bottom")} f-${esc(w.titleFont || "editorial")}">
          <b>${esc(t.headline == null ? d.headline : t.headline)}</b>
          ${(t.sub == null ? "For Sale" : t.sub) ? `<span>${esc(t.sub == null ? "For Sale" : t.sub)}</span>` : ""}</div>` : ""}
        ${cap ? `<div class="rv-ov-cap">${esc(cap)}</div>` : ""}
        ${closeOn && brandOn ? `<div class="rv-ov-close">
          <b>${esc(kit?.company_name || kit?.contact_name || d.company || "Your Brand")}</b>
          ${w.branding?.cta && kit?.default_cta ? `<span>${esc(kit.default_cta)}</span>` : ""}
          ${w.branding?.contact ? `<em>${esc([d.contactPhone, d.contactEmail].filter(Boolean).join(" · "))}</em>` : ""}</div>` : ""}
        ${sc?.disclosure ? `<span class="rv-ov-disc">${esc(DISCLOSURE_LABEL[sc.disclosure] || "Digitally Altered")}</span>` : ""}
      </div>
    </div>
    <div class="rv-cv-bar">
      <button class="icon-btn sm" id="rvPrevScene" aria-label="Previous Scene" ${i > 0 ? "" : "disabled"}><i data-lucide="skip-back"></i></button>
      <button class="icon-btn sm" id="rvPlay" aria-label="${w.playing ? "Pause" : "Play"}"><i data-lucide="${w.playing ? "pause" : "play"}"></i></button>
      <button class="icon-btn sm" id="rvNextScene" aria-label="Next Scene" ${i < list.length - 1 ? "" : "disabled"}><i data-lucide="skip-forward"></i></button>
      <span class="mono sm">${fmtClock(i * per)} / ${fmtClock(total)}</span>
      <span class="rv-cv-sp"></span>
      <span class="mono sm">${esc(formatLabel(fmt))}</span>
      <label class="rv-toggle sm"><input type="checkbox" id="rvPrevBrand" ${brandOn ? "checked" : ""}><span>Branded</span></label>
    </div>
    <div class="rv-tl">${list.map((s2, n) => `<button class="rv-tl-i ${n === i ? "on" : ""}" data-tlpick="${n}" data-key="${esc(s2.key)}" draggable="true">
      <span class="rv-tl-th" data-img="${esc(s2.path)}"></span>
      <em class="mono">${n + 1}</em>
      ${(s2.caption && w.captions) || (n === 0 && openOn) ? `<i class="rv-tl-mark" data-lucide="type"></i>` : ""}
      <b>${esc(s2.room || "Scene")}</b><span class="mono">${per.toFixed(1)}s</span>
    </button>`).join("") || `<div class="rv-note sm">Add Photos To Build The Timeline.</div>`}
      <button class="rv-tl-add" id="rvTlAdd" aria-label="Add Photos"><i data-lucide="plus"></i><b>Add</b></button>
      <input type="file" id="rvTlFile" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif" hidden>
    </div>
    ${audioOn ? `<div class="rv-wave" aria-hidden="true">${waveBars(list.length + 3).map((h) => `<i style="height:${h}%"></i>`).join("")}</div>` : ""}
    <div class="rv-tl-foot">
      <span class="mono">${list.length} ${list.length === 1 ? "Scene" : "Scenes"} · ${total}s${musicOn ? " · Music" : ""}${narrOn ? " · Narration" : ""}</span>
      <button class="fb-link" data-sec="scenes">Back To Select &amp; Order</button>
    </div>
  </div>`;
}

function wizardHtml() {
  const w = S.wizard;
  const cur = sectionOf(w.step);
  const rail = `<nav class="rv-rail">${WIZ_SECTIONS
    .map(([key, name, icon]) => {
      const ok = sectionReady(key);
      return `<button class="rv-rail-i ${cur === key ? "on" : ""} ${ok ? "" : "off"}" data-sec="${key}" ${ok ? "" : "disabled"}>
        <i data-lucide="${icon}"></i><span>${name}</span>${key === "scenes" && w.scenes.length ? `<i class="rv-badge mono">${w.scenes.length}</i>` : ""}</button>`;
    })
    .join("")}</nav>`;

  let body = "";
  if (w.step === 1) body = stepPhotos();
  if (w.step === 2) body = stepSelect();
  
  if (w.step === 4) body = stepBrand();
  if (w.step === 5) body = stepTitles();
  if (w.step === 6) body = stepAudio();
  if (w.step === 7) body = stepQuality();

  const [pageTitle, pageSub] = STEP_TITLES[w.step] || STEP_TITLES[1];
  const orient = orientationOf(w);
  const headTools = w.step === 2
    ? `<div class="rv-head-tools">
        <div class="rv-orient"><span>Video Format</span>
          <div class="rv-seg">${VIDEO_FORMATS.map((f) => `<button class="${w.primaryFormat === f.id ? "on" : ""}" data-primaryfmt="${f.id}">${f.label} ${f.note}</button>`).join("")}</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="rvHeadAdd"><i data-lucide="plus"></i>Add Photos</button>
        <input type="file" id="rvHeadFile" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif" hidden>
      </div>`
    : "";


  /* Step 1 runs full width: the grid is the whole job, so the step rail
     only appears once photos are in play; the builder's own step navigation
     stays visible from Select & Order onward. */
  const wide = w.step === 1;
  const editor = EDITOR_STEPS.includes(w.step);
  /* Titles, Audio and Brand share one editing canvas: the preview and the
     scene timeline stay put and only the right-hand tools change. */
  const shell = editor
    ? `<div class="rv-layout rv-editor">
        ${rail}
        <div class="rv-canvas">${canvasHtml()}</div>
        <aside class="rv-panel">
          <div class="rv-panel-b">${body}</div>
          <div class="rv-panel-f">
            <button class="btn btn-ghost btn-sm" id="rvBack">Back</button>
            <button class="btn btn-primary btn-sm" id="rvNext">Continue</button>
          </div>
        </aside>
      </div>`
    : w.step === 7
      ? `<div class="rv-layout rv-editor rv-review">
          ${rail}
          <div class="rv-canvas">${canvasHtml(true)}${body}</div>
          <aside class="rv-panel">${previewPanel()}</aside>
        </div>`
      : `<div class="rv-layout ${wide ? "rv-wide" : "rv-railed"}">
          ${wide ? "" : rail}
          <div class="rv-wiz">${body}</div>
        </div>`;
  return `<div class="rv-head">
    <div><h2>${esc(pageTitle)}</h2><p>${esc(pageSub)}</p></div>
    ${headTools}
    <details class="rv-more rv-headmore"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
      <div class="rv-more-m">
        <button id="rvExitBuilder">Exit Builder</button>
        <button id="rvDeleteDraft" class="danger">Delete Draft</button>
      </div>
    </details>
  </div>
  ${w.step === 2 ? frameNotice() : ""}
  ${shell}

  ${w.pop ? popoverHtml() : ""}
  ${w.animate ? animateModalFor(w) : ""}
  ${w.clipReview ? clipReviewFor(w) : ""}
  ${w.roomPick ? roomPickerHtml() : ""}
  ${w.lowModal ? lowSceneModal() : ""}
  ${w.shortenModal ? shortenModalHtml() : ""}
  ${w.logoModal ? logoModalHtml() : ""}
  ${w.exitModal ? exitModalHtml() : ""}
  ${w.deleteModal ? deleteModalHtml() : ""}`;
}

/** Photo-set recommendation strip.

    This never reads a bare room label any more: it works off resolved
    classifications, so an unanalysed or low-confidence photo can no longer be
    read as proof that a space is missing. Silent while analysis runs, silent
    when analysis failed, and silent while any photo is still unresolved. */
function frameNotice() {
  const w = S.wizard;
  if (!w || !(w.available || []).length) return "";
  const photos = resolvedPhotos();
  const rec = missingRecommendation(photos, w.analysisStatus || "pending");
  if (!rec.show) return "";
  /* A dismissal only holds while the set, its labels and its selection are unchanged. */
  if (w.frameNoticeDismissed && w.frameNoticeSig === noticeSignature(photos)) return "";
  const action = rec.kind === "unselected"
    ? `<button class="btn btn-ghost btn-sm" id="rvNoticeSelect">Select Existing Photo</button>`
    : rec.kind === "missing"
      ? `<button class="btn btn-ghost btn-sm" id="rvNoticeAdd">Add Photos</button>`
      : `<button class="btn btn-ghost btn-sm" id="rvNoticeReview">Review Room Types</button>`;
  return `<div class="rv-notice">
    <i data-lucide="info"></i>
    <span><b>${esc(rec.title)}</b> ${esc(rec.message)}</span>
    ${action}
    <button class="fb-link" id="rvNoticeX">Dismiss</button>
  </div>`;
}

/** Check in the uploaded photos that satisfy an unselected recommendation. */
function selectRecommendedGap() {
  const w = S.wizard;
  if (!w) return;
  const photos = resolvedPhotos();
  const rec = missingRecommendation(photos, w.analysisStatus || "pending");
  for (const cat of rec.unselected || []) {
    const hit = photos.find((p) => p.category === cat && p.state === "confirmed" && p.selected === false);
    if (!hit) continue;
    const a = (w.available || []).find((x) => x.key === hit.id);
    if (a && !w.scenes.some((x) => x.key === a.key)) w.scenes.push(assetToScene(a));
  }
  syncSceneOrder();
}

/** Every grid photo with its manual label, AI guess and trust band applied. */
export function resolvedPhotos() {
  const w = S.wizard;
  if (!w) return [];
  const guesses = w.roomGuess || {};
  return (w.available || []).map((a) => {
    const g = guesses[a.key] || {};
    /* A label already carried by a library asset or a hand-typed rename is a
       confirmed answer; only untouched uploads wait for the classifier. */
    const manual = a.roomManual || (!a.uploaded && a.room && a.room !== UNSORTED_LABEL ? a.room : null);
    const selected = (w.scenes || []).some((x) => x.key === a.key);
    return resolvePhoto({ id: a.key, manual, label: g.label ?? null, confidence: g.confidence ?? 0, selected });
  });
}

/** Classify uploaded photos from their pixels, after the grid is already up. */
export async function classifyUploads() {
  const w = S.wizard;
  if (!w) return;
  w.roomGuess = w.roomGuess || {};
  const todo = (w.uploads || []).filter(
    (u) => u.file && !u.roomManual && !u.roomLock && !w.roomGuess["u-" + u.id],
  );
  if (!todo.length) {
    if (w.analysisStatus !== "completed") w.analysisStatus = (w.available || []).length ? "completed" : "pending";
    render();
    return;
  }
  w.analysisStatus = "running";
  render();

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    try {
      const images = [];
      for (const u of batch) {
        const image = await thumbDataUrl(u.file);
        images.push({ id: "u-" + u.id, image });
      }
      const out = await classifyPhotoRooms({ data: { images } });
      if (S.wizard !== w) return;
      for (const r of out.results || []) {
        w.roomGuess[r.id] = { label: r.label, confidence: r.confidence };
        applyGuess(r.id);
        ok++;
      }
      /* Anything the model skipped stays unresolved, never "missing". */
      for (const u of batch) if (!w.roomGuess["u-" + u.id]) failed++;
    } catch (_) {
      if (S.wizard !== w) return;
      failed += batch.length;
    }
    render();
  }
  if (S.wizard !== w) return;
  w.analysisStatus = failed === 0 ? "completed" : ok === 0 ? "failed" : "partial";
  /* Detection is metadata only. It never re-orders the grid the user is
     already looking at; Auto Arrange is the one explicit way to reorder. */
  render();
}

/** Push a confident guess onto the grid asset, the upload and any scene. */
function applyGuess(key) {
  const w = S.wizard;
  const a = (w.available || []).find((x) => x.key === key);
  /* A hand-picked room wins permanently, until detection is run again. */
  if (a && a.roomLock) return;
  const photo = resolvedPhotos().find((p) => p.id === key);
  if (!photo || photo.state === "unsorted") return;
  const label = photo.label;
  if (a) { a.room = label; a.roomState = photo.state; a.group = groupFor(label, ""); }
  const up = (w.uploads || []).find((u) => "u-" + u.id === key);
  if (up) up.room = label;
  (w.scenes || []).filter((x) => x.key === key).forEach((x) => { x.room = label; });
}

/** Write a room label chosen by hand, on the asset, its upload and its scene. */
function setRoomLabel(key, value, manual) {
  const w = S.wizard;
  if (!w) return;
  const val = String(value || "").trim() || UNSORTED;
  const known = val !== UNSORTED && val !== NEEDS_REVIEW;
  const a = (w.available || []).find((x) => x.key === key);
  if (a) {
    a.room = val;
    a.roomManual = known ? val : null;
    a.roomLock = !!manual;
    a.roomState = val === NEEDS_REVIEW ? "review" : known ? "confirmed" : "unsorted";
    a.group = groupFor(known ? val : "", "");
  }
  /* Uploads are rebuilt from w.uploads on every asset load, so the label has
     to live on the upload record to survive a reload. */
  if (String(key).startsWith("u-")) {
    const up = (w.uploads || []).find((u) => "u-" + u.id === key);
    if (up) { up.room = val; up.roomManual = known ? val : null; up.roomLock = !!manual; }
  }
  (w.scenes || []).filter((x) => x.key === key).forEach((x) => { x.room = val; });
}

/** Explicit re-run: drop every manual lock and classify the uploads again. */
function redetectRooms() {
  const w = S.wizard;
  if (!w) return;
  w.roomGuess = {};
  (w.available || []).forEach((a) => { a.roomLock = false; a.roomManual = null; });
  (w.uploads || []).forEach((u) => { u.roomLock = false; u.roomManual = null; });
  classifyUploads().catch(() => { if (S.wizard === w) { w.analysisStatus = "failed"; render(); } });
}


/* ======================= STEP 1, PHOTOS ======================= */
/** Every finished design in the workspace, newest property first. */
function designChoices() {
  const out = [];
  for (const p of S.tree || []) {
    for (const pr of p.projects || []) {
      for (const r of pr.rooms || []) {
        if (!r.after_path) continue;
        out.push({
          roomId: r.id, versionId: r.version_id, propertyId: p.id, propertyLabel: p.address,
          room: r.name || "Untitled Room", after: r.after_path, before: r.before_path || null,
        });
      }
    }
  }
  return out;
}

/* Single shared Step 1 -> Step 2 transition, used by both the automatic
   post-upload advance and the manual Continue button. Never fire-and-forget:
   a failure must leave the photos intact and the user on a usable Step 1. */
export async function advanceToGrid(w) {
  await runAdvanceToGrid(w, {
    loadAssets: loadWizardAssets,
    isCurrent: (x) => S.wizard === x,
    attachUploads: attachUploadAssets,
    selectUploads: selectUploadedScenes,
    selectRecommended,
    autoArrange,
    render,
  });
  /* Classification runs after the grid is visible, never before it. */
  classifyUploads().catch(() => { if (S.wizard === w) { w.analysisStatus = "failed"; render(); } });
}

/** Dependency set shared by every accepted-photo entry path. */
function intakeDeps() {
  return {
    rejectReason,
    createUrl: (f) => URL.createObjectURL(f),
    uuid: () => crypto.randomUUID(),
    advance: advanceToGrid,
    loadAssets: loadWizardAssets,
    isCurrent: (x) => S.wizard === x,
    attachUploads: attachUploadAssets,
    selectUploads: selectUploadedScenes,
    selectKeys: selectSceneKeys,
    autoArrange,
    render,
  };
}

const isHeicFile = (f) =>
  /\.(heic|heif)$/i.test(f?.name || "") || /image\/hei[cf]/i.test(f?.type || "");

/**
 * Canonical accept for every entry path (picker, drop, step-2 inputs, retry).
 *
 * HEIC is converted here rather than only inside the source picker, so the
 * "Add Photos" inputs on Scenes accept iPhone photos exactly like Step 1 does.
 */
export async function acceptPhotos(w, files, source) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return;
  const ready = [];
  if (list.some(isHeicFile)) {
    /* Only paint a converting state when there is something to convert. */
    w.uploadPrep = list.map((f) => ({ name: f.name }));
    render();
  }
  for (const f of list) {
    try {
      ready.push(await normalizeImageFile(f));
    } catch (_) {
      w.uploadFails = w.uploadFails || [];
      w.uploadFails.push({ name: f.name, why: "HEIC Could Not Be Converted", file: f });
    }
  }
  w.uploadPrep = [];
  if (S.wizard && S.wizard !== w) return;
  if (!ready.length) { render(); return; }
  await acceptVideoPhotos({ wizard: w, files: ready, source, deps: intakeDeps() });
  classifyUploads().catch(() => {});
  /* Photos only count as a draft once they are in private storage. */
  storeUploads(w);
}

/* ------------------------------------------------- durable builder drafts */

let wizSaver = null;

/** Push every attached upload into private storage, then autosave the draft. */
async function storeUploads(w) {
  const pending = (w.uploads || []).filter((u) => u.file && !u.storagePath && !u.storing);
  if (!pending.length) { autosaveWizard(w); return; }
  for (const u of pending) {
    u.storing = true;
    try {
      u.storagePath = await uploadRoomPhoto(u.file);
      /* First photo safely stored: the draft row exists from here on. */
      autosaveWizard(w);
    } catch (_) {
      u.storeFailed = true;
    }
    u.storing = false;
  }
  autosaveWizard(w);
}

function wizardDraftBody(w) {
  return {
    project: {
      id: w.editingId || undefined,
      property_id: w.propertyId || null,
      property_label: w.propertyLabel || null,
      ...addressColumns(w),
      title_touched: !!w.titleTouched,
      design_version_id: w.versionId || null,
      title: sanitizeTitle(defaultTitle(w)),
      video_type: w.videoType,
      source_type: w.sourceType || "property",
      status: "draft",
      formats: outputFormats(w),
      length_preset: w.length,
      transition: w.transition,
      motion: w.motion,
      brand_kit_id: w.brandKitId || null,
      branding: w.branding,
      disclosure: { mode: w.disclosureMode },
      builder_step: String(w.step || 1),
      settings: {
        quality: w.quality || "standard",
        primaryFormat: w.primaryFormat || DEFAULT_FORMAT,
        additionalFormats: w.additionalFormats || [],
        mode: w.mode || "auto",
        titles: w.titles || null,
      },
      draft_state: {
        step: w.step,
        gridOrder: w.gridOrder || [],
        uploads: (w.uploads || [])
          .filter((u) => u.storagePath)
          .map((u) => ({ id: u.id, name: u.name, path: u.storagePath, room: u.room || null, room_source: u.roomSource || "ai" })),
        scenes: (w.scenes || []).map((sc) => ({
          key: sc.key, path: sc.path, compare: sc.compare || null, room: sc.room, kind: sc.kind,
          scene_type: sc.scene_type, duration: sc.duration, motion: sc.motion, crop: sc.crop || null,
          caption: sc.caption || null, disclosure: sc.disclosure || null, motion_level: sc.motion_level || "standard",
          immersive_effect: sc.immersive_effect || null, exterior_effect: sc.exterior_effect || null,
          labels: sc.labels || [], asset_id: sc.asset_id || null, version_id: sc.version_id || null,
          clip_id: sc.clip_id || null, use_clip: !!sc.use_clip, animate_id: sc.animate_id || null,
          enhancement_level: sc.enhancement_level || null, clip_seconds: sc.clip_seconds || null,
        })),
        titles: w.titles || null,
        audio: { presentation: w.presentation, music: w.music, volume: w.volume, beatSync: w.beatSync, narration: w.narration, script: w.script, voice: w.voice, captions: w.captions },
        branding: w.branding,
        quality: w.quality || "standard",
        format: w.primaryFormat || DEFAULT_FORMAT,
      },
    },
  };
}

function ensureWizSaver(w) {
  if (wizSaver) return wizSaver;
  wizSaver = new DraftAutosaver(w.draftKey || (w.draftKey = newDraftId()), {
    debounceMs: 900,
    save: async (payload) => {
      const body = payload.body;
      /* Resolve the id at write time so a save queued before the first insert
         finished can never create a second project. */
      if (w.editingId) body.project.id = w.editingId;
      else delete body.project.id;
      const saved = await saveVideo(body);
      w.editingId = saved.id;
      rememberActiveBuilder(saved.id);
      return saved;
    },
    onState: (state) => {
      w.saveState = state;
      const el = document.getElementById("rvSaveState");
      if (el) el.textContent = { saving: "Saving…", saved: "Saved", error: "Couldn't Save" }[state] || "";
    },
  });
  return wizSaver;
}

/** Autosave meaningful builder changes. Safe to call from render(). */
export function autosaveWizard(w) {
  if (!w || w.busy) return;
  const hasWork = (w.uploads || []).some((u) => u.storagePath) || (w.scenes || []).length > 0 || !!w.editingId;
  if (!hasWork) return;
  ensureWizSaver(w).queue({ id: w.draftKey, project_type: "property_video", body: wizardDraftBody(w) });
}

export function stopWizardAutosave() {
  if (!wizSaver) return;
  void wizSaver.flush();
  wizSaver.destroy();
  wizSaver = null;
}


/** Seeded HEIC files: convert with the shared picker rules, then accept. */
async function drainSeedPending(w) {
  const pending = (w.seedPending || []).splice(0);
  if (!pending.length) return;
  const ready = [];
  for (const f of pending) {
    try { ready.push(await normalizeImageFile(f)); }
    catch (err) {
      w.uploadFails = w.uploadFails || [];
      w.uploadFails.push({ name: f.name, why: "HEIC Could Not Be Converted", file: f });
    }
  }
  if (S.wizard !== w) return;
  if (ready.length) await acceptPhotos(w, ready, "seed_heic");
  else render();
}

/** Uploaded photos are the user's explicit choice: select them by default. */
function selectUploadedScenes(w) {
  if (!w) return;
  const ups = (w.gridOrder || [])
    .map((k) => (w.available || []).find((a) => a.key === k))
    .filter((a) => a && a.uploaded);
  if (ups.length) {
    w.scenes = ups.map(assetToScene);
    syncSceneOrder();
    return;
  }
  selectRecommended();
}

/** Add just-added photos to the selection without disturbing existing scenes. */
function selectSceneKeys(w, keys) {
  if (!w || !keys?.length) return;
  const have = new Set((w.scenes || []).map((s) => s.key));
  const add = keys
    .filter((k) => !have.has(k))
    .map((k) => (w.available || []).find((a) => a.key === k))
    .filter(Boolean)
    .map(assetToScene);
  if (!add.length) return;
  w.scenes = (w.scenes || []).concat(add);
  syncSceneOrder();
}




/* ---------- Property address (optional, autosaved) ---------- */
let addrTimer = null;

function addrDraftPayload(w) {
  return {
    id: w.editingId || undefined,
    property_id: w.propertyId || null,
    property_label: w.propertyLabel || null,
    ...addressColumns(w),
    title_touched: !!w.titleTouched,
    design_version_id: w.versionId || null,
    title: sanitizeTitle(defaultTitle(w)),
    video_type: w.videoType,
    source_type: w.sourceType || "upload",
    status: "draft",
    formats: outputFormats(w),
    length_preset: w.length,
    transition: w.transition,
    motion: w.motion,
    brand_kit_id: w.brandKitId || null,
    branding: w.branding,
    disclosure: { mode: w.disclosureMode },
    settings: { quality: w.quality || "standard", primaryFormat: w.primaryFormat || DEFAULT_FORMAT, additionalFormats: w.additionalFormats || [] },
  };
}

/** Address edits ride the shared draft autosave. No success toast per edit. */
async function autosaveAddress(w) {
  if (!w.editingId && !(w.scenes || []).length) { w.addressSaveState = ""; return; }
  w.addressSaveState = "saving";
  paintSaveState(w);
  try {
    const saved = await saveVideo({ project: addrDraftPayload(w) });
    if (saved?.id) w.editingId = saved.id;
    w.addressSaveState = "saved";
  } catch (_) {
    w.addressSaveState = "error";
  }
  paintSaveState(w);
}

function paintSaveState(w) {
  if (S.wizard !== w) return;
  document.querySelectorAll(".rv-save").forEach((n) => n.remove());
  const host = document.querySelector(".rd-addr-bar") || document.querySelector(".rd-addrf");
  if (!host) return;
  const span = document.createElement("span");
  span.className = "rv-save mono" + (w.addressSaveState === "saved" ? " ok" : w.addressSaveState === "error" ? " bad" : "");
  span.textContent = w.addressSaveState === "saving" ? "Saving\u2026" : w.addressSaveState === "saved" ? "Saved" : w.addressSaveState === "error" ? "Couldn\u2019t Save \u2014 Retry" : "";
  if (!span.textContent) return;
  if (w.addressSaveState === "error") span.onclick = () => autosaveAddress(w);
  host.appendChild(span);
}

async function lookupAddressMatch(w) {
  const text = cleanAddressText(w.address);
  if (text.length < 8 || w.propertyId) { w.addressMatch = null; return; }
  try {
    const res = await matchPropertyAddress({ data: { address: text } });
    if (S.wizard !== w) return;
    w.addressMatch = res?.match || null;
    if (w.addressMatch) render();
  } catch (_) {}
}

function bindAddressInputs(el, w) {
  el.querySelectorAll("#rvAddr, #rvAddrBar").forEach((input) => {
    input.addEventListener("input", (ev) => {
      applyAddress(w, ev.target.value, "manual");
      w.addressMatchDismissed = false;
      /* Keep the sibling copy of the field in sync without a full repaint. */
      el.querySelectorAll("#rvAddr, #rvAddrBar").forEach((other) => { if (other !== input) other.value = w.address; });
      const t = el.querySelector("#rvTitle");
      if (t && !w.titleTouched) t.value = defaultTitle(w);
      clearTimeout(addrTimer);
      addrTimer = setTimeout(() => { autosaveAddress(w); lookupAddressMatch(w); }, 900);
    });
  });
  el.querySelectorAll("[data-addr-use]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.addrUse;
    w.propertyId = id;
    w.propertyLabel = w.addressMatch?.address || w.address;
    w.address = w.addressMatch?.address || w.address;
    applyAddress(w, w.address, "existing_property");
    w.addressMatch = null;
    render();
    autosaveAddress(w);
  }));
  el.querySelectorAll("[data-addr-sep]").forEach((b) => (b.onclick = () => {
    /* Keep Separate preserves the typed address as project metadata only. */
    w.addressMatchDismissed = true;
    w.propertyId = null;
    render();
    autosaveAddress(w);
  }));
  el.querySelectorAll("[data-addr-retry]").forEach((b) => (b.onclick = () => autosaveAddress(w)));
}

/* Title and address are independent. The title only follows the address while
   the user has not typed one of their own (titleTouched). */

function defaultTitle(w) {
  return resolveProjectTitle({
    kind: "video",
    title: w.title ?? null,
    titleTouched: !!w.titleTouched,
    address: w.address || w.propertyLabel,
  });
}

/** The address-based suggestion, when it differs from the current title. */
function titleSuggestion(w) {
  const s = suggestVideoTitle(w.address || w.propertyLabel);
  if (!s) return "";
  return sanitizeTitle(defaultTitle(w)) === s ? "" : s;
}

function titleFieldHtml(w, opts = {}) {
  const sug = titleSuggestion(w);
  const label = opts.label || "Video Title";
  return `<label class="rv-f">${esc(label)}<input id="rvTitle" maxlength="160" placeholder="Untitled Video" value="${esc(defaultTitle(w))}"></label>
  ${sug ? `<div class="rv-note rv-sugt">Suggested: ${esc(sug)} <button class="fb-link" data-usetitle="1">Use Suggested Title</button></div>` : ""}`;
}

/* Step 1 is the shared source picker, mounted after render. Nothing about
   uploading, dropping, cloud links or address lookup lives in this file. */
function stepPhotos() {
  const w = S.wizard;
  const chosen = w.propertyId ? (S.tree.find((p) => p.id === w.propertyId)?.address || w.propertyLabel) : "";
  const failed = w.uploadFails || [];
  return `${titleFieldHtml(w)}
  ${addressFieldHtml(w, S.tree || [], { id: "rvAddr" })}

  <div id="rvPicker"></div>
  ${chosen ? `<div class="rv-note">Using ${esc(chosen)}.</div>` : ""}
  ${w.uploadPrep && w.uploadPrep.length ? `<div class="rv-prep">${w.uploadPrep
    .map((f) => `<div class="rv-prep-r"><span>${esc(f.name)}</span><i class="rv-prep-bar"><em style="width:${f.pct}%"></em></i></div>`)
    .join("")}</div>` : ""}
  ${w.uploads.length ? `<div class="rv-added"><i data-lucide="check"></i>${w.uploads.length} ${w.uploads.length === 1 ? "photo" : "photos"} added</div>` : ""}
  ${w.uploadError ? `<div class="rv-fails"><div class="rv-fail-r"><i data-lucide="triangle-alert"></i><span>${esc(w.uploadError)}</span></div></div>` : ""}
  ${failed.length ? `<div class="rv-fails">${failed
    .map((f, i) => `<div class="rv-fail-r"><i data-lucide="triangle-alert"></i><span>${esc(f.name)}</span><em>${esc(f.why)}</em>
      <button class="fb-link" data-failretry="${i}">Retry</button><button class="fb-link" data-failrm="${i}">Remove</button></div>`)
    .join("")}</div>` : ""}
  <div class="rv-foot"><button class="btn btn-primary" id="rvNext" ${stepReady() ? "" : "disabled"}>Continue</button></div>`;
}

/* The preview panel renders its own Continue, so readiness lives in one place
   and both buttons stay in sync. */
function stepReady() {
  const w = S.wizard;
  if (!w) return false;
  if (w.step === 1) return (w.uploads || []).length > 0 || !!w.versionId || !!w.propertyId;
  if (w.step === 2) return w.scenes.length > 0;
  if (w.step === 7) return qualityCompat(w).compatible;
  return true;
}


/* ======================= STEP 2, THE PHOTO GRID ======================= */
/** Analysis-shaped view of the wizard's available photos. */
function analysisAssets() {
  return (S.wizard?.available || []).map((a) => ({
    id: a.key,
    room_group: a.room,
    room_confidence: 1,
    flags: a.flags || [],
    hdr_group: a.hdr || null,
    dup_group: a.dup || null,
    quality: a.quality || {},
    hidden: false,
  }));
}

export const NEEDS_REVIEW = "Needs Review";

/** Room type is metadata under the photo: an icon, the label, one click to change. */
function roomCell(a) {
  const label = a.room || UNSORTED;
  const unknown = !label || label === UNSORTED || label === NEEDS_REVIEW;
  return `<button class="rv-room ${unknown ? "muted" : ""} ${a.roomManual ? "set" : ""}"
    data-roompick="${esc(a.key)}" title="Click To Change Room Type">
    <i data-lucide="${esc(roomIcon(unknown ? "" : label))}"></i>
    <span>${esc(label)}</span>
    <em data-lucide="chevron-down"></em>
  </button>`;
}

/** Compact searchable room selector, anchored over the grid. */
function roomPickerHtml() {
  const w = S.wizard;
  const key = w.roomPick?.key;
  const a = (w.available || []).find((x) => x.key === key);
  if (!a) return "";
  const q = w.roomPickQ || "";
  const found = searchRooms(q);
  const cur = a.room || UNSORTED;
  const custom = q.trim() && !found.some((r) => r.label.toLowerCase() === q.trim().toLowerCase());
  return `<div class="rv-modal on" id="rvRoomWrap"><div class="rv-modal-in rv-roomsheet" role="dialog" aria-label="Room type">
    <div class="rv-modal-h"><b>Room Type</b><button class="icon-btn" id="rvRoomX" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="rv-roomsearch">
      <i data-lucide="search"></i>
      <input id="rvRoomQ" value="${esc(q)}" placeholder="Search Room Types" autocomplete="off" maxlength="60">
    </div>
    <div class="rv-roomlist">
      ${found.map((r) => `<button class="rv-roomopt ${cur === r.label ? "on" : ""}" data-roomset="${esc(r.label)}">
        <i data-lucide="${esc(r.icon)}"></i><span>${esc(r.label)}</span>${cur === r.label ? `<em data-lucide="check"></em>` : ""}</button>`).join("")}
      ${custom ? `<button class="rv-roomopt custom" data-roomset="${esc(q.trim())}"><i data-lucide="plus"></i><span>Use “${esc(q.trim())}”</span></button>` : ""}
      ${found.length || custom ? "" : `<div class="rv-note sm">No Room Types Match That Search.</div>`}
    </div>
    <div class="rv-roomfoot">
      <button class="rv-roomopt ${cur === UNSORTED ? "on" : ""}" data-roomset="${esc(UNSORTED)}"><i data-lucide="circle-dashed"></i><span>Unassigned</span></button>
      <button class="rv-roomopt ${cur === NEEDS_REVIEW ? "on" : ""}" data-roomset="${esc(NEEDS_REVIEW)}"><i data-lucide="circle-help"></i><span>Needs Review</span></button>
    </div>
  </div></div>`;
}


/* ======================= AI ANIMATE =======================
   One scene, one genuine AI-generated clip. Everything durable (price,
   provider job, storage, refunds) lives server-side in `scene_clips`; the
   builder only opens the modal, shows the row and approves the result. */

/** The clip service needs a real project row, so make sure the draft has one. */
async function ensureVideoProjectId(w) {
  if (w.editingId) return w.editingId;
  const body = wizardDraftBody(w);
  delete body.project.id;
  const saved = await saveVideo(body);
  if (!saved?.id) throw new Error("This draft could not be saved. Try again.");
  w.editingId = saved.id;
  rememberActiveBuilder(saved.id);
  sceneClips.setProject(saved.id);
  return saved.id;
}

function animateSource(w, key) {
  const a = (w.available || []).find((x) => x.key === key) || null;
  const sc = (w.scenes || []).find((x) => x.key === key) || null;
  if (!a && !sc) return null;
  return {
    asset: a,
    scene: sc,
    path: (sc && sc.path) || (a && a.path) || "",
    room: (sc && sc.room) || (a && a.room) || null,
    version: sc?.version_id ? String(sc.version_id) : "original",
  };
}

function animateModalFor(w) {
  const src = animateSource(w, w.animate.key);
  const idx = (w.scenes || []).findIndex((x) => x.key === w.animate.key);
  return animateModalHtml({
    key: w.animate.key,
    room: src?.room || null,
    position: idx >= 0 ? idx + 1 : (w.scenes || []).length + 1,
    total: (w.scenes || []).length || null,
    thumb: src?.path || null,
    selected: w.animate.sel || null,
    orientation: orientationOf(w),
    balance: S.credits?.balance ?? 0,
    clip: sceneClips.get(w.animate.key),
    busy: !!w.animate.busy,
    confirm: !!w.animate.confirm,
    cat: w.animate.cat || "recommended",
  });
}

function clipReviewFor(w) {
  const clip = sceneClips.get(w.clipReview.key);
  if (!clip) return "";
  const src = animateSource(w, w.clipReview.key);
  return clipReviewHtml({
    clip,
    url: sceneClips.url(clip),
    photo: src?.path || null,
    room: src?.room || null,
    busy: !!w.clipReview.busy,
  });
}

/** Approving a clip is what makes the final video use it, never generation. */
function markSceneClip(w, key, clip, use) {
  const sc = (w.scenes || []).find((x) => x.key === key);
  if (!sc) return;
  if (use && clip) {
    sc.clip_id = clip.id;
    sc.use_clip = true;
    sc.animate_id = clip.animate_id || null;
    sc.enhancement_level = "animate";
    sc.clip_seconds = clip.seconds || null;
    if (clip.disclosure) sc.disclosure = clip.disclosure;
  } else {
    sc.clip_id = null;
    sc.use_clip = false;
    sc.enhancement_level = sc.vfx_gen ? "effects" : "motion";
    sc.clip_seconds = null;
  }
  autosaveWizard(w);
}

async function startAnimate(w) {
  const key = w.animate?.key;
  const animate_id = w.animate?.sel;
  const src = animateSource(w, key);
  if (!key || !animate_id || !src?.path) return;
  const bal = S.credits?.balance;
  if (bal != null && bal < ANIMATE_CREDITS_PER_CLIP) {
    toast(`This Clip Costs ${ANIMATE_CREDITS_PER_CLIP} Credits And Your Balance Is ${bal}.`);
    return;
  }
  w.animate.busy = true; render();
  try {
    /* Selecting a photo first keeps the clip attached to a real scene. */
    if (!src.scene && src.asset) { w.scenes.push(assetToScene(src.asset)); syncSceneOrder(); }
    const projectId = await ensureVideoProjectId(w);
    await sceneClips.start({
      video_project_id: projectId,
      scene_key: key,
      animate_id,
      source_path: src.path,
      source_version: src.version,
      orientation: orientationOf(w),
      room_name: src.room,
      style: w.styleId || null,
    });
    S.credits = await getMyCredits().catch(() => S.credits);
    w.animate = null;
    toast("Generating Your AI Clip. You Can Keep Working.");
  } catch (e) {
    toast(e?.message || "That clip could not be started.");
    if (w.animate) { w.animate.busy = false; w.animate.confirm = false; }
  }
  render();
}

function bindAnimate(el, w, render) {
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
  const clipOf = (key) => sceneClips.get(key);

  on("[data-clip]", "click", async (e) => {
    e.stopPropagation();
    const t = e.currentTarget;
    const action = t.dataset.clip;
    const key = t.dataset.key;
    const id = t.dataset.id;
    const clip = clipOf(key);
    try {
      if (action === "open") {
        w.animate = { key, sel: clip?.animate_id || null, busy: false, confirm: false };
      } else if (action === "view") {
        w.animate = { key, sel: clip?.animate_id || null };
      } else if (action === "review") {
        w.clipReview = { key };
      } else if (action === "cancel" && id) {
        await sceneClips.cancel(id);
        S.credits = await getMyCredits().catch(() => S.credits);
        toast("Clip Cancelled. Your Credits Were Returned.");
      } else if (action === "retry" && id) {
        await sceneClips.retry(id);
        S.credits = await getMyCredits().catch(() => S.credits);
        toast("Generating Your AI Clip Again.");
      } else if (action === "use" && id) {
        const updated = await sceneClips.use(id, true);
        markSceneClip(w, key, updated, true);
        toast("This Scene Will Use The AI Clip.");
      } else if (action === "revert" && id) {
        const updated = await sceneClips.use(id, false);
        markSceneClip(w, key, updated, false);
        toast("This Scene Will Use The Photo.");
      } else if (action === "delete" && id) {
        await sceneClips.remove(id);
        markSceneClip(w, key, null, false);
      } else if (action === "download") {
        const url = sceneClips.url(clip);
        if (url) window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      toast(err?.message || "That did not work. Try again.");
    }
    render();
  });

  on("[data-animcat]", "click", (e) => {
    if (!w.animate) return;
    w.animate.cat = e.currentTarget.dataset.animcat;
    render();
  });
  on("[data-animate]", "click", (e) => {
    if (!w.animate) return;
    w.animate.sel = e.currentTarget.dataset.animate;
    w.animate.confirm = false;
    render();
  });
  const closeAnim = () => { w.animate = null; render(); };
  on("#rvAnimX, #rvAnimCancel, #rvAnimNo", "click", closeAnim);
  on("#rvAnimGo", "click", () => { if (w.animate) { w.animate.confirm = true; render(); } });
  on("#rvAnimYes", "click", () => void startAnimate(w));

  /* Clip review */
  const closeRev = () => { w.clipReview = null; render(); };
  on("#rvClipX", "click", closeRev);
  on("#rvClipKeep", "click", async () => {
    const key = w.clipReview?.key; const clip = clipOf(key);
    if (clip) { try { markSceneClip(w, key, await sceneClips.use(clip.id, false), false); } catch (_) {} }
    closeRev();
  });
  on("#rvClipUse", "click", async () => {
    const key = w.clipReview?.key; const clip = clipOf(key);
    if (!clip) return closeRev();
    try {
      markSceneClip(w, key, await sceneClips.use(clip.id, true), true);
      toast("This Scene Will Use The AI Clip.");
    } catch (err) { toast(err?.message || "That clip could not be used."); }
    closeRev();
  });
  on("#rvClipRegen", "click", async () => {
    const key = w.clipReview?.key; const clip = clipOf(key);
    w.clipReview = null;
    if (clip) { try { await sceneClips.retry(clip.id); S.credits = await getMyCredits().catch(() => S.credits); } catch (err) { toast(err?.message || "That clip could not be regenerated."); } }
    render();
  });
  on("#rvClipDl", "click", () => {
    const clip = clipOf(w.clipReview?.key);
    const url = sceneClips.url(clip);
    if (url) window.open(url, "_blank", "noopener");
  });
  on("[data-clipctl]", "click", (e) => {
    const v = el.querySelector("#rvClipVid");
    if (!v) return;
    const a = e.currentTarget.dataset.clipctl;
    if (a === "play") { v.paused ? v.play() : v.pause(); }
    else if (a === "mute") { v.muted = !v.muted; }
    else { v.currentTime = 0; v.play(); }
  });
}

/** The grid is the order. w.scenes is always the selected subset of
    w.gridOrder, in gridOrder sequence. Call after every mutation. */
function syncSceneOrder() {
  const w = S.wizard;
  if (!w || !w.scenes) return;
  const pos = new Map((w.gridOrder || []).map((k, i) => [k, i]));
  w.scenes.sort((a, b) => (pos.get(a.key) ?? 1e9) - (pos.get(b.key) ?? 1e9));
}

/** Compact state indicators. Icon plus tooltip only — never a full label. */
function sceneBadges(s, clip) {
  if (!s) return "";
  const out = [];
  const add = (icon, tip, cls = "") => out.push(`<em class="rv-badge ${cls}" title="${esc(tip)}"><i data-lucide="${icon}"></i></em>`);
  if (clip && (clip.status === "queued" || clip.status === "processing")) add("loader", "AI Clip Processing", "busy");
  else if (clip && clip.status === "failed") add("triangle-alert", "AI Clip Failed", "bad");
  else if (clip && clip.status === "completed" && clip.approved) add("clapperboard", "Using AI Clip", "ai");
  if (s.caption) add("type", `Text: ${s.caption}`);
  if ((s.motion || "auto") !== "auto" && !s.use_clip) add("camera", `Motion: ${motionLabel(s)}`);
  if (s.look) add("palette", "Look Applied");
  if (s.vfx && s.vfx !== "none") add("wand-sparkles", "Effect Applied");
  return out.length ? `<div class="rv-badges">${out.join("")}</div>` : "";
}

function tileHtml(a, seq) {
  const w = S.wizard;
  const s = w.scenes.find((x) => x.key === a.key) || null;
  const flags = (a.flags || []).map((f) => FLAG_LABEL[f] || f);
  const cropHot = s && s.crop && s.crop !== "center";
  const vfxHot = s && ((s.vfx && s.vfx !== "none") || s.look);
  const camHot = s && ((s.motion && s.motion !== "auto") || s.motion_level === "immersive" || s.exterior_effect);
  const cap = s ? String(s.caption || "") : "";
  const clip = sceneClips.get(a.key);
  const clipHot = !!clip && clip.status !== "cancelled" && clip.status !== "failed";
  /* Every card carries the same actions; using one on an unselected photo
     selects it first, so the tools never disappear on the user. */
  const tools = `<div class="rv-tools">
      <button class="rv-tool ${cropHot ? "hot" : ""}" data-pop="crop" data-key="${esc(a.key)}" aria-label="Crop"><i data-lucide="crop"></i><em>Crop</em></button>
      <button class="rv-tool ${vfxHot ? "hot" : ""}" data-pop="look" data-key="${esc(a.key)}" aria-label="Effects"><i data-lucide="wand-sparkles"></i><em>Effects</em></button>
      <button class="rv-tool ${camHot ? "hot" : ""}" data-pop="motion" data-key="${esc(a.key)}" aria-label="Motion"><i data-lucide="camera"></i><em>Motion</em></button>
      <button class="rv-tool ${cap ? "hot" : ""}" data-pop="cap" data-key="${esc(a.key)}" aria-label="Text"><i data-lucide="type"></i><em>Text</em></button>
      <button class="rv-tool ${clipHot ? "hot" : ""}" data-clip="open" data-key="${esc(a.key)}" aria-label="AI Animate"><i data-lucide="clapperboard"></i><em>Animate</em></button>
    </div>`;
  return `<div class="rv-tile ${s ? "on" : ""}" data-key="${esc(a.key)}" draggable="true">
    <div class="rv-tile-th" data-img="${esc(a.path)}" data-asset="${esc(a.key)}" role="button" tabindex="0" aria-pressed="${s ? "true" : "false"}">
      <span class="rv-tile-check"><i data-lucide="check"></i></span>
      ${flags.length ? `<em class="rv-flag" title="${esc(flags.join(", "))}" data-goto="media"><i data-lucide="triangle-alert"></i></em>` : ""}
      ${s ? `<span class="rv-tile-seq mono">${seq}</span>` : ""}
      ${sceneBadges(s, clip)}
      ${tools}
    </div>
    <div class="rv-tile-foot">
      ${roomCell(a)}
    </div>
    ${clipCardHtml(a.key, clip)}
  </div>`;
}


function stepSelect() {
  const w = S.wizard;
  const byKey = new Map(w.available.map((a) => [a.key, a]));
  const ordered = (w.gridOrder || []).map((k) => byKey.get(k)).filter(Boolean);
  const seqOf = new Map(w.scenes.map((s, i) => [s.key, i + 1]));

  const dupCount = w.available.filter((a) => a.dup).length;
  const orient = orientationOf(w);
  const per = sceneDurations(w.scenes.length, w.length);
  const total = Math.round(per * w.scenes.length);
  const imm = immersiveCount();

  /* One continuous grid, in the user's own scene order. Room type is metadata
     under each photo and never splits the layout into sections. */
  const grid = ordered.map((a) => tileHtml(a, seqOf.get(a.key))).join("");

  const all = w.available.length > 0 && w.scenes.length === w.available.length;
  const why = !w.scenes.length ? "Check At Least One Photo To Continue." : "";

  const organizing = w.selectGridLoading || w.analysisStatus === "running";
  return `${organizing ? `<div class="rv-organizing sm"><i data-lucide="loader"></i>Organizing photos…</div>` : ""}
  ${w.enrichNotice ? `<div class="rv-notice"><i data-lucide="info"></i><span>${esc(w.enrichNotice)}</span><button class="fb-link" id="rvEnrichX">Dismiss</button></div>` : ""}
  <div class="rv-utility">
    <label class="rv-selall"><input type="checkbox" id="rvSelAll" ${all ? "checked" : ""}><b>${w.scenes.length} of ${w.available.length} selected</b></label>
    <div class="rv-utility-m">${addressBarHtml(w, S.tree || [], "rvAddrBar")}</div>
    <div class="rv-utility-a">
      <button class="btn btn-ghost btn-sm" id="rvAuto"><i data-lucide="wand-sparkles"></i>Auto Arrange</button>
      <details class="rv-more"><summary class="icon-btn sm" aria-label="More"><i data-lucide="ellipsis"></i></summary>
        <div class="rv-more-m">
          <button id="rvRecommend">Select Recommended</button>
          <button id="rvClear">Clear Selection</button>
          <button id="rvReverse">Reverse Order</button>
          <button id="rvResetOrder">Reset Original Order</button>
          <button id="rvRedetect">Detect Room Types Again</button>
          ${dupCount ? `<button id="rvKeepBest">Keep Best Of Similar</button>` : ""}
        </div>
      </details>
    </div>
  </div>

  <div class="rv-grid ${orient}">${grid || `<div class="rv-note">No Content Found For This Source.</div>`}</div>
  <div class="rv-gridfoot">
    <div class="rv-count">
      <span>${w.scenes.length} ${w.scenes.length === 1 ? "scene" : "scenes"} · ${total} sec · ${creditTotal()} credits</span>
      ${imm > 4 ? `<div class="rv-note sm">Immersive movement is on for ${imm} scenes, ${imm * IMMERSIVE_CREDITS_PER_SCENE} extra credits.</div>` : ""}
    </div>
    <div class="rv-gridfoot-a">
      <button class="btn btn-ghost" id="rvBack">Back</button>
      <button class="btn btn-primary" id="rvNext" ${stepReady() ? "" : `disabled title="${esc(why)}"`}>Continue</button>
    </div>
  </div>`;
}

/* ---------- leaving and deleting a draft ----------

   The builder autosaves, so there is no Cancel here. Exit Builder saves and
   leaves; Delete Draft is explicitly destructive and keeps uploaded source
   photos unless the user asks for those too. */
function exitModalHtml() {
  const m = S.wizard.exitModal || {};
  if (m.state === "error") {
    return `<div class="rv-modal on" id="rvExitWrap"><div class="rv-modal-in" role="dialog" aria-label="Changes not saved">
      <div class="rv-modal-h"><b>Your Latest Changes Are Not Saved</b><button class="icon-btn" id="rvExitX"><i data-lucide="x"></i></button></div>
      <div class="rv-modal-b"><p>We could not save this draft just now. Leaving may lose your most recent edits.</p></div>
      <div class="rv-modal-f"><button class="btn btn-ghost" id="rvExitLeave">Leave Anyway</button><button class="btn btn-primary" id="rvExitRetry">Retry Saving</button></div>
    </div></div>`;
  }
  return `<div class="rv-modal on" id="rvExitWrap"><div class="rv-modal-in" role="dialog" aria-label="Saving your draft">
    <div class="rv-modal-h"><b>Saving Your Draft</b></div>
    <div class="rv-modal-b"><p>Saving your project before you leave…</p></div>
  </div></div>`;
}

function deleteModalHtml() {
  const w = S.wizard;
  const m = w.deleteModal || {};
  const photos = (w.uploads || []).filter((u) => u.storagePath).length;
  return `<div class="rv-modal on" id="rvDelWrap"><div class="rv-modal-in" role="dialog" aria-label="Delete this draft">
    <div class="rv-modal-h"><b>Delete This Video Draft?</b><button class="icon-btn" id="rvDelX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">
      <p>This removes the video project and its scene setup. This cannot be undone.</p>
      <p>Your uploaded source photos stay in your library and will not be deleted${photos ? ` (${photos})` : ""}, unless you choose to delete them too.</p>
      <label class="rv-check"><input type="checkbox" id="rvDelPhotos" ${m.alsoPhotos ? "checked" : ""}><span>Also Delete The Uploaded Photos For This Project</span></label>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvDelKeep">Keep Draft</button>
      <button class="btn btn-danger" id="rvDelGo"${m.busy ? " disabled" : ""}>${m.busy ? "Deleting…" : "Delete Draft"}</button></div>
  </div></div>`;
}

/** Leave the builder for Media without touching saved work. */
function leaveBuilder(w) {
  stopWizardAutosave();
  revokeUploadUrls(w);
  forgetActiveBuilder();
  S.screen = "library";
  S.wizard = null;
  render();
  goTo("v-media");
}

async function exitBuilder(w) {
  w.exitModal = { state: "saving" };
  render();
  autosaveWizard(w);
  try {
    if (wizSaver) await wizSaver.flush();
  } catch (_) {}
  if (S.wizard !== w) return;
  if (wizSaver && wizSaver.state === "error") {
    w.exitModal = { state: "error" };
    render();
    return;
  }
  w.exitModal = null;
  leaveBuilder(w);
}

async function confirmDeleteDraft(w) {
  const m = w.deleteModal || {};
  if (m.busy) return;
  w.deleteModal = { ...m, busy: true };
  render();
  const paths = m.alsoPhotos ? (w.uploads || []).map((u) => u.storagePath).filter(Boolean) : [];
  try {
    if (w.editingId) await deleteProjectDraft({ data: { id: w.editingId } });
    for (const path of paths) {
      try { await deleteRoomPhoto(path); } catch (_) {}
    }
  } catch (e) {
    w.deleteModal = { ...m, busy: false };
    render();
    toast(e?.message || "Could not delete this draft.");
    return;
  }
  if (S.wizard !== w) return;
  w.deleteModal = null;
  stopWizardAutosave();
  toast(paths.length ? "Draft And Photos Deleted." : "Draft Deleted. Your Photos Were Kept.");
  leaveBuilder(w);
}

function lowSceneModal() {
  const w = S.wizard;
  return `<div class="rv-modal on" id="rvLowWrap"><div class="rv-modal-in" role="dialog" aria-label="Add a few more rooms">
    <div class="rv-modal-h"><b>Your Video Deserves More Photos</b><button class="icon-btn" id="rvLowX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b"><p>Videos with 8 to 12 rooms hold attention longest. You have <b class="mono">${w.scenes.length}</b>.</p></div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvLowMore">Add More Photos</button><button class="btn btn-primary" id="rvLowGo">Continue Anyway</button></div>
  </div></div>`;
}

/* ---------- per-scene motion, immersive movement and exterior effects ---------- */
function isExterior(scene) {
  return /exterior|front|facade|curb|yard|patio|deck|pool|garden|landscape|backyard|outdoor/i.test(
    (scene.room || "") + " " + (scene.kind || ""),
  );
}
function immersiveCount() {
  return (S.wizard?.scenes || []).filter((s) => s.motion_level === "immersive").length;
}

const MOTION_COPY = {
  auto: "Auto picks the camera move that suits each room, based on what is in the frame.",
  push: "Push In moves the camera slowly toward the room, drawing the viewer inward.",
  pull: "Pull Out starts tight and widens to reveal the whole space.",
  pan_left: "Pan Left glides across the room from right to left.",
  pan_right: "Pan Right glides across the room from left to right.",
  orbit_left: "Orbit Left rotates the camera counter clockwise around the focal point.",
  orbit_right: "Orbit Right rotates the camera clockwise around the focal point, creating a sense of depth.",
  tilt_up: "Tilt Up sweeps the frame upward, good for tall ceilings and entryways.",
  tilt_down: "Tilt Down settles the frame downward, good for stairs and open floor plans.",
  dolly_left: "Dolly Left tracks sideways to the left while easing in.",
  dolly_right: "Dolly Right tracks sideways to the right while easing in.",
  crane_up: "Crane Up lifts and widens at the same time for an opening shot.",
  crane_down: "Crane Down descends into the room for a closing shot.",
  diag_in: "Diagonal In pushes toward the upper corner of the frame.",
  diag_out: "Diagonal Out drifts back and away from the focal point.",
  drift_in: "Slow Drift In is a barely there push, best under narration.",
  drift_out: "Slow Drift Out is a barely there pull, best under narration.",
  static: "Static holds the frame still, letting the design speak for itself.",
  curtains: "Curtains Drifting adds a soft fabric movement near windows while the room stays exactly as designed.",
  fire: "Fireplace Flicker animates the flame and its light spill only.",
  water: "Water Movement ripples pools, tubs and open water in the frame.",
  light: "Daylight Shift moves the natural light across the room over the length of the clip.",
  foliage: "Foliage Sway adds a gentle breeze through plants and trees.",
  approach: "Approach drives the camera toward the front of the property.",
  rise: "Rise lifts the camera upward to open the view.",
  aerial_reveal: "Aerial Reveal pulls up and back for a wide establishing look.",
};
/** Preview animation class per option. Immersive and exterior reuse the closest camera move. */
const MOTION_PREVIEW = {
  curtains: "drift_in", fire: "static", water: "drift_in", light: "static", foliage: "drift_in",
  approach: "push", rise: "pull", aerial_reveal: "pull",
};
const FX_PREVIEW = ["curtains", "fire", "water", "light", "foliage"];
function fxClass(id) { return FX_PREVIEW.includes(id) ? `rv-pop-fx fx-${id}` : "rv-pop-fx"; }
function motionName(id) {
  const all = [...STANDARD_MOTIONS, ...IMMERSIVE_EFFECTS, ...EXTERIOR_EFFECTS];
  const hit = all.find(([i]) => i === id);
  return hit ? (id === "auto" ? "Auto, Recommended" : hit[1]) : "Auto, Recommended";
}

const CROPS = [["center", "Center"], ["top", "Top"], ["bottom", "Bottom"]];

function motionLabel(s) {
  if (s.motion_level === "immersive") {
    const e = IMMERSIVE_EFFECTS.find(([id]) => id === (s.immersive_effect || "light"));
    return e ? e[1] : "Immersive";
  }
  if ((s.motion || "auto") === "auto") return "Auto";
  const m = STANDARD_MOTIONS.find(([id]) => id === s.motion);
  return m ? m[1] : "Auto";
}

function popoverHtml() {
  const w = S.wizard;
  const { kind } = w.pop;
  /* Resolve by asset key when we have one, so a reorder underneath an open
     popover cannot retarget it at a different scene. */
  const i = w.pop.key ? w.scenes.findIndex((x) => x.key === w.pop.key) : w.pop.i;
  const s = w.scenes[i];
  if (!s) return "";
  let body = "";
  if (kind === "motion") {
    const q = (w.popQ || "").toLowerCase();
    const match = (n) => !q || n.toLowerCase().includes(q);
    const rows = STANDARD_MOTIONS.filter(([, n]) => match(n));
    const sel = s.motion || "auto";
    const hov = w.popHover || sel;
    body = `<div class="rv-pop-two">
      <div class="rv-pop-side">
        <input id="rvPopQ" value="${esc(w.popQ || "")}" placeholder="Search Motions">
        <div class="rv-pop-scroll">
          <div class="rv-pop-h">Camera Moves</div>
          ${rows.some(([id]) => id === "auto") ? `<button class="rv-pop-auto ${s.motion_level !== "immersive" && (s.motion || "auto") === "auto" ? "on" : ""}" data-motionpick="auto" data-hover="auto">
            <span><b>Auto, Recommended</b><em>We’ll Choose A Natural Movement For This Scene</em></span><i data-lucide="sparkles"></i>
          </button>` : ""}
          <div class="rv-pop-grid">
            ${rows.filter(([id]) => id !== "auto").map(([id, n]) => `<button class="rv-pop-row ${s.motion_level !== "immersive" && s.motion === id ? "on" : ""}" data-motionpick="${id}" data-hover="${id}">${esc(n)}</button>`).join("")}
          </div>
        </div>
        <label class="rv-check"><input type="checkbox" id="rvAllMotion"> Apply To All Scenes</label>
      </div>
      <div class="rv-pop-prev">
        <div class="rv-pop-stage">
          <div class="rv-pop-clip m-${esc(MOTION_PREVIEW[hov] || hov || "auto")}" data-img="${esc(s.path)}"></div>
          <div class="${fxClass(hov)}"></div>
          <span class="rv-pop-live"><i></i>Live Preview</span>
        </div>
        <b id="rvPopName">${esc(motionName(hov))}</b>
        <span id="rvPopCopy">${esc(MOTION_COPY[hov] || MOTION_COPY.auto)}</span>
        <span class="rv-pop-tip">Hover Any Option To Preview It. The Loop Repeats Automatically.</span>
      </div>
    </div>`;

  } else if (kind === "crop") {
    body = `<div class="rv-pop-list">
      <div class="rv-pop-h">Crop <i class="mono">${esc(w.primaryFormat || "9:16")}</i></div>
      ${CROPS.map(([id, n]) => `<button class="rv-pop-row ${(s.crop || "center") === id ? "on" : ""}" data-croppick="${id}">${n}</button>`).join("")}
    </div>`;
  } else if (kind === "cap") {
    const pos = s.caption_pos || "bottom";
    const sty = s.caption_style || "brand";
    body = `<div class="rv-textbox">
      <label class="rv-f">On-Screen Text
        <input class="rv-cap" data-cap="${i}" value="${esc(s.caption ?? "")}" maxlength="60" placeholder="Kitchen With Quartz Island" autofocus></label>
      <div class="rv-note sm">Shown over this scene while it plays.</div>
      <div class="rv-textrow"><span>Position</span><div class="rv-seg">
        ${[["bottom", "Bottom"], ["center", "Center"], ["top", "Top"]].map(([id, n]) => `<button class="${pos === id ? "on" : ""}" data-cappos="${id}">${n}</button>`).join("")}
      </div></div>
      <div class="rv-textrow"><span>Text Style</span><div class="rv-seg">
        ${[["brand", "Brand Default"], ["minimal", "Minimal"]].map(([id, n]) => `<button class="${sty === id ? "on" : ""}" data-capstyle="${id}">${n}</button>`).join("")}
      </div></div>
      <button class="fb-link" id="rvCapClear" ${s.caption ? "" : "disabled"}>Clear Text</button>
    </div>`;
  } else {
    /* Effects modal. Two tabs — Looks (colour and presentation, free) and
       Effects (adds or animates content, costs credits). Display grouping
       only: every picked option still writes the same stored ids. */
    const tab = w.popTab === "effects" ? "effects" : "looks";
    const cats = tab === "looks" ? lookCats() : fxCats();
    const catId = cats.some(([id]) => id === w.popCat) ? w.popCat : cats[0][0];
    const amt = s.look_amount ?? DEFAULT_INTENSITY;
    const activeLook = s.look ? lookById(s.look) : null;
    const activeTile = s.vfx && s.vfx !== "none" ? tileById(s.vfx) : null;
    const nothing = !activeLook && !activeTile;
    const plan = applyAllPlan(w.scenes, s);
    const canAll = !nothing && plan.targets > 0;

    /* A tile shows the real treatment when we can paint it. Generated effects
       cannot be previewed before they are made, so they say so instead of
       showing an unchanged photo and pretending. */
    const card = (o) => `<button class="fx-card ${o.on ? "on" : ""}" ${o.attr} role="option"
      aria-selected="${o.on ? "true" : "false"}" title="${esc(o.blurb || o.name)}">
      <span class="fx-th ${o.blank ? "blank" : ""} ${o.pending ? "pending" : ""}" ${o.blank || o.pending ? "" : `data-img="${esc(s.path)}"`}>${
        o.blank ? `<i data-lucide="ban"></i>` : o.pending ? `<i data-lucide="sparkles"></i><em>Preview After Generating</em>` : o.overlay || ""}
        ${o.on ? `<i class="fx-ck" data-lucide="check"></i>` : ""}</span>
      <span class="fx-nm">${esc(o.name)}</span>
      ${o.gen ? `<em class="fx-cost gen">AI Image · ${o.credits} Credits</em>` : o.credits ? `<em class="fx-cost">${o.credits} Credits</em>` : ""}
      ${o.beta ? `<em class="fx-beta">Beta</em>` : ""}
    </button>`;

    const grid = tab === "looks"
      ? card({ name: "None", blurb: "No Look Applied", on: !activeLook && !activeTile, blank: true, attr: `data-lookpick=""` }) +
        looksForCat(catId).map((l) => card({
          name: l.label, blurb: l.blurb, on: s.look === l.id && !activeTile,
          overlay: lookOverlayHTML(l, amt), attr: `data-lookpick="${esc(l.id)}"`,
        })).join("")
      : card({ name: "None", blurb: "No Effect Applied", on: nothing, blank: true, attr: `data-vfxpick="none"` }) +
        effectTiles(catId).map((t) => {
          const lk = t.look ? lookById(t.look) : null;
          return card({
            name: t.label, blurb: t.sub, on: s.vfx === t.id, credits: t.credits || 0,
            gen: !!t.gen, pending: !!t.gen,
            overlay: lk ? lookOverlayHTML(lk, amt) : "", attr: `data-vfxpick="${esc(t.id)}"`,
          });
        }).join("");

    const selName = activeTile ? activeTile.label : activeLook ? activeLook.label : "None";
    const selCopy = activeTile ? activeTile.sub : activeLook ? activeLook.blurb || "" : "No effect applied.";
    const cost = sceneEffectCredits(s);

    body = `<div class="fx-wrap">
      <div class="fx-tabs" role="tablist">
        <button role="tab" aria-selected="${tab === "looks"}" class="${tab === "looks" ? "on" : ""}" data-fxtab="looks">Looks</button>
        <button role="tab" aria-selected="${tab === "effects"}" class="${tab === "effects" ? "on" : ""}" data-fxtab="effects">Effects</button>
      </div>
      <div class="fx-body">
        <nav class="fx-cats" aria-label="Categories">
          ${cats.map(([id, n]) => `<button class="${catId === id ? "on" : ""}" data-fxcat="${id}">${esc(n)}</button>`).join("")}
        </nav>
        <div class="fx-grid" role="listbox" aria-label="${tab === "looks" ? "Looks" : "Effects"}">${grid}</div>
        <aside class="fx-prev">
          <div class="rv-pop-stage">
            <div class="rv-pop-clip m-static" data-img="${esc(s.path)}">${activeLook ? lookOverlayHTML(activeLook, amt) : ""}</div>
            <span class="rv-pop-live"><i></i>Live Preview</span>
          </div>
          <b>${esc(selName)}${cost ? ` <em class="fx-cost inline">AI Image · ${cost} Credits</em>` : ""}</b>
          ${cost ? `<span class="rv-note sm">This is generated as a new image version. Your original photo is kept.</span>` : ""}
          <span>${esc(selCopy)}</span>
          ${supportsIntensity(s) ? `<label class="rv-f">Intensity <i class="fx-amt">${esc(intensityWord(amt))}</i>
            <input type="range" id="rvLookAmt" min="10" max="100" value="${amt}">
            <span class="fx-scale"><em>Subtle</em><em>Balanced</em><em>Strong</em></span></label>` : ""}
          <button class="btn btn-ghost btn-sm fx-all" id="rvAllLook" ${canAll ? "" : "disabled"}>
            <i data-lucide="copy"></i>Apply to All${plan.targets ? ` (${plan.targets + 1} Scenes)` : ""}</button>
          ${w.popAll ? `<span class="fx-ok"><i data-lucide="check"></i>Will Apply To All ${plan.total} Scenes</span>` : ""}
          ${needsDisclosure(s) ? `<span class="rv-pop-tip">Generated effects may require an AI-modified disclosure.</span>` : ""}
        </aside>
      </div>
      ${w.popConfirm ? `<div class="fx-confirm"><div>
        <b>Apply this effect to ${plan.total} scenes${plan.credits ? ` for an estimated ${plan.credits} additional credits` : ""}?</b>
        ${plan.perScene && plan.credits !== plan.perScene * plan.targets ? `<span>${Math.round(plan.credits / plan.perScene)} of ${plan.targets} other scenes still need it.</span>` : ""}
        <div class="fx-confirm-a"><button class="btn btn-ghost btn-sm" id="rvAllNo">Cancel</button>
        <button class="btn btn-primary btn-sm" id="rvAllYes">Apply to All</button></div>
      </div></div>` : ""}
    </div>`;
  }

  const isFx = kind === "look";
  const title = kind === "motion" ? "Motion" : kind === "crop" ? "Crop" : kind === "cap" ? "Text" : "Effects";
  const width = kind === "crop" ? "wide" : kind === "cap" ? "compact" : "xwide";
  const foot = isFx
    ? `<button class="btn btn-ghost" id="rvPopCancel">Cancel</button><button class="btn btn-primary" id="rvPopDone" ${fxDirty(s, w.pop.snap) || w.popAll ? "" : "disabled"}>Apply</button>`
    : `<button class="btn btn-ghost" id="rvPopCancel">Cancel</button><button class="btn btn-primary" id="rvPopDone">Save</button>`;
  return `<div class="rv-modal on" id="rvPopWrap"><div class="rv-modal-in ${width} ${isFx ? "fx-modal" : ""}" role="dialog" aria-label="${esc(title)}">
    <div class="rv-modal-h"><b>${esc(title)}</b><button class="icon-btn" id="rvPopX" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">${body}</div>
    <div class="rv-modal-f">${foot}</div>
  </div></div>`;
}

/* Video format. The old step 3 folded into the grid, so the segmented control
   lives in the grid header now. */
function orientationOf(w) {
  const f = w?.primaryFormat || DEFAULT_FORMAT;
  return f === "16:9" ? "landscape" : f === "1:1" ? "square" : "portrait";
}
/** Every deliverable this project will produce, primary first. */
function outputFormats(w) {
  return getOutputFormats(w?.primaryFormat, w?.additionalFormats);
}
/** Compatibility of the current quality tier with the selected scene count. */
function qualityCompat(w) {
  const wiz = w || S.wizard || {};
  return getQualityCompatibility(wiz.quality || "standard", (wiz.scenes || []).length);
}


/* Map friendly voice names to gateway voices. */
const VOICE_MAP: Record<string, string> = {
  professional: "alloy", warm: "coral", conversational: "sage", luxury: "ballad",
};

let voiceAudio: HTMLAudioElement | null = null;

function stopVoicePreview() {
  if (voiceAudio) { try { voiceAudio.pause(); } catch (_) { /* noop */ } voiceAudio = null; }
  if (S.wizard) S.wizard.voicePreviewing = false;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

async function buildNarration(type: string, script: string | null | undefined, voice: string | null | undefined) {
  if (type === "upload") return S.wizard?.narrationUpload || null;
  if (type !== "generate" || !script || script.trim().length < 4) return null;
  try {
    const { synthesizeNarration } = await import("@/lib/narration.functions");
    const out = await synthesizeNarration({
      data: { script: script.trim().slice(0, 4000), ...voiceRequest(voice, VOICE_MAP) },
    });
    return out?.audio || null;
  } catch (_) {
    return null;
  }
}

function defaultScript() {
  const w = S.wizard;
  const rooms = Array.from(new Set(w.scenes.map((s) => s.room).filter(Boolean))).slice(0, 6);
  const lines = [];
  if (w.propertyLabel) lines.push(`A look at ${w.propertyLabel}.`);
  if (rooms.length) lines.push(`This video covers ${rooms.join(", ")}.`);
  if (w.scenes.some((s) => s.scene_type === "before_after")) lines.push("Each space is shown as it is today, then as the proposed design.");
  lines.push("Every design shown is a proposed concept created in REAL DESIGNS.");
  return lines.join(" ");
}

const LABEL_STYLES: Array<[string, string]> = [
  ["clean", "Clean"],
  ["architectural", "Architectural"],
  ["callout", "Callout"],
];
const LABEL_POSITIONS: Array<[string, string]> = [
  ["top_left", "Top Left"],
  ["top_right", "Top Right"],
  ["bottom_left", "Bottom Left"],
  ["bottom_right", "Bottom Right"],
];

function labelEditor(s, i) {
  const labels = Array.isArray(s.labels) ? s.labels : [];
  return `<div class="rv-mcard">
    <div class="rv-mcard-h"><b>${esc(s.room || "Scene " + (i + 1))}</b>
      ${labels.length < 2 ? `<button class="btn btn-ghost btn-sm" data-label-add="${i}">Add Label</button>` : ""}
    </div>
    ${labels.length === 0 ? `<div class="rv-note sm">No Labels On This Scene.</div>` : ""}
    ${labels.map((l, j) => `<div class="rv-labrow">
      <input data-label-text="${i}:${j}" value="${esc(l.text || "")}" placeholder="Label Text" maxlength="40">
      <select data-label-style="${i}:${j}">${LABEL_STYLES.map(([v, n]) => `<option value="${v}" ${(l.style || "clean") === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-label-pos="${i}:${j}">${LABEL_POSITIONS.map(([v, n]) => `<option value="${v}" ${(l.position || "bottom_left") === v ? "selected" : ""}>${n}</option>`).join("")}</select>
      <button class="rv-x" data-label-del="${i}:${j}" aria-label="Remove Label"><i data-lucide="x"></i></button>
    </div>`).join("")}
  </div>`;
}



/* ---------- Step 4 templates ---------- */
const INTRO_TEMPLATES = [
  ["none", "None", "No Intro Card", "plain"],
  ["clean", "Clean Title Card", "Address On White", "clean"],
  ["editorial", "Editorial", "Serif Title, Thin Rule", "editorial"],
  ["bold", "Bold Listing", "Red Block, Large Type", "bold"],
  ["minimal_bar", "Minimal Bar", "Lower Third Only", "bar"],
  ["split", "Split Frame", "Photo Beside The Title", "split"],
  ["stamp", "Stamp", "Boxed Address Stamp", "stamp"],
  ["dark", "Dark Card", "White Type On Black", "dark"],
  ["kicker", "Kicker", "Just Listed Kicker Above Address", "kicker"],
];
const OUTRO_TEMPLATES = [
  ["none", "None", "No Outro Card", "plain"],
  ["agent_white", "Agent Card, White", "Headshot, Name, Title, Phone, Email, CTA", "agentw"],
  ["agent_black", "Agent Card, Black", "Headshot, Name, Title, Phone, Email, CTA", "agentb"],
  ["contact_bar", "Contact Bar", "Single Line Contact Strip", "bar"],
  ["cta_only", "Call To Action", "Book A Showing", "bold"],
];
/** Real, typeset mini previews of each intro/outro card. */
function tplCtx() {
  const w = S.wizard || ({} as any);
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const raw = String(w.address || w.propertyLabel || w.title || "123 Maple Ave, Austin, TX");
  const parts = raw.split(",");
  const line1 = (parts[0] || raw).trim();
  const line2 = parts.slice(1).join(",").trim() || "For Sale";
  const shot = (w.scenes || []).find((s) => s && s.path);
  return {
    a: esc(line1),
    b: esc(line2),
    agent: esc(kit?.name || "Your Name"),
    phone: esc(kit?.phone || "(555) 555-0134"),
    photo: shot ? esc(shot.path) : "",
  };
}
function tplThumb(kind) {
  const c = tplCtx();
  const bg = c.photo ? ` data-img="${c.photo}"` : "";
  const body = {
    plain: `<span class="tp-none">No Card</span>`,
    clean: `<span class="tp-a">${c.a}</span><span class="tp-b">${c.b}</span>`,
    editorial: `<span class="tp-a serif">${c.a}</span><span class="tp-rule"></span><span class="tp-b">${c.b}</span>`,
    bold: `<span class="tp-a big">${c.a}</span><span class="tp-b">${c.b}</span>`,
    bar: `<span class="tp-lower"><span class="tp-a">${c.a}</span><span class="tp-b">${c.b}</span></span>`,
    split: `<span class="tp-half"${bg}></span><span class="tp-side"><span class="tp-a">${c.a}</span><span class="tp-b">${c.b}</span></span>`,
    stamp: `<span class="tp-stamp"><span class="tp-a">${c.a}</span></span><span class="tp-b">${c.b}</span>`,
    dark: `<span class="tp-a">${c.a}</span><span class="tp-b">${c.b}</span>`,
    kicker: `<span class="tp-kick">Just Listed</span><span class="tp-a">${c.a}</span><span class="tp-b">${c.b}</span>`,
    agentw: `<span class="tp-face"></span><span class="tp-a">${c.agent}</span><span class="tp-b">${c.phone}</span><span class="tp-cta">Book A Showing</span>`,
    agentb: `<span class="tp-face"></span><span class="tp-a">${c.agent}</span><span class="tp-b">${c.phone}</span><span class="tp-cta">Book A Showing</span>`,
  }[kind] || `<span class="tp-a">${c.a}</span>`;
  const photoBg = kind === "bar" ? bg : "";
  return `<span class="rv-tpl-th t-${kind}"${photoBg}>${body}</span>`;
}
function templateGrid(list, sel, attr) {
  return `<div class="rv-tpls">${list
    .map(([id, name, note, kind]) => `<button class="rv-tpl ${sel === id ? "on" : ""}" data-${attr}="${id}">
      ${tplThumb(kind)}<b>${name}</b><em>${note}</em>
    </button>`)
    .join("")}</div>`;
}

function logoModalHtml() {
  const w = S.wizard;
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const logo = kit?.logo_path || null;
  return `<div class="rv-modal on" id="rvLogoWrap"><div class="rv-modal-in" role="dialog" aria-label="Select logo">
    <div class="rv-modal-h"><b>Select Logo</b><button class="icon-btn" id="rvLogoX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">
      ${logo
        ? `<div class="rv-logos"><button class="rv-logo on" data-logopick="${esc(logo)}"><span class="rv-a-th" data-img="${esc(logo)}"></span><b>${esc(kit.name || "Brand Kit Logo")}</b></button></div>`
        : `<div class="rv-note">No Images Uploaded Yet</div>
      <button class="btn btn-ghost btn-sm" id="rvLogoUp"><i data-lucide="upload"></i>Upload Image</button>
      <input type="file" id="rvLogoFile" accept="image/*" hidden>`}
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvLogoCancel">Cancel</button><button class="btn btn-primary" id="rvLogoDone">Select Logo</button></div>
  </div></div>`;
}

/* ======================= STEP 4, BRAND ======================= */
/** Which Step 4 accordions are open, kept across re-renders. */
const accOpen = new Set<string>(["template"]);
function stepBrand() {
  const w = S.wizard;
  if (!w.avatar) w.avatar = blankAvatarConfig();
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const discScenes = w.scenes.filter((s) => s.disclosure);
  const colors = kit?.colors || {};
  const swatches = ["primary", "secondary", "accent"].map((k) => colors[k]).filter(Boolean);
  return `
  <section class="rv-sec">
    <h4>Brand Kit</h4>
    <div class="rv-kits">${S.kits.map((k) => `<button class="rv-kit ${w.brandKitId === k.id ? "on" : ""}" data-kit="${k.id}"><b>${esc(k.name)}</b><span>${esc(k.company_name || k.contact_name || "No Company Name")}</span></button>`).join("")}
      <button class="rv-kit add" id="rvKitNew"><i data-lucide="plus"></i><b>New Brand Kit</b></button>
    </div>
    ${kit ? `<div class="rv-kitface">
      <span class="rv-sw">${swatches.length ? swatches.map((c) => `<i style="background:${esc(c)}"></i>`).join("") : `<em class="sm">Kit Colors Not Set</em>`}</span>
      <span class="sm">${esc(kit.font || "Default Typography")}</span>
      <button class="fb-link" id="rvKitEdit">Edit</button>
    </div>` : `<div class="rv-note sm">Add A Brand Kit To Put Your Logo And Contact Details On The Branded Version.</div>`}
  </section>

  <section class="rv-sec">
    <h4>Logo &amp; Watermark</h4>
    <div class="rv-tog">
      <div class="rv-tog-row">
        <span><b>Logo Watermark</b><em>Your Logo On Every Scene.</em><button class="fb-link" id="rvPickLogo">Select Logo</button></span>
        <label class="rv-switch"><input type="checkbox" id="rvLogoBrand" ${w.logoBranding ? "checked" : ""}><i></i></label>
      </div>
    </div>
    <details class="rv-adv-d"><summary>Advanced Placement</summary>
      <div class="rv-seg tiny wrap">${[["tl", "Top Left"], ["tr", "Top Right"], ["bl", "Bottom Left"], ["br", "Bottom Right"]]
        .map(([id, n]) => `<button class="${(w.logoPos || "tr") === id ? "on" : ""}" data-logopos="${id}">${n}</button>`).join("")}</div>
      <label class="rv-f">Opacity<input type="range" id="rvLogoOp" min="20" max="100" value="${Math.round((w.logoOpacity ?? 0.85) * 100)}"></label>
    </details>
  </section>

  <section class="rv-sec">
    <h4>Opening &amp; Closing Cards</h4>
    <div class="rv-seg tiny">${[["intro", "Opening"], ["outro", "Closing"]]
      .map(([id, n]) => `<button class="${(w.tplScope === "outro" ? "outro" : "intro") === id ? "on" : ""}" data-tplscope="${id}">${n}</button>`).join("")}</div>
    ${w.tplScope === "outro"
      ? templateGrid(OUTRO_TEMPLATES, w.outroTemplate || "agent_white", "tploutro")
      : templateGrid(INTRO_TEMPLATES, w.introTemplate || "clean", "tplintro")}
    ${kit ? `<div class="rv-checks">
      <label class="rv-check"><input type="checkbox" data-br="outro" ${w.branding.outro ? "checked" : ""}> Closing Branded Scene</label>
      <label class="rv-check"><input type="checkbox" data-br="contact" ${w.branding.contact ? "checked" : ""}> Contact Information</label>
      <label class="rv-check"><input type="checkbox" data-br="cta" ${w.branding.cta ? "checked" : ""}> Call To Action${kit.default_cta ? ` — ${esc(kit.default_cta)}` : ""}</label>
    </div>` : ""}
  </section>

  <section class="rv-sec">
    <h4>Output</h4>
    <div class="rv-seg">${[["unbranded", "Unbranded"], ["branded", "Branded"], ["both", "Both"]]
      .map(([id, n]) => `<button class="${(w.outputMode || "both") === id ? "on" : ""}" data-out="${id}">${n}</button>`).join("")}</div>
    <div class="rv-note sm">Unbranded Goes To The MLS. Branded Goes Everywhere Else.</div>
  </section>

  <section class="rv-sec">
    <h4>Disclosure</h4>
    <div class="rv-note sm">${discScenes.length ? `${discScenes.length} ${discScenes.length === 1 ? "Scene Carries" : "Scenes Carry"} A Disclosure Label. Required Labels Cannot Be Removed.` : "No Altered Scenes Detected. Nothing To Disclose."}</div>
    <label class="rv-check"><input type="checkbox" id="rvAiDisc" ${w.aiDisclaimer ? "checked" : ""}> Digitally Altered Watermark For The Full Video</label>
    <label class="rv-check"><input type="checkbox" id="rvBurnDisc" ${w.burnDisclosure ? "checked" : ""}> Burn In Disclosure Labels</label>
    ${discScenes.length ? `<details class="rv-adv-d"><summary>Per Scene Labels</summary>
      ${discScenes.map((s2) => `<label class="rv-f">${esc(s2.room)}
        <select data-disc="${w.scenes.indexOf(s2)}">${Object.keys(DISCLOSURE_LABEL).map((k) => `<option value="${k}" ${s2.disclosure === k ? "selected" : ""}>${DISCLOSURE_LABEL[k]}</option>`).join("")}</select></label>`).join("")}
      <div class="rv-seg tiny wrap">${[["altered", "Altered Only"], ["all", "Whole Video"], ["intro", "Intro"], ["outro", "Outro"]]
        .map(([id, n]) => `<button class="${w.disclosureMode === id ? "on" : ""}" data-dmode="${id}">${n}</button>`).join("")}</div>
    </details>` : ""}
  </section>`;
}

/* ======================= TITLES ======================= */
function titleDefaults() {
  const w = S.wizard;
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const addr = w.propertyLabel || w.address || w.title || "Your Property";
  return {
    address: addr,
    headline: w.titlesHeadline || addr,
    contactName: kit?.contact_name || kit?.name || "",
    contactPhone: kit?.phone || "",
    contactEmail: kit?.email || "",
    company: kit?.company_name || "",
  };
}

const TITLE_FONTS = [["editorial", "Editorial"], ["modern", "Modern"], ["bold", "Bold"]];

function stepTitles() {
  const w = S.wizard;
  if (!w.titles) w.titles = { property: true, contact: true, custom: [] };
  const t = w.titles;
  const d = titleDefaults();
  const custom = Array.isArray(t.custom) ? t.custom : [];
  const sc = activeScene();
  const i = activeIndex();
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;

  return `
  <section class="rv-sec">
    <div class="rv-sec-h"><h4>Video Title</h4></div>
    ${titleFieldHtml(w, { label: "Project Title" })}
    <div class="rv-note sm">This Names The Project. It Is Not Shown In The Video.</div>
  </section>

  <section class="rv-sec">
    <div class="rv-sec-h"><h4>Opening Title</h4>
      <label class="rv-switch sm"><input type="checkbox" data-tt="property" ${t.property ? "checked" : ""}><i></i></label></div>
    ${t.property ? `
    <label class="rv-f">Headline<input id="rvTtHead" value="${esc(t.headline == null ? d.headline : t.headline)}" maxlength="80"></label>
    <label class="rv-f">Supporting Line<input id="rvTtSub" value="${esc(t.sub == null ? "For Sale" : t.sub)}" maxlength="80"></label>
    <div class="rv-sub">Typography</div>
    <div class="rv-seg tiny">${TITLE_FONTS.map(([id, n]) => `<button class="${(w.titleFont || "editorial") === id ? "on" : ""}" data-tfont="${id}">${n}</button>`).join("")}</div>
    <div class="rv-sub">Position</div>
    <div class="rv-seg tiny">${[["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]
      .map(([id, n]) => `<button class="${(w.titlePos || "bottom") === id ? "on" : ""}" data-tpos="${id}">${n}</button>`).join("")}</div>
    <details class="rv-adv-d"${t.customOn ? " open" : ""}><summary>Extra Title Cards</summary>
      <label class="rv-check"><input type="checkbox" data-tt="customOn" ${t.customOn ? "checked" : ""}> Show Custom Title Cards</label>
      ${t.customOn ? `${custom.map((c, n) => `<div class="rv-labrow"><input data-tcustom="${n}" value="${esc(c)}" maxlength="60" placeholder="Custom Title">
        <button class="rv-x" data-tcustom-del="${n}" aria-label="Remove Title"><i data-lucide="x"></i></button></div>`).join("")}
      <button class="btn btn-ghost btn-sm" id="rvTtAdd"><i data-lucide="plus"></i>Add A Title</button>` : ""}
    </details>` : `<div class="rv-note sm">No Opening Title Card.</div>`}
  </section>

  <section class="rv-sec">
    <div class="rv-sec-h"><h4>Scene Text</h4>
      <label class="rv-switch sm"><input type="checkbox" id="rvCaps" ${w.captions ? "checked" : ""}><i></i></label></div>
    ${w.captions ? (sc ? `
    <label class="rv-f">Scene ${i + 1} — ${esc(sc.room || "Scene")}<input id="rvSceneText" value="${esc(sc.caption || "")}" maxlength="60" placeholder="${esc(sc.room || "Scene Text")}"></label>
    <div class="rv-inline">
      <button class="btn btn-ghost btn-sm" id="rvSuggestLabels"><i data-lucide="wand"></i>Suggest Labels</button>
      <button class="btn btn-ghost btn-sm" id="rvCapAll">Use Room Names Everywhere</button>
    </div>
    <details class="rv-adv-d"><summary>On Screen Labels</summary>${labelEditor(sc, i)}</details>
    <div class="rv-note sm">Select A Thumbnail In The Timeline To Edit Another Scene.</div>`
      : `<div class="rv-note sm">Select A Scene To Add Text.</div>`)
      : `<div class="rv-note sm">Scene Text Is Off.</div>`}
  </section>

  <section class="rv-sec">
    <div class="rv-sec-h"><h4>Closing Title</h4>
      <label class="rv-switch sm"><input type="checkbox" data-br="outro" ${w.branding.outro ? "checked" : ""}><i></i></label></div>
    ${w.branding.outro ? `
    <div class="rv-note sm">${kit ? `Using ${esc(kit.name)}: ${esc([kit.contact_name, kit.phone, kit.email].filter(Boolean).join(" · ") || "No Contact Details Yet")}` : "Add A Brand Kit In Brand To Fill The Closing Card."}</div>
    <label class="rv-check"><input type="checkbox" data-br="cta" ${w.branding.cta ? "checked" : ""}> Call To Action${kit?.default_cta ? ` — ${esc(kit.default_cta)}` : ""}</label>
    <label class="rv-check"><input type="checkbox" data-br="contact" ${w.branding.contact ? "checked" : ""}> Contact Details</label>
    <button class="fb-link" data-sec="brand">Edit In Brand</button>` : `<div class="rv-note sm">No Closing Card.</div>`}
  </section>`;
}

/* ======================= AUDIO ======================= */
function stepAudio() {
  const w = S.wizard;
  if (!w.avatar) w.avatar = blankAvatarConfig();
  const tab = w.audioTab || "music";
  const title = w.title || w.propertyLabel || "";
  return `
  <div class="rv-seg">${[["music", "Music"], ["narration", "Narration"], ["presenter", "Presenter"]]
    .map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-atab="${id}">${n}</button>`).join("")}</div>

  ${tab === "music" ? `<section class="rv-sec">
    ${musicPicker("rvMusic", w.music)}
    <label class="rv-f">Volume<input type="range" id="rvVol" min="0" max="100" value="${Math.round(w.volume * 100)}"></label>
    <label class="rv-check"><input type="checkbox" id="rvBeat" ${w.beatSync ? "checked" : ""}> Beat Sync</label>
    ${w.music && w.music !== "none" ? `<button class="fb-link" id="rvMusicOff">Remove Track</button>` : ""}
  </section>` : ""}

  ${tab === "narration" ? `<section class="rv-sec">
    <div class="rv-seg tiny">${[["none", "None"], ["generate", "Generate"], ["upload", "Upload"]]
      .map(([id, n]) => `<button class="${w.narration === id ? "on" : ""}" data-nar="${id}">${n}</button>`).join("")}</div>
    ${w.narration === "generate" ? `<label class="rv-f">Script<textarea id="rvScript" rows="5">${esc(w.script || defaultScript())}</textarea></label>
    <label class="rv-f">Voice<select id="rvVoice">${["Professional", "Warm", "Conversational", "Luxury"].map((v) => `<option value="${v.toLowerCase()}" ${w.voice === v.toLowerCase() ? "selected" : ""}>${v}</option>`).join("")}${myVoiceOption(w.voice)}</select></label>
    <div class="rv-inline">${voiceStudioButton()}
      <button class="btn btn-ghost btn-sm" id="rvVoicePrev"><i data-lucide="volume-2"></i>${w.voicePreviewing ? "Stop Preview" : "Preview Voice"}</button></div>` : ""}
    ${w.narration === "upload" ? `<label class="rv-f">Voiceover File, MP3, M4A Or WAV<input type="file" id="rvNarFile" accept="audio/*"></label>
    <div class="rv-note sm">${w.narrationName ? `Using ${esc(w.narrationName)}.` : "Upload a recorded voiceover to mix over your music bed."}</div>` : ""}
    ${w.narration === "none" ? `<div class="rv-note sm">No Narration. Music Alone Carries The Video.</div>` : ""}
  </section>` : ""}

  ${tab === "presenter" ? `<section class="rv-sec">
    ${w.avatar?.enabled ? avatarSection(w.avatar, title) : `<div class="rv-note sm">A Presenter Speaks Over The Video On Camera. Narration Settings Still Apply.</div>
      <button class="btn btn-ghost btn-sm" id="rvPresOn"><i data-lucide="user-round"></i>Add A Presenter</button>`}
  </section>` : ""}`;
}

/* ======================= QUALITY ======================= */
export function qualityTier(id: string) {
  return qualityTierById(id);
}
function qualityCost(id: string) {
  return Math.round(CREDIT_COSTS.video * qualityTierById(id).costMultiplier);
}

function stepQuality() {
  const w = S.wizard;
  const scenes = w.scenes.length;
  const outs = outputFormats(w);
  const compat = qualityCompat(w);
  const lowest = lowestCompatibleQuality(scenes);

  const per = sceneDurations(scenes, w.length);
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const rows = [
    ["Scenes", `${scenes} · ${Math.round(per * scenes)}s`, "scenes"],
    ["Format", formatLabel(w.primaryFormat || DEFAULT_FORMAT), "scenes"],
    ["Titles", w.titles?.property === false ? "No Opening Title" : "Opening Title On", "titles"],
    ["Audio", w.music && w.music !== "none" ? "Music On" : w.narration && w.narration !== "none" ? "Narration Only" : "No Audio", "audio"],
    ["Brand", kit ? kit.name : "No Brand Kit", "brand"],
  ];
  return `<h3>Review &amp; Generate</h3>
  <p class="rv-hint">Everything Below Is What Will Be Created. Change Anything Before You Render.</p>
  <div class="rv-rev">${rows.map(([k, v, sec]) => `<div class="rv-rev-r"><span>${k}</span><b>${esc(String(v))}</b><button class="fb-link" data-sec="${sec}">Change</button></div>`).join("")}</div>
  <div class="rv-sub">Quality</div>
  <p class="rv-hint">Higher Tiers Render Sharper And Cost More Credits.</p>

  <div class="rv-qtiers">${QUALITY_TIERS.map((t) => {
    const c = getQualityCompatibility(t.id, scenes);
    return `<button class="rv-qtier ${w.quality === t.id ? "on" : ""} ${c.compatible ? "" : "off"}" data-qual="${t.id}" ${c.compatible ? "" : "disabled aria-disabled=\"true\""}>
      <b>${t.name}</b><em>${t.note}</em>
      <span class="mono">Up To ${t.maxScenes} Scenes · ${qualityCost(t.id)} Credits</span>
      ${c.compatible ? "" : `<i class="rv-qover">${esc(c.reason)}</i>`}
    </button>`;
  }).join("")}</div>

  ${compat.compatible ? "" : `<div class="rv-qfix">
    <p>${esc(compat.reason)} Nothing Is Removed Until You Choose.</p>
    <div class="rv-qfix-a">
      ${lowest ? `<button class="btn btn-primary btn-sm" id="rvKeepAll">Keep All ${scenes} Scenes</button>` : ""}
      <button class="btn btn-ghost btn-sm" id="rvShorten">Shorten Video</button>
    </div>
    ${lowest ? `<div class="rv-note sm">Keeping Every Scene Switches Quality To ${lowest.name}.</div>`
      : `<div class="rv-note sm">No Quality Tier Supports ${scenes} Scenes. Shorten The Video To Continue.</div>`}
  </div>`}

  <div class="rv-sub">Mode</div>
  <div class="rv-seg">${[["auto", "Auto"], ["advanced", "Advanced"]]
    .map(([id, n]) => `<button class="${(w.mode || "auto") === id ? "on" : ""}" data-mode="${id}">${n}</button>`).join("")}</div>
  <div class="rv-note sm">${(w.mode || "auto") === "auto"
    ? "Auto Picks Motion, Transitions And Pacing For You. Everything You Set Elsewhere Still Applies."
    : "Advanced Keeps Every Per Scene Choice You Made Exactly As You Set It."}</div>

  <div class="rv-sub">Video Format</div>
  <div class="rv-fmt-sum"><b>${esc(formatLabel(w.primaryFormat || DEFAULT_FORMAT))}</b>
    <button class="fb-link" data-sec="scenes">Change In Select &amp; Order</button></div>

  <div class="rv-sub">Additional Versions</div>
  <div class="rv-seg wrap">${VIDEO_FORMATS.filter((f) => f.id !== (w.primaryFormat || DEFAULT_FORMAT))
    .map((f) => `<button class="${(w.additionalFormats || []).includes(f.id) ? "on" : ""}" data-addfmt="${f.id}">Also Create ${f.label}</button>`).join("")}</div>
  <div class="rv-note sm">Rendering ${outs.length} Version${outs.length === 1 ? "" : "s"}: ${esc(outs.join(", "))}.</div>

  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button></div>`;
}

/* Scenes the shorten flow suggests dropping first: flagged photos, then
   near-duplicates, then the trailing scenes. Order is never rearranged. */
function recommendedRemovals(w, max) {
  const scenes = w.scenes || [];
  const over = scenes.length - max;
  if (over <= 0) return [];
  const scored = scenes.map((s, i) => {
    const a = (w.available || []).find((x) => x.key === s.key) || {};
    let penalty = 0;
    if ((a.flags || []).length) penalty += 100;
    if (a.dup) penalty += 50;
    return { key: s.key, i, penalty };
  });
  scored.sort((a, b) => b.penalty - a.penalty || b.i - a.i);
  return scored.slice(0, over).map((x) => x.key);
}

function shortenModalHtml() {
  const w = S.wizard;
  const max = qualityTierById(w.quality).maxScenes;
  const drop = new Set(w.shortenPicks || recommendedRemovals(w, max));
  const keep = w.scenes.length - drop.size;
  const ok = keep > 0 && keep <= max;
  return `<div class="rv-modal on" id="rvShortWrap"><div class="rv-modal-in rv-modal-lg" role="dialog" aria-label="Shorten video">
    <div class="rv-modal-h"><b>Shorten Video</b><button class="icon-btn" id="rvShortX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">
      <p>Your Video Contains <b class="mono">${w.scenes.length}</b> Scenes. ${esc(qualityTierById(w.quality).name)} Allows <b class="mono">${max}</b>.
      Scenes Marked Below Are Recommended For Removal. Nothing Is Removed Until You Confirm.</p>
      <div class="rv-shortlist">${w.scenes.map((s, i) => `
        <label class="rv-shortrow ${drop.has(s.key) ? "drop" : ""}">
          <input type="checkbox" data-shortkeep="${esc(s.key)}" ${drop.has(s.key) ? "" : "checked"}>
          <span class="mono">${i + 1}</span>
          <b>${esc(s.room || "Scene")}</b>
          <em>${drop.has(s.key) ? "Recommended For Removal" : "Keep"}</em>
        </label>`).join("")}</div>
      <div class="rv-note sm">Final Video: <b class="mono">${keep}</b> Scene${keep === 1 ? "" : "s"}${ok ? "" : keep > max ? ` — Still ${keep - max} Over The Limit.` : " — Keep At Least One Scene."}</div>
    </div>
    <div class="rv-modal-f">
      <button class="btn btn-ghost" id="rvShortCancel">Cancel</button>
      <button class="btn btn-primary" id="rvShortSave" ${ok ? "" : "disabled"}>Save ${keep} Scene${keep === 1 ? "" : "s"}</button>
    </div>
  </div></div>`;
}

function plannedVariants() {
  const w = S.wizard;
  const mode = w.outputMode || "both";
  const versions = [];
  if (mode === "unbranded" || mode === "both") versions.push("clean");
  if (mode === "branded" || mode === "both") versions.push("branded");
  const out = [];
  for (const f of outputFormats(w)) {
    for (const v of versions) out.push({ aspect_ratio: f, version_type: v, brand_kit_id: v === "branded" ? w.brandKitId || null : null });
  }
  return out;
}

function vfxGenCredits() {
  return (S.wizard?.scenes || []).reduce((n, s) => n + (s.vfx_gen ? (tileById(s.vfx_gen)?.credits || 0) : 0), 0);
}
function creditTotal() {
  return qualityCost(S.wizard?.quality || "standard") + immersiveCount() * IMMERSIVE_CREDITS_PER_SCENE + vfxGenCredits();
}

/* Itemized cost so the number in the footer is never a mystery. AI clips are
   charged when they are generated, so they are listed as already paid rather
   than added to the render total again. */
function creditBreakdown() {
  const w = S.wizard || {};
  const rows = [];
  rows.push(["Video Render", qualityCost(w.quality || "standard")]);
  const imm = immersiveCount();
  if (imm) rows.push([`Immersive Motion · ${imm} ${imm === 1 ? "Scene" : "Scenes"}`, imm * IMMERSIVE_CREDITS_PER_SCENE]);
  const gen = vfxGenCredits();
  if (gen) {
    const n = (w.scenes || []).filter((x) => x.vfx_gen).length;
    rows.push([`AI Effects · ${n} ${n === 1 ? "Scene" : "Scenes"}`, gen]);
  }
  const clips = (w.scenes || []).filter((x) => x.use_clip && x.clip_id).length;
  return { rows, clips, clipCost: clips * ANIMATE_CREDITS_PER_CLIP, total: rows.reduce((n, r) => n + r[1], 0) };
}

/* ======================= PERSISTENT PREVIEW PANEL ======================= */
function previewPanel() {
  const w = S.wizard;
  const per = sceneDurations(w.scenes.length, w.length);
  const total = Math.round(per * w.scenes.length);
  const vs = plannedVariants();
  const cost = creditTotal();
  const bal = S.credits?.balance ?? window.__rdCredits?.balance;
  const block = videoCreditBlock(cost);
  const first = w.scenes[0];
  return `<div class="rv-preview">
    <div class="rv-stage" data-img="${esc(first?.path || "")}">${first ? "" : `<span class="rv-note sm">No Scenes Yet</span>`}</div>
    <div class="mono rv-meta">Scene 1 Of ${w.scenes.length || 0} · ${per ? per.toFixed(1) : "0.0"}s · ${total}s Total</div>
    <div class="rv-sub sm">Variants</div>
    <div class="rv-vars">${vs.length ? vs.map((v) => `<div><span class="mono">${esc(v.aspect_ratio)}</span><i>${v.version_type === "clean" ? "Unbranded" : v.version_type === "branded" ? "Branded" : "Disclosure Ready"}</i><b>Queued</b></div>`).join("") : `<div class="rv-note sm">Pick A Format.</div>`}</div>
    <div class="rv-bill">
      ${creditBreakdown().rows.map(([n, v]) => `<div><span>${esc(n)}</span><b class="mono">${v}</b></div>`).join("")}
      <div class="rv-bill-t"><span>Total To Render</span><b class="mono">${cost} Credits</b></div>
      ${creditBreakdown().clips ? `<div class="rv-bill-n">${creditBreakdown().clips} AI ${creditBreakdown().clips === 1 ? "Clip" : "Clips"} · ${creditBreakdown().clipCost} Credits Already Charged</div>` : ""}
      ${bal != null ? `<div class="rv-bill-n">Balance ${bal}${bal >= cost ? ` · ${bal - cost} After This Render` : ""}</div>` : ""}
    </div>
    ${block ? `<div class="rv-note sm">${esc(block)}</div>` : bal != null && bal < cost ? `<div class="rv-note sm">You Need ${cost - bal} More Credits To Render This Video.</div><button class="btn btn-ghost btn-sm" id="rvAddCredits2"><i data-lucide="zap"></i>Add Credits</button>` : ""}
    ${!qualityCompat(w).compatible ? `<div class="rv-note sm">${esc(qualityCompat(w).reason)} Choose A Compatible Quality Or Shorten The Video.</div>` : ""}
    ${!block && !browserRenderSupport().ok ? `<div class="rv-note sm">${esc(browserRenderSupport().reason)} Nothing Is Charged Until A Render Actually Starts.</div>` : ""}
    ${w.busy ? `<div class="rv-proc sm"><b>Creating Your Video</b>
      <div class="rv-prog"><i style="width:${Math.round(w.progress * 100)}%"></i></div>
      <span>${esc(w.stage || "Preparing scenes")}</span>
      <div class="rv-note sm">${esc(activeRenderProvider().runningNotice)}${
        runsInBackground()
          ? ""
          : " Your Video Is Created In This Browser Tab. Closing Or Refreshing This Tab Stops The Render — Your Project Is Saved And Your Credits Are Returned."
      }</div>
      <button class="btn btn-ghost btn-xs" id="rvCancelRender"${w.cancelling ? " disabled" : ""}><i data-lucide="x"></i>${w.cancelling ? "Stopping…" : "Stop Render"}</button></div>`
      : atReview(w)
        ? block
          ? `<button class="btn btn-primary rv-cta" id="rvAddCredits"><i data-lucide="zap"></i>Add Credits To Render</button>`
          : `${tabNoticeHtml()}<button class="btn btn-primary rv-cta" id="rvGen" ${vs.length && qualityCompat(w).compatible && browserRenderSupport().ok ? "" : "disabled"}><i data-lucide="clapperboard"></i>Generate Video</button>`

        : `<button class="btn btn-primary rv-cta" id="rvNext" ${stepReady() ? "" : "disabled"}>Continue</button>`}

  </div>`;
}


/* ======================= SCENE HELPERS ======================= */
/** True on the final Review step, whatever internal step number it carries. */
function atReview(w) {
  return Number(w?.step) === 7;
}

/** The browser renderer needs this tab: say so before the user commits. */
function tabNoticeHtml() {
  if (runsInBackground() || !browserRenderSupport().ok) return "";
  return `<div class="rv-note sm" id="rvTabNote">Your Video Is Created In This Browser Tab. Keep This Tab Open Until It Finishes — Closing Or Refreshing Stops The Render And Returns Your Credits.</div>`;
}

function assetToScene(a) {
  const w = S.wizard || {};
  const isBA = w.videoType === "before_after" || w.videoType === "renovation_vision";
  return {
    key: a.key,
    path: a.path,
    compare: isBA ? a.compare || null : null,
    room: a.room || UNSORTED,
    kind: a.kind,
    scene_type: isBA && a.compare ? "before_after" : a.kind === "Original" ? "original" : "design",
    duration: 3,
    motion: "auto",
    caption: "",
    disclosure: a.disclosure || null,
    asset_id: a.asset_id || null,
    version_id: a.version_id || null,
  };
}
function autoArrange() {
  const w = S.wizard;
  if (!w || !w.scenes) return;
  /* The grid is the order, so arranging sorts gridOrder and lets the scenes
     follow. Unselected photos travel with their room group. */
  const byKey = new Map((w.available || []).map((a) => [a.key, a]));
  /* Confirmed categories drive the order; unknown rooms keep their group rank
     and sort after the rooms we can actually name. */
  (w.gridOrder || []).sort((ka, kb) => {
    const a = byKey.get(ka);
    const b = byKey.get(kb);
    const ca = normalizeCategory(a?.room);
    const cb = normalizeCategory(b?.room);
    if (ca || cb) {
      const ra = arrangeRank(a?.room);
      const rb = arrangeRank(b?.room);
      if (ra !== rb) return ra - rb;
    }
    const ga = orderRank(a?.group || groupFor(a?.room || ""));
    const gb = orderRank(b?.group || groupFor(b?.room || ""));
    return ga - gb || String(a?.room || "").localeCompare(String(b?.room || ""));
  });
  syncSceneOrder();
}

/* ======================= GENERATION ======================= */
async function generate() {
  const w = S.wizard;
  const vs = plannedVariants();

  // A quality tier can never quietly drop selected scenes: block the render
  // and send the user back to the choice instead.
  const compat = qualityCompat(w);
  if (!compat.compatible) {
    w.step = 7;
    render();
    toast(compat.reason);
    return;
  }

  // The renderer runs in this tab: if this browser cannot encode, stop here.
  // Nothing is created and no credits are charged for a render that cannot run.
  const support = browserRenderSupport();
  if (!support.ok) {
    toast(support.reason);
    return;
  }

  // Preflight. Entitlement is decided before any row or render job exists, so
  // a render we already know cannot run never leaves a failed card behind.
  try {
    const fresh = await getMyCredits().catch(() => null);
    if (fresh) S.credits = fresh;
  } catch (_) {}
  const block = videoCreditBlock(creditTotal());
  if (block) {
    render();
    toast(block);
    openUpgrade(block);
    return;
  }

  w.busy = true;
  w.cancelling = false;
  w.progress = 0;
  w.stage = "Preparing scenes";
  RENDER_ABORT = typeof AbortController !== "undefined" ? new AbortController() : null;
  render();


  let projectId = null;
  try {
    const per = sceneDurations(w.scenes.length, w.length);
    const saved = await saveVideo({
      project: {
        property_id: w.propertyId || null,
        property_label: w.propertyLabel || null,
        ...addressColumns(w),
        title_touched: !!w.titleTouched,
        design_version_id: w.versionId || null,
        title: sanitizeTitle(defaultTitle(w)),
        video_type: w.videoType,
        source_type: w.sourceType || "property",
        status: "queued",
        formats: outputFormats(w),
        length_preset: w.length,
        transition: w.transition,
        motion: w.motion,
        brand_kit_id: w.brandKitId || null,
        branding: w.branding,
        disclosure: { mode: w.disclosureMode },
        settings: { baTransition: w.baTransition || "match", quality: w.quality || "standard", primaryFormat: w.primaryFormat || DEFAULT_FORMAT, additionalFormats: w.additionalFormats || [], mode: w.mode || "auto", titles: w.titles || null },
      },
      scenes: w.scenes.map((s, i) => ({
        source_asset_id: s.asset_id || null,
        source_version_id: s.version_id || null,
        source_path: s.path,
        compare_path: s.compare || null,
        room_name: s.room,
        sequence: i,
        scene_type: s.scene_type,
        duration: per,
        motion: s.motion || "auto",
        transition: w.transition,
        caption: w.captions ? s.caption || s.room : null,
        /* Text placement rides along in crop_data so it survives a reload
           without a schema change. */
        crop_data: { ...(s.crop_data || {}), caption_pos: s.caption_pos || "bottom", caption_style: s.caption_style || "brand" },
        disclosure_type: s.disclosure || null,
        motion_level: s.motion_level === "immersive" ? "immersive" : "standard",
        immersive_effect: s.motion_level === "immersive" ? s.immersive_effect || "light" : null,
        exterior_effect: s.exterior_effect || null,
        labels: Array.isArray(s.labels) ? s.labels.filter((l) => (l.text || "").trim()) : [],
        enhance: s.enhance || null,
      })),
      audio: {
        presentation_style: w.presentation,
        music_track_id: w.music,
        music_volume: w.volume,
        beat_sync: w.beatSync,
        narration_type: w.narration,
        narration_script: w.narration === "generate" ? w.script || defaultScript() : null,
        voice_id: w.voice,
        captions_enabled: !!w.captions,
      },
    });
    projectId = saved.id;

    const started = await startRender({
      id: projectId,
      variants: vs,
      quality: w.quality || "standard",
      scene_count: w.scenes.length,
      output_formats: outputFormats(w),
    });
    if (started.reused) {
      // A live job already owns this video: never charge or render twice.
      w.busy = false;
      toast("This Video Is Already Being Created In Another Tab.");
      await loadLibrary();
      S.screen = "library";
      render();
      return;
    }
    S.renderJobId = started.job?.id || null;
    await jobUpdate({ status: "rendering", progress: 0, stage: "Preparing scenes" });
    track?.("reveal_generate", { formats: outputFormats(w).join(","), scenes: w.scenes.length });
    await renderAllVariants(projectId, started.variants, w, null, RENDER_ABORT?.signal || null);
    await jobUpdate({ status: "completed", progress: 1, stage: "Finished" });
    S.renderJobId = null;
    await setVideoStatus({ id: projectId, status: "ready" });
    toast("Your Video Is Ready.");
    await loadLibrary();
    S.screen = "detail";
    S.detailId = projectId;
    await openDetail(projectId);
  } catch (e) {
    const cancelled = isRenderCancelled(e);
    const msg = cancelled ? "You stopped this render. Your credits were returned." : String(e?.message || e || "");
    const entitlement = isPlanBlocked(msg);
    if (projectId) {
      if (entitlement || cancelled) {
        // Nothing was produced: no half-finished card is left behind, and the
        // job row releases whatever was charged.
        try { await deleteVideo({ id: projectId }); } catch (_) {}
      } else {
        try { await setVideoStatus({ id: projectId, status: "failed", error_message: (msg || "The render did not finish.").slice(0, 300) }); } catch (_) {}
      }
    }
    if (S.renderJobId) {
      await jobUpdate({
        status: entitlement || cancelled ? "cancelled" : "failed",
        error_message: (msg || "The render did not finish.").slice(0, 300),
      });
      S.renderJobId = null;
    }
    toast(msg || "The render failed. Your credits were returned and your selections were saved.");
    if (entitlement) openUpgrade(msg);
    w.busy = false;
    w.cancelling = false;
    RENDER_ABORT = null;
    await loadLibrary();
    S.screen = entitlement ? "wizard" : "library";
    render();
  }

}

/* The job row is the durable record of a render. Progress is written through
   a throttled heartbeat: it keeps the status honest after a refresh and marks
   the job interrupted if this tab goes away mid-render. */
let JOB_BEAT = 0;
/** Set while this tab owns a render, so the user can stop it. */
let RENDER_ABORT = null;

/** Stops the encode in this tab and releases the credits held by the job. */
async function cancelRender() {
  const w = S.wizard;
  if (!w || !w.busy || w.cancelling) return;
  w.cancelling = true;
  render();
  try { RENDER_ABORT?.abort(); } catch (_) {}
  if (S.renderJobId) {
    try { await cancelRenderJob({ id: S.renderJobId, force: true }); } catch (_) {}
  }
}
async function jobUpdate(patch, throttleMs = 0) {
  if (!S.renderJobId) return;
  if (throttleMs) {
    const now = Date.now();
    if (now - JOB_BEAT < throttleMs) return;
    JOB_BEAT = now;
  }
  try {
    await updateRenderJob({ id: S.renderJobId, ...patch });
  } catch (_) {}
}

const STAGES = ["Preparing scenes", "Creating motion", "Building transitions", "Adding audio and captions", "Applying branding", "Finalizing formats"];

async function renderAllVariants(projectId, variants, cfg, perOverride, signal) {
  const w = cfg;
  const per = perOverride || sceneDurations(w.scenes.length, w.length);
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const urls = [];
  for (const s of w.scenes) {
    /* An approved AI clip replaces the still for this scene, and its real
       duration wins so the video never cuts a generated clip mid-move. */
    const clip = s.use_clip ? sceneClips.get(s.key) : null;
    const clipUrl = clip && clip.status === "completed" ? sceneClips.url(clip) : null;
    urls.push({
      url: await resolvePhotoUrl(s.path),
      clipUrl,
      clipSeconds: clipUrl ? clip?.seconds || null : null,
      compareUrl: s.compare ? await resolvePhotoUrl(s.compare) : null,
      room_name: s.room,
      scene_type: s.scene_type,
      duration: clipUrl && clip?.seconds ? clip.seconds : per,
      motion: s.motion || "auto",
      transition: s.scene_type === "before_after" ? (w.baTransition || "match") : w.transition,
      caption: w.captions ? s.caption || s.room : null,
      captionPos: s.caption_pos || "bottom",
      captionStyle: s.caption_style || "brand",
      disclosure_type: s.disclosure || null,
      motion_level: s.motion_level === "immersive" ? "immersive" : "standard",
      immersive_effect: s.motion_level === "immersive" ? s.immersive_effect || "light" : null,
      exterior_effect: s.exterior_effect || null,
      labels: Array.isArray(s.labels) ? s.labels.filter((l) => (l.text || "").trim()) : [],
      enhance: s.enhance || null,
    });
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const avTitle = w.title || w.propertyLabel || "";
  const narrationUrl = await buildNarration(w.narration, avatarScript(w.avatar, w.script || defaultScript(), avTitle), w.voice);
  const avatar = avatarRenderOption(w.avatar, avTitle);


  let done = 0;
  for (const v of variants) {
    if (signal?.aborted) throw new Error(RENDER_CANCELLED);
    const out = await renderReveal(urls, {
      signal: signal || null,
      aspect: v.aspect_ratio,
      versionType: v.version_type,
      brand: v.version_type === "branded" && kit
        ? {
            company_name: kit.company_name,
            contact_name: kit.contact_name,
            phone: w.branding.contact ? kit.phone : null,
            email: w.branding.contact ? kit.email : null,
            website: w.branding.contact ? kit.website : null,
            default_cta: w.branding.cta ? kit.default_cta : null,
            accent: kit.colors?.primary || null,
          }
        : null,
      title: w.title || w.propertyLabel || "",
      transition: w.transition,
      captionsEnabled: !!w.captions,
      music: w.music && w.music !== "none" ? w.music : null,
      narrationUrl,
      avatar,

      musicVolume: typeof w.volume === "number" ? w.volume : 0.6,
      onProgress: (p) => {
        S.wizard.progress = (done + p) / variants.length;
        S.wizard.stage = STAGES[Math.min(STAGES.length - 1, Math.floor(p * STAGES.length))];
        const bar = host()?.querySelector(".rv-prog i");
        const lab = host()?.querySelector(".rv-proc span");
        if (bar) bar.style.width = Math.round(S.wizard.progress * 100) + "%";
        if (lab) lab.textContent = S.wizard.stage;
        void jobUpdate({ status: "rendering", progress: Math.min(1, S.wizard.progress), stage: S.wizard.stage }, 5000);
      },
    });

    const base = `${uid}/${projectId}/${v.id}`;
    const videoPath = `${base}.${out.ext}`;
    const up = await supabase.storage.from(BUCKET).upload(videoPath, out.blob, {
      contentType: out.blob.type || "video/webm",
      upsert: true,
    });
    if (up.error) throw new Error(up.error.message);
    let thumbPath = null;
    try {
      const posterBlob = await (await fetch(out.poster)).blob();
      thumbPath = `${base}.jpg`;
      await supabase.storage.from(BUCKET).upload(thumbPath, posterBlob, { contentType: "image/jpeg", upsert: true });
    } catch (_) { thumbPath = null; }

    await finishVariant({
      variant_id: v.id,
      render_status: "ready",
      output_path: videoPath,
      thumbnail_path: thumbPath,
      duration: out.duration,
      resolution: v.aspect_ratio === "16:9" ? "1920x1080" : "1080x1920",
    });
    done += 1;
  }
}

/* ======================= DETAIL ======================= */
async function openDetail(id) {
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
    toast("This Video Draft Is No Longer Available. Create A New Video To Try Again.");
    S.screen = "library";
    render();
    return;
  }
  S.screen = "detail";
  S.detailId = id;
  S.detail = null;
  render();
  try {
    S.detail = await getVideo({ id });
  } catch (e) {
    toast(e?.message || "Could not open that video.");
    S.screen = "library";
  }
  render();
  if (S.detail) mountPlayer();
}

async function mountPlayer() {
  const d = S.detail;
  if (!d) return;
  const sel = host()?.querySelector("#rvPlayer");
  if (!sel) return;
  const fmt = S.playFormat || d.variants[0]?.aspect_ratio;
  const ver = S.playVersion || d.variants[0]?.version_type;
  const v = d.variants.find((x) => x.aspect_ratio === fmt && x.version_type === ver) || d.variants[0];
  if (!v?.output_path) { sel.innerHTML = `<div class="rv-note">No Rendered Output Yet.</div>`; return; }
  const url = await signed(v.output_path);
  sel.innerHTML = url ? `<video src="${url}" controls playsinline></video>` : `<div class="rv-note">Could Not Load The Video.</div>`;
}

function detailHtml() {
  const d = S.detail;
  if (!d) return `<div class="rv-note">Loading…</div>`;
  const p = d.project;
  const fmts = Array.from(new Set(d.variants.map((v) => v.aspect_ratio)));
  const vers = Array.from(new Set(d.variants.map((v) => v.version_type)));
  const tab = S.detailTab;
  let body = "";
  if (tab === "video") {
    body = `<div class="rv-player" id="rvPlayer"></div>
    <div class="rv-seg">${fmts.map((f) => `<button class="${(S.playFormat || fmts[0]) === f ? "on" : ""}" data-pf="${f}">${f}</button>`).join("")}</div>
    <div class="rv-seg">${vers.map((v) => `<button class="${(S.playVersion || vers[0]) === v ? "on" : ""}" data-pv="${v}">${v === "disclosure" ? "Disclosure Ready" : v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div>`;
  }
  if (tab === "scenes") {
    body = `<div class="rv-strip">${d.scenes.map((s, i) => `<div class="rv-sc"><span class="rv-seq">${i + 1}</span><span class="rv-a-th" data-img="${esc(s.source_path)}"></span><b>${esc(s.room_name || "")}</b><i>${s.scene_type === "before_after" ? "Before & After" : s.scene_type}</i></div>`).join("")}</div>`;
  }
  if (tab === "captions") {
    body = `<div class="rv-adv">${d.scenes.map((s) => `<div class="rv-f"><span>${esc(s.room_name || "")}</span><b>${esc(s.caption || "No Caption")}</b></div>`).join("")}</div>`;
  }
  if (tab === "details") {
    body = `<div class="rv-review">
      <div><span>Property</span><b>${esc(p.property_label || "None")}</b></div>
      <div><span>Video Type</span><b>${esc(VIDEO_TYPES.find((t) => t.id === p.video_type)?.name || "")}</b></div>
      <div><span>Scenes</span><b>${d.scenes.length}</b></div>
      <div><span>Formats</span><b>${esc((p.formats || []).join(", "))}</b></div>
      <div><span>Disclosure</span><b>${esc(Array.from(new Set(d.scenes.map((s) => s.disclosure_type).filter(Boolean).map((k) => DISCLOSURE_LABEL[k]))).join(", ") || "None Required")}</b></div>
      <div><span>Created</span><b>${fmtDate(p.created_at)}</b></div>
    </div>`;
  }
  if (tab === "presentation") body = presentationHtml(d);



  return `<div class="rv-head">
    <div><h2>${esc(p.title)}</h2><p>${esc(p.property_label || "No Property Linked")} • ${statusOf(p)} • ${fmtDate(p.created_at)}</p></div>
    <div class="rv-head-a">
      <button class="btn btn-ghost" id="rvBackLib"><i data-lucide="arrow-left"></i>Library</button>
      <button class="btn btn-ghost" id="rvDl"><i data-lucide="download"></i>Download</button>
      <button class="btn btn-ghost" id="rvShare"><i data-lucide="share-2"></i>Share</button>
      <button class="btn btn-primary" id="rvEdit"><i data-lucide="pencil"></i>Edit</button>
    </div>
  </div>
  ${p.status === "failed" ? `<div class="rv-fail"><b>${planBlockedMsg(p) ? "Not Enough Credits To Render" : "This Render Failed"}</b><span>${esc(planBlockedMsg(p) ? "This Video Was Never Rendered And Nothing Was Charged. Add Credits, Then Try Again." : p.error_message || "The render did not finish.")}</span>
    <div>${planBlockedMsg(p)
      ? `<button class="btn btn-primary btn-sm" id="rvUpgrade"><i data-lucide="zap"></i>Add Credits</button><button class="btn btn-ghost btn-sm" id="rvRetry">Try Again</button><button class="btn btn-ghost btn-sm" id="rvEdit2">Change Settings</button>`
      : `<button class="btn btn-primary btn-sm" id="rvRetry">Try Again</button><button class="btn btn-ghost btn-sm" id="rvEdit2">Change Settings</button><a class="btn btn-ghost btn-sm" href="/contact">Contact Support</a>`}</div></div>` : ""}

  <div class="rv-tabs">${[["video", "Video"], ["scenes", "Scenes"], ["captions", "Captions"], ["presentation", "Presentation"], ["details", "Details"]]
    .map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-tab="${id}">${n}</button>`).join("")}</div>
  <div class="rv-detail">${body}</div>`;
}

const PRES_TYPES: Array<[string, string]> = [
  ["listing", "Listing Presentation"],
  ["design", "Design Presentation"],
  ["renovation", "Renovation Presentation"],
  ["portfolio", "Portfolio Piece"],
];
const PRES_SECTIONS: Array<[string, string]> = [
  ["address", "Property Address"],
  ["video", "Video Walkthrough"],
  ["before_after", "Before And After"],
  ["rooms", "Room Gallery"],
  ["budget", "Planning Ranges"],
  ["products", "Product List"],
  ["brand", "Brand Header"],
  ["contact", "Contact Details"],
];

/** Presentation page settings for one video. */
function presentationHtml(d) {
  const sh = d.share || {};
  const sec = sh.sections || {};
  const secOn = (k) => (sec[k] === undefined ? !["budget", "products"].includes(k) : !!sec[k]);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const live = sh.slug || sh.token;
  return `<div class="rv-pres">
    <div class="rv-sub">Presentation Type</div>
    <div class="rv-seg wrap">${PRES_TYPES.map(([v, n]) => `<button class="${(sh.presentation_type || "listing") === v ? "on" : ""}" data-ptype="${v}">${n}</button>`).join("")}</div>

    <label class="rv-f">Page Headline<input id="pr_head" value="${esc(sh.headline || d.project.title || "")}" maxlength="120"></label>
    <label class="rv-f">Custom Link Name<span class="rv-pre">${esc(origin)}/v/</span><input id="pr_slug" value="${esc(sh.slug || "")}" placeholder="oak-street-listing"></label>

    <div class="rv-sub">Sections</div>
    <div class="rv-adv rv-secs">${PRES_SECTIONS.map(([k, n]) => `<label class="rv-check"><input type="checkbox" data-psec="${k}" ${secOn(k) ? "checked" : ""}> ${n}</label>`).join("")}</div>

    <div class="rv-sub">Access</div>
    <label class="rv-check"><input type="checkbox" id="pr_pw_on" ${sh.password_hash ? "checked" : ""}> Require A Password</label>
    <label class="rv-f">Password<input id="pr_pw" type="password" placeholder="${sh.password_hash ? "Saved, Type To Replace" : "Set A Password"}"></label>
    <label class="rv-check"><input type="checkbox" id="pr_dl" ${sh.allow_download !== false ? "checked" : ""}> Allow Downloads</label>
    <label class="rv-check"><input type="checkbox" id="pr_appr" ${sh.approval_enabled ? "checked" : ""}> Collect Approvals & Comments</label>

    <div class="rv-sub">Mobile Layout</div>
    <div class="rv-seg">${[["stacked", "Stacked"], ["compact", "Compact"]].map(([v, n]) => `<button class="${(sh.mobile_layout || "stacked") === v ? "on" : ""}" data-pmob="${v}">${n}</button>`).join("")}</div>

    ${live ? `<div class="rv-note sm">Live At <a href="/v/${esc(live)}" target="_blank" rel="noreferrer">${esc(origin)}/v/${esc(live)}</a></div>` : ""}
    <div class="rv-foot">
      ${live ? `<button class="btn btn-ghost" id="prCopy"><i data-lucide="link"></i>Copy Link</button>` : ""}
      <button class="btn btn-primary" id="prSave">Save Presentation Page</button>
    </div>
  </div>`;
}



/* ======================= THUMB PAINTING ======================= */
/* One resolve per storage path for the whole surface: the same photo shows up
   in Available, Scenes, the scene card, the popover preview and the stage. */
const IMG_URLS = new Map();
function cachedPhotoUrl(path) {
  if (!path) return Promise.resolve(null);
  if (IMG_URLS.has(path)) return IMG_URLS.get(path);
  const p = Promise.resolve()
    .then(() => resolvePhotoUrl(path))
    .catch(() => null)
    .then((url) => {
      /* Never cache a failure: an expired signed URL must be retried. */
      if (!url) IMG_URLS.delete(path);
      return url;
    });
  IMG_URLS.set(path, p);
  return p;
}

let thumbObserver: IntersectionObserver | null = null;

/** Sign and paint one element. The painted guard is what stops a failed
    tile from retrying forever. */
async function paintOneThumb(el) {
  if (el.dataset.painted) return true;
  const path = el.getAttribute("data-img");
  if (!path) return true;
  const url = await cachedPhotoUrl(path);
  if (url) {
    el.style.backgroundImage = `url("${url}")`;
    el.classList.remove("rv-noimg");
    el.dataset.painted = "1";
    return true;
  }
  if (!el.querySelector(".rv-noimg-i")) {
    el.insertAdjacentHTML("beforeend", `<i class="rv-noimg-i" data-lucide="image-off"></i>`);
  }
  el.classList.add("rv-noimg");
  paint();
  return false;
}

/* Full size tiles are expensive to sign and fetch, so only the ones near the
   viewport ask for a URL. */
async function paintAssetThumbs() {
  const els = Array.from(host()?.querySelectorAll("[data-img]") || []);
  if (thumbObserver) { thumbObserver.disconnect(); thumbObserver = null; }
  if (typeof IntersectionObserver === "undefined") {
    await Promise.all(els.map((el) => paintOneThumb(el)));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      paintOneThumb(en.target).then((ok) => { if (ok) io.unobserve(en.target); });
    }
  }, { rootMargin: "400px" });
  thumbObserver = io;
  els.forEach((el) => { if (!el.dataset.painted) io.observe(el); });
}

/* ======================= RENDER + EVENTS ======================= */
function render() {
  const el = host();
  if (!el) return;
  // A screen can only stay open while its state object exists; otherwise the
  // step renderers dereference null and the whole view crashes.
  if (S.screen === "wizard" && !S.wizard) S.screen = "library";
  if (S.screen === "design") S.screen = "library";
  if (S.screen === "detail" && !S.detail) S.screen = "library";
  /* Step 3 folded into step 2; old deep links must not land on nothing. */
  if (S.wizard && S.wizard.step === 3) S.wizard.step = 2;
  /* The builder has its own step navigation, so from Select & Order onward the
     main app rail is borrowed (collapsed without touching the saved
     preference) and released when the workflow closes. */
  try {
    const railApi = (window as any).__rdRailBorrow;
    if (railApi) {
      if (S.screen === "wizard" && S.wizard && S.wizard.step >= 2) railApi.collapse();
      else if (S.screen !== "wizard") railApi.release();
    }
  } catch (_) {}
  el.innerHTML =
    S.screen === "wizard" ? wizardHtml() : S.screen === "detail" ? detailHtml() : libraryHtml();
  paint();
  paintAssetThumbs();

  if (S.screen === "wizard" && S.wizard) autosaveWizard(S.wizard);
  if (S.screen !== "wizard") stopWizardAutosave();
  if (S.screen === "library") paintThumbs();
  if (S.screen === "detail" && S.detail) mountPlayer();
  bind();

}

function bind() {
  const el = host();
  if (!el) return;
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
  if (S.screen === "wizard" && S.wizard) bindAnimate(el, S.wizard, render);

  /* library */
  on("#rvNew, #rvNew2", "click", () => startWizard({}));
  on(".rv-chip", "click", (e) => { S.filter = e.currentTarget.dataset.f; renderList(); });
  const q = el.querySelector("#rvQ");
  /* Only the result list is repainted so the focused input and the thumbnails
     never get torn down mid-typing. */
  if (q) q.addEventListener("input", (e) => { S.q = e.target.value; renderList(); });
  bindCards(el);

  /* wizard */
  const w = S.wizard;
  if (w) {
  on("#rvExitBuilder", "click", () => { void exitBuilder(w); });
  on("#rvExitRetry", "click", () => { void exitBuilder(w); });
  on("#rvExitLeave", "click", () => { w.exitModal = null; leaveBuilder(w); });
  on("#rvExitX", "click", () => { w.exitModal = null; render(); });
  on("#rvDeleteDraft", "click", () => { w.deleteModal = { alsoPhotos: false, busy: false }; render(); });
  on("#rvDelX, #rvDelKeep", "click", () => { w.deleteModal = null; render(); });
  on("#rvDelPhotos", "change", (e) => { w.deleteModal = { ...(w.deleteModal || {}), alsoPhotos: !!e.currentTarget.checked }; });
  on("#rvDelGo", "click", () => { void confirmDeleteDraft(w); });
  on("#rvBack", "click", () => { w.step = prevStep(w.step); render(); });
  on(".rv-rail-i", "click", async (e) => {
    const key = e.currentTarget.dataset.sec;
    if (!key || !sectionReady(key)) return;
    w.step = stepForSection(key);
    if (key === "scenes") await loadWizardAssets();
    if (S.wizard !== w) return;
    render();
  });
  on("#rvNext", "click", async () => {
    const t = el.querySelector("#rvTitle");
    if (t) w.title = sanitizeTitle(t.value);
    if (w.step === 1) {
      await advanceToGrid(w);
      return;
    }
    if (w.step === 2) {
      if (w.scenes.length < 5 && !w.lowWarned) { w.lowWarned = true; w.lowModal = true; render(); return; }
      /* Video type follows the content unless the user already changed it. */
      if (!w.typeTouched) {
        const ba = w.scenes.filter((s) => s.compare).length;
        w.videoType = ba > w.scenes.length / 2 ? "before_after" : "property_tour";
      }
    }
    w.step = nextStep(w.step);
    render();
  });
  /* Titles section */
  on("[data-tt]", "change", (e) => {
    const k = e.currentTarget.dataset.tt;
    w.titles = w.titles || { property: true, contact: true, custom: [] };
    w.titles[k] = !!e.currentTarget.checked;
    render();
  });
  const ttHead = el.querySelector("#rvTtHead");
  if (ttHead) ttHead.addEventListener("input", (ev) => { w.titles.headline = ev.target.value; });
  const ttSub = el.querySelector("#rvTtSub");
  if (ttSub) ttSub.addEventListener("input", (ev) => { w.titles.sub = ev.target.value; });
  on("#rvTtAdd", "click", () => {
    w.titles.custom = (w.titles.custom || []).concat("");
    render();
  });
  el.querySelectorAll("[data-tcustom]").forEach((i) =>
    i.addEventListener("input", (ev) => { w.titles.custom[Number(ev.target.dataset.tcustom)] = ev.target.value; }));
  on("[data-tcustom-del]", "click", (e) => {
    w.titles.custom.splice(Number(e.currentTarget.dataset.tcustomDel), 1);
    render();
  });
  /* Quality section */
  on("[data-qual]", "click", (e) => {
    const id = e.currentTarget.dataset.qual;
    if (!getQualityCompatibility(id, w.scenes.length).compatible) return;
    w.quality = id;
    render();
  });
  on("#rvKeepAll", "click", () => {
    const t = lowestCompatibleQuality(w.scenes.length);
    if (!t) return;
    w.quality = t.id;
    toast(`Quality Set To ${t.name} So All ${w.scenes.length} Scenes Are Kept.`);
    render();
  });
  on("#rvShorten", "click", () => {
    w.shortenPicks = recommendedRemovals(w, qualityTierById(w.quality).maxScenes);
    w.shortenModal = true;
    render();
  });
  const closeShorten = () => { w.shortenModal = false; w.shortenPicks = null; render(); };
  on("#rvShortX", "click", closeShorten);
  on("#rvShortCancel", "click", closeShorten);
  el.querySelectorAll("[data-shortkeep]").forEach((box) =>
    box.addEventListener("change", (ev) => {
      const key = ev.target.dataset.shortkeep;
      const picks = new Set(w.shortenPicks || []);
      if (ev.target.checked) picks.delete(key);
      else picks.add(key);
      w.shortenPicks = Array.from(picks);
      render();
    }));
  on("#rvShortSave", "click", () => {
    const drop = new Set(w.shortenPicks || []);
    if (!drop.size) { closeShorten(); return; }
    w.scenes = w.scenes.filter((s) => !drop.has(s.key));
    syncSceneOrder();
    w.shortenModal = false;
    w.shortenPicks = null;
    w.step = 2;
    toast(`Video Shortened To ${w.scenes.length} Scene${w.scenes.length === 1 ? "" : "s"}.`);
    render();
  });
  on("[data-mode]", "click", (e) => { w.mode = e.currentTarget.dataset.mode; render(); });

  on("#rvLowX", "click", () => { w.lowModal = false; render(); });
  on("#rvLowMore", "click", () => { w.lowModal = false; w.step = 1; render(); });
  on("#rvLowGo", "click", () => { w.lowModal = false; w.step = nextStep(2); render(); });


  const titleIn = el.querySelector("#rvTitle");
  if (titleIn) {
    /* Typing marks the title as user-owned; the address can never overwrite it
       again. A blank field never blocks saving — the fallback covers it. */
    titleIn.addEventListener("input", (ev) => { w.title = ev.target.value; w.titleTouched = true; });
    titleIn.addEventListener("blur", () => {
      w.title = sanitizeTitle(w.title);
      titleIn.value = defaultTitle(w);
      const note = titleIn.closest(".rv-sec, .rv-f")?.parentElement?.querySelector?.(".rv-sugt");
      if (note && !titleSuggestion(w)) note.remove();
      autosaveAddress(w);
    });
  }
  on("[data-usetitle]", "click", () => {
    const s = titleSuggestion(w);
    if (!s) return;
    w.title = s;
    w.titleTouched = true;
    render();
    autosaveAddress(w);
  });

  bindAddressInputs(el, w);
  on("[data-rmup]", "click", (e) => {
    const id = e.currentTarget.dataset.rmup;
    const gone = (w.uploads || []).find((u) => u.id === id);
    if (gone?.url?.startsWith?.("blob:")) { try { URL.revokeObjectURL(gone.url); } catch (_) {} }
    w.uploads = w.uploads.filter((u) => u.id !== id);
    w.available = (w.available || []).filter((a) => a.key !== "u-" + id);
    w.gridOrder = (w.gridOrder || []).filter((key) => key !== "u-" + id);
    w.scenes = (w.scenes || []).filter((scene) => scene.key !== "u-" + id);
    render();
  });
  /* Intake lives in @/lib/video-upload-intake so the Step 1 -> Step 2
     transition can be exercised without a DOM. */
  const addUploads = (list) => acceptPhotos(w, list, w.step === 1 ? "picker" : "picker_step2");
  on("[data-failrm]", "click", (e) => { (w.uploadFails || []).splice(Number(e.currentTarget.dataset.failrm), 1); render(); });
  on("[data-failretry]", "click", (e) => {
    const i = Number(e.currentTarget.dataset.failretry);
    const entry = (w.uploadFails || [])[i];
    if (!entry) return;
    w.uploadFails.splice(i, 1);
    addUploads(entry.file ? [entry.file] : []).catch(() => {
      w.uploadError = "That photo could not be added. Please try again.";
      render();
    });
  });
  el.querySelectorAll(".rv-thumb[draggable='true']").forEach((thumb) => {
    thumb.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/rd-upload", thumb.dataset.uploadId));
    thumb.addEventListener("dragover", (e) => { e.preventDefault(); thumb.classList.add("drop-l"); });
    thumb.addEventListener("dragleave", () => thumb.classList.remove("drop-l"));
    thumb.addEventListener("dragend", () => thumb.classList.remove("drop-l"));
    thumb.addEventListener("drop", (e) => {
      e.preventDefault();
      thumb.classList.remove("drop-l");
      const from = e.dataTransfer.getData("text/rd-upload");
      const to = thumb.dataset.uploadId;
      const fromIndex = w.uploads.findIndex((upload) => upload.id === from);
      const toIndex = w.uploads.findIndex((upload) => upload.id === to);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      const [moved] = w.uploads.splice(fromIndex, 1);
      w.uploads.splice(toIndex, 0, moved);
      render();
    });
  });
  /* A stray drop outside a dropzone must never navigate away from the app. */
  if (!window.__rvDropGuard) {
    window.__rvDropGuard = true;
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
  }
  const useDesign = async (roomId) => {
    const d = designChoices().find((x) => x.roomId === roomId);
    if (!d) return;
    w.sourceType = "design";
    w.propertyId = d.propertyId;
    w.propertyLabel = d.propertyLabel;
    /* A design carries its property association into the video. */
    if (d.propertyLabel) applyAddress(w, d.propertyLabel, "inherited");
    w.versionId = d.versionId;
    if (!w.titleTouched) w.title = defaultTitle(w) || `${d.room} Design`;
    if (d.before && !w.typeTouched) w.videoType = "before_after";
    await loadWizardAssets();
    const a = w.available.find((x) => x.key === "d-" + d.roomId) || w.available.find((x) => x.path === d.after);
    w.scenes = a ? [assetToScene(a)] : [];
    /* One design, nothing to select, so Step 2 is skipped. */
    w.step = 3;
    render();
  };
  /* Step 1 uses the one shared source picker, mounted fresh on every paint. */
  const slot = el.querySelector("#rvPicker");
  if (slot) {
    mountSourcePicker(slot, {
      context: "video",
      esc,
      lucide: { createIcons: () => paint() },
      initialTab: w.sourceType || "upload",
      onTab: (t) => { w.sourceType = t; },
      properties: () =>
        S.tree.map((p) => {
          const rooms = (p.projects || []).reduce(
            (a, pr) => a + ((pr.rooms || []) as any[]).filter((r: any) => !!r.before_path).length,
            0,
          );
          const assets = Number(p.asset_count || 0);
          return {
            address: p.address,
            meta: (() => { const n = rooms || assets; return n ? `${n} ${n === 1 ? "Photo" : "Photos"}` : "No Photos Yet"; })(),
          };
        }),
      designs: () =>
        designChoices().map((d) => ({
          id: d.roomId,
          label: d.room,
          sub: `${d.propertyLabel} · ${d.before ? "Before And After" : "Design"}`,
        })),
      onPick: async (picked) => {
        try {
          await addUploads(picked.map((p) => p.file).filter(Boolean));
        } catch (_) {
          w.uploadError = "Your photos were added, but the next step could not load. Please try again.";
          render();
        }
      },
      onProperty: (address) => {
        const p = S.tree.find((x) => x.address === address);
        w.propertyLabel = address;
        if (p) w.propertyId = p.id;
        /* Starting from an existing property prefills its address. */
        applyAddress(w, address, "existing_property");
        w.addressMatch = null;
        if (!w.titleTouched) w.title = defaultTitle(w);
        render();
      },
      onDesign: (id) => useDesign(id),
      showAlert: toast,
    });
  }
  on("[data-type]", "click", (e) => { w.videoType = e.currentTarget.dataset.type; w.typeTouched = true; render(); });

  on("[data-type]", "click", (e) => { w.videoType = e.currentTarget.dataset.type; w.typeTouched = true; render(); });

  on("[data-asset]", "click", (e) => {
    const key = e.currentTarget.dataset.asset;
    const i = w.scenes.findIndex((s) => s.key === key);
    if (i >= 0) w.scenes.splice(i, 1);
    else {
      const a = w.available.find((x) => x.key === key);
      if (a) w.scenes.push(assetToScene(a));
    }
    syncSceneOrder();
    render();
  });
  on("[data-drop]", "click", (e) => { e.stopPropagation(); w.scenes.splice(Number(e.currentTarget.dataset.drop), 1); syncSceneOrder(); render(); });
  on("#rvSelAll", "change", (e) => {
    if (e.currentTarget.checked) w.scenes = (w.gridOrder || []).map((k) => w.available.find((a) => a.key === k)).filter(Boolean).map(assetToScene);
    else w.scenes = [];
    syncSceneOrder();
    render();
  });
  on("#rvReverse", "click", () => { w.gridOrder = (w.gridOrder || []).slice().reverse(); syncSceneOrder(); render(); });
  on("#rvResetOrder", "click", () => {
    const list = (w.gridOrder || []).map((k) => w.available.find((a) => a.key === k)).filter(Boolean);
    list.sort((a, b) => orderRank(a.group) - orderRank(b.group) || String(a.room || "").localeCompare(String(b.room || "")));
    w.gridOrder = list.map((a) => a.key);
    syncSceneOrder();
    render();
  });
  /* Header and notice shortcuts both reopen the picker step without losing work. */
  on("#rvHeadAdd", "click", () => el.querySelector("#rvHeadFile")?.click());
  on("#rvNoticeAdd", "click", () => el.querySelector("#rvHeadFile")?.click());
  on("#rvHeadFile", "change", (e) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = "";
    addUploads(files).catch(() => { w.uploadError = "Those photos could not be added. Please try again."; render(); });
  });
  on("#rvEnrichX", "click", () => { delete w.enrichNotice; render(); });
  on("#rvNoticeSelect", "click", () => { selectRecommendedGap(); render(); });
  on("#rvNoticeReview", "click", () => { document.querySelector(".rv-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  on("#rvNoticeX", "click", () => { w.frameNoticeDismissed = true; w.frameNoticeSig = noticeSignature(resolvedPhotos()); render(); });
  /* The warning pip is its own action; it must not toggle the tile under it. */
  on(".rv-tile .rv-flag", "click", (e) => e.stopPropagation());
  on(".rv-tile-th", "keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.currentTarget.click();
  });
  on("#rvRecommend", "click", () => { selectRecommended(); autoArrange(); render(); });
  on("#rvClear", "click", () => { w.scenes = []; syncSceneOrder(); render(); });
  on("#rvAuto", "click", () => { autoArrange(); render(); });
  on("#rvRedetect", "click", () => { redetectRooms(); render(); });
  on("#rvKeepBest", "click", () => {
    const seen = new Set();
    w.scenes = w.scenes.filter((s) => {
      const a = w.available.find((x) => x.key === s.key);
      const g = a?.dup;
      if (!g) return true;
      if (seen.has(g)) return false;
      seen.add(g);
      return true;
    });
    syncSceneOrder();
    render();
  });
  on("#rvKeepAll", "click", () => render());

  /* drag ordering */
  /* Every card reorders, selected or not, and across rows in either direction. */
  el.querySelectorAll(".rv-tile[draggable='true']").forEach((n) => {
    n.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", n.dataset.key);
      e.dataTransfer.effectAllowed = "move";
      n.classList.add("drag");
    });
    n.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; n.classList.add("drop-l"); });
    n.addEventListener("dragleave", () => n.classList.remove("drop-l"));
    n.addEventListener("dragend", () => { n.classList.remove("drop-l"); n.classList.remove("drag"); });
    n.addEventListener("drop", (e) => {
      e.preventDefault();
      n.classList.remove("drop-l");
      const from = e.dataTransfer.getData("text/plain");
      const to = n.dataset.key;
      if (!from || from === to) return;
      const order = w.gridOrder || [];
      const fi = order.indexOf(from);
      const ti = order.indexOf(to);
      if (fi < 0 || ti < 0) return;
      order.splice(fi, 1);
      order.splice(ti, 0, from);
      w.manualOrder = true;
      syncSceneOrder();
      render();
    });
  });

  /* setup */
  on("[data-primaryfmt]", "click", (e) => {
    const f = e.currentTarget.dataset.primaryfmt;
    w.primaryFormat = f;
    w.additionalFormats = (w.additionalFormats || []).filter((x) => x !== f);
    render();
  });
  on("[data-addfmt]", "click", (e) => {
    const f = e.currentTarget.dataset.addfmt;
    const list = (w.additionalFormats || []).filter((x) => x !== w.primaryFormat);
    w.additionalFormats = list.includes(f) ? list.filter((x) => x !== f) : list.concat(f);
    render();
  });
  on("[data-len]", "click", (e) => { w.length = e.currentTarget.dataset.len; render(); });
  /* scene chips and their popovers. Keyed by asset so a reorder underneath
     the open popover never retargets it at a different scene. */
  const cur = () => {
    if (!w.pop) return null;
    if (w.pop.key) return w.scenes.find((s) => s.key === w.pop.key) || null;
    return w.scenes[w.pop.i] || null;
  };
  on("[data-pop]", "click", (e) => {
    e.stopPropagation();
    const key = e.currentTarget.dataset.key || null;
    let i = key ? w.scenes.findIndex((s) => s.key === key) : Number(e.currentTarget.dataset.i);
    /* Acting on an unselected photo selects it, so every card keeps its tools. */
    if (i < 0 && key) {
      const a = w.available.find((x) => x.key === key);
      if (!a) return;
      w.scenes.push(assetToScene(a));
      syncSceneOrder();
      i = w.scenes.findIndex((s) => s.key === key);
    }
    if (i < 0) return;
    const kind = e.currentTarget.dataset.pop;
    w.pop = { kind, i, key };
    w.popQ = ""; w.popHover = null;
    if (kind === "look") {
      /* Snapshot so Cancel and Escape can put the scene back exactly. */
      const sc = w.scenes[i];
      w.pop.snap = fxSnap(sc);
      w.popTab = sc && sc.vfx && sc.vfx !== "none" ? "effects" : "looks";
      w.popCat = "recommended"; w.popAll = false; w.popConfirm = false;
    }
    if (kind === "cap" || kind === "motion") {
      /* Snapshot so Cancel restores exactly what the scene had. */
      const sc = w.scenes[i] || {};
      w.pop.snap = kind === "cap"
        ? { caption: sc.caption ?? "", caption_pos: sc.caption_pos || "bottom", caption_style: sc.caption_style || "brand" }
        : { motion: sc.motion || "auto", motion_level: sc.motion_level || "standard", immersive_effect: sc.immersive_effect || null };
    }
    render();
  });
  const closeFx = (commit) => {
    const s = cur();
    if (w.pop?.kind === "look") {
      if (commit) {
        if (w.popAll && s) {
          w.scenes.forEach((t) => {
            if (t === s) return;
            t.look = s.look || null; t.look_amount = s.look_amount ?? null;
            t.vfx = s.vfx || "none"; t.vfx_gen = s.vfx_gen || null;
            if (s.vfx_gen) { const tl = tileById(s.vfx_gen); if (tl?.disclosure) t.disclosure = tl.disclosure; }
            else if (w.pop.snap && !w.pop.snap.vfx_gen) t.disclosure = t.disclosure && tileById(t.vfx_gen || "") ? null : t.disclosure;
          });
          toast("Effect Applied To Every Scene.");
        }
      } else {
        fxRestore(s, w.pop.snap);
      }
    } else if ((w.pop?.kind === "cap" || w.pop?.kind === "motion") && !commit && s && w.pop.snap) {
      Object.assign(s, w.pop.snap);
    }
    w.pop = null; w.popAll = false; w.popConfirm = false;
    render();
  };
  on("#rvPopX, #rvPopCancel", "click", () => closeFx(false));
  on("#rvPopDone", "click", () => closeFx(true));
  const popWrap = el.querySelector("#rvPopWrap");
  if (popWrap) {
    popWrap.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); closeFx(false); return; }
      if ((ev.key === "Enter" || ev.key === " ") && ev.target?.classList?.contains("fx-card")) {
        ev.preventDefault(); ev.target.click();
      }
    });
    if (w.pop?.kind === "look") setTimeout(() => popWrap.querySelector(".fx-card.on, .fx-card")?.focus?.({ preventScroll: true }), 0);
  }
  const pq = el.querySelector("#rvPopQ");
  if (pq) pq.addEventListener("input", (ev) => { w.popQ = ev.target.value; render(); el.querySelector("#rvPopQ")?.focus(); });
  on("[data-motionpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.motion = e.currentTarget.dataset.motionpick;
    s.motion_level = "standard";
    s.immersive_effect = null;
    render();
  });
  on("[data-hover]", "mouseenter", (e) => {
    const id = e.currentTarget.dataset.hover;
    w.popHover = id;
    const clip = el.querySelector(".rv-pop-clip");
    if (!clip) return; // preview not mounted, nothing to repaint
    clip.className = `rv-pop-clip m-${MOTION_PREVIEW[id] || id || "auto"}`;
    const fx = el.querySelector(".rv-pop-fx"); if (fx) fx.className = fxClass(id);
    const nm = el.querySelector("#rvPopName"); if (nm) nm.textContent = motionName(id);
    const cp = el.querySelector("#rvPopCopy"); if (cp) cp.textContent = MOTION_COPY[id] || MOTION_COPY.auto;
  });

  on("[data-immpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.motion_level = "immersive";
    s.immersive_effect = e.currentTarget.dataset.immpick;
    render();
  });
  on("[data-extpick]", "click", (e) => { const s = cur(); if (!s) return; s.exterior_effect = e.currentTarget.dataset.extpick || null; render(); });
  on("[data-croppick]", "click", (e) => { const s = cur(); if (!s) return; s.crop = e.currentTarget.dataset.croppick; render(); });
  on("[data-fxtab]", "click", (e) => { w.popTab = e.currentTarget.dataset.fxtab; w.popCat = "all"; render(); });
  on("[data-fxcat]", "click", (e) => { w.popCat = e.currentTarget.dataset.fxcat; render(); });
  /* Base disclosure the scene carried before any generative effect. */
  const baseDisc = () => (w.pop?.snap && !w.pop.snap.vfx_gen ? w.pop.snap.disclosure : null);
  on("[data-lookpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.look = e.currentTarget.dataset.lookpick || null;
    s.vfx = "none"; s.vfx_gen = null; s.disclosure = baseDisc();
    if (s.look && s.look_amount == null) s.look_amount = DEFAULT_INTENSITY;
    render();
  });
  on("[data-vfxpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    const t = tileById(e.currentTarget.dataset.vfxpick);
    s.vfx = t?.id || "none";
    s.look = t?.look || null;
    s.vfx_gen = t?.gen ? t.id : null;
    if (t?.gen && t.disclosure) s.disclosure = t.disclosure;
    else s.disclosure = baseDisc();
    if (s.look && s.look_amount == null) s.look_amount = DEFAULT_INTENSITY;
    render();
  });
  const amt = el.querySelector("#rvLookAmt");
  if (amt) amt.addEventListener("input", (ev) => {
    const s = cur(); if (!s) return;
    s.look_amount = Number(ev.target.value);
    render();
    const again = el.querySelector("#rvLookAmt"); if (again) again.focus();
  });
  on("#rvAllMotion", "change", (e) => {
    if (!e.currentTarget.checked) return;
    const src = cur(); if (!src) return;
    w.scenes.forEach((s) => { s.motion = src.motion || "auto"; s.motion_level = src.motion_level || "standard"; s.immersive_effect = src.immersive_effect || null; });
    toast("Motion Applied To Every Scene.");
  });
  on("#rvAllLook", "click", () => {
    const src = cur(); if (!src) return;
    /* Paid effects confirm first; free looks apply straight away. */
    if (sceneEffectCredits(src) > 0) { w.popConfirm = true; render(); return; }
    w.popAll = true; render();
  });
  on("#rvAllNo", "click", () => { w.popConfirm = false; render(); });
  on("#rvAllYes", "click", () => { w.popAll = true; w.popConfirm = false; render(); });
  on("[data-tpl]", "click", (e) => { w.template = e.currentTarget.dataset.tpl; render(); });
  on("[data-out]", "click", (e) => {
    w.outputMode = e.currentTarget.dataset.out;
    w.versions.clean = w.outputMode !== "branded";
    w.versions.branded = w.outputMode !== "unbranded";
    render();
  });
  on("[data-tplscope]", "click", (e) => { w.tplScope = e.currentTarget.dataset.tplscope; render(); });
  on("[data-tplintro]", "click", (e) => { w.introTemplate = e.currentTarget.dataset.tplintro; w.template = w.introTemplate; render(); });
  on("[data-tploutro]", "click", (e) => { w.outroTemplate = e.currentTarget.dataset.tploutro; render(); });
  const sr = el.querySelector("#rvSpeedRamps"); if (sr) sr.addEventListener("change", (e) => { w.speedRamps = e.target.checked; });
  const lb = el.querySelector("#rvLogoBrand");
  if (lb) lb.addEventListener("change", (e) => { w.logoBranding = e.target.checked; w.branding.watermark = e.target.checked; });
  const ad = el.querySelector("#rvAiDisc"); if (ad) ad.addEventListener("change", (e) => { w.aiDisclaimer = e.target.checked; });
  const bd = el.querySelector("#rvBurnDisc"); if (bd) bd.addEventListener("change", (e) => { w.burnDisclosure = e.target.checked; });
  const pl = el.querySelector("#rvPickLogo"); if (pl) pl.addEventListener("click", (e) => { e.preventDefault(); w.logoModal = true; render(); });
  ["#rvLogoX", "#rvLogoCancel"].forEach((sel2) => {
    const b = el.querySelector(sel2); if (b) b.addEventListener("click", () => { w.logoModal = false; render(); });
  });
  const ldone = el.querySelector("#rvLogoDone");
  if (ldone) ldone.addEventListener("click", () => { w.logoModal = false; w.logoBranding = true; w.branding.watermark = true; render(); });
  const lup = el.querySelector("#rvLogoUp"); if (lup) lup.addEventListener("click", () => el.querySelector("#rvLogoFile")?.click());
  const lfile = el.querySelector("#rvLogoFile");
  if (lfile) lfile.addEventListener("change", async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    w.logoDataUrl = await fileToDataUrl(f);
    w.logoModal = false; w.logoBranding = true; w.branding.watermark = true;
    toast("Logo Added."); render();
  });
  on("[data-tr]", "click", (e) => { w.transition = e.currentTarget.dataset.tr; render(); });
  on("[data-ba]", "click", (e) => { w.baTransition = e.currentTarget.dataset.ba; render(); });

  /* room type selector */
  on("[data-roompick]", "click", (e) => {
    e.preventDefault(); e.stopPropagation();
    w.roomPick = { key: e.currentTarget.dataset.roompick };
    w.roomPickQ = "";
    render();
  });
  const closeRoom = () => { w.roomPick = null; w.roomPickQ = ""; render(); };
  on("#rvRoomX", "click", closeRoom);
  on("#rvRoomWrap", "mousedown", (e) => { if (e.target.id === "rvRoomWrap") closeRoom(); });
  const roomQ = el.querySelector("#rvRoomQ");
  if (roomQ) {
    roomQ.focus();
    const caret = roomQ.value.length;
    try { roomQ.setSelectionRange(caret, caret); } catch (_) {}
    roomQ.addEventListener("input", () => { w.roomPickQ = roomQ.value; render(); });
    roomQ.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRoom(); }
      if (e.key === "Enter") {
        e.preventDefault();
        const first = el.querySelector(".rv-roomopt");
        if (first) first.click();
      }
    });
  }
  on("[data-roomset]", "click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const key = w.roomPick?.key;
    const val = String(e.currentTarget.dataset.roomset || "").trim().slice(0, 60);
    if (!key || !val) return closeRoom();
    setRoomLabel(key, val, true);
    closeRoom();
  });

  const fixAll = el.querySelector("#rvFixAll");
  if (fixAll) fixAll.addEventListener("click", () => {
    const recs = recommendations(analysisAssets()).filter((r) => r.op);
    const byId = new Map();
    recs.forEach((r) => r.ids.forEach((id) => byId.set(id, r.op)));
    let n = 0;
    w.available.forEach((a) => { if (byId.has(a.key)) { a.enhance = byId.get(a.key); n++; } });
    w.scenes.forEach((sc) => { if (byId.has(sc.key)) sc.enhance = byId.get(sc.key); });
    w.enhanceDismissed = true;
    toast(`${n} ${n === 1 ? "Photo Will Be Enhanced" : "Photos Will Be Enhanced"} When The Video Renders.`);
    render();
  });
  const fixSkip = el.querySelector("#rvFixSkip");
  if (fixSkip) fixSkip.addEventListener("click", () => { w.enhanceDismissed = true; render(); });

  /* audio */
  on("[data-pres]", "click", (e) => {
    w.presentation = e.currentTarget.dataset.pres;
    w.captions = w.presentation === "captions" ? true : w.captions;
    if (w.presentation === "narration" || w.presentation === "both") w.narration = w.narration === "none" ? "generate" : w.narration;
    render();
  });
  el.querySelectorAll("details.rv-acc[data-acc]").forEach((d) => d.addEventListener("toggle", () => {
    const k = d.dataset.acc;
    if (d.open) accOpen.add(k); else accOpen.delete(k);
  }));
  on("[data-track]", "click", (e) => {
    if (e.target.closest("[data-trackplay]")) return;
    w.music = e.currentTarget.dataset.track; stopMusic(); render();
  });
  on("[data-trackplay]", "click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const id = e.currentTarget.dataset.trackplay;
    if (!id || id === "none") return;
    toggleMusic(id); render();
  });
  on("[data-musicgenre]", "click", (e) => { w.musicGenre = e.currentTarget.dataset.musicgenre; render(); });
  const mq = el.querySelector("#rvMusicQ");
  if (mq) mq.addEventListener("input", (e) => {
    w.musicQ = e.target.value;
    const at = e.target.selectionStart; render();
    const n = host()?.querySelector("#rvMusicQ"); if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch (_) {} }
  });
  bindMusicControls(el, (v) => { w.music = v; render(); }, () => w.music);
  const vol = el.querySelector("#rvVol"); if (vol) vol.addEventListener("input", (e) => { w.volume = Number(e.target.value) / 100; });
  const beat = el.querySelector("#rvBeat"); if (beat) beat.addEventListener("change", (e) => { w.beatSync = e.target.checked; });
  on("[data-nar]", "click", (e) => { stopVoicePreview(); w.narration = e.currentTarget.dataset.nar; render(); });
  const scr = el.querySelector("#rvScript"); if (scr) scr.addEventListener("input", (e) => { w.script = e.target.value; });
  const narFile = el.querySelector("#rvNarFile");
  if (narFile) narFile.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast("Voiceover Must Be Under 25 MB.");
    w.narrationName = f.name;
    w.narrationUpload = await fileToDataUrl(f);
    toast("Voiceover Added.");
    render();
  });
  const vprev = el.querySelector("#rvVoicePrev");
  if (vprev) vprev.addEventListener("click", async () => {
    if (w.voicePreviewing) { stopVoicePreview(); render(); return; }
    w.voicePreviewing = true; render();
    const url = await buildNarration("generate", (w.script || defaultScript()).slice(0, 400), w.voice);
    if (!url) { w.voicePreviewing = false; render(); return toast("Voiceover Preview Failed."); }
    voiceAudio = new Audio(url);
    voiceAudio.onended = () => { w.voicePreviewing = false; render(); };
    voiceAudio.play().catch(() => {});
  });
  const voice = el.querySelector("#rvVoice"); if (voice) voice.addEventListener("change", (e) => { w.voice = e.target.value.toLowerCase(); });
  const vstudio = el.querySelector('[data-a="voiceStudio"]');
  if (vstudio) vstudio.addEventListener("click", () => openVoiceStudio((p) => { if (p) w.voice = "myvoice"; render(); }));
  const caps = el.querySelector("#rvCaps"); if (caps) caps.addEventListener("change", (e) => { w.captions = e.target.checked; render(); });
  if (w.avatar) bindAvatar(el, w.avatar, render, toast);

  on("[data-cap]", "input", (e) => {
    const sc = w.scenes[Number(e.currentTarget.dataset.cap)];
    if (!sc) return;
    sc.caption = e.currentTarget.value;
    const clear = el.querySelector("#rvCapClear");
    if (clear) clear.disabled = !sc.caption;
  });
  on("[data-cappos]", "click", (e) => { const sc = cur(); if (!sc) return; sc.caption_pos = e.currentTarget.dataset.cappos; render(); });
  on("[data-capstyle]", "click", (e) => { const sc = cur(); if (!sc) return; sc.caption_style = e.currentTarget.dataset.capstyle; render(); });
  on("#rvCapClear", "click", () => { const sc = cur(); if (!sc) return; sc.caption = ""; render(); });

  /* scene labels */
  const lref = (v) => { const [i, j] = String(v).split(":").map(Number); return { s: w.scenes[i], j }; };
  on("#rvSuggestLabels", "click", () => {
    w.scenes.forEach((s) => { if (!Array.isArray(s.labels) || !s.labels.length) s.labels = suggestLabels(s.room, s.caption); });
    render();
  });
  on("[data-label-add]", "click", (e) => {
    const s = w.scenes[Number(e.currentTarget.dataset.labelAdd)];
    s.labels = Array.isArray(s.labels) ? s.labels : [];
    s.labels.push({ text: s.room || "", style: "clean", position: "bottom_left" });
    render();
  });
  on("[data-label-del]", "click", (e) => { const { s, j } = lref(e.currentTarget.dataset.labelDel); s.labels.splice(j, 1); render(); });
  on("[data-label-text]", "input", (e) => { const { s, j } = lref(e.currentTarget.dataset.labelText); s.labels[j].text = e.currentTarget.value; });
  on("[data-label-style]", "change", (e) => { const { s, j } = lref(e.currentTarget.dataset.labelStyle); s.labels[j].style = e.currentTarget.value; });
  on("[data-label-pos]", "change", (e) => { const { s, j } = lref(e.currentTarget.dataset.labelPos); s.labels[j].position = e.currentTarget.value; });


  /* ---- shared canvas + panel controls ---- */
  on("[data-tlpick]", "click", (e) => { w.activeIdx = Number(e.currentTarget.dataset.tlpick); render(); });
  on("#rvPrevScene", "click", () => { w.activeIdx = Math.max(0, activeIndex() - 1); render(); });
  on("#rvNextScene", "click", () => { w.activeIdx = Math.min(w.scenes.length - 1, activeIndex() + 1); render(); });
  on("#rvPlay", "click", () => {
    w.playing = !w.playing; render();
    if (w.playing) {
      clearInterval(w.playTimer);
      w.playTimer = setInterval(() => {
        const cur = S.wizard;
        if (!cur || !cur.playing) { clearInterval(w.playTimer); return; }
        cur.activeIdx = (Number(cur.activeIdx) || 0) + 1;
        if (cur.activeIdx >= cur.scenes.length) { cur.activeIdx = 0; cur.playing = false; clearInterval(w.playTimer); }
        render();
      }, Math.max(700, sceneDurations(w.scenes.length, w.length) * 1000));
    } else clearInterval(w.playTimer);
  });
  const pb = el.querySelector("#rvPrevBrand");
  if (pb) pb.addEventListener("change", (e) => { w.previewBrand = e.target.checked; render(); });
  on("#rvTlAdd", "click", () => el.querySelector("#rvTlFile")?.click());
  const tlf = el.querySelector("#rvTlFile");
  if (tlf) tlf.addEventListener("change", async (e) => {
    const f = [...(e.target.files || [])];
    if (!f.length) return;
    try { await addUploads(f); } catch (_) { toast("Those photos could not be added."); }
  });
  on("[data-sec]:not(.rv-rail-i)", "click", async (e) => {
    const key = e.currentTarget.dataset.sec;
    if (!key || !sectionReady(key)) return;
    w.step = stepForSection(key);
    if (key === "scenes") await loadWizardAssets();
    if (S.wizard !== w) return;
    render();
  });

  /* titles */
  on("[data-tfont]", "click", (e) => { w.titleFont = e.currentTarget.dataset.tfont; render(); });
  on("[data-tpos]", "click", (e) => { w.titlePos = e.currentTarget.dataset.tpos; render(); });
  const stx = el.querySelector("#rvSceneText");
  if (stx) stx.addEventListener("input", (e) => {
    const sc = activeScene(); if (!sc) return;
    sc.caption = e.target.value;
    const ov = el.querySelector(".rv-ov-cap");
    if (ov) ov.textContent = sc.caption || sc.room || "";
    const tl = el.querySelector(`.rv-tl-i[data-tlpick="${activeIndex()}"] b`);
    if (tl) tl.textContent = sc.room || "Scene";
  });
  on("#rvCapAll", "click", () => { w.scenes.forEach((sc) => { if (!sc.caption) sc.caption = sc.room || ""; }); render(); });

  /* audio */
  on("[data-atab]", "click", (e) => { w.audioTab = e.currentTarget.dataset.atab; render(); });
  on("#rvMusicOff", "click", () => { w.music = "none"; render(); });
  on("#rvPresOn", "click", () => { w.avatar = w.avatar || blankAvatarConfig(); w.avatar.enabled = true; render(); });

  /* brand placement */
  on("[data-logopos]", "click", (e) => { w.logoPos = e.currentTarget.dataset.logopos; render(); });
  const lop = el.querySelector("#rvLogoOp");
  if (lop) lop.addEventListener("input", (e) => { w.logoOpacity = Number(e.target.value) / 100; });

  /* branding */
  on("[data-kit]", "click", (e) => { w.brandKitId = e.currentTarget.dataset.kit || null; render(); });
  on("#rvKitNew", "click", () => openBrandKit(null));
  on("#rvKitEdit", "click", () => openBrandKit(S.kits.find((k) => k.id === w.brandKitId)));
  on("[data-br]", "change", (e) => { w.branding[e.currentTarget.dataset.br] = e.currentTarget.checked; render(); });
  on("[data-ver]", "change", (e) => { w.versions[e.currentTarget.dataset.ver] = e.currentTarget.checked; });
  on("[data-disc]", "change", (e) => { w.scenes[Number(e.currentTarget.dataset.disc)].disclosure = e.currentTarget.value; });
  on("[data-dmode]", "click", (e) => { w.disclosureMode = e.currentTarget.dataset.dmode; render(); });

  /* review */
  on("#rvGen", "click", () => generate());
  on("#rvCancelRender", "click", () => cancelRender());
  on("#rvAddCredits2", "click", () => openUpgrade("You need more credits to render this video."));
  on("#rvAddCredits", "click", () => openUpgrade(videoCreditBlock(creditTotal()) || "You need more credits to render this video."));

  } // end wizard bindings (S.wizard may be null on the library screen)

  /* detail */
  on("[data-tab]", "click", (e) => { S.detailTab = e.currentTarget.dataset.tab; render(); });
  on("[data-pf]", "click", (e) => { S.playFormat = e.currentTarget.dataset.pf; render(); });
  on("[data-pv]", "click", (e) => { S.playVersion = e.currentTarget.dataset.pv; render(); });
  on("#rvBackLib", "click", async () => { stopVoicePreview(); stopMusic(); await loadLibrary(); S.screen = "library"; render(); });
  on("#rvDl", "click", async () => {
    const v = S.detail?.variants.find((x) => x.output_path);
    if (!v) return toast("Nothing Rendered Yet.");
    const url = await signed(v.output_path);
    if (url) window.open(url, "_blank");
  });
  on("#rvShare", "click", () => { S.detailTab = "presentation"; render(); });

  /* presentation page settings */
  const share = () => (S.detail.share = S.detail.share || {});
  on("[data-ptype]", "click", (e) => { share().presentation_type = e.currentTarget.dataset.ptype; render(); });
  on("[data-pmob]", "click", (e) => { share().mobile_layout = e.currentTarget.dataset.pmob; render(); });
  on("#prCopy", "click", async () => {
    const sh = S.detail.share || {};
    try { await navigator.clipboard.writeText(location.origin + "/v/" + (sh.slug || sh.token)); } catch (_) {}
    toast("Presentation Link Copied.");
  });
  on("#prSave", "click", async (e) => {
    const q = (sel) => el.querySelector(sel);
    const sh = S.detail.share || {};
    const sections = {};
    el.querySelectorAll("[data-psec]").forEach((n) => { sections[n.dataset.psec] = n.checked; });
    const pwOn = q("#pr_pw_on")?.checked;
    const pw = q("#pr_pw")?.value || "";
    e.currentTarget.disabled = true;
    try {
      const res = await saveShareLink({
        video_project_id: S.detailId,
        presentation_type: sh.presentation_type || "listing",
        slug: (q("#pr_slug")?.value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || null,
        headline: q("#pr_head")?.value || null,
        privacy_type: pwOn ? "private" : "public",
        password: pwOn && pw ? pw : null,
        clear_password: !pwOn,
        allow_download: !!q("#pr_dl")?.checked,
        approval_enabled: !!q("#pr_appr")?.checked,
        comments_enabled: !!q("#pr_appr")?.checked,
        show_budget: !!sections.budget,
        show_products: !!sections.products,
        mobile_layout: sh.mobile_layout || "stacked",
        sections,
      });
      S.detail.share = { ...sh, ...res, sections, password_hash: pwOn ? (pw ? "set" : sh.password_hash) : null };
      toast("Presentation Page Saved.");
      render();
    } catch (err) {
      toast(err?.message || "Could not save the presentation page.");
      e.currentTarget.disabled = false;
    }
  });

  on("#rvEdit, #rvEdit2, #rvRetry", "click", () => editExisting(S.detail));
  on("#rvUpgrade", "click", () => openUpgradeFlow(S.detail));

  el.querySelectorAll("[data-goto]").forEach((n) => n.addEventListener("click", () => S.go && S.go(n.dataset.goto)));
}

function selectRecommended() {
  const w = S.wizard;
  if (!w || !w.available) return;
  const pool = w.available.filter((a) => (w.videoType === "before_after" ? a.compare : true));
  const picked = [];
  const seenRoom = new Set();
  for (const a of pool) {
    if (a.kind === "Design" || a.recommended) {
      const k = a.room + a.kind;
      if (seenRoom.has(k)) continue;
      seenRoom.add(k);
      picked.push(a);
    }
  }
  const chosen = (picked.length ? picked : pool).slice(0, 12);
  w.scenes = chosen.map(assetToScene);
  syncSceneOrder();
}

/** Reopen an existing project in the wizard at the storyboard step. */
function editExisting(d) {
  if (!d) return;
  const p = d.project;
  S.wizard = newWizard({
    propertyId: p.property_id,
    propertyLabel: p.property_label,
    title: p.title,
    videoType: p.video_type,
    sourceType: p.source_type,
  });
  const w = S.wizard;
  w.editingId = p.id;
  /* Clips generated in an earlier session (or on another device) come back
     with the project, and any job still running keeps polling. */
  sceneClips.onChange = () => { if (S.screen === "wizard") render(); };
  void sceneClips.load(p.id);
  w.address = cleanAddressText(p.property_address || "");
  w.addressSource = p.address_source || (p.property_id ? "existing_property" : "unknown");
  w.titleTouched = !!p.title_touched;
  {
    /* Older projects saved a flat formats[]; normalise into the canonical pair. */
    const saved = p.settings || {};
    const norm = normalizeFormats(
      saved.primaryFormat ? [saved.primaryFormat].concat(saved.additionalFormats || []) : p.formats,
    );
    w.primaryFormat = norm.primaryFormat;
    w.additionalFormats = norm.additionalFormats;
  }
  w.length = p.length_preset;
  w.transition = p.transition;
  w.motion = p.motion;
  w.brandKitId = p.brand_kit_id;
  w.branding = p.branding || w.branding;
  w.disclosureMode = p.disclosure?.mode || "altered";
  w.captions = !!d.audio?.captions_enabled;
  w.scenes = d.scenes.map((s) => ({
    key: s.id,
    path: s.source_path,
    compare: s.compare_path,
    room: s.room_name || "Untitled",
    kind: s.scene_type === "original" ? "Original" : "Design",
    scene_type: s.scene_type,
    duration: Number(s.duration),
    motion: s.motion,
    caption: s.caption,
    caption_pos: s.crop_data?.caption_pos || "bottom",
    caption_style: s.crop_data?.caption_style || "brand",
    crop_data: s.crop_data || {},
    disclosure: s.disclosure_type,
    motion_level: s.motion_level === "immersive" ? "immersive" : "standard",
    immersive_effect: s.immersive_effect || null,
    exterior_effect: s.exterior_effect || null,
    labels: Array.isArray(s.labels) ? s.labels : [],
    asset_id: s.source_asset_id,
    version_id: s.source_version_id,
  }));
  w.step = 3;
  /* Resume an unfinished builder exactly where it was left, from the stored
     draft state rather than from anything cached in this browser. */
  const ds = p.draft_state || null;
  if (ds && p.status === "draft") {
    w.gridOrder = Array.isArray(ds.gridOrder) ? ds.gridOrder : w.gridOrder;
    w.uploads = (ds.uploads || []).map((u) => ({
      id: u.id, name: u.name, originalName: u.name, url: "", file: null,
      storagePath: u.path, room: u.room || "Unsorted", roomSource: u.room_source || "ai",
    }));
    if (ds.scenes?.length && !w.scenes.length) w.scenes = ds.scenes;
    if (ds.titles) w.titles = ds.titles;
    if (ds.audio) {
      w.presentation = ds.audio.presentation ?? w.presentation;
      w.music = ds.audio.music ?? w.music;
      w.volume = ds.audio.volume ?? w.volume;
      w.beatSync = ds.audio.beatSync ?? w.beatSync;
      w.narration = ds.audio.narration ?? w.narration;
      w.script = ds.audio.script ?? w.script;
      w.voice = ds.audio.voice ?? w.voice;
      w.captions = ds.audio.captions ?? w.captions;
    }
    w.quality = ds.quality || w.quality;
    const step = Number(p.builder_step || ds.step || 2);
    w.step = Number.isFinite(step) && step >= 1 ? step : 2;
    /* Storage paths become viewable URLs for this session only. */
    Promise.all(
      w.uploads.map(async (u) => { try { u.url = await roomPhotoUrl(u.storagePath); } catch (_) {} }),
    ).then(() => { attachUploadAssets(w); render(); });
  }
  S.screen = "wizard";
  loadWizardAssets().then(render);
  render();
}

/* ======================= BRAND KIT MODAL ======================= */
function openBrandKit(kit) {
  let wrap = document.getElementById("rvKitWrap");
  /* Modals must live inside .rd-app: every field rule is scoped to it, so a
     body-level modal renders unstyled. */
  if (!wrap) {
    wrap = document.createElement("div"); wrap.id = "rvKitWrap";
    (document.querySelector(".rd-app") || document.body).appendChild(wrap);
  }
  const k = kit || {};
  const logo0 = esc(k.logo_url || "");
  const color0 = esc(k.colors?.primary || "#CC0000");
  wrap.className = "rv-modal on";
  wrap.innerHTML = `<div class="rv-modal-in" role="dialog" aria-label="Brand kit">
    <div class="rv-modal-h"><b>${kit ? "Edit" : "New"} Brand Kit</b><button class="icon-btn" id="rvKitX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">
      <div class="rv-sub">Identity</div>
      <div class="rv-grid2">
        <label class="rv-f">Brand Kit Name<input id="k_name" value="${esc(k.name || "My Brand Kit")}"></label>
        <label class="rv-f">Kit Type<select id="k_type">${["personal", "company", "client"].map((t) => `<option value="${t}" ${k.kit_type === t ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)} Brand Kit</option>`).join("")}</select></label>
      </div>

      <div class="rv-sub">Names</div>
      <div class="rv-grid2">
        <label class="rv-f">Company Name<input id="k_co" value="${esc(k.company_name || "")}"></label>
        <label class="rv-f">Agent Or Designer Name<input id="k_person" value="${esc(k.contact_name || "")}"></label>
      </div>

      <div class="rv-sub">Look</div>
      <div class="rv-f">Logo
        <div class="rv-logo-up">
          <span class="rv-logo-th${logo0 ? " has" : ""}" id="rvKitLogoTh">${logo0 ? `<img src="${logo0}" alt="Brand logo">` : `<i data-lucide="image"></i>`}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="rvKitLogoUp"><i data-lucide="upload"></i>Upload Logo</button>
          ${logo0 ? `<button type="button" class="btn btn-ghost btn-sm" id="rvKitLogoClear">Remove</button>` : ""}
          <input type="file" id="rvKitLogoFile" accept="image/*" hidden>
          <input type="hidden" id="k_logo" value="${logo0}">
        </div>
        <span class="rv-hint-in">PNG Or SVG Works Best. A Transparent Background Looks Cleanest On Video.</span>
      </div>
      <div class="rv-grid2">
        <label class="rv-f">Primary Brand Color
          <span class="rv-color">
            <input id="k_color" type="color" value="${color0}">
            <b class="mono" id="rvKitHex">${color0.toUpperCase()}</b>
          </span>
        </label>
        <label class="rv-f">Primary Font<input id="k_font" value="${esc(k.font || "Inter")}"></label>
      </div>

      <div class="rv-sub">Contact</div>
      <div class="rv-grid2">
        <label class="rv-f">Phone<input id="k_phone" value="${esc(k.phone || "")}"></label>
        <label class="rv-f">Email<input id="k_email" value="${esc(k.email || "")}"></label>
      </div>
      <label class="rv-f">Website<input id="k_web" value="${esc(k.website || "")}"></label>

      <div class="rv-sub">Default Call To Action</div>
      <label class="rv-f">Call To Action<input id="k_cta" value="${esc(k.default_cta || "Book A Design Consultation")}"></label>

      <label class="rv-check"><input type="checkbox" id="k_def" ${k.is_default ? "checked" : ""}> Use As My Default Brand Kit</label>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvKitCancel">Cancel</button><button class="btn btn-primary" id="rvKitSave">Save Brand Kit</button></div>
  </div>`;
  paint();
  const close = () => { wrap.className = "rv-modal"; wrap.innerHTML = ""; };
  wrap.querySelector("#rvKitX").onclick = close;
  wrap.querySelector("#rvKitCancel").onclick = close;
  /* Logo upload, with the pasted-URL field kept as a hidden value so the save
     handler and existing kits keep working unchanged. */
  const hex = wrap.querySelector("#rvKitHex");
  const colorIn = wrap.querySelector("#k_color");
  if (colorIn && hex) colorIn.addEventListener("input", () => { hex.textContent = String(colorIn.value || "").toUpperCase(); });
  const logoHidden = wrap.querySelector("#k_logo");
  const setLogo = (url) => {
    if (logoHidden) logoHidden.value = url || "";
    const th = wrap.querySelector("#rvKitLogoTh");
    if (th) { th.className = "rv-logo-th" + (url ? " has" : ""); th.innerHTML = url ? `<img src="${esc(url)}" alt="Brand logo">` : `<i data-lucide="image"></i>`; }
    paint();
  };
  wrap.querySelector("#rvKitLogoUp")?.addEventListener("click", () => wrap.querySelector("#rvKitLogoFile")?.click());
  wrap.querySelector("#rvKitLogoClear")?.addEventListener("click", () => setLogo(""));
  wrap.querySelector("#rvKitLogoFile")?.addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Please sign in again to upload a logo.");
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const path = `${uid}/brand/${Date.now()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || "image/png", upsert: true });
      if (up.error) throw new Error(up.error.message);
      const url = await signed(path);
      setLogo(url || "");
      toast("Logo Uploaded.");
    } catch (err) { toast(err?.message || "Could not upload that logo."); }
  });

  wrap.querySelector("#rvKitSave").onclick = async () => {
    const g = (id) => wrap.querySelector("#" + id)?.value || "";
    try {
      const saved = await saveBrandKit({
        ...(kit?.id ? { id: kit.id } : {}),
        name: g("k_name") || "Brand Kit",
        kit_type: g("k_type"),
        company_name: g("k_co"),
        contact_name: g("k_person"),
        logo_url: g("k_logo"),
        colors: { primary: g("k_color") },
        font: g("k_font"),
        phone: g("k_phone"),
        email: g("k_email"),
        website: g("k_web"),
        default_cta: g("k_cta"),
        is_default: !!wrap.querySelector("#k_def")?.checked,
      });
      S.kits = await listBrandKits();
      if (S.wizard) S.wizard.brandKitId = saved.id;
      close();
      render();
      toast("Brand Kit Saved.");
    } catch (e) { toast(e?.message || "Could not save that brand kit."); }
  };
}



/** Entry point from a design card: seeds the design as scene one of the
    unified builder and opens it at the Edit step. */
export async function startDesignVideo(design = {}) {
  if (!design || !design.id) throw new Error("That design could not be identified.");
  if (!design.path) throw new Error("That design has no image yet.");
  dvActive = true;
  [0, 300, 900, 1800, 3000].forEach((ms) => setTimeout(closeIntroNow, ms));
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(design.id));
  const versionId = design.sample || !isUuid ? null : design.id;
  startWizard({
    propertyId: design.property_id || null,
    propertyLabel: design.address || design.sub || null,
    versionId,
    sourceType: "design",
    videoType: "design_reveal",
    title: (design.name || "Design") + " Video",
  });
  const w = S.wizard;
  w.scenes = [{
    key: "seed-" + design.id,
    path: design.path,
    compare: design.before_path || null,
    room: design.name || "Selected Design",
    kind: "Design",
    scene_type: "design",
    duration: 3,
    motion: "auto",
    caption: "",
    disclosure: "proposed",
    asset_id: null,
    version_id: versionId,
  }];
  w.step = 3;
  render();
  closeIntroNow();
  /* Paint the requested editor before yielding to library requests. Otherwise
     the previous standalone video library can appear for one frame. */
  if (!S.tree.length) await loadLibrary();
  if (S.wizard === w) render();
}

/** Continue a saved design-video draft from Media or the library. */
const ACTIVE_KEY = "rd_reveal_active";

/* A refresh mid-build must come back to the same project, so the id of the
   project currently open in the builder is remembered locally. The work
   itself lives on the server; this is only a pointer. */
function rememberActiveBuilder(id) {
  try { if (id) localStorage.setItem(ACTIVE_KEY, String(id)); } catch (_) {}
}
export function forgetActiveBuilder() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
}

/** Reopen the project that was open in the builder before a refresh. */
export async function resumeActiveBuilder() {
  let id = "";
  try { id = localStorage.getItem(ACTIVE_KEY) || ""; } catch (_) { return false; }
  if (!id) return false;
  try {
    await continueDesignVideo(id);
    return true;
  } catch (_) {
    forgetActiveBuilder();
    return false;
  }
}

export async function continueDesignVideo(id) {
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.mounted) await mountReveal(S.go, {});
  const full = await getVideo({ id });
  editExisting(full);
}


/* ======================= INTRO ======================= */
let dvActive = false; // set while a contextual builder is being seeded
function closeIntroNow() {
  const w = document.getElementById("rvIntroWrap");
  if (w && w.parentNode) w.parentNode.removeChild(w);
  try { localStorage.setItem("rd_reveal_intro", "1"); } catch (_) {}
}

function maybeIntro() {
  if (dvActive) { closeIntroNow(); return; }
  try { if (localStorage.getItem("rd_reveal_intro") === "1") return; } catch (_) { return; }
  let wrap = document.getElementById("rvIntroWrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "rvIntroWrap"; (document.querySelector(".rd-app") || document.body).appendChild(wrap); }
  wrap.className = "rv-modal on";
  wrap.innerHTML = `<div class="rv-modal-in sm" role="dialog" aria-label="Welcome To Property Videos">
    <div class="rv-modal-h"><b>Create Your First Property Video</b></div>
    <div class="rv-modal-b">
      <ol class="rv-intro"><li>Choose a property or design</li><li>Select the scenes</li><li>Choose a format and style</li><li>Generate and share</li></ol>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvIntroNo">Not Now</button><button class="btn btn-ghost" id="rvIntroTour">Watch Quick Tour</button><button class="btn btn-primary" id="rvIntroGo">Create Video</button></div>
  </div>`;
  paint();
  const done = () => { try { localStorage.setItem("rd_reveal_intro", "1"); } catch (_) {} wrap.className = "rv-modal"; wrap.innerHTML = ""; };
  wrap.querySelector("#rvIntroNo").onclick = done;
  wrap.querySelector("#rvIntroTour").onclick = () => renderTour(wrap, done);
  wrap.querySelector("#rvIntroGo").onclick = () => { done(); startWizard({}); };
}

const TOUR = [
  { icon: "home", t: "Pick The Property", b: "Start from a property you already uploaded, a saved design, or a listing link. Every photo in that property is ready to drop into the timeline." },
  { icon: "images", t: "Choose The Scenes", b: "Order the rooms the way a buyer would walk the home. Drag to reorder, drop weak shots, and add before and after pairs where staging tells the story." },
  { icon: "sliders-horizontal", t: "Set The Look", b: "Choose a format for where it will post, add music or an AI voiceover, and pick transitions. Captions and your branding are applied automatically." },
  { icon: "share-2", t: "Generate & Share", b: "Rendering runs in the background. When it finishes you can download it, share a client link, or send it straight into a presentation." },
];

function renderTour(wrap, done, i = 0) {
  const s = TOUR[i];
  wrap.innerHTML = `<div class="rv-modal-in sm" role="dialog" aria-label="Quick Tour">
    <div class="rv-modal-h"><b>Quick Tour</b><span>Step ${i + 1} Of ${TOUR.length}</span></div>
    <div class="rv-modal-b">
      <div class="rv-tour"><i data-lucide="${s.icon}"></i><b>${s.t}</b><p>${s.b}</p></div>
      <div class="rv-tour-dots">${TOUR.map((_, n) => `<span class="${n === i ? "on" : ""}"></span>`).join("")}</div>
    </div>
    <div class="rv-modal-f">
      <button class="btn btn-ghost" id="rvTourSkip">Skip Tour</button>
      ${i > 0 ? `<button class="btn btn-ghost" id="rvTourBack">Back</button>` : ""}
      <button class="btn btn-primary" id="rvTourNext">${i === TOUR.length - 1 ? "Create Video" : "Next"}</button>
    </div>
  </div>`;
  paint();
  wrap.querySelector("#rvTourSkip").onclick = done;
  const back = wrap.querySelector("#rvTourBack");
  if (back) back.onclick = () => renderTour(wrap, done, i - 1);
  wrap.querySelector("#rvTourNext").onclick = () => {
    if (i === TOUR.length - 1) { done(); startWizard({}); return; }
    renderTour(wrap, done, i + 1);
  };
}

/* ======================= PUBLIC API ======================= */
export function startWizard(seed = {}) {
  revokeUploadUrls(S.wizard);
  const w = newWizard(seed);
  S.wizard = w;
  S.screen = "wizard";
  sceneClips.onChange = () => { if (S.screen === "wizard") render(); };
  sceneClips.setProject(w.editingId || null);
  logVideoEvent("video_builder_started", {
    seedFileCount: Array.from(seed.files || []).length,
    uploadCount: (w.uploads || []).length,
    propertyId: w.propertyId,
    versionId: w.versionId,
    resolvedInitialStep: w.step,
    entrySource: seed.from || seed.source || (w.uploads.length ? "handoff" : w.propertyId ? "property" : "empty"),
  });

  if ((w.uploads || []).length) {
    /* Seeded / handoff photos take the same route as a direct upload:
       visible on Scenes before the first paint, enrichment afterwards. */
    hydrateSeededWizard(w, { attachUploads: attachUploadAssets, selectUploads: selectUploadedScenes });
    render();
    runEnrichment(w, {
      loadAssets: loadWizardAssets,
      isCurrent: (x) => S.wizard === x,
      attachUploads: attachUploadAssets,
      selectUploads: selectUploadedScenes,
      autoArrange,
      render,
    }).catch(() => {});
    classifyUploads().catch(() => {});
    drainSeedPending(w);
  } else if (w.propertyId || w.versionId) {
    loadWizardAssets().then(render);
    render();
  } else {
    render();
  }
  ensureStepInvariant(w, { attachUploads: attachUploadAssets, selectUploads: selectUploadedScenes, render });
  const focusHost = () => {
    try {
      const el = host();
      if (!el || S.screen !== "wizard") return;
      if (!el.classList.contains("on")) {
        document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v === el));
      }
    } catch (_) {}
  };
  [0, 200, 600, 1200, 2000].forEach((ms) => setTimeout(focusHost, ms));
}


/** Contextual entry point used from properties, designs and comparisons. */
export async function createVideoFrom(seed = {}) {
  dvActive = true;
  [0, 300, 900, 1800].forEach((ms) => setTimeout(closeIntroNow, ms));
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  /* Build immediately, before the first await, so navigation never exposes
     stale library markup while property and media data are loading. */
  startWizard(seed);
  const wizard = S.wizard;
  if (!S.tree.length) await loadLibrary();
  if (S.wizard === wizard) render();
}

export async function mountReveal(go, _opts = {}) {
  S.go = go || S.go;
  const el = host();
  if (!el) return;
  if (!S.mounted) {
    S.mounted = true;
    el.innerHTML = `<div class="rv-note">Loading Your Videos…</div>`;
  }
  await loadLibrary();
  if (S.screen === "library") render();
  else render();
  maybeIntro();
}

export default mountReveal;

/** Open one video's detail screen from another module (Listing Video, Media). */
export async function openVideoDetail(id, tab = "video") {
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.mounted) await mountReveal(S.go, {});
  S.detailTab = tab;
  await openDetail(id);
}


/* Repaint only the filtered result list; the toolbar, search input and any
   already-loaded thumbnails stay in the DOM so nothing flashes. */
function renderList() {
  const el = host();
  if (!el || S.screen !== "library") return;
  el.querySelectorAll(".rv-chip").forEach((c) => c.classList.toggle("on", c.dataset.f === S.filter));
  const list = el.querySelector(".rv-list");
  if (!list) return render();
  list.innerHTML = cardsHtml(libraryRows());
  try { window.lucide?.createIcons(); } catch (_) {}
  bindCards(list);
  paintThumbs();
}

function bindCards(root) {
  const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
  on(".rv-card .icon-btn", "click", async (e) => {
    e.stopPropagation();
    const card = e.currentTarget.closest(".rv-card");
    const id = card.dataset.id;
    const act = e.currentTarget.dataset.act;
    if (act === "open" || act === "edit") return openDetail(id);
    if (act === "caption") {
      const p = S.projects.find((x) => x.id === id);
      openSocialCopy({
        title: p?.title || "Property Video",
        propertyLabel: p?.property_label || null,
        kind: "video",
      });
      return;
    }
    if (act === "dupe") { await duplicateVideo({ id }); await loadLibrary(); render(); return toast("Video Duplicated."); }
    if (act === "del") { if (!confirm("Delete this video?")) return; await deleteVideo({ id }); await loadLibrary(); render(); return; }
    if (act === "download") {
      const v = S.variants.find((x) => x.video_project_id === id && x.output_path);
      if (!v) return toast("Nothing Rendered Yet.");
      const url = await signed(v.output_path);
      if (url) window.open(url, "_blank");
      return;
    }
    if (act === "share") {
      const { token, slug } = await saveShareLink({ video_project_id: id });
      try { await navigator.clipboard.writeText(location.origin + "/v/" + (slug || token)); } catch (_) {}
      await loadLibrary();
      S.detailTab = "presentation";
      await openDetail(id);
      return toast("Presentation Link Copied.");
    }
  });
  on(".rv-card .rv-thumb, .rv-card .rv-meta", "click", (e) => openDetail(e.currentTarget.closest(".rv-card").dataset.id));
}

/* Leaving the video workspace must not leave anything mounted in its view.
   The old standalone "Property Videos" library was folded into Media > Videos;
   this view now only hosts the builder and the video detail screen, so it is
   emptied on exit and rebuilt fresh next time. */
/* The shell only lets the reveal view open right after a builder entry point
   flags its intent. A builder or detail screen that is already live must keep
   that permission, otherwise a later navigation to "reveal" (hash restore,
   remount, deep link) bounces the user back to Media mid-build. */
export function revealBusy() {
  return !!(S.wizard || S.detail || S.detailId);
}
try { (window as any).__rdRevealBusy = revealBusy; } catch (_) {}

export function resetReveal() {
  stopAvatarVoice(); // never let a voice sample keep playing after navigation
  revokeUploadUrls(S.wizard);
  S.screen = "library";
  S.wizard = null;
  S.detail = null;
  S.detailId = null;
  const el = host();
  if (el) { el.innerHTML = ""; S.mounted = false; }
}
