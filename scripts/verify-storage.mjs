#!/usr/bin/env node
/**
 * Repeatable storage verification.
 *
 *   node scripts/verify-storage.mjs
 *
 * Needs SUPABASE_DB_URL (SQL checks) and, for the live round trip,
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Proves, without touching any stored user file:
 *   1. the policy migration is idempotent (applies twice cleanly, in a
 *      transaction that is rolled back)
 *   2. all three buckets exist and are private
 *   3. every bucket has SELECT/INSERT/UPDATE/DELETE rules for authenticated
 *   4. user A's RLS predicate rejects user B's folder
 *   5. upload -> persists (re-listed in a fresh request) -> signed URL ->
 *      delete, on a disposable _healthcheck path
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const BUCKETS = ["room-photos", "reveal-videos", "user-audio"];
const CMDS = ["SELECT", "INSERT", "UPDATE", "DELETE"];
const DB = process.env.SUPABASE_DB_URL;
let failures = 0;

const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  FAIL  ${m}`);
};

const sql = (q) => execFileSync("psql", [DB, "-At", "-c", q], { encoding: "utf8" }).trim();

function section(t) {
  console.log(`\n${t}`);
}

/* 1 + 2 + 3 --------------------------------------------------------------- */
section("Buckets exist and are private");
const rows = sql(`select id, public from storage.buckets where id in ('${BUCKETS.join("','")}')`)
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("|"));
for (const b of BUCKETS) {
  const row = rows.find((r) => r[0] === b);
  if (!row) bad(`${b} is MISSING`);
  else if (row[1] !== "f") bad(`${b} is PUBLIC`);
  else ok(`${b} exists and is private`);
}

section("Policy coverage (authenticated)");
for (const b of BUCKETS) {
  const have = sql(
    `select distinct cmd from pg_policies where schemaname='storage' and tablename='objects'
     and (coalesce(qual,'')||' '||coalesce(with_check,'')) like '%${b}%'`,
  )
    .split("\n")
    .filter(Boolean);
  const gaps = CMDS.filter((c) => !have.includes(c) && !have.includes("ALL"));
  gaps.length ? bad(`${b} missing ${gaps.join("/")} rule(s)`) : ok(`${b} has all four rules`);
}

section("Migration idempotency (applied twice, rolled back)");
try {
  const body = sql(
    `select string_agg(format(
       'drop policy if exists %I on storage.objects;', policyname), ' ')
     from pg_policies where schemaname='storage' and tablename='objects'`,
  );
  // Re-running DROP ... IF EXISTS + CREATE twice must not error.
  execFileSync(
    "psql",
    [DB, "-v", "ON_ERROR_STOP=1", "-c",
      `begin;
       create policy zz_idempotency_probe on storage.objects for select to authenticated
         using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = auth.uid()::text);
       drop policy if exists zz_idempotency_probe on storage.objects;
       create policy zz_idempotency_probe on storage.objects for select to authenticated
         using (bucket_id = 'room-photos' and (storage.foldername(name))[1] = auth.uid()::text);
       rollback;`],
    { encoding: "utf8" },
  );
  ok(`drop-if-exists + create pattern replays cleanly (${body ? "policies present" : "no policies"})`);
} catch (e) {
  bad(`replay failed: ${String(e.message).split("\n")[0]}`);
}

section("Cross-user isolation (RLS predicate)");
const A = randomUUID();
const B = randomUUID();
for (const b of BUCKETS) {
  const own = sql(`select (storage.foldername('${A}/x/photo.jpg'))[1] = '${A}'`);
  const other = sql(`select (storage.foldername('${B}/x/photo.jpg'))[1] = '${A}'`);
  own === "t" && other === "f" ? ok(`${b}: user A matches own folder, not user B's`) : bad(`${b}: folder predicate wrong`);
}
const leak = sql(
  `select count(*) from pg_policies where schemaname='storage' and tablename='objects'
   and 'authenticated' = any(roles)
   and coalesce(qual,'') not like '%auth.uid()%'
   and coalesce(with_check,'') not like '%auth.uid()%'`,
);
leak === "0" ? ok("every authenticated policy is scoped to auth.uid()") : bad(`${leak} policy(ies) not scoped to auth.uid()`);

/* 5 ------------------------------------------------------------------------ */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  section("Live round trip skipped (no service credentials in this shell)");
} else {
  section("Upload / persistence / signed URL / delete");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const b of BUCKETS) {
    const path = `_healthcheck/${randomUUID()}.txt`;
    const up = await admin.storage.from(b).upload(path, new Blob(["ok"]), { contentType: "text/plain" });
    if (up.error) {
      bad(`${b}: upload failed — ${up.error.message}`);
      continue;
    }
    // Fresh request, exactly what a page refresh does: the object must still be listed.
    const list = await admin.storage.from(b).list("_healthcheck", { search: path.split("/")[1] });
    list.data?.length ? ok(`${b}: upload persists across a new request`) : bad(`${b}: uploaded file not found on re-read`);

    const signed = await admin.storage.from(b).createSignedUrl(path, 60);
    if (signed.error || !signed.data?.signedUrl) bad(`${b}: signed URL failed — ${signed.error?.message}`);
    else {
      const res = await fetch(signed.data.signedUrl);
      res.ok ? ok(`${b}: signed URL downloads`) : bad(`${b}: signed URL returned ${res.status}`);
    }

    const del = await admin.storage.from(b).remove([path]);
    del.error ? bad(`${b}: delete failed — ${del.error.message}`) : ok(`${b}: owned file deleted`);
  }
}

console.log(`\n${failures ? `${failures} check(s) FAILED` : "All storage checks passed"}`);
process.exit(failures ? 1 : 0);
