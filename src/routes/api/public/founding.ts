import { createFileRoute } from "@tanstack/react-router";

/**
 * Real founding member seat count.
 *
 * This is an exact COUNT of claimed founding accounts. It is never a timer,
 * never a per-visitor decrement, and never seeded with a fake head start.
 * When it hits zero, founding pricing is genuinely closed.
 */
export const FOUNDING_LIMIT = 500;

export const Route = createFileRoute("/api/public/founding")({
  server: {
    handlers: {
      GET: async () => {
        // Count-only RPC is service-role gated; never called from the browser.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await supabaseAdmin.rpc("founding_members_claimed");

        if (error) {
          return Response.json({ error: "count_unavailable" }, { status: 503 });
        }

        const claimed = (data as number | null) ?? 0;
        const remaining = Math.max(FOUNDING_LIMIT - claimed, 0);

        return Response.json(
          { limit: FOUNDING_LIMIT, claimed, remaining, open: remaining > 0 },
          { headers: { "Cache-Control": "public, max-age=30" } },
        );
      },
    },
  },
});
