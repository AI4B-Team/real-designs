import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/for-property-managers",
  tier: "C",
  intent: "Property managers standardizing turn budgets and finishes across a portfolio, and needing owner sign-off documentation for capital work.",

  metaTitle: "AI Turn Budgeting For Property Managers",
  metaDescription: "Standardize finishes and price unit turns across your portfolio with a documented condition record and owner-ready planning ranges.",

  eyebrow: "For Property Managers",
  h1: "Standardize The Turn Across Every Unit You Manage",
  lede: "Turn move-out photos into a documented condition record, a standardized finish package, and a planning-range budget you can send an owner for approval, without reinventing the scope for every unit.",

  spaceType: "interior",
  roomType: "whole home",
  budgetBand: 1,

  intro: [
    "Managing turns across a portfolio breaks down when every unit gets a different finish decision made on the fly by whichever maintenance tech or vendor happens to be on site, which is how a fifty-unit portfolio ends up with a dozen different flooring types and no consistent record of what condition each unit was actually in at move-out.",
    "Reality Lock lets you photograph a unit at move-out, generate a standardized turn design at the finish level your portfolio policy specifies, and produce a scoped budget with a planning range for owner approval, all tied to a photo record of the unit's actual condition rather than a verbal description in an email thread.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Unit condition at move-out, documented before turn",
  afterCaption: "Standardized turn finish applied consistently across the portfolio",

  steps: [
    { title: "Document Condition At Move-Out", text: "Photograph the unit as it sits, creating a timestamped condition record before any turn work begins." },
    { title: "Apply Your Standard Finish Package", text: "Generate the turn design against your portfolio's standard finish level, not a one-off decision per unit." },
    { title: "Send Owners A Scoped, Priced Turn Plan", text: "Attach the planning-range budget to the condition photos for owner approval, with a consistent format across every unit and every owner." },
  ],

  showcase: ["grades", "scope", "brief", "interior"],


  sections: [
    {
      h2: "Turn Budgets That Do Not Vary By Which Tech Showed Up",
      body: [
        "Inconsistent turn budgets across a portfolio are rarely a pricing problem, they are a specification problem. Without a documented standard, one turn gets granite because the tenant complained, and the next gets laminate because nobody asked. Reality Lock gives you a repeatable finish package to generate against for every unit, so the scope going out for pricing is the same shape every time, whether the unit is a one-bedroom or a four-bedroom.",
        "That repeatability is what makes portfolio-level budgeting possible in the first place. When every turn scope follows the same structure, you can actually compare cost per square foot across units and vendors, instead of comparing numbers that were never built the same way.",
      ],
    },
    {
      h2: "Standardizing Finishes Without A Design Meeting Per Unit",
      body: [
        "Property managers do not have the time to make a fresh design decision for every vacant unit, and they should not need to. Once a standard finish level is set for a portfolio tier, whether that is a value-tier duplex or a mid-market apartment building, the same finish package can be applied unit after unit, with the photo-based redesign confirming it fits each unit's actual layout rather than assuming a one-size template works everywhere.",
        "This also protects against the slow creep where individual maintenance staff start substituting materials on hand, which is how portfolios end up with inconsistent finishes that complicate future turns and bulk purchasing.",
      ],
      bullets: [
        "One finish standard applied across units instead of ad hoc choices",
        "A consistent scope format for every owner approval request",
        "Easier bulk purchasing when the same materials repeat across units",
      ],
    },
    {
      h2: "Owner Approvals That Do Not Stall On A Missing Number",
      body: [
        "Owners approve capital work faster when they can see both the condition that justifies it and a planning-range cost in the same document, instead of a phone call describing damage they cannot see. Attaching the move-out condition photos to the scoped turn budget gives owners the context to approve quickly, particularly for owners who are not local and rely entirely on your documentation to make the call.",
        "For larger capital items inside a turn, like a full kitchen replacement rather than a cosmetic refresh, the same documentation supports a capital expenditure conversation that is separate from routine turn costs and easier for an owner to plan for across a fiscal year.",
      ],
    },
    {
      h2: "Documenting Condition For Deposit & Liability Disputes",
      body: [
        "A timestamped photo record at move-out, tied to the generated turn scope, becomes useful well beyond the turn itself. When a security deposit deduction is disputed, having a documented before condition alongside an itemized scope of the work performed gives you a clearer record than a maintenance log entry written after the fact.",
        "This same documentation habit, applied consistently across every unit turn, also builds a longitudinal record of a property's condition over time, which is useful when planning larger capital projects like roof or HVAC replacement cycles across a portfolio.",
      ],
    },
  ],

  faqs: [
    {
      q: "Can this replace our maintenance vendor bids?",
      a: "No. It produces a planning-range budget built from national averages to standardize your scope and speed up owner approval, but the firm price for a turn should still come from your local vendors or in-house crew. Treat the generated range as the starting point for a bid request, not the final number.",
    },
    {
      q: "How does this help with owner approvals specifically?",
      a: "Owners approve capital and turn spending faster when they can see documented unit condition and a scoped, priced plan in one place. Attaching move-out photos to a line-itemed turn scope gives remote or passive owners the context to approve without a phone call walking them through the damage.",
    },
    {
      q: "Can we apply the same finish standard across different unit types?",
      a: "Yes. You set a finish package once for a portfolio tier, and the photo-based redesign applies it to each unit's actual layout, whether that is a studio or a three-bedroom, so the standard holds without a separate design decision per unit.",
    },
    {
      q: "Does this help with tenant deposit disputes?",
      a: "The timestamped move-out condition photos, kept alongside the turn scope performed, create a documented record that is more defensible than an after-the-fact maintenance note. It does not replace your state's specific deposit disclosure requirements, which you should continue to follow separately.",
    },
    {
      q: "Is this useful for a portfolio of only a few units, or only large ones?",
      a: "It scales either direction. Smaller portfolios benefit from having a repeatable scope format instead of building one from scratch each turn, while larger portfolios benefit most from the consistency it enforces across many units and multiple vendors or maintenance staff.",
    },
  ],

  relatedSlugs: [
    "/renovation-cost-estimator",
    "/rental-grade-vs-retail-grade",
    "/rehab-cost-calculator",
    "/rehab-cost-calculator",
    "/ai-kitchen-design",
    "/ai-bathroom-design",
  ],

  ctaTitle: "Standardize Your Next Turn Before It Starts",
  ctaBody: "Photograph the unit, apply your standard finish package, and send owners a documented, priced turn plan.",
  ctaLabel: "Build A Turn Plan",
};
