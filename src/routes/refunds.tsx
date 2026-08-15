import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Refund Policy & 30 Day Guarantee | REAL DESIGNS";
const DESC =
  "Every paid REAL DESIGNS subscription carries a 30 day money back guarantee. How refunds work for annual plans, project packs, top ups and founding member rates.";

export const Route = createFileRoute("/refunds")({
  head: () => pageHead("/refunds", TITLE, DESC),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <LegalDoc
      h1="Refund Policy"
      updated="August 10, 2026"
      lede="Thirty days, no retention call, no exit survey you have to argue with."
      sections={[
        {
          id: "guarantee",
          h2: "The Guarantee",
          body: [
            "Every paid subscription carries a 30 day money back guarantee. If REAL DESIGNS is not earning its keep, email support within 30 days of your first payment and we will refund it in full. No forms, no retention call, no exit survey you have to argue with.",
          ],
        },
        {
          id: "what-you-keep",
          h2: "What You Keep",
          body: [
            "Images you generated before the refund remain yours under the licence in effect when you made them. We do not revoke rights to work you have already delivered to a client.",
          ],
        },
        {
          id: "annual-plans",
          h2: "Annual Plans",
          body: [
            "Annual plans are refundable in full within 30 days of purchase. After 30 days annual plans are non refundable, but you keep access for the remainder of the term and can cancel renewal at any time from your dashboard.",
          ],
        },
        {
          id: "project-packs",
          h2: "Project Packs",
          body: [
            "One time project packs are refundable within 14 days if fewer than 10 credits have been used. Once a pack is substantially used we cannot refund it, because the compute has been spent.",
          ],
        },
        {
          id: "credit-top-ups",
          h2: "Credit Top Ups",
          body: [
            "Top up credits are non refundable once purchased, since they are consumed on use. Unused top up credits remain available while your subscription is active.",
          ],
        },
        {
          id: "add-ons",
          h2: "Add Ons",
          body: [
            "The Double Your Credits add on can be cancelled at any time and stops at the end of the current billing period. It is not prorated.",
          ],
        },
        {
          id: "founding-member-pricing",
          h2: "Founding Member Pricing",
          body: [
            "If you refund a founding member subscription your locked rate is released and returned to the available pool. Resubscribing later means paying the rate in effect at that time.",
          ],
        },
        {
          id: "how-to-request",
          h2: "How To Request",
          body: [
            "Email support@realdesigns.ai from the address on the account. Refunds return to the original payment method and typically settle in 5 to 10 business days.",
          ],
        },
        {
          id: "chargebacks",
          h2: "Chargebacks",
          body: [
            "Please contact us before disputing a charge. We will almost always resolve it faster than your bank will.",
          ],
        },
      ]}
    />
  );
}
