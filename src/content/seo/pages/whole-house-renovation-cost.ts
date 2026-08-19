import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/whole-house-renovation-cost",
  tier: "A",
  intent: "Buyer wants a realistic whole house renovation cost range broken down by room and trade before committing to a full gut or a phased plan.",

  metaTitle: "Whole House Renovation Cost Planning Guide",
  metaDescription: "See a realistic whole house renovation cost range by room and trade, from a cosmetic pass to a full gut, with line items you can review with a contractor.",

  eyebrow: "Whole House Renovation",
  h1: "Whole House Renovation Cost",
  lede: "Get a room by room scope and a planning range for a whole house renovation, cosmetic refresh through full gut, before you start collecting contractor bids.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 3,

  intro: [
    "A whole house renovation cost planning range depends on how many rooms are touched and how deep the work goes in each one, which is why the same size house can plan anywhere from $60,000 to $400,000 or more. A cosmetic whole house pass, paint, flooring, lighting and fixture swaps across every room with no layout changes, typically plans in the $60,000 to $120,000 range for an average 2,000 square foot home. A full gut renovation that touches the kitchen, all bathrooms, mechanical systems and structural layout runs $250,000 to $450,000 or more, because you are now paying for demolition, permits, and coordinated trades across the entire footprint at once instead of one room at a time.",
    "The single biggest driver of a whole house number is how many wet rooms, kitchens and bathrooms, are included, since plumbing, tile and cabinetry make up a disproportionate share of any renovation budget. A house with three bathrooms and a kitchen being fully redone will cost more than a larger house where only the living spaces and bedrooms get cosmetic work. Seeing the room by room breakdown before you talk to a contractor is what keeps a whole house renovation from turning into an open ended change order.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Existing living room, dated finishes, original layout throughout the home.",
  afterCaption: "Same living room, finishes, lighting and flooring updated as part of a whole house pass.",

  steps: [
    { title: "List Every Room", text: "Kitchen, bathrooms, bedrooms and living spaces are priced individually so the whole house total is a sum of real rooms, not a square footage guess." },
    { title: "Set A Whole House Budget Band", text: "Choose cosmetic, mid-range or full gut and every room in the plan generates finishes that match that spend level consistently across the house." },
    { title: "Get A Trade By Trade Scope", text: "Export a combined scope with cabinetry, flooring, plumbing, electrical and paint broken out by room and by trade so subcontractors can bid off the same document." },
  ],

  showcase: ["scope", "budget-mode", "interior", "brief", "grades"],

  scopeTitle: "Whole House Renovation Scope & Planning Range",
  scopeIntro: "Line items for a full renovation of an average 2,000 square foot, three bedroom, two bathroom home.",
  scopeLines: [
    { item: "Kitchen Remodel", qty: "1 kitchen, 180 SF", trade: "General", low: 35000, high: 75000 },
    { item: "Primary Bathroom Remodel", qty: "1 bath, 80 SF", trade: "General", low: 15000, high: 32000 },
    { item: "Secondary Bathroom Remodel", qty: "1 bath, 45 SF", trade: "General", low: 9000, high: 18000 },
    { item: "Flooring Throughout", qty: "1,600 SF", trade: "Flooring", low: 12000, high: 28000 },
    { item: "Interior Paint, Whole House", qty: "2,000 SF", trade: "Painting", low: 6000, high: 13000 },
    { item: "Electrical Updates & Fixtures", qty: "24 fixtures", trade: "Electrical", low: 8000, high: 18000 },
    { item: "HVAC System Updates", qty: "1 system", trade: "Mechanical", low: 9000, high: 20000 },
    { item: "Windows & Trim", qty: "16 windows", trade: "Carpentry", low: 14000, high: 32000 },
  ],
  scopeBasis: "Planning range built from typical national material and labor costs for mid-range residential whole house renovations, not a contractor bid.",
  confidence: "Medium",

  sections: [
    {
      h2: "Cosmetic Pass Versus Full Gut",
      body: [
        "A cosmetic whole house pass means paint, flooring, lighting, hardware and fixture swaps in every room with no layout or system changes, no moved plumbing, no new electrical panel, no structural work. This is the $60,000 to $120,000 range for an average home and it is the fastest path to a visibly different house, usually completed in four to eight weeks.",
        "A full gut renovation means removing rooms down to studs, relocating plumbing and electrical, replacing mechanical systems and often changing the floor plan itself. This is the $250,000 to $450,000 range and it takes four to eight months, because permits, inspections and sequenced trades add time that a cosmetic pass never encounters.",
        "Most homeowners actually want something in between, a mid-range renovation that redoes the kitchen and bathrooms fully while giving the rest of the house a cosmetic pass, which typically lands in the $130,000 to $240,000 range depending on how many wet rooms are involved.",
      ],
      bullets: [
        "Cosmetic pass: paint, flooring, lighting, fixtures, no layout changes",
        "Mid-range: kitchen and bathrooms fully redone, rest of house cosmetic",
        "Full gut: structural, plumbing, electrical and mechanical systems all replaced",
      ],
    },
    {
      h2: "Kitchens & Bathrooms Drive The Total",
      body: [
        "Wet rooms, the kitchen and every bathroom, carry a disproportionate share of any whole house budget because they combine cabinetry, tile, plumbing and electrical in a small footprint. A house with a kitchen and three bathrooms being fully redone can spend 50 to 60 percent of the total renovation budget in those rooms alone, even though they represent a fraction of the square footage.",
        "This is why two houses of the same size can have wildly different whole house numbers, one where only bedrooms and living spaces are touched will cost far less than one where every bathroom is also gutted. Scoping wet rooms first and separately from the rest of the house gives a much more accurate whole house total than a blended per square foot number.",
      ],
    },
    {
      h2: "Sequencing & Living Through The Work",
      body: [
        "Whole house renovations are typically sequenced kitchen and bathrooms first, since those trades take longest and the house is least livable during that phase, followed by flooring, paint and lighting throughout. Attempting every room simultaneously usually costs more in trade coordination and mistakes than a sequenced plan, even though it takes longer calendar time.",
        "Whether you can live in the house during a whole house renovation depends almost entirely on whether the kitchen and at least one bathroom stay functional at any given time. A full gut renovation of every room simultaneously typically requires moving out, while a phased cosmetic to mid-range renovation can often be done with the household staying in place.",
        "Budgeting for temporary housing or a kitchen setup elsewhere, even a modest one, should be part of the whole house planning conversation from the start rather than a surprise mid-project.",
      ],
    },
    {
      h2: "Systems & Structure Behind The Finishes",
      body: [
        "Older homes frequently need electrical panel upgrades, HVAC replacement, or plumbing repiping as part of a whole house renovation even though none of that work is visible in the finished photos. These system level costs, typically $8,000 to $20,000 per system, are the most common source of whole house budgets running over, because they are discovered once walls are opened rather than planned for up front.",
        "A house built before the 1990s should assume at least one major system, electrical, plumbing or HVAC, needs meaningful investment during a full renovation, and pricing that in during planning avoids a mid-project scramble when it is found during demolition.",
      ],
    },
  ],

  faqs: [
    { q: "What is a realistic whole house renovation cost?", a: "For an average 2,000 square foot home, a cosmetic pass plans in the $60,000 to $120,000 range, a mid-range renovation with a full kitchen and bathroom remodel plans in the $130,000 to $240,000 range, and a full gut renovation plans in the $250,000 to $450,000 range." },
    { q: "Why do kitchens and bathrooms cost so much more than other rooms?", a: "Kitchens and bathrooms combine cabinetry, tile, plumbing and electrical in a small footprint, and can account for 50 to 60 percent of a whole house budget even though they are a fraction of the total square footage." },
    { q: "Can I live in my house during a whole house renovation?", a: "It depends on whether a functional kitchen and at least one bathroom remain available throughout. A phased cosmetic to mid-range renovation can often be done in place, while a full simultaneous gut of every room typically requires moving out." },
    { q: "What usually causes a whole house renovation to go over budget?", a: "System level surprises, electrical panels, plumbing repiping or HVAC replacement, discovered once walls are opened, are the most common overrun. Budgeting $8,000 to $20,000 per system as a contingency for older homes helps avoid this." },
    { q: "How long does a whole house renovation take?", a: "A cosmetic pass typically takes four to eight weeks. A mid-range renovation with kitchen and bathroom work takes three to five months. A full gut renovation typically takes four to eight months from permit to completion." },
    { q: "Should I renovate room by room or all at once?", a: "Sequencing kitchen and bathrooms first, then flooring, paint and lighting throughout, generally produces better trade coordination and fewer mistakes than attempting every room simultaneously, even though it extends the calendar timeline." },
  ],

  relatedSlugs: [
    "/kitchen-remodel-cost",
    "/bathroom-remodel-cost",
    "/renovation-cost-estimator",
    "/rehab-cost-calculator",
    "/ai-design-for-house-flippers",
    "/for-contractors",
  ],

  howTo: {
    name: "How To Plan A Whole House Renovation Budget",
    steps: [
      { name: "List Every Room In Scope", text: "Note which rooms get a cosmetic pass, a mid-range remodel, or a full gut, since mixing scope levels across the house is normal and expected." },
      { name: "Scope Wet Rooms Separately", text: "Price the kitchen and every bathroom individually first, since they drive the majority of the total and vary the most by finish level." },
      { name: "Budget A System Contingency", text: "Set aside 10 to 15 percent of the total for electrical, plumbing or HVAC discoveries, especially in homes built before the 1990s." },
      { name: "Sequence The Work", text: "Plan kitchen and bathrooms first, then flooring, paint and lighting throughout, to minimize how long the household is disrupted." },
      { name: "Get A Trade By Trade Scope", text: "Export a combined room by room, trade by trade scope so every subcontractor bids off the same document instead of a vague verbal description." },
    ],
  },

  ctaTitle: "Plan Your Whole House Renovation Budget",
  ctaBody: "Use the free rehab calculator room by room to build a combined planning range for the whole house.",
  ctaLabel: "Try The Free Calculator",
};
