import type { LandingPage } from "@/content/seo/types";

import { page as aiInteriorDesign } from "@/content/seo/pages/ai-interior-design";
import { page as aiExteriorDesign } from "@/content/seo/pages/ai-exterior-design";
import { page as aiLandscapeDesign } from "@/content/seo/pages/ai-landscape-design";
import { page as aiVirtualStaging } from "@/content/seo/pages/ai-virtual-staging";
import { page as aiKitchenDesign } from "@/content/seo/pages/ai-kitchen-design";
import { page as aiBathroomDesign } from "@/content/seo/pages/ai-bathroom-design";
import { page as rehabCostCalculator } from "@/content/seo/pages/rehab-cost-calculator";
import { page as arvCalculator } from "@/content/seo/pages/arv-calculator";
import { page as renovationCostEstimator } from "@/content/seo/pages/renovation-cost-estimator";
import { page as contractorScopeGenerator } from "@/content/seo/pages/contractor-scope-generator";
import { page as kitchenRemodelCost } from "@/content/seo/pages/kitchen-remodel-cost";
import { page as bathroomRemodelCost } from "@/content/seo/pages/bathroom-remodel-cost";
import { page as forFlippers } from "@/content/seo/pages/ai-design-for-house-flippers";
import { page as forContractors } from "@/content/seo/pages/for-contractors";
import { page as forAgents } from "@/content/seo/pages/for-real-estate-agents";
import { page as forPropertyManagers } from "@/content/seo/pages/for-property-managers";
import { page as forInteriorDesigners } from "@/content/seo/pages/for-interior-designers";
import { page as forLandlords } from "@/content/seo/pages/for-landlords";
import { page as stagingDisclosure } from "@/content/seo/pages/virtual-staging-disclosure-rules";
import { page as mlsPhotoRules } from "@/content/seo/pages/mls-photo-rules";
import { page as sketchToRender } from "@/content/seo/pages/sketch-to-render";
import { page as planTo3d } from "@/content/seo/pages/2d-to-3d-floor-plan";
import { page as declutterPhoto } from "@/content/seo/pages/declutter-photo";
import { page as gradeCompare } from "@/content/seo/pages/rental-grade-vs-retail-grade";

export const LANDING_PAGES: LandingPage[] = [
  aiInteriorDesign,
  aiExteriorDesign,
  aiLandscapeDesign,
  aiVirtualStaging,
  aiKitchenDesign,
  aiBathroomDesign,
  rehabCostCalculator,
  arvCalculator,
  renovationCostEstimator,
  contractorScopeGenerator,
  kitchenRemodelCost,
  bathroomRemodelCost,
  forFlippers,
  forContractors,
  forAgents,
  forPropertyManagers,
  forInteriorDesigners,
  forLandlords,
  stagingDisclosure,
  mlsPhotoRules,
  sketchToRender,
  planTo3d,
  declutterPhoto,
  gradeCompare,
];

/** Keyed by bare slug, without the leading slash. */
export const PAGE_BY_SLUG = new Map(
  LANDING_PAGES.map((p) => [p.slug.replace(/^\//, ""), p]),
);

export function getLandingPage(slug: string): LandingPage | undefined {
  return PAGE_BY_SLUG.get(slug.replace(/^\//, ""));
}
