import { createFileRoute } from "@tanstack/react-router";

import { correlationIdFrom, CORRELATION_HEADER } from "@/lib/obs/correlation";

/**
 * Production health endpoint.
 *
 * Returns only whether each dependency is configured and answering, how long
 * the probe took and a short classification code. No secrets, no environment
 * values, no user data, no infrastructure identifiers.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const correlationId = correlationIdFrom(request.headers);
        try {
          const { healthReport } = await import("@/lib/obs/health.server");
          const url = new URL(request.url);
          const report = await healthReport(url.searchParams.get("force") === "1");
          const httpStatus = report.status === "outage" ? 503 : 200;
          return Response.json(
            {
              status: report.status,
              checkedAt: report.checkedAt,
              correlationId,
              providers: report.providers.map((p) => ({
                key: p.key,
                name: p.name,
                state: p.state,
                critical: p.critical,
                latencyMs: p.latencyMs,
                code: p.code ?? null,
              })),
              jobs: report.jobs,
            },
            {
              status: httpStatus,
              headers: {
                "Cache-Control": "no-store",
                [CORRELATION_HEADER]: correlationId,
              },
            },
          );
        } catch {
          return Response.json(
            { status: "unknown", correlationId },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
