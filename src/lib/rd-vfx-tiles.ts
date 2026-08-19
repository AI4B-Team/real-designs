/* Named VFX tiles for the video builder Effects modal.
   A tile is either a colour grade (free, maps onto a VFX_LOOKS id) or a
   generative effect that adds content to the frame, which costs credits and
   forces a disclosure label on that scene.

   Stored ids never change: a saved draft keeps working when a label or a
   category is edited here. */

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

/** Display categories for the Effects tab. */
export const VFX_TILE_CATEGORIES: Array<[string, string]> = [
  ["recommended", "Recommended"],
  ["exterior", "Exterior"],
  ["interior", "Interior"],
  ["timelapse", "Timelapse"],
  ["environment", "Environment"],
  ["transformation", "Transformation"],
];

export const VFX_TILES: VfxTile[] = [
  { id: "none", label: "None", sub: "No Visual Effect Applied", cats: ["recommended"], look: null },

  /* Free colour treatments that still read as an "effect" to the user. */
  {
    id: "day_twilight",
    label: "Twilight Photo",
    sub: "Still Photo Graded To Twilight",
    cats: ["recommended", "timelapse", "exterior"],
    look: "twilight_deep",
  },
  {
    id: "sunshine",
    label: "Sunshine",
    sub: "Bright Midday Light",
    cats: ["recommended", "timelapse", "exterior"],
    look: "summer_sun",
  },
  {
    id: "starry_night",
    label: "Starry Night",
    sub: "Night Sky Grade",
    cats: ["timelapse", "exterior"],
    look: "blue_hour",
  },
  {
    id: "golden_hour",
    label: "Golden Hour",
    sub: "Warm Late Afternoon Light",
    cats: ["recommended", "timelapse", "exterior"],
    look: "goldenhour",
  },
  {
    id: "pencil_sketch",
    label: "Pencil Sketch",
    sub: "Hand-Drawn Style",
    cats: ["recommended", "transformation"],
    look: "editorial",
  },
  {
    id: "shadows",
    label: "Shadows",
    sub: "Cast Shadows Across The Scene",
    cats: ["exterior", "environment"],
    look: "high_contrast",
  },
  {
    id: "sway_trees",
    label: "Foliage",
    sub: "Fresh Planting Grade",
    cats: ["exterior", "environment"],
    look: "spring_bloom",
  },
  {
    id: "fan_static",
    label: "Static Ceiling Fan",
    sub: "Keep The Ceiling Fan Still",
    cats: ["interior"],
    look: null,
  },

  /* Generative — real image generation, priced and disclosed. */
  {
    id: "virtual_staging",
    label: "Virtual Staging",
    sub: "Furnish An Empty Interior",
    cats: ["recommended", "interior", "transformation"],
    gen: true,
    disclosure: "staged",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    sub: "People Enjoying The Space",
    cats: ["interior", "transformation"],
    gen: true,
    disclosure: "lifestyle",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "construction",
    label: "Construction",
    sub: "Unfinished Space Rendered Finished",
    cats: ["transformation"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "fan_spin",
    label: "Ceiling Fan",
    sub: "Fan Blades In Motion",
    cats: ["interior", "environment"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "fx_fireplace",
    label: "Fireplace",
    sub: "Lit Fire In An Existing Fireplace",
    cats: ["interior", "environment"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "fx_pool",
    label: "Pool Water",
    sub: "Clean, Lit Water In An Existing Pool",
    cats: ["exterior", "environment"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "fx_curtains",
    label: "Curtains",
    sub: "Dressed Windows In An Existing Room",
    cats: ["interior", "environment"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "word_for_sale",
    label: "For Sale",
    sub: "3D Word Drop",
    cats: ["transformation"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "word_just_listed",
    label: "Just Listed",
    sub: "3D Word Drop",
    cats: ["recommended", "transformation"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
  {
    id: "word_open_house",
    label: "Open House",
    sub: "3D Word Drop",
    cats: ["transformation"],
    gen: true,
    disclosure: "altered",
    credits: VFX_GEN_CREDITS_PER_SCENE,
  },
];

export const tileById = (id?: string | null): VfxTile | null =>
  VFX_TILES.find((t) => t.id === id) || null;

export const tilesForCat = (cat: string): VfxTile[] =>
  cat === "all" ? VFX_TILES : VFX_TILES.filter((t) => t.id === "none" || t.cats.includes(cat));
