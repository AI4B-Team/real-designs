import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

const title = "Reset Password | REAL DESIGNS";
const description = "Choose a new password for your REAL DESIGNS workspace.";

export const Route = createFileRoute("/reset-password")({
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    navigate({ to: "/app", replace: true });
  }

  return (
    <main className="rd-auth">
      <div className="panel" style={{ gridColumn: "1 / -1" }}>
        <section>
          <p className="eyebrow">REAL DESIGNS</p>
          <h1>Set A New Password</h1>
          <p className="lede">Choose a new password to get back into your workspace.</p>
          <form onSubmit={submit}>
            <label htmlFor="rd-newpw">New Password</label>
            <div className="pw">
              <input
                id="rd-newpw"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
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
              {busy ? "Working…" : "Update Password"}
            </button>
          </form>
          {msg ? <p className="msg">{msg}</p> : null}
          <p className="alt quiet">
            <a href="/auth">Back To Sign In</a>
          </p>
        </section>
      </div>
    </main>
  );
}
