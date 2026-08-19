import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/brrrr-calculator",
  tier: "A",
  intent: "Investor wants a BRRRR method calculator to check rehab, refinance and holding numbers before committing to a deal.",

  metaTitle: "BRRRR Calculator: Rehab & Refinance Numbers",
  metaDescription: "Run the BRRRR method calculator, buy, rehab, rent, refinance, repeat, and see a realistic rehab budget, ARV assumption and cash-out refinance number side by side.",

  eyebrow: "BRRRR Calculator",
  h1: "BRRRR Calculator For Rehab & Refinance Numbers",
  lede: "Model the buy, rehab, rent, refinance and repeat cycle against a rehab scope pulled from your actual property, not a generic per square foot guess.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 2,

  intro: [
    "A BRRRR calculator only works if the rehab number in the middle of the equation is real, because every downstream figure, the after repair value, the refinance loan amount, and the cash left in the deal, depends on it. Most BRRRR spreadsheets ask an investor to type in a rehab estimate before they have ever scoped the property, which turns the entire model into a guess dressed up as math. For a typical value-add single family rehab, a moderate cosmetic to mid-level renovation plans in the $25,000 to $55,000 range, while a heavier rehab touching the kitchen, both bathrooms, flooring and mechanicals can run $60,000 to $110,000 or more.",
    "The refinance side of BRRRR is just as sensitive to that number. Lenders typically cash-out refinance at 70 to 75 percent of the new appraised value, so a rehab that pushes the after repair value from $180,000 to $240,000 changes the refinance proceeds by tens of thousands of dollars, but only if the appraiser agrees the rehab actually happened at the scope and quality level assumed. Running the numbers on a rehab scope generated from your real layout, with line items an appraiser and a lender can both recognize, keeps the calculator honest instead of aspirational.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Existing living room, worn flooring and dated finishes, pre-rehab condition.",
  afterCaption: "Same room after a rental-grade rehab, refinished floors, paint and updated lighting.",

  steps: [
    { title: "Set The Property Condition", text: "Dated, worn or distressed sets the rehab baseline instead of an assumed per square foot number." },
    { title: "Set Rehab Level & Budget Band", text: "Choose a rental-grade or retail-grade finish level so the rehab estimate matches the exit strategy, refinance and hold versus a flip and sell." },
    { title: "Compare Rehab Cost To ARV & Refinance", text: "See the rehab line items next to an ARV assumption and a 70 to 75 percent cash-out refinance number to check how much cash stays in the deal." },
  ],

  showcase: ["scope", "budget-mode", "arv", "grades"],


  sections: [
    {
      h2: "Why The Rehab Number Makes Or Breaks BRRRR",
      body: [
        "The BRRRR calculator is only as reliable as its weakest input, and for most investors that is the rehab estimate. Every other figure, the refinance loan amount, the cash left in the deal, the resulting cash-on-cash return, is downstream math once the rehab cost and the after repair value are set. A rehab estimate that is off by $15,000 does not just change the rehab line, it changes the ARV assumption the lender will support, and it changes how much cash actually comes back out at refinance.",
        "This is why experienced BRRRR investors scope a property in detail before running the calculator rather than after. A line item scope, flooring, kitchen, bathrooms, mechanicals, roof, gives a lender or an appraiser something concrete to evaluate, and it gives the investor a realistic sense of the rehab timeline, which matters because holding costs during the rehab and refinance period, taxes, insurance, hard money interest, keep accruing regardless of the model.",
        "Getting the rehab scope right up front is also what separates a repeatable BRRRR strategy from a one-off lucky deal, because the investor who can accurately scope ten properties can accurately calculator ten deals, while the investor guessing at rehab cost is really just gambling with better spreadsheets.",
      ],
    },
    {
      h2: "Rental-Grade Versus Retail-Grade Rehab",
      body: [
        "BRRRR properties are rehabbed to be rented, not sold, which means the finish level should be durable and tenant-appropriate rather than aspirational. Rental-grade LVP flooring, mid-range cabinets, and durable paint typically cost 20 to 35 percent less than the retail-grade finishes an investor would choose if flipping the same property for a sale to an owner-occupant.",
        "Overspending on retail-grade finishes in a rental is one of the most common ways a BRRRR deal underperforms, because the extra cost does not translate into meaningfully higher rent, but it does eat directly into the cash left in the deal after refinance. The rehab scope should match the exit strategy, and for a hold and refinance strategy that means rental-grade materials chosen for durability under tenant turnover, not showroom appeal.",
      ],
      bullets: [
        "Rental-grade: LVP flooring, laminate or stock cabinets, durable paint, standard fixtures",
        "Retail-grade: hardwood or premium tile, semi-custom cabinets, designer fixtures",
        "Match the rehab grade to the hold strategy, not to what would sell fastest",
      ],
    },
    {
      h2: "The Refinance Side Of The Calculator",
      body: [
        "Most cash-out refinance lenders will lend 70 to 75 percent of the new appraised value on an investment property, and many require a seasoning period, often six months of ownership, before they will refinance based on the improved value rather than the purchase price. This seasoning requirement is one of the most overlooked variables in a BRRRR calculator, because it directly affects how long hard money or private money financing needs to be carried, and that carrying cost compounds every month of delay.",
        "The gap between the total cash invested, purchase price plus rehab plus holding costs, and the cash-out refinance proceeds is the number that determines whether a BRRRR deal actually returns most of the investor's capital or leaves a large chunk permanently tied up. A rehab scope that an appraiser can verify against comparable rentals in the area gives the refinance appraisal a much better chance of hitting the ARV assumption used in the original calculator.",
      ],
    },
    {
      h2: "Holding Costs That The Calculator Should Not Skip",
      body: [
        "Between acquisition and the cash-out refinance, a BRRRR property generates no rental income but does generate real carrying costs: property taxes, insurance, utilities to keep the rehab crew working, and interest on any hard money or private money used for acquisition and rehab. On a typical rehab timeline of two to four months plus a six month seasoning period before refinance, holding costs commonly add $6,000 to $15,000 to the true cost of the deal.",
        "Investors who build a BRRRR calculator around only purchase price, rehab, and ARV routinely underestimate the deal's real cash requirement because they leave out this holding period entirely. Building the rehab timeline into the calculator, not just the rehab dollar amount, is what turns the tool from a rough sketch into something closer to an actual underwriting model.",
      ],
    },
  ],

  faqs: [
    { q: "What is a good rehab budget for a BRRRR deal?", a: "A moderate rental-grade rehab on a typical single family property plans in the $25,000 to $55,000 range, while a heavier rehab touching kitchen, bathrooms, flooring and mechanicals can run $60,000 to $110,000 or more, depending on square footage and condition." },
    { q: "How much of the ARV can I refinance out at?", a: "Most investment property cash-out refinance lenders lend 70 to 75 percent of the new appraised value, and many require a seasoning period, commonly six months of ownership, before they will lend against the post-rehab value." },
    { q: "Should I rehab a BRRRR property to rental-grade or retail-grade finishes?", a: "Rental-grade finishes, durable LVP flooring, stock or laminate cabinets and standard fixtures, are typically the right call for a hold and rent strategy, since they cost 20 to 35 percent less than retail-grade finishes without meaningfully reducing achievable rent." },
    { q: "Why does my BRRRR calculator always show less cash-out than expected?", a: "This usually comes from an optimistic ARV assumption, an underestimated rehab scope, or ignoring holding costs during the rehab and seasoning period. All three compress the actual cash-out refinance proceeds compared to a rough spreadsheet estimate." },
    { q: "How long does the BRRRR cycle typically take?", a: "A full cycle, buy, rehab, rent, refinance, commonly takes eight to twelve months: two to four months for the rehab, one to two months to place a tenant, and a lender's seasoning period, often six months, before the cash-out refinance can close." },
    { q: "Does a rehab scope tool help with the refinance appraisal?", a: "A line item rehab scope gives an appraiser concrete, verifiable improvements, flooring, cabinetry, mechanicals, to point to when supporting the after repair value, which improves the odds the refinance appraisal comes in at or near the ARV assumption used in the calculator." },
  ],

  relatedSlugs: [
    "/arv-calculator",
    "/rehab-cost-calculator",
    "/ai-design-for-house-flippers",
    "/rental-grade-vs-retail-grade",
    "/renovation-cost-estimator",
    "/for-contractors",
  ],

  howTo: {
    name: "How To Run BRRRR Numbers With A Rehab Scope",
    steps: [
      { name: "Set The Property Condition", text: "Use the free rehab calculator to set condition and finish grade so the rehab total reflects more than a per square foot guess." },
      { name: "Set The Finish Level To Rental-Grade", text: "Choose a rental-grade budget band so the rehab estimate matches materials appropriate for a hold and rent strategy." },
      { name: "Total The Rehab Line Items", text: "Add up the scoped line items, flooring, kitchen, bathrooms, mechanicals, roof, to get a defensible rehab total." },
      { name: "Estimate The After Repair Value", text: "Compare the scoped rehab against recent comparable rental sales or refinance appraisals in the immediate area." },
      { name: "Apply A 70 To 75 Percent Refinance Assumption", text: "Multiply the ARV by 70 to 75 percent to estimate likely cash-out refinance proceeds from a lender." },
      { name: "Subtract Total Cash Invested", text: "Compare refinance proceeds against purchase price, rehab cost and holding costs to see how much cash stays in the deal." },
    ],
  },

  ctaTitle: "Scope Your Rehab & Run The Numbers",
  ctaBody: "Use the free rehab and ARV calculators to build a rental-grade rehab number for your BRRRR math.",
  ctaLabel: "Try The Free Calculators",
};
