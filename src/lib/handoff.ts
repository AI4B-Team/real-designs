/**
 * The one handoff contract between surfaces.
 *
 * Media, Properties, Batch and Studio all start builders the same way: they
 * write a single validated envelope, navigate, and the builder consumes it
 * exactly once. Nothing else may pass project context between views.
 */

export type HandoffTarget = "design" | "video";

export type HandoffAsset = {
  /** Durable storage path. Never a blob: URL. */
  path: string;
  name?: string | null;
  room?: string | null;
  /** Source media row id, when the asset came from a saved record. */
  id?: string | null;
};

export type Handoff = {
  target: HandoffTarget;
  /** Where the user started, for telemetry and for "Back". */
  origin: "studio" | "media" | "property" | "batch" | "app";
  propertyId: string | null;
  propertyAddress: string | null;
  /** Existing draft to resume instead of starting a new project. */
  draftId?: string | null;
  assets: HandoffAsset[];
  at: number;
};

const KEY = "rd.handoff.v1";

export type HandoffInput = Omit<Partial<Handoff>, "target"> & { target: HandoffTarget };

/** Normalise and validate. Returns null when the payload cannot start a build. */
export function makeHandoff(input: HandoffInput): Handoff | null {
  if (!input || (input.target !== "design" && input.target !== "video")) return null;
  const assets: HandoffAsset[] = (input.assets || [])
    .filter((a) => a && typeof a.path === "string" && !!a.path && !/^blob:/i.test(a.path))
    .map((a) => ({
      path: a.path,
      name: a.name || null,
      room: a.room || null,
      id: a.id || null,
    }));
  const draftId = input.draftId || null;
  if (!assets.length && !draftId) return null;
  return {
    target: input.target,
    origin: (input.origin as Handoff["origin"]) || "app",
    propertyId: input.propertyId || null,
    propertyAddress: input.propertyAddress || null,
    draftId,
    assets,
    at: Date.now(),
  };
}

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

let mem: Handoff | null = null;

/** Publish a handoff. Survives the navigation, and only the newest one lives. */
export function setHandoff(input: HandoffInput): Handoff | null {
  const h = makeHandoff(input);
  mem = h;
  const s = store();
  try {
    if (s) {
      if (h) s.setItem(KEY, JSON.stringify(h));
      else s.removeItem(KEY);
    }
  } catch {
    /* private mode: the in-memory copy still carries the same session */
  }
  return h;
}

/** Read without consuming. */
export function peekHandoff(target?: HandoffTarget): Handoff | null {
  let h = mem;
  if (!h) {
    const s = store();
    try {
      const raw = s && s.getItem(KEY);
      h = raw ? (JSON.parse(raw) as Handoff) : null;
    } catch {
      h = null;
    }
  }
  if (!h) return null;
  if (target && h.target !== target) return null;
  return h;
}

/** Read once. A refresh must never re-run the same handoff. */
export function consumeHandoff(target?: HandoffTarget): Handoff | null {
  const h = peekHandoff(target);
  if (!h) return null;
  clearHandoff();
  return h;
}

export function clearHandoff() {
  mem = null;
  const s = store();
  try {
    if (s) s.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
