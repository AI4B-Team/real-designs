import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { track } from "@/lib/analytics";

const title = "Sign In | REAL DESIGNS";
const description =
  "Sign in to REAL DESIGNS to save properties, priced scopes and contractor briefs to your account.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/app", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        track("signed_up", { method: "email" });
        if (!data.session) {
          setMsg("Check your email to confirm the address, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("signed_in", { method: "email" });
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMsg(null);
    track("sign_in_started", { method: "google" });
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      setMsg("Google sign-in failed. Try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app", replace: true });
  }

  return (
    <main className="rd-auth">
      <aside className="promo">
        <p className="mark">REAL DESIGNS</p>
        <h2>Redesign Any Space. Know What It Costs.</h2>
        <p className="sub">
          Turn one photo into a photoreal design, a priced scope and a contractor planning brief.
        </p>
        <ul>
          <li>
            <span className="n">1</span>
            <span>
              <b>Upload Your Space</b>
              Same walls, same windows. Reality stays locked.
            </span>
          </li>
          <li>
            <span className="n">2</span>
            <span>
              <b>See The Design</b>
              Refresh, Makeover or Renovation from one room.
            </span>
          </li>
          <li>
            <span className="n">3</span>
            <span>
              <b>Plan The Build</b>
              Line-item costs, 3D plans and shareable approvals.
            </span>
          </li>
        </ul>
        <p className="quote">Free to start. 5 designs a day, no card required.</p>
      </aside>

      <div className="panel">
      <section>
        <p className="eyebrow">REAL DESIGNS</p>

        <h1>{mode === "signin" ? "Sign In" : "Create Your Account"}</h1>
        <p className="lede">
          Save properties, priced scopes and contractor briefs to your own workspace.
        </p>

        <button type="button" className="google" onClick={google} disabled={busy}>
          Continue With Google
        </button>

        <div className="or">
          <span>Or Use Email</span>
        </div>

        <form onSubmit={submit}>
          <label htmlFor="rd-email">Email</label>
          <input
            id="rd-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="rd-password">Password</label>
          <input
            id="rd-password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {msg ? <p className="msg">{msg}</p> : null}

        <p className="alt">
          {mode === "signin" ? "New to REAL DESIGNS?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Create An Account" : "Sign In"}
          </button>
        </p>
        <p className="alt">
          <a href="/">Back To Home</a>
        </p>
      </section>
      </div>

    </main>
  );
}
