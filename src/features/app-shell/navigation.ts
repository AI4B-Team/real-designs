/**
 * One navigation registry for both sidebar states.
 *
 * Expanded and collapsed rails render the same list: the collapsed rail shows
 * the icon and uses the same label as its tooltip, so an icon and a label can
 * never drift apart. Visibility is evaluated from the feature registry before
 * anything is rendered — a suppressed destination is never emitted and then
 * removed, so it cannot flash.
 */

import {
  DEFAULT_CONTEXT,
  evaluateFeature,
  type FeatureContext,
  type FeatureId,
} from "@/features/registry/features";

export interface NavDestination {
  /** Feature that owns this destination. */
  feature: FeatureId;
  /** Legacy view key (`data-v`), also the `#v-<key>` deep link. */
  view: string;
  /** One label, used for the expanded row and the collapsed tooltip. */
  label: string;
  /** One icon definition. */
  icon: string;
  /** Id of the live counter badge the workspace loader writes into. */
  countId?: string;
  /** Registry-driven badge; the shell never hardcodes badge markup. */
  badge?: string | null;
}

export interface NavSection {
  /** Group heading, omitted for the first (ungrouped) item. */
  title?: string;
  items: NavDestination[];
}

/**
 * The complete destination list, before evaluation. Nothing suppressed appears
 * here with a `nav` flag, so `navigationFor()` filters rather than repairs.
 */
const DESTINATIONS: NavSection[] = [
  { items: [{ feature: "dashboard", view: "dash", label: "Dashboard", icon: "home" }] },
  {
    title: "Create",
    items: [
      { feature: "studio", view: "studio", label: "Studio", icon: "panels-top-left" },
      { feature: "explore", view: "explore", label: "Explore", icon: "compass" },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        feature: "properties",
        view: "props",
        label: "Properties",
        icon: "map-pin",
        countId: "cntProps",
      },
      { feature: "designs", view: "designs", label: "Designs", icon: "images", countId: "cntDesigns" },
      /* Video is consolidated into Media on purpose: one destination. */
      { feature: "media", view: "media", label: "Media", icon: "image-plus" },
      { feature: "batch", view: "listings", label: "Batch", icon: "building-2" },
    ],
  },
  {
    title: "Plan",
    items: [
      /* Budget is suppressed in the feature registry, so it has no entry here
         and none is filtered in later. */
      { feature: "products", view: "products", label: "Products", icon: "shopping-bag" },
      { feature: "reports", view: "reports", label: "Reports", icon: "bar-chart-3" },
    ],
  },
  {
    title: "Share",
    items: [{ feature: "presentations", view: "present", label: "Presentations", icon: "presentation" }],
  },
];

/**
 * Sections a given context may see. Empty groups disappear with their heading,
 * and the result is identical for the expanded and collapsed rails.
 */
export function navigationFor(ctx: FeatureContext = DEFAULT_CONTEXT): NavSection[] {
  const out: NavSection[] = [];
  for (const section of DESTINATIONS) {
    const items: NavDestination[] = [];
    for (const item of section.items) {
      const verdict = evaluateFeature(item.feature, ctx);
      if (!verdict.visibleInNav) continue;
      items.push({ ...item, badge: verdict.badge ?? null });
    }
    if (!items.length) continue;
    out.push(section.title ? { title: section.title, items } : { items });
  }
  return out;
}

/** Flat list of visible view keys, for tests and route checks. */
export function navigationViews(ctx: FeatureContext = DEFAULT_CONTEXT): string[] {
  return navigationFor(ctx).flatMap((s) => s.items.map((i) => i.view));
}

/** Scopes offered by the topbar search caret menu, filtered by the registry. */
export const SEARCH_SCOPES = [
  { scope: "All", label: "Everything", icon: "search", meta: "Default" },
  { scope: "Properties", label: "Properties", icon: "map-pin", meta: "0" },
  { scope: "Rooms", label: "Rooms", icon: "sofa", meta: "0" },
  { scope: "Designs", label: "Designs", icon: "images", meta: "0" },
  { scope: "Products", label: "Products", icon: "shopping-bag", meta: "0" },
  { scope: "Presentations", label: "Presentations", icon: "presentation", meta: "0" },
];
