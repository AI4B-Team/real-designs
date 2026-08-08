import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/ai-interior-design",
  tier: "A",
  intent: "Someone wants to upload a photo of a room they actually own and see it redesigned with real furniture and finishes, priced.",

  metaTitle: "AI Interior Design From Your Own Room Photo",
  metaDescription: "Upload a photo of your actual living room and get a furnished redesign with Reality Lock walls, real products, and a priced scope of work.",

  eyebrow: "AI Interior Design",
  h1: "AI Interior Design From A Photo Of A Room You Actually Own",
  lede: "Not a stock room, not a mood board. Your walls, your windows, your ceiling height, redesigned and priced.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 1,

  intro: [
    "Most AI interior design tools generate a room. This one redesigns the room in your photo. You upload a picture of your living room, the walls, the window on the left, the low ceiling, whatever is actually there, and the output keeps that geometry in place while it changes finishes, furniture and layout. That distinction matters because a design on a room you do not own is decoration, not planning.",
    "The output is a rendering plus a scope. The rendering shows what the room could look like. The scope lists the paint, the sofa, the rug, the lighting and what each is likely to cost, with a confidence level attached to the total. If you cannot buy or build what you are looking at, it was never a plan.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Living room as photographed, existing layout and finishes.",
  afterCaption: "Same walls and window, restyled furniture, paint and lighting.",

  steps: [
    { title: "Upload Your Room Photo", text: "One photo of the actual space, taken from a normal standing position, is enough for the software to read the wall lines and window openings." },
    { title: "Choose A Style And Budget", text: "Pick a look and a rough budget band. The system generates furniture, paint and finish choices that fit both, not a fantasy render disconnected from spend." },
    { title: "Get A Priced Scope", text: "Review a shopping list and a scope of work with planning ranges by line item, so a designer, a spouse, or a contractor can act on it directly." },
  ],

  showcase: ["interior", "reality-lock", "shop", "declutter", "brief"],

  scopeTitle: "Living Room Refresh Budget",
  scopeIntro: "A furniture-forward makeover on an existing 14x18 living room, no wall moves, no electrical relocation.",
  scopeLines: [
    { item: "Interior Paint, Walls And Trim", qty: "320 SF", trade: "Painting", low: 600, high: 1100 },
    { item: "Sofa And Accent Chair", qty: "2 Pieces", trade: "Furniture", low: 1400, high: 3200 },
    { item: "Area Rug", qty: "9x12", trade: "Furniture", low: 300, high: 900 },
    { item: "Coffee Table And Side Tables", qty: "3 Pieces", trade: "Furniture", low: 400, high: 1100 },
    { item: "Window Treatments", qty: "2 Windows", trade: "Soft Goods", low: 250, high: 700 },
    { item: "Lighting, Floor And Table Lamps", qty: "3 Fixtures", trade: "Electrical/Furniture", low: 200, high: 650 },
    { item: "Art And Wall Decor", qty: "6 Pieces", trade: "Decor", low: 150, high: 600 },
    { item: "Installation And Delivery", qty: "1 Job", trade: "Labor", low: 200, high: 500 },
  ],
  scopeBasis: "Ranges built from current retail furniture pricing and regional painting labor rates, not from a national construction cost index.",
  confidence: "Medium",

  sections: [
    {
      h2: "A Rendering Is Not A Plan",
      body: [
        "A rendering answers one question: does this look good. A plan answers a harder one: can I actually get this, and what does it cost. Plenty of AI interior tools stop at the rendering. They give you a gorgeous image of a couch that does not exist in any catalog and a floor plan that quietly widened your room by four feet because the model needed the space to make the composition work.",
        "This tool treats the photo as a constraint, not a suggestion. The render is checked against the wall positions, window openings and ceiling height captured from your upload before anything gets priced. If a piece of furniture would not physically fit in the room you photographed, it does not get proposed. That is a lower ceiling on creativity and a higher floor on usefulness.",
      ],
    },
    {
      h2: "Why Reality Lock Exists",
      body: [
        "Reality Lock is the name for the constraint that keeps your architecture fixed while the design changes around it. Walls stay where they are. Windows stay where they are. Ceiling height does not change. Everything else, paint, furniture, rugs, lighting, art, is free to move.",
        "The reason this matters is boring but real: a beautiful design on a room that is not yours, with proportions that are not yours, cannot be shopped for or built. You would spend an afternoon falling in love with a couch that is scaled for a room nine feet wider than the one you have. Reality Lock exists so the falling in love part and the buying part end up pointed at the same room.",
        "It also protects the budget conversation. When the geometry is locked, a designer or a spouse looking at the after photo is evaluating finish and furniture choices, not silently wondering whether the whole layout is even achievable.",
      ],
    },
    {
      h2: "Furniture Line Items Versus Construction Line Items",
      body: [
        "Interior redesign scopes behave differently from renovation scopes, and the tool prices them differently on purpose. A sofa has a retail price today. A wall move has a labor estimate that depends on whether it is load bearing, what is inside it, and who is swinging the hammer.",
        "For a room like the one in this example, most of the budget sits in furniture and soft goods, not labor. That means the planning range is tighter and the confidence level is usually higher, because you are pricing catalog items, not unknowns behind drywall.",
        "If your redesign does involve construction, moving an outlet, adding recessed lighting, reframing a nook, those items get flagged separately with a lower confidence rating, because they depend on conditions a photo cannot fully show.",
      ],
      bullets: [
        "Furniture and decor: priced against current retail, high confidence",
        "Paint and soft goods: priced by square footage and labor rate, high confidence",
        "Electrical or framing changes: priced as a range pending a site visit, lower confidence",
      ],
    },
    {
      h2: "What The Tool Will Not Do",
      body: [
        "It will not turn a cramped one-window room into an airy loft. It will not invent square footage. It will not tell you a $400 budget gets you a full furniture set from a design brand, and it will not silently swap your ceiling fan for recessed cans and call it done without listing the electrical cost.",
        "It also will not replace a walkthrough with an actual designer or contractor if your project involves structural changes, permits, or anything behind a wall. Use it to get the direction and the number right before that call, not instead of it.",
      ],
    },
  ],

  faqs: [
    { q: "Do I need a professional photo of my room?", a: "No. A phone photo taken standing in a normal spot, with the room lit and mostly free of clutter, is enough for the software to read the wall lines and window positions accurately." },
    { q: "Can it redesign a room with furniture already in it?", a: "Yes, though a photo of the room decluttered or lightly furnished gives a cleaner read on the actual proportions. If your room is cluttered, running it through a declutter pass first tends to improve accuracy." },
    { q: "Will the furniture it shows me actually be purchasable?", a: "The shopping list is matched to real products and current pricing where possible. Some items are close matches rather than the exact SKU, and that is noted rather than presented as a guaranteed link." },
    { q: "What is the difference between this and virtual staging?", a: "Virtual staging furnishes an empty room, usually for a listing photo. This tool redesigns a room you live in, keeps your existing architecture, and is meant to guide an actual purchase or renovation, not just a photo." },
    { q: "Can I use this output to hire a contractor?", a: "For furniture-only changes you generally do not need a contractor. If your redesign includes any construction items, the scope of work list is written to be handed to a contractor for their own bid, not as a replacement for one." },
  ],

  relatedSlugs: [
    "/renovation-cost-estimator",
    "/rehab-cost-calculator",
    "/for-interior-designers",
    "/for-landlords",
    "/declutter-photo",
    "/rental-grade-vs-retail-grade",
  ],

  ctaTitle: "Redesign The Room You Actually Have",
  ctaBody: "Upload a photo of your living room and get a furnished redesign with a priced shopping list, built around walls that do not move.",
  ctaLabel: "Start My Interior Design",
};
