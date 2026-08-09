import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portfolio reporting.
 *
 * Rolls the owned hierarchy (property -> project -> room -> version -> scope)
 * up to one row per property, and summarises credit spend by action. RLS
 * scopes every read to the signed-in owner.
 */

export type PropertyReportRow = {
  property_id: string;
  address: string;
  projects: number;
  rooms: number;
  designs: number;
  approved: number;
  priced: number;
  low: number;
  high: number;
  budget_target: number | null;
  budget_fit: "under" | "over" | "at" | "unknown";
  last_activity: string | null;
};

export const getPortfolioReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [
      { data: props, error: pErr },
      { data: versions, error: vErr },
      { data: ledger, error: lErr },
      { data: pres, error: prErr },
    ] = await Promise.all([
      supabase.from("properties").select("id, address, created_at"),
      supabase
        .from("versions")
        .select(
          `id, created_at, status,
           rooms!inner ( id, project_id,
             projects!inner ( id, budget_target,
               properties!inner ( id, address ) ) ),
           scopes ( total_low, total_high )`,
        )
        .order("created_at", { ascending: false }),
      supabase.from("credit_ledger").select("action, delta, created_at").gte("created_at", since),
      supabase.from("presentations").select("id, status, view_count"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (vErr) throw new Error(vErr.message);
    if (lErr) throw new Error(lErr.message);
    if (prErr) throw new Error(prErr.message);

    const byProp = new Map<string, PropertyReportRow & { _projects: Set<string>; _rooms: Set<string> }>();
    for (const p of (props ?? []) as any[]) {
      byProp.set(p.id, {
        property_id: p.id,
        address: p.address,
        projects: 0,
        rooms: 0,
        designs: 0,
        approved: 0,
        priced: 0,
        low: 0,
        high: 0,
        budget_target: null,
        budget_fit: "unknown",
        last_activity: p.created_at ?? null,
        _projects: new Set<string>(),
        _rooms: new Set<string>(),
      });
    }

    for (const v of (versions ?? []) as any[]) {
      const project = v.rooms?.projects;
      const propId = project?.properties?.id;
      if (!propId) continue;
      const row = byProp.get(propId);
      if (!row) continue;
      row._projects.add(project.id);
      row._rooms.add(v.rooms.id);
      row.designs += 1;
      if (v.status === "approved") row.approved += 1;
      const scope = (v.scopes ?? [])[0];
      if (scope) {
        row.priced += 1;
        row.low += Number(scope.total_low ?? 0);
        row.high += Number(scope.total_high ?? scope.total_low ?? 0);
      }
      if (project.budget_target != null) {
        row.budget_target = (row.budget_target ?? 0) + Number(project.budget_target);
      }
      if (!row.last_activity || v.created_at > row.last_activity) row.last_activity = v.created_at;
    }

    const rows: PropertyReportRow[] = Array.from(byProp.values()).map((r) => {
      const { _projects, _rooms, ...rest } = r;
      const out: PropertyReportRow = {
        ...rest,
        projects: _projects.size,
        rooms: _rooms.size,
      };
      if (out.budget_target != null && out.priced > 0) {
        out.budget_fit = out.high <= out.budget_target ? "under" : out.low > out.budget_target ? "over" : "at";
      }
      return out;
    });
    rows.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));

    const spendByAction: Record<string, number> = {};
    let spent30 = 0;
    for (const l of (ledger ?? []) as any[]) {
      const d = Number(l.delta ?? 0);
      if (d >= 0) continue;
      spendByAction[l.action] = (spendByAction[l.action] ?? 0) + Math.abs(d);
      spent30 += Math.abs(d);
    }

    const presRows = (pres ?? []) as any[];

    return {
      rows,
      totals: {
        properties: rows.length,
        designs: rows.reduce((s, r) => s + r.designs, 0),
        approved: rows.reduce((s, r) => s + r.approved, 0),
        low: rows.reduce((s, r) => s + r.low, 0),
        high: rows.reduce((s, r) => s + r.high, 0),
      },
      credits: { spent30, byAction: spendByAction },
      presentations: {
        total: presRows.length,
        approved: presRows.filter((p) => p.status === "approved").length,
        views: presRows.reduce((s, p) => s + Number(p.view_count ?? 0), 0),
      },
    };
  });
