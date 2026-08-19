// Per-style preview photography. One realistic image per catalog style so the
// image always matches the style name and description.
import imgWarmMinimal from "@/assets/styles/warm-minimal.jpg";
import imgOrganicModern from "@/assets/styles/organic-modern.jpg";
import imgModern from "@/assets/styles/modern.jpg";
import imgContemporary from "@/assets/styles/contemporary.jpg";
import imgTransitional from "@/assets/styles/transitional.jpg";
import imgModernFarmhouse from "@/assets/styles/modern-farmhouse.jpg";
import imgMidCenturyModern from "@/assets/styles/mid-century-modern.jpg";
import imgJapandi from "@/assets/styles/japandi.jpg";
import imgScandinavian from "@/assets/styles/scandinavian.jpg";
import imgCoastal from "@/assets/styles/coastal.jpg";
import imgQuietLuxury from "@/assets/styles/quiet-luxury.jpg";
import imgTraditional from "@/assets/styles/traditional.jpg";
import imgMinimalist from "@/assets/styles/minimalist.jpg";
import imgBauhaus from "@/assets/styles/bauhaus.jpg";
import imgIndustrial from "@/assets/styles/industrial.jpg";
import imgSoftContemporary from "@/assets/styles/soft-contemporary.jpg";
import imgUrbanModern from "@/assets/styles/urban-modern.jpg";
import imgFuturistic from "@/assets/styles/futuristic.jpg";
import imgModernLuxury from "@/assets/styles/modern-luxury.jpg";
import imgScandinavianModern from "@/assets/styles/scandinavian-modern.jpg";
import imgAffordableScandinavian from "@/assets/styles/affordable-scandinavian.jpg";
import imgHollywoodRegency from "@/assets/styles/hollywood-regency.jpg";
import imgHollywoodGlam from "@/assets/styles/hollywood-glam.jpg";
import imgArtDeco from "@/assets/styles/art-deco.jpg";
import imgArtNouveau from "@/assets/styles/art-nouveau.jpg";
import imgFrenchCountry from "@/assets/styles/french-country.jpg";
import imgEnglishCountry from "@/assets/styles/english-country.jpg";
import imgMediterranean from "@/assets/styles/mediterranean.jpg";
import imgNeoclassical from "@/assets/styles/neoclassical.jpg";
import imgEuropeanTraditional from "@/assets/styles/european-traditional.jpg";
import imgParisian from "@/assets/styles/parisian.jpg";
import imgCaliforniaCasual from "@/assets/styles/california-casual.jpg";
import imgCoastalGrandmother from "@/assets/styles/coastal-grandmother.jpg";
import imgBiophilic from "@/assets/styles/biophilic.jpg";
import imgWabiSabi from "@/assets/styles/wabi-sabi.jpg";
import imgRustic from "@/assets/styles/rustic.jpg";
import imgCottagecore from "@/assets/styles/cottagecore.jpg";
import imgJapanese from "@/assets/styles/japanese.jpg";
import imgZen from "@/assets/styles/zen.jpg";
import imgBalinese from "@/assets/styles/balinese.jpg";
import imgTropical from "@/assets/styles/tropical.jpg";
import imgDesertModern from "@/assets/styles/desert-modern.jpg";
import imgMountainModern from "@/assets/styles/mountain-modern.jpg";
import imgEclectic from "@/assets/styles/eclectic.jpg";
import imgBohemian from "@/assets/styles/bohemian.jpg";
import imgScandiBoho from "@/assets/styles/scandi-boho.jpg";
import imgMaximalist from "@/assets/styles/maximalist.jpg";
import imgGlamRock from "@/assets/styles/glam-rock.jpg";
import imgRetro from "@/assets/styles/retro.jpg";
import imgMemphis from "@/assets/styles/memphis.jpg";
import imgDarkAcademia from "@/assets/styles/dark-academia.jpg";
import imgGrandmillennial from "@/assets/styles/grandmillennial.jpg";
import imgVintage from "@/assets/styles/vintage.jpg";
import imgTraditionalFarmhouse from "@/assets/styles/traditional-farmhouse.jpg";
import imgRusticFarmhouse from "@/assets/styles/rustic-farmhouse.jpg";
import imgModernCountry from "@/assets/styles/modern-country.jpg";
import imgCottage from "@/assets/styles/cottage.jpg";
import imgSouthwestern from "@/assets/styles/southwestern.jpg";
import imgLodge from "@/assets/styles/lodge.jpg";
import imgCraftsman from "@/assets/styles/craftsman.jpg";
import imgColonial from "@/assets/styles/colonial.jpg";
import imgTudor from "@/assets/styles/tudor.jpg";
import imgSpanishRevival from "@/assets/styles/spanish-revival.jpg";
import imgRanch from "@/assets/styles/ranch.jpg";
import imgVictorian from "@/assets/styles/victorian.jpg";
import imgCapeCod from "@/assets/styles/cape-cod.jpg";
import imgPrairie from "@/assets/styles/prairie.jpg";
import imgEuropeanEstate from "@/assets/styles/european-estate.jpg";
import imgGardenModernMinimal from "@/assets/styles/garden-modern-minimal.jpg";
import imgGardenEnglishCottage from "@/assets/styles/garden-english-cottage.jpg";
import imgGardenJapaneseZen from "@/assets/styles/garden-japanese-zen.jpg";
import imgGardenXeriscape from "@/assets/styles/garden-xeriscape.jpg";
import imgGardenFormalEuropean from "@/assets/styles/garden-formal-european.jpg";
import imgGardenFrenchFormal from "@/assets/styles/garden-french-formal.jpg";
import imgGardenWoodland from "@/assets/styles/garden-woodland.jpg";
import imgGardenPrairieNative from "@/assets/styles/garden-prairie-native.jpg";
import imgGardenResort from "@/assets/styles/garden-resort.jpg";
import imgGardenCourtyard from "@/assets/styles/garden-courtyard.jpg";
import imgGardenRooftopUrban from "@/assets/styles/garden-rooftop-urban.jpg";
import imgGardenEdible from "@/assets/styles/garden-edible.jpg";

export const STYLE_PHOTOS: Record<string, string> = {
  "warm-minimal": imgWarmMinimal,
  "organic-modern": imgOrganicModern,
  modern: imgModern,
  contemporary: imgContemporary,
  transitional: imgTransitional,
  "modern-farmhouse": imgModernFarmhouse,
  "mid-century-modern": imgMidCenturyModern,
  japandi: imgJapandi,
  scandinavian: imgScandinavian,
  coastal: imgCoastal,
  "quiet-luxury": imgQuietLuxury,
  traditional: imgTraditional,
  minimalist: imgMinimalist,
  bauhaus: imgBauhaus,
  industrial: imgIndustrial,
  "soft-contemporary": imgSoftContemporary,
  "urban-modern": imgUrbanModern,
  futuristic: imgFuturistic,
  "modern-luxury": imgModernLuxury,
  "scandinavian-modern": imgScandinavianModern,
  "affordable-scandinavian": imgAffordableScandinavian,
  "hollywood-regency": imgHollywoodRegency,
  "hollywood-glam": imgHollywoodGlam,
  "art-deco": imgArtDeco,
  "art-nouveau": imgArtNouveau,
  "french-country": imgFrenchCountry,
  "english-country": imgEnglishCountry,
  mediterranean: imgMediterranean,
  neoclassical: imgNeoclassical,
  "european-traditional": imgEuropeanTraditional,
  parisian: imgParisian,
  "california-casual": imgCaliforniaCasual,
  "coastal-grandmother": imgCoastalGrandmother,
  biophilic: imgBiophilic,
  "wabi-sabi": imgWabiSabi,
  rustic: imgRustic,
  cottagecore: imgCottagecore,
  japanese: imgJapanese,
  zen: imgZen,
  balinese: imgBalinese,
  tropical: imgTropical,
  "desert-modern": imgDesertModern,
  "mountain-modern": imgMountainModern,
  eclectic: imgEclectic,
  bohemian: imgBohemian,
  "scandi-boho": imgScandiBoho,
  maximalist: imgMaximalist,
  "glam-rock": imgGlamRock,
  retro: imgRetro,
  memphis: imgMemphis,
  "dark-academia": imgDarkAcademia,
  grandmillennial: imgGrandmillennial,
  vintage: imgVintage,
  "traditional-farmhouse": imgTraditionalFarmhouse,
  "rustic-farmhouse": imgRusticFarmhouse,
  "modern-country": imgModernCountry,
  cottage: imgCottage,
  southwestern: imgSouthwestern,
  lodge: imgLodge,
  craftsman: imgCraftsman,
  colonial: imgColonial,
  tudor: imgTudor,
  "spanish-revival": imgSpanishRevival,
  ranch: imgRanch,
  victorian: imgVictorian,
  "cape-cod": imgCapeCod,
  prairie: imgPrairie,
  "european-estate": imgEuropeanEstate,
  "garden-modern-minimal": imgGardenModernMinimal,
  "garden-english-cottage": imgGardenEnglishCottage,
  "garden-japanese-zen": imgGardenJapaneseZen,
  "garden-xeriscape": imgGardenXeriscape,
  "garden-formal-european": imgGardenFormalEuropean,
  "garden-french-formal": imgGardenFrenchFormal,
  "garden-woodland": imgGardenWoodland,
  "garden-prairie-native": imgGardenPrairieNative,
  "garden-resort": imgGardenResort,
  "garden-courtyard": imgGardenCourtyard,
  "garden-rooftop-urban": imgGardenRooftopUrban,
  "garden-edible": imgGardenEdible,
};
