/**
 * Signup / onboarding questionnaire modal.
 *
 * Shown once, the first time a new member opens the app. Answers are stored
 * on their signup profile so the back office can work the list and push it
 * into the connected CRM.
 */
import { createIcons, icons } from "lucide";
import { getSignupSurvey, saveSignupSurvey } from "@/lib/signup-survey.functions";

const HOW_HEARD = [
  "Google Search",
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "Friend Or Colleague",
  "Brokerage Or Team",
  "Podcast Or Newsletter",
  "Other",
];
const VOLUME = ["Under 10", "10 To 25", "26 To 50", "51 To 100", "100+", "Not Sure Yet"];
const ROLES = ["Real Estate Agent", "Broker Or Team Lead", "Photographer", "Investor Or Flipper", "Designer Or Stager", "Contractor", "Homeowner", "Other"];
const GOALS = ["Win More Listings", "Sell Listings Faster", "Virtual Staging", "Renovation Planning", "Marketing Videos", "Client Presentations"];
const TEAMS = ["Just Me", "2 To 5", "6 To 20", "20+"];

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const opts = (list: string[], val: string) =>
  `<option value="">Select One</option>` + list.map((o) => `<option${o === val ? " selected" : ""}>${esc(o)}</option>`).join("");

function toast(msg: string) {
  try {
    (window as any).rdToast ? (window as any).rdToast(msg) : console.log(msg);
  } catch (_) {}
}

/** Opens the questionnaire. Returns once the member saves or skips. */
export function openSignupSurvey(seed?: any) {
  if (document.getElementById("rdSurvey")) return;
  const r = seed || {};
  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.id = "rdSurvey";
  wrap.innerHTML = `
  <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Welcome Questionnaire" style="max-width:560px">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <h3 style="margin:0 0 4px">Welcome To REAL DESIGNS</h3>
    <p class="mono" style="margin:0 0 14px;color:var(--mute-2)">A Few Quick Questions So We Can Set Your Workspace Up Properly. You Can Change These Later In Account &rarr; Profile.</p>
    <div class="crm-form">
      <label>Your Name<input type="text" data-f="full_name" value="${esc(r.full_name || "")}" placeholder="Jordan Reyes" maxlength="120"></label>
      <label>Phone Number<input type="tel" data-f="phone" value="${esc(r.phone || "")}" placeholder="(555) 123-4567" maxlength="40"></label>
      <label>Company Or Brokerage<input type="text" data-f="company" value="${esc(r.company || "")}" placeholder="Optional" maxlength="120"></label>
      <label>What Best Describes You<select data-f="role">${opts(ROLES, r.role || "")}</select></label>
      <label>How Did You Hear About Us<select data-f="how_heard">${opts(HOW_HEARD, r.how_heard || "")}</select></label>
      <label data-detail hidden>Tell Us More<input type="text" data-f="how_heard_detail" value="${esc(r.how_heard_detail || "")}" placeholder="Who Or Where?" maxlength="200"></label>
      <label>Listings Per Year<select data-f="listings_per_year">${opts(VOLUME, r.listings_per_year || "")}</select></label>
      <label>Team Size<select data-f="team_size">${opts(TEAMS, r.team_size || "")}</select></label>
      <label>Main Goal<select data-f="primary_goal">${opts(GOALS, r.primary_goal || "")}</select></label>
      <label class="crm-toggle"><input type="checkbox" data-f="marketing_opt_in"${r.marketing_opt_in ? " checked" : ""}> Send Me Product Tips And Launch News</label>
      <div class="crm-actions">
        <button class="btn btn-primary btn-xs" data-save><i data-lucide="check"></i>Save And Continue</button>
        <button class="btn btn-ghost btn-xs" data-skip>Skip For Now</button>
      </div>
    </div>
  </div>`;
  (document.querySelector(".rd-app") || document.body).appendChild(wrap);
  try { createIcons({ icons, root: wrap } as any); } catch (_) {}

  const q = (k: string) => wrap.querySelector(`[data-f="${k}"]`) as HTMLInputElement | HTMLSelectElement | null;
  const val = (k: string) => (q(k) as HTMLInputElement)?.value?.trim() || "";
  const detail = wrap.querySelector("[data-detail]") as HTMLElement | null;
  const syncDetail = () => {
    if (detail) detail.hidden = val("how_heard") !== "Other" && val("how_heard") !== "Friend Or Colleague";
  };
  (q("how_heard") as HTMLSelectElement).onchange = syncDetail;
  syncDetail();

  const close = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") skip();
  };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-x]").forEach((b: any) => (b.onclick = () => skip()));

  async function skip() {
    close();
    try {
      await saveSignupSurvey({ data: { skipped: true } });
    } catch (_) {}
  }

  (wrap.querySelector("[data-save]") as HTMLButtonElement).onclick = async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    if (!val("how_heard")) {
      toast("Let Us Know How You Heard About Us.");
      return;
    }
    btn.disabled = true;
    try {
      await saveSignupSurvey({
        data: {
          full_name: val("full_name") || null,
          phone: val("phone") || null,
          company: val("company") || null,
          role: val("role") || null,
          how_heard: val("how_heard") || null,
          how_heard_detail: val("how_heard_detail") || null,
          listings_per_year: val("listings_per_year") || null,
          team_size: val("team_size") || null,
          primary_goal: val("primary_goal") || null,
          marketing_opt_in: !!(q("marketing_opt_in") as HTMLInputElement)?.checked,
          completed: true,
          skipped: false,
        },
      });
      await syncToAccount({
        full_name: val("full_name"),
        phone: val("phone"),
        company: val("company"),
      });
      try {
        const { autoPushSignupToCrm } = await import("@/lib/signup-survey.functions");
        void autoPushSignupToCrm({ data: undefined } as any).catch(() => {});
      } catch (_) {
        /* CRM push is best-effort */
      }
      close();
      try {
        document.dispatchEvent(new CustomEvent("rd:survey-saved"));
      } catch (_) {
        /* no listeners is fine */
      }
      toast("Thanks — Your Workspace Is Ready.");

    } catch (e: any) {
      btn.disabled = false;
      toast(e?.message || "Those answers could not be saved.");
    }
  };
}

/** Mirrors the shared contact fields onto the account profile. */
async function syncToAccount(fields: { full_name: string; phone: string; company: string }) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    const m: any = data?.user?.user_metadata || {};
    const next: any = {};
    if (fields.full_name && fields.full_name !== m.full_name) next.full_name = fields.full_name;
    if (fields.phone && fields.phone !== m.phone) next.phone = fields.phone;
    if (fields.company && fields.company !== m.company) next.company = fields.company;
    if (Object.keys(next).length) await supabase.auth.updateUser({ data: next });
  } catch (_) {
    /* the questionnaire row is the source of truth */
  }
}

/** Fills blank name/phone/company from the account profile. */
async function withAuthSeed(row: any) {
  const seed: any = { ...(row || {}) };
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    const m: any = data?.user?.user_metadata || {};
    if (!seed.full_name) seed.full_name = m.full_name || m.name || "";
    if (!seed.phone) seed.phone = m.phone || "";
    if (!seed.company) seed.company = m.company || "";
  } catch (_) {
    /* seeding is best effort */
  }
  return seed;
}

/** Opens the questionnaire only when this member has never answered it. */
export async function maybeOpenSignupSurvey() {
  try {
    const out: any = await getSignupSurvey();
    const row = out?.row;
    if (row && (row.completed || row.skipped)) return;
    openSignupSurvey(await withAuthSeed(row));
  } catch (_) {
    /* never block the app on the questionnaire */
  }
}

/** Reopen for editing from the account area. */
export async function editSignupSurvey() {
  try {
    const out: any = await getSignupSurvey();
    openSignupSurvey(await withAuthSeed(out?.row));
  } catch (_) {
    openSignupSurvey(await withAuthSeed(null));
  }
}
