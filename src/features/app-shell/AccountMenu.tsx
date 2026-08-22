import { memo } from "react";

import { isFeatureVisible } from "./feature-availability";
import { ShellIcon } from "./ShellIcon";

const LINKS: Array<{ goto: string; label: string; icon: string }> = [
  { goto: "account", label: "Account", icon: "user-round" },
  { goto: "team", label: "Team", icon: "users" },
  { goto: "billing", label: "Billing", icon: "credit-card" },
  /* API & White Label is `hidden` in the feature registry — an account menu
     entry for a surface that does not exist yet is worse than no entry. */
];

/**
 * Avatar button and account dropdown.
 *
 * Identity text, avatar initials and log out are still filled in by the
 * legacy session controller through `.acct-head` / `.av`.
 */
export const AccountMenu = memo(function AccountMenu() {
  return (
    <div className="acct-wrap">
      <button
        className="acct-btn"
        id="acctBtn"
        aria-label="Open account menu"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <span className="av" />
      </button>
      <div className="acct-menu" id="acctMenu">
        <div className="acct-head">
          <div style={{ minWidth: 0 }}>
            <b>Your Account</b>
            <span />
          </div>
        </div>
        {isFeatureVisible("checkout") ? (
          <button className="btn btn-primary btn-block" data-goto="billing">
            <ShellIcon name="zap" />
            Upgrade
          </button>
        ) : null}
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} data-goto="team">
          <ShellIcon name="user-plus" />
          Invite Members
        </button>
        <div className="acct-sep" />
        {LINKS.map((l) => (
          <button className="acct-i" data-goto={l.goto} key={l.goto}>
            <ShellIcon name={l.icon} />
            {l.label}
            <ShellIcon name="chevron-right" className="chev" />
          </button>
        ))}
        <button className="btn btn-logout btn-block" style={{ marginTop: 10 }}>
          <ShellIcon name="log-out" />
          Log Out
        </button>
        <div className="acct-foot">
          <a href="/terms" target="_blank" rel="noopener">
            Terms
          </a>
          <span>&bull;</span>
          <a href="/privacy" target="_blank" rel="noopener">
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
});
