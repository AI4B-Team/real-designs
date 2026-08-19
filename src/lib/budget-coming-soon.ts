/**
 * One block, used at every budget entry point. It says the same honest thing
 * everywhere: budgets are coming, no numbers are invented in the meantime, and
 * you can tell us which market to price first.
 */
import { createIcons, icons } from "lucide";
import {
  getBudgetAvailability,
  requestBudgetMarket,
  myBudgetRequests,
} from "@/lib/budget.functions";

let cached: { available: boolean; markets: string[]; headline: string; detail: string } | null =
  null;

/**
 * Synchronous read of the single source of truth. Defaults to "not available"
 * so nothing budget related can render optimistically before the check lands.
 */
export function budgetsLive() {
  return !!cached?.available;
}

/** Reflect availability on <html data-budgets="off|on"> so CSS can gate too. */
function reflect(available: boolean) {
  try {
    document.documentElement.dataset["budgets"] = available ? "on" : "off";
  } catch (_) {}
}

export async function budgetAvailability() {
  if (cached) return cached;
  try {
    cached = (await getBudgetAvailability()) as any;
  } catch (_) {
    cached = { available: false, markets: [], headline: "Budgets Are Coming Soon", detail: "" };
  }
  reflect(!!cached!.available);
  return cached!;
}

function esc(s: any) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

function toast(msg: string) {
  try {
    const t = (window as any).rdToast;
    if (typeof t === "function") t(msg);
    else console.log(msg);
  } catch (_) {}
}

export function budgetComingSoonHtml(context?: string) {
  return `
  <section class="bcs" data-bcs>
    <div class="bcs-head">
      <span class="bcs-pill">Coming Soon</span>
      <h2>Budgets Are Coming Soon</h2>
      <p>We Are Not Guessing At Renovation Costs. Budgets Turn On Once Verified Local Contractor Cost Data Is Licensed For Your Market${
        context ? `, So ${esc(context)} Stays Honest` : ""
      }.<br>Until Then You Will Never See A Made Up Number Here.</p>
    </div>
    <ul class="bcs-list">
      <li><i data-lucide="scan-search"></i><div><b>What Already Works</b><span>The Change List From Your Approved Design Is Built And Saved Today.</span></div></li>
      <li><i data-lucide="database"></i><div><b>What We Are Waiting On</b><span>Verified Labor And Material Costs, By Trade, For Your Metro.</span></div></li>
      <li><i data-lucide="badge-check"></i><div><b>What You Will Get</b><span>A Line By Line Planning Range With A Contingency. Never A Bid.</span></div></li>
    </ul>
    <div class="bcs-form">
      <label>Which Market Should We Price First?<input type="text" data-bcs-region placeholder="e.g. Tampa Bay, FL"></label>
      <button class="btn btn-primary btn-xs" data-bcs-send><i data-lucide="bell-plus"></i>Notify Me When It Is Live</button>
      <button class="btn btn-ghost btn-xs" data-bcs-how><i data-lucide="info"></i>How Pricing Will Work</button>
    </div>
    <p class="bcs-note" data-bcs-note></p>
  </section>`;
}

function howModal() {
  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="How Pricing Will Work" style="max-width:560px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 10px">How Pricing Will Work</h3>
    <ol class="bcs-steps">
      <li><b>Compare</b> The Original Photo To The Approved Design And List Only What Actually Changed.</li>
      <li><b>Measure</b> The Room, With Your Confirmation On Every Dimension.</li>
      <li><b>Price</b> Each Line Against Verified Local Labor And Material Costs, By Trade.</li>
      <li><b>Range</b> It Low To High, Add A Contingency, And Show The Source Of Every Line.</li>
    </ol>
    <p class="bcs-note">No Language Model Ever Produces A Dollar Figure. If A Line Cannot Be Priced From Real Data, It Is Left Out Rather Than Estimated.</p>
    <div class="crm-actions"><button class="btn btn-ghost btn-xs" data-x>Close</button></div>
  </div>`;
  (document.querySelector(".rd-app") || document.body).appendChild(wrap);
  try {
    createIcons({ icons, root: wrap } as any);
  } catch (_) {}
  const close = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelectorAll("[data-x]").forEach((b: any) => (b.onclick = close));
}

/**
 * Small informational popover shown wherever a user clicks a Budget entry
 * point. It never navigates, never checks credits and never touches the plan:
 * it only explains that Project Budget is coming and offers the waitlist.
 */
let openPop: HTMLElement | null = null;

export function closeBudgetPopover() {
  if (openPop) {
    openPop.remove();
    openPop = null;
  }
}

export function openBudgetPopover(anchor: HTMLElement) {
  closeBudgetPopover();
  const pop = document.createElement("div");
  pop.className = "bsoon-pop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", BUDGET_TITLE);
  pop.innerHTML = `
    <button class="bsoon-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <div class="bsoon-h"><b>${esc(BUDGET_TITLE)}</b><span class="bsoon-badge">${esc(BUDGET_BADGE)}</span></div>
    <p class="bsoon-d">${esc(BUDGET_DESC)}</p>
    <p class="bsoon-n">${esc(BUDGET_DISCLOSURE)}</p>
    <div class="bsoon-f">
      <input type="text" data-bsoon-region placeholder="Your Market, e.g. Tampa Bay, FL" aria-label="Your Market">
      <button class="btn btn-primary btn-xs" data-bsoon-send>${esc(BUDGET_CTA)}</button>
    </div>
    <p class="bsoon-note" data-bsoon-note></p>`;
  document.body.appendChild(pop);
  openPop = pop;

  const r = anchor.getBoundingClientRect();
  const w = 320;
  const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  const top = Math.min(r.bottom + 8, window.innerHeight - 40);
  pop.style.left = left + "px";
  pop.style.top = top + "px";

  try {
    createIcons({ icons, root: pop } as any);
  } catch (_) {}

  const note = pop.querySelector("[data-bsoon-note]") as HTMLElement | null;
  const input = pop.querySelector("[data-bsoon-region]") as HTMLInputElement | null;
  const send = pop.querySelector("[data-bsoon-send]") as HTMLButtonElement | null;
  if (send) {
    send.onclick = async () => {
      const region = input?.value?.trim() || "";
      if (region.length < 2) {
        toast("Add Your Market First.");
        input?.focus();
        return;
      }
      send.disabled = true;
      try {
        await requestBudgetMarket({ data: { region } });
        if (note) note.textContent = `Thanks. We Will Email You When ${region} Goes Live.`;
        if (input) input.value = "";
      } catch (e: any) {
        if (note) note.textContent = e?.message || "Could Not Save That Request.";
      }
      send.disabled = false;
    };
  }

  const onDoc = (e: MouseEvent) => {
    if (!pop.contains(e.target as Node) && e.target !== anchor) dismiss();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") dismiss();
  };
  function dismiss() {
    document.removeEventListener("mousedown", onDoc);
    document.removeEventListener("keydown", onKey);
    closeBudgetPopover();
    try {
      anchor.focus();
    } catch (_) {}
  }
  pop.querySelectorAll("[data-x]").forEach((b: any) => (b.onclick = dismiss));
  setTimeout(() => {
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
  }, 0);
  return pop;
}

/** Render the block into a host element and wire the waitlist form. */
export async function mountBudgetComingSoon(host: HTMLElement, context?: string) {
  const avail = await budgetAvailability();
  if (avail.available) return false;
  host.innerHTML = budgetComingSoonHtml(context);
  const note = host.querySelector("[data-bcs-note]") as HTMLElement | null;
  const input = host.querySelector("[data-bcs-region]") as HTMLInputElement | null;
  const send = host.querySelector("[data-bcs-send]") as HTMLButtonElement | null;
  const how = host.querySelector("[data-bcs-how]") as HTMLButtonElement | null;
  if (how) how.onclick = () => howModal();

  try {
    const mine: any = await myBudgetRequests();
    const rows = mine?.rows || [];
    if (rows.length && note)
      note.textContent = `You Asked For ${rows.map((r: any) => r.region).join(", ")}. We Will Email You The Day It Goes Live.`;
  } catch (_) {}

  if (send) {
    send.onclick = async () => {
      const region = input?.value?.trim() || "";
      if (region.length < 2) {
        toast("Add Your Market First.");
        input?.focus();
        return;
      }
      send.disabled = true;
      try {
        await requestBudgetMarket({ data: { region } });
        if (note)
          note.textContent = `Thanks. ${region} Is On The List And We Will Email You The Day It Goes Live.`;
        if (input) input.value = "";
        toast("You Are On The List.");
      } catch (e: any) {
        toast(e?.message || "Could Not Save That Request.");
      }
      send.disabled = false;
    };
  }

  try {
    createIcons({ icons, root: host } as any);
  } catch (_) {}
  return true;
}
