import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Signup / onboarding questionnaire.
 *
 * New members answer a short questionnaire the first time they open the app.
 * The answers live on their own row (they can edit it), and admins can read
 * every row in the back office so the list can be worked or pushed into the
 * CRM that the CRM Sync module already manages.
 */

const Survey = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  role: z.string().trim().max(60).nullable().optional(),
  how_heard: z.string().trim().max(60).nullable().optional(),
  how_heard_detail: z.string().trim().max(200).nullable().optional(),
  listings_per_year: z.string().trim().max(40).nullable().optional(),
  primary_goal: z.string().trim().max(80).nullable().optional(),
  team_size: z.string().trim().max(40).nullable().optional(),
  marketing_opt_in: z.boolean().optional(),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access is required.");
}

/** The signed-in member's own answers, or null when they have not answered. */
export const getSignupSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("signup_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { row: data ?? null, email: (context.claims as any)?.email ?? null };
  });

/** Creates or updates the member's questionnaire answers. */
export const saveSignupSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Survey.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const payload: Record<string, unknown> = {
      user_id: userId,
      email: (claims as any)?.email ?? null,
      ...data,
    };
    const { data: row, error } = await supabase
      .from("signup_profiles")
      .upsert(payload as any, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

/** True when the signed-in user may open the back-office signup list. */
export const isSignupAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!data };
  });

/** Back office: every questionnaire answer, newest first. Admin only. */
export const listSignupSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { data, error } = await context.supabase
      .from("signup_profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const k = (r as any).how_heard || "Unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return {
      rows,
      total: rows.length,
      completed: rows.filter((r: any) => r.completed).length,
      optIn: rows.filter((r: any) => r.marketing_opt_in).length,
      sources: Object.entries(counts).sort((a, b) => b[1] - a[1]),
    };
  });

/** Marks a signup lead as pushed into the CRM. Admin only. */
export const markSignupPushed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("signup_profiles")
      .update({ crm_pushed_at: new Date().toISOString() } as any)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
