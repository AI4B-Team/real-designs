import { createFileRoute } from "@tanstack/react-router";
import { Fragment } from "react";
import { Check, X, ArrowLeft } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Compare Every Feature | REAL DESIGNS Plans";
const DESC =
  "Full feature comparison of the Free, Starter, Pro and Studio plans: downloads, licensing, budgets, floor plans, walkthroughs, team seats and client delivery.";

export const Route = createFileRoute("/pricing_/compare")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/pricing/compare") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/pricing/compare") }],
  }),
  component: ComparePage,
});

type Row = [string, string | boolean, string | boolean, string | boolean, string | boolean];

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Design",
    rows: [
      ["Monthly credits", "5 a day", "200", "2,000", "4,000"],
      ["Interiors, exteriors and landscapes", true, true, true, true],
      ["Full style library and Reality Lock", true, true, true, true],
      ["Virtual staging, declutter, material swap", true, true, true, true],
      ["Design DNA", false, "One property", "Unlimited", "Unlimited"],
    ],
  },
  {
    title: "Output & Licensing",
    rows: [
      ["Clean HD download", false, true, true, true],
      ["Watermark removed", false, true, true, true],
      ["Personal use license", false, true, true, true],
      ["Commercial license", false, false, true, true],
    ],
  },
  {
    title: "Planning",
    rows: [
      ["Typical budget range by room type", true, true, true, true],
      ["Scope and budget from your photo", false, true, true, true],
      ["Shopping list with live pricing", false, true, true, true],
      ["Contractor brief PDF", false, false, true, true],
      ["ARV impact range", false, false, true, true],
      ["2D to 3D floor plans", false, false, false, true],
      ["Video walkthroughs", false, false, false, true],
    ],
  },
  {
    title: "Delivery & Teams",
    rows: [
      ["Before and after presentation", false, true, true, true],
      ["Batch listing staging with MLS disclosure", false, false, true, true],
      ["Client approval portal", false, false, false, true],
      ["Brand presets and white label decks", false, false, false, true],
      ["Priority render queue", false, false, false, true],
      ["Team seats", "1", "1", "5", "Unlimited"],
    ],
  },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={16} className="ok" />;
  if (v === false) return <X size={16} className="nope" />;
  return <span>{v}</span>;
}

function ComparePage() {
  return (
    <div className="rd-site rd-lp rd-pricing">
      <SiteHeader />

      <section className="alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Compare</span>
            <h1>Every Feature, Side By Side.</h1>
            <p className="lede lede-wide">
              The complete breakdown of what each plan includes.
            </p>
          </div>

          <div className="cmp-wrap">
            <table className="cmp-t">
              <thead>
                <tr>
                  <th />
                  <th>Free</th>
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Studio</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => (
                  <Fragment key={g.title}>
                    <tr className="grp">
                      <td colSpan={5}>{g.title}</td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r[0]}>
                        <td>{r[0]}</td>
                        <td>
                          <Cell v={r[1]} />
                        </td>
                        <td>
                          <Cell v={r[2]} />
                        </td>
                        <td>
                          <Cell v={r[3]} />
                        </td>
                        <td>
                          <Cell v={r[4]} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <p className="price-more">
            <a href="/pricing">
              <ArrowLeft size={15} /> Back To Plans
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
