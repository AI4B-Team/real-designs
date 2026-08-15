/* Founding member FAQ copy.
   Kept out of the route file so the route's head() can read it after the
   shared-module split (route-local consts are not exported to that chunk). */
export const FOUNDERS_FAQ: [string, string][] = [
  [
    "What does founding pricing lock in?",
    "The launch rate on the plan you choose, for as long as your subscription stays active. When we raise prices later, your rate stays where it started.",
  ],
  [
    "How is the remaining count calculated?",
    "It is read live from claimed founding accounts. There is no countdown timer and no reset.",
  ],
  [
    "What is the fast action bonus?",
    "Every founding account includes the Renovation Planning Pack, a $49 value, added to the workspace on signup.",
  ],
  [
    "What happens when the 500 are gone?",
    "The offer closes and standard pricing applies. Existing founding accounts are unaffected.",
  ],
  [
    "Is there a guarantee?",
    "Yes. Every paid plan includes a 30 day money back guarantee and cancels from your dashboard in two clicks.",
  ],
];
