/**
 * REAL DESIGNS canonical style catalog.
 *
 * One immutable record per style. Alternate names live as aliases so saved
 * projects keep working when a display name changes. Every consumer — Explore,
 * Studio, the generation server functions and the admin manager — reads from
 * here so a style selection always reaches the generation payload.
 */

import { PHOTOS } from "@/content/rd-photos";
import { STYLE_PHOTOS } from "@/content/rd-style-photos";

export type ProjectType = "interior" | "exterior" | "garden" | "virtual-staging" | "concept";

export type StyleRecord = {
  id: string;
  slug: string;
  displayName: string;
  shortDescription: string;
  category: string;
  aliases: string[];
  compatibleProjectTypes: ProjectType[];
  compatibleRoomTypes: string[];
  palette: string[];
  swatches: string[];
  materials: string[];
  definingFeatures: string[];
  finishLevel: string[];
  mood: string[];
  generationPrompt: string;
  negativePrompt: string;
  previewImage: string;
  featuredRank: number;
  isFeatured: boolean;
  isActive: boolean;
  isAuto?: boolean;
};

/* ------------------------------------------------------------------ */
/* palette presets — 4 swatches each, reused across related styles      */
/* ------------------------------------------------------------------ */
const P4: Record<string, { names: string[]; hex: string[] }> = {
  warmneutral: { names: ["warm white", "sand", "taupe", "walnut"], hex: ["#F2EDE4", "#DDCDB6", "#8C7A63", "#2E2A26"] },
  organic: { names: ["oat", "clay", "olive", "espresso"], hex: ["#F4EFE7", "#CBB9A3", "#7D8467", "#3A342C"] },
  crisp: { names: ["white", "pale grey", "graphite", "black"], hex: ["#FFFFFF", "#E3E5E7", "#6B7075", "#171A1C"] },
  cool: { names: ["soft white", "mist", "slate", "ink"], hex: ["#F7F8F9", "#D6DCE1", "#7A858F", "#20262B"] },
  coastal: { names: ["chalk", "sea glass", "denim", "navy"], hex: ["#FDFCF9", "#D7E3E6", "#8FA9B4", "#2C3A42"] },
  farmhouse: { names: ["cream", "linen", "sage", "charcoal"], hex: ["#FBF8F3", "#DAD2C4", "#5C6E62", "#1C1B19"] },
  luxury: { names: ["alabaster", "greige", "bronze", "onyx"], hex: ["#EDE9E3", "#B9A88F", "#6B563C", "#141210"] },
  walnut: { names: ["bone", "amber", "forest", "walnut"], hex: ["#F0E7D8", "#C08A4E", "#3F6152", "#211C17"] },
  industrial: { names: ["concrete", "brick", "steel", "soot"], hex: ["#DCD8D3", "#A9705B", "#6E7378", "#1E1F21"] },
  japandi: { names: ["rice paper", "ash", "moss", "sumi"], hex: ["#F4F1EA", "#CFC5B4", "#7C8579", "#26241F"] },
  classic: { names: ["ivory", "parchment", "oxblood", "mahogany"], hex: ["#F6F1E7", "#DFD2BB", "#7E3B33", "#2A1F1A"] },
  glam: { names: ["blush", "champagne", "emerald", "jet"], hex: ["#F4E4E4", "#E0C591", "#1F5546", "#131113"] },
  deco: { names: ["cream", "gold", "teal", "black lacquer"], hex: ["#F3EADB", "#C9A227", "#14545C", "#111111"] },
  french: { names: ["chalk", "wheat", "lavender grey", "slate blue"], hex: ["#F5F1E8", "#DCC8A0", "#B7B3BE", "#4E5A69"] },
  medi: { names: ["limewash", "terracotta", "olive", "cobalt"], hex: ["#F4EDE1", "#C97B4E", "#77804F", "#2F4E73"] },
  desert: { names: ["bone", "sandstone", "rust", "cactus"], hex: ["#F1E7D9", "#D8B48C", "#B05C38", "#6E7A54"] },
  mountain: { names: ["snow", "stone", "pine", "bark"], hex: ["#EFEFEC", "#B7B2A8", "#3E5045", "#3A2E26"] },
  tropical: { names: ["shell", "palm", "teak", "lagoon"], hex: ["#F7F3E9", "#4F7A4B", "#8B5A2B", "#2E7D8C"] },
  boho: { names: ["cream", "terracotta", "ochre", "cocoa"], hex: ["#F5EDE1", "#C0714E", "#D6A24B", "#4A3527"] },
  retro: { names: ["butter", "orange", "avocado", "chocolate"], hex: ["#F5E3B3", "#D9683A", "#7E8B3C", "#4B2E20"] },
  dark: { names: ["parchment", "tobacco", "forest", "near black"], hex: ["#E9E0CE", "#8A6A45", "#2F3D33", "#15140F"] },
  garden: { names: ["gravel", "foliage", "bloom", "shadow"], hex: ["#E6E4DC", "#6F8A5A", "#C3A24B", "#2C332B"] },
  gardenformal: { names: ["limestone", "boxwood", "gravel", "yew"], hex: ["#EDE9DE", "#4F6B45", "#C9C2B2", "#26332A"] },
  gardenarid: { names: ["decomposed granite", "agave", "rust", "shade"], hex: ["#E8DDC9", "#8FA07A", "#B0603A", "#3B3A33"] },
};


const IMG = PHOTOS as Record<string, string>;
const pick = (k: string): string => IMG[k] || IMG["after"] || "";

type Row = {
  id: string;
  name: string;
  cat: string;
  t: string; // i=interior e=exterior g=garden s=virtual staging
  al?: string[];
  pal: keyof typeof P4;
  mat: string[];
  feat: string[];
  desc: string;
  img: string;
  fin?: string[];
  mood?: string[];
  rooms?: string[];
  rank?: number;
  neg?: string;
};

const ALL_ROOMS = ["Living Room", "Kitchen", "Bedroom", "Bathroom", "Dining Room", "Office", "Entry", "Basement"];
const NEG_BASE =
  "distorted architecture, warped perspective, extra rooms or windows, text, watermarks, logos, low resolution, cluttered composition, unrealistic lighting";

const ROWS: Row[] = [
  /* ---------------- Most Popular ---------------- */
  { id: "warm-minimal", name: "Warm Minimal", cat: "Most Popular", t: "is", pal: "warmneutral", rank: 1, img: "after",
    al: ["Warm Minimalism", "Soft Minimal"], mat: ["white oak", "linen", "honed quartz", "matte brass"],
    feat: ["quiet palette", "warm woods", "uncluttered surfaces"], desc: "Quiet palette, warm woods and nothing extra." },
  { id: "organic-modern", name: "Organic Modern", cat: "Most Popular", t: "is", pal: "organic", rank: 2, img: "neutral",
    al: ["Natural Modern", "Organic Contemporary"], mat: ["oak", "linen", "stone", "plaster", "wool"],
    feat: ["soft curved forms", "natural texture", "restrained decoration"], desc: "Rounded forms, natural texture, modern lines." },
  { id: "modern", name: "Modern", cat: "Most Popular", t: "ies", pal: "crisp", rank: 3, img: "luxury",
    al: ["Modernism", "Clean Modern"], mat: ["glass", "steel", "polished concrete", "oak"],
    feat: ["clean geometry", "flat planes", "open volume"], desc: "Clean geometry, flat planes and open volume." },
  { id: "contemporary", name: "Contemporary", cat: "Most Popular", t: "ieg s", pal: "cool", rank: 4, img: "neutral",
    al: ["Current", "Today's Modern"], mat: ["engineered stone", "matte lacquer", "brushed nickel", "wool"],
    feat: ["current silhouettes", "low contrast palette", "layered lighting"], desc: "Current silhouettes with a calm, low contrast palette." },
  { id: "transitional", name: "Transitional", cat: "Most Popular", t: "ies", pal: "warmneutral", rank: 5, img: "after",
    al: ["Updated Traditional"], mat: ["painted millwork", "quartz", "linen", "aged brass"],
    feat: ["classic frames with modern lines", "soft neutrals", "broad appeal"], desc: "Classic bones, modern lines, broad buyer appeal." },
  { id: "modern-farmhouse", name: "Modern Farmhouse", cat: "Most Popular", t: "ies", pal: "farmhouse", rank: 6, img: "farmhouse",
    al: ["Farmhouse", "New Farmhouse"], mat: ["shaker doors", "butcher block", "matte black iron", "shiplap"],
    feat: ["painted millwork", "black hardware", "honest materials"], desc: "Painted millwork, black hardware, honest materials." },
  { id: "mid-century-modern", name: "Mid-Century Modern", cat: "Most Popular", t: "ies", pal: "walnut", rank: 7, img: "midcentury",
    al: ["Midcentury Modern", "Mid Century", "MCM", "Mid-Century"], mat: ["walnut", "leather", "terrazzo", "brass"],
    feat: ["tapered legs", "graphic contrast", "low horizontal seating"], desc: "Walnut, tapered legs and graphic contrast." },
  { id: "japandi", name: "Japandi", cat: "Most Popular", t: "is", pal: "japandi", rank: 8, img: "japandi",
    al: ["Japanese Scandinavian"], mat: ["ash", "paper", "clay plaster", "rattan"],
    feat: ["pale wood", "low profiles", "disciplined negative space"], desc: "Pale wood, low profiles, disciplined space." },
  { id: "scandinavian", name: "Scandinavian", cat: "Most Popular", t: "ies", pal: "crisp", rank: 9, img: "neutral",
    al: ["Nordic", "Scandi"], mat: ["light birch", "wool", "cotton", "white paint"],
    feat: ["bright light", "simple forms", "functional comfort"], desc: "Bright light, simple forms, functional comfort." },
  { id: "coastal", name: "Coastal", cat: "Most Popular", t: "iegs", pal: "coastal", rank: 10, img: "coastal",
    al: ["Beach House", "Seaside"], mat: ["whitewashed oak", "cotton", "sea grass", "polished nickel"],
    feat: ["bright whites", "soft blues", "open light"], desc: "Bright whites, soft blues and open light." },
  { id: "quiet-luxury", name: "Quiet Luxury", cat: "Most Popular", t: "is", pal: "luxury", rank: 11, img: "luxury",
    al: ["Understated Luxury", "Stealth Wealth"], mat: ["book matched marble", "walnut", "bronze", "wool"],
    feat: ["fewer better materials", "tailored upholstery", "low contrast hardware"], desc: "Stone slabs, deep tone, restrained detail." },
  { id: "traditional", name: "Traditional", cat: "Most Popular", t: "ies", pal: "classic", rank: 12, img: "after",
    al: ["Classic"], mat: ["stained hardwood", "wainscoting", "damask", "polished brass"],
    feat: ["symmetry", "detailed millwork", "layered textiles"], desc: "Symmetry, detailed millwork and layered textiles." },

  /* ---------------- Clean and Modern ---------------- */
  { id: "minimalist", name: "Minimalist", cat: "Clean and Modern", t: "is", pal: "crisp", img: "neutral",
    al: ["Minimalism", "Minimal"], mat: ["white plaster", "pale oak", "glass", "stainless"],
    feat: ["strict editing", "hidden storage", "single accent"], desc: "Strict editing, hidden storage, one accent." },
  { id: "bauhaus", name: "Bauhaus", cat: "Clean and Modern", t: "ie", pal: "retro", img: "midcentury",
    al: ["Bauhaus Modern"], mat: ["tubular steel", "leather", "primary lacquer", "plywood"],
    feat: ["primary color blocking", "geometric form", "function first"], desc: "Geometric form, primary accents, function first." },
  { id: "industrial", name: "Industrial", cat: "Clean and Modern", t: "ies", pal: "industrial", img: "industrial",
    al: ["Loft", "Warehouse"], mat: ["exposed brick", "blackened steel", "concrete", "reclaimed timber"],
    feat: ["raw brick", "steel frames", "utility lighting"], desc: "Raw brick, steel frames and utility lighting." },
  { id: "soft-contemporary", name: "Soft Contemporary", cat: "Clean and Modern", t: "is", pal: "warmneutral", img: "after",
    al: ["Soft Modern"], mat: ["boucle", "limestone", "oak", "brushed nickel"],
    feat: ["rounded edges", "tone on tone layering", "diffuse light"], desc: "Rounded edges and gentle tone on tone layering." },
  { id: "urban-modern", name: "Urban Modern", cat: "Clean and Modern", t: "ie", pal: "cool", img: "industrial",
    al: ["City Modern", "Metropolitan"], mat: ["smoked glass", "dark oak", "concrete", "gunmetal"],
    feat: ["moody contrast", "high rise scale", "sculptural lighting"], desc: "Moody contrast built for city views." },
  { id: "futuristic", name: "Futuristic", cat: "Clean and Modern", t: "ie", pal: "crisp", img: "luxury",
    al: ["Sci-Fi Modern", "High Tech"], mat: ["seamless composite", "back-lit acrylic", "chrome", "micro-cement"],
    feat: ["seamless surfaces", "integrated lighting", "sculptural curves"], desc: "Seamless surfaces and integrated light." },
  { id: "modern-luxury", name: "Modern Luxury", cat: "Clean and Modern", t: "ies", pal: "luxury", img: "luxury",
    al: ["Luxury", "Luxurious", "Luxury Modern", "High End Modern"], mat: ["slab marble", "smoked oak", "polished brass", "velvet"],
    feat: ["dramatic stone", "statement lighting", "tailored detail"], desc: "Dramatic stone, statement lighting, tailored detail." },
  { id: "scandinavian-modern", name: "Scandinavian Modern", cat: "Clean and Modern", t: "is", pal: "crisp", img: "japandi",
    al: ["Nordic Modern"], mat: ["pale ash", "wool felt", "matte white", "black steel"],
    feat: ["light wood with modern lines", "practical storage", "airy rooms"], desc: "Nordic light with sharper modern lines." },
  { id: "affordable-scandinavian", name: "Affordable Scandinavian", cat: "Clean and Modern", t: "is", pal: "crisp", img: "neutral",
    al: ["Budget Scandinavian", "Flat Pack Modern", "IKEA Style", "IKEA"], mat: ["light laminate", "cotton", "white melamine", "birch"],
    feat: ["value furnishings", "smart storage", "light and simple"], desc: "Light, simple and built for a modest budget.", fin: ["Rental Grade", "Retail Grade"] },

  /* ---------------- Classic and Refined ---------------- */
  { id: "hollywood-regency", name: "Hollywood Regency", cat: "Classic and Refined", t: "is", pal: "glam", img: "luxury",
    al: ["Regency"], mat: ["lacquer", "mirror", "velvet", "polished brass"],
    feat: ["high gloss", "bold symmetry", "jewel accents"], desc: "High gloss, bold symmetry and jewel accents." },
  { id: "hollywood-glam", name: "Hollywood Glam", cat: "Classic and Refined", t: "is", pal: "glam", img: "luxury",
    al: ["Glam", "Glamour"], mat: ["crystal", "mirrored glass", "silk", "chrome"],
    feat: ["sparkle", "deep upholstery", "dramatic scale"], desc: "Sparkle, deep upholstery and dramatic scale." },
  { id: "art-deco", name: "Art Deco", cat: "Classic and Refined", t: "ie", pal: "deco", img: "luxury",
    al: ["Deco"], mat: ["fluted wood", "brass inlay", "marble", "lacquer"],
    feat: ["stepped geometry", "fluting", "metallic inlay"], desc: "Stepped geometry, fluting and metallic inlay." },
  { id: "art-nouveau", name: "Art Nouveau", cat: "Classic and Refined", t: "ie", pal: "deco", img: "after",
    al: ["Nouveau"], mat: ["stained glass", "wrought iron", "carved wood", "patterned tile"],
    feat: ["organic curves", "botanical motifs", "hand craft"], desc: "Organic curves and botanical hand craft." },
  { id: "french-country", name: "French Country", cat: "Classic and Refined", t: "ie", pal: "french", img: "farmhouse",
    al: ["Provencal", "French Provincial"], mat: ["limewash", "rush seating", "aged oak", "toile"],
    feat: ["soft aged finishes", "curved profiles", "gentle pattern"], desc: "Soft aged finishes with gentle French pattern." },
  { id: "english-country", name: "English Country", cat: "Classic and Refined", t: "i", pal: "classic", img: "after",
    al: ["English Manor"], mat: ["chintz", "painted cabinetry", "brass", "wool rug"],
    feat: ["layered pattern", "collected furniture", "warm clutter"], desc: "Layered pattern and comfortably collected rooms." },
  { id: "mediterranean", name: "Mediterranean", cat: "Classic and Refined", t: "ieg", pal: "medi", img: "resortYard",
    al: ["Tuscan", "Riviera"], mat: ["stucco", "terracotta tile", "wrought iron", "olive wood"],
    feat: ["arched openings", "warm plaster", "terracotta"], desc: "Arched openings, warm plaster and terracotta." },
  { id: "neoclassical", name: "Neoclassical", cat: "Classic and Refined", t: "ie", pal: "classic", img: "luxury",
    al: ["Classical"], mat: ["marble", "plaster moulding", "gilt", "silk"],
    feat: ["columns and cornices", "strict symmetry", "restrained ornament"], desc: "Columns, cornices and strict symmetry." },
  { id: "european-traditional", name: "European Traditional", cat: "Classic and Refined", t: "ie", pal: "classic", img: "after",
    al: ["Old World"], mat: ["carved oak", "limestone", "tapestry", "antique brass"],
    feat: ["heavy millwork", "antique pieces", "deep tones"], desc: "Heavy millwork, antiques and deep tone." },
  { id: "parisian", name: "Parisian", cat: "Classic and Refined", t: "i", pal: "french", img: "after",
    al: ["Paris Apartment", "Haussmann"], mat: ["herringbone oak", "plaster moulding", "marble mantel", "velvet"],
    feat: ["tall windows", "herringbone floors", "restrained glamour"], desc: "Herringbone floors and restrained glamour." },

  /* ---------------- Relaxed and Natural ---------------- */
  { id: "california-casual", name: "California Casual", cat: "Relaxed and Natural", t: "is", pal: "organic", img: "neutral",
    al: ["California Modern", "West Coast Casual"], mat: ["white oak", "linen slipcovers", "jute", "rattan"],
    feat: ["indoor outdoor flow", "relaxed seating", "sun bleached tones"], desc: "Sun bleached tones and relaxed indoor outdoor living." },
  { id: "coastal-grandmother", name: "Coastal Grandmother", cat: "Relaxed and Natural", t: "is", pal: "coastal", img: "coastal",
    al: ["Nancy Meyers", "Classic Coastal"], mat: ["slipcovered linen", "painted shaker", "wicker", "nickel"],
    feat: ["soft comfort", "garden flowers", "creamy neutrals"], desc: "Soft comfort, creamy neutrals, garden flowers." },
  { id: "biophilic", name: "Biophilic", cat: "Relaxed and Natural", t: "ieg", pal: "organic", img: "resortYard",
    al: ["Green Design", "Nature Led"], mat: ["living plants", "natural stone", "timber", "cork"],
    feat: ["planting indoors", "daylight", "natural airflow"], desc: "Planting, daylight and natural material throughout." },
  { id: "wabi-sabi", name: "Wabi-Sabi", cat: "Relaxed and Natural", t: "i", pal: "japandi", img: "japandi",
    al: ["Wabi Sabi", "Imperfect Natural"], mat: ["hand plaster", "raw linen", "aged wood", "ceramic"],
    feat: ["imperfect surfaces", "handmade objects", "very few pieces"], desc: "Imperfect surfaces and handmade calm." },
  { id: "rustic", name: "Rustic", cat: "Relaxed and Natural", t: "ie", pal: "mountain", img: "craftsman",
    al: ["Rustic Natural"], mat: ["reclaimed beams", "fieldstone", "iron", "hide"],
    feat: ["exposed timber", "rough stone", "warm firelight"], desc: "Exposed timber, rough stone and warm firelight." },
  { id: "cottagecore", name: "Cottagecore", cat: "Relaxed and Natural", t: "i", pal: "french", img: "farmhouse",
    al: ["Cottage Core"], mat: ["floral cotton", "painted wood", "enamel", "wicker"],
    feat: ["small floral pattern", "vintage finds", "soft light"], desc: "Small florals, vintage finds and soft light." },
  { id: "japanese", name: "Japanese", cat: "Relaxed and Natural", t: "ig", pal: "japandi", img: "japandi",
    al: ["Japanese Traditional"], mat: ["hinoki", "tatami", "shoji paper", "black iron"],
    feat: ["low furniture", "screens", "ordered emptiness"], desc: "Low furniture, screens and ordered emptiness." },
  { id: "zen", name: "Zen", cat: "Relaxed and Natural", t: "ig", pal: "japandi", img: "japandi",
    al: ["Zen Minimal"], mat: ["stone", "bamboo", "linen", "raked gravel"],
    feat: ["meditative calm", "balanced asymmetry", "single focal point"], desc: "Meditative calm and balanced asymmetry." },
  { id: "balinese", name: "Balinese", cat: "Relaxed and Natural", t: "ieg", pal: "tropical", img: "resortYard",
    al: ["Bali Resort", "Indonesian"], mat: ["teak", "thatch", "carved stone", "rattan"],
    feat: ["carved detail", "open pavilions", "lush planting"], desc: "Carved teak, open pavilions and lush planting." },
  { id: "tropical", name: "Tropical", cat: "Relaxed and Natural", t: "ieg", pal: "tropical", img: "resortYard",
    al: ["Island", "Tropical Modern"], mat: ["palm", "cane", "teak", "cotton canvas"],
    feat: ["big leaf planting", "ceiling fans", "breezy layouts"], desc: "Big leaf planting and breezy island layouts." },
  { id: "desert-modern", name: "Desert Modern", cat: "Relaxed and Natural", t: "ieg", pal: "desert", img: "ranch",
    al: ["Palm Springs", "Desert Contemporary"], mat: ["stucco", "sandstone", "rust steel", "leather"],
    feat: ["sun tones", "deep overhangs", "arid planting"], desc: "Sun tones, deep overhangs and arid planting." },
  { id: "mountain-modern", name: "Mountain Modern", cat: "Relaxed and Natural", t: "ie", pal: "mountain", img: "craftsman",
    al: ["Alpine Modern", "Modern Lodge"], mat: ["timber", "stone", "blackened steel", "wool"],
    feat: ["heavy timber", "large glazing", "stone fireplace"], desc: "Heavy timber, big glass and stone fireplaces." },

  /* ---------------- Expressive and Collected ---------------- */
  { id: "eclectic", name: "Eclectic", cat: "Expressive and Collected", t: "i", pal: "boho", img: "after",
    al: ["Collected", "Mixed"], mat: ["mixed woods", "vintage textiles", "art glass", "brass"],
    feat: ["mixed eras", "curated art", "bold pairings"], desc: "Mixed eras, curated art and confident pairings." },
  { id: "bohemian", name: "Bohemian", cat: "Expressive and Collected", t: "i", pal: "boho", img: "after",
    al: ["Boho"], mat: ["macrame", "kilim", "rattan", "aged wood"],
    feat: ["layered textiles", "plants", "warm earth tones"], desc: "Layered textiles, plants and warm earth tones." },
  { id: "scandi-boho", name: "Scandi Boho", cat: "Expressive and Collected", t: "i", pal: "warmneutral", img: "neutral",
    al: ["Nordic Boho"], mat: ["light wood", "sheepskin", "woven jute", "cotton"],
    feat: ["light base with texture", "soft layering", "handmade accents"], desc: "Nordic light with soft handmade layering." },
  { id: "maximalist", name: "Maximalist", cat: "Expressive and Collected", t: "i", pal: "deco", img: "luxury",
    al: ["Maximalism", "More Is More"], mat: ["patterned wallpaper", "velvet", "lacquer", "brass"],
    feat: ["saturated color", "pattern on pattern", "full walls of art"], desc: "Saturated color and confident pattern." },
  { id: "glam-rock", name: "Glam Rock", cat: "Expressive and Collected", t: "i", pal: "dark", img: "industrial",
    al: ["Rock Glam", "Edgy Glam"], mat: ["black lacquer", "leather", "smoked mirror", "chrome"],
    feat: ["dark drama", "metallic edge", "graphic art"], desc: "Dark drama with a metallic edge." },
  { id: "retro", name: "Retro", cat: "Expressive and Collected", t: "i", pal: "retro", img: "midcentury",
    al: ["Seventies", "Vintage Modern"], mat: ["shag", "smoked glass", "chrome", "veneer"],
    feat: ["period color", "curved seating", "playful pattern"], desc: "Period color, curves and playful pattern." },
  { id: "memphis", name: "Memphis", cat: "Expressive and Collected", t: "i", pal: "retro", img: "midcentury",
    al: ["Memphis Design", "Postmodern"], mat: ["laminate", "terrazzo", "painted steel", "acrylic"],
    feat: ["primary blocks", "squiggle motifs", "graphic geometry"], desc: "Primary blocks and graphic postmodern geometry." },
  { id: "dark-academia", name: "Dark Academia", cat: "Expressive and Collected", t: "i", pal: "dark", img: "after",
    al: ["Library Study", "Scholarly"], mat: ["dark walnut", "leather", "brass lamps", "books"],
    feat: ["deep tones", "built-in shelving", "study lighting"], desc: "Deep tones, books and warm study lighting." },
  { id: "grandmillennial", name: "Grandmillennial", cat: "Expressive and Collected", t: "i", pal: "french", img: "after",
    al: ["Granny Chic", "New Traditional"], mat: ["chintz", "skirted upholstery", "rattan", "china"],
    feat: ["classic pattern reworked", "scallops and trim", "playful nostalgia"], desc: "Classic pattern reworked with playful nostalgia." },
  { id: "vintage", name: "Vintage", cat: "Expressive and Collected", t: "i", pal: "walnut", img: "midcentury",
    al: ["Antique Mix"], mat: ["patinated wood", "aged brass", "worn leather", "linen"],
    feat: ["period pieces", "gentle patina", "collected feel"], desc: "Period pieces with gentle patina." },

  /* ---------------- Farmhouse and Country ---------------- */
  { id: "traditional-farmhouse", name: "Traditional Farmhouse", cat: "Farmhouse and Country", t: "ieg", pal: "farmhouse", img: "farmhouse",
    al: ["Country Farmhouse", "Classic Farmhouse", "Farmhouse Garden"], mat: ["beadboard", "painted cabinets", "cast iron", "checker tile"],
    feat: ["porch culture", "practical materials", "farm table scale"], desc: "Practical materials and honest farm scale." },
  { id: "rustic-farmhouse", name: "Rustic Farmhouse", cat: "Farmhouse and Country", t: "ie", pal: "mountain", img: "craftsman",
    al: ["Weathered Farmhouse"], mat: ["reclaimed barnwood", "iron", "stone", "burlap"],
    feat: ["rough timber", "weathered finish", "heavy hardware"], desc: "Rough timber and weathered, hard working finishes." },
  { id: "modern-country", name: "Modern Country", cat: "Farmhouse and Country", t: "ie", pal: "farmhouse", img: "farmhouse",
    al: ["Contemporary Country"], mat: ["painted joinery", "soapstone", "wool", "oak"],
    feat: ["clean lines with country warmth", "muted color", "simple hardware"], desc: "Country warmth with clean modern lines." },
  { id: "cottage", name: "Cottage", cat: "Farmhouse and Country", t: "ieg", pal: "french", img: "farmhouse",
    al: ["Cottage Style", "Cottage Garden", "Storybook"], mat: ["beadboard", "painted trim", "floral cotton", "brick"],
    feat: ["small cosy rooms", "painted finishes", "soft pattern"], desc: "Small, cosy and softly painted throughout." },
  { id: "southwestern", name: "Southwestern", cat: "Farmhouse and Country", t: "ieg", pal: "desert", img: "ranch",
    al: ["Santa Fe", "Adobe"], mat: ["adobe plaster", "saltillo tile", "wool weaving", "carved wood"],
    feat: ["earth tones", "woven pattern", "rounded adobe forms"], desc: "Earth tones, woven pattern and adobe forms." },
  { id: "lodge", name: "Lodge", cat: "Farmhouse and Country", t: "ie", pal: "mountain", img: "craftsman",
    al: ["Cabin", "Hunting Lodge"], mat: ["log", "river stone", "plaid wool", "antler"],
    feat: ["log structure", "big hearth", "deep seating"], desc: "Log structure, big hearth and deep seating." },

  /* ---------------- Exterior only ---------------- */
  { id: "craftsman", name: "Craftsman", cat: "Exterior Architecture", t: "e", pal: "mountain", img: "craftsman",
    al: ["Arts and Crafts", "Bungalow"], mat: ["cedar shingle", "tapered columns", "stone base", "exposed rafters"],
    feat: ["deep porch", "tapered columns", "handcrafted detail"], desc: "Deep porches and handcrafted timber detail.", rooms: ["Front Elevation"] },
  { id: "colonial", name: "Colonial", cat: "Exterior Architecture", t: "e", pal: "classic", img: "paintedBrick",
    al: ["Colonial Revival"], mat: ["clapboard", "shutters", "brick", "painted trim"],
    feat: ["symmetrical facade", "centred entry", "multi pane windows"], desc: "Symmetrical facade with a centred entry.", rooms: ["Front Elevation"] },
  { id: "tudor", name: "Tudor", cat: "Exterior Architecture", t: "e", pal: "dark", img: "paintedBrick",
    al: ["Tudor Revival"], mat: ["half timbering", "stucco", "brick", "slate"],
    feat: ["steep gables", "half timbering", "tall chimneys"], desc: "Steep gables and half timbered character.", rooms: ["Front Elevation"] },
  { id: "spanish-revival", name: "Spanish Revival", cat: "Exterior Architecture", t: "eg", pal: "medi", img: "resortYard",
    al: ["Spanish Colonial", "Mission"], mat: ["white stucco", "clay barrel tile", "iron", "carved wood"],
    feat: ["red tile roof", "arcades", "courtyards"], desc: "White stucco, clay tile roofs and arcades.", rooms: ["Front Elevation"] },
  { id: "ranch", name: "Ranch", cat: "Exterior Architecture", t: "e", pal: "warmneutral", img: "ranch",
    al: ["Rambler", "Single Story"], mat: ["brick veneer", "board siding", "asphalt shingle", "aluminium"],
    feat: ["long low roofline", "attached garage", "wide street presence"], desc: "Long, low rooflines with wide street presence.", rooms: ["Front Elevation"] },
  { id: "victorian", name: "Victorian", cat: "Exterior Architecture", t: "e", pal: "classic", img: "paintedBrick",
    al: ["Queen Anne"], mat: ["fish scale shingle", "spindle work", "bay windows", "painted trim"],
    feat: ["ornate trim", "steep roofs", "multi color paint"], desc: "Ornate trim, steep roofs and layered paint.", rooms: ["Front Elevation"] },
  { id: "cape-cod", name: "Cape Cod", cat: "Exterior Architecture", t: "e", pal: "coastal", img: "coastal",
    al: ["New England Cape"], mat: ["cedar shake", "white trim", "shutters", "brick chimney"],
    feat: ["steep gable", "dormers", "simple symmetry"], desc: "Steep gables, dormers and simple symmetry.", rooms: ["Front Elevation"] },
  { id: "prairie", name: "Prairie", cat: "Exterior Architecture", t: "e", pal: "walnut", img: "ranch",
    al: ["Prairie School", "Wright Style"], mat: ["banded brick", "art glass", "wide eaves", "stucco"],
    feat: ["horizontal emphasis", "wide overhangs", "ribbon windows"], desc: "Horizontal lines with wide sheltering eaves.", rooms: ["Front Elevation"] },
  { id: "european-estate", name: "European Estate", cat: "Exterior Architecture", t: "e", pal: "classic", img: "luxury",
    al: ["Chateau", "Manor"], mat: ["cast stone", "slate roof", "iron gates", "limestone"],
    feat: ["grand proportions", "stone detail", "formal entry court"], desc: "Grand stone proportions and formal entry courts.", rooms: ["Front Elevation"] },

  /* ---------------- Garden and Landscape ---------------- */
  { id: "garden-modern-minimal", name: "Modern Minimal", cat: "Garden and Landscape", t: "g", pal: "garden", img: "resortYard",
    al: ["Minimal Garden", "Modern Landscape"], mat: ["poured concrete", "corten steel", "clipped hedging", "gravel"],
    feat: ["clean geometry", "restrained planting", "hidden lighting"], desc: "Clean geometry and restrained planting.", rooms: ["Yard"] },
  { id: "garden-english-cottage", name: "English Cottage", cat: "Garden and Landscape", t: "g", pal: "garden", img: "resortYard",
    al: ["English Garden", "Cottage Border"], mat: ["brick path", "timber arbour", "perennial borders", "stone edging"],
    feat: ["dense flowering borders", "informal paths", "climbing roses"], desc: "Dense flowering borders and informal paths.", rooms: ["Yard"] },
  { id: "garden-japanese-zen", name: "Japanese Zen", cat: "Garden and Landscape", t: "g", pal: "japandi", img: "resortYard",
    al: ["Zen Garden", "Karesansui"], mat: ["raked gravel", "moss", "boulders", "bamboo"],
    feat: ["raked gravel", "placed stone", "quiet water"], desc: "Raked gravel, placed stone and quiet water.", rooms: ["Yard"] },
  { id: "garden-xeriscape", name: "Desert / Xeriscape", cat: "Garden and Landscape", t: "g", pal: "gardenarid", img: "ranch",
    al: ["Xeriscape", "Drought Tolerant", "Desert Garden"], mat: ["decomposed granite", "boulders", "succulents", "drip irrigation"],
    feat: ["low water planting", "gravel mulch", "sculptural cactus"], desc: "Low water planting with sculptural desert form.", rooms: ["Yard"] },
  { id: "garden-formal-european", name: "Formal European", cat: "Garden and Landscape", t: "g", pal: "gardenformal", img: "resortYard",
    al: ["Formal Garden", "European Formal"], mat: ["clipped boxwood", "limestone", "gravel walks", "urns"],
    feat: ["axial symmetry", "clipped hedging", "stone ornament"], desc: "Axial symmetry, clipped hedging and stone ornament.", rooms: ["Yard"] },
  { id: "garden-french-formal", name: "French Formal", cat: "Garden and Landscape", t: "g", pal: "gardenformal", img: "resortYard",
    al: ["Parterre", "Jardin a la Francaise"], mat: ["parterre hedging", "gravel", "topiary", "cast stone"],
    feat: ["parterre patterns", "topiary", "central axis"], desc: "Parterre patterns, topiary and a strong axis.", rooms: ["Yard"] },
  { id: "garden-woodland", name: "Woodland", cat: "Garden and Landscape", t: "g", pal: "garden", img: "resortYard",
    al: ["Shade Garden", "Forest Garden"], mat: ["bark mulch", "ferns", "native shrubs", "stepping stones"],
    feat: ["dappled shade", "layered understorey", "meandering paths"], desc: "Dappled shade and layered woodland planting.", rooms: ["Yard"] },
  { id: "garden-prairie-native", name: "Prairie and Native", cat: "Garden and Landscape", t: "g", pal: "garden", img: "ranch",
    al: ["Native Planting", "Meadow"], mat: ["ornamental grasses", "native perennials", "steel edging", "gravel"],
    feat: ["seasonal grasses", "pollinator planting", "loose massing"], desc: "Grasses and native perennials in loose drifts.", rooms: ["Yard"] },
  { id: "garden-resort", name: "Resort", cat: "Garden and Landscape", t: "g", pal: "tropical", img: "resortYard",
    al: ["Resort Landscape", "Hotel Garden"], mat: ["travertine deck", "pool coping", "palms", "outdoor lounge"],
    feat: ["pool as centrepiece", "lounge zones", "night lighting"], desc: "Pool, lounging zones and warm night lighting.", rooms: ["Yard"] },
  { id: "garden-courtyard", name: "Courtyard", cat: "Garden and Landscape", t: "g", pal: "medi", img: "resortYard",
    al: ["Patio Garden", "Enclosed Garden"], mat: ["stucco walls", "tile", "potted olives", "fountain"],
    feat: ["enclosed intimacy", "central feature", "container planting"], desc: "Enclosed, intimate and centred on one feature.", rooms: ["Yard"] },
  { id: "garden-rooftop-urban", name: "Rooftop Urban", cat: "Garden and Landscape", t: "g", pal: "cool", img: "resortYard",
    al: ["Roof Terrace", "Urban Terrace"], mat: ["composite decking", "planters", "wind screens", "string lights"],
    feat: ["lightweight planters", "wind shelter", "skyline seating"], desc: "Lightweight planters and skyline seating.", rooms: ["Yard"] },
  { id: "garden-edible", name: "Edible Garden", cat: "Garden and Landscape", t: "g", pal: "garden", img: "resortYard",
    al: ["Kitchen Garden", "Potager", "Vegetable Garden"], mat: ["raised beds", "cedar", "trellis", "compost"],
    feat: ["raised beds", "productive planting", "clear access paths"], desc: "Raised beds and productive, tidy planting.", rooms: ["Yard"] },
];

const TYPE_MAP: Record<string, ProjectType> = { i: "interior", e: "exterior", g: "garden", s: "virtual-staging" };

function typeNoun(types: ProjectType[]): string {
  if (types.includes("interior")) return "interior";
  if (types.includes("exterior")) return "home exterior";
  return "garden landscape";
}

function build(row: Row): StyleRecord {
  const types = Array.from(
    new Set(String(row.t).replace(/\s+/g, "").split("").map((c) => TYPE_MAP[c]).filter(Boolean)),
  ) as ProjectType[];
  const pal = P4[row.pal] || P4["warmneutral"]!;
  const noun = typeNoun(types);
  const prompt = [
    `${row.name.toLowerCase()} ${noun}`,
    `defined by ${row.feat.join(", ")}`,
    `materials: ${row.mat.join(", ")}`,
    `color palette: ${pal.names.join(", ")}`,
    "photorealistic, professionally styled, natural light, magazine quality",
  ].join("; ");
  return {
    id: row.id,
    slug: row.id,
    displayName: row.name,
    shortDescription: row.desc,
    category: row.cat,
    aliases: row.al || [],
    compatibleProjectTypes: types.concat(["concept"]),
    compatibleRoomTypes: row.rooms || (types.includes("interior") ? ALL_ROOMS : ["Yard", "Front Elevation"]),
    palette: pal.names,
    swatches: pal.hex,
    materials: row.mat,
    definingFeatures: row.feat,
    finishLevel: row.fin || ["Retail Grade", "Premium"],
    mood: row.mood || moodFor(row),
    generationPrompt: prompt,
    negativePrompt: NEG_BASE + (row.neg ? ", " + row.neg : ""),
    previewImage: STYLE_PHOTOS[row.id] || pick(row.img),
    featuredRank: row.rank || 900,
    isFeatured: !!row.rank,
    isActive: true,
  };
}

function moodFor(row: Row): string[] {
  const c = row.cat;
  if (c === "Clean and Modern") return ["Calm", "Minimal"];
  if (c === "Classic and Refined") return ["Refined", "Formal"];
  if (c === "Relaxed and Natural") return ["Warm", "Natural"];
  if (c === "Expressive and Collected") return ["Bold", "Playful"];
  if (c === "Farmhouse and Country") return ["Warm", "Homely"];
  if (c === "Garden and Landscape") return ["Natural", "Calm"];
  if (c === "Exterior Architecture") return ["Classic", "Curb Appeal"];
  return ["Warm", "Calm"];
}

export const AUTO_STYLE: StyleRecord = {
  id: "auto",
  slug: "auto",
  displayName: "Auto — Let REAL DESIGNS Decide",
  shortDescription: "We choose the strongest style for this space.",
  category: "Automatic",
  aliases: ["No Style", "None", "Any", "Surprise Me"],
  compatibleProjectTypes: ["interior", "exterior", "garden", "virtual-staging", "concept"],
  compatibleRoomTypes: ALL_ROOMS,
  palette: ["warm white", "sand", "taupe", "charcoal"],
  swatches: P4["warmneutral"]!.hex,
  materials: ["broadly appealing materials"],
  definingFeatures: ["chosen automatically from the source photo"],
  finishLevel: ["Rental Grade", "Retail Grade", "Premium"],
  mood: ["Calm"],
  generationPrompt:
    "choose the most flattering, market-appropriate design style for this space; cohesive palette, current furnishings, photorealistic, magazine quality",
  negativePrompt: NEG_BASE,
  previewImage: pick("after"),
  featuredRank: 0,
  isFeatured: false,
  isActive: true,
  isAuto: true,
};

export const STYLES: StyleRecord[] = ROWS.map(build);

export const STYLE_CATEGORIES = [
  "Most Popular",
  "Clean and Modern",
  "Classic and Refined",
  "Relaxed and Natural",
  "Expressive and Collected",
  "Farmhouse and Country",
  "Exterior Architecture",
  "Garden and Landscape",
];

/** Seasonal themes are optional add-ons, never permanent styles. */
export const SEASONAL_THEMES = [
  { id: "theme-christmas", name: "Christmas", prompt: "tasteful seasonal Christmas decoration, garland, warm string lighting" },
  { id: "theme-fall", name: "Fall", prompt: "autumn seasonal styling, warm foliage tones, cosy textiles" },
  { id: "theme-spring", name: "Spring", prompt: "fresh spring styling, blossom, light textiles" },
];

/* ------------------------------------------------------------------ */
/* lookup + normalization                                              */
/* ------------------------------------------------------------------ */
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const INDEX: Record<string, StyleRecord> = {};
[AUTO_STYLE].concat(STYLES).forEach((s) => {
  INDEX[norm(s.id)] = s;
  INDEX[norm(s.displayName)] = s;
  s.aliases.forEach((a) => { if (!INDEX[norm(a)]) INDEX[norm(a)] = s; });
});
// Ambiguous historical labels resolved to their canonical record.
[
  ["farmhouse", "modern-farmhouse"],
  ["luxury", "modern-luxury"],
  ["luxurious", "modern-luxury"],
  ["asian decor", "japanese"],
  ["asian", "japanese"],
  ["ikea", "affordable-scandinavian"],
  ["no style", "auto"],
  ["investor neutral", "warm-minimal"],
  ["mid century", "mid-century-modern"],
  ["minimalism", "minimalist"],
].forEach(([from, to]) => {
  const rec = INDEX[norm(String(to))];
  if (rec) INDEX[norm(String(from))] = rec;
});

export function resolveStyle(input?: string | null): StyleRecord {
  if (!input) return AUTO_STYLE;
  return INDEX[norm(input)] || AUTO_STYLE;
}

export function styleById(id?: string | null): StyleRecord | undefined {
  return id ? INDEX[norm(id)] : undefined;
}

export function stylesFor(projectType: ProjectType): StyleRecord[] {
  return STYLES.filter((s) => s.isActive && s.compatibleProjectTypes.includes(projectType));
}

/** Extract the closest canonical style from free written text. */
export function styleFromText(text: string): StyleRecord | null {
  const t = norm(text);
  if (!t) return null;
  let best: StyleRecord | null = null;
  let bestLen = 0;
  Object.keys(INDEX).forEach((key) => {
    if (key.length < 4 || key.length <= bestLen) return;
    const rec = INDEX[key];
    if (rec && t.indexOf(key) > -1) { best = rec; bestLen = key.length; }
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* provider mapping — public names never change to suit a provider      */
/* ------------------------------------------------------------------ */
export const PROVIDER_STYLE_MAP: Record<string, Record<string, string>> = {
  gemini: {
    "mid-century-modern": "mid century modern",
    "quiet-luxury": "understated luxury",
    "affordable-scandinavian": "budget scandinavian",
  },
};

export function providerStyleName(styleId: string, provider = "gemini"): string {
  const rec = styleById(styleId);
  if (!rec) return "";
  return (PROVIDER_STYLE_MAP[provider] || {})[rec.id] || rec.displayName;
}

/* ------------------------------------------------------------------ */
/* generation payload                                                  */
/* ------------------------------------------------------------------ */
export type StylePayload = {
  styleId: string;
  styleName: string;
  stylePrompt: string;
  styleNegativePrompt: string;
  projectType: ProjectType;
  roomType: string;
  userPrompt: string;
  preserveArchitecture: boolean;
};

export function buildStylePayload(opts: {
  style?: string | null;
  projectType?: ProjectType;
  roomType?: string;
  userPrompt?: string;
  preserveArchitecture?: boolean;
  theme?: string | null;
}): StylePayload {
  const rec = resolveStyle(opts.style);
  const theme = SEASONAL_THEMES.find((t) => t.id === opts.theme || t.name === opts.theme);
  return {
    styleId: rec.id,
    styleName: rec.displayName,
    stylePrompt: rec.generationPrompt + (theme ? "; " + theme.prompt : ""),
    styleNegativePrompt: rec.negativePrompt,
    projectType: opts.projectType || "interior",
    roomType: opts.roomType || "living room",
    userPrompt: opts.userPrompt || "",
    preserveArchitecture: opts.preserveArchitecture !== false,
  };
}

/* ------------------------------------------------------------------ */
/* smart recommendations                                               */
/* ------------------------------------------------------------------ */
export type SourceSignals = {
  projectType?: ProjectType;
  roomType?: string;
  brightness?: "bright" | "average" | "dim";
  woodTones?: boolean;
  text?: string;
};

export function recommendStyles(sig: SourceSignals, limit = 4): { style: StyleRecord; reason: string }[] {
  const type = sig.projectType || "interior";
  const pool = stylesFor(type);
  const scored = pool.map((s) => {
    let score = s.isFeatured ? 3 : 0;
    let reason = "A strong, broadly appealing match for this space";
    if (sig.brightness === "bright" && /coastal|scandi|minimal|japandi|contemporary/i.test(s.id)) {
      score += 3; reason = "Works with your natural light";
    }
    if (sig.brightness === "dim" && /dark-academia|quiet-luxury|urban-modern|traditional|industrial/i.test(s.id)) {
      score += 3; reason = "Handles the lower light in this room well";
    }
    if (sig.woodTones && /warm-minimal|organic|japandi|mid-century|rustic|mountain/i.test(s.id)) {
      score += 3; reason = "Complements the existing wood tones";
    }
    if (type === "exterior") reason = "Fits the home's exterior architecture";
    if (type === "garden") reason = "Suits the scale and planting of this yard";
    if (sig.roomType && s.compatibleRoomTypes.some((r) => norm(r) === norm(sig.roomType || ""))) score += 1;
    if (sig.text) {
      const hit = styleFromText(sig.text);
      if (hit && hit.id === s.id) { score += 10; reason = "Matches the style words in your description"; }
    }
    return { style: s, reason, score: score + (900 - s.featuredRank) / 1000 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(3, limit)).map(({ style, reason }) => ({ style, reason }));
}

/* ------------------------------------------------------------------ */
/* admin overrides                                                     */
/* ------------------------------------------------------------------ */
export type StyleOverrideRow = {
  style_id: string;
  display_name?: string | null;
  short_description?: string | null;
  category?: string | null;
  aliases?: string[] | null;
  project_types?: string[] | null;
  preview_image?: string | null;
  provider_map?: Record<string, string> | null;
  generation_prompt?: string | null;
  negative_prompt?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
  is_hidden?: boolean | null;
  is_custom?: boolean | null;
};

/** Apply admin overrides on top of the shipped catalog. IDs never change. */
export function applyStyleOverrides(rows: StyleOverrideRow[]): void {
  (rows || []).forEach((row) => {
    if (!row || !row.style_id) return;
    let rec = styleById(row.style_id);
    if (!rec && row.is_custom) {
      rec = {
        ...AUTO_STYLE,
        id: row.style_id,
        slug: row.style_id,
        displayName: row.display_name || row.style_id,
        shortDescription: row.short_description || "",
        category: row.category || "Most Popular",
        aliases: [],
        isAuto: false,
        featuredRank: 900,
        isFeatured: false,
      };
      STYLES.push(rec);
      INDEX[norm(rec.id)] = rec;
      INDEX[norm(rec.displayName)] = rec;
    }
    if (!rec) return;
    if (row.display_name) { rec.displayName = row.display_name; INDEX[norm(row.display_name)] = rec; }
    if (row.short_description) rec.shortDescription = row.short_description;
    if (row.category) rec.category = row.category;
    if (row.aliases) { rec.aliases = row.aliases; row.aliases.forEach((a) => { INDEX[norm(a)] = rec as StyleRecord; }); }
    if (row.project_types && row.project_types.length) rec.compatibleProjectTypes = row.project_types as ProjectType[];
    if (row.preview_image) rec.previewImage = row.preview_image;
    if (row.generation_prompt) rec.generationPrompt = row.generation_prompt;
    if (row.negative_prompt) rec.negativePrompt = row.negative_prompt;
    if (typeof row.sort_order === "number") rec.featuredRank = row.sort_order;
    if (typeof row.is_featured === "boolean") rec.isFeatured = row.is_featured;
    if (typeof row.is_hidden === "boolean") rec.isActive = !row.is_hidden;
    if (row.provider_map) {
      Object.entries(row.provider_map).forEach(([provider, name]) => {
        PROVIDER_STYLE_MAP[provider] = PROVIDER_STYLE_MAP[provider] || {};
        (PROVIDER_STYLE_MAP[provider] as Record<string, string>)[rec!.id] = name;
      });
    }
  });
}
