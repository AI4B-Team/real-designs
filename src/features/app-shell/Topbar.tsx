import { memo } from "react";

import { AccountMenu } from "./AccountMenu";
import { CreateMenu } from "./CreateMenu";
import { HelpMenu } from "./HelpMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { SearchBar } from "./SearchBar";

/** Top bar of the authenticated shell: search on the left, actions on the right. */
export const Topbar = memo(function Topbar() {
  return (
    <div className="topbar">
      <SearchBar />
      <div className="topbar-right">
        <CreateMenu />
        <NotificationsMenu />
        <HelpMenu />
        <AccountMenu />
      </div>
    </div>
  );
});
