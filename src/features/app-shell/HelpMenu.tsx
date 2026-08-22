import { memo } from "react";

import { ShellIcon } from "./ShellIcon";

/** Help dropdown: help center, product tour, tutorials, shortcuts, feedback. */
export const HelpMenu = memo(function HelpMenu() {
  return (
    <div className="help-wrap">
      <button
        className="icon-btn"
        id="helpBtn"
        aria-label="Open help menu"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <ShellIcon name="circle-help" />
      </button>
      <div className="help-menu" id="helpMenu">
        <button className="acct-i" data-goto="help">
          <ShellIcon name="life-buoy" />
          Help
        </button>
        <button className="acct-i" id="tourBtn">
          <ShellIcon name="play-circle" />
          Tour
        </button>
        <button className="acct-i" data-goto="tutorials">
          <ShellIcon name="book-open" />
          Tutorials
        </button>
        <button className="acct-i" data-kbd="1">
          <ShellIcon name="command" />
          Shortcuts
        </button>
        <button className="acct-i" id="fbBtn">
          <ShellIcon name="message-square-plus" />
          Feedback
        </button>
      </div>
    </div>
  );
});
