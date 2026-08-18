/**
 * Scene enhancement capability model (Phase 1).
 *
 * This is the single source of truth for what a scene in a property video can
 * have applied to it, and it deliberately separates three very different
 * things that competitors blur together:
 *
 *   Level 1 — MOTION   deterministic camera movement over the untouched photo.
 *                      Included, instant, never alters architecture.
 *   Level 2 — EFFECTS  looks (colour grades) and composited presentation or
 *                      environmental treatments. Free or priced, never called
 *                      AI-generated video.
 *   Level 3 — ANIMATE  a genuine image-to-video clip produced by the Veo
 *                      provider. Priced per clip, async, stored in private
 *                      storage, disclosed as AI-generated video.
 *
 * Nothing in here renders anything: it is the vocabulary, the pricing and the
 * disclosure rules that the UI, the credit path and the renderer all read, so
 * a label can never drift away from what actually happens.
 */

export type CapabilityLevel = "motion" | "effect" | "animate";

export type DisclosureKey =
  | "staged"
  | "proposed"
  | "altered"
  | "ai_video"
  | "simulated_motion"
  | "simulated_aerial"
  | "lifestyle";

export const DISCLOSURE_LABELS: Record<DisclosureKey, string> = {
  staged: "Virtually Staged",
  proposed: "Proposed Design",
  altered: "Digitally Altered",
  ai_video: "AI-Generated Video",
  simulated_motion: "Simulated Camera Movement",
  simulated_aerial: "Simulated Aerial Movement",
  lifestyle: "Lifestyle Elements Added",
};

export function disclosureLabel(key?: string | null): string {
  return (key && DISCLOSURE_LABELS[key as DisclosureKey]) || "";
}

/* ------------------------------------------------------------ level 1 */

export type MotionOption = {
  id: string;
  label: string;
  /** Short description of the actual camera move. */
  sub: string;
};

/** Deterministic camera moves. Always included, always available. */
export const MOTION_OPTIONS: MotionOption[] = [
  { id: "auto", label: "Auto", sub: "Picks A Move That Suits The Room" },
  { id: "push", label: "Push In", sub: "Moves Slowly Toward The Subject" },
  { id: "pull", label: "Pull Out", sub: "Moves Slowly Away From The Subject" },
  { id: "pan_left", label: "Pan Left", sub: "Sweeps Across To The Left" },
  { id: "pan_right", label: "Pan Right", sub: "Sweeps Across To The Right" },
  { id: "tilt_up", label: "Tilt Up", sub: "Rises From Floor To Ceiling" },
  { id: "tilt_down", label: "Tilt Down", sub: "Falls From Ceiling To Floor" },
  { id: "drift_in", label: "Drift In", sub: "Gentle Diagonal Move Inward" },
  { id: "drift_out", label: "Drift Out", sub: "Gentle Diagonal Move Outward" },
  { id: "slide_left", label: "Slide Left", sub: "Even Lateral Slide To The Left" },
  { id: "slide_right", label: "Slide Right", sub: "Even Lateral Slide To The Right" },
  { id: "static", label: "Static", sub: "No Camera Movement" },
];

export const DEFAULT_MOTION = "auto";

export function motionOption(id?: string | null): MotionOption {
  return MOTION_OPTIONS.find((m) => m.id === id) || MOTION_OPTIONS[0]!;
}

/** Motion is free and never touches the pixels of the original photo. */
export const MOTION_CREDITS = 0;

/* ------------------------------------------------------------ level 2 */

export type EffectCategory = "featured" | "listing" | "lighting" | "social" | "beforeafter" | "exterior";

export const EFFECT_CATEGORIES: Array<[EffectCategory | "all", string]> = [
  ["all", "All"],
  ["featured", "Featured"],
  ["listing", "Listing"],
  ["lighting", "Lighting"],
  ["social", "Social"],
  ["beforeafter", "Before/After"],
  ["exterior", "Exterior"],
];

export type LookOption = {
  id: string;
  label: string;
  sub: string;
  /** Colour grades are always included. */
  credits: 0;
};

/** Colour grades. Included, reversible, no content is added to the frame. */
export const LOOK_OPTIONS: LookOption[] = [
  { id: "none", label: "None", sub: "Original Colour", credits: 0 },
  { id: "listing_clean", label: "Listing Clean", sub: "Neutral, Bright, MLS-Safe", credits: 0 },
  { id: "cinematic", label: "Cinematic", sub: "Deeper Contrast, Filmic Roll-Off", credits: 0 },
  { id: "golden_hour", label: "Golden Hour", sub: "Warm Late-Afternoon Grade", credits: 0 },
  { id: "luxury", label: "Luxury", sub: "Rich Shadows, Restrained Colour", credits: 0 },
  { id: "film", label: "Film", sub: "Soft Grain And Faded Blacks", credits: 0 },
  { id: "high_contrast", label: "High Contrast", sub: "Punchy Highlights And Shadows", credits: 0 },
  { id: "warm", label: "Warm", sub: "Warmer White Balance", credits: 0 },
  { id: "cool", label: "Cool", sub: "Cooler White Balance", credits: 0 },
  { id: "bw", label: "Black And White", sub: "Monochrome Conversion", credits: 0 },
];

export function lookOption(id?: string | null): LookOption {
  return LOOK_OPTIONS.find((l) => l.id === id) || LOOK_OPTIONS[0]!;
}

export type EffectOption = {
  id: string;
  label: string;
  /** Plain explanation of what actually happens to the frame. */
  sub: string;
  cats: EffectCategory[];
  /** Credits per scene. 0 = included. */
  credits: number;
  /** Set when the effect changes what the property appears to contain. */
  disclosure?: DisclosureKey;
  /** True only while the effect is genuinely experimental. */
  beta?: boolean;
  /** Supports an intensity slider. */
  intensity?: boolean;
};

export const EFFECT_PREMIUM_CREDITS = 2;

/**
 * Composited treatments. These are overlays, masks and animated composites
 * drawn over the photo — never generative video.
 */
export const EFFECT_OPTIONS: EffectOption[] = [
  { id: "none", label: "None", sub: "No Effect Applied", cats: ["featured"], credits: 0 },

  /* Presentation */
  { id: "light_leak", label: "Light Leak", sub: "Animated Light Streak Across The Frame", cats: ["featured", "lighting"], credits: 0, intensity: true },
  { id: "magazine", label: "Magazine", sub: "Editorial Type Frame Around The Photo", cats: ["featured", "social"], credits: 0 },
  { id: "just_listed", label: "Just Listed", sub: "Animated Just Listed Banner", cats: ["listing", "social"], credits: 0 },
  { id: "property_outline", label: "Property Outline", sub: "Traced Outline Drawn Over The Exterior", cats: ["exterior", "listing"], credits: EFFECT_PREMIUM_CREDITS },
  { id: "room_label", label: "Room Label", sub: "Animated Room Name Card", cats: ["listing"], credits: 0 },
  { id: "feature_callout", label: "Feature Callout", sub: "Pointer Label On A Feature You Choose", cats: ["listing"], credits: 0 },
  { id: "price_reveal", label: "Price Reveal", sub: "Animated Price Card", cats: ["listing", "social"], credits: 0 },
  { id: "address_reveal", label: "Address Reveal", sub: "Animated Address Card", cats: ["listing"], credits: 0 },
  { id: "map_reveal", label: "Map Reveal", sub: "Location Map Wipe", cats: ["listing"], credits: EFFECT_PREMIUM_CREDITS },
  { id: "before_after", label: "Before And After", sub: "Wipe Between Two Versions Of This Photo", cats: ["beforeafter", "featured"], credits: 0 },
  { id: "empty_staged", label: "Empty To Staged Comparison", sub: "Wipe Between The Empty And Staged Versions", cats: ["beforeafter"], credits: 0, disclosure: "staged" },
  { id: "renovation_compare", label: "Renovation Comparison", sub: "Wipe Between Existing And Proposed", cats: ["beforeafter"], credits: 0, disclosure: "proposed" },
  { id: "construction_progress", label: "Construction Progress", sub: "Sequenced Wipe Through Progress Photos", cats: ["beforeafter"], credits: 0 },
  { id: "blueprint_reality", label: "Blueprint To Reality", sub: "Line-Drawing Dissolve Into The Photo", cats: ["beforeafter"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "proposed" },
  { id: "photo_stack", label: "Photo Stack", sub: "Photos Stack Onto The Frame In Sequence", cats: ["social"], credits: 0 },
  { id: "social_hook", label: "Social Hook", sub: "Opening Hook Text For Short-Form", cats: ["social"], credits: 0 },

  /* Environmental — only where compositing is convincing. */
  { id: "fireplace_glow", label: "Fireplace Glow", sub: "Flicker Composited Onto An Existing Fireplace", cats: ["lighting"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true },
  { id: "pool_shimmer", label: "Pool Shimmer", sub: "Surface Shimmer Composited Onto An Existing Pool", cats: ["exterior"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true },
  { id: "subtle_foliage", label: "Subtle Foliage", sub: "Gentle Sway Applied To Existing Planting", cats: ["exterior"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true, beta: true },
  { id: "daylight_shift", label: "Daylight Shift", sub: "Graded Shift Through The Time Of Day", cats: ["lighting", "exterior"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true },
  { id: "window_light", label: "Window Light", sub: "Light Bloom Composited At The Windows", cats: ["lighting"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true },
  { id: "shadow_movement", label: "Shadow Movement", sub: "Cast Shadows Drift Across The Frame", cats: ["lighting", "exterior"], credits: EFFECT_PREMIUM_CREDITS, disclosure: "altered", intensity: true, beta: true },
];

export function effectOption(id?: string | null): EffectOption {
  return EFFECT_OPTIONS.find((e) => e.id === id) || EFFECT_OPTIONS[0]!;
}

export function effectsForCategory(cat: EffectCategory | "all"): EffectOption[] {
  if (cat === "all") return EFFECT_OPTIONS;
  return EFFECT_OPTIONS.filter((e) => e.id === "none" || e.cats.includes(cat));
}

/* ------------------------------------------------------------ level 3 */

export type AnimateOption = {
  id: string;
  label: string;
  sub: string;
  /** Prompt direction sent to the image-to-video provider. */
  prompt: string;
  /** Clip length in seconds. */
  seconds: 4 | 6 | 8;
  disclosure: DisclosureKey;
  /** True when the option intentionally introduces people. */
  lifestyle?: boolean;
  beta?: boolean;
};

/** Credits for one generated clip. Matches the provider's video price point. */
export const ANIMATE_CREDITS_PER_CLIP = 40;

/** Sentence appended to every prompt so architecture is never invented. */
export const ARCHITECTURE_GUARD =
  "Preserve the property exactly as photographed: do not add, remove or move walls, doors, windows, rooms, stairs or rooflines, do not change the view through any window, and do not add text. Camera movement only, no cuts.";

export const NO_PEOPLE_GUARD = "No people and no animals appear in the shot.";

export const ANIMATE_OPTIONS: AnimateOption[] = [
  { id: "cinematic_walkthrough", label: "Cinematic Walkthrough", sub: "Steady move through the space", prompt: "A slow, steady cinematic walkthrough moving forward at eye level through this space.", seconds: 8, disclosure: "ai_video" },
  { id: "dolly_in", label: "Slow Dolly In", sub: "Gentle move toward the subject", prompt: "A slow dolly in toward the centre of the room at eye level.", seconds: 6, disclosure: "ai_video" },
  { id: "dolly_out", label: "Slow Dolly Out", sub: "Gentle move away from the subject", prompt: "A slow dolly out, gradually revealing more of the space.", seconds: 6, disclosure: "ai_video" },
  { id: "enter_room", label: "Enter The Room", sub: "Crosses the threshold into the space", prompt: "The camera moves through the existing doorway into the room, at walking pace.", seconds: 8, disclosure: "ai_video" },
  { id: "approach_property", label: "Approach The Property", sub: "Moves toward the front elevation", prompt: "The camera approaches the front of the property along the existing path at walking pace.", seconds: 8, disclosure: "ai_video" },
  { id: "aerial_reveal", label: "Aerial Reveal", sub: "Simulated rise above the property", prompt: "The camera rises smoothly above the property, revealing the lot from a higher vantage point.", seconds: 8, disclosure: "simulated_aerial" },
  { id: "day_to_dusk", label: "Day To Dusk", sub: "Light falls toward evening", prompt: "The light transitions from daylight to dusk, with interior lights warming up. Nothing else changes.", seconds: 6, disclosure: "altered" },
  { id: "fireplace", label: "Fireplace Animation", sub: "Flames move in an existing fireplace", prompt: "Flames move naturally in the fireplace already present in the image. Nothing else changes.", seconds: 4, disclosure: "altered" },
  { id: "pool_water", label: "Pool Water", sub: "Water moves in an existing pool", prompt: "The water in the existing pool ripples gently in the light. Nothing else changes.", seconds: 4, disclosure: "altered" },
  { id: "curtains", label: "Curtains Moving", sub: "Existing curtains drift", prompt: "The curtains already in the frame drift gently in a light breeze. Nothing else changes.", seconds: 4, disclosure: "altered" },
  { id: "foliage", label: "Foliage Moving", sub: "Existing planting sways", prompt: "The trees and planting already in the frame sway gently in a light breeze. Nothing else changes.", seconds: 4, disclosure: "altered" },
  { id: "empty_to_staged", label: "Empty To Staged", sub: "Furniture appears in an empty room", prompt: "Tasteful furniture and decor gradually appear in this empty room. The room itself is unchanged.", seconds: 6, disclosure: "staged" },
  { id: "before_after_reno", label: "Before To After Renovation", sub: "Finishes update in place", prompt: "The finishes, cabinetry and fixtures update to a renovated condition while the room layout stays identical.", seconds: 6, disclosure: "proposed" },
  { id: "construction", label: "Construction Transformation", sub: "Unfinished space becomes finished", prompt: "The unfinished space progresses to a finished condition while the structure stays identical.", seconds: 8, disclosure: "proposed" },
  { id: "lifestyle", label: "Lifestyle Scene", sub: "Adds people enjoying the space", prompt: "People relax and move naturally through the space, enjoying it.", seconds: 6, disclosure: "lifestyle", lifestyle: true },
  { id: "luxury_reveal", label: "Luxury Reveal", sub: "Slow, elegant reveal of the space", prompt: "A slow, elegant reveal of the space with a smooth lateral glide.", seconds: 8, disclosure: "ai_video" },
  { id: "twilight_reveal", label: "Twilight Reveal", sub: "Exterior settles into twilight", prompt: "The exterior settles into twilight as the camera glides slowly toward the property.", seconds: 8, disclosure: "altered" },
];

export function animateOption(id?: string | null): AnimateOption | null {
  return ANIMATE_OPTIONS.find((a) => a.id === id) || null;
}

/** Full prompt for a clip, including the guards that keep the property honest. */
export function animatePrompt(id: string, context?: { room?: string | null; style?: string | null }): string {
  const opt = animateOption(id);
  if (!opt) throw new Error(`Unknown AI Animate option: ${id}`);
  const where = context?.room ? ` Subject: ${context.room}.` : "";
  const style = context?.style ? ` Overall look: ${context.style}.` : "";
  return [opt.prompt + where + style, ARCHITECTURE_GUARD, opt.lifestyle ? "" : NO_PEOPLE_GUARD]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/* ------------------------------------------------------------ pricing */

export type SceneEnhancement = {
  motion?: string | null;
  look?: string | null;
  effect?: string | null;
  effectIntensity?: number | null;
  animate?: string | null;
};

/** Which level a scene is currently using. Animate wins, then effect, then motion. */
export function capabilityLevel(s: SceneEnhancement): CapabilityLevel {
  if (s.animate && animateOption(s.animate)) return "animate";
  const e = s.effect && s.effect !== "none" ? effectOption(s.effect) : null;
  if (e && e.id !== "none") return "effect";
  return "motion";
}

export type CostLine = { label: string; scenes: number; perScene: number; total: number };

export type CostQuote = {
  lines: CostLine[];
  total: number;
  balance: number;
  remaining: number;
  affordable: boolean;
};

/** Cost of applying one capability across a number of scenes. */
export function costPerScene(kind: CapabilityLevel, id?: string | null): number {
  if (kind === "motion") return MOTION_CREDITS;
  if (kind === "effect") return effectOption(id).credits;
  return animateOption(id) ? ANIMATE_CREDITS_PER_CLIP : 0;
}

/**
 * Builds the confirmation quote shown before anything is charged. The UI must
 * never charge without displaying one of these.
 */
export function quote(
  items: Array<{ label: string; kind: CapabilityLevel; id?: string | null; scenes: number }>,
  balance: number,
): CostQuote {
  const lines = items.map((i) => {
    const perScene = costPerScene(i.kind, i.id);
    return { label: i.label, scenes: i.scenes, perScene, total: perScene * i.scenes };
  });
  const total = lines.reduce((n, l) => n + l.total, 0);
  return { lines, total, balance, remaining: balance - total, affordable: total <= balance };
}

/** Disclosure keys a scene has earned from what was actually applied to it. */
export function sceneDisclosures(s: SceneEnhancement & { staged?: boolean; redesigned?: boolean }): DisclosureKey[] {
  const out = new Set<DisclosureKey>();
  if (s.staged) out.add("staged");
  if (s.redesigned) out.add("proposed");
  const effect = s.effect && s.effect !== "none" ? effectOption(s.effect) : null;
  if (effect?.disclosure) out.add(effect.disclosure);
  const anim = s.animate ? animateOption(s.animate) : null;
  if (anim) {
    out.add(anim.disclosure);
    if (anim.disclosure !== "ai_video") out.add("ai_video");
  } else if (s.motion && s.motion !== "static") {
    out.add("simulated_motion");
  }
  return [...out];
}

/* ------------------------------------------------- clip job vocabulary */

export type ClipStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export function clipStatusLabel(status?: string | null, progress?: number | null): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return progress ? `Processing ${Math.round(Number(progress) * 100)}%` : "Processing";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

/** Only completed clips may be used in a render. */
export function clipUsable(clip: { status?: string | null; storage_path?: string | null } | null | undefined) {
  return !!clip && clip.status === "completed" && !!clip.storage_path;
}

/* ------------------------------------------- animate taxonomy & fitness */

export type AnimateCategory = "camera" | "environment" | "transformation" | "lifestyle";

export const ANIMATE_CATEGORIES: Array<[string, string]> = [
  ["recommended", "Recommended"],
  ["camera", "Camera"],
  ["environment", "Environment"],
  ["transformation", "Transformation"],
  ["lifestyle", "Lifestyle"],
];

const ANIMATE_CATEGORY_OF: Record<string, AnimateCategory> = {
  cinematic_walkthrough: "camera",
  dolly_in: "camera",
  dolly_out: "camera",
  enter_room: "camera",
  approach_property: "camera",
  aerial_reveal: "camera",
  luxury_reveal: "camera",
  day_to_dusk: "environment",
  twilight_reveal: "environment",
  fireplace: "environment",
  pool_water: "environment",
  curtains: "environment",
  foliage: "environment",
  empty_to_staged: "transformation",
  before_after_reno: "transformation",
  construction: "transformation",
  lifestyle: "lifestyle",
};

export function animateCategory(id: string): AnimateCategory {
  return ANIMATE_CATEGORY_OF[id] || "camera";
}

const EXTERIOR_RE = /exterior|front|facade|curb|yard|patio|deck|pool|garden|landscape|backyard|outdoor|driveway|porch|balcony/i;
const ENTRY_RE = /entry|foyer|hall|stair|closet|laundry|garage|utility/i;

function isExteriorRoom(room?: string | null) {
  return EXTERIOR_RE.test(String(room || ""));
}

/**
 * Options we actively recommend for a detected room type. Everything else
 * stays browsable — the UI only warns, it never hides.
 */
export function recommendedAnimateIds(room?: string | null): string[] {
  const r = String(room || "").toLowerCase();
  if (isExteriorRoom(r)) {
    const out = ["approach_property", "aerial_reveal", "twilight_reveal", "day_to_dusk", "foliage"];
    if (/pool/.test(r)) out.unshift("pool_water");
    return out;
  }
  if (ENTRY_RE.test(r)) return ["enter_room", "dolly_in", "cinematic_walkthrough"];
  if (!r || /unassigned|needs review/.test(r)) return ["dolly_in", "cinematic_walkthrough", "dolly_out"];
  const out = ["enter_room", "dolly_in", "cinematic_walkthrough", "luxury_reveal"];
  if (/living|family|great|den/.test(r)) out.push("fireplace", "curtains");
  if (/bedroom|primary|master/.test(r)) out.push("curtains");
  if (/empty|vacant|unfurnished/.test(r)) out.unshift("empty_to_staged");
  return out;
}

/**
 * A plain warning when the picked option needs something the photo may not
 * contain. Empty string means nothing to warn about.
 */
export function animateWarning(id: string, room?: string | null): string {
  const r = String(room || "").toLowerCase();
  const exterior = isExteriorRoom(r);
  if (id === "pool_water" && !/pool/.test(r))
    return "This animates water in an existing pool. Pick it only if a pool is visible in this photo.";
  if (id === "fireplace" && exterior)
    return "This animates an existing fireplace. Pick it only if a fireplace is visible in this photo.";
  if (id === "fireplace" && !/living|family|great|den|bedroom|lounge/.test(r))
    return "This animates an existing fireplace. Pick it only if a fireplace is visible in this photo.";
  if (id === "curtains" && exterior)
    return "This animates existing curtains, which are usually only visible indoors.";
  if (id === "approach_property" && r && !exterior)
    return "This is written for a front exterior. Indoors it may invent space beyond the frame.";
  if (id === "aerial_reveal" && r && !exterior)
    return "Simulated aerial movement suits exteriors. Indoors the result is often unusable.";
  if (id === "enter_room" && exterior)
    return "This crosses an interior threshold. On an exterior photo the result may be unpredictable.";
  if (id === "foliage" && r && !exterior)
    return "This animates planting that is already in the frame.";
  return "";
}
