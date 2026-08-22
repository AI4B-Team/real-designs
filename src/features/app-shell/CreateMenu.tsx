import { memo } from "react";

import { ShellIcon } from "./ShellIcon";

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
        <ShellIcon name="plus" />
        Create
        <ShellIcon className="chev" name="chevron-down" />
      </button>
      <div className="help-menu" id="createMenu">
        <button className="acct-i" data-create="design">
          <ShellIcon name="wand-sparkles" />
          Design
        </button>
        <button className="acct-i" data-create="video">
          <ShellIcon name="clapperboard" />
          Video
        </button>
      </div>
    </div>
  );
});
