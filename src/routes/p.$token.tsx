import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getSharedPresentation, respondToPresentation } from "@/lib/presentations.functions";
import "@/styles/rd-site.css";

export const Route = createFileRoute("/p/$token")({
  loader: async ({ params }) => {
    try {
      return { token: params.token, deck: await getSharedPresentation({ data: { token: params.token } }) };
    } catch {
      return { token: params.token, deck: null };
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData?.deck ? `${loaderData.deck.title} | REAL DESIGNS` : "Design Package | REAL DESIGNS";
    const description = loaderData?.deck
      ? `${loaderData.deck.room_name} at ${loaderData.deck.address} — before and after with a planning budget range.`
      : "A private design package shared with you through REAL DESIGNS.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => <Shell><p>This link could not be opened. Ask the sender for a fresh one.</p></Shell>,
  notFoundComponent: () => <Shell><p>This link is no longer active.</p></Shell>,
  component: SharedPresentation,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pp-wrap">
      <div className="pp-card pp-empty">
        <span className="pp-brand">REAL DESIGNS</span>
        {children}
      </div>
    </main>
  );
}

const money = (n: number) => "$" + Math.round(n).toLocaleString();

function SharedPresentation() {
  const { token, deck } = Route.useLoaderData();
  const [status, setStatus] = useState(deck?.status ?? "sent");
  const [savedNote, setSavedNote] = useState(deck?.decision_note ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (deck) document.title = `${deck.title} | REAL DESIGNS`;
  }, [deck]);

  if (!deck) return <Shell><p>This link is no longer active.</p></Shell>;

  const decided = status === "approved" || status === "changes";
  const hasCompare = Boolean(deck.after_url && deck.before_url);

  function moveSplit(clientX: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }

  async function decide(decision: "approved" | "changes") {
    setBusy(true);
    try {
      const res = await respondToPresentation({ data: { token, decision, note: note || undefined } });
      if (res?.ok) {
        setStatus(decision);
        setSavedNote(note);
      }
    } finally {
      setBusy(false);
    }
  }

  const accent = /^#[0-9a-f]{6}$/i.test(deck.brand_accent || "") ? (deck.brand_accent as string) : "#CC0000";
  const brandName = (deck.brand_name || "").trim();

  return (
    <main className="pp-wrap" style={{ "--pp-accent": accent } as Record<string, string>}>
      <header className="pp-head">
        <span className="pp-brand">
          {brandName || (<>REAL <b>DESIGNS</b></>)}
          {brandName ? <span className="pp-via">via Real Designs</span> : null}
        </span>
        <span className="pp-kicker">Prepared For {deck.client_name || "You"}</span>
      </header>

      <section className="pp-card">
        <h1 className="pp-title">{deck.title}</h1>
        <p className="pp-sub">
          {deck.address} &middot; {deck.room_name} &middot; Version {deck.version_no}
          {deck.style ? ` · ${deck.style}` : ""}
        </p>

        {deck.after_url || deck.before_url ? (
          <div
            className={"pp-compare" + (hasCompare ? " is-compare" : "") + (dragging ? " is-drag" : "")}
            onPointerDown={hasCompare ? (e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
              moveSplit(e.clientX, e.currentTarget);
            } : undefined}
            onPointerMove={hasCompare ? (e) => {
              if (dragging) moveSplit(e.clientX, e.currentTarget);
            } : undefined}
            onPointerUp={hasCompare ? () => setDragging(false) : undefined}
            onPointerCancel={hasCompare ? () => setDragging(false) : undefined}
          >
            <img src={deck.before_url ?? deck.after_url ?? ""} alt={`${deck.room_name} before the redesign`} />
            {hasCompare ? (
              <>
                <span className="pp-tag pp-tag-before">Before</span>
                <div className="pp-after" style={{ width: split + "%" }}>
                  <img src={deck.after_url!} alt={`${deck.room_name} after the redesign`} />
                  <span className="pp-tag pp-tag-after">After</span>
                </div>
                <div className="pp-handle" style={{ left: split + "%" }} aria-hidden="true">
                  <span />
                </div>
                <input
                  className="pp-range"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(split)}
                  aria-label="Drag to compare before and after"
                  onChange={(e) => setSplit(Number(e.target.value))}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {hasCompare ? <p className="pp-hint">Drag across the photo to reveal the redesign.</p> : null}

        {deck.total_low != null && deck.total_high != null ? (
          <div className="pp-range-box">
            <span>Estimated Planning Range</span>
            <b>
              {money(deck.total_low)} to {money(deck.total_high)}
            </b>
          </div>
        ) : null}
      </section>

      {deck.lines.length ? (
        <section className="pp-card">
          <h2 className="pp-h2">Scope Of Work</h2>
          <table className="pp-table">
            <thead>
              <tr>
                <th>Line Item</th>
                <th>Trade</th>
                <th className="n">Qty</th>
                <th className="n">Low</th>
                <th className="n">High</th>
              </tr>
            </thead>
            <tbody>
              {deck.lines.map((l: { description: string; trade: string; qty: number; uom: string; low: number; high: number }, i: number) => (
                <tr key={i}>
                  <td data-l="Line Item">{l.description}</td>
                  <td data-l="Trade">{l.trade}</td>
                  <td className="n" data-l="Qty">
                    {l.qty} {l.uom}
                  </td>
                  <td className="n" data-l="Low">{money(l.low)}</td>
                  <td className="n" data-l="High">{money(l.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pp-note">
            Planning estimate, not a construction bid. Quantities are derived from the photo and should be field
            verified.
          </p>
        </section>
      ) : null}

      <section className="pp-card" id="decision">
        <h2 className="pp-h2">Your Decision</h2>
        {decided ? (
          <>
            <p className={"pp-done" + (status === "changes" ? " is-changes" : "")}>
              {status === "approved"
                ? "Approved. The sender has been notified in their workspace."
                : "Changes requested. The sender will follow up with a new version."}
            </p>
            {savedNote ? <p className="pp-yournote">Your note: “{savedNote}”</p> : null}
          </>
        ) : (
          <>
            <textarea
              className="pp-note-in"
              rows={3}
              placeholder="Optional note for the sender"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="pp-actions">
              <button className="pp-btn pp-btn-primary" disabled={busy} onClick={() => decide("approved")}>
                {busy ? "Sending…" : "Approve This Design"}
              </button>
              <button className="pp-btn" disabled={busy} onClick={() => decide("changes")}>
                Request Changes
              </button>
            </div>
          </>
        )}
      </section>

      <footer className="pp-foot">Shared securely through REAL DESIGNS. No account needed.</footer>

      {!decided ? (
        <div className="pp-sticky">
          <a className="pp-btn pp-btn-primary" href="#decision">Approve Or Request Changes</a>
        </div>
      ) : null}
    </main>
  );
}

