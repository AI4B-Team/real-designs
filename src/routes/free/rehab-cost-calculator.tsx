import { createFileRoute } from "@tanstack/react-router";

import { FreeToolTemplate } from "@/components/seo/FreeToolTemplate";
import { RehabCalculator } from "@/components/seo/RehabCalculator";
import "@/styles/rd-site.css";
import { absoluteUrl } from "@/lib/site";

const TITLE = "Free Rehab Cost Calculator, No Photo Needed | REAL DESIGNS";
const DESC =
  "Estimate a rehab budget by room, size and finish grade. Free, no signup, no photo required. Returns a planning range with a confidence level.";

export const Route = createFileRoute("/free/rehab-cost-calculator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/free/rehab-cost-calculator") },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/free/rehab-cost-calculator") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How To Estimate A Rehab Budget",
          step: [
            { "@type": "HowToStep", position: 1, name: "List The Rooms", text: "Add every room you intend to touch, with its approximate square footage." },
            { "@type": "HowToStep", position: 2, name: "Set A Finish Grade", text: "Choose rental grade, retail grade or high end for each room separately." },
            { "@type": "HowToStep", position: 3, name: "Read The Range", text: "The calculator returns a low and high planning range built from published unit rates." },
            { "@type": "HowToStep", position: 4, name: "Add Contingency", text: "Carry ten to twenty percent on top before you treat the number as a budget." },
          ],
        }),
      },
    ],
  }),
  component: FreeRehabTool,
});

function FreeRehabTool() {
  return (
    <FreeToolTemplate
      eyebrow="Free Tool"
      h1="Free Rehab Cost Calculator"
      lede="No photo, no signup, no sales call. Room by room, finish grade by finish grade, with a range you can defend."
      intro={[
        "Enter the rooms you plan to touch, roughly how big they are and what grade of finish you intend to install. The calculator returns a planning range for the whole rehab, broken out by room, using published unit rates rather than a single dollars per square foot number that hides everything interesting.",
        "It requires no photo and no account. That is deliberate. Most people run rehab numbers before they own the property, often standing in someone else's driveway with fifteen minutes to decide whether to make an offer.",
        "The output is a planning range with a confidence level, not a bid. Use it to size an offer, to sanity check a contractor and to decide which rooms actually deserve the money.",
      ]}
      tool={<RehabCalculator defaultRoom="kitchen" />}
      sections={[
        {
          h2: "Why Dollars Per Square Foot Lies",
          body: [
            "The classic shortcut is to multiply total square footage by a single rate. It fails because cost is not distributed evenly across a house. Kitchens and bathrooms carry plumbing, electrical, cabinetry and tile, and they routinely cost five to ten times per square foot what a bedroom costs.",
            "A twelve hundred square foot house with two bathrooms and a gut kitchen is a completely different budget from a twelve hundred square foot house with one bathroom and a kitchen that only needs paint and hardware. A single average rate treats them as identical, which is why deals get underwritten badly.",
            "This calculator prices by room and by grade, so the expensive rooms are visibly expensive and you can see instantly which decision is moving your total.",
          ],
        },
        {
          h2: "Finish Grade Is A Business Decision",
          body: [
            "Rental grade means durable, replaceable and cheap to repair, chosen on a replacement cycle rather than a taste preference. Retail grade means it needs to photograph well and survive an inspection by a buyer who is emotionally invested. High end means the fixtures themselves are part of the value argument.",
            "Installing retail grade in a rental usually destroys money twice, once at purchase and again when a tenant damages something that costs three times as much to replace. Installing rental grade in a retail flip costs you more than it saves, because buyers read cheap finishes as evidence of what they cannot see behind the drywall.",
            "Set the grade per room, not per project. Kitchens and primary bathrooms often justify a step up while secondary bedrooms rarely do.",
          ],
          bullets: [
            "Rental grade: LVP, stock cabinets, laminate tops, satin paint",
            "Retail grade: quality LVP or tile, semi custom cabinets, quartz",
            "High end: hardwood, custom cabinetry, stone, designer fixtures",
            "Mixing grades across rooms is normal and usually correct",
          ],
        },
        {
          h2: "What The Range Does Not Include",
          body: [
            "Structural work, foundation repair, roofing, full electrical rewires, sewer laterals, mold and asbestos remediation, permits and architectural fees are not in these numbers. They are site specific, wildly variable and impossible to estimate without a look at the property.",
            "Nor is holding cost. On a flip, months of interest, taxes, insurance and utilities can equal an entire kitchen. If the schedule slips because of a permit, the rehab budget was never the real risk.",
            "Carry ten to twenty percent contingency on a cosmetic rehab and more on anything involving a house older than fifty years. The contingency is not pessimism, it is the price of the things nobody can see from the driveway.",
          ],
        },
        {
          h2: "How To Use The Number In A Negotiation",
          body: [
            "The high end of the range is the number to underwrite with. The low end is the number to celebrate later if you hit it. Deals fail on the difference between an optimistic budget and an actual one, so use the pessimistic figure to decide what you can pay.",
            "When bids come back, compare them line by line against the range rather than against each other. A bid far under the range is usually missing scope, and the missing scope reappears as a change order at a worse moment. A bid far over may be a contractor who does not want the job, which is useful information too.",
            "Bring the itemized version to the conversation. A contractor arguing with a specific line about cabinet linear footage is a productive argument. A contractor arguing with a single total is a negotiation about nothing.",
          ],
        },
      ]}
      faqs={[
        {
          q: "Do I need a photo or an account to use this?",
          a: "Neither. The calculator runs entirely on room type, size and finish grade, so you can use it standing in a driveway before you own anything. An account only matters when you want to save scenarios or attach them to a photo based design.",
        },
        {
          q: "Where do the unit rates come from?",
          a: "They are published national unit rates for materials and labor by trade, applied to the quantities your inputs imply and then spread into a low and high band. They are not sourced from your local subcontractors, which is exactly why the output is a planning range and not a bid.",
        },
        {
          q: "Should I use this to underwrite a purchase?",
          a: "Use it to screen deals and to size an initial offer, then verify with real bids before you remove contingencies. Use the high end of the range. Add holding costs, closing costs and a contingency, since a rehab budget that ignores time is not a budget.",
        },
        {
          q: "Why is my contractor's quote higher than the range?",
          a: "Common reasons are local labor rates well above national averages, hidden conditions found on site, permit and inspection requirements, difficult access, and scope you described loosely but they priced completely. Ask for the line items and compare them to yours before assuming anyone is wrong.",
        },
        {
          q: "Does it handle a whole house or only one room?",
          a: "Add as many rooms as the project contains and the totals accumulate. For a whole house, remember to include the items that do not belong to a single room, such as exterior work, systems and flooring in circulation space, since those are easy to forget and rarely cheap.",
        },
      ]}
      related={[
        "/rehab-cost-calculator",
        "/arv-calculator",
        "/renovation-cost-estimator",
        "/rental-grade-vs-retail-grade",
        "/ai-design-for-house-flippers",
        "/contractor-scope-generator",
      ]}
      ctaTitle="Price The Rehab Before You Make The Offer."
      ctaBody="Room by room, grade by grade, with a range you can take into a negotiation."
    />
  );
}
