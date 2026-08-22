/**
 * Design Settings for the Describe composer.
 *
 * Everything the user can see here is a real, visual selection backed by a
 * stable id: space, room / area, design style, and the advanced controls
 * (change level, aspect ratio, output count, mood and lighting). Nothing is a
 * label floating over an empty region, and nothing that is visible is left out
 * of the generation payload.
 */

import {
  areaByLabel,
  areaPreview,
  areasForSpace,
  type AreaOption,
  type CanvasSpace,
} from "@/lib/space-datasets";
import { STYLES, type StyleRecord } from "@/lib/style-catalog";
import { stylesForNeed } from "@/lib/canvas-style";

export type Space = "Interior" | "Exterior" | "Garden";

export const SPACE_OPTIONS: { id: Space; icon: string }[] = [
  { id: "Interior", icon: "sofa" },
  { id: "Exterior", icon: "home" },
  { id: "Garden", icon: "trees" },
];

export function spaceKeyOf(space: string): CanvasSpace {
  const s = String(space || "").toLowerCase();
  return s === "exterior" || s === "garden" ? (s as CanvasSpace) : "interior";
}

/* ------------------------------------------------------------------ */
/* room / area                                                         */
/* ------------------------------------------------------------------ */

/** Room types people actually ask for first, per space. */
const COMMON_AREA_IDS: Record<CanvasSpace, string[]> = {
  interior: ["i-kitchen", "i-living-room", "i-bedroom", "i-bathroom", "i-dining-room"],
  exterior: ["e-front-of-house", "e-back-of-house"],
  garden: ["g-backyard", "g-front-yard", "g-pool-area"],
};

const RECENT_KEY = "rd.describe.recentRooms";

/** Rooms the user picked before, most recent first. */
export function recentAreaIds(): string[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string").slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

export function rememberArea(id: string) {
  if (!id) return;
  try {
    if (typeof localStorage === "undefined") return;
    const next = [id, ...recentAreaIds().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (_) {
    /* storage is a nicety here, never a requirement */
  }
}

/**
 * The four cards shown inline, ranked so the room the user actually named
 * comes first: prompt-inferred, then recent picks, then common rooms, then
 * whatever is left. Family Room and Great Room stay under View all.
 */
export function quickAreas(
  space: string,
  selectedId?: string | null,
  max = 4,
  opts: { inferredId?: string | null; recents?: string[] } = {},
): AreaOption[] {
  const key = spaceKeyOf(space);
  const all = areasForSpace(key).filter((a) => a.id.indexOf("other") === -1);
  const byId = new Map(all.map((a) => [a.id, a]));
  const out: AreaOption[] = [];
  const seen = new Set<string>();
  const take = (id?: string | null) => {
    if (!id || out.length >= max || seen.has(id)) return;
    const rec = byId.get(id);
    if (!rec) return;
    seen.add(id);
    out.push(rec);
  };
  take(selectedId);
  take(opts.inferredId);
  for (const id of opts.recents ?? recentAreaIds()) take(id);
  for (const id of COMMON_AREA_IDS[key] || []) take(id);
  for (const a of all) take(a.id);
  return out.slice(0, max);
}

export function areaImage(a: AreaOption): string | null {
  return areaPreview(a.id);
}

export function searchAreas(space: string, q: string): AreaOption[] {
  const term = String(q || "").trim().toLowerCase();
  const all = areasForSpace(spaceKeyOf(space));
  return term ? all.filter((a) => a.label.toLowerCase().includes(term)) : all;
}


/** Room type inferred from what the user actually wrote. */
export function inferAreaFromPrompt(prompt: string, space: string): AreaOption | null {
  const text = String(prompt || "").toLowerCase();
  if (!text.trim()) return null;
  const all = areasForSpace(spaceKeyOf(space));
  /* Longest label first: "Living Room" wins over "Room". */
  const ranked = all.slice().sort((a, b) => b.label.length - a.label.length);
  for (const a of ranked) {
    if (a.id.indexOf("other") > -1) continue;
    if (text.includes(a.label.toLowerCase())) return a;
  }
  const alias: Record<string, string> = {
    "i-kitchen": "kitchen",
    "i-bathroom": "bath",
    "i-bedroom": "bedroom",
    "i-home-office": "office",
    "i-living-room": "lounge",
    "e-front-of-house": "facade",
    "e-back-of-house": "rear exterior",
    "g-backyard": "back yard",
    "g-front-yard": "front garden",
    "g-pool-area": "pool",
  };
  for (const a of ranked) {
    const key = alias[a.id];
    if (key && text.includes(key)) return a;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* design style                                                        */
/* ------------------------------------------------------------------ */

/** Styles that apply to the selected space, never an interior-only pool. */
export function stylePool(space: string): StyleRecord[] {
  return stylesForNeed(STYLES, "design", spaceKeyOf(space));
}

const PREFERRED_STYLE_IDS = ["modern", "contemporary", "transitional", "warm-minimal"];

/** The four style cards; the active and the inferred style are always shown. */
export function quickStyleCards(
  space: string,
  selectedId?: string | null,
  max = 4,
  inferredId?: string | null,
): StyleRecord[] {
  const pool = stylePool(space);
  const byId = new Map(pool.map((s) => [s.id, s]));
  const out: StyleRecord[] = [];
  const seen = new Set<string>();
  const take = (rec?: StyleRecord | null) => {
    if (!rec || out.length >= max || seen.has(rec.id)) return;
    seen.add(rec.id);
    out.push(rec);
  };
  if (selectedId) take(byId.get(selectedId));
  if (inferredId) take(byId.get(inferredId));
  for (const id of PREFERRED_STYLE_IDS) take(byId.get(id));
  for (const rec of pool) take(rec);
  return out;
}

/** Design style named in the description: "modern luxury kitchen" → Modern Luxury. */
export function inferStyleFromPrompt(prompt: string, space: string): StyleRecord | null {
  const text = String(prompt || "").toLowerCase();
  if (!text.trim()) return null;
  const pool = stylePool(space);
  const candidates: { rec: StyleRecord; name: string }[] = [];
  for (const rec of pool) {
    candidates.push({ rec, name: rec.displayName.toLowerCase() });
    for (const a of rec.aliases || []) candidates.push({ rec, name: String(a).toLowerCase() });
  }
  /* Longest name first so "Modern Luxury" beats "Modern". */
  candidates.sort((a, b) => b.name.length - a.name.length);
  for (const c of candidates) if (c.name && text.includes(c.name)) return c.rec;
  return null;
}


export function styleImage(rec: StyleRecord, space: string): string {
  const sp = spaceKeyOf(space);
  const bySpace = (rec as any).previewBySpace as Record<string, string> | undefined;
  return (bySpace && bySpace[sp]) || rec.previewImage;
}

/* ------------------------------------------------------------------ */
/* mood and lighting                                                   */
/* ------------------------------------------------------------------ */

export type Mood = { id: string; label: string; icon: string; spaces: CanvasSpace[] };

export const MOODS: Mood[] = [
  { id: "auto", label: "Auto", icon: "sparkles", spaces: ["interior", "exterior", "garden"] },
  {
    id: "natural-daylight",
    label: "Natural daylight",
    icon: "sun",
    spaces: ["interior", "exterior", "garden"],
  },
  { id: "bright-airy", label: "Bright & airy", icon: "sun-medium", spaces: ["interior"] },
  { id: "warm-cozy", label: "Warm & cozy", icon: "flame", spaces: ["interior"] },
  { id: "moody", label: "Moody", icon: "cloud-moon", spaces: ["interior", "exterior"] },
  {
    id: "golden-hour",
    label: "Golden hour",
    icon: "sunset",
    spaces: ["exterior", "garden", "interior"],
  },
  {
    id: "evening-ambience",
    label: "Evening ambience",
    icon: "moon",
    spaces: ["exterior", "garden", "interior"],
  },
];

export const DEFAULT_MOOD_ID = "auto";

export function moodsForSpace(space: string): Mood[] {
  const sp = spaceKeyOf(space);
  return MOODS.filter((m) => m.spaces.includes(sp));
}

export function moodLabel(id: string): string {
  return MOODS.find((m) => m.id === id)?.label || "Auto";
}

/** Keeps mood applicable when the space changes. */
export function ensureMood(id: string, space: string): string {
  return moodsForSpace(space).some((m) => m.id === id) ? id : DEFAULT_MOOD_ID;
}

/* ------------------------------------------------------------------ */
/* prompt editor                                                       */
/* ------------------------------------------------------------------ */

export const PROMPT_MIN_H = 144;
export const PROMPT_MAX_H = 320;

export const PROMPT_LIMIT = 1200;
/** Character count only appears when the limit is genuinely close. */
export const PROMPT_COUNT_FROM = PROMPT_LIMIT - 200;

/** Compact by default, growing with the content, then scrolling. */
export function promptHeight(scrollHeight: number): number {
  return Math.min(Math.max(Math.round(scrollHeight) || 0, PROMPT_MIN_H), PROMPT_MAX_H);
}

export function showCharCount(len: number): boolean {
  return len >= PROMPT_COUNT_FROM;
}

/* ------------------------------------------------------------------ */
/* reference roles                                                     */
/* ------------------------------------------------------------------ */

export type RefRole = "style" | "materials" | "color" | "layout";

export const REF_ROLES: { id: RefRole; label: string }[] = [
  { id: "style", label: "Style Inspiration" },
  { id: "materials", label: "Materials" },
  { id: "color", label: "Color Palette" },
  { id: "layout", label: "Layout Inspiration" },
];

export const MAX_REFS = 4;

export function refRoleLabel(id: string): string {
  return REF_ROLES.find((r) => r.id === id)?.label || "Style Inspiration";
}

/** Moves a reference to a new position, keeping every other one in order. */
export function reorder<T>(list: T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item as T);
  return out;
}

/* ------------------------------------------------------------------ */
/* summary and validation                                              */
/* ------------------------------------------------------------------ */

export type SettingsState = {
  prompt: string;
  refCount: number;
  space: string;
  roomId: string | null;
  roomLabel: string;
  styleId: string | null;
  styleLabel: string;
  level: string;
  ratio: string;
  options: number;
  moodId: string;
};

/** "Kitchen · Warm Minimal · Subtle · 1:1 · 2 images" */
export function generationSummary(s: SettingsState): string {
  const parts: string[] = [];
  if (s.roomLabel) parts.push(s.roomLabel);
  if (s.styleLabel) parts.push(s.styleLabel);
  parts.push(s.level, s.ratio, s.options + (s.options === 1 ? " image" : " images"));
  const mood = s.moodId && s.moodId !== DEFAULT_MOOD_ID ? moodLabel(s.moodId) : "";
  if (mood && mood !== "Auto") parts.push(mood);
  return parts.filter(Boolean).join(" \u00b7 ");
}

/** "Subtle · 1:1 · 2 images" for the collapsed Advanced settings summary. */
export function advancedSummary(s: SettingsState): string {
  const parts = [s.level, s.ratio, s.options + (s.options === 1 ? " image" : " images")];
  const mood = moodLabel(s.moodId);
  if (mood && mood !== "Auto") parts.push(mood);
  return parts.join(" \u00b7 ");
}

/** "Kitchen · Modern Luxury · 1 image" — what the footer shows when ready. */
export function compactSummary(s: SettingsState): string {
  const parts: string[] = [];
  if (s.roomLabel) parts.push(s.roomLabel);
  if (s.styleLabel) parts.push(s.styleLabel);
  parts.push(s.level, s.ratio);
  const mood = moodLabel(s.moodId);
  if (s.moodId && s.moodId !== DEFAULT_MOOD_ID && mood !== "Auto") parts.push(mood);
  return parts.filter(Boolean).join(" \u00b7 ");
}

/**
 * One specific instruction at a time, in the order the user works. Generate is
 * never silently disabled and never shows a generic red error.
 */
export function nextRequirement(s: SettingsState): string | null {
  if (!s.prompt.trim() && !s.refCount) return "Add a description or reference image.";
  if (!s.roomId && !s.styleId) return "Select a room and design style";
  if (!s.roomId) return "Select a room or area";
  if (!s.styleId) return "Select a design style";
  return null;
}

/** Which section the blocking requirement lives in, so it can be reached. */
export function nextRequirementTarget(s: SettingsState): "prompt" | "room" | "style" | null {
  if (!s.prompt.trim() && !s.refCount) return "prompt";
  if (!s.roomId) return "room";
  if (!s.styleId) return "style";
  return null;
}


/** Selections that stop making sense after a space change. */
export function incompatibleAfterSpace(
  s: Pick<SettingsState, "roomLabel" | "styleId">,
  nextSpace: string,
): string[] {
  const out: string[] = [];
  const rec = areaByLabel(s.roomLabel);
  if (rec && rec.space !== spaceKeyOf(nextSpace)) out.push(s.roomLabel);
  if (s.styleId && !stylePool(nextSpace).some((x) => x.id === s.styleId)) out.push("design style");
  return out;
}
