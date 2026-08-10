import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Affiliate Disclosure | REAL DESIGNS";
const DESC =
  "Some product links in REAL DESIGNS are affiliate links. How that works, what we earn, and why it never affects which products we show you or how they are ranked.";

export const Route = createFileRoute("/affiliate-disclosure")({
  head: () => pageHead("/affiliate-disclosure", TITLE, DESC),
  component: AffiliateDisclosurePage,
});

function AffiliateDisclosurePage() {
  return (
    <LegalDoc
      h1="Affiliate Disclosure"
      updated="August 10, 2026"
      lede="Some product links in REAL DESIGNS are affiliate links. If you buy through them we may earn a commission at no additional cost to you."
      sections={[
        {
          id: "the-disclosure",
          h2: "The Disclosure",
          body: [
            "Some product links in REAL DESIGNS are affiliate links. If you buy through them we may earn a commission at no additional cost to you. This never affects which products we show you or how they are ranked. Products are matched by visual similarity to your design and filtered by your chosen price tier, not by what pays us most.",
          ],
        },
        {
          id: "how-matching-works",
          h2: "How Product Matching Works",
          body: [
            "Shop The Design reads the objects in your generated render, matches them by visual similarity, and filters the results to the price tier you selected for the room. Commission rate is not an input to that ranking, and a retailer cannot pay to appear higher.",
          ],
        },
        {
          id: "where-it-appears",
          h2: "Where This Is Shown",
          body: [
            "This disclosure also appears inline on the Shop and Product Board screens, next to the links themselves, so it is visible at the point you decide to buy rather than only in the footer.",
          ],
        },
        {
          id: "what-we-are-not",
          h2: "What We Are Not",
          body: [
            "We are not the seller. We do not hold stock, ship, handle returns or warrant price, availability, dimensions or fitness for your space. Your purchase is with the retailer and their terms govern it.",
          ],
        },
        {
          id: "questions",
          h2: "Questions",
          body: [
            "Email support@realdesigns.ai if you want to know whether a specific link is an affiliate link. We will tell you.",
          ],
        },
      ]}
    />
  );
}
