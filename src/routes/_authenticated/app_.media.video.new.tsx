import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Canonical listing-video entry URL. The authenticated app is a single
 * surface at /app, so this route forwards to the listing-video workspace.
 */
export const Route = createFileRoute("/_authenticated/app_/media/video/new")({
  beforeLoad: () => {
    throw redirect({ to: "/app", hash: "v-lvideo" });
  },
  component: () => null,
});
