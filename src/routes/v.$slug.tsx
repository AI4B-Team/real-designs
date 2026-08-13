import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";

import { getRevealPresentation, submitPresentationFeedback } from "@/lib/reveal.functions";
import { DISCLOSURE_LABEL } from "@/lib/reveal-render";
import "@/styles/rd-presentation.css";

export const Route = createFileRoute("/v/$slug")({
  loader: async ({ params }) => {
    try {
      return { key: params.slug, deck: await getRevealPresentation({ data: { key: params.slug } }) };
    } catch {
      return { key: params.slug, deck: null };
    }
  },
  head: ({ loaderData }) => {
    const deck: any = loaderData?.deck;
    const title = deck && !deck.locked && deck.title ? `${deck.title} | REAL DESIGNS` : "Property Presentation | REAL DESIGNS";
    const description =
      deck && !deck.locked
        ? `${deck.address ? deck.address + " — " : ""}Video walkthrough, before and after photos and a planning range, shared through REAL DESIGNS.`
        : "A private property presentation shared through REAL DESIGNS.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <Shell>This presentation could not be opened. Ask the sender for a fresh link.</Shell>,
  notFoundComponent: () => <Shell>This presentation is no longer active.</Shell>,
  component: PresentationPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pv">
      <div className="pv-wrap">
        <div className="pv-card pv-lock">
          <span className="pv-brand">REAL DESIGNS</span>
          <p className="pv-sub">{children}</p>
        </div>
      </div>
    </main>
  );
}

const money = (n: number) => "$" + Math.round(n).toLocaleString();

function PresentationPage() {
  const { key, deck: initial } = Route.useLoaderData();
  const [deck, setDeck] = useState<any>(initial);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  if (!deck) return <Shell>This presentation is no longer active.</Shell>;
  if (deck.expired) return <Shell>This link has expired. Ask the sender for a new one.</Shell>;

  if (deck.locked) {
    return (
      <main className="pv">
        <div className="pv-wrap">
          <div className="pv-card pv-lock">
            <h1 className="pv-h1">Private Presentation</h1>
            <p className="pv-sub">Enter the password the sender gave you.</p>
            <label className="pv-f">
              Password
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            {pwError ? <p className="pv-note">{pwError}</p> : null}
            <button
              className="pv-btn pv-btn-primary"
              disabled={busy || !pw}
              onClick={async () => {
                setBusy(true);
                setPwError("");
                try {
                  const res: any = await getRevealPresentation({ data: { key, password: pw } });
                  if (!res || res.locked) setPwError("That password did not match.");
                  else setDeck(res);
                } catch {
                  setPwError("That password did not match.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Checking…" : "Open Presentation"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const s = deck.sections || {};
  const accent = /^#[0-9a-f]{6}$/i.test(deck.brand?.accent || "") ? deck.brand.accent : "#CC0000";
  const beforeAfter = (deck.scenes || []).filter((x: any) => x.before_url && x.after_url);
  const rooms = (deck.scenes || []).filter((x: any) => x.after_url && !(x.before_url && x.after_url));

  async function send(kind: "comment" | "approved" | "changes") {
    setBusy(true);
    try {
      await submitPresentationFeedback({ data: { key, kind, name: name || null, note: note || null } });
      setSent(
        kind === "approved"
          ? "Thank you — your approval was sent."
          : kind === "changes"
            ? "Thank you — your change request was sent."
            : "Thank you — your comment was sent.",
      );
      setNote("");
    } catch (e: any) {
      setSent(e?.message || "That could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className={"pv" + (deck.mobile_layout === "compact" ? " is-compact" : "")}
      style={{ "--pv-accent": accent } as Record<string, string>}
    >
      <header className="pv-head">
        <span className="pv-brand">
          {deck.brand?.logo_url ? (
            <img src={deck.brand.logo_url} alt={deck.brand.company_name || "Brand logo"} />
          ) : null}
          {deck.brand?.company_name || (
            <>
              REAL <b>DESIGNS</b>
            </>
          )}
        </span>
        <span className="pv-kicker">
          {deck.presentation_type === "design"
            ? "Design Presentation"
            : deck.presentation_type === "renovation"
              ? "Renovation Presentation"
              : deck.presentation_type === "portfolio"
                ? "Portfolio"
                : "Listing Presentation"}
        </span>
      </header>

      <div className="pv-wrap">
        <section className="pv-card">
          <h1 className="pv-h1">{deck.title}</h1>
          {deck.address ? <p className="pv-sub">{deck.address}</p> : null}
          {deck.headline ? <p className="pv-lead">{deck.headline}</p> : null}
        </section>

        {s.video !== false && deck.video_url ? (
          <section className="pv-card">
            <h2 className="pv-h2">The Walkthrough</h2>
            <div className="pv-video">
              <video src={deck.video_url} controls playsInline preload="metadata" />
            </div>
            {deck.allow_download ? (
              <p className="pv-note">
                <a href={deck.video_url} download>
                  Download This Video
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {s.before_after !== false && beforeAfter.length ? (
          <section className="pv-card">
            <h2 className="pv-h2">Before And After</h2>
            {beforeAfter.map((x: any, i: number) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <b>{x.room_name}</b>
                <div className="pv-ba">
                  <figure>
                    <img src={x.before_url} alt={`${x.room_name} before the redesign`} />
                    <figcaption>Before</figcaption>
                  </figure>
                  <figure>
                    <img src={x.after_url} alt={`${x.room_name} after the redesign`} />
                    <figcaption>After</figcaption>
                  </figure>
                </div>
                {x.disclosure_type ? (
                  <span className="pv-disc">{DISCLOSURE_LABEL[x.disclosure_type] || "Digitally Altered"}</span>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {s.rooms !== false && rooms.length ? (
          <section className="pv-card">
            <h2 className="pv-h2">The Spaces</h2>
            <div className="pv-grid">
              {rooms.map((x: any, i: number) => (
                <div className="pv-shot" key={i}>
                  <img src={x.after_url} alt={x.caption || x.room_name || "Property photo"} />
                  <b>{x.caption || x.room_name}</b>
                </div>
              ))}
            </div>
            <p className="pv-note">
              Designed views are proposed concepts created in REAL DESIGNS, not photographs of a completed
              renovation.
            </p>
          </section>
        ) : null}

        {s.budget && deck.budget ? (
          <section className="pv-card">
            <h2 className="pv-h2">Planning Range</h2>
            {deck.budget.lines.length ? (
              <table className="pv-table">
                <thead>
                  <tr>
                    <th>Line Item</th>
                    <th>Trade</th>
                    <th className="n">Low</th>
                    <th className="n">High</th>
                  </tr>
                </thead>
                <tbody>
                  {deck.budget.lines.map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.description}</td>
                      <td>{l.trade}</td>
                      <td className="n">{money(l.low)}</td>
                      <td className="n">{money(l.high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <div className="pv-range">
              <span>Estimated Planning Range</span>
              <b>
                {money(deck.budget.low)} to {money(deck.budget.high)}
              </b>
            </div>
            <p className="pv-note">Planning estimate, not a construction bid. Field verification is required.</p>
          </section>
        ) : null}

        {(deck.comments_enabled || deck.approval_enabled) && !sent ? (
          <section className="pv-card">
            <h2 className="pv-h2">{deck.approval_enabled ? "Your Response" : "Leave A Comment"}</h2>
            <label className="pv-f">
              Your Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="pv-f">
              {deck.approval_enabled ? "Notes For The Sender" : "Comment"}
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="pv-actions">
              {deck.approval_enabled ? (
                <>
                  <button className="pv-btn pv-btn-primary" disabled={busy} onClick={() => send("approved")}>
                    Approve
                  </button>
                  <button className="pv-btn" disabled={busy} onClick={() => send("changes")}>
                    Request Changes
                  </button>
                </>
              ) : null}
              {deck.comments_enabled ? (
                <button className="pv-btn" disabled={busy || !note} onClick={() => send("comment")}>
                  Send Comment
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {sent ? (
          <section className="pv-card">
            <p className="pv-ok">{sent}</p>
          </section>
        ) : null}

        {s.contact !== false && deck.brand ? (
          <section className="pv-card">
            <h2 className="pv-h2">Get In Touch</h2>
            <div className="pv-contact">
              {deck.brand.contact_name ? <span>{deck.brand.contact_name}</span> : null}
              {deck.brand.phone ? <a href={`tel:${deck.brand.phone}`}>{deck.brand.phone}</a> : null}
              {deck.brand.email ? <a href={`mailto:${deck.brand.email}`}>{deck.brand.email}</a> : null}
              {deck.brand.website ? (
                <a href={deck.brand.website} target="_blank" rel="noreferrer">
                  {deck.brand.website}
                </a>
              ) : null}
            </div>
            {deck.brand.default_cta ? (
              <div className="pv-actions" style={{ marginTop: 14 }}>
                <a className="pv-btn pv-btn-primary" href={deck.brand.email ? `mailto:${deck.brand.email}` : "#"}>
                  {deck.brand.default_cta}
                </a>
              </div>
            ) : null}
          </section>
        ) : null}

        <footer className="pv-foot">
          Shared securely through REAL DESIGNS. Designed views are AI-generated concepts.
        </footer>
      </div>
    </main>
  );
}
