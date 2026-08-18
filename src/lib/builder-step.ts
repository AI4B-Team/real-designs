/**
 * One explicit builder-step state machine for the Photo Design workflow.
 *
 * The step is never inferred from which DOM nodes happen to be visible, and
 * never from the truthiness of an index. A photo is "open" only when its key
 * is present in the current photo collection.
 */

export type DesignStep = "add" | "rooms" | "design" | "review";

export const DESIGN_STEPS: DesignStep[] = ["add", "rooms", "design", "review"];

export type StepState = {
  /** Photos currently in the session. */
  keys: string[];
  /** Key of the photo open on the individual canvas, or null. */
  activeKey: string | null;
  /** True while the upload/source picker is the visible step. */
  adding?: boolean;
  /** True when the user is looking at the results grid. */
  reviewing?: boolean;
  /** Keys with a generated design. */
  completed?: string[];
};

/** Is this key a real, still-present photo? */
export function isActiveKey(keys: string[], key: unknown): key is string {
  return typeof key === "string" && !!key && keys.indexOf(key) !== -1;
}

/** The durable step that must be written to the draft row. */
export function durableStep(s: StepState): DesignStep {
  if (!s.keys.length) return "add";
  if (s.adding) return "add";
  if (isActiveKey(s.keys, s.activeKey)) return "design";
  if (s.reviewing && (s.completed || []).length) return "review";
  return "rooms";
}

export type RestoreInput = {
  builder_step?: string | null;
  keys: string[];
  /** Previously active photo key, from draft settings. */
  activeKey?: string | null;
  completed?: string[];
};

/** What a reopened draft must show. Stale state can never open a blank canvas. */
export function restoreStep(input: RestoreInput): { step: DesignStep; activeKey: string | null } {
  const keys = input.keys || [];
  if (!keys.length) return { step: "add", activeKey: null };
  const raw = String(input.builder_step || "").toLowerCase();
  const active = isActiveKey(keys, input.activeKey) ? (input.activeKey as string) : null;

  if (raw === "add") return { step: "add", activeKey: null };
  if (raw === "design" || raw === "canvas") {
    /* The photo may have been removed since the draft was saved. */
    return active ? { step: "design", activeKey: active } : { step: "rooms", activeKey: null };
  }
  if (raw === "review" || raw === "final" || raw === "results") {
    return (input.completed || []).length ? { step: "review", activeKey: null } : { step: "rooms", activeKey: null };
  }
  return { step: "rooms", activeKey: null };
}

/** Can the user jump to this rail step right now, and if not, why not? */
export function stepAvailability(
  step: DesignStep,
  s: StepState,
): { ready: boolean; reason: string } {
  const has = s.keys.length > 0;
  const done = (s.completed || []).length > 0;
  if (step === "add") return { ready: true, reason: "" };
  if (step === "rooms")
    return has ? { ready: true, reason: "" } : { ready: false, reason: "Add at least one photo first." };
  if (step === "design")
    return has
      ? { ready: true, reason: "" }
      : { ready: false, reason: "Add photos before designing a room." };
  return done
    ? { ready: true, reason: "" }
    : { ready: false, reason: "Generate at least one design to review results." };
}

/**
 * Resolve a rail click into the next state. "Design" without an open photo
 * falls back to the last opened room, otherwise it asks for a choice.
 */
export function navigateTo(
  step: DesignStep,
  s: StepState & { lastOpened?: string | null },
): { step: DesignStep; activeKey: string | null; prompt?: "choose-room" } {
  const avail = stepAvailability(step, s);
  if (!avail.ready) return { step: durableStep(s), activeKey: s.activeKey ?? null };
  if (step === "design") {
    const key = isActiveKey(s.keys, s.activeKey)
      ? (s.activeKey as string)
      : isActiveKey(s.keys, s.lastOpened)
        ? (s.lastOpened as string)
        : null;
    return key ? { step: "design", activeKey: key } : { step: "rooms", activeKey: null, prompt: "choose-room" };
  }
  return { step, activeKey: null };
}
