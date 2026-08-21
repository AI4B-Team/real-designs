import { memo } from "react";

/**
 * Notifications bell and dropdown.
 *
 * The list body (`notifList`) is still populated by the legacy notification
 * service; this component owns the shell markup only.
 */
export const NotificationsMenu = memo(function NotificationsMenu() {
  return (
    <div className="notif-wrap">
      <button
        className="icon-btn"
        id="notifBtn"
        aria-label="Open notifications"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <i data-lucide="bell" />
        <span className="bdg" id="notifDot" />
      </button>
      <div className="notif-menu" id="notifMenu">
        <div className="notif-head">
          <b>Notifications</b>
          <button className="fb-link" id="notifRead">
            Mark All Read
          </button>
        </div>
        <div className="notif-tabs" id="notifTabs">
          <button className="notif-tab on" data-t="all">
            All
          </button>
          <button className="notif-tab" data-t="unread">
            Unread
          </button>
          <button className="notif-tab" data-t="approvals">
            Approvals
          </button>
        </div>
        <div className="notif-list" id="notifList" />
        <div className="notif-foot">
          <button className="acct-i" data-goto="notifications">
            <i data-lucide="inbox" />
            View All Notifications
          </button>
        </div>
      </div>
    </div>
  );
});
