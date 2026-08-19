import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

// The gate runs after hydration (not in beforeLoad): redirecting mid-hydration
// swaps the tree React is still matching against the server placeholder and
// throws a hydration mismatch.
function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "in" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;

    // A signed-in session arriving (or being refreshed) always wins over a
    // pending check: an in-flight lookup can never bounce an active user out.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session) setState("in");
      else if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });

    // A network hiccup on the session lookup must never bounce someone out of
    // a page they are working in. Only a confirmed missing session redirects;
    // a failed request is retried, and a stored session keeps them in place.
    (async () => {
      // No stored session at all is a definitive answer, not a network problem:
      // getSession reads local storage, so it cannot fail for connectivity.
      const { data: first } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!first?.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }

      let networkFailed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data?.user) {
          setState("in");
          return;
        }
        if (!error) break; // answered cleanly: there is genuinely no user
        // A rejected session (401/403) is an answer too — send them to sign in.
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) break;
        networkFailed = true;
        const { data: s } = await supabase.auth.getSession();
        if (cancelled) return;
        if (s?.session) {
          setState("in");
          return;
        }
        setState("offline");
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        if (cancelled) return;
      }
      if (cancelled) return;
      // Never redirect on an unresolved network condition: show the retry state.
      if (networkFailed) setState("offline");
      else navigate({ to: "/auth", replace: true });
    })();


    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, [navigate]);

  if (state === "offline")
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Reconnecting…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We are having trouble reaching the server. Your work is safe.
          </p>
          <button
            className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (state !== "in")
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  return <Outlet />;
}
