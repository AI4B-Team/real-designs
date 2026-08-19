import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/kitchen-remodel-cost",
  tier: "B",
  intent: "What a kitchen remodel actually costs by tier, and which line items drive the number.",

  metaTitle: "What A Kitchen Remodel Actually Costs | Real Designs",
  metaDescription:
    "Kitchen remodel planning ranges by tier: cosmetic refresh, mid-range remodel and full gut with layout change, broken down by trade.",

  eyebrow: "Kitchen Cost",
  h1: "What A Kitchen Remodel Actually Costs",
  lede: "The same word, kitchen remodel, describes a $9,000 refresh and an $85,000 gut job. Here is how to tell which one you are actually pricing.",

  spaceType: "interior",
  roomType: "kitchen",
  budgetBand: 2,

  intro: [
    "Ask five people what a kitchen remodel costs and you get five wildly different numbers, because the phrase covers three different jobs. A cosmetic refresh on a 180 square foot kitchen sits in the $9,000 to $16,000 range, a mid-range remodel that replaces cabinetry and countertops runs $28,000 to $45,000, and a full gut with a layout change starts around $55,000 and climbs from there. This page separates those three tiers by the line items that actually drive the difference, starting with the one that moves the number more than any other: cabinetry.",
  ],

  beforePhoto: "kitchenBefore",
  afterPhoto: "kitchenAfter",
  beforeCaption:
    "A dated kitchen with original cabinetry, laminate counters and no layout changes needed.",
  afterCaption:
    "The same footprint after a mid-range remodel: new cabinetry, quartz counters and updated lighting.",

  steps: [
    {
      title: "Pick Your Kitchen Size",
      text: "Typical cabinet run and square footage set the baseline for the planning range below.",
    },
    {
      title: "Pick A Tier",
      text: "Cosmetic refresh, mid-range remodel, or full gut with layout change, each with its own planning range.",
    },
    {
      title: "Get The Line-Item Breakdown",
      text: "Every trade priced separately so you can see exactly where your budget is going.",
    },
  ],

  showcase: ["scope", "budget-mode", "reality-lock", "shop", "grades"],

  sections: [
    {
      h2: "The Three Tiers, And Why The Word 'Remodel' Hides The Difference",
      body: [
        "A cosmetic refresh keeps every cabinet box, every plumbing line and every wall exactly where it is, and changes surfaces: paint, hardware, a new backsplash, sometimes new countertops over the existing boxes. On a 180 square foot kitchen that lands around $9,000 to $16,000, and it is the fastest tier to complete because there is no demolition below the surface.",
        "A mid-range remodel replaces the cabinetry itself along with countertops, backsplash, flooring and appliances, but keeps the layout. Sinks, ranges and refrigerators stay in their existing locations. This is the tier most people picture when they say 'remodel the kitchen,' and it runs $28,000 to $45,000 on that same 180 square foot room.",
        "A full gut with a layout change moves plumbing and sometimes gas lines, may remove or add a wall, and often adds an island or reconfigures the working triangle entirely. This tier starts around $55,000 and has no real ceiling, because it depends on how much structural and mechanical work the new layout requires.",
      ],
    },
    {
      h2: "Cabinetry: The Line That Moves The Whole Budget",
      body: [
        "Cabinetry is the single largest line item in almost every kitchen remodel, typically 30 to 40 percent of the total budget, and it is also the line with the widest price spread. Stock cabinets from a big box supplier run $44 to $66 per linear foot installed. Semi-custom cabinetry, which is what most mid-range remodels actually use, runs meaningfully higher once you add soft-close hardware, full-overlay doors and a painted rather than laminate finish. Full custom cabinetry from a local shop can double the stock price again.",
        "Because cabinetry drives so much of the total, it is the first line to pin down before estimating anything else. A homeowner who wants a $30,000 kitchen but specifies full custom cabinetry has already spent most of that budget before countertops, tile or appliances enter the conversation.",
      ],
    },
    {
      h2: "Countertops By Material",
      body: [
        "Countertop material is the second-biggest lever in a kitchen budget after cabinetry, and the spread between materials is large enough to matter on a 40 to 45 square foot countertop run. Laminate runs roughly $16 to $24 per square foot installed and is the budget-tier default. Quartz, the most common mid-range and retail-grade choice, runs meaningfully higher and adds durability and resale appeal that laminate does not. Natural stone like granite or marble sits above quartz, with marble carrying both a higher material cost and a sealing and maintenance conversation that quartz avoids entirely.",
        "The honest advice here: quartz is where most mid-range remodels should land. It is the material buyers expect to see in a listing photo, and the incremental cost over laminate is small relative to the total kitchen budget, while the incremental cost of natural stone over quartz is rarely worth it unless the kitchen is a genuine showpiece.",
      ],
    },
    {
      h2: "Moving Plumbing Or Gas: The Cost People Never See Coming",
      body: [
        "Relocating a sink even a few feet, or moving a gas range to a new wall, is the single most common reason a kitchen budget blows past its original estimate. A layout that keeps every fixture in its existing location avoids this cost entirely. A layout that moves the sink to an island, or relocates a gas line to a different wall, adds plumbing and sometimes mechanical labor that can run into the thousands depending on what is under the slab or inside the wall cavity.",
        "This is worth deciding early and explicitly, because it is the line that separates a mid-range remodel from a full gut in terms of both cost and permit complexity. If your contractor's bid includes moved plumbing or gas without you having asked for it, ask why, because it usually means the new layout requires it, and that is useful information before you commit.",
      ],
    },
    {
      h2: "Permits, Inspections & Where People Underestimate",
      body: [
        "Any kitchen remodel touching electrical circuits, gas lines or structural walls needs a permit in most jurisdictions, and permit fees plus inspection scheduling typically add $350 to $900 and one to three weeks of calendar time that homeowners rarely budget for. Skipping the permit to save the fee is a real risk at resale, when an uninspected electrical or gas change can hold up a buyer's financing.",
        "The most common underestimate on a kitchen job is not any single line, it is the accumulation of small allowance-level items: disposal fees for old cabinetry, paint touch-up after other trades finish, a dishwasher that needs to be reset because the new countertop height changed, and appliance delivery lead times that stretch a two-week job into six. Build a 10 to 15 percent contingency into any kitchen budget for exactly this reason, and treat it as part of the plan rather than a sign something went wrong.",
      ],
    },
  ],

  faqs: [
    {
      q: "What does a mid-range kitchen remodel cost on average?",
      a: "On a typical 180 square foot kitchen with no layout change, a mid-range remodel replacing cabinetry, countertops, backsplash, flooring and appliances lands in a planning range of roughly $28,000 to $45,000. Actual pricing depends heavily on cabinetry grade and countertop material, the two largest line items in the scope.",
    },
    {
      q: "Is it cheaper to keep the existing kitchen layout?",
      a: "Yes, significantly. Keeping every sink, range and appliance in its current location avoids relocating plumbing and gas lines, which is one of the most expensive and unpredictable parts of a kitchen job. A layout change can add thousands of dollars and additional permit steps that a same-footprint remodel avoids entirely.",
    },
    {
      q: "How much of the budget should go to cabinetry?",
      a: "Cabinetry typically represents 30 to 40 percent of a kitchen remodel budget. If cabinetry is eating a much larger share than that, it usually means the grade chosen (custom versus semi-custom versus stock) is mismatched with the rest of the budget for countertops, tile and appliances.",
    },
    {
      q: "Do I need a permit for a kitchen remodel?",
      a: "If the job touches electrical circuits, gas lines, plumbing relocation or structural walls, most jurisdictions require a permit. A cosmetic refresh that changes only paint and surfaces usually does not. Skipping a required permit creates real resale risk when a buyer's lender flags unpermitted work.",
    },
    {
      q: "Why do kitchen remodels go over budget so often?",
      a: "Most overages come from an accumulation of small items rather than one big miss: disposal fees, paint touch-up after other trades, appliance lead times and unexpected electrical panel capacity issues. Building a 10 to 15 percent contingency into the original budget is the standard way experienced contractors account for this.",
    },
  ],

  relatedSlugs: [
    "/rehab-cost-calculator",
    "/free/rehab-cost-calculator",
    "/renovation-cost-estimator",
    "/ai-kitchen-design",
    "/rental-grade-vs-retail-grade",
    "/for-real-estate-agents",
  ],

  ctaTitle: "Price Your Own Kitchen In Minutes",
  ctaBody:
    "Try the free rehab calculator for a tier-specific planning range, or start an AI redesign of your kitchen.",
  ctaLabel: "Try The Free Calculator",
};
