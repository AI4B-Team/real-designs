// REAL DESIGNS — Reports. Operational workspace overview built entirely from
// real records: properties, projects, rooms, designs, scopes, budgets, credit
// ledger and client presentation activity.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { getWorkspaceReport } from "@/lib/reports.functions";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};
const toast = (m) => {
  try {
    window.rdToast ? window.rdToast(m) : null;
  } catch (_) {}
};

const RANGES = [
  ["30d", "Last 30 Days"],
  ["90d", "Last 90 Days"],
  ["year", "This Year"],
  ["all", "All Time"],
  ["custom", "Custom"],
];

const FIT = {
  on_track: ["ok", "On Track"],
  near_limit: ["warn", "Near Limit"],
  over: ["bad", "Over Budget"],
  unset: ["gray", "Not Set"],
};

const CREDIT_LABEL = {
  design: "Image Generation",
  video: "Video Generation",
  plan_3d: "3D Plan Generation",
  scope: "Budget",
  topup: "Top Up",
  grant: "Grant",
  refund: "Refund",
};

const STATUS_SEG = [
  ["draft", "Draft", "#9ca3af", 0],
  ["review", "In Review", "#f59e0b", 2],
  ["approved", "Approved", "#10b981", 1],
  ["archived", "Archived", "#4b5563", 3],
];

const PER_PAGE = 20;

const S = {
  range: "30d",
  customFrom: "",
  customTo: "",
  propertyId: "",
  q: "",
  fit: "all",
  sort: "last_activity",
  dir: "desc",
  page: 1,
  data: null,
  loading: false,
  error: "",
  refreshing: false,
  menu: false,
};

let go = (v) => {
  try {
    window.__rdGo && window.__rdGo(v);
  } catch (_) {}
};
let wired = false;

/** Resolve the selected preset into ISO bounds. */
function bounds() {
  const now = new Date();
  if (S.range === "all") return { from: null, to: null };
  if (S.range === "custom") {
    return {
      from: S.customFrom ? new Date(S.customFrom + "T00:00:00").toISOString() : null,
      to: S.customTo ? new Date(S.customTo + "T23:59:59").toISOString() : null,
    };
  }
  if (S.range === "year") return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: null };
  const days = S.range === "90d" ? 90 : 30;
  return { from: new Date(Date.now() - days * 86400000).toISOString(), to: null };
}

function rangeLabel() {
  const r = RANGES.find((x) => x[0] === S.range);
  if (S.range === "custom" && (S.customFrom || S.customTo))
    return (S.customFrom || "Start") + " to " + (S.customTo || "Today");
  return r ? r[1] : "Last 30 Days";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ---------------- data ---------------- */

async function load(refresh) {
  if (S.loading) return;
  S.loading = true;
  S.error = "";
  if (refresh) S.refreshing = true;
  render();
  const b = bounds();
  try {
    S.data = await Promise.race([
      getWorkspaceReport({ data: { from: b.from, to: b.to, propertyId: S.propertyId || null } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000)),
    ]);
    S.error = "";
    if (refresh) toast("Report Updated");
  } catch (e) {
    console.error("[reports] load failed", e);
    S.error =
      String((e && e.message) || "") === "timeout"
        ? "The report took too long to load. Please try again."
        : "We could not load your report just now.";
  }
  S.loading = false;
  S.refreshing = false;
  render();
}

/** Shared failure block so no section can sit on a skeleton forever. */
function errHtml() {
  return `<div class="rp-sec-b"><div class="rp-err"><i data-lucide="alert-circle"></i><span>${esc(
    S.error,
  )}</span><button class="btn btn-ghost btn-xs" data-a="refresh">Retry</button></div></div>`;
}


/* ---------------- rollup helpers ---------------- */

function filteredRows() {
  const d = S.data;
  if (!d) return [];
  const q = S.q.trim().toLowerCase();
  let rows = d.rows.filter((r) => {
    if (S.fit !== "all" && r.budget_fit !== S.fit) return false;
    if (!q) return true;
    return (
      String(r.property).toLowerCase().includes(q) ||
      String(r.project).toLowerCase().includes(q) ||
      String(r.client || "").toLowerCase().includes(q)
    );
  });
  const key = S.sort;
  const dir = S.dir === "asc" ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    let av = a[key],
      bv = b[key];
    if (key === "scope") {
      av = a.high;
      bv = b.high;
    }
    if (av == null) av = key === "last_activity" ? "" : -1;
    if (bv == null) bv = key === "last_activity" ? "" : -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
  return rows;
}

function totalsOf(rows) {
  return rows.reduce(
    (t, r) => {
      t.rooms += r.rooms;
      t.designs += r.designs;
      t.approved += r.approved;
      t.low += r.low;
      t.high += r.high;
      t.budget += r.budget_target || 0;
      return t;
    },
    { rooms: 0, designs: 0, approved: 0, low: 0, high: 0, budget: 0 },
  );
}

/* ---------------- render ---------------- */

export function mountReports(nav) {
  if (typeof nav === "function") go = nav;
  const host = document.getElementById("repRoot");
  if (!host) return;
  if (!wired) {
    wired = true;
    host.addEventListener("click", onClick);
    host.addEventListener("change", onChange);
    host.addEventListener("input", onInput);
    document.addEventListener("click", (e) => {
      if (S.menu && !e.target.closest(".rp-exp")) {
        S.menu = false;
        const m = document.getElementById("rpExpMenu");
        if (m) m.classList.remove("on");
      }
    });
  }
  if (!S.data && !S.loading) load(false);
  else render();
}

function render() {
  const host = document.getElementById("repRoot");
  if (!host) return;
  const scrollQ = document.activeElement && document.activeElement.id === "rpSearch";
  host.innerHTML = `<div class="rp">
    ${headHtml()}
    ${cardsHtml()}
    ${rollupHtml()}
    ${progressHtml()}
    <div class="rp-grid2">${creditsHtml()}${clientsHtml()}</div>
  </div>`;
  paint();
  if (scrollQ) {
    const i = document.getElementById("rpSearch");
    if (i) {
      i.focus();
      i.setSelectionRange(i.value.length, i.value.length);
    }
  }
}

function headHtml() {
  const props = (S.data && S.data.properties) || [];
  const canExport = filteredRows().length > 0;
  return `<div class="rp-head">
    <div>
      <h2>Reports</h2>
      <p>Track project progress, budgets, design activity and client decisions across your workspace.</p>
    </div>
    <div class="rp-tools">
      <select id="rpRange" aria-label="Date range">${RANGES.map(
        (r) => `<option value="${r[0]}"${S.range === r[0] ? " selected" : ""}>${r[1]}</option>`,
      ).join("")}</select>
      <div class="rp-custom${S.range === "custom" ? " on" : ""}">
        <input type="date" id="rpFrom" value="${esc(S.customFrom)}" aria-label="From date">
        <input type="date" id="rpTo" value="${esc(S.customTo)}" aria-label="To date">
      </div>
      <select id="rpProp" aria-label="Property filter">
        <option value="">All Properties</option>
        ${props.map((p) => `<option value="${esc(p.id)}"${S.propertyId === p.id ? " selected" : ""}>${esc(p.address)}</option>`).join("")}
      </select>
      <button class="btn btn-ghost btn-xs" id="rpRefresh" data-a="refresh"${S.loading ? " disabled" : ""}>
        <i data-lucide="${S.refreshing ? "loader" : "refresh-cw"}"></i>${S.refreshing ? "Refreshing" : "Refresh"}</button>
      <div class="rp-exp">
        <button class="btn btn-dark btn-xs" data-a="expmenu"><i data-lucide="download"></i>Export Report<i data-lucide="chevron-down"></i></button>
        <div class="rp-menu${S.menu ? " on" : ""}" id="rpExpMenu">
          <button data-a="csv"${canExport ? "" : " disabled title=\"No records match the current filters\""}><i data-lucide="table"></i>Export CSV</button>
          <button data-a="pdf"${canExport ? "" : " disabled title=\"No records match the current filters\""}><i data-lucide="file-text"></i>Download PDF</button>
        </div>
      </div>
    </div>
  </div>`;
}

function cardsHtml() {
  if (S.loading && !S.data) return `<div class="rp-cards">${'<div class="rp-sk card"></div>'.repeat(4)}</div>`;
  if (S.error && !S.data)
    return `<div class="rp-sec"><div class="rp-sec-b"><div class="rp-err"><i data-lucide="alert-circle"></i><span>${esc(
      S.error,
    )}</span><button class="btn btn-ghost btn-xs" data-a="refresh">Retry</button></div></div></div>`;
  const s = S.data.summary;
  const cards = [
    ["folder-kanban", "Active Projects", String(s.activeProjects), s.properties + (s.properties === 1 ? " property" : " properties") + " in the workspace"],
    ["images", "Designs Created", String(s.designsCreated), rangeLabel()],
    [
      "check-circle-2",
      "Approved Designs",
      String(s.approvedDesigns),
      s.designsCreated ? s.approvalRate + "% of designs in this period" : "No designs in this period",
    ],
    [
      "wallet",
      "Planned Budget",
      s.plannedBudget ? money(s.plannedBudget) : "Not Set",
      s.budgetedProjects
        ? s.budgetedProjects + (s.budgetedProjects === 1 ? " project has" : " projects have") + " a saved budget"
        : "Add a budget target to a project",
    ],
  ];
  return `<div class="rp-cards">${cards
    .map(
      (c) =>
        `<div class="rp-card"><div class="t"><i data-lucide="${c[0]}"></i>${c[1]}</div><b>${c[2]}</b><div class="d">${esc(c[3])}</div></div>`,
    )
    .join("")}</div>`;
}

function sortIcon(key) {
  if (S.sort !== key) return "";
  return `<i data-lucide="${S.dir === "asc" ? "arrow-up" : "arrow-down"}"></i>`;
}

function rollupHtml() {
  if (S.error && !S.data) return "";
  const body = () => {
    if (S.loading && !S.data)
      return `<div class="rp-sec-b">${'<div class="rp-sk line"></div>'.repeat(6)}</div>`;
    if (S.error)
      return `<div class="rp-sec-b"><div class="rp-err"><i data-lucide="alert-circle"></i><span>${esc(S.error)}</span><button class="btn btn-ghost btn-xs" data-a="refresh">Retry</button></div></div>`;
    if (!S.data) return "";
    if (!S.data.rows.length)
      return `<div class="rp-empty">
        <h4>No Project Data Yet</h4>
        <p>Create a property or save a design to start tracking progress and budgets.</p>
        <div class="row"><button class="btn btn-primary btn-xs" data-a="newprop"><i data-lucide="plus"></i>Create Property</button>
        <button class="btn btn-ghost btn-xs" data-a="studio"><i data-lucide="wand-2"></i>Open Studio</button></div>
      </div>`;
    const rows = filteredRows();
    if (!rows.length)
      return `<div class="rp-empty"><h4>No Matching Projects</h4><p>Adjust the search or budget filter to see more rows.</p>
        <div class="row"><button class="btn btn-ghost btn-xs" data-a="clearfilters">Clear Filters</button></div></div>`;
    const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (S.page > pages) S.page = pages;
    const slice = rows.slice((S.page - 1) * PER_PAGE, S.page * PER_PAGE);
    const t = totalsOf(rows);
    const head = [
      ["property", "Property", ""],
      ["project", "Project", ""],
      ["rooms", "Rooms", "n"],
      ["designs", "Designs", "n"],
      ["approved", "Approved", "n"],
      ["scope", "Scope Range", "n"],
      ["budget_target", "Planned Budget", "n"],
      ["budget_fit", "Budget Fit", ""],
      ["last_activity", "Last Activity", ""],
    ];
    return `<div class="rp-tw"><table class="rp-tbl">
      <thead><tr>${head
        .map((h) => `<th class="${h[2]}" data-sort="${h[0]}">${h[1]}${sortIcon(h[0])}</th>`)
        .join("")}</tr></thead>
      <tbody>${slice
        .map((r) => {
          const f = FIT[r.budget_fit] || FIT.unset;
          const scope = r.priced ? money(r.low) + " – " + money(r.high) : '<span class="mut">Not Priced</span>';
          return `<tr data-open="${esc(r.property_id)}" data-addr="${esc(r.property)}">
            <td><b>${esc(r.property)}</b></td>
            <td>${esc(r.project)}${r.client ? `<span class="mut"> · ${esc(r.client)}</span>` : ""}</td>
            <td class="n">${r.rooms}</td>
            <td class="n">${r.designs}</td>
            <td class="n">${r.approved}/${r.designs}</td>
            <td class="n">${scope}</td>
            <td class="n">${r.budget_target != null ? money(r.budget_target) : '<span class="mut">—</span>'}</td>
            <td><span class="rp-pill ${f[0]}">${f[1]}</span></td>
            <td>${fmtDate(r.last_activity)}</td>
          </tr>`;
        })
        .join("")}</tbody>
      <tfoot><tr><td>Totals</td><td>${rows.length} ${rows.length === 1 ? "row" : "rows"}</td>
        <td class="n">${t.rooms}</td><td class="n">${t.designs}</td><td class="n">${t.approved}/${t.designs}</td>
        <td class="n">${t.high ? money(t.low) + " – " + money(t.high) : "—"}</td>
        <td class="n">${t.budget ? money(t.budget) : "—"}</td><td></td><td></td></tr></tfoot>
    </table></div>
    ${
      pages > 1
        ? `<div class="rp-page"><span>Page ${S.page} of ${pages} · ${rows.length} rows</span>
      <span><button class="btn btn-ghost btn-xs" data-a="prev"${S.page === 1 ? " disabled" : ""}>Previous</button>
      <button class="btn btn-ghost btn-xs" data-a="next"${S.page === pages ? " disabled" : ""}>Next</button></span></div>`
        : ""
    }`;
  };
  return `<div class="rp-sec">
    <div class="rp-sec-h">
      <div><h3>Portfolio Rollup</h3><div class="sub">Every property and project, with priced scope and budget fit</div></div>
      <div class="rp-filters">
        <div class="rp-search"><i data-lucide="search"></i><input id="rpSearch" type="text" placeholder="Search Property, Project Or Client" value="${esc(S.q)}"></div>
        <select id="rpFit" aria-label="Budget fit filter">
          <option value="all"${S.fit === "all" ? " selected" : ""}>All Budget Fits</option>
          <option value="on_track"${S.fit === "on_track" ? " selected" : ""}>On Track</option>
          <option value="near_limit"${S.fit === "near_limit" ? " selected" : ""}>Near Limit</option>
          <option value="over"${S.fit === "over" ? " selected" : ""}>Over Budget</option>
          <option value="unset"${S.fit === "unset" ? " selected" : ""}>Not Set</option>
        </select>
      </div>
    </div>
    <div class="rp-sec-b flush">${body()}</div>
  </div>`;
}

function progressHtml() {
  if (S.error) return "";
  if (!S.data) return "";
  const c = S.data.statusCounts;
  const total = STATUS_SEG.reduce((s, x) => s + (c[x[0]] || 0), 0);
  const bar = total
    ? `<div class="rp-stat">${STATUS_SEG.map(
        (x) =>
          `<i data-status="${x[0]}" title="${x[1]}" style="width:${((c[x[0]] || 0) / total) * 100}%;background:${x[2]}"></i>`,
      ).join("")}</div>`
    : "";
  return `<div class="rp-sec"><div class="rp-sec-h"><div><h3>Design Progress</h3><div class="sub">Design status across ${rangeLabel().toLowerCase()}</div></div></div>
  <div class="rp-sec-b">
    ${total ? bar : '<p class="rp-note">No designs created during this period.</p>'}
    <div class="rp-legend">${STATUS_SEG.map(
      (x) =>
        `<button data-status="${x[0]}"><span class="dot" style="background:${x[2]}"></span>${x[1]} <b>${c[x[0]] || 0}</b></button>`,
    ).join("")}</div>
  </div></div>`;
}

function creditsHtml() {
  if (S.error && !S.data) return "";
  const inner = () => {
    if (S.loading && !S.data) return `<div class="rp-sec-b">${'<div class="rp-sk line"></div>'.repeat(5)}</div>`;
    if (S.error) return errHtml();
    if (!S.data) return "";
    const cr = S.data.credits;
    const entries = Object.keys(cr.byType)
      .map((k) => [k, cr.byType[k]])
      .sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 0;
    const series = cr.daily;
    const peak = series.reduce((m, d) => Math.max(m, d.credits), 0);
    const chart = series.length
      ? `<div class="rp-bars">${series
          .map((d) => `<i class="on" style="height:${peak ? Math.max(4, (d.credits / peak) * 100) : 4}%" title="${d.date}: ${d.credits}"></i>`)
          .join("")}</div><div class="rp-axis"><span>${series[0].date}</span><span>${series[series.length - 1].date}</span></div>`
      : "";
    const tx = cr.tx;
    return `<div class="rp-sec-b">
      <div class="rp-kv">
        <div><div class="l">Credits Used</div><b>${cr.used}</b></div>
        <div><div class="l">Credits Remaining</div><b>${cr.plan === "free" ? cr.freeRemainingToday + " Today" : cr.remaining}</b></div>
        <div><div class="l">Average Per Project</div><b>${cr.perProject}</b></div>
      </div>
      ${
        entries.length
          ? `<div class="rp-use">${entries
              .map(
                (e) =>
                  `<div class="r"><span class="l">${esc(CREDIT_LABEL[e[0]] || e[0])}</span><span class="m"><i style="width:${
                    max ? Math.round((e[1] / max) * 100) : 0
                  }%"></i></span><b>${e[1]}</b></div>`,
              )
              .join("")}</div>${chart}
          <div class="rp-tw"><table class="rp-tbl" style="min-width:520px">
            <thead><tr><th>Date</th><th>Action</th><th>Property Or Note</th><th class="n">Credits</th><th class="n">Balance</th></tr></thead>
            <tbody>${tx
              .slice(0, 12)
              .map(
                (t) =>
                  `<tr><td>${fmtDate(t.created_at)}</td><td>${esc(CREDIT_LABEL[t.action] || t.action)}</td><td class="mut">${esc(
                    t.note || "—",
                  )}</td><td class="n">${t.delta < 0 ? Math.abs(t.delta) : "+" + t.delta}</td><td class="n">${t.balance_after}</td></tr>`,
              )
              .join("")}</tbody>
          </table></div>`
          : '<p class="rp-note">No credits used during this period.</p>'
      }
    </div>`;
  };
  return `<div class="rp-sec"><div class="rp-sec-h"><div><h3>Credit Usage</h3><div class="sub">${rangeLabel()}</div></div></div>${inner()}</div>`;
}

function clientsHtml() {
  if (S.error && !S.data) return "";
  const inner = () => {
    if (S.loading && !S.data) return `<div class="rp-sec-b">${'<div class="rp-sk line"></div>'.repeat(5)}</div>`;
    if (S.error) return errHtml();
    if (!S.data) return "";
    const c = S.data.clients;
    const eligible = S.data.summary.designsCreated > 0;
    const kv = [
      ["Shared", c.shared],
      ["Viewed", c.viewed],
      ["Changes", c.changes],
      ["Approved", c.approved],
    ];
    return `<div class="rp-sec-b">
      <div class="rp-kv" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${kv.map((k) => `<div><div class="l">${k[0]}</div><b>${k[1]}</b></div>`).join("")}
      </div>
      ${
        c.recent.length
          ? c.recent
              .slice(0, 8)
              .map(
                (a) =>
                  `<button class="rp-act" data-pkg="${esc(a.package_id)}"><i data-lucide="activity"></i>
                <span class="m"><b>${esc(a.client || "Guest")} · ${esc(actLabel(a.kind))}</b>
                <span>${esc(a.title)}${a.property ? " · " + esc(a.property) : ""}</span></span>
                <time>${fmtDateTime(a.created_at)}</time></button>`,
              )
              .join("")
          : `<p class="rp-note">No client activity during this period.</p>${
              eligible
                ? '<button class="btn btn-ghost btn-xs" data-a="present"><i data-lucide="presentation"></i>Create Presentation</button>'
                : ""
            }`
      }
    </div>`;
  };
  return `<div class="rp-sec"><div class="rp-sec-h"><div><h3>Client Activity</h3><div class="sub">Presentation sharing and decisions</div></div></div>${inner()}</div>`;
}

function actLabel(kind) {
  const m = {
    view: "Viewed The Presentation",
    comment: "Left A Comment",
    decision: "Made A Decision",
    share: "Link Shared",
    created: "Package Created",
    updated: "Package Updated",
  };
  return m[kind] || String(kind || "Activity").replace(/_/g, " ");
}

/* ---------------- events ---------------- */

function onInput(e) {
  if (e.target.id === "rpSearch") {
    S.q = e.target.value;
    S.page = 1;
    render();
  }
}

function onChange(e) {
  const id = e.target.id;
  if (id === "rpRange") {
    S.range = e.target.value;
    S.page = 1;
    if (S.range === "custom") return render();
    return load(false);
  }
  if (id === "rpFrom" || id === "rpTo") {
    if (id === "rpFrom") S.customFrom = e.target.value;
    else S.customTo = e.target.value;
    if (S.customFrom || S.customTo) load(false);
    return;
  }
  if (id === "rpProp") {
    S.propertyId = e.target.value;
    S.page = 1;
    return load(false);
  }
  if (id === "rpFit") {
    S.fit = e.target.value;
    S.page = 1;
    return render();
  }
}

function onClick(e) {
  const th = e.target.closest("th[data-sort]");
  if (th) {
    const k = th.getAttribute("data-sort");
    if (S.sort === k) S.dir = S.dir === "asc" ? "desc" : "asc";
    else {
      S.sort = k;
      S.dir = k === "property" || k === "project" ? "asc" : "desc";
    }
    return render();
  }
  const seg = e.target.closest("[data-status]");
  if (seg) return openDesigns(seg.getAttribute("data-status"));
  const pkg = e.target.closest("[data-pkg]");
  if (pkg) {
    try {
      window.__rdOpenPackage && window.__rdOpenPackage(pkg.getAttribute("data-pkg"));
    } catch (_) {}
    return go("present");
  }
  const row = e.target.closest("tr[data-open]");
  if (row) return openProperty(row.getAttribute("data-addr"));
  const b = e.target.closest("[data-a]");
  if (!b || b.disabled) return;
  const a = b.getAttribute("data-a");
  if (a === "refresh") return load(true);
  if (a === "expmenu") {
    S.menu = !S.menu;
    const m = document.getElementById("rpExpMenu");
    if (m) m.classList.toggle("on", S.menu);
    return;
  }
  if (a === "csv") {
    S.menu = false;
    exportCsv();
    return render();
  }
  if (a === "pdf") {
    S.menu = false;
    exportPdf();
    return render();
  }
  if (a === "prev") {
    S.page = Math.max(1, S.page - 1);
    return render();
  }
  if (a === "next") {
    S.page = S.page + 1;
    return render();
  }
  if (a === "clearfilters") {
    S.q = "";
    S.fit = "all";
    S.page = 1;
    return render();
  }
  if (a === "newprop") return go("props");
  if (a === "studio") return go("studio");
  if (a === "present") return go("present");
}

/** Open the Designs page with the matching status tab applied. */
function openDesigns(status) {
  const idx = { all: 0, approved: 1, review: 2, archived: 3 }[status];
  go("designs");
  setTimeout(() => {
    const tabs = document.querySelectorAll("#designTabs button");
    const t = tabs[idx == null ? 0 : idx];
    if (t) t.click();
  }, 60);
}

/** Open the property in the Properties tree. */
function openProperty(address) {
  go("props");
  setTimeout(() => {
    const rows = Array.from(document.querySelectorAll("#propTree .tr.l1, .tr.l1"));
    const hit = rows.find((r) => (r.getAttribute("title") || r.textContent || "").trim().startsWith(address));
    if (hit) hit.click();
  }, 80);
}

/* ---------------- export ---------------- */

function csvCell(v) {
  return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
}

function exportCsv() {
  const rows = filteredRows();
  if (!rows.length) return toast("No Records To Export");
  const head = [
    "Property",
    "Project",
    "Client",
    "Rooms",
    "Designs",
    "Approved Designs",
    "Approval Rate",
    "Scope Minimum",
    "Scope Maximum",
    "Planned Budget",
    "Budget Variance",
    "Budget Fit",
    "Last Activity",
  ];
  const lines = [head.map(csvCell).join(",")].concat(
    rows.map((r) =>
      [
        r.property,
        r.project,
        r.client,
        r.rooms,
        r.designs,
        r.approved,
        r.designs ? Math.round((r.approved / r.designs) * 100) + "%" : "0%",
        r.priced ? Math.round(r.low) : "",
        r.priced ? Math.round(r.high) : "",
        r.budget_target == null ? "" : Math.round(r.budget_target),
        r.budget_target == null || !r.priced ? "" : Math.round(r.budget_target - r.high),
        (FIT[r.budget_fit] || FIT.unset)[1],
        r.last_activity || "",
      ]
        .map(csvCell)
        .join(","),
    ),
  );
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "real-designs-report-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast("CSV Downloaded");
}

function pdfPage(inner, n, total) {
  return `<section class="pg"><header><span class="brand"><b>REAL</b> DESIGNS</span><span>Workspace Report · ${esc(
    rangeLabel(),
  )}</span></header><div class="body">${inner}</div><footer><span>Generated ${new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}</span><span>Page ${n} of ${total}</span></footer></section>`;
}

function exportPdf() {
  const d = S.data;
  if (!d) return;
  const rows = filteredRows();
  if (!rows.length) return toast("No Records To Export");
  const propName = S.propertyId
    ? (d.properties.find((p) => p.id === S.propertyId) || {}).address || "Selected Property"
    : "All Properties";
  const s = d.summary;
  const t = totalsOf(rows);
  const chunks = [];
  for (let i = 0; i < rows.length; i += 18) chunks.push(rows.slice(i, i + 18));
  const totalPages = 1 + chunks.length;

  const summary = `<h1>Workspace Report</h1>
    <p class="meta">Period: ${esc(rangeLabel())} · Property: ${esc(propName)} · Budget Fit: ${esc(
      S.fit === "all" ? "All" : (FIT[S.fit] || FIT.unset)[1],
    )}${S.q ? " · Search: " + esc(S.q) : ""}</p>
    <div class="cards">
      <div><span>Active Projects</span><b>${s.activeProjects}</b></div>
      <div><span>Designs Created</span><b>${s.designsCreated}</b></div>
      <div><span>Approved Designs</span><b>${s.approvedDesigns} (${s.approvalRate}%)</b></div>
      <div><span>Planned Budget</span><b>${s.plannedBudget ? money(s.plannedBudget) : "Not Set"}</b></div>
    </div>
    <h2>Design Progress</h2>
    <table><thead><tr><th>Draft</th><th>In Review</th><th>Approved</th><th>Archived</th></tr></thead>
    <tbody><tr><td>${d.statusCounts.draft}</td><td>${d.statusCounts.review}</td><td>${d.statusCounts.approved}</td><td>${d.statusCounts.archived}</td></tr></tbody></table>
    <h2>Credit Usage</h2>
    <table><thead><tr><th>Used</th><th>Remaining</th><th>Average Per Project</th><th>Top Category</th></tr></thead>
    <tbody><tr><td>${d.credits.used}</td><td>${d.credits.plan === "free" ? d.credits.freeRemainingToday + " Today" : d.credits.remaining}</td><td>${d.credits.perProject}</td><td>${esc(
      Object.keys(d.credits.byType).sort((a, b) => d.credits.byType[b] - d.credits.byType[a]).map((k) => CREDIT_LABEL[k] || k)[0] || "None",
    )}</td></tr></tbody></table>
    <h2>Client Activity</h2>
    <table><thead><tr><th>Links Shared</th><th>Viewed</th><th>Changes Requested</th><th>Approved</th></tr></thead>
    <tbody><tr><td>${d.clients.shared}</td><td>${d.clients.viewed}</td><td>${d.clients.changes}</td><td>${d.clients.approved}</td></tr></tbody></table>`;

  const tableHead = `<tr><th>Property</th><th>Project</th><th>Rooms</th><th>Designs</th><th>Approved</th><th>Scope Range</th><th>Budget</th><th>Fit</th><th>Last Activity</th></tr>`;
  const pages = [pdfPage(summary, 1, totalPages)].concat(
    chunks.map((ch, i) =>
      pdfPage(
        `<h2>Portfolio Rollup${chunks.length > 1 ? " (" + (i + 1) + " of " + chunks.length + ")" : ""}</h2>
        <table><thead>${tableHead}</thead><tbody>${ch
          .map(
            (r) =>
              `<tr><td>${esc(r.property)}</td><td>${esc(r.project)}</td><td>${r.rooms}</td><td>${r.designs}</td><td>${r.approved}</td><td>${
                r.priced ? money(r.low) + " – " + money(r.high) : "Not Priced"
              }</td><td>${r.budget_target != null ? money(r.budget_target) : "—"}</td><td>${
                (FIT[r.budget_fit] || FIT.unset)[1]
              }</td><td>${fmtDate(r.last_activity)}</td></tr>`,
          )
          .join("")}${
          i === chunks.length - 1
            ? `<tr class="tot"><td>Totals</td><td>${rows.length} rows</td><td>${t.rooms}</td><td>${t.designs}</td><td>${t.approved}</td><td>${
                t.high ? money(t.low) + " – " + money(t.high) : "—"
              }</td><td>${t.budget ? money(t.budget) : "—"}</td><td></td><td></td></tr>`
            : ""
        }</tbody></table>`,
        i + 2,
        totalPages,
      ),
    ),
  );

  const w = window.open("", "_blank");
  if (!w) return toast("Allow Pop-Ups To Download The PDF");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>REAL DESIGNS Report</title><style>
    *{box-sizing:border-box} body{margin:0;font-family:'DM Sans',system-ui,sans-serif;color:#111827;background:#f3f4f6}
    .pg{width:8.5in;min-height:11in;margin:0 auto 16px;background:#fff;padding:0.6in;display:flex;flex-direction:column}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #c00;padding-bottom:8px;font-size:11px;color:#6b7280}
    .brand{font-weight:700;color:#111827;letter-spacing:.14em;font-size:12px}
    .brand b{color:#c00}
    .body{flex:1;padding-top:18px}
    footer{display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:8px;font-size:10.5px;color:#9ca3af}
    h1{font-size:22px;margin:0 0 6px} h2{font-size:14px;margin:20px 0 8px} .meta{font-size:11.5px;color:#6b7280;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
    .cards div{border:1px solid #e5e7eb;border-radius:10px;padding:10px}
    .cards span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px}
    .cards b{font-size:17px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{text-align:left;text-transform:uppercase;letter-spacing:.06em;font-size:9px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding:6px 5px}
    td{padding:6px 5px;border-bottom:1px solid #f1f2f4}
    tr.tot td{font-weight:700;background:#fafafa}
    @media print{ body{background:#fff} .pg{margin:0;page-break-after:always;box-shadow:none} .pg:last-child{page-break-after:auto} }
  </style></head><body>${pages.join("")}</body></html>`);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch (_) {}
  }, 400);
  toast("PDF Report Ready");
}
