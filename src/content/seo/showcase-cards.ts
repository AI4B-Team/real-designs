import { PHOTOS } from "@/content/rd-photos";

/**
 * Static, server-rendered version of the twelve showcase cards.
 * Landing pages pick four to six by id; the animated homepage grid is untouched.
 */
export type ShowcaseCard = {
  id: string;
  title: string;
  line: string;
  photo: string;
  href: string;
};

export const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    id: "exterior",
    title: "Exterior And Curb Appeal",
    line: "Paint, roof, siding, windows and trim priced as a job, not as a mood board.",
    photo: PHOTOS.exteriorAfter,
    href: "/ai-exterior-design",
  },
  {
    id: "interior",
    title: "Interior Redesign",
    line: "Your real walls and windows keep their positions. Only the finishes and furniture move.",
    photo: PHOTOS.after,
    href: "/ai-interior-design",
  },
  {
    id: "landscape",
    title: "Landscape And Yard",
    line: "Planting beds, hardscape, fencing and lighting with a square foot quantity behind each one.",
    photo: PHOTOS.yardAfter,
    href: "/ai-landscape-design",
  },
  {
    id: "staging",
    title: "Virtual Staging",
    line: "Furnish a vacant room for a listing and carry the disclosure label with the file.",
    photo: PHOTOS.stageStaged,
    href: "/ai-virtual-staging",
  },
  {
    id: "declutter",
    title: "Furniture And Clutter Removal",
    line: "Clear a lived-in room back to its architecture so buyers read the space, not the stuff.",
    photo: PHOTOS.stageEmpty,
    href: "/declutter-photo",
  },
  {
    id: "reality-lock",
    title: "Reality Lock",
    line: "Walls, windows, doors and ceiling height stay measured. A redesign you cannot actually build is worthless.",
    photo: PHOTOS.wfDesigned,
    href: "/ai-interior-design",
  },
  {
    id: "scope",
    title: "Scope And Budget",
    line: "Every design produces line items with quantities, trades and a planning range. Not a ballpark.",
    photo: PHOTOS.kitchenAfter,
    href: "/renovation-cost-estimator",
  },
  {
    id: "budget-mode",
    title: "Budget Mode",
    line: "Set the number first and the design is generated to land inside it.",
    photo: PHOTOS.neutral,
    href: "/rehab-cost-calculator",
  },
  {
    id: "shop",
    title: "Shopping List",
    line: "Fixtures, finishes and furniture matched to real products with live pricing.",
    photo: PHOTOS.luxury,
    href: "/ai-interior-design",
  },
  {
    id: "brief",
    title: "Contractor Brief",
    line: "A printable scope of work a trade can price without a second site visit.",
    photo: PHOTOS.plan2d,
    href: "/contractor-scope-generator",
  },
  {
    id: "walkthrough",
    title: "Walkthrough Video",
    line: "A short moving pass through the designed space for listings and client decks.",
    photo: PHOTOS.plan3d,
    href: "/2d-to-3d-floor-plan",
  },
  {
    id: "mls",
    title: "MLS Disclosure Labeling",
    line: "Every staged or edited image exports with a disclosure caption already attached.",
    photo: PHOTOS.stageClutter,
    href: "/mls-photo-rules",
  },
  {
    id: "sketch",
    title: "Sketch To Render",
    line: "A hand drawing or a flat plan becomes a furnished, photoreal view of the same layout.",
    photo: PHOTOS.sketchRender,
    href: "/sketch-to-render",
  },
  {
    id: "grades",
    title: "Rental Grade And Retail Grade",
    line: "Price the same room twice, once for a tenant turn and once for a resale buyer.",
    photo: PHOTOS.bedroomAfter,
    href: "/rental-grade-vs-retail-grade",
  },
  {
    id: "arv",
    title: "ARV Impact Range",
    line: "What the work is likely to return, expressed as a range with the comps that drove it.",
    photo: PHOTOS.officeAfter,
    href: "/arv-calculator",
  },
];

export const CARD_BY_ID = new Map(SHOWCASE_CARDS.map((c) => [c.id, c]));
