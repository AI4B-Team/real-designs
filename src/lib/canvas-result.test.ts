import { describe, expect, it } from "vitest";
import {
  approveState,
  conceptResult,
  historyHeading,
  resultLabel,
  roomVersions,
  sourceResult,
  versionResult,
} from "@/lib/canvas-result";

describe("canvas result contract", () => {
  it("never names a temporary concept a version", () => {
    const c = conceptResult({ outputId: "a", index: 0, total: 2 });
    expect(resultLabel(c)).toBe("Concept 1");
    expect(c.versionNo).toBeNull();
    expect(approveState(c).enabled).toBe(false);
    expect(approveState(c).tooltip).toBe("Save Concept 1 Before Approving");
  });

  it("uses the server version number for label and tooltip alike", () => {
    const v = versionResult({ id: "v1", room_id: "r1", version_no: 7 });
    const st = approveState(v);
    expect(st.label).toBe("Approve Version 7");
    expect(st.tooltip).toBe("Approve Version 7");
    expect(st.enabled).toBe(true);
  });

  it("disables approval while a save runs", () => {
    const v = versionResult({ id: "v1", room_id: "r1", version_no: 2 });
    expect(approveState(v, { saving: true })).toEqual({
      enabled: false,
      label: "Approve Design",
      tooltip: "This Design Is Still Saving",
    });
  });

  it("keeps the source photo unapprovable", () => {
    const s = sourceResult("r1", "p/a.jpg");
    expect(resultLabel(s)).toBe("Original Photo");
    expect(approveState(s).enabled).toBe(false);
  });

  it("quarantines versions from other rooms and sorts newest first", () => {
    const rows = [
      { id: "a", room_id: "r1", version_no: 1 },
      { id: "b", room_id: "r2", version_no: 9 },
      { id: "c", room_id: "r1", version_no: 3 },
      { id: "d", version_no: 4 },
    ];
    expect(roomVersions(rows, "r1").map((r) => r.id)).toEqual(["c", "a"]);
    expect(roomVersions(rows, null)).toEqual([]);
  });

  it("explains partially loaded history", () => {
    expect(historyHeading(2, 8)).toBe("Showing 2 Of 8 Versions");
    expect(historyHeading(3, 3)).toBe("3 Versions");
    expect(historyHeading(1, 1)).toBe("1 Version");
    expect(historyHeading(0, 0)).toBe("No Versions Yet");
  });
});
