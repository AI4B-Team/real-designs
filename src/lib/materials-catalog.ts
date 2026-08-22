/**
 * The REAL DESIGNS material catalog.
 *
 * One DOM-free dataset owns every surface the Materials tool can target and
 * every replacement material that is legitimate for that surface. Flooring
 * materials never appear under Countertop, roofing never appears indoors, and
 * each material carries the finish, colour, pattern and scale choices a real
 * specifier would have to make — plus the sentence the model receives.
 *
 * Nothing here touches credits, prompts-as-a-whole or the DOM: the brief in
 * @/lib/materials-brief composes those from this data.
 */

/* --------------------------------------------------------------- surfaces */

export type SurfaceKindId =
  | "flooring"
  | "wall_paint"
  | "wall_tile"
  | "backsplash"
  | "countertop"
  | "cabinetry"
  | "island"
  | "ceiling"
  | "trim_doors"
  | "fireplace"
  | "siding"
  | "roofing"
  | "exterior_trim"
  | "front_door"
  | "paving"
  | "decking"
  | "fencing"
  | "gravel_bed";

export type SurfaceKind = {
  id: SurfaceKindId;
  label: string;
  /** Plain sentence shown under the surface chip. */
  blurb: string;
  /** How the surface is named to the model. */
  promptName: string;
  /** Indoors, outdoors or both — drives which surfaces are offered. */
  scope: "interior" | "exterior" | "both";
  /** Material families that are legitimate replacements for this surface. */
  families: MaterialFamily[];
};

export const SURFACE_KINDS: SurfaceKind[] = [
  {
    id: "flooring",
    label: "Flooring",
    blurb: "The walking surface of the room, wall to wall.",
    promptName: "the floor surface",
    scope: "interior",
    families: ["wood", "tile", "stone", "resilient", "carpet", "concrete"],
  },
  {
    id: "wall_paint",
    label: "Wall Paint",
    blurb: "Painted wall planes, excluding tile and panelling.",
    promptName: "the painted wall surfaces",
    scope: "both",
    families: ["paint", "plaster", "wallcovering", "panelling"],
  },
  {
    id: "wall_tile",
    label: "Wall Tile",
    blurb: "Tiled walls in bathrooms, showers and wet areas.",
    promptName: "the tiled wall surfaces",
    scope: "interior",
    families: ["tile", "stone"],
  },
  {
    id: "backsplash",
    label: "Backsplash",
    blurb: "The splash zone between counter and upper cabinets.",
    promptName: "the kitchen backsplash",
    scope: "interior",
    families: ["tile", "stone", "metal"],
  },
  {
    id: "countertop",
    label: "Countertop",
    blurb: "Worktops on base cabinets, islands and vanities.",
    promptName: "the countertop surfaces",
    scope: "interior",
    families: ["stone", "solid_surface", "wood", "concrete"],
  },
  {
    id: "cabinetry",
    label: "Cabinetry",
    blurb: "Cabinet doors, drawer fronts and visible frames.",
    promptName: "the cabinet doors and drawer fronts",
    scope: "interior",
    families: ["paint", "wood", "laminate"],
  },
  {
    id: "island",
    label: "Island",
    blurb: "The island body only, kept separate from the perimeter.",
    promptName: "the kitchen island body",
    scope: "interior",
    families: ["paint", "wood", "stone", "laminate"],
  },
  {
    id: "ceiling",
    label: "Ceiling",
    blurb: "The ceiling plane and any exposed beams.",
    promptName: "the ceiling surface",
    scope: "interior",
    families: ["paint", "plaster", "panelling", "wood"],
  },
  {
    id: "trim_doors",
    label: "Trim And Doors",
    blurb: "Baseboards, casings, interior doors and millwork.",
    promptName: "the trim, casings and interior doors",
    scope: "interior",
    families: ["paint", "wood"],
  },
  {
    id: "fireplace",
    label: "Fireplace Surround",
    blurb: "The surround and hearth only, not the firebox.",
    promptName: "the fireplace surround and hearth",
    scope: "interior",
    families: ["stone", "tile", "paint", "plaster", "brick"],
  },
  {
    id: "siding",
    label: "Siding",
    blurb: "The exterior wall cladding of the building.",
    promptName: "the exterior siding",
    scope: "exterior",
    families: ["siding", "brick", "stone", "stucco", "paint"],
  },
  {
    id: "roofing",
    label: "Roofing",
    blurb: "The visible roof planes.",
    promptName: "the roof surface",
    scope: "exterior",
    families: ["roofing"],
  },
  {
    id: "exterior_trim",
    label: "Exterior Trim",
    blurb: "Fascia, corner boards, window trim and soffits.",
    promptName: "the exterior trim boards",
    scope: "exterior",
    families: ["paint", "wood"],
  },
  {
    id: "front_door",
    label: "Front Door",
    blurb: "The entry door slab only.",
    promptName: "the front entry door",
    scope: "exterior",
    families: ["paint", "wood"],
  },
  {
    id: "paving",
    label: "Driveway And Paving",
    blurb: "Driveway, walkway and patio paving.",
    promptName: "the driveway and paved surfaces",
    scope: "exterior",
    families: ["paving", "concrete", "stone"],
  },
  {
    id: "decking",
    label: "Decking",
    blurb: "Deck boards, steps and deck railings.",
    promptName: "the deck boards",
    scope: "exterior",
    families: ["wood", "composite"],
  },
  {
    id: "fencing",
    label: "Fencing",
    blurb: "Fence panels, gates and posts.",
    promptName: "the fencing",
    scope: "exterior",
    families: ["wood", "composite", "metal"],
  },
  {
    id: "gravel_bed",
    label: "Ground Cover",
    blurb: "Gravel beds, mulch and loose ground cover.",
    promptName: "the loose ground cover beds",
    scope: "exterior",
    families: ["groundcover"],
  },
];

export function surfaceKind(id?: string | null): SurfaceKind | null {
  const key = String(id || "").trim().toLowerCase();
  return SURFACE_KINDS.find((s) => s.id === key) || null;
}

export function surfaceLabel(id?: string | null): string {
  return surfaceKind(id)?.label || "Surface";
}

/** Surfaces offered for a space, so roofing never shows up in a bedroom. */
export function surfacesForSpace(space?: string | null): SurfaceKind[] {
  const s = String(space || "").toLowerCase();
  const exterior = s.includes("exterior") || s.includes("outdoor") || s.includes("yard") || s.includes("curb");
  return SURFACE_KINDS.filter((k) =>
    k.scope === "both" ? true : exterior ? k.scope === "exterior" : k.scope === "interior",
  );
}

/* -------------------------------------------------------------- materials */

export type MaterialFamily =
  | "wood"
  | "tile"
  | "stone"
  | "resilient"
  | "carpet"
  | "concrete"
  | "paint"
  | "plaster"
  | "wallcovering"
  | "panelling"
  | "laminate"
  | "solid_surface"
  | "metal"
  | "brick"
  | "stucco"
  | "siding"
  | "roofing"
  | "paving"
  | "composite"
  | "groundcover";

export const FAMILY_LABELS: Record<MaterialFamily, string> = {
  wood: "Wood",
  tile: "Tile",
  stone: "Stone",
  resilient: "Resilient",
  carpet: "Carpet",
  concrete: "Concrete",
  paint: "Paint",
  plaster: "Plaster",
  wallcovering: "Wallcovering",
  panelling: "Panelling",
  laminate: "Laminate",
  solid_surface: "Solid Surface",
  metal: "Metal",
  brick: "Brick",
  stucco: "Stucco",
  siding: "Siding",
  roofing: "Roofing",
  paving: "Paving",
  composite: "Composite",
  groundcover: "Ground Cover",
};

export type MaterialOption = { id: string; label: string; prompt: string };

export type Material = {
  id: string;
  name: string;
  family: MaterialFamily;
  /** Which surfaces this material may legitimately be applied to. */
  kinds: SurfaceKindId[];
  blurb: string;
  /** The physical description the model receives. */
  spec: string;
  /** Flat swatch colour for the picker. */
  swatch: string;
  finishes: MaterialOption[];
  colors: MaterialOption[];
  patterns?: MaterialOption[];
  scales?: MaterialOption[];
  /** Rough installed cost band, used for the honesty note only. */
  band: "budget" | "mid" | "premium";
};

const SHEENS: MaterialOption[] = [
  { id: "matte", label: "Matte", prompt: "a matte, low-sheen finish that scatters light" },
  { id: "satin", label: "Satin", prompt: "a satin finish with a soft, even sheen" },
  { id: "semi_gloss", label: "Semi Gloss", prompt: "a semi-gloss finish with clear but not mirrored reflections" },
];

const STONE_FINISH: MaterialOption[] = [
  { id: "polished", label: "Polished", prompt: "polished, reflecting the room's light sources crisply" },
  { id: "honed", label: "Honed", prompt: "honed to a flat matte surface with no mirror reflection" },
  { id: "leathered", label: "Leathered", prompt: "leathered, with a soft textured low sheen" },
];

const WOOD_FINISH: MaterialOption[] = [
  { id: "matte", label: "Matte Oil", prompt: "an oiled matte finish where the grain stays visible" },
  { id: "satin", label: "Satin Lacquer", prompt: "a satin lacquer with a gentle sheen" },
  { id: "wire_brushed", label: "Wire Brushed", prompt: "wire-brushed, with the open grain physically textured" },
];

const PLANK_SCALES: MaterialOption[] = [
  { id: "narrow", label: "Narrow Strip", prompt: "narrow strip boards roughly 3 inches wide" },
  { id: "standard", label: "Standard Plank", prompt: "standard planks roughly 5 inches wide" },
  { id: "wide", label: "Wide Plank", prompt: "wide planks roughly 8 inches wide" },
];

const TILE_SCALES: MaterialOption[] = [
  { id: "small", label: "Small Format", prompt: "small format tiles around 4 by 4 inches" },
  { id: "standard", label: "Standard", prompt: "standard tiles around 12 by 24 inches" },
  { id: "large", label: "Large Format", prompt: "large format tiles around 24 by 48 inches with minimal grout lines" },
];

const TILE_PATTERNS: MaterialOption[] = [
  { id: "stack", label: "Stacked", prompt: "laid in a straight stacked grid" },
  { id: "offset", label: "Offset", prompt: "laid in a one-third offset running bond" },
  { id: "herringbone", label: "Herringbone", prompt: "laid in a herringbone pattern" },
  { id: "vertical", label: "Vertical Stack", prompt: "laid in a vertical stacked pattern" },
];

const PLANK_PATTERNS: MaterialOption[] = [
  { id: "straight", label: "Straight Lay", prompt: "run straight, boards parallel to the longest wall" },
  { id: "diagonal", label: "Diagonal", prompt: "run on a 45 degree diagonal" },
  { id: "herringbone", label: "Herringbone", prompt: "laid in a herringbone pattern" },
  { id: "chevron", label: "Chevron", prompt: "laid in a chevron pattern" },
];

function color(id: string, label: string, prompt: string): MaterialOption {
  return { id, label, prompt };
}

export const MATERIALS: Material[] = [
  /* ---------------------------------------------------------- flooring */
  {
    id: "white_oak",
    name: "White Oak",
    family: "wood",
    kinds: ["flooring", "island", "cabinetry", "ceiling", "decking"],
    blurb: "Engineered white oak with a calm, open grain.",
    spec: "engineered white oak boards with visible open grain, subtle colour variation board to board, micro-bevelled edges and end joints that stagger naturally",
    swatch: "#c8a97e",
    finishes: WOOD_FINISH,
    colors: [
      color("natural", "Natural", "a natural pale honey tone"),
      color("blonde", "Blonde", "a bleached blonde tone"),
      color("greige", "Greige", "a soft grey-beige stain"),
      color("walnut_stain", "Walnut Stain", "a mid walnut brown stain"),
    ],
    patterns: PLANK_PATTERNS,
    scales: PLANK_SCALES,
    band: "premium",
  },
  {
    id: "walnut",
    name: "American Walnut",
    family: "wood",
    kinds: ["flooring", "cabinetry", "island", "countertop"],
    blurb: "Deep chocolate hardwood with a rich figure.",
    spec: "American walnut boards with deep chocolate tone, pronounced grain figure and natural sapwood variation",
    swatch: "#6b4630",
    finishes: WOOD_FINISH,
    colors: [
      color("natural", "Natural", "its natural dark chocolate tone"),
      color("light", "Light Walnut", "a lighter, warmer walnut tone"),
    ],
    patterns: PLANK_PATTERNS,
    scales: PLANK_SCALES,
    band: "premium",
  },
  {
    id: "lvp",
    name: "Luxury Vinyl Plank",
    family: "resilient",
    kinds: ["flooring"],
    blurb: "Waterproof plank with a printed wood grain.",
    spec: "rigid-core luxury vinyl plank with a printed wood grain, repeating every few boards, crisp micro-bevel edges and a uniform low sheen",
    swatch: "#b79a76",
    finishes: [
      { id: "matte", label: "Matte", prompt: "a matte wear layer" },
      { id: "satin", label: "Satin", prompt: "a satin wear layer with a light sheen" },
    ],
    colors: [
      color("light_oak", "Light Oak", "a light oak tone"),
      color("grey_oak", "Grey Oak", "a cool grey oak tone"),
      color("warm_hickory", "Warm Hickory", "a warm hickory tone with contrast"),
    ],
    patterns: PLANK_PATTERNS,
    scales: PLANK_SCALES,
    band: "budget",
  },
  {
    id: "porcelain_wood",
    name: "Wood Look Porcelain",
    family: "tile",
    kinds: ["flooring", "wall_tile", "decking"],
    blurb: "Porcelain planks with a wood grain print and grout joints.",
    spec: "porcelain plank tile printed with a wood grain, laid with tight matching grout joints that stay visible",
    swatch: "#bda887",
    finishes: [
      { id: "matte", label: "Matte", prompt: "a matte, slip-rated surface" },
      { id: "satin", label: "Satin", prompt: "a satin surface with a light sheen" },
    ],
    colors: [
      color("natural", "Natural Oak", "a natural oak tone"),
      color("grey", "Grey", "a cool grey tone"),
    ],
    patterns: PLANK_PATTERNS,
    scales: PLANK_SCALES,
    band: "mid",
  },
  {
    id: "marble_tile",
    name: "Marble Look Porcelain",
    family: "tile",
    kinds: ["flooring", "wall_tile", "backsplash", "fireplace"],
    blurb: "Large format porcelain with soft marble veining.",
    spec: "large format porcelain with soft grey marble veining, veins that never repeat identically between tiles and thin matching grout joints",
    swatch: "#e7e5e1",
    finishes: STONE_FINISH,
    colors: [
      color("white_grey", "White And Grey", "a white field with soft grey veining"),
      color("warm_white", "Warm White", "a warm white field with beige veining"),
      color("dramatic", "Dramatic", "a deeper field with bold contrasting veining"),
    ],
    patterns: TILE_PATTERNS,
    scales: TILE_SCALES,
    band: "mid",
  },
  {
    id: "zellige",
    name: "Zellige Tile",
    family: "tile",
    kinds: ["backsplash", "wall_tile", "fireplace"],
    blurb: "Hand-glazed tile with an irregular, glossy face.",
    spec: "hand-glazed zellige tile with irregular edges, a rippled glossy face and visible colour variation from tile to tile",
    swatch: "#dfe6e2",
    finishes: [{ id: "gloss", label: "Glossy", prompt: "a wet, uneven glossy glaze" }],
    colors: [
      color("white", "Chalk White", "a chalk white glaze"),
      color("sage", "Sage", "a soft sage green glaze"),
      color("clay", "Clay", "a terracotta clay glaze"),
      color("ink", "Ink", "a deep ink blue glaze"),
    ],
    patterns: TILE_PATTERNS,
    scales: [{ id: "small", label: "4 x 4", prompt: "roughly 4 by 4 inch tiles" }],
    band: "premium",
  },
  {
    id: "subway",
    name: "Subway Tile",
    family: "tile",
    kinds: ["backsplash", "wall_tile"],
    blurb: "Classic ceramic rectangles with defined grout.",
    spec: "ceramic subway tile with crisp edges, a uniform glaze and clearly visible grout joints",
    swatch: "#f2f1ee",
    finishes: [
      { id: "gloss", label: "Glossy", prompt: "a glossy glaze" },
      { id: "matte", label: "Matte", prompt: "a matte glaze" },
    ],
    colors: [
      color("white", "White", "a bright white glaze"),
      color("bone", "Bone", "a warm bone glaze"),
      color("charcoal", "Charcoal", "a charcoal glaze"),
    ],
    patterns: TILE_PATTERNS,
    scales: [
      { id: "classic", label: "3 x 6", prompt: "classic 3 by 6 inch tiles" },
      { id: "long", label: "2 x 8", prompt: "elongated 2 by 8 inch tiles" },
    ],
    band: "budget",
  },
  {
    id: "wool_carpet",
    name: "Wool Loop Carpet",
    family: "carpet",
    kinds: ["flooring"],
    blurb: "Soft wool loop pile with a tight, even texture.",
    spec: "wool loop pile carpet with a tight even texture, a soft matte surface and no pattern",
    swatch: "#cfc7ba",
    finishes: [{ id: "loop", label: "Loop Pile", prompt: "a low loop pile" }],
    colors: [
      color("oatmeal", "Oatmeal", "an oatmeal tone"),
      color("stone", "Stone", "a mid stone grey"),
      color("charcoal", "Charcoal", "a charcoal tone"),
    ],
    band: "mid",
  },
  {
    id: "polished_concrete",
    name: "Polished Concrete",
    family: "concrete",
    kinds: ["flooring", "countertop", "paving"],
    blurb: "Ground and sealed concrete with fine aggregate.",
    spec: "ground and sealed concrete showing fine aggregate, subtle mottling and occasional control joints",
    swatch: "#b9b7b2",
    finishes: [
      { id: "honed", label: "Honed", prompt: "honed to a matte finish" },
      { id: "polished", label: "Polished", prompt: "polished to a soft reflective sheen" },
    ],
    colors: [
      color("grey", "Natural Grey", "a natural grey tone"),
      color("warm", "Warm Grey", "a warm grey tone"),
    ],
    band: "mid",
  },

  /* ------------------------------------------------------- countertops */
  {
    id: "quartz",
    name: "Engineered Quartz",
    family: "solid_surface",
    kinds: ["countertop", "backsplash", "island"],
    blurb: "Consistent engineered slab with controlled veining.",
    spec: "engineered quartz slab with a consistent field, controlled veining that runs continuously across the slab and a clean square or eased edge",
    swatch: "#eceae5",
    finishes: STONE_FINISH,
    colors: [
      color("white_vein", "White With Veining", "a white field with soft grey veining"),
      color("solid_white", "Solid White", "a solid white field with no veining"),
      color("greige", "Greige", "a warm greige field"),
      color("charcoal", "Charcoal", "a charcoal field with fine white veining"),
    ],
    band: "mid",
  },
  {
    id: "marble_slab",
    name: "Marble Slab",
    family: "stone",
    kinds: ["countertop", "backsplash", "fireplace", "island"],
    blurb: "Natural marble with genuine, unrepeatable veining.",
    spec: "natural marble slab with genuine unrepeatable veining that flows across the surface and turns down any visible edge",
    swatch: "#eae7e2",
    finishes: STONE_FINISH,
    colors: [
      color("carrara", "Carrara", "a white Carrara field with soft grey veining"),
      color("calacatta", "Calacatta", "a bright white field with bold grey and gold veining"),
      color("nero", "Nero", "a black field with white veining"),
    ],
    band: "premium",
  },
  {
    id: "granite",
    name: "Granite",
    family: "stone",
    kinds: ["countertop", "island"],
    blurb: "Speckled natural stone with high durability.",
    spec: "natural granite slab with a dense speckled mineral pattern and a squared edge profile",
    swatch: "#7d7a75",
    finishes: STONE_FINISH,
    colors: [
      color("salt_pepper", "Salt And Pepper", "a grey salt and pepper pattern"),
      color("black", "Absolute Black", "a near black field"),
      color("brown", "Warm Brown", "a warm brown speckled field"),
    ],
    band: "mid",
  },
  {
    id: "butcher_block",
    name: "Butcher Block",
    family: "wood",
    kinds: ["countertop", "island"],
    blurb: "Edge-grain hardwood worktop with visible joins.",
    spec: "edge-grain hardwood butcher block with visible glue lines between staves and a softened front edge",
    swatch: "#c19a6b",
    finishes: [
      { id: "oil", label: "Oiled", prompt: "an oiled matte finish" },
      { id: "satin", label: "Satin", prompt: "a satin sealed finish" },
    ],
    colors: [
      color("maple", "Maple", "a pale maple tone"),
      color("walnut", "Walnut", "a dark walnut tone"),
    ],
    band: "budget",
  },

  /* -------------------------------------------------------- paint etc. */
  {
    id: "flat_paint",
    name: "Interior Paint",
    family: "paint",
    kinds: ["wall_paint", "ceiling", "trim_doors", "cabinetry", "island", "fireplace", "exterior_trim", "front_door", "siding"],
    blurb: "A clean repaint of the existing surface, texture intact.",
    spec: "an even coat of paint that follows the existing wall texture exactly, with clean cut lines at trim, ceiling and corners",
    swatch: "#eeece7",
    finishes: SHEENS,
    colors: [
      color("warm_white", "Warm White", "a warm off-white"),
      color("cool_white", "Cool White", "a crisp cool white"),
      color("greige", "Greige", "a soft greige"),
      color("sage", "Sage", "a muted sage green"),
      color("navy", "Deep Navy", "a deep navy"),
      color("charcoal", "Charcoal", "a soft charcoal"),
      color("clay", "Clay", "a warm terracotta clay"),
      color("black", "Soft Black", "a soft near-black"),
    ],
    band: "budget",
  },
  {
    id: "limewash",
    name: "Limewash",
    family: "plaster",
    kinds: ["wall_paint", "ceiling", "fireplace", "siding"],
    blurb: "Mineral wash with soft cloudy movement.",
    spec: "a mineral limewash with soft cloudy movement and a chalky matte surface, varying gently across the plane",
    swatch: "#e3ded4",
    finishes: [{ id: "matte", label: "Chalky Matte", prompt: "a chalky matte surface" }],
    colors: [
      color("chalk", "Chalk", "a chalk white wash"),
      color("bone", "Bone", "a warm bone wash"),
      color("clay", "Clay", "a pale clay wash"),
      color("smoke", "Smoke", "a soft grey wash"),
    ],
    band: "mid",
  },
  {
    id: "venetian_plaster",
    name: "Venetian Plaster",
    family: "plaster",
    kinds: ["wall_paint", "fireplace", "ceiling"],
    blurb: "Burnished plaster with depth and subtle sheen.",
    spec: "burnished Venetian plaster with layered trowel movement and a subtle polished sheen catching the light",
    swatch: "#ded6c9",
    finishes: [
      { id: "burnished", label: "Burnished", prompt: "burnished to a soft polish" },
      { id: "matte", label: "Matte", prompt: "left matte with visible trowel texture" },
    ],
    colors: [
      color("ivory", "Ivory", "an ivory tone"),
      color("taupe", "Taupe", "a soft taupe tone"),
      color("terracotta", "Terracotta", "a muted terracotta tone"),
    ],
    band: "premium",
  },
  {
    id: "shiplap",
    name: "Shiplap Panelling",
    family: "panelling",
    kinds: ["wall_paint", "ceiling", "fireplace"],
    blurb: "Horizontal boards with an even shadow gap.",
    spec: "painted shiplap boards with an even shadow gap between each board, running level and wrapping corners cleanly",
    swatch: "#f0eee9",
    finishes: SHEENS,
    colors: [
      color("white", "White", "a clean white"),
      color("greige", "Greige", "a soft greige"),
      color("sage", "Sage", "a muted sage"),
    ],
    patterns: [
      { id: "horizontal", label: "Horizontal", prompt: "boards running horizontally" },
      { id: "vertical", label: "Vertical", prompt: "boards running vertically" },
    ],
    band: "mid",
  },
  {
    id: "slat_wood",
    name: "Wood Slat Panelling",
    family: "panelling",
    kinds: ["wall_paint", "ceiling", "fireplace"],
    blurb: "Vertical timber slats over a dark backer.",
    spec: "vertical timber slats at an even spacing over a dark recessed backer, with consistent shadow lines",
    swatch: "#a9825a",
    finishes: WOOD_FINISH,
    colors: [
      color("oak", "Oak", "a natural oak tone"),
      color("walnut", "Walnut", "a dark walnut tone"),
    ],
    band: "premium",
  },
  {
    id: "grasscloth",
    name: "Grasscloth",
    family: "wallcovering",
    kinds: ["wall_paint", "ceiling"],
    blurb: "Woven natural fibre wallcovering with visible seams.",
    spec: "woven grasscloth wallcovering with visible horizontal fibre texture and honest vertical seams at panel widths",
    swatch: "#d6c9ad",
    finishes: [{ id: "natural", label: "Natural", prompt: "an unlacquered natural surface" }],
    colors: [
      color("sand", "Sand", "a sand tone"),
      color("flax", "Flax", "a pale flax tone"),
      color("olive", "Olive", "a muted olive tone"),
    ],
    band: "premium",
  },
  {
    id: "laminate_slab",
    name: "Slab Laminate Fronts",
    family: "laminate",
    kinds: ["cabinetry", "island"],
    blurb: "Flat-front cabinet fronts with a uniform surface.",
    spec: "flat slab cabinet fronts with a uniform surface, consistent reveals between doors and the existing hardware positions retained",
    swatch: "#d8d4cd",
    finishes: [
      { id: "matte", label: "Matte", prompt: "a matte surface" },
      { id: "gloss", label: "Gloss", prompt: "a gloss surface" },
    ],
    colors: [
      color("white", "White", "a clean white"),
      color("graphite", "Graphite", "a graphite grey"),
      color("oak", "Oak Print", "an oak woodgrain print"),
    ],
    band: "budget",
  },
  {
    id: "brick",
    name: "Brick",
    family: "brick",
    kinds: ["fireplace", "siding", "wall_paint"],
    blurb: "Laid brick with real mortar joints.",
    spec: "laid brick with genuine mortar joints, colour variation brick to brick and a running bond course pattern",
    swatch: "#a4614b",
    finishes: [
      { id: "natural", label: "Natural", prompt: "left natural with an unsealed face" },
      { id: "whitewash", label: "Whitewashed", prompt: "lightly whitewashed so the brick texture shows through" },
    ],
    colors: [
      color("red", "Red", "a classic red brick"),
      color("white", "Painted White", "a painted white brick"),
      color("charcoal", "Charcoal", "a charcoal brick"),
    ],
    band: "mid",
  },
  {
    id: "brushed_metal",
    name: "Brushed Metal",
    family: "metal",
    kinds: ["backsplash", "fencing"],
    blurb: "Sheet metal with a directional brushed grain.",
    spec: "sheet metal with a directional brushed grain and soft, diffuse reflections rather than mirror reflections",
    swatch: "#b7b9bb",
    finishes: [{ id: "brushed", label: "Brushed", prompt: "a brushed directional finish" }],
    colors: [
      color("steel", "Stainless", "a stainless steel tone"),
      color("brass", "Brass", "an unlacquered brass tone"),
      color("black", "Blackened", "a blackened steel tone"),
    ],
    band: "mid",
  },

  /* ---------------------------------------------------------- exterior */
  {
    id: "fiber_cement",
    name: "Fiber Cement Siding",
    family: "siding",
    kinds: ["siding"],
    blurb: "Lap boards with a consistent exposure and crisp shadow.",
    spec: "fiber cement lap siding with a consistent board exposure, crisp shadow lines and clean butt joints",
    swatch: "#cfd3d2",
    finishes: [{ id: "matte", label: "Matte", prompt: "a factory matte finish" }],
    colors: [
      color("white", "Arctic White", "an arctic white"),
      color("greige", "Greige", "a warm greige"),
      color("slate", "Slate", "a slate grey"),
      color("black", "Iron Black", "an iron black"),
      color("sage", "Sage", "a muted sage"),
    ],
    patterns: [
      { id: "lap", label: "Lap", prompt: "horizontal lap boards" },
      { id: "board_batten", label: "Board And Batten", prompt: "vertical board and batten" },
      { id: "shake", label: "Shake", prompt: "staggered shake courses" },
    ],
    band: "mid",
  },
  {
    id: "stucco",
    name: "Stucco",
    family: "stucco",
    kinds: ["siding"],
    blurb: "Continuous rendered finish with a fine texture.",
    spec: "continuous rendered stucco with a fine sand float texture and clean returns at openings",
    swatch: "#e2ded4",
    finishes: [
      { id: "sand", label: "Sand Float", prompt: "a fine sand float texture" },
      { id: "smooth", label: "Smooth", prompt: "a smooth troweled texture" },
    ],
    colors: [
      color("white", "White", "a white render"),
      color("sand", "Sand", "a sand render"),
      color("grey", "Grey", "a grey render"),
    ],
    band: "mid",
  },
  {
    id: "stone_veneer",
    name: "Stone Veneer",
    family: "stone",
    kinds: ["siding", "fireplace"],
    blurb: "Stacked natural stone with real joint shadows.",
    spec: "stacked natural stone veneer with irregular stone sizes, genuine joint shadows and no repeating stone pattern",
    swatch: "#9a958c",
    finishes: [{ id: "natural", label: "Natural", prompt: "a natural cleft face" }],
    colors: [
      color("grey", "Grey Ledge", "a grey ledgestone blend"),
      color("tan", "Tan", "a tan and cream blend"),
      color("charcoal", "Charcoal", "a charcoal blend"),
    ],
    band: "premium",
  },
  {
    id: "arch_shingle",
    name: "Architectural Shingle",
    family: "roofing",
    kinds: ["roofing"],
    blurb: "Dimensional asphalt shingle with staggered tabs.",
    spec: "dimensional asphalt shingles with staggered tabs, visible course lines and consistent granule texture",
    swatch: "#5c5f63",
    finishes: [{ id: "standard", label: "Standard", prompt: "a standard granulated surface" }],
    colors: [
      color("charcoal", "Charcoal", "a charcoal blend"),
      color("weathered_wood", "Weathered Wood", "a weathered wood blend"),
      color("slate", "Slate", "a slate grey blend"),
    ],
    band: "budget",
  },
  {
    id: "standing_seam",
    name: "Standing Seam Metal",
    family: "roofing",
    kinds: ["roofing"],
    blurb: "Metal panels with raised seams running up the slope.",
    spec: "standing seam metal roofing with raised seams running straight up the slope at an even spacing and a low satin sheen",
    swatch: "#6e7377",
    finishes: [{ id: "satin", label: "Satin", prompt: "a satin painted finish" }],
    colors: [
      color("black", "Matte Black", "a matte black"),
      color("charcoal", "Charcoal", "a charcoal grey"),
      color("bronze", "Bronze", "a dark bronze"),
      color("galv", "Galvalume", "a natural galvalume silver"),
    ],
    band: "premium",
  },
  {
    id: "paver",
    name: "Concrete Pavers",
    family: "paving",
    kinds: ["paving"],
    blurb: "Modular pavers with real joint lines.",
    spec: "modular concrete pavers with consistent joint lines, slight unit-to-unit colour variation and clean edge restraint",
    swatch: "#b3aca2",
    finishes: [{ id: "matte", label: "Matte", prompt: "an unsealed matte surface" }],
    colors: [
      color("grey", "Grey", "a natural grey"),
      color("charcoal", "Charcoal", "a charcoal tone"),
      color("sand", "Sand", "a sand tone"),
    ],
    patterns: [
      { id: "running", label: "Running Bond", prompt: "laid in a running bond" },
      { id: "herringbone", label: "Herringbone", prompt: "laid in a herringbone pattern" },
      { id: "stack", label: "Stacked", prompt: "laid in a stacked grid" },
    ],
    band: "mid",
  },
  {
    id: "composite_deck",
    name: "Composite Decking",
    family: "composite",
    kinds: ["decking", "fencing"],
    blurb: "Composite boards with an embossed grain.",
    spec: "composite deck boards with an embossed grain, even gaps between boards and consistent board runs",
    swatch: "#8c7256",
    finishes: [{ id: "matte", label: "Matte", prompt: "a matte embossed surface" }],
    colors: [
      color("teak", "Teak", "a warm teak tone"),
      color("grey", "Driftwood Grey", "a driftwood grey"),
      color("espresso", "Espresso", "a dark espresso tone"),
    ],
    band: "mid",
  },
  {
    id: "gravel",
    name: "Gravel Bed",
    family: "groundcover",
    kinds: ["gravel_bed", "paving"],
    blurb: "Loose aggregate with a natural, uneven surface.",
    spec: "loose aggregate gravel with a naturally uneven surface, varied stone sizes and a defined bed edge",
    swatch: "#c2bcae",
    finishes: [{ id: "loose", label: "Loose", prompt: "a loose raked surface" }],
    colors: [
      color("pea", "Pea Gravel", "a pale pea gravel"),
      color("basalt", "Basalt", "a dark basalt chip"),
      color("river", "River Rock", "a mixed river rock"),
    ],
    band: "budget",
  },
];

export function material(id?: string | null): Material | null {
  const key = String(id || "").trim().toLowerCase();
  return MATERIALS.find((m) => m.id === key) || null;
}

/** Every material that is legitimate for one surface, grouped for the picker. */
export function materialsForSurface(kind?: string | null): Material[] {
  const k = surfaceKind(kind);
  if (!k) return [];
  return MATERIALS.filter((m) => m.kinds.includes(k.id));
}

export function materialGroups(kind?: string | null): Array<{ family: MaterialFamily; label: string; items: Material[] }> {
  const list = materialsForSurface(kind);
  const out: Array<{ family: MaterialFamily; label: string; items: Material[] }> = [];
  list.forEach((m) => {
    let g = out.find((x) => x.family === m.family);
    if (!g) {
      g = { family: m.family, label: FAMILY_LABELS[m.family], items: [] };
      out.push(g);
    }
    g.items.push(m);
  });
  return out;
}

/** A material is never offered for a surface it cannot physically go on. */
export function isCompatible(kind: string | null | undefined, materialId: string | null | undefined): boolean {
  const k = surfaceKind(kind);
  const m = material(materialId);
  return !!k && !!m && m.kinds.includes(k.id);
}

export function optionOf(list: MaterialOption[] | undefined, id?: string | null): MaterialOption | null {
  if (!list || !list.length) return null;
  const key = String(id || "").trim().toLowerCase();
  return list.find((o) => o.id === key) || list[0] || null;
}

export const BAND_NOTE: Record<Material["band"], string> = {
  budget: "Typically the most affordable option in its category.",
  mid: "Typically a mid-range option in its category.",
  premium: "Typically a premium option in its category.",
};
