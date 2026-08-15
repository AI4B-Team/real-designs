import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Privacy Policy | REAL DESIGNS";
const DESC =
  "We never sell your personal information and never train AI models on your photos. What we collect, how long we keep it, and how to export or delete it.";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("/privacy", TITLE, DESC),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalDoc
      h1="Privacy Policy"
      updated="August 10, 2026"
      lede="Your property photographs are the most sensitive thing you give us. This is what we hold, where it lives and how to get rid of it."
      draftNotice="Draft pending attorney review. Retention and sub processor statements must be reconciled against actual system behaviour before publish. In particular, the 30 day free tier deletion job must be live before this page goes public."
      sections={[
        {
          id: "short-version",
          h2: "The Short Version",
          bullets: [
            "We do not sell your personal information.",
            "We do not train AI models on your photographs.",
            "Free tier images are deleted after 30 days. Paid images stay until you delete them or close your account.",
            "You can export or delete everything from your dashboard.",
          ],
        },
        {
          id: "what-we-collect",
          h2: "What We Collect",
          bullets: [
            "Account: name, email, company, password hash, plan",
            "Content: photographs you upload, designs generated, dimensions you confirm, project names, property addresses you enter",
            "Payment: handled by Stripe. We never see or store full card numbers",
            "Usage: pages viewed, features used, credits consumed, device and browser, truncated IP address",
            "Support: anything you send us",
          ],
        },
        {
          id: "property-addresses",
          h2: "Property Addresses",
          counsel: true,
          body: [
            "Addresses you enter are used to select local cost data and comparable sales. They are stored with your account and are not published, sold or shared with contractors unless you explicitly send a scope to a specific recipient.",
          ],
        },
        {
          id: "photographs",
          h2: "Photographs: Retention & Training",
          body: [
            "We do not use your photographs or generated designs to train AI models.",
            "Uploads are transmitted to our GPU processing providers to generate your result and are not retained by them for training under our agreements.",
            "Free tier uploads and outputs are deleted 30 days after creation. Paid tier content is retained until you delete it or close your account, then removed within 30 days.",
          ],
        },
        {
          id: "sub-processors",
          h2: "Who We Share With",
          body: ["We use a small set of processors, each bound to act only on our instructions:"],
          bullets: [
            "Supabase: database, storage and authentication",
            "Stripe: payments",
            "Resend: transactional email",
            "[GPU PROVIDER]: image generation",
            "[ANALYTICS]: product analytics",
            "[SUPPORT TOOL]: support conversations",
          ],
          after: ["A current list is maintained at /subprocessors."],
        },
        {
          id: "affiliate-tracking",
          h2: "Affiliate & Advertising Tracking",
          body: [
            "Product links may carry affiliate parameters that let a retailer attribute a purchase to us. We do not receive your payment details from those retailers. See our Affiliate Disclosure at /affiliate-disclosure.",
          ],
        },
        {
          id: "your-rights",
          h2: "Your Rights",
          body: [
            "Access, correction, deletion, export, and objection.",
            "California residents: right to know, delete, correct, and to opt out of sale or sharing. We do not sell or share personal information as those terms are defined under the CCPA.",
            "EU and UK residents: GDPR rights including portability and the right to lodge a complaint with a supervisory authority.",
            "Exercise any of these at privacy@realdesigns.ai or in your dashboard.",
          ],
        },
        {
          id: "cookies",
          h2: "Cookies",
          body: [
            "Essential cookies for login and security. Analytics cookies only with consent where consent is required.",
          ],
        },
        {
          id: "children",
          h2: "Children",
          body: [
            "REAL DESIGNS is not directed to anyone under 16 and we do not knowingly collect their data.",
          ],
        },
        {
          id: "security-transfers-changes",
          h2: "Security, International Transfers, Changes & Contact",
          body: [
            "Data is encrypted in transit and at rest, and row level security scopes every database read to the account that owns the row. See /security for detail.",
            "Data is processed in the United States. Where we transfer personal data out of the EU or UK we rely on standard contractual clauses.",
            "If we make a material change we will update the date at the top and notify account holders by email. Questions go to privacy@realdesigns.ai.",
          ],
        },
      ]}
    />
  );
}
