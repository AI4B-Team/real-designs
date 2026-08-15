// REAL DESIGNS — Presentations. Property-centered client packages: build from
// existing designs, photos, videos and budgets, share a branded client link,
// track activity and export a print-ready PDF.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { resolvePhotoUrl } from "@/lib/room-photos";
import { getPropertyTree, listSavedEstimates } from "@/lib/workspace.functions";
import { listMediaAssets } from "@/lib/property-media.functions";
import { listVideos } from "@/lib/reveal.functions";
import {
  listPackages,
  getPackage,
  savePackage,
  deletePackage,
  createPackageLink,
  revokePackageLink,
} from "@/lib/presentation-packages.functions";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
  resolveImgs();
};

/** Stored photo paths resolve asynchronously; fill them in after render. */
async function resolveImgs(root) {
  const scope = root || document;
  const list = Array.from(scope.querySelectorAll("img[data-ph]"));
  await Promise.all(
    list.map(async (img) => {
      const path = img.getAttribute("data-ph");
      img.removeAttribute("data-ph");
      try {
        const u = await resolvePhotoUrl(path);
        if (u) img.src = u;
      } catch (_) {}
    }),
  );
}
const toast = (m) => {
  try {
    window.rdToast ? window.rdToast(m) : console.log(m);
  } catch (_) {}
};
const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");

export const PRES_SECTIONS = [
  { key: "cover", title: "Cover" },
  { key: "before_after", title: "Before And After" },
  { key: "designs", title: "Design Concepts" },
  { key: "photos", title: "Property Photos" },
  { key: "video", title: "Walkthrough Video" },
  { key: "budget", title: "Scope And Budget" },
  { key: "next", title: "Next Steps" },
];

const STATUS = {
  draft: ["p-gray", "Draft"],
  shared: ["p-blue", "Shared"],
  viewed: ["p-blue", "Opened"],
  approved: ["p-ok", "Approved"],
  changes: ["p-amb", "Changes Requested"],
};

const S = {
  rows: [],
  loading: false,
  sources: null,
  draft: null,
  step: 1,
  busy: false,
  openId: null,
};

function ago(iso) {
  if (!iso) return "no activity yet";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  return Math.floor(d / 86400) + "d ago";
}

function shareUrl(token) {
  return location.origin + "/pkg/" + token;
}

function activeLink(row) {
  return (row.links || []).find((l) => !l.revoked) || null;
}

/* ======================= LIBRARY ======================= */

function libraryHtml() {
  if (S.loading) return `<p class="pk-note">Loading Your Presentations…</p>`;
  if (!S.rows.length) {
    return `<div class="pk-empty">
      <i data-lucide="presentation"></i>
      <b>No Presentations Yet</b>
      <span>Build a client-ready package from a property's designs, photos, video and budget. Share one branded link, then track every view and decision.</span>
      <button class="btn btn-primary btn-sm" data-pk="new"><i data-lucide="plus"></i>New Presentation</button>
    </div>`;
  }
  return S.rows
    .map((r) => {
      const [cls, lab] = STATUS[r.status] || STATUS.draft;
      const link = activeLink(r);
      const ctx = [r.property_label, r.client_name ? "For " + r.client_name : null].filter(Boolean).map(esc).join(" · ");
      return `<div class="pk-row" data-id="${r.id}">
        <div class="pk-row-t">
          <b>${esc(r.title)}</b>
          <span>${ctx ? ctx + " · " : ""}${r.asset_count} Item${r.asset_count === 1 ? "" : "s"} · ${r.view_count || 0} View${
            (r.view_count || 0) === 1 ? "" : "s"
          } · ${esc(r.last_activity || "Created")} ${ago(r.last_activity_at || r.created_at)}</span>
        </div>
        <span class="pill ${cls}">${lab}</span>
        <div class="pk-row-a">
          <button class="btn btn-ghost btn-xs" data-pk="open" title="Open Presentation"><i data-lucide="eye"></i>Open</button>
          <button class="btn btn-ghost btn-xs" data-pk="edit" title="Edit Presentation"><i data-lucide="pencil"></i>Edit</button>
          <button class="btn btn-ghost btn-xs" data-pk="${link ? "copy" : "link"}" title="${link ? "Copy Client Link" : "Create Client Link"}"><i data-lucide="${
            link ? "copy" : "link"
          }"></i>${link ? "Copy Link" : "Client Link"}</button>
          <button class="btn btn-ghost btn-xs" data-pk="pdf" title="Export PDF"><i data-lucide="file-text"></i>PDF</button>
          <button class="btn btn-ghost btn-xs" data-pk="del" title="Delete Presentation"><i data-lucide="trash-2"></i>Delete</button>
        </div>

      </div>`;
    })
    .join("");
}

async function refresh() {
  const el = document.getElementById("pkList");
  if (!el) return;
  S.loading = !S.rows.length;
  el.innerHTML = libraryHtml();
  paint();
  try {
    S.rows = await listPackages();
  } catch (_) {
    S.rows = [];
  }
  S.loading = false;
  el.innerHTML = libraryHtml();
  paint();
}

/* ======================= SOURCES ======================= */

async function loadSources() {
  if (S.sources) return S.sources;
  const [tree, estimates, media, videos] = await Promise.all([
    getPropertyTree().catch(() => []),
    listSavedEstimates().catch(() => []),
    listMediaAssets({ data: {} }).catch(() => ({ assets: [], versions: [] })),
    listVideos().catch(() => ({ projects: [], variants: [] })),
  ]);
  S.sources = { tree, estimates, media, videos };
  return S.sources;
}

function propertyOptions() {
  const t = (S.sources && S.sources.tree) || [];
  return t.map((p) => ({ id: p.id, label: p.address }));
}

/** Everything in the workspace that can go into a package, for one property. */
function sourceItems(propertyId) {
  const out = { designs: [], photos: [], videos: [], budget: [] };
  const src = S.sources || {};
  (src.tree || [])
    .filter((p) => !propertyId || p.id === propertyId)
    .forEach((p) =>
      (p.projects || []).forEach((pr) =>
        (pr.rooms || []).forEach((r) => {
          if (r.after_path)
            out.designs.push({
              id: "d_" + (r.version_id || r.id),
              title: r.name,
              caption: pr.name,
              url: r.after_path,
              compare_url: r.before_path || null,
              kind: r.before_path ? "before_after" : "image",
            });
        }),
      ),
    );
  ((src.media && src.media.assets) || [])
    .filter((a) => !propertyId || a.property_id === propertyId)
    .slice(0, 60)
    .forEach((a) =>
      out.photos.push({
        id: "m_" + a.id,
        title: a.room_label || a.file_name || "Photo",
        caption: a.status || "",
        url: a.storage_path || a.url || null,
        kind: "image",
      }),
    );
  ((src.videos && src.videos.projects) || []).slice(0, 40).forEach((v) => {
    const variant = ((src.videos && src.videos.variants) || []).find((x) => x.video_project_id === v.id);
    out.videos.push({
      id: "v_" + v.id,
      title: v.title || "Listing Video",
      caption: v.status || "",
      url: variant ? variant.output_path || variant.url || null : null,
      kind: "video",
    });
  });
  (src.estimates || [])
    .filter((e) => !propertyId || true)
    .slice(0, 30)
    .forEach((e) =>
      out.budget.push({
        id: "b_" + e.version_id,
        title: e.room_name + " — " + e.project_name,
        caption:
          e.total_low != null ? money(e.total_low) + " to " + money(e.total_high) : "No pricing yet",
        url: null,
        kind: "budget",
        meta: { low: e.total_low, high: e.total_high, address: e.address, room: e.room_name },
      }),
    );
  return out;
}

/* ======================= BUILDER ======================= */

function newDraft() {
  return {
    id: null,
    title: "",
    property_id: null,
    property_label: "",
    client_name: "",
    client_email: "",
    intro: "",
    accent: "#CC0000",
    logo_url: "",
    settings: { allow_comments: true, allow_approve: true, allow_changes: true },
    sections: PRES_SECTIONS.map((s, i) => ({ ...s, hidden: false, sort_order: i })),
    picked: {},
    access_code: "",
    expires_days: null,
  };
}

const STEPS = [
  ["Property And Details", "map-pin"],
  ["Select Assets", "images"],
  ["Sections And Order", "list-ordered"],
  ["Branding And Sharing", "share-2"],
];

function stepBar() {
  return `<div class="pk-steps">${STEPS.map(
    ([l, ic], i) =>
      `<div class="pk-step${S.step === i + 1 ? " on" : ""}${S.step > i + 1 ? " done" : ""}"><i data-lucide="${ic}"></i><span>${i + 1}. ${l}</span></div>`,
  ).join("")}</div>`;
}

function step1() {
  const d = S.draft;
  const opts = propertyOptions();
  return `<div class="pk-form">
    <label class="pk-f"><span>Presentation Title</span>
      <input id="pkTitle" value="${esc(d.title)}" placeholder="Kitchen And Living Room Concept"></label>
    <label class="pk-f"><span>Property</span>
      <select id="pkProp">
        <option value="">Select A Property</option>
        ${opts.map((o) => `<option value="${o.id}"${d.property_id === o.id ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select></label>
    <div class="pk-two">
      <label class="pk-f"><span>Client Name</span><input id="pkCName" value="${esc(d.client_name)}" placeholder="Client name"></label>
      <label class="pk-f"><span>Client Email</span><input id="pkCEmail" value="${esc(d.client_email)}" placeholder="client@email.com"></label>
    </div>
    <label class="pk-f"><span>Introduction</span>
      <textarea id="pkIntro" rows="4" placeholder="A short note that opens the presentation.">${esc(d.intro)}</textarea></label>
  </div>`;
}

const TABS = [
  ["designs", "Designs"],
  ["photos", "Photos"],
  ["videos", "Videos"],
  ["budget", "Budget"],
];

function step2() {
  const d = S.draft;
  const items = sourceItems(d.property_id);
  const tab = d.tab || "designs";
  const list = items[tab] || [];
  const count = Object.keys(d.picked).length;
  return `<div class="pk-assets">
    <div class="pk-tabs">${TABS.map(
      ([k, l]) => `<button class="pk-tab${tab === k ? " on" : ""}" data-pktab="${k}">${l} ${items[k].length}</button>`,
    ).join("")}</div>
    <p class="pk-note">${count} Item${count === 1 ? "" : "s"} Selected${
      d.property_id ? "" : " · Choose a property in step one to narrow these results"
    }</p>
    <div class="pk-grid">${
      list.length
        ? list
            .map((it) => {
              const on = !!d.picked[it.id];
              const thumb = it.url && it.kind !== "budget" && it.kind !== "video" ? it.url : null;
              return `<button class="pk-item${on ? " on" : ""}" data-pkpick="${it.id}" data-pksrc="${tab}">
          <span class="pk-thumb">${
            thumb
              ? `<img data-ph="${esc(thumb)}" alt="${esc(it.title)}" loading="lazy">`
              : `<i data-lucide="${it.kind === "video" ? "clapperboard" : it.kind === "budget" ? "calculator" : "image"}"></i>`
          }${on ? `<em><i data-lucide="check"></i></em>` : ""}</span>
          <b>${esc(it.title)}</b><span>${esc(it.caption || "")}</span>
        </button>`;
            })
            .join("")
        : `<p class="pk-note">Nothing Here Yet. Create designs, upload photos or run a budget first.</p>`
    }</div>
  </div>`;
}

function step3() {
  const d = S.draft;
  const used = {};
  Object.values(d.picked).forEach((p) => (used[p.section_key] = (used[p.section_key] || 0) + 1));
  return `<div class="pk-secs">
    <p class="pk-note">Reorder sections, rename them or hide any section the client should not see.</p>
    ${d.sections
      .map(
        (s, i) => `<div class="pk-sec${s.hidden ? " off" : ""}" data-sec="${s.key}">
        <button class="icon-btn xs" data-secmove="up" ${i === 0 ? "disabled" : ""} title="Move Up"><i data-lucide="chevron-up"></i></button>
        <button class="icon-btn xs" data-secmove="down" ${i === d.sections.length - 1 ? "disabled" : ""} title="Move Down"><i data-lucide="chevron-down"></i></button>
        <input class="pk-sec-t" data-sectitle value="${esc(s.title)}">
        <span class="pk-sec-c">${used[s.key] || 0} Item${(used[s.key] || 0) === 1 ? "" : "s"}</span>
        <button class="icon-btn xs" data-sechide title="${s.hidden ? "Show Section" : "Hide Section"}"><i data-lucide="${s.hidden ? "eye-off" : "eye"}"></i></button>
      </div>`,
      )
      .join("")}
  </div>`;
}

function step4() {
  const d = S.draft;
  const st = d.settings;
  return `<div class="pk-form">
    <div class="pk-two">
      <label class="pk-f"><span>Accent Color</span><input id="pkAccent" type="color" value="${esc(d.accent)}"></label>
      <label class="pk-f"><span>Logo URL</span><input id="pkLogo" value="${esc(d.logo_url)}" placeholder="https://"></label>
    </div>
    <div class="pk-toggles">
      <label><input type="checkbox" data-set="allow_comments" ${st.allow_comments ? "checked" : ""}> Allow Client Comments</label>
      <label><input type="checkbox" data-set="allow_approve" ${st.allow_approve ? "checked" : ""}> Allow Client Approval</label>
      <label><input type="checkbox" data-set="allow_changes" ${st.allow_changes ? "checked" : ""}> Allow Change Requests</label>
    </div>
    <div class="pk-two">
      <label class="pk-f"><span>Access Code</span><input id="pkCode" value="${esc(d.access_code)}" placeholder="Optional"></label>
      <label class="pk-f"><span>Link Expires</span>
        <select id="pkExp">
          <option value="">Never</option>
          <option value="7"${d.expires_days === 7 ? " selected" : ""}>In 7 Days</option>
          <option value="30"${d.expires_days === 30 ? " selected" : ""}>In 30 Days</option>
          <option value="90"${d.expires_days === 90 ? " selected" : ""}>In 90 Days</option>
        </select></label>
    </div>
    <p class="pk-note">Saving creates the presentation and a branded client link. The client does not need an account.</p>
  </div>`;
}

function builderHtml() {
  const body = S.step === 1 ? step1() : S.step === 2 ? step2() : S.step === 3 ? step3() : step4();
  return `<div class="pk-modal" role="dialog" aria-modal="true">
    <div class="pk-box">
      <div class="pk-head">
        <b>${S.draft.id ? "Edit Presentation" : "New Presentation"}</b>
        <button class="icon-btn" data-pk="close" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      ${stepBar()}
      <div class="pk-body">${body}</div>
      <div class="pk-foot">
        <button class="btn btn-ghost btn-sm" data-pk="back" ${S.step === 1 ? "disabled" : ""}>Back</button>
        <button class="btn btn-primary btn-sm" data-pk="${S.step === 4 ? "save" : "next"}" ${S.busy ? "disabled" : ""}>
          ${S.busy ? "Saving…" : S.step === 4 ? "Save And Create Link" : "Continue"}</button>
      </div>
    </div>
  </div>`;
}

function renderBuilder() {
  const host = document.getElementById("pkModal");
  if (!host) return;
  host.innerHTML = S.draft ? builderHtml() : "";
  paint();
}

function readStep() {
  const d = S.draft;
  const v = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };
  if (S.step === 1) {
    d.title = v("pkTitle").trim();
    d.property_id = v("pkProp") || null;
    const opt = propertyOptions().find((o) => o.id === d.property_id);
    d.property_label = opt ? opt.label : "";
    d.client_name = v("pkCName").trim();
    d.client_email = v("pkCEmail").trim();
    d.intro = v("pkIntro").trim();
  }
  if (S.step === 3) {
    document.querySelectorAll(".pk-sec").forEach((el) => {
      const key = el.getAttribute("data-sec");
      const s = d.sections.find((x) => x.key === key);
      const inp = el.querySelector("[data-sectitle]");
      if (s && inp) s.title = inp.value.trim() || s.title;
    });
  }
  if (S.step === 4) {
    d.accent = v("pkAccent") || "#CC0000";
    d.logo_url = v("pkLogo").trim();
    d.access_code = v("pkCode").trim();
    const e = v("pkExp");
    d.expires_days = e ? Number(e) : null;
  }
}

const SECTION_FOR = { designs: "designs", photos: "photos", videos: "video", budget: "budget" };

async function openBuilder(id) {
  S.draft = newDraft();
  S.step = 1;
  renderBuilder();
  await loadSources();
  if (id) {
    try {
      const p = await getPackage({ data: { id } });
      const d = S.draft;
      d.id = p.package.id;
      d.title = p.package.title || "";
      d.property_id = p.package.property_id || null;
      d.property_label = p.package.property_label || "";
      d.client_name = p.package.client_name || "";
      d.client_email = p.package.client_email || "";
      d.intro = p.package.intro || "";
      d.accent = p.package.accent || "#CC0000";
      d.logo_url = p.package.logo_url || "";
      d.settings = Object.assign({ allow_comments: true, allow_approve: true, allow_changes: true }, p.package.settings || {});
      if (p.sections.length)
        d.sections = p.sections.map((s, i) => ({ key: s.section_key, title: s.title, hidden: s.hidden, sort_order: i }));
      p.assets.forEach((a) => {
        if (!a.source_id) return;
        d.picked[a.source_id] = {
          section_key: a.section_key,
          kind: a.kind,
          title: a.title,
          caption: a.caption,
          url: a.url,
          compare_url: a.compare_url,
          meta: a.meta || {},
        };
      });
    } catch (e) {
      toast(e?.message || "Could not open that presentation.");
    }
  }
  renderBuilder();
}

async function saveDraft() {
  const d = S.draft;
  readStep();
  if (!d.title) {
    S.step = 1;
    renderBuilder();
    toast("Give the presentation a title.");
    return;
  }
  S.busy = true;
  renderBuilder();
  const assets = Object.entries(d.picked).map(([sid, a], i) => ({
    section_key: a.section_key,
    kind: a.kind,
    title: a.title || null,
    caption: a.caption || null,
    url: a.url || null,
    compare_url: a.compare_url || null,
    source_id: sid,
    meta: a.meta || {},
    sort_order: i,
  }));
  try {
    const res = await savePackage({
      data: {
        id: d.id,
        title: d.title,
        property_id: d.property_id,
        property_label: d.property_label || null,
        client_name: d.client_name || null,
        client_email: d.client_email || null,
        intro: d.intro || null,
        logo_url: d.logo_url || null,
        accent: d.accent,
        settings: d.settings,
        sections: d.sections.map((s, i) => ({
          section_key: s.key,
          title: s.title,
          hidden: !!s.hidden,
          sort_order: i,
        })),
        assets,
      },
    });
    let link = null;
    if (!d.id) {
      link = await createPackageLink({
        data: {
          package_id: res.id,
          access_code: d.access_code || null,
          expires_days: d.expires_days,
        },
      });
    }
    S.busy = false;
    S.draft = null;
    renderBuilder();
    await refresh();
    if (link) {
      try {
        await navigator.clipboard.writeText(shareUrl(link.token));
        toast("Presentation Saved. Client link copied to your clipboard.");
      } catch (_) {
        toast("Presentation Saved And Shared.");
      }
    } else toast("Presentation Saved.");
  } catch (e) {
    S.busy = false;
    renderBuilder();
    toast(e?.message || "Could not save that presentation.");
  }
}

/* ======================= DETAIL / EXPORT ======================= */

async function openDetail(id) {
  const host = document.getElementById("pkModal");
  if (!host) return;
  host.innerHTML = `<div class="pk-modal"><div class="pk-box"><div class="pk-body"><p class="pk-note">Loading…</p></div></div></div>`;
  let p;
  try {
    p = await getPackage({ data: { id } });
  } catch (e) {
    host.innerHTML = "";
    toast(e?.message || "Could not open that presentation.");
    return;
  }
  const link = (p.links || []).find((l) => !l.revoked);
  const [cls, lab] = STATUS[p.package.status] || STATUS.draft;
  host.innerHTML = `<div class="pk-modal" role="dialog" aria-modal="true"><div class="pk-box">
    <div class="pk-head"><b>${esc(p.package.title)}</b><span class="pill ${cls}">${lab}</span>
      <button class="icon-btn" data-pk="close" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="pk-body">
      <div class="pk-detail">
        <div class="pk-kpi"><b>${p.assets.length}</b><span>Items</span></div>
        <div class="pk-kpi"><b>${p.package.view_count || 0}</b><span>Views</span></div>
        <div class="pk-kpi"><b>${p.comments.length}</b><span>Comments</span></div>
        <div class="pk-kpi"><b>${(p.sections || []).filter((s) => !s.hidden).length}</b><span>Sections</span></div>
      </div>
      ${
        link
          ? `<div class="pk-linkbox"><input readonly value="${esc(shareUrl(link.token))}">
              <button class="btn btn-dark btn-xs" data-pk="copytok" data-tok="${esc(link.token)}">Copy</button>
              <button class="btn btn-ghost btn-xs" data-pk="revoke" data-lid="${link.id}">Revoke</button></div>`
          : `<button class="btn btn-primary btn-sm" data-pk="mklink" data-id="${p.package.id}"><i data-lucide="link"></i>Create Client Link</button>`
      }
      <h4 class="pk-h4">Activity</h4>
      ${
        p.activity.length
          ? p.activity
              .map(
                (a) =>
                  `<div class="pk-act"><i data-lucide="${
                    a.kind === "approved" ? "check-circle-2" : a.kind === "changes" ? "refresh-cw" : a.kind === "opened" ? "eye" : a.kind === "comment" ? "message-square" : "circle-dot"
                  }"></i><div><b>${esc(a.detail || a.kind)}</b><span>${new Date(a.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}</span></div></div>`,
              )
              .join("")
          : `<p class="pk-note">No Activity Yet. The timeline fills in once your client opens the link.</p>`
      }
      ${
        p.comments.length
          ? `<h4 class="pk-h4">Client Comments</h4>` +
            p.comments
              .map(
                (c) =>
                  `<div class="pk-act"><i data-lucide="message-square"></i><div><b>${esc(c.author_name || "Client")}</b><span>${esc(c.body)}</span></div></div>`,
              )
              .join("")
          : ""
      }
    </div>
    <div class="pk-foot">
      <button class="btn btn-ghost btn-sm" data-pk="edit" data-id="${p.package.id}">Edit</button>
      <button class="btn btn-primary btn-sm" data-pk="pdf" data-id="${p.package.id}">Export PDF</button>
    </div>
  </div></div>`;
  paint();
}

async function exportPdf(id) {
  let p;
  try {
    p = await getPackage({ data: { id } });
  } catch (e) {
    toast(e?.message || "Could not export that presentation.");
    return;
  }
  const pk = p.package;
  const urls = {};
  await Promise.all(
    p.assets.map(async (a) => {
      if (a.url) urls[a.url] = (await resolvePhotoUrl(a.url)) || "";
    }),
  );
  const secs = (p.sections || []).filter((s) => !s.hidden);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(pk.title)}</title>
  <style>
    body{font-family:'DM Sans',system-ui,sans-serif;color:#111;margin:38px}
    h1{font-size:26px;margin:0 0 4px} h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 10px;color:${esc(pk.accent)}}
    .sub{color:#666;font-size:13px;margin-bottom:18px}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    figure{margin:0} img{width:100%;border-radius:8px;border:1px solid #e5e5e5}
    figcaption{font-size:12px;color:#555;margin-top:4px}
    .line{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:6px 0;font-size:13px}
    @media print{ a{display:none} }
  </style></head><body>
  <h1>${esc(pk.title)}</h1>
  <div class="sub">${esc(pk.property_label || "")}${pk.client_name ? " · Prepared for " + esc(pk.client_name) : ""}</div>
  ${pk.intro ? `<p>${esc(pk.intro)}</p>` : ""}
  ${secs
    .map((s) => {
      const list = p.assets.filter((a) => a.section_key === s.section_key);
      if (!list.length) return "";
      const body =
        s.section_key === "budget"
          ? list
              .map(
                (a) =>
                  `<div class="line"><span>${esc(a.title || "")}</span><b>${esc(a.caption || "")}</b></div>`,
              )
              .join("")
          : `<div class="g">${list
              .map(
                (a) =>
                  `<figure>${a.url && urls[a.url] ? `<img src="${esc(urls[a.url])}">` : ""}<figcaption>${esc(a.title || "")}</figcaption></figure>`,
              )
              .join("")}</div>`;
      return `<h2>${esc(s.title)}</h2>${body}`;
    })
    .join("")}
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast("Allow pop-ups to export the PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.print();
    } catch (_) {}
  }, 700);
}

/* ======================= MOUNT ======================= */

let wired = false;

/** Deep link from Reports: open a package detail once the view mounts. */
try {
  (window as any).__rdOpenPackage = (id) => {
    PENDING_OPEN = id;
  };
} catch (_) {}
let PENDING_OPEN = null;

export function mountPresent() {
  const host = document.getElementById("presRoot");
  if (!host) return;
  if (!document.getElementById("pkModal")) {
    const m = document.createElement("div");
    m.id = "pkModal";
    host.appendChild(m);
  }
  if (!wired) {
    wired = true;
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", (e: any) => {
      if (e.key !== "Escape") return;
      const m = document.getElementById("pkModal");
      if (!m || !m.innerHTML.trim()) return;
      S.draft = null;
      m.innerHTML = "";
    });
  }

  refresh().then(() => {
    if (PENDING_OPEN) {
      const id = PENDING_OPEN;
      PENDING_OPEN = null;
      try {
        openDetail(id);
      } catch (_) {}
    }
  });
}

async function onClick(e) {
  const t = e.target.closest("[data-pk],[data-pktab],[data-pkpick],[data-secmove],[data-sechide]");
  if (!t) return;
  const row = e.target.closest(".pk-row");
  const id = t.getAttribute("data-id") || (row ? row.getAttribute("data-id") : null);
  const a = t.getAttribute("data-pk");

  if (!S.draft && (t.hasAttribute("data-pktab") || t.hasAttribute("data-pkpick") || t.hasAttribute("data-secmove") || t.hasAttribute("data-sechide"))) return;
  if (t.hasAttribute("data-pktab")) {
    S.draft.tab = t.getAttribute("data-pktab");
    return renderBuilder();
  }
  if (t.hasAttribute("data-pkpick")) {
    const sid = t.getAttribute("data-pkpick");
    const src = t.getAttribute("data-pksrc");
    if (S.draft.picked[sid]) delete S.draft.picked[sid];
    else {
      const it = (sourceItems(S.draft.property_id)[src] || []).find((x) => x.id === sid);
      if (it)
        S.draft.picked[sid] = {
          section_key: it.kind === "before_after" ? "before_after" : SECTION_FOR[src],
          kind: it.kind,
          title: it.title,
          caption: it.caption,
          url: it.url,
          compare_url: it.compare_url || null,
          meta: it.meta || {},
        };
    }
    return renderBuilder();
  }
  if (t.hasAttribute("data-secmove")) {
    readStep();
    const key = t.closest(".pk-sec").getAttribute("data-sec");
    const arr = S.draft.sections;
    const i = arr.findIndex((s) => s.key === key);
    const j = t.getAttribute("data-secmove") === "up" ? i - 1 : i + 1;
    if (j >= 0 && j < arr.length) {
      const [s] = arr.splice(i, 1);
      arr.splice(j, 0, s);
    }
    return renderBuilder();
  }
  if (t.hasAttribute("data-sechide")) {
    readStep();
    const key = t.closest(".pk-sec").getAttribute("data-sec");
    const s = S.draft.sections.find((x) => x.key === key);
    if (s) s.hidden = !s.hidden;
    return renderBuilder();
  }

  if (a === "new") return openBuilder(null);
  if (a === "close") {
    S.draft = null;
    const host = document.getElementById("pkModal");
    if (host) host.innerHTML = "";
    return;
  }
  if (a === "back") {
    readStep();
    S.step = Math.max(1, S.step - 1);
    return renderBuilder();
  }
  if (a === "next") {
    readStep();
    if (S.step === 1 && !S.draft.title) {
      const ti = document.getElementById("pkTitle");
      if (ti) {
        ti.classList.add("pk-invalid");
        ti.focus();
        ti.addEventListener("input", () => ti.classList.remove("pk-invalid"), { once: true });
      }
      return toast("Give the presentation a title.");
    }
    S.step = Math.min(4, S.step + 1);
    return renderBuilder();
  }
  if (a === "save") return saveDraft();
  if (a === "open" && id) return openDetail(id);
  if (a === "edit" && id) return openBuilder(id);
  if (a === "pdf" && id) return exportPdf(id);
  if (a === "copytok") {
    try {
      await navigator.clipboard.writeText(shareUrl(t.getAttribute("data-tok")));
      toast("Client Link Copied.");
    } catch (_) {}
    return;
  }
  if (a === "copy" && id) {
    const r = S.rows.find((x) => x.id === id);
    const link = r && activeLink(r);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(shareUrl(link.token));
      toast("Client Link Copied.");
    } catch (_) {}
    return;
  }
  if ((a === "link" || a === "mklink") && id) {
    try {
      const link = await createPackageLink({ data: { package_id: id } });
      await navigator.clipboard.writeText(shareUrl(link.token)).catch(() => {});
      toast("Client Link Created And Copied.");
      await refresh();
      if (a === "mklink") openDetail(id);
    } catch (err) {
      toast(err?.message || "Could not create that link.");
    }
    return;
  }
  if (a === "revoke") {
    try {
      await revokePackageLink({ data: { id: t.getAttribute("data-lid") } });
      toast("Link Revoked.");
      await refresh();
    } catch (err) {
      toast(err?.message || "Could not revoke that link.");
    }
    return;
  }
  if (a === "del" && id) {
    if (!confirm("Delete this presentation? The client link stops working.")) return;
    try {
      await deletePackage({ data: { id } });
      await refresh();
      toast("Presentation Deleted.");
    } catch (err) {
      toast(err?.message || "Could not delete that presentation.");
    }
  }
}

function onChange(e) {
  const t = e.target;
  if (!S.draft) return;
  if (t.id === "pkProp") {
    readStep();
    return renderBuilder();
  }
  if (t.hasAttribute && t.hasAttribute("data-set")) {
    S.draft.settings[t.getAttribute("data-set")] = t.checked;
  }
}
