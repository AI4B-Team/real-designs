import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/virtual-staging-disclosure-rules",
  tier: "D",
  intent: "Someone staging a listing photo wants to know what disclosure language they need and what edits cross the line.",

  metaTitle: "Virtual Staging Disclosure Rules By State",
  metaDescription: "General guidance on virtual staging disclosure categories, compliant captions, and what counts as material misrepresentation. Not legal advice.",

  eyebrow: "Compliance",
  h1: "Virtual Staging Disclosure Rules By State",
  lede: "General guidance on what a compliant listing caption usually needs to say, and where the line between staging and misrepresentation typically sits.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 0,

  intro: [
    "Rules for disclosing virtually staged photos vary by state and by individual MLS, and they change over time, so nothing on this page should be read as legal advice or as a summary of any specific statute or MLS rule. What follows is general information about the categories of rule that commonly show up: labeling requirements for staged images, restrictions on removing permanent features, and requirements that furnishings shown in a photo be identified as virtual. Before you publish a listing, confirm the current wording your own MLS requires and check with your state's real estate licensing body, because the language that satisfies one board may not satisfy another.",
    "The short version most agents land on is this: staging furniture into an empty room is broadly treated differently from altering the structure of the room itself, and a caption that says the image has been virtually staged is a reasonable starting point in most markets. Whether that caption needs to appear on the photo itself, in the listing remarks, or both is exactly the kind of detail that differs by MLS, which is why you confirm it locally rather than assume.",
  ],

  beforePhoto: "stageEmpty",
  afterPhoto: "stageStaged",
  beforeCaption: "Vacant room, no furniture, structure unchanged.",
  afterCaption: "Same room virtually staged, disclosure label attached to the file.",

  steps: [
    { title: "Identify The Edit Type", text: "Decide whether the change adds furnishings, alters cosmetics, or touches a permanent feature of the room." },
    { title: "Apply A Disclosure Label", text: "Attach language identifying the image as virtually staged or edited before it goes to the MLS." },
    { title: "Confirm With Your Local MLS", text: "Check current wording and placement requirements with your own board before publishing." },
  ],

  showcase: ["staging", "mls", "reality-lock", "declutter"],

  scopeTitle: "Sample Per-Listing Disclosure Cost Table",
  scopeIntro: "Planning range for staging and labeling a typical single family listing, medium confidence because MLS-specific labeling requirements vary.",
  scopeLines: [
    { item: "Base Listing Photography", qty: "20 Photos", trade: "Photography", low: 150, high: 350 },
    { item: "Virtual Staging Per Room", qty: "4 Rooms", trade: "Staging", low: 120, high: 320 },
    { item: "Disclosure Label Application", qty: "24 Photos", trade: "Labeling", low: 0, high: 60 },
    { item: "Caption & Remarks Review", qty: "1 LS", trade: "Compliance", low: 0, high: 75 },
    { item: "Reshoot Allowance", qty: "1 Visit", trade: "Photography", low: 100, high: 250 },
    { item: "MLS Resubmission Fee", qty: "1 LS", trade: "Admin", low: 0, high: 50 },
    { item: "Brokerage Compliance Review", qty: "1 LS", trade: "Compliance", low: 0, high: 100 },
  ],
  scopeBasis: "Typical vendor pricing for staging and labeling a single listing. Confirm your own MLS's specific labeling requirement before publishing.",
  confidence: "Medium",

  sections: [
    {
      h2: "Categories Of Rule You Will Commonly Encounter",
      body: [
        "Most MLS and state frameworks touching virtual staging fall into a small number of categories rather than a single unified rule. There is usually a labeling requirement, some form of language that must appear identifying an image as staged or edited. There is usually a prohibition, explicit or implied, on removing or altering permanent features of the property, meaning the walls, windows, flooring and layout shown in the photo need to reflect what a buyer will actually walk into. There is often a separate rule governing brokerage advertising more broadly, which can layer additional requirements on top of whatever the MLS itself requires for photo submission.",
        "These categories exist because the underlying concern is consistent even where the specific wording is not: a buyer should not be misled about what the property physically is. A caption requirement solves for buyers seeing an image without context. A permanent-feature rule solves for staging crossing over into changing the product itself. An advertising rule solves for the same photo appearing in more places than just the MLS listing, each of which may have its own disclosure expectations.",
        "Because these categories are common does not mean the specific requirement is common. Some boards want the disclosure on the photo itself, some want it only in remarks, some want a specific phrase, and some leave the wording to the listing agent's judgment. That gap between category and specific requirement is exactly why this page stops at describing the shape of the rule and tells you to confirm the wording locally.",
      ],
      bullets: [
        "Labeling requirements for staged or edited images",
        "Prohibitions on removing or altering permanent features",
        "Requirements to identify furnishings as virtual",
        "Brokerage-level advertising rules layered on top of MLS rules",
      ],
    },
    {
      h2: "Writing A Caption That Holds Up",
      body: [
        "A workable starting point for a caption is plain, factual language stating that the image has been virtually staged or digitally altered, placed somewhere a viewer will actually see it before forming an impression of the room. Vague language buried at the bottom of a long remarks field does less work than a short, direct line near the top. Some agents also add the disclosure directly onto the image file itself, as a small watermark or caption bar, so the label travels with the photo even if it is copied outside the MLS onto a third party site.",
        "What the caption should avoid is language that undersells the edit, phrasing that makes staging sound like a minor enhancement rather than an addition of furniture that does not exist in the room. It should also avoid trying to do double duty as marketing copy. A caption's job in this context is disclosure first, and readability by a buyer's agent or a buyer scrolling quickly through photos is a large part of whether it functions as intended.",
        "None of this is a substitute for the specific phrase your own MLS may require. Some boards have adopted standard language that listing agents are expected to use verbatim. If yours has, use it as written rather than paraphrasing, because the value of a standard phrase is that it is recognized consistently across every listing that carries it.",
      ],
    },
    {
      h2: "What Generally Counts As Material Misrepresentation",
      body: [
        "The distinction that shows up most consistently across different frameworks is between staging that adds or rearranges furnishings and edits that change facts about the property a buyer would rely on. Adding a sofa, art, and a rug to a vacant living room changes the feel of the photo but does not change any fact about the room. Removing a water stain from a ceiling, erasing a crack in a foundation wall, or digitally replacing damaged flooring changes a fact the buyer needs, and that is the kind of edit most commonly treated as material misrepresentation regardless of the specific state or MLS.",
        "The test that many agents use informally is whether the edit would still be true if a buyer walked into the room in person. Furniture that was never there is obviously not present at a showing, but everyone understands staging works that way, and the disclosure covers the gap. A defect that was edited out of the photo is present at the showing, and the photo now actively contradicts what the buyer will find. That contradiction is the practical core of what turns an edit into a misrepresentation problem rather than a staging one.",
      ],
    },
    {
      h2: "Why Removing A Permanent Feature Is Different From Adding A Sofa",
      body: [
        "Adding furniture to an empty room is reversible in the sense that everyone viewing the photo understands the room does not currently contain that furniture, and the disclosure exists precisely to make that understanding explicit. Removing a permanent feature, a wall, a fixture, visible damage, or altering the layout of the room in the image, is not reversible in the same way. The buyer cannot mentally subtract an edit they were never told about, and the photo becomes a representation of a room that does not exist in that configuration.",
        "This is also why most frameworks that regulate virtual staging draw the line at permanence rather than at the fact of editing itself. A tool that lets you swap a couch or repaint a wall digitally for visualization purposes is doing something categorically different from a tool that lets you erase a support column or move a doorway in a listing photo, even though both involve digital editing of an image. Keeping that distinction in mind when you choose what to stage, and confirming with your MLS how staged photos of rooms with any visible condition issues should be handled, is a reasonable way to stay on the right side of rules that otherwise vary quite a bit by jurisdiction.",
      ],
    },
  ],

  faqs: [
    {
      q: "Do All States Require The Same Disclosure Language For Staged Photos?",
      a: "No. Requirements vary by state and by individual MLS, and they change over time. This page describes common categories of rule, not a specific statute or MLS policy. Confirm the current wording and placement your own MLS requires before publishing any staged listing photo.",
    },
    {
      q: "Is This Page Legal Advice?",
      a: "No. This is general information intended to help you understand the categories of rule that commonly exist around virtual staging disclosure. It is not a substitute for advice from a real estate attorney or guidance from your state's licensing body and your local MLS.",
    },
    {
      q: "Can I Virtually Stage A Room With Visible Damage?",
      a: "Staging furniture into a room is generally treated differently from editing out a defect the room actually has. Adding furnishings to a damaged room while leaving the damage visible is a different situation from removing the damage from the photo. Confirm how your MLS wants damage-adjacent staging handled before publishing.",
    },
    {
      q: "Does The Disclosure Need To Be On The Photo Itself?",
      a: "Some MLS boards want the disclosure printed on the image, others accept it in the listing remarks, and some specify both. This detail differs by board and changes over time, so check your current MLS rules rather than assuming remarks alone are sufficient.",
    },
    {
      q: "What Should I Do If I Am Not Sure An Edit Is Allowed?",
      a: "Ask your MLS compliance desk or your broker before publishing. Treating an edit as staging when it actually changes a fact about the property, like removing a crack or a stain, carries more downside than a short delay to confirm the rule with the people who enforce it.",
    },
  ],

  relatedSlugs: [
    "/mls-photo-rules",
    "/ai-virtual-staging",
    "/declutter-photo",
    "/for-real-estate-agents",
    "/rental-grade-vs-retail-grade",
    "/for-property-managers",
  ],

  ctaTitle: "Stage Listing Photos With Disclosure Built In",
  ctaBody: "Every staged image exports with a disclosure caption attached, so you are not writing that language by hand for every listing.",
  ctaLabel: "Try Virtual Staging",
};
