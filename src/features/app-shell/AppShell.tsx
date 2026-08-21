import type { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type Props = {
  /** Feature content rendered inside `.content` — React views or legacy ones. */
  children: ReactNode;
};

/**
 * Shared chrome for the authenticated back office.
 *
 * Feature screens render as children, so a migrated React view and a legacy
 * prototype view can coexist under the same shell during the migration.
 */
export function AppShell({ children }: Props) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
