import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initAnalytics, trackPageview } from "../lib/analytics";

function NotFoundComponent() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "#faf8f5", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="max-w-md text-center">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#CC0000",
            padding: 6,
            marginBottom: 22,
          }}
        >
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              border: "2px solid #fff",
              padding: "6px 15px",
              color: "#fff",
            }}
          >
            <b style={{ fontWeight: 900, fontSize: 20, lineHeight: 1, letterSpacing: ".04em" }}>REAL</b>
            <em
              style={{
                fontStyle: "normal",
                textTransform: "uppercase",
                fontWeight: 700,
                fontSize: 7.5,
                lineHeight: 1,
                letterSpacing: ".3em",
                margin: "3px 0 0 .3em",
              }}
            >
              Designs
            </em>
          </span>
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "2.4rem",
            fontWeight: 500,
            color: "#CC0000",
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1 className="mt-4 text-xl font-semibold" style={{ color: "#14120f", letterSpacing: "-.02em" }}>
          Page Not Found
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6b6660" }}>
          This page does not exist or has moved. Head back home or jump straight into the app.
        </p>
        <div className="mt-6 flex items-center justify-center" style={{ gap: 10 }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "#CC0000",
              padding: "10px 18px",
              fontSize: ".88rem",
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Go Home
          </Link>
          <Link
            to="/pricing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: "1px solid #e4dfd7",
              background: "#fff",
              padding: "10px 18px",
              fontSize: ".88rem",
              fontWeight: 600,
              color: "#14120f",
            }}
          >
            See Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}


// A stale/replaced build chunk makes the browser fail the route's dynamic
// import and blanks the page. Reload once (guarded) to pick up fresh chunks.
function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const key = "rd:chunk-reload";
      let s: { n?: number; at?: number } = {};
      try {
        s = JSON.parse(sessionStorage.getItem(key) || "{}") || {};
      } catch {
        s = {};
      }
      const now = Date.now();
      const n = s.at && now - s.at < 30000 ? s.n || 0 : 0;
      if (n < 3) {
        try {
          sessionStorage.setItem(key, JSON.stringify({ n: n + 1, at: now }));
        } catch {
          /* private mode */
        }
        window.setTimeout(() => window.location.reload(), 600 * (n + 1));
        return;
      }
    }

    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);



  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This Page Did Not Load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:site_name", content: "REAL DESIGNS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Runs before hydration: if the client entry chunk itself fails to load (stale
// chunk after a redeploy/dev restart), React never mounts, so the router error
// boundary can't help. Reload once to fetch fresh chunks.
const chunkRecoveryScript = `(function(){
  var K='rd:chunk-reload';
  function isChunk(m){return typeof m==='string'&&(/Failed to fetch dynamically imported module/i.test(m)||/Importing a module script failed/i.test(m)||/error loading dynamically imported module/i.test(m));}
  function state(){try{return JSON.parse(sessionStorage.getItem(K)||'{}')||{};}catch(e){return {};}}
  function retry(m){
    if(!isChunk(m))return;
    var s=state();var now=Date.now();
    var n=(s.at&&now-s.at<30000)?(s.n||0):0;
    if(n>=3)return;
    try{sessionStorage.setItem(K,JSON.stringify({n:n+1,at:now}));}catch(e){return;}
    // The dev/deploy server may still be swapping bundles: wait, then verify the
    // document is reachable before reloading so we don't spin on a dead server.
    setTimeout(function(){
      fetch(location.pathname,{cache:'reload'}).then(function(){location.reload();},function(){location.reload();});
    },600*(n+1));
  }
  addEventListener('error',function(e){retry(e&&e.message);});
  addEventListener('unhandledrejection',function(e){var r=e&&e.reason;retry(r&&r.message||String(r));});
})();`;


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // The app mounted fine, so allow a future one-shot chunk reload again.
  useEffect(() => {
    try {
      sessionStorage.removeItem("rd:chunk-reload");
    } catch {
      /* private mode */
    }
  }, []);


  // Global: white dropdown menus and white tooltips on every route.
  useEffect(() => {
    let stop: Array<() => void> = [];
    void Promise.all([import("../lib/tooltips"), import("../lib/selects")]).then(
      ([tips, sels]) => {
        stop = [tips.initTooltips(document), sels.initSelects(document)];
      },
    );
    return () => stop.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void initAnalytics().then(() => {
      trackPageview(window.location.pathname + window.location.search);
      unsub = router.subscribe("onResolved", () => {
        trackPageview(window.location.pathname + window.location.search);
      });
    });
    return () => unsub?.();
  }, [router]);


  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
