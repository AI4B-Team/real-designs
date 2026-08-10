import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Terms Of Service | REAL DESIGNS";
const DESC =
  "The rules for using REAL DESIGNS: planning estimates are not bids, ARV figures are not appraisals, photo rights, model training, staging disclosure and credits.";

export const Route = createFileRoute("/terms")({
  head: () => pageHead("/terms", TITLE, DESC),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalDoc
      h1="Terms Of Service"
      updated="August 10, 2026"
      lede="Read sections 3, 4 and 5 carefully. They set what our output is, what it is not, and what you are responsible for."
      draftNotice="Draft pending attorney review. Sections tagged Counsel Review carry specific liability and must be reviewed by a licensed attorney before publish. Bracketed entity, venue and arbitration details are placeholders."
      sections={[
        {
          id: "who-we-are",
          h2: "Who We Are",
          body: [
            "REAL DESIGNS is operated by [ENTITY NAME], a [STATE] [ENTITY TYPE], with its principal place of business in Florida.",
          ],
        },
        {
          id: "what-the-service-does",
          h2: "What The Service Does",
          body: [
            "REAL DESIGNS generates visual designs from photographs you upload and produces planning estimates, scopes of work, product suggestions and presentation materials derived from those designs.",
          ],
        },
        {
          id: "planning-estimates",
          h2: "Planning Estimates Are Not Bids",
          counsel: true,
          body: [
            "This is the most important term on this page.",
            "Cost figures produced by REAL DESIGNS are planning estimates. They are:",
          ],
          bullets: [
            "Derived from a photograph and from dimensions you confirm",
            "Ranges, not fixed prices, with a stated confidence level",
            "Based on general market rate assumptions, not on any specific contractor's pricing",
          ],
          after: [
            "They are not: a bid, a quote, a construction contract, an appraisal, an engineering opinion, a structural assessment, or a guarantee of any cost.",
            "You must field verify quantities and obtain bids from licensed contractors before committing to any work. We are not liable for decisions made in reliance on a planning estimate.",
          ],
        },
        {
          id: "arv-and-market-figures",
          h2: "ARV And Market Figures Are Not Appraisals",
          counsel: true,
          body: [
            "ARV impact ranges are modelled from comparable sales data. They are not an appraisal, not a broker price opinion, not investment advice, and not a prediction of resale value. We are not a licensed appraiser or broker.",
          ],
        },
        {
          id: "your-photographs",
          h2: "Your Photographs And Your Rights",
          counsel: true,
          body: [
            "You must own or have permission to use every image you upload. This matters particularly for listing photographs, which are frequently owned by the photographer rather than the agent or seller. Uploading a photograph you do not have rights to is a breach of these terms and you indemnify us against any resulting claim.",
          ],
        },
        {
          id: "ownership",
          h2: "Ownership Of What You Generate",
          body: ["You own the images you generate, subject to your plan's licence:"],
          bullets: [
            "Free: personal, non commercial, watermarked",
            "Starter: personal use, no watermark",
            "Pro and above: commercial use",
          ],
          after: ["Ownership survives cancellation. We do not revoke rights to past work."],
        },
        {
          id: "training",
          h2: "Training",
          counsel: true,
          body: [
            "We do not train models on your uploaded photographs or generated designs by default. If we ever offer an opt in programme it will be explicit, separate, and revocable. Silence is never consent.",
          ],
        },
        {
          id: "mls-and-staging-disclosure",
          h2: "MLS And Staging Disclosure",
          counsel: true,
          body: [
            "Our disclosure tooling applies labels according to the ruleset you select. You remain solely responsible for complying with your MLS rules, your state law and your brokerage policy. These rules vary and change. We provide tooling, not legal advice, and we do not warrant that any ruleset is current or complete.",
          ],
        },
        {
          id: "credits-and-fair-use",
          h2: "Credits And Fair Use",
          body: [
            "Credits reset monthly and do not expire while your subscription is active. Unused credits do not carry over past cancellation and have no cash value.",
            "All plans, add ons and top ups are subject to a fair use policy: sustained usage far beyond the typical pattern for your plan may pause new generations for 24 hours. We will contact you before pausing.",
          ],
        },
        {
          id: "founding-member-pricing",
          h2: "Founding Member Pricing",
          counsel: true,
          body: [
            "Founding member rates are locked for the life of a continuous subscription, including across plan changes. Cancellation releases the rate. This is a binding commitment and we will honour it.",
          ],
        },
        {
          id: "acceptable-use",
          h2: "Acceptable Use",
          body: [
            "See the Acceptable Use Policy at /acceptable-use, incorporated into these terms by reference.",
          ],
        },
        {
          id: "third-party-products",
          h2: "Third Party Products And Links",
          body: [
            "Product suggestions link to third party retailers. We are not the seller, we do not warrant fitness, availability, dimensions or price accuracy, and we are not party to your purchase. Some links are affiliate links; see our Affiliate Disclosure at /affiliate-disclosure.",
          ],
        },
        {
          id: "no-professional-relationship",
          h2: "No Professional Relationship",
          body: [
            "Using REAL DESIGNS does not create a contractor, architect, engineer, designer, appraiser, broker or attorney client relationship.",
          ],
        },
        {
          id: "standard-provisions",
          h2: "Availability, Termination, Changes, Limitation Of Liability, Indemnification, Dispute Resolution And Governing Law",
          counsel: true,
          body: [
            "Standard provisions. Venue and arbitration terms to be set by counsel. Governing law: Florida.",
          ],
        },
      ]}
      footNote="Questions about these terms go to support@realdesigns.ai."
    />
  );
}
