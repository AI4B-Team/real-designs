// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PRES_NUDGE_MS,
  PRES_TABS,
  presentationAgo,
  presentationCreatedActivity,
  presentationDue,
  presentationHistoryCopy,
  presentationLink,
  presentationMatches,
  presentationRowCopy,
  presentationStatusMeta,
  presentationTabCounts,
  type PresentationRow,
} from "./list-model";

const NOW = Date.parse("2024-05-10T12:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const row = (over: Partial<PresentationRow> = {}): PresentationRow => ({
  id: "p1",
  token: "tok1",
  title: "Kitchen Refresh",
  status: "sent",
  created_at: iso(60_000),
  ...over,
});

describe("presentation status meta", () => {
  it("maps every known status to the legacy pill class and label", () => {
    expect(presentationStatusMeta("sent")).toEqual({ cls: "p-gray", label: "Sent" });
    expect(presentationStatusMeta("viewed")).toEqual({ cls: "p-blue", label: "Opened" });
    expect(presentationStatusMeta("approved")).toEqual({ cls: "p-ok", label: "Approved" });
    expect(presentationStatusMeta("changes")).toEqual({
      cls: "p-amb",
      label: "Changes Requested",
    });
  });

  it("falls back to Sent for missing or unknown statuses", () => {
    expect(presentationStatusMeta(null)).toEqual({ cls: "p-gray", label: "Sent" });
    expect(presentationStatusMeta("revoked")).toEqual({ cls: "p-gray", label: "Sent" });
  });
});

describe("presentationAgo", () => {
  it("reports never without a timestamp", () => {
    expect(presentationAgo(null, NOW)).toBe("never");
  });

  it("uses the legacy buckets", () => {
    expect(presentationAgo(iso(5_000), NOW)).toBe("just now");
    expect(presentationAgo(iso(5 * 60_000), NOW)).toBe("5m ago");
    expect(presentationAgo(iso(4 * 3_600_000), NOW)).toBe("4h ago");
    expect(presentationAgo(iso(3 * 86_400_000), NOW)).toBe("3d ago");
  });
});

describe("presentationLink", () => {
  it("builds the public share URL from the origin", () => {
    expect(presentationLink("abc", "https://app.test")).toBe("https://app.test/p/abc");
  });
});

describe("follow-up rules", () => {
  it("never nags an approved link", () => {
    expect(presentationDue(row({ status: "approved", created_at: iso(30 * 86_400_000) }), NOW)).toBe(
      false,
    );
  });

  it("comes due three days after creation", () => {
    expect(presentationDue(row({ created_at: iso(PRES_NUDGE_MS - 1000) }), NOW)).toBe(false);
    expect(presentationDue(row({ created_at: iso(PRES_NUDGE_MS + 1000) }), NOW)).toBe(true);
  });

  it("restarts the clock from the last reminder", () => {
    const r = row({ created_at: iso(30 * 86_400_000), reminded_at: iso(1000) });
    expect(presentationDue(r, NOW)).toBe(false);
  });
});

describe("filtering and tab counts", () => {
  const rows = [
    row({ id: "a", status: "sent", created_at: iso(10 * 86_400_000) }),
    row({ id: "b", status: "viewed" }),
    row({ id: "c", status: "approved", created_at: iso(30 * 86_400_000) }),
    row({ id: "d", status: "changes" }),
  ];

  it("keeps everything under All", () => {
    expect(rows.filter((r) => presentationMatches(r, "all", NOW))).toHaveLength(4);
  });

  it("matches by exact status, defaulting to sent", () => {
    expect(presentationMatches(row({ status: null }), "sent", NOW)).toBe(true);
    expect(presentationMatches(row({ status: "viewed" }), "sent", NOW)).toBe(false);
  });

  it("counts each tab in tab order", () => {
    expect(PRES_TABS.map((t) => t.key)).toEqual([
      "all",
      "due",
      "sent",
      "viewed",
      "approved",
      "changes",
    ]);
    expect(presentationTabCounts(rows, NOW)).toEqual([4, 1, 1, 1, 1, 1]);
  });
});

describe("row copy", () => {
  it("describes an untouched link", () => {
    const c = presentationRowCopy(row(), NOW);
    expect(c.who).toBe("No recipient named");
    expect(c.seen).toBe("not opened");
    expect(c.reminders).toBe("");
    expect(c.hasNote).toBe(false);
  });

  it("pluralises views, reminders, removed lines and comments", () => {
    const one = presentationRowCopy(
      row({ view_count: 1, reminder_count: 1, excluded_count: 1, note_count: 1 }),
      NOW,
    );
    expect(one.seen).toBe("opened once");
    expect(one.reminders).toBe(" · 1 reminder sent");
    expect(one.droppedPill).toBe("1 Line Removed");
    expect(one.notesPill).toBe("1 Line Comment");

    const many = presentationRowCopy(
      row({ view_count: 4, reminder_count: 2, excluded_count: 3, note_count: 2 }),
      NOW,
    );
    expect(many.seen).toBe("opened 4 times");
    expect(many.reminders).toBe(" · 2 reminders sent");
    expect(many.droppedPill).toBe("3 Lines Removed");
    expect(many.notesPill).toBe("2 Line Comments");
  });

  it("joins address and room into the context line", () => {
    const c = presentationRowCopy(row({ address: "12 Oak St", room_name: "Kitchen" }), NOW);
    expect(c.context).toBe("12 Oak St · Kitchen");
    expect(presentationRowCopy(row({ address: "12 Oak St" }), NOW).context).toBe("12 Oak St");
  });

  it("names the recipient when there is one", () => {
    expect(presentationRowCopy(row({ client_name: "Dana" }), NOW).who).toBe("Sent to Dana");
  });

  it("explains trimmed scope and note-only feedback", () => {
    expect(presentationRowCopy(row({ excluded_count: 2, client_name: "Dana" }), NOW).noteLead).toBe(
      "Dana trimmed the scope",
    );
    expect(presentationRowCopy(row({ note_count: 2 }), NOW).noteLead).toBe(
      "The client left notes on the scope",
    );
    expect(presentationRowCopy(row({ decision_note: "Looks good" }), NOW).noteLead).toBe("");
  });

  it("shows at most three line notes", () => {
    const c = presentationRowCopy(
      row({ note_count: 5, line_notes: { a: "1", b: "2", c: "3", d: "4", e: "5" } }),
      NOW,
    );
    expect(c.lineNotes).toEqual(["1", "2", "3"]);
  });
});

describe("activity timeline copy", () => {
  it("maps kinds to icons and labels", () => {
    expect(presentationHistoryCopy({ id: "1", kind: "approved" }).label).toBe("Approved");
    expect(presentationHistoryCopy({ id: "1", kind: "reminded" }).icon).toBe("bell-ring");
    expect(presentationHistoryCopy({ id: "1", kind: "nonsense" }).label).toBe("Opened");
  });

  it("appends removed-line and comment counts to the detail", () => {
    const h = presentationHistoryCopy({
      id: "1",
      kind: "changes",
      detail: "Client responded",
      excluded_count: 1,
      note_count: 2,
    });
    expect(h.detail).toBe("Client responded · 1 line removed · 2 line comments");
  });

  it("synthesises the created entry from the row", () => {
    const ev = presentationCreatedActivity(row({ created_at: "2024-05-01T00:00:00Z" }));
    expect(ev).toMatchObject({ id: "created", kind: "created", detail: "Share link created" });
  });
});
