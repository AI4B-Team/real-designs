import { Link } from "@tanstack/react-router";
import { setStartIntent } from "@/lib/onboarding";
import { useEffect, useState } from "react";

import { GlobalFooter } from "@/components/seo/GlobalFooter";
import { supabase } from "@/integrations/supabase/client";

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}




export function BrandMark() {
  return (
    <span className="rd-mark" aria-label="REAL DESIGNS">
      <i>
        <b>REAL</b>
        <em>Designs</em>
      </i>
    </span>
  );
}

// Most pages that render this CTA have no #builder section, so a plain hash
// link is a dead button there. Open the upload modal when it exists on the
// page, scroll to the builder when that exists, otherwise go to the home
// page builder.
export function handleUploadClick(e: React.MouseEvent<HTMLAnchorElement>) {
  // Remember the workflow so signing up or logging in lands straight back on it.
  setStartIntent({ workflow: "redesign", source: "upload_cta" });
  const w = window as unknown as { openUpload?: () => void };
  if (typeof w.openUpload === "function") {
    e.preventDefault();
    w.openUpload();
    return;
  }
  const target = document.getElementById("builder");
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function UploadSpaceLink({
  className = "btn btn-primary",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href="/#upload" className={className} onClick={handleUploadClick}>
      {children}
    </a>
  );
}

export function SiteHeader() {
  const signedIn = useSignedIn();
  const onUpload = handleUploadClick;

  return (
    <header id="hdr">
      <div className="wrap nav">
        <Link to="/" className="logo">
          <BrandMark />
        </Link>

        <div className="nav-cta">
          <Link to="/explore" className="btn btn-ghost btn-sm">
            Explore Styles
          </Link>
          {signedIn ? (
            <Link to="/app" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="btn btn-ghost btn-sm">
              Log In
            </Link>
          )}
          <a href="/#upload" className="btn btn-primary btn-sm" onClick={onUpload}>
            Upload Your Space
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return <GlobalFooter />;
}


