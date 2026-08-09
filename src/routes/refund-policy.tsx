import { createFileRoute } from "@tanstack/react-router";

import { LegalTemplate } from "@/components/seo/LegalTemplate";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Refund Policy And 30 Day Guarantee | REAL DESIGNS";
const DESC =
  "How the 30 day money back guarantee works on REAL DESIGNS plans, what happens to credits and top up packs, and how to cancel.";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/refund-policy") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/refund-policy") }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <LegalTemplate
      eyebrow="Legal"
      h1="Refund Policy"
      lede="Paid plans carry a thirty day money back guarantee. Here is exactly how it works, including the parts most policies bury."
      updated="August 2026"
      sections={[
        {
          h2: "The Thirty Day Guarantee",
          body: [
            "If a paid plan is not right for you, email support@realdesigns.ai within thirty days of the charge and we will refund it in full. You do not have to justify the request, and you can have used the plan in the meantime.",
            "The refund goes back to the original payment method. Processing usually takes five to ten working days depending on your bank.",
          ],
        },
        {
          h2: "What Happens To Your Credits",
          body: [
            "When a plan is refunded, the plan credits it granted are removed and your account returns to the free tier. Work you have already generated stays in your workspace and stays yours to use, subject to the terms of service.",
          ],
        },
        {
          h2: "Top Up Credit Packs",
          body: [
            "Top up packs are consumable, so they are refundable only on the unused balance. If you bought a pack and have not spent any of it, we refund the pack in full. If you have spent part of it, we refund the remainder pro rata.",
            "Packs do not expire while your account is open.",
          ],
        },
        {
          h2: "Renewals",
          body: [
            "We email before a plan renews. If a renewal catches you by surprise, tell us within thirty days of the charge and we will refund it and cancel the plan.",
          ],
        },
        {
          h2: "Cancelling",
          body: [
            "Cancel any time from the billing section of your account. Cancelling stops the next charge and leaves your plan active until the end of the period you have paid for. After that the account moves to the free tier and your saved work stays where it is.",
          ],
        },
        {
          h2: "Exceptions",
          body: [
            "We may decline a refund where an account has clearly abused the guarantee, for example repeated buy and refund cycles, or where the account breached the terms of service. This is rare and we will explain the reason.",
          ],
        },
        {
          h2: "How To Request One",
          body: [
            "Email support@realdesigns.ai from the address on the account, with the word Refund in the subject. We reply within two working days.",
          ],
        },
      ]}
    />
  );
}
