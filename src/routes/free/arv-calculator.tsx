import { createFileRoute } from "@tanstack/react-router";

import { ArvCalculator } from "@/components/seo/ArvCalculator";
import { FreeToolTemplate } from "@/components/seo/FreeToolTemplate";
import "@/styles/rd-site.css";

const TITLE = "Free ARV Calculator With 70 Percent Rule | REAL DESIGNS";
const DESC =
  "Work out after repair value, maximum allowable offer and the 70 percent rule. Free, no signup, no photo. A planning tool, not an appraisal.";

export const Route = createFileRoute("/free/arv-calculator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/free/arv-calculator" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/free/arv-calculator" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How To Calculate ARV And Maximum Allowable Offer",
          step: [
            { "@type": "HowToStep", position: 1, name: "Pull Comparable Sales", text: "Find closed sales of similar size and condition within a short radius and a recent window." },
            { "@type": "HowToStep", position: 2, name: "Set The After Repair Value", text: "Take the price per square foot the renovated comparables achieved and apply it to your subject." },
            { "@type": "HowToStep", position: 3, name: "Enter The Rehab Budget", text: "Use the high end of your rehab planning range, not the optimistic figure." },
            { "@type": "HowToStep", position: 4, name: "Apply The Rule", text: "Seventy percent of ARV minus rehab gives a maximum allowable offer to start from." },
          ],
        }),
      },
    ],
  }),
  component: FreeArvTool,
});

function FreeArvTool() {
  return (
    <FreeToolTemplate
      eyebrow="Free Tool"
      h1="Free ARV And Maximum Offer Calculator"
      lede="After repair value, rehab budget, and the highest price the deal can survive. No photo, no signup."
      intro={[
        "After repair value is what the property is worth once the work is finished and sold in normal condition. Everything else in a flip is downstream of that one number, which is why getting it wrong is the most expensive mistake in the business.",
        "Enter your ARV estimate and your rehab budget and this calculator returns a maximum allowable offer using the seventy percent rule, plus a view of the profit that remains once costs are subtracted. It needs no photo and no account.",
        "This is a planning tool. It is not an appraisal, not a broker price opinion and not investment advice. Comparable sales, financing terms and your local market will move every figure it produces.",
      ]}
      tool={<ArvCalculator />}
      sections={[
        {
          h2: "Where The Seventy Percent Rule Comes From",
          body: [
            "The rule says pay no more than seventy percent of after repair value minus the rehab budget. The missing thirty percent is not profit. It is closing costs on both ends, financing, holding costs, agent commission and the margin that makes the risk worth taking.",
            "It is a screening heuristic, not a law. In hot markets with thin inventory, disciplined operators sometimes work at seventy five percent because their rehab costs are predictable and their sale is fast. In slow markets, sixty five is closer to safe. What matters is that you know which number you are using and why.",
            "The rule protects you from the most common failure mode, which is not overspending on the rehab. It is overpaying at purchase and then hoping the finishes rescue the deal. They never do.",
          ],
        },
        {
          h2: "Estimating ARV Without Fooling Yourself",
          body: [
            "Use closed sales, not active listings. An asking price is an opinion and a closed sale is a fact. Stay within a tight radius, ideally the same neighborhood and the same school attendance area, and stay recent, ideally within the last six months.",
            "Compare like for like on size, bed and bath count, lot, garage and above all condition. A renovated comparable is the only honest reference for a renovated subject, because the discount for dated finishes is exactly what you are trying to capture.",
            "Then be pessimistic on purpose. Take the middle of the comparable range rather than the top. The one comparable that sold high probably had something yours does not, and building your model on the best sale in the neighborhood is how a thin deal becomes a loss.",
          ],
          bullets: [
            "Closed sales only, within roughly half a mile where possible",
            "Last six months, adjusted if the market has clearly moved",
            "Match condition, not just square footage",
            "Use the middle of the range, never the outlier",
          ],
        },
        {
          h2: "The Costs People Forget",
          body: [
            "Holding cost is the quiet killer. Interest on hard money, property taxes, insurance, utilities and lawn care run every single day the property is not sold, and they run at full rate during the two weeks you spend waiting for an inspection to be scheduled.",
            "Selling costs are the other omission. Commission, transfer taxes, title, and the concessions a buyer will ask for after their inspection. Assuming a clean sale at list price with no concessions is optimism disguised as arithmetic.",
            "A deal that only works if nothing goes wrong is not a deal. Run the model with an extra sixty days of holding and a modest price reduction, and see whether you would still do it.",
          ],
        },
        {
          h2: "How Design Choices Move ARV",
          body: [
            "Not every dollar of rehab returns a dollar of value. Kitchens, primary bathrooms, curb appeal and flooring consistently move buyer perception. Bespoke choices, unusual layouts and finishes far above the neighborhood standard usually do not, because the appraiser and the buyer both compare you to the street.",
            "The most reliable rule is to renovate to the top of the neighborhood and stop. Over improving relative to the comparables means you are funding a value the market will not pay you for, and you find out at the appraisal.",
            "Deciding this before you buy, rather than while you are standing in a tile aisle, is the whole reason to run the design and the budget together instead of in sequence.",
          ],
        },
      ]}
      faqs={[
        {
          q: "Is this an appraisal?",
          a: "No. It is a planning calculator that applies arithmetic to numbers you supply. An appraisal is performed by a licensed appraiser who inspects the property and defends the comparables. Lenders will require one, and it can disagree with your model for reasons the model cannot see.",
        },
        {
          q: "What percentage should I actually use?",
          a: "Seventy percent is the common default and a fair starting point. Tighten toward sixty five in slow or falling markets, on unfamiliar neighborhoods, or on properties older than fifty years where hidden conditions are likely. Loosen only when your rehab costs are genuinely predictable and your sale timeline is short.",
        },
        {
          q: "Does the rule work for a rental instead of a flip?",
          a: "Not really. Rentals are underwritten on cash flow, cap rate and debt service coverage rather than resale margin, so ARV matters mainly for refinancing. If you plan to refinance out, ARV still sets your ceiling, but the seventy percent screen is the wrong test for a hold.",
        },
        {
          q: "How do I get the rehab number to put into this?",
          a: "Use the free rehab cost calculator to build a room by room planning range, then enter the high end here rather than the low end. Deals should survive the pessimistic version of the budget, because the pessimistic version is the one that tends to happen.",
        },
        {
          q: "Can I trust the profit figure?",
          a: "Treat it as a screen, not a forecast. It reflects the inputs you gave it and cannot know your financing terms, your actual holding period, concessions at closing or what an inspection will turn up. Deals that look thin here are almost always thinner in reality.",
        },
      ]}
      related={[
        "/arv-calculator",
        "/rehab-cost-calculator",
        "/ai-design-for-house-flippers",
        "/rental-grade-vs-retail-grade",
        "/renovation-cost-estimator",
        "/free/rehab-cost-calculator",
      ]}
      ctaTitle="Know The Highest Price The Deal Survives."
      ctaBody="ARV, rehab, maximum allowable offer. Free, and no account required."
    />
  );
}
