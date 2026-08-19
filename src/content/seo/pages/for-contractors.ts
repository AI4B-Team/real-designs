import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/for-contractors",
  tier: "C",
  intent: "Contractors and remodelers who need to win a bid, show a client what they are paying for, and stop change orders that erode margin.",

  metaTitle: "AI Design & Scope Tools For Contractors",
  metaDescription: "Show clients exactly what you are pricing before you break ground. Reality Lock keeps designs buildable and scoped, so bids hold and change orders drop.",

  eyebrow: "For Contractors",
  h1: "Show The Client What They Are Buying Before You Quote It",
  lede: "Turn a phone photo of the existing kitchen into a design your client can approve and a scope you can price, so the number you write on the proposal is the number the job actually costs.",

  spaceType: "interior",
  roomType: "kitchen",
  budgetBand: 2,

  intro: [
    "Most change orders do not start on the job site, they start in the sales conversation, when a client agrees to a vague description like 'updated kitchen' and later discovers that meant something different in their head than it did in yours.",
    "Reality Lock lets you generate a design from the client's own kitchen photo, locked to their actual cabinet run, window placement and ceiling height so the render is something you can actually build, and pairs it with a line-itemed scope of work with quantities and trades. Send the client the picture and the scope in the same proposal, and there is far less room for a disagreement about what was included once demo starts.",
  ],

  beforePhoto: "kitchenBefore",
  afterPhoto: "kitchenAfter",
  beforeCaption: "Client's existing kitchen, phone photo",
  afterCaption: "Proposed design with a matching scope of work attached",

  steps: [
    { title: "Photograph The Existing Space", text: "Use the same phone photos you would take for your own estimate walk-through, no measuring or CAD required." },
    { title: "Generate The Design & Scope Together", text: "The redesign and the itemized scope of work are produced from the same job, so the picture and the price sheet always match." },
    { title: "Attach Both To The Proposal", text: "Send the client a design they can approve and a scope they can read line by line, closing the gap between what they picture and what they are paying for." },
  ],

  showcase: ["reality-lock", "scope", "brief", "interior"],


  sections: [
    {
      h2: "Win The Bid With A Picture The Client Can Approve",
      body: [
        "Homeowners struggle to visualize a remodel from a materials list and a floor plan sketch, which is exactly why so many decisions get made or unmade at the granite counter in the showroom. When your proposal includes a rendered version of their own kitchen, in their own layout, they can make a real decision instead of an imagined one.",
        "Because the render is locked to the home's actual dimensions, window and door positions, and ceiling height, it does not set an expectation you cannot deliver on. You are not competing against a stock photo of someone else's kitchen, you are showing them their kitchen finished.",
      ],
    },
    {
      h2: "Reducing Change Orders With A Scope Both Sides Signed Off On",
      body: [
        "The scope of work generated with the design lists quantities and trade categories the same way your own estimating process would, which means it can become the attachment your client signs alongside the proposal, not a separate document you have to build from scratch after the design is approved.",
        "When a client later asks for something that was not on that list, whether it is a different backsplash pattern or a relocated outlet, the scope document is the reference point that makes it a change order conversation instead of an argument about what was promised.",
      ],
      bullets: [
        "A shared reference document for what was quoted versus what was requested",
        "Fewer 'I thought that was included' conversations mid-project",
        "A faster path to a signed change order when scope genuinely changes",
      ],
    },
    {
      h2: "Quoting Faster Without Underpricing The Job",
      body: [
        "Estimating takes time you are not always billing for, and the pressure to turn a proposal around quickly can push contractors toward rounder, less precise numbers. Generating a quantity-based scope alongside the design gives you a structured starting point, itemized by trade, that you then adjust to your actual supplier pricing and labor rates rather than estimating from memory on every job.",
        "This does not replace your own take-off process on complex jobs, but on a standard kitchen or bathroom remodel it can cut the time between the first site visit and a proposal in the client's inbox, without you eyeballing a number under pressure to close the job that week.",
      ],
    },
    {
      h2: "A Design Document That Survives The Subcontractor Handoff",
      body: [
        "On jobs where you are subcontracting cabinetry, tile or electrical, the design and scope together give your subs a single reference instead of a verbal description filtered through you. That matters most on jobs where the general contractor is not on site every day and a sub is making a judgment call about a detail that was never fully specified.",
        "Locked room dimensions also mean a cabinetry sub or countertop fabricator is working from a layout that matches the existing walls, reducing the odds of a measurement mismatch discovered at install.",
      ],
    },
  ],

  faqs: [
    {
      q: "Will this generate an exact bid I can send to a client?",
      a: "No. It generates a planning-stage scope with a cost range built from national material and labor averages, meant to be adjusted to your own supplier pricing, crew rates and local market before it becomes a quote. Treat it as a structured starting point, not a final number.",
    },
    {
      q: "Does the design account for our actual cabinet layout and dimensions?",
      a: "Yes. Reality Lock keeps the redesign locked to the room's real walls, windows, doors and ceiling height from the uploaded photo, so what the client approves is a layout you can actually build rather than a generic stock kitchen that does not match their space.",
    },
    {
      q: "How does this help with change orders specifically?",
      a: "The itemized scope attached to the proposal becomes a shared reference for what was included at signing. When a client requests something outside that list mid-project, you have a documented baseline to point to, which speeds up getting a change order approved instead of debating what was originally promised.",
    },
    {
      q: "Can I use this for bathrooms and other rooms, not just kitchens?",
      a: "Yes. The same photo-to-design-and-scope workflow applies to bathrooms, living rooms, bedrooms and whole-home projects. Kitchens are the most common starting point for contractor proposals because they carry the largest share of a typical remodel budget.",
    },
    {
      q: "Does this replace my own estimating software?",
      a: "No. It generates a planning-level scope and cost range to speed up the front end of a proposal and give the client a visual to approve. Your own estimating software or take-off process should still produce the firm number you stand behind in the signed contract.",
    },
  ],

  relatedSlugs: [
    "/rehab-cost-calculator",
    "/kitchen-remodel-cost",
    "/renovation-cost-estimator",
    "/bathroom-remodel-cost",
    "/ai-kitchen-design",
    "/rehab-cost-calculator",
  ],

  ctaTitle: "Give Every Proposal A Picture & A Scope",
  ctaBody: "Photograph the existing space and generate a design and an itemized scope your client can approve in the same meeting.",
  ctaLabel: "Build A Client Proposal",
};
