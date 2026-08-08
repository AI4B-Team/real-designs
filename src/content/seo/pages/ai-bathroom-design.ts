import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/ai-bathroom-design",
  tier: "A",
  intent: "Buyer wants AI bathroom design plus a realistic remodel cost range and understanding of why bathrooms are so expensive per square foot.",

  metaTitle: "AI Bathroom Design And Remodel Cost Planning",
  metaDescription: "Design a bathroom with AI and see a realistic remodel cost range. Waterproofing, tile labor, tub to shower conversion and ventilation broken down.",

  eyebrow: "AI Bathroom Design",
  h1: "AI Bathroom Design And Remodel Cost",
  lede: "A 40 square foot bathroom can cost more per square foot to remodel than an entire kitchen. See a designed version of your actual bathroom next to a line item planning range before you call a contractor.",

  spaceType: "interior",
  roomType: "bathroom",
  budgetBand: 2,

  intro: [
    "A full bathroom remodel, new tile, vanity, tub or shower, toilet and fixtures, in a standard 5 by 8 foot bathroom typically plans in the $12,000 to $25,000 range, which works out to $300 to $625 per square foot, often higher per square foot than a kitchen remodel. The reason is waterproofing and tile labor, both of which are priced by the hour and do not scale down just because the room is small.",
    "A tub to shower conversion alone, without touching the rest of the room, plans in the $6,000 to $14,000 range depending on whether the plumbing moves and whether the shower gets a curb or is built curbless with a linear drain. This page breaks down where that money actually goes and why bathrooms are the room where DIY cost estimates are most often wrong, sometimes by half.",
  ],

  beforePhoto: "bathBefore",
  afterPhoto: "bath",
  beforeCaption: "Existing bathroom, dated tile and fixtures, tub in place.",
  afterCaption: "Same bathroom, tile, vanity and fixtures redesigned within the existing footprint.",

  steps: [
    { title: "Upload Your Bathroom Photo", text: "Tub, shower, vanity and toilet positions from your actual room anchor the design so waterproofing and tile scope match reality." },
    { title: "Choose Fixtures And Tile Level", text: "Select a tub to shower conversion, vanity upgrade or full gut, and the design generates a layout that fits your budget band." },
    { title: "Get A Waterproofing And Trade Scope", text: "Export a scope with tile square footage, waterproofing membrane area and plumbing moves flagged as their own line items." },
  ],

  showcase: ["scope", "brief", "reality-lock", "grades"],

  scopeTitle: "Bathroom Remodel Scope And Planning Range",
  scopeIntro: "Line items for a standard 5 by 8 foot, roughly 40 square foot, full bathroom remodel.",
  scopeLines: [
    { item: "Waterproofing Membrane, Shower Pan And Walls", qty: "60 SF", trade: "Waterproofing", low: 1200, high: 2800 },
    { item: "Tile, Floor And Shower Walls", qty: "150 SF", trade: "Tile", low: 3000, high: 7500 },
    { item: "Vanity And Countertop", qty: "1 vanity, 36 in", trade: "Cabinetry", low: 900, high: 2800 },
    { item: "Tub To Shower Conversion", qty: "1 conversion", trade: "Plumbing", low: 3500, high: 8500 },
    { item: "Toilet Replacement", qty: "1 unit", trade: "Plumbing", low: 400, high: 1100 },
    { item: "Exhaust Fan And Ventilation", qty: "1 fan, ducted", trade: "Electrical", low: 350, high: 900 },
    { item: "Lighting And Electrical", qty: "4 fixtures", trade: "Electrical", low: 700, high: 1800 },
    { item: "Glass Shower Enclosure", qty: "1 enclosure", trade: "Glass", low: 900, high: 2600 },
  ],
  scopeBasis: "Planning range built from typical national material and labor costs for a standard size residential bathroom remodel, not a contractor bid.",
  confidence: "Medium",

  sections: [
    {
      h2: "Why A Small Room Costs So Much Per Square Foot",
      body: [
        "A bathroom is one of the few rooms where the cost per square foot regularly beats the kitchen, even though it is a fraction of the size. A 40 square foot bathroom remodel at $18,000 works out to $450 per square foot, while a 200 square foot kitchen remodel at $50,000 works out to $250 per square foot. The bathroom costs more per foot because nearly every surface in it is waterproofed, tiled, or plumbed, and none of those trades charge less just because the room is small.",
        "A plumber setting a shower valve and running supply lines spends roughly the same time in a tiny bathroom as a larger one, because the fixture count, not the floor area, drives the labor hours. The same is true for the tile setter and the waterproofing contractor, both of whom are pricing the job by fixture count and square footage of tiled surface, which in a shower includes the walls, not just the floor.",
      ],
    },
    {
      h2: "Waterproofing And Tile Labor Are The Real Cost Drivers",
      body: [
        "Waterproofing a shower pan and walls correctly, with a membrane system rather than just a mortar bed, typically runs $1,200 to $2,800 in materials and labor before a single tile goes down. Skipping or shortcutting this step is the single most common cause of bathroom failures, leaks into the subfloor or the ceiling below, that show up twelve to twenty-four months after a remodel, well after the contractor is gone.",
        "Tile labor is priced by square foot of tiled surface and by the complexity of the pattern, a straight-set 12 by 24 inch tile on a shower wall runs $8 to $15 per square foot installed, while a small format mosaic or a herringbone pattern can run $18 to $30 per square foot installed because the layout takes significantly longer to set and grout. In a shower with 60 to 80 square feet of wall and floor tile, that pattern choice alone can swing the bill by $1,500 to $2,500.",
      ],
    },
    {
      h2: "Tub To Shower Conversions",
      body: [
        "Converting a bathtub to a walk-in or curbless shower is one of the most requested bathroom changes, especially for aging in place or for a primary bathroom being upgraded ahead of a sale. A basic conversion that keeps the existing plumbing location plans in the $6,000 to $9,000 range. A curbless conversion with a linear drain, which requires lowering the subfloor to create the slope to drain, plans closer to $9,000 to $14,000 because of the added framing and plumbing work.",
        "The plumbing rarely moves in a straightforward conversion since the drain and supply lines are usually reused, but the waterproofing scope goes up because a shower has exposed wall area on three or four sides that a tub with a surround did not need tiled and sealed to the same degree. This is the main reason a tub to shower swap looks simple on a rendering but prices out higher than homeowners expect.",
      ],
      bullets: [
        "Basic conversion, existing plumbing reused: $6,000 to $9,000",
        "Curbless conversion with linear drain and subfloor work: $9,000 to $14,000",
        "Add a glass enclosure instead of a curtain: add $900 to $2,600",
      ],
    },
    {
      h2: "Ventilation And Why DIY Estimates Miss The Mark",
      body: [
        "A bathroom without adequate exhaust ventilation traps moisture that leads to mold on grout lines, peeling paint, and eventually damage to drywall behind tile. Code generally requires either an operable window or a mechanical exhaust fan ducted to the exterior, not just into the attic space, and retrofitting proper exterior ducting into an existing bathroom can run $350 to $900 depending on the duct run length and roof or wall penetration required.",
        "Bathrooms are the room where DIY cost estimates are most often wrong because homeowners price the visible finishes, tile, vanity, fixtures, and forget the waterproofing membrane, the exhaust ducting, and the plumbing labor that never shows up in a big box store receipt. A homeowner pricing tile and a vanity at $6,000 in materials is often surprised when the finished remodel with labor lands at $16,000 to $20,000, and the gap is almost always waterproofing and plumbing labor that was never in the material estimate to begin with.",
      ],
    },
  ],

  faqs: [
    { q: "Why is a bathroom remodel so expensive per square foot?", a: "Nearly every surface in a bathroom is waterproofed, tiled, or plumbed, and those trades price by fixture count and tiled surface area, not by floor area. A small room still needs a full shower valve, full waterproofing membrane and full tile labor." },
    { q: "How much does a tub to shower conversion cost?", a: "A basic conversion that reuses the existing plumbing typically plans in the $6,000 to $9,000 range. A curbless shower with a linear drain, which requires lowering the subfloor, plans closer to $9,000 to $14,000." },
    { q: "What is the biggest hidden cost in a bathroom remodel?", a: "Waterproofing. Homeowners pricing tile and fixtures from a store receipt usually miss the membrane system behind the tile, which runs $1,200 to $2,800 and is the difference between a remodel that lasts and one that leaks within two years." },
    { q: "Do I need a bigger exhaust fan for a remodeled bathroom?", a: "If the bathroom lacks proper exterior ducted ventilation, code generally requires adding it during a remodel. Retrofitting exterior ducting typically plans in the $350 to $900 range depending on the duct run and roof or wall penetration needed." },
    { q: "Why does tile pattern choice change the price so much?", a: "A straight-set large format tile runs $8 to $15 per square foot installed, while small format mosaic or herringbone patterns run $18 to $30 per square foot because the layout takes far longer to set and grout correctly." },
  ],

  relatedSlugs: [
    "/bathroom-remodel-cost",
    "/renovation-cost-estimator",
    "/for-contractors",
    "/ai-design-for-house-flippers",
    "/rental-grade-vs-retail-grade",
    "/2d-to-3d-floor-plan",
  ],

  ctaTitle: "Design Your Bathroom And See The Scope",
  ctaBody: "Upload your bathroom and get a design with tile, waterproofing and a planning range attached.",
  ctaLabel: "Start Bathroom Design",
};
