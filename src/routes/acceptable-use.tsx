import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Acceptable Use Policy | REAL DESIGNS";
const DESC =
  "What you may not do with REAL DESIGNS: misrepresenting property condition, removing staging disclosure labels, uploading photographs you do not own, and how we enforce.";

export const Route = createFileRoute("/acceptable-use")({
  head: () => pageHead("/acceptable-use", TITLE, DESC),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <LegalDoc
      h1="Acceptable Use Policy"
      updated="August 10, 2026"
      lede="Referenced by and incorporated into the Terms of Service."
      sections={[
        {
          id: "prohibited-uses",
          h2: "You May Not Use REAL DESIGNS To",
          bullets: [
            "Upload photographs you do not own or have permission to use",
            "Generate images of a property to deceive a buyer, tenant, lender or insurer about its actual condition",
            "Remove or alter a required virtual staging disclosure label",
            "Represent a generated image as an unaltered photograph of real conditions",
            "Generate content depicting identifiable people without their consent",
            "Generate content that is sexual, violent, hateful or promotes illegal activity",
            "Scrape, resell or redistribute our outputs as a competing generation service",
            "Circumvent credit limits, share accounts across organisations, or automate the interface outside our published API",
          ],
        },
        {
          id: "enforcement",
          h2: "Enforcement",
          body: [
            "Depending on severity we will issue a warning, suspend the account, or terminate it.",
            "Deliberate misrepresentation of property condition results in immediate termination without refund.",
          ],
        },
        {
          id: "reporting",
          h2: "Reporting A Violation",
          body: [
            "If you believe an image generated with REAL DESIGNS is being used to misrepresent a property, email abuse@realdesigns.ai with the listing or URL. We investigate every report.",
          ],
        },
      ]}
    />
  );
}
