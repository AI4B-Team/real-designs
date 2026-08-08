import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/for-landlords",
  tier: "C",
  intent: "Small and mid size landlords planning a rental turn who need to know which upgrades raise achievable rent and which just cost money.",

  metaTitle: "Rental Turn Planning For Landlords",
  metaDescription: "Plan a durable rental turn, see which upgrades actually raise rent, and get a planning range before you spend a day of vacancy.",

  eyebrow: "For Landlords",
  h1: "Turn A Unit Fast Without Guessing At Finishes",
  lede: "See a photo-real version of your unit in a durable rental finish, know which upgrades are likely to move achievable rent, and get a planning range before you commit a dollar or another day of vacancy.",

  spaceType: "interior",
  roomType: "bedroom",
  budgetBand: 0,

  intro: [
    "If you own a handful of doors, a vacant unit is not a line item on a portfolio report, it is a mortgage payment coming due with no rent behind it. You do not have a maintenance department, a standard finish spec, or a capital budget meeting. You have a bedroom that needs paint, maybe flooring, and a decision you have to make yourself, usually while also holding down a day job.",
    "Reality Lock lets you photograph the room as it sits and see it redesigned in a rental-grade finish, so you can decide what actually needs doing before you call anyone, and get a planning range for the work so you are not walking into a conversation with a painter or a flooring guy with no idea what a fair number looks like.",
  ],

  beforePhoto: "bedroomBefore",
  afterPhoto: "bedroomAfter",
  beforeCaption: "Bedroom as it sits between tenants, worn but not damaged",
  afterCaption: "Same room in a durable rental finish, ready to photograph and list",

  steps: [
    { title: "Photograph The Room Between Tenants", text: "Take the room as it is, scuffed walls and all, without staging anything first." },
    { title: "See A Durable Rental Finish Applied", text: "Generate a version of the room finished for durability and fast turnaround, not a magazine redesign." },
    { title: "Get A Planning Range Before You Call Anyone", text: "Use the scoped range to sanity check quotes from a painter or flooring installer before you agree to a price." },
  ],

  showcase: ["grades", "budget-mode", "brief", "interior"],

  scopeTitle: "Sample Single Unit Turn Scope",
  scopeIntro: "A representative scope for one bedroom and adjoining living space between tenants, sized for a small landlord doing a normal turn rather than a full renovation.",
  scopeLines: [
    { item: "Wall And Trim Paint, Bedroom", qty: "300 SF", trade: "Painting", low: 280, high: 550 },
    { item: "LVP Flooring, Bedroom", qty: "150 SF", trade: "Flooring", low: 450, high: 900 },
    { item: "Closet Door And Hardware Repair", qty: "1 Closet", trade: "Carpentry", low: 120, high: 300 },
    { item: "Blind Replacement", qty: "2 Windows", trade: "Fixtures", low: 80, high: 180 },
    { item: "Outlet And Switch Cover Swap", qty: "4 Points", trade: "Electrical", low: 40, high: 120 },
    { item: "Deep Clean And Carpet Or Floor Detail", qty: "1 Room", trade: "Cleaning", low: 100, high: 220 },
  ],
  scopeBasis: "Ranges reflect national averages for a single room turn at durable rental grade finish, before local labor pricing is applied.",
  confidence: "Medium",

  sections: [
    {
      h2: "A Vacant Room Costs You Every Day It Sits Empty",
      body: [
        "The real cost of a slow turn is not the paint or the flooring, it is the vacancy days stacked up while you decide what to do. A landlord with one or two rental properties often loses more to a two week delay in deciding on finishes than to the finishes themselves, because rent stops the day the last tenant leaves and does not resume until a new one signs.",
        "Reality Lock shortens that decision window. Instead of standing in an empty bedroom trying to picture new flooring against a wall color you have not chosen yet, you see the finished room before any work starts, which means you can get quotes moving and a listing photo shoot scheduled on the same week instead of the same month.",
        "That speed matters more for a landlord with four doors than for a firm with four hundred, because you do not have a backlog of other units carrying the vacancy while this one sits. Every empty day comes straight out of your own return.",
      ],
    },
    {
      h2: "Which Upgrades Raise Rent And Which Just Cost Money",
      body: [
        "Not every upgrade you can make to a rental bedroom will move the rent a tenant is willing to pay for it. Fresh paint and clean, durable flooring consistently make a unit rent faster and sometimes at a slightly higher number, because they read as cared for in a listing photo. A built-in closet system or premium light fixtures rarely move the needle the same way in a rental, because most tenants are comparing your unit to three others in the same rent band, not evaluating it like a buyer would.",
        "Seeing the room redesigned before you spend anything gives you a chance to ask the harder question honestly: does this specific change look different enough in the finished photo to justify the cost, or does it just look tidier. A lot of landlord money gets spent on upgrades that make an owner feel better about the unit without actually changing what a tenant will pay.",
      ],
      bullets: [
        "Paint and flooring tend to earn back their cost in faster leasing",
        "Cosmetic upgrades rarely move rent in a normal tenant pool",
        "A finished-room photo helps you judge the difference before spending",
      ],
    },
    {
      h2: "One Finish Standard Across A Few Units Keeps Repairs Cheap",
      body: [
        "You do not need a portfolio-wide finish policy to benefit from picking one paint color and one flooring product and sticking with it across your units. When every unit uses the same LVP and the same wall color, a scuff or a chipped plank in one unit gets patched with material you already have on hand, instead of you tracking down a discontinued color match three years later.",
        "This matters more for a small landlord than for a large management company, because you are usually the one doing the patch yourself or paying a handyman by the hour to figure it out. Standardizing finishes across even three or four units turns a repair from a shopping trip into a five minute fix.",
      ],
    },
    {
      h2: "Match The Finish To What Tenants In That Rent Band Actually Expect",
      body: [
        "A unit renting at the lower end of your local market does not need the same finish as one competing at the top of the range, and overspending on finish for the rent band you are actually in does not translate into rent a tenant in that band will pay. A tenant looking at units in a modest rent range is comparing your unit to others with laminate counters and builder grade fixtures, not comparing it to a renovated flip.",
        "Reality Lock lets you generate the room at a finish level that matches your actual rent band, so you can see whether a mid-tier upgrade looks meaningfully better in that context before spending toward a finish level the rent in your market will never recover.",
      ],
    },
    {
      h2: "A Listing Photo That Actually Rents The Unit Fast",
      body: [
        "Most vacancy delay after the physical turn is done comes from a bad listing photo, a dim, cluttered, or half finished looking room that makes a prospective tenant scroll past without a second look. A clear, well lit photo of the finished room gives you something worth posting the day the work wraps, instead of waiting for a separate photography appointment.",
        "For a landlord managing this alone, having the finished-room image ready before the last coat of paint is even fully dry means you can have a listing live and taking inquiries the same day the unit is turn ready, which is often the single biggest lever on total vacancy days.",
      ],
    },
  ],

  faqs: [
    {
      q: "Is this going to tell me what my unit will actually rent for?",
      a: "No. It shows you a redesigned version of the room in a chosen finish level and a planning range for the work, not a rent estimate or an appraisal. You should still check comparable listings in your area for actual achievable rent, this tool is for deciding what work is worth doing before you start.",
    },
    {
      q: "I only have a couple of rental units, is this overkill for me?",
      a: "It is built for exactly that case. A landlord with two or three units does not need a portfolio finish policy, but still benefits from seeing the room finished before spending, getting a planning range to check contractor quotes against, and having a photo ready the day the work is done, all without a design background.",
    },
    {
      q: "Will fancier finishes get me more rent for a modest unit?",
      a: "Usually not by much. Tenants in a given rent band compare your unit to others in the same band, and a finish level well above what the market expects rarely earns back its cost through higher rent. Seeing the finished room at a couple of different finish levels helps you judge whether an upgrade is worth it before spending on it.",
    },
    {
      q: "How does this help me avoid a bad contractor quote?",
      a: "The scoped planning range gives you a reasonable ballpark drawn from national averages for the specific work in your turn, so if a quote comes back well above or suspiciously below that range, you know to ask questions before agreeing. It is a sanity check for a conversation, not a substitute for getting your own local quotes.",
    },
    {
      q: "Can I use the same finish choice across all my units?",
      a: "Yes, and doing so tends to save money over time. Picking one paint color and one flooring product and reusing them across your units means future patch repairs use material you already know and can often already have on hand, instead of matching a discontinued product from a single unit's original turn.",
    },
  ],

  relatedSlugs: [
    "/rental-grade-vs-retail-grade",
    "/rehab-cost-calculator",
    "/renovation-cost-estimator",
    "/for-property-managers",
    "/mls-photo-rules",
    "/ai-interior-design",
  ],

  ctaTitle: "See The Turn Before You Spend A Dollar",
  ctaBody: "Photograph the room, see it in a durable rental finish, and get a planning range to check against your quotes.",
  ctaLabel: "Plan This Turn",
};
