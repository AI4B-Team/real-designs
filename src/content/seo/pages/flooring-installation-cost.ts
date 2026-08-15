import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/flooring-installation-cost",
  tier: "B",
  intent: "Buyer wants flooring installation cost per square foot across material types before choosing a product and getting quotes.",

  metaTitle: "Flooring Installation Cost Per Square Foot",
  metaDescription: "Compare flooring installation cost per square foot for hardwood, laminate, vinyl and tile, with a planning range and a line item scope by room.",

  eyebrow: "Flooring Installation",
  h1: "Flooring Installation Cost Per Square Foot",
  lede: "See a realistic flooring installation cost per square foot for the most common material types, plus a line item scope so you know what is included before you get a quote.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 1,

  intro: [
    "Flooring installation cost per square foot ranges from about $3 to $6 for laminate, $4 to $9 for luxury vinyl plank, $6 to $14 for solid or engineered hardwood, and $7 to $16 for ceramic or porcelain tile, all including materials and labor. The single biggest variable inside any of those ranges is subfloor condition, if the existing subfloor needs leveling, repair, or removal of old adhesive, add $1 to $3 per square foot before the new flooring even goes down.",
    "For a typical living room around 300 square feet, that means laminate plans in the $900 to $1,800 range, luxury vinyl plank in the $1,200 to $2,700 range, hardwood in the $1,800 to $4,200 range, and tile in the $2,100 to $4,800 range. Getting a per square foot number before shopping materials is what keeps a flooring project from being priced backwards, where the product is chosen first and the installation cost becomes a surprise line item added on top.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Existing living room, worn carpet, original subfloor condition.",
  afterCaption: "Same living room, new flooring installed with baseboards and transitions finished.",

  steps: [
    { title: "Upload Your Room Photo", text: "The room dimensions and existing flooring condition anchor the square footage and demo scope so the estimate matches what a flooring contractor will actually quote." },
    { title: "Choose A Flooring Material", text: "Compare laminate, vinyl, hardwood and tile against your actual square footage to see the installed cost difference between materials in dollars, not just per square foot." },
    { title: "Get A Line Item Scope", text: "Export a scope with square footage, material, underlayment, transitions and baseboard reinstall broken out so a contractor can quote against a fixed list." },
  ],

  showcase: ["scope", "interior", "budget-mode", "shop"],

  scopeTitle: "Flooring Installation Scope & Planning Range",
  scopeIntro: "Line items for a 300 square foot living room, luxury vinyl plank at a mid-range price point.",
  scopeLines: [
    { item: "Demo & Haul Away, Existing Flooring", qty: "300 SF", trade: "Flooring", low: 450, high: 900 },
    { item: "Subfloor Repair & Leveling", qty: "300 SF", trade: "Flooring", low: 300, high: 900 },
    { item: "Luxury Vinyl Plank, Material", qty: "300 SF", trade: "Flooring", low: 900, high: 2100 },
    { item: "Underlayment", qty: "300 SF", trade: "Flooring", low: 150, high: 400 },
    { item: "Installation Labor", qty: "300 SF", trade: "Flooring", low: 750, high: 1500 },
    { item: "Baseboard Removal & Reinstall", qty: "70 LF", trade: "Carpentry", low: 280, high: 700 },
    { item: "Transition Strips & Trim", qty: "3 doorways", trade: "Flooring", low: 120, high: 300 },
    { item: "Furniture Move & Setup", qty: "1 room", trade: "General", low: 100, high: 300 },
  ],
  scopeBasis: "Planning range built from typical national material and labor costs for mid-range residential flooring installation, not a contractor bid.",
  confidence: "High",

  sections: [
    {
      h2: "Cost Per Square Foot By Material",
      body: [
        "Laminate is the most budget friendly option at $3 to $6 per square foot installed, and it is a reasonable choice for bedrooms and living rooms where moisture is not a concern. Luxury vinyl plank runs $4 to $9 per square foot and has become the most popular mid-range choice because it is water resistant and durable enough for kitchens, entries and bathrooms as well as living spaces.",
        "Solid or engineered hardwood runs $6 to $14 per square foot and remains the highest resale value option in most markets, though it requires more careful subfloor prep and is not recommended for bathrooms or basements below grade. Ceramic or porcelain tile runs $7 to $16 per square foot, with the range driven heavily by tile size and pattern complexity, a simple large format tile installs faster and cheaper than a small mosaic or herringbone pattern.",
        "Carpet, while less commonly requested now, still runs $2 to $5 per square foot installed for mid-range material and remains the cheapest option for bedrooms where softness matters more than durability.",
      ],
      bullets: [
        "Laminate: $3 to $6 per SF installed",
        "Luxury vinyl plank: $4 to $9 per SF installed",
        "Hardwood, solid or engineered: $6 to $14 per SF installed",
        "Ceramic or porcelain tile: $7 to $16 per SF installed",
      ],
    },
    {
      h2: "Subfloor Condition Changes The Number",
      body: [
        "The flooring material and installation labor are only part of the cost, subfloor condition is the variable most homeowners underestimate. A subfloor that is level, dry and free of old adhesive residue adds little to the base installation cost, while a subfloor that needs leveling compound, plywood replacement, or removal of multiple layers of old flooring can add $1 to $3 per square foot before the new material goes down.",
        "Water damage, squeaky spots, or visible unevenness are signs the subfloor will need work, and a contractor cannot give an accurate quote without seeing the subfloor exposed, which is why flooring quotes often include a contingency line for subfloor repair discovered during demo.",
      ],
    },
    {
      h2: "What Installation Labor Actually Includes",
      body: [
        "Installation labor covers laying the material itself, but a complete flooring job also includes demo and haul away of the old flooring, underlayment, transition strips between rooms, and removing and reinstalling baseboards so the new flooring meets the wall cleanly. Skipping baseboard removal to save money usually looks worse than the cost saved, since the new flooring will show a visible gap or an uneven cut line against the old baseboard.",
        "Furniture moving is also frequently left out of a quote unless specifically requested, and for a fully furnished room that can add $100 to $300 depending on room size and whether items need to be moved to another part of the house during installation.",
      ],
    },
    {
      h2: "Room By Room Considerations",
      body: [
        "Kitchens and bathrooms need water resistant material, luxury vinyl plank or tile, since laminate and solid hardwood can warp or swell with moisture exposure over time. Basements below grade have the same requirement plus a vapor barrier consideration, since concrete slabs can wick moisture even when they appear dry.",
        "High traffic areas like entries and hallways benefit from more durable, easier to clean material even if it costs more per square foot, since replacing worn flooring in five years costs more than the upgrade would have at installation. Bedrooms are the one area where carpet still makes practical sense for many households, since the softness and sound dampening it provides do not have a good substitute in hard flooring.",
      ],
    },
  ],

  faqs: [
    { q: "What is the average cost to install flooring per square foot?", a: "Installed cost ranges from about $3 to $6 per square foot for laminate, $4 to $9 for luxury vinyl plank, $6 to $14 for hardwood, and $7 to $16 for tile, including both material and labor." },
    { q: "Does subfloor condition really change the price that much?", a: "Yes. A subfloor that needs leveling, repair, or removal of old adhesive can add $1 to $3 per square foot before the new flooring is even installed, and this is the most common reason a quote comes in higher than the advertised per square foot price." },
    { q: "What flooring is best for kitchens and bathrooms?", a: "Luxury vinyl plank or tile are the standard choices for kitchens and bathrooms because they resist water, while laminate and solid hardwood can warp or swell with moisture exposure over time." },
    { q: "Is it cheaper to install flooring myself?", a: "Material cost stays the same either way, but skipping installation labor, roughly 40 to 50 percent of the installed price, can cut the total significantly if you are comfortable with the tools and the subfloor is already in good condition." },
    { q: "Does a flooring quote usually include baseboards?", a: "Not always. Removing and reinstalling baseboards so new flooring meets the wall cleanly is a separate line item, typically $4 to $10 per linear foot, and should be confirmed as included before comparing quotes." },
    { q: "How much does it cost to remove old flooring before installing new?", a: "Demo and haul away of existing flooring typically runs $1.50 to $3 per square foot depending on the material being removed, with multiple layers of old flooring or glued down carpet costing more to remove than a single layer." },
  ],

  relatedSlugs: [
    "/renovation-cost-estimator",
    "/rehab-cost-calculator",
    "/kitchen-remodel-cost",
    "/bathroom-remodel-cost",
    "/rental-grade-vs-retail-grade",
    "/ai-design-for-house-flippers",
  ],

  howTo: {
    name: "How To Estimate Flooring Installation Cost",
    steps: [
      { name: "Measure The Room Square Footage", text: "Measure length and width of each room getting new flooring and add 10 percent for waste and cuts around edges and doorways." },
      { name: "Choose A Material Category", text: "Pick laminate, vinyl, hardwood or tile based on room use, water exposure, and how the room needs to perform, not just appearance." },
      { name: "Check Subfloor Condition", text: "Look for soft spots, squeaks, unevenness or water damage, since subfloor repair can add $1 to $3 per square foot to the total." },
      { name: "Add Demo, Underlayment & Trim", text: "Include removal of old flooring, underlayment, transition strips and baseboard reinstall as separate line items, not assumed inside the material price." },
      { name: "Compare Installed Quotes, Not Material Prices", text: "Ask for a per square foot installed price that includes labor, demo and trim so quotes from different contractors are actually comparable." },
    ],
  },

  ctaTitle: "Get Your Flooring Installation Estimate",
  ctaBody: "Upload your room and compare flooring materials against your actual square footage and a planning range.",
  ctaLabel: "Start Flooring Estimate",
};
