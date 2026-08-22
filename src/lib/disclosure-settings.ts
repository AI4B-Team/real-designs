/**
 * Workspace disclosure defaults and Brand Kit glue.
 *
 * Settings are cached locally so the export sheet opens instantly, then
 * refreshed from the signed-in workspace preferences.
 */

import {
  applyBrandKit,
  DEFAULT_DISCLOSURE_SETTINGS,
  normalizeSettings,
  type BrandKit,
  type DisclosureSettings,
} from "@/lib/disclosure";
import { getPrefs, savePrefs } from "@/lib/prefs";

const LS = "rd.disclosure";

export function cachedDisclosureSettings(): DisclosureSettings {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LS);
    if (!raw) return { ...DEFAULT_DISCLOSURE_SETTINGS };
    return normalizeSettings({ ...DEFAULT_DISCLOSURE_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_DISCLOSURE_SETTINGS };
  }
}

export function writeDisclosureCache(s: DisclosureSettings): void {
  try {
    localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}

/** Brand Kit read from workspace preferences. A blank logo stays blank. */
export async function brandKit(): Promise<BrandKit> {
  try {
    const p = await getPrefs();
    const brand = (p.brand || {}) as Record<string, string>;
    return {
      company: brand["company"] || "",
      logoUrl: brand["logoUrl"] || "",
      color: brand["color"] || "",
    };
  } catch {
    return {};
  }
}

/** Cached settings folded with the Brand Kit. */
export async function loadDisclosureSettings(): Promise<DisclosureSettings> {
  const base = cachedDisclosureSettings();
  return applyBrandKit(base, await brandKit());
}

/** Persist the export defaults for next time. */
export async function saveDisclosureSettings(s: DisclosureSettings): Promise<void> {
  const next = normalizeSettings(s);
  writeDisclosureCache(next);
  try {
    await savePrefs({ brand: { company: next.companyName, color: next.bgColor } as never });
  } catch {
    /* signed out: the local cache is enough */
  }
}
