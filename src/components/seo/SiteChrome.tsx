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
  // Most pages that render this header have no #builder section, so a plain
  // hash link is a dead button there. Scroll when it exists, otherwise send
  // the visitor to the builder on the home page.
  function onUpload(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("builder");
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <header id="hdr">
      <div className="wrap nav">
        <Link to="/" className="logo">
          <BrandMark />
        </Link>

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
          <a href="/#builder" className="btn btn-primary btn-sm" onClick={onUpload}>
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


