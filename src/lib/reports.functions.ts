import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Workspace reporting.
 *
 * Aggregates the owned hierarchy (property -> project -> room -> version -> scope)
 * plus credit ledger and client presentation activity into one payload. RLS
 * scopes every read to the signed-in owner, so no workspace can see another's
 * records. Every section is computed from real rows only.
 */

export type ReportRow = {
  property_id: string;
  project_id: string | null;
  property: string;
  project: string;
  client: string;
  rooms: number;
  designs: number;
  approved: number;
  priced: number;
  low: number;
  high: number;
  budget_target: number | null;
  budget_fit: "on_track" | "near_limit" | "over" | "unset";
  last_activity: string | null;
};

const Input = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
});

function fit(low: number, high: number, priced: number, target: number | null): ReportRow["budget_fit"] {
  if (target == null || target <= 0 || priced === 0) return "unset";
  if (high <= target) return "on_track";
  if (low > target) return "over";
  return "near_limit";
}

export const getWorkspaceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const from = data.from || null;
    const to = data.to || null;
    const propertyId = data.propertyId || null;

    const inRange = (iso: string | null | undefined) => {
      if (!iso) return false;
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      return true;
    };

    let versionQ = supabase
      .from("versions")
      .select(
        `id, created_at, status, room_id,
         rooms!inner ( id, project_id, projects!inner ( id, name, budget_target, property_id ) ),
         scopes ( total_low, total_high )`,
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    if (from) versionQ = versionQ.gte("created_at", from);
    if (to) versionQ = versionQ.lte("created_at", to);

    let ledgerQ = supabase
      .from("credit_ledger")
      .select("id, action, delta, balance_after, note, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (from) ledgerQ = ledgerQ.gte("created_at", from);
    if (to) ledgerQ = ledgerQ.lte("created_at", to);

    const [propsR, projectsR, roomsR, versionsR, ledgerR, acctR, pkgR, linksR, actR, decR] = await Promise.all([
      supabase.from("properties").select("id, address, created_at").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, property_id, name, budget_target, created_at"),
      supabase.from("rooms").select("id, project_id, created_at"),
      versionQ,
      ledgerQ,
      supabase.from("credit_accounts").select("balance, plan, free_used_today, free_day").eq("user_id", userId).maybeSingle(),
      supabase
        .from("presentation_packages")
        .select("id, title, property_id, property_label, client_name, status, view_count, archived, created_at, last_activity_at"),
      supabase.from("presentation_links").select("id, package_id, created_at, view_count, revoked"),
      supabase
        .from("presentation_activity")
        .select("id, package_id, kind, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("presentation_decisions").select("id, package_id, decision, client_name, note, created_at"),
    ]);

    const firstError = [propsR, projectsR, roomsR, versionsR, ledgerR, pkgR, linksR, actR, decR].find((r: any) => r.error);
    if (firstError) throw new Error((firstError as any).error.message);

    const properties = ((propsR.data ?? []) as any[]).filter((p) => !propertyId || p.id === propertyId);
    const propIds = new Set(properties.map((p) => p.id));
    const projects = ((projectsR.data ?? []) as any[]).filter((p) => propIds.has(p.property_id));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const rooms = ((roomsR.data ?? []) as any[]).filter((r) => projectById.has(r.project_id));
    const versions = ((versionsR.data ?? []) as any[]).filter((v) => {
      const pj = v.rooms?.projects;
      return pj && propIds.has(pj.property_id);
    });

    /* ---- portfolio rollup: one row per project, plus bare properties ---- */
    const rowKey = (propId: string, projId: string | null) => propId + "|" + (projId ?? "-");
    const rows = new Map<string, ReportRow & { _rooms: Set<string> }>();
    const addrOf = new Map(properties.map((p) => [p.id, p.address as string]));

    for (const p of properties) {
      const own = projects.filter((x) => x.property_id === p.id);
      if (!own.length) {
        rows.set(rowKey(p.id, null), {
          property_id: p.id,
          project_id: null,
          property: p.address,
          project: "No Project Yet",
          client: "",
          rooms: 0,
          designs: 0,
          approved: 0,
          priced: 0,
          low: 0,
          high: 0,
          budget_target: null,
          budget_fit: "unset",
          last_activity: p.created_at ?? null,
          _rooms: new Set(),
        });
      }
    }
    for (const pj of projects) {
      rows.set(rowKey(pj.property_id, pj.id), {
        property_id: pj.property_id,
        project_id: pj.id,
        property: addrOf.get(pj.property_id) ?? "Property",
        project: pj.name ?? "Project",
        client: "",
        rooms: 0,
        designs: 0,
        approved: 0,
        priced: 0,
        low: 0,
        high: 0,
        budget_target: pj.budget_target == null ? null : Number(pj.budget_target),
        budget_fit: "unset",
        last_activity: pj.created_at ?? null,
        _rooms: new Set(),
      });
    }
    for (const r of rooms) {
      const pj = projectById.get(r.project_id);
      const row = pj && rows.get(rowKey(pj.property_id, pj.id));
      if (row) row._rooms.add(r.id);
    }

    const statusCounts = { draft: 0, review: 0, approved: 0, archived: 0 };
    for (const v of versions) {
      const pj = v.rooms.projects;
      const row = rows.get(rowKey(pj.property_id, pj.id));
      const st = String(v.status ?? "draft");
      if (st in statusCounts) (statusCounts as any)[st] += 1;
      if (!row) continue;
      row.designs += 1;
      if (st === "approved") row.approved += 1;
      const scope = (v.scopes ?? [])[0];
      if (scope) {
        row.priced += 1;
        row.low += Number(scope.total_low ?? 0);
        row.high += Number(scope.total_high ?? scope.total_low ?? 0);
      }
      if (!row.last_activity || v.created_at > row.last_activity) row.last_activity = v.created_at;
    }

    /* client name comes from any package attached to the property */
    const packages = ((pkgR.data ?? []) as any[]).filter((p) => !p.archived && (!propertyId || p.property_id === propertyId));
    for (const pk of packages) {
      if (!pk.property_id || !pk.client_name) continue;
      for (const row of rows.values()) if (row.property_id === pk.property_id && !row.client) row.client = pk.client_name;
    }

    const outRows: ReportRow[] = Array.from(rows.values()).map(({ _rooms, ...rest }) => ({
      ...rest,
      rooms: _rooms.size,
      budget_fit: fit(rest.low, rest.high, rest.priced, rest.budget_target),
    }));
    outRows.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));

    /* ---- credits ---- */
    const ledger = (ledgerR.data ?? []) as any[];
    const byType: Record<string, number> = {};
    const daily: Record<string, number> = {};
    let used = 0;
    for (const l of ledger) {
      const d = Number(l.delta ?? 0);
      if (d >= 0) continue;
      const amt = Math.abs(d);
      used += amt;
      byType[l.action] = (byType[l.action] ?? 0) + amt;
      const day = String(l.created_at).slice(0, 10);
      daily[day] = (daily[day] ?? 0) + amt;
    }
    const projectCount = outRows.filter((r) => r.project_id).length;

    /* ---- client activity ---- */
    const pkgIds = new Set(packages.map((p) => p.id));
    const pkgById = new Map(packages.map((p) => [p.id, p]));
    const links = ((linksR.data ?? []) as any[]).filter((l) => pkgIds.has(l.package_id) && inRangeOrAll(l.created_at));
    function inRangeOrAll(iso: string) {
      if (!from && !to) return true;
      return inRange(iso);
    }
    const activity = ((actR.data ?? []) as any[]).filter((a) => pkgIds.has(a.package_id) && inRangeOrAll(a.created_at));
    const decisions = ((decR.data ?? []) as any[]).filter((d) => pkgIds.has(d.package_id) && inRangeOrAll(d.created_at));

    const viewed = activity.filter((a) => a.kind === "view").length;
    const changes = decisions.filter((d) => d.decision === "changes").length;
    const approvedPres = decisions.filter((d) => d.decision === "approved").length;

    const recent = activity.slice(0, 25).map((a) => {
      const pk = pkgById.get(a.package_id);
      return {
        id: a.id,
        package_id: a.package_id,
        title: pk?.title ?? "Presentation",
        property: pk?.property_label ?? "",
        client: pk?.client_name ?? "Guest",
        kind: a.kind,
        detail: a.detail ?? "",
        created_at: a.created_at,
      };
    });

    const designsCreated = versions.length;
    const approvedDesigns = versions.filter((v) => v.status === "approved").length;

    return {
      range: { from, to },
      rows: outRows,
      summary: {
        activeProjects: projectCount || properties.length,
        properties: properties.length,
        designsCreated,
        approvedDesigns,
        approvalRate: designsCreated ? Math.round((approvedDesigns / designsCreated) * 100) : 0,
        plannedBudget: outRows.reduce((s, r) => s + (r.budget_target ?? 0), 0),
        budgetedProjects: outRows.filter((r) => r.budget_target != null).length,
        scopeLow: outRows.reduce((s, r) => s + r.low, 0),
        scopeHigh: outRows.reduce((s, r) => s + r.high, 0),
      },
      statusCounts,
      credits: {
        used,
        remaining: Number((acctR.data as any)?.balance ?? 0),
        plan: (acctR.data as any)?.plan ?? "free",
        freeRemainingToday: (() => {
          const acct: any = acctR.data;
          if (!acct || acct.plan !== "free") return 0;
          const today = new Date().toISOString().slice(0, 10);
          const usedToday = acct.free_day === today ? Number(acct.free_used_today ?? 0) : 0;
          return Math.max(0, 5 - usedToday);
        })(),
        perProject: projectCount ? Math.round((used / projectCount) * 10) / 10 : 0,
        byType,
        daily: Object.keys(daily)
          .sort()
          .map((d) => ({ date: d, credits: daily[d] })),
        tx: ledger.slice(0, 50).map((l) => ({
          id: l.id,
          created_at: l.created_at,
          action: l.action,
          note: l.note ?? "",
          delta: Number(l.delta ?? 0),
          balance_after: Number(l.balance_after ?? 0),
        })),
      },
      clients: {
        shared: links.length,
        viewed,
        changes,
        approved: approvedPres,
        packages: packages.length,
        recent,
      },
      properties: properties.map((p) => ({ id: p.id, address: p.address })),
    };
  });
