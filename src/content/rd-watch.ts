/**
 * Watch A Site — monitor a listing site the user owns and prepare videos for
 * new properties. Nothing runs until the user attests, in writing, that they
 * own the site and have the right to the data on it.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import {
  listWatchedSites,
  addWatchedSite,
  removeWatchedSite,
  checkWatchSite,
  ATTESTATION_TEXT,
} from "@/lib/watch-sites.functions";

const S: any = {
  sites: null,
  loading: true,
  error: "",
  busy: false,
  check: null,
  form: {
    site_url: "",
    period: "weekly",
    watch_since: "",
    video_type: "listing_video",
    new_listing_mode: "review",
    attested: false,
  },
};

function host() {
  return document.getElementById("v-watch");
}
function esc(s: any) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(m: string) {
  try {
    (window as any).rdToast ? (window as any).rdToast(m) : console.log(m);
  } catch (_) {}
}
function fmt(d: any) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (_) {
    return "—";
  }
}

export async function mountWatch(go: any) {
  if (!host()) return;
  render();
  if (!S.sites) await load();
}

async function load() {
  S.loading = true;
  render();
  try {
    const out: any = await listWatchedSites();
    S.sites = out.sites || [];
    S.error = "";
  } catch (e: any) {
    S.sites = [];
    S.error = e?.message || "Could not load your monitored sites.";
  }
  S.loading = false;
  render();
}

function seg(name: string, value: string, opts: Array<[string, string]>) {
  return `<div class="wt-seg">${opts
    .map(([id, label]) => `<button class="${value === id ? "on" : ""}" data-seg="${name}" data-val="${id}">${label}</button>`)
    .join("")}</div>`;
}

function formHtml() {
  const f = S.form;
  const chk = S.check;
  return `<div class="card wt-card">
    <div class="card-h"><div><h3>Add A Listing Site</h3>
      <div class="sub">Point Us At Your Own Listing Site. We Will Watch For New Properties And Prepare Videos, With Optional Auto Generate Or Manual Review.</div></div></div>
    <div class="card-b wt-form">
      <label class="wt-f">Website URL
        <span class="wt-row">
          <input id="wtUrl" type="url" placeholder="https://your-site.com" value="${esc(f.site_url)}">
          <button class="btn btn-ghost btn-xs" id="wtCheck">Check</button>
        </span>
        <em>Enter The Homepage Or Any Listing Page On Your Site.</em>
      </label>
      ${chk ? `<div class="wt-check ${chk.ok && chk.robots_ok && chk.reachable ? "ok" : "bad"}"><i data-lucide="${chk.ok && chk.robots_ok && chk.reachable ? "check-circle-2" : "triangle-alert"}"></i><span>${esc(chk.reason)}</span></div>` : ""}

      <label class="wt-f">Monitoring Period ${seg("period", f.period, [["weekly", "Weekly"], ["monthly", "Monthly"]])}</label>

      <label class="wt-f">Watch Since
        <input id="wtSince" type="date" value="${esc(f.watch_since)}">
        <em>Listings Modified On Or After This Date. Older Listings Are Recorded But Skipped.</em>
      </label>

      <label class="wt-f">Video Type ${seg("video_type", f.video_type, [["listing_video", "Listing Video"], ["social_reel", "Social Reel"]])}</label>

      <div class="wt-f">New Listings
        <label class="wt-radio"><input type="radio" name="wtMode" value="review" ${f.new_listing_mode === "review" ? "checked" : ""}>
          <span><b>I Will Review First</b><em>We Email You With New Properties. You Decide Which Ones Become Videos.</em></span></label>
        <label class="wt-radio"><input type="radio" name="wtMode" value="auto" ${f.new_listing_mode === "auto" ? "checked" : ""}>
          <span><b>Create Videos Automatically</b><em>We Start A Video For Every New Property.</em></span></label>
      </div>

      <div class="wt-attest">
        <b>Ownership And Permission</b>
        <p>This Feature Only Works For Sites You Own And Have Permission To Pull From.</p>
        <label class="wt-check-box"><input type="checkbox" id="wtAttest" ${f.attested ? "checked" : ""}>
          <span>${esc(ATTESTATION_TEXT)} See Our <a href="/terms" target="_blank" rel="noopener">Terms Of Use</a>.</span></label>
      </div>

      <div class="wt-actions">
        <button class="btn btn-primary" id="wtStart" ${f.attested && f.site_url.trim() && !S.busy ? "" : "disabled"}>${S.busy ? "Starting" : "Start Monitoring"}</button>
      </div>
      <div class="wt-note">We Respect robots.txt, Rate Limit Politely And Identify Ourselves As REAL DESIGNS On Every Request.</div>
    </div>
  </div>`;
}

function listHtml() {
  if (S.loading) return `<div class="card"><div class="card-b"><div class="wt-empty">Loading Your Monitored Sites</div></div></div>`;
  const rows = S.sites || [];
  return `<div class="card wt-card">
    <div class="card-h"><div><h3>Sites You Are Watching</h3><div class="sub">${rows.length} Site${rows.length === 1 ? "" : "s"}</div></div></div>
    <div class="card-b">
      ${rows.length
        ? `<div class="wt-list">${rows
            .map(
              (r: any) => `<div class="wt-row-item">
        <div class="wt-site"><b>${esc(r.host)}</b><span>${esc(r.site_url)}</span></div>
        <div class="wt-meta mono">${r.period === "monthly" ? "Monthly" : "Weekly"} · ${r.video_type === "social_reel" ? "Social Reel" : "Listing Video"} · ${r.new_listing_mode === "auto" ? "Auto Create" : "Review First"}</div>
        <div class="wt-meta">Since ${fmt(r.watch_since)} · Attested ${fmt(r.attested_at)}</div>
        <button class="btn btn-ghost btn-xs" data-remove="${r.id}"><i data-lucide="trash-2"></i>Remove</button>
      </div>`,
            )
            .join("")}</div>`
        : `<div class="wt-empty">No Sites Yet. Add The Site You Own Above And We Will Watch It For New Listings.</div>`}
    </div>
  </div>`;
}

function render() {
  const el = host();
  if (!el) return;
  el.innerHTML = `${S.error ? `<div class="wt-check bad"><i data-lucide="triangle-alert"></i><span>${esc(S.error)}</span></div>` : ""}
  ${formHtml()}
  ${listHtml()}`;
  try {
    createIcons({ icons, root: el } as any);
  } catch (_) {}
  wire(el);
}

function wire(el: HTMLElement) {
  const urlInput = el.querySelector("#wtUrl") as HTMLInputElement | null;
  urlInput?.addEventListener("input", () => {
    S.form.site_url = urlInput.value;
    const btn = el.querySelector("#wtStart") as HTMLButtonElement | null;
    if (btn) btn.disabled = !(S.form.attested && S.form.site_url.trim()) || S.busy;
  });
  (el.querySelector("#wtSince") as HTMLInputElement | null)?.addEventListener("change", (e: any) => {
    S.form.watch_since = e.target.value;
  });
  el.querySelectorAll("[data-seg]").forEach((b: any) =>
    b.addEventListener("click", () => {
      S.form[b.dataset.seg] = b.dataset.val;
      render();
    }),
  );
  el.querySelectorAll('input[name="wtMode"]').forEach((r: any) =>
    r.addEventListener("change", () => {
      S.form.new_listing_mode = r.value;
    }),
  );
  const att = el.querySelector("#wtAttest") as HTMLInputElement | null;
  att?.addEventListener("change", () => {
    S.form.attested = !!att.checked;
    const btn = el.querySelector("#wtStart") as HTMLButtonElement | null;
    if (btn) btn.disabled = !(S.form.attested && S.form.site_url.trim()) || S.busy;
  });

  (el.querySelector("#wtCheck") as HTMLButtonElement | null)?.addEventListener("click", async (e: any) => {
    if (!S.form.site_url.trim()) return toast("Enter Your Website Address First.");
    e.currentTarget.disabled = true;
    try {
      S.check = await checkWatchSite({ data: { site_url: S.form.site_url.trim() } });
    } catch (err: any) {
      S.check = { ok: false, reason: err?.message || "We could not check that address." };
    }
    render();
  });

  (el.querySelector("#wtStart") as HTMLButtonElement | null)?.addEventListener("click", async () => {
    if (!S.form.attested) return;
    S.busy = true;
    render();
    try {
      await addWatchedSite({
        data: {
          site_url: S.form.site_url.trim(),
          period: S.form.period,
          watch_since: S.form.watch_since || null,
          video_type: S.form.video_type,
          new_listing_mode: S.form.new_listing_mode,
          attested: true,
        },
      });
      S.form = { site_url: "", period: "weekly", watch_since: "", video_type: "listing_video", new_listing_mode: "review", attested: false };
      S.check = null;
      toast("Monitoring Started.");
      S.busy = false;
      await load();
    } catch (e: any) {
      S.busy = false;
      toast(e?.message || "We could not start monitoring that site.");
      render();
    }
  });

  el.querySelectorAll("[data-remove]").forEach((b: any) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await removeWatchedSite({ data: { id: b.dataset.remove } });
        toast("Monitoring Stopped.");
        await load();
      } catch (e: any) {
        b.disabled = false;
        toast(e?.message || "Could not remove that site.");
      }
    }),
  );
}
