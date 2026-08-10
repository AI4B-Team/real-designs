/** Footer and internal-link navigation for the programmatic landing pages. */

export type NavLink = { href: string; label: string };
export type NavGroup = { heading: string; links: NavLink[] };

export const DESIGN_LINKS: NavLink[] = [
  { href: "/ai-interior-design", label: "AI Interior Design" },
  { href: "/ai-exterior-design", label: "AI Exterior Design" },
  { href: "/ai-landscape-design", label: "AI Landscape Design" },
  { href: "/ai-virtual-staging", label: "AI Virtual Staging" },
  { href: "/ai-kitchen-design", label: "AI Kitchen Design" },
  { href: "/ai-bathroom-design", label: "AI Bathroom Design" },
  { href: "/sketch-to-render", label: "Sketch To Render" },
  { href: "/2d-to-3d-floor-plan", label: "2D Plan To Furnished 3D" },
  { href: "/declutter-photo", label: "Remove Furniture And Clutter" },
  { href: "/airbnb-interior-design", label: "Airbnb Interior Design" },
  { href: "/curb-appeal-ideas", label: "Curb Appeal Ideas" },
];

export const PLAN_LINKS: NavLink[] = [
  { href: "/rehab-cost-calculator", label: "Rehab Cost Calculator" },
  { href: "/arv-calculator", label: "ARV Calculator" },
  { href: "/renovation-cost-estimator", label: "Renovation Cost Estimator" },
  { href: "/contractor-scope-generator", label: "Contractor Scope Generator" },
  { href: "/kitchen-remodel-cost", label: "Kitchen Remodel Cost" },
  { href: "/bathroom-remodel-cost", label: "Bathroom Remodel Cost" },
  { href: "/rental-grade-vs-retail-grade", label: "Rental Grade vs Retail Grade" },
  { href: "/virtual-staging-disclosure-rules", label: "Staging Disclosure Rules" },
  { href: "/mls-photo-rules", label: "MLS Photo Rules" },
  { href: "/whole-house-renovation-cost", label: "Whole House Renovation Cost" },
  { href: "/flooring-installation-cost", label: "Flooring Installation Cost" },
  { href: "/home-staging-cost", label: "Home Staging Cost" },
  { href: "/brrrr-calculator", label: "BRRRR Calculator" },
];

export const AUDIENCE_LINKS: NavLink[] = [
  { href: "/ai-design-for-house-flippers", label: "House Flippers" },
  { href: "/for-contractors", label: "Contractors" },
  { href: "/for-real-estate-agents", label: "Real Estate Agents" },
  { href: "/for-property-managers", label: "Property Managers" },
  { href: "/for-interior-designers", label: "Interior Designers" },
  { href: "/for-landlords", label: "Landlords" },
];

export const FREE_TOOL_LINKS: NavLink[] = [
  { href: "/free/ai-interior-design", label: "Free AI Redesign" },
  { href: "/free/virtual-staging", label: "Free Virtual Staging" },
  { href: "/free/rehab-cost-calculator", label: "Free Rehab Calculator" },
  { href: "/free/arv-calculator", label: "Free ARV Calculator" },
];

export const FOOTER_GROUPS: NavGroup[] = [
  {
    heading: "Design",
    links: [
      { href: "/ai-interior-design", label: "Interior" },
      { href: "/ai-exterior-design", label: "Exterior" },
      { href: "/ai-landscape-design", label: "Landscape" },
      { href: "/ai-virtual-staging", label: "Virtual Staging" },
      { href: "/sketch-to-render", label: "Sketch To Render" },
      { href: "/resources", label: "View All Features" },
    ],
  },
  {
    heading: "Planning",
    links: [
      { href: "/renovation-cost-estimator", label: "Budget & Scope" },
      { href: "/rehab-cost-calculator", label: "Rehab Calculator" },
      { href: "/arv-calculator", label: "ARV Calculator" },
      { href: "/contractor-scope-generator", label: "Contractor Brief" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    heading: "Who It's For",
    links: [
      { href: "/ai-design-for-house-flippers", label: "Investors" },
      { href: "/for-real-estate-agents", label: "Agents" },
      { href: "/for-interior-designers", label: "Designers" },
      { href: "/for-contractors", label: "Contractors" },
      { href: "/for-property-managers", label: "Property Managers" },
      { href: "/for-landlords", label: "Landlords" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/#why", label: "Why REAL DESIGNS" },
      { href: "/pricing", label: "Pricing" },
      { href: "/resources", label: "Help Center" },
      { href: "/terms", label: "Fair Use" },
      { href: "/refund-policy", label: "Refunds" },
      { href: "/privacy", label: "Terms & Privacy" },
    ],
  },
];

export const POPULAR_TOOL_LINKS: NavLink[] = [
  { href: "/free/ai-interior-design", label: "AI Redesign" },
  { href: "/free/virtual-staging", label: "Virtual Staging" },
  { href: "/free/rehab-cost-calculator", label: "Rehab Calculator" },
  { href: "/free/arv-calculator", label: "ARV Calculator" },
  { href: "/resources", label: "View All Tools" },
];

/** Every URL that belongs in sitemap.xml, in priority order. */
export const ALL_PAGE_PATHS: string[] = [
  ...FREE_TOOL_LINKS.map((l) => l.href),
  ...DESIGN_LINKS.map((l) => l.href),
  ...PLAN_LINKS.map((l) => l.href),
  ...AUDIENCE_LINKS.map((l) => l.href),
];

export const LABEL_BY_PATH: Record<string, string> = Object.fromEntries(
  [...DESIGN_LINKS, ...PLAN_LINKS, ...AUDIENCE_LINKS, ...FREE_TOOL_LINKS].map((l) => [
    l.href,
    l.label,
  ]),
);
