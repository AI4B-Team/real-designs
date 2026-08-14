/**
 * Shared "active Studio style" selection.
 *
 * Explore writes the canonical style id here when the user presses
 * "Try This Style". Studio reads it on mount so the choice survives a page
 * refresh, back navigation and the upload / sample flows. Selecting a style
 * never generates anything and never spends a credit.
 */

import { buildStylePayload, styleById, type StylePayload, type StyleRecord } from "@/lib/style-catalog";

const KEY = "rd_style_choice";

export type StudioStyleChoice = {
  styleId: string;
  name: string;
  thumb: string;
  spaces: string[];
  palette: string[];
  payload: StylePayload;
  ts: number;
};

/** Studio space-chip value for a catalog project type. */
export function spaceForProjectType(t?: string): string {
  if (t === "exterior") return "exterior";
  if (t === "garden") return "landscape";
  if (t === "virtual-staging") return "staging";
  return "interior";
}

function build(rec: StyleRecord): StudioStyleChoice {
  return {
    styleId: rec.id,
    name: rec.displayName,
    thumb: rec.previewImage || "",
    spaces: (rec.compatibleProjectTypes || []).slice(),
    palette: (rec.swatches || []).slice(0, 5),
    payload: buildStylePayload({ style: rec.id, projectType: rec.compatibleProjectTypes[0] }),
    ts: Date.now(),
  };
}

/** Validates the id against the catalog and persists it. Returns null when unknown. */
export function setStudioStyle(id?: string | null): StudioStyleChoice | null {
  const rec = styleById(id);
  if (!rec) return null;
  const choice = build(rec);
  try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch (_) { /* storage may be blocked */ }
  try { window.dispatchEvent(new CustomEvent("rd:style-selected", { detail: choice })); } catch (_) {}
  return choice;
}

/** Reads the stored choice, re-validated against the current catalog. */
export function getStudioStyle(): StudioStyleChoice | null {
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; }
  const rec = raw && styleById(raw.styleId);
  if (!rec) return null;
  return { ...build(rec), ts: raw.ts || Date.now() };
}

export function clearStudioStyle(): void {
  try { localStorage.removeItem(KEY); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent("rd:style-cleared")); } catch (_) {}
}

/**
 * Mirrors the stored choice into the live Studio controls (style select and
 * space chip). Safe to call when the Studio markup is not mounted yet.
 */
export function applyStudioStyleToControls(choice?: StudioStyleChoice | null): boolean {
  const c = choice || getStudioStyle();
  if (!c) return false;
  const sel = document.getElementById("fStyle") as HTMLSelectElement | null;
  if (!sel) return false;

  const space = spaceForProjectType(c.spaces[0]);
  const chip = document.querySelector('#spChips [data-sp="' + space + '"]') as HTMLElement | null;
  if (chip && !chip.classList.contains("on")) chip.click();

  const has = Array.from(sel.options).some((o) => o.value === c.name || o.text === c.name);
  if (!has) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    opt.dataset["styleId"] = c.styleId;
    sel.insertBefore(opt, sel.firstChild);
  }
  sel.value = c.name;
  try { sel.dispatchEvent(new Event("change", { bubbles: true })); } catch (_) {}
  return true;
}
