/**
 * Render-time removal of markup for features that are not shipped.
 *
 * A hidden feature is not "hidden": its markup never enters the document at
 * all. Everything that used to run after mount — nav gating, `hidden = true`,
 * "Coming Soon" relabelling — depended on initialization succeeding, so any
 * unrelated startup failure brought Budget straight back. This module cuts the
 * markup out of the HTML string before it is ever handed to the DOM, so the
 * only way Budget can reappear is by flipping the feature registry.
 */
import { isFeatureVisible } from "@/features/app-shell/feature-availability";

/** Substrings that identify a start tag whose whole element must go. */
const BUDGET_MARKERS = [
  'id="kpiBudget"',
  'id="budgetVsEstimateCard"',
  'id="toolrowBudget"',
  'id="v-scope"',
  'id="dfMarketField"',
  'id="dfBandField"',
  'id="budgetSoon"',
  'data-goto="scope"',
  'data-v="scope"',
  'data-tool="Budget"',
];

/** Void elements never have a closing tag. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Start index of the tag that contains `at`, or -1 when there is none. */
function tagStart(html: string, at: number): number {
  const open = html.lastIndexOf("<", at);
  if (open < 0) return -1;
  const close = html.indexOf(">", open);
  if (close < 0 || close < at) return -1;
  return open;
}

/**
 * Remove the element whose start tag contains `marker`, including every
 * descendant. Tag depth is counted so nested elements of the same name cannot
 * end the removal early.
 */
export function removeElement(html: string, marker: string): string {
  let out = html;
  for (let guard = 0; guard < 50; guard++) {
    const hit = out.indexOf(marker);
    if (hit < 0) return out;
    const start = tagStart(out, hit);
    if (start < 0) return out;
    const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(out.slice(start, start + 40));
    if (!nameMatch) return out;
    const name = nameMatch[1]!.toLowerCase();
    const startTagEnd = out.indexOf(">", start);
    if (startTagEnd < 0) return out;
    const selfClosing = out[startTagEnd - 1] === "/" || VOID.has(name);
    let end = startTagEnd + 1;
    if (!selfClosing) {
      let depth = 1;
      const re = new RegExp(`<${name}\\b|</${name}\\s*>`, "gi");
      re.lastIndex = startTagEnd + 1;
      let m: RegExpExecArray | null;
      while ((m = re.exec(out))) {
        depth += m[0].startsWith("</") ? -1 : 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      }
      if (depth !== 0) return out;
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

/** Markers whose elements must not be rendered, given the feature registry. */
export function hiddenMarkers(): string[] {
  return isFeatureVisible("budget") ? [] : BUDGET_MARKERS;
}

/** Strip every hidden feature's markup from an app HTML fragment. */
export function gateFeatureMarkup(html: string): string {
  return hiddenMarkers().reduce((acc, marker) => removeElement(acc, marker), html);
}
