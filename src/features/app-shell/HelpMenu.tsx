import { memo } from "react";

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
        <i data-lucide="circle-help" />
      </button>
      <div className="help-menu" id="helpMenu">
        <button className="acct-i" data-goto="help">
          <i data-lucide="life-buoy" />
          Help
        </button>
        <button className="acct-i" id="tourBtn">
          <i data-lucide="play-circle" />
          Tour
        </button>
        <button className="acct-i" data-goto="tutorials">
          <i data-lucide="book-open" />
          Tutorials
        </button>
        <button className="acct-i" data-kbd="1">
          <i data-lucide="command" />
          Shortcuts
        </button>
        <button className="acct-i" id="fbBtn">
          <i data-lucide="message-square-plus" />
          Feedback
        </button>
      </div>
    </div>
  );
});
