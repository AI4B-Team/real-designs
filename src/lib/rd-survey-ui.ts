/**
 * Signup / onboarding questionnaire.
 *
 * Shown once, the first time a new member opens the app. One question per
 * step with a progress bar, so it never feels like a form dump. Answers are
 * stored on their signup profile so the back office can work the list and
 * push it into the connected CRM.
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
const ROLES = [
  "Real Estate Agent",
  "Broker Or Team Lead",
  "Photographer",
  "Investor Or Flipper",
  "Designer Or Stager",
  "Contractor",
  "Homeowner",
  "Other",
];
const GOALS = [
  "Win More Listings",
  "Sell Listings Faster",
  "Virtual Staging",
  "Renovation Planning",
  "Marketing Videos",
  "Client Presentations",
];
const TEAMS = ["Just Me", "2 To 5", "6 To 20", "20+"];

type Answers = Record<string, any> & Record<never, never>;

type Step =
  | {
      kind: "text";
      title: string;
      hint?: string;
      fields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
      required?: string[];
    }
  | { kind: "choice"; title: string; hint?: string; key: string; options: string[]; required?: boolean }
  | { kind: "finish"; title: string; hint?: string };

const STEPS: Step[] = [
  {
    kind: "text",
    title: "First, What Should We Call You?",
    hint: "This Shows Up On Your Presentations And Shared Links.",
    fields: [
      { key: "full_name", label: "Your Name", placeholder: "Jordan Reyes" },
      { key: "company", label: "Company Or Brokerage", placeholder: "Optional" },
    ],
  },
  {
    kind: "choice",
    title: "What Best Describes You?",
    hint: "We Tune Your Workspace Around This.",
    key: "role",
    options: ROLES,
    required: true,
  },
  {
    kind: "choice",
    title: "How Did You Hear About Us?",
    key: "how_heard",
    options: HOW_HEARD,
    required: true,
  },
  {
    kind: "choice",
    title: "How Many Listings Do You Handle Per Year?",
    key: "listings_per_year",
    options: VOLUME,
  },
  { kind: "choice", title: "How Big Is Your Team?", key: "team_size", options: TEAMS },
  {
    kind: "choice",
    title: "What Is Your Main Goal Right Now?",
    key: "primary_goal",
    options: GOALS,
  },
  {
    kind: "finish",
    title: "Where Can We Reach You?",
    hint: "Get Texts With New Features And Launch Offers. Optional — Stop Anytime.",
  },
];

const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );

function toast(msg: string) {
  try {
    (window as any).rdToast ? (window as any).rdToast(msg) : console.log(msg);
  } catch (_) {}
}

/** Opens the questionnaire. Steps through one question at a time. */
export function openSignupSurvey(seed?: any) {
  if (document.getElementById("rdSurvey")) return;
  const a: any = { ...(seed || {}) };
  let i = 0;

  const wrap = document.createElement("div");
  wrap.className = "rd-modal on";
  wrap.id = "rdSurvey";
  wrap.innerHTML = `
  <div class="rd-modal-card rd-survey" role="dialog" aria-modal="true" aria-label="Welcome Questionnaire">
    <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
    <div class="sv-top">
      <span class="mono sv-count" data-count></span>
      <div class="sv-bar"><i data-bar></i></div>
    </div>
    <div class="sv-body" data-body></div>
    <div class="sv-foot">
      <button class="btn btn-ghost btn-xs" data-back><i data-lucide="arrow-left"></i>Back</button>
      <div class="sv-foot-right">
        <button class="btn btn-ghost btn-xs" data-skip>Skip For Now</button>
        <button class="btn btn-primary btn-xs" data-next>Next<i data-lucide="arrow-right"></i></button>
      </div>
    </div>
  </div>`;
  (document.querySelector(".rd-app") || document.body).appendChild(wrap);

  const body = wrap.querySelector("[data-body]") as HTMLElement;
  const bar = wrap.querySelector("[data-bar]") as HTMLElement;
  const count = wrap.querySelector("[data-count]") as HTMLElement;
  const backBtn = wrap.querySelector("[data-back]") as HTMLButtonElement;
  const nextBtn = wrap.querySelector("[data-next]") as HTMLButtonElement;

  function render() {
    const step = STEPS[i]!;
    count.textContent = `Step ${i + 1} Of ${STEPS.length}`;
    bar.style.width = `${((i + 1) / STEPS.length) * 100}%`;
    backBtn.disabled = i === 0;
    nextBtn.innerHTML =
      i === STEPS.length - 1
        ? `<i data-lucide="check"></i>Finish`
        : `Next<i data-lucide="arrow-right"></i>`;

    if (step.kind === "choice") {
      const detail =
        step.key === "how_heard" &&
        (a.how_heard === "Other" || a.how_heard === "Friend Or Colleague")
          ? `<label class="sv-field sv-detail">Tell Us More<input type="text" data-f="how_heard_detail" value="${esc(a.how_heard_detail || "")}" placeholder="Who Or Where?" maxlength="200"></label>`
          : "";
      body.innerHTML = `
        <h3>${esc(step.title)}</h3>
        ${step.hint ? `<p class="sv-hint">${esc(step.hint)}</p>` : ""}
        <div class="sv-opts">${step.options
          .map(
            (o) =>
              `<button type="button" class="sv-opt${a[step.key] === o ? " on" : ""}" data-opt="${esc(o)}">${esc(o)}</button>`,
          )
          .join("")}</div>
        ${detail}`;
      body.querySelectorAll<HTMLButtonElement>("[data-opt]").forEach((b) => {
        b.onclick = () => {
          a[step.key] = b.dataset["opt"];
          if (step.key === "how_heard") {
            render();
            return;
          }
          render();
          window.setTimeout(next, 140);
        };
      });
    } else if (step.kind === "text") {
      body.innerHTML = `
        <h3>${esc(step.title)}</h3>
        ${step.hint ? `<p class="sv-hint">${esc(step.hint)}</p>` : ""}
        <div class="sv-fields">${step.fields
          .map(
            (f) =>
              `<label class="sv-field">${esc(f.label)}<input type="${f.type || "text"}" data-f="${f.key}" value="${esc(a[f.key] || "")}" placeholder="${esc(f.placeholder)}" maxlength="120"></label>`,
          )
          .join("")}</div>`;
    } else {
      body.innerHTML = `
        <h3>${esc(step.title)}</h3>
        ${step.hint ? `<p class="sv-hint">${esc(step.hint)}</p>` : ""}
        <div class="sv-fields">
          <label class="sv-field">Phone Number<input type="tel" data-f="phone" value="${esc(a.phone || "")}" placeholder="(555) 123-4567" maxlength="40"></label>
          <label class="sv-check"><input type="checkbox" data-f="marketing_opt_in"${a.marketing_opt_in ? " checked" : ""}> Send Me Product Tips And Launch News</label>
        </div>`;
    }

    try {
      createIcons({ icons, root: wrap } as any);
    } catch (_) {}
    const first = body.querySelector("input") as HTMLInputElement | null;
    if (first) first.focus();
  }

  function collect() {
    body.querySelectorAll<HTMLInputElement>("[data-f]").forEach((el) => {
      const k = el.dataset["f"]!;
      a[k] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
  }

  function next() {
    collect();
    const step = STEPS[i]!;
    if (step.kind === "choice" && step.required && !a[step.key]) {
      toast("Pick One To Continue.");
      return;
    }
    if (i < STEPS.length - 1) {
      i++;
      render();
      return;
    }
    void save();
  }

  function back() {
    collect();
    if (i > 0) {
      i--;
      render();
    }
  }

  const close = () => {
    wrap.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") void skip();
    if (e.key === "Enter") {
      const step = STEPS[i]!;
      if (step.kind !== "choice") next();
    }
  };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-x]").forEach((b: any) => (b.onclick = () => void skip()));
  backBtn.onclick = back;
  nextBtn.onclick = next;
  (wrap.querySelector("[data-skip]") as HTMLButtonElement).onclick = () => void skip();

  async function skip() {
    close();
    try {
      await saveSignupSurvey({ data: { skipped: true } });
    } catch (_) {}
  }

  async function save() {
    nextBtn.disabled = true;
    try {
      await saveSignupSurvey({
        data: {
          full_name: a.full_name || null,
          phone: a.phone || null,
          company: a.company || null,
          role: a.role || null,
          how_heard: a.how_heard || null,
          how_heard_detail: a.how_heard_detail || null,
          listings_per_year: a.listings_per_year || null,
          team_size: a.team_size || null,
          primary_goal: a.primary_goal || null,
          marketing_opt_in: !!a.marketing_opt_in,
          completed: true,
          skipped: false,
        },
      });
      await syncToAccount({
        full_name: a.full_name || "",
        phone: a.phone || "",
        company: a.company || "",
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
      nextBtn.disabled = false;
      toast(e?.message || "Those answers could not be saved.");
    }
  }

  render();
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
