import { useEffect } from "react";

import { initDatalists } from "@/lib/datalists";
import { initSelects } from "@/lib/selects";
import { initTooltips } from "@/lib/tooltips";

import { overlaysHtml, viewsHtml } from "@/content/rd-app-html";
import { initApp } from "@/content/rd-app-script";

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
  return <div className="rd-legacy" dangerouslySetInnerHTML={{ __html: viewsHtml }} />;
}

export function LegacyOverlays() {
  return <div className="rd-legacy-overlays" dangerouslySetInnerHTML={{ __html: overlaysHtml }} />;
}

/**
 * Runs after its siblings have mounted (child effects fire in tree order), so
 * the legacy controller always finds the shell, the views and the overlays.
 */
export function LegacyRuntime() {
  useEffect(() => {
    const cleanup = initApp();
    const stopTips = initTooltips(document);
    const stopSelects = initSelects(document);
    const stopLists = initDatalists(document);
    return () => {
      stopLists();
      stopSelects();
      stopTips();
      cleanup();
    };
  }, []);
  return null;
}
