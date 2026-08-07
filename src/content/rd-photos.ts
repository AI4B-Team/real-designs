// Shared realistic photography used by both the marketing site and the back office.
import roomBefore from "@/assets/room-before.jpg";
import roomAfter from "@/assets/room-after.jpg";
import roomKitchen from "@/assets/room-kitchen.jpg";
import roomBath from "@/assets/room-bath.jpg";
import exteriorBefore from "@/assets/exterior-before.jpg";
import styleCoastal from "@/assets/style-coastal.jpg";
import styleFarmhouse from "@/assets/style-farmhouse.jpg";
import styleJapandi from "@/assets/style-japandi.jpg";
import styleMidcentury from "@/assets/style-midcentury.jpg";
import styleIndustrial from "@/assets/style-industrial.jpg";
import styleLuxury from "@/assets/style-luxury.jpg";
import styleNeutral from "@/assets/style-neutral.jpg";
import styleRanch from "@/assets/style-ranch.jpg";
import stylePaintedBrick from "@/assets/style-paintedbrick.jpg";
import styleResortYard from "@/assets/style-resortyard.jpg";
import styleCraftsman from "@/assets/style-craftsman.jpg";
import roomClutter from "@/assets/room-clutter.jpg";
import roomEmpty from "@/assets/room-empty.jpg";
import kitchenBefore from "@/assets/kitchen-before.jpg";
import yardBefore from "@/assets/yard-before.jpg";
import wfOriginal from "@/assets/wf-original.jpg";
import wfEmpty from "@/assets/wf-empty.jpg";
import wfDesigned from "@/assets/wf-designed.jpg";
import kitchenAfter from "@/assets/kitchen-after.jpg";
import bathBefore from "@/assets/bath-before.jpg";
import bedroomBefore from "@/assets/bedroom-before.jpg";
import bedroomAfter from "@/assets/bedroom-after.jpg";
import officeBefore from "@/assets/office-before.jpg";
import officeAfter from "@/assets/office-after.jpg";
import exteriorAfter from "@/assets/exterior-after.jpg";
import yardAfter from "@/assets/yard-after.jpg";
import plan2d from "@/assets/rd-plan-02-2d.jpg";
import plan3d from "@/assets/rd-plan-03-3d.jpg";
import sketchHand from "@/assets/rd-plan-01-napkin.jpg";
import sketchRender from "@/assets/rd-plan-04-photo.jpg";
import stageEmpty from "@/assets/stage-empty.jpg";
import stageStaged from "@/assets/stage-staged.jpg";
import stageClutter from "@/assets/stage-clutter.jpg";

export const PHOTOS = {
  before: roomBefore,
  after: roomAfter,
  kitchen: roomKitchen,
  bath: roomBath,
  exteriorBefore,
  coastal: styleCoastal,
  farmhouse: styleFarmhouse,
  japandi: styleJapandi,
  midcentury: styleMidcentury,
  industrial: styleIndustrial,
  luxury: styleLuxury,
  neutral: styleNeutral,
  ranch: styleRanch,
  paintedBrick: stylePaintedBrick,
  resortYard: styleResortYard,
  craftsman: styleCraftsman,
  clutter: roomClutter,
  empty: roomEmpty,
  stageEmpty,
  stageStaged,
  stageClutter,
  kitchenBefore,
  yardBefore,
  wfOriginal,
  wfEmpty,
  wfDesigned,
  kitchenAfter,
  bathBefore,
  bedroomBefore,
  bedroomAfter,
  officeBefore,
  officeAfter,
  exteriorAfter,
  yardAfter,
  plan2d,
  plan3d,
  sketchHand,
  sketchRender,
} as const;

export function photo(src: string, alt: string) {
  return `<img src="${src}" alt="${alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">`;
}
