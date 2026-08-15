// REAL REVEAL — property video and marketing content.
// Library, create wizard, storyboard editor and share settings. Sources come
// from the property tree and media that already exist; nothing is re-uploaded.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { toggleMusic, stopMusic, playingId, addCustomTrack, getCustomTracks, loadCustomTracks } from "@/lib/rd-music";
import { voiceRequest } from "@/lib/rd-voice";
import { openSocialCopy } from "@/lib/rd-social-copy";
import { myVoiceOption, openVoiceStudio, voiceStudioButton } from "@/lib/rd-voice-ui";
import { supabase } from "@/integrations/supabase/client";
import { resolvePhotoUrl } from "@/lib/room-photos";
import { getPropertyTree } from "@/lib/workspace.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
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


/** True when a failed render was refused for plan/credit reasons, not a bug. */
function planBlockedMsg(p) {
  return isPlanBlocked((p && p.error_message) || "");
}

function openUpgradeFlow(p) {
  const msg = String((p && p.error_message) || "") || "Video rendering needs a paid plan.";
  openUpgrade(msg);
}

/** Null when the account can pay for a video render, otherwise the reason. */
function videoCreditBlock() {
  const c = S.credits;
  if (!c || c.unavailable) return null;
  if (c.plan === "free") return "Video rendering needs a paid plan. The free plan covers 5 designs a day.";
  if ((c.balance ?? 0) < CREDIT_COSTS.video)
    return `Not enough credits. This video costs ${CREDIT_COSTS.video} and you have ${c.balance ?? 0}.`;
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
  { id: "none", group: "No Music", name: "No Music" },
  { id: "modern", group: "Modern", name: "Clean Modern" },
  { id: "luxury", group: "Luxury", name: "Quiet Luxury" },
  { id: "warm", group: "Warm", name: "Warm Home" },
  { id: "cinematic", group: "Cinematic", name: "Cinematic Reveal" },
  { id: "upbeat", group: "Upbeat", name: "Upbeat Listing" },
  { id: "minimal", group: "Minimal", name: "Minimal Pulse" },
];

function musicList() {
  return MUSIC.concat(getCustomTracks().map((t) => ({ id: t.id, group: "My Uploads", name: t.name })));
}
function musicPicker(id, sel, withGroup) {
  const on = playingId() && playingId() === sel;
  return `<div class="rv-music">
    <select id="${id}">${musicList().map((m) => `<option value="${m.id}" ${sel === m.id ? "selected" : ""}>${esc(withGroup ? m.group + " \u2014 " + m.name : m.name)}</option>`).join("")}</select>
    <button type="button" class="btn btn-ghost btn-sm rv-music-play" data-musicplay="${id}" ${sel === "none" ? "disabled" : ""}><i data-lucide="${on ? "pause" : "play"}"></i>${on ? "Stop" : "Preview"}</button>
    <button type="button" class="btn btn-ghost btn-sm" data-musicup="${id}"><i data-lucide="upload"></i>Upload Track</button>
    <input type="file" accept="audio/*" class="rv-music-file" data-musicfile="${id}" hidden>
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
  "Outdoor Areas", "Backyard", "Floor Plans", "Concepts", "Other",
];

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
  return "Other";
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
    address: "",
    candidates: [],
    pop: null,
    popQ: "",
    popCat: "featured",
    lowModal: false,
    lowWarned: false,
    disclosureMode: "altered",
    uploads: [],
    busy: false,
    progress: 0,
    stage: "",
  };
}

/** Build the available asset list from what the property already holds. */
async function loadWizardAssets() {
  const w = S.wizard;
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
        out.push({
          key: "m-" + a.id, path: a.storage_path, room: a.room_group || "Other", kind: "Original",
          group: groupFor(a.room_group, ""), asset_id: a.id, disclosure: null, recommended: !!a.recommended,
          dup: a.dup_group || null,
        });
      }
    } catch (_) {}
  }
  for (const u of w.uploads) out.push({ key: "u-" + u.id, path: u.url, room: u.name, kind: "Original", group: "Other", disclosure: null, uploaded: true });
  w.available = out;
}

const WIZ_STEPS = ["Photos", "Select", "Edit", "Brand"];

function wizardHtml() {
  const w = S.wizard;
  const rail = `<div class="rv-steps">${WIZ_STEPS
    .map((s, i) => `<span class="${w.step === i + 1 ? "on" : w.step > i + 1 ? "done" : ""}" data-step="${i + 1}">${s}${i === 1 && w.scenes.length ? `<i class="rv-badge mono">${w.scenes.length}</i>` : ""}</span>`)
    .join("")}</div>`;

  let body = "";
  if (w.step === 1) body = stepPhotos();
  if (w.step === 2) body = stepSelect();
  if (w.step === 3) body = stepEdit();
  if (w.step === 4) body = stepBrand();

  return `<div class="rv-head">
    <div><h2>Create A Property Video</h2><p>${esc(w.propertyLabel || "Build a video from content you already have.")}</p></div>
    <button class="btn btn-ghost" id="rvCancel"><i data-lucide="x"></i>Cancel</button>
  </div>
  ${rail}
  <div class="rv-layout ${w.step > 1 ? "with-side" : ""}">
    <div class="rv-wiz">${body}</div>
    ${w.step > 1 ? `<aside class="rv-side">${previewPanel()}</aside>` : ""}
  </div>
  ${w.pop ? popoverHtml() : ""}
  ${w.lowModal ? lowSceneModal() : ""}`;
}

/* ======================= STEP 1, PHOTOS ======================= */
function stepPhotos() {
  const w = S.wizard;
  const opts = [
    ["address", "Property Address", "Import Photos From The Listing.", "map-pin"],
    ["upload", "Upload", "Drag Photos In Or Browse Your Device.", "upload"],
    ["property", "A Property You Already Have", "Use Rooms, Designs And Photos Already In Your Workspace.", "home"],
    ["design", "A Design", "Start From One Finished Design Or A Before And After.", "images"],
  ];
  const recent = S.tree.slice(0, 6);
  let panel = "";
  if (w.sourceType === "address") {
    panel = `<div class="rv-srcpanel">
      <label class="rv-f">Property Address<span class="rv-inp-ic"><i data-lucide="search"></i><input id="rvAddr" value="${esc(w.address || "")}" placeholder="3417 Hoover Dr, Holiday, FL 34691"></span></label>
      <button class="btn btn-primary btn-sm" id="rvAddrGo">${w.addrBusy ? "Looking Up" : "Find Photos"}</button>
      ${(w.candidates || []).length ? `<div class="rv-sub">Choose A Listing</div>
      <div class="rv-cands">${w.candidates.map((c, i) => `<div class="rv-cand">
        <span class="rv-a-th" data-img="${esc(c.cover || "")}"></span>
        <div><b class="mono">${esc(c.price || "")}</b><span>${esc(c.address || "")}</span>
        <i class="mono">${esc(c.meta || "")}</i></div>
        <button class="btn btn-ghost btn-xs" data-cand="${i}">Use This Listing</button>
      </div>`).join("")}</div>` : ""}
      ${w.addrNote ? `<div class="rv-note">${esc(w.addrNote)}</div>` : ""}
      <button class="fb-link" id="rvAddrSkip">No Thanks, I Will Upload Photos Myself</button>
    </div>`;
  } else if (w.sourceType === "upload") {
    panel = `<div class="rv-srcpanel">
      <div class="rv-upload"><input type="file" id="rvFiles" accept="image/*" multiple hidden>
        <button class="btn btn-ghost" id="rvBrowse"><i data-lucide="image-plus"></i>Browse Files</button>
        <span class="mono">${w.uploads.length} Photos Added</span>
      </div>
    </div>`;
  } else if (w.sourceType === "property" || w.sourceType === "design") {
    panel = recent.length
      ? `<div class="rv-sub">Recent Properties</div>
      <div class="rv-recents">${recent
        .map((p) => `<button class="rv-recent ${w.propertyId === p.id ? "on" : ""}" data-prop="${p.id}"><i data-lucide="home"></i><b>${esc(p.address)}</b><span class="mono">${(p.projects || []).reduce((a, pr) => a + (pr.rooms || []).length, 0)} Rooms</span></button>`)
        .join("")}</div>`
      : `<div class="rv-note">No Properties Yet. Upload Photos To Start.</div>`;
  }

  const ready = w.sourceType === "upload" || w.sourceType === "address" ? w.uploads.length > 0 : !!w.propertyId;
  return `<h3>Where Are The Photos?</h3>
  <div class="rv-opts">${opts
    .map(([id, n, d, ic]) => `<button class="rv-opt ${w.sourceType === id ? "on" : ""}" data-src="${id}"><i data-lucide="${ic}"></i><b>${n}</b><span>${d}</span></button>`)
    .join("")}</div>
  ${panel}
  <label class="rv-f">Video Title<input id="rvTitle" value="${esc(w.title || (w.propertyLabel ? w.propertyLabel + " Reveal" : "Untitled Reveal"))}"></label>
  <div class="rv-foot"><button class="btn btn-primary" id="rvNext" ${ready ? "" : "disabled"}>Continue</button></div>`;
}

/* ======================= STEP 2, SELECT ======================= */
function stepSelect() {
  const w = S.wizard;
  const groups = {};
  for (const a of w.available) (groups[a.group] = groups[a.group] || []).push(a);
  const order = Object.keys(groups).sort((a, b) => orderRank(a) - orderRank(b));
  const dupCount = w.available.filter((a) => a.dup).length;

  const left = order.map((g) => `<div class="rv-g"><div class="rv-g-h">${esc(g)}</div><div class="rv-g-b">${groups[g]
    .map((a) => `<button class="rv-asset ${w.scenes.some((s) => s.key === a.key) ? "on" : ""}" data-asset="${a.key}">
      <span class="rv-a-th" data-img="${esc(a.path)}"></span>
      <span class="rv-a-m"><b>${esc(a.room || "Untitled")}</b><i>${a.kind}${a.disclosure ? " • " + DISCLOSURE_LABEL[a.disclosure] : ""}</i></span>
    </button>`).join("")}</div></div>`).join("");

  const right = w.scenes.length
    ? w.scenes.map((s, i) => `<div class="rv-scene" draggable="true" data-idx="${i}">
        <span class="rv-seq mono">${i + 1}</span>
        <span class="rv-a-th" data-img="${esc(s.path)}"></span>
        <span class="rv-s-m"><b>${esc(s.room)}</b><i>${s.scene_type === "before_after" ? "Before & After" : s.kind}</i></span>
        <span class="rv-s-a">
          <button class="icon-btn" data-move="-1" title="Move Up"><i data-lucide="chevron-up"></i></button>
          <button class="icon-btn" data-move="1" title="Move Down"><i data-lucide="chevron-down"></i></button>
          <button class="icon-btn" data-drop="${i}" title="Remove"><i data-lucide="x"></i></button>
        </span>
      </div>`).join("")
    : `<div class="rv-note">No Scenes Yet. Add Content From The Left.</div>`;

  return `<h3>Select Scenes</h3>
  ${dupCount ? `<div class="rv-dup"><i data-lucide="copy"></i><b>${dupCount} Similar Angles Detected</b><span><button class="fb-link" id="rvKeepBest">Keep Best</button><button class="fb-link" data-goto="media">Review</button><button class="fb-link" id="rvKeepAll">Keep All</button></span></div>` : ""}
  <div class="rv-two">
    <div class="rv-col"><div class="rv-col-h">Available Content</div><div class="rv-col-b">${left || `<div class="rv-note">No Content Found For This Source.</div>`}</div></div>
    <div class="rv-col"><div class="rv-col-h">Video Scenes<span class="mono">${w.scenes.length}</span></div><div class="rv-col-b" id="rvSceneList">${right}</div></div>
  </div>
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
    <div class="rv-modal-h"><b>Add A Few More Rooms</b><button class="icon-btn" id="rvLowX"><i data-lucide="x"></i></button></div>
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
  auto: "Automatic picks the camera move that suits each room.",
  push: "Push In moves the camera slowly toward the room, drawing the viewer inward.",
  pull: "Pull Out starts tight and widens to reveal the whole space.",
  pan_left: "Pan Left glides across the room from right to left.",
  pan_right: "Pan Right glides across the room from left to right.",
  orbit_left: "Orbit Left rotates the camera counter clockwise around the focal point.",
  orbit_right: "Orbit Right rotates the camera clockwise around the focal point, creating a sense of depth.",
  static: "Static holds the frame still, letting the design speak for itself.",
};
const CROPS = [["center", "Center"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]];

function motionLabel(s) {
  if (s.motion_level === "immersive") {
    const e = IMMERSIVE_EFFECTS.find(([id]) => id === (s.immersive_effect || "light"));
    return e ? e[1] : "Immersive";
  }
  const m = STANDARD_MOTIONS.find(([id]) => id === (s.motion || "auto"));
  return m ? m[1] : "Automatic";
}

function sceneCard(s, i) {
  const w = S.wizard;
  const look = s.look ? lookById(s.look) : null;
  const changed = (s.motion && s.motion !== "auto") || s.motion_level === "immersive" || s.exterior_effect;
  return `<div class="rv-scard" draggable="true" data-idx="${i}">
    <div class="rv-scard-th" data-img="${esc(s.path)}">
      <span class="rv-seq mono">${i + 1}</span>
      <button class="rv-x" data-drop="${i}" aria-label="Remove Scene"><i data-lucide="x"></i></button>
      <div class="rv-mchips">
        <button class="rv-mchip ${changed ? "hot" : ""}" data-pop="motion" data-i="${i}"><i data-lucide="video"></i>${esc(motionLabel(s))}<i data-lucide="chevron-down"></i></button>
        <button class="rv-mchip" data-pop="crop" data-i="${i}"><i data-lucide="crop"></i><span class="mono">${esc((CROPS.find(([c]) => c === (s.crop || "center")) || CROPS[0])[1])}</span></button>
        <button class="rv-mchip ${look ? "hot" : ""}" data-pop="look" data-i="${i}"><i data-lucide="palette"></i>${esc(look ? look.label : "Look")}</button>
      </div>
    </div>
    <div class="rv-scard-b">
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
    const rows = STANDARD_MOTIONS.filter(([, n]) => !q || n.toLowerCase().includes(q));
    const hov = w.popHover || (s.motion_level === "immersive" ? null : s.motion || "auto");
    body = `<div class="rv-pop-two">
      <div class="rv-pop-list">
        <input id="rvPopQ" value="${esc(w.popQ || "")}" placeholder="Choose Camera Motion">
        ${rows.map(([id, n]) => `<button class="rv-pop-row ${s.motion_level !== "immersive" && (s.motion || "auto") === id ? "on" : ""}" data-motionpick="${id}" data-hover="${id}">${id === "auto" ? "Automatic, Recommended" : n}</button>`).join("")}
        <div class="rv-pop-sep"></div>
        <div class="rv-pop-h">Immersive Movement</div>
        ${IMMERSIVE_EFFECTS.map(([id, n]) => `<button class="rv-pop-row ${s.motion_level === "immersive" && (s.immersive_effect || "light") === id ? "on" : ""}" data-immpick="${id}">${esc(n)}<i class="mono">+${IMMERSIVE_CREDITS_PER_SCENE}</i></button>`).join("")}
        <div class="rv-note sm">Only movement is animated. Walls, windows and furniture stay exactly as designed.</div>
        ${isExterior(s) ? `<div class="rv-pop-sep"></div><div class="rv-pop-h">Cinematic Exterior</div>
        <button class="rv-pop-row ${s.exterior_effect ? "" : "on"}" data-extpick="">None</button>
        ${EXTERIOR_EFFECTS.map(([id, n]) => `<button class="rv-pop-row ${s.exterior_effect === id ? "on" : ""}" data-extpick="${id}">${esc(n)}</button>`).join("")}
        ${s.exterior_effect ? `<div class="rv-note sm">${esc(EXTERIOR_DISCLOSURE)}</div>` : ""}` : ""}
      </div>
      <div class="rv-pop-prev">
        <div class="rv-pop-clip ${esc(hov || "auto")}" data-img="${esc(s.path)}"></div>
        <b>${esc((STANDARD_MOTIONS.find(([id]) => id === hov) || ["", "Automatic"])[1])}</b>
        <span>${esc(MOTION_COPY[hov] || MOTION_COPY.auto)}</span>
      </div>
    </div>`;
  } else if (kind === "crop") {
    body = `<div class="rv-pop-list">
      <div class="rv-pop-h">Crop <i class="mono">${esc(w.formats[0] || "9:16")}</i></div>
      ${CROPS.map(([id, n]) => `<button class="rv-pop-row ${(s.crop || "center") === id ? "on" : ""}" data-croppick="${id}">${n}</button>`).join("")}
    </div>`;
  } else {
    const cat = w.popCat || "featured";
    const looks = VFX_LOOKS.filter((l) => (l.cat || "featured") === cat);
    body = `<div class="rv-pop-look">
      <div class="rv-seg tiny">${VFX_CATEGORIES.map(([id, n]) => `<button class="${cat === id ? "on" : ""}" data-lookcat="${id}">${n}</button>`).join("")}</div>
      <div class="rv-looks">
        <button class="rv-look ${s.look ? "" : "on"}" data-lookpick=""><span class="rv-look-th none"><i data-lucide="ban"></i></span><b>None</b></button>
        ${looks.map((l) => `<button class="rv-look ${s.look === l.id ? "on" : ""}" data-lookpick="${l.id}" title="${esc(l.blurb)}"><span class="rv-look-th" data-img="${esc(s.path)}">${lookOverlayHTML(l, s.look_amount ?? 100)}</span><b>${esc(l.label)}</b></button>`).join("")}
      </div>
      <label class="rv-f">Intensity<input type="range" id="rvLookAmt" min="10" max="100" value="${s.look_amount ?? 100}"></label>
    </div>`;
  }
  return `<div class="rv-modal on" id="rvPopWrap"><div class="rv-modal-in wide" role="dialog" aria-label="Scene options">
    <div class="rv-modal-h"><b>${kind === "motion" ? "Camera Motion" : kind === "crop" ? "Crop" : "Look"}</b><button class="icon-btn" id="rvPopX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">${body}</div>
    <div class="rv-modal-f"><button class="btn btn-primary" id="rvPopDone">Done</button></div>
  </div></div>`;
}

/* ======================= STEP 3, EDIT ======================= */
function stepEdit() {
  const w = S.wizard;
  const per = sceneDurations(w.scenes.length, w.length);
  const total = Math.round(per * w.scenes.length);
  const imm = immersiveCount();
  return `<h3>Edit The Video</h3>
  <div class="rv-sub">Video Type</div>
  <div class="rv-seg wrap">${VIDEO_TYPES.map((t) => `<button class="${w.videoType === t.id ? "on" : ""}" data-type="${t.id}">${t.name}</button>`).join("")}</div>
  <div class="rv-sub">Format</div>
  <div class="rv-seg wrap">${FORMATS.map((f) => `<button class="${w.formats.includes(f.id) ? "on" : ""}" data-fmt="${f.id}">${f.name}</button>`).join("")}</div>
  <div class="rv-sub">Length</div>
  <div class="rv-seg wrap">${LENGTHS.map(([id, n]) => `<button class="${w.length === id ? "on" : ""}" data-len="${id}">${n}</button>`).join("")}</div>

  <div class="rv-bulk">
    <button class="btn btn-ghost btn-xs" id="rvAllMotion"><i data-lucide="video"></i>Apply Motion To All</button>
    <button class="btn btn-ghost btn-xs" id="rvAllLook"><i data-lucide="palette"></i>Apply Look To All</button>
    <button class="btn btn-ghost btn-xs" id="rvAuto"><i data-lucide="arrow-down-up"></i>Auto Arrange</button>
    <span class="mono">${w.scenes.length} Scenes · ${total}s · ${creditTotal()} Credits</span>
  </div>
  ${imm > 4 ? `<div class="rv-note sm">Immersive Movement Is On For ${imm} Scenes, ${imm * IMMERSIVE_CREDITS_PER_SCENE} Extra Credits. Most Videos Only Need It On Two Or Three.</div>` : ""}
  <div class="rv-sgrid">${w.scenes.map((s, i) => sceneCard(s, i)).join("") || `<div class="rv-note">No Scenes Selected.</div>`}</div>

  <div class="rv-sub">Transitions</div>
  <div class="rv-seg wrap">${[["clean", "Clean"], ["smooth", "Smooth"], ["cinematic", "Cinematic"], ["match", "Before & After"], ["none", "None"], ["whip", "Whip Pan"], ["punch", "Zoom Punch"], ["flash", "Flash Cut"], ["glitch", "Glitch"], ["leak", "Light Leak"], ["slide", "Slide"]]
    .map(([id, n]) => `<button class="${w.transition === id ? "on" : ""}" data-tr="${id}">${n}</button>`).join("")}</div>
  ${w.scenes.some((s) => s.scene_type === "before_after") ? `<div class="rv-sub">Before &amp; After Reveal</div>
  <div class="rv-seg wrap">${[["match", "Match Frame"], ["slider", "Slider Reveal"], ["wipe", "Wipe"], ["fade", "Fade"]]
    .map(([id, n]) => `<button class="${w.baTransition === id || (!w.baTransition && id === "match") ? "on" : ""}" data-ba="${id}">${n}</button>`).join("")}</div>` : ""}
  <label class="rv-f">Narration Script, Optional<textarea id="rvScript" rows="4" placeholder="Leave Blank For No Narration">${esc(w.script || "")}</textarea></label>

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
  if (rooms.length) lines.push(`This reveal covers ${rooms.join(", ")}.`);
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


/* ======================= STEP 4, BRAND ======================= */
function stepBrand() {
  const w = S.wizard;
  if (!w.avatar) w.avatar = blankAvatarConfig();
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  const discScenes = w.scenes.filter((s) => s.disclosure);
  return `<h3>Brand & Audio</h3>

  <details class="rv-acc" open><summary>Template</summary>
    <div class="rv-seg wrap">${[["none", "No Intro Or Outro"], ["clean", "Clean Title Card"], ["editorial", "Editorial"], ["bold", "Bold Listing"]]
      .map(([id, n]) => `<button class="${(w.template || "clean") === id ? "on" : ""}" data-tpl="${id}">${n}</button>`).join("")}</div>
  </details>

  <details class="rv-acc"><summary>Brand Kit</summary>
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
    <div class="rv-note sm">Unbranded Goes To The MLS. Branded Goes Everywhere Else. Both Renders Unbranded First.</div>
  </details>

  <details class="rv-acc"><summary>Audio</summary>
    <label class="rv-f">Track</label>${musicPicker("rvMusic", w.music, true)}
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

  <details class="rv-acc"><summary>Captions & Disclosure</summary>
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
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button></div>`;
}

function plannedVariants() {
  const w = S.wizard;
  const mode = w.outputMode || "both";
  const versions = [];
  if (mode === "unbranded" || mode === "both") versions.push("clean");
  if (mode === "branded" || mode === "both") versions.push("branded");
  if (w.versions?.disclosure) versions.push("disclosure");
  const out = [];
  for (const f of w.formats) {
    for (const v of versions) out.push({ aspect_ratio: f, version_type: v, brand_kit_id: v === "branded" ? w.brandKitId || null : null });
  }
  return out;
}

function creditTotal() {
  return CREDIT_COSTS.video + immersiveCount() * IMMERSIVE_CREDITS_PER_SCENE;
}

/* ======================= PERSISTENT PREVIEW PANEL ======================= */
function previewPanel() {
  const w = S.wizard;
  const per = sceneDurations(w.scenes.length, w.length);
  const total = Math.round(per * w.scenes.length);
  const vs = plannedVariants();
  const cost = creditTotal();
  const bal = S.credits?.balance ?? window.__rdCredits?.balance;
  const first = w.scenes[0];
  return `<div class="rv-preview">
    <div class="rv-stage" data-img="${esc(first?.path || "")}">${first ? "" : `<span class="rv-note sm">No Scenes Yet</span>`}</div>
    <div class="mono rv-meta">Scene 1 Of ${w.scenes.length || 0} · ${per ? per.toFixed(1) : "0.0"}s · ${total}s Total</div>
    <div class="rv-sub sm">Variants</div>
    <div class="rv-vars">${vs.length ? vs.map((v) => `<div><span class="mono">${esc(v.aspect_ratio)}</span><i>${v.version_type === "clean" ? "Unbranded" : v.version_type === "branded" ? "Branded" : "Disclosure Ready"}</i><b>Queued</b></div>`).join("") : `<div class="rv-note sm">Pick A Format.</div>`}</div>
    <div class="rv-cost mono">${cost} Credits</div>
    ${bal != null && bal < cost ? `<div class="rv-note sm">Your Balance Is ${bal}. Add Credits Before Rendering.</div>` : ""}
    ${w.busy ? `<div class="rv-proc sm"><b>Creating Your Video</b>
      <div class="rv-prog"><i style="width:${Math.round(w.progress * 100)}%"></i></div>
      <span>${esc(w.stage || "Preparing scenes")}</span>
      <div class="rv-note sm">You Can Leave This Page. We Will Notify You When It Is Ready.</div></div>`
      : w.step === 4
        ? `<button class="btn btn-primary rv-cta" id="rvGen" ${vs.length ? "" : "disabled"}><i data-lucide="clapperboard"></i>Generate Video</button>`
        : `<button class="btn btn-primary rv-cta" id="rvNext">Continue</button>`}
  </div>`;
}


/* ======================= SCENE HELPERS ======================= */
function assetToScene(a) {
  const w = S.wizard;
  const isBA = w.videoType === "before_after" || w.videoType === "renovation_vision";
  return {
    key: a.key,
    path: a.path,
    compare: isBA ? a.compare || null : null,
    room: a.room || "Untitled",
    kind: a.kind,
    scene_type: isBA && a.compare ? "before_after" : a.kind === "Original" ? "original" : "design",
    duration: 3,
    motion: "auto",
    caption: a.room || "",
    disclosure: a.disclosure || null,
    asset_id: a.asset_id || null,
    version_id: a.version_id || null,
  };
}
function autoArrange() {
  const w = S.wizard;
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
        title: w.title || (w.propertyLabel ? w.propertyLabel + " Reveal" : "Untitled Reveal"),
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
    if (projectId) {
      try { await setVideoStatus({ id: projectId, status: "failed", error_message: String(e?.message || e).slice(0, 300) }); } catch (_) {}
    }
    toast(e?.message || "The render failed. Your selections were saved.");
    w.busy = false;
    await loadLibrary();
    S.screen = "library";
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
  ${p.status === "failed" ? `<div class="rv-fail"><b>${planBlockedMsg(p) ? "This Render Needs A Paid Plan" : "This Render Failed"}</b><span>${esc(p.error_message || "Something went wrong.")}</span>
    <div>${planBlockedMsg(p)
      ? `<button class="btn btn-primary btn-sm" id="rvUpgrade"><i data-lucide="zap"></i>Upgrade</button><button class="btn btn-ghost btn-sm" id="rvEdit2">Change Settings</button>`
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
    <label class="rv-f">Password<input id="pr_pw" type="password" placeholder="${sh.password_hash ? "Saved — Type To Replace" : "Set A Password"}"></label>
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
async function paintAssetThumbs() {
  const els = host()?.querySelectorAll("[data-img]") || [];
  for (const el of els) {
    if (el.dataset.painted) continue;
    const url = await resolvePhotoUrl(el.getAttribute("data-img"));
    if (url) el.style.backgroundImage = `url("${url}")`;
    el.dataset.painted = "1";
  }
}

/* ======================= RENDER + EVENTS ======================= */
function render() {
  const el = host();
  if (!el) return;
  // A screen can only stay open while its state object exists; otherwise the
  // step renderers dereference null and the whole view crashes.
  if (S.screen === "wizard" && !S.wizard) S.screen = "library";
  if (S.screen === "design" && !S.dv) S.screen = "library";
  if (S.screen === "detail" && !S.detail) S.screen = "library";
  el.innerHTML =
    S.screen === "wizard" ? wizardHtml() : S.screen === "design" ? dvHtml() : S.screen === "detail" ? detailHtml() : libraryHtml();
  paint();
  paintAssetThumbs();
  dvStopPreview();
  if (S.screen === "design") { closeIntroNow(); dvPaintThumbs(); }

  if (S.screen === "library") paintThumbs();
  if (S.screen === "detail" && S.detail) mountPlayer();
  bind();
  if (S.screen === "design") dvBind();
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


  on("[data-src]", "click", (e) => { w.sourceType = e.currentTarget.dataset.src; render(); });
  const addrIn = el.querySelector("#rvAddr");
  if (addrIn) addrIn.addEventListener("input", (ev) => { w.address = ev.target.value; });
  on("#rvAddrSkip", "click", () => { w.sourceType = "upload"; render(); });
  on("#rvAddrGo", "click", async () => {
    const v = (el.querySelector("#rvAddr")?.value || "").trim();
    if (v.length < 3) return toast("Type A Full Property Address.");
    w.address = v; w.addrBusy = true; w.addrNote = ""; w.candidates = []; render();
    try {
      const { lookupListingByAddress } = await import("@/lib/listing-import.functions");
      const r = await lookupListingByAddress({ data: { address: v } });
      if (r?.ok && r.listing) {
        const l = r.listing;
        const photos = r.photos || [];
        w.candidates = [{
          cover: photos[0]?.url || photos[0]?.path || "",
          price: l.price ? "$" + Number(l.price).toLocaleString() : "",
          address: l.address || v,
          meta: [l.beds ? l.beds + " Bd" : "", l.baths ? l.baths + " Ba" : "", l.sqft ? Number(l.sqft).toLocaleString() + " Sqft" : "", photos.length + " Photos"].filter(Boolean).join(" · "),
          photos,
        }];
      } else {
        const { NO_IMPORT_MESSAGE } = await import("@/lib/listing-source");
        w.addrNote = r?.message || NO_IMPORT_MESSAGE;
        w.propertyLabel = v;
        w.sourceType = "upload";
      }
    } catch (_) {
      const { NO_IMPORT_MESSAGE } = await import("@/lib/listing-source");
      w.addrNote = NO_IMPORT_MESSAGE;
      w.propertyLabel = v;
      w.sourceType = "upload";
    }
    w.addrBusy = false;
    render();
  });
  on("[data-cand]", "click", (e) => {
    const c = w.candidates[Number(e.currentTarget.dataset.cand)];
    if (!c) return;
    w.propertyLabel = c.address;
    for (const ph of c.photos || []) {
      const url = ph.url || ph.path;
      if (url) w.uploads.push({ id: crypto.randomUUID(), name: ph.room || "Listing Photo", url });
    }
    toast("Listing Photos Added.");
    render();
  });
  on("[data-prop]", "click", (e) => { w.propertyId = e.currentTarget.dataset.prop; w.sourceType = w.sourceType || "property"; render(); });
  on("#rvBrowse", "click", () => el.querySelector("#rvFiles")?.click());
  const files = el.querySelector("#rvFiles");
  if (files) files.addEventListener("change", async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      w.uploads.push({ id: crypto.randomUUID(), name: f.name.replace(/\.[a-z0-9]+$/i, ""), url: URL.createObjectURL(f) });
    }
    render();
  });
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
  on("[data-hover]", "mouseenter", (e) => { w.popHover = e.currentTarget.dataset.hover; render(); });
  on("[data-immpick]", "click", (e) => {
    const s = cur(); if (!s) return;
    s.motion_level = "immersive";
    s.immersive_effect = e.currentTarget.dataset.immpick;
    render();
  });
  on("[data-extpick]", "click", (e) => { const s = cur(); if (!s) return; s.exterior_effect = e.currentTarget.dataset.extpick || null; render(); });
  on("[data-croppick]", "click", (e) => { const s = cur(); if (!s) return; s.crop = e.currentTarget.dataset.croppick; render(); });
  on("[data-lookcat]", "click", (e) => { w.popCat = e.currentTarget.dataset.lookcat; render(); });
  on("[data-lookpick]", "click", (e) => { const s = cur(); if (!s) return; s.look = e.currentTarget.dataset.lookpick || null; render(); });
  const amt = el.querySelector("#rvLookAmt");
  if (amt) amt.addEventListener("change", (ev) => { const s = cur(); if (s) s.look_amount = Number(ev.target.value); render(); });
  on("#rvAllMotion", "click", () => {
    const first = w.scenes[0]; if (!first) return;
    w.scenes.forEach((s) => { s.motion = first.motion || "auto"; s.motion_level = first.motion_level || "standard"; s.immersive_effect = first.immersive_effect || null; });
    toast("Motion Applied To Every Scene.");
    render();
  });
  on("#rvAllLook", "click", () => {
    const first = w.scenes[0]; if (!first) return;
    w.scenes.forEach((s) => { s.look = first.look || null; s.look_amount = first.look_amount ?? 100; });
    toast("Look Applied To Every Scene.");
    render();
  });
  on("[data-tpl]", "click", (e) => { w.template = e.currentTarget.dataset.tpl; render(); });
  on("[data-out]", "click", (e) => {
    w.outputMode = e.currentTarget.dataset.out;
    w.versions.clean = w.outputMode !== "branded";
    w.versions.branded = w.outputMode !== "unbranded";
    render();
  });
  on("[data-tr]", "click", (e) => { w.transition = e.currentTarget.dataset.tr; render(); });
  on("[data-ba]", "click", (e) => { w.baTransition = e.currentTarget.dataset.ba; render(); });

  /* audio */
  on("[data-pres]", "click", (e) => {
    w.presentation = e.currentTarget.dataset.pres;
    w.captions = w.presentation === "captions" ? true : w.captions;
    if (w.presentation === "narration" || w.presentation === "both") w.narration = w.narration === "none" ? "generate" : w.narration;
    render();
  });
  const mus = el.querySelector("#rvMusic"); if (mus) mus.addEventListener("change", (e) => { w.music = e.target.value; stopMusic(); render(); });
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
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "rvKitWrap"; document.body.appendChild(wrap); }
  const k = kit || {};
  wrap.className = "rv-modal on";
  wrap.innerHTML = `<div class="rv-modal-in" role="dialog" aria-label="Brand kit">
    <div class="rv-modal-h"><b>${kit ? "Edit" : "New"} Brand Kit</b><button class="icon-btn" id="rvKitX"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b">
      <label class="rv-f">Brand Kit Name<input id="k_name" value="${esc(k.name || "My Brand Kit")}"></label>
      <label class="rv-f">Kit Type<select id="k_type">${["personal", "company", "client"].map((t) => `<option value="${t}" ${k.kit_type === t ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)} Brand Kit</option>`).join("")}</select></label>
      <label class="rv-f">Company Name<input id="k_co" value="${esc(k.company_name || "")}"></label>
      <label class="rv-f">Agent Or Designer Name<input id="k_person" value="${esc(k.contact_name || "")}"></label>
      <label class="rv-f">Logo URL<input id="k_logo" value="${esc(k.logo_url || "")}"></label>
      <label class="rv-f">Primary Brand Color<input id="k_color" type="color" value="${esc(k.colors?.primary || "#CC0000")}"></label>
      <label class="rv-f">Primary Font<input id="k_font" value="${esc(k.font || "Inter")}"></label>
      <label class="rv-f">Phone<input id="k_phone" value="${esc(k.phone || "")}"></label>
      <label class="rv-f">Email<input id="k_email" value="${esc(k.email || "")}"></label>
      <label class="rv-f">Website<input id="k_web" value="${esc(k.website || "")}"></label>
      <label class="rv-f">Default Call To Action<input id="k_cta" value="${esc(k.default_cta || "Book A Design Consultation")}"></label>
      <label class="rv-check"><input type="checkbox" id="k_def" ${k.is_default ? "checked" : ""}> Use As My Default Brand Kit</label>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvKitCancel">Cancel</button><button class="btn btn-primary" id="rvKitSave">Save Brand Kit</button></div>
  </div>`;
  paint();
  const close = () => { wrap.className = "rv-modal"; wrap.innerHTML = ""; };
  wrap.querySelector("#rvKitX").onclick = close;
  wrap.querySelector("#rvKitCancel").onclick = close;
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

const videoSupported = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined";


/** Entry point from a design card: seeds the design as scene one of the
    unified builder and opens it at the Edit step. */
export async function startDesignVideo(design = {}) {
  if (!design || !design.id) throw new Error("That design could not be identified.");
  if (!design.path) throw new Error("That design has no image yet.");
  dvActive = true;
  [0, 300, 900, 1800, 3000].forEach((ms) => setTimeout(closeIntroNow, ms));
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.mounted) await mountReveal(S.go, {});
  else if (!S.tree.length) await loadLibrary();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(design.id));
  const versionId = design.sample || !isUuid ? null : design.id;
  startWizard({
    propertyId: design.property_id || null,
    propertyLabel: design.address || design.sub || null,
    versionId,
    sourceType: "design",
    videoType: "design_showcase",
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
    caption: design.name || "",
    disclosure: "proposed",
    asset_id: null,
    version_id: versionId,
  }];
  w.step = 3;
  render();
  closeIntroNow();
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
  if (dvActive || S.screen === "design") { closeIntroNow(); return; }
  try { if (localStorage.getItem("rd_reveal_intro") === "1") return; } catch (_) { return; }
  let wrap = document.getElementById("rvIntroWrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "rvIntroWrap"; document.body.appendChild(wrap); }
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
}

/** Contextual entry point used from properties, designs and comparisons. */
export async function createVideoFrom(seed = {}) {
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.projects.length && !S.mounted) await mountReveal(S.go, {});
  if (!S.tree.length) await loadLibrary();
  startWizard(seed);
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
