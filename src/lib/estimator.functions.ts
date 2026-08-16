import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * build-scope (Phase 1)
 *
 * Contains ZERO model calls. It is SQL reads plus arithmetic.
 * A language model must never generate a dollar figure that reaches the user:
 * the AI decides WHAT changed and HOW MUCH of it, this function decides WHAT IT COSTS.
 */

const BuildScopeInput = z.object({ version_id: z.string().uuid() });

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

type Room = {
  floor_area_sf: number | null;
  wall_area_sf: number | null;
  perimeter_lf: number | null;
  dims_source: string | null;
  dims_confirmed_at: string | null;
};

function qtyFromFormula(formula: string, room: Room): number | null {
  switch (formula) {
    case "floor_area_sf":
      return room.floor_area_sf;
    case "wall_area_sf":
      return room.wall_area_sf;
    case "perimeter_lf":
      return room.perimeter_lf;
    case "each":
      return 1;
    default:
      return null;
  }
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export const buildScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BuildScopeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // ---- 0. Refuse before we charge. Pricing only exists where a market has
    // been verified against real cost data; anything else would be a guess. ----
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ count: verified }, { count: catalog }] = await Promise.all([
        supabaseAdmin.from("markets").select("id", { count: "exact", head: true }).not("verified_at", "is", null),
        supabaseAdmin.from("unit_costs").select("id", { count: "exact", head: true }),
      ]);
      if (!verified || !catalog) {
        throw new Error(
          "BUDGET_UNAVAILABLE: Budgets are not live yet. We only price against verified local cost data, so nothing was charged.",
        );
      }
    }


    // ---- 1. Load the version and its property hierarchy (RLS scopes this to the caller) ----
    const { data: version, error: versionError } = await supabase
      .from("versions")
      .select(
        `id, room_id,
         rooms!inner (
           id, floor_area_sf, wall_area_sf, perimeter_lf, dims_source, dims_confirmed_at,
           projects!inner (
             id, finish_grade, budget_target,
             properties!inner ( id, market_id )
           )
         )`,
      )
      .eq("id", data.version_id)
      .maybeSingle();

    if (versionError) throw new Error(versionError.message);
    if (!version) throw new Error("Version not found");

    const room = (version as any).rooms as Room & { projects: any };
    const project = room.projects;
    const property = project.properties;

    // Market factors and the cost catalog are internal pricing data: privileged read only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A property without a market still gets a price: fall back to the baseline
    // market so the user sees a planning range instead of a dead end.
    let market: { id: string; labor_factor: number | null; material_factor: number | null } | null = null;
    if (property.market_id) {
      const { data: m, error: marketError } = await supabaseAdmin
        .from("markets")
        .select("id, labor_factor, material_factor, verified_at")
        .eq("id", property.market_id)
        .maybeSingle();
      if (marketError) throw new Error(marketError.message);
      market = (m as any)?.verified_at ? (m as any) : null;
    }
    if (!market) {
      const { data: fallback } = await supabaseAdmin
        .from("markets")
        .select("id, labor_factor, material_factor")
        .not("verified_at", "is", null)
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();
      market = fallback as any;
    }
    if (!market) {
      throw new Error("No cost markets are set up yet, so this scope cannot be priced. Add a market with unit costs first.");
    }

    // Metered: charge only once we know the scope can actually be priced, so a
    // missing market or catalog never costs the user credits.
    const { charge, chargeErrorMessage } = await import("@/lib/credits.server");
    const billing = await charge(context.userId, "scope", "priced scope");
    if (!billing.ok) throw new Error(chargeErrorMessage(billing));


    const laborFactor = num(market.labor_factor) || 1;
    const materialFactor = num(market.material_factor) || 1;

    // ---- 2. Change items are the diff. Only these get priced. ----
    const { data: changeItems, error: ciError } = await supabase
      .from("change_items")
      .select("id, action, label, material, grade, qty, uom, qty_source, csi_division")
      .eq("version_id", data.version_id);
    if (ciError) throw new Error(ciError.message);

    const priceable = (changeItems ?? []).filter((c) => c.action !== "keep");

    // ---- 3. Cost mappings -> unit costs. A SQL join, nothing invented. ----
    const { data: mappings, error: mapError } = await supabaseAdmin
      .from("cost_mappings")
      .select(
        `label, material, grade, qty_formula,
         unit_costs!inner ( id, item_code, description, uom, csi_division, grade,
                            material_low, material_high, labor_low, labor_high, source )`,
      );
    if (mapError) throw new Error(mapError.message);

    const finishGrade: string = project.finish_grade ?? "retail";

    const lines: Array<Record<string, unknown>> = [];
    let totalLow = 0;
    let totalHigh = 0;
    let matchedCount = 0;

    for (const item of priceable) {
      const grade = item.grade ?? finishGrade;

      // exact match first, then label+grade, then any row for the label -> fallback
      let mapping =
        (mappings ?? []).find(
          (m) => m.label === item.label && m.material === item.material && m.grade === grade,
        ) ??
        (mappings ?? []).find((m) => m.label === item.label && m.grade === grade);
      let isFallback = false;

      if (!mapping) {
        mapping = (mappings ?? []).find((m) => m.label === item.label);
        isFallback = true;
      }
      if (!mapping) continue; // no priced line exists; silence beats a made-up number

      const uc = (mapping as any).unit_costs;

      const qty =
        item.qty != null ? Number(item.qty) : qtyFromFormula(mapping.qty_formula, room);
      if (qty == null || !Number.isFinite(qty) || qty <= 0) continue;

      const matLow = num(uc.material_low) * materialFactor * qty;
      const matHigh = num(uc.material_high) * materialFactor * qty;
      const labLow = num(uc.labor_low) * laborFactor * qty;
      const labHigh = num(uc.labor_high) * laborFactor * qty;

      const lineLow = matLow + labLow;
      const lineHigh = matHigh + labHigh;

      totalLow += lineLow;
      totalHigh += lineHigh;
      if (!isFallback) matchedCount += 1;

      lines.push({
        change_item_id: item.id,
        csi_division: uc.csi_division,
        description: uc.description,
        trade: TRADE_BY_DIVISION[uc.csi_division] ?? "General",
        qty: Number(qty.toFixed(2)),
        uom: item.uom ?? uc.uom,
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

    if (lines.length === 0) {
      throw new Error("No priceable change items for this version.");
    }

    // ---- 4. Contingency ----
    totalLow = totalLow * (1 + CONTINGENCY_PCT / 100);
    totalHigh = totalHigh * (1 + CONTINGENCY_PCT / 100);

    // ---- 5. Confidence is computed, never chosen ----
    const matchedPct = (matchedCount / lines.length) * 100;
    const pricingConf = matchedPct >= 85 ? "high" : matchedPct >= 60 ? "medium" : "low";

    const dimsConfirmed = room.dims_confirmed_at != null;
    const layoutConf = !dimsConfirmed
      ? "low"
      : room.dims_source === "user" || room.dims_source === "floor_plan"
        ? "high"
        : room.dims_source === "depth_estimate"
          ? "medium"
          : "low";

    const budgetTarget = project.budget_target == null ? null : Number(project.budget_target);
    const budgetFit =
      budgetTarget == null
        ? null
        : totalHigh <= budgetTarget
          ? "within"
          : totalLow <= budgetTarget
            ? "tight"
            : "over";

    // ---- 6. Persist. Latest computation replaces the previous one for this version. ----
    await supabase.from("scopes").delete().eq("version_id", data.version_id);

    const { data: scope, error: scopeError } = await supabase
      .from("scopes")
      .insert({
        version_id: data.version_id,
        market_id: market.id,
        total_low: Number(totalLow.toFixed(2)),
        total_high: Number(totalHigh.toFixed(2)),
        contingency_pct: CONTINGENCY_PCT,
        layout_conf: layoutConf,
        pricing_conf: pricingConf,
        matched_pct: Number(matchedPct.toFixed(2)),
        budget_fit: budgetFit,
      })
      .select("id, total_low, total_high, layout_conf, pricing_conf, matched_pct, budget_fit")
      .single();
    if (scopeError) throw new Error(scopeError.message);

    const { error: linesError } = await supabase
      .from("scope_lines")
      .insert(lines.map((l) => ({ ...l, scope_id: scope.id })) as any);
    if (linesError) throw new Error(linesError.message);

    return {
      scope_id: scope.id,
      total_low: Number(scope.total_low),
      total_high: Number(scope.total_high),
      layout_conf: scope.layout_conf,
      pricing_conf: scope.pricing_conf,
      matched_pct: scope.matched_pct == null ? null : Number(scope.matched_pct),
      budget_fit: scope.budget_fit,
      line_count: lines.length,
      dims_confirmed: dimsConfirmed,
      // Every surface that shows a number states this.
      disclaimer:
        "Planning range, Tampa Bay market, from our own project data. Not a bid or an engineering determination.",
    };
  });

/** Read back a computed scope with its audited lines. */
export const getScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ version_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: scope, error } = await context.supabase
      .from("scopes")
      .select(
        `id, total_low, total_high, contingency_pct, layout_conf, pricing_conf, matched_pct,
         budget_fit, computed_at,
         scope_lines ( id, csi_division, description, trade, qty, uom, material_low, material_high,
                       labor_low, labor_high, line_low, line_high, price_source, is_fallback )`,
      )
      .eq("version_id", data.version_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return scope;
  });

/**
 * Dimensions are user-confirmed. estimate-dimensions (Phase 3) only ever proposes;
 * dims_confirmed_at is set here, by an explicit human action, and nowhere else.
 */
export const confirmRoomDimensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        room_id: z.string().uuid(),
        floor_area_sf: z.number().positive(),
        wall_area_sf: z.number().positive(),
        ceiling_ht_in: z.number().positive(),
        perimeter_lf: z.number().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { room_id, ...dims } = data;
    const { data: room, error } = await context.supabase
      .from("rooms")
      .update({ ...dims, dims_source: "user", dims_confirmed_at: new Date().toISOString() })
      .eq("id", room_id)
      .select("id, dims_confirmed_at")
      .single();
    if (error) throw new Error(error.message);
    return room;
  });
