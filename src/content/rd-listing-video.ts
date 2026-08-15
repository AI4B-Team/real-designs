// Create A Listing Video — the property-centred video workflow.
//
// Start (property, upload, cloud source, address, listing link) → Photos
// (analysis + selection workspace) → Setup (format, length, motion, music,
// branding, advanced) → one Generate Video action → branded, clean and, when
// required, disclosure outputs stored on the property.
//
// Listing links are read as text only. Nothing is scraped and no media is ever
// imported from a public listing page.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { toggleMusic, stopMusic, playingId, addCustomTrack, getCustomTracks, loadCustomTracks } from "@/lib/rd-music";
import { supabase } from "@/integrations/supabase/client";
import { resolvePhotoUrl } from "@/lib/room-photos";
import {
  listMediaAssets,
  listMediaProperties,
  createMediaProperty,
  updateMediaAssets,
} from "@/lib/property-media.functions";
import { saveVideo, startRender, finishVariant, setVideoStatus, listBrandKits } from "@/lib/reveal.functions";
import { renderReveal, sceneDurations, DISCLOSURE_LABEL } from "@/lib/reveal-render";
import { openVideoDetail } from "@/content/rd-reveal";
import { openPhotoEditor } from "@/content/rd-photo-editor";
import { identifyListing, normalizeAddress, NO_IMPORT_MESSAGE } from "@/lib/listing-source";
import { startListingImport, linkListingImport } from "@/lib/listing-import.functions";
import * as UM from "@/lib/upload-manager";
import { CREDIT_COSTS, getMyCredits } from "@/lib/credits.functions";
import { track } from "@/lib/analytics";
import { avatarSection, bindAvatar, avatarRenderOption, avatarScript, blankAvatarConfig } from "@/lib/rd-avatar-ui";

const BUCKET = "reveal-videos";
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};
const toast = (m) => {
  try {
    window.rdToast ? window.rdToast(m) : console.log(m);
  } catch (_) {}
};

/* ======================= CONSTANTS ======================= */

export const LV_TYPES = [
  ["listing_video", "Listing Video", "A polished animated sequence of your listing photos."],
  ["ai_walkthrough", "AI Walkthrough", "Immersive spatial movement applied to the rooms you select."],
  ["before_after", "Before & After Reveal", "Original spaces transitioning into the redesigned versions."],
  ["design_presentation", "Design Presentation", "Concepts, budgets, products and plans in one video."],
  ["cinematic_exterior", "Cinematic Exterior", "Exterior and landscape scenes with cinematic camera work."],
];

const FORMATS = [
  ["9:16", "Vertical 9:16", "Reels, TikTok and Shorts"],
  ["16:9", "Landscape 16:9", "MLS, websites and presentations"],
  ["1:1", "Square 1:1", "Feed posts and email"],
];

const LENGTHS = [
  ["quick", "Short", "About 15 seconds"],
  ["standard", "Standard", "About 30 seconds"],
  ["full", "Full", "About 60 seconds"],
];

const MOTIONS = [
  ["auto", "Auto Motion", "We choose a movement for every photo."],
  ["standard", "Standard Motion", "Slow zooms, pans and subtle crop movement."],
  ["immersive", "Immersive Motion", "AI spatial movement. Uses additional credits."],
  ["none", "No Motion", "Still frames only."],
];

const MUSIC = [
  ["modern", "Clean Modern"],
  ["luxury", "Quiet Luxury"],
  ["warm", "Warm Home"],
  ["cinematic", "Cinematic Reveal"],
  ["upbeat", "Upbeat Listing"],
  ["minimal", "Minimal Pulse"],
];

/** Default listing running order. Users can always override it. */
const ORDER = [
  "Front Exterior",
  "Entry",
  "Living Room",
  "Family Room",
  "Kitchen",
  "Dining Room",
  "Primary Bedroom",
  "Bedroom",
  "Primary Bathroom",
  "Bathroom",
  "Office",
  "Basement",
  "Laundry",
  "Garage",
  "Community",
  "Pool",
  "Patio",
  "Garden",
  "Aerial",
  "Side Exterior",
  "Rear Exterior",
  "Other",
  "Needs Review",
];

const ROOM_CHOICES = ORDER.slice();

const REVIEW_FLAGS = ["blurry", "lowres", "duplicate", "watermark", "privacy"];

const IMMERSIVE_CREDIT = CREDIT_COSTS.plan_3d;
const VIDEO_CREDIT = CREDIT_COSTS.video;

/* ======================= STATE ======================= */

const S = {
  go: null,
  mounted: false,
  loading: false,
  step: "start", // start | review | photos | setup | rendering | done
  importUrl: "",
  importState: "idle", // idle | running | failed | ready
  importStage: "",
  importError: "",
  importRow: null,
  otherOpen: false,
  properties: [],
  propertyId: null,
  propertyLabel: "",
  standalone: false,
  assets: [],
  photos: [],
  kits: [],
  addressQuery: "",
  addressMatches: [],
  linkOpen: false,
  linkValue: "",
  link: null,
  authorized: false,
  authorizedAt: null,
  job: null,
  jobUnsub: null,
  cover: null,
  setup: {
    type: "listing_video",
    format: "9:16",
    length: "standard",
    motion: "auto",
    music: "modern",
    brandKitId: null,
    advOpen: false,
    narration: "none",
    script: "",
    voice: "",
    captions: false,
    labels: true,
    intro: false,
    outro: true,
    transition: "clean",
    effects: "none",
    customText: "",
    disclosure: "auto",
    resolution: "1080",
    sceneDuration: 0,
    avatar: blankAvatarConfig(),
  },
  confirm: false,
  credits: null,

  progress: 0,
  stage: "",
  busy: false,
  projectId: null,
  outputs: [],
  playVersion: "branded",
};

function hostEl() {
  return document.getElementById("v-lvideo");
}

/* ======================= ANALYSIS ======================= */

function orientationOf(a) {
  const w = Number(a.width || a.quality?.width || 0);
  const h = Number(a.height || a.quality?.height || 0);
  if (!w || !h) return "Unknown";
  if (w / h > 1.15) return "Landscape";
  if (h / w > 1.15) return "Portrait";
  return "Square";
}

function qualityScore(a) {
  const q = a.quality || {};
  const exposure = 100 - Math.abs(128 - Number(q.brightness ?? 128));
  const sharp = Math.min(400, Number(q.blur ?? 0)) / 4;
  const res = Math.min(100, Number(a.width || q.width || 0) / 40);
  return Math.max(1, Math.min(100, Math.round((exposure + sharp + res) / 3)));
}

function flagsOf(a) {
  const f = Array.isArray(a.flags) ? a.flags.slice() : [];
  if (a.dup_group) f.push("duplicate");
  if (/watermark|logo/i.test(a.original_filename || "")) f.push("watermark");
  return Array.from(new Set(f));
}

function needsReview(p) {
  return p.room === "Needs Review" || p.flags.some((f) => REVIEW_FLAGS.includes(f));
}

const EXTERIOR = /exterior|aerial|patio|pool|garden|community/i;

/** Auto Motion picks a movement from the composition of each photo. */
function autoMotion(p, i) {
  if (EXTERIOR.test(p.room)) return i === 0 ? "push" : p.orientation === "Landscape" ? "pan_right" : "pull";
  if (p.orientation === "Portrait") return "pull";
  if (p.orientation === "Landscape") return i % 2 === 0 ? "pan_left" : "pan_right";
  return "push";
}

function coverSuitable(p) {
  return EXTERIOR.test(p.room) && p.score >= 55 && !p.flags.includes("blurry");
}

function immersiveSuitable(p) {
  return !EXTERIOR.test(p.room) && p.score >= 50;
}

function toPhoto(a, i) {
  const room = a.room_group || "Needs Review";
  const flags = flagsOf(a);
  const p = {
    id: a.id,
    assetId: a.id,
    path: a.storage_path,
    name: a.original_filename || "Photo",
    room,
    flags,
    orientation: orientationOf(a),
    score: qualityScore(a),
    include: true,
    rotate: 0,
    motion: "",
    modification_class: a.modification_class || "Unmodified Original",
    order: i,
  };
  p.coverOk = coverSuitable(p);
  p.immersiveOk = immersiveSuitable(p);
  if (needsReview(p)) p.include = false;
  return p;
}

function autoArrange() {
  const rank = (r) => {
    const i = ORDER.indexOf(r);
    return i < 0 ? ORDER.length : i;
  };
  S.photos.sort((a, b) => rank(a.room) - rank(b.room) || b.score - a.score);
  // A closing exterior reads better than a second opening one.
  const closing = S.photos.findIndex((p) => /rear exterior/i.test(p.room));
  if (closing > -1) S.photos.push(S.photos.splice(closing, 1)[0]);
  S.photos.forEach((p, i) => (p.order = i));
  if (!S.cover) {
    const c = S.photos.find((p) => p.include && p.coverOk) || S.photos.find((p) => p.include);
    S.cover = c ? c.id : null;
  }
}

/* ======================= DATA ======================= */

async function loadProperties() {
  try {
    S.properties = await listMediaProperties();
  } catch (_) {
    S.properties = [];
  }
}

async function loadKits() {
  try {
    S.kits = await listBrandKits();
    if (!S.setup.brandKitId) {
      const def = S.kits.find((k) => k.is_default) || S.kits[0];
      S.setup.brandKitId = def ? def.id : null;
    }
  } catch (_) {
    S.kits = [];
  }
  try {
    S.credits = await getMyCredits();
  } catch (_) {
    S.credits = null;
  }
}

/** Null when the account can pay, otherwise the reason it cannot. */
function creditBlock() {
  const c = S.credits;
  if (!c || c.unavailable) return null;
  if (c.plan === "free") return "Video rendering needs a paid plan. The free plan covers 5 designs a day.";
  if ((c.balance ?? 0) < creditCost())
    return `Not enough credits. This video costs ${creditCost()} and you have ${c.balance ?? 0}.`;
  return null;
}


async function loadAssets(propertyId, allowLibraryFallback = false) {
  S.loading = true;
  S.usedLibrary = false;
  render();
  try {
    const r = await listMediaAssets({ data: { property_id: propertyId || null } });
    S.assets = (r.assets || []).filter((a) => !a.hidden);
    if (!S.assets.length && propertyId && allowLibraryFallback) {
      const all = await listMediaAssets({ data: { property_id: null } });
      S.assets = (all.assets || []).filter((a) => !a.hidden);
      S.usedLibrary = S.assets.length > 0;
    }
    S.photos = S.assets.map(toPhoto);
    // Every photo can be flagged for review, which would leave nothing selected
    // and dead-end the flow. Keep the strongest shots on so the user can proceed.
    if (S.photos.length && !S.photos.some((p) => p.include)) {
      [...S.photos]
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(8, S.photos.length))
        .forEach((p) => (p.include = true));
      toast("All Photos Were Flagged For Review — We Preselected The Best Ones.");
    }
    autoArrange();
  } catch (e) {
    toast(e?.message || "Could not load that property's photos.");
  }
  S.loading = false;
}


/* ======================= START SCREEN ======================= */


function startHtml() {
  const matches = S.addressMatches;
  const other = S.otherOpen || S.importState === "failed" || S.propertyId || S.standalone || S.job;
  return `<div class="lv">
    <div class="lv-head">
      <h2>Create A Listing Video</h2>
      <p>Start with your listing link. We'll pull in the property details so you can go straight to choosing photos.</p>
    </div>

    <div class="lv-start">
      <div class="lv-import">
        <label class="lv-f">
          <span>Listing Link</span>
          <span class="lv-input big"><i data-lucide="link"></i>
            <input id="lvImportUrl" placeholder="https://www.zillow.com/homedetails/..." value="${esc(S.importUrl)}" autocomplete="off" spellcheck="false">
          </span>
        </label>
        <button class="btn btn-primary" id="lvImportGo" ${S.importState === "running" ? "disabled" : ""}>
          ${S.importState === "running" ? "Importing…" : "Import Listing"}
        </button>
        <p class="lv-note">Supported: Zillow, Realtor.com, Redfin, Homes.com, Trulia and Compass. We only use listing data from authorized sources.</p>
      </div>

      ${importStatusHtml()}

      <button class="lv-quiet" id="lvOther"><i data-lucide="${other ? "chevron-up" : "chevron-down"}"></i>Or Start Another Way</button>

      ${
        other
          ? `<div class="lv-other">
        <label class="lv-f">
          <span>Property or Address</span>
          <span class="lv-input"><i data-lucide="map-pin"></i>
            <input id="lvAddr" placeholder="Search your properties or enter an address" value="${esc(S.addressQuery)}" autocomplete="off">
          </span>
        </label>
        ${
          S.addressQuery.trim().length > 1
            ? `<div class="lv-matches">
                ${matches
                  .map(
                    (p) =>
                      `<button class="lv-match" data-prop="${p.id}"><i data-lucide="building-2"></i><b>${esc(p.address)}</b><span>Use This Property</span></button>`,
                  )
                  .join("")}
                <button class="lv-match new" data-newprop="1"><i data-lucide="plus"></i><b>${esc(normalizeAddress(S.addressQuery))}</b><span>Create Property Draft</span></button>
              </div>`
            : ""
        }

        <div class="lv-drop" id="lvDrop" tabindex="0" role="button" aria-label="Upload listing photos">
          <i data-lucide="upload-cloud"></i>
          <b>Upload Listing Photos</b>
          <span>Drag and drop, or browse. JPG, PNG, HEIC and WEBP up to ${UM.MAX_FILE_MB} MB each. Uploads keep running while you work.</span>
          <button class="btn btn-dark btn-sm" id="lvBrowse">Browse Files</button>
        </div>
        <input type="file" id="lvFiles" multiple accept="${UM.ACCEPT_ATTR}" hidden>

        <label class="lv-auth"><input type="checkbox" id="lvAuth" ${S.authorized ? "checked" : ""}>
          I own these photos or have permission to use them in designs, videos and marketing materials.</label>

        <div class="lv-cloud">
          <button class="lv-cbtn" data-cloud="dropbox"><i data-lucide="cloud"></i>Import From Dropbox</button>
          <button class="lv-cbtn" data-cloud="drive"><i data-lucide="hard-drive"></i>Import From Google Drive</button>
        </div>

        ${S.job ? jobHtml() : ""}
        ${
          S.propertyId || S.standalone
            ? `<div class="lv-ctx"><i data-lucide="check"></i><b>${esc(S.propertyLabel || "Standalone Project")}</b>
                <button class="lv-quiet" id="lvUseMedia">Use Existing Property Media</button></div>`
            : `<button class="lv-quiet" id="lvStandalone">Create A Standalone Video Instead</button>`
        }
      </div>`
          : ""
      }
    </div>
  </div>`;
}

function importStatusHtml() {
  if (S.importState === "running") {
    return `<div class="lv-job">
      <div class="lv-job-h"><b>Importing Listing</b><span>${esc(S.importStage || "Retrieving Listing Details")}</span></div>
      <div class="lv-bar indet"><i></i></div>
      <p class="lv-note">This keeps running while you work. We'll show the listing details as soon as they arrive.</p>
    </div>`;
  }
  if (S.importState === "failed") {
    return `<div class="lv-result warn">
      <b>We Couldn't Import That Listing</b>
      <p class="lv-note">${esc(S.importError || "Something went wrong with that link.")}</p>
      <div class="lv-panel-a">
        <button class="btn btn-ghost btn-sm" id="lvImportGo"><i data-lucide="rotate-cw"></i>Try Again</button>
        <button class="btn btn-ghost btn-sm" id="lvBrowse"><i data-lucide="upload"></i>Upload Photos Instead</button>
      </div>
    </div>`;
  }
  return "";
}

function reviewHtml() {
  const l = (S.importRow && S.importRow.listing) || {};
  const row = (label, val) => `<div class="lv-row"><span>${label}</span><b>${esc(val || "Not Provided")}</b></div>`;
  return `<div class="lv">
    <div class="lv-head">
      <button class="lv-back" data-a="back-start"><i data-lucide="arrow-left"></i>Back</button>
      <h2>Review Listing</h2>
      <p>Confirm the imported details before we build the video.</p>
    </div>
    <div class="lv-result">
      ${row("Address", l.address)}
      ${row("Price", l.price ? `$${Number(l.price).toLocaleString()}` : "")}
      ${row("Beds", l.beds)}
      ${row("Baths", l.baths)}
      ${row("Floor SF", l.sqft)}
      ${row("Source", S.importRow ? S.importRow.provider_name : "")}
      ${row("Photos Imported", S.importRow ? String(S.importRow.photo_count || 0) : "0")}
    </div>
    <div class="lv-foot">
      <button class="btn btn-ghost btn-sm" data-a="back-start">Back</button>
      <button class="btn btn-primary btn-sm" data-a="review-continue"><i data-lucide="arrow-right"></i>Continue To Photos</button>
    </div>
  </div>`;
}

function linkPanelHtml() {
  const r = S.link;
  return `<div class="lv-panel">
    <label class="lv-f"><span>Listing Link</span>
      <span class="lv-input"><i data-lucide="link"></i><input id="lvLink" placeholder="https://www.example.com/homedetails/..." value="${esc(S.linkValue)}"></span>
    </label>
    <div class="lv-panel-a"><button class="btn btn-dark btn-sm" id="lvLinkGo">Check Link</button></div>
    ${
      r
        ? `<div class="lv-result">
            <div class="lv-row"><span>Provider</span><b>${esc(r.provider ? r.provider.name : "Unknown")}</b></div>
            <div class="lv-row"><span>Address</span><b>${esc(r.address || "Not Readable From This Link")}</b></div>
            <div class="lv-row"><span>Media Access</span><b>${r.provider && r.provider.authorized ? "Authorized Source" : "Not Connected"}</b></div>
            <p class="lv-note">${esc(r.address ? NO_IMPORT_MESSAGE : r.message)}</p>
            <div class="lv-panel-a">
              ${r.address ? `<button class="btn btn-ghost btn-sm" data-useaddr="${esc(r.address)}"><i data-lucide="map-pin"></i>Use This Address</button>` : ""}
              <button class="btn btn-ghost btn-sm" id="lvLinkUpload"><i data-lucide="upload"></i>Upload Photos</button>
              <button class="btn btn-ghost btn-sm" data-cloud="dropbox"><i data-lucide="cloud"></i>Import From Dropbox</button>
              <button class="btn btn-ghost btn-sm" data-cloud="drive"><i data-lucide="hard-drive"></i>Import From Google Drive</button>
              <button class="btn btn-ghost btn-sm" data-cloud="mls"><i data-lucide="plug"></i>Connect Listing Source</button>
            </div>
          </div>`
        : ""
    }
  </div>`;
}

function jobHtml() {
  const j = S.job;
  const total = j.files.length || 1;
  const pct = Math.round(((j.uploaded + j.failed) / total) * 100);
  return `<div class="lv-job">
    <div class="lv-job-h"><b>${esc(j.state)}</b><span>${j.uploaded} of ${total} uploaded${j.failed ? ` • ${j.failed} failed` : ""}</span></div>
    <div class="lv-bar"><i style="width:${pct}%"></i></div>
    <div class="lv-job-a">
      ${j.failed ? `<button class="lv-quiet" id="lvRetry">Retry Failed</button>` : ""}
      ${["Preparing", "Uploading", "Processing", "Organizing"].includes(j.state) ? `<button class="lv-quiet" id="lvCancel">Cancel Upload</button>` : ""}
      <span class="lv-note">You can keep working while these finish.</span>
    </div>
  </div>`;
}

/* ======================= PHOTO WORKSPACE ======================= */

function photosHtml() {
  const total = S.photos.length;
  const selected = S.photos.filter((p) => p.include).length;
  const review = S.photos.filter((p) => needsReview(p)).length;
  const list = S.photos
    .map(
      (p, i) => `<div class="lv-ph${p.include ? " on" : ""}${needsReview(p) ? " review" : ""}" draggable="true" data-ph="${p.id}" data-i="${i}">
      <div class="lv-ph-i" data-img="${esc(p.path)}" style="transform:rotate(${p.rotate}deg)"></div>
      <div class="lv-ph-top">
        <label class="lv-ph-chk"><input type="checkbox" data-inc="${p.id}" ${p.include ? "checked" : ""}><span class="sr-only">Include ${esc(p.name)}</span></label>
        <span class="lv-seq">${i + 1}</span>
        ${S.cover === p.id ? `<span class="lv-cover">Cover</span>` : ""}
      </div>
      <div class="lv-ph-b">
        <select data-room="${p.id}" aria-label="Scene label">${ROOM_CHOICES.map(
          (r) => `<option ${r === p.room ? "selected" : ""}>${esc(r)}</option>`,
        ).join("")}</select>
        <div class="lv-ph-m">
          <span title="Quality score">${p.score}</span>
          <span>${esc(p.orientation)}</span>
          ${p.flags.map((f) => `<em>${esc(flagLabel(f))}</em>`).join("")}
        </div>
        <div class="lv-ph-a">
          <button class="icon-btn xs" data-a="cover" data-id="${p.id}" title="Set as cover"><i data-lucide="star"></i></button>
          <button class="icon-btn xs" data-a="rotate" data-id="${p.id}" title="Rotate"><i data-lucide="rotate-cw"></i></button>
          <button class="icon-btn xs" data-a="replace" data-id="${p.id}" title="Replace"><i data-lucide="repeat"></i></button>
          <button class="icon-btn xs" data-a="edit" data-id="${p.id}" title="Edit photo"><i data-lucide="wand-2"></i></button>
        </div>
      </div>
    </div>`,
    )
    .join("");

  return `<div class="lv">
    <div class="lv-head">
      <button class="lv-back" data-a="back-start"><i data-lucide="arrow-left"></i>Back</button>
      <h2>Select Your Photos</h2>
      <p>${esc(S.propertyLabel || "Standalone Project")} • Approve what belongs in the video, set the order and fix anything flagged.</p>
    </div>
    <div class="lv-bar2">
      <div class="lv-counts"><b>${total} Photos</b><span>${selected} Selected</span><span class="${review ? "warn" : ""}">${review} Needs Review</span></div>
      <div class="lv-tools">
        <button class="btn btn-ghost btn-xs" data-a="all">Select All</button>
        <button class="btn btn-ghost btn-xs" data-a="none">Clear Selection</button>
        <button class="btn btn-ghost btn-xs" data-a="more"><i data-lucide="plus"></i>Add More Photos</button>
        <button class="btn btn-ghost btn-xs" data-a="arrange"><i data-lucide="list-ordered"></i>Auto-Arrange</button>
      </div>
    </div>
    <div class="lv-grid" id="lvGrid">${list || `<div class="lv-note">No photos yet. Add photos to continue.</div>`}</div>
    <div class="lv-foot">
      <span class="lv-note">Nothing is deleted. Flagged photos stay available under Needs Review.</span>
      <button class="btn btn-primary" data-a="to-setup" ${selected ? "" : "disabled"}>Continue To Video Setup</button>
    </div>
  </div>`;
}

function flagLabel(f) {
  const map = {
    blurry: "Blur",
    lowres: "Small Image",
    duplicate: "Duplicate",
    watermark: "Watermark",
    privacy: "Privacy",
    overexposed: "Overexposed",
    underexposed: "Underexposed",
    warmcast: "Warm Cast",
    coolcast: "Cool Cast",
    windows: "Blown Windows",
    bracket: "Bracket",
  };
  return map[f] || f;
}

/* ======================= SETUP ======================= */

function creditCost() {
  const scenes = S.photos.filter((p) => p.include);
  const immersive = S.setup.motion === "immersive" ? scenes.filter((p) => p.immersiveOk).length : 0;
  return VIDEO_CREDIT + immersive * IMMERSIVE_CREDIT;
}

function seg(name, opts, value) {
  return `<div class="lv-seg" role="group">${opts
    .map(([id, label, note]) => `<button class="${value === id ? "on" : ""}" data-set="${name}" data-val="${id}"><b>${esc(label)}</b>${note ? `<span>${esc(note)}</span>` : ""}</button>`)
    .join("")}</div>`;
}

function setupHtml() {
  const st = S.setup;
  if (!st.avatar) st.avatar = blankAvatarConfig();
  const kit = S.kits.find((k) => k.id === st.brandKitId);

  const scenes = S.photos.filter((p) => p.include).length;
  return `<div class="lv">
    <div class="lv-head">
      <button class="lv-back" data-a="back-photos"><i data-lucide="arrow-left"></i>Back</button>
      <h2>Create Your Video</h2>
      <p>${scenes} scenes • ${esc(S.propertyLabel || "Standalone Project")}</p>
    </div>

    <div class="lv-preview">
      <span class="lv-lab">Live Preview</span>
      <div class="lv-stage ar-${esc(st.format).replace(":", "-")}" id="lvStage" data-motion="${esc(st.motion)}"><div class="lv-stage-empty">Include A Photo To Preview</div></div>
      <div class="lv-pv-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-a="pvtoggle"><i data-lucide="${lvPvPaused ? "play" : "pause"}"></i>${lvPvPaused ? "Play" : "Pause"}</button>
        <span class="lv-pv-meta" id="lvPvMeta"></span>
      </div>
    </div>

    <div class="lv-set">

      <div class="lv-block"><span class="lv-lab">Video Type</span>${seg("type", LV_TYPES.map((t) => [t[0], t[1], t[2]]), st.type)}</div>
      <div class="lv-block"><span class="lv-lab">Video Format</span>${seg("format", FORMATS, st.format)}
        <p class="lv-note">${st.format === "9:16" ? "Recommended for social media." : st.format === "16:9" ? "Recommended for MLS and websites." : "Recommended for feed posts and email."}</p></div>
      <div class="lv-block"><span class="lv-lab">Video Length</span>${seg("length", LENGTHS, st.length)}</div>
      <div class="lv-block"><span class="lv-lab">Motion</span>${seg("motion", MOTIONS, st.motion)}</div>
      <div class="lv-block"><span class="lv-lab">Music</span>
        <div class="rv-music">
          <select id="lvMusic">
            <option value="none" ${st.music === "none" ? "selected" : ""}>No Music</option>
            <optgroup label="Music Library">${MUSIC.map(([id, n]) => `<option value="${id}" ${st.music === id ? "selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>
            ${getCustomTracks().length ? `<optgroup label="My Uploads">${getCustomTracks().map((t) => `<option value="${t.id}" ${st.music === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>` : ""}
          </select>
          <button type="button" class="btn btn-ghost btn-sm rv-music-play" data-a="musicplay" ${st.music === "none" ? "disabled" : ""}><i data-lucide="${playingId() === st.music ? "pause" : "play"}"></i>${playingId() === st.music ? "Stop" : "Preview"}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-a="audio"><i data-lucide="upload"></i>Upload Audio</button>
          <input type="file" accept="audio/*" id="lvMusicFile" hidden>
        </div>
        <p class="lv-note">Recommended track: ${esc(MUSIC[0][1])}. Uploaded audio is stored in your media library.</p>
      </div>
      <div class="lv-block"><span class="lv-lab">Branding</span>
        <div class="lv-two">
          <select id="lvKit">
            <option value="">No Branding</option>
            ${S.kits.map((k) => `<option value="${k.id}" ${st.brandKitId === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}
          </select>
          <button class="lv-quiet" data-a="kits">Manage Brand Kit</button>
        </div>
        ${kit ? `<p class="lv-note">${esc([kit.contact_name, kit.company_name, kit.phone, kit.website].filter(Boolean).join(" • "))}</p>` : ""}
      </div>

      <details class="lv-adv" ${st.advOpen ? "open" : ""}>
        <summary>Advanced Options</summary>
        <div class="lv-adv-b">
          <label class="lv-f"><span>Voiceover</span><select id="lvNarr">
            <option value="none" ${st.narration === "none" ? "selected" : ""}>No Voiceover</option>
            <option value="generate" ${st.narration === "generate" ? "selected" : ""}>AI Narration</option>
            <option value="upload" ${st.narration === "upload" ? "selected" : ""}>Upload My Voiceover</option>
          </select></label>
          ${st.narration === "generate" ? `<label class="lv-f"><span>Voice</span><select id="lvVoice">
            ${[["warm", "Warm Female"], ["clear", "Clear Male"], ["calm", "Calm Neutral"], ["luxury", "Luxury"]]
              .map(([v, n]) => `<option value="${v}" ${st.voice === v ? "selected" : ""}>${n}</option>`).join("")}
          </select></label>
          <label class="lv-f wide"><span>Narration Script</span><textarea id="lvScript" rows="3" placeholder="Leave empty and we write one from your scenes.">${esc(st.script)}</textarea></label>
          <div class="lv-f wide"><button type="button" class="btn btn-ghost btn-sm" data-a="lvVoicePrev"><i data-lucide="volume-2"></i>${st.voicePreviewing ? "Stop Preview" : "Preview Voiceover"}</button></div>` : ""}
          ${st.narration === "upload" ? `<label class="lv-f wide"><span>Voiceover File</span><input type="file" id="lvNarFile" accept="audio/*"></label>
          <p class="lv-note">${st.narrationName ? `Using ${esc(st.narrationName)}.` : "Upload a recorded voiceover to mix over your music bed."}</p>` : ""}
          <div class="lv-f wide av-block">${avatarSection(st.avatar, S.propertyLabel || "")}</div>
          <label class="lv-check"><input type="checkbox" data-chk="captions" ${st.captions ? "checked" : ""}> Captions</label>

          <label class="lv-check"><input type="checkbox" data-chk="labels" ${st.labels ? "checked" : ""}> Scene Labels</label>
          <label class="lv-check"><input type="checkbox" data-chk="intro" ${st.intro ? "checked" : ""}> Intro</label>
          <label class="lv-check"><input type="checkbox" data-chk="outro" ${st.outro ? "checked" : ""}> Outro</label>
          <label class="lv-f"><span>Transitions</span><select id="lvTrans">
            <optgroup label="Classic">
            ${[["clean", "Clean Cut"], ["fade", "Fade"], ["slide", "Slide"], ["architectural", "Architectural Wipe"]]
              .map(([v, n]) => `<option value="${v}" ${st.transition === v ? "selected" : ""}>${n}</option>`).join("")}
            </optgroup>
            <optgroup label="Viral VFX">
            ${[["whip", "Whip Pan"], ["punch", "Zoom Punch"], ["flash", "Flash Cut"], ["glitch", "Glitch"], ["leak", "Light Leak"]]
              .map(([v, n]) => `<option value="${v}" ${st.transition === v ? "selected" : ""}>${n}</option>`).join("")}
            </optgroup>
          </select></label>

          <label class="lv-f"><span>Video Effects</span><select id="lvFx">
            ${[["none", "None"], ["film", "Subtle Film Grain"], ["warm", "Warm Grade"], ["cool", "Cool Grade"]]
              .map(([v, n]) => `<option value="${v}" ${st.effects === v ? "selected" : ""}>${n}</option>`).join("")}
          </select></label>
          <label class="lv-f wide"><span>Custom Text</span><input id="lvText" value="${esc(st.customText)}" placeholder="Open Sunday, 1 to 4"></label>
          <label class="lv-f"><span>Disclosure</span><select id="lvDisc">
            <option value="auto" ${st.disclosure === "auto" ? "selected" : ""}>Automatic</option>
            <option value="always" ${st.disclosure === "always" ? "selected" : ""}>Always Show</option>
            <option value="none" ${st.disclosure === "none" ? "selected" : ""}>Not Required</option>
          </select></label>
          <label class="lv-f"><span>Resolution</span><select id="lvRes">
            <option value="1080" ${st.resolution === "1080" ? "selected" : ""}>1080p</option>
            <option value="720" ${st.resolution === "720" ? "selected" : ""}>720p</option>
          </select></label>
          <label class="lv-f"><span>Scene Duration</span><select id="lvDur">
            <option value="0" ${!st.sceneDuration ? "selected" : ""}>Automatic</option>
            <option value="2" ${st.sceneDuration === 2 ? "selected" : ""}>2 Seconds</option>
            <option value="3" ${st.sceneDuration === 3 ? "selected" : ""}>3 Seconds</option>
            <option value="4" ${st.sceneDuration === 4 ? "selected" : ""}>4 Seconds</option>
          </select></label>
        </div>
      </details>
    </div>

    <div class="lv-foot">
      <span class="lv-cost">Uses ${creditCost()} video credits</span>
      <button class="btn btn-primary" data-a="generate" ${scenes ? "" : "disabled"}><i data-lucide="clapperboard"></i>Generate Video</button>
    </div>
    ${S.confirm ? confirmHtml() : ""}
  </div>`;
}

function confirmHtml() {
  const block = creditBlock();
  if (block)
    return `<div class="lv-modal" role="dialog" aria-label="Upgrade required">
    <div class="lv-modal-in">
      <b>Upgrade To Render Video</b>
      <p>${block}</p>
      <div class="lv-modal-a">
        <button class="btn btn-ghost" data-a="cancel-gen">Cancel</button>
        <a class="btn btn-primary" href="/app#v-billing">View Plans</a>
      </div>
    </div>
  </div>`;
  return `<div class="lv-modal" role="dialog" aria-label="Confirm video generation">
    <div class="lv-modal-in">
      <b>Generate This Video?</b>
      <p>${creditCost()} video credits will be used now. We create a branded version and a clean version from one request.</p>
      <div class="lv-modal-a">
        <button class="btn btn-ghost" data-a="cancel-gen">Cancel</button>
        <button class="btn btn-primary" data-a="confirm-gen">Generate Video</button>
      </div>
    </div>
  </div>`;
}



/* Map friendly voice names to gateway voices. */
const VOICE_MAP: Record<string, string> = {
  professional: "alloy", warm: "coral", conversational: "sage", luxury: "ballad",
  clear: "echo", calm: "sage",
};

let voiceAudio: HTMLAudioElement | null = null;

function stopVoicePreview() {
  if (voiceAudio) { try { voiceAudio.pause(); } catch (_) { /* noop */ } voiceAudio = null; }
  if (S.setup) S.setup.voicePreviewing = false;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

/* Fallback script written from the included scenes. */
function lvDefaultScript() {
  const rooms = Array.from(new Set(S.photos.filter((p) => p.include).map((p) => p.room).filter(Boolean))).slice(0, 6);
  const lines = [];
  if (S.setup.title) lines.push(`A look at ${S.setup.title}.`);
  if (rooms.length) lines.push(`This tour covers ${rooms.join(", ")}.`);
  lines.push("Every design shown is a proposed concept created in REAL DESIGNS.");
  return lines.join(" ");
}

async function buildNarration(type: string, script: string | null | undefined, voice: string | null | undefined) {
  if (type === "upload") return S.setup?.narrationUpload || null;
  if (type !== "generate") return null;
  const text = (script || "").trim() || lvDefaultScript();
  if (text.length < 4) return null;
  try {
    const { synthesizeNarration } = await import("@/lib/narration.functions");
    const out = await synthesizeNarration({
      data: { script: text.slice(0, 4000), voice: VOICE_MAP[(voice || "").toLowerCase()] || "alloy" },
    });
    return out?.audio || null;
  } catch (_) {
    return null;
  }
}

/* ======================= RENDER PROGRESS + RESULT ======================= */

const STAGES = [
  "Preparing photos",
  "Analyzing scenes",
  "Creating motion",
  "Building branded version",
  "Building clean version",
  "Finalizing",
];

function renderingHtml() {
  return `<div class="lv">
    <div class="lv-head"><h2>Creating Your Video</h2><p>${esc(S.stage || STAGES[0])}</p></div>
    <div class="lv-bar big"><i style="width:${Math.round(S.progress * 100)}%"></i></div>
    <ul class="lv-stages">${STAGES.map(
      (s, i) => `<li class="${S.stage === s ? "on" : i < STAGES.indexOf(S.stage) ? "done" : ""}">${s}</li>`,
    ).join("")}</ul>
    <p class="lv-note">Keep REAL DESIGNS open. You can move to any other page while this renders.</p>
  </div>`;
}

function doneHtml() {
  const outs = S.outputs;
  const cur = outs.find((o) => o.version_type === S.playVersion) || outs[0];
  return `<div class="lv">
    <div class="lv-head"><h2>Your Listing Video Is Ready</h2><p>${esc(S.propertyLabel || "Standalone Project")}</p></div>
    <div class="lv-seg plain">${outs
      .map(
        (o) =>
          `<button class="${cur && cur.id === o.id ? "on" : ""}" data-ver="${o.version_type}"><b>${o.version_type === "branded" ? "Branded Video" : o.version_type === "clean" ? "Clean Video" : "Disclosure Video"}</b></button>`,
      )
      .join("")}</div>
    <div class="lv-player" id="lvPlayer"></div>
    <div class="lv-foot wrap">
      <button class="btn btn-ghost btn-sm" data-a="download"><i data-lucide="download"></i>Download</button>
      <button class="btn btn-ghost btn-sm" data-a="share"><i data-lucide="share-2"></i>Share</button>
      <button class="btn btn-ghost btn-sm" data-a="duplicate"><i data-lucide="copy"></i>Duplicate</button>
      <button class="btn btn-ghost btn-sm" data-a="quick"><i data-lucide="sliders-horizontal"></i>Quick Edit</button>
      <button class="btn btn-primary btn-sm" data-a="studio"><i data-lucide="film"></i>Open In Studio</button>
    </div>
  </div>`;
}

/* ======================= RENDER ======================= */

let lvMusicLoaded = false;
function render() {
  const el = hostEl();
  if (!el) return;
  if (!lvMusicLoaded) {
    lvMusicLoaded = true;
    loadCustomTracks().then((list) => { if (list.length) render(); });
  }
  el.innerHTML =
    S.step === "review"
      ? reviewHtml()
      : S.step === "photos"
      ? photosHtml()
      : S.step === "setup"
        ? setupHtml()
        : S.step === "rendering"
          ? renderingHtml()
          : S.step === "done"
            ? doneHtml()
            : startHtml();
  paint();
  hydrateThumbs();
  stopPreview();
  if (S.step === "setup") {
    startPreview();
    if (!S.setup.avatar) S.setup.avatar = blankAvatarConfig();
    bindAvatar(el, S.setup.avatar, render, toast);
  }

  if (S.step === "done") mountPlayer();


}

async function hydrateThumbs() {
  const nodes = Array.from(hostEl()?.querySelectorAll("[data-img]") || []);
  for (const n of nodes) {
    const path = n.getAttribute("data-img");
    if (!path) continue;
    const url = await resolvePhotoUrl(path);
    if (url) n.style.backgroundImage = `url("${url}")`;
  }
}

/** Live preview player for the setup step. */
let lvPvTimer = null;
let lvPvPaused = false;

function stopPreview() {
  if (lvPvTimer) { clearInterval(lvPvTimer); lvPvTimer = null; }
}

async function startPreview() {
  stopPreview();
  const el = hostEl();
  const stage = el?.querySelector("#lvStage");
  if (!stage) return;
  const scenes = S.photos.filter((p) => p.include).slice(0, 12);
  if (!scenes.length) return;

  const urls = [];
  for (const p of scenes) urls.push(await resolvePhotoUrl(p.path).catch(() => null));
  if (hostEl() !== el || !el.contains(stage)) return;

  const total = S.setup.length === "quick" ? 15 : S.setup.length === "full" ? 60 : 30;
  const per = S.setup.sceneDuration || Math.max(1.5, total / scenes.length);
  stage.innerHTML = scenes.map((p, i) => `<figure class="lv-pv-slide${i === 0 ? " on" : ""}">
      ${urls[i] ? `<img src="${esc(urls[i])}" alt="${esc(p.room)}">` : `<span class="lv-pv-miss">Image Unavailable</span>`}
      ${S.setup.labels ? `<figcaption>${esc(p.room)}</figcaption>` : ""}
    </figure>`).join("");
  stage.style.setProperty("--lv-per", per + "s");

  const meta = el.querySelector("#lvPvMeta");
  let i = 0;
  const show = () => {
    stage.querySelectorAll(".lv-pv-slide").forEach((n, k) => n.classList.toggle("on", k === i));
    if (meta) meta.textContent = `Scene ${i + 1} Of ${scenes.length} · ${per.toFixed(1)}s Each`;
  };
  show();
  if (!lvPvPaused) lvPvTimer = setInterval(() => { i = (i + 1) % scenes.length; show(); }, per * 1000);
}

async function mountPlayer() {
  const box = hostEl()?.querySelector("#lvPlayer");
  if (!box) return;
  const cur = S.outputs.find((o) => o.version_type === S.playVersion) || S.outputs[0];
  if (!cur?.output_path) {
    box.innerHTML = `<div class="lv-note">No output yet.</div>`;
    return;
  }

  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(cur.output_path, 3600);
  box.innerHTML = data?.signedUrl
    ? `<video src="${data.signedUrl}" controls playsinline></video>`
    : `<div class="lv-note">Could not load that video.</div>`;
}

/* ======================= LISTING IMPORT ======================= */

async function runImport() {
  const url = String(S.importUrl || "").trim();
  if (!url) return toast("Paste a listing link to continue.");
  S.importState = "running";
  S.importStage = "Validating Link";
  S.importError = "";
  render();
  track("lvideo_import_start", { url_host: (url.match(/([a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || "" });
  try {
    S.importStage = "Retrieving Listing Details";
    const r = await startListingImport({ data: { url, property_id: S.propertyId || null } });
    S.importRow = r.import || null;
    if (!r.ok) {
      S.importState = "failed";
      S.importError = r.message || "We couldn't import that listing.";
      S.otherOpen = true;
      track("lvideo_import_failed", { code: r.code || "unknown" });
      return render();
    }
    S.importState = "ready";
    S.step = "review";
    if (S.importRow?.listing?.address) {
      S.addressQuery = S.importRow.listing.address;
      matchAddresses();
    }
    track("lvideo_import_ready", { photos: S.importRow?.photo_count || 0 });
    return render();
  } catch (e) {
    S.importState = "failed";
    S.importError = e?.message || "We couldn't reach the import service. Try again in a moment.";
    S.otherOpen = true;
    return render();
  }
}

/** Turn a reviewed import into a property context and move to the photo step. */
async function continueFromImport() {
  const address = normalizeAddress(S.importRow?.listing?.address || S.addressQuery || "");
  try {
    if (!S.propertyId) {
      const existing = S.properties.find((p) => normalizeAddress(p.address) === address);
      const row = existing || (await createMediaProperty({ data: { address: address || "Imported Listing" } }));
      if (!existing) S.properties.unshift(row);
      S.propertyId = row.id;
      S.propertyLabel = row.address;
      S.standalone = false;
    }
    if (S.importRow?.id) {
      try {
        await linkListingImport({ data: { id: S.importRow.id, property_id: S.propertyId } });
      } catch (_) {}
    }
    await loadAssets(S.propertyId);
  } catch (e) {
    return toast(e?.message || "Could not set up that property.");
  }
  if (!S.photos.length) {
    S.step = "start";
    S.otherOpen = true;
    toast("No photos came through with that listing. Upload the listing photos to continue.");
    return render();
  }
  S.step = "photos";
  render();
}

/* ======================= UPLOADS ======================= */

function watchJobs() {
  if (S.jobUnsub) return;
  S.jobUnsub = UM.subscribe((jobs) => {
    if (!S.job) return;
    const j = jobs.find((x) => x.id === S.job.id);
    if (!j) return;
    const wasDone = S.job.state;
    S.job = j;
    if (S.step === "start") render();
    if (j.state === "Complete" && wasDone !== "Complete") {
      loadAssets(S.propertyId).then(() => {
        S.step = "photos";
        render();
      });
    }
  });
}

async function beginUpload(files) {
  if (!files.length) return;
  if (!S.authorized) {
    toast("Confirm you own these photos or have permission to use them.");
    return;
  }
  const rejected = files.filter((f) => UM.rejectReason(f));
  const ok = files.filter((f) => !UM.rejectReason(f));
  if (rejected.length) toast(`${rejected.length} file${rejected.length > 1 ? "s were" : " was"} skipped as unsupported.`);
  if (!ok.length) return;
  if (!S.propertyId && !S.standalone) {
    const label = normalizeAddress(S.addressQuery) || "Untitled Property";
    try {
      const row = await createMediaProperty({ data: { address: label } });
      S.propertyId = row.id;
      S.propertyLabel = row.address;
    } catch (_) {
      S.standalone = true;
      S.propertyLabel = "Standalone Project";
    }
  }
  watchJobs();
  S.job = UM.startJob({
    files: ok,
    propertyId: S.propertyId,
    propertyLabel: S.propertyLabel || "Standalone Project",
    source: "computer",
  });
  track("listing_video_upload", { files: ok.length });
  render();
}

/* ======================= GENERATION ======================= */

function disclosureFor(p) {
  const c = (p.modification_class || "").toLowerCase();
  if (c.includes("virtually staged")) return "staged";
  if (c.includes("proposed")) return "proposed";
  if (c.includes("concept")) return "concept";
  if (c.includes("altered")) return "altered";
  return null;
}

function needsDisclosure(scenes) {
  if (S.setup.disclosure === "none") return false;
  if (S.setup.disclosure === "always") return true;
  return S.setup.motion === "immersive" || scenes.some((s) => !!disclosureFor(s));
}

/** Rotate an image in the browser so the render receives the corrected frame. */
async function rotatedUrl(url, deg) {
  if (!deg) return url;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const swap = deg % 180 !== 0;
  const c = document.createElement("canvas");
  c.width = swap ? img.naturalHeight : img.naturalWidth;
  c.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c.toDataURL("image/jpeg", 0.92);
}

async function generate() {
  const chosen = S.photos.filter((p) => p.include);
  if (!chosen.length) return;
  S.confirm = false;
  S.busy = true;
  S.step = "rendering";
  S.progress = 0;
  S.stage = STAGES[0];
  render();

  const st = S.setup;
  const per = st.sceneDuration || sceneDurations(chosen.length, st.length);
  const withCoverFirst = S.cover ? [...chosen].sort((a, b) => (a.id === S.cover ? -1 : b.id === S.cover ? 1 : 0)) : chosen;

  let projectId = null;
  try {
    const sceneRows = withCoverFirst.map((p, i) => ({
      source_asset_id: p.assetId || null,
      source_path: p.path,
      room_name: p.room,
      sequence: i,
      scene_type: st.type === "before_after" ? "before_after" : "design",
      duration: per,
      motion: st.motion === "none" ? "static" : st.motion === "auto" ? autoMotion(p, i) : p.motion || autoMotion(p, i),
      transition: st.transition,
      caption: st.captions ? p.room : null,
      disclosure_type: disclosureFor(p),
      motion_level: st.motion === "immersive" && p.immersiveOk ? "immersive" : "standard",
      immersive_effect: st.motion === "immersive" && p.immersiveOk ? "light" : null,
      exterior_effect: st.type === "cinematic_exterior" && EXTERIOR.test(p.room) ? "approach" : null,
      labels: st.labels ? [{ text: p.room, style: "clean", position: "bottom_left" }] : [],
    }));

    const saved = await saveVideo({
      data: {
      project: {
        property_id: S.propertyId || null,
        property_label: S.propertyLabel || (S.standalone ? "Standalone Project" : null),
        title: (S.propertyLabel || "Listing") + " Video",
        video_type: st.type,
        source_type: S.standalone ? "standalone" : "property",
        status: "queued",
        formats: [st.format],
        length_preset: st.length,
        transition: st.transition,
        motion: st.motion,
        brand_kit_id: st.brandKitId || null,
        branding: { contact: true, cta: true, intro: st.intro, outro: st.outro },
        disclosure: { mode: st.disclosure },
        settings: {
          workflow: "listing_video",
          effects: st.effects,
          resolution: st.resolution,
          custom_text: st.customText,
          music: st.music,
          narration: st.narration,
          cover_asset_id: S.cover,
          listing_link: S.link ? { provider: S.link.provider?.id, address: S.link.address } : null,
          media_authorization: S.authorizedAt ? { confirmed_at: S.authorizedAt, user_id: S.userId || null } : null,
        },
      },
      scenes: sceneRows,
      audio: {
        presentation_style: st.narration === "none" ? "music" : "narration",
        music_track_id: st.music,
        music_volume: 0.6,
        beat_sync: true,
        narration_type: st.narration,
        narration_script: st.narration === "generate" ? st.script || null : null,
        voice_id: st.voice || null,
        captions_enabled: !!st.captions,
      },
      },
    });
    projectId = saved.id;
    S.projectId = projectId;

    const versions = [{ version_type: "branded" }, { version_type: "clean" }];
    if (needsDisclosure(withCoverFirst)) versions.push({ version_type: "disclosure" });
    const started = await startRender({
      data: {
      id: projectId,
      variants: versions.map((v) => ({
        aspect_ratio: st.format,
        version_type: v.version_type,
        brand_kit_id: v.version_type === "branded" ? st.brandKitId || null : null,
      })),
      },
    });
    track("listing_video_generate", { scenes: sceneRows.length, format: st.format, motion: st.motion });

    S.stage = STAGES[1];
    render();

    const kit = S.kits.find((k) => k.id === st.brandKitId) || null;
    const scenes = [];
    for (const [i, p] of withCoverFirst.entries()) {
      const url = await resolvePhotoUrl(p.path);
      scenes.push({
        url: await rotatedUrl(url, p.rotate),
        room_name: p.room,
        scene_type: sceneRows[i].scene_type,
        duration: per,
        motion: sceneRows[i].motion,
        transition: st.transition,
        caption: st.captions ? p.room : null,
        disclosure_type: sceneRows[i].disclosure_type,
        motion_level: sceneRows[i].motion_level,
        immersive_effect: sceneRows[i].immersive_effect,
        exterior_effect: sceneRows[i].exterior_effect,
        labels: sceneRows[i].labels,
      });
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const avTitle = S.propertyLabel || "";
    const narrationUrl = await buildNarration(st.narration, avatarScript(st.avatar, st.script || "", avTitle), st.voice);
    const avatar = avatarRenderOption(st.avatar, avTitle);
    const outs = [];
    let done = 0;
    for (const v of started.variants) {
      S.stage = v.version_type === "branded" ? STAGES[3] : v.version_type === "clean" ? STAGES[4] : STAGES[5];
      render();
      const out = await renderReveal(scenes, {
        aspect: v.aspect_ratio,
        versionType: v.version_type,
        brand:
          v.version_type === "branded" && kit
            ? {
                company_name: kit.company_name,
                contact_name: kit.contact_name,
                phone: kit.phone,
                email: kit.email,
                website: kit.website,
                default_cta: st.customText || kit.default_cta,
                accent: kit.colors?.primary || null,
              }
            : null,
        title: S.propertyLabel || "",
        transition: st.transition,
        captionsEnabled: !!st.captions,
        music: st.music && st.music !== "none" ? st.music : null,
        narrationUrl,
        avatar,
        musicVolume: 0.6,
        onProgress: (pct) => {
          S.progress = (done + pct) / started.variants.length;
          const bar = hostEl()?.querySelector(".lv-bar i");
          if (bar) bar.style.width = Math.round(S.progress * 100) + "%";
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
      } catch (_) {
        thumbPath = null;
      }
      await finishVariant({
        data: {
        variant_id: v.id,
        render_status: "ready",
        output_path: videoPath,
        thumbnail_path: thumbPath,
        duration: out.duration,
        resolution: v.aspect_ratio === "16:9" ? "1920x1080" : "1080x1920",
        },
      });
      outs.push({ ...v, output_path: videoPath });
      done += 1;
    }

    await setVideoStatus({ data: { id: projectId, status: "ready" } });
    if (S.propertyId && withCoverFirst.length) {
      try {
        await updateMediaAssets({ data: { ids: withCoverFirst.map((p) => p.assetId).filter(Boolean), patch: { recommended: true } } });
      } catch (_) {}
    }
    S.outputs = outs;
    S.playVersion = "branded";
    S.stage = "Complete";
    S.progress = 1;
    S.step = "done";
    S.busy = false;
    toast("Your Listing Video Is Ready.");
    render();
  } catch (e) {
    S.busy = false;
    if (projectId) {
      try {
        await setVideoStatus({ data: { id: projectId, status: "failed", error_message: String(e?.message || e).slice(0, 300) } });
      } catch (_) {}
    }
    toast(e?.message || "The render failed. Your selections were saved.");
    S.step = "setup";
    render();
  }
}

/* ======================= EVENTS ======================= */

function bind() {
  const el = hostEl();
  if (!el || el.__lvBound) return;
  el.__lvBound = true;

  el.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-a],[data-prop],[data-newprop],[data-cloud],[data-set],[data-ver],[data-useaddr],#lvImportGo,#lvOther,#lvBrowse,#lvLinkOpen,#lvLinkGo,#lvLinkUpload,#lvStandalone,#lvUseMedia,#lvRetry,#lvCancel,#lvDrop");
    if (!t) return;

    if (t.id === "lvOther") {
      S.otherOpen = !S.otherOpen;
      return render();
    }
    if (t.id === "lvImportGo") {
      const field = el.querySelector("#lvImportUrl");
      if (field) S.importUrl = field.value || "";
      return runImport();
    }
    if (t.id === "lvDrop" || t.id === "lvBrowse") return el.querySelector("#lvFiles")?.click();
    if (t.id === "lvLinkOpen") {
      S.linkOpen = !S.linkOpen;
      return render();
    }
    if (t.id === "lvLinkGo") {
      S.linkValue = el.querySelector("#lvLink")?.value || "";
      S.link = identifyListing(S.linkValue);
      if (S.link.address) {
        S.addressQuery = S.link.address;
        matchAddresses();
      }
      return render();
    }
    if (t.id === "lvLinkUpload") return el.querySelector("#lvFiles")?.click();
    if (t.id === "lvStandalone") {
      S.standalone = true;
      S.propertyId = null;
      S.propertyLabel = "Standalone Project";
      return render();
    }
    if (t.id === "lvUseMedia") {
      await loadAssets(S.propertyId, true);
      if (!S.photos.length) {
        toast("No photos found yet. Upload listing photos to continue.");
        return render();
      }
      if (S.usedLibrary) toast("Showing photos from your media library.");
      S.step = "photos";
      return render();
    }

    if (t.id === "lvRetry") {
      UM.retryFailed(S.job.id);
      return;
    }
    if (t.id === "lvCancel") {
      UM.cancelJob(S.job.id);
      return;
    }

    const useAddr = t.getAttribute("data-useaddr");
    if (useAddr) {
      S.addressQuery = useAddr;
      matchAddresses();
      return render();
    }

    const propId = t.getAttribute("data-prop");
    if (propId) {
      const p = S.properties.find((x) => x.id === propId);
      S.propertyId = propId;
      S.propertyLabel = p ? p.address : "";
      S.standalone = false;
      await loadAssets(propId, true);
      S.step = S.photos.length ? "photos" : "start";
      if (!S.photos.length) toast("That property has no photos yet. Upload the listing photos to continue.");
      else if (S.usedLibrary)
        toast("That property has no photos yet — showing photos from your media library instead.");
      return render();
    }


    if (t.getAttribute("data-newprop")) {
      const label = normalizeAddress(S.addressQuery);
      try {
        const row = await createMediaProperty({ data: { address: label } });
        S.propertyId = row.id;
        S.propertyLabel = row.address;
        S.standalone = false;
        S.properties.unshift(row);
        toast("Property Draft Created.");
      } catch (err) {
        toast(err?.message || "Could not create that property.");
      }
      return render();
    }

    const cloud = t.getAttribute("data-cloud");
    if (cloud) {
      toast(
        cloud === "mls"
          ? "Connecting an authorized listing source is set up in Settings. Until then, upload the original photos."
          : `${cloud === "drive" ? "Google Drive" : "Dropbox"} is not connected yet. Connect it in Settings, or upload the photos from this device.`,
      );
      return;
    }

    const setKey = t.getAttribute("data-set");
    if (setKey) {
      S.setup[setKey] = t.getAttribute("data-val");
      return render();
    }

    const ver = t.getAttribute("data-ver");
    if (ver) {
      S.playVersion = ver;
      return render();
    }

    const a = t.getAttribute("data-a");
    const id = t.getAttribute("data-id");
    if (a === "review-continue") return continueFromImport();
    if (a === "lvVoicePrev") {
      if (S.setup.voicePreviewing) { stopVoicePreview(); return render(); }
      S.setup.voicePreviewing = true;
      render();
      return void buildNarration("generate", (S.setup.script || lvDefaultScript()).slice(0, 400), S.setup.voice).then((url) => {
        if (!url) { S.setup.voicePreviewing = false; render(); return void toast("Voiceover Preview Failed."); }
        voiceAudio = new Audio(url);
        voiceAudio.onended = () => { S.setup.voicePreviewing = false; render(); };
        voiceAudio.play().catch(() => {});
      });
    }
    if (a === "back-start") {
      stopVoicePreview();
      S.step = "start";
      return render();
    }
    if (a === "back-photos") {
      stopVoicePreview();
      S.step = "photos";
      return render();
    }
    if (a === "all") {
      S.photos.forEach((p) => (p.include = true));
      return render();
    }
    if (a === "none") {
      S.photos.forEach((p) => (p.include = false));
      return render();
    }
    if (a === "more") return el.querySelector("#lvMore")?.click() || openMorePicker();
    if (a === "arrange") {
      autoArrange();
      return render();
    }
    if (a === "cover") {
      S.cover = id;
      return render();
    }
    if (a === "rotate") {
      const p = S.photos.find((x) => x.id === id);
      if (p) p.rotate = (p.rotate + 90) % 360;
      return render();
    }
    if (a === "replace") return openMorePicker(id);
    if (a === "edit") {
      const asset = S.assets.find((x) => x.id === id);
      if (!asset) return toast("Open this photo from Media to edit it.");
      return openPhotoEditor({
        assetId: id,
        assets: S.assets,
        versions: [],
        propertyLabel: S.propertyLabel,
        reload: () => loadAssets(S.propertyId).then(render),
      });
    }
    if (a === "to-setup") {
      await loadKits();
      S.step = "setup";
      return render();
    }
    if (a === "kits") {
      S.go && S.go("reveal");
      return toast("Brand kits are managed on the Video page.");
    }
    if (a === "pvtoggle") {
      lvPvPaused = !lvPvPaused;
      if (lvPvPaused) stopPreview();
      return void render();
    }
    if (a === "musicplay") {

      const cur = S.setup.music;
      if (!cur || cur === "none") return toast("Choose A Track First.");
      toggleMusic(cur);
      return void render();
    }
    if (a === "audio") {
      const inp = document.getElementById("lvMusicFile");
      if (!inp) return;
      inp.onchange = (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) return toast("Audio Files Must Be Under 20MB.");
        const t = addCustomTrack(f);
        stopMusic();
        S.setup.music = t.id;
        S.setup.uploadedTrack = t.name;
        toast("Track Uploaded.");
        render();
      };
      return void inp.click();
    }
    if (a === "generate") {
      stopVoicePreview();
      stopMusic();
      if (!S.credits) {
        try {
          S.credits = await getMyCredits();
        } catch (_) {
          S.credits = null;
        }
      }
      S.confirm = true;
      return render();
    }

    if (a === "cancel-gen") {
      S.confirm = false;
      return render();
    }
    if (a === "confirm-gen") return generate();
    if (a === "download") {
      const cur = S.outputs.find((o) => o.version_type === S.playVersion) || S.outputs[0];
      if (!cur?.output_path) return;
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(cur.output_path, 3600, { download: true });
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
      return;
    }
    if (a === "share" || a === "quick" || a === "studio" || a === "duplicate") {
      if (!S.projectId) return;
      return openVideoDetail(S.projectId, a === "share" ? "presentation" : a === "studio" ? "scenes" : "video");
    }
  });

  el.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "lvFiles") {
      const files = Array.from(t.files || []);
      t.value = "";
      return beginUpload(files);
    }
    if (t.id === "lvAuth") {
      S.authorized = t.checked;
      S.authorizedAt = t.checked ? new Date().toISOString() : null;
      return;
    }
    if (t.id === "lvMusic") { S.setup.music = t.value; stopMusic(); return void render(); }
    if (t.id === "lvKit") return void (S.setup.brandKitId = t.value || null);
    if (t.id === "lvNarr") { stopVoicePreview(); S.setup.narration = t.value; return void render(); }
    if (t.id === "lvNarFile") {
      const f = t.files && t.files[0];
      if (!f) return;
      if (f.size > 25 * 1024 * 1024) return void toast("Voiceover Must Be Under 25 MB.");
      fileToDataUrl(f).then((url) => {
        S.setup.narrationName = f.name;
        S.setup.narrationUpload = url;
        toast("Voiceover Added.");
        render();
      }).catch(() => toast("Could Not Read That File."));
      return;
    }
    if (t.id === "lvVoice") return void (S.setup.voice = t.value);
    if (t.id === "lvScript") return void (S.setup.script = t.value);
    if (t.id === "lvTrans") return void (S.setup.transition = t.value);
    if (t.id === "lvFx") return void (S.setup.effects = t.value);
    if (t.id === "lvText") return void (S.setup.customText = t.value);
    if (t.id === "lvDisc") return void (S.setup.disclosure = t.value);
    if (t.id === "lvRes") return void (S.setup.resolution = t.value);
    if (t.id === "lvDur") return void (S.setup.sceneDuration = Number(t.value) || 0);
    const chk = t.getAttribute && t.getAttribute("data-chk");
    if (chk) return void (S.setup[chk] = t.checked);
    const inc = t.getAttribute && t.getAttribute("data-inc");
    if (inc) {
      const p = S.photos.find((x) => x.id === inc);
      if (p) p.include = t.checked;
      return render();
    }
    const room = t.getAttribute && t.getAttribute("data-room");
    if (room) {
      const p = S.photos.find((x) => x.id === room);
      if (p) p.room = t.value;
      if (p?.assetId) updateMediaAssets({ data: { ids: [p.assetId], patch: { room_group: t.value } } }).catch(() => {});
      return;
    }
  });

  el.addEventListener("keydown", (e) => {
    if (e.target.id === "lvImportUrl" && e.key === "Enter") {
      e.preventDefault();
      S.importUrl = e.target.value || "";
      runImport();
    }
  });

  el.addEventListener("input", (e) => {
    if (e.target.id === "lvImportUrl") S.importUrl = e.target.value;
    if (e.target.id === "lvAddr") {
      S.addressQuery = e.target.value;
      matchAddresses();
      const box = el.querySelector(".lv-matches");
      if (!box) return render();
      render();
      const input = el.querySelector("#lvAddr");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (e.target.id === "lvLink") S.linkValue = e.target.value;
  });

  /* drag and drop onto the start screen */
  el.addEventListener("dragover", (e) => {
    if (S.step !== "start") return;
    e.preventDefault();
    el.querySelector("#lvDrop")?.classList.add("over");
  });
  el.addEventListener("dragleave", () => el.querySelector("#lvDrop")?.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    if (S.step !== "start") return;
    e.preventDefault();
    el.querySelector("#lvDrop")?.classList.remove("over");
    beginUpload(Array.from(e.dataTransfer?.files || []));
  });

  /* drag to reorder in the photo workspace */
  let dragId = null;
  el.addEventListener("dragstart", (e) => {
    const card = e.target.closest?.("[data-ph]");
    if (!card) return;
    dragId = card.getAttribute("data-ph");
  });
  el.addEventListener("dragover", (e) => {
    if (dragId) e.preventDefault();
  });
  el.addEventListener("drop", (e) => {
    if (!dragId) return;
    const card = e.target.closest?.("[data-ph]");
    if (!card) return;
    const overId = card.getAttribute("data-ph");
    const from = S.photos.findIndex((p) => p.id === dragId);
    const to = S.photos.findIndex((p) => p.id === overId);
    dragId = null;
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = S.photos.splice(from, 1);
    S.photos.splice(to, 0, moved);
    S.photos.forEach((p, i) => (p.order = i));
    render();
  });
}

function matchAddresses() {
  const q = S.addressQuery.toLowerCase().trim();
  S.addressMatches = q ? S.properties.filter((p) => (p.address || "").toLowerCase().includes(q)).slice(0, 5) : [];
}

let replaceTarget = null;
function openMorePicker(targetId) {
  replaceTarget = targetId || null;
  let input = document.getElementById("lvMoreFiles");
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.id = "lvMoreFiles";
    input.multiple = true;
    input.accept = UM.ACCEPT_ATTR;
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      input.value = "";
      if (!files.length) return;
      if (replaceTarget) {
        const p = S.photos.find((x) => x.id === replaceTarget);
        if (p) p.include = false;
        replaceTarget = null;
      }
      S.authorized = true;
      S.authorizedAt = S.authorizedAt || new Date().toISOString();
      S.step = "start";
      render();
      await beginUpload(files);
    });
  }
  input.click();
}

/* ======================= PUBLIC API ======================= */

export async function mountListingVideo(go, opts = {}) {
  S.go = go || S.go;
  const el = hostEl();
  if (!el) return;
  bind();
  if (!S.mounted) {
    S.mounted = true;
    el.innerHTML = `<div class="lv-note">Loading…</div>`;
    await loadProperties();
    await loadKits();
  }
  if (opts.propertyId && opts.propertyId !== S.propertyId) {
    S.propertyId = opts.propertyId;
    S.standalone = false;
    S.propertyLabel = opts.propertyLabel || S.properties.find((p) => p.id === opts.propertyId)?.address || "";
    await loadAssets(opts.propertyId);
    S.step = S.photos.length ? "photos" : "start";
  }
  if (Array.isArray(opts.assets) && opts.assets.length) {
    S.assets = opts.assets;
    S.photos = opts.assets.map(toPhoto);
    autoArrange();
    S.step = "photos";
  }
  render();
}

/** Entry point used from Studio, Properties, Media, Video and the New Design menu. */
export async function openListingVideo(seed = {}) {
  // S.go is only set once the view has mounted, so fall back to the app router.
  const go = S.go || (typeof window !== "undefined" ? window.__rdGo : null);
  if (go) {
    S.go = go;
    go("lvideo");
  }
  try {
    if (typeof history !== "undefined" && location.pathname === "/app" && location.hash !== "#v-lvideo") {
      history.replaceState(null, "", "/app#v-lvideo");
    }
  } catch (_) {}
  await mountListingVideo(S.go, seed);
  track("listing_video_open", { from: seed.from || "menu" });
}


export default mountListingVideo;
