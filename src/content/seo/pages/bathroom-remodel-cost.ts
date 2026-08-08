import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/bathroom-remodel-cost",
  tier: "B",
  intent: "What a bathroom remodel actually costs by room type, and why the smallest room in the house is the most expensive per square foot.",

  metaTitle: "What A Bathroom Remodel Actually Costs | Real Designs",
  metaDescription:
    "Bathroom remodel planning ranges for a powder room, hall bath and primary suite, plus why tile labor and waterproofing drive the number.",

  eyebrow: "Bathroom Cost",
  h1: "What A Bathroom Remodel Actually Costs",
  lede:
    "A bathroom is the most expensive room in the house per square foot, and the reason is almost always tile labor and what is found once the demo starts.",

  spaceType: "interior",
  roomType: "bathroom",
  budgetBand: 2,

  intro: [
    "A 45 square foot hall bathroom can cost more per square foot to remodel than a 300 square foot living room, and the reason surprises most homeowners: it has nothing to do with size and everything to do with density of trades. A powder room refresh runs $4,500 to $9,000, a hall bath remodel runs $14,000 to $24,000, and a primary suite renovation runs $28,000 to $55,000 or more. This page walks through those three room types and the two lines, tile labor and waterproofing, that decide which end of each range you land on.",
  ],

  beforePhoto: "bathBefore",
  afterPhoto: "bath",
  beforeCaption: "A dated hall bathroom with original tile, tub and vanity.",
  afterCaption: "The same footprint with new tile, a tub-to-shower conversion and updated fixtures.",

  steps: [
    { title: "Photograph Your Bathroom", text: "One photo captures the fixture layout Reality Lock uses to size tile and plumbing quantities." },
    { title: "Choose Your Room Type", text: "Powder room, hall bath or primary suite, each with a different scope and planning range." },
    { title: "Review The Trade Breakdown", text: "See tile, plumbing and waterproofing priced separately so you know exactly what is driving the total." },
  ],

  showcase: ["scope", "reality-lock", "budget-mode", "grades"],

  scopeTitle: "Hall Bathroom Remodel Scope, 45 SF",
  scopeIntro:
    "A standard hall bath with a tub-to-shower conversion, new tile and no plumbing relocation beyond the shower valve.",
  scopeLines: [
    { item: "Demolition And Disposal", qty: "45 SF", trade: "Demolition", low: 360, high: 540 },
    { item: "Shower Pan And Waterproofing Membrane", qty: "40 SF", trade: "Waterproofing", low: 900, high: 1600 },
    { item: "Tub-To-Shower Conversion, Plumbing", qty: "1 LS", trade: "Plumbing", low: 1600, high: 3200 },
    { item: "Wall Tile, Shower Surround", qty: "80 SF", trade: "Tile", low: 3400, high: 5400 },
    { item: "Floor Tile", qty: "45 SF", trade: "Tile", low: 1900, high: 3100 },
    { item: "Vanity And Countertop", qty: "1 LS", trade: "Cabinetry", low: 900, high: 2000 },
    { item: "Toilet, Sink And Trim", qty: "1 LS", trade: "Plumbing", low: 750, high: 1400 },
    { item: "Exhaust Fan And Lighting", qty: "1 LS", trade: "Electrical", low: 550, high: 1050 },
    { item: "Paint And Drywall Repair", qty: "45 SF", trade: "Paint", low: 320, high: 500 },
    { item: "Permits And Inspection", qty: "1 LS", trade: "General", low: 250, high: 600 },
  ],
  scopeBasis: "Based on a 45 SF hall bathroom, retail finish grade, tub replaced with a tiled shower, no wall relocation.",
  confidence: "Medium",

  sections: [
    {
      h2: "Powder Room, Hall Bath And Primary Suite Are Three Different Jobs",
      body: [
        "A powder room has no shower or tub, which removes the two most labor-intensive fixtures from the scope entirely. It is just a toilet, a sink, flooring, paint and lighting in a room often under 20 square feet, which is why a powder room refresh runs $4,500 to $9,000 and is usually the fastest bathroom project to complete.",
        "A hall bath brings a tub or shower into the scope, which introduces tile, waterproofing and plumbing complexity that a powder room never touches. On a typical 45 square foot hall bath, that pushes the range to $14,000 to $24,000, and the tile and waterproofing lines alone can represent more than half the total.",
        "A primary suite renovation is often larger in square footage, frequently includes a double vanity, a separate shower and tub, and sometimes a layout change to expand the room by borrowing space from an adjacent closet. That combination of scale and complexity puts a primary suite renovation at $28,000 to $55,000 or higher, and it is the tier most likely to include a genuine layout change rather than a like-for-like swap.",
      ],
    },
    {
      h2: "Tile Labor Is The Line That Decides Your Number",
      body: [
        "Wall and floor tile together typically run $42 to $68 per square foot installed, and that per-square-foot figure is dominated by labor, not material. A basic 12 by 24 inch porcelain tile laid in a simple running bond costs far less to install than the same material laid in a herringbone pattern, and a mosaic accent strip or a niche cut into a shower wall adds hours a straight wall never requires.",
        "This is why two bathrooms with an identical fixture list can come in thousands of dollars apart: the tile pattern and the amount of cutting it requires. If you are trying to hit a specific budget, the tile layout is the first thing to simplify, and it is also the line most homeowners underestimate when they are pricing off a photo from a design magazine rather than their own contractor's labor rate.",
      ],
      bullets: [
        "Running bond or straight-lay patterns install fastest and cheapest",
        "Herringbone, chevron and mosaic patterns add labor hours, not material cost",
        "Niches, curbless entries and accent bands each add a separate cut-and-fit step",
        "Large-format tile reduces grout lines but increases waste on small, angled bathroom walls",
      ],
    },
    {
      h2: "Waterproofing Is Not Optional, And It Is Not Visible",
      body: [
        "A tiled shower is only as good as the membrane underneath it, and waterproofing is the line item that never shows up in a finished photo but is the single most common source of costly failure years after the remodel. A properly installed shower pan liner or sheet membrane system, sloped correctly to the drain, is what keeps water inside the shower rather than migrating into the subfloor or the wall cavity behind it.",
        "Skipping or underspecifying waterproofing to save money on a bathroom remodel is one of the worst trades a homeowner can make, because the cost of fixing a failed membrane after the fact, including new tile, new subfloor and sometimes mold remediation, is almost always several times the cost of doing it correctly the first time. Any bid that does not name a specific waterproofing product or method by line item deserves a direct question before you sign it.",
      ],
    },
    {
      h2: "Tub-To-Shower Conversion And The Plumbing Behind It",
      body: [
        "Converting a tub to a walk-in or curbless shower is one of the most requested bathroom updates, especially in primary suites and homes preparing for long-term aging in place. The plumbing side of that conversion, relocating or replacing the valve, adjusting the drain location and sometimes reframing the opening, typically runs $1,600 to $3,200 as its own line, separate from the tile and waterproofing that finish the shower once the rough plumbing is done.",
        "The cost swings most on drain relocation: a shower placed directly over the existing tub drain is straightforward, while a curbless shower that requires lowering the subfloor to create a flush transition adds framing and sometimes structural work that a standard conversion does not need. Ask specifically whether your conversion requires a drain move before assuming the lower end of any range applies.",
      ],
    },
    {
      h2: "Why The Smallest Room Costs The Most Per Square Foot, And What Demo Day Reveals",
      body: [
        "A bathroom packs more trades per square foot than any other room in the house: plumbing, electrical, tile, waterproofing, cabinetry and ventilation all converge in a space that might be 45 square feet total. That density, not the size, is why bathroom remodels routinely price at $300 to $500 per square foot while a bedroom refresh might run $30 to $60. Small rooms do not get a small-room discount on labor, because the crew still has to show up, set up and execute the same number of trade transitions.",
        "Demo day is also where bathrooms produce the most unpleasant surprises of any room type, because they sit directly above living space and involve constant water exposure. Rotted subfloor around a toilet flange, deteriorated framing behind a leaking tub surround, or a cast iron drain line that needs replacing are all common finds once the old tile and fixtures come out, and none of them are visible in a pre-demo estimate. Budgeting a 15 to 20 percent contingency specifically for bathroom jobs, higher than the standard kitchen contingency, is the honest way to plan for what demo day tends to find.",
      ],
    },
  ],

  faqs: [
    {
      q: "How much does a hall bathroom remodel cost?",
      a: "A typical 45 square foot hall bathroom remodel, including a tub-to-shower conversion, new tile and updated fixtures, runs a planning range of roughly $14,000 to $24,000. The tile pattern chosen and whether waterproofing needs full replacement are the two biggest swing factors within that range.",
    },
    {
      q: "Why is a bathroom more expensive per square foot than other rooms?",
      a: "A bathroom concentrates more trades, plumbing, electrical, tile, waterproofing and cabinetry, into a small footprint than any other room in the house. That density of specialized labor, not the square footage, is why bathrooms routinely run $300 to $500 per square foot compared to $30 to $60 for a bedroom refresh.",
    },
    {
      q: "What does a tub-to-shower conversion typically cost?",
      a: "The plumbing portion of a tub-to-shower conversion typically runs $1,600 to $3,200, separate from tile and waterproofing. The cost depends heavily on whether the drain needs to be relocated; a conversion that reuses the existing drain location is significantly cheaper than one requiring a curbless, flush entry.",
    },
    {
      q: "What do contractors usually find when they demo a bathroom?",
      a: "The most common finds are rotted subfloor around the toilet flange, deteriorated framing behind a leaking tub surround, and aging cast iron or galvanized drain lines that need replacing. None of these are visible before demo, which is why bathroom contingencies typically run 15 to 20 percent, higher than most other rooms.",
    },
    {
      q: "Is waterproofing really worth the extra cost in a shower remodel?",
      a: "Yes. A properly sloped membrane system under shower tile is what prevents water from migrating into the subfloor and wall cavity over years of use. Skipping or underspecifying it is one of the costliest mistakes in a bathroom remodel, because repairing a failed membrane later usually costs several times more than doing it correctly the first time.",
    },
  ],

  relatedSlugs: [
    "/contractor-scope-generator",
    "/kitchen-remodel-cost",
    "/free/rehab-cost-calculator",
    "/ai-bathroom-design",
    "/rental-grade-vs-retail-grade",
    "/for-property-managers",
  ],

  ctaTitle: "Get A Trade-By-Trade Bathroom Estimate",
  ctaBody: "Upload a photo of your bathroom and see exactly which trade lines are driving your total.",
  ctaLabel: "Estimate My Bathroom",
};
