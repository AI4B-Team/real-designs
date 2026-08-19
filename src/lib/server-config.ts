/**
 * Server configuration contract.
 *
 * Pure and environment-agnostic so it can be unit tested and reused by the
 * verification CLI. The server-side wrapper in `server-config.server.ts`
 * feeds it `process.env` inside a handler.
 */

export type ConfigVar = {
  name: string;
  required: boolean;
  /** Why the app needs it, in operator language. */
  purpose: string;
  /** A value that must never appear in a client bundle. */
  secret: boolean;
};

export const SERVER_CONFIG: ConfigVar[] = [
  {
    name: "SUPABASE_URL",
    required: true,
    purpose: "Backend API endpoint used by server functions.",
    secret: false,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    purpose: "Privileged backend key for admin-only server work.",
    secret: true,
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    required: false,
    purpose: "Public backend key for server-side anonymous reads.",
    secret: false,
  },
  {
    name: "SUPABASE_ANON_KEY",
    required: false,
    purpose: "Legacy alias of the publishable key.",
    secret: false,
  },
  {
    name: "LOVABLE_API_KEY",
    required: true,
    purpose: "AI gateway access for design, scoring and video features.",
    secret: true,
  },
];

export const CLIENT_CONFIG: ConfigVar[] = [
  {
    name: "VITE_SUPABASE_URL",
    required: true,
    purpose: "Backend endpoint for the browser client.",
    secret: false,
  },
  {
    name: "VITE_SUPABASE_PUBLISHABLE_KEY",
    required: true,
    purpose: "Public backend key for the browser client.",
    secret: false,
  },
];

export type ConfigReport = {
  ok: boolean;
  missing: string[];
  /** Secrets that were exposed through a VITE_ prefixed variable. */
  leaked: string[];
  warnings: string[];
};

const SECRET_HINT = /(SERVICE_ROLE|SECRET|_API_KEY|PASSWORD|PRIVATE)/i;

export function validateServerConfig(env: Record<string, string | undefined>): ConfigReport {
  const missing = SERVER_CONFIG.filter((v) => v.required && !env[v.name]?.trim()).map(
    (v) => v.name,
  );

  const leaked = Object.keys(env).filter(
    (key) => key.startsWith("VITE_") && SECRET_HINT.test(key) && !key.includes("PUBLISHABLE"),
  );

  const warnings: string[] = [];
  if (!env["SUPABASE_PUBLISHABLE_KEY"] && !env["SUPABASE_ANON_KEY"]) {
    warnings.push(
      "No publishable key is set; server-side anonymous reads will fall back to the admin client.",
    );
  }
  const url = env["SUPABASE_URL"];
  if (url && !/^https:\/\//.test(url)) warnings.push("SUPABASE_URL should be an https URL.");

  return { ok: missing.length === 0 && leaked.length === 0, missing, leaked, warnings };
}

/** Operator-facing one-liner; never includes a value, only names. */
export function describeConfigReport(report: ConfigReport): string {
  if (report.ok) return "Server configuration is complete.";
  const parts: string[] = [];
  if (report.missing.length) parts.push(`missing: ${report.missing.join(", ")}`);
  if (report.leaked.length)
    parts.push(`secret exposed to the browser: ${report.leaked.join(", ")}`);
  return `Server configuration problem — ${parts.join("; ")}.`;
}
