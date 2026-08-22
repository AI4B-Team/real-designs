/**
 * The one authoritative description of what the Canvas is showing.
 *
 * Every label that names a result — the Approve button, its tooltip, the
 * Version History rows, the badge under the image — is derived from this
 * object. Nothing counts array positions, session lengths or thumbnails to
 * guess a persistent version number: `versionNo` only ever comes from the
 * server, and only ever exists once a version row exists.
 */

export type ActiveResultKind = "source" | "pending-concept" | "persistent-version";

export type ActiveResultStatus = "generating" | "ready" | "saving" | "saved" | "failed";

export type ActiveCanvasResult = {
  kind: ActiveResultKind;
  roomId: string | null;
  outputId: string | null;
  versionId: string | null;
  /** Server-assigned, room-scoped. Null for anything not yet persistent. */
  versionNo: number | null;
  sourcePath: string | null;
  resultPath: string | null;
  status: ActiveResultStatus;
  /** Slot position of a temporary concept, zero based. */
  conceptIndex?: number;
  conceptTotal?: number;
};

export type RoomVersionRow = {
  id: string;
  room_id?: string | null;
  version_no: number;
  status?: string | null;
  before_path?: string | null;
  after_path?: string | null;
  created_at?: string | null;
  parent_version_id?: string | null;
  generation_job_id?: string | null;
};

/* ------------------------------------------------------------------ */
/* Constructors                                                        */
/* ------------------------------------------------------------------ */

export function sourceResult(roomId: string | null, sourcePath: string | null): ActiveCanvasResult {
  return {
    kind: "source",
    roomId: roomId || null,
    outputId: null,
    versionId: null,
    versionNo: null,
    sourcePath: sourcePath || null,
    resultPath: null,
    status: "ready",
  };
}

export function conceptResult(input: {
  roomId?: string | null;
  outputId: string;
  index: number;
  total: number;
  sourcePath?: string | null;
  resultPath?: string | null;
  status?: ActiveResultStatus;
}): ActiveCanvasResult {
  return {
    kind: "pending-concept",
    roomId: input.roomId || null,
    outputId: input.outputId,
    versionId: null,
    versionNo: null,
    sourcePath: input.sourcePath || null,
    resultPath: input.resultPath || null,
    status: input.status || "generating",
    conceptIndex: Math.max(0, Number(input.index) || 0),
    conceptTotal: Math.max(1, Number(input.total) || 1),
  };
}

/** A result becomes a version only when the server hands back a version row. */
export function versionResult(
  row: RoomVersionRow,
  extra?: { roomId?: string | null; outputId?: string | null },
): ActiveCanvasResult {
  return {
    kind: "persistent-version",
    roomId: (row.room_id ?? extra?.roomId) || null,
    outputId: extra?.outputId || null,
    versionId: String(row.id),
    versionNo: Number(row.version_no) || null,
    sourcePath: row.before_path || null,
    resultPath: row.after_path || null,
    status: "saved",
  };
}

/* ------------------------------------------------------------------ */
/* Room-scoped history                                                 */
/* ------------------------------------------------------------------ */

/**
 * Version History belongs to one room id. Room names are neither unique nor
 * stable, so any row that does not carry the active room id is quarantined.
 */
export function roomVersions<T extends RoomVersionRow>(rows: T[], roomId: string | null): T[] {
  if (!roomId) return [];
  return (rows || [])
    .filter((r) => !!r && String(r.room_id ?? "") === String(roomId))
    .slice()
    .sort((a, b) => (Number(b.version_no) || 0) - (Number(a.version_no) || 0));
}

/** "Showing 2 Of 8 Versions" — the history header never lies about the total. */
export function historyHeading(loaded: number, total: number): string {
  const t = Math.max(0, Number(total) || 0);
  const l = Math.max(0, Math.min(Number(loaded) || 0, t));
  if (!t) return "No Versions Yet";
  if (l < t) return `Showing ${l} Of ${t} Versions`;
  return t === 1 ? "1 Version" : `${t} Versions`;
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

/** The single name of whatever is on the canvas. */
export function resultLabel(r: ActiveCanvasResult | null): string {
  if (!r) return "";
  if (r.kind === "source") return "Original Photo";
  if (r.kind === "persistent-version") return r.versionNo ? `Version ${r.versionNo}` : "Saved Design";
  const total = r.conceptTotal || 1;
  return total > 1 ? `Concept ${(r.conceptIndex || 0) + 1}` : "Concept";
}

export type ApproveState = { enabled: boolean; label: string; tooltip: string };

/**
 * Approve names exactly one version, and the tooltip repeats that same name.
 * The two can never disagree because they are produced together.
 */
export function approveState(
  r: ActiveCanvasResult | null,
  opts?: { saving?: boolean; approved?: boolean },
): ApproveState {
  if (opts?.saving)
    return {
      enabled: false,
      label: "Approve Design",
      tooltip: "This Design Is Still Saving",
    };
  if (!r || r.kind === "source")
    return {
      enabled: false,
      label: "Approve Design",
      tooltip: "Generate A Design Before Approving",
    };
  if (r.kind === "pending-concept" || !r.versionNo) {
    const name = resultLabel(r);
    return {
      enabled: false,
      label: "Approve Design",
      tooltip: `Save ${name} Before Approving`,
    };
  }
  const name = `Version ${r.versionNo}`;
  return {
    enabled: true,
    label: opts?.approved ? `${name} Approved` : `Approve ${name}`,
    tooltip: opts?.approved ? `${name} Is Approved` : `Approve ${name}`,
  };
}
