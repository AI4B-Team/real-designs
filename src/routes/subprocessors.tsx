import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Sub Processors | REAL DESIGNS";
const DESC =
  "The current list of third party sub processors REAL DESIGNS uses to run the service, what each one handles, and how we notify you of changes.";

export const Route = createFileRoute("/subprocessors")({
  head: () => pageHead("/subprocessors", TITLE, DESC),
  component: SubprocessorsPage,
});

function SubprocessorsPage() {
  return (
    <LegalDoc
      eyebrow="Trust"
      h1="Sub Processors"
      updated="August 10, 2026"
      lede="Referenced by our Privacy Policy and by any data processing agreement. Each provider is bound to act only on our instructions."
      draftNotice="Draft. Placeholder entries must be replaced with the live provider names before this page is published or attached to a data processing agreement."
      sections={[
        {
          id: "current-list",
          h2: "Current List",
          bullets: [
            "Supabase - database, file storage and authentication - United States",
            "Stripe - payment processing - United States",
            "Resend - transactional email delivery - United States",
            "[GPU PROVIDER] - image generation and rendering - United States",
            "[ANALYTICS] - product analytics - United States",
            "[SUPPORT TOOL] - support conversations - United States",
            "Cloudflare - content delivery and application hosting - Global edge network",
          ],
        },
        {
          id: "what-they-receive",
          h2: "What They Receive",
          body: [
            "Providers receive only the data needed for their function. Our GPU providers receive the image for the duration of the job and do not retain it for training. Stripe receives billing details directly and we never see full card numbers. Analytics receives usage events and a truncated IP address, not your photographs.",
          ],
        },
        {
          id: "changes",
          h2: "Changes",
          body: [
            "We update this page when a sub processor is added or removed. Customers with a signed data processing agreement can request email notice of changes at privacy@realdesigns.ai.",
          ],
        },
      ]}
    />
  );
}
