/* View model for the scene Effects modal in the property video builder.
   Display grouping only — every stored identifier (scene.look, scene.vfx,
   scene.vfx_gen, scene.disclosure, scene.look_amount) keeps its existing value
   so saved drafts and the renderer are untouched. */

import { VFX_LOOKS } from "@/lib/rd-vfx-looks";
import { VFX_TILES, tileById } from "@/lib/rd-vfx-tiles";

/** Left-column labels. Keys are the stored category ids. */
export const LOOK_CAT_LABEL: Record<string, string> = {
  all: "All",
  featured: "Featured",
  lighting: "Lighting",
  season: "Season",
  camera: "Camera",
};

export const FX_CAT_LABEL: Record<string, string> = {
  all: "All",
  outdoor: "Exterior",
  indoor: "Interior",
  timelapse: "Timelapse",
  fan: "Ceiling Fan",
  word: "Word Drop",
};

/** Intensity presets. Balanced is the default for a freshly picked look. */
export const INTENSITY = { subtle: 35, balanced: 70, strong: 100 } as const;
export const DEFAULT_INTENSITY = INTENSITY.balanced;

export function intensityWord(v: number): string {
  const n = Number(v) || 0;
  if (n <= 45) return "Subtle";
  if (n <= 85) return "Balanced";
  return "Strong";
}

export type FxSnap = {
  look: string | null;
  look_amount: number | null;
  vfx: string | null;
  vfx_gen: string | null;
  disclosure: string | null;
};

export function fxSnap(s: any): FxSnap {
  return {
    look: s?.look ?? null,
    look_amount: s?.look_amount ?? null,
    vfx: s?.vfx ?? null,
    vfx_gen: s?.vfx_gen ?? null,
    disclosure: s?.disclosure ?? null,
  };
}

export function fxRestore(s: any, snap: FxSnap | null | undefined) {
  if (!s || !snap) return;
  s.look = snap.look;
  s.look_amount = snap.look_amount;
  s.vfx = snap.vfx;
  s.vfx_gen = snap.vfx_gen;
  s.disclosure = snap.disclosure;
}

export function fxDirty(s: any, snap: FxSnap | null | undefined): boolean {
  if (!snap) return false;
  const now = fxSnap(s);
  return (Object.keys(snap) as Array<keyof FxSnap>).some((k) => now[k] !== snap[k]);
}

/** Only categories that actually hold options, "All" first. */
export function lookCats(): Array<[string, string]> {
  const used = new Set(VFX_LOOKS.map((l: any) => l.cat || "featured"));
  return [["all", LOOK_CAT_LABEL['all']] as [string, string]].concat(
    Object.keys(LOOK_CAT_LABEL)
      .filter((k) => k !== "all" && used.has(k))
      .map((k) => [k, LOOK_CAT_LABEL[k]!] as [string, string]),
  );
}

export function fxCats(): Array<[string, string]> {
  const used = new Set<string>();
  VFX_TILES.forEach((t) => t.cats.forEach((c) => c !== "all" && used.add(c)));
  return [["all", FX_CAT_LABEL['all']] as [string, string]].concat(
    Object.keys(FX_CAT_LABEL)
      .filter((k) => k !== "all" && used.has(k))
      .map((k) => [k, FX_CAT_LABEL[k]!] as [string, string]),
  );
}

export function looksForCat(cat: string) {
  return cat === "all" ? VFX_LOOKS.slice() : VFX_LOOKS.filter((l: any) => (l.cat || "featured") === cat);
}

/** Effects tab: content-generating and animated tiles, minus the plain grades. */
export function effectTiles(cat: string) {
  const list = VFX_TILES.filter((t) => t.id !== "none");
  return cat === "all" ? list : list.filter((t) => t.cats.includes(cat));
}

/** Intensity only applies when a color grade is actually painted. */
export function supportsIntensity(s: any): boolean {
  return !!(s && s.look);
}

/** Credits this one scene will spend on its effect, charged at render time. */
export function sceneEffectCredits(s: any): number {
  return s?.vfx_gen ? tileById(s.vfx_gen)?.credits || 0 : 0;
}

/** What "Apply to All" would do: how many scenes change and what it adds. */
export function applyAllPlan(scenes: any[], src: any) {
  const list = (scenes || []).filter(Boolean);
  const targets = list.filter((s) => s !== src);
  const per = sceneEffectCredits(src);
  const already = targets.filter((s) => (s.vfx_gen || null) === (src?.vfx_gen || null)).length;
  const billable = per ? targets.length - already : 0;
  return { total: list.length, targets: targets.length, perScene: per, credits: billable * per };
}

/** Disclosure copy only belongs to effects that add or alter frame content. */
export function needsDisclosure(s: any): boolean {
  return !!(s && s.vfx_gen);
}
