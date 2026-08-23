import { useEffect } from "react";

import { initDatalists } from "@/lib/datalists";
import { initSelects } from "@/lib/selects";
import { initTooltips } from "@/lib/tooltips";

import { gateFeatureMarkup } from "@/content/feature-markup-gate";
import { overlaysHtml, viewsHtml } from "@/content/rd-app-html";
import { initApp } from "@/content/rd-app-script";
import { guardMount } from "@/lib/errors/mount-guard";

/* Hidden features are cut out of the markup once, at module scope, so they can
   never reach the DOM — not even for a frame, and not even when the rest of
   initialization fails. */
const gatedViewsHtml = gateFeatureMarkup(viewsHtml);
const gatedOverlaysHtml = gateFeatureMarkup(overlaysHtml);

/**
 * Compatibility layer for back-office screens that have not been migrated to
 * React yet.
 *
 * `LegacyViews` renders the remaining prototype views inside the React
 * AppShell, `LegacyOverlays` renders the modal/tour layer that lives outside
 * `.app`, and `LegacyRuntime` boots the imperative controller once both are in
 * the DOM. As each feature moves to `src/features/<feature>`, its markup and
 * script leave these files and this layer shrinks.
 */
export function LegacyViews() {
  return <div className="rd-legacy" dangerouslySetInnerHTML={{ __html: gatedViewsHtml }} />;
}

export function LegacyOverlays() {
  return <div className="rd-legacy-overlays" dangerouslySetInnerHTML={{ __html: gatedOverlaysHtml }} />;
}

/**
 * Runs after its siblings have mounted (child effects fire in tree order), so
 * the legacy controller always finds the shell, the views and the overlays.
 */
export function LegacyRuntime() {
  useEffect(() => {
    /* Each initializer is isolated: before this guard, one throw anywhere in
       the imperative controller left the user on an empty shell with nothing
       in the console but a raw stack. Now a failure is classified, reported
       with a correlation reference, and the surviving modules still run. */
    const app = guardMount("legacy.initApp", initApp, { required: true });
    const tips = guardMount("legacy.tooltips", () => initTooltips(document));
    const selects = guardMount("legacy.selects", () => initSelects(document));
    const lists = guardMount("legacy.datalists", () => initDatalists(document));
    return () => {
      guardMount("legacy.datalists.cleanup", () => lists.value?.());
      guardMount("legacy.selects.cleanup", () => selects.value?.());
      guardMount("legacy.tooltips.cleanup", () => tips.value?.());
      guardMount("legacy.initApp.cleanup", () => app.value?.());
    };
  }, []);
  return null;
}
