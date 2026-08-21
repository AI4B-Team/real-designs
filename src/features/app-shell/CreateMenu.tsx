import { memo } from "react";

/** Primary "Create" split button and its Design / Video menu. */
export const CreateMenu = memo(function CreateMenu() {
  return (
    <div className="help-wrap create-wrap">
      <button
        className="btn btn-primary btn-xs"
        id="newDesignBtn"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <i data-lucide="plus" />
        Create
        <i className="chev" data-lucide="chevron-down" />
      </button>
      <div className="help-menu" id="createMenu">
        <button className="acct-i" data-create="design">
          <i data-lucide="wand-sparkles" />
          Design
        </button>
        <button className="acct-i" data-create="video">
          <i data-lucide="clapperboard" />
          Video
        </button>
      </div>
    </div>
  );
});
