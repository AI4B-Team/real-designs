// Complete Property Upload, background upload manager and the property media
// review screen. This extends the existing Properties / Listing Batch systems:
// assets attach to the same property rows, enhanced media stays in Media and
// design generations stay labeled and linked back to their source photo.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { roomPhotoUrl } from "@/lib/room-photos";
import {
  listMediaAssets,
  listMediaProperties,
  createMediaProperty,
  updateMediaAssets,
  deleteMediaAssets,
  addMediaVersion,
  listExportPackages,
} from "@/lib/property-media.functions";
import { runPhotoEdit } from "@/lib/photo-edit.functions";
import { uploadRenderDataUrl } from "@/lib/room-photos";
import * as UM from "@/lib/upload-manager";
import { ROOM_GROUPS, FLAG_LABEL, recommendations, similarTo, missingSpaces, pickRecommended } from "@/lib/media-analysis";
import { openPhotoEditor, openExportDialog } from "@/content/rd-photo-editor";
import { track } from "@/lib/analytics";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};

let STATE = {
  propertyId: null,
  propertyLabel: "All Properties",
  assets: [],
  versions: [],
  exports: [],
  properties: [],
  tab: "all",
  room: "",
  selected: new Set(),
  loading: false,
};

/* =======================================================================
   UPLOAD MODAL
   ======================================================================= */

export async function openPropertyUpload(opts = {}) {
  const wrap = hostEl("pmu-wrap");
  wrap.classList.add("on");
  document.body.style.overflow = "hidden";
  let props = [];
  try {
    props = await listMediaProperties();
  } catch (_) {}
  let mode = opts.propertyId ? "existing" : props.length ? "existing" : "new";
  let propertyId = opts.propertyId || (props[0] ? props[0].id : null);
  let files = [];
  let rejected = [];

  function render() {
    wrap.innerHTML = `<div class="pmu" role="dialog" aria-label="Upload property photos">
      <div class="pmu-h">
        <div><b>Upload Property Photos</b><span>Upload the full photo set for one property. We'll automatically organize the images by room and angle.</span></div>
        <button class="icon-btn" id="pmuClose" aria-label="Close upload"><i data-lucide="x"></i></button>
      </div>
      <div class="pmu-b">
        <div class="pmu-col">
          <div class="pmu-lab">Property</div>
          <div class="pmu-seg" role="group" aria-label="Property choice">
            <button data-m="existing" class="${mode === "existing" ? "on" : ""}" ${props.length ? "" : "disabled"}>Existing Property</button>
            <button data-m="new" class="${mode === "new" ? "on" : ""}">Create New Property</button>
            <button data-m="none" class="${mode === "none" ? "on" : ""}">Add Address Later</button>
          </div>
          ${
            mode === "existing"
              ? `<label class="pmu-f">Select Property<select id="pmuProp">${props
                  .map((p) => `<option value="${p.id}" ${p.id === propertyId ? "selected" : ""}>${esc(p.address)}</option>`)
                  .join("")}</select></label>`
              : mode === "new"
                ? `<label class="pmu-f">Address<input id="pmuAddr" placeholder="123 Main St, Tampa FL"></label>`
                : `<p class="pmu-note">Photos upload into an unassigned set. You can attach them to a property later from Media.</p>`
          }
          <details class="pmu-more"><summary>Optional Property Details</summary>
            <div class="pmu-grid">
              <label>Property Name<input id="pmuName" placeholder="Riverwalk Listing"></label>
              <label>Property Type<select id="pmuType"><option>Single Family</option><option>Condo</option><option>Townhome</option><option>Multi Family</option><option>Land</option><option>Commercial</option></select></label>
              <label>Listing Status<select id="pmuStatus"><option>Pre Listing</option><option>Active</option><option>Coming Soon</option><option>Pending</option><option>Sold</option></select></label>
              <label>Bedrooms<input id="pmuBeds" type="number" min="0" max="30"></label>
              <label>Bathrooms<input id="pmuBaths" type="number" min="0" max="30" step="0.5"></label>
              <label>Square Footage<input id="pmuSqft" type="number" min="0"></label>
              <label>Project Purpose<select id="pmuPurpose"><option>Listing Media</option><option>Pre Listing Prep</option><option>Renovation Planning</option><option>Investor Analysis</option><option>Client Presentation</option></select></label>
              <label>Agent, Photographer Or Client<input id="pmuWho" placeholder="Who is this for"></label>
              <label class="pmu-wide">Internal Notes<textarea id="pmuNotes" rows="2"></textarea></label>
            </div>
          </details>
        </div>
        <div class="pmu-col">
          <div class="pmu-lab">Choose Photos</div>
          <div class="pmu-src">
            <button class="pmu-s on" id="pmuPick"><i data-lucide="monitor"></i>Computer</button>
            <button class="pmu-s" disabled title="Planned"><i data-lucide="hard-drive"></i>Google Drive<em>Planned</em></button>
            <button class="pmu-s" disabled title="Planned"><i data-lucide="cloud"></i>Dropbox<em>Planned</em></button>
          </div>
          <div class="pmu-drop" id="pmuDrop" tabindex="0" role="button" aria-label="Drag photos here or press Enter to browse">
            <i data-lucide="upload-cloud"></i>
            <b>Drag and drop the property photos here</b>
            <span>JPG, JPEG, PNG, HEIC or WEBP &middot; Up to ${UM.MAX_FILE_MB} MB per image</span>
          </div>
          <input type="file" id="pmuFiles" multiple accept="${UM.ACCEPT_ATTR}" hidden>
          <div class="pmu-files" id="pmuList"></div>
          <div class="pmu-act">
            <button class="btn btn-primary" id="pmuStart" ${files.length ? "" : "disabled"}><i data-lucide="upload"></i>Upload Photos${files.length ? ` (${files.length})` : ""}</button>
            <button class="btn btn-ghost" id="pmuCancel">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;
    paint();
    wrap.querySelector("#pmuClose").onclick = close;
    wrap.querySelector("#pmuCancel").onclick = close;
    wrap.querySelectorAll(".pmu-seg button").forEach((b) => {
      b.onclick = () => {
        mode = b.dataset.m;
        render();
      };
    });
    const sel = wrap.querySelector("#pmuProp");
    sel && (sel.onchange = () => (propertyId = sel.value));
    const input = wrap.querySelector("#pmuFiles");
    const pick = () => input.click();
    wrap.querySelector("#pmuPick").onclick = pick;
    const drop = wrap.querySelector("#pmuDrop");
    drop.onclick = pick;
    drop.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick();
      }
    };
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("over");
      }),
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("over");
      }),
    );
    drop.addEventListener("drop", (e) => take(Array.from(e.dataTransfer.files || [])));
    input.onchange = () => take(Array.from(input.files || []));
    wrap.querySelector("#pmuStart").onclick = start;
    renderList();
  }

  function take(incoming) {
    for (const f of incoming) {
      const bad = UM.rejectReason(f);
      if (bad) rejected.push({ name: f.name, reason: bad });
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) files.push(f);
    }
    render();
  }

  function renderList() {
    const l = wrap.querySelector("#pmuList");
    if (!l) return;
    if (!files.length && !rejected.length) {
      l.innerHTML = "";
      return;
    }
    l.innerHTML = `<div class="pmu-count"><b>${files.length} Photo${files.length === 1 ? "" : "s"} Ready</b>${
      rejected.length ? `<span class="pmu-bad">${rejected.length} Skipped</span>` : ""
    }</div>
    ${rejected
      .slice(0, 6)
      .map((r) => `<div class="pmu-badrow"><i data-lucide="triangle-alert"></i>${esc(r.name)} — ${esc(r.reason)}</div>`)
      .join("")}`;
    paint();
  }

  async function start() {
    let pid = null;
    let label = "Unassigned Media";
    if (mode === "existing") {
      pid = propertyId;
      label = (props.find((p) => p.id === pid) || {}).address || "Property";
    } else if (mode === "new") {
      const addr = (wrap.querySelector("#pmuAddr").value || "").trim();
      if (addr.length < 3) return alert("Enter the property address first.");
      try {
        const row = await createMediaProperty({ data: { address: addr } });
        pid = row.id;
        label = row.address;
      } catch (e) {
        return alert(e.message || "That property could not be created.");
      }
    }
    const name = wrap.querySelector("#pmuName");
    if (name && name.value.trim()) label = name.value.trim();
    try {
      const details = {};
      ["Type", "Status", "Beds", "Baths", "Sqft", "Purpose", "Who", "Notes"].forEach((k) => {
        const el = wrap.querySelector("#pmu" + k);
        if (el && el.value) details[k.toLowerCase()] = el.value;
      });
      localStorage.setItem("rd.propmeta." + (pid || "unassigned"), JSON.stringify({ label, ...details }));
    } catch (_) {}
    UM.startJob({ files, propertyId: pid, propertyLabel: label, source: "computer" });
    close();
    mountUploadDock();
  }

  function close() {
    wrap.classList.remove("on");
    wrap.innerHTML = "";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onEsc);
  }
  const onEsc = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onEsc);

  render();
}

function hostEl(cls) {
  let el = document.querySelector("." + cls);
  if (!el) {
    el = document.createElement("div");
    el.className = cls;
    (document.querySelector(".rd-app") || document.body).appendChild(el);
  }
  return el;
}

/* =======================================================================
   BACKGROUND UPLOAD DOCK
   ======================================================================= */

let dockBound = false;
export function mountUploadDock(go) {
  const dock = hostEl("pmd");
  if (!dockBound) {
    dockBound = true;
    UM.subscribe((jobs) => renderDock(dock, jobs, go));
  }
  renderDock(dock, UM.listJobs(), go);
}

const notified = new Set();

function renderDock(dock, jobs, go) {
  const live = jobs.filter((j) => j.state !== "Canceled" || j.finishedAt > Date.now() - 60000);
  if (!live.length) {
    dock.classList.remove("on");
    dock.innerHTML = "";
    return;
  }
  dock.classList.add("on");
  dock.innerHTML = live
    .slice(-3)
    .map((j) => {
      const total = j.files.length;
      const pct = total ? Math.round(((j.uploaded + j.failed) / total) * 100) : 0;
      const done = ["Complete", "Partially Complete", "Failed", "Canceled", "Interrupted"].includes(j.state);
      return `<div class="pmd-job" data-j="${j.id}">
      <div class="pmd-h"><b>${esc(j.propertyLabel)}</b><span class="pill ${j.state === "Complete" ? "p-grn" : j.state === "Failed" ? "p-red" : "p-amb"}">${esc(j.state)}</span></div>
      <div class="pmd-meta">${j.uploaded} Uploaded · ${Math.max(0, total - j.uploaded - j.failed)} Remaining${j.failed ? ` · ${j.failed} Failed` : ""} · ${total} File${total === 1 ? "" : "s"}</div>
      ${done ? "" : `<div class="pmd-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`}
      ${j.current && !done ? `<div class="pmd-cur">${esc(j.current)}</div>` : ""}
      ${j.state === "Interrupted" ? `<div class="pmd-cur">Upload was interrupted by a page reload. Photos already uploaded were kept — add the remaining files again.</div>` : ""}
      <div class="pmd-act">
        ${done ? "" : `<button class="fb-link" data-a="pause">Pause</button><button class="fb-link" data-a="resume">Resume</button><button class="fb-link" data-a="cancel">Cancel</button>`}
        ${j.failed ? `<button class="fb-link" data-a="retry">Retry Failed</button>` : ""}
        ${done ? `<button class="fb-link" data-a="review">Review Property</button><button class="fb-link" data-a="another">Start Another Upload</button><button class="fb-link" data-a="dismiss">Dismiss</button>` : ""}
      </div>
    </div>`;
    })
    .join("");
  dock.querySelectorAll(".pmd-job").forEach((el) => {
    const id = el.dataset.j;
    el.querySelectorAll("[data-a]").forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === "pause") UM.pauseAll();
        if (a === "resume") UM.resumeAll();
        if (a === "cancel") UM.cancelJob(id);
        if (a === "retry") UM.retryFailed(id);
        if (a === "dismiss") UM.dismissJob(id);
        if (a === "another") openPropertyUpload();
        if (a === "review") {
          const job = UM.listJobs().find((j) => j.id === id);
          STATE.propertyId = job ? job.propertyId : null;
          STATE.propertyLabel = job ? job.propertyLabel : "All Properties";
          (window.__rdGo || go || (() => {}))("media");
          load();
        }
      };
    });
  });
  live.forEach((j) => {
    if (["Complete", "Partially Complete"].includes(j.state) && !notified.has(j.id)) {
      notified.add(j.id);
      try {
        window.__rdToast && window.__rdToast("Property Upload Complete. Your photos are ready to review and organize.");
      } catch (_) {}
    }
  });
}

/* =======================================================================
   MEDIA REVIEW SCREEN
   ======================================================================= */

let goFn = (v) => {};
let mounted = false;

export function mountMedia(go, ctx = {}) {
  goFn = go;
  window.__rdGo = go;
  mountUploadDock(go);
  const view = document.getElementById("v-media");
  if (!view) return;
  if (!mounted) {
    mounted = true;
    view.innerHTML = shell();
    paint();
    bind(view);
  }
  load();
}

function shell() {
  return `<div class="pm">
  <div class="card pm-head">
    <div class="card-h">
      <div>
        <h3 id="pmTitle">Media</h3>
        <div class="sub" id="pmSub">All your uploaded and generated images, videos and project files in one place.</div>

      </div>
      <div class="pm-head-a">
        <label class="pm-pick"><span class="sr-only">Property</span><select id="pmProp"></select></label>
        <button class="btn btn-primary btn-xs" id="pmUpload"><i data-lucide="upload-cloud"></i>Upload Property Photos</button>
      </div>
    </div>
    <div class="card-b">
      <div class="pm-stats" id="pmStats"></div>
      <div class="pm-actions">
        <button class="btn btn-dark btn-xs" id="pmRecs"><i data-lucide="wand-2"></i>Review Recommendations</button>
        <button class="btn btn-ghost btn-xs" id="pmEdit"><i data-lucide="sliders-horizontal"></i>Edit Photos</button>
        <button class="btn btn-ghost btn-xs" id="pmListing"><i data-lucide="package"></i>Prepare Listing</button>
        <button class="btn btn-ghost btn-xs" id="pmMore"><i data-lucide="plus"></i>Add More Photos</button>
      </div>
      <div id="pmMissing"></div>
    </div>
  </div>

  <div id="pmPrepare"></div>

  <div class="pm-main">
    <aside class="card pm-rooms">
      <div class="card-h"><div><h3>Rooms And Spaces</h3><div class="sub">Grouped from the upload</div></div>
        <button class="icon-btn" id="pmNewRoom" aria-label="Create a custom group"><i data-lucide="folder-plus"></i></button></div>
      <div class="card-b" id="pmRoomList"></div>
    </aside>
    <div class="card pm-grid-card">
      <div class="card-h">
        <div class="pm-tabs" id="pmTabs" role="tablist">
          <button class="on" data-t="all" role="tab">All Photos</button>
          <button data-t="rec" role="tab">Recommended</button>
          <button data-t="review" role="tab">Needs Review</button>
          <button data-t="dupes" role="tab">Duplicates</button>
          <button data-t="quality" role="tab">Quality Issues</button>
          <button data-t="room" role="tab">By Room</button>
          <button data-t="hidden" role="tab">Hidden</button>
        </div>
      </div>
      <div class="pm-bulk" id="pmBulk"></div>
      <div class="card-b"><div class="pm-grid" id="pmGrid"></div></div>
    </div>
  </div>

  <div class="card pm-exports">
    <div class="card-h"><div><h3>Export Packages</h3><div class="sub">Listing packages built from approved versions</div></div>
      <button class="btn btn-ghost btn-xs" id="pmExport"><i data-lucide="download"></i>New Export</button></div>
    <div class="card-b" id="pmExportList"></div>
  </div>
</div>`;
}

function bind(view) {
  const $ = (id) => view.querySelector("#" + id);
  $("pmUpload").onclick = () => openPropertyUpload(STATE.propertyId ? { propertyId: STATE.propertyId } : {});
  $("pmMore").onclick = () => openPropertyUpload(STATE.propertyId ? { propertyId: STATE.propertyId } : {});
  $("pmProp").onchange = (e) => {
    const v = e.target.value;
    STATE.propertyId = v || null;
    const p = STATE.properties.find((x) => x.id === v);
    STATE.propertyLabel = p ? p.address : "All Properties";
    STATE.selected = new Set();
    load();
  };
  $("pmRecs").onclick = () => {
    renderPrepare(true);
    document.getElementById("pmPrepare").scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $("pmEdit").onclick = () => {
    const first = visible()[0];
    if (first) openEditor(first.id);
  };
  $("pmListing").onclick = () => openExport();
  $("pmExport").onclick = () => openExport();
  $("pmNewRoom").onclick = async () => {
    const name = prompt("Name the new group");
    if (!name) return;
    const ids = [...STATE.selected];
    if (!ids.length) return alert("Select the photos to move into the new group first.");
    await patch(ids, { room_group: name.slice(0, 60), room_confidence: 1 });
  };
  view.querySelectorAll("#pmTabs button").forEach((b) => {
    b.onclick = () => {
      STATE.tab = b.dataset.t;
      view.querySelectorAll("#pmTabs button").forEach((x) => x.classList.toggle("on", x === b));
      renderGrid();
      renderRooms();
    };
  });
}

async function load() {
  STATE.loading = true;
  renderStats();
  try {
    const [props, data, exps] = await Promise.all([
      listMediaProperties().catch(() => []),
      listMediaAssets({ data: { property_id: STATE.propertyId } }),
      listExportPackages({ data: { property_id: STATE.propertyId } }).catch(() => []),
    ]);
    STATE.properties = props;
    STATE.assets = data.assets;
    STATE.versions = data.versions;
    STATE.exports = exps;
  } catch (e) {
    STATE.assets = [];
  }
  STATE.loading = false;
  renderProps();
  renderStats();
  renderRooms();
  renderGrid();
  renderPrepare(false);
  renderExports();
}

function renderProps() {
  const sel = document.getElementById("pmProp");
  if (!sel) return;
  sel.innerHTML =
    `<option value="">All Properties</option>` +
    STATE.properties
      .map((p) => `<option value="${p.id}" ${p.id === STATE.propertyId ? "selected" : ""}>${esc(p.address)}</option>`)
      .join("");
  const t = document.getElementById("pmTitle");
  if (t) t.textContent = STATE.propertyId ? STATE.propertyLabel : "Media";

}

function rooms() {
  const map = new Map();
  STATE.assets.forEach((a) => map.set(a.room_group, (map.get(a.room_group) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderStats() {
  const el = document.getElementById("pmStats");
  if (!el) return;
  if (STATE.loading) {
    el.innerHTML = `<div class="pm-stat"><b>Loading</b><span>Reading Property Media</span></div>`;
    return;
  }
  const a = STATE.assets;
  const job = UM.activeJob();
  const visible = a.filter((x) => !x.hidden);
  const processing = job ? (job.files || []).filter((f) => f.state === "queued" || f.state === "uploading").length : 0;
  const needsReview = visible.filter((x) => x.room_group === "Needs Review" || (x.flags || []).length).length;
  const cells = [
    ["Total Media", visible.length],
    ["Needs Review", needsReview],
    ["Processing", processing],
    ["Ready", Math.max(0, visible.length - needsReview - processing)],
  ];
  el.innerHTML = cells.map(([k, v]) => `<div class="pm-stat"><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join("");

  const miss = document.getElementById("pmMissing");
  if (miss) {
    const m = missingSpaces(a);
    miss.innerHTML =
      a.length && m.length
        ? `<div class="note"><i data-lucide="info"></i><span>These spaces are not in this set yet: ${esc(m.join(", "))}. If the shoot is complete you can ignore this.</span></div>`
        : "";
    paint();
  }
}

function renderRooms() {
  const el = document.getElementById("pmRoomList");
  if (!el) return;
  const list = rooms();
  el.innerHTML = `<button class="pm-room${STATE.room ? "" : " on"}" data-r="">All Rooms<span>${STATE.assets.length}</span></button>${list
    .map(
      ([r, n]) =>
        `<button class="pm-room${STATE.room === r ? " on" : ""}" data-r="${esc(r)}">${esc(r)}<span>${n}</span></button>`,
    )
    .join("")}
  <div class="pm-room-tools">
    <button class="fb-link" data-t="rename">Rename Group</button>
    <button class="fb-link" data-t="merge">Merge Into</button>
    <button class="fb-link" data-t="move">Move Selected Here</button>
  </div>`;
  el.querySelectorAll(".pm-room").forEach((b) => {
    b.onclick = () => {
      STATE.room = b.dataset.r;
      if (STATE.room) STATE.tab = "room";
      document.querySelectorAll("#pmTabs button").forEach((x) => x.classList.toggle("on", x.dataset.t === STATE.tab));
      renderRooms();
      renderGrid();
    };
  });
  el.querySelectorAll("[data-t]").forEach((b) => {
    b.onclick = async () => {
      if (!STATE.room) return alert("Pick a group first.");
      const inRoom = STATE.assets.filter((a) => a.room_group === STATE.room).map((a) => a.id);
      if (b.dataset.t === "rename") {
        const n = prompt("Rename this group", STATE.room);
        if (n) await patch(inRoom, { room_group: n.slice(0, 60), room_confidence: 1 });
      } else if (b.dataset.t === "merge") {
        const n = prompt("Merge into which group?", "Living Room");
        if (n) await patch(inRoom, { room_group: n.slice(0, 60), room_confidence: 1 });
      } else {
        const ids = [...STATE.selected];
        if (!ids.length) return alert("Select photos first.");
        await patch(ids, { room_group: STATE.room, room_confidence: 1 });
      }
    };
  });
}

function visible() {
  const a = STATE.assets;
  switch (STATE.tab) {
    case "rec":
      return a.filter((x) => x.recommended && !x.hidden);
    case "review":
      return a.filter((x) => x.room_group === "Needs Review" && !x.hidden);
    case "dupes":
      return a.filter((x) => x.dup_group && !x.hidden);
    case "quality":
      return a.filter((x) => (x.flags || []).length && !x.hidden);
    case "hidden":
      return a.filter((x) => x.hidden);
    case "room":
      return a.filter((x) => !x.hidden && (!STATE.room || x.room_group === STATE.room));
    default:
      return a.filter((x) => !x.hidden);
  }
}

function versionsFor(id) {
  return STATE.versions.filter((v) => v.asset_id === id && !v.archived);
}

async function renderGrid() {
  const el = document.getElementById("pmGrid");
  if (!el) return;
  const list = visible();
  if (STATE.loading) {
    el.innerHTML = `<div class="pm-empty"><b>Loading Property Media</b></div>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="pm-empty">
      <b>${STATE.assets.length ? "Nothing In This Tab" : "No Property Media Yet"}</b>
      <span>${STATE.assets.length ? "Try another tab or clear the room filter." : "Upload a complete property shoot and we will organize it by room and angle."}</span>
      <button class="btn btn-primary btn-xs" id="pmEmptyUp"><i data-lucide="upload-cloud"></i>Upload Property Photos</button>
    </div>`;
    paint();
    const b = el.querySelector("#pmEmptyUp");
    b && (b.onclick = () => openPropertyUpload());
    renderBulk();
    return;
  }
  el.innerHTML = list
    .map((a) => {
      const vs = versionsFor(a.id);
      const flags = (a.flags || []).map((f) => FLAG_LABEL[f] || f);
      const low = a.room_confidence < 0.5;
      return `<div class="pm-card${STATE.selected.has(a.id) ? " sel" : ""}" data-id="${a.id}">
      <label class="pm-check"><input type="checkbox" ${STATE.selected.has(a.id) ? "checked" : ""} aria-label="Select ${esc(a.original_filename || a.room_group)}"><span></span></label>
      <div class="pm-thumb" data-p="${esc(a.storage_path)}" role="img" aria-label="${esc(a.room_group)} photo"></div>
      <div class="pm-card-b">
        <b>${esc(a.room_group)}${low ? " ?" : ""}</b>
        <div class="pm-tags">
          ${a.recommended ? `<span class="pill p-grn">Recommended</span>` : ""}
          ${a.hdr_group ? `<span class="pill p-gray">Bracket</span>` : ""}
          ${a.dup_group ? `<span class="pill p-gray">Duplicate</span>` : ""}
          ${vs.length ? `<span class="pill p-gray">${vs.length} Version${vs.length === 1 ? "" : "s"}</span>` : ""}
          ${a.modification_class !== "Unmodified Original" ? `<span class="pill p-amb">${esc(a.modification_class)}</span>` : ""}
          ${flags.length ? `<span class="pill p-amb">${esc(flags[0])}</span>` : ""}
        </div>
      </div>
      <div class="pm-card-a">
        <button class="icon-btn" data-a="edit" aria-label="Open in editor" title="Open In Editor"><i data-lucide="sliders-horizontal"></i></button>
        <button class="icon-btn" data-a="hide" aria-label="${a.hidden ? "Show in listing exports" : "Hide from listing exports"}" title="${a.hidden ? "Show" : "Hide"}"><i data-lucide="${a.hidden ? "eye" : "eye-off"}"></i></button>
        <button class="icon-btn" data-a="rec" aria-label="Toggle recommended" title="Recommended"><i data-lucide="star"></i></button>
      </div>
    </div>`;
    })
    .join("");
  paint();
  el.querySelectorAll(".pm-card").forEach((c) => {
    const id = c.dataset.id;
    c.querySelector("input").onchange = (e) => {
      e.target.checked ? STATE.selected.add(id) : STATE.selected.delete(id);
      c.classList.toggle("sel", e.target.checked);
      renderBulk();
    };
    c.querySelector('[data-a="edit"]').onclick = () => openEditor(id);
    c.querySelector('[data-a="hide"]').onclick = async () => {
      const a = STATE.assets.find((x) => x.id === id);
      await patch([id], { hidden: !a.hidden });
    };
    c.querySelector('[data-a="rec"]').onclick = async () => {
      const a = STATE.assets.find((x) => x.id === id);
      await patch([id], { recommended: !a.recommended });
    };
    c.querySelector(".pm-thumb").onclick = () => openEditor(id);
  });
  for (const t of el.querySelectorAll(".pm-thumb")) {
    const url = await roomPhotoUrl(t.dataset.p);
    if (url) t.style.backgroundImage = `url("${url}")`;
  }
  renderBulk();
}

function renderBulk() {
  const el = document.getElementById("pmBulk");
  if (!el) return;
  const n = STATE.selected.size;
  if (!n) {
    el.classList.remove("on");
    el.innerHTML = "";
    return;
  }
  el.classList.add("on");
  el.innerHTML = `<div class="pm-bulk-in" role="region" aria-label="Bulk actions">
    <b>${n} Selected</b>
    <label class="pm-bulk-room"><span class="sr-only">Assign room</span>
      <select id="pmAssign"><option value="">Assign Room</option>${ROOM_GROUPS.map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
    <button class="btn btn-ghost btn-xs" data-b="rec"><i data-lucide="star"></i>Mark Recommended</button>
    <button class="btn btn-ghost btn-xs" data-b="hide"><i data-lucide="eye-off"></i>Hide</button>
    <button class="btn btn-dark btn-xs" data-b="edit"><i data-lucide="wand-2"></i>Apply Edit</button>
    <button class="btn btn-ghost btn-xs" data-b="lvideo"><i data-lucide="clapperboard"></i>Create Listing Video</button>
    <button class="btn btn-ghost btn-xs" data-b="export"><i data-lucide="download"></i>Export Selected</button>
    <button class="btn btn-ghost btn-xs" data-b="del"><i data-lucide="trash-2"></i>Delete</button>
    <button class="fb-link" data-b="clear">Clear</button>
  </div>`;
  paint();
  el.querySelector("#pmAssign").onchange = async (e) => {
    if (!e.target.value) return;
    await patch([...STATE.selected], { room_group: e.target.value, room_confidence: 1 });
    track("room_assignment_changed", { count: n });
  };
  el.querySelectorAll("[data-b]").forEach((b) => {
    b.onclick = async () => {
      const ids = [...STATE.selected];
      const k = b.dataset.b;
      if (k === "clear") {
        STATE.selected = new Set();
        renderGrid();
      } else if (k === "rec") await patch(ids, { recommended: true });
      else if (k === "hide") await patch(ids, { hidden: true });
      else if (k === "edit") openScope({ ids, label: null, op: null, family: "property" });
      else if (k === "lvideo") { try { window.rdListingVideo({ propertyId: STATE.propertyId, propertyLabel: STATE.propertyLabel, assets: STATE.assets.filter((a) => ids.includes(a.id)), from: "media" }); } catch (_) {} }
      else if (k === "export") openExport(ids);
      else if (k === "del") {
        if (!confirm(`Delete ${ids.length} photo${ids.length === 1 ? "" : "s"}? Saved versions are removed too.`)) return;
        await deleteMediaAssets({ data: { ids } });
        STATE.selected = new Set();
        load();
      }
    };
  });
}

async function patch(ids, p) {
  await updateMediaAssets({ data: { ids, patch: p } });
  STATE.assets = STATE.assets.map((a) => (ids.includes(a.id) ? { ...a, ...p } : a));
  renderStats();
  renderRooms();
  renderGrid();
  renderPrepare(false);
}

/* ---------- Prepare This Property ---------- */

function renderPrepare(open) {
  const el = document.getElementById("pmPrepare");
  if (!el) return;
  const recs = recommendations(STATE.assets);
  if (!STATE.assets.length) {
    el.innerHTML = "";
    return;
  }
  const auto = pickRecommended(STATE.assets);
  el.innerHTML = `<div class="card pm-prep">
    <div class="card-h"><div><h3>Prepare This Property</h3><div class="sub">Recommendations measured from this photo set. Nothing runs until you approve it.</div></div>
      <button class="btn btn-ghost btn-xs" id="pmAutoRec"><i data-lucide="star"></i>Mark Best Of Each Angle</button></div>
    <div class="card-b">
      ${
        recs.length
          ? recs
              .map(
                (r) => `<div class="pm-rec" data-k="${r.key}">
        <div class="pm-rec-t"><b>${esc(r.label)}</b><span>${esc(r.note)}</span></div>
        <div class="pm-rec-n">${r.ids.length} Photo${r.ids.length === 1 ? "" : "s"}</div>
        <div class="pm-rec-a">
          <button class="fb-link" data-a="preview">Preview Affected</button>
          ${r.op ? `<button class="btn btn-dark btn-xs" data-a="approve"><i data-lucide="check"></i>Approve</button>` : `<button class="btn btn-ghost btn-xs" data-a="review">Open Review</button>`}
          <button class="fb-link" data-a="ignore">Ignore</button>
        </div>
      </div>`,
              )
              .join("")
          : `<div class="pm-empty sm"><b>No Corrections Recommended</b><span>Nothing in this set is flagged right now.</span></div>`
      }
    </div>
  </div>`;
  paint();
  el.querySelector("#pmAutoRec").onclick = async () => {
    const ids = [...auto];
    if (ids.length) await patch(ids, { recommended: true });
  };
  el.querySelectorAll(".pm-rec").forEach((row) => {
    const rec = recs.find((r) => r.key === row.dataset.k);
    row.querySelectorAll("[data-a]").forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.a;
        if (a === "preview") {
          STATE.selected = new Set(rec.ids);
          STATE.tab = "all";
          document.querySelectorAll("#pmTabs button").forEach((x) => x.classList.toggle("on", x.dataset.t === "all"));
          renderGrid();
        } else if (a === "ignore") {
          row.remove();
        } else if (a === "review") {
          STATE.tab = rec.key === "dupes" ? "dupes" : "quality";
          document.querySelectorAll("#pmTabs button").forEach((x) => x.classList.toggle("on", x.dataset.t === STATE.tab));
          renderGrid();
        } else {
          openScope({ ids: rec.ids, label: rec.label, op: rec.op, family: "property" });
        }
      };
    });
  });
  if (open) el.querySelector(".pm-prep").classList.add("open");
}

/* ---------- Edit scope + batch run ---------- */

function openScope(cfg) {
  const wrap = hostEl("pms-wrap");
  wrap.classList.add("on");
  let scope = "selected";
  let op = cfg.op;
  let family = cfg.family || "property";
  let ids = cfg.ids.slice();
  const anchor = STATE.assets.find((a) => a.id === ids[0]);

  const OPS_P = [
    ["auto_enhance", "Auto Enhance"],
    ["window_balance", "Window Balance"],
    ["perspective", "Perspective Correction"],
    ["white_balance", "White-Balance Correction"],
    ["lens", "Lens Correction"],
    ["sky", "Sky Enhancement"],
    ["lawn", "Lawn Enhancement"],
    ["noise", "Noise Reduction"],
    ["sharpen", "Sharpening"],
    ["privacy_blur", "Privacy Blur"],
    ["declutter", "Declutter"],
    ["hdr_merge", "HDR Merge"],
  ];

  function targets() {
    if (scope === "one") return ids.slice(0, 1);
    if (scope === "all") return STATE.assets.filter((a) => !a.hidden).map((a) => a.id);
    if (scope === "similar" && anchor) return similarTo(anchor, STATE.assets);
    return ids;
  }

  function render() {
    const t = targets();
    wrap.innerHTML = `<div class="pms" role="dialog" aria-label="Apply edit">
      <div class="pms-h"><div><b>Apply Edit</b><span>${esc(STATE.propertyLabel)}</span></div>
        <button class="icon-btn" id="pmsClose" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="pms-b">
        <label class="pms-f">Edit<select id="pmsOp">${OPS_P.map(
          ([k, l]) => `<option value="${k}" ${k === op ? "selected" : ""}>${esc(l)}</option>`,
        ).join("")}</select></label>
        <div class="pms-lab">Application Scope</div>
        <div class="pms-seg" role="group" aria-label="Application scope">
          <button data-s="one" class="${scope === "one" ? "on" : ""}">This Photo</button>
          <button data-s="selected" class="${scope === "selected" ? "on" : ""}">Selected Photos</button>
          <button data-s="similar" class="${scope === "similar" ? "on" : ""}">Similar Photos</button>
          <button data-s="all" class="${scope === "all" ? "on" : ""}">Entire Property</button>
        </div>
        <p class="pms-note">Similar photos means the same room, the same indoor or outdoor classification and comparable exposure — not the whole property.</p>
        <div class="pms-sum">
          <div><span>Edit</span><b id="pmsOpLab">${esc((OPS_P.find(([k]) => k === op) || ["", "Auto Enhance"])[1])}</b></div>
          <div><span>Affected Photos</span><b>${t.length}</b></div>
          <div><span>Credit Impact</span><b>${t.length} Credit${t.length === 1 ? "" : "s"}</b></div>
          <div><span>Output</span><b>New Version Per Photo, Originals Kept</b></div>
        </div>
        <div class="pms-list">${t
          .slice(0, 30)
          .map((id) => {
            const a = STATE.assets.find((x) => x.id === id) || {};
            return `<div class="pms-row"><span>${esc(a.room_group || "Photo")} · ${esc((a.original_filename || "").slice(0, 28))}</span><button class="fb-link" data-x="${id}">Remove</button></div>`;
          })
          .join("")}${t.length > 30 ? `<div class="pms-row"><span>+ ${t.length - 30} More</span></div>` : ""}</div>
        ${t.length > 12 ? `<div class="note"><i data-lucide="triangle-alert"></i><span>This is a large batch. Confirm the count above before running.</span></div>` : ""}
        <div class="pms-act">
          <button class="btn btn-primary" id="pmsRun"><i data-lucide="play"></i>Apply To ${t.length} Photo${t.length === 1 ? "" : "s"}</button>
          <button class="btn btn-ghost" id="pmsCancel">Cancel</button>
        </div>
        <div class="pms-status" id="pmsStatus" role="status" aria-live="polite"></div>
      </div>
    </div>`;
    paint();
    wrap.querySelector("#pmsClose").onclick = close;
    wrap.querySelector("#pmsCancel").onclick = close;
    wrap.querySelector("#pmsOp").onchange = (e) => {
      op = e.target.value;
      render();
    };
    wrap.querySelectorAll(".pms-seg button").forEach((b) => {
      b.onclick = () => {
        scope = b.dataset.s;
        render();
      };
    });
    wrap.querySelectorAll("[data-x]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.x;
        ids = ids.filter((x) => x !== id);
        if (scope !== "selected") scope = "selected";
        render();
      };
    });
    wrap.querySelector("#pmsRun").onclick = () => run(t);
  }

  async function run(list) {
    const status = wrap.querySelector("#pmsStatus");
    const btn = wrap.querySelector("#pmsRun");
    btn.disabled = true;
    track("batch_edit_started", { op, count: list.length });
    let ok = 0;
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      const a = STATE.assets.find((x) => x.id === list[i]);
      status.textContent = `Processing ${i + 1} Of ${list.length}`;
      try {
        const url = await roomPhotoUrl(a.storage_path);
        const blob = await (await fetch(url)).blob();
        const dataUrl = await new Promise((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        const out = await runPhotoEdit({
          data: { family, op, image: dataUrl, room: a.room_group, direction: "Warm Minimal", instruction: null },
        });
        const path = await uploadRenderDataUrl(out.image);
        const row = await addMediaVersion({
          data: {
            asset_id: a.id,
            label: out.label,
            kind: out.family === "design" ? "design" : "enhanced",
            modification_class: out.modification_class,
            storage_path: path,
            ops: { op },
            approve: true,
          },
        });
        STATE.versions.push(row);
        a.approved_version_id = row.id;
        a.modification_class = out.modification_class;
        ok++;
      } catch (e) {
        bad++;
        status.textContent = `Stopped after ${ok} photo${ok === 1 ? "" : "s"}: ${e.message || e}`;
        break;
      }
    }
    track("batch_edit_completed", { op, ok, failed: bad });
    if (!bad) status.textContent = `Applied to ${ok} photo${ok === 1 ? "" : "s"}. Each result is a new version.`;
    btn.disabled = false;
    renderGrid();
    renderStats();
  }

  function close() {
    wrap.classList.remove("on");
    wrap.innerHTML = "";
    document.removeEventListener("keydown", onEsc);
  }
  const onEsc = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onEsc);
  render();
}

function openEditor(id) {
  openPhotoEditor({
    assetId: id,
    assets: visible().length ? visible() : STATE.assets,
    versions: STATE.versions,
    propertyLabel: STATE.propertyLabel,
    reload: () => load(),
  });
}

function openExport(ids) {
  openExportDialog({
    assets: STATE.assets,
    versions: STATE.versions,
    selected: ids || [...STATE.selected],
    propertyId: STATE.propertyId,
    propertyLabel: STATE.propertyLabel,
    reload: () => load(),
  });
}

function renderExports() {
  const el = document.getElementById("pmExportList");
  if (!el) return;
  if (!STATE.exports.length) {
    el.innerHTML = `<div class="pm-empty sm"><b>No Packages Yet</b><span>Build an MLS, portal, social or client package from approved versions.</span></div>`;
    return;
  }
  el.innerHTML = STATE.exports
    .map(
      (x) => `<div class="rowi"><div class="rowt"><b>${esc(x.label)}</b><span>${new Date(x.created_at).toLocaleString()} · ${
        x.options && x.options.watermark ? "Watermarked" : "No Watermark"
      } · ${x.options && x.options.disclosure ? "Disclosure Applied" : "No Disclosure"}</span></div><span class="pill p-gray">${x.file_count} Files</span></div>`,
    )
    .join("");
}
