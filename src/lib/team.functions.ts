import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Invites sent by the signed-in owner, plus invites addressed to their email. */
export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as Record<string, unknown>)?.["email"] ?? "");
    const [sent, received] = await Promise.all([
      context.supabase
        .from("team_invites")
        .select("id, email, role, status, accepted_at, created_at")
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("team_invites")
        .select("id, owner_id, role, status, created_at")
        .neq("owner_id", context.userId)
        .eq("status", "pending"),
    ]);
    return { email, sent: sent.data ?? [], received: received.data ?? [] };
  });

/** Invite a teammate by email. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(200),
        role: z.enum(["viewer", "member", "admin"]).default("member"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    const self = String((context.claims as Record<string, unknown>)?.["email"] ?? "").toLowerCase();
    if (email === self) return { ok: false, error: "That is your own address." };
    const { error } = await context.supabase
      .from("team_invites")
      .insert({ owner_id: context.userId, email, role: data.role, status: "pending" });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "That address is already invited." };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

/** Change the role on an invite you sent. */
export const updateInviteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), role: z.enum(["viewer", "member", "admin"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invites")
      .update({ role: data.role })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    return { ok: !error, error: error?.message ?? null };
  });

/** Revoke an invite you sent. */
export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invites")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    return { ok: !error, error: error?.message ?? null };
  });

/** Accept an invite addressed to your email. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invites")
      .update({
        status: "accepted",
        accepted_user_id: context.userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

/** Decline an invite addressed to your email. */
export const declineInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invites")
      .update({ status: "declined" })
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });
