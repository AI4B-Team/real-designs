// Property detail: everything that belongs to one address, in one place.
// Nothing here is a copy — each card is the same canonical record the Media
// library shows, filtered by property.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { loadMediaLibrary, onMediaChange, typeGroup, stageLabel } from "@/lib/media-library";
import { propertyBuckets } from "@/lib/media-view";
import { listPackages } from "@/lib/presentation-packages.functions";
import { resolvePhotoUrl } from "@/lib/room-photos";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};

const P = { propertyId: null, label: "", tab: "overview", items: [], packages: [], loading: true, off: null };

const TABS = [
  ["overview", "Overview", "layout-dashboard"],
  ["photos", "Photos", "image"],
  ["designs", "Designs", "wand-2"],
  ["videos", "Videos", "clapperboard"],
  ["presentations", "Presentations", "presentation"],
];

function host() {
  const view = document.getElementById("v-props");
  if (!view) return null;
  let el = document.getElementById("propDetail");
  if (!el) {
    const rooms = view.querySelector("#roomCards")?.closest(".card");
    if (!rooms || !rooms.parentElement) return null;
    el = document.createElement("div");
    el.id = "propDetail";
    el.className = "card pd";
    el.style.marginBottom = "16px";
    rooms.parentElement.insertBefore(el, rooms);
  }
  return el;
}

/** Called whenever the property tree selection changes. */
export function mountPropertyDetail(property) {
  const el = host();
  if (!el) return;
  const id = property && property.id ? property.id : null;
  const changed = id !== P.propertyId;
  P.propertyId = id;
  P.label = (property && property.address) || "";
  if (changed) P.tab = "overview";
  if (!P.off) P.off = onMediaChange(() => reload());
  render();
  if (changed || !P.items.length) reload();
}

async function reload() {
  if (!document.getElementById("propDetail")) return;
  try {
    const [items, packages] = await Promise.all([
      loadMediaLibrary().catch(() => []),
      listPackages().catch(() => []),
    ]);
    P.items = items || [];
    P.packages = packages || [];
  } catch (_) {
    P.items = [];
  }
  P.loading = false;
  render();
}

function pkgsForProperty() {
  return (P.packages || []).filter((p) => (p.property_id || null) === P.propertyId);
}

function render() {
  const el = document.getElementById("propDetail");
  if (!el) return;
  if (!P.propertyId) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const b = propertyBuckets(P.items, P.propertyId);
  const pk = pkgsForProperty();
  /* Presentations are saved work too: the headline total and the Overview
     badge count them, so the tabs never contradict the header. */
  const total = b.all.length + pk.length;
  const count = { overview: total, photos: b.photos.length, designs: b.designs.length, videos: b.videos.length, presentations: pk.length };

  el.innerHTML = `<div class="card-h">
      <div><h3>${esc(P.label || "This Property")}</h3>
        <div class="sub">${P.loading ? "Loading This Property&rsquo;s Work&hellip;" : total + (total === 1 ? " Item" : " Items") + " Saved To This Address"}</div></div>

    </div>
    <div class="pd-tabs" role="tablist">${TABS.map(
      ([k, label, icon]) =>
        `<button role="tab" class="${P.tab === k ? "on" : ""}" data-pt="${k}"><i data-lucide="${icon}"></i>${label}<em>${count[k] || 0}</em></button>`,
    ).join("")}</div>
    <div class="card-b pd-body">${body(b, pk)}</div>`;
  paint();
  el.querySelectorAll("[data-pt]").forEach((btn) => {
    btn.onclick = () => {
      P.tab = btn.dataset.pt;
      render();
    };
  });
  hydrate(el);
  el.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => {
      try {
        window.__rdGo && window.__rdGo(btn.dataset.go);
      } catch (_) {}
    };
  });
}

function body(b, pk) {
  if (P.loading) return `<p class="pd-note">Loading&hellip;</p>`;
  if (P.tab === "overview") return overview(b, pk);
  if (P.tab === "presentations")
    return pk.length
      ? `<div class="pd-list">${pk.map(pkgRow).join("")}</div>`
      : empty("presentation", "No Presentations Yet", "Package this property's designs and videos into a client-ready link.", "present", "Open Presentations");
  const list = P.tab === "photos" ? b.photos : P.tab === "designs" ? b.designs : b.videos;
  if (!list.length) {
    if (P.tab === "photos")
      return empty("image", "No Photos Yet", "Upload the property shoot and every photo lands here.", "media", "Open Media");
    if (P.tab === "designs")
      return empty("wand-2", "No Designs Yet", "Redesign a room from this property and it appears here.", "studio", "Open Studio");
    return empty("clapperboard", "No Videos Yet", "Turn this property's photos into a listing video.", "reveal", "Create A Video");
  }
  return `<div class="pd-grid">${list.map(tile).join("")}</div>`;
}

function overview(b, pk) {
  const stat = (n, label) => `<div class="pd-stat"><b>${n}</b><span>${label}</span></div>`;
  const recent = b.all.slice(0, 6);
  return `<div class="pd-stats">
      ${stat(b.photos.length, "Photos")}${stat(b.designs.length, "Designs")}${stat(b.videos.length, "Videos")}
      ${stat(pk.length, "Presentations")}${stat(b.drafts.length, "Drafts")}${stat(b.failed.length, "Needs Attention")}
    </div>
    ${b.working.length ? `<p class="pd-note">${b.working.length} Item${b.working.length === 1 ? " Is" : "s Are"} Still Processing.</p>` : ""}
    ${
      recent.length
        ? `<div class="pd-sub">Recent Work</div><div class="pd-grid">${recent.map(tile).join("")}</div>`
        : empty("images", "Nothing Saved Here Yet", "Photos, designs, videos and presentations for this address will collect here.", "media", "Open Media")
    }`;
}

function tile(m) {
  const g = typeGroup(m.type);
  const proc = m.status === "processing" || m.status === "queued";
  const inner = proc
    ? `<div class="pd-state"><i data-lucide="loader"></i><span>${esc(stageLabel(m.stage) || "Processing")}</span></div>`
    : m.status === "failed"
      ? `<div class="pd-state bad"><i data-lucide="alert-triangle"></i><span>Needs Attention</span></div>`
      : `<img data-photo="${esc(m.path || "")}" alt="${esc(m.title)}" hidden>${g === "videos" ? `<span class="pd-play"><i data-lucide="play"></i></span>` : ""}`;
  return `<figure class="pd-tile"><div class="pd-th">${inner}</div>
    <figcaption><b>${esc(m.title)}</b><span class="mono">${esc(
      m.draft
        ? m.draftTypeLabel || "Project"
        : m.room && m.room !== "Needs Review"
          ? m.room
          : g === "videos"
            ? "Video"
            : g === "images"
              ? "Design"
              : "Photo",
    )}${m.status === "draft" ? " &middot; Draft" : ""}</span></figcaption></figure>`;
}

function pkgRow(p) {
  return `<div class="pd-row"><i data-lucide="presentation"></i>
    <div><b>${esc(p.title || "Untitled Presentation")}</b>
      <span class="mono">${esc(p.client_name || "No Client Named")} &middot; ${esc(String(p.status || "draft"))}</span></div>
    <button class="btn btn-ghost btn-xs" data-go="present">Open</button></div>`;
}

function empty(icon, title, note, go, cta) {
  return `<div class="pd-empty"><i data-lucide="${icon}"></i><b>${esc(title)}</b><span>${esc(note)}</span>
    <button class="btn btn-primary btn-sm" data-go="${go}">${esc(cta)}</button></div>`;
}

async function hydrate(root) {
  root.querySelectorAll("[data-photo]").forEach(async (img) => {
    const p = img.getAttribute("data-photo");
    if (!p) return;
    const url = await resolvePhotoUrl(p);
    if (!url) return;
    img.src = url;
    img.hidden = false;
  });
}
