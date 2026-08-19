import { describe, expect, it } from "vitest";
import { describeConfigReport, validateServerConfig } from "./server-config";

const base = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  LOVABLE_API_KEY: "key",
};

describe("validateServerConfig", () => {
  it("passes on a complete environment", () => {
    const r = validateServerConfig(base);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(describeConfigReport(r)).toMatch(/complete/);
  });

  it("names every missing required variable", () => {
    const r = validateServerConfig({ SUPABASE_URL: base.SUPABASE_URL });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(r.missing).toContain("LOVABLE_API_KEY");
  });

  it("fails when a secret is exposed through a VITE_ variable", () => {
    const r = validateServerConfig({ ...base, VITE_SUPABASE_SERVICE_ROLE_KEY: "leak" });
    expect(r.ok).toBe(false);
    expect(r.leaked).toEqual(["VITE_SUPABASE_SERVICE_ROLE_KEY"]);
    expect(describeConfigReport(r)).toMatch(/exposed to the browser/);
  });

  it("does not treat the publishable key as a leak", () => {
    const r = validateServerConfig({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" });
    expect(r.leaked).toEqual([]);
  });

  it("warns about a missing publishable key and a non-https url", () => {
    const r = validateServerConfig({ SUPABASE_URL: "http://x", SUPABASE_SERVICE_ROLE_KEY: "k", LOVABLE_API_KEY: "k" });
    expect(r.warnings).toHaveLength(2);
  });
});
