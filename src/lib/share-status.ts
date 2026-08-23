/**
 * The shared status and view-counting model behind Quick Approval Links and
 * Presentations. Statuses must describe events that actually happened, so
 * copying a message or opening a mail client never reads as "Sent".
 */

export type ShareStatus =
  | "created"
  | "email_opened"
  | "sent"
  | "opened"
  | "commented"
  | "approved"
  | "changes"
  | "revoked"
  | "expired";

export type ShareEvent =
  | "link_created"
  | "presentation_published"
  | "message_copied"
  | "email_app_opened"
  | "email_sent_by_app"
  | "public_opened"
  | "comment_submitted"
  | "approval_submitted"
  | "changes_requested"
  | "link_revoked"
  | "link_expired"
  | "version_issued"
  | "approval_superseded";

export const STATUS_LABEL: Record<ShareStatus, string> = {
  created: "Created",
  email_opened: "Email Opened",
  sent: "Sent",
  opened: "Opened",
  commented: "Commented",
  approved: "Approved",
  changes: "Changes Requested",
  revoked: "Revoked",
  expired: "Expired",
};

export const EVENT_LABEL: Record<ShareEvent, string> = {
  link_created: "Approval Link Created",
  presentation_published: "Presentation Published",
  message_copied: "Message Copied",
  email_app_opened: "Email App Opened",
  email_sent_by_app: "Email Sent By REAL DESIGNS",
  public_opened: "Public Link Opened",
  comment_submitted: "Comment Submitted",
  approval_submitted: "Approval Submitted",
  changes_requested: "Changes Requested",
  link_revoked: "Link Revoked",
  link_expired: "Link Expired",
  version_issued: "New Version Issued",
  approval_superseded: "Previous Approval Superseded",
};

export const DELIVERY_DISCLAIMER =
  "Delivery occurs through your email app and cannot be confirmed by REAL DESIGNS.";

const RANK: Record<ShareStatus, number> = {
  created: 0,
  email_opened: 1,
  sent: 2,
  opened: 3,
  commented: 4,
  approved: 6,
  changes: 6,
  revoked: 7,
  expired: 7,
};

/**
 * Applies one real, persisted event to a status. Copying a message or opening
 * the mail app can never produce "sent" — only a delivery REAL DESIGNS made.
 */
export function applyShareEvent(current: ShareStatus, event: ShareEvent): ShareStatus {
  const next: ShareStatus | null =
    event === "message_copied"
      ? "created"
      : event === "email_app_opened"
        ? "email_opened"
        : event === "email_sent_by_app"
          ? "sent"
          : event === "public_opened"
            ? "opened"
            : event === "comment_submitted"
              ? "commented"
              : event === "approval_submitted"
                ? "approved"
                : event === "changes_requested"
                  ? "changes"
                  : event === "link_revoked"
                    ? "revoked"
                    : event === "link_expired"
                      ? "expired"
                      : null;
  if (!next) return current;
  if (current === "revoked" || current === "expired") return current;
  return RANK[next] >= RANK[current] ? next : current;
}

export type ViewerContext = {
  /** The signed-in owner previewing their own link. */
  isCreator?: boolean;
  /** Editor preview surface rather than the public URL. */
  isEditorPreview?: boolean;
  isBot?: boolean;
  isPrerender?: boolean;
  isHealthCheck?: boolean;
  isPdfRenderer?: boolean;
  /** Same session already counted within the de-dupe window. */
  alreadyCountedInSession?: boolean;
};

const BOT = /(bot|crawler|spider|slurp|headlesschrome|lighthouse|preview|monitor|curl|wget)/i;

export function isBotAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT.test(userAgent);
}

/** Only a genuine public recipient session increments the public view count. */
export function countsAsPublicView(ctx: ViewerContext): boolean {
  return !(
    ctx.isCreator ||
    ctx.isEditorPreview ||
    ctx.isBot ||
    ctx.isPrerender ||
    ctx.isHealthCheck ||
    ctx.isPdfRenderer ||
    ctx.alreadyCountedInSession
  );
}

export type ViewStats = {
  publicOpens: number;
  uniquePublicOpens: number;
  lastOpenedAt: string | null;
  creatorPreviews: number;
};

export const emptyViewStats = (): ViewStats => ({
  publicOpens: 0,
  uniquePublicOpens: 0,
  lastOpenedAt: null,
  creatorPreviews: 0,
});

export function recordView(
  stats: ViewStats,
  ctx: ViewerContext & { at?: string; firstInSession?: boolean },
): ViewStats {
  if (!countsAsPublicView(ctx)) {
    return ctx.isCreator || ctx.isEditorPreview
      ? { ...stats, creatorPreviews: stats.creatorPreviews + 1 }
      : stats;
  }
  return {
    publicOpens: stats.publicOpens + 1,
    uniquePublicOpens: stats.uniquePublicOpens + (ctx.firstInSession === false ? 0 : 1),
    lastOpenedAt: ctx.at ?? new Date().toISOString(),
    creatorPreviews: stats.creatorPreviews,
  };
}
