/** Canonical REAL DESIGNS design directions. Single source shared by the public
 *  Explore catalog and the authenticated app Explore screen. */
import { PHOTOS } from "@/content/rd-photos";

const P = PHOTOS;

export type Direction = {
  id: string; name: string; img: string; line: string; about: string;
  palette: string[]; spaces: string[]; materials: string[]; finishes: string[];
  rooms: string[]; budgets: string[]; grades: string[];
  traits?: string[]; examples?: string[]; staging?: boolean;
};

const BASE: Direction[] = [
  {
    id: "warm-minimal", name: "Warm Minimal", img: P.after,
    line: "Quiet palette, warm woods, nothing extra.",
    about: "Soft neutrals and oak warmth with very little visual noise. Reads calm on camera and photographs wide, which makes it a safe default for resale and rental listings alike.",
    palette: ["#EFEAE2", "#D9CBB6", "#8C7A63", "#2E2A26"],
    spaces: ["Interior"], materials: ["White oak", "Linen", "Honed quartz", "Matte brass"],
    finishes: ["Wide plank oak floors", "Flat panel cabinetry", "Warm white walls"],
    rooms: ["Living Room", "Primary Bedroom", "Kitchen"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "organic-modern", name: "Organic Modern", img: P.neutral,
    line: "Rounded forms, natural texture, modern lines.",
    about: "Modern geometry softened with plaster, boucle and stone. Works well when the architecture is plain and the space needs character without a renovation.",
    palette: ["#F2EDE6", "#CBB9A3", "#7D7466", "#3A342C"],
    spaces: ["Interior"], materials: ["Limewash plaster", "Boucle", "Travertine", "Blackened steel"],
    finishes: ["Plaster walls", "Stone coffee table", "Curved seating"],
    rooms: ["Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "modern-farmhouse", name: "Modern Farmhouse", img: P.farmhouse,
    line: "Painted millwork, black hardware, honest materials.",
    about: "Shaker millwork and matte black fittings against warm white. Broad buyer appeal in suburban markets and forgiving on mid budgets.",
    palette: ["#FBF8F3", "#DAD2C4", "#4B5D53", "#1C1B19"],
    spaces: ["Interior", "Exterior"], materials: ["Shaker doors", "Butcher block", "Matte black iron", "Shiplap"],
    finishes: ["Painted island", "Apron sink", "Board and batten"],
    rooms: ["Kitchen", "Living Room", "Primary Bath"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "quiet-luxury", name: "Quiet Luxury", img: P.luxury,
    line: "Stone slabs, deep tone, restrained detail.",
    about: "Fewer, better materials. Full slab stone, tailored upholstery and low contrast hardware. Best on properties where the finish grade already supports the price.",
    palette: ["#EDE9E3", "#B9A88F", "#5A5147", "#141210"],
    spaces: ["Interior"], materials: ["Book matched marble", "Walnut", "Bronze", "Wool"],
    finishes: ["Slab backsplash", "Integrated appliance panels", "Concealed lighting"],
    rooms: ["Primary Bath", "Kitchen", "Living Room"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade", "Premium"],
  },
  {
    id: "japandi", name: "Japandi", img: P.japandi,
    line: "Pale wood, low profiles, disciplined space.",
    about: "Japanese restraint with Scandinavian warmth. Very few objects, strong horizontal lines and matte finishes throughout.",
    palette: ["#F4F1EA", "#CFC5B4", "#7C8579", "#26241F"],
    spaces: ["Interior"], materials: ["Ash", "Paper shades", "Clay plaster", "Rattan"],
    finishes: ["Low bed platform", "Frameless joinery", "Matte black taps"],
    rooms: ["Primary Bedroom", "Living Room"], budgets: ["Refresh", "Makeover"], grades: ["Retail Grade"],
  },
  {
    id: "coastal", name: "Coastal", img: P.coastal,
    line: "Bright whites, soft blues, open light.",
    about: "Light woods and washed blues that make small rooms read larger. Strong performer for short term rental photography.",
    palette: ["#FDFCF9", "#D7E3E6", "#8FA9B4", "#2C3A42"],
    spaces: ["Interior", "Exterior"], materials: ["Whitewashed oak", "Cotton", "Sea grass", "Polished nickel"],
    finishes: ["White trim", "Slat detail", "Woven textures"],
    rooms: ["Living Room", "Primary Bedroom"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "mid-century", name: "Mid-Century", img: P.midcentury,
    line: "Walnut, tapered legs, graphic contrast.",
    about: "Warm walnut, low seating and a tight accent palette. Suits post-war architecture and open plan living rooms.",
    palette: ["#F0E7D8", "#C08A4E", "#3F6152", "#211C17"],
    spaces: ["Interior"], materials: ["Walnut", "Leather", "Terrazzo", "Brass"],
    finishes: ["Slat room divider", "Tapered leg casegoods", "Globe lighting"],
    rooms: ["Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "industrial", name: "Industrial", img: P.industrial,
    line: "Raw brick, steel frames, utility lighting.",
    about: "Exposed structure treated as the finish. Cost efficient when the shell is already interesting and the budget is tight.",
    palette: ["#E8E4DE", "#A2764F", "#585A5C", "#171717"],
    spaces: ["Interior"], materials: ["Brick", "Blackened steel", "Concrete", "Reclaimed oak"],
    finishes: ["Steel framed glazing", "Sealed concrete floors", "Exposed conduit"],
    rooms: ["Living Room", "Kitchen"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "transitional", name: "Transitional", img: P.bedroomAfter,
    line: "Classic bones, current finishes, low risk.",
    about: "The middle lane. Traditional profiles paired with modern hardware and lighting, which appraises well and dates slowly.",
    palette: ["#F6F3EE", "#CFC3B2", "#6D6A64", "#232120"],
    spaces: ["Interior"], materials: ["Painted millwork", "Quartz", "Satin nickel", "Wool blend"],
    finishes: ["Recessed panel doors", "Subtle crown", "Layered lighting"],
    rooms: ["Primary Bedroom", "Living Room", "Dining Room"], budgets: ["Makeover", "Renovation"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "contemporary", name: "Contemporary", img: P.officeAfter,
    line: "Flat fronts, crisp edges, controlled contrast.",
    about: "Handleless joinery, large format tile and a tight two tone palette. Strong for newer builds and condo interiors.",
    palette: ["#FFFFFF", "#D5D7D8", "#6A6E70", "#101112"],
    spaces: ["Interior"], materials: ["Large format porcelain", "Lacquer", "Glass", "Matte aluminium"],
    finishes: ["Handleless cabinets", "Linear lighting", "Full height tile"],
    rooms: ["Kitchen", "Primary Bath", "Home Office"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade", "Premium"],
  },
  {
    id: "mediterranean", name: "Mediterranean", img: P.resortYard,
    line: "Warm stucco, terracotta, shaded outdoor rooms.",
    about: "Sun tolerant materials, arched openings and planted courtyards. Best used across exterior and landscape together.",
    palette: ["#F5EDE0", "#D6A97B", "#94743F", "#3B2E22"],
    spaces: ["Exterior", "Landscape"], materials: ["Stucco", "Terracotta", "Limestone", "Olive planting"],
    finishes: ["Arched openings", "Clay tile", "Gravel courtyard"],
    rooms: ["Backyard", "Front Elevation"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade", "Premium"],
  },
  {
    id: "scandinavian", name: "Scandinavian", img: P.stageStaged,
    line: "Light floors, soft contrast, functional layout.",
    about: "Pale floors, white walls and a small number of well chosen pieces. The most economical direction for virtual staging.",
    palette: ["#FFFFFF", "#E6DED2", "#A9AFA6", "#2B2B2B"],
    spaces: ["Interior"], materials: ["Pale oak", "Wool", "Powder coated steel", "Cotton"],
    finishes: ["White walls", "Light plank floors", "Simple casegoods"],
    rooms: ["Living Room", "Primary Bedroom"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "craftsman-revival", name: "Craftsman Revival", img: P.craftsman,
    line: "Tapered columns, deep eaves, honest woodwork.",
    about: "Period correct porch detail, painted siding and stained timber. Restores character to post-war and bungalow elevations without changing the footprint.",
    palette: ["#F1EBDF", "#9C6B43", "#4A5A48", "#1F1B17"],
    spaces: ["Exterior"], materials: ["Painted siding", "Stained cedar", "Stone base", "Bronze fixtures"],
    finishes: ["Tapered porch columns", "Exposed rafter tails", "Divided light windows"],
    rooms: ["Front Elevation"], budgets: ["Makeover", "Renovation"], grades: ["Retail Grade"],
  },
  {
    id: "painted-brick", name: "Painted Brick", img: P.paintedBrick,
    line: "One coat of paint, an entirely new elevation.",
    about: "The highest return exterior move on dated brick. Limewash or masonry paint with refreshed trim, door and lighting.",
    palette: ["#F7F5F1", "#D8D2C8", "#6E6A64", "#1B1A18"],
    spaces: ["Exterior"], materials: ["Masonry paint", "Limewash", "Black steel", "Composite door"],
    finishes: ["Painted brick field", "Contrast trim", "Updated porch lighting"],
    rooms: ["Front Elevation"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade", "Retail Grade"],
  },
  {
    id: "resort-landscape", name: "Resort Landscape", img: P.resortYard,
    line: "Shaded seating, layered planting, evening light.",
    about: "Treats the yard as an outdoor room: paved living zone, structured planting and low voltage lighting for evening photography.",
    palette: ["#F2EFE7", "#C6B79A", "#4C6551", "#23231F"],
    spaces: ["Landscape"], materials: ["Porcelain paving", "Hardwood decking", "Palm planting", "Low voltage lighting"],
    finishes: ["Shade structure", "Built-in seating", "Planted borders"],
    rooms: ["Backyard"], budgets: ["Renovation", "Full Remodel"], grades: ["Retail Grade", "Premium"],
  },
  {
    id: "low-maintenance-yard", name: "Low Maintenance Yard", img: P.yardAfter,
    line: "Gravel, native planting, almost no upkeep.",
    about: "Drought tolerant planting, defined edging and hard surfaces. Built for rentals and turnover properties where nobody is mowing.",
    palette: ["#F4F1E9", "#CFC4AC", "#7C8A6C", "#2A2823"],
    spaces: ["Landscape"], materials: ["Decomposed granite", "Native grasses", "Steel edging", "Concrete pavers"],
    finishes: ["Gravel beds", "Drip irrigation", "Paver walkway"],
    rooms: ["Backyard", "Front Elevation"], budgets: ["Refresh", "Makeover"], grades: ["Rental Grade"],
  },
];

const TRAITS: Record<string, string[]> = {
  "warm-minimal": ["Warm", "Minimal", "Rental-Friendly"],
  "organic-modern": ["Organic", "Warm", "Minimal"],
  "modern-farmhouse": ["Traditional", "Warm", "Rental-Friendly"],
  "quiet-luxury": ["Luxury", "Minimal"],
  japandi: ["Minimal", "Organic"],
  coastal: ["Warm", "Rental-Friendly"],
  "mid-century": ["Bold", "Warm"],
  industrial: ["Bold", "Rental-Friendly"],
  transitional: ["Traditional", "Rental-Friendly"],
  contemporary: ["Minimal", "Bold", "Luxury"],
  mediterranean: ["Warm", "Traditional", "Organic"],
  scandinavian: ["Minimal", "Rental-Friendly"],
  "craftsman-revival": ["Traditional", "Warm"],
  "painted-brick": ["Bold", "Rental-Friendly"],
  "resort-landscape": ["Luxury", "Organic"],
  "low-maintenance-yard": ["Organic", "Rental-Friendly"],
};

/** Extra photoreal examples shown in the direction preview. */
const EXAMPLES: Record<string, string[]> = {
  "warm-minimal": [P.after, P.kitchenAfter, P.stageEmpty],
  "organic-modern": [P.neutral, P.yardAfter, P.officeAfter],
  "modern-farmhouse": [P.farmhouse, P.paintedBrick, P.kitchenAfter],
  "quiet-luxury": [P.luxury, P.bath, P.after],
  japandi: [P.japandi, P.bedroomAfter, P.neutral],
  coastal: [P.coastal, P.stageStaged, P.exteriorAfter],
  "mid-century": [P.midcentury, P.officeAfter, P.after],
  industrial: [P.industrial, P.kitchen, P.officeAfter],
  transitional: [P.bedroomAfter, P.after, P.bath],
  contemporary: [P.officeAfter, P.exteriorAfter, P.luxury],
  mediterranean: [P.resortYard, P.craftsman, P.yardAfter],
  scandinavian: [P.stageStaged, P.neutral, P.bedroomAfter],
  "craftsman-revival": [P.craftsman, P.ranch, P.exteriorAfter],
  "painted-brick": [P.paintedBrick, P.ranch, P.craftsman],
  "resort-landscape": [P.resortYard, P.yardAfter, P.exteriorAfter],
  "low-maintenance-yard": [P.yardAfter, P.resortYard, P.ranch],
};

/** Directions that also work as virtual staging presets for empty rooms. */
const STAGING = new Set(["warm-minimal", "scandinavian", "transitional", "contemporary", "coastal"]);

export const DIRECTIONS: Direction[] = BASE.map((d) => ({
  ...d,
  traits: TRAITS[d.id] ?? [],
  examples: EXAMPLES[d.id] ?? [d.img],
  staging: STAGING.has(d.id),
}));

export const TRAIT_OPTIONS = [
  "Warm", "Minimal", "Traditional", "Organic", "Bold", "Luxury", "Rental-Friendly",
] as const;
