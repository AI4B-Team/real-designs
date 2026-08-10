import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";
import "@/styles/rd-legal.css";

const TITLE = "About REAL DESIGNS | Built By People Who Renovate";
const DESC =
  "Two decades of buying, gutting and reselling distressed property in Tampa Bay, turned into an AI tool that prices the design it just produced.";

export const Route = createFileRoute("/about")({
  head: () => pageHead("/about", TITLE, DESC),
  component: AboutPage,
});

const SECTIONS = [
  {
    h2: "The Origin",
    body: [
      "REAL DESIGNS did not start in a design studio. It started in Tampa, in houses that smelled like mildew, with a clipboard and a contractor who wanted a number by Friday.",
      "For two decades we have bought distressed property, gutted it, and put it back on the market. Somewhere in there we ended up on television doing it. And the same problem showed up on every single job: everyone could imagine the finished room, and nobody could tell you what it would cost until the bids came back a week later.",
      "When AI design tools arrived, they solved the wrong half. They made the pretty picture instant and left the number exactly where it was.",
    ],
  },
  {
    h2: "What We Actually Built",
    body: [
      "A tool that reads the design it just produced, breaks it into line items with quantities and trades, and prices it against local labour and material rates. Not a ballpark. A planning range with a stated confidence level, built from twenty years of real invoices before it was ever built from a database.",
      "We also made it keep your walls where they are. Every render starts from your photograph and preserves the architecture, because a design you cannot build is a screensaver.",
    ],
  },
  {
    h2: "What We Will Not Do",
    body: [],
    bullets: [
      "We will not tell you a number is a bid when it is an estimate.",
      "We will not invent customer testimonials.",
      "We will not run a countdown timer that resets when you reload the page.",
      "We will not train our models on your photographs without asking you first.",
    ],
    after: [
      "If that costs us a few conversions, fine. The people we built this for are making forty thousand dollar decisions. They can tell the difference.",
    ],
  },
  {
    h2: "Where We Are",
    body: [
      "Tampa Bay, Florida. Our cost data starts here because this is where we have actually done the work, and it expands as we can back it up.",
    ],
  },
];

function AboutPage() {
  return (
    <div className="rd-site rd-legal">
      <SiteHeader />

      <main className="rd-legal-main">
        <header className="rd-legal-head">
          <span className="eyebrow">About</span>
          <h1>We Built This Because We Needed It.</h1>
          <p className="rd-legal-lede">
            Twenty years of renovation work in Tampa Bay, turned into software that prices the
            design it just made.
          </p>
        </header>

        <article className="rd-legal-prose">
          {SECTIONS.map((s) => (
            <section key={s.h2} id={s.h2.toLowerCase().replace(/[^a-z]+/g, "-")}>
              <h2>{s.h2}</h2>
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.bullets && (
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {s.after?.map((p, i) => (
                <p key={`a${i}`}>{p}</p>
              ))}
            </section>
          ))}

          <div className="rd-legal-cta">
            <Link to="/auth" className="btn btn-primary">
              Start Free
            </Link>
            <Link to="/pricing" className="btn btn-ghost">
              See The Pricing
            </Link>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
