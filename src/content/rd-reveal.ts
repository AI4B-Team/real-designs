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
import { resolvePhotoUrl } from "@/lib/room-photos";
import { getPropertyTree } from "@/lib/workspace.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
import { FLAG_LABEL, recommendations, missingSpaces } from "@/lib/media-analysis";
import { mountSourcePicker } from "@/lib/source-picker";
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
} from "@/lib/reveal.functions";
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
} from "@/lib/reveal-render";
import { track } from "@/lib/analytics";
import { avatarSection, bindAvatar, avatarRenderOption, avatarScript, blankAvatarConfig } from "@/lib/rd-avatar-ui";
import { getMyCredits, CREDIT_COSTS } from "@/lib/credits.functions";
import { isPlanBlocked, openUpgrade } from "@/lib/rd-upgrade";
import { VFX_LOOKS, VFX_CATEGORIES, lookById, lookOverlayHTML } from "@/lib/rd-vfx-looks";
import { VFX_TILE_CATEGORIES, tileById, tilesForCat } from "@/lib/rd-vfx-tiles";


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
    const [lib, tree, kits, credits] = await Promise.all([
      listVideos(),
      getPropertyTree().catch(() => []),
      listBrandKits().catch(() => []),
      getMyCredits().catch(() => null),
    ]);
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
function newWizard(seed = {}) {
  return {
    step: seed.propertyId || seed.versionId ? 2 : 1,
    sourceType: seed.sourceType || (seed.versionId ? "design" : seed.propertyId ? "property" : ""),
    propertyId: seed.propertyId || null,
    propertyLabel: seed.propertyLabel || null,
    versionId: seed.versionId || null,
    title: seed.title || "",
    videoType: seed.videoType || "property_tour",
    available: [],
    scenes: [],
    formats: ["9:16"],
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
    address: "",
    candidates: [],
    pop: null,
    popQ: "",
    popCat: "all",
    lowModal: false,
    lowWarned: false,
    disclosureMode: "altered",
    uploads: [],
    mode: "auto",
    quality: "standard",
    titles: { property: true, contact: true, custom: [] },
    busy: false,
    progress: 0,
    stage: "",
  };
}

/** Build the available asset list from what the property already holds. */
async function loadWizardAssets() {
  const w = S.wizard;
  if (!w) return;
  const out = [];
  const prop = S.tree.find((p) => p.id === w.propertyId) || null;
  if (prop) {
    w.propertyLabel = prop.address;
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
  for (const u of w.uploads) out.push({ key: "u-" + u.id, path: u.url, room: u.name || UNSORTED, kind: "Original", group: "Other", disclosure: null, uploaded: true, flags: [] });
  w.available = out;
}

/* The builder is organised as six named sections in a left rail. Internally
   the wizard still tracks a step number, so every existing deep link, modal
   and shortcut keeps working. */
const WIZ_SECTIONS: Array<[string, string, string, number]> = [
  ["photos", "Photos", "image", 1],
  ["scenes", "Scenes", "layout-grid", 2],
  ["titles", "Titles", "type", 5],
  ["audio", "Audio", "music", 6],
  ["brand", "Brand", "palette", 4],
  ["quality", "Quality", "sparkles", 7],
];
const FLOW = [1, 2, 3, 5, 6, 4, 7];
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
  if (key === "scenes") return (S.wizard.scenes || []).length ? 3 : 2;
  return (WIZ_SECTIONS.find((x) => x[0] === key) || [null, null, null, 1])[3];
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
  if (w.step === 3) body = stepEdit();
  if (w.step === 4) body = stepBrand();
  if (w.step === 5) body = stepTitles();
  if (w.step === 6) body = stepAudio();
  if (w.step === 7) body = stepQuality();

  return `<div class="rv-head">
    <div><h2>Create A Property Video</h2><p>${esc(w.propertyLabel || "Build a video from content you already have.")}</p></div>
    <button class="btn btn-ghost" id="rvCancel"><i data-lucide="x"></i>Cancel</button>
  </div>
  <div class="rv-layout rv-railed ${w.step > 1 ? "with-side" : ""}">
    ${rail}
    <div class="rv-wiz">${body}</div>
    ${w.step > 1 ? `<aside class="rv-side">${previewPanel()}</aside>` : ""}
  </div>
  ${w.pop ? popoverHtml() : ""}
  ${w.lowModal ? lowSceneModal() : ""}
  ${w.logoModal ? logoModalHtml() : ""}`;
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

/** Title the user never has to type: address, property or design name. */
function defaultTitle(w) {
  return w.title || w.propertyLabel || "Untitled Video";
}

/* Step 1 is the shared source picker, mounted after render. Nothing about
   uploading, dropping, cloud links or address lookup lives in this file. */
function stepPhotos() {
  const w = S.wizard;
  const chosen = w.propertyId ? (S.tree.find((p) => p.id === w.propertyId)?.address || w.propertyLabel) : "";
  return `<h3>Where Are The Photos?</h3>
  <label class="rv-f">Video Title<input id="rvTitle" value="${esc(defaultTitle(w))}"></label>
  <div id="rvPicker"></div>
  ${chosen ? `<div class="rv-note">Using ${esc(chosen)}.</div>` : ""}
  ${w.uploads.length ? `<div class="rv-thumbs">${w.uploads
    .map((u) => `<div class="rv-thumb" style="background-image:url('${esc(u.url)}')"><button data-rmup="${u.id}" title="Remove"><i data-lucide="x"></i></button></div>`)
    .join("")}</div>
  <div class="rv-upload"><span class="mono">${w.uploads.length} Photos Added</span></div>` : ""}
  <div class="rv-foot"><button class="btn btn-primary" id="rvNext" ${stepReady() ? "" : "disabled"}>Continue</button></div>`;
}

/* The preview panel renders its own Continue, so readiness lives in one place
   and both buttons stay in sync. */
function stepReady() {
  const w = S.wizard;
  if (!w) return false;
  if (w.step === 1) return (w.uploads || []).length > 0 || !!w.versionId || !!w.propertyId;
  if (w.step === 2) return w.scenes.length > 0;
  if (w.step === 3) return (w.formats || []).length > 0;
  return true;
}


/* ======================= STEP 2, SELECT ======================= */
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

function nameCell(value, attr) {
  const w = S.wizard;
  if (w.renaming === attr) {
    return `<input class="rv-nameedit" data-nameinput="${esc(attr)}" value="${esc(value)}" maxlength="60">`;
  }
  return `<b class="rv-editname" data-rename="${esc(attr)}" title="Click To Rename">${esc(value)}</b>`;
}

function stepSelect() {
  const w = S.wizard;
  const groups = {};
  for (const a of w.available) (groups[a.group] = groups[a.group] || []).push(a);
  const order = Object.keys(groups).sort((a, b) => orderRank(a) - orderRank(b));
  const dupCount = w.available.filter((a) => a.dup).length;
  const assets = analysisAssets();
  const flagged = w.available.filter((a) => (a.flags || []).length);
  const recs = recommendations(assets).filter((r) => r.op);
  const missing = missingSpaces(assets);

  const left = order.map((g) => `<div class="rv-g"><div class="rv-g-h">${esc(g)}<i class="mono">${groups[g].length}</i></div><div class="rv-g-b">${groups[g]
    .map((a) => `<button class="rv-asset ${w.scenes.some((s) => s.key === a.key) ? "on" : ""}" data-asset="${a.key}">
      <span class="rv-a-th" data-img="${esc(a.path)}">${(a.flags || []).length ? `<em class="rv-flag" title="${esc((a.flags || []).map((f) => FLAG_LABEL[f] || f).join(", "))}"><i data-lucide="triangle-alert"></i></em>` : ""}</span>
      <span class="rv-a-m">${nameCell(a.room || UNSORTED, "a:" + a.key)}<i>${a.kind}${a.disclosure ? " • " + DISCLOSURE_LABEL[a.disclosure] : ""}</i></span>
    </button>`).join("")}</div></div>`).join("");

  const right = w.scenes.length
    ? w.scenes.map((s, i) => `<div class="rv-scene" draggable="true" data-idx="${i}">
        <span class="rv-seq mono">${i + 1}</span>
        <span class="rv-a-th" data-img="${esc(s.path)}"></span>
        <span class="rv-s-m">${nameCell(s.room || UNSORTED, "s:" + i)}<i>${s.scene_type === "before_after" ? "Before & After" : s.kind}</i></span>
        <span class="rv-s-a">
          <button class="icon-btn" data-move="-1" title="Move Up"><i data-lucide="chevron-up"></i></button>
          <button class="icon-btn" data-move="1" title="Move Down"><i data-lucide="chevron-down"></i></button>
          <button class="icon-btn" data-drop="${i}" title="Remove"><i data-lucide="x"></i></button>
        </span>
      </div>`).join("")
    : `<div class="rv-note">No Scenes Yet. Add Content From The Left.</div>`;

  const fixCard = recs.length && !w.enhanceDismissed ? `<div class="rv-fix">
    <b>We Found ${recs.reduce((n, r) => n + r.ids.length, 0)} Photos We Can Improve</b>
    ${recs.map((r) => `<div class="rv-fix-row"><span>${esc(r.label)}</span><i class="mono">${r.ids.length} ${r.ids.length === 1 ? "Photo" : "Photos"}</i><em>${esc(r.note)}</em></div>`).join("")}
    <div class="rv-fix-a">
      <button class="btn btn-primary btn-sm" id="rvFixAll">Fix All</button>
      <button class="btn btn-ghost btn-sm" data-goto="media">Review Each</button>
      <button class="btn btn-ghost btn-sm" id="rvFixSkip">Skip</button>
    </div>
  </div>` : "";

  return `<h3>Select The Photos</h3>
  ${dupCount ? `<div class="rv-dup"><i data-lucide="copy"></i><b>${dupCount} Similar Angles Detected</b><span><button class="fb-link" id="rvKeepBest">Keep Best</button><button class="fb-link" data-goto="media">Review</button><button class="fb-link" id="rvKeepAll">Keep All</button></span></div>` : ""}
  ${flagged.length ? `<div class="rv-issues"><i data-lucide="triangle-alert"></i><b>${flagged.length} Photos Have Issues We Can Fix</b><button class="fb-link" data-goto="media">Review</button></div>` : ""}
  ${missing.length ? `<div class="rv-note sm">No ${missing.slice(0, 2).join(" Or ")} In This Set. Buyers Look For Those First.</div>` : ""}
  <div class="rv-two">
    <div class="rv-col"><div class="rv-col-h">Available Photos<span class="mono">${w.available.length}</span></div><div class="rv-col-b">${left || `<div class="rv-note">No Content Found For This Source.</div>`}</div></div>
    <div class="rv-col"><div class="rv-col-h">Selected Photos<span class="mono">${w.scenes.length}</span></div><div class="rv-col-b" id="rvSceneList">${right}</div></div>
  </div>
  ${fixCard}
  <div class="rv-foot">
    <button class="btn btn-ghost" id="rvBack">Back</button>
    <button class="btn btn-ghost" id="rvRecommend">Select All Recommended</button>
    <button class="btn btn-ghost" id="rvClear">Clear</button>
    <button class="btn btn-ghost" id="rvAuto">Auto Arrange</button>
    <button class="btn btn-primary" id="rvNext" ${w.scenes.length ? "" : "disabled"}>Continue</button>
  </div>`;
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

function sceneCard(s, i) {
  const look = s.look ? lookById(s.look) : null;
  const changed = (s.motion && s.motion !== "auto") || s.motion_level === "immersive" || s.exterior_effect;
  return `<div class="rv-scard" draggable="true" data-idx="${i}">
    <div class="rv-scard-th" data-img="${esc(s.path)}">
      <span class="rv-seq mono">${i + 1}</span>
      <button class="rv-x" data-drop="${i}" aria-label="Remove Scene"><i data-lucide="x"></i></button>
    </div>
    <div class="rv-scard-b">
      <div class="rv-mchips">
        <button class="rv-mchip ${changed ? "hot" : ""}" data-pop="motion" data-i="${i}" title="Camera Motion">${esc(motionLabel(s))}<i data-lucide="chevron-down"></i></button>
        <button class="rv-mchip" data-pop="crop" data-i="${i}" title="Crop">Crop</button>
        <button class="rv-mchip ${s.vfx && s.vfx !== "none" ? "hot" : ""}" data-pop="look" data-i="${i}" title="VFX">${esc(tileById(s.vfx)?.label || "VFX")}</button>
      </div>
      <b>${esc(s.room || "Scene " + (i + 1))}</b>
      <input class="rv-cap" data-cap="${i}" value="${esc(s.caption ?? "")}" placeholder="Add Text, Optional">
      <div class="rv-scard-a">
        <button class="icon-btn" data-move="-1" title="Move Up"><i data-lucide="chevron-up"></i></button>
        <button class="icon-btn" data-move="1" title="Move Down"><i data-lucide="chevron-down"></i></button>
      </div>
    </div>
  </div>`;
}

function popoverHtml() {
  const w = S.wizard;
  const { kind, i } = w.pop;
  const s = w.scenes[i];
  if (!s) return "";
  let body = "";
  if (kind === "motion") {
    const q = (w.popQ || "").toLowerCase();
    const match = (n) => !q || n.toLowerCase().includes(q);
    const rows = STANDARD_MOTIONS.filter(([, n]) => match(n));
    const imms = IMMERSIVE_EFFECTS.filter(([, n]) => match(n));
    const exts = EXTERIOR_EFFECTS.filter(([, n]) => match(n));
    const sel = s.motion_level === "immersive" ? s.immersive_effect || "light" : s.motion || "auto";
    const hov = w.popHover || sel;
    body = `<div class="rv-pop-two">
      <div class="rv-pop-side">
        <input id="rvPopQ" value="${esc(w.popQ || "")}" placeholder="Search Camera Motions">
        <div class="rv-pop-scroll">
          <div class="rv-pop-h">Camera Moves</div>
          ${rows.some(([id]) => id === "auto") ? `<button class="rv-pop-auto ${s.motion_level !== "immersive" && (s.motion || "auto") === "auto" ? "on" : ""}" data-motionpick="auto" data-hover="auto">
            <span><b>Auto, Recommended</b><em>We Pick The Best Move For Each Room</em></span><i data-lucide="sparkles"></i>
          </button>` : ""}
          <div class="rv-pop-grid">
            ${rows.filter(([id]) => id !== "auto").map(([id, n]) => `<button class="rv-pop-row ${s.motion_level !== "immersive" && s.motion === id ? "on" : ""}" data-motionpick="${id}" data-hover="${id}">${esc(n)}</button>`).join("")}
          </div>
          ${imms.length ? `<div class="rv-pop-sep"></div>
          <div class="rv-pop-h">Immersive Movement <i class="mono">+${IMMERSIVE_CREDITS_PER_SCENE} Each</i></div>
          <div class="rv-pop-grid">
            ${imms.map(([id, n]) => `<button class="rv-pop-row ${s.motion_level === "immersive" && (s.immersive_effect || "light") === id ? "on" : ""}" data-immpick="${id}" data-hover="${id}">${esc(n)}<i class="mono">+${IMMERSIVE_CREDITS_PER_SCENE}</i></button>`).join("")}
          </div>
          <div class="rv-note sm">Only movement is animated. Walls, windows and furniture stay exactly as designed.</div>` : ""}
          ${isExterior(s) && exts.length ? `<div class="rv-pop-sep"></div><div class="rv-pop-h">Cinematic Exterior</div>
          <div class="rv-pop-grid">
            <button class="rv-pop-row ${s.exterior_effect ? "" : "on"}" data-extpick="">None</button>
            ${exts.map(([id, n]) => `<button class="rv-pop-row ${s.exterior_effect === id ? "on" : ""}" data-extpick="${id}" data-hover="${id}">${esc(n)}</button>`).join("")}
          </div>
          ${s.exterior_effect ? `<div class="rv-note sm">${esc(EXTERIOR_DISCLOSURE)}</div>` : ""}` : ""}
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
      <div class="rv-pop-h">Crop <i class="mono">${esc(w.formats[0] || "9:16")}</i></div>
      ${CROPS.map(([id, n]) => `<button class="rv-pop-row ${(s.crop || "center") === id ? "on" : ""}" data-croppick="${id}">${n}</button>`).join("")}
    </div>`;
  } else {
    const cat = VFX_TILE_CATEGORIES.some(([id]) => id === w.popCat) ? w.popCat : "all";
    const tiles = tilesForCat(cat);
    const active = s.vfx || "none";
    const gcat = VFX_CATEGORIES.some(([id]) => id === w.popGrade) ? w.popGrade : "featured";
    const grades = VFX_LOOKS.filter((l) => (l.cat || "featured") === gcat);
    const amt = s.look_amount ?? 100;
    const activeLook = s.look ? lookById(s.look) : null;
    body = `<div class="rv-pop-two look">
      <div class="rv-pop-side">
        <div class="rv-pop-scroll tall">
          <div class="rv-pop-h">Color Grades <i>Free</i></div>
          <div class="rv-seg tiny">${VFX_CATEGORIES.map(([id, n]) => `<button class="${gcat === id ? "on" : ""}" data-gradecat="${id}">${n}</button>`).join("")}</div>
          <div class="rv-looks">
            <button class="rv-look ${!s.look ? "on" : ""}" data-lookpick="">
              <span class="rv-look-th none"><i data-lucide="ban"></i></span><b>None</b><em>No Grade</em>
            </button>
            ${grades.map((l) => `<button class="rv-look ${s.look === l.id ? "on" : ""}" data-lookpick="${esc(l.id)}" title="${esc(l.blurb || "")}">
              <span class="rv-look-th" data-img="${esc(s.path)}">${lookOverlayHTML(l, amt)}</span>
              <b>${esc(l.label)}</b><em>${esc(l.blurb || "")}</em>
            </button>`).join("")}
          </div>
          <div class="rv-pop-sep"></div>
          <div class="rv-pop-h">Effects <i>Some Cost Credits</i></div>
          <div class="rv-seg tiny">${VFX_TILE_CATEGORIES.map(([id, n]) => `<button class="${cat === id ? "on" : ""}" data-lookcat="${id}">${n}</button>`).join("")}</div>
          <div class="rv-looks">
            ${tiles.map((t) => {
              const lk = t.look ? lookById(t.look) : null;
              return `<button class="rv-look ${active === t.id ? "on" : ""}" data-vfxpick="${t.id}" title="${esc(t.sub)}">
                <span class="rv-look-th ${t.id === "none" ? "none" : ""}" data-img="${esc(s.path)}">${lk ? lookOverlayHTML(lk, amt) : t.id === "none" ? `<i data-lucide="ban"></i>` : ""}</span>
                <b>${esc(t.label)}</b><em>${esc(t.sub)}</em>
                ${t.gen ? `<i class="mono">+${t.credits}</i>` : ""}
              </button>`;
            }).join("")}
          </div>
        </div>
      </div>
      <div class="rv-pop-prev">
        <div class="rv-pop-stage">
          <div class="rv-pop-clip m-static" data-img="${esc(s.path)}">${activeLook ? lookOverlayHTML(activeLook, amt) : ""}</div>
          <span class="rv-pop-live"><i></i>Live Preview</span>
        </div>
        <b>${esc(activeLook ? activeLook.label : tileById(active)?.label || "None")}</b>
        <span>${esc(activeLook ? activeLook.blurb || "" : tileById(active)?.sub || "No Effect Applied. The Photo Renders Exactly As Uploaded.")}</span>
        <label class="rv-f">Intensity<input type="range" id="rvLookAmt" min="10" max="100" value="${amt}"></label>
        <label class="rv-check"><input type="checkbox" id="rvAllLook"> Apply To All Scenes</label>
        <span class="rv-pop-tip">Color Grades Are Free. Effects That Add Content To The Frame Cost Credits And Carry A Disclosure Label.</span>
      </div>
    </div>`;
  }

  return `<div class="rv-modal on" id="rvPopWrap"><div class="rv-modal-in ${kind === "crop" ? "wide" : "xwide"}" role="dialog" aria-label="Scene options">
    <div class="rv-modal-h"><b>${kind === "motion" ? "Camera Motion" : kind === "crop" ? "Crop" : "Look & Effects"}</b>${kind === "look" ? `<span class="rv-pill">Experimental</span>` : ""}<button class="icon-btn" id="rvPopX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">${body}</div>
    <div class="rv-modal-f"><button class="btn btn-primary" id="rvPopDone">Done</button></div>
  </div></div>`;
}

/* ======================= STEP 3, EDIT ======================= */
const ORIENTATIONS: Array<[string, string, string[]]> = [
  ["portrait", "Portrait", ["9:16", "4:5"]],
  ["landscape", "Landscape", ["16:9", "1:1"]],
];
function orientationOf(w) {
  return (w.formats || []).some((f) => f === "16:9" || f === "1:1") ? "landscape" : "portrait";
}
function stepEdit() {
  const w = S.wizard;
  const per = sceneDurations(w.scenes.length, w.length);
  const total = Math.round(per * w.scenes.length);
  const imm = immersiveCount();
  const orient = orientationOf(w);
  return `<div class="rv-head-row">
    <div><h3>Configure Photos</h3><p class="rv-hint">Drag To Reorder. Set Orientation, Crop Photos, And Customize Camera Motions.</p></div>
    <div class="rv-orient"><span>Video Orientation</span>
      <div class="rv-seg">${ORIENTATIONS.map(([id, n]) => `<button class="${orient === id ? "on" : ""}" data-orient="${id}">${n}</button>`).join("")}</div>
    </div>
  </div>
  <div class="rv-meta mono">${w.scenes.length} Scenes · ${total}s · ${creditTotal()} Credits</div>
  ${imm > 4 ? `<div class="rv-note sm">Immersive Movement Is On For ${imm} Scenes, ${imm * IMMERSIVE_CREDITS_PER_SCENE} Extra Credits. Most Videos Only Need It On Two Or Three.</div>` : ""}
  <div class="rv-photostrip">${w.scenes.map((s, i) => sceneCard(s, i)).join("") || `<div class="rv-note">No Scenes Selected.</div>`}</div>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext" ${w.formats.length ? "" : "disabled"}>Continue</button></div>`;
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
  return `<h3>Brand & Audio</h3>

  <details class="rv-acc" data-acc="template"${accOpen.has("template") ? " open" : ""}><summary>Template</summary>
    <div class="rv-seg tiny">${[["intro", "Intro"], ["outro", "Outro"], ["full", "Full Video"]]
      .map(([id, n]) => `<button class="${(w.tplScope || "intro") === id ? "on" : ""}" data-tplscope="${id}">${n}</button>`).join("")}</div>
    ${(w.tplScope || "intro") === "intro" ? templateGrid(INTRO_TEMPLATES, w.introTemplate || "clean", "tplintro") : ""}
    ${w.tplScope === "outro" ? templateGrid(OUTRO_TEMPLATES, w.outroTemplate || "agent_white", "tploutro") : ""}
    ${w.tplScope === "full" ? `
    <div class="rv-sub">Speed</div>
    <div class="rv-seg">${[["full", "Slow"], ["standard", "Medium"], ["quick", "Fast"]]
      .map(([id, n]) => `<button class="${w.length === id ? "on" : ""}" data-len="${id}">${n}</button>`).join("")}</div>
    <div class="rv-sub">Transitions</div>
    <div class="rv-seg wrap">${[["clean", "Clean"], ["smooth", "Smooth"], ["cinematic", "Cinematic"], ["match", "Before & After"], ["none", "None"]]
      .map(([id, n]) => `<button class="${w.transition === id ? "on" : ""}" data-tr="${id}">${n}</button>`).join("")}</div>
    ${w.scenes.some((s) => s.scene_type === "before_after") ? `<div class="rv-sub">Before &amp; After Reveal</div>
    <div class="rv-seg wrap">${[["match", "Match Frame"], ["slider", "Slider Reveal"], ["wipe", "Wipe"], ["fade", "Fade"]]
      .map(([id, n]) => `<button class="${w.baTransition === id || (!w.baTransition && id === "match") ? "on" : ""}" data-ba="${id}">${n}</button>`).join("")}</div>` : ""}
    <div class="rv-sub">Video Options</div>
    <div class="rv-tog">
      <div class="rv-tog-row" data-tip="Adds transitions to accelerate between clips for a more cinematic, dynamic look.">
        <span><b>Speed Ramps</b><em>Elevate Your Video With Speed Transitions.</em></span>
        <label class="rv-switch"><input type="checkbox" id="rvSpeedRamps" ${w.speedRamps ? "checked" : ""}><i></i></label>
      </div>
      <div class="rv-tog-row" data-tip="Places your logo as a watermark on every frame of the video.">
        <span><b>Logo Branding</b><em>Show A Logo Watermark Throughout The Video.</em>
        <button class="fb-link" id="rvPickLogo">Select Logo</button></span>
        <label class="rv-switch"><input type="checkbox" id="rvLogoBrand" ${w.logoBranding ? "checked" : ""}><i></i></label>
      </div>
      <div class="rv-tog-row" data-tip="Burns a Digitally Altered watermark into the full duration of the video.">
        <span><b>AI Disclaimer</b><em>Add A "Digitally Altered" Watermark For The Full Duration.</em></span>
        <label class="rv-switch"><input type="checkbox" id="rvAiDisc" ${w.aiDisclaimer ? "checked" : ""}><i></i></label>
      </div>
    </div>` : ""}
  </details>

  <details class="rv-acc" data-acc="brandkit"${accOpen.has("brandkit") ? " open" : ""}><summary>Brand Kit</summary>
    <div class="rv-kits">${S.kits.map((k) => `<button class="rv-kit ${w.brandKitId === k.id ? "on" : ""}" data-kit="${k.id}"><b>${esc(k.name)}</b><span>${esc(k.company_name || k.contact_name || "No Company Name")}</span></button>`).join("")}
      <button class="rv-kit add" id="rvKitNew"><i data-lucide="plus"></i><b>New Brand Kit</b></button>
    </div>
    ${kit ? `<div class="rv-adv">
      <label class="rv-check"><input type="checkbox" data-br="outro" ${w.branding.outro ? "checked" : ""}> Closing Branded Scene</label>
      <label class="rv-check"><input type="checkbox" data-br="watermark" ${w.branding.watermark ? "checked" : ""}> Logo Watermark On Every Scene</label>
      <label class="rv-check"><input type="checkbox" data-br="contact" ${w.branding.contact ? "checked" : ""}> Contact Information</label>
      <label class="rv-check"><input type="checkbox" data-br="cta" ${w.branding.cta ? "checked" : ""}> Call To Action</label>
      <button class="fb-link" id="rvKitEdit">Edit This Brand Kit</button>
    </div>` : `<div class="rv-note sm">Add A Brand Kit To Put Your Logo And Contact Details On The Branded Version.</div>`}
    <div class="rv-sub">Output Versions</div>
    <div class="rv-seg">${[["unbranded", "Unbranded"], ["branded", "Branded"], ["both", "Both"]]
      .map(([id, n]) => `<button class="${(w.outputMode || "both") === id ? "on" : ""}" data-out="${id}">${n}</button>`).join("")}</div>
    <label class="rv-check"><input type="checkbox" id="rvBurnDisc" ${w.burnDisclosure ? "checked" : ""}> Burn In Disclosure Labels</label>
    <div class="rv-note sm">Unbranded Goes To The MLS. Branded Goes Everywhere Else. Both Renders Unbranded First. Disclosure Labels Burn Into The Versions You Already Render, So Nothing Renders Twice.</div>
  </details>


  <details class="rv-acc" data-acc="captions"${accOpen.has("captions") ? " open" : ""}><summary>Captions &amp; Disclosure</summary>
    <label class="rv-check"><input type="checkbox" id="rvCaps" ${w.captions ? "checked" : ""}> Show Text On Scenes</label>
    <div class="rv-sub">Scene Labels</div>
    <div class="rv-adv">
      <button class="btn btn-ghost btn-sm" id="rvSuggestLabels"><i data-lucide="wand"></i>Suggest Labels</button>
      ${w.scenes.map((s, i) => labelEditor(s, i)).join("")}
    </div>
    <div class="rv-sub">Disclosure</div>
    <div class="rv-note sm">${discScenes.length ? `${discScenes.length} ${discScenes.length === 1 ? "Scene Will" : "Scenes Will"} Carry A Disclosure Label. Required Labels Cannot Be Removed.` : "No Altered Scenes Detected. Nothing To Disclose."}</div>
    <div class="rv-adv">
      ${discScenes.map((s) => `<label class="rv-f">${esc(s.room)}
        <select data-disc="${w.scenes.indexOf(s)}">${Object.keys(DISCLOSURE_LABEL).map((k) => `<option value="${k}" ${s.disclosure === k ? "selected" : ""}>${DISCLOSURE_LABEL[k]}</option>`).join("")}</select></label>`).join("")}
      <div class="rv-seg wrap">${[["altered", "Altered Scenes Only"], ["all", "Apply Throughout Video"], ["intro", "Intro Disclosure"], ["outro", "Outro Disclosure"]]
        .map(([id, n]) => `<button class="${w.disclosureMode === id ? "on" : ""}" data-dmode="${id}">${n}</button>`).join("")}</div>
    </div>
  </details>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
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

function stepTitles() {
  const w = S.wizard;
  if (!w.titles) w.titles = { property: true, contact: true, custom: [] };
  const t = w.titles;
  const d = titleDefaults();
  const custom = Array.isArray(t.custom) ? t.custom : [];
  return `<h3>Titles</h3>
  <p class="rv-hint">Text Cards Drawn From The Property And Your Brand Kit. Turn Off Anything You Do Not Want On Screen.</p>

  <div class="rv-tog">
    <div class="rv-tog-row">
      <span><b>Property Details</b><em>${esc(d.address)}</em></span>
      <label class="rv-switch"><input type="checkbox" data-tt="property" ${t.property ? "checked" : ""}><i></i></label>
    </div>
    <div class="rv-tog-row">
      <span><b>Contact Details</b><em>${esc([d.contactName, d.contactPhone, d.contactEmail].filter(Boolean).join(" · ") || "Add A Brand Kit To Fill This In")}</em></span>
      <label class="rv-switch"><input type="checkbox" data-tt="contact" ${t.contact ? "checked" : ""}><i></i></label>
    </div>
    <div class="rv-tog-row">
      <span><b>Custom Titles</b><em>Your Own Lines, Shown In Order.</em></span>
      <label class="rv-switch"><input type="checkbox" data-tt="customOn" ${t.customOn ? "checked" : ""}><i></i></label>
    </div>
  </div>

  ${t.property ? `<label class="rv-f">Headline<input id="rvTtHead" value="${esc(t.headline == null ? d.headline : t.headline)}" maxlength="80"></label>
  <label class="rv-f">Sub Line<input id="rvTtSub" value="${esc(t.sub == null ? "For Sale" : t.sub)}" maxlength="80"></label>` : ""}

  ${t.customOn ? `<div class="rv-adv">
    ${custom.map((c, i) => `<div class="rv-labrow"><input data-tcustom="${i}" value="${esc(c)}" maxlength="60" placeholder="Custom Title">
      <button class="rv-x" data-tcustom-del="${i}" aria-label="Remove Title"><i data-lucide="x"></i></button></div>`).join("")}
    <button class="btn btn-ghost btn-sm" id="rvTtAdd"><i data-lucide="plus"></i>Add A Title</button>
  </div>` : ""}

  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
}

/* ======================= AUDIO ======================= */
function stepAudio() {
  const w = S.wizard;
  if (!w.avatar) w.avatar = blankAvatarConfig();
  return `<h3>Audio</h3>
  <p class="rv-hint">Music Bed, Narration And Presenter.</p>
  <div class="rv-audio-sec">
  <details class="rv-acc" data-acc="audio"${accOpen.has("audio") ? " open" : ""}><summary>Audio</summary>
    <div class="rv-sub">Track</div>${musicPicker("rvMusic", w.music)}
    <label class="rv-f">Volume<input type="range" id="rvVol" min="0" max="100" value="${Math.round(w.volume * 100)}"></label>
    <label class="rv-check"><input type="checkbox" id="rvBeat" ${w.beatSync ? "checked" : ""}> Beat Sync</label>
    <div class="rv-sub">Narration</div>
    <div class="rv-seg">${[["none", "No Narration"], ["generate", "Generate Narration"], ["upload", "Upload Voiceover"]]
      .map(([id, n]) => `<button class="${w.narration === id ? "on" : ""}" data-nar="${id}">${n}</button>`).join("")}</div>
    ${w.narration === "generate" ? `<label class="rv-f">Script, Editable Draft<textarea id="rvScript" rows="4">${esc(w.script || defaultScript())}</textarea></label>
    <label class="rv-f">Voice<select id="rvVoice">${["Professional", "Warm", "Conversational", "Luxury"].map((v) => `<option value="${v.toLowerCase()}" ${w.voice === v.toLowerCase() ? "selected" : ""}>${v}</option>`).join("")}${myVoiceOption(w.voice)}</select></label>
    <div class="rv-f">${voiceStudioButton()}</div>
    <div class="rv-adv"><button class="btn btn-ghost btn-sm" id="rvVoicePrev"><i data-lucide="volume-2"></i>${w.voicePreviewing ? "Stop Preview" : "Preview Voiceover"}</button></div>` : ""}
    ${w.narration === "upload" ? `<label class="rv-f">Voiceover File, MP3, M4A Or WAV<input type="file" id="rvNarFile" accept="audio/*"></label>
    <div class="rv-note sm">${w.narrationName ? `Using ${esc(w.narrationName)}.` : "Upload a recorded voiceover to mix over your music bed."}</div>` : ""}
    ${avatarSection(w.avatar, w.title || w.propertyLabel || "")}
  </details>
  </div>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
}

/* ======================= QUALITY ======================= */
const QUALITY_TIERS: Array<[string, string, string, number, number]> = [
  ["basic", "Basic", "720p, Quick Render", 8, 1],
  ["standard", "Standard", "1080p, The Usual Choice", 20, 1.5],
  ["high", "High", "1080p, Sharper Motion And Longer Cut", 30, 2],
  ["ultra", "Ultra", "4K Master, Every Photo Used", 40, 3],
];
export function qualityTier(id: string) {
  return QUALITY_TIERS.find((t) => t[0] === id) || QUALITY_TIERS[1];
}
function qualityCost(id: string) {
  const scenes = (S.wizard?.scenes || []).length || 0;
  const t = qualityTier(id);
  return Math.round(CREDIT_COSTS.video * t[4] * (scenes > t[3] ? 1 + (scenes - t[3]) / (t[3] * 2) : 1));
}

function stepQuality() {
  const w = S.wizard;
  const scenes = w.scenes.length;
  return `<h3>Quality</h3>
  <p class="rv-hint">Higher Tiers Use More Photos And More Credits. ${scenes} Photo${scenes === 1 ? "" : "s"} Selected.</p>

  <div class="rv-qtiers">${QUALITY_TIERS.map(([id, name, note, max]) => `
    <button class="rv-qtier ${w.quality === id ? "on" : ""}" data-qual="${id}">
      <b>${name}</b><em>${note}</em>
      <span class="mono">Up To ${max} Photos · ${qualityCost(id)} Credits</span>
      ${scenes > max ? `<i class="rv-qover">${scenes - max} Photo${scenes - max === 1 ? "" : "s"} Over, Priced Above</i>` : ""}
    </button>`).join("")}</div>

  <div class="rv-sub">Mode</div>
  <div class="rv-seg">${[["auto", "Auto"], ["advanced", "Advanced"]]
    .map(([id, n]) => `<button class="${(w.mode || "auto") === id ? "on" : ""}" data-mode="${id}">${n}</button>`).join("")}</div>
  <div class="rv-note sm">${(w.mode || "auto") === "auto"
    ? "Auto Picks Motion, Transitions And Pacing For You. Everything You Set Elsewhere Still Applies."
    : "Advanced Keeps Every Per Scene Choice You Made Exactly As You Set It."}</div>

  <div class="rv-sub">Formats</div>
  <div class="rv-seg wrap">${[["9:16", "Vertical"], ["1:1", "Square"], ["16:9", "Horizontal"]]
    .map(([id, n]) => `<button class="${w.formats.includes(id) ? "on" : ""}" data-fmt="${id}">${n}</button>`).join("")}</div>

  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button></div>`;
}

function plannedVariants() {
  const w = S.wizard;
  const mode = w.outputMode || "both";
  const versions = [];
  if (mode === "unbranded" || mode === "both") versions.push("clean");
  if (mode === "branded" || mode === "both") versions.push("branded");
  const out = [];
  for (const f of w.formats) {
    for (const v of versions) out.push({ aspect_ratio: f, version_type: v, brand_kit_id: v === "branded" ? w.brandKitId || null : null });
  }
  return out;
}

function vfxGenCredits() {
  return (S.wizard?.scenes || []).reduce((n, s) => n + (s.vfx_gen ? (tileById(s.vfx_gen)?.credits || 0) : 0), 0);
}
function creditTotal() {
  return CREDIT_COSTS.video + immersiveCount() * IMMERSIVE_CREDITS_PER_SCENE + vfxGenCredits();
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
    <div class="rv-cost mono">${cost} Credits</div>
    ${block ? `<div class="rv-note sm">${esc(block)}</div>` : bal != null && bal < cost ? `<div class="rv-note sm">Your Balance Is ${bal}. Add Credits Before Rendering.</div>` : ""}
    ${!block && typeof MediaRecorder === "undefined" ? `<div class="rv-note sm">This Browser Cannot Record Video. Open REAL DESIGNS In Chrome Or Edge On A Computer To Render.</div>` : ""}
    ${w.busy ? `<div class="rv-proc sm"><b>Creating Your Video</b>
      <div class="rv-prog"><i style="width:${Math.round(w.progress * 100)}%"></i></div>
      <span>${esc(w.stage || "Preparing scenes")}</span>
      <div class="rv-note sm">Keep This Tab Open And Visible Until The Render Finishes. Switching Away Can Stall It.</div></div>`
      : w.step === 4
        ? block
          ? `<button class="btn btn-primary rv-cta" id="rvAddCredits"><i data-lucide="zap"></i>Add Credits To Render</button>`
          : `<button class="btn btn-primary rv-cta" id="rvGen" ${vs.length && typeof MediaRecorder !== "undefined" ? "" : "disabled"}><i data-lucide="clapperboard"></i>Generate Video</button>`

        : `<button class="btn btn-primary rv-cta" id="rvNext" ${stepReady() ? "" : "disabled"}>Continue</button>`}

  </div>`;
}


/* ======================= SCENE HELPERS ======================= */
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
  w.scenes.sort((a, b) => {
    const ga = orderRank(groupFor(a.room));
    const gb = orderRank(groupFor(b.room));
    return ga - gb || a.room.localeCompare(b.room);
  });
}

/* ======================= GENERATION ======================= */
async function generate() {
  const w = S.wizard;
  const vs = plannedVariants();

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
  w.progress = 0;
  w.stage = "Preparing scenes";
  render();


  let projectId = null;
  try {
    const per = sceneDurations(w.scenes.length, w.length);
    const saved = await saveVideo({
      project: {
        property_id: w.propertyId || null,
        property_label: w.propertyLabel || null,
        design_version_id: w.versionId || null,
        title: w.title || w.propertyLabel || "Untitled Video",
        video_type: w.videoType,
        source_type: w.sourceType || "property",
        status: "queued",
        formats: w.formats,
        length_preset: w.length,
        transition: w.transition,
        motion: w.motion,
        brand_kit_id: w.brandKitId || null,
        branding: w.branding,
        disclosure: { mode: w.disclosureMode },
        settings: { baTransition: w.baTransition || "match" },
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

    const started = await startRender({ id: projectId, variants: vs });
    track?.("reveal_generate", { formats: w.formats.join(","), scenes: w.scenes.length });
    await renderAllVariants(projectId, started.variants, w);
    await setVideoStatus({ id: projectId, status: "ready" });
    toast("Your Video Is Ready.");
    await loadLibrary();
    S.screen = "detail";
    S.detailId = projectId;
    await openDetail(projectId);
  } catch (e) {
    const msg = String(e?.message || e || "");
    const entitlement = isPlanBlocked(msg);
    if (projectId) {
      if (entitlement) {
        // The server refused before rendering anything, so nothing was spent
        // and nothing should stay in the library.
        try { await deleteVideo({ id: projectId }); } catch (_) {}
      } else {
        try { await setVideoStatus({ id: projectId, status: "failed", error_message: (msg || "The render did not finish.").slice(0, 300) }); } catch (_) {}
      }
    }
    toast(msg || "The render failed. Your selections were saved.");
    if (entitlement) openUpgrade(msg);
    w.busy = false;
    await loadLibrary();
    S.screen = entitlement ? "wizard" : "library";
    render();
  }

}

const STAGES = ["Preparing scenes", "Creating motion", "Building transitions", "Adding audio and captions", "Applying branding", "Finalizing formats"];

async function renderAllVariants(projectId, variants, cfg, perOverride) {
  const w = cfg;
  const per = perOverride || sceneDurations(w.scenes.length, w.length);
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const urls = [];
  for (const s of w.scenes) {
    urls.push({
      url: await resolvePhotoUrl(s.path),
      compareUrl: s.compare ? await resolvePhotoUrl(s.compare) : null,
      room_name: s.room,
      scene_type: s.scene_type,
      duration: per,
      motion: s.motion || "auto",
      transition: s.scene_type === "before_after" ? (w.baTransition || "match") : w.transition,
      caption: w.captions ? s.caption || s.room : null,
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
    const out = await renderReveal(urls, {
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

async function paintAssetThumbs() {
  const els = Array.from(host()?.querySelectorAll("[data-img]") || []);
  let missing = false;
  await Promise.all(
    els.map(async (el) => {
      if (el.dataset.painted) return;
      const path = el.getAttribute("data-img");
      if (!path) return;
      const url = await cachedPhotoUrl(path);
      if (url) {
        el.style.backgroundImage = `url("${url}")`;
        el.classList.remove("rv-noimg");
        /* Only a real paint counts, otherwise the tile is poisoned forever. */
        el.dataset.painted = "1";
        return;
      }
      if (!el.querySelector(".rv-noimg-i")) {
        el.insertAdjacentHTML("beforeend", `<i class="rv-noimg-i" data-lucide="image-off"></i>`);
      }
      el.classList.add("rv-noimg");
      missing = true;
    }),
  );
  if (missing) paint();
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
  el.innerHTML =
    S.screen === "wizard" ? wizardHtml() : S.screen === "detail" ? detailHtml() : libraryHtml();
  paint();
  paintAssetThumbs();

  if (S.screen === "library") paintThumbs();
  if (S.screen === "detail" && S.detail) mountPlayer();
  bind();

}

function bind() {
  const el = host();
  if (!el) return;
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));

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
  on("#rvCancel", "click", () => { S.screen = "library"; S.wizard = null; render(); });
  on("#rvBack", "click", () => { w.step = Math.max(1, w.step - 1); render(); });
  on(".rv-steps span", "click", (e) => {
    const n = Number(e.currentTarget.dataset.step);
    if (n && n < w.step) { w.step = n; render(); }
  });
  on("#rvNext", "click", async () => {
    const t = el.querySelector("#rvTitle");
    if (t) w.title = t.value;
    if (w.step === 1) {
      w.step = 2;
      await loadWizardAssets();
      /* The user can leave the builder mid-load; never touch a discarded wizard. */
      if (S.wizard !== w) return;
      if (!w.scenes.length) { selectRecommended(); autoArrange(); }
      render();
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
    w.step = Math.min(4, w.step + 1);
    render();
  });
  on("#rvLowX", "click", () => { w.lowModal = false; render(); });
  on("#rvLowMore", "click", () => { w.lowModal = false; w.step = 1; render(); });
  on("#rvLowGo", "click", () => { w.lowModal = false; w.step = 3; render(); });


  const titleIn = el.querySelector("#rvTitle");
  if (titleIn) titleIn.addEventListener("input", (ev) => { w.title = ev.target.value; w.titleTouched = true; });
  on("[data-rmup]", "click", (e) => {
    const id = e.currentTarget.dataset.rmup;
    w.uploads = w.uploads.filter((u) => u.id !== id);
    render();
  });
  const addUploads = (list) => {
    for (const f of Array.from(list || [])) {
      if (!/^image\//.test(f.type || "")) continue;
      w.uploads.push({ id: crypto.randomUUID(), name: f.name.replace(/\.[a-z0-9]+$/i, ""), url: URL.createObjectURL(f) });
    }
    render();
  };
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
    w.versionId = d.versionId;
    if (!w.titleTouched) w.title = `${d.room} Design`;
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
      onPick: (picked) => addUploads(picked.map((p) => p.file)),
      onProperty: (address) => {
        const p = S.tree.find((x) => x.address === address);
        w.propertyLabel = address;
        if (p) w.propertyId = p.id;
        if (!w.titleTouched) w.title = address;
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
    render();
  });
  on("[data-drop]", "click", (e) => { e.stopPropagation(); w.scenes.splice(Number(e.currentTarget.dataset.drop), 1); render(); });
  on("[data-move]", "click", (e) => {
    e.stopPropagation();
    const row = e.currentTarget.closest(".rv-scene, .rv-scard");
    const i = Number(row.dataset.idx);
    const j = i + Number(e.currentTarget.dataset.move);
    if (j < 0 || j >= w.scenes.length) return;
    const [x] = w.scenes.splice(i, 1);
    w.scenes.splice(j, 0, x);
    render();
  });
  on("#rvRecommend", "click", () => { selectRecommended(); autoArrange(); render(); });
  on("#rvClear", "click", () => { w.scenes = []; render(); });
  on("#rvAuto", "click", () => { autoArrange(); render(); });
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
    render();
  });
  on("#rvKeepAll", "click", () => render());

  /* drag ordering */
  el.querySelectorAll(".rv-scene, .rv-scard").forEach((n) => {
    n.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", n.dataset.idx));
    n.addEventListener("dragover", (e) => e.preventDefault());
    n.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      const to = Number(n.dataset.idx);
      if (Number.isNaN(from) || from === to) return;
      const [x] = w.scenes.splice(from, 1);
      w.scenes.splice(to, 0, x);
      render();
    });
  });

  /* setup */
  on("[data-fmt]", "click", (e) => {
    const f = e.currentTarget.dataset.fmt;
    w.formats = w.formats.includes(f) ? w.formats.filter((x) => x !== f) : w.formats.concat(f);
    render();
  });
  on("[data-orient]", "click", (e) => {
    const o = ORIENTATIONS.find(([id]) => id === e.currentTarget.dataset.orient);
    if (o) w.formats = o[2].slice();
    render();
  });
  on("[data-len]", "click", (e) => { w.length = e.currentTarget.dataset.len; render(); });
  /* scene chips and their popovers */
  const cur = () => (w.pop ? w.scenes[w.pop.i] : null);
  on("[data-pop]", "click", (e) => {
    e.stopPropagation();
    w.pop = { kind: e.currentTarget.dataset.pop, i: Number(e.currentTarget.dataset.i) };
    w.popQ = ""; w.popHover = null;
    render();
  });
  on("#rvPopX, #rvPopDone", "click", () => { w.pop = null; render(); });
  const pq = el.querySelector("#rvPopQ");
  if (pq) pq.addEventListener("input", (ev) => { w.popQ = ev.target.value; render(); el.querySelector("#rvPopQ")?.focus(); });
  on("[data-motionpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.motion = e.currentTarget.dataset.motionpick;
    s.motion_level = "standard";
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
  on("[data-lookcat]", "click", (e) => { w.popCat = e.currentTarget.dataset.lookcat; render(); });
  on("[data-gradecat]", "click", (e) => { w.popGrade = e.currentTarget.dataset.gradecat; render(); });
  on("[data-lookpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.look = e.currentTarget.dataset.lookpick || null;
    render();
  });
  on("[data-vfxpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    const t = tileById(e.currentTarget.dataset.vfxpick);
    s.vfx = t?.id || "none";
    s.look = t?.look || null;
    s.vfx_gen = t?.gen ? t.id : null;
    if (t?.gen && t.disclosure) s.disclosure = t.disclosure;
    render();
  });
  const amt = el.querySelector("#rvLookAmt");
  if (amt) amt.addEventListener("change", (ev) => { const s = cur(); if (s) s.look_amount = Number(ev.target.value); render(); });
  on("#rvAllMotion", "change", (e) => {
    if (!e.currentTarget.checked) return;
    const src = cur(); if (!src) return;
    w.scenes.forEach((s) => { s.motion = src.motion || "auto"; s.motion_level = src.motion_level || "standard"; s.immersive_effect = src.immersive_effect || null; });
    toast("Motion Applied To Every Scene.");
  });
  on("#rvAllLook", "change", (e) => {
    if (!e.currentTarget.checked) return;
    const src = cur(); if (!src) return;
    w.scenes.forEach((s) => {
      s.look = src.look || null; s.look_amount = src.look_amount ?? 100;
      s.vfx = src.vfx || "none"; s.vfx_gen = src.vfx_gen || null;
      if (src.vfx_gen) { const t = tileById(src.vfx_gen); if (t?.disclosure) s.disclosure = t.disclosure; }
    });
    toast("VFX Applied To Every Scene.");
  });
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

  /* inline room rename */
  on("[data-rename]", "click", (e) => { e.preventDefault(); e.stopPropagation(); w.renaming = e.currentTarget.dataset.rename; render(); });
  const nameIn = el.querySelector("[data-nameinput]");
  if (nameIn) {
    nameIn.focus(); nameIn.select();
    const commit = (save) => {
      const attr = nameIn.dataset.nameinput || "";
      const val = roomLabelOf(nameIn.value);
      w.renaming = null;
      if (save && attr) {
        if (attr.startsWith("a:")) {
          const key = attr.slice(2);
          const a = w.available.find((x) => x.key === key);
          if (a) a.room = val;
          w.scenes.filter((x) => x.key === key).forEach((x) => { x.room = val; });
        } else {
          const sc = w.scenes[Number(attr.slice(2))];
          if (sc) sc.room = val;
        }
      }
      render();
    };
    nameIn.addEventListener("blur", () => commit(true));
    nameIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
  }
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

  on("[data-cap]", "input", (e) => { w.scenes[Number(e.currentTarget.dataset.cap)].caption = e.currentTarget.value; });

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


  /* branding */
  on("[data-kit]", "click", (e) => { w.brandKitId = e.currentTarget.dataset.kit || null; render(); });
  on("#rvKitNew", "click", () => openBrandKit(null));
  on("#rvKitEdit", "click", () => openBrandKit(S.kits.find((k) => k.id === w.brandKitId)));
  on("[data-br]", "change", (e) => { w.branding[e.currentTarget.dataset.br] = e.currentTarget.checked; });
  on("[data-ver]", "change", (e) => { w.versions[e.currentTarget.dataset.ver] = e.currentTarget.checked; });
  on("[data-disc]", "change", (e) => { w.scenes[Number(e.currentTarget.dataset.disc)].disclosure = e.currentTarget.value; });
  on("[data-dmode]", "click", (e) => { w.disclosureMode = e.currentTarget.dataset.dmode; render(); });

  /* review */
  on("#rvGen", "click", () => generate());
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
  w.formats = p.formats || ["9:16"];
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
    disclosure: s.disclosure_type,
    motion_level: s.motion_level === "immersive" ? "immersive" : "standard",
    immersive_effect: s.immersive_effect || null,
    exterior_effect: s.exterior_effect || null,
    labels: Array.isArray(s.labels) ? s.labels : [],
    asset_id: s.source_asset_id,
    version_id: s.source_version_id,
  }));
  w.step = 3;
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
  S.wizard = newWizard(seed);
  S.screen = "wizard";
  if (S.wizard.propertyId) loadWizardAssets().then(render);
  render();
  /* Another view can steal focus while the builder mounts (media tab
     restores, deep links). The wizard host must stay the visible view. */
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
  S.screen = "library";
  S.wizard = null;
  S.detail = null;
  S.detailId = null;
  const el = host();
  if (el) { el.innerHTML = ""; S.mounted = false; }
}
