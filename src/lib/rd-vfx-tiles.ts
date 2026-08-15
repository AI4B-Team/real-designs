/* Named VFX tiles for the video builder Step 3 modal.
   A tile is either a color grade (free, maps onto a VFX_LOOKS id) or a
   generative effect that adds content to the frame, which costs credits and
   forces a disclosure label on that scene. */

export type VfxTile = {
  id: string;
  label: string;
  sub: string;
  cats: string[];
  /** Color grade id from VFX_LOOKS, when this tile is a free grade. */
  look?: string | null;
  /** True when the tile adds content to the frame. */
  gen?: boolean;
  /** Forced disclosure key when gen. */
  disclosure?: string;
  /** Credit cost per scene when gen. */
  credits?: number;
};

export const VFX_GEN_CREDITS_PER_SCENE = 6;

export const VFX_TILE_CATEGORIES: Array<[string, string]> = [
  ["all", "All"],
  ["outdoor", "Outdoor"],
  ["indoor", "Indoor"],
  ["timelapse", "Timelapse"],
  ["fan", "Ceiling Fan"],
  ["word", "Word Drop"],
];

export const VFX_TILES: VfxTile[] = [
  { id: "none", label: "None", sub: "No Visual Effect Applied", cats: ["all"], look: null },
  { id: "day_twilight", label: "Day To Twilight", sub: "Daylight To Twilight Timelapse", cats: ["timelapse", "outdoor"], look: "twilight_deep" },
  { id: "sunshine", label: "Sunshine", sub: "From Dawn To Noon", cats: ["timelapse", "outdoor"], look: "summer_sun" },
  { id: "starry_night", label: "Starry Night", sub: "Day To Star-Filled Night", cats: ["timelapse", "outdoor"], look: "blue_hour" },
  { id: "golden_hour", label: "Golden Hour", sub: "Warm Late Afternoon Light", cats: ["timelapse", "outdoor"], look: "goldenhour" },
  { id: "pencil_sketch", label: "Pencil Sketch", sub: "Hand-Drawn Style", cats: ["all"], look: "editorial" },
  { id: "virtual_staging", label: "Virtual Staging", sub: "Furnished Interior Look", cats: ["indoor"], gen: true, disclosure: "staged", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "lifestyle", label: "Lifestyle", sub: "People And Animation", cats: ["indoor"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "shadows", label: "Shadows", sub: "Cast Shadows Across The Scene", cats: ["outdoor"], look: "high_contrast" },
  { id: "sway_trees", label: "Sway Trees", sub: "Gently Sway Outdoor Foliage", cats: ["outdoor"], look: "spring_bloom" },
  { id: "construction", label: "Construction", sub: "Construction Timelapse", cats: ["timelapse"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "fan_spin", label: "Spin Ceiling Fan", sub: "Animate The Ceiling Fan Blades", cats: ["fan"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "fan_static", label: "Static Ceiling Fan", sub: "Keep The Ceiling Fan Still", cats: ["fan"], look: null },
  { id: "word_for_sale", label: "For Sale", sub: "3D Word Drop", cats: ["word"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "word_just_listed", label: "Just Listed", sub: "3D Word Drop", cats: ["word"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
  { id: "word_open_house", label: "Open House", sub: "3D Word Drop", cats: ["word"], gen: true, disclosure: "altered", credits: VFX_GEN_CREDITS_PER_SCENE },
];

export const tileById = (id?: string | null): VfxTile | null =>
  VFX_TILES.find((t) => t.id === id) || null;

export const tilesForCat = (cat: string): VfxTile[] =>
  cat === "all" ? VFX_TILES : VFX_TILES.filter((t) => t.id === "none" || t.cats.includes(cat));
