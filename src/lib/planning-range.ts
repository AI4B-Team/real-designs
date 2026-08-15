/**
 * Deterministic planning-range engine shared by the free calculators and the
 * landing page builder. No image, no account, no model call: published unit
 * rates times measured quantities, adjusted by finish grade.
 *
 * Every number this produces is a planning range, never a bid.
 */

export type FinishGrade = "rental" | "retail" | "premium";

export type RoomKey =
  | "kitchen"
  | "bathroom"
  | "living"
  | "bedroom"
  | "wholeHome"
  | "exterior"
  | "landscape";

export type CalcLine = {
  item: string;
  trade: string;
  qty: string;
  low: number;
  high: number;
};

export type CalcResult = {
  lines: CalcLine[];
  subtotalLow: number;
  subtotalHigh: number;
  contingencyPct: number;
  totalLow: number;
  totalHigh: number;
  perSfLow: number;
  perSfHigh: number;
  confidence: "High" | "Medium" | "Low";
};

export const ROOMS: { key: RoomKey; label: string; defaultSf: number }[] = [
  { key: "kitchen", label: "Kitchen", defaultSf: 180 },
  { key: "bathroom", label: "Bathroom", defaultSf: 45 },
  { key: "living", label: "Living Room", defaultSf: 300 },
  { key: "bedroom", label: "Bedroom", defaultSf: 160 },
  { key: "wholeHome", label: "Whole Home", defaultSf: 1500 },
  { key: "exterior", label: "Exterior", defaultSf: 1400 },
  { key: "landscape", label: "Landscape", defaultSf: 2000 },
];

export const GRADES: { key: FinishGrade; label: string; note: string }[] = [
  { key: "rental", label: "Rental Grade", note: "Durable, replaceable, tenant turn" },
  { key: "retail", label: "Retail Grade", note: "Resale buyer expectations" },
  { key: "premium", label: "Premium", note: "High end finishes and fixtures" },
];

const GRADE_FACTOR: Record<FinishGrade, number> = {
  rental: 0.72,
  retail: 1,
  premium: 1.55,
};

/** Base retail-grade cost per square foot of the room, low and high. */
type Recipe = { line: string; trade: string; unit: "sf" | "ls" | "lf"; low: number; high: number };

const RECIPES: Record<RoomKey, Recipe[]> = {
  kitchen: [
    { line: "Demolition & Disposal", trade: "Demolition", unit: "sf", low: 3.2, high: 4.4 },
    { line: "Cabinetry", trade: "Cabinetry", unit: "sf", low: 44, high: 66 },
    { line: "Countertops", trade: "Countertops", unit: "sf", low: 16, high: 24 },
    { line: "Tile Backsplash", trade: "Tile", unit: "sf", low: 6.5, high: 9.5 },
    { line: "Flooring", trade: "Flooring", unit: "sf", low: 8.5, high: 13 },
    { line: "Paint, Walls & Ceiling", trade: "Paint", unit: "sf", low: 4.2, high: 6.1 },
    { line: "Plumbing, Sink & Faucet", trade: "Plumbing", unit: "ls", low: 900, high: 1500 },
    { line: "Electrical & Lighting", trade: "Electrical", unit: "ls", low: 1100, high: 1900 },
    { line: "Appliance Set", trade: "Appliances", unit: "ls", low: 2400, high: 4600 },
  ],
  bathroom: [
    { line: "Demolition & Disposal", trade: "Demolition", unit: "sf", low: 8, high: 12 },
    { line: "Tub Or Shower Assembly", trade: "Plumbing", unit: "ls", low: 1600, high: 3200 },
    { line: "Wall & Floor Tile", trade: "Tile", unit: "sf", low: 42, high: 68 },
    { line: "Vanity & Top", trade: "Cabinetry", unit: "ls", low: 700, high: 1700 },
    { line: "Toilet, Sink & Trim", trade: "Plumbing", unit: "ls", low: 750, high: 1400 },
    { line: "Paint & Drywall Repair", trade: "Paint", unit: "sf", low: 7, high: 11 },
    { line: "Exhaust, Lighting & Devices", trade: "Electrical", unit: "ls", low: 550, high: 1050 },
  ],
  living: [
    { line: "Flooring", trade: "Flooring", unit: "sf", low: 7.5, high: 12 },
    { line: "Paint, Walls & Ceiling", trade: "Paint", unit: "sf", low: 3.6, high: 5.4 },
    { line: "Trim & Baseboard", trade: "Carpentry", unit: "sf", low: 2.4, high: 4 },
    { line: "Lighting & Devices", trade: "Electrical", unit: "sf", low: 2.8, high: 4.6 },
    { line: "Furniture & Soft Goods", trade: "Furnishing", unit: "sf", low: 11, high: 22 },
  ],
  bedroom: [
    { line: "Flooring", trade: "Flooring", unit: "sf", low: 7, high: 11 },
    { line: "Paint, Walls & Ceiling", trade: "Paint", unit: "sf", low: 3.4, high: 5.2 },
    { line: "Closet Build Out", trade: "Carpentry", unit: "ls", low: 450, high: 1400 },
    { line: "Lighting & Devices", trade: "Electrical", unit: "sf", low: 2.2, high: 3.8 },
    { line: "Furniture & Soft Goods", trade: "Furnishing", unit: "sf", low: 9, high: 18 },
  ],
  wholeHome: [
    { line: "Flooring Throughout", trade: "Flooring", unit: "sf", low: 7, high: 11.5 },
    { line: "Interior Paint", trade: "Paint", unit: "sf", low: 3.1, high: 4.7 },
    { line: "Kitchen Allowance", trade: "Cabinetry", unit: "ls", low: 12000, high: 26000 },
    { line: "Bathroom Allowance", trade: "Plumbing", unit: "ls", low: 7500, high: 16000 },
    { line: "Interior Doors & Trim", trade: "Carpentry", unit: "sf", low: 2.2, high: 3.6 },
    { line: "Electrical Refresh", trade: "Electrical", unit: "sf", low: 2.6, high: 4.4 },
    { line: "HVAC Service Or Replacement", trade: "Mechanical", unit: "ls", low: 1200, high: 8500 },
  ],
  exterior: [
    { line: "Pressure Wash & Prep", trade: "Prep", unit: "sf", low: 0.5, high: 0.9 },
    { line: "Siding Repair", trade: "Carpentry", unit: "sf", low: 1.4, high: 3.6 },
    { line: "Exterior Paint", trade: "Paint", unit: "sf", low: 2.6, high: 4.4 },
    { line: "Trim, Shutters & Front Door", trade: "Carpentry", unit: "ls", low: 900, high: 3200 },
    { line: "Roof Repair Allowance", trade: "Roofing", unit: "ls", low: 800, high: 6500 },
    { line: "Exterior Lighting & Hardware", trade: "Electrical", unit: "ls", low: 450, high: 1400 },
  ],
  landscape: [
    { line: "Clearing & Grading", trade: "Sitework", unit: "sf", low: 0.9, high: 1.8 },
    { line: "Sod Or Lawn Restoration", trade: "Planting", unit: "sf", low: 1.1, high: 2.2 },
    { line: "Planting Beds & Mulch", trade: "Planting", unit: "sf", low: 2.4, high: 5.2 },
    { line: "Hardscape, Walkway Or Patio", trade: "Hardscape", unit: "ls", low: 2200, high: 9500 },
    { line: "Irrigation Adjustment", trade: "Irrigation", unit: "ls", low: 450, high: 2400 },
    { line: "Landscape Lighting", trade: "Electrical", unit: "ls", low: 600, high: 2600 },
  ],
};

const money = (n: number) => Math.round(n / 10) * 10;

export function estimate(room: RoomKey, sf: number, grade: FinishGrade): CalcResult {
  const area = Math.max(20, Math.min(12000, Math.round(sf) || 0));
  const gf = GRADE_FACTOR[grade];
  const recipes = RECIPES[room];

  const lines: CalcLine[] = recipes.map((r) => {
    const mult = r.unit === "ls" ? 1 : area;
    return {
      item: r.line,
      trade: r.trade,
      qty: r.unit === "ls" ? "1 LS" : `${area} SF`,
      low: money(r.low * mult * gf),
      high: money(r.high * mult * gf),
    };
  });

  const subtotalLow = lines.reduce((s, l) => s + l.low, 0);
  const subtotalHigh = lines.reduce((s, l) => s + l.high, 0);
  const contingencyPct = 10;
  const totalLow = money(subtotalLow * 1.1);
  const totalHigh = money(subtotalHigh * 1.1);

  return {
    lines,
    subtotalLow,
    subtotalHigh,
    contingencyPct,
    totalLow,
    totalHigh,
    perSfLow: Math.round((totalLow / area) * 10) / 10,
    perSfHigh: Math.round((totalHigh / area) * 10) / 10,
    // Typed dimensions are user supplied, so layout confidence is high;
    // pricing confidence drops on the two allowance-heavy scopes.
    confidence: room === "wholeHome" || room === "exterior" ? "Medium" : "High",
  };
}

export const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/* ARV                                                                 */
/* ------------------------------------------------------------------ */

export type ArvInput = {
  /** Current as-is value or purchase price. */
  asIs: number;
  /** Planned rehab budget. */
  rehab: number;
  /** Condition of the property today. */
  condition: "dated" | "worn" | "distressed";
  /** Ceiling set by the best comparable sale on the street. */
  compCeiling?: number;
};

export type ArvResult = {
  arvLow: number;
  arvHigh: number;
  liftLow: number;
  liftHigh: number;
  recoupLow: number;
  recoupHigh: number;
  maxOffer: number;
  cappedByComps: boolean;
};

/**
 * Recoup multiples are deliberately conservative and expressed as a range.
 * Worse starting condition returns more per dollar because the first dollars
 * buy back the discount the condition created.
 */
const RECOUP: Record<ArvInput["condition"], [number, number]> = {
  dated: [0.95, 1.35],
  worn: [1.1, 1.55],
  distressed: [1.25, 1.85],
};

export function estimateArv(input: ArvInput): ArvResult {
  const asIs = Math.max(0, input.asIs || 0);
  const rehab = Math.max(0, input.rehab || 0);
  const [rl, rh] = RECOUP[input.condition];

  const liftLow = money(rehab * rl);
  const liftHigh = money(rehab * rh);

  let arvLow = money(asIs + liftLow);
  let arvHigh = money(asIs + liftHigh);

  const ceiling = input.compCeiling && input.compCeiling > 0 ? input.compCeiling : 0;
  const cappedByComps = ceiling > 0 && arvHigh > ceiling;
  if (cappedByComps) {
    arvHigh = ceiling;
    if (arvLow > ceiling) arvLow = ceiling;
  }

  // The long-standing flipper rule of thumb: 70 percent of ARV, less the rehab.
  const maxOffer = money(arvLow * 0.7 - rehab);

  return {
    arvLow,
    arvHigh,
    liftLow,
    liftHigh,
    recoupLow: Math.round(rl * 100),
    recoupHigh: Math.round(rh * 100),
    maxOffer: Math.max(0, maxOffer),
    cappedByComps,
  };
}
