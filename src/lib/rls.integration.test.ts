/**
 * Live RLS and storage-policy contract tests.
 *
 * These run against a real project and are skipped unless credentials are
 * present, so `npm test` stays hermetic:
 *
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
 *   E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run test:integration
 *
 * They assert that access is DENIED. Nothing here may be "fixed" by loosening
 * a policy — a failure means the database is more open than intended.
 */

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
const email = process.env["E2E_USER_EMAIL"];
const password = process.env["E2E_USER_PASSWORD"];

const live = Boolean(url && key);
const authed = live && Boolean(email && password);

describe.skipIf(!live)("signed-out access is closed", () => {
  const anon = () => createClient(url!, key!, { auth: { persistSession: false } });

  it.each([
    "properties",
    "projects",
    "video_projects",
    "property_media_assets",
    "credit_accounts",
    "user_roles",
  ])("cannot read %s", async (table) => {
    const { data, error } = await anon().from(table).select("*").limit(1);
    expect(error ?? { message: "" }).toBeTruthy();
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot write to a workspace table", async () => {
    const { error } = await anon()
      .from("properties")
      .insert({ address: "hack" } as never);
    expect(error).toBeTruthy();
  });

  it("cannot list a private bucket", async () => {
    const { data } = await anon().storage.from("room-photos").list("");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot sign a URL for someone else's object", async () => {
    const { error } = await anon()
      .storage.from("room-photos")
      .createSignedUrl("00000000-0000-4000-8000-000000000000/x.jpg", 60);
    expect(error).toBeTruthy();
  });
});

describe.skipIf(!authed)("signed-in access is workspace scoped", () => {
  const client = createClient(url!, key!, { auth: { persistSession: false } });
  let userId = "";

  beforeAll(async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
    if (error) throw error;
    userId = data.user?.id ?? "";
  });

  it("only ever returns rows from the caller's workspace", async () => {
    const { data } = await client.from("properties").select("id, owner_id").limit(50);
    for (const row of data ?? []) expect((row as { owner_id: string }).owner_id).toBe(userId);
  });

  it("changing an id in the request cannot reach another workspace", async () => {
    const foreign = "00000000-0000-4000-8000-000000000000";
    const { data } = await client.from("properties").select("id").eq("owner_id", foreign);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot insert a row owned by someone else", async () => {
    const { error } = await client
      .from("properties")
      .insert({ address: "spoof", owner_id: "00000000-0000-4000-8000-000000000000" } as never);
    expect(error).toBeTruthy();
  });

  it("cannot upload outside its own storage folder", async () => {
    const body = new Blob(["x"], { type: "image/jpeg" });
    const { error } = await client.storage
      .from("room-photos")
      .upload(`00000000-0000-4000-8000-000000000000/probe.jpg`, body);
    expect(error).toBeTruthy();
  });

  it("cannot read retention or pricing tables", async () => {
    for (const table of ["billing_retention", "account_deletions", "unit_costs", "markets"]) {
      const { data, error } = await client.from(table).select("*").limit(1);
      expect(error ?? (data ?? []).length === 0).toBeTruthy();
    }
  });
});
