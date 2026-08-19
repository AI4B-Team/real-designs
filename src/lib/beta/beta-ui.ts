/**
 * Closed beta client layer.
 *
 * Mirrors the server's feature map into the workspace: a Beta label with a
 * feedback link in the topbar, "Coming Soon" pills on held-back navigation,
 * and a diagnostic ID that the feedback form attaches to every report.
 */
import {
  resolveFeatures,
  unavailableMessage,
  type FeatureKey,
  type FeatureState,
} from "./features";
import { getBetaState } from "./beta.functions";
import { newCorrelationId } from "@/lib/obs/correlation";

let state: Record<FeatureKey, FeatureState> | null = null;
let betaMode = true;
let loaded = false;

const DIAG_KEY = "rd.beta.diagnosticId";

/** Stable per-browser diagnostic ID. Safe to show and to send with feedback. */
export function diagnosticId(): string {
  try {
    const existing = localStorage.getItem(DIAG_KEY);
    if (existing) return existing;
    const fresh = newCorrelationId("RD");
    localStorage.setItem(DIAG_KEY, fresh);
    return fresh;
  } catch (_) {
    return newCorrelationId("RD");
  }
}

/** Optimistic default keeps held-back features off until the server answers. */
function fallback() {
  return resolveFeatures({
    betaMode: true,
    allowlisted: true,
    stripeReady: false,
    emailReady: false,
  });
}

export function betaFeature(key: FeatureKey): FeatureState {
  return (state ?? fallback())[key];
}

export function betaAvailable(key: FeatureKey): boolean {
  return betaFeature(key).available;
}

export function betaIsOn(): boolean {
  return betaMode;
}

export function betaBlockedMessage(key: FeatureKey): string {
  return unavailableMessage(key);
}

export async function loadBetaState() {
  if (loaded) return state;
  try {
    const res = (await getBetaState()) as {
      features: Record<FeatureKey, FeatureState>;
      betaMode: boolean;
    };
    state = res.features;
    betaMode = !!res.betaMode;
  } catch (_) {
    state = fallback();
  }
  loaded = true;
  return state;
}

function toast(msg: string) {
  try {
    const t = (window as unknown as { rdToast?: (m: string) => void }).rdToast;
    if (typeof t === "function") t(msg);
    else console.warn(msg);
  } catch (_) {
    /* noop */
  }
}

function labelNav() {
  const features = state ?? fallback();
  for (const f of Object.values(features)) {
    if (!f.view) continue;
    const btn = document.querySelector<HTMLElement>(`.nav-i[data-v="${f.view}"]`);
    if (!btn) continue;
    btn.querySelector(".rd-beta-soon")?.remove();
    btn.dataset["rdUnavailable"] = f.available ? "" : f.key;
    if (f.available) continue;
    const pill = document.createElement("span");
    pill.className = "rd-beta-soon";
    pill.textContent = "Coming Soon";
    btn.appendChild(pill);
  }
}

function mountBadge() {
  const right = document.querySelector<HTMLElement>(".topbar-right");
  if (!right || document.getElementById("rdBetaBadge")) return;
  const wrap = document.createElement("div");
  wrap.className = "rd-beta-wrap";
  wrap.innerHTML = `
    <span class="rd-beta-badge" id="rdBetaBadge" title="Closed Beta. Some features are still coming.">Beta</span>
    <button type="button" class="rd-beta-fb" id="rdBetaFeedback">Send Feedback</button>`;
  right.insertBefore(wrap, right.firstChild);
  wrap.querySelector("#rdBetaFeedback")?.addEventListener("click", () => {
    document.getElementById("fbBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * Held-back navigation must not silently do nothing: intercept the click,
 * explain honestly, and leave the tester where they were.
 */
function guardNavClicks() {
  document.addEventListener(
    "click",
    (e) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>(".nav-i");
      if (!btn) return;
      const key = btn.dataset["rdUnavailable"];
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      toast(unavailableMessage(key as FeatureKey));
    },
    true,
  );
}

/** Call once at app boot, after the shell markup exists. */
export async function initBeta() {
  mountBadge();
  guardNavClicks();
  await loadBetaState();
  document.documentElement.dataset["beta"] = betaMode ? "on" : "off";
  labelNav();
  return state;
}
