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
import { openVideoDetail, createVideoFrom } from "@/content/rd-reveal";
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
      <p>All your uploaded and generated images, videos and project files in one place.</p>
    </div>
    <div class="ml-create">
      <button class="btn btn-primary btn-sm" id="mlCreate" aria-haspopup="true" aria-expanded="false"><i data-lucide="plus"></i>Create Media</button>
      <div class="ml-menu" id="mlMenu" role="menu">
        <button data-c="image" role="menuitem"><i data-lucide="wand-2"></i>Generate an Image</button>
        <button data-c="video" role="menuitem"><i data-lucide="clapperboard"></i>Create a Listing Video</button>
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
  view.querySelectorAll("#mlBulk [data-b]").forEach((b) => (b.onclick = () => bulk(b.dataset.b)));
}

/** Open the listing-video workflow without leaving a stale sidebar item. */
export function openVideoWorkflow(seed = {}) {
  try {
    (window as any).__rdAllowReveal && (window as any).__rdAllowReveal();
  } catch (_) {}
  createVideoFrom(seed);
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
      <button class="btn btn-primary btn-sm" data-e="image">Generate an Image</button></div>`;
  if (S.tab === "videos")
    return `<div class="ml-empty"><i data-lucide="clapperboard"></i><b>No Videos Yet</b><span>Turn a property shoot or a finished design into a listing video.</span>
      <button class="btn btn-primary btn-sm" data-e="video">Create a Listing Video</button></div>`;
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
    <div class="ml-thumb">${thumb}
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

function actions(m, g) {
  if (m.status === "failed")
    return `<button class="btn btn-ghost btn-xs" data-retry="${m.id}" style="flex:1"><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-xs" data-remove="${m.id}"><i data-lucide="trash-2"></i></button>`;
  if (m.status === "processing" || m.status === "queued")
    return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Details</button>`;
  if (g === "videos")
    return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1"><i data-lucide="play"></i>Play</button>
      <button class="btn btn-ghost btn-xs" data-edit="${m.id}" title="Edit"><i data-lucide="pencil"></i></button>
      <button class="btn btn-ghost btn-xs" data-dl="${m.id}" title="Download"><i data-lucide="download"></i></button>
      <button class="btn btn-ghost btn-xs" data-share="${m.id}" title="Share"><i data-lucide="share-2"></i></button>
      <button class="btn btn-ghost btn-xs" data-arch="${m.id}" title="Archive"><i data-lucide="archive"></i></button>`;
  if (g === "uploads")
    return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Open</button>
      <button class="btn btn-ghost btn-xs" data-studio="${m.id}" title="Use in Studio"><i data-lucide="wand-2"></i></button>
      <button class="btn btn-ghost btn-xs" data-dl="${m.id}" title="Download"><i data-lucide="download"></i></button>
      <button class="btn btn-ghost btn-xs" data-arch="${m.id}" title="Archive"><i data-lucide="archive"></i></button>`;
  return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Open</button>
    <button class="btn btn-ghost btn-xs" data-dl="${m.id}" title="Download"><i data-lucide="download"></i></button>
    <button class="btn btn-ghost btn-xs" data-pres="${m.id}" title="Add to Presentation"><i data-lucide="presentation"></i></button>
    <button class="btn btn-ghost btn-xs" data-arch="${m.id}" title="Archive"><i data-lucide="archive"></i></button>`;
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
    const p = img.getAttribute("data-photo");
    if (!p) return;
    const url = await resolvePhotoUrl(p);
    if (url) {
      img.src = url;
      img.hidden = false;
    }
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
  grid.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => {
    const m = find(b.dataset.edit);
    if (m) { try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {} openVideoDetail(m.refId, "video"); }
  }));
  grid.querySelectorAll("[data-share]").forEach((b) => (b.onclick = () => {
    const m = find(b.dataset.share);
    if (m) { try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {} openVideoDetail(m.refId, "share"); }
  }));
  grid.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => download(find(b.dataset.dl))));
  grid.querySelectorAll("[data-arch]").forEach((b) => (b.onclick = () => archive([find(b.dataset.arch)])));
  grid.querySelectorAll("[data-pres]").forEach((b) => (b.onclick = () => S.go("present")));
  grid.querySelectorAll("[data-studio]").forEach((b) => (b.onclick = () => S.go("studio")));
  grid.querySelectorAll("[data-retry]").forEach((b) => (b.onclick = () => retry(find(b.dataset.retry))));
  grid.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => remove(find(b.dataset.remove))));
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

async function bulk(action) {
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
  if (action === "download") {
    for (const m of list) await download(m);
    return;
  }
  if (action === "archive") await archive(list);
}

/* ---------------- detail drawer ---------------- */

async function openDetail(m) {
  if (!m) return;
  const d = document.getElementById("mlDrawer");
  if (!d) return;
  const g = typeGroup(m.type);
  const related = S.items.filter((x) => x.id !== m.id && x.property && x.property === m.property).slice(0, 6);
  const url = await resolvePhotoUrl(m.assetPath || m.path);
  const srcUrl = m.sourcePath ? await resolvePhotoUrl(m.sourcePath) : null;
  d.hidden = false;
  d.innerHTML = `<div class="ml-dr-bg" data-close></div>
  <aside class="ml-dr" role="dialog" aria-label="${esc(m.title)}">
    <div class="ml-dr-h"><div><b>${esc(m.title)}</b><span class="mono">${esc(m.property || "Unassigned")}${m.room ? " &middot; " + esc(m.room) : ""}</span></div>
      <button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="ml-dr-b">
      <div class="ml-dr-prev">${
        g === "videos" && m.assetPath && url
          ? `<video src="${url}" controls playsinline style="width:100%;border-radius:10px"></video>`
          : url
            ? `<img src="${url}" alt="${esc(m.title)}">`
            : `<div class="ml-proc"><i data-lucide="loader"></i><span>${esc(stageLabel(m.stage) || STATUS_LABEL[m.status])}</span></div>`
      }</div>
      <div class="ml-dr-meta">
        <div><span>Status</span><b>${STATUS_LABEL[m.status] || m.status}</b></div>
        <div><span>Type</span><b>${g === "videos" ? "Listing Video" : g === "images" ? "Generated Image" : "Uploaded File"}</b></div>
        <div><span>Created</span><b>${esc(fmtDate(m.createdAt))}</b></div>
        ${m.duration ? `<div><span>Duration</span><b>${m.duration}s</b></div>` : ""}
        ${m.aspect && g === "videos" ? `<div><span>Format</span><b>${esc(m.aspect)}</b></div>` : ""}
        ${m.versions ? `<div><span>Versions</span><b>${m.versions}</b></div>` : ""}
      </div>
      ${
        srcUrl
          ? `<div class="ml-dr-sec"><b>Source Image</b><img src="${srcUrl}" alt="Source photo"></div>`
          : ""
      }
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
      <div class="ml-dr-a">
        <button class="btn btn-primary btn-sm" data-dld><i data-lucide="download"></i>Download</button>
        ${g === "videos" ? `<button class="btn btn-ghost btn-sm" data-shr><i data-lucide="share-2"></i>Share</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-arc><i data-lucide="archive"></i>Archive</button>
      </div>
    </div>
  </aside>`;
  paint();
  hydrateThumbs(d);
  d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => { d.hidden = true; d.innerHTML = ""; }));
  const dl = d.querySelector("[data-dld]");
  if (dl) dl.onclick = () => download(m);
  const sh = d.querySelector("[data-shr]");
  if (sh) sh.onclick = () => { try { (window as any).__rdAllowReveal && (window as any).__rdAllowReveal(); } catch (_) {} openVideoDetail(m.refId, "share"); };
  const ar = d.querySelector("[data-arc]");
  if (ar) ar.onclick = async () => { d.hidden = true; d.innerHTML = ""; await archive([m]); };
  d.querySelectorAll("[data-rel]").forEach((b) => (b.onclick = () => openDetail(S.items.find((x) => x.id === b.dataset.rel))));
}

export default mountMediaLibrary;
