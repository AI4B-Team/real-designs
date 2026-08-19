/* Pricing FAQ copy.
   Lives outside the route file so head() can read it after the TanStack
   shared-module split (route-local consts are not exported to that chunk). */
export const PRICING_FAQ: [string, string][] = [
  [
    "Which Plan Is Right For Me?",
    "If you are redesigning your own home, Starter is enough. If you work on several properties and need commercial rights, choose Pro. If you present to clients with a team, choose Studio.",
  ],
  [
    "What Counts As A Credit?",
    "A credit is the usage meter, not the product. Most redesigns use one credit. Floor plans and walkthroughs cost more, and the cost is always shown before you generate.",
  ],
  [
    "Can I Buy One Project Without Subscribing?",
    "Yes. Project packs cover a single room, a listing or a whole home as a one time purchase.",
  ],
  [
    "Is Budget & Scope Planning Available?",
    "Not yet. Cost estimation and contractor scope tools are coming soon and are not part of any current plan or credit balance.",
  ],
  [
    "Can I Use The Images Commercially?",
    "Yes on Pro and Studio. Starter is a personal use license, and free downloads are watermarked and not licensed for marketing use.",
  ],
  [
    "Do Unused Credits Roll Over?",
    "Plan credits reset each billing period. Credits you purchase separately stay in your balance while your subscription is active.",
  ],
  [
    "Can I Cancel Or Change Plans?",
    "Yes, in two clicks from your dashboard. Upgrades apply immediately and downgrades start at your next billing date.",
  ],
  [
    "What Happens To My Projects After Cancellation?",
    "Everything you already generated stays yours to download. Your projects remain viewable in read only mode, and paid features pause until you resubscribe.",
  ],
];
