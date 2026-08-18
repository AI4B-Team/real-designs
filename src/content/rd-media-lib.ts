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
import { updateMediaAssets, deleteMediaAssets, listMediaProperties, createMediaProperty } from "@/lib/property-media.functions";
import { assignMediaToProperty } from "@/lib/media-assign.functions";
import { addressDisplay } from "@/lib/property-address";
import { openAddressModal } from "@/lib/address-modal";
import { suggestAddresses } from "@/lib/property-address.functions";
import { filterMedia, propertyOptions, assignKind, isAssignable, matchesTab, DRAFT_TYPE_LABEL } from "@/lib/media-view";
import { deleteProjectDraft } from "@/lib/drafts.functions";
import { setVideoStatus, deleteVideo, duplicateVideo, getVideo, saveVideo } from "@/lib/reveal.functions";
import { openVideoDetail, continueDesignVideo } from "@/content/rd-reveal";
import { openPhotoEditor } from "@/content/rd-photo-editor";
import { openPropertyUpload } from "@/content/rd-propmedia";
import { cancelJob } from "@/lib/upload-manager";
import { openMotionClip } from "@/lib/rd-motion-clip";
import { openSocialCopy } from "@/lib/rd-social-copy";
import { openBulkRestyle } from "@/lib/rd-bulk-restyle";
import { isPlanBlocked, openUpgrade as openUpgradeFlow } from "@/lib/rd-upgrade";


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
  prop: "all",
  propList: [],
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
const TABS = [
  ["all", "All"],
  ["images", "Images"],
  ["videos", "Videos"],
  ["drafts", "Drafts"],
  ["processing", "Processing"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["unassigned", "Unassigned"],
];

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
    ${TABS.map(([k, label]) => `<button class="${k === "all" ? "on" : ""}" data-t="${k}" role="tab">${label} <em id="mlc-${k}"></em></button>`).join("")}
  </div>

  <div class="ml-bar">
    <label class="ml-search"><i data-lucide="search"></i><input id="mlQ" placeholder="Search property, project, room or filename"></label>
    <label class="ml-sel"><span class="sr-only">Property</span><select id="mlProp">
      <option value="all">All Properties</option>
      <option value="none">Unassigned</option>
    </select></label>
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
    <button class="btn btn-ghost btn-xs" id="mlAll" hidden><i data-lucide="list-checks"></i>Select All</button>
  </div>

  <div class="ml-bulk" id="mlBulk">
    <span id="mlSelCount">0 Selected</span>
    <button class="btn btn-primary btn-xs" data-b="video" id="mlBulkVideo"><i data-lucide="clapperboard"></i>Create Video</button>
    <button class="btn btn-ghost btn-xs" data-b="restyle" id="mlBulkRestyle"><i data-lucide="wand-2"></i>Redesign</button>
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

let MENU_WIRED = false;

function bind(view) {
  const $ = (id) => view.querySelector("#" + id);
  const menu = $("mlMenu");
  $("mlCreate").onclick = (e) => {
    e.stopPropagation();
    const on = !menu.classList.contains("on");
    menu.classList.toggle("on", on);
    $("mlCreate").setAttribute("aria-expanded", String(on));
  };
  if (!MENU_WIRED) {
    MENU_WIRED = true;
    document.addEventListener("click", (e) => {
      const m = document.getElementById("mlMenu");
      if (!m) return;
      if (!e.target.closest || !e.target.closest(".ml-create")) m.classList.remove("on");
    });
  }
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
  $("mlProp").onchange = (e) => {
    S.prop = e.target.value;
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
  $("mlAll").onclick = () => {
    const list = filtered();
    const all = list.length > 0 && list.every((m) => S.sel.has(m.id));
    if (all) list.forEach((m) => S.sel.delete(m.id));
    else list.forEach((m) => S.sel.add(m.id));
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
  try {
    S.propList = await listMediaProperties();
  } catch (_) {}
  S.loading = false;
  render();
}

function filtered() {
  return filterMedia(S.items, {
    tab: S.tab,
    status: S.status,
    property: S.prop,
    q: S.q,
    favOnly: S.favOnly,
    sort: S.sort,
    isFav,
  });
}

/** Keep the property picker in step with what actually exists. */
function paintPropFilter() {
  const sel = document.getElementById("mlProp");
  if (!sel) return;
  const { properties, unassigned } = propertyOptions(S.items, S.propList);
  const cur = S.prop;
  sel.innerHTML =
    `<option value="all">All Properties</option>` +
    `<option value="none">Unassigned${unassigned ? " (" + unassigned + ")" : ""}</option>` +
    properties.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}${p.count ? " (" + p.count + ")" : ""}</option>`).join("");
  sel.value = [...sel.options].some((o) => o.value === cur) ? cur : "all";
  S.prop = sel.value;
}


function counts() {
  const live = S.items.filter((m) => m.status !== "archived");
  const out = {};
  TABS.forEach(([k]) => (out[k] = live.filter((m) => matchesTab(m, k)).length));
  return out;
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
  paintPropFilter();
  const c = counts();
  TABS.forEach(([k]) => {
    const el = document.getElementById("mlc-" + k);
    if (el) el.textContent = String(c[k] || 0);
  });
  const bulk = document.getElementById("mlBulk");
  const allBtn = document.getElementById("mlAll") as HTMLButtonElement | null;
  if (allBtn) {
    allBtn.hidden = !S.selMode;
    const vis = filtered();
    const all = vis.length > 0 && vis.every((m) => S.sel.has(m.id));
    allBtn.textContent = all ? "Clear Selection" : "Select All";
    allBtn.classList.toggle("on", all);
  }
  if (bulk) {
    bulk.classList.toggle("on", S.selMode && S.sel.size > 0);
    const n = document.getElementById("mlSelCount");
    if (n) n.textContent = S.sel.size + " Selected";
    const bv = document.getElementById("mlBulkVideo");
    if (bv) bv.disabled = !selectedItems().some(videoReady);
    const br = document.getElementById("mlBulkRestyle");
    if (br) {
      const n2 = selectedItems().filter(canEditImage).length;
      br.disabled = n2 === 0;
      br.innerHTML = `<i data-lucide="wand-2"></i>Redesign${n2 > 1 ? " " + n2 : ""}`;
    }
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
      ? `${m.path ? `<img data-photo="${esc(m.path)}" alt="${esc(m.title)}"${THUMB_URLS.get(m.path) ? ` src="${esc(THUMB_URLS.get(m.path))}"` : " hidden"}>` : ""}
         <div class="ml-fail"><i data-lucide="alert-triangle"></i><b>Needs Attention</b><span>${esc(failReason(m))}</span></div>`

      : `<img data-photo="${esc(m.path || "")}" alt="${esc(m.title)}"${THUMB_URLS.get(m.path) ? ` src="${esc(THUMB_URLS.get(m.path))}"` : " hidden"}>
         ${g === "videos" ? `<span class="ml-play"><i data-lucide="play"></i></span>` : ""}`;
  const badges =
    g === "videos" && !proc
      ? `<span class="ml-meta-b">${m.duration ? m.duration + "s" : "—"}</span><span class="ml-meta-b">${esc(m.aspect || "9:16")}</span>`
      : "";
  const cached = !!(m.path && THUMB_URLS.get(m.path));
  return `<div class="card ml-card${sel ? " sel" : ""}" data-card="${m.id}">
    <div class="ml-thumb${proc || m.status === "failed" || cached ? "" : " sk"}" data-thumb="${m.id}" role="button" tabindex="0" aria-label="Open ${esc(m.title)}">${thumb}
      <span class="ml-type"><i data-lucide="${TYPE_ICON[m.type] || "image"}"></i></span>
      ${badges ? `<div class="ml-badges">${badges}</div>` : ""}
      <div class="ml-ov">
        ${S.selMode ? `<button class="ml-ob${sel ? " on" : ""}" data-pick="${m.id}" aria-label="Select"><i data-lucide="${sel ? "check" : "square"}"></i></button>` : ""}
        <button class="ml-ob${isFav(m.id) ? " fav" : ""}" data-fav="${m.id}" aria-label="Favorite"><i data-lucide="heart"></i></button>
      </div>
    </div>
    <div class="ml-body">
      <div class="ml-t"><b>${esc(m.title)}</b><span class="pill st-${m.status}">${STATUS_LABEL[m.status] || m.status}</span></div>
      <div class="mono ml-sub">${esc(addressDisplay({ property_address: m.address, property_label: m.property, property_id: m.propertyId }).text)}${m.room && m.room !== "Needs Review" ? " &middot; " + esc(m.room) : ""} &middot; ${esc(fmtDate(m.updatedAt || m.createdAt))}${m.room === "Needs Review" ? ` <span class="ml-unsorted">Needs Sorting</span>` : ""}</div>
      ${m.draft ? `<div class="mono ml-sub">${esc(m.draftTypeLabel || DRAFT_TYPE_LABEL[m.draftType] || "Project")}${m.photoCount ? " &middot; " + m.photoCount + " Photo" + (m.photoCount === 1 ? "" : "s") : ""} &middot; Last Edited ${esc(fmtDate(m.updatedAt || m.createdAt))}</div>` : ""}
      <div class="ml-acts">${actions(m, g)}</div>
    </div>
  </div>`;
}

/* ---------------- action model ---------------- */

const READY = (m) => ["ready", "shared", "draft"].includes(m.status);
const videoReady = (m) => READY(m) && typeGroup(m.type) !== "videos" && !!m.path;
const canEditImage = (m) => m.type === "uploaded_image" && !m.job && !!m.refId && READY(m);
const selectedItems = () => S.items.filter((m) => S.sel.has(m.id));

const planBlocked = (m) => isPlanBlocked((m && m.error) || "");

/** What actually happened, in the user's terms. Never a generic paywall line. */
function failReason(m) {
  const raw = String((m && m.error) || "").trim();
  if (planBlocked(m))
    return typeGroup(m.type) === "videos"
      ? "Not Enough Credits To Render This Video. Nothing Was Charged."
      : "Not Enough Credits For This Generation. Nothing Was Charged.";
  return raw || "The Render Did Not Finish. Try Again.";
}


function openUpgrade(m) {
  const msg = String((m && m.error) || "") || "This action needs a paid plan.";
  if (typeof (window as any).rdUpgradeModal === "function") { openUpgradeFlow(msg); return; }
  S.go("billing");
}

function actions(m, g) {
  if (m.status === "failed" && planBlocked(m))
    return `<button class="btn btn-primary btn-xs" data-upg="${m.id}" style="flex:1"><i data-lucide="zap"></i>Add Credits</button>
      <button class="btn btn-ghost btn-xs" data-retry="${m.id}"><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;
  if (m.status === "failed")
    return `<button class="btn btn-ghost btn-xs" data-retry="${m.id}" style="flex:1"><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;

  if (m.status === "processing" || m.status === "queued")
    return `<button class="btn btn-ghost btn-xs" data-open="${m.id}" style="flex:1">Open Details</button>
      ${m.job ? `<button class="btn btn-ghost btn-xs" data-cancel="${m.id}">Cancel</button>` : ""}`;
  if (m.draft)
    return `<button class="btn btn-primary btn-xs" data-cont="${m.id}" style="flex:1"><i data-lucide="play"></i>Continue Editing</button>
      <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;
  if (m.status === "draft" && g === "videos")
    return `<button class="btn btn-primary btn-xs" data-cont="${m.id}" style="flex:1"><i data-lucide="play"></i>Continue</button>
      <button class="btn btn-ghost btn-xs" data-more="${m.id}" title="More Actions" aria-label="More Actions"><i data-lucide="more-horizontal"></i></button>`;
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
      ...(planBlocked(m) ? [{ icon: "zap", label: "Add Credits", fn: () => openUpgrade(m) }] : []),
      { icon: "sliders-horizontal", label: "Edit Settings", fn: () => editSettings(m) },
      { icon: "trash-2", label: "Delete", danger: true, fn: () => del(m) },
    ];

  if (g === "videos")
    return [
      { icon: "pencil", label: "Edit Video", fn: () => openVideo(m, "video") },
      { icon: "copy", label: "Duplicate", fn: () => dupVideo(m, false) },
      { icon: "scissors", label: "Create Short Version", fn: () => dupVideo(m, true) },
      { icon: "ratio", label: "Change Format", fn: () => openVideo(m, "video") },
      { icon: "presentation", label: "Add To Presentation", fn: () => S.go("present") },
      { icon: "message-square-quote", label: "Write Social Caption", fn: () => socialCopy(m) },
      { icon: "type", label: "Rename", fn: () => renameItem(m) },
      fav,
      { icon: "archive", label: "Archive", fn: () => archive([m]) },
      { icon: "trash-2", label: "Delete", danger: true, fn: () => del(m) },
    ];
  const out = [];
  if (canEditImage(m)) out.push({ icon: "sliders-horizontal", label: "Edit Image", fn: () => editImage(m) });
  if (m.draft || isDesignDraft(m)) out.push({ icon: "pencil", label: "Continue Editing", fn: () => continueProject(m) });
  if (canEditImage(m)) out.push({ icon: "wand-2", label: "Redesign In A Style", fn: () => restyleFrom([m]) });
  out.push({ icon: "clapperboard", label: "Create Video", fn: () => videoFrom([m]) });
  if (videoReady(m)) out.push({ icon: "film", label: "Create Motion Clip", fn: () => motionClip(m) });
  out.push({ icon: "wand-2", label: g === "uploads" ? "Create A Design" : "Use In Studio", fn: () => S.go("studio") });
  if (g === "images") out.push({ icon: "layers", label: "Create Variations", fn: () => S.go("studio") });
  if (m.sourcePath) out.push({ icon: "columns-2", label: "Compare With Source", fn: () => openDetail(m, { compare: true }) });
  if (isAssignable(m))
    out.push({ icon: "home", label: m.propertyId ? "Move To Another Property" : "Assign To A Property", fn: () => openAssign([m]) });
  if (isAssignable(m) && m.propertyId)
    out.push({ icon: "unlink", label: "Remove From Property", fn: () => doAssign([m], null) });
  if (m.type === "generated_video")
    out.push({ icon: "map-pin", label: m.address ? "Change Address" : "Add An Address", fn: () => changeAddress(m) });
  out.push({ icon: "layout-grid", label: "Add To Design", fn: () => S.go("designs") });
  out.push({ icon: "presentation", label: "Add To Presentation", fn: () => S.go("present") });
  out.push({ icon: "message-square-quote", label: "Write Social Caption", fn: () => socialCopy(m) });
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
    if (e.key !== "Escape") return;
    if (POP) {
      closePop();
      return;
    }
    const d = document.getElementById("mlDrawer");
    if (d && !d.hidden) closeDrawer();
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

/* Signed thumbnail URLs are cached per storage path so re-rendering the grid
   (typing in search, toggling a filter) repaints instantly instead of blanking
   every tile back to its skeleton while new URLs are fetched. */
const THUMB_URLS = new Map<string, string>();

async function hydrateThumbs(root) {
  root.querySelectorAll("[data-photo]").forEach(async (img) => {
    const done = () => img.closest(".ml-thumb")?.classList.remove("sk");
    const p = img.getAttribute("data-photo");
    if (!p) return done();
    if (THUMB_URLS.has(p)) { if (!img.src) { img.src = THUMB_URLS.get(p); img.hidden = false; } return done(); }
    const url = await resolvePhotoUrl(p);
    if (!url) return done();
    THUMB_URLS.set(p, url);
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
  grid.querySelectorAll("[data-upg]").forEach((b) => (b.onclick = () => openUpgrade(find(b.dataset.upg))));
  grid.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = () => cancelItem(find(b.dataset.cancel))));
  grid.querySelectorAll("[data-cont]").forEach((b) => (b.onclick = () => continueProject(find(b.dataset.cont))));
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
  openVideoWorkflow({
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

/** Apply one style to many uploaded photos at once, one credit each. */
function restyleFrom(items) {
  const usable = items.filter(canEditImage);
  if (!usable.length) {
    toast("Select Uploaded Photos To Redesign Them In Bulk.");
    return;
  }
  openBulkRestyle({
    items: usable.map((m) => ({
      id: m.id,
      assetId: m.refId,
      title: m.title,
      path: m.assetPath || m.path,
      room: m.room || null,
    })),
    toast,
    onDone: () => load(true),
  });
}

/** One photo becomes a short cinematic clip, no builder required. */
function motionClip(m) {
  if (!videoReady(m)) {
    toast("Pick A Ready Image To Create A Motion Clip.");
    return;
  }
  openMotionClip({
    title: m.title,
    path: m.assetPath || m.path,
    propertyLabel: m.property || null,
    room: m.room && m.room !== "Needs Review" ? m.room : null,
    toast,
    onDone: () => load(true),
  });
}

/** AI caption and hashtags for any asset, text only and free. */
function socialCopy(m) {
  openSocialCopy({
    title: m.title,
    room: m.room && m.room !== "Needs Review" ? m.room : null,
    style: m.style || null,
    propertyLabel: m.property || null,
    kind: typeGroup(m.type) === "videos" ? "video" : "image",
  });
}

/* Any unfinished video reopens in the unified builder rather than a detail
   page that has nothing to play yet. */
function isDesignDraft(m) {
  return m && m.type === "generated_video" && m.status === "draft";
}


/** Reopen a durable draft in the builder that owns it. */
function continueProject(m) {
  if (!m) return;
  if (!m.draft) return openVideo(m);
  if (m.draftType === "photo_staging") {
    const st = (window as any).rdStaging;
    if (st && st.resume) {
      st.resume(m.draftId).then((ok) => {
        if (!ok) toast("That project could not be reopened. Its photos may have been removed.");
      });
      return;
    }
    S.go("staging");
    return;
  }
  if (m.draftType === "photo_redesign") {
    try { (window as any).__rdStudioDraft = m.draftId; } catch (_) {}
    S.go("studio");
    return;
  }
  openVideo(m);
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

/** Edit the optional property address on a video project.
    Uses the shared address modal: no native prompt, title untouched. */
async function changeAddress(m) {
  openAddressModal({
    address: m.address || "",
    propertyId: m.propertyId || null,
    properties: S.propList || [],
    subtitle: "Optional. Changing the address never renames your project.",
    suggest: async (q) => {
      try {
        const res = await suggestAddresses({ data: { q } });
        return (res && res.suggestions) || [];
      } catch (_) {
        return (S.propList || []).filter((p) => !q || String(p.address || "").toLowerCase().includes(String(q).toLowerCase()));
      }
    },
    onSave: async (r) => {
      const cur = await getVideo({ data: { id: m.refId } });
      const project = {};
      PROJECT_KEYS.forEach((k) => {
        if (cur.project[k] !== null && cur.project[k] !== undefined) project[k] = cur.project[k];
      });
      /* Title is a separate field and is never derived from the address here. */
      project.property_address = r.columns.property_address;
      project.normalized_address = r.columns.normalized_address;
      project.address_source = r.columns.address_source;
      if (r.assignmentChanged) project.property_id = r.propertyId;
      await saveVideo({ data: { project } });
      /* Assignment moves the record into the property's tab, or back to
         Unassigned — the draft and its media are never deleted. */
      if (r.assignmentChanged && isAssignable(m)) {
        await assignMediaToProperty({ data: { items: [{ kind: assignKind(m), id: m.refId }], property_id: r.propertyId || null } });
      }
    },
    onDone: async (r) => {
      toast(r.address ? "Address Saved." : "Address Removed.");
      await load(true);
      emitMediaChange();
    },
  });
}

/**
 * Deleting a project and deleting a single asset are different actions, so the
 * confirmation says exactly which one is about to happen.
 */
async function del(m) {
  if (!m) return;
  if (m.draft && m.draftId) {
    const label = m.draftTypeLabel || DRAFT_TYPE_LABEL[m.draftType] || "Project";
    const msg =
      "Delete the whole project “" +
      m.title +
      "” (" +
      label +
      ")?\n\nThis removes the project and its saved progress. Photos already uploaded to this account stay in Media.";
    if (!window.confirm(msg)) return;
    try {
      await deleteProjectDraft({ data: { id: m.draftId } });
      if (m.videoProjectId) await deleteVideo({ data: { id: m.videoProjectId } });
    } catch (e) {
      window.alert("Could not delete this project: " + (e && e.message ? e.message : "try again"));
      return;
    }
    closeDrawer();
    await load(true);
    return;
  }
  const what = m.type === "generated_video" ? "video" : m.type === "generated_image" ? "design" : "photo";
  if (!window.confirm("Delete this " + what + ", “" + m.title + "”? Only this one file is deleted. This cannot be undone.")) return;
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
  if (m.type === "generated_video") {
    if (m.refId) return openVideo(m, "video");
    toast("This Video Draft Is No Longer Available. Create A New Video To Try Again.");
    return;
  }
  if (m.job) return openPropertyUpload({ propertyId: m.propertyId || m.job.propertyId || null });
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
  if (action === "restyle") return restyleFrom(list);
  if (action === "prop") return openAssign(list);
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
    <div class="ml-dr-h"><div><b>${esc(m.title)}</b><span class="mono">${esc(m.property || "Unsorted Uploads")}${m.room && m.room !== "Needs Review" ? " &middot; " + esc(m.room) : ""}${m.room === "Needs Review" ? ` <span class="ml-unsorted">Needs Sorting</span>` : ""}</span></div>
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
          ? `<div class="ml-dr-note bad"><i data-lucide="alert-triangle"></i><div><b>${planBlocked(m) ? "Not Enough Credits" : "Render Failed"}</b><span>${esc(failReason(m))}</span></div></div>`
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
  bind("[data-upg]", () => openUpgrade(m));
  bind("[data-cancel]", () => cancelItem(m));
  const more = d.querySelector("[data-more-dr]");
  if (more) more.onclick = (ev) => { ev.stopPropagation(); popMenu(more, moreItems(m)); };
  d.querySelectorAll("[data-rel]").forEach((b) => (b.onclick = () => openDetail(S.items.find((x) => x.id === b.dataset.rel))));
}

/** Primary actions in the drawer differ by asset type and status. */
function drawerActions(m, g, proc) {
  if (m.status === "failed" && planBlocked(m))
    return `<button class="btn btn-primary btn-sm" data-upg><i data-lucide="zap"></i>Add Credits</button>
      <button class="btn btn-ghost btn-sm" data-retry><i data-lucide="rotate-ccw"></i>Retry</button>
      <button class="btn btn-ghost btn-sm" data-more-dr><i data-lucide="more-horizontal"></i>More</button>`;

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


/* ---------------- assign to a property ---------------- */

/** Point records at a property (or clear it). One row, no copies. */
async function doAssign(items, propertyId) {
  const payload = (items || [])
    .map((m) => ({ kind: assignKind(m), id: m.refId, m }))
    .filter((x) => x.kind && x.id);
  const skipped = (items || []).length - payload.length;
  if (!payload.length) {
    toast("Designs Follow Their Room's Property. Move The Project Instead.");
    return;
  }
  try {
    await assignMediaToProperty({ data: { items: payload.map(({ kind, id }) => ({ kind, id })), property_id: propertyId || null } });
  } catch (e) {
    window.alert("Could not update: " + (e && e.message ? e.message : "try again"));
    return;
  }
  toast(
    (propertyId ? "Moved " : "Removed From Property: ") + payload.length + " Item" + (payload.length === 1 ? "" : "s") +
      (skipped ? " · " + skipped + " Design" + (skipped === 1 ? "" : "s") + " Skipped" : ""),
  );
  S.sel.clear();
  await load(true);
  emitMediaChange();
}

function openAssign(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return;
  const usable = list.filter(isAssignable);
  const host = document.createElement("div");
  host.className = "ml-assign";
  host.innerHTML = `<div class="ml-assign-bg" data-x></div>
    <div class="ml-assign-w" role="dialog" aria-label="Assign To A Property">
      <h3>Assign To A Property</h3>
      <p>${usable.length} Item${usable.length === 1 ? "" : "s"} Will Move. Nothing Is Copied — The Same Record Shows In Media And Under The Property.</p>
      ${list.length !== usable.length ? `<p class="ml-assign-note">${list.length - usable.length} Design${list.length - usable.length === 1 ? "" : "s"} Stay With Their Room's Property.</p>` : ""}
      <label class="ml-assign-f"><span>Existing Property</span>
        <select id="maSel"><option value="">Choose A Property</option>${S.propList
          .map((p) => `<option value="${esc(p.id)}">${esc(p.address || "Untitled Property")}</option>`)
          .join("")}</select></label>
      <label class="ml-assign-f"><span>Or Add A New Address</span>
        <input id="maNew" placeholder="123 Main Street, Austin TX"></label>
      <div class="ml-assign-a">
        <button class="btn btn-ghost btn-sm" data-x>Cancel</button>
        <button class="btn btn-ghost btn-sm" id="maNone">Remove From Property</button>
        <button class="btn btn-primary btn-sm" id="maGo">Assign</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  paint();
  const close = () => host.remove();
  host.querySelectorAll("[data-x]").forEach((b) => (b.onclick = close));
  host.querySelector("#maNone").onclick = async () => {
    close();
    await doAssign(usable, null);
  };
  host.querySelector("#maGo").onclick = async () => {
    const sel = host.querySelector("#maSel").value;
    const fresh = String(host.querySelector("#maNew").value || "").trim();
    let id = sel;
    if (fresh) {
      try {
        const row = await createMediaProperty({ data: { address: fresh } });
        id = row && row.id;
        S.propList = await listMediaProperties();
      } catch (e) {
        window.alert("Could not add that property: " + (e && e.message ? e.message : "try again"));
        return;
      }
    }
    if (!id) {
      window.alert("Choose a property or type a new address.");
      return;
    }
    close();
    await doAssign(usable, id);
  };
}

export default mountMediaLibrary;
