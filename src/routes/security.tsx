import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Security At REAL DESIGNS | Encryption, Access And Disclosure";
const DESC =
  "How REAL DESIGNS encrypts and isolates your property photographs, who can access them, where data is stored, and how to report a vulnerability.";

export const Route = createFileRoute("/security")({
  head: () => pageHead("/security", TITLE, DESC),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <LegalDoc
      eyebrow="Trust"
      h1="Security"
      updated="August 10, 2026"
      lede="What we do to keep your property photographs and project data private, stated plainly enough for a brokerage to review."
      sections={[
        {
          id: "encryption",
          h2: "Encryption",
          body: [
            "All traffic runs over TLS 1.2 or higher. Data is encrypted at rest by our cloud provider using AES-256.",
          ],
        },
        {
          id: "isolation",
          h2: "Data Isolation",
          body: [
            "Every table carries row level security, so a database read is scoped to the account that owns the row. Storage buckets are private by default and images are served through short lived signed URLs rather than public addresses.",
            "The one deliberate exception is a presentation link you create yourself, which is unlisted and readable by anyone holding the URL until you expire it.",
          ],
        },
        {
          id: "access",
          h2: "Internal Access",
          body: [
            "Access to production is limited to the engineers who need it, protected by multi factor authentication, and used only to operate the service or to resolve a support request you have raised.",
          ],
        },
        {
          id: "hosting",
          h2: "Where Data Is Stored",
          body: [
            "Application data and uploads are stored in the United States. Image generation runs on our GPU processing providers, which receive an upload only for the duration of the job and do not retain it for training under our agreements. Payments are processed by Stripe and we never see full card numbers.",
          ],
        },
        {
          id: "retention",
          h2: "Retention And Deletion",
          body: [
            "Free tier uploads and outputs are deleted 30 days after creation. Paid tier content is retained until you delete it or close your account, then removed within 30 days. Deletion is available from your dashboard at any time.",
          ],
        },
        {
          id: "reporting",
          h2: "Reporting A Vulnerability",
          body: [
            "Email security@realdesigns.ai with steps to reproduce. We acknowledge within 2 business days and will keep you updated until it is resolved.",
            "Please give us reasonable time to fix an issue before disclosing it publicly, and do not access or modify data that is not yours while testing. We do not pursue legal action against researchers acting in good faith under those conditions.",
          ],
        },
      ]}
    />
  );
}
