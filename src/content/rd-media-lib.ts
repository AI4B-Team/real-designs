// Unified Media library screen. Every generated image, generated listing
// video and uploaded source file lives here behind one set of type tabs and a
// single status filter. Designs stays the design workspace; Media is the
// asset library.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { loadMediaLibrary, onMediaChange, stageLabel, typeGroup, emitMediaChange } from "@/lib/media-library";
import { resolvePhotoUrl } from "@/lib/room-photos";
import { setVersionStatusBulk, deleteVersions } from "@/lib/workspace.functions";
import { updateMediaAssets, deleteMediaAssets } from "@/lib/property-media.functions";
import { setVideoStatus, deleteVideo, duplicateVideo, getVideo, saveVideo } from "@/lib/reveal.functions";
import { openVideoDetail, continueDesignVideo } from "@/content/rd-reveal";
import { openListingVideo } from "@/content/rd-listing-video";
import { openPhotoEditor } from "@/content/rd-photo-editor";
import { openPropertyUpload } from "@/content/rd-propmedia";
import { cancelJob } from "@/lib/upload-manager";


const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};

const FAV_KEY = "rd.media.favs.v1";
const readFavs = () => {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
};
let FAVS = readFavs();
const isFav = (id) => FAVS.indexOf(String(id)) > -1;
function toggleFav(id) {
  const s = String(id);
  const i = FAVS.indexOf(s);
  if (i > -1) FAVS.splice(i, 1);
  else FAVS.push(s);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(FAVS));
  } catch (_) {}
}

const S = {
  items: [],
  tab: "all",
  status: "all",
  q: "",
  sort: "new",
  favOnly: false,
  selMode: false,
  sel: new Set(),
  loading: true,
  go: (v) => {},
  off: null,
  timer: null,
};

const STATUS_LABEL = {
  draft: "Draft",
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  shared: "Shared",
  archived: "Archived",
};
const TYPE_ICON = {
  generated_image: "image",
  generated_video: "clapperboard",
  uploaded_image: "upload",
  uploaded_document: "file-text",
};

/* ======================================================================= */

export async function mountMediaLibrary(go, _ctx = {}) {
  S.go = go || S.go;
  const view = document.getElementById("v-media");
  if (!view) return;
  if (!view.dataset.mlBuilt) {
    view.dataset.mlBuilt = "1";
    view.innerHTML = shell();
    paint();
    bind(view);
  }
  const want = (window as any).__rdMediaTab;
  if (want) {
    S.tab = want;
    (window as any).__rdMediaTab = null;
    view.querySelectorAll("#mlTabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === S.tab));
  }
  if (!S.off) S.off = onMediaChange(() => load(true));
  if (!S.timer) S.timer = window.setInterval(() => { if (hasLive()) load(true); }, 6000);
  await load(S.items.length > 0);
}

const hasLive = () =>
  document.getElementById("v-media")?.classList.contains("on") &&
  S.items.some((i) => ["processing", "queued"].includes(i.status));

function shell() {
  return `<div class="ml">
  <div class="ml-head">
    <div>
      <h2>Media</h2>
      <p>All your uploaded and generated images, videos and project files in one place. Use Upload Property Photos to import an entire property shoot in bulk.</p>
    </div>
    <div class="ml-create">
      <button class="btn btn-primary btn-sm" id="mlCreate" aria-haspopup="true" aria-expanded="false"><i data-lucide="plus"></i>Create Media</button>
      <div class="ml-menu" id="mlMenu" role="menu">
        <button data-c="image" role="menuitem"><i data-lucide="wand-2"></i>Generate An Image</button>
        <button data-c="video" role="menuitem"><i data-lucide="clapperboard"></i>Create A Listing Video</button>
        <button data-c="upload" role="menuitem"><i data-lucide="upload-cloud"></i>Upload Files</button>
      </div>
    </div>
  </div>

  <div class="ml-tabs" id="mlTabs" role="tablist">
    <button class="on" data-t="all" role="tab">All <em id="mlcAll"></em></button>
    <button data-t="images" role="tab">Images <em id="mlcImages"></em></button>
    <button data-t="videos" role="tab">Videos <em id="mlcVideos"></em></button>
    <button data-t="uploads" role="tab">Uploads <em id="mlcUploads"></em></button>
  </div>

  <div class="ml-bar">
    <label class="ml-search"><i data-lucide="search"></i><input id="mlQ" placeholder="Search property, project, room or filename"></label>
    <label class="ml-sel"><span class="sr-only">Status</span><select id="mlStatus">
      <option value="all">All Statuses</option>
      <option value="draft">Draft</option>
      <option value="processing">Processing</option>
      <option value="ready">Ready</option>
      <option value="failed">Failed</option>
      <option value="shared">Shared</option>
      <option value="archived">Archived</option>
    </select></label>
    <label class="ml-sel"><span class="sr-only">Sort</span><select id="mlSort">
      <option value="new">Newest</option>
      <option value="old">Oldest</option>
      <option value="name">Name</option>
      <option value="prop">Property</option>
    </select></label>
    <button class="btn btn-ghost btn-xs" id="mlFav"><i data-lucide="heart"></i>Favorites</button>
    <button class="btn btn-ghost btn-xs" id="mlSelect"><i data-lucide="check-square"></i>Select</button>
  </div>

  <div class="ml-bulk" id="mlBulk">
    <span id="mlSelCount">0 Selected</span>
    <button class="btn btn-primary btn-xs" data-b="video" id="mlBulkVideo"><i data-lucide="clapperboard"></i>Create Video</button>
    <button class="btn btn-ghost btn-xs" data-b="prop"><i data-lucide="home"></i>Add To Property</button>
    <button class="btn btn-ghost btn-xs" data-b="pres"><i data-lucide="presentation"></i>Add To Presentation</button>
    <button class="btn btn-ghost btn-xs" data-b="download"><i data-lucide="download"></i>Download</button>
    <button class="btn btn-ghost btn-xs" data-b="archive"><i data-lucide="archive"></i>Archive</button>
    <button class="btn btn-ghost btn-xs" data-b="more" id="mlBulkMore"><i data-lucide="more-horizontal"></i>More</button>
    <button class="btn btn-ghost btn-xs" data-b="clear">Clear</button>
  </div>


  <div class="ml-grid" id="mlGrid"></div>

  <div class="ml-drawer" id="mlDrawer" hidden></div>
</div>`;
}

function bind(view) {
  const $ = (id) => view.querySelector("#" + id);
  const menu = $("mlMenu");
  $("mlCreate").onclick = (e) => {
    e.stopPropagation();
    const on = !menu.classList.contains("on");
    menu.classList.toggle("on", on);
    $("mlCreate").setAttribute("aria-expanded", String(on));
  };
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest(".ml-create")) menu.classList.remove("on");
  });
  menu.querySelectorAll("[data-c]").forEach((b) => {
    b.onclick = () => {
      menu.classList.remove("on");
      const c = b.dataset.c;
      if (c === "image") S.go("studio");
      if (c === "video") openVideoWorkflow({ from: "media" });
      if (c === "upload") openPropertyUpload({});
    };
  });
  view.querySelectorAll("#mlTabs button").forEach((b) => {
    b.onclick = () => {
      S.tab = b.dataset.t;
      view.querySelectorAll("#mlTabs button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    };
  });
  $("mlQ").oninput = (e) => {
    S.q = e.target.value || "";
    render();
  };
  $("mlStatus").onchange = (e) => {
    S.status = e.target.value;
    render();
  };
  $("mlSort").onchange = (e) => {
    S.sort = e.target.value;
    render();
  };
  $("mlFav").onclick = () => {
    S.favOnly = !S.favOnly;
    $("mlFav").classList.toggle("on", S.favOnly);
    render();
  };
  $("mlSelect").onclick = () => {
    S.selMode = !S.selMode;
    if (!S.selMode) S.sel.clear();
    $("mlSelect").classList.toggle("on", S.selMode);
    render();
  };
  view.querySelectorAll("#mlBulk [data-b]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); bulk(b.dataset.b, b); }));
}

/** Open the canonical listing-video workflow (same one Studio and Properties open). */
export function openVideoWorkflow(seed = {}) {
  const open = (window as any).rdListingVideo;
  if (typeof open === "function") {
    open({ from: "media", ...seed });
    return;
  }
  try {
    (window as any).__rdGo && (window as any).__rdGo("lvideo");
  } catch (_) {}
}


async function load(quiet) {
  if (!quiet) {
    S.loading = true;
    render();
  }
  try {
    S.items = await loadMediaLibrary();
  } catch (_) {
    S.items = [];
  }
  S.loading = false;
  render();
}

function filtered() {
  const q = S.q.trim().toLowerCase();
  let list = S.items.filter((m) => {
    if (S.tab !== "all" && typeGroup(m.type) !== S.tab) return false;
    if (S.status !== "all" && m.status !== S.status) return false;
    if (S.status === "all" && m.status === "archived") return false;
    if (S.favOnly && !isFav(m.id)) return false;
    if (q && ((m.title || "") + " " + (m.property || "") + " " + (m.project || "") + " " + (m.room || "")).toLowerCase().indexOf(q) < 0)
      return false;
    return true;
  });
  if (S.sort === "old") list = list.slice().reverse();
  else if (S.sort === "name") list = list.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else if (S.sort === "prop") list = list.slice().sort((a, b) => String(a.property || "zzz").localeCompare(String(b.property || "zzz")));
  return list;
}

function counts() {
  const live = S.items.filter((m) => m.status !== "archived");
  return {
    all: live.length,
    images: live.filter((m) => typeGroup(m.type) === "images").length,
    videos: live.filter((m) => typeGroup(m.type) === "videos").length,
    uploads: live.filter((m) => typeGroup(m.type) === "uploads").length,
  };
}

function emptyState() {
  if (S.tab === "images")
    return `<div class="ml-empty"><i data-lucide="image"></i><b>No Images Yet</b><span>Generate a design from a photo and it lands here.</span>
      <button class="btn btn-primary btn-sm" data-e="image">Generate An Image</button></div>`;
  if (S.tab === "videos")
    return `<div class="ml-empty"><i data-lucide="clapperboard"></i><b>No Videos Yet</b><span>Turn a property shoot or a finished design into a listing video.</span>
      <button class="btn btn-primary btn-sm" data-e="video">Create A Listing Video</button></div>`;
  if (S.tab === "uploads")
    return `<div class="ml-empty"><i data-lucide="upload-cloud"></i><b>No Uploads Yet</b><span>Add your source photos, sketches and floor plans.</span>
      <button class="btn btn-primary btn-sm" data-e="upload">Upload Files</button></div>`;
  return `<div class="ml-empty"><i data-lucide="images"></i><b>No Media Yet</b><span>Upload a source file or create your first image or listing video.</span>
    <button class="btn btn-primary btn-sm" data-e="upload">Upload Files</button></div>`;
}

function render() {
  const grid = document.getElementById("mlGrid");
  if (!grid) return;
  const c = counts();
  ["All", "Images", "Videos", "Uploads"].forEach((k) => {
    const el = document.getElementById("mlc" + k);
    if (el) el.textContent = String(c[k.toLowerCase()] || 0);
  });
  const bulk = document.getElementById("mlBulk");
  if (bulk) {
    bulk.classList.toggle("on", S.selMode && S.sel.size > 0);
    const n = document.getElementById("mlSelCount");
    if (n) n.textContent = S.sel.size + " Selected";
    const bv = document.getElementById("mlBulkVideo");
    if (bv) bv.disabled = !selectedItems().some(videoReady);
  }

  if (S.loading) {
    grid.innerHTML = `<p class="ml-note">Loading Your Media…</p>`;
    return;
  }
  const list = filtered();
  if (!list.length) {
    grid.innerHTML = emptyState();
    paint();
    grid.querySelectorAll("[data-e]").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.e === "image") S.go("studio");
        if (b.dataset.e === "video") openVideoWorkflow({ from: "media" });
        if (b.dataset.e === "upload") openPropertyUpload({});
      };
    });
    return;
  }
  grid.innerHTML = list.map(card).join("");
  paint();
  hydrateThumbs(grid);
  wireCards(grid, list);
}

function card(m) {
  const g = typeGroup(m.type);
  const sel = S.sel.has(m.id);
  const proc = m.status === "processing" || m.status === "queued";
  const thumb = proc
    ? `<div class="ml-proc"><i data-lucide="loader"></i><span>${esc(stageLabel(m.stage) || "Processing")}</span>
        <div class="ml-bar ${m.progress == null ? "ind" : ""}"><i style="width:${m.progress == null ? 40 : m.progress}%"></i></div></div>`
    : m.status === "failed"
      ? `<div class="ml-fail"><i data-lucide="alert-triangle"></i><span>${esc(m.error || "Generation failed")}</span></div>`
      : `<img data-photo="${esc(m.path || "")}" alt="${esc(m.title)}" hidden>
         ${g === "videos" ? `<span class="ml-play"><i data-lucide="play"></i></span>` : ""}`;
  const badges =
    g === "videos" && !proc
      ? `<span class="ml-meta-b">${m.duration ? m.duration + "s" : "—"}</span><span class="ml-meta-b">${esc(m.aspect || "9:16")}</span>`
      : "";
  return `<div class="card ml-card${sel ? " sel" : ""}" data-card="${m.id}">
    <div class="ml-thumb${proc || m.status === "failed" ? "" : " sk"}" data-thumb="${m.id}" role="button" tabindex="0" aria-label="Open ${esc(m.title)}">${thumb}
      <span class="ml-type"><i data-lucide="${TYPE_ICON[m.type] || "image"}"></i></span>
      ${badges ? `<div class="ml-badges">${badges}</div>` : ""}
      <div class="ml-ov">
        ${S.selMode ? `<button class="ml-ob${sel ? " on" : ""}" data-pick="${m.id}" aria-label="Select"><i data-lucide="${sel ? "check" : "square"}"></i></button>` : ""}
        <button class="ml-ob${isFav(m.id) ? " fav" : ""}" data-fav="${m.id}" aria-label="Favorite"><i data-lucide="heart"></i></button>
      </div>
    </div>
    <div class="ml-body">
      <div class="ml-t"><b>${esc(m.title)}</b><span class="pill st-${m.status}">${STATUS_LABEL[m.status] || m.status}</span></div>
      <div class="mono ml-sub">${esc(m.property || "Unassigned")}${m.room ? " &middot; " + esc(m.room) : ""} &middot; ${esc(fmtDate(m.createdAt))}</div>
      <div class="ml-acts">${actions(m, g)}</div>
    </div>
  </div>`;
}

/* ---------------- action model ---------------- */

const READY = (m) => ["ready", "shared", "draft"].includes(m.status);
const videoReady = (m) => READY(m) && typeGroup(m.type) !== "videos" && !!m.path;
const canEditImage = (m) => m.type === "uploaded_image" && !m.job && !!m.refId && READY(m);
const selectedItems = () => S.items.filter((m) => S.sel.has(m.id));

function actions(m, g) {
  if (m.status === "failed")
    return `<button class="btn btn-ghost btn-xs" data-retry="${m.id}" style="flex:1"><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;
  if (m.status === "processing" || m.status === "queued")
    return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Open Details</button>
      ${m.job ? `<button class="btn btn-ghost btn-xs" data-cancel="${m.id}">Cancel</button>` : ""}`;
  return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Open</button>
    <button class="btn btn-ghost btn-xs" data-dl="${m.id}" title="Download" aria-label="Download"><i data-lucide="download"></i></button>
    <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;
}

/** Every secondary action for one asset. Only implemented workflows appear. */
function moreItems(m) {
  const g = typeGroup(m.type);
  const fav = { icon: "heart", label: isFav(m.id) ? "Unfavorite" : "Favorite", fn: () => { toggleFav(m.id); render(); } };
  if (m.status === "failed")
    return [
      { icon: "rotate-ccw", label: "Retry", fn: () => retry(m) },
      { icon: "sliders-horizontal", label: "Edit Settings", fn: () => editSettings(m) },
      { icon: "trash-2", label: "Remove", danger: true, fn: () => remove(m) },
    ];
  if (g === "videos")
    return [
      { icon: "pencil", label: "Edit Video", fn: () => openVideo(m, "video") },
      { icon: "copy", label: "Duplicate", fn: () => dupVideo(m, false) },
      { icon: "scissors", label: "Create Short Version", fn: () => dupVideo(m, true) },
      { icon: "ratio", label: "Change Format", fn: () => openVideo(m, "video") },
      { icon: "presentation", label: "Add To Presentation", fn: () => S.go("present") },
      { icon: "type", label: "Rename", fn: () => renameItem(m) },
      fav,
      { icon: "archive", label: "Archive", fn: () => archive([m]) },
      { icon: "trash-2", label: "Delete", danger: true, fn: () => del(m) },
    ];
  const out = [];
  if (canEditImage(m)) out.push({ icon: "sliders-horizontal", label: "Edit Image", fn: () => editImage(m) });
  if (isDesignDraft(m)) out.push({ icon: "pencil", label: "Continue Editing", fn: () => openVideo(m) });
  out.push({ icon: "clapperboard", label: "Create Video", fn: () => videoFrom([m]) });
  out.push({ icon: "wand-2", label: g === "uploads" ? "Create A Design" : "Use In Studio", fn: () => S.go("studio") });
  if (g === "images") out.push({ icon: "layers", label: "Create Variations", fn: () => S.go("studio") });
  if (m.sourcePath) out.push({ icon: "columns-2", label: "Compare With Source", fn: () => openDetail(m, { compare: true }) });
  out.push({ icon: "home", label: "Add To Property", fn: () => S.go("props") });
  out.push({ icon: "layout-grid", label: "Add To Design", fn: () => S.go("designs") });
  out.push({ icon: "presentation", label: "Add To Presentation", fn: () => S.go("present") });
  if (m.type === "uploaded_image" && !m.job) out.push({ icon: "type", label: "Rename", fn: () => renameItem(m) });
  out.push(fav);
  out.push({ icon: "archive", label: "Archive", fn: () => archive([m]) });
  out.push({ icon: "trash-2", label: "Delete", danger: true, fn: () => del(m) });
  return out;
}

/* ---------------- popup menu ---------------- */

let POP = null;
function closePop() {
  if (POP) {
    POP.remove();
    POP = null;
  }
}
try {
  document.addEventListener("click", (e) => {
    if (POP && !POP.contains(e.target)) closePop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePop();
  });
} catch (_) {}

function popMenu(anchor, items) {
  closePop();
  const list = items.filter(Boolean);
  const el = document.createElement("div");
  el.className = "ml-pop";
  el.setAttribute("role", "menu");
  el.innerHTML = list
    .map(
      (it, i) =>
        `<button role="menuitem" data-i="${i}" class="${it.danger ? "danger" : ""}"${it.disabled ? " disabled" : ""}><i data-lucide="${it.icon}"></i>${esc(it.label)}</button>`,
    )
    .join("");
  document.body.appendChild(el);
  paint();
  const r = anchor.getBoundingClientRect();
  const h = el.offsetHeight;
  const w = el.offsetWidth;
  el.style.top = Math.max(10, Math.min(window.innerHeight - h - 10, r.bottom + 6)) + "px";
  el.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.right - w)) + "px";
  el.querySelectorAll("[data-i]").forEach(
    (b) =>
      (b.onclick = (ev) => {
        ev.stopPropagation();
        const it = list[Number(b.dataset.i)];
        closePop();
        if (it && !it.disabled && it.fn) it.fn();
      }),
  );
  POP = el;
}


function fmtDate(d) {
  if (!d) return "Just now";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (_) {
    return "";
  }
}

async function hydrateThumbs(root) {
  root.querySelectorAll("[data-photo]").forEach(async (img) => {
    const done = () => img.closest(".ml-thumb")?.classList.remove("sk");
    const p = img.getAttribute("data-photo");
    if (!p) return done();
    const url = await resolvePhotoUrl(p);
    if (!url) return done();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    img.src = url;
    img.hidden = false;
  });
}

function wireCards(grid, list) {
  const find = (id) => list.find((x) => x.id === id);
  grid.querySelectorAll("[data-fav]").forEach((b) => (b.onclick = () => { toggleFav(b.dataset.fav); render(); }));
  grid.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => {
    const id = b.dataset.pick;
    if (S.sel.has(id)) S.sel.delete(id);
    else S.sel.add(id);
    render();
  }));
  grid.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openDetail(find(b.dataset.open))));
  grid.querySelectorAll("[data-thumb]").forEach((el) => {
    el.onclick = (ev) => {
      if (ev.target.closest("[data-fav],[data-pick]")) return;
      openDetail(find(el.dataset.thumb));
    };
    el.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openDetail(find(el.dataset.thumb));
      }
    };
  });
  grid.querySelectorAll("[data-more]").forEach(
    (b) =>
      (b.onclick = (ev) => {
        ev.stopPropagation();
        const m = find(b.dataset.more);
        if (m) popMenu(b, moreItems(m));
      }),
  );
  grid.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => download(find(b.dataset.dl))));
  grid.querySelectorAll("[data-retry]").forEach((b) => (b.onclick = () => retry(find(b.dataset.retry))));
  grid.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = () => cancelItem(find(b.dataset.cancel))));
}

/* ---------------- workflow bridges ---------------- */

function toast(msg) {
  try {
    const t = (window as any).__rdToast;
    if (t) t(msg);
  } catch (_) {}
}

function assetRow(m) {
  return {
    id: m.refId,
    storage_path: m.assetPath || m.path,
    file_name: m.title,
    original_filename: m.title,
    room_group: m.room || "Media",
    property_id: m.propertyId || null,
    flags: m.flags || [],
  };
}

/** Uploads open in the photo editor; generated designs re-open in Studio. */
function editImage(m) {
  if (canEditImage(m)) {
    openPhotoEditor({ assetId: m.refId, assets: [assetRow(m)], versions: [], propertyLabel: m.property || "Media", reload: () => load(true) });
    return;
  }
  toast("Open This Design In Studio To Keep Editing It.");
  S.go("studio");
}

/** Seed the listing-video workflow from one or many ready images. */
function videoFrom(items) {
  const usable = items.filter(videoReady);
  if (!usable.length) {
    toast("Select At Least One Ready Image To Create A Video.");
    return;
  }
  try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {}
  openListingVideo({
    from: "media",
    assets: usable.map((x, i) => ({
      id: x.refId || x.id,
      storage_path: x.assetPath || x.path,
      file_name: x.title,
      original_filename: x.title,
      room_group: x.room || x.title,
      sort_order: i,
    })),
  });
}

function isDesignDraft(m) {
  return m && m.type === "generated_video" && m.status === "draft" && (m.settings || {}).builder === "design";
}

function openVideo(m, tab) {
  try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {}
  if (isDesignDraft(m)) {
    continueDesignVideo(m.refId).catch((e) => toast(e?.message || "Could not open that draft."));
    return;
  }
  openVideoDetail(m.refId, tab || "video");
}

async function dupVideo(m, short) {
  try {
    const res = await duplicateVideo({ data: { id: m.refId } });
    const id = res && (res.id || (res.project && res.project.id));
    await load(true);
    if (id) {
      if (short) toast("Copy Created — Trim The Scenes For A Short Version.");
      try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {}
      openVideoDetail(id, "video");
    }
  } catch (e) {
    window.alert("Could not duplicate: " + (e && e.message ? e.message : "try again"));
  }
}

const PROJECT_KEYS = ["id","property_id","property_label","room_id","design_version_id","title","video_type","source_type","status","formats","length_preset","transition","motion","brand_kit_id","branding","disclosure","settings"];

async function renameItem(m) {
  const name = window.prompt("Rename", m.title);
  if (!name || name.trim() === "" || name === m.title) return;
  try {
    if (m.type === "generated_video") {
      const cur = await getVideo({ data: { id: m.refId } });
      const project = {};
      PROJECT_KEYS.forEach((k) => {
        if (cur.project[k] !== null && cur.project[k] !== undefined) project[k] = cur.project[k];
      });
      project.title = name.trim();
      await saveVideo({ data: { project } });
    } else {
      await updateMediaAssets({ data: { ids: [m.refId], patch: { file_name: name.trim() } } });
    }
    toast("Renamed.");
  } catch (e) {
    window.alert("Could not rename: " + (e && e.message ? e.message : "try again"));
  }
  await load(true);
}

async function del(m) {
  if (!m) return;
  if (!window.confirm("Delete “" + m.title + "”? This cannot be undone.")) return;
  try {
    if (m.type === "generated_video") await deleteVideo({ data: { id: m.refId } });
    else if (m.type === "generated_image") await deleteVersions({ data: { version_ids: [m.refId] } });
    else if (m.refId && !m.job) await deleteMediaAssets({ data: { ids: [m.refId] } });
    else {
      await remove(m);
      return;
    }
  } catch (e) {
    window.alert("Could not delete: " + (e && e.message ? e.message : "try again"));
    return;
  }
  closeDrawer();
  await load(true);
}

function cancelItem(m) {
  if (!m || !m.job) return;
  try {
    cancelJob(m.job.id);
  } catch (_) {}
  emitMediaChange();
}

/** Failed items go back to the settings that produced them. */
function editSettings(m) {
  if (m.type === "generated_video") return openVideo(m, "video");
  if (m.job) return openPropertyUpload({});
  S.go("studio");
}


async function download(m) {
  if (!m) return;
  const url = await resolvePhotoUrl(m.assetPath || m.path);
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = String(m.title).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function archive(items) {
  const list = items.filter(Boolean);
  if (!list.length) return;
  const vers = list.filter((m) => m.type === "generated_image").map((m) => m.refId);
  const ups = list.filter((m) => m.type === "uploaded_image" && !m.job).map((m) => m.refId);
  const vids = list.filter((m) => m.type === "generated_video").map((m) => m.refId);
  try {
    if (vers.length) await setVersionStatusBulk({ data: { version_ids: vers, status: "archived" } });
    if (ups.length) await updateMediaAssets({ data: { ids: ups, patch: { hidden: true } } });
    for (const id of vids) await setVideoStatus({ data: { id, status: "archived" } });
  } catch (e) {
    window.alert("Could not archive: " + (e && e.message ? e.message : "try again"));
  }
  S.sel.clear();
  await load(true);
}

function retry(m) {
  if (!m) return;
  if (m.type === "generated_video") {
    try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {}
    openVideoDetail(m.refId, "video");
    return;
  }
  if (m.job) {
    try {
      const UM = (window as any).rdUploadManager;
      UM && UM.retryFailed && UM.retryFailed(m.job.id);
    } catch (_) {}
    emitMediaChange();
    return;
  }
  if (m.retry && typeof m.retry === "function") m.retry();
  else S.go("studio");
}

async function remove(m) {
  if (!m) return;
  if (m.pending) {
    (window as any).rdMedia && (window as any).rdMedia.removePendingMedia(m.id);
    return;
  }
  await archive([m]);
}

async function bulk(action, anchor) {
  const list = filtered().filter((m) => S.sel.has(m.id));
  if (action === "clear") {
    S.sel.clear();
    render();
    return;
  }
  if (!list.length) return;
  if (action === "fav") {
    list.forEach((m) => { if (!isFav(m.id)) toggleFav(m.id); });
    render();
    return;
  }
  if (action === "video") return videoFrom(list);
  if (action === "prop") return S.go("props");
  if (action === "pres") return S.go("present");
  if (action === "more")
    return popMenu(anchor, [
      { icon: "heart", label: "Favorite", fn: () => bulk("fav") },
      { icon: "layout-grid", label: "Add To Design", fn: () => S.go("designs") },
      { icon: "wand-2", label: "Use In Studio", fn: () => S.go("studio") },
    ]);
  if (action === "download") {
    for (const m of list) await download(m);
    return;
  }
  if (action === "archive") await archive(list);
}

function closeDrawer() {
  const d = document.getElementById("mlDrawer");
  if (d) {
    d.hidden = true;
    d.innerHTML = "";
  }
}


/* ---------------- detail drawer ---------------- */

async function openDetail(m, opts) {
  if (!m) return;
  const d = document.getElementById("mlDrawer");
  if (!d) return;
  const g = typeGroup(m.type);
  const proc = m.status === "processing" || m.status === "queued";
  const related = S.items.filter((x) => x.id !== m.id && x.property && x.property === m.property).slice(0, 6);
  const url = await resolvePhotoUrl(m.assetPath || m.path);
  const srcUrl = m.sourcePath ? await resolvePhotoUrl(m.sourcePath) : null;
  const compare = !!(opts && opts.compare && srcUrl);
  d.hidden = false;
  d.innerHTML = `<div class="ml-dr-bg" data-close></div>
  <aside class="ml-dr" role="dialog" aria-label="${esc(m.title)}">
    <div class="ml-dr-h"><div><b>${esc(m.title)}</b><span class="mono">${esc(m.property || "Unassigned")}${m.room ? " &middot; " + esc(m.room) : ""}</span></div>
      <button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="ml-dr-b">
      <div class="ml-dr-prev">${
        compare
          ? `<div class="ml-cmp"><figure><img src="${srcUrl}" alt="Source photo"><figcaption>Source</figcaption></figure><figure><img src="${url}" alt="${esc(m.title)}"><figcaption>Result</figcaption></figure></div>`
          : g === "videos" && m.assetPath && url
            ? `<video src="${url}" controls playsinline style="width:100%;border-radius:10px"></video>`
            : url
              ? `<img src="${url}" alt="${esc(m.title)}">`
              : `<div class="ml-proc"><i data-lucide="loader"></i><span>${esc(stageLabel(m.stage) || STATUS_LABEL[m.status])}</span></div>`
      }</div>
      ${
        proc
          ? `<div class="ml-dr-note"><i data-lucide="loader"></i><div><b>${esc(stageLabel(m.stage) || "Processing")}</b>
              <div class="ml-bar ${m.progress == null ? "ind" : ""}"><i style="width:${m.progress == null ? 40 : m.progress}%"></i></div></div></div>`
          : ""
      }
      ${
        m.status === "failed"
          ? `<div class="ml-dr-note bad"><i data-lucide="alert-triangle"></i><div><b>Generation Failed</b><span>${esc(m.error || "Something went wrong.")}</span></div></div>`
          : ""
      }
      <div class="ml-dr-meta">
        <div><span>Status</span><b>${STATUS_LABEL[m.status] || m.status}</b></div>
        <div><span>Type</span><b>${g === "videos" ? "Listing Video" : g === "images" ? "Generated Image" : "Uploaded File"}</b></div>
        <div><span>Created</span><b>${esc(fmtDate(m.createdAt))}</b></div>
        ${m.duration ? `<div><span>Duration</span><b>${m.duration}s</b></div>` : ""}
        ${m.aspect && g === "videos" ? `<div><span>Format</span><b>${esc(m.aspect)}</b></div>` : ""}
        ${m.versions ? `<div><span>Versions</span><b>${m.versions}</b></div>` : ""}
      </div>
      ${srcUrl && !compare ? `<div class="ml-dr-sec"><b>Source Image</b><img src="${srcUrl}" alt="Source photo"></div>` : ""}
      ${
        g === "videos" && m.scenes && m.scenes.length
          ? `<div class="ml-dr-sec"><b>Scenes</b><ol class="ml-scenes">${m.scenes
              .map((s) => `<li>${esc(s.room_name || "Scene")} <em class="mono">${Number(s.duration || 0)}s</em></li>`)
              .join("")}</ol></div>`
          : ""
      }
      <div class="ml-dr-sec"><b>Settings</b><div class="ml-kv">${Object.entries(m.settings || {})
        .filter(([, v]) => v)
        .map(([k, v]) => `<span>${esc(k)}</span><em>${esc(v)}</em>`)
        .join("") || "<span>None recorded</span>"}</div></div>
      ${
        related.length
          ? `<div class="ml-dr-sec"><b>Related Assets</b><div class="ml-rel">${related
              .map((r) => `<button data-rel="${r.id}"><img data-photo="${esc(r.path || "")}" alt="${esc(r.title)}" hidden><span>${esc(r.title)}</span></button>`)
              .join("")}</div></div>`
          : ""
      }
      <div class="ml-dr-a">${drawerActions(m, g, proc)}</div>
    </div>
  </aside>`;
  paint();
  hydrateThumbs(d);
  d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeDrawer()));
  const bind = (sel, fn) => { const el = d.querySelector(sel); if (el) el.onclick = fn; };
  bind("[data-dld]", () => download(m));
  bind("[data-shr]", () => openVideo(m, "share"));
  bind("[data-arc]", async () => { closeDrawer(); await archive([m]); });
  bind("[data-edit-img]", () => { closeDrawer(); editImage(m); });
  bind("[data-mkvid]", () => { closeDrawer(); videoFrom([m]); });
  bind("[data-studio]", () => { closeDrawer(); S.go("studio"); });
  bind("[data-editvid]", () => { closeDrawer(); openVideo(m, "video"); });
  bind("[data-retry]", () => retry(m));
  bind("[data-cancel]", () => cancelItem(m));
  const more = d.querySelector("[data-more-dr]");
  if (more) more.onclick = (ev) => { ev.stopPropagation(); popMenu(more, moreItems(m)); };
  d.querySelectorAll("[data-rel]").forEach((b) => (b.onclick = () => openDetail(S.items.find((x) => x.id === b.dataset.rel))));
}

/** Primary actions in the drawer differ by asset type and status. */
function drawerActions(m, g, proc) {
  if (m.status === "failed")
    return `<button class="btn btn-primary btn-sm" data-retry><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-sm" data-more-dr><i data-lucide="more-horizontal"></i>More</button>`;
  if (proc)
    return `${m.job ? `<button class="btn btn-ghost btn-sm" data-cancel><i data-lucide="x"></i>Cancel</button>` : ""}
      <button class="btn btn-ghost btn-sm" data-more-dr><i data-lucide="more-horizontal"></i>More</button>`;
  if (g === "videos")
    return `<button class="btn btn-primary btn-sm" data-dld><i data-lucide="download"></i>Download</button>
      <button class="btn btn-ghost btn-sm" data-editvid><i data-lucide="pencil"></i>Edit Video</button>
      <button class="btn btn-ghost btn-sm" data-shr><i data-lucide="share-2"></i>Share</button>
      <button class="btn btn-ghost btn-sm" data-more-dr><i data-lucide="more-horizontal"></i>More</button>`;
  return `${canEditImage(m) ? `<button class="btn btn-primary btn-sm" data-edit-img><i data-lucide="sliders-horizontal"></i>Edit Image</button>` : ""}
    <button class="btn btn-${canEditImage(m) ? "ghost" : "primary"} btn-sm" data-mkvid><i data-lucide="clapperboard"></i>Create Video</button>
    <button class="btn btn-ghost btn-sm" data-studio><i data-lucide="wand-2"></i>Use In Studio</button>
    <button class="btn btn-ghost btn-sm" data-dld><i data-lucide="download"></i>Download</button>
    <button class="btn btn-ghost btn-sm" data-more-dr><i data-lucide="more-horizontal"></i>More</button>`;
}


export default mountMediaLibrary;
