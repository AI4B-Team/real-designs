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
  const [state, setState] = useState<"checking" | "in">("checking");

  useEffect(() => {
    let cancelled = false;

    // A network hiccup on the session lookup must never bounce someone out of
    // a page they are working in. Only a confirmed missing session redirects;
    // a failed request is retried, and a stored session keeps them in place.
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data?.user) {
          setState("in");
          return;
        }
        if (!error) break; // answered cleanly: there is genuinely no user
        const { data: s } = await supabase.auth.getSession();
        if (cancelled) return;
        if (s?.session) {
          setState("in");
          return;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        if (cancelled) return;
      }
      if (!cancelled) navigate({ to: "/auth", replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);


  if (state !== "in") return null;
  return <Outlet />;
}
