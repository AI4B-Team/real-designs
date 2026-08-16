import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Site Watch — listing site monitoring, gated on a written ownership
 * attestation. We never pull from portals: the person granting access has to
 * be the person who owns the content, so portal hosts are rejected outright
 * and every row stores the exact attestation text the user agreed to.
 */

export const ATTESTATION_VERSION = "v1";
export const ATTESTATION_TEXT =
  "I Own This Website And Grant REAL DESIGNS Permission To Periodically Pull Data From It. I Have The Right To Access And Use This Data.";

const USER_AGENT = "REAL DESIGNS Site Monitor (+https://realdesigns.ai/contact)";

const PORTALS = [
  "zillow.com", "redfin.com", "realtor.com", "trulia.com", "homes.com", "compass.com",
  "rightmove.co.uk", "zoopla.co.uk", "onthemarket.com", "movoto.com", "point2homes.com",
  "century21.com", "coldwellbankerhomes.com", "remax.com", "sothebysrealty.com",
  "apartments.com", "rent.com", "loopnet.com", "har.com", "estately.com", "openhouse.com",
  "realestate.com.au", "domain.com.au", "idealista.com", "immobilienscout24.de",
  "facebook.com", "instagram.com", "craigslist.org", "airbnb.com", "vrbo.com",
];

function hostOf(raw: string) {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  const u = new URL(withScheme);
  return { url: u.toString(), host: u.hostname.toLowerCase().replace(/^www\./, ""), origin: u.origin };
}

function isPortal(host: string) {
  return PORTALS.some((p) => host === p || host.endsWith("." + p));
}

/** Politely ask the target whether we may read it. Absent robots means yes. */
async function robotsAllows(origin: string) {
  try {
    const res = await fetch(origin + "/robots.txt", {
      headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return true;
    const txt = (await res.text()).slice(0, 20000);
    let applies = false;
    let allowed = true;
    for (const line of txt.split(/\r?\n/)) {
      const [rawKey, ...rest] = String(line.split("#")[0] || "").split(":");
      const key = (rawKey || "").trim().toLowerCase();
      const val = rest.join(":").trim();
      if (key === "user-agent") applies = val === "*" || /real designs/i.test(val);
      else if (applies && key === "disallow" && val === "/") allowed = false;
      else if (applies && key === "allow" && val === "/") allowed = true;
    }
    return allowed;
  } catch (_) {
    return true;
  }
}

export const checkWatchSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ site_url: z.string().min(3).max(400) }).parse(d))
  .handler(async ({ data }) => {
    let parsed;
    try {
      parsed = hostOf(data.site_url.trim());
    } catch (_) {
      return { ok: false, reason: "That Does Not Look Like A Web Address. Try Something Like https://your-site.com." };
    }
    if (isPortal(parsed.host)) {
      return { ok: false, reason: "This Looks Like A Listing Portal, Not Your Own Site. Add A Site You Own." };
    }
    const robots = await robotsAllows(parsed.origin);
    let reachable = true;
    try {
      const res = await fetch(parsed.url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      reachable = res.status < 500;
    } catch (_) {
      reachable = false;
    }
    return {
      ok: true,
      host: parsed.host,
      url: parsed.url,
      robots_ok: robots,
      reachable,
      reason: !robots
        ? "This Site Asks Crawlers To Stay Out In Its robots.txt. We Will Not Monitor It Until That Changes."
        : reachable
          ? "Looks Good. This Site Is Reachable."
          : "We Could Not Reach That Address. Check The Spelling Before You Start Monitoring.",
    };
  });

export const listWatchedSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watched_sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sites: data || [] };
  });

export const addWatchedSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        site_url: z.string().min(3).max(400),
        period: z.enum(["weekly", "monthly"]).default("weekly"),
        watch_since: z.string().max(20).nullable().optional(),
        video_type: z.enum(["listing_video", "social_reel"]).default("listing_video"),
        new_listing_mode: z.enum(["review", "auto"]).default("review"),
        attested: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.attested) throw new Error("Tick The Ownership And Permission Box Before Monitoring Starts.");
    let parsed;
    try {
      parsed = hostOf(data.site_url.trim());
    } catch (_) {
      throw new Error("That Does Not Look Like A Web Address.");
    }
    if (isPortal(parsed.host)) {
      throw new Error("This Looks Like A Listing Portal, Not Your Own Site. Add A Site You Own.");
    }
    const robots_ok = await robotsAllows(parsed.origin);
    if (!robots_ok) throw new Error("This Site Asks Crawlers To Stay Out In Its robots.txt. We Will Not Monitor It.");

    const { data: row, error } = await context.supabase
      .from("watched_sites")
      .insert({
        user_id: context.userId,
        site_url: parsed.url,
        host: parsed.host,
        period: data.period,
        watch_since: data.watch_since || null,
        video_type: data.video_type,
        new_listing_mode: data.new_listing_mode,
        robots_ok,
        status: "active",
        attested_at: new Date().toISOString(),
        attestation_version: ATTESTATION_VERSION,
        attestation_text: ATTESTATION_TEXT,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { site: row };
  });

export const removeWatchedSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watched_sites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
