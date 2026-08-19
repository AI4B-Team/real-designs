import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard rail: the service-role client and any server-only secret must never be
 * reachable from a module that the browser bundle can pull in.
 *
 * `*.server.ts` files are stripped from client bundles by filename, and the
 * bodies of `createServerFn().handler()` are stripped too — but a *module
 * scope* import inside a `.functions.ts` file is not, so it would drag the
 * admin client into a route chunk. These tests fail loudly if that ever
 * regresses.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const clientReachable = files.filter((f) => !/\.server\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

describe("server secret boundary", () => {
  it("no client-reachable module imports the admin client at module scope", () => {
    const offenders = clientReachable.filter((f) => {
      const src = readFileSync(f, "utf8");
      // Only a top-level `import ... from ".../client.server"` is a leak;
      // `await import(...)` inside a handler is the sanctioned pattern.
      return /^\s*import[^\n]*['"][^'"]*client\.server['"]/m.test(src);
    });
    expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
  });

  it("no module reads the service role key outside a server-only file", () => {
    // Naming the variable in a config manifest is fine; *reading its value*
    // outside a server-only file is what would ship the key to the browser.
    const READ =
      /process\.env(\.SUPABASE_SERVICE_ROLE_KEY|\[\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\])/;
    const offenders = clientReachable.filter((f) => READ.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
  });

  it("no secret is exposed through a VITE_ prefixed variable", () => {
    const offenders = files.filter(
      (f) =>
        !/\.test\.tsx?$/.test(f) &&
        /import\.meta\.env\.VITE_[A-Z_]*(SERVICE_ROLE|SECRET)/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
  });
});
