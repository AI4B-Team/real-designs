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
  { id: "auto", label: "Auto", blurb: "Let The Model Choose The Move", seconds: 8,
    prompt: "Move the camera smoothly and naturally from the first framing to the final framing at an even pace." },
  { id: "walkthrough", label: "Walkthrough", blurb: "Walk Forward Through The Space", seconds: 8,
    prompt: "A steady eye-level walkthrough moving forward through the space, ending on the final framing." },
  { id: "push_in", label: "Push In", blurb: "Move Toward The Subject", seconds: 6,
    prompt: "A slow push in toward the subject, settling on the final framing." },
  { id: "pull_out", label: "Pull Out", blurb: "Move Away And Reveal", seconds: 6,
    prompt: "A slow pull out that gradually reveals more of the space, settling on the final framing." },
  { id: "pan", label: "Pan", blurb: "Sweep Across The Space", seconds: 6,
    prompt: "A smooth horizontal pan across the space, coming to rest on the final framing." },
  { id: "orbit", label: "Orbit", blurb: "Arc Around The Subject", seconds: 8,
    prompt: "A gentle arcing orbit around the subject, ending on the final framing." },
  { id: "reveal", label: "Reveal", blurb: "Open Onto The Second Frame", seconds: 8,
    prompt: "The camera moves through the space and opens onto the final framing as a reveal." },
  { id: "custom", label: "Custom", blurb: "Describe The Move Yourself", seconds: 8,
    prompt: "Move the camera from the first framing to the final framing exactly as described." },
];

export function seMotion(id?: string | null): SeMotion {
  return SE_MOTIONS.find((m) => m.id === id) || SE_MOTIONS[0];
}

export function seMotionLabel(id?: string | null): string {
  return seMotion(id).label;
}

export const SE_DURATIONS = [4, 6, 8];

/** Statuses a Start/End generation can be in. */
export const SE_ACTIVE = ["queued", "processing"];

export function seBusy(row?: { status?: string | null } | null): boolean {
  return !!row && SE_ACTIVE.includes(String(row.status || ""));
}

export function seDone(row?: { status?: string | null; clip_path?: string | null } | null): boolean {
  return !!row && row.status === "completed";
}
