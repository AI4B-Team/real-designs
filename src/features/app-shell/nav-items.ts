/** Sidebar navigation model for the authenticated shell. */
export type NavItem = {
  /** Legacy view key (`data-v`), also used for the `#v-<key>` deep link. */
  view: string;
  label: string;
  icon: string;
  /** Id of the live counter badge the workspace loader writes into. */
  countId?: string;
};

export type NavGroup = {
  /** Group heading, omitted for the first (ungrouped) item. */
  title?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ view: "dash", label: "Dashboard", icon: "home" }] },
  {
    title: "Create",
    items: [
      { view: "studio", label: "Studio", icon: "wand-2" },
      { view: "explore", label: "Explore", icon: "compass" },
    ],
  },
  {
    title: "Manage",
    items: [
      { view: "props", label: "Properties", icon: "map-pin", countId: "cntProps" },
      { view: "designs", label: "Designs", icon: "images", countId: "cntDesigns" },
      { view: "media", label: "Media", icon: "image-plus" },
      { view: "listings", label: "Batch", icon: "building-2" },
    ],
  },
  {
    title: "Plan",
    items: [
      { view: "scope", label: "Budget", icon: "calculator" },
      { view: "products", label: "Products", icon: "shopping-bag" },
      { view: "reports", label: "Reports", icon: "bar-chart-3" },
    ],
  },
  {
    title: "Share",
    items: [{ view: "present", label: "Presentations", icon: "presentation" }],
  },
];

/** Scopes offered by the topbar search caret menu. */
export const SEARCH_SCOPES = [
  { scope: "All", label: "Everything", icon: "search", meta: "Default" },
  { scope: "Properties", label: "Properties", icon: "map-pin", meta: "0" },
  { scope: "Rooms", label: "Rooms", icon: "sofa", meta: "0" },
  { scope: "Designs", label: "Designs", icon: "images", meta: "0" },
  { scope: "Products", label: "Products", icon: "shopping-bag", meta: "0" },
  { scope: "Presentations", label: "Presentations", icon: "presentation", meta: "0" },
];
