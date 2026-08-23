/**
 * Shared "active Studio style" selection.
 *
 * Explore writes the canonical style id here when the user presses
 * "Try This Style". Studio reads it on mount so the choice survives a page
 * refresh, back navigation and the upload / sample flows. Selecting a style
 * never generates anything and never spends a credit.
 */

import {
  buildStylePayload,
  styleById,
  type StylePayload,
  type StyleRecord,
} from "@/lib/style-catalog";
import { getDraft, setDraftStyle, removeDraftStyle } from "@/lib/studio-draft";

/* The style is not a separate record: it lives on the canonical Studio draft
   so it stays scoped to one project and can never leak into the next one. */

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
    payload: buildStylePayload({
      style: rec.id,
      projectType: rec.compatibleProjectTypes[0] || "interior",
    }),
    ts: Date.now(),
  };
}

/** Validates the id against the catalog and stores it on the draft. */
let announcing = false;
export function setStudioStyle(id?: string | null): StudioStyleChoice | null {
  const rec = styleById(id);
  if (!rec) return null;
  const choice = build(rec);
  /* Re-selecting the style already on the draft is a no-op. Listeners re-read
     the choice when they hear the event, and some of them write it back, so
     announcing an unchanged selection would loop forever. */
  const prev = getDraft();
  if (prev && prev.styleId === choice.styleId) return choice;
  setDraftStyle(rec.id);
  if (announcing) return choice;
  announcing = true;
  try {
    window.dispatchEvent(new CustomEvent("rd:style-selected", { detail: choice }));
  } catch (_) {
  } finally {
    announcing = false;
  }
  return choice;
}


/** Reads the draft's style, re-validated against the current catalog. */
export function getStudioStyle(): StudioStyleChoice | null {
  const d = getDraft();
  const rec = d && styleById(d.styleId);
  if (!rec) return null;
  return build(rec);
}

export function clearStudioStyle(): void {
  removeDraftStyle();
  try {
    window.dispatchEvent(new CustomEvent("rd:style-cleared"));
  } catch (_) {}
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
  try {
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (_) {}
  return true;
}
