import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { count, error } = await supabase
          .from("founding_members")
          .select("id", { count: "exact", head: true });

        if (error) {
          return Response.json({ error: "count_unavailable" }, { status: 503 });
        }

        const claimed = count ?? 0;
        const remaining = Math.max(FOUNDING_LIMIT - claimed, 0);

        return Response.json(
          { limit: FOUNDING_LIMIT, claimed, remaining, open: remaining > 0 },
          { headers: { "Cache-Control": "public, max-age=30" } },
        );
      },
    },
  },
});
