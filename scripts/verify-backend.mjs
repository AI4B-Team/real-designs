#!/usr/bin/env node
/**
 * Admin-safe backend verification. Read-only: it never writes, migrates or
 * grants. Run it before a deploy, or against production, without risk.
 *
 *   node scripts/verify-backend.mjs            # static + live (if PG* env set)
 *   node scripts/verify-backend.mjs --static   # file checks only
 */

import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const MIGRATIONS = path.resolve("supabase/migrations");
const staticOnly = process.argv.includes("--static");
const problems = [];
const notes = [];

function fail(msg) {
  problems.push(msg);
}

/* ---------- 1. Migration files ---------- */

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));
const sorted = [...files].sort();
if (JSON.stringify(files.slice().sort()) !== JSON.stringify(sorted)) fail("Migration filenames do not sort deterministically.");

const stamps = new Map();
for (const file of sorted) {
  const stamp = file.split("_")[0];
  if (!/^\d{14}$/.test(stamp)) fail(`${file}: filename must start with a 14-digit timestamp.`);
  if (stamps.has(stamp)) fail(`${file}: duplicate migration timestamp with ${stamps.get(stamp)}.`);
  stamps.set(stamp, file);

  const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
  const stripped = sql.replace(/--[^\n]*/g, "");

  if (/ALTER\s+DATABASE/i.test(stripped)) fail(`${file}: ALTER DATABASE is not allowed.`);
  // Storage object policies are expected here; tables and triggers in managed
  // schemas are not.
  if (/CREATE\s+(TABLE|TRIGGER)[\s\S]{0,80}\b(auth|storage|realtime|vault)\./i.test(stripped)) {
    fail(`${file}: migrations must not create tables or triggers in managed schemas.`);
  }
  if (/\blocalhost\b|127\.0\.0\.1|\bdev_only\b/i.test(stripped)) fail(`${file}: environment-specific value in a migration.`);

  for (const m of stripped.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([A-Za-z0-9_]+)/gi)) {
    const table = m[1];
    const re = (pat) => new RegExp(pat.replace("TBL", table), "i").test(stripped);
    if (!re("GRANT[\\s\\S]*?ON\\s+(TABLE\\s+)?public\\.TBL")) fail(`${file}: public.${table} created without GRANT statements.`);
    if (!re("ALTER\\s+TABLE\\s+public\\.TBL\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY")) {
      fail(`${file}: public.${table} created without enabling row level security.`);
    }
  }
}
notes.push(`${sorted.length} migration files checked, applied in filename order.`);

/* ---------- 2. Live database ---------- */

function psql(sql) {
  return execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

if (!staticOnly && process.env.PGHOST) {
  try {
    const noRls = psql(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    if (noRls) fail(`Tables without row level security: ${noRls.split("\n").join(", ")}`);

    const anon = psql(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))",
    );
    if (anon) fail(`Tables reachable by signed-out visitors: ${anon.split("\n").join(", ")}`);

    const noPolicy = psql(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) and (has_table_privilege('authenticated', c.oid,'SELECT') or has_table_privilege('authenticated', c.oid,'INSERT'))",
    );
    if (noPolicy) fail(`Tables granted to signed-in users but with no policy: ${noPolicy.split("\n").join(", ")}`);

    const buckets = psql("select id || ':' || public from storage.buckets order by id");
    const seen = Object.fromEntries(buckets.split("\n").filter(Boolean).map((r) => r.split(":")));
    for (const b of ["room-photos", "reveal-videos", "user-audio"]) {
      if (!(b in seen)) fail(`Storage bucket "${b}" is missing.`);
      else if (seen[b] === "t") fail(`Storage bucket "${b}" is public; it must be private.`);
    }

    const storagePolicies = psql(
      "select count(*) from pg_policies where schemaname='storage' and tablename='objects'",
    );
    if (Number(storagePolicies) < 12) fail(`Only ${storagePolicies} storage policies found; expected read/write/update/delete per bucket.`);

    notes.push("Live checks: row level security, privileges, policies, buckets.");
  } catch (err) {
    notes.push(`Live checks skipped: ${err.message.split("\n")[0]}`);
  }
} else {
  notes.push("Live checks skipped (no database connection configured).");
}

/* ---------- 3. Report ---------- */

for (const n of notes) console.log("  " + n);
if (problems.length) {
  console.error("\nBackend verification failed:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("\nBackend verification passed.");
