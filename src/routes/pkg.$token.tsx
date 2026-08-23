import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { RealDesignsLogoResponsive, REAL_DESIGNS_HOME } from "@/components/brand/RealDesignsLogo";
import { resolveShareBranding } from "@/lib/share-branding";
import {
  approvalScopeMessage,
  buildItems,
  canRequestChanges,
  commentsFor,
  formatDay,
  formatStamp,
  gateMessage,
  permissionsFrom,
  preparedByLine,
  presentationTitle,
  presentationVersion,
  recipientLine,
  type PresentationItem,
  type ShareComment,
} from "@/lib/share-presentation";
import {
  getSharedPackage,
  commentOnPackage,
  decideOnPackage,
} from "@/lib/presentation-packages.functions";
import "@/styles/rd-share-pkg.css";

export const Route = createFileRoute("/pkg/$token")({
  loader: async ({ params }) => {
    try {
      return {
        token: params.token,
        pack: await getSharedPackage({ data: { token: params.token } }),
      };
    } catch {
      return { token: params.token, pack: null };
    }
  },
  head: ({ loaderData }) => {
    const pk =
      loaderData?.pack && !(loaderData.pack as any).error ? (loaderData.pack as any) : null;
    const title = pk
      ? `${presentationTitle(pk.title)} | REAL DESIGNS`
      : "Client Presentation | REAL DESIGNS";
    const description = pk
      ? `${pk.property_label || "A property presentation"} — designs and before/after views, ready for your review.`
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
      <header className="sp-head">
        <RealDesignsLogoResponsive href={REAL_DESIGNS_HOME} />
      </header>
      <div className="sp-card sp-center">{children}</div>
      <footer className="sp-foot">Shared securely through REAL DESIGNS. No account needed.</footer>
    </main>
  );
}

function Compare({ item }: { item: PresentationItem }) {
  const [mode, setMode] = useState<"after" | "side" | "slider">("after");
  const [pos, setPos] = useState(50);
  const has = !!item.compareUrl && !!item.url;
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  if (!item.url)
    return (
      <div className="sp-stage sp-stage-empty">
        <p>This design is still processing. Refresh in a moment.</p>
      </div>
    );

  if (failed)
    return (
      <div className="sp-stage sp-stage-empty">
        <p>This image could not be loaded.</p>
        <button
          className="sp-btn"
          onClick={() => {
            setFailed(false);
            setNonce((n) => n + 1);
          }}
        >
          Try Again
        </button>
      </div>
    );

  return (
    <div className="sp-stagewrap">
      {has ? (
        <div className="sp-modes" role="group" aria-label="Comparison mode">
          <button
            className={mode === "after" ? "sp-chip on" : "sp-chip"}
            onClick={() => setMode("after")}
          >
            Design
          </button>
          <button
            className={mode === "side" ? "sp-chip on" : "sp-chip"}
            onClick={() => setMode("side")}
          >
            Side By Side
          </button>
          <button
            className={mode === "slider" ? "sp-chip on" : "sp-chip"}
            onClick={() => setMode("slider")}
          >
            Before / After Slider
          </button>
        </div>
      ) : null}

      {mode === "side" && has ? (
        <div className="sp-side">
          <figure>
            <img
              key={`b${nonce}`}
              src={item.compareUrl!}
              alt={`${item.title} before`}
              loading="lazy"
              onError={() => setFailed(true)}
            />
            <figcaption>Before</figcaption>
          </figure>
          <figure>
            <img
              key={`a${nonce}`}
              src={item.url}
              alt={`${item.title} after`}
              loading="lazy"
              onError={() => setFailed(true)}
            />
            <figcaption>After</figcaption>
          </figure>
        </div>
      ) : mode === "slider" && has ? (
        <div className="sp-stage sp-slider">
          <img src={item.compareUrl!} alt={`${item.title} before`} />
          <div className="sp-slider-top" style={{ width: `${pos}%` }}>
            <img src={item.url} alt={`${item.title} after`} />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label="Compare before and after"
            onChange={(e) => setPos(Number(e.target.value))}
          />
        </div>
      ) : (
        <div className="sp-stage">
          <img
            key={`m${nonce}`}
            src={item.url}
            alt={item.title}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </div>
  );
}

function ItemView({
  item,
  total,
  comments,
  canComment,
  onComment,
}: {
  item: PresentationItem;
  total: number;
  comments: ShareComment[];
  canComment: boolean;
  onComment: (key: string, body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mine = commentsFor(comments, item.commentKey);

  return (
    <article className="sp-item" id={`item-${item.index + 1}`} data-item={item.id}>
      <div className="sp-item-head">
        <div>
          <span className="sp-room">{item.roomName}</span>
          <h2 className="sp-item-title">{item.title}</h2>
        </div>
        <div className="sp-item-meta">
          <span className="sp-count">
            {item.index + 1} of {total}
          </span>
          {item.version ? <span className="sp-ver">Version {item.version}</span> : null}
        </div>
      </div>

      <div ref={stageRef}>
        <Compare item={item} />
      </div>

      <div className="sp-item-foot">
        <div className="sp-facts">
          {item.style ? (
            <span>
              <b>Style</b> {item.style}
            </span>
          ) : null}
          {item.caption ? <span>{item.caption}</span> : null}
          {item.notes ? <span>{item.notes}</span> : null}
        </div>
        <button
          className="sp-btn sp-btn-sm"
          onClick={() => {
            const el = stageRef.current?.querySelector("img");
            if (el?.requestFullscreen) void el.requestFullscreen();
          }}
        >
          View Fullscreen
        </button>
      </div>

      {canComment ? (
        <div className="sp-comments">
          {mine.length ? (
            <ul className="sp-clist">
              {mine.map((c) => (
                <li key={c.id}>
                  <b>{c.author_name || "You"}</b>
                  <span>{formatStamp(c.created_at)}</span>
                  <p>{c.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            className="sp-in"
            rows={2}
            value={draft}
            placeholder={`Comment on ${item.roomName}`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="sp-btn sp-btn-sm"
            disabled={busy || draft.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await onComment(item.commentKey, draft.trim());
                setDraft("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Add Comment"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SharedPackage() {
  const { token, pack } = Route.useLoaderData() as any;
  const [code, setCode] = useState("");
  const [gate, setGate] = useState<any>(pack);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<ShareComment[]>(pack?.comments ?? []);
  const [decision, setDecision] = useState<{ decision: string; created_at: string } | null>(
    pack?.decision?.decision ? pack.decision : null,
  );
  const [cursor, setCursor] = useState(0);

  const ok = gate && !gate.error;
  const items = useMemo(
    () => (ok ? buildItems(gate.sections ?? [], gate.assets ?? []) : []),
    [ok, gate],
  );
  const perms = permissionsFrom(ok ? gate.settings : null);

  useEffect(() => {
    if (perms.mode !== "slideshow" || items.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setCursor((c) => Math.min(items.length - 1, c + 1));
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [perms.mode, items.length]);

  async function unlock() {
    setBusy(true);
    try {
      const res: any = await getSharedPackage({ data: { token, code } });
      if (!res?.error) {
        setGate(res);
        setComments(res.comments ?? []);
        if (res.decision?.decision) setDecision(res.decision);
      } else setGate({ ...gate, error: res.error });
    } finally {
      setBusy(false);
    }
  }

  async function addComment(key: string, body: string) {
    await commentOnPackage({
      data: { token, section: key, body, name: gate?.client_name || undefined },
    });
    setComments((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        section_key: key,
        author_name: gate?.client_name || "You",
        body,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  if (!gate) return <Shell>{gateMessage(null)}</Shell>;

  if (gate.error === "code_required" || gate.error === "bad_code") {
    return (
      <Shell>
        <h1 className="sp-title">Enter Your Access Code</h1>
        <p className="sp-sub">
          {gate.error === "bad_code"
            ? "That code did not match. Try again."
            : "The sender protected this presentation."}
        </p>
        <input
          className="sp-in"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
        />
        <button className="sp-btn sp-btn-primary" disabled={busy || !code} onClick={unlock}>
          {busy ? "Checking…" : "Open Presentation"}
        </button>
      </Shell>
    );
  }
  if (gate.error) return <Shell>{gateMessage(gate.error)}</Shell>;

  const pk = gate;
  const accent = /^#[0-9a-f]{6}$/i.test(pk.accent || "") ? pk.accent : "#CC0000";
  const title = presentationTitle(pk.title);
  const prepared = preparedByLine(pk.settings);
  // Workspace branding only replaces the REAL DESIGNS mark when the brand kit
  // was verified; otherwise the canonical mark stays.
  const settings = (pk.settings ?? {}) as Record<string, unknown>;
  const branding = resolveShareBranding({
    name: typeof settings["brand_name"] === "string" ? (settings["brand_name"] as string) : null,
    logo_url: pk.logo_url ?? null,
    verified: settings["brand_verified"] === true,
    accent,
  });
  const version = presentationVersion(items);
  const shown = perms.mode === "slideshow" ? items.slice(cursor, cursor + 1) : items;

  async function decide(kind: "approved" | "changes") {
    setBusy(true);
    setError(null);
    try {
      const merged = [feedback.trim(), note.trim()].filter(Boolean).join("\n\n");
      await decideOnPackage({
        data: {
          token,
          decision: kind,
          note: `${merged}${merged ? "\n\n" : ""}[reviewed version ${version.slice(0, 400)}]`.slice(
            0,
            1000,
          ),
          name: pk.client_name || undefined,
        },
      });
      setDecision({ decision: kind, created_at: new Date().toISOString() });
      setConfirming(false);
    } catch {
      setError("We could not send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sp-wrap" style={{ "--sp-accent": accent } as Record<string, string>}>
      <header className="sp-head">
        {branding.kind === "workspace" ? (
          <span className="sp-brand">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.name} className="sp-brand-logo" />
            ) : (
              <span className="sp-brand-name">{branding.name}</span>
            )}
            <span className="sp-via">Shared Through REAL DESIGNS</span>
          </span>
        ) : (
          <RealDesignsLogoResponsive href={REAL_DESIGNS_HOME} />
        )}
        <span className="sp-kicker">{recipientLine(pk.client_name)}</span>
      </header>

      <section className="sp-hero">
        <h1 className="sp-title">{title}</h1>
        {pk.property_label ? <p className="sp-sub">{pk.property_label}</p> : null}
        <p className="sp-meta">
          {prepared ? <span>{prepared}</span> : null}
          {pk.created_at ? <span>Updated {formatDay(pk.created_at)}</span> : null}
        </p>
        {pk.intro ? <p className="sp-intro">{pk.intro}</p> : null}
      </section>

      {items.length === 0 ? (
        <section className="sp-card sp-center">
          <p>This presentation does not contain any designs yet.</p>
          <p className="sp-sub">The sender has been notified. Check back shortly.</p>
        </section>
      ) : (
        <>
          <nav className="sp-nav" aria-label="Presentation navigation">
            {perms.mode === "slideshow" ? (
              <div className="sp-navbar">
                <button
                  className="sp-btn sp-btn-sm"
                  disabled={cursor === 0}
                  onClick={() => setCursor((c) => Math.max(0, c - 1))}
                >
                  Previous
                </button>
                <span className="sp-count">
                  {cursor + 1} of {items.length}
                </span>
                <button
                  className="sp-btn sp-btn-sm"
                  disabled={cursor >= items.length - 1}
                  onClick={() => setCursor((c) => Math.min(items.length - 1, c + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
            <div className="sp-film">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  className={perms.mode === "slideshow" && i === cursor ? "sp-thumb on" : "sp-thumb"}
                  title={`${it.roomName} — ${it.title}`}
                  onClick={() => {
                    if (perms.mode === "slideshow") setCursor(i);
                    else
                      document
                        .getElementById(`item-${i + 1}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {it.url ? <img src={it.url} alt="" loading="lazy" /> : <span />}
                  <em>{it.roomName}</em>
                </button>
              ))}
            </div>
          </nav>

          {shown.map((it) => (
            <ItemView
              key={it.id}
              item={it}
              total={items.length}
              comments={comments}
              canComment={perms.comments}
              onComment={addComment}
            />
          ))}
        </>
      )}

      {items.length > 0 && (perms.approve || perms.changes) ? (
        <section className="sp-card" id="decision">
          {decision ? (
            <div className="sp-done">
              <h2 className="sp-h1">
                {decision.decision === "approved" ? "Presentation Approved" : "Changes Requested"}
              </h2>
              <p>
                {decision.decision === "approved"
                  ? `Your approval was sent${prepared ? ` to ${prepared.replace(/^Prepared by /, "")}` : ""} on ${formatStamp(decision.created_at)}.`
                  : "Your feedback was sent successfully."}
              </p>
              <div className="sp-actions">
                <button
                  className="sp-btn"
                  onClick={() =>
                    document
                      .querySelector(".sp-hero")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Return To Presentation
                </button>
              </div>
            </div>
          ) : (
            <>
              {perms.comments ? (
                <>
                  <h2 className="sp-h2">Overall Feedback</h2>
                  <textarea
                    className="sp-in"
                    rows={3}
                    value={feedback}
                    placeholder="Share any general feedback about this presentation."
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </>
              ) : null}

              <h2 className="sp-h2">Your Decision</h2>
              {confirming ? (
                <div className="sp-confirm">
                  <p>{approvalScopeMessage(items.length)}</p>
                  <div className="sp-actions">
                    <button
                      className="sp-btn sp-btn-primary"
                      disabled={busy}
                      onClick={() => decide("approved")}
                    >
                      {busy ? "Sending…" : "Confirm Approval"}
                    </button>
                    <button className="sp-btn" disabled={busy} onClick={() => setConfirming(false)}>
                      Go Back
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="sp-label" htmlFor="sp-note">
                    Final Note To The Sender (Optional)
                  </label>
                  <textarea
                    id="sp-note"
                    className="sp-in"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="sp-actions">
                    {perms.approve ? (
                      <button
                        className="sp-btn sp-btn-primary"
                        disabled={busy}
                        onClick={() => setConfirming(true)}
                      >
                        Approve Presentation
                      </button>
                    ) : null}
                    {perms.changes ? (
                      <button
                        className="sp-btn"
                        disabled={busy}
                        onClick={() => {
                          if (!canRequestChanges(feedback || note, comments)) {
                            setError(
                              "Add a comment or overall feedback so the sender knows what to change.",
                            );
                            return;
                          }
                          void decide("changes");
                        }}
                      >
                        Request Changes
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              {error ? <p className="sp-err">{error}</p> : null}
            </>
          )}
        </section>
      ) : null}

      <footer className="sp-foot">Shared securely through REAL DESIGNS. No account needed.</footer>
    </main>
  );
}
