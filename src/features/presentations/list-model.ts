/**
 * Pure view model for the client-link (presentation) list.
 *
 * This module owns every formatting and filtering rule the list surface needs.
 * It has no DOM and no data access, so the strings below can be pinned by
 * tests and reused by the React surface without booting the legacy runtime.
 */

export type PresentationStatus = "sent" | "viewed" | "approved" | "changes";

export interface PresentationRow {
  id: string;
  token: string;
  title?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  address?: string | null;
  room_name?: string | null;
  status?: string | null;
  view_count?: number | null;
  note_count?: number | null;
  excluded_count?: number | null;
  reminder_count?: number | null;
  decision_note?: string | null;
  line_notes?: Record<string, string> | null;
  created_at?: string | null;
  last_viewed_at?: string | null;
  reminded_at?: string | null;
}

export interface PresentationActivity {
  id: string;
  kind?: string | null;
  detail?: string | null;
  note?: string | null;
  excluded_count?: number | null;
  note_count?: number | null;
  created_at?: string | null;
}

export type PresentationFilter = "all" | "due" | PresentationStatus;

const PRES_STATUS_FALLBACK = { cls: "p-info", label: "Sent" } as const;

export const PRES_STATUS_META: Record<string, { cls: string; label: string } | undefined> = {
  sent: { cls: "p-info", label: "Sent" },
  viewed: { cls: "p-amb", label: "Opened" },
  approved: { cls: "p-ok", label: "Approved" },
  changes: { cls: "p-amb", label: "Changes Requested" },
};

export const PRES_TABS: Array<{ key: PresentationFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Follow Up" },
  { key: "sent", label: "Awaiting" },
  { key: "viewed", label: "Opened" },
  { key: "approved", label: "Approved" },
  { key: "changes", label: "Changes" },
];

/* A link needs a nudge once it has been out for three days with no decision,
   and again three days after the last reminder. Approved links never nag. */
export const PRES_NUDGE_MS = 3 * 86400000;

export function presentationStatusMeta(status?: string | null) {
  return PRES_STATUS_META[status || ""] || PRES_STATUS_FALLBACK;
}

export function presentationAgo(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const d = (now - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  return Math.floor(d / 86400) + "d ago";
}

export function presentationLink(token: string, origin?: string): string {
  const base =
    origin || (typeof location !== "undefined" && location.origin ? location.origin : "");
  return base + "/p/" + token;
}

export function presentationDue(r: PresentationRow, now: number = Date.now()): boolean {
  const st = r.status || "sent";
  if (st === "approved") return false;
  const since = new Date(r.reminded_at || r.created_at || now).getTime();
  return now - since > PRES_NUDGE_MS;
}

export function presentationMatches(
  r: PresentationRow,
  filter: PresentationFilter,
  now: number = Date.now(),
): boolean {
  if (filter === "all") return true;
  if (filter === "due") return presentationDue(r, now);
  return (r.status || "sent") === filter;
}

export function presentationTabCounts(
  rows: PresentationRow[],
  now: number = Date.now(),
): number[] {
  return PRES_TABS.map(({ key }) =>
    key === "all"
      ? rows.length
      : key === "due"
        ? rows.filter((r) => presentationDue(r, now)).length
        : rows.filter((r) => (r.status || "sent") === key).length,
  );
}

export interface PresentationRowCopy {
  context: string;
  who: string;
  seen: string;
  when: string;
  reminders: string;
  due: boolean;
  droppedPill: string;
  notesPill: string;
  noteLead: string;
  lineNotes: string[];
  hasNote: boolean;
}

/** Every human-readable string on a single row, derived in one place. */
export function presentationRowCopy(
  r: PresentationRow,
  now: number = Date.now(),
): PresentationRowCopy {
  const excluded = r.excluded_count || 0;
  const notes = r.note_count || 0;
  const reminders = r.reminder_count || 0;
  const who = r.client_name ? "Sent to " + r.client_name : "No recipient named";
  const seen = r.view_count
    ? r.view_count === 1
      ? "opened once"
      : "opened " + r.view_count + " times"
    : "not opened";
  const noteLead = r.decision_note
    ? ""
    : excluded
      ? `${r.client_name || "The client"} trimmed the scope`
      : `${r.client_name || "The client"} left notes on the scope`;
  return {
    context: [r.address, r.room_name].filter(Boolean).join(" · "),
    who,
    seen,
    when: presentationAgo(r.last_viewed_at || r.created_at, now),
    reminders: reminders ? ` · ${reminders} reminder${reminders === 1 ? "" : "s"} sent` : "",
    due: presentationDue(r, now),
    droppedPill: excluded ? `${excluded} Line${excluded === 1 ? "" : "s"} Removed` : "",
    notesPill: notes ? `${notes} Line Comment${notes === 1 ? "" : "s"}` : "",
    noteLead,
    lineNotes: notes ? Object.values(r.line_notes || {}).slice(0, 3).map(String) : [],
    hasNote: !!(r.decision_note || excluded || notes),
  };
}

const PRES_HISTORY_FALLBACK = { icon: "eye", label: "Opened" } as const;

export const PRES_HISTORY_META: Record<string, { icon: string; label: string } | undefined> = {
  created: { icon: "plus-circle", label: "Link Created" },
  viewed: { icon: "eye", label: "Opened" },
  approved: { icon: "check-circle-2", label: "Approved" },
  changes: { icon: "refresh-cw", label: "Changes Requested" },
  reminded: { icon: "bell-ring", label: "Reminder Sent" },
  comments: { icon: "message-square", label: "Line Comments" },
};

export function presentationHistoryWhen(iso?: string | null): string {
  try {
    return new Date(iso as string).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function presentationHistoryCopy(ev: PresentationActivity) {
  const meta = PRES_HISTORY_META[ev.kind || ""] || PRES_HISTORY_FALLBACK;
  const extras: string[] = [];
  if (ev.excluded_count)
    extras.push(ev.excluded_count + " line" + (ev.excluded_count === 1 ? "" : "s") + " removed");
  if (ev.note_count)
    extras.push(ev.note_count + " line comment" + (ev.note_count === 1 ? "" : "s"));
  return {
    icon: meta.icon,
    label: meta.label,
    detail: (ev.detail || "") + (extras.length ? " · " + extras.join(" · ") : ""),
    note: ev.note || "",
    when: presentationHistoryWhen(ev.created_at),
  };
}

/** The synthetic "created" entry the timeline always ends with. */
export function presentationCreatedActivity(r: PresentationRow): PresentationActivity {
  return {
    id: "created",
    kind: "created",
    detail: "Share link created",
    note: null,
    excluded_count: 0,
    note_count: 0,
    created_at: r.created_at || null,
  };
}
