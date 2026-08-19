import { describe, expect, it } from "vitest";
import {
  assertUploadAllowed,
  buildObjectPath,
  isOwnedPath,
  safeExtension,
  sanitizeFileName,
} from "./storage-paths";

const UID = "11111111-2222-4333-8444-555555555555";

describe("sanitizeFileName", () => {
  it("drops directory structure", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\photos\\front.jpg")).toBe("front.jpg");
  });

  it("removes control characters and collapses separators", () => {
    expect(sanitizeFileName("liv\ning room  photo.JPG")).toBe("living-room-photo.JPG");
  });

  it("never starts with a dot or dash", () => {
    expect(sanitizeFileName(".env")).toBe("env");
    expect(sanitizeFileName("--rf.jpg")).toBe("rf.jpg");
  });
});

describe("safeExtension", () => {
  it("lowercases known extensions", () => {
    expect(safeExtension("Front.JPEG")).toBe("jpeg");
  });
  it("falls back when there is no extension", () => {
    expect(safeExtension("frontdoor", "jpg")).toBe("jpg");
  });
});

describe("buildObjectPath", () => {
  it("scopes the object to the owner folder", () => {
    expect(buildObjectPath(UID, "front.jpg")).toMatch(
      new RegExp(`^${UID}/front-[0-9a-f-]{8,}\\.jpg$`),
    );
  });

  it("is collision resistant for identical filenames", () => {
    expect(buildObjectPath(UID, "a.jpg")).not.toBe(buildObjectPath(UID, "a.jpg"));
  });

  it("refuses to build a path without a real user id", () => {
    expect(() => buildObjectPath("anonymous", "a.jpg")).toThrow();
  });

  it("keeps traversal out of the final path", () => {
    expect(buildObjectPath(UID, "../../secret.png")).not.toContain("..");
  });
});

describe("isOwnedPath", () => {
  it("accepts the owner folder only", () => {
    expect(isOwnedPath(`${UID}/a.jpg`, UID)).toBe(true);
    expect(isOwnedPath("other-user/a.jpg", UID)).toBe(false);
    expect(isOwnedPath(`${UID}/../other/a.jpg`, UID)).toBe(false);
  });
});

describe("assertUploadAllowed", () => {
  it("rejects wrong MIME types", () => {
    expect(() =>
      assertUploadAllowed("room-photos", { type: "application/pdf", size: 10 }),
    ).toThrow();
  });
  it("rejects oversized files", () => {
    expect(() =>
      assertUploadAllowed("room-photos", { type: "image/jpeg", size: 40 * 1024 * 1024 }),
    ).toThrow();
  });
  it("accepts a valid photo", () => {
    expect(() =>
      assertUploadAllowed("room-photos", { type: "image/jpeg", size: 1024 }),
    ).not.toThrow();
  });
});
