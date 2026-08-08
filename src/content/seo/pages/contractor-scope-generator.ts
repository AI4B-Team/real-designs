import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/contractor-scope-generator",
  tier: "B",
  intent: "How to write a contractor scope of work that produces accurate bids instead of change orders.",

  metaTitle: "Contractor Scope Of Work Generator | Real Designs",
  metaDescription:
    "Turn a photo and a budget into a line-item scope of work with quantities, trades and planning ranges a contractor can price on the first visit.",

  eyebrow: "Scope Of Work",
  h1: "Contractor Scope Of Work Generator",
  lede:
    "A scope document that names the trade, the quantity and the material for every line, so the number you get back is a price and not a guess.",

  spaceType: "interior",
  roomType: "kitchen",
  budgetBand: 2,

  intro: [
    "A scope of work is the document that separates a firm price from a guess, and most homeowners hand a contractor neither: they hand over a Pinterest board and a room number. On a typical kitchen job with 9 to 12 line items, a scope missing even 3 of them is the single biggest cause of change orders, which is where a $28,000 kitchen quietly becomes a $34,000 kitchen. This page builds that document from a photo of the actual room, with quantities a trade can price without a second visit.",
  ],

  beforePhoto: "kitchenBefore",
  afterPhoto: "kitchenAfter",
  beforeCaption: "A kitchen photographed as it sits, walls and cabinet runs measured from the frame.",
  afterCaption: "The same room with a finish plan applied and every surface converted to a scope line.",

  steps: [
    { title: "Upload The Room", text: "One photo of the space gives Reality Lock the wall lengths, ceiling height and fixture locations the scope is built on." },
    { title: "Set The Finish Level And Budget", text: "Pick a grade and a target number and the scope is generated to match it, not the other way around." },
    { title: "Export The Document", text: "A printable scope with quantities, trades and a planning range per line, ready to hand to three bidders." },
  ],

  showcase: ["brief", "scope", "reality-lock", "budget-mode"],

  scopeTitle: "Sample Scope Of Work: Mid-Range Kitchen",
  scopeIntro:
    "This is the level of detail a scope needs before a trade can price it in one pass. Quantities are pulled from the room, not assumed from a national average.",
  scopeLines: [
    { item: "Demolition And Disposal", qty: "180 SF", trade: "Demolition", low: 580, high: 790 },
    { item: "Cabinetry, Base And Wall", qty: "24 LF", trade: "Cabinetry", low: 7900, high: 11900 },
    { item: "Countertops, Quartz", qty: "42 SF", trade: "Countertops", low: 2600, high: 3900 },
    { item: "Tile Backsplash", qty: "30 SF", trade: "Tile", low: 1200, high: 1750 },
    { item: "Flooring, LVP", qty: "180 SF", trade: "Flooring", low: 1500, high: 2300 },
    { item: "Paint, Walls And Ceiling", qty: "180 SF", trade: "Paint", low: 750, high: 1100 },
    { item: "Plumbing, Sink And Faucet", qty: "1 LS", trade: "Plumbing", low: 900, high: 1500 },
    { item: "Electrical And Under-Cabinet Lighting", qty: "1 LS", trade: "Electrical", low: 1100, high: 1900 },
    { item: "Appliance Set, Mid Range", qty: "1 LS", trade: "Appliances", low: 2400, high: 4600 },
    { item: "Permit And Inspection Fees", qty: "1 LS", trade: "General", low: 350, high: 900 },
  ],
  scopeBasis: "Rates reflect a 180 SF kitchen at retail finish grade. Layout is not changing and no plumbing or gas lines are moving.",
  confidence: "Medium",

  sections: [
    {
      h2: "What Belongs In A Scope Of Work Document",
      body: [
        "A scope of work is not a description of a style, it is an inventory of what a crew will touch, remove, install and finish, stated with quantities. Every line needs four things: the item, the trade responsible for it, a measured quantity, and a range wide enough to cover normal material variation but tight enough to mean something. Anything softer than that is a mood board with a dollar sign on it, and mood boards do not get you comparable bids from three different contractors.",
        "The document should read the same way a trade reads a job: demolition first, then structural or mechanical rough-in if there is any, then the finish trades in the order they actually occupy the room. A cabinet installer cannot price a job that says 'update kitchen.' A cabinet installer can price a job that says 24 linear feet of base and wall cabinetry, shaker style, painted finish, soft-close hardware. The specificity is the point, not an obstacle to getting a number fast.",
      ],
    },
    {
      h2: "Why Vague Scopes Produce Change Orders",
      body: [
        "Every line a scope omits becomes a conversation on-site, and every on-site conversation about scope becomes a change order, because the crew is already mobilized and the leverage has shifted. A scope that says 'new flooring' without naming the underlayment, the transition strips at the doorways, or whether the dishwasher gets pulled and reset, is a scope that will generate at least one surprise invoice. On a kitchen remodel, the three most common omissions are electrical circuit upgrades for new appliances, disposal of old cabinetry and countertop, and paint touch-up after other trades finish.",
        "None of those three are exotic. They are predictable parts of almost every kitchen job, and a scope that names them up front costs nothing extra, because the contractor was going to charge for the work either way. The only question is whether you find out the number before the crew starts or after the old cabinets are already in a dumpster and you are negotiating from a room with no working sink.",
      ],
      bullets: [
        "Electrical circuit or panel work for new appliances",
        "Disposal fees for cabinetry, countertop and old flooring",
        "Paint touch-up after cabinetry, tile and flooring trades finish",
        "Plumbing supply line relocation if the sink moves even a few inches",
      ],
    },
    {
      h2: "How Trades Read A Scope Before They Bid",
      body: [
        "A general contractor pricing a kitchen does not read your scope as a story, they read it as a list to route to subcontractors. The cabinetry line goes to a cabinet shop, the countertop line goes to a fabricator, the tile line goes to a tile setter, and each of those trades needs its own quantity to price against. If your scope bundles three trades into one paragraph, the general contractor has to disassemble it before they can even send it out for pricing, and that disassembly time gets built into their markup whether they tell you or not.",
        "A scope organized by trade, with the quantity already measured, is a scope a general contractor can forward as-is. That shaves real time off the bidding cycle, and it is also the fastest way to compare three bids apples to apples, because all three contractors priced the identical list instead of three different interpretations of 'update the kitchen.'",
      ],
    },
    {
      h2: "Exclusions, Allowances And Who Supplies What",
      body: [
        "A complete scope names what is excluded as clearly as what is included. If the appliance package is a homeowner-supplied allowance rather than a contractor markup, say so on the line, because the price a contractor quotes for 'appliance install' with their own supplied units is not comparable to installing units you bought yourself. The same applies to tile, plumbing fixtures and lighting: allowance lines should state a dollar figure the homeowner is budgeting for that item, separate from the labor to install it.",
        "This matters most on countertops and cabinetry, the two most expensive lines in almost every kitchen scope. A cabinetry allowance of $8,000 means nothing without stating whether it covers stock cabinets or semi-custom, because that single distinction can move the line by 40 percent. Write the allowance and the grade assumption on the same line, every time.",
      ],
    },
    {
      h2: "How A Photo-Derived Scope Shortens The Site Visit",
      body: [
        "The traditional path to a scope of work is a contractor walking your kitchen with a tape measure and a notepad, then emailing you a proposal three to ten days later. That visit is necessary for a final bid, but it does not have to be the starting point for the scope itself. A photo of the room, combined with a stated finish grade and budget target, produces a quantity-based scope before anyone shows up, and the site visit becomes a verification pass rather than a discovery pass.",
        "That changes the tone of the whole negotiation. Contractors bidding against a document that already has measured quantities spend their visit confirming conditions, not building a list from scratch, and homeowners walk into the bidding process already knowing what a realistic range looks like for their specific room instead of a national average that has nothing to do with their cabinet run or their tile choice.",
      ],
    },
  ],

  faqs: [
    {
      q: "Is a scope of work the same thing as a contractor bid?",
      a: "No. A scope of work is a description of the job, itemized by trade and quantity. A bid is a contractor's priced response to that scope. Having a detailed scope in hand before you request bids is what lets you compare multiple contractors on the exact same work instead of three different interpretations of the job.",
    },
    {
      q: "Can I use a generated scope to get bids from multiple contractors?",
      a: "Yes, that is the intended use. A scope with named trades, measured quantities and stated allowances is the document you hand to every contractor you are getting a bid from, so their prices are answering the same question and can actually be compared side by side.",
    },
    {
      q: "Does a photo-based scope replace a site visit?",
      a: "No. It replaces the blank-page starting point of a site visit. A contractor still needs to confirm wall condition, verify electrical panel capacity and check for anything hidden behind cabinetry or flooring before a final price is firm. The scope makes that visit faster and more focused.",
    },
    {
      q: "What if my contractor wants to price it differently than the scope?",
      a: "That is useful information, not a problem. If a contractor's pricing structure diverges from the scope's line items, ask them to reconcile it line by line. A contractor unwilling to do that is telling you something about how their change orders will go later in the job.",
    },
    {
      q: "How accurate are the planning ranges compared to a real bid?",
      a: "The ranges are built from published unit rates and the measured quantities of your room, which puts them in the right neighborhood for planning and financing conversations. They carry a Medium or High confidence label, not a guarantee, and a signed bid from a licensed contractor is always the number that governs the job.",
    },
  ],

  relatedSlugs: [
    "/kitchen-remodel-cost",
    "/renovation-cost-estimator",
    "/free/rehab-cost-calculator",
    "/rental-grade-vs-retail-grade",
    "/ai-kitchen-design",
    "/for-contractors",
  ],

  howTo: {
    name: "How To Generate A Contractor Scope Of Work",
    steps: [
      { name: "Photograph The Room", text: "Take one clear, well-lit photo of the space from a corner so both wall runs are visible." },
      { name: "Set Finish Grade And Budget", text: "Choose rental, retail or premium grade and enter a target budget so the scope is priced to match it." },
      { name: "Review The Generated Line Items", text: "Check that each line names a trade, a quantity and an allowance or unit rate, and adjust any that do not match your room." },
      { name: "Add Exclusions And Notes", text: "State anything homeowner-supplied, anything explicitly excluded, and any known site conditions like an older electrical panel." },
      { name: "Export And Distribute", text: "Send the finished scope to three contractors so every bid answers the same document." },
    ],
  },

  ctaTitle: "Turn Your Kitchen Photo Into A Scope Of Work",
  ctaBody: "Upload one photo and get a line-item document a contractor can price without a second visit.",
  ctaLabel: "Generate My Scope",
};
