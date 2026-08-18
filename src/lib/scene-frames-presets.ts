/**
 * Start / End motion presets — pure, shared by the browser and the server.
 *
 * A Start/End clip is one generated shot that begins on the start frame and
 * finishes on the end frame. The preset chooses the camera language; the
 * optional prompt describes what should change along the way.
 */

export const SE_CREDITS = 40;

export type SeMotion = {
  id: string;
  label: string;
  blurb: string;
  prompt: string;
  seconds: number;
};

export const SE_MOTIONS: SeMotion[] = [
  { id: "auto", label: "Auto", blurb: "Best Movement For This Scene", seconds: 8,
    prompt: "Move the camera smoothly and naturally from the first framing to the final framing at an even pace." },
  { id: "walkthrough", label: "Walkthrough", blurb: "Move Forward Through The Space", seconds: 8,
    prompt: "A steady eye-level walkthrough moving forward through the space, ending on the final framing." },
  { id: "push_in", label: "Push In", blurb: "Move Toward The Subject", seconds: 6,
    prompt: "A slow push in toward the subject, settling on the final framing." },
  { id: "pull_out", label: "Pull Out", blurb: "Reveal More Of The Space", seconds: 6,
    prompt: "A slow pull out that gradually reveals more of the space, settling on the final framing." },
  { id: "pan", label: "Pan", blurb: "Move Across The Scene", seconds: 6,
    prompt: "A smooth horizontal pan across the space, coming to rest on the final framing." },
  { id: "orbit", label: "Orbit", blurb: "Curve Around The Subject", seconds: 8,
    prompt: "A gentle arcing orbit around the subject, ending on the final framing." },
  { id: "reveal", label: "Reveal", blurb: "End On The Selected Frame", seconds: 8,
    prompt: "The camera moves through the space and opens onto the final framing as a reveal." },
  { id: "custom", label: "Custom", blurb: "Describe Your Own Movement", seconds: 8,
    prompt: "Move the camera from the first framing to the final framing exactly as described." },
];

export function seMotion(id?: string | null): SeMotion {
  return SE_MOTIONS.find((m) => m.id === id) || (SE_MOTIONS[0] as SeMotion);
}

export function seMotionLabel(id?: string | null): string {
  return seMotion(id).label;
}

export const SE_DURATIONS = [4, 6, 8];

/**
 * Credit cost of one Start/End clip. The charge path meters a single "video"
 * action regardless of length, so every duration genuinely costs the same —
 * the cost is still derived here so the UI never hard-codes a number.
 */
export function seCost(_seconds?: number | null): number {
  return SE_CREDITS;
}


/** Statuses a Start/End generation can be in. */
export const SE_ACTIVE = ["queued", "processing"];

export function seBusy(row?: { status?: string | null } | null): boolean {
  return !!row && SE_ACTIVE.includes(String(row.status || ""));
}

export function seDone(row?: { status?: string | null; clip_path?: string | null } | null): boolean {
  return !!row && row.status === "completed";
}
