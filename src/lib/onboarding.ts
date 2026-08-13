/**
 * First-use and adaptive post-login routing state.
 *
 * Everything here is durable client state (localStorage) scoped to the signed
 * in user id, so a refresh, a signup redirect or a checkout round trip never
 * loses the workflow the visitor picked.
 */

export type StartIntent = {
  /** Studio workflow key, e.g. "redesign", "stage", "sketch". */
  workflow?: string | undefined;
  /** interior | exterior | landscape */
  space?: string | undefined;
  room?: string | undefined;
  /** Design Direction name to preselect. */
  direction?: string | undefined;
  /** Sample space key when the CTA was "Try A Sample Space". */
  sample?: string | undefined;
  /** Where the intent came from, for analytics only. */
  source?: string | undefined;
  ts?: number | undefined;
};

export type StudioSession = {
  workflow?: string | undefined;
  space?: string | undefined;
  room?: string | undefined;
  direction?: string | undefined;
  sample?: string | undefined;
  thumb?: string | undefined;
  property?: string | undefined;
  updated?: number | undefined;
};

export type StartPage = "smart" | "dashboard" | "studio" | "last";

const DAY = 1000 * 60 * 60 * 24;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

function drop(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

/* ---------- CTA intent (survives signup / login) ---------- */

const INTENT = "rd.intent";

/** Stores the workflow a visitor picked before authenticating. */
export function setStartIntent(intent: StartIntent) {
  write(INTENT, { ...intent, ts: Date.now() });
}

/** Reads the pending CTA intent without consuming it. */
export function peekStartIntent(): StartIntent | null {
  const i = read<StartIntent>(INTENT);
  if (!i) return null;
  if (Date.now() - (i.ts ?? 0) > DAY) {
    drop(INTENT);
    return null;
  }
  return i;
}

/** Reads and clears the pending CTA intent. */
export function takeStartIntent(): StartIntent | null {
  const i = peekStartIntent();
  drop(INTENT);
  return i;
}

/* ---------- unfinished Studio session ---------- */

const sessionKey = (uid: string) => `rd.session.${uid}`;

export function saveStudioSession(uid: string, patch: StudioSession) {
  const cur = read<StudioSession>(sessionKey(uid)) ?? {};
  write(sessionKey(uid), { ...cur, ...patch, updated: Date.now() });
}

export function getStudioSession(uid: string): StudioSession | null {
  const s = read<StudioSession>(sessionKey(uid));
  if (!s || !s.updated) return null;
  if (Date.now() - s.updated > 14 * DAY) {
    drop(sessionKey(uid));
    return null;
  }
  return s;
}

export function clearStudioSession(uid: string) {
  drop(sessionKey(uid));
}

/* ---------- onboarding completion ---------- */

const doneKey = (uid: string) => `rd.firstuse.${uid}`;

export function isOnboardingComplete(uid: string) {
  return read<{ done?: boolean }>(doneKey(uid))?.done === true;
}

export function completeOnboarding(uid: string, how: string) {
  write(doneKey(uid), { done: true, how, ts: Date.now() });
}

/* ---------- last opened view ---------- */

const lastKey = (uid: string) => `rd.lastview.${uid}`;

export function setLastView(uid: string, view: string) {
  write(lastKey(uid), { view, ts: Date.now() });
}

export function getLastView(uid: string): string | null {
  return read<{ view?: string }>(lastKey(uid))?.view ?? null;
}

/* ---------- checkout / upgrade return ---------- */

const RETURN = "rd.returnTo";

export function setCheckoutReturn(state: { view: string; intent?: StartIntent; reason?: string }) {
  write(RETURN, { ...state, ts: Date.now() });
}

export function takeCheckoutReturn(): { view: string; intent?: StartIntent; reason?: string } | null {
  const r = read<{ view: string; intent?: StartIntent; reason?: string; ts?: number }>(RETURN);
  drop(RETURN);
  if (!r || Date.now() - (r.ts ?? 0) > DAY) return null;
  return r;
}

/** Clears every sensitive local first-use record. Called on sign out. */
export function clearFirstUseState(uid?: string) {
  drop(INTENT);
  drop(RETURN);
  if (uid) {
    drop(sessionKey(uid));
    drop(lastKey(uid));
  }
}

/* ---------- eligibility ---------- */

export type AccountContent = {
  properties: number;
  designs: number;
  scopes: number;
  products: number;
  hasSession: boolean;
  onboarded: boolean;
};

/**
 * A user is new only when the account holds no real content. Never trust a
 * single flag: a missing or corrupted marker must not resend an active user
 * through onboarding, and a cleared marker must not hide the dashboard.
 */
export function isNewUser(c: AccountContent) {
  if (c.onboarded) return false;
  return (
    c.properties === 0 && c.designs === 0 && c.scopes === 0 && c.products === 0 && !c.hasSession
  );
}
