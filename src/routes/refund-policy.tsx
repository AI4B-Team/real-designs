import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path. The refund policy now lives at /refunds. */
export const Route = createFileRoute("/refund-policy")({
  beforeLoad: () => {
    throw redirect({ to: "/refunds" });
  },
});
