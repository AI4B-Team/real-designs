import { createFileRoute } from "@tanstack/react-router";

import { LegalTemplate } from "@/components/seo/LegalTemplate";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Privacy Policy | REAL DESIGNS";
const DESC =
  "What REAL DESIGNS collects, how your property photos are stored and processed, who we share data with, and how to delete your workspace.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/privacy") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/privacy") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalTemplate
      eyebrow="Legal"
      h1="Privacy Policy"
      lede="Your property photos are the most sensitive thing you give us. This explains exactly what we hold, where it lives and how to get rid of it."
      updated="August 2026"
      sections={[
        {
          h2: "What We Collect",
          body: ["We keep the collection narrow. In practice that is:"],
          bullets: [
            "Account data: your email address, your name if you give it, and your sign in method",
            "Content you upload: room photos, sketches, floor plans and the notes you type into the builder",
            "Work we generate for you: designs, scope line items, budget ranges and presentation links",
            "Usage data: credits spent, actions taken in the application and basic error logs",
            "Technical data: IP address, browser and device type, captured for security and abuse prevention",
          ],
        },
        {
          h2: "What We Do Not Collect",
          body: [
            "We do not ask for a property address unless you choose to type one as a label. We do not collect government identifiers, and we never see or store your full card details. When payments are enabled they are handled by a payment processor and card data goes straight to them.",
          ],
        },
        {
          h2: "How Your Photos Are Handled",
          body: [
            "Uploads go into private storage. Access is enforced per account at the database level, so another user cannot read your files, and links to your images are short lived signed URLs rather than public addresses.",
            "Photos are sent to our AI processing providers to produce your design, read room geometry and estimate quantities. They are transmitted for that purpose and are not used to train public models.",
            "The one exception is a presentation link you create yourself. Anything inside it is visible to whoever holds the URL until you expire it.",
          ],
        },
        {
          h2: "Why We Process Your Data",
          body: [
            "To run the service you asked for, to enforce credit limits and plan entitlements, to keep the platform secure, to answer support requests and to meet our legal obligations. Where the law requires consent, such as marketing email, we ask for it and you can withdraw it at any time.",
          ],
        },
        {
          h2: "Who We Share With",
          body: [
            "We use a small set of processors, each bound to handle your data only on our instructions: our cloud hosting and database provider, our AI model providers, our email delivery provider and, once payments are live, our payment processor.",
            "We do not sell personal data. We do not share your uploads with advertisers or data brokers.",
          ],
        },
        {
          h2: "How Long We Keep Things",
          body: [
            "Uploads and generated work stay while your account is open, because that is your workspace. Delete a room, design or property and it goes from your workspace immediately and from backups within thirty days.",
            "Close your account and we delete your content within thirty days, keeping only what we must for tax, accounting and fraud records.",
          ],
        },
        {
          h2: "Your Rights",
          body: [
            "You can ask for a copy of your data, correct it, delete it, or object to a particular use. Profile and security details are editable directly on the account page. For anything else, write to privacy@realdesigns.ai and we will respond within thirty days.",
            "If you are in the UK, EU or a state with equivalent law, those rights include portability and the right to complain to your data protection regulator.",
          ],
        },
        {
          h2: "Cookies",
          body: [
            "We use the cookies and local storage needed to keep you signed in, remember your workspace preferences and secure the session. We do not run third party advertising trackers.",
          ],
        },
        {
          h2: "Security",
          body: [
            "Data is encrypted in transit and at rest. Row level security scopes every database read to the account that owns the row. Storage buckets are private by default. No system is perfect, and if a breach affects you we will tell you and the relevant regulator within the required window.",
          ],
        },
        {
          h2: "Children",
          body: [
            "REAL DESIGNS is not for anyone under eighteen and we do not knowingly collect their data. If you believe a minor has an account, email privacy@realdesigns.ai and we will remove it.",
          ],
        },
        {
          h2: "Changes And Contact",
          body: [
            "If we make a material change we will update the date at the top and notify account holders by email. Questions go to privacy@realdesigns.ai.",
          ],
        },
      ]}
    />
  );
}
