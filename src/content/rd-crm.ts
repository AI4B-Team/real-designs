/**
 * CRM Sync — connect Follow Up Boss, HubSpot or a custom webhook, pull the
 * contact list in, and push finished videos, presentations and designs back
 * out to the CRM timeline.
 */
import { createIcons, icons } from "lucide";
import { listCrm, connectCrm, disconnectCrm, setCrmAutoPush, syncCrmContacts, pushToCrm } from "@/lib/crm.functions";

const PROVIDERS: Array<{ id: string; name: string; icon: string; blurb: string; keyLabel: string; keyHelp: string; needsUrl?: boolean }> = [
  {
    id: "followupboss",
    name: "Follow Up Boss",
    icon: "contact",
    blurb: "Sync people and log every shared design as a note on their timeline.",
    keyLabel: "API Key",
    keyHelp: "Follow Up Boss → Admin → API, then create a key.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: "briefcase",
    blurb: "Pull contacts and write notes against the matching HubSpot record.",
    keyLabel: "Private App Token",
    keyHelp: "HubSpot → Settings → Integrations → Private Apps.",
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    icon: "webhook",
    blurb: "Post every share event to your own endpoint, signed with your secret.",
    keyLabel: "Signing Secret",
    keyHelp: "Any strong random string. We send it as X-Real-Designs-Signature.",
    needsUrl: true,
  },
];

const S: any = { data: null, loading: true, busy: "", picked: "", error: "" };
let GO: any = null;

function esc(s: any) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
function host() {
  return document.getElementById("v-crm");
}
function toast(msg: string) {
  try {
    (window as any).rdToast ? (window as any).rdToast(msg) : console.log(msg);
  } catch (_) {}
}
function fmt(d: any) {
  if (!d) return "Never";
  try {
    return new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch (_) {
    return "—";
  }
}

export async function mountCrm(go: any) {
  GO = go;
  if (!host()) return;
  if (!S.data) await load();
  else render();
}

async function load() {
  S.loading = true;
  render();
  try {
    S.data = await listCrm();
    S.error = "";
  } catch (e: any) {
    S.error = e?.message || "Could not load your CRM connections.";
  }
  try {
    const who: any = await isSignupAdmin();
    S.admin = !!who?.admin;
    if (S.admin) S.signups = await listSignupSurveys();
  } catch (_) {
    S.admin = false;
  }
  S.loading = false;
  render();
}


function connectionFor(id: string) {
  return (S.data?.connections || []).find((c: any) => c.provider === id) || null;
}

function render() {
  const el = host();
  if (!el) return;
  if (S.loading && !S.data) {
    el.innerHTML = `<div class="card"><div class="card-b"><p class="mono">Loading Your CRM Connections…</p></div></div>`;
    return;
  }
  const contacts = S.data?.contacts || [];
  const log = S.data?.log || [];

  el.innerHTML = `
  <div class="crm">
    ${S.error ? `<div class="note"><i data-lucide="alert-triangle"></i><span>${esc(S.error)}</span></div>` : ""}

    <div class="grid g3" style="margin-bottom:16px">
      ${PROVIDERS.map((p) => card(p)).join("")}
    </div>

    <div class="grid g2">
      <div class="card">
        <div class="card-h"><div><h3>Synced Contacts</h3><div class="sub">${contacts.length} Pulled From Your CRM</div></div>
          ${contacts.length ? `<button class="btn btn-ghost btn-xs" data-push><i data-lucide="send"></i>Send To Contact</button>` : ""}</div>
        <div class="card-b" style="padding-top:4px">
          ${
            contacts.length
              ? `<table><thead><tr><th>Name</th><th>Email</th><th>Stage</th><th style="text-align:right">Last Activity</th></tr></thead><tbody>
                  ${contacts
                    .slice(0, 25)
                    .map(
                      (c: any) => `<tr><td><b>${esc(c.name || "Unnamed")}</b></td><td class="mono">${esc(c.email || "—")}</td>
                      <td>${esc(c.stage || "—")}</td><td style="text-align:right" class="mono">${esc(fmt(c.last_activity_at))}</td></tr>`,
                    )
                    .join("")}
                </tbody></table>`
              : `<p class="mono" style="color:var(--mute-2)">Connect a CRM and run a sync to pull your contacts in.</p>`
          }
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div><h3>Sync Activity</h3><div class="sub">Last 25 Events</div></div></div>
        <div class="card-b" style="padding-top:4px">
          ${
            log.length
              ? log
                  .slice(0, 25)
                  .map(
                    (l: any) => `<div class="rowi"><div class="rowt"><b>${esc(actionLabel(l.action))}</b><span>${esc(l.detail || "")}</span></div>
                    <span class="pill ${l.status === "ok" ? "p-ok" : "p-warn"}">${l.status === "ok" ? "Done" : "Failed"}</span></div>`,
                  )
                  .join("")
              : `<p class="mono" style="color:var(--mute-2)">Nothing has synced yet.</p>`
          }
        </div>
      </div>
    </div>
  </div>`;

  bind();
  try {
    createIcons({ icons, root: el } as any);
  } catch (_) {}
}

function actionLabel(a: string) {
  return a === "connect" ? "Connection Verified" : a === "sync_contacts" ? "Contacts Synced" : "Content Pushed";
}

function card(p: any) {
  const c = connectionFor(p.id);
  const open = S.picked === p.id;
  return `
  <div class="card crm-card${c ? " on" : ""}">
    <div class="card-h"><div><h3><i data-lucide="${p.icon}"></i> ${esc(p.name)}</h3><div class="sub">${esc(p.blurb)}</div></div>
      <span class="pill ${c ? (c.status === "connected" ? "p-ok" : "p-warn") : "p-mute"}">${c ? (c.status === "connected" ? "Connected" : "Needs Attention") : "Not Connected"}</span></div>
    <div class="card-b">
      ${
        c
          ? `<div class="crm-meta">
              <div><span>Account</span><b>${esc(c.account_name || p.name)}</b></div>
              <div><span>Key</span><b class="mono">${esc(c.key_hint || "—")}</b></div>
              <div><span>Last Sync</span><b class="mono">${esc(fmt(c.last_synced_at))}</b></div>
             </div>
             ${c.last_error ? `<div class="note"><i data-lucide="alert-triangle"></i><span>${esc(c.last_error)}</span></div>` : ""}
             <label class="crm-toggle"><input type="checkbox" data-auto="${c.id}" ${c.auto_push ? "checked" : ""}> Push New Videos And Presentations Automatically</label>
             <div class="crm-actions">
               ${p.id !== "webhook" ? `<button class="btn btn-primary btn-xs" data-sync="${c.id}" ${S.busy === c.id ? "disabled" : ""}><i data-lucide="refresh-cw"></i>${S.busy === c.id ? "Syncing…" : "Sync Contacts"}</button>` : ""}
               <button class="btn btn-ghost btn-xs" data-test="${p.id}"><i data-lucide="key-round"></i>Replace Key</button>
               <button class="btn btn-ghost btn-xs" data-off="${c.id}"><i data-lucide="unplug"></i>Disconnect</button>
             </div>`
          : open
            ? form(p)
            : `<button class="btn btn-dark btn-xs" data-open="${p.id}"><i data-lucide="plug"></i>Connect ${esc(p.name)}</button>`
      }
      ${c && open ? form(p) : ""}
    </div>
  </div>`;
}

function form(p: any) {
  return `
  <div class="crm-form">
    ${p.needsUrl ? `<label>Webhook URL<input type="url" data-f="url" placeholder="https://hooks.example.com/real-designs"></label>` : ""}
    <label>${esc(p.keyLabel)}<input type="password" data-f="key" placeholder="Paste Your ${esc(p.keyLabel)}" autocomplete="off"></label>
    <p class="mono crm-help">${esc(p.keyHelp)}</p>
    <div class="crm-actions">
      <button class="btn btn-primary btn-xs" data-save="${p.id}" ${S.busy === p.id ? "disabled" : ""}>${S.busy === p.id ? "Verifying…" : "Verify And Save"}</button>
      <button class="btn btn-ghost btn-xs" data-cancel>Cancel</button>
    </div>
  </div>`;
}

function bind() {
  const el = host();
  if (!el) return;
  el.querySelectorAll("[data-open]").forEach((b: any) => (b.onclick = () => { S.picked = b.dataset.open; render(); }));
  el.querySelectorAll("[data-test]").forEach((b: any) => (b.onclick = () => { S.picked = b.dataset.test; render(); }));
  el.querySelectorAll("[data-cancel]").forEach((b: any) => (b.onclick = () => { S.picked = ""; render(); }));
  el.querySelectorAll("[data-save]").forEach((b: any) => (b.onclick = () => save(b.dataset.save)));
  el.querySelectorAll("[data-sync]").forEach((b: any) => (b.onclick = () => sync(b.dataset.sync)));
  el.querySelectorAll("[data-off]").forEach((b: any) => (b.onclick = () => drop(b.dataset.off)));
  el.querySelectorAll("[data-auto]").forEach((b: any) => (b.onchange = () => auto(b.dataset.auto, b.checked)));
  const push = el.querySelector("[data-push]") as HTMLElement | null;
  if (push) push.onclick = () => openPush();
}

async function save(provider: string) {
  const el = host();
  const key = (el?.querySelector('.crm-form [data-f="key"]') as HTMLInputElement)?.value?.trim() || "";
  const url = (el?.querySelector('.crm-form [data-f="url"]') as HTMLInputElement)?.value?.trim() || "";
  if (key.length < 6) {
    toast("Paste A Valid Key First.");
    return;
  }
  S.busy = provider;
  render();
  try {
    await connectCrm({ data: { provider: provider as any, credential: key, endpoint: url || null } });
    S.picked = "";
    S.busy = "";
    toast("CRM Connected.");
    await load();
  } catch (e: any) {
    S.busy = "";
    toast(e?.message || "That connection could not be verified.");
    render();
  }
}

async function sync(id: string) {
  S.busy = id;
  render();
  try {
    const out: any = await syncCrmContacts({ data: { id } });
    toast(`${out.synced} Contact${out.synced === 1 ? "" : "s"} Synced.`);
  } catch (e: any) {
    toast(e?.message || "The sync failed.");
  }
  S.busy = "";
  await load();
}

async function drop(id: string) {
  try {
    await disconnectCrm({ data: { id } });
    toast("CRM Disconnected.");
  } catch (e: any) {
    toast(e?.message || "Could not disconnect.");
  }
  await load();
}

async function auto(id: string, on: boolean) {
  try {
    await setCrmAutoPush({ data: { id, auto_push: on } });
  } catch (e: any) {
    toast(e?.message || "Could not save that setting.");
  }
}

/** Send a link (video, presentation, design) into the CRM timeline. */
export function openPush(seed?: { title?: string; body?: string; link?: string }) {
  const conns = S.data?.connections || [];
  const contacts = S.data?.contacts || [];
  if (!conns.length) {
    toast("Connect A CRM First.");
    GO?.("crm");
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Send To CRM" style="max-width:520px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 12px">Send To CRM</h3>
    <div class="crm-form">
      <label>CRM<select data-f="conn">${conns.map((c: any) => `<option value="${c.id}">${esc(c.label || c.provider)}</option>`).join("")}</select></label>
      <label>Contact<select data-f="contact"><option value="">No Contact — Log Only</option>${contacts
        .map((c: any) => `<option value="${c.id}">${esc(c.name || c.email || "Unnamed")}</option>`)
        .join("")}</select></label>
      <label>Title<input type="text" data-f="title" value="${esc(seed?.title || "New Design From REAL DESIGNS")}"></label>
      <label>Message<textarea data-f="body" rows="3">${esc(seed?.body || "")}</textarea></label>
      <label>Link<input type="url" data-f="link" value="${esc(seed?.link || "")}" placeholder="https://"></label>
      <div class="crm-actions"><button class="btn btn-primary btn-xs" data-send><i data-lucide="send"></i>Send</button>
        <button class="btn btn-ghost btn-xs" data-x>Cancel</button></div>
    </div>
  </div>`;
  (document.querySelector(".rd-app") || document.body).appendChild(wrap);
  try { createIcons({ icons, root: wrap } as any); } catch (_) {}
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.querySelectorAll("[data-x]").forEach((b: any) => (b.onclick = close));
  const val = (k: string) => (wrap.querySelector(`[data-f="${k}"]`) as HTMLInputElement)?.value?.trim() || "";
  (wrap.querySelector("[data-send]") as HTMLButtonElement).onclick = async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const out: any = await pushToCrm({
        data: {
          connectionId: val("conn"),
          contactId: val("contact") || null,
          title: val("title") || "REAL DESIGNS Update",
          body: val("body"),
          link: val("link") || null,
        },
      });
      close();
      toast(out.detail || "Sent To Your CRM.");
      await load();
    } catch (e: any) {
      btn.disabled = false;
      toast(e?.message || "That push failed.");
    }
  };
}
