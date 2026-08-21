/**
 * Consolidated Canvas capabilities.
 *
 * REAL DESIGNS keeps one Canvas and one settings panel. Specialized editing
 * features (paint visualizer, floor editor, material swap, design advisor,
 * critique, smart home) are NOT separate destinations: each is a capability
 * of an existing tool and is expressed here so a single list drives the UI.
 */

export type CapabilityId = string;

export type Capability = {
  id: CapabilityId;
  label: string;
  icon: string;
  /** One line of truthful explanation shown under the capability. */
  blurb: string;
};

/** Tools that own capabilities. Ids match the tool rail's data-tool values. */
export const CAPABILITIES: Record<string, Capability[]> = {
  "Object Edit": [
    { id: "obj-replace", label: "Select And Replace Object", icon: "replace", blurb: "Swap one masked object for another." },
    { id: "obj-remove", label: "Remove Object", icon: "eraser", blurb: "Erase the masked object and rebuild behind it." },
    { id: "obj-preserve", label: "Preserve Object", icon: "lock", blurb: "Lock the mask so generation cannot change it." },
    { id: "obj-target", label: "Targeted Changes", icon: "crosshair", blurb: "Apply an instruction to the mask only." },
    { id: "obj-refine", label: "Precise Mask Refinement", icon: "brush", blurb: "Add, remove and brush the mask edges." },
  ],
  "Material Swap": [
    { id: "mat-surface", label: "Select A Surface", icon: "square-dashed", blurb: "Pick a real pixel mask before choosing a material." },
    { id: "mat-apply", label: "Apply Material", icon: "paint-roller", blurb: "Applies to the selected mask only." },
  ],
  "Virtual Stage": [
    { id: "stage-furniture", label: "Furniture Staging", icon: "sofa", blurb: "Add appropriate furniture to the space." },
    { id: "stage-decor", label: "Decor Staging", icon: "flower-2", blurb: "Add art, rugs, plants and soft goods." },
    { id: "stage-fill", label: "Fill Empty Space", icon: "layout-dashboard", blurb: "Complete a sparse or empty room." },
    { id: "stage-replace", label: "Replace Furniture", icon: "replace", blurb: "Swap existing pieces for a new direction." },
    { id: "stage-remove", label: "Remove Furniture", icon: "eraser", blurb: "Clear pieces before staging." },
    { id: "stage-compose", label: "Room Composition", icon: "grid-2x2", blurb: "Rearrange the layout and flow." },
  ],
  "Sketch To Render": [
    { id: "sketch-render", label: "Sketch To Render", icon: "pen-tool", blurb: "Turn a line drawing into a photoreal render." },
    { id: "sketch-upload", label: "Upload Drawing", icon: "upload", blurb: "Bring in a scan or exported drawing." },
    { id: "sketch-mark", label: "Mark Changes On The Photo", icon: "highlighter", blurb: "Draw directly on the current photo." },
    { id: "sketch-concept", label: "Generate From Rough Concept", icon: "sparkles", blurb: "Build from a loose concept sketch." },
  ],
  "Design Assistant": [
    { id: "ai-recommend", label: "Get Design Recommendations", icon: "lightbulb", blurb: "Directions that suit this space." },
    { id: "ai-review", label: "Review The Current Room", icon: "search-check", blurb: "Read the room as it stands today." },
    { id: "ai-critique", label: "Critique A Generated Version", icon: "message-square-warning", blurb: "Honest notes on the version on canvas." },
    { id: "ai-improve", label: "Suggest Improvements", icon: "wand-sparkles", blurb: "Concrete next moves." },
    { id: "ai-materials", label: "Recommend Materials", icon: "layers", blurb: "Finishes that fit the detected surfaces." },
    { id: "ai-planning", label: "Recommend Space Planning", icon: "ruler", blurb: "Layout and circulation notes." },
    { id: "ai-smart", label: "Recommend Smart-Home Upgrades", icon: "cpu", blurb: "Practical automation for this room." },
    { id: "ai-scope", label: "Explain Likely Renovation Scope", icon: "hard-hat", blurb: "What the change would involve." },
    { id: "ai-prompt", label: "Suggested Prompt", icon: "pencil-line", blurb: "Editable before anything is generated." },
  ],
};

export function capabilitiesFor(tool: string): Capability[] {
  return CAPABILITIES[tool] || [];
}

/* ------------------------------------------------------------ materials */

export type SurfaceKind = "wall" | "floor" | "cabinet" | "countertop" | "exterior";

export type MaterialCategory = { id: string; label: string };

const MATERIALS: Record<SurfaceKind, MaterialCategory[]> = {
  wall: [
    { id: "paint", label: "Paint" },
    { id: "wallpaper", label: "Wallpaper" },
    { id: "paneling", label: "Paneling" },
    { id: "tile", label: "Tile" },
    { id: "other", label: "Other Finish" },
  ],
  floor: [
    { id: "lvp", label: "LVP" },
    { id: "hardwood", label: "Hardwood" },
    { id: "tile", label: "Tile" },
    { id: "carpet", label: "Carpet" },
    { id: "concrete", label: "Concrete" },
    { id: "stone", label: "Stone" },
    { id: "other", label: "Other" },
  ],
  cabinet: [
    { id: "paint-stain", label: "Paint Or Stain" },
    { id: "door-style", label: "Door Style" },
    { id: "hardware", label: "Hardware" },
    { id: "countertop", label: "Countertop" },
    { id: "backsplash", label: "Backsplash" },
  ],
  countertop: [
    { id: "quartz", label: "Quartz" },
    { id: "granite", label: "Granite" },
    { id: "marble", label: "Marble" },
    { id: "butcher-block", label: "Butcher Block" },
    { id: "concrete", label: "Concrete" },
    { id: "solid-surface", label: "Solid Surface" },
    { id: "other", label: "Other" },
  ],
  exterior: [
    { id: "paint", label: "Paint" },
    { id: "stucco", label: "Stucco" },
    { id: "siding", label: "Siding" },
    { id: "brick", label: "Brick" },
    { id: "stone", label: "Stone" },
    { id: "roofing", label: "Roofing" },
    { id: "trim", label: "Trim" },
  ],
};

/** Map a detected object/surface label onto a material family. */
export function surfaceKind(label?: string | null): SurfaceKind | null {
  const v = String(label || "").toLowerCase();
  if (!v) return null;
  if (/counter|island top|vanity top/.test(v)) return "countertop";
  if (/cabinet|cupboard|millwork|vanity/.test(v)) return "cabinet";
  if (/floor|rug area|tile floor|decking/.test(v)) return "floor";
  if (/wall|ceiling|backsplash|paneling/.test(v)) return "wall";
  if (/siding|stucco|brick|roof|facade|trim|exterior/.test(v)) return "exterior";
  return null;
}

/**
 * Material categories for a detected surface. Returns an empty list when no
 * mask has been selected yet — the UI must then ask for a selection instead
 * of inventing a surface.
 */
export function materialsForSurface(label?: string | null): MaterialCategory[] {
  const kind = surfaceKind(label);
  return kind ? MATERIALS[kind] : [];
}

export function materialsForKind(kind: SurfaceKind): MaterialCategory[] {
  return MATERIALS[kind];
}
