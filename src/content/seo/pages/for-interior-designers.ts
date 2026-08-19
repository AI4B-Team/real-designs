import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/for-interior-designers",
  tier: "C",
  intent:
    "Interior designers who need fast early concepts to align a client before committing billable hours to specification and sourcing.",

  metaTitle: "AI Concepting Tools For Interior Designers",
  metaDescription:
    "Get a client aligned on direction before you spend billable hours on specification. Reality Lock generates early concepts from their own room.",

  eyebrow: "For Interior Designers",
  h1: "Align The Client Before You Spend Billable Hours",
  lede: "Generate a handful of early concept directions from the client's own room so the conversation about style and budget happens before you start specifying, not after a round of revisions nobody agreed to pay for.",

  spaceType: "interior",
  roomType: "living room",
  budgetBand: 2,

  intro: [
    "The most expensive round of a design engagement is often the first one, before a client has committed to a direction, when a designer is asked to produce boards or concepts on spec just to win the alignment meeting.",
    "Reality Lock is built for that early stage only. It generates a small set of directional concepts from a photo of the client's actual room, locked to their real walls and windows, so you can walk into a kickoff meeting with visuals to react to instead of blank paper. It is not a substitute for the specification, sourcing and installation oversight that is the actual craft of the work, and it is not positioned as one.",
  ],

  beforePhoto: "before",
  afterPhoto: "after",
  beforeCaption: "Client's living room, existing condition",
  afterCaption: "Early concept direction for client alignment, pre-specification",

  steps: [
    {
      title: "Photograph The Client's Room",
      text: "Use a phone photo from the initial consult, no measured drawings needed for this stage of the conversation.",
    },
    {
      title: "Generate A Few Directional Concepts",
      text: "Produce two or three distinct style directions locked to the room's real proportions, for the client to react to.",
    },
    {
      title: "Move Into Specification With Direction Agreed",
      text: "Once the client has picked a direction, your billable hours go into sourcing, detailing and installation, not into guessing at their taste.",
    },
  ],

  showcase: ["interior", "reality-lock", "shop", "sketch"],

  sections: [
    {
      h2: "Protecting Billable Hours At The Start Of A Project",
      body: [
        "A common friction point in a design engagement is the gap between what a client can picture and what a designer can describe verbally before any real specification work has started. That gap gets filled either by unpaid concept work, or by moving straight into detailed specification on a direction the client has not actually confirmed they like, both of which cost the designer time that was never billed for.",
        "Generating a few early concept directions from the client's own room, before specification begins, gives the client something concrete to react to at the alignment stage, so the hours that follow go toward a direction that has already been agreed on rather than one the designer is guessing at.",
      ],
    },
    {
      h2: "Presenting Options Instead Of A Single Answer",
      body: [
        "Clients often engage more confidently with a decision when they are choosing between two or three credible directions rather than accepting or rejecting a single proposal. Generating multiple distinct concepts from the same room photo supports that kind of presentation without requiring a separate round of hand rendering for each direction.",
        "This is particularly useful with clients who are early in defining their own taste and benefit from seeing contrasting directions side by side before committing to the vocabulary a designer will use in the formal specification that follows.",
      ],
      bullets: [
        "Two or three concept directions from one client meeting",
        "A shared visual reference for style conversations going forward",
        "Less time spent describing a direction the client cannot yet picture",
      ],
    },
    {
      h2: "Where The Tool Stops & The Designer Starts",
      body: [
        "A generated concept is a starting conversation, not a finished design. It does not select or specify actual products, does not account for lead times, custom fabrication, lighting design at a technical level, or the hundred small decisions that separate a rendered concept from a room that has actually been designed and installed. That work, the sourcing, the detailing, the vendor relationships and the judgment about how pieces actually work together in person, remains the part of the engagement only a designer does.",
        "We think of this as narrowing the distance between a client's imagination and a designer's first pass, so the billable work that follows is spent building the real thing instead of guessing at a direction. It is a tool for the beginning of a relationship, not a replacement for the relationship itself.",
      ],
    },
    {
      h2: "Using Concepts To Set Expectations On Budget",
      body: [
        "Clients frequently anchor their expectations to images they have seen online that bear no relationship to their actual room's proportions or their actual budget tier. Generating a concept from their own space, at a budget band consistent with what they intend to spend, helps recalibrate that expectation early, before a designer has invested hours in a specification the client's budget cannot actually support.",
        "This is not a substitute for a detailed budget conversation, but it gives designers a visual anchor to have that conversation around, rather than relying on a client's mental image of a magazine spread shot in a much larger room with a much larger budget.",
      ],
    },
  ],

  faqs: [
    {
      q: "Does this replace the specification and sourcing work designers do?",
      a: "No. It generates early directional concepts to align a client before specification begins. The sourcing, detailing, vendor coordination and installation oversight that make up the actual delivery of a design remain work only a designer performs, and the tool is not positioned as a substitute for that craft.",
    },
    {
      q: "Will clients expect the exact furniture shown in a generated concept?",
      a: "Some may, which is why we recommend framing generated concepts explicitly as directional, not final specification, in the client conversation. Setting that expectation early avoids confusion later when actual sourced pieces differ from a generated image due to availability, budget or fit.",
    },
    {
      q: "Can I use this to bill for concept development, or should it be free?",
      a: "That is a business decision each designer should make based on their own fee structure. Many designers use it to speed up work they would otherwise spend unbilled hours on during an initial consult, effectively protecting margin on the early stage of an engagement rather than creating a new billable line item.",
    },
    {
      q: "Does it understand my studio's specific aesthetic or past projects?",
      a: "It generates concepts from style and budget inputs you select, not from a designer's personal portfolio or signature style. It is best used as a starting point for client alignment, which a designer then refines and makes their own during specification.",
    },
    {
      q: "Is this only for full room redesigns, or can it help with smaller decisions?",
      a: "It works for both. Some designers use it for full room concepts at a project kickoff, others use it narrowly to test a single decision, like a paint direction or a furniture layout change, with a client before committing design hours to developing that idea further.",
    },
  ],

  relatedSlugs: [
    "/ai-interior-design",
    "/sketch-to-render",
    "/ai-kitchen-design",
    "/ai-bathroom-design",
    "/2d-to-3d-floor-plan",
    "/declutter-photo",
  ],

  ctaTitle: "Get The Client Aligned Before You Specify",
  ctaBody:
    "Photograph the room and generate a few concept directions to open the client conversation on the right footing.",
  ctaLabel: "Generate Early Concepts",
};
