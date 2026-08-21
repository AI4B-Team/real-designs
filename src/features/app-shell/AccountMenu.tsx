import { memo } from "react";

const LINKS: Array<{ goto: string; label: string; icon: string }> = [
  { goto: "account", label: "Account", icon: "user-round" },
  { goto: "team", label: "Team", icon: "users" },
  { goto: "billing", label: "Billing", icon: "credit-card" },
  { goto: "api", label: "API & White Label", icon: "key-round" },
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
        <button className="btn btn-primary btn-block" data-goto="billing">
          <i data-lucide="zap" />
          Upgrade
        </button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} data-goto="team">
          <i data-lucide="user-plus" />
          Invite Members
        </button>
        <div className="acct-sep" />
        {LINKS.map((l) => (
          <button className="acct-i" data-goto={l.goto} key={l.goto}>
            <i data-lucide={l.icon} />
            {l.label}
            <i className="chev" data-lucide="chevron-right" />
          </button>
        ))}
        <button className="btn btn-logout btn-block" style={{ marginTop: 10 }}>
          <i data-lucide="log-out" />
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
