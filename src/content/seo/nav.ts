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
  { heading: "Design", links: DESIGN_LINKS },
  { heading: "Plan", links: PLAN_LINKS },
  { heading: "Who It's For", links: AUDIENCE_LINKS },
  { heading: "Free Tools", links: FREE_TOOL_LINKS },
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
