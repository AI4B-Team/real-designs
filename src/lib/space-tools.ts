/**
 * Central space-aware tool configuration for the Studio Canvas.
 *
 * One place decides, for every combination of space type and tool:
 *  - the label the user reads (the internal tool identifier never changes),
 *  - the description,
 *  - whether the tool is supported at all,
 *  - which style family the style section offers and what it is called,
 *  - the instruction placeholder,
 *  - the space-specific rules the server prompt must carry.
 *
 * Click handlers read this module. They never re-derive compatibility.
 */

export type SpaceType = "interior" | "exterior" | "garden";

/** Style pools in the catalog keyed by project type. */
export type StyleProjectType = "interior" | "exterior" | "garden" | "virtual-staging" | "concept";

/** Canonical space for any chip value, project type or room space string. */
export function normalizeSpace(v?: string | null): SpaceType {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "exterior") return "exterior";
  if (s === "garden" || s === "landscape" || s === "yard" || s === "outdoor") return "garden";
  return "interior";
}

/** Credit cost per run, by internal tool identifier. */
export const TOOL_CREDITS: Record<string, number> = {
  Redesign: 1,
  "Virtual Stage": 1,
  Declutter: 1,
  "Material Swap": 1,
  "Sketch To Render": 1,
  Budget: 3,
  "Multi Angle": 1,
  "Walkthrough Video": 40,
  "2D To 3D Plan": 6,
};

export function toolCost(tool?: string | null): number {
  return TOOL_CREDITS[String(tool || "").trim()] ?? 1;
}

/** "1 Credit" / "40 Credits" — never "Free" unless the run truly costs zero. */
export function costLabel(credits: number): string {
  if (!credits) return "Free";
  return credits + " Credit" + (credits === 1 ? "" : "s");
}

type ToolCopy = { label: string; desc: string };

const BASE: Record<string, ToolCopy> = {
  Redesign: {
    label: "Redesign",
    desc: "Restyles the space while Reality Lock holds walls, windows and layout.",
  },
  "Virtual Stage": {
    label: "Stage",
    desc: "Choose the furniture and décor style for this room.",
  },
  Declutter: {
    label: "Declutter",
    desc: "Removes clutter and personal items without touching the architecture.",
  },
  "Material Swap": {
    label: "Materials",
    desc: "Swaps a single finish, such as flooring, counters or siding color.",
  },
  "Sketch To Render": {
    label: "Sketch",
    desc: "Turns a hand sketch or blueprint into a rendered room.",
  },
  Budget: {
    label: "Budget",
    desc: "Builds a line item scope with a planning range from the detected changes.",
  },
  "Multi Angle": {
    label: "Angles",
    desc: "Regenerates the same design from additional camera positions.",
  },
  "Walkthrough Video": {
    label: "Video",
    desc: "Renders a short dolly in walkthrough of the finished design.",
  },
  "2D To 3D Plan": {
    label: "Floorplan",
    desc: "Converts a flat floor plan into a furnished 3D plan and eye level render.",
  },
};

const OVERRIDES: Record<SpaceType, Record<string, Partial<ToolCopy>>> = {
  interior: {},
  exterior: {
    Redesign: { desc: "Restyles the facade and finishes while the structure stays exactly as built." },
    "Virtual Stage": {
      label: "Exterior Styling",
      desc: "Improve curb appeal with compatible landscaping, exterior décor, lighting, and finishes.",
    },
    Declutter: {
      label: "Declutter",
      desc: "Removes bins, vehicles, hoses and yard clutter without touching the building.",
    },
    "Material Swap": {
      label: "Materials",
      desc: "Swaps a single exterior finish, such as siding, roofing, paint or driveway paving.",
    },
    "Sketch To Render": { desc: "Turns an elevation sketch or plan into a rendered exterior." },
  },
  garden: {
    Redesign: { desc: "Restyles the yard while trees, grade and lot boundaries stay in place." },
    "Virtual Stage": {
      label: "Landscape Design",
      desc: "Add plants, hardscaping, lighting, and outdoor features in the selected style.",
    },
    Declutter: {
      label: "Declutter",
      desc: "Clears debris, hoses and stored items from the yard without changing planting.",
    },
    "Material Swap": {
      label: "Materials",
      desc: "Swaps a single outdoor material, such as paving, decking, gravel or fencing.",
    },
    "Sketch To Render": { desc: "Turns a landscape sketch or site plan into a rendered yard." },
  },
};

export function toolLabel(tool: string, space: SpaceType | string): string {
  const sp = normalizeSpace(space as string);
  const base = BASE[tool];
  return OVERRIDES[sp][tool]?.label || base?.label || tool;
}

export function toolDescription(tool: string, space: SpaceType | string): string {
  const sp = normalizeSpace(space as string);
  const base = BASE[tool];
  return OVERRIDES[sp][tool]?.desc || base?.desc || "";
}

/** Tools that cannot run on a space stay visible, disabled, with a reason. */
const UNSUPPORTED: Record<SpaceType, Record<string, string>> = {
  interior: {},
  exterior: {
    "2D To 3D Plan": "Floor plans are an interior tool. Switch Space Type to Interior to use it.",
  },
  garden: {
    "2D To 3D Plan": "Floor plans are an interior tool. Switch Space Type to Interior to use it.",
  },
};

export type ToolSupport = { ok: boolean; reason?: string };

export function toolSupport(tool: string, space: SpaceType | string): ToolSupport {
  const reason = UNSUPPORTED[normalizeSpace(space as string)][tool];
  return reason ? { ok: false, reason } : { ok: true };
}

/** First supported tool, used when the active tool becomes incompatible. */
export function fallbackTool(space: SpaceType | string): string {
  return toolSupport("Redesign", space).ok ? "Redesign" : "Declutter";
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

/** Which catalog pool the style section should offer. */
export function styleProjectType(
  need: "design" | "stage" | null | undefined,
  space: SpaceType | string,
): StyleProjectType {
  const sp = normalizeSpace(space as string);
  if (sp === "exterior") return "exterior";
  if (sp === "garden") return "garden";
  return need === "stage" ? "virtual-staging" : "interior";
}

/** Section label: never "Staging Style" on an exterior or garden photo. */
export function styleSectionLabel(
  need: "design" | "stage" | null | undefined,
  space: SpaceType | string,
): string {
  const sp = normalizeSpace(space as string);
  if (need === "stage") {
    if (sp === "exterior") return "Exterior Style";
    if (sp === "garden") return "Landscape Style";
    return "Staging Style";
  }
  if (sp === "exterior") return "Exterior Style";
  if (sp === "garden") return "Landscape Style";
  return "Design Style";
}

/** Prompt shown above the style browser for this space. */
export function styleSectionHint(
  need: "design" | "stage" | null | undefined,
  space: SpaceType | string,
): string {
  const sp = normalizeSpace(space as string);
  if (sp === "exterior")
    return "Pick the exterior style for this facade. Landscaping, lighting and finishes follow it.";
  if (sp === "garden")
    return "Pick the landscape style for this yard. Planting, hardscaping and lighting follow it.";
  if (need === "stage") return "Choose the furniture and décor style for this room.";
  return "Pick the direction this room should be redesigned in. Nothing is chosen for you.";
}

/** A style is submittable only when the catalog says it fits this pool. */
export function styleCompatible(
  compatibleProjectTypes: readonly string[] | undefined,
  need: "design" | "stage" | null | undefined,
  space: SpaceType | string,
): boolean {
  const wanted = styleProjectType(need, space);
  if (!compatibleProjectTypes || !compatibleProjectTypes.length) return false;
  return compatibleProjectTypes.indexOf(wanted) > -1;
}

/* ------------------------------------------------------------------ */
/* instructions + server prompt rules                                  */
/* ------------------------------------------------------------------ */

/** No pricing or budget promises: Budget is Coming Soon. */
export function instructionPlaceholder(_space: SpaceType | string): string {
  return "Keep the flooring, lighten the cabinets, and add an island.";
}

/** Space-specific instruction the model must receive. */
export function spacePromptIntro(
  space: SpaceType | string,
  tool: string,
  subject: string,
  styleName: string,
): string {
  const sp = normalizeSpace(space as string);
  const staging = String(tool || "").toLowerCase() === "virtual stage";
  if (sp === "exterior")
    return staging
      ? `Improve the curb appeal of this exterior photograph in the ${styleName} style using compatible landscaping, exterior decor, lighting and finishes.`
      : `Restyle the exterior of this ${subject} photograph in the ${styleName} style.`;
  if (sp === "garden")
    return staging
      ? `Design this outdoor space in the ${styleName} style by adding plants, hardscaping, lighting and outdoor features.`
      : `Restyle this ${subject} landscape photograph in the ${styleName} style.`;
  return staging
    ? `Stage this empty ${subject} photograph with furniture and decor in the ${styleName} style.`
    : `Redesign this ${subject} photograph in the ${styleName} style.`;
}

/** Architecture-preservation rules the payload always carries. */
export function spacePromptRules(space: SpaceType | string): string[] {
  const sp = normalizeSpace(space as string);
  if (sp === "exterior")
    return [
      "Exterior photograph: never add indoor furniture. Preserve the building structure, windows, doors, roofline, camera angle and lot boundaries exactly as photographed.",
      "Only landscaping, exterior decor, lighting, paint and exterior finishes may change.",
    ];
  if (sp === "garden")
    return [
      "Outdoor landscape photograph: never add indoor furniture. Preserve the building structure, grade, mature trees, camera angle and lot boundaries exactly as photographed.",
      "Only planting, hardscaping, outdoor lighting and outdoor features may change.",
    ];
  return [
    "Interior photograph: preserve walls, window and door positions, ceiling height, camera angle and room proportions exactly as photographed.",
  ];
}
