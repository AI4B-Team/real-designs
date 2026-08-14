import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, read-only pricing preview.
 *
 * Same arithmetic as buildScope, but it persists nothing and touches no
 * user-owned tables: only the three server-only reference tables
 * (markets, unit_costs, cost_mappings), read with the privileged client.
 * No model ever produces a dollar figure here; SQL and arithmetic do.
 */

const TRADE_BY_DIVISION: Record<string, string> = {
  "02 41 19": "Demolition",
  "06 22 00": "Carpentry",
  "08 14 00": "Doors",
  "09 30 13": "Tile",
  "09 65 19": "Flooring",
  "09 91 23": "Paint",
  "12 35 30": "Cabinetry",
  "12 36 61": "Countertops",
  "22 41 00": "Plumbing",
  "26 51 00": "Electrical",
};

const CONTINGENCY_PCT = 10;

const PreviewInput = z.object({
  market_id: z.string().uuid().optional(),
  grade: z.enum(["rental", "retail", "premium"]).default("retail"),
  floor_area_sf: z.number().positive(),
  wall_area_sf: z.number().positive(),
  perimeter_lf: z.number().positive(),
  dims_source: z.enum(["user", "floor_plan", "depth_estimate", "assumed"]).default("user"),
  budget_target: z.number().positive().nullable().optional(),
  items: z
    .array(
      z.object({
        label: z.string(),
        material: z.string().nullable().optional(),
        qty: z.number().positive().nullable().optional(),
      }),
    )
    .min(1),
});

const num = (v: unknown) => (v == null ? 0 : Number(v));

export const priceScopePreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PreviewInput.parse(input))
  .handler(async ({ data }) => {
    // Reference pricing tables are server-only: no anon/authenticated SELECT.
    // This handler reads them privileged and returns aggregated ranges only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = supabaseAdmin;


    const { data: markets, error: marketError } = await supabase
      .from("markets")
      .select("id, name, labor_factor, material_factor")
      .order("name");
    if (marketError) throw new Error(marketError.message);
    if (!markets || markets.length === 0) throw new Error("No markets configured.");

    const market = markets.find((m) => m.id === data.market_id) ?? markets[0]!;
    const laborFactor = num(market.labor_factor) || 1;
    const materialFactor = num(market.material_factor) || 1;

    const { data: mappings, error: mapError } = await supabase
      .from("cost_mappings")
      .select(
        `label, material, grade, qty_formula,
         unit_costs!inner ( item_code, description, uom, csi_division,
                            material_low, material_high, labor_low, labor_high, source )`,
      );
    if (mapError) throw new Error(mapError.message);

    const qtyFor = (formula: string) => {
      switch (formula) {
        case "floor_area_sf":
          return data.floor_area_sf;
        case "wall_area_sf":
          return data.wall_area_sf;
        case "perimeter_lf":
          return data.perimeter_lf;
        case "each":
          return 1;
        default:
          return null;
      }
    };

    type Line = {
      description: string;
      trade: string;
      csi_division: string;
      qty: number;
      uom: string;
      material_low: number;
      material_high: number;
      labor_low: number;
      labor_high: number;
      line_low: number;
      line_high: number;
      price_source: string;
      is_fallback: boolean;
    };
    const lines: Line[] = [];
    let totalLow = 0;
    let totalHigh = 0;
    let matched = 0;
    let matTotLow = 0;
    let matTotHigh = 0;
    let labTotLow = 0;
    let labTotHigh = 0;

    for (const item of data.items) {
      const all = mappings ?? [];
      let mapping =
        all.find(
          (m) => m.label === item.label && m.material === (item.material ?? null) && m.grade === data.grade,
        ) ?? all.find((m) => m.label === item.label && m.grade === data.grade);
      let isFallback = false;
      if (!mapping) {
        mapping = all.find((m) => m.label === item.label);
        isFallback = true;
      }
      if (!mapping) continue;

      const uc = (mapping as any).unit_costs;
      const qty = item.qty ?? qtyFor(mapping.qty_formula);
      if (qty == null || !Number.isFinite(qty) || qty <= 0) continue;

      const matLow = num(uc.material_low) * materialFactor * qty;
      const matHigh = num(uc.material_high) * materialFactor * qty;
      const labLow = num(uc.labor_low) * laborFactor * qty;
      const labHigh = num(uc.labor_high) * laborFactor * qty;
      const lineLow = matLow + labLow;
      const lineHigh = matHigh + labHigh;

      totalLow += lineLow;
      totalHigh += lineHigh;
      matTotLow += matLow;
      matTotHigh += matHigh;
      labTotLow += labLow;
      labTotHigh += labHigh;
      if (!isFallback) matched += 1;

      lines.push({
        description: uc.description,
        trade: TRADE_BY_DIVISION[uc.csi_division] ?? "General",
        csi_division: uc.csi_division,
        qty: Number(qty.toFixed(2)),
        uom: uc.uom,
        material_low: Number(matLow.toFixed(2)),
        material_high: Number(matHigh.toFixed(2)),
        labor_low: Number(labLow.toFixed(2)),
        labor_high: Number(labHigh.toFixed(2)),
        line_low: Number(lineLow.toFixed(2)),
        line_high: Number(lineHigh.toFixed(2)),
        price_source: `${uc.source}:${uc.item_code}`,
        is_fallback: isFallback,
      });
    }

    // No matching cost lines is a normal empty state, not a failure — return a
    // zeroed estimate so the caller can render an empty table instead of erroring.

    const subtotalLow = totalLow;
    const subtotalHigh = totalHigh;
    const contLow = subtotalLow * (CONTINGENCY_PCT / 100);
    const contHigh = subtotalHigh * (CONTINGENCY_PCT / 100);
    totalLow = subtotalLow + contLow;
    totalHigh = subtotalHigh + contHigh;

    const matchedPct = lines.length ? (matched / lines.length) * 100 : 0;
    const pricingConf = matchedPct >= 85 ? "High" : matchedPct >= 60 ? "Medium" : "Low";
    const layoutConf =
      data.dims_source === "user" || data.dims_source === "floor_plan"
        ? "High"
        : data.dims_source === "depth_estimate"
          ? "Medium"
          : "Low";

    const budgetTarget = data.budget_target ?? null;
    const budgetFit =
      budgetTarget == null
        ? null
        : totalHigh <= budgetTarget
          ? "Within Target"
          : totalLow <= budgetTarget
            ? "Tight"
            : "Over Target";

    return {
      market: { id: market.id, name: market.name },
      grade: data.grade,
      lines,
      subtotal_low: Number(subtotalLow.toFixed(2)),
      subtotal_high: Number(subtotalHigh.toFixed(2)),
      material_low: Number(matTotLow.toFixed(2)),
      material_high: Number(matTotHigh.toFixed(2)),
      labor_low: Number(labTotLow.toFixed(2)),
      labor_high: Number(labTotHigh.toFixed(2)),
      contingency_pct: CONTINGENCY_PCT,
      contingency_low: Number(contLow.toFixed(2)),
      contingency_high: Number(contHigh.toFixed(2)),
      total_low: Number(totalLow.toFixed(2)),
      total_high: Number(totalHigh.toFixed(2)),
      matched_pct: Number(matchedPct.toFixed(0)),
      pricing_conf: pricingConf,
      layout_conf: layoutConf,
      budget_fit: budgetFit,
      markets: markets.map((m) => ({ id: m.id, name: m.name })),
      disclaimer:
        "Planning range from our own project data. Not a bid or an engineering determination.",
    };
  });
