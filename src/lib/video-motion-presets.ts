/**
 * Targeted image-to-video motion presets.
 *
 * Real estate video is a small, well-understood vocabulary of camera moves.
 * This module is the single source of truth for that vocabulary: the label,
 * the plain-language description, the generation prompt, the simulated
 * preview transform and which spaces the move suits.
 */

export type MotionSpace = "interior" | "exterior" | "garden";

export type MotionStrength = "subtle" | "standard" | "dramatic";

export type MotionPreset = {
  id: string;
  label: string;
  /** What the viewer will see, in plain language. */
  blurb: string;
  /** Direction sent to the generator. */
  prompt: string;
  /** Spaces this move is recommended for. */
  spaces: MotionSpace[];
  /** Default clip length in seconds. */
  seconds: number;
};

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "pan_left",
    label: "Pan Left",
    blurb: "Sweep Across The Space To The Left",
    prompt: "A smooth horizontal camera pan to the left across the space, steady and even.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 5,
  },
  {
    id: "pan_right",
    label: "Pan Right",
    blurb: "Sweep Across The Space To The Right",
    prompt: "A smooth horizontal camera pan to the right across the space, steady and even.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 5,
  },
  {
    id: "tilt_up",
    label: "Tilt Up",
    blurb: "Rise To Show Height",
    prompt: "A slow upward tilt revealing the ceiling height or upper facade.",
    spaces: ["interior", "exterior"],
    seconds: 5,
  },
  {
    id: "tilt_down",
    label: "Tilt Down",
    blurb: "Settle Onto The Floor Plane",
    prompt: "A slow downward tilt settling onto the floor or ground plane.",
    spaces: ["interior", "garden"],
    seconds: 5,
  },
  {
    id: "zoom_in",
    label: "Zoom In",
    blurb: "Draw Attention To One Detail",
    prompt: "A gradual zoom in toward the focal detail of the scene.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 4,
  },
  {
    id: "zoom_out",
    label: "Zoom Out",
    blurb: "Open Up The Full View",
    prompt: "A gradual zoom out revealing the full extent of the space.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 4,
  },
  {
    id: "dolly_in",
    label: "Dolly In",
    blurb: "Move Forward Into The Room",
    prompt: "A steady dolly move forward into the space, camera height unchanged.",
    spaces: ["interior", "exterior"],
    seconds: 6,
  },
  {
    id: "dolly_out",
    label: "Dolly Out",
    blurb: "Pull Back From The Subject",
    prompt: "A steady dolly move backward away from the subject, camera height unchanged.",
    spaces: ["interior", "exterior"],
    seconds: 6,
  },
  {
    id: "orbit_left",
    label: "Orbit Left",
    blurb: "Curve Around To The Left",
    prompt: "A gentle arcing orbit to the left around the main subject.",
    spaces: ["exterior", "garden"],
    seconds: 6,
  },
  {
    id: "orbit_right",
    label: "Orbit Right",
    blurb: "Curve Around To The Right",
    prompt: "A gentle arcing orbit to the right around the main subject.",
    spaces: ["exterior", "garden"],
    seconds: 6,
  },
  {
    id: "reveal",
    label: "Reveal",
    blurb: "Open Onto The Full Space",
    prompt: "The camera moves through the space and opens onto the full view as a reveal.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 6,
  },
  {
    id: "walkthrough",
    label: "Walkthrough",
    blurb: "Walk Forward Through The Space",
    prompt: "A steady eye-level walkthrough moving forward through the space.",
    spaces: ["interior"],
    seconds: 8,
  },
  {
    id: "drift",
    label: "Subtle Drift",
    blurb: "Barely Perceptible Movement",
    prompt: "A very slight parallax drift, keeping the framing essentially still.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 4,
  },
  {
    id: "static",
    label: "Static Hold",
    blurb: "No Camera Movement",
    prompt: "A locked-off static shot with no camera movement.",
    spaces: ["interior", "exterior", "garden"],
    seconds: 4,
  },
];

export function motionPreset(id?: string | null): MotionPreset {
  return MOTION_PRESETS.find((m) => m.id === id) || (MOTION_PRESETS[0] as MotionPreset);
}

export function motionLabel(id?: string | null): string {
  return motionPreset(id).label;
}

/** Presets that suit a space, recommended ones first. */
export function motionsForSpace(space: MotionSpace | string): MotionPreset[] {
  const s = (["interior", "exterior", "garden"].includes(String(space))
    ? String(space)
    : "interior") as MotionSpace;
  const fits = MOTION_PRESETS.filter((m) => m.spaces.includes(s));
  const rest = MOTION_PRESETS.filter((m) => !m.spaces.includes(s));
  return [...fits, ...rest];
}

/** The move a space defaults to when the user has not chosen one. */
export function defaultMotionFor(space: MotionSpace | string): string {
  const s = String(space);
  if (s === "exterior") return "orbit_left";
  if (s === "garden") return "pan_right";
  return "dolly_in";
}

export const MOTION_STRENGTHS: Array<{ id: MotionStrength; label: string; scale: number }> = [
  { id: "subtle", label: "Subtle", scale: 0.55 },
  { id: "standard", label: "Standard", scale: 1 },
  { id: "dramatic", label: "Dramatic", scale: 1.6 },
];

export function strengthScale(id?: string | null): number {
  return MOTION_STRENGTHS.find((s) => s.id === id)?.scale ?? 1;
}

/**
 * Prompt sent to the generator: the preset's camera language plus the user's
 * own description of what should change. Never fabricates subject matter.
 */
export function motionPrompt(id: string, strength: MotionStrength, note?: string | null): string {
  const p = motionPreset(id);
  const pace =
    strength === "subtle"
      ? "Keep the movement minimal and understated."
      : strength === "dramatic"
        ? "Make the movement pronounced but still smooth."
        : "Keep the movement smooth and natural.";
  const extra = String(note || "").trim();
  return [p.prompt, pace, extra].filter(Boolean).join(" ");
}
