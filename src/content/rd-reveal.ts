// REAL REVEAL — property video and marketing content.
// Library, create wizard, storyboard editor and share settings. Sources come
// from the property tree and media that already exist; nothing is re-uploaded.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { toggleMusic, stopMusic, playingId, addCustomTrack, getCustomTracks, loadCustomTracks } from "@/lib/rd-music";
import { supabase } from "@/integrations/supabase/client";
import { resolvePhotoUrl } from "@/lib/room-photos";
import { getPropertyTree } from "@/lib/workspace.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
import {
  listVideos,
  getVideo,
  saveVideo,
  deleteVideo,
  duplicateVideo,
  setVideoStatus,
  startRender,
  finishVariant,
  listBrandKits,
  saveBrandKit,
  saveShareLink,
} from "@/lib/reveal.functions";
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
  { id: "9:16", name: "Vertical — 9:16", d: "Reels, TikTok and Shorts" },
  { id: "16:9", name: "Landscape — 16:9", d: "YouTube, websites and presentations" },
  { id: "1:1", name: "Square — 1:1", d: "Flexible social posting", soon: true },
  { id: "4:5", name: "Portrait — 4:5", d: "Instagram and Facebook feeds", soon: true },
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
    const [lib, tree, kits] = await Promise.all([
      listVideos(),
      getPropertyTree().catch(() => []),
      listBrandKits().catch(() => []),
    ]);
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
function statusOf(p) {
  return p.status === "ready" ? "Ready" : p.status === "processing" ? "Processing" : p.status === "failed" ? "Failed" : p.status === "archived" ? "Archived" : "Draft";
}

function libraryHtml() {
  const q = S.q.toLowerCase().trim();
  const rows = S.projects.filter((p) => {
    if (S.filter === "drafts" && p.status !== "draft") return false;
    if (S.filter === "processing" && p.status !== "processing") return false;
    if (S.filter === "ready" && p.status !== "ready") return false;
    if (S.filter === "shared" && !S.shares.some((s) => s.video_project_id === p.id)) return false;
    if (!q) return true;
    return [p.title, p.property_label, p.video_type].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  const head = `<div class="rv-head">
    <div>
      <h2>REAL REVEAL</h2>
      <p>Create polished videos and marketing content from your properties, photos and designs.</p>
    </div>
    <div class="rv-head-a">
      <button class="btn btn-ghost" id="rvListing"><i data-lucide="building-2"></i>Create A Listing Video</button>
      <button class="btn btn-primary" id="rvNew"><i data-lucide="clapperboard"></i>Create Video</button>
    </div>
  </div>
  <div class="rv-bar">
    <div class="rv-chips">${["all", "drafts", "processing", "ready", "shared"]
      .map((f) => `<button class="rv-chip ${S.filter === f ? "on" : ""}" data-f="${f}">${f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}</button>`)
      .join("")}</div>
    <div class="rv-search"><i data-lucide="search"></i><input id="rvQ" placeholder="Search Property, Project, Room Or Title" value="${esc(S.q)}"></div>
  </div>`;

  if (!S.projects.length) {
    return head + `<div class="rv-empty">
      <i data-lucide="clapperboard"></i>
      <h3>Turn A Design Into A REAL REVEAL</h3>
      <p>Create a polished property tour, before-and-after reveal or social video from your existing projects.</p>
      <div class="rv-empty-a">
        <button class="btn btn-primary" id="rvNew2">Create Your First Video</button>
        <button class="btn btn-ghost" data-goto="props">Open A Property</button>
      </div>
    </div>`;
  }

  const cards = rows.map((p) => {
    const vs = S.variants.filter((v) => v.video_project_id === p.id);
    const sc = S.scenes.filter((s) => s.video_project_id === p.id);
    const dur = vs[0]?.duration || sc.reduce((a, b) => a + Number(b.duration || 0), 0);
    const shared = S.shares.some((s) => s.video_project_id === p.id);
    const type = VIDEO_TYPES.find((t) => t.id === p.video_type)?.name || "Video";
    const disc = p.disclosure?.mode ? "Disclosure Applied" : "No Disclosure";
    return `<div class="rv-card" data-id="${p.id}">
      <div class="rv-thumb" data-thumb="${p.id}"><i data-lucide="film"></i></div>
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
        <button class="icon-btn" data-act="share" title="Share"><i data-lucide="share-2"></i></button>
        <button class="icon-btn" data-act="del" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`;
  }).join("");

  return head + `<div class="rv-list">${cards || `<div class="rv-note">No Videos Match That Filter.</div>`}</div>`;
}

async function paintThumbs() {
  for (const p of S.projects) {
    const el = host()?.querySelector(`[data-thumb="${p.id}"]`);
    if (!el) continue;
    const v = S.variants.find((x) => x.video_project_id === p.id && x.thumbnail_path);
    let url = null;
    if (v?.thumbnail_path) url = await signed(v.thumbnail_path);
    if (!url) {
      const s = S.scenes.filter((x) => x.video_project_id === p.id).sort((a, b) => a.sequence - b.sequence)[0];
      if (s?.source_path) url = await resolvePhotoUrl(s.source_path);
    }
    if (url) el.style.backgroundImage = `url("${url}")`;
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
    narration: "none",
    script: "",
    voice: "professional",
    captions: true,
    brandKitId: S.kits.find((k) => k.is_default)?.id || null,
    branding: { outro: true, watermark: false, contact: true, cta: true, scope: "final" },
    versions: { branded: true, clean: false, disclosure: true },
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

function wizardHtml() {
  const w = S.wizard;
  const steps = ["Source", "Type", "Scenes", "Setup", "Audio", "Branding", "Review"];
  const rail = `<div class="rv-steps">${steps
    .map((s, i) => `<span class="${w.step === i + 1 ? "on" : w.step > i + 1 ? "done" : ""}">${s}</span>`)
    .join("")}</div>`;

  let body = "";
  if (w.step === 1) body = stepSource();
  if (w.step === 2) body = stepType();
  if (w.step === 3) body = stepScenes();
  if (w.step === 4) body = stepSetup();
  if (w.step === 5) body = stepAudio();
  if (w.step === 6) body = stepBrand();
  if (w.step === 7) body = stepReview();

  return `<div class="rv-head">
    <div><h2>Create A REAL REVEAL</h2><p>${esc(w.propertyLabel || "Build a video from content you already have.")}</p></div>
    <button class="btn btn-ghost" id="rvCancel"><i data-lucide="x"></i>Cancel</button>
  </div>
  ${rail}
  <div class="rv-wiz">${body}</div>`;
}

function stepSource() {
  const w = S.wizard;
  const opts = [
    ["property", "Property", "Use rooms, photos and designs from an existing property.", "map-pin"],
    ["design", "Completed Design", "Create a reveal from one design or before-and-after result.", "images"],
    ["upload", "Upload Photos", "Start with a new group of property images.", "upload"],
    ["concept", "Concept", "Turn a text-generated or sketch-generated concept into a presentation.", "sparkle"],
  ];
  const recent = S.tree.slice(0, 6);
  return `<h3>What Do You Want To Turn Into a Video?</h3>
  <div class="rv-opts">${opts
    .map(([id, n, d, ic]) => `<button class="rv-opt ${w.sourceType === id ? "on" : ""}" data-src="${id}"><i data-lucide="${ic}"></i><b>${n}</b><span>${d}</span></button>`)
    .join("")}</div>
  ${recent.length ? `<div class="rv-sub">Recent Properties</div>
  <div class="rv-recents">${recent
    .map((p) => `<button class="rv-recent ${w.propertyId === p.id ? "on" : ""}" data-prop="${p.id}"><i data-lucide="home"></i><b>${esc(p.address)}</b><span>${(p.projects || []).reduce((a, pr) => a + (pr.rooms || []).length, 0)} Rooms</span></button>`)
    .join("")}</div>` : `<div class="rv-note">No Properties Yet. Upload Photos To Start.</div>`}
  ${w.sourceType === "upload" ? `<div class="rv-upload"><input type="file" id="rvFiles" accept="image/*" multiple hidden><button class="btn btn-ghost" id="rvBrowse"><i data-lucide="image-plus"></i>Browse Files</button><span>${w.uploads.length} Photos Added</span></div>` : ""}
  <div class="rv-foot"><button class="btn btn-primary" id="rvNext" ${w.sourceType && (w.propertyId || w.uploads.length || w.sourceType === "concept") ? "" : "disabled"}>Continue</button></div>`;
}

function stepType() {
  const w = S.wizard;
  return `<h3>What Are You Creating?</h3>
  <div class="rv-rows">${VIDEO_TYPES.map((t) => `<button class="rv-row ${w.videoType === t.id ? "on" : ""}" data-type="${t.id}"><b>${t.name}</b><span>${t.d}</span></button>`).join("")}</div>
  <label class="rv-f">Video Title<input id="rvTitle" value="${esc(w.title || (w.propertyLabel ? w.propertyLabel + " Reveal" : "Untitled Reveal"))}"></label>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
}

function stepScenes() {
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
        <span class="rv-seq">${i + 1}</span>
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
    <div class="rv-col"><div class="rv-col-h">Video Scenes<span>${w.scenes.length}</span></div><div class="rv-col-b" id="rvSceneList">${right}</div></div>
  </div>
  <div class="rv-foot">
    <button class="btn btn-ghost" id="rvBack">Back</button>
    <button class="btn btn-ghost" id="rvRecommend">Select All Recommended</button>
    <button class="btn btn-ghost" id="rvClear">Clear</button>
    <button class="btn btn-ghost" id="rvAuto">Auto Arrange</button>
    <button class="btn btn-primary" id="rvNext" ${w.scenes.length ? "" : "disabled"}>Continue</button>
  </div>`;
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

function sceneMotionCard(s, i) {
  const level = s.motion_level === "immersive" ? "immersive" : "standard";
  return `<div class="rv-mcard">
    <div class="rv-mcard-h"><b>${esc(s.room || "Scene " + (i + 1))}</b>
      <span class="rv-seg tiny">
        <button class="${level === "standard" ? "on" : ""}" data-level="standard" data-i="${i}">Standard</button>
        <button class="${level === "immersive" ? "on" : ""}" data-level="immersive" data-i="${i}">Immersive</button>
      </span>
    </div>
    ${level === "standard"
      ? `<label class="rv-f">Camera Move<select data-scene-motion="${i}">${STANDARD_MOTIONS
          .map(([m, n]) => `<option value="${m}" ${(s.motion || "auto") === m ? "selected" : ""}>${n}</option>`).join("")}</select></label>`
      : `<label class="rv-f">Animated Movement<select data-immersive="${i}">${IMMERSIVE_EFFECTS
          .map(([m, n]) => `<option value="${m}" ${(s.immersive_effect || "light") === m ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <div class="rv-note sm">Adds ${IMMERSIVE_CREDITS_PER_SCENE} Credits. Only Movement Is Animated — Walls, Windows And Furniture Stay Exactly As Designed.</div>`}
    ${isExterior(s) ? `<label class="rv-f">Cinematic Exterior<select data-ext="${i}">
      <option value="">None</option>
      ${EXTERIOR_EFFECTS.map(([m, n]) => `<option value="${m}" ${s.exterior_effect === m ? "selected" : ""}>${n}</option>`).join("")}
    </select></label>
    ${s.exterior_effect ? `<div class="rv-note sm">${esc(EXTERIOR_DISCLOSURE)}</div>` : ""}` : ""}
  </div>`;
}


function stepSetup() {
  const w = S.wizard;
  return `<h3>Configure The Video</h3>
  <div class="rv-sub">Format</div>
  <div class="rv-opts sm">${FORMATS.map((f) => `<button class="rv-opt ${w.formats.includes(f.id) ? "on" : ""} ${f.soon ? "soon" : ""}" data-fmt="${f.id}" ${f.soon ? "disabled" : ""}><b>${f.name}</b><span>${f.d}${f.soon ? " — Coming Soon" : ""}</span></button>`).join("")}</div>
  <div class="rv-sub">Length</div>
  <div class="rv-seg">${[["quick", "Quick — About 15s"], ["standard", "Standard — About 30s"], ["full", "Full — About 60s"]]
    .map(([id, n]) => `<button class="${w.length === id ? "on" : ""}" data-len="${id}">${n}</button>`).join("")}</div>
  <div class="rv-sub">Motion</div>
  <div class="rv-seg"><button class="${w.motion === "auto" ? "on" : ""}" data-motion="auto">Automatic — Recommended</button><button class="${w.motion !== "auto" ? "on" : ""}" data-motion="advanced">Advanced Per Scene</button></div>
  ${w.motion !== "auto" ? `<div class="rv-adv">${w.scenes.map((s, i) => sceneMotionCard(s, i)).join("")}
    ${immersiveCount() ? `<div class="rv-note sm">Immersive Motion Is Added To ${immersiveCount()} ${immersiveCount() === 1 ? "Scene" : "Scenes"} — ${immersiveCount() * IMMERSIVE_CREDITS_PER_SCENE} Extra Credits.</div>` : ""}
  </div>` : ""}
  <div class="rv-sub">Transitions</div>
  <div class="rv-seg">${[["clean", "Clean"], ["smooth", "Smooth"], ["cinematic", "Cinematic"], ["match", "Before & After"], ["none", "None"]]
    .map(([id, n]) => `<button class="${w.transition === id ? "on" : ""}" data-tr="${id}">${n}</button>`).join("")}</div>
  ${w.scenes.some((s) => s.scene_type === "before_after") ? `<div class="rv-sub">Before-And-After Reveal</div>
  <div class="rv-seg">${[["match", "Match Frame"], ["slider", "Slider Reveal"], ["wipe", "Wipe"], ["fade", "Fade"]]
    .map(([id, n]) => `<button class="${w.baTransition === id || (!w.baTransition && id === "match") ? "on" : ""}" data-ba="${id}">${n}</button>`).join("")}</div>` : ""}
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext" ${w.formats.length ? "" : "disabled"}>Continue</button></div>`;
}


/* Map friendly voice names to gateway voices. */
const VOICE_MAP: Record<string, string> = {
  professional: "alloy", warm: "coral", conversational: "sage", luxury: "ballad",
};

async function buildNarration(type: string, script: string | null | undefined, voice: string | null | undefined) {
  if (type !== "generate" || !script || script.trim().length < 4) return null;
  try {
    const { synthesizeNarration } = await import("@/lib/narration.functions");
    const out = await synthesizeNarration({
      data: { script: script.trim().slice(0, 4000), voice: VOICE_MAP[(voice || "").toLowerCase()] || "alloy" },
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

function stepAudio() {
  const w = S.wizard;
  return `<h3>Audio And Story</h3>
  <div class="rv-sub">Presentation Style</div>
  <div class="rv-seg">${[["music", "Music Only"], ["captions", "Captions"], ["narration", "Narration"], ["both", "Music + Narration"]]
    .map(([id, n]) => `<button class="${w.presentation === id ? "on" : ""}" data-pres="${id}">${n}</button>`).join("")}</div>
  <div class="rv-sub">Music</div>
  <label class="rv-f">Track</label>${musicPicker("rvMusic", w.music, true)}
  <label class="rv-f">Volume<input type="range" id="rvVol" min="0" max="100" value="${Math.round(w.volume * 100)}"></label>
  <label class="rv-check"><input type="checkbox" id="rvBeat" ${w.beatSync ? "checked" : ""}> Beat Sync</label>
  <div class="rv-note sm">Music is mixed into your download. Beat sync paces scene timing.</div>
  <div class="rv-sub">Narration</div>
  <div class="rv-seg">${[["none", "No Narration"], ["generate", "Generate Narration"], ["upload", "Upload Voiceover"]]
    .map(([id, n]) => `<button class="${w.narration === id ? "on" : ""}" data-nar="${id}">${n}</button>`).join("")}</div>
  ${w.narration === "generate" ? `<label class="rv-f">Script — Editable Draft<textarea id="rvScript" rows="4">${esc(w.script || defaultScript())}</textarea></label>
  <label class="rv-f">Voice<select id="rvVoice">${["Professional", "Warm", "Conversational", "Luxury"].map((v) => `<option ${w.voice === v.toLowerCase() ? "selected" : ""}>${v}</option>`).join("")}</select></label>
  <div class="rv-adv"><button class="btn btn-ghost btn-sm" id="rvVoicePrev"><i data-lucide="volume-2"></i>${w.voicePreviewing ? "Stop Preview" : "Preview Voiceover"}</button></div>` : ""}
  ${w.narration === "upload" ? `<label class="rv-f">Voiceover File — MP3, M4A Or WAV<input type="file" id="rvNarFile" accept="audio/*"></label>
  <div class="rv-note sm">${w.narrationName ? `Using ${esc(w.narrationName)}.` : "Upload a recorded voiceover to mix over your music bed."}</div>` : ""}
  <div class="rv-sub">Captions</div>
  <label class="rv-check"><input type="checkbox" id="rvCaps" ${w.captions ? "checked" : ""}> Show Captions On Scenes</label>
  ${w.captions ? `<div class="rv-adv">${w.scenes.map((s, i) => `<label class="rv-f">${esc(s.room)}<input data-cap="${i}" value="${esc(s.caption ?? s.room ?? "")}"></label>`).join("")}</div>` : ""}
  <div class="rv-sub">Scene Labels</div>
  <div class="rv-note sm">Short on-screen labels for room names, materials or one callout. Keep them restrained — two per scene is the maximum.</div>
  <div class="rv-adv">
    <button class="btn btn-ghost btn-sm" id="rvSuggestLabels"><i data-lucide="wand"></i>Suggest Labels</button>
    ${w.scenes.map((s, i) => labelEditor(s, i)).join("")}
  </div>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
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


function stepBrand() {
  const w = S.wizard;
  const kit = S.kits.find((k) => k.id === w.brandKitId) || null;
  return `<h3>Branding And Disclosure</h3>
  <div class="rv-sub">Brand Kit</div>
  <div class="rv-kits">${S.kits.map((k) => `<button class="rv-kit ${w.brandKitId === k.id ? "on" : ""}" data-kit="${k.id}"><b>${esc(k.name)}</b><span>${esc(k.company_name || k.contact_name || "No Company Name")}</span></button>`).join("")}
    <button class="rv-kit add" id="rvKitNew"><i data-lucide="plus"></i><b>New Brand Kit</b></button>
    <button class="rv-kit ${w.brandKitId ? "" : "on"}" data-kit=""><b>Continue Without Branding</b><span>Clean Video, No Logo Or Contact</span></button>
  </div>
  ${kit ? `<div class="rv-adv">
    <label class="rv-check"><input type="checkbox" data-br="outro" ${w.branding.outro ? "checked" : ""}> Closing Branded Scene</label>
    <label class="rv-check"><input type="checkbox" data-br="watermark" ${w.branding.watermark ? "checked" : ""}> Logo Watermark On Every Scene</label>
    <label class="rv-check"><input type="checkbox" data-br="contact" ${w.branding.contact ? "checked" : ""}> Contact Information</label>
    <label class="rv-check"><input type="checkbox" data-br="cta" ${w.branding.cta ? "checked" : ""}> Call To Action</label>
    <button class="fb-link" id="rvKitEdit">Edit This Brand Kit</button>
  </div>` : ""}
  <div class="rv-sub">Export Versions</div>
  <div class="rv-adv">
    <label class="rv-check"><input type="checkbox" data-ver="branded" ${w.versions.branded ? "checked" : ""}> Branded — Brand Elements And CTA</label>
    <label class="rv-check"><input type="checkbox" data-ver="clean" ${w.versions.clean ? "checked" : ""}> Clean — No Logo Or Contact</label>
    <label class="rv-check"><input type="checkbox" data-ver="disclosure" ${w.versions.disclosure ? "checked" : ""}> Disclosure Ready — Alteration Labels Applied</label>
  </div>
  <div class="rv-sub">Disclosure</div>
  <div class="rv-adv">
    ${w.scenes.filter((s) => s.disclosure).map((s, i) => `<label class="rv-f">${esc(s.room)}
      <select data-disc="${w.scenes.indexOf(s)}">${Object.keys(DISCLOSURE_LABEL).map((k) => `<option value="${k}" ${s.disclosure === k ? "selected" : ""}>${DISCLOSURE_LABEL[k]}</option>`).join("")}</select></label>`).join("") || `<div class="rv-note sm">No Altered Scenes Detected. Nothing To Disclose.</div>`}
    <div class="rv-seg">${[["altered", "Altered Scenes Only"], ["all", "Apply Throughout Video"], ["intro", "Intro Disclosure"], ["outro", "Outro Disclosure"]]
      .map(([id, n]) => `<button class="${w.disclosureMode === id ? "on" : ""}" data-dmode="${id}">${n}</button>`).join("")}</div>
  </div>
  <div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvNext">Continue</button></div>`;
}

function plannedVariants() {
  const w = S.wizard;
  const out = [];
  for (const f of w.formats) {
    for (const v of ["branded", "clean", "disclosure"]) {
      if (w.versions[v]) out.push({ aspect_ratio: f, version_type: v, brand_kit_id: v === "branded" ? w.brandKitId || null : null });
    }
  }
  return out;
}

function stepReview() {
  const w = S.wizard;
  const per = sceneDurations(w.scenes.length, w.length);
  const dur = Math.round(per * w.scenes.length);
  const vs = plannedVariants();
  const imm = w.motion === "auto" ? 0 : immersiveCount();
  const cost = 40 + imm * IMMERSIVE_CREDITS_PER_SCENE;
  const bal = window.__rdCredits?.balance;
  return `<h3>Review And Generate</h3>
  <div class="rv-review">
    <div><span>Source</span><b>${esc(w.propertyLabel || (w.sourceType === "upload" ? "Uploaded Photos" : "Concept"))}</b></div>
    <div><span>Video Type</span><b>${esc(VIDEO_TYPES.find((t) => t.id === w.videoType)?.name || "")}</b></div>
    <div><span>Scenes</span><b>${w.scenes.length}</b></div>
    <div><span>Formats</span><b>${esc(w.formats.join(", "))}</b></div>
    <div><span>Estimated Duration</span><b>About ${dur}s</b></div>
    <div><span>Versions</span><b>${vs.map((v) => v.version_type).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "None"}</b></div>
    <div><span>Credits Required</span><b>${cost}${imm ? ` — Includes ${imm * IMMERSIVE_CREDITS_PER_SCENE} For Immersive Motion` : ""}</b></div>
    <div><span>Current Balance</span><b>${bal == null ? "—" : bal}</b></div>
  </div>
  ${w.busy ? `<div class="rv-proc"><b>Creating Your REAL REVEAL</b>
    <div class="rv-prog"><i style="width:${Math.round(w.progress * 100)}%"></i></div>
    <span>${esc(w.stage || "Preparing scenes")}</span>
    <div class="rv-note sm">You Can Leave This Page — We Will Notify You When It Is Ready.</div></div>`
    : `<div class="rv-foot"><button class="btn btn-ghost" id="rvBack">Back</button><button class="btn btn-primary" id="rvGen" ${vs.length ? "" : "disabled"}><i data-lucide="clapperboard"></i>Generate Video</button></div>`}`;
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
        motion_level: w.motion === "auto" ? "standard" : s.motion_level === "immersive" ? "immersive" : "standard",
        immersive_effect: w.motion !== "auto" && s.motion_level === "immersive" ? s.immersive_effect || "light" : null,
        exterior_effect: w.motion !== "auto" ? s.exterior_effect || null : null,
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
    toast("Your REAL REVEAL Is Ready.");
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
      motion: w.motion === "auto" ? "auto" : s.motion || "auto",
      transition: s.scene_type === "before_after" ? (w.baTransition || "match") : w.transition,
      caption: w.captions ? s.caption || s.room : null,
      disclosure_type: s.disclosure || null,
      motion_level: w.motion !== "auto" && s.motion_level === "immersive" ? "immersive" : "standard",
      immersive_effect: w.motion !== "auto" && s.motion_level === "immersive" ? s.immersive_effect || "light" : null,
      exterior_effect: w.motion !== "auto" ? s.exterior_effect || null : null,
      labels: Array.isArray(s.labels) ? s.labels.filter((l) => (l.text || "").trim()) : [],
    });
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const narrationUrl = await buildNarration(w.narration, w.script || defaultScript(), w.voice);

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
  ${p.status === "failed" ? `<div class="rv-fail"><b>This Render Failed</b><span>${esc(p.error_message || "Something went wrong.")}</span>
    <div><button class="btn btn-primary btn-sm" id="rvRetry">Try Again</button><button class="btn btn-ghost btn-sm" id="rvEdit2">Change Settings</button><a class="btn btn-ghost btn-sm" href="/contact">Contact Support</a></div></div>` : ""}
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
    <label class="rv-check"><input type="checkbox" id="pr_appr" ${sh.approval_enabled ? "checked" : ""}> Collect Approvals And Comments</label>

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
  on(".rv-chip", "click", (e) => { S.filter = e.currentTarget.dataset.f; render(); });
  const q = el.querySelector("#rvQ");
  if (q) q.addEventListener("input", (e) => { S.q = e.target.value; const p = e.target.selectionStart; render(); const n = host().querySelector("#rvQ"); if (n) { n.focus(); n.setSelectionRange(p, p); } });
  on(".rv-card .icon-btn", "click", async (e) => {
    e.stopPropagation();
    const card = e.currentTarget.closest(".rv-card");
    const id = card.dataset.id;
    const act = e.currentTarget.dataset.act;
    if (act === "open" || act === "edit") return openDetail(id);
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

  /* wizard */
  const w = S.wizard;
  on("#rvCancel", "click", () => { S.screen = "library"; S.wizard = null; render(); });
  on("#rvBack", "click", () => { w.step = Math.max(1, w.step - 1); render(); });
  on("#rvNext", "click", async () => {
    if (w.step === 2) {
      const t = el.querySelector("#rvTitle");
      if (t) w.title = t.value;
      w.step = 3;
      await loadWizardAssets();
      if (!w.scenes.length) { selectRecommended(); autoArrange(); }
      render();
      return;
    }
    w.step = Math.min(7, w.step + 1);
    render();
  });
  on("[data-src]", "click", (e) => { w.sourceType = e.currentTarget.dataset.src; render(); });
  on("[data-prop]", "click", (e) => { w.propertyId = e.currentTarget.dataset.prop; w.sourceType = w.sourceType || "property"; render(); });
  on("#rvBrowse", "click", () => el.querySelector("#rvFiles")?.click());
  const files = el.querySelector("#rvFiles");
  if (files) files.addEventListener("change", async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      w.uploads.push({ id: crypto.randomUUID(), name: f.name.replace(/\.[a-z0-9]+$/i, ""), url: URL.createObjectURL(f) });
    }
    render();
  });
  on("[data-type]", "click", (e) => { w.videoType = e.currentTarget.dataset.type; render(); });

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
    const row = e.currentTarget.closest(".rv-scene");
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
  el.querySelectorAll(".rv-scene").forEach((n) => {
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
  on("[data-motion]", "click", (e) => { w.motion = e.currentTarget.dataset.motion; render(); });
  on("[data-scene-motion]", "change", (e) => { w.scenes[Number(e.currentTarget.dataset.sceneMotion)].motion = e.currentTarget.value; });
  on("[data-level]", "click", (e) => {
    const s = w.scenes[Number(e.currentTarget.dataset.i)];
    s.motion_level = e.currentTarget.dataset.level;
    if (s.motion_level === "immersive" && !s.immersive_effect) s.immersive_effect = "light";
    render();
  });
  on("[data-immersive]", "change", (e) => { w.scenes[Number(e.currentTarget.dataset.immersive)].immersive_effect = e.currentTarget.value; });
  on("[data-ext]", "change", (e) => { w.scenes[Number(e.currentTarget.dataset.ext)].exterior_effect = e.currentTarget.value || null; render(); });
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
  const caps = el.querySelector("#rvCaps"); if (caps) caps.addEventListener("change", (e) => { w.captions = e.target.checked; render(); });
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

  /* detail */
  on("[data-tab]", "click", (e) => { S.detailTab = e.currentTarget.dataset.tab; render(); });
  on("[data-pf]", "click", (e) => { S.playFormat = e.currentTarget.dataset.pf; render(); });
  on("[data-pv]", "click", (e) => { S.playVersion = e.currentTarget.dataset.pv; render(); });
  on("#rvBackLib", "click", async () => { await loadLibrary(); S.screen = "library"; render(); });
  on("#rvDl", "click", async () => {
    const v = S.detail?.variants.find((x) => x.output_path);
    if (!v) return toast("Nothing Rendered Yet.");
    const url = await signed(v.output_path);
    if (url) window.open(url, "_blank");
  });
  on("#rvListing", "click", () => { try { window.rdListingVideo({ from: "video" }); } catch (_) {} });
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

/* ======================= DESIGN VIDEO BUILDER =======================
   "Turn This Design Into A Video" — a single-design builder, kept separate
   from the property/listing wizard. It seeds the selected design as scene one
   so the user never re-uploads it, saves a draft immediately, and only spends
   credits when Generate Video is confirmed. */
const DV_MOTION = [["subtle", "Subtle"], ["cinematic", "Cinematic"], ["walkthrough", "Walkthrough"]];
const DV_DURATIONS = [5, 10, 15];
const DV_FORMATS = [["9:16", "Portrait 9:16"], ["1:1", "Square 1:1"], ["16:9", "Landscape 16:9"]];

const videoSupported = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined";

function dvSceneMotion(style, i) {
  if (style === "cinematic") return i % 2 ? "orbit_left" : "push";
  if (style === "walkthrough") return i % 2 ? "pan_left" : "pan_right";
  return "auto";
}

function newDV(seed = {}) {
  return {
    projectId: seed.projectId || null,
    designId: seed.designId || null,
    propertyId: seed.propertyId || null,
    propertyLabel: seed.propertyLabel || null,
    versionId: seed.versionId || null,
    title: seed.title || "Design Video",
    motionStyle: "subtle",
    duration: 10,
    aspect: "16:9",
    music: "none",
    captions: false,
    brandKitId: S.kits.find((k) => k.is_default)?.id || null,
    branding: { outro: false, watermark: false, contact: false, cta: false },
    scenes: seed.scenes || [],
    busy: false,
    progress: 0,
    stage: "",
    saving: false,
    picker: false,
  };
}

function dvScene(src = {}) {
  return {
    key: src.key || "s-" + Math.random().toString(36).slice(2, 9),
    path: src.path,
    room: src.room || "Scene",
    caption: src.caption || "",
    version_id: src.version_id || null,
    asset_id: src.asset_id || null,
    scene_type: src.scene_type || "design",
  };
}

/** Draft persistence — every change is saved so leaving never loses work. */
let dvSaveTimer = null;
function dvQueueSave() {
  clearTimeout(dvSaveTimer);
  dvSaveTimer = setTimeout(() => { dvSaveDraft().catch(() => {}); }, 700);
}

async function dvSaveDraft(status = "draft") {
  const d = S.dv;
  if (!d) return null;
  const per = d.scenes.length ? d.duration / d.scenes.length : d.duration;
  const saved = await saveVideo({
    project: {
      id: d.projectId || undefined,
      property_id: d.propertyId || null,
      property_label: d.propertyLabel || null,
      design_version_id: d.versionId || null,
      title: d.title || "Design Video",
      video_type: "design_reveal",
      source_type: "design",
      status,
      formats: [d.aspect],
      length_preset: "custom",
      transition: "clean",
      motion: d.motionStyle,
      brand_kit_id: d.brandKitId || null,
      branding: d.branding,
      disclosure: { mode: "altered" },
      settings: {
        builder: "design",
        motionStyle: d.motionStyle,
        totalDuration: d.duration,
        sourceDesignId: d.designId || null,
        sourceImageUrl: d.scenes[0]?.path || null,
      },
    },
    scenes: d.scenes.map((s, i) => ({
      source_asset_id: s.asset_id || null,
      source_version_id: s.version_id || null,
      source_path: s.path,
      compare_path: null,
      room_name: s.room,
      sequence: i,
      scene_type: s.scene_type || "design",
      duration: Math.max(0.5, Math.min(20, per)),
      motion: dvSceneMotion(d.motionStyle, i),
      transition: "clean",
      caption: s.caption || null,
      disclosure_type: "proposed",
      motion_level: "standard",
      labels: [],
    })),
    audio: {
      presentation_style: d.music === "none" ? "silent" : "music",
      music_track_id: d.music,
      music_volume: 0.6,
      beat_sync: true,
      narration_type: "none",
      captions_enabled: !!d.captions,
    },
  });
  d.projectId = saved.id;
  return saved;
}

function dvHtml() {
  const d = S.dv;
  const blocked = !videoSupported();
  if (d.busy) {
    return `<div class="rv-wiz"><div class="rv-proc">
      <i data-lucide="clapperboard"></i><h3>Creating Your Video</h3><span>${esc(d.stage || "Preparing scenes")}</span>
      <div class="rv-prog"><i style="width:${Math.round(d.progress * 100)}%"></i></div>
    </div></div>`;
  }
  const scenes = d.scenes.map((s, i) => `<div class="dv-scene" data-dvi="${i}" draggable="true">
      <span class="dv-num">${i + 1}</span>
      <div class="dv-thumb" data-dvthumb="${esc(s.path)}"></div>
      <div class="dv-sc-meta"><b>${esc(s.room)}</b><span>${i === 0 ? "Selected Design" : "Added Scene"}</span>
        <input class="dv-cap" data-dvcap="${i}" value="${esc(s.caption)}" placeholder="Add Text (Optional)">
      </div>
      <div class="dv-sc-act">
        <button class="icon-btn" data-dvmove="-1" title="Move Up" aria-label="Move Scene Up"><i data-lucide="chevron-up"></i></button>
        <button class="icon-btn" data-dvmove="1" title="Move Down" aria-label="Move Scene Down"><i data-lucide="chevron-down"></i></button>
        <button class="icon-btn" data-dvprev="${i}" title="Preview" aria-label="Preview Scene"><i data-lucide="eye"></i></button>
        <button class="icon-btn" data-dvdupe="${i}" title="Duplicate" aria-label="Duplicate Scene"><i data-lucide="copy"></i></button>
        <button class="icon-btn" data-dvdel="${i}" title="Remove" aria-label="Remove Scene"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join("");

  const seg = (name, items, cur, attr) => `<div class="rv-seg dv-seg" role="group" aria-label="${name}">${items
    .map(([v, l]) => `<button class="${String(cur) === String(v) ? "on" : ""}" ${attr}="${v}">${l}</button>`).join("")}</div>`;

  return `<div class="rv-wiz dv-wrap">
    <div class="dv-head">
      <div><h2>Turn This Design Into a Video</h2><p>Add motion, music and branding to your design.</p></div>
      <button class="btn btn-ghost btn-sm" id="dvClose"><i data-lucide="x"></i>Close</button>
    </div>

    <label class="dv-field"><span>Title</span><input id="dvTitle" value="${esc(d.title)}"></label>

    <div class="dv-preview">
      <div class="dv-lab">Live Preview</div>
      <div class="dv-stage ar-${esc(d.aspect).replace(/[^0-9x:]/g, "").replace(":", "-")}" id="dvStage" data-motion="${esc(d.motionStyle)}">
        <div class="dv-stage-empty">Add A Scene To Preview</div>
      </div>
      <div class="dv-pv-foot">
        <button class="btn btn-ghost btn-sm" id="dvPvToggle"><i data-lucide="pause"></i>Pause</button>
        <span class="dv-pv-meta" id="dvPvMeta"></span>
      </div>
    </div>

    <div class="dv-scenes">${scenes || `<div class="rv-note">This Design Has No Usable Image.</div>`}</div>

    <div class="dv-add">
      <button class="btn btn-ghost btn-sm" id="dvAddScene"><i data-lucide="plus"></i>Add Another Scene</button>
      <input type="file" id="dvFiles" accept="image/*" multiple hidden>
    </div>

    <div class="dv-controls">
      <div><span class="dv-lab">Motion Style</span>${seg("Motion Style", DV_MOTION, d.motionStyle, "data-dvmotion")}</div>
      <div><span class="dv-lab">Duration</span>${seg("Duration", DV_DURATIONS.map((n) => [n, n + "s"]), d.duration, "data-dvdur")}</div>
      <div><span class="dv-lab">Format</span>${seg("Format", DV_FORMATS, d.aspect, "data-dvfmt")}</div>
    </div>

    <div class="dv-opts">
      <label class="dv-field"><span>Music</span>${musicPicker("dvMusic", d.music, false)}</label>
      <label class="dv-field"><span>Logo Or Branding</span><select id="dvKit"><option value="">No Branding</option>${S.kits
        .map((k) => `<option value="${k.id}" ${d.brandKitId === k.id ? "selected" : ""}>${esc(k.company_name || "Brand Kit")}</option>`).join("")}</select></label>
      <label class="dv-check"><input type="checkbox" id="dvCaptions" ${d.captions ? "checked" : ""}><span>Show Text On Scenes</span></label>
    </div>

    ${blocked ? `<div class="rv-fail">Video generation is not connected yet.</div>` : ""}

    <div class="rv-foot dv-foot">
      <div class="dv-foot-l">
        <button class="btn btn-ghost btn-sm" id="dvBackLib"><i data-lucide="arrow-left"></i>Back</button>
        <button class="btn btn-ghost btn-sm" id="dvToListing"><i data-lucide="building-2"></i>Add to a Listing Video</button>
      </div>
      <button class="btn btn-primary" id="dvGen" ${blocked || !d.scenes.length ? "disabled" : ""}><i data-lucide="clapperboard"></i>Generate Video</button>
    </div>
  </div>
  ${d.picker ? dvPickerHtml() : ""}`;
}

function dvAvailable() {
  const out = [];
  for (const p of S.tree || []) {
    for (const pr of p.projects || []) {
      for (const r of pr.rooms || []) {
        if (r.after_path) out.push({ key: "d-" + r.id, path: r.after_path, room: r.name + " — Design", version_id: r.version_id, scene_type: "design" });
        if (r.before_path) out.push({ key: "o-" + r.id, path: r.before_path, room: r.name + " — Original", version_id: r.version_id, scene_type: "original" });
      }
    }
  }
  return out;
}

function dvPickerHtml() {
  const items = dvAvailable();
  return `<div class="rv-modal on" id="dvPicker"><div class="rv-modal-in" role="dialog" aria-label="Add A Scene">
    <div class="rv-modal-h"><b>Add Another Scene</b></div>
    <div class="rv-modal-b">
      <div class="dv-pick">${items.length
        ? items.map((a) => `<button class="dv-pick-i" data-dvpick="${a.key}"><span class="dv-thumb" data-dvthumb="${esc(a.path)}"></span><b>${esc(a.room)}</b></button>`).join("")
        : `<div class="rv-note">No Saved Designs Or Photos Yet. Upload An Image Instead.</div>`}</div>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="dvPickUpload"><i data-lucide="image-plus"></i>Upload An Image</button><button class="btn btn-ghost" id="dvPickClose">Done</button></div>
  </div></div>`;
}

/** Live preview player: cycles the scene images with the chosen motion. */
let dvPvTimer = null;
let dvPvPaused = false;

export function dvStopPreview() {
  if (dvPvTimer) { clearInterval(dvPvTimer); dvPvTimer = null; }
}

async function dvStartPreview() {
  dvStopPreview();
  const el = host();
  const d = S.dv;
  const stage = el?.querySelector("#dvStage");
  if (!el || !d || !stage) return;
  const scenes = d.scenes || [];
  if (!scenes.length) return;

  const urls = [];
  for (const s of scenes) {
    const p = s.path || "";
    urls.push(/^(blob:|https?:|data:)/.test(p) ? p : await resolvePhotoUrl(p).catch(() => null));
  }
  if (host() !== el || S.dv !== d) return;

  const per = Math.max(1.2, (Number(d.duration) || 15) / scenes.length);
  stage.innerHTML = scenes.map((s, i) => `<figure class="dv-pv-slide${i === 0 ? " on" : ""}" data-pv="${i}">
      ${urls[i] ? `<img src="${esc(urls[i])}" alt="${esc(s.room || "Scene")}">` : `<span class="dv-pv-miss">Image Unavailable</span>`}
      ${d.captions && s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ""}
    </figure>`).join("");
  stage.style.setProperty("--dv-per", per + "s");

  const meta = el.querySelector("#dvPvMeta");
  let i = 0;
  const show = () => {
    stage.querySelectorAll(".dv-pv-slide").forEach((n, k) => n.classList.toggle("on", k === i));
    if (meta) meta.textContent = `Scene ${i + 1} Of ${scenes.length} · ${per.toFixed(1)}s Each · ${d.duration}s Total`;
  };
  show();
  if (!dvPvPaused) {
    dvPvTimer = setInterval(() => { i = (i + 1) % scenes.length; show(); }, per * 1000);
  }
}

async function dvPaintThumbs() {
  const el = host();
  if (!el) return;
  for (const n of el.querySelectorAll("[data-dvthumb]")) {
    const p = n.getAttribute("data-dvthumb");
    if (!p || n.dataset.painted) continue;
    n.dataset.painted = "1";
    const url = /^(blob:|https?:|data:)/.test(p) ? p : await resolvePhotoUrl(p);
    if (url) n.style.backgroundImage = `url("${url}")`;
  }
  dvStartPreview();
}

function dvBind() {
  const el = host();
  const d = S.dv;
  if (!el || !d) return;
  const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((n) => n.addEventListener(ev, fn));
  const upd = (fn) => { fn(); dvQueueSave(); render(); };

  on("#dvPvToggle", "click", (e) => {
    dvPvPaused = !dvPvPaused;
    e.currentTarget.innerHTML = dvPvPaused
      ? '<i data-lucide="play"></i>Play'
      : '<i data-lucide="pause"></i>Pause';
    try { window.lucide?.createIcons?.(); } catch (_) {}
    if (dvPvPaused) dvStopPreview(); else dvStartPreview();
  });

  on("#dvClose, #dvBackLib", "click", async () => { dvActive = false; dvStopPreview(); stopMusic(); await dvSaveDraft().catch(() => {}); await loadLibrary(); S.screen = "library"; S.dv = null; render(); });

  const t = el.querySelector("#dvTitle");
  if (t) t.addEventListener("change", () => { d.title = t.value.trim() || "Design Video"; dvQueueSave(); });
  on("[data-dvmotion]", "click", (e) => upd(() => { d.motionStyle = e.currentTarget.dataset.dvmotion; }));
  on("[data-dvdur]", "click", (e) => upd(() => { d.duration = Number(e.currentTarget.dataset.dvdur); }));
  on("[data-dvfmt]", "click", (e) => upd(() => { d.aspect = e.currentTarget.dataset.dvfmt; }));
  const mu = el.querySelector("#dvMusic");
  if (mu) mu.addEventListener("change", () => { d.music = mu.value; stopMusic(); dvQueueSave(); render(); });
  bindMusicControls(el, (v) => { d.music = v; dvQueueSave(); render(); }, () => d.music);
  const kit = el.querySelector("#dvKit");
  if (kit) kit.addEventListener("change", () => { d.brandKitId = kit.value || null; d.branding = { ...d.branding, outro: !!kit.value, contact: !!kit.value }; dvQueueSave(); });
  const cap = el.querySelector("#dvCaptions");
  if (cap) cap.addEventListener("change", () => { d.captions = cap.checked; dvQueueSave(); });

  on("[data-dvcap]", "change", (e) => { d.scenes[Number(e.currentTarget.dataset.dvcap)].caption = e.currentTarget.value; d.captions = true; dvQueueSave(); });
  on("[data-dvdel]", "click", (e) => upd(() => { d.scenes.splice(Number(e.currentTarget.dataset.dvdel), 1); }));
  on("[data-dvdupe]", "click", (e) => upd(() => {
    const i = Number(e.currentTarget.dataset.dvdupe);
    d.scenes.splice(i + 1, 0, dvScene({ ...d.scenes[i], key: null }));
  }));
  on("[data-dvmove]", "click", (e) => upd(() => {
    const row = e.currentTarget.closest(".dv-scene");
    const i = Number(row.dataset.dvi), j = i + Number(e.currentTarget.dataset.dvmove);
    if (j < 0 || j >= d.scenes.length) return;
    const [x] = d.scenes.splice(i, 1);
    d.scenes.splice(j, 0, x);
  }));
  on("[data-dvprev]", "click", async (e) => {
    const s = d.scenes[Number(e.currentTarget.dataset.dvprev)];
    const url = /^(blob:|https?:|data:)/.test(s.path) ? s.path : await resolvePhotoUrl(s.path);
    if (url) window.open(url, "_blank", "noopener");
    else toast("That Scene Image Is Unavailable.");
  });
  el.querySelectorAll(".dv-scene").forEach((n) => {
    n.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", n.dataset.dvi));
    n.addEventListener("dragover", (e) => e.preventDefault());
    n.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain")), to = Number(n.dataset.dvi);
      if (Number.isNaN(from) || from === to) return;
      upd(() => { const [x] = d.scenes.splice(from, 1); d.scenes.splice(to, 0, x); });
    });
  });

  on("#dvAddScene", "click", () => { d.picker = true; render(); });
  on("#dvPickClose", "click", () => { d.picker = false; render(); });
  on("#dvPickUpload", "click", () => el.querySelector("#dvFiles")?.click());
  const files = el.querySelector("#dvFiles");
  if (files) files.addEventListener("change", (e) => {
    for (const f of Array.from(e.target.files || [])) {
      d.scenes.push(dvScene({ path: URL.createObjectURL(f), room: f.name.replace(/\.[a-z0-9]+$/i, ""), scene_type: "original" }));
    }
    d.picker = false;
    dvQueueSave();
    render();
  });
  on("[data-dvpick]", "click", (e) => {
    const a = dvAvailable().find((x) => x.key === e.currentTarget.dataset.dvpick);
    if (a) d.scenes.push(dvScene(a));
    d.picker = false;
    dvQueueSave();
    render();
  });

  on("#dvToListing", "click", async () => {
    await dvSaveDraft().catch(() => {});
    try { window.rdListingVideo({ from: "design", designId: d.designId, path: d.scenes[0]?.path || null }); }
    catch (_) { toast("Could Not Open The Listing Video Workflow."); }
  });
  on("#dvGen", "click", () => dvGenerate());
}

async function dvGenerate() {
  const d = S.dv;
  if (!d || !d.scenes.length) return toast("Add At Least One Scene First.");
  if (!videoSupported()) {
    console.warn("[REAL REVEAL] Video generation provider is not configured in this environment (MediaRecorder unavailable).");
    return toast("Video generation is not connected yet.");
  }
  d.busy = true; d.progress = 0; d.stage = "Preparing scenes";
  render();
  let projectId = d.projectId;
  try {
    const saved = await dvSaveDraft("queued");
    projectId = saved.id;
    const variants = [{ aspect_ratio: d.aspect, version_type: d.brandKitId ? "branded" : "clean", brand_kit_id: d.brandKitId || null }];
    const started = await startRender({ id: projectId, variants });
    track?.("design_video_generate", { aspect: d.aspect, scenes: d.scenes.length, motion: d.motionStyle });
    const cfg = {
      scenes: d.scenes.map((s, i) => ({ ...s, motion: dvSceneMotion(d.motionStyle, i), compare: null, disclosure: "proposed", labels: [] })),
      length: "custom",
      motion: "custom",
      transition: "clean",
      captions: !!d.captions,
      brandKitId: d.brandKitId,
      branding: d.branding,
      title: d.title,
      propertyLabel: d.propertyLabel,
    };
    await renderAllVariants(projectId, started.variants, cfg, d.duration / d.scenes.length);
    await setVideoStatus({ id: projectId, status: "ready" });
    toast("Your Design Video Is Ready.");
    await loadLibrary();
    S.dv = null;
    await openDetail(projectId);
  } catch (e) {
    if (projectId) { try { await setVideoStatus({ id: projectId, status: "failed", error_message: String(e?.message || e).slice(0, 300) }); } catch (_) {} }
    toast(e?.message || "The Video Could Not Be Created. Your Draft Was Saved.");
    if (S.dv) { S.dv.busy = false; render(); }
  }
}

/** Entry point from a design card: seeds the design as scene one. */
export async function startDesignVideo(design = {}) {
  if (!design || !design.id) throw new Error("That design could not be identified.");
  if (!design.path) throw new Error("That design has no image yet.");
  S.screen = "design";
  dvActive = true;
  [0, 300, 900, 1800, 3000].forEach((ms) => setTimeout(closeIntroNow, ms));
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.mounted) await mountReveal(S.go, {});
  else if (!S.tree.length) await loadLibrary();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(design.id));
  S.dv = newDV({
    designId: design.id,
    versionId: design.sample || !isUuid ? null : design.id,
    propertyId: design.property_id || null,
    propertyLabel: design.address || design.sub || null,
    title: (design.name || "Design") + " Video",
    scenes: [dvScene({ path: design.path, room: design.name || "Selected Design", version_id: design.sample || !isUuid ? null : design.id })],
  });
  S.screen = "design";
  render();
  closeIntroNow();
  try { await dvSaveDraft(); } catch (e) { toast(e?.message || "The draft could not be saved. You can still build the video."); }
  render();
}

/** Continue a saved design-video draft from Media or the library. */
export async function continueDesignVideo(id) {
  try { window.__rdAllowReveal && window.__rdAllowReveal(); } catch (_) {}
  goTo("reveal");
  if (!S.mounted) await mountReveal(S.go, {});
  const full = await getVideo({ id });
  const p = full.project;
  const st = p.settings || {};
  S.dv = newDV({
    projectId: p.id,
    designId: st.sourceDesignId || null,
    propertyId: p.property_id,
    propertyLabel: p.property_label,
    versionId: p.design_version_id,
    title: p.title,
    scenes: (full.scenes || []).map((s) => dvScene({ path: s.source_path, room: s.room_name, caption: s.caption || "", version_id: s.source_version_id, asset_id: s.source_asset_id, scene_type: s.scene_type })),
  });
  S.dv.motionStyle = st.motionStyle || "subtle";
  S.dv.duration = st.totalDuration || 10;
  S.dv.aspect = (p.formats || [])[0] || "16:9";
  S.dv.brandKitId = p.brand_kit_id || null;
  S.dv.branding = p.branding || S.dv.branding;
  S.dv.music = full.audio?.music_track_id || "none";
  S.dv.captions = !!full.audio?.captions_enabled;
  S.screen = "design";
  render();
}

/* ======================= INTRO ======================= */
let dvActive = false;
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
  wrap.innerHTML = `<div class="rv-modal-in sm" role="dialog" aria-label="Welcome to REAL REVEAL">
    <div class="rv-modal-h"><b>Create Your First REAL REVEAL</b></div>
    <div class="rv-modal-b">
      <ol class="rv-intro"><li>Choose a property or design</li><li>Select the scenes</li><li>Choose a format and style</li><li>Generate and share</li></ol>
    </div>
    <div class="rv-modal-f"><button class="btn btn-ghost" id="rvIntroNo">Not Now</button><button class="btn btn-ghost" id="rvIntroTour">Watch Quick Tour</button><button class="btn btn-primary" id="rvIntroGo">Create Video</button></div>
  </div>`;
  paint();
  const done = () => { try { localStorage.setItem("rd_reveal_intro", "1"); } catch (_) {} wrap.className = "rv-modal"; wrap.innerHTML = ""; };
  wrap.querySelector("#rvIntroNo").onclick = done;
  wrap.querySelector("#rvIntroTour").onclick = () => { done(); toast("The Quick Tour Is Coming Soon."); };
  wrap.querySelector("#rvIntroGo").onclick = () => { done(); startWizard({}); };
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
  else await loadLibrary();
  S.detailTab = tab;
  await openDetail(id);
}
