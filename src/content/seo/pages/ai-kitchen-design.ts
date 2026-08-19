import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/ai-kitchen-design",
  tier: "A",
  intent: "Buyer wants AI kitchen design plus a realistic sense of what a kitchen remodel actually costs and why estimates vary so widely.",

  metaTitle: "AI Kitchen Design & Remodel Cost Planning",
  metaDescription: "Design a kitchen with AI and see a realistic remodel cost range. Cabinetry, layout changes, appliances and plumbing broken down by line item.",

  eyebrow: "AI Kitchen Design",
  h1: "AI Kitchen Design & Remodel Cost",
  lede: "Generate a designed kitchen from your real layout and see the line items, cabinetry, counters, appliances and plumbing, that actually drive the number before a contractor walks in.",

  spaceType: "interior",
  roomType: "kitchen",
  budgetBand: 2,

  intro: [
    "A kitchen remodel cost planning range depends almost entirely on one decision: are you keeping the existing layout and swapping finishes, or are you moving cabinets, plumbing and electrical to a new footprint. A finish level refresh, new cabinet fronts, counters, backsplash and appliances in the same footprint, typically plans in the $18,000 to $35,000 range for an average kitchen. A full remodel that relocates the sink, moves an island, or opens a wall runs $45,000 to $90,000 or more, because you are now paying for plumbing rough-in, electrical, and often structural work on top of the same finishes.",
    "Cabinetry is usually the single largest line item in either version, often 30 to 40 percent of the total budget. AI kitchen design lets you test cabinet configurations, counter materials and appliance packages against your actual room dimensions before you commit to a layout, so the design and the scope of work come out of the same session instead of a mood board that a contractor then has to price separately.",
  ],

  beforePhoto: "kitchenBefore",
  afterPhoto: "kitchenAfter",
  beforeCaption: "Existing kitchen, dated cabinetry and laminate counters, footprint unchanged.",
  afterCaption: "Same kitchen, cabinetry, counters and lighting redesigned within the existing footprint.",

  steps: [
    { title: "Upload Your Kitchen Photo", text: "The cabinet locations, window and appliance positions from your actual room anchor the design so the plan matches what a contractor will actually build." },
    { title: "Set Budget Band & Finish Level", text: "Choose a refresh, makeover or full renovation level and the design generates cabinetry, counters and appliances that fit that spend, not an aspirational one." },
    { title: "Get A Cabinetry & Trade Scope", text: "Export a line item scope with cabinet linear footage, counter square footage and any plumbing or electrical relocation flagged separately." },
  ],

  showcase: ["scope", "brief", "budget-mode", "shop", "reality-lock"],


  sections: [
    {
      h2: "Cabinetry Is What Drives The Number",
      body: [
        "Cabinets are the most expensive single component of nearly every kitchen budget, typically 30 to 40 percent of the total spend once you include hardware and install. The gap between stock cabinets and semi-custom or custom cabinetry is enormous, stock boxes might run $150 to $300 per linear foot installed while custom cabinetry can run $600 to $1,200 per linear foot for the same run of cabinets.",
        "This is also where most homeowners overspend without realizing it, because a kitchen with 28 linear feet of cabinets at custom pricing can add $15,000 to $20,000 over the same layout in stock or semi-custom cabinetry, before a single counter or appliance is chosen. If the budget is tight, spending on cabinet boxes in a mid-range line and putting the savings into counters or a better range is usually the better trade.",
        "AI kitchen design generates cabinet configurations against your actual wall dimensions, so you see linear footage and door count before you are comparing quotes from three different cabinet shops with three different measuring methods.",
      ],
    },
    {
      h2: "Layout Changes Versus Finish Changes",
      body: [
        "A finish change means new cabinet doors, counters, backsplash, paint and lighting in the exact same footprint, with the sink, range and refrigerator staying where they are. This is the $18,000 to $35,000 range for a typical kitchen and it is almost entirely a cosmetic and cabinetry job, no plumbing rough-in, no permit for structural work in most jurisdictions.",
        "A layout change means moving the sink, relocating the range, adding or removing a wall, or adding an island with its own plumbing or electrical run. Each of those moves triggers a permit, a plumber, and often an electrician, and that is why the same square footage can jump from $35,000 to $80,000 or more when the layout changes even though the finish level looks similar in a rendering.",
        "The mistake homeowners make with AI renderings generally is falling in love with a moved island or relocated sink without realizing that single move is often responsible for $8,000 to $15,000 of the budget increase on its own, separate from any finish upgrade.",
      ],
      bullets: [
        "Finish only, same footprint: cabinets, counters, backsplash, paint, lighting",
        "Layout change: moved sink, moved range, new island, removed wall",
        "Layout changes require permits and trade coordination that finish changes do not",
      ],
    },
    {
      h2: "Refresh Versus Remodel Is An Order Of Magnitude Difference",
      body: [
        "A kitchen refresh, new paint on existing cabinets, new hardware, a new backsplash and maybe a new sink faucet, can land in the $4,000 to $9,000 range and take one to two weeks. A kitchen remodel, new cabinets, new counters, new appliances and new flooring, lands in the $35,000 to $70,000 range and takes six to ten weeks minimum. These are not two points on the same scale, they are different scopes of work with different trades and different timelines.",
        "The confusion usually starts when a homeowner sees an AI rendering that looks like a full remodel and assumes it is achievable at refresh pricing because the photo does not show the difference between painted cabinets and new cabinet boxes. A good scope tool separates finish level from layout so you know before you call a contractor which category you are actually shopping for.",
      ],
    },
    {
      h2: "Appliance Allowances & Plumbing Relocation",
      body: [
        "Appliance packages vary more than almost any other line item, a builder grade four piece package runs $2,500 to $4,500 while a mid to high end package with a professional range can run $9,000 to $18,000 or more. Because appliances are often selected last, after cabinets and counters are already committed, it is common for a kitchen budget to run over specifically because the appliance allowance was set too low at the start.",
        "Plumbing relocation, moving a sink more than a foot or two from its existing drain line, typically adds $1,800 to $4,500 depending on whether the work is on a slab foundation or an accessible crawlspace, since slab work usually means cutting concrete. If the design keeps the sink and dishwasher on their existing plumbing lines, that cost disappears entirely, which is one of the fastest ways to cut a kitchen budget without touching the visible finishes.",
      ],
    },
  ],

  faqs: [
    { q: "What is the average cost of a kitchen remodel?", a: "For a mid-size kitchen, a finish only refresh typically plans in the $18,000 to $35,000 range, while a full remodel that changes the layout or relocates plumbing plans in the $45,000 to $90,000 range. Actual cost depends heavily on cabinetry grade and appliance selections." },
    { q: "Why does moving the kitchen sink cost so much?", a: "Moving a sink means rerouting the drain and supply lines, which usually requires a plumber and sometimes cutting into a slab foundation. Planning ranges for this alone run $1,800 to $4,500, separate from the sink and faucet fixtures themselves." },
    { q: "Is a kitchen refresh worth it instead of a full remodel?", a: "If the layout works and the cabinet boxes are structurally sound, a refresh, new doors, hardware, counters and backsplash, can deliver most of the visual improvement for a fraction of the cost and time of a full remodel." },
    { q: "How much of the budget should go to cabinets?", a: "Cabinetry typically runs 30 to 40 percent of a kitchen remodel budget. If cabinets are eating more than half the budget, it usually means the cabinet grade chosen does not match the rest of the finish level." },
    { q: "Does AI kitchen design account for plumbing and electrical?", a: "It flags any layout change, like a moved sink or new island outlet, as a separate scope line so you can see the cost impact before committing, but the exact routing still needs to be confirmed by a licensed plumber or electrician on site." },
  ],

  relatedSlugs: [
    "/kitchen-remodel-cost",
    "/renovation-cost-estimator",
    "/ai-design-for-house-flippers",
    "/for-contractors",
    "/2d-to-3d-floor-plan",
    "/rental-grade-vs-retail-grade",
  ],

  ctaTitle: "Design Your Kitchen & See The Scope",
  ctaBody: "Upload your kitchen and get a design with cabinetry, counters and a planning range attached.",
  ctaLabel: "Start Kitchen Design",
};
