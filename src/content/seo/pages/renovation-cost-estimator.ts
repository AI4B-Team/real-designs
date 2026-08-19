import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/renovation-cost-estimator",
  tier: "B",
  intent:
    "Someone with a limited renovation budget wants to know what each room costs and which room to do first.",

  metaTitle: "Renovation Cost Estimator By Room",
  metaDescription:
    "Compare renovation costs room by room, see what drives each number, and sequence the work when the budget will not cover the whole house.",

  eyebrow: "Renovation Cost Estimator",
  h1: "Renovation Cost Estimator By Room",
  lede: "Kitchens, bathrooms and living rooms are priced by completely different drivers. See what moves each number before you sequence the work.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 2,

  intro: [
    "Renovation cost per room is driven by different things: kitchens are priced mainly by linear feet of cabinetry and countertop material, bathrooms by tile labour and plumbing fixture count, and living rooms by flooring square footage and furnishing. A retail grade kitchen renovation typically runs $19,000 to $35,000, a bathroom $9,000 to $18,000, and a living room refresh $6,000 to $15,000, and those ranges rarely move together when a budget gets tight.",
    "This estimator prices each room separately so you can see which one is actually eating your budget, then helps you sequence the work if you cannot do every room at once. The room by room total is almost always more useful than a single whole house figure, because it tells you where to spend first for the best return on livability or resale.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Original living room, dated flooring and no updated lighting.",
  afterCaption: "Refreshed flooring, paint and furnishing at retail grade.",

  steps: [
    {
      title: "Pick A Room",
      text: "Kitchen, bathroom, living room, bedroom or whole home, each with its own cost drivers.",
    },
    {
      title: "Set Square Footage & Grade",
      text: "Room size and rental, retail or premium grade both scale the total.",
    },
    {
      title: "Compare Rooms Side By Side",
      text: "See which room's renovation cost is the largest share of your total budget.",
    },
  ],

  showcase: ["interior", "scope", "budget-mode", "grades"],

  sections: [
    {
      h2: "Why Each Room Is Priced By A Different Driver",
      body: [
        "A kitchen renovation is priced primarily by linear feet of cabinetry and square feet of countertop, because those two items dominate both material and labour cost. A galley kitchen with 24 linear feet of cabinets and a small island can cost more than a larger open kitchen with fewer cabinet runs, which is why square footage alone is a poor predictor of kitchen cost. Appliances and plumbing fixtures add a fixed allowance on top regardless of layout.",
        "A bathroom is priced mainly by tile labour and fixture count, not by square footage. A small bathroom with a walk in shower featuring a niche, a bench and a glass enclosure can cost more per square foot than a larger bathroom with a standard tub surround, because tile installation hours, not tile material, drive most of the number. Plumbing rough in changes, if the layout moves a drain or supply line, add cost that has nothing to do with room size.",
        "A living room, by contrast, scales closely with square footage because it is dominated by flooring, paint and furnishing, all of which are priced per square foot with minimal fixed cost. This makes living rooms the most predictable room to estimate and the easiest to compare directly against a bedroom of similar size.",
      ],
    },
    {
      h2: "Kitchen: The Most Expensive Room, Priced By Cabinetry Run",
      body: [
        "Cabinetry alone commonly makes up 35 to 45 percent of a kitchen renovation budget at retail grade. Semi custom shaker cabinets run roughly $44 to $66 per linear foot installed, and a typical kitchen needs 20 to 30 linear feet, putting cabinetry cost alone between $880 and nearly $2,000 before countertops, backsplash or appliances are added. This is why two kitchens of similar floor area can price thousands apart based purely on cabinet layout complexity.",
        "Countertops, backsplash tile, flooring, plumbing fixtures and an appliance allowance stack on top, and appliances alone commonly run $2,400 to $4,600 for a mid range set of range, refrigerator, dishwasher and microwave. Add electrical work for under cabinet lighting or additional outlets and a retail grade kitchen renovation on an average sized kitchen typically lands between $19,000 and $35,000.",
      ],
    },
    {
      h2: "Bathroom And Living Room: Small Space, Big Number, And The Reverse",
      body: [
        "Bathrooms defy square footage intuition because tile labour is priced by installed square foot of wall and floor tile combined, commonly $42 to $68 per square foot including labour, and a shower surround alone can add 60 to 100 square feet of tile. A 45 square foot bathroom with a tiled shower, new vanity, toilet and updated lighting typically runs $9,000 to $18,000, a number that surprises homeowners comparing it to a much larger living room costing less.",
        "Living rooms move in the opposite direction: cost scales almost linearly with square footage because flooring, paint and furnishing dominate the line items and none of them carry the fixed plumbing or tile labour cost a bathroom does. A 300 square foot living room at retail grade, including new flooring, paint, trim, lighting and furnishing, typically lands between $10,000 and $16,000, most of it driven by flooring choice and furniture grade rather than construction labour.",
      ],
      bullets: [
        "Kitchen: driven by cabinetry linear feet and appliance allowance",
        "Bathroom: driven by tile labour and fixture count, not floor area",
        "Living room and bedroom: driven by flooring square footage and furnishing grade",
        "Whole home: driven by the sum of kitchen and bathroom allowances plus flooring and paint",
      ],
    },
    {
      h2: "Sequencing Rooms When The Budget Will Not Cover Everything",
      body: [
        "When a renovation budget cannot cover every room, sequence by which room most limits how the whole property shows or functions. For a resale exit, kitchens and bathrooms are almost always first because buyers and appraisers weight them most heavily, and a dated kitchen can suppress a buyer's perception of an otherwise renovated home. For a personal residence being renovated to live in, the room used daily and causing the most friction, often a kitchen with a broken workflow or a bathroom with a failing shower pan, should move first regardless of resale logic.",
        "For a rental exit, sequence differently again: durability upgrades that reduce turnover maintenance, flooring that survives tenant traffic, updated plumbing fixtures that reduce service calls, often return more in reduced operating cost than a fully renovated living room a tenant will not maintain. This is the same reasoning behind choosing rental grade versus retail grade finishes, matched to how the property will actually be used.",
        "A practical sequencing test: for each room, divide the planning range high figure by how much it improves either sale price or monthly rent, and start with the room that produces the best ratio. This keeps sequencing tied to a number rather than to whichever room feels most urgent while walking through the house.",
      ],
    },
  ],

  faqs: [
    {
      q: "Why Does A Small Bathroom Cost More Than A Large Living Room?",
      a: "Bathrooms are priced by tile labour and fixture count, not by floor area, and tile installation is expensive per square foot regardless of how small the room is. A living room is priced mainly by flooring and furnishing, which scale down with a smaller footprint. This is why a 45 square foot bathroom can cost more than a 300 square foot living room refresh.",
    },
    {
      q: "Which Room Should I Renovate First On A Tight Budget?",
      a: "For resale, prioritize kitchens and bathrooms because buyers and appraisers weight them most heavily. For a home you plan to live in, prioritize the room causing the most daily friction. For a rental, prioritize durability upgrades that reduce maintenance calls over cosmetic upgrades a tenant will not preserve.",
    },
    {
      q: "How Much Does A Full Kitchen Renovation Typically Cost?",
      a: "At retail grade, a typical kitchen renovation including cabinetry, countertops, backsplash, flooring, plumbing fixtures and a mid range appliance set commonly lands between $19,000 and $35,000, with cabinetry linear footage as the single largest cost driver.",
    },
    {
      q: "Can I Renovate Rooms In Phases Without Losing Money?",
      a: "Yes, as long as each phase is scoped as a complete unit, finishing flooring, paint and fixtures fully in one room before moving to the next, rather than starting many rooms partway. Partial phases across multiple rooms often cost more overall because trades remobilize to the same site repeatedly.",
    },
    {
      q: "Does Room Size Always Predict Renovation Cost?",
      a: "No. Kitchens and bathrooms are driven by cabinetry linear feet and tile labour respectively, not floor area, so a small kitchen or bathroom with a complex layout can cost more than a larger, simpler one. Living rooms and bedrooms scale more directly with square footage.",
    },
  ],

  relatedSlugs: [
    "/free/rehab-cost-calculator",
    "/free/arv-calculator",
    "/kitchen-remodel-cost",
    "/bathroom-remodel-cost",
    "/rehab-cost-calculator",
    "/rental-grade-vs-retail-grade",
  ],

  howTo: {
    name: "How To Estimate Renovation Cost By Room",
    steps: [
      {
        name: "List Every Room In Scope",
        text: "Write down each room you are considering renovating, kitchen, bathroom, living room, bedroom.",
      },
      {
        name: "Measure Or Estimate Square Footage",
        text: "Get an approximate square footage for each room, and linear footage of cabinetry for any kitchen.",
      },
      {
        name: "Pick A Finish Grade Per Room",
        text: "Assign rental, retail or premium grade to each room based on how the property will be used.",
      },
      {
        name: "Generate A Range For Each Room",
        text: "Run each room through the estimator separately to see its individual low and high total.",
      },
      {
        name: "Rank Rooms By Impact Per Dollar",
        text: "Divide each room's planning range by its impact on sale price or rent to find the best sequencing order.",
      },
      {
        name: "Confirm The Top Priority Rooms With A Contractor",
        text: "Take the highest priority rooms to a contractor for a walkthrough before committing the full budget.",
      },
    ],
  },

  ctaTitle: "Compare Every Room Before You Commit A Budget",
  ctaBody:
    "See a planning range for each room in your home and sequence the work around what actually moves the needle.",
  ctaLabel: "Estimate My Renovation",
};
