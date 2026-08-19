import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "Copyright & DMCA Policy | REAL DESIGNS";
const DESC =
  "How to file a DMCA takedown notice with REAL DESIGNS, the counter notice process, and why agents uploading MLS listing photographs need to check their licence.";

export const Route = createFileRoute("/copyright")({
  head: () => pageHead("/copyright", TITLE, DESC),
  component: CopyrightPage,
});

function CopyrightPage() {
  return (
    <LegalDoc
      h1="Copyright & DMCA Policy"
      updated="August 10, 2026"
      lede="If you are an agent uploading listing photographs, confirm your licence covers creating derivative works. Many photographer agreements do not."
      draftNotice="Draft pending attorney review. The DMCA designated agent below is a placeholder and must be registered with the US Copyright Office before this page is published."
      sections={[
        {
          id: "listing-photographs",
          h2: "A Warning About Listing Photographs",
          body: [
            "Real estate listing photographs are usually owned by the photographer, who grants the brokerage a limited licence to market a specific property. That licence often does not permit derivative works, and an AI redesign is a derivative work.",
            "Before you upload a listing photograph, confirm in writing that your licence covers creating and publishing derivative images. If it does not, use a photograph you took yourself or obtain the photographer's permission.",
          ],
        },
        {
          id: "our-position",
          h2: "Our Position",
          body: [
            "We respect copyright and we expect our users to. Uploading material you do not have the rights to breaches our Terms of Service, and we remove infringing content and terminate repeat infringers.",
          ],
        },
        {
          id: "designated-agent",
          h2: "DMCA Designated Agent",
          body: ["Notices of claimed infringement should be sent to our designated agent:"],
          bullets: [
            "Agent: [DESIGNATED AGENT NAME] - TO BE REGISTERED with the US Copyright Office",
            "Email: copyright@realdesigns.ai",
            "Post: [ENTITY NAME], [STREET ADDRESS], Tampa, FL [ZIP], United States",
            "Phone: [PHONE]",
          ],
        },
        {
          id: "takedown-notice",
          h2: "Filing A Takedown Notice",
          body: ["A valid notice under 17 U.S.C. 512(c)(3) must include all of the following:"],
          bullets: [
            "A physical or electronic signature of the copyright owner or a person authorised to act for them",
            "Identification of the copyrighted work claimed to have been infringed",
            "Identification of the material claimed to be infringing, with enough detail for us to locate it, such as the presentation URL or image link",
            "Your address, telephone number and email address",
            "A statement that you have a good faith belief the use is not authorised by the copyright owner, its agent or the law",
            "A statement, under penalty of perjury, that the information in the notice is accurate and that you are the owner or authorised to act on the owner's behalf",
          ],
          after: [
            "We act on complete notices promptly, remove or disable access to the material, and notify the account holder.",
          ],
        },
        {
          id: "counter-notice",
          h2: "Counter Notice",
          body: [
            "If your material was removed and you believe that was a mistake or a misidentification, you may send a counter notice to the same agent. It must include your signature, identification of the removed material and where it appeared, a statement under penalty of perjury that you have a good faith belief the removal was a mistake, your contact details, and your consent to the jurisdiction of the federal district court for your address, or for the Middle District of Florida if you are outside the United States.",
            "If we receive a valid counter notice we forward it to the complaining party. Unless they file a court action within 10 to 14 business days, we may restore the material.",
          ],
        },
        {
          id: "repeat-infringers",
          h2: "Repeat Infringers",
          body: [
            "We maintain a repeat infringer policy. Accounts that receive multiple substantiated notices are terminated, and termination for repeat infringement does not entitle the account holder to a refund.",
          ],
        },
        {
          id: "misrepresentation",
          h2: "Misrepresentation",
          body: [
            "Knowingly filing a false notice or counter notice carries liability for damages under 17 U.S.C. 512(f). Please be sure before you file.",
          ],
        },
      ]}
    />
  );
}
