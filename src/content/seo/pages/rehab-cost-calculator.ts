import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/rehab-cost-calculator",
  tier: "B",
  intent: "Someone wants a defensible rehab number before they write an offer or hand a job to a contractor.",

  metaTitle: "Free Rehab Cost Calculator From A Photo",
  metaDescription: "Upload a photo, get a rehab planning range built from quantities and unit rates, not a rule of thumb. See the line items before you offer.",

  eyebrow: "Rehab Cost Calculator",
  h1: "Free Rehab Cost Calculator From A Photo",
  lede: "Turn one photo into a measured scope with unit rates and a labour factor, not a per square foot guess.",

  spaceType: "interior",
  roomType: "whole home",
  budgetBand: 2,

  intro: [
    "A rehab number is built the same way every time: quantity times unit rate times a local labour factor, plus a contingency line, and it should land as a range, not a single figure. On a typical 1,500 square foot whole home rehab at retail grade, that math usually lands between $28,000 and $52,000 depending on kitchen and bathroom condition, and the spread between those two numbers is the whole point. A single number hides the risk. A range shows it.",
    "This calculator does that math from a photo of the space and a budget band you pick, then lets you adjust room by room before you ever call a contractor. It will not tell you the roof is bad if the photo does not show the roof. It will tell you what the visible finishes cost to replace at three grades, with the trades and quantities laid out so you can check the arithmetic yourself.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Dated finishes throughout, no visible structural issues.",
  afterCaption: "Same layout, retail grade finishes priced line by line.",

  steps: [
    { title: "Pick A Room", text: "Choose the room and enter its size to set the baseline for the planning range." },
    { title: "Pick A Grade & Budget Band", text: "Rental, retail or premium changes every unit rate in the scope at once." },
    { title: "Get The Range", text: "A low and high total, a per square foot figure, and a printable line item table." },
  ],

  showcase: ["scope", "budget-mode", "brief", "grades", "reality-lock"],

  scopeTitle: "Sample Whole Home Rehab Scope",
  scopeIntro: "A 1,500 square foot retail grade rehab, dated but not distressed, with kitchen and one bathroom included.",
  scopeLines: [
    { item: "Demolition & Disposal", qty: "1,500 SF", trade: "Demolition", low: 3400, high: 5200 },
    { item: "Flooring Throughout", qty: "1,500 SF", trade: "Flooring", low: 10500, high: 17250 },
    { item: "Interior Paint", qty: "1,500 SF", trade: "Paint", low: 4650, high: 7050 },
    { item: "Kitchen Allowance", qty: "1 LS", trade: "Cabinetry", low: 12000, high: 26000 },
    { item: "Bathroom Allowance", qty: "1 LS", trade: "Plumbing", low: 7500, high: 16000 },
    { item: "Interior Doors & Trim", qty: "1,500 SF", trade: "Carpentry", low: 3300, high: 5400 },
    { item: "Electrical Refresh", qty: "1,500 SF", trade: "Electrical", low: 3900, high: 6600 },
    { item: "HVAC Service Or Replacement", qty: "1 LS", trade: "Mechanical", low: 1200, high: 8500 },
    { item: "Exterior Touch Up", qty: "1 LS", trade: "Paint", low: 900, high: 2400 },
    { item: "Contingency", qty: "10 Pct", trade: "Reserve", low: 4735, high: 9440 },
  ],
  scopeBasis: "Published unit rates times measured square footage, adjusted for retail grade finish and a 10 percent contingency.",
  confidence: "Medium",

  sections: [
    {
      h2: "How A Real Rehab Number Gets Built",
      body: [
        "Every legitimate rehab estimate is quantity times rate times a labour factor. The quantity comes from measuring the space, square feet of flooring, linear feet of cabinetry, square feet of tile. The rate comes from what that material and its installation actually cost in a given market, which is why a kitchen in rural Ohio and a kitchen in coastal California can differ by 40 percent for the identical scope. The labour factor adjusts for local trade availability and permitting friction, and it is the piece most flat calculators skip entirely.",
        "Contingency is the fourth term, and it is not padding. It exists because a rehab always surfaces something the initial walkthrough could not see, cracked subfloor under old carpet, undersized electrical panel behind a wall, a plumbing stack that has to be relocated once the tile comes off. Ten percent is a reasonable floor for a house that has been maintained. Fifteen to twenty percent is more honest for anything that has sat vacant or been a rental for a decade without inspection.",
        "What this calculator produces is that same structure applied to your photo: measured or estimated quantities, published unit rates for the grade you select, and a contingency line you can see and adjust. It will not replace a contractor's walkthrough, but it gives you a number to walk into that conversation with instead of a guess pulled from a forum thread.",
      ],
    },
    {
      h2: "Per Square Foot Rule Of Thumb Versus Measured Scope",
      body: [
        "A per square foot rule of thumb, say $35 a square foot for a full rehab, is useful for one thing only: deciding whether a property is worth a second look. It compresses kitchens, bathrooms, mechanicals and cosmetic work into a single blended number, and blended numbers hide exactly the line items that blow budgets. Two houses at the same square footage with different kitchen conditions can differ by $15,000 in real cost while showing an identical per square foot figure on a spreadsheet.",
        "A measured scope goes the other direction. It breaks the same house into flooring, paint, cabinetry, countertops, plumbing fixtures, electrical devices and appliances, prices each one at the unit rate for the grade you are targeting, and sums them with a contingency on top. It takes longer to produce but it is the only version a contractor can actually price against, and the only version that tells you which room is driving your budget.",
        "Use the rule of thumb to screen ten properties in an afternoon. Use the measured scope on the two or three that survive that screen, before you make an offer or sign a contract. Skipping straight to a per square foot number on the property you are actually buying is how rehabs go 20 percent over.",
      ],
      bullets: [
        "Per square foot: fast, good for screening multiple properties",
        "Measured scope: slower, good for the property you are actually buying",
        "Blended numbers hide which room is driving the budget",
        "A contractor cannot price a per square foot figure, only a line item scope",
      ],
    },
    {
      h2: "Where Rehab Budgets Actually Go Wrong",
      body: [
        "The three most common overruns are kitchens, bathrooms and anything behind a wall. Kitchens overrun because cabinetry is quoted by linear foot but people picture it by square foot of floor space, and a galley kitchen with 30 linear feet of cabinets can cost more than an open kitchen with 22. Bathrooms overrun because tile labour, not tile material, is the expensive part, and a shower with a niche and a bench adds hours a flat estimate never accounts for.",
        "Behind the wall costs, old wiring, undersized panels, cast iron drain lines, are the ones that turn a planning range into a change order. They are also the reason contingency exists rather than being optional. A rehab calculator built from a photo can flag visible age indicators, an old panel, aluminum-looking wiring, visible corrosion, but it cannot see inside a wall, and no honest tool will claim otherwise.",
      ],
    },
    {
      h2: "Grade Changes The Entire Number, Not Just The Finishes",
      body: [
        "Rental grade, retail grade and premium are not cosmetic labels, they change the unit rate on every line in the scope. A rental grade kitchen uses laminate countertops and stock cabinets priced for durability and low replacement cost. A retail grade kitchen targets what a resale buyer in that market expects to see, quartz, semi custom cabinets, a tile backsplash. Premium goes further into custom cabinetry and higher end appliances aimed at a specific buyer.",
        "Picking the wrong grade for your exit strategy is one of the most expensive mistakes a rehab budget can make. Retail grade finishes on a property you plan to hold as a long term rental overspend on durability you do not need. Rental grade finishes on a property you plan to flip in a retail neighborhood undersell what the comps in that street expect, and the appraisal or buyer walkthrough will reflect it.",
      ],
    },
  ],

  faqs: [
    {
      q: "How Accurate Is A Rehab Number From A Photo?",
      a: "It is only as accurate as what a photo can show, which is visible finishes, layout and obvious age indicators. It cannot see behind walls, under flooring, or inside a panel. Treat the output as a planning range for visible scope and add contingency for anything the photo cannot confirm, especially on older or vacant properties.",
    },
    {
      q: "Should I Use Rental Grade Or Retail Grade Pricing?",
      a: "Match the grade to your exit strategy. Rental grade fits a property you plan to hold and lease. Retail grade fits a property you plan to sell to an owner occupant in a market where buyers expect updated finishes. Using the wrong grade either overspends on durability nobody needs or undersells what comps require.",
    },
    {
      q: "Why Does My Contractor's Number Differ From This Range?",
      a: "A contractor's price includes a physical walkthrough, your specific product selections, current material pricing in their supply chain, and their own labour and overhead. This calculator gives you a planning range to negotiate against and to sanity check that number, not a substitute for a bid.",
    },
    {
      q: "What Is A Reasonable Contingency Percentage?",
      a: "Ten percent is a reasonable floor for a property that has been maintained and inspected. Fifteen to twenty percent is more honest for a property that sat vacant, was a long term rental without upkeep, or has any visible deferred maintenance on the exterior or mechanicals.",
    },
    {
      q: "Does This Calculator Replace An Inspection?",
      a: "No. It prices visible finish scope from a photo and published unit rates. A licensed inspection covers structural, electrical, plumbing and mechanical systems that a photo cannot evaluate, and should happen before you finalize any purchase or rehab budget.",
    },
  ],

  relatedSlugs: [
    "/free/rehab-cost-calculator",
    "/free/arv-calculator",
    "/arv-calculator",
    "/renovation-cost-estimator",
    "/rehab-cost-calculator",
    "/rental-grade-vs-retail-grade",
  ],

  howTo: {
    name: "How To Build A Rehab Cost Planning Range",
    steps: [
      { name: "List Each Room", text: "Note each room you plan to rehab along with its approximate size." },
      { name: "Select Space Type & Budget Band", text: "Choose interior, exterior or landscape, then pick a budget band from Refresh through Reimagine." },
      { name: "Choose A Finish Grade", text: "Pick rental, retail or premium based on whether you are holding, flipping or building for a specific buyer." },
      { name: "Review The Line Items", text: "Check the quantities, trades and unit rates the calculator generated against what you can see in the room." },
      { name: "Add Contingency", text: "Apply a 10 to 20 percent contingency depending on the property's age and condition history." },
      { name: "Confirm With A Walkthrough", text: "Use the range to screen the deal, then confirm it with a contractor's physical walkthrough before committing." },
    ],
  },

  ctaTitle: "See Your Rehab Number Line By Line",
  ctaBody: "Use the free rehab calculator to get a planning range with unit rates and a contingency line you can review with a contractor.",
  ctaLabel: "Try The Free Calculator",
};
