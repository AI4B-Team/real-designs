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

  async function forgot() {
    if (!email) {
      setMsg("Enter your email first, then select Forgot Password.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    setMsg(error ? error.message : "Check your email for a password reset link.");
  }

  return (
    <main className="rd-auth">
      <aside className="promo">
        <p className="mark">REAL DESIGNS</p>
        <h2>
          Redesign Any Space With AI.
          <br />
          See The Design. Plan The Cost.
        </h2>

        <p className="sub">
          Turn one photo into a photoreal redesign, a planning range, shopping list and
          project-ready scope.
        </p>
        <ul>
          <li>
            <span className="n">1</span>
            <span>
              <b>Upload Your Space</b>
              Keep the same walls, windows and proportions.
            </span>
          </li>
          <li>
            <span className="n">2</span>
            <span>
              <b>Compare Your Options</b>
              See Refresh, Makeover and Renovation outcomes for the same space.
            </span>
          </li>
          <li>
            <span className="n">3</span>
            <span>
              <b>Plan What Comes Next</b>
              Create a shopping list, line-item scope and contractor brief.
            </span>
          </li>
        </ul>
        <p className="quote">Free to start. 5 designs a day, no card required.</p>
      </aside>

      <div className="panel">
        <div className="mobile-head">
          <p className="mark">REAL DESIGNS</p>
          <h2>Redesign Any Space With AI.</h2>
          <p>Free to start. 5 designs a day, no card required.</p>
        </div>
        <section>
          <p className="eyebrow">REAL DESIGNS</p>

          <h1>{mode === "signin" ? "Sign In" : "Create Your Account"}</h1>
          <p className="lede">
            Pick up where you left off. Your properties, designs, budgets and project briefs stay
            together in one workspace.
          </p>

          <button type="button" className="google" onClick={google} disabled={busy}>
            <GoogleMark />
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
            <div className="labelrow">
              <label htmlFor="rd-password">Password</label>
              {mode === "signin" ? (
                <button type="button" onClick={forgot} disabled={busy}>
                  Forgot Password?
                </button>
              ) : null}
            </div>
            <div className="pw">
              <input
                id="rd-password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Working…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {msg ? <p className="msg">{msg}</p> : null}

          <p className="alt">
            {mode === "signin" ? "New to REAL DESIGNS?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create A Free Account" : "Sign In"}
            </button>
          </p>
          <p className="alt quiet">
            <a href="/">Back To Home</a>
          </p>
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.5 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.7 7l7.5 5.8c4.4-4.1 6.9-10.1 6.9-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.4 0-11.7-3.8-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

