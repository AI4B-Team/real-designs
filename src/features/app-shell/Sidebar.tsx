import { Fragment, memo } from "react";

import { CreditSummary } from "./CreditSummary";
import { NAV_GROUPS } from "./nav-items";

/**
 * Left rail of the authenticated shell.
 *
 * Markup mirrors the previous prototype string exactly (classes, ids and
 * data attributes) so the legacy interaction layer in rd-app-script keeps
 * driving view switching, counters and the collapse rail while features are
 * migrated one at a time. The component renders once and is memoized, so
 * React never fights those imperative updates.
 */
export const Sidebar = memo(function Sidebar() {
  return (
    <aside className="side">
      <div className="side-top">
        <button
          className="side-toggle"
          id="sideToggle"
          aria-label="Collapse menu"
          title="Collapse menu"
        >
          <i data-lucide="chevrons-left" />
        </button>
        <div className="logo">
          <span className="rd-mark" aria-label="REAL DESIGNS">
            <i>
              <b>REAL</b>
              <em>Designs</em>
            </i>
          </span>
        </div>
      </div>
      <nav className="side-nav">
        {NAV_GROUPS.map((group, gi) => (
          <Fragment key={group.title || "primary"}>
            {group.title ? <div className="nav-group">{group.title}</div> : null}
            {group.items.map((item, i) => (
              <button
                key={item.view}
                data-tip={item.label}
                className={gi === 0 && i === 0 ? "nav-i on" : "nav-i"}
                data-v={item.view}
              >
                <i data-lucide={item.icon} />
                {item.label}
                {item.countId ? (
                  <span className="cnt" id={item.countId}>
                    0
                  </span>
                ) : null}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>
      <div className="side-foot">
        <CreditSummary />
      </div>
    </aside>
  );
});
