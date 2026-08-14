import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { getSharedPackage, commentOnPackage, decideOnPackage } from "@/lib/presentation-packages.functions";
import "@/styles/rd-site.css";
import "@/styles/rd-share-pkg.css";

export const Route = createFileRoute("/pkg/$token")({
  loader: async ({ params }) => {
    try {
      return { token: params.token, pack: await getSharedPackage({ data: { token: params.token } }) };
    } catch {
      return { token: params.token, pack: null };
    }
  },
  head: ({ loaderData }) => {
    const pk = (loaderData?.pack as any)?.package;
    const title = pk ? `${pk.title} | REAL DESIGNS` : "Client Presentation | REAL DESIGNS";
    const description = pk
      ? `${pk.property_label || "A property presentation"} prepared for ${pk.client_name || "you"} — designs, photos, video and budget in one place.`
      : "A private presentation shared with you through REAL DESIGNS.";
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
  component: SharedPackage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="sp-wrap">
      <div className="sp-card sp-center">{children}</div>
    </main>
  );
}

function SharedPackage() {
  const { token, pack } = Route.useLoaderData() as any;
  const [code, setCode] = useState("");
  const [gate, setGate] = useState<any>(pack);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [decision, setDecision] = useState<string | null>(pack?.package?.status ?? null);

  async function unlock() {
    setBusy(true);
    try {
      const res: any = await getSharedPackage({ data: { token, code } });
      if (!res?.error) setGate(res);
    } finally {
      setBusy(false);
    }
  }

  if (!gate) return <Shell><p>This link is no longer active. Ask the sender for a fresh one.</p></Shell>;

  if (gate.error === "code_required" || gate.error === "bad_code") {
    return (
      <Shell>
        <h1 className="sp-title">Enter Your Access Code</h1>
        <p className="sp-sub">
          {gate.error === "bad_code" ? "That code did not match. Try again." : "The sender protected this presentation."}
        </p>
        <input className="sp-in" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" />
        <button className="sp-btn sp-btn-primary" disabled={busy || !code} onClick={unlock}>
          {busy ? "Checking…" : "Open Presentation"}
        </button>
      </Shell>
    );
  }
  if (gate.error) return <Shell><p>This link is no longer active. Ask the sender for a fresh one.</p></Shell>;

  const pk = gate.package;
  const accent = /^#[0-9a-f]{6}$/i.test(pk.accent || "") ? pk.accent : "#CC0000";
  const settings = pk.settings || {};
  const sections = (gate.sections || []).filter((s: any) => !s.hidden);
  const assetsFor = (key: string) => (gate.assets || []).filter((a: any) => a.section_key === key);

  async function decide(kind: "approved" | "changes") {
    setBusy(true);
    try {
      await decideOnPackage({ data: { token, decision: kind, note: note || undefined } });
      setDecision(kind);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await commentOnPackage({ data: { token, body: comment.trim(), author_name: pk.client_name || undefined } });
      setComment("");
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sp-wrap" style={{ "--sp-accent": accent } as Record<string, string>}>
      <header className="sp-head">
        {pk.logo_url ? (
          <img className="sp-logo" src={pk.logo_url} alt="" />
        ) : (
          <span className="sp-brand">REAL <b>DESIGNS</b></span>
        )}
        <span className="sp-kicker">Prepared For {pk.client_name || "You"}</span>
      </header>

      <section className="sp-card">
        <h1 className="sp-title">{pk.title}</h1>
        {pk.property_label ? <p className="sp-sub">{pk.property_label}</p> : null}
        {pk.intro ? <p className="sp-intro">{pk.intro}</p> : null}
      </section>

      {sections.map((s: any) => {
        const list = assetsFor(s.section_key);
        if (!list.length) return null;
        return (
          <section className="sp-card" key={s.section_key}>
            <h2 className="sp-h2">{s.title}</h2>
            {s.section_key === "budget" ? (
              <div className="sp-lines">
                {list.map((a: any) => (
                  <div className="sp-line" key={a.id}>
                    <span>{a.title}</span>
                    <b>{a.caption}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sp-grid">
                {list.map((a: any) => (
                  <figure className="sp-fig" key={a.id}>
                    {a.kind === "video" && a.url ? (
                      <video src={a.url} controls playsInline />
                    ) : a.compare_url && a.url ? (
                      <div className="sp-ba">
                        <img src={a.compare_url} alt={`${a.title} before`} />
                        <img src={a.url} alt={`${a.title} after`} />
                      </div>
                    ) : a.url ? (
                      <img src={a.url} alt={a.title || ""} />
                    ) : null}
                    <figcaption>{a.title}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {settings.allow_comments !== false ? (
        <section className="sp-card">
          <h2 className="sp-h2">Leave A Comment</h2>
          {sent ? <p className="sp-ok">Thanks — your comment reached the sender.</p> : null}
          <textarea
            className="sp-in"
            rows={3}
            value={comment}
            placeholder="Anything you want changed or kept?"
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="sp-btn" disabled={busy || !comment.trim()} onClick={send}>
            Send Comment
          </button>
        </section>
      ) : null}

      {settings.allow_approve !== false || settings.allow_changes !== false ? (
        <section className="sp-card" id="decision">
          <h2 className="sp-h2">Your Decision</h2>
          {decision === "approved" || decision === "changes" ? (
            <p className="sp-ok">
              {decision === "approved"
                ? "Approved. The sender has been notified."
                : "Changes requested. The sender will follow up."}
            </p>
          ) : (
            <>
              <textarea
                className="sp-in"
                rows={3}
                value={note}
                placeholder="Optional note for the sender"
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="sp-actions">
                {settings.allow_approve !== false ? (
                  <button className="sp-btn sp-btn-primary" disabled={busy} onClick={() => decide("approved")}>
                    {busy ? "Sending…" : "Approve This Presentation"}
                  </button>
                ) : null}
                {settings.allow_changes !== false ? (
                  <button className="sp-btn" disabled={busy} onClick={() => decide("changes")}>
                    Request Changes
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>
      ) : null}

      <footer className="sp-foot">Shared securely through REAL DESIGNS. No account needed.</footer>
    </main>
  );
}
