import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Do Not Sell Or Share My Personal Information | REAL DESIGNS";
const DESC =
  "REAL DESIGNS does not sell or share personal information as those terms are defined under the CCPA. How to submit a request and what we do with it.";

export const Route = createFileRoute("/do-not-sell")({
  head: () => pageHead("/do-not-sell", TITLE, DESC),
  component: DoNotSellPage,
});

function DoNotSellPage() {
  return (
    <LegalDoc
      h1="Do Not Sell Or Share My Personal Information"
      updated="August 10, 2026"
      lede="The short answer is that we do not, and there is nothing you need to opt out of. The longer answer is below."
      sections={[
        {
          id: "our-position",
          h2: "Our Position",
          body: [
            "We do not sell personal information, and we do not share it for cross context behavioural advertising, as those terms are defined by the California Consumer Privacy Act. We do not run third party advertising trackers and we do not pass your uploads or project data to data brokers.",
          ],
        },
        {
          id: "affiliate-links",
          h2: "Affiliate Links",
          body: [
            "Product links may carry an affiliate parameter so a retailer can attribute a purchase to us. That parameter identifies REAL DESIGNS, not you, and we do not receive your payment details from the retailer. See our Affiliate Disclosure at /affiliate-disclosure.",
          ],
        },
        {
          id: "submit-a-request",
          h2: "Submitting A Request",
          body: [
            "You can still record an opt out, or exercise your rights to know, correct or delete, by emailing privacy@realdesigns.ai from the address on your account. We verify the request against your account and respond within 45 days.",
            "An authorised agent may submit on your behalf with written permission. We do not discriminate against anyone for exercising these rights.",
          ],
        },
      ]}
    />
  );
}
