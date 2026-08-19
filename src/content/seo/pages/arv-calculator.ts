import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/arv-calculator",
  tier: "B",
  intent: "A flipper wants to know what a property will be worth after rehab, and how much they can safely pay for it today.",

  metaTitle: "ARV Calculator For Flippers",
  metaDescription: "Estimate after repair value as a range, apply the 70 percent rule, and see the holding and selling costs most flippers forget to budget.",

  eyebrow: "ARV Calculator",
  h1: "ARV Calculator For Flippers",
  lede: "After repair value is a range set by comps and rehab quality, not a single number a spreadsheet spits out.",

  spaceType: "interior",
  roomType: "whole home",
  budgetBand: 2,

  intro: [
    "After repair value, ARV, is what a property is likely to sell for once the rehab is complete, and on a distressed property with a $35,000 rehab budget it typically lands as a range spanning $15,000 to $20,000 wide, not a single figure. The 70 percent rule, maximum offer equals 70 percent of ARV minus rehab cost, only works if the ARV going into it is realistic and capped by what comparable sales on that street actually support.",
    "This calculator builds that range from your as is value, planned rehab spend and property condition, then checks it against a comp ceiling if you have one. It also surfaces the costs most first time flippers forget: six to nine months of holding costs and 8 to 10 percent of sale price in selling costs, both of which eat into the margin the 70 percent rule is supposed to protect.",
  ],

  beforePhoto: "kitchenBefore",
  afterPhoto: "kitchenAfter",
  beforeCaption: "As is condition, dated kitchen, no visible structural issues.",
  afterCaption: "Post rehab condition matched to what nearby comps support.",

  steps: [
    { title: "Enter As Is Value & Rehab", text: "Start with a current value or purchase price and your planned rehab budget." },
    { title: "Set Condition & Comp Ceiling", text: "Condition sets the recoup multiple, and a comp ceiling caps the top of the range." },
    { title: "Get ARV & Max Offer", text: "See an ARV range, projected lift, and the maximum offer the 70 percent rule supports." },
  ],

  showcase: ["arv", "scope", "grades", "budget-mode"],

  sections: [
    {
      h2: "The 70 Percent Rule, And Why It Is A Floor Not A Formula",
      body: [
        "The 70 percent rule says a flipper should pay no more than 70 percent of ARV minus the rehab budget. On a property with a $260,000 ARV and a $38,000 rehab, that puts the maximum offer around $144,000. The 30 percent gap is not profit margin sitting untouched, it is the space that absorbs holding costs, selling costs, financing costs and the contingency that always shows up once demolition starts.",
        "The rule breaks the moment the ARV feeding it is optimistic. If the true ARV is $240,000 instead of $260,000, the same 70 percent math should have produced a $128,000 max offer, and a deal bought at $144,000 against that real number is already underwater before a single nail gets pulled. The rule is only as good as the range behind it, which is why ARV needs to be treated as a range with a defensible ceiling, not a single hopeful figure.",
        "Some markets and some deal types support a tighter margin than 70 percent, wholesalers competing for a listing sometimes push to 75 or 80 percent on a fast turn property. That is a risk decision, not a formula error, and it should be made with eyes open on the holding and selling costs below, not by assuming the standard rule does not apply to you.",
      ],
    },
    {
      h2: "Why ARV Is A Range, Not A Number",
      body: [
        "ARV depends on comparable sales, and comps themselves are a range. Three similar sales on the same street in the last six months might show closed prices of $248,000, $256,000 and $271,000 for properties with slightly different lot sizes, finish levels and days on market. Picking the highest comp as your ARV is optimism, not analysis. Picking the lowest is overly conservative and can cause you to pass on a workable deal.",
        "The rehab quality you plan also shifts where in that range you land. A rehab that matches the finish level of the $271,000 sale supports pricing near that top comp. A rehab that lands at rental grade finishes in a retail neighborhood will underperform even the lowest comp, because buyers in that price band expect updated kitchens and bathrooms and will discount a property that falls short.",
        "This calculator expresses ARV as a low and high figure tied to your rehab spend and condition, and lets you enter a comp ceiling to cap the top end. If your rehab budget implies a value above what the street has actually supported in a recent sale, the calculator caps the range there, because no amount of granite countertop changes what a buyer's appraiser will find on the block.",
      ],
    },
    {
      h2: "Improvements That Return, & Improvements That Do Not",
      body: [
        "Kitchens and bathrooms consistently return the highest share of their cost in resale markets because they are the rooms buyers judge a property by on a walkthrough. A well executed kitchen remodel in a retail flip market frequently recoups 80 to 100 percent of its cost in added sale price, sometimes more when it corrects an obviously dated or non functional layout. Fresh paint and flooring recoup well too, because they are the cheapest way to make a property show as move in ready.",
        "Structural and mechanical work, a new roof, updated electrical panel, HVAC replacement, rarely returns its full cost directly in sale price, but it is not optional. Buyers and their inspectors will find deferred maintenance on these systems and either walk away or demand a credit that costs more than doing the work upfront. Think of this spend as removing a deal killer, not as a value add line item.",
        "Over improving for the block is the most common way flippers destroy their own margin. A $70,000 kitchen and primary suite addition on a street where every comp tops out at $290,000 will not sell for $340,000 no matter how good it looks in photos, because the appraisal and the buyer pool are both anchored to the street, not to your finish level.",
      ],
      bullets: [
        "Kitchens and bathrooms: highest return, buyers judge on these first",
        "Paint and flooring: cheap, high return, makes a property show move in ready",
        "Roof, electrical, HVAC: low direct return, but removes inspection deal killers",
        "Additions and top end finishes above the block ceiling: return the least",
      ],
    },
    {
      h2: "Holding Costs & Selling Costs, The Numbers Everyone Forgets",
      body: [
        "Holding costs accumulate every month a property sits between purchase and closed sale: loan interest, property taxes, insurance, utilities and basic maintenance. On a $185,000 property with hard money financing, six to seven months of holding costs commonly runs $8,000 to $13,000, and every month a rehab runs long adds directly to that total. This is why a realistic timeline matters as much as a realistic rehab budget.",
        "Selling costs are the second forgotten line: realtor commissions typically run 5 to 6 percent of sale price, plus closing costs, transfer taxes and any buyer concessions negotiated at the table. Combined, selling costs commonly land at 8 to 10 percent of the final sale price. On a $260,000 resale, that is $20,000 to $26,000 leaving the deal before the flipper sees a dollar of profit.",
        "Both of these belong in the deal math from the start, not as a surprise at closing. A flipper who budgets rehab and purchase price carefully but ignores six months of carrying costs and a 9 percent selling cost hit will consistently find their actual margin runs thousands below what the 70 percent rule implied on paper.",
      ],
    },
  ],

  faqs: [
    {
      q: "What Is A Good ARV To Rehab Cost Ratio?",
      a: "There is no fixed ratio because it depends on purchase price and the market, but as a sanity check, rehab spend that pushes projected value meaningfully above the strongest recent comp on the street is a warning sign, not a target. Let comps set the ceiling, then size rehab to reach it, not exceed it.",
    },
    {
      q: "How Do I Find A Reliable Comp Ceiling?",
      a: "Use closed sales, not active listings, within the same subdivision or block where possible, sold in the last three to six months, with similar square footage and finish level. The highest reliable comp with a similar or better finish level sets a realistic ceiling. Active listings show asking price, not what a buyer actually paid.",
    },
    {
      q: "Does The 70 Percent Rule Work In Every Market?",
      a: "It works as a starting discipline everywhere, but the exact percentage that makes sense varies with financing cost, local holding time and competition for deals. Slower markets with longer holding periods often need a tighter number than 70 percent, while fast turning markets with quick sales sometimes support a slightly higher one.",
    },
    {
      q: "Why Did My ARV Get Capped Below My Rehab's Implied Value?",
      a: "That happens when the finish level implied by your rehab budget would produce a home that outclasses every recent comparable sale on the street. Appraisers and buyer's agents anchor to the block, not to your finish choices, so the calculator caps the range at the strongest defensible comp you enter.",
    },
    {
      q: "Are Holding Costs Included In The 70 Percent Rule?",
      a: "No, the 70 percent rule's 30 percent gap is meant to cover holding costs, selling costs, financing costs and contingency together, it is not pure profit. That is exactly why treating it as a hard formula without checking the underlying costs against your actual timeline leads to thinner margins than expected.",
    },
  ],

  relatedSlugs: [
    "/free/arv-calculator",
    "/free/rehab-cost-calculator",
    "/rehab-cost-calculator",
    "/renovation-cost-estimator",
    "/ai-design-for-house-flippers",
    "/rental-grade-vs-retail-grade",
  ],

  howTo: {
    name: "How To Calculate After Repair Value",
    steps: [
      { name: "Enter As Is Value", text: "Start with the current purchase price or as is appraised value of the property." },
      { name: "Enter Planned Rehab Budget", text: "Add the total planned rehab spend across all rooms and systems." },
      { name: "Select Property Condition", text: "Choose dated, worn or distressed to set the recoup multiple applied to your rehab spend." },
      { name: "Add A Comp Ceiling", text: "Enter the highest reliable closed comparable sale on the street to cap the top of the range." },
      { name: "Review The ARV Range", text: "Check the low and high ARV figures and whether the comp ceiling capped the result." },
      { name: "Apply The 70 Percent Rule", text: "Multiply the low end ARV by 0.7 and subtract rehab cost to see the maximum defensible offer." },
    ],
  },

  ctaTitle: "Know Your Number Before You Offer",
  ctaBody: "Get an ARV range built from your rehab plan and capped by real comps, plus the max offer the 70 percent rule supports.",
  ctaLabel: "Calculate My ARV",
};
