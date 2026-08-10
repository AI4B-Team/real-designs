import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Contact REAL DESIGNS | Support And Business Address";
const DESC =
  "How to reach REAL DESIGNS support, press, copyright and privacy teams, our response time expectation, and our business mailing address in Tampa Bay, Florida.";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("/contact", TITLE, DESC),
  component: ContactPage,
});

function ContactPage() {
  return (
    <LegalDoc
      eyebrow="Company"
      h1="Contact Us"
      updated="August 10, 2026"
      lede="A real person reads every message. We answer in business hours, Monday to Friday, Eastern Time."
      sections={[
        {
          id: "support",
          h2: "Support",
          body: [
            "Email support@realdesigns.ai from the address on your account. We reply within one business day, and usually the same day.",
            "Include the property or design name and, where it helps, a screenshot. It saves a round trip.",
          ],
        },
        {
          id: "other-inboxes",
          h2: "Other Inboxes",
          bullets: [
            "Billing and refunds: support@realdesigns.ai",
            "Privacy and data requests: privacy@realdesigns.ai",
            "Copyright and DMCA: copyright@realdesigns.ai",
            "Abuse and misrepresentation reports: abuse@realdesigns.ai",
            "Security disclosure: security@realdesigns.ai",
            "Press and partnerships: hello@realdesigns.ai",
          ],
        },
        {
          id: "business-address",
          h2: "Business Address",
          body: [
            "REAL DESIGNS, [ENTITY NAME], [STREET ADDRESS], Tampa, FL [ZIP], United States.",
            "This address appears on our email footers as required by the CAN-SPAM Act.",
          ],
        },
        {
          id: "response-times",
          h2: "Response Times",
          bullets: [
            "Support: within 1 business day",
            "Refund requests: within 2 business days",
            "Privacy and data requests: within 30 days, usually far sooner",
            "Copyright notices: promptly on receipt of a complete notice",
          ],
        },
      ]}
    />
  );
}
