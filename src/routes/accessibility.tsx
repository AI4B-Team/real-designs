import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Accessibility Statement | REAL DESIGNS";
const DESC =
  "Our commitment to WCAG 2.1 AA, the known gaps we are working on, and how to request an accommodation or report an accessibility barrier.";

export const Route = createFileRoute("/accessibility")({
  head: () => pageHead("/accessibility", TITLE, DESC),
  component: AccessibilityPage,
});

function AccessibilityPage() {
  return (
    <LegalDoc
      eyebrow="Trust"
      h1="Accessibility"
      updated="August 10, 2026"
      lede="We are working toward WCAG 2.1 Level AA across the marketing site and the application."
      sections={[
        {
          id: "commitment",
          h2: "Our Commitment",
          body: [
            "REAL DESIGNS should be usable with a keyboard, with a screen reader and at high zoom. We treat an accessibility barrier as a bug, not a feature request.",
          ],
        },
        {
          id: "what-we-do",
          h2: "What We Do",
          bullets: [
            "Semantic headings, landmarks and labelled form controls",
            "Visible focus indicators on every interactive element",
            "Alternative text on meaningful imagery, and empty alt text on decoration",
            "Colour is never the only signal for state or meaning",
            "Contrast targets of at least 4.5 to 1 for body text",
          ],
        },
        {
          id: "known-gaps",
          h2: "Known Gaps",
          body: [
            "Generated renders are visual by nature, so we are expanding the written scope and line item output that accompanies every design. Some data tables and the interactive hero tour are still being improved for screen reader use.",
          ],
        },
        {
          id: "accommodation",
          h2: "Requesting An Accommodation",
          body: [
            "If any part of REAL DESIGNS is difficult to use, email accessibility@realdesigns.ai with the page and what happened. We reply within 2 business days and will provide the information or function in an alternative format while we fix the underlying issue.",
          ],
        },
      ]}
    />
  );
}
