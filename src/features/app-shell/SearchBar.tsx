import { memo } from "react";

import { SEARCH_SCOPES } from "./nav-items";

/**
 * Topbar search field plus its scope menu.
 *
 * Live results and scope selection are still handled by the legacy search
 * controller, which binds to `schBtn` / `schMenu`.
 */
export const SearchBar = memo(function SearchBar() {
  return (
    <div className="search-wrap">
      <div className="search">
        <i data-lucide="search" />
        <input type="text" placeholder="Search properties, rooms, designs" />
        <button
          className="search-caret"
          id="schBtn"
          aria-label="Choose Search Scope"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <i data-lucide="chevron-down" />
        </button>
      </div>
      <div className="search-menu" id="schMenu">
        <div className="acct-group">Search In</div>
        {SEARCH_SCOPES.map((s) => (
          <button className="acct-i" data-scope={s.scope} key={s.scope}>
            <i data-lucide={s.icon} />
            {s.label}
            <span className="mv">{s.meta}</span>
          </button>
        ))}
        <div className="acct-sep" />
        <div className="acct-group">Recent</div>
      </div>
    </div>
  );
});
