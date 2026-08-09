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
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setState("in");
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state !== "in") return null;
  return <Outlet />;
}
