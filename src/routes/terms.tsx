import { createFileRoute } from "@tanstack/react-router";

import { LegalTemplate } from "@/components/seo/LegalTemplate";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Terms Of Service | REAL DESIGNS";
const DESC =
  "The rules for using REAL DESIGNS: accounts, credits, plans, image rights, staging disclosure and the limits of our planning estimates.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/terms") },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/terms") }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalTemplate
      eyebrow="Legal"
      h1="Terms Of Service"
      lede="Plain language rules for using REAL DESIGNS. Read the sections on estimates and staging disclosure carefully, because they set what our output is and is not."
      updated="August 2026"
      sections={[
        {
          h2: "Who We Are And What This Covers",
          body: [
            "REAL DESIGNS is an AI design and renovation planning service. These terms cover the marketing site, the free tools, the web application and any client approval links you share.",
            "By creating an account or using the free tools you agree to these terms. If you use REAL DESIGNS on behalf of a company, you confirm you are allowed to accept them for that company.",
          ],
        },
        {
          h2: "Accounts",
          body: [
            "You need an account for anything that saves work. Keep your login details private, use an email address you control, and tell us straight away if you think somebody else has access to your workspace.",
            "You must be at least eighteen years old. We do not allow shared logins across an organisation while multi seat access is still in development.",
          ],
        },
        {
          h2: "Credits, Plans And Fair Use",
          body: [
            "One credit balance covers everything. A design costs one credit, a scope costs three, a furnished 3D plan costs six and a video costs forty. Costs are shown before you spend and are deducted when the work is queued.",
            "Free accounts get a daily allowance and see typical ranges only. Paid plans add credits, computed ranges and export without our watermark. Credits from a plan renew with the plan. Top up packs sit on top of your balance.",
            "All plans, add-ons and top-ups include a fair use policy. Sustained usage far beyond the typical pattern for your plan may pause new generations until we have spoken with you. We will always contact you before that happens.",
          ],
        },
        {
          h2: "Estimates Are Planning Numbers, Not Bids",
          body: [
            "Every cost figure REAL DESIGNS produces is a planning estimate built from room type, finish level, quantities read from your photo and regional labour and material rates. It is not a construction bid, an appraisal, a valuation or professional advice.",
            "Do not sign a contract, make an offer or set a budget on our number alone. Get quotes from licensed trades in your market. Subcontractor pricing governs. Where a design implies structural change, an engineer or architect has to sign it off.",
          ],
        },
        {
          h2: "Your Content And Your Rights",
          body: [
            "You keep ownership of the photos, sketches and plans you upload. You give us the licence we need to process them, store them for you and produce your designs, scopes and shareable links.",
            "You own the designs generated from your uploads and may use them commercially, subject to your plan and to the staging disclosure rules below. We do not sell your uploads or your generated images, and we do not use your property photos in our marketing without asking you first.",
            "Only upload photos you have the right to use. Do not upload anything that infringes somebody else's copyright, captures people who have not agreed to it, or breaks the terms of a listing service you are bound by.",
          ],
        },
        {
          h2: "Virtual Staging And Listing Disclosure",
          body: [
            "Images produced by REAL DESIGNS are digitally altered. If you use them in a property listing, an advertisement or any marketing, you must disclose that they are virtually staged or digitally enhanced, in the way your MLS, association and state or national rules require.",
            "You are responsible for that disclosure. Removing our watermark on a paid plan does not remove the obligation to label the image.",
          ],
        },
        {
          h2: "Acceptable Use",
          body: ["You agree not to:"],
          bullets: [
            "Present a generated image as an unaltered photograph of a property",
            "Use the service to mislead a buyer, tenant, lender, insurer or appraiser",
            "Resell, scrape or bulk export the service or its outputs as your own product without a written agreement",
            "Attempt to bypass credit limits, watermarks, paywalls or rate limits",
            "Upload unlawful content, or content depicting people in a way they have not consented to",
          ],
        },
        {
          h2: "Client Approval Links",
          body: [
            "Presentation links are unlisted and open to anyone who has the URL. Treat them like a shared document. You can expire a link at any time from the application. Do not put anything in a presentation that you would not want forwarded.",
          ],
        },
        {
          h2: "Availability And Changes",
          body: [
            "We are an active product and features change. We may add, alter or retire parts of the service. Where a change materially reduces something you are paying for, we will tell you in advance and you may cancel under the refund policy.",
            "The service is provided as is. We do not promise uninterrupted availability or that a generated design will match a finished build.",
          ],
        },
        {
          h2: "Liability",
          body: [
            "To the fullest extent the law allows, REAL DESIGNS is not liable for indirect or consequential loss, including lost profit, a purchase decision, a renovation overrun or a listing outcome. Our total liability for any claim is limited to what you paid us in the twelve months before the claim.",
            "Nothing here limits liability that cannot be limited by law.",
          ],
        },
        {
          h2: "Ending Your Account",
          body: [
            "You can close your account at any time from the account page. We may suspend or close an account that breaks these terms, and we will explain why where we are allowed to.",
            "When an account closes we delete your uploads and generated work on the schedule set out in the privacy policy.",
          ],
        },
        {
          h2: "Contact",
          body: [
            "Questions about these terms can go to support@realdesigns.ai. We answer in business hours and aim to reply within two working days.",
          ],
        },
      ]}
    />
  );
}
