/**
 * Compatibility surface over the one navigation registry.
 *
 * Older call sites import NAV_GROUPS / SEARCH_SCOPES from here. The data now
 * comes from `navigation.ts`, evaluated against the feature registry, so there
 * is exactly one place that decides what the shell advertises.
 */
import { navigationFor, type NavDestination, type NavSection } from "./navigation";

export type NavItem = NavDestination;
export type NavGroup = NavSection;

export const NAV_GROUPS: NavGroup[] = navigationFor();

export { navigationFor, navigationViews, SEARCH_SCOPES } from "./navigation";
