import { describe, it, expect } from "vitest";
import {
  classifyStorageError,
  missingCommands,
  userMessageFor,
  REQUIRED_BUCKETS,
  type BucketStage,
} from "./storage-health-stages";

const stage = (kind: BucketStage["kind"], bucket = "room-photos"): BucketStage => ({
  bucket,
  kind,
  detail: "",
});

describe("storage health stages", () => {
  it("tracks the three private buckets", () => {
    expect([...REQUIRED_BUCKETS]).toEqual(["room-photos", "reveal-videos", "user-audio"]);
  });

  it("separates a missing bucket from a policy failure", () => {
    expect(classifyStorageError("Bucket not found", "upload_failure")).toBe("bucket_missing");
    expect(
      classifyStorageError("new row violates row-level security policy", "upload_failure"),
    ).toBe("policy_failure");
    expect(classifyStorageError("payload too large", "upload_failure")).toBe("upload_failure");
    expect(classifyStorageError("boom", "signed_url_failure")).toBe("signed_url_failure");
  });

  it("reports the exact access rules a bucket lacks", () => {
    const rows = [
      { bucket: "room-photos", cmd: "SELECT" },
      { bucket: "room-photos", cmd: "INSERT" },
      { bucket: "user-audio", cmd: "ALL" },
    ];
    expect(missingCommands("room-photos", rows)).toEqual(["UPDATE", "DELETE"]);
    expect(missingCommands("user-audio", rows)).toEqual([]);
    expect(missingCommands("reveal-videos", rows)).toEqual([
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
    ]);
  });

  it("keeps the end-user sentence neutral and stage-appropriate", () => {
    expect(userMessageFor([stage("ok"), stage("ok")])).toBeNull();
    expect(userMessageFor([stage("signed_url_failure")])).toMatch(/can't be displayed/);
    expect(userMessageFor([stage("bucket_missing")])).toMatch(
      /Uploads are temporarily unavailable/,
    );
    // a misconfigured-public bucket is an admin problem, not a user-facing outage
    expect(userMessageFor([stage("bucket_public")])).toBeNull();
    expect(userMessageFor([stage("bucket_missing")])).not.toMatch(/bucket/i);
  });
});
