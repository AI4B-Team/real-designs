import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/ai-landscape-design",
  tier: "A",
  intent: "Someone wants an AI landscape or backyard design for their actual yard with a real materials budget, not just plant inspiration.",

  metaTitle: "AI Landscape Design With A Real Materials Budget",
  metaDescription: "Upload a yard photo and get an AI backyard design with plants, hardscape and irrigation priced separately as planning ranges.",

  eyebrow: "AI Landscape Design",
  h1: "AI Landscape And Backyard Design With A Real Materials Budget",
  lede: "See your actual yard redesigned with planting beds, patio and lighting, priced by material, not by mood.",

  spaceType: "landscape",
  roomType: "landscape",
  budgetBand: 2,

  intro: [
    "A backyard design is only useful if the plant list, the patio, and the irrigation are priced separately, because they behave like three different budgets stacked in one yard. This tool starts with a photo of your actual yard, keeps the fence lines, grade and existing trees where they are, and generates a landscape design with a scope that splits plant material from hardscape from irrigation and drainage. That separation is the whole point: a $6,000 patio and a $600 planting bed can sit next to each other in the same design and get treated very differently in the budget.",
    "You also get a maintenance figure alongside the build cost, because a landscape design that looks great on delivery day and costs $400 a month to keep alive is not the deal it appears to be on paper.",
  ],

  beforePhoto: "yardBefore",
  afterPhoto: "yardAfter",
  beforeCaption: "Backyard as photographed, existing grass, fence line and bare beds.",
  afterCaption: "Same fence and grade, new patio, planting beds and path lighting.",

  steps: [
    { title: "Upload A Photo Of Your Yard", text: "A photo taken from the back door or a corner of the yard, showing the fence lines and any existing trees, gives the software enough to work with." },
    { title: "Choose A Style And Climate Zone", text: "Select a landscape style and confirm your general climate zone so plant selections are ones that will actually survive where you live." },
    { title: "Get A Split Materials Budget", text: "Review a scope that separates plant material, hardscape, irrigation and lighting, plus an estimated ongoing maintenance cost." },
  ],

  showcase: ["landscape", "reality-lock", "scope", "brief"],

  scopeTitle: "Backyard Redesign Materials Budget",
  scopeIntro: "A mid-range backyard refresh on a roughly 30x40 yard, existing fence and grade kept as is.",
  scopeLines: [
    { item: "Paver Patio", qty: "200 SF", trade: "Hardscape", low: 2400, high: 5000 },
    { item: "Planting Beds, Shrubs And Perennials", qty: "120 SF Bed Area", trade: "Landscaping", low: 800, high: 2200 },
    { item: "Shade Tree, 15 Gallon", qty: "2 Trees", trade: "Landscaping", low: 300, high: 900 },
    { item: "Sod Or Seed Replacement", qty: "600 SF", trade: "Landscaping", low: 400, high: 1200 },
    { item: "Drip Irrigation, Beds And Trees", qty: "1 Zone", trade: "Irrigation", low: 600, high: 1800 },
    { item: "Grading And Drainage Correction", qty: "Allowance", trade: "Grading", low: 500, high: 2500 },
    { item: "Low Voltage Path And Bed Lighting", qty: "10 Fixtures", trade: "Electrical", low: 600, high: 1600 },
    { item: "Mulch And Edging", qty: "120 SF Bed Area", trade: "Landscaping", low: 200, high: 500 },
  ],
  scopeBasis: "Ranges reflect typical regional material and installed labor costs and assume no major slope or drainage rework beyond the stated allowance.",
  confidence: "Medium",

  sections: [
    {
      h2: "Plant Material Behaves Nothing Like Hardscape",
      body: [
        "Plants and hardscape are priced on completely different curves, and most generic landscape estimates blur them together into one misleading number. A shrub costs what it costs at the nursery plus a planting labor fee, and that price is fairly stable no matter which yard it goes into. A patio, by contrast, is priced by the square foot of material plus base preparation, and the base prep, excavation, gravel, compaction, can quietly become the majority of the cost before a single paver is laid.",
        "This tool keeps those two categories separate in the scope so you are not looking at one blended number that hides which part of the project is actually expensive. It is common for a yard with modest planting and an ambitious patio to have 70 percent of its budget sitting in hardscape, and the scope should say that plainly rather than average it out.",
      ],
    },
    {
      h2: "Irrigation And Drainage: The Invisible Budget Line",
      body: [
        "Irrigation and drainage rarely appear in a homeowner's mental picture of a landscape project, because neither one is visible once installed. But skipping them is how a beautiful planting bed dies in its first August or a new patio ends up with standing water after every storm.",
        "The tool includes an irrigation line for any bed or tree work proposed, and a drainage allowance whenever the yard photo suggests grading could be an issue, low corners, water staining near a fence line, a downspout draining directly into a planting area. These are flagged with lower confidence than the plant list itself, since actual drainage behavior depends on rainfall and soil conditions a photo cannot fully capture, but leaving them off the budget entirely is worse than an imperfect estimate.",
      ],
    },
    {
      h2: "Designing For Your Actual Climate Zone",
      body: [
        "A landscape design that ignores climate zone is a design for a plant list that will need replacing within a season. The tool asks for a general climate zone alongside the yard photo and restricts plant selections to species that are realistically hardy there, rather than proposing the same magnolia and boxwood combination regardless of whether the yard is in Phoenix or Portland.",
        "This also affects the maintenance number. A xeriscape-leaning design in an arid zone can carry a lower ongoing water and care cost than a lush cottage garden style forced into the same climate, and the scope reflects that difference rather than treating maintenance as a flat percentage of build cost.",
      ],
      bullets: [
        "Arid or low-water zones: drought tolerant plant selections, lower irrigation footprint",
        "Humid or temperate zones: broader plant palette, higher mowing and pruning frequency",
        "Cold winter zones: hardscape freeze-thaw considerations added to the patio and paver line",
      ],
    },
    {
      h2: "Maintenance Cost Is A Second Number, Not A Footnote",
      body: [
        "Most landscape estimates stop at the installed cost and leave maintenance as an afterthought, which is backwards, because maintenance is the number you pay every year the build cost only happens once. This tool includes an estimated monthly or seasonal maintenance range alongside the installed budget, split by mowing, pruning, and irrigation system upkeep where relevant.",
        "This matters most when comparing two design directions that cost roughly the same to install. A native, low-maintenance planting scheme and a formal, high-maintenance garden can land within a few hundred dollars of each other on installation and diverge sharply over five years of upkeep. Seeing both numbers before you commit avoids the discovery, a season in, that the yard you chose needs more care than you planned to give it.",
      ],
    },
  ],

  faqs: [
    { q: "Can it design around existing trees I want to keep?", a: "Yes, if the trees are visible in your uploaded photo, the design keeps them in place and works the new planting beds and patio layout around their canopy and root zone rather than proposing removal." },
    { q: "Does the budget include permits for a patio or deck?", a: "No, permit costs vary too much by city and by whether the structure is attached to the house to include in a general planning range. Check with your local building department separately for any structure requiring a permit." },
    { q: "How accurate is the plant list for my actual climate?", a: "Plant selections are filtered by the general climate zone you provide, which improves accuracy over a generic list, but local microclimate factors like shade, wind exposure and soil type are not visible from a photo and can still affect what thrives." },
    { q: "Can I get separate designs for the front and back yard?", a: "Yes, run each area through separately with its own photo. Front and back yards usually have different sun exposure and different design goals, curb appeal versus outdoor living, so treating them as one project tends to produce a compromised result for both." },
    { q: "What if my yard has a significant slope?", a: "The tool will flag likely grading or drainage needs based on what is visible in the photo and include an allowance for it, but a meaningful slope should be confirmed on site before finalizing a hardscape budget, since retaining walls can add cost quickly." },
  ],

  relatedSlugs: [
    "/renovation-cost-estimator",
    "/contractor-scope-generator",
    "/for-property-managers",
    "/ai-design-for-house-flippers",
    "/sketch-to-render",
    "/rental-grade-vs-retail-grade",
  ],

  ctaTitle: "Design Your Backyard With A Real Budget Behind It",
  ctaBody: "Upload a photo of your yard and get a landscape design with plant material, hardscape and irrigation priced separately.",
  ctaLabel: "Start My Landscape Design",
};
