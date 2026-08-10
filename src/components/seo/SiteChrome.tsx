import { Link } from "@tanstack/react-router";
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

export function SiteHeader() {
  const signedIn = useSignedIn();
  return (
    <header id="hdr">
      <div className="wrap nav">
        <a href="/" className="logo">
          <BrandMark />
        </a>

        <div className="nav-cta">
          {signedIn ? (
            <Link to="/app" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="btn btn-ghost btn-sm">
              Log In
            </Link>
          )}
          <a href="#builder" className="btn btn-primary btn-sm">
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


