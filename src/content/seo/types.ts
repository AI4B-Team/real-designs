import { PHOTOS } from "@/content/rd-photos";

export type PhotoKey = keyof typeof PHOTOS;

export type ScopeLine = {
  /** Line item description, Title Case. */
  item: string;
  /** Quantity string with unit, e.g. "24 LF". */
  qty: string;
  /** Trade, e.g. "Cabinetry". */
  trade: string;
  low: number;
  high: number;
};

export type Faq = { q: string; a: string };

export type ProseSection = {
  h2: string;
  /** Paragraphs of body copy. Plain text, no markdown. */
  body: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
};

export type HowToStep = { name: string; text: string };

export type LandingTier = "A" | "B" | "C" | "D";

export type LandingPage = {
  slug: string;
  tier: LandingTier;
  /** Search intent this page answers, one sentence. */
  intent: string;

  /** Head */
  metaTitle: string;
  metaDescription: string;

  /** Hero */
  eyebrow: string;
  h1: string;
  lede: string;

  /** Builder prefill */
  spaceType: "interior" | "exterior" | "landscape";
  roomType: string;
  /** 0 Refresh, 1 Makeover, 2 Renovation, 3 Reimagine */
  budgetBand: 0 | 1 | 2 | 3;

  /** Answer the intent inside the first 100 words. */
  intro: string[];

  /** Before / after pair for this topic. */
  beforePhoto: PhotoKey;
  afterPhoto: PhotoKey;
  beforeCaption: string;
  afterCaption: string;

  /** How It Works, topic worded. Exactly three. */
  steps: { title: string; text: string }[];

  /** Showcase card ids, 4 to 6 of them. */
  showcase: string[];

  /**
   * Budget and scope block. Retained on the type for backward compatibility
   * with archived drafts, but no page should set these: fabricated line-item
   * tables are not rendered anywhere in the app.
   */
  scopeTitle?: string;
  scopeIntro?: string;
  scopeLines?: ScopeLine[];
  scopeBasis?: string;
  confidence?: "High" | "Medium" | "Low";

  /** Long-form unique copy. Together with intro this carries the page. */
  sections: ProseSection[];

  faqs: Faq[];

  /** Six related slugs for the internal link cluster. */
  relatedSlugs: string[];

  /** Present on calculator and how-to pages only. */
  howTo?: { name: string; steps: HowToStep[] };

  ctaTitle: string;
  ctaBody: string;
  ctaLabel: string;
};
