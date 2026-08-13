import { createFileRoute } from "@tanstack/react-router";
import { Search, X, ImagePlus, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";

import { SiteFooter, SiteHeader, UploadSpaceLink } from "@/components/seo/SiteChrome";
import { DIRECTIONS, TRAIT_OPTIONS, type Direction } from "@/content/directions";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";
import "@/styles/rd-directory.css";

const TITLE = "Explore AI Home Design Styles | REAL DESIGNS";
const DESC =
  "Explore interior, exterior and landscape design directions. Preview each style, compare palettes and start redesigning your own space with REAL DESIGNS.";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/explore") },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/explore") }],
  }),
  component: ExplorePage,
});

const SPACES = ["All", "Interior", "Exterior", "Landscape", "Virtual Staging"] as const;
type Space = (typeof SPACES)[number];

const ROOMS = ["Living Room", "Kitchen", "Primary Bedroom", "Primary Bath", "Dining Room", "Home Office"];

/** Deep link into the existing homepage builder with the direction preselected. */
const builderHref = (d: Direction) => `/?direction=${encodeURIComponent(d.name)}#builder`;

function matchesSpace(d: Direction, space: Space) {
  if (space === "All") return true;
  if (space === "Virtual Staging") return !!d.staging;
  return d.spaces.includes(space);
}

function ExplorePage() {
  const [q, setQ] = useState("");
  const [space, setSpace] = useState<Space>("All");
  const [room, setRoom] = useState<string | null>(null);
  const [traits, setTraits] = useState<string[]>([]);
  const [open, setOpen] = useState<Direction | null>(null);
  const [shot, setShot] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DIRECTIONS.filter((d) => {
      if (!matchesSpace(d, space)) return false;
      if (room && !d.rooms.includes(room)) return false;
      if (traits.length && !traits.every((t) => d.traits?.includes(t))) return false;
      if (!needle) return true;
      return [d.name, d.line, d.about, ...(d.traits ?? []), ...d.materials, ...d.rooms]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, space, room, traits]);

  const spaceCount = (s: Space) => DIRECTIONS.filter((d) => matchesSpace(d, s)).length;
  const dirty = q !== "" || space !== "All" || room !== null || traits.length > 0;

  function clearAll() {
    setQ("");
    setSpace("All");
    setRoom(null);
    setTraits([]);
  }

  function toggleTrait(t: string) {
    setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function preview(d: Direction) {
    setShot(0);
    setOpen(d);
  }

  const examples = open?.examples?.length ? open.examples : open ? [open.img] : [];

  return (
    <div className="rd-site rd-dir">
      <SiteHeader />

      <main>
        <section className="dir-wrap dir-intro">
          <span className="eyebrow">Design Direction Library</span>
          <h1>Find The Direction That Feels Like You.</h1>
          <p>
            Explore curated directions for interiors, exteriors and landscapes.
            <br />
            Start with one you love, then customize the materials, colors and budget around your
            actual space.
          </p>
          <div className="dir-cta">
            <UploadSpaceLink className="btn btn-primary">
              <ImagePlus size={16} strokeWidth={1.9} aria-hidden="true" />
              Upload Your Space
            </UploadSpaceLink>
          </div>
        </section>

        <div className="dir-filters">
          <div className="dir-wrap">
            <div className="dir-frow">
              <label className="dir-search">
                <Search size={16} strokeWidth={1.9} aria-hidden="true" />
                <span className="sr-only">Search Directions</span>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search a style name or characteristic"
                />
              </label>
              <div className="dir-pills" role="group" aria-label="Space Type">
                {SPACES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="dir-pill"
                    aria-pressed={space === s}
                    onClick={() => {
                      setSpace(s);
                      if (s !== "Interior") setRoom(null);
                    }}
                  >
                    {s}
                    <em>{s === "All" ? DIRECTIONS.length : spaceCount(s)}</em>
                  </button>
                ))}
              </div>
            </div>

            {space === "Interior" && (
              <div className="dir-sub" role="group" aria-label="Room">
                <span className="dir-lab">Room</span>
                {ROOMS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="dir-pill"
                    aria-pressed={room === r}
                    onClick={() => setRoom(room === r ? null : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            <div className="dir-sub" role="group" aria-label="Characteristics">
              <span className="dir-lab">Characteristics</span>
              {TRAIT_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="dir-pill"
                  aria-pressed={traits.includes(t)}
                  onClick={() => toggleTrait(t)}
                >
                  {t}
                </button>
              ))}
              {dirty && (
                <button type="button" className="dir-clear" onClick={clearAll}>
                  Clear Results
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="dir-wrap">
          <p className="dir-count">
            {filtered.length} Of {DIRECTIONS.length} Directions
          </p>

          <div className="dir-grid">
            {filtered.map((d, i) => (
              <article className="dir-card" key={d.id}>
                <div className="dir-img">
                  <img src={d.img} alt={`${d.name} design direction example`} loading="lazy" />
                </div>
                <div className="dir-body">
                  <div className="dir-name">
                    <h2>{d.name}</h2>
                    <span>{String(i + 1).padStart(3, "0")}</span>
                  </div>
                  <p className="dir-line">{d.line}</p>
                  <div className="dir-sw" aria-hidden="true">
                    {d.palette.slice(0, 5).map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </div>
                  <div className="dir-tags">
                    {[...d.spaces, ...(d.staging ? ["Virtual Staging"] : [])].map((s) => (
                      <span className="dir-tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="dir-acts">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => preview(d)}>
                      Preview Direction
                    </button>
                    <a className="btn btn-primary btn-sm" href={builderHref(d)}>
                      Use This Direction
                    </a>
                  </div>
                </div>
              </article>
            ))}

            {filtered.length === 0 && (
              <div className="dir-empty">
                <b>No Exact Matches Yet.</b>
                <p>
                  Try removing a filter, or upload your space and describe the direction you want.
                </p>
                <a href="/#builder" className="btn btn-primary btn-sm">
                  Start A Custom Design
                </a>
              </div>
            )}
          </div>
        </div>
      </main>

      {open && (
        <>
          <div className="dir-scrim" onClick={() => setOpen(null)} aria-hidden="true" />
          <aside className="dir-panel" role="dialog" aria-modal="true" aria-label={open.name}>
            <div className="dir-ph">
              <div>
                <h2>{open.name}</h2>
                <p>{open.line}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(null)}
                aria-label="Close Preview"
              >
                <X size={16} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </div>

            <div className="dir-pb">
              <div className="dir-hero">
                <img
                  src={examples[shot % examples.length]}
                  alt={`${open.name} example ${(shot % examples.length) + 1}`}
                />
              </div>
              {examples.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShot((s) => s + 1)}
                >
                  <Shuffle size={15} strokeWidth={1.9} aria-hidden="true" />
                  See Another Example
                </button>
              )}
              <p className="dir-about">{open.about}</p>

              <div className="dir-spec">
                <b>Color Palette</b>
                <div className="dir-pal" aria-hidden="true">
                  {open.palette.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </div>
              </div>

              <div className="dir-spec">
                <b>Materials And Finishes</b>
                <div>
                  {[...open.materials, ...open.finishes].map((m) => (
                    <span className="dir-tag" key={m}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="dir-spec">
                <b>Best Suited For</b>
                <div>
                  {[...open.spaces, ...open.rooms].map((r) => (
                    <span className="dir-tag" key={r}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="dir-spec">
                <b>Budget And Finish Grade</b>
                <div>
                  {[...open.budgets, ...open.grades].map((b) => (
                    <span className="dir-tag" key={b}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="dir-pf">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>
                Keep Browsing
              </button>
              <a className="btn btn-primary" href={builderHref(open)}>
                Use This Direction
              </a>
            </div>
          </aside>
        </>
      )}

      <SiteFooter />
    </div>
  );
}
