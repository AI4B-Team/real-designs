/**
 * Product analytics + funnel tracking (PostHog).
 *
 * Safe no-op until a PostHog connection is linked: without
 * VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY every call short-circuits, so
 * tracking code can live everywhere without breaking local/dev builds.
 */

type Props = Record<string, unknown>;

let ready = false;
let started = false;
let ph: typeof import("posthog-js").default | null = null;

const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"] as string | undefined;
const region = (import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] as string) || "eu";
const apiHost = region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";

const queue: Array<[string, Props | undefined]> = [];

export function analyticsEnabled() {
  return Boolean(token);
}

export async function initAnalytics() {
  if (typeof window === "undefined" || started || !token) return;
  started = true;

  const mod = await import("posthog-js");
  ph = mod.default;
  ph.init(token, {
    api_host: apiHost,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: true,
  });
  ready = true;

  for (const [event, props] of queue.splice(0)) ph.capture(event, props);

  // Identify the signed-in user and reset on sign-out.
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    if (data.user) identify(data.user.id, { email: data.user.email });
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        identify(session.user.id, { email: session.user.email });
      } else if (event === "SIGNED_OUT") {
        ph?.reset();
      }
    });
  } catch {
    /* auth is optional for tracking */
  }
}

export function track(event: string, props?: Props) {
  if (typeof window === "undefined" || !token) return;
  if (ready && ph) ph.capture(event, props);
  else if (queue.length < 50) queue.push([event, props]);
}

export function identify(id: string, props?: Props) {
  if (!ready || !ph) return;
  ph.identify(id, props);
}

export function trackPageview(path: string) {
  track("$pageview", { $current_url: window.location.origin + path, path });
}

declare global {
  interface Window {
    rdTrack?: (event: string, props?: Props) => void;
  }
}

if (typeof window !== "undefined") {
  window.rdTrack = track;
}
