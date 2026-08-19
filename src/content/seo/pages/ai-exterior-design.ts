import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/ai-exterior-design",
  tier: "A",
  intent:
    "Someone wants a priced AI exterior design and curb appeal makeover for a house they own, not just a rendering.",

  metaTitle: "AI Exterior Design & Curb Appeal, Priced",
  metaDescription:
    "Upload a front elevation photo and get an AI exterior design with paint, siding, roof and door choices priced as a planning range.",

  eyebrow: "AI Exterior Design",
  h1: "AI Exterior Design & Curb Appeal, Priced Like A Job",
  lede: "See a new paint scheme, siding, roof and front door on your actual house, with dollars attached to each choice.",

  spaceType: "exterior",
  roomType: "exterior",
  budgetBand: 2,

  intro: [
    "Curb appeal is one of the few renovation categories where the return is well documented and the spend is small relative to interior work. Paint, a front door, and cleaned-up landscaping routinely return more of their cost at resale than a kitchen remodel does, because they change the first impression, not the square footage. This tool takes a front elevation photo of your actual house and generates exterior design options, paint colors, siding, roof, door, trim, with a planning range for each so you know what the look costs before you commit to it.",
    "It is not a rendering service. Every design comes back with a scope broken into paint, roof, siding, and hardscape line items, because those trades price differently and most homeowners end up doing them in phases anyway.",
  ],

  beforePhoto: "exteriorBefore",
  afterPhoto: "exteriorAfter",
  beforeCaption: "Front elevation as photographed, original siding, roof and door.",
  afterCaption: "Same structure, new paint scheme, front door and trim, roof unchanged.",

  steps: [
    {
      title: "Upload A Front Elevation Photo",
      text: "Stand across the street or in the driveway and photograph the full front of the house, including the roofline and the driveway if possible.",
    },
    {
      title: "Test Paint, Siding & Door Options",
      text: "Generate a few exterior looks against your actual roofline and window placement, not a generic house shape.",
    },
    {
      title: "Get A Priced Curb Appeal Scope",
      text: "Receive a scope broken out by trade, paint, roof, siding, door and landscaping, so you can phase the work or hand it to a contractor.",
    },
  ],

  showcase: ["exterior", "reality-lock", "scope", "brief", "arv"],

  sections: [
    {
      h2: "The Economics Of Curb Appeal",
      body: [
        "Curb appeal spending behaves differently from interior remodeling spending because the cost basis is smaller and the audience is broader. Every buyer who drives by sees the exterior whether or not they book a showing. That is why a fresh coat of paint and a new front door consistently show up near the top of return-on-cost lists, they touch the widest audience for the least money.",
        "The mistake most homeowners make is treating the exterior as one project instead of several trades stacked on top of each other. Paint is cheap and fast. Roofing and siding are expensive and slow. This tool keeps those separated in the scope so you can paint this spring and defer the roof to next year without losing track of either number.",
      ],
    },
    {
      h2: "What Paint & A Front Door Actually Return",
      body: [
        "Paint and a front door are the two items most commonly cited as high-return exterior work, and the reason is straightforward: they are the two elements a buyer's eye lands on in the first three seconds, and they are inexpensive relative to structural work. A repaint on a modest single story house typically runs a few thousand dollars, well under the cost of a roof or a siding job, which is part of why the return percentage looks favorable.",
        "That does not mean paint color is a minor decision. Color choice is one of the few free variables in a renovation, so the tool generates several palette options against your actual roofline and trim before you spend anything, since repainting a repaint is money nobody wants to spend twice.",
      ],
    },
    {
      h2: "Roof & Siding Allowances, Handled Honestly",
      body: [
        "Roof and siding are the two line items in an exterior scope that a photo genuinely cannot price with confidence, because condition matters more than appearance. A roof that looks fine from the street can have five years of life left or fifteen, and that difference is a five figure swing.",
        "For that reason, roof and siding line items in this tool are always shown as an allowance with a wider range and a lower confidence label, rather than a tight number dressed up to look precise. If your project depends on the roof, treat that line as a placeholder to confirm with an inspection, not as a planning figure to build a budget around.",
      ],
      bullets: [
        "Paint, doors, lighting: tight ranges, high confidence, priced from the photo alone",
        "Landscaping and hardscape: moderate ranges, medium confidence, quantity estimated from the elevation",
        "Roof and siding condition: wide allowance, low confidence, needs a physical inspection",
      ],
    },
    {
      h2: "Why Exterior Square Footage Is Measured Differently",
      body: [
        "Interior renovation costs are usually priced per square foot of floor area. Exterior costs are priced per square foot of elevation, the vertical wall and roof surface a painter or a siding crew actually has to cover, not the footprint of the house. A single story ranch and a two story colonial can have identical floor square footage and very different paint bills, because the two story house has roughly twice the wall surface to coat.",
        "This tool estimates elevation area from the photo geometry rather than asking you for your home's floor plan square footage, because floor square footage is close to useless for pricing an exterior job. If you have seen a painting estimate that seemed disconnected from your home's listed size, this is usually why.",
      ],
    },
  ],

  faqs: [
    {
      q: "Do I need photos from multiple angles?",
      a: "One clear front elevation photo is enough to generate a design and a paint and trim estimate. If your house has a distinct side or rear feature you want addressed, a second photo helps, but it is not required to start.",
    },
    {
      q: "Can the tool tell me if I need a new roof?",
      a: "No. Roof condition depends on physical inspection, not photo analysis. The scope includes a roof allowance so the budget has a placeholder, but confirm actual condition with a roofer before relying on that number.",
    },
    {
      q: "Will the paint colors it shows me match real paint brands?",
      a: "Color options are generated to be close matches to common exterior paint lines, and the scope notes them as closest match rather than an exact manufacturer code, since lighting and photo color can shift slightly from the can.",
    },
    {
      q: "How is this different from a general contractor estimate?",
      a: "This gives you a planning range across the whole exterior scope before you call anyone, so you know roughly what paint versus siding versus a new door costs relative to each other. A contractor estimate is still the number to act on for actual bidding.",
    },
    {
      q: "Does it factor in HOA rules or paint color restrictions?",
      a: "No, the tool does not know your HOA's approved palette. If your neighborhood has color or material restrictions, check those separately before finalizing a design generated here.",
    },
  ],

  relatedSlugs: [
    "/rehab-cost-calculator",
    "/arv-calculator",
    "/ai-design-for-house-flippers",
    "/for-real-estate-agents",
    "/mls-photo-rules",
    "/rental-grade-vs-retail-grade",
  ],

  ctaTitle: "Price Your Curb Appeal Before You Paint",
  ctaBody:
    "Upload a front elevation photo and get exterior design options with a paint, door and landscaping budget attached.",
  ctaLabel: "Start My Exterior Design",
};
