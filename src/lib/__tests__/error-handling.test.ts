/**
 * Phase 0D — structured error handling.
 *
 * These tests pin the guarantees, not the wording: a user never sees technical
 * detail, a nameable failure is never reported as "Something went wrong", a
 * single failure produces a single message, critical failures stay traceable,
 * and an optional module failing never takes the app down.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  defaultUserMessage,
  failure,
  isAppError,
  toAppError,
} from "@/lib/errors/app-error";
import { guardMount, guardMountAsync } from "@/lib/errors/mount-guard";
import { inlineError, notifyError, resetNotifyDedupe } from "@/lib/errors/notify";
import { clearRecentErrors, recentErrors, reportError, setErrorSink, tolerate } from "@/lib/errors/report";

beforeEach(() => {
  clearRecentErrors();
  resetNotifyDedupe();
  setErrorSink(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  document.body.innerHTML = "";
});

describe("canonical error model", () => {
  it("keeps technical detail out of the user-facing message", () => {
    const err = new AppError({
      operation: "generation.design",
      category: "provider",
      technicalMessage: 'PostgrestError: relation "media_assets" does not exist',
    });
    expect(err.userMessage).not.toMatch(/Postgrest|media_assets|relation/);
    expect(err.toUserFacing().message).toBe(err.userMessage);
    expect(JSON.stringify(err.toUserFacing())).not.toMatch(/media_assets/);
  });

  it("redacts secrets out of the technical message it does keep", () => {
    const err = new AppError({
      operation: "upload.file",
      category: "upload",
      technicalMessage:
        "failed with apikey=sb_secret_abcdef123456 token eyJhbGciOiJIUzI1NiJ9.payload.signature",
    });
    expect(err.technicalMessage).not.toContain("sb_secret_abcdef123456");
    expect(err.technicalMessage).not.toContain("eyJhbGciOiJIUzI1NiJ9.payload.signature");
  });

  it("never reports a nameable failure as a generic message", () => {
    for (const category of ["upload", "credits", "authentication", "persistence"] as const) {
      expect(defaultUserMessage(category, category)).not.toMatch(/^Something went wrong/);
    }
    expect(defaultUserMessage("unknown", "unknown")).toMatch(/Something went wrong/);
  });

  it("carries a correlation id on every error and repeats it in the record", () => {
    const err = new AppError({ operation: "credits.charge", category: "credits" });
    expect(err.correlationId).toMatch(/^RD/);
    expect(err.toRecord()['correlationId']).toBe(err.correlationId);
    expect(err.toUserFacing().correlationId).toBe(err.correlationId);
  });

  it("exposes job identity for tracing without leaking the raw context", () => {
    const err = new AppError({
      operation: "generation.video",
      category: "generation",
      context: { jobId: "job_1", batchId: "batch_9", authToken: "sb_secret_zzz" },
    });
    const record = err.toRecord();
    expect(record['jobId']).toBe("job_1");
    expect(record['batchId']).toBe("batch_9");
    expect(JSON.stringify(record)).not.toContain("sb_secret_zzz");
  });

  it("classifies transport and platform failures instead of guessing", () => {
    const at = (e: unknown) => toAppError(e, { operation: "op" });
    expect(at({ status: 401 }).category).toBe("authentication");
    expect(at({ status: 403 }).category).toBe("authorization");
    expect(at({ status: 429 }).code).toBe("rate_limited");
    expect(at({ status: 503 }).code).toBe("provider_unavailable");
    expect(at(new Error("Failed to fetch")).category).toBe("network");
    expect(at(new Error("request timed out")).code).toBe("timeout");
    expect(at(new Error("insufficient credits")).category).toBe("credits");
  });

  it("derives retryability from the failure, not from the call site", () => {
    const at = (e: unknown) => toAppError(e, { operation: "op" });
    expect(at({ status: 429 }).retryable).toBe(true);
    expect(at(new Error("Failed to fetch")).retryable).toBe(true);
    expect(at({ status: 401 }).retryable).toBe(false);
    expect(at({ status: 403 }).retryable).toBe(false);
    expect(
      toAppError(new Error("bad size"), { operation: "op", category: "validation" }).retryable,
    ).toBe(false);
  });

  it("keeps an existing AppError intact rather than reclassifying it", () => {
    const original = new AppError({ operation: "a", category: "credits", code: "custom" });
    const wrapped = toAppError(original, { operation: "b", category: "network" });
    expect(wrapped).toBe(original);
    expect(isAppError(wrapped)).toBe(true);
  });

  it("returns a wire-safe failure shape with no stack or cause", () => {
    const shape = failure(
      new AppError({ operation: "op", category: "storage", cause: new Error("deep detail") }),
    );
    expect(Object.keys(shape).sort()).toEqual(
      ["category", "code", "correlationId", "message", "ok", "retryable"].sort(),
    );
    expect(JSON.stringify(shape)).not.toContain("deep detail");
  });
});

describe("reporting", () => {
  it("records every failure exactly once, even the ones the user never sees", () => {
    reportError(new Error("cache write blocked"), {
      operation: "draft.cache",
      category: "storage",
      severity: "low",
    });
    const records = recentErrors();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ operation: "draft.cache", severity: "low" });
  });

  it("forwards records to a sink and survives a sink that throws", () => {
    const seen: unknown[] = [];
    setErrorSink((r) => {
      seen.push(r);
      throw new Error("sink exploded");
    });
    expect(() =>
      reportError(new Error("x"), { operation: "op", category: "network" }),
    ).not.toThrow();
    expect(seen).toHaveLength(1);
  });

  it("lets optional work fail without breaking the caller, but not silently", async () => {
    const value = await tolerate("explore.prefetch", () => {
      throw new Error("prefetch failed");
    });
    expect(value).toBeNull();
    expect(recentErrors()).toHaveLength(1);
  });
});

describe("notification", () => {
  it("shows one message per failure and suppresses the duplicate storm", () => {
    const opts = { operation: "upload.file", category: "upload" as const };
    const first = notifyError(new Error("boom"), { ...opts, now: 1000 });
    const second = notifyError(new Error("boom"), { ...opts, now: 1500 });
    const later = notifyError(new Error("boom"), { ...opts, now: 20000 });
    expect(first.shown).toBe(true);
    expect(second.shown).toBe(false);
    expect(later.shown).toBe(true);
    /* Suppressed for the user is not suppressed for support. */
    expect(recentErrors()).toHaveLength(3);
  });

  it("treats distinct operations as distinct failures", () => {
    const a = notifyError(new Error("boom"), { operation: "upload.file", category: "upload", now: 1 });
    const b = notifyError(new Error("boom"), { operation: "draft.autosave", category: "upload", now: 2 });
    expect(a.shown && b.shown).toBe(true);
  });

  it("never interrupts the user for a low-severity failure", () => {
    const out = notifyError(new Error("tooltip missing"), {
      operation: "ui.tooltip",
      category: "navigation",
      severity: "low",
    });
    expect(out.shown).toBe(false);
    expect(recentErrors()).toHaveLength(1);
  });

  it("adds a traceable reference only to critical failures", () => {
    const critical = notifyError(new Error("refund failed"), {
      operation: "generation.refund",
      category: "credits",
      severity: "critical",
    });
    const ordinary = notifyError(new Error("offline"), {
      operation: "explore.load",
      category: "network",
      severity: "high",
    });
    expect(critical.message).toContain(critical.error.correlationId);
    expect(ordinary.message).not.toContain(ordinary.error.correlationId);
  });

  it("offers retry only when retrying is actually safe and possible", () => {
    const retryable = notifyError(new Error("Failed to fetch"), {
      operation: "explore.load",
      category: "network",
      retry: () => {},
      now: 1,
    });
    const notRetryable = notifyError({ status: 403 }, {
      operation: "asset.delete",
      category: "authorization",
      retry: () => {},
      now: 2,
    });
    const noHandler = notifyError(new Error("Failed to fetch"), {
      operation: "media.load",
      category: "network",
      now: 3,
    });
    expect(retryable.retryOffered).toBe(true);
    expect(notRetryable.retryOffered).toBe(false);
    expect(noHandler.retryOffered).toBe(false);
  });

  it("runs the retry handler with the same intent when the user asks", () => {
    const retry = vi.fn();
    notifyError(new Error("Failed to fetch"), {
      operation: "explore.load",
      category: "network",
      retry,
      now: 1,
    });
    const button = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Retry",
    );
    button?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("reports inline failures without raising a toast", () => {
    const out = inlineError(new Error("bad email"), {
      operation: "form.invite",
      category: "validation",
    });
    expect(out.shown).toBe(false);
    expect(document.querySelector("#rd-error-retry")).toBeNull();
    expect(recentErrors()).toHaveLength(1);
  });
});

describe("mount isolation", () => {
  it("keeps the app alive when an optional module fails to mount", () => {
    const out = guardMount("explore", () => {
      throw new Error("explore boot failed");
    });
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe("module_mount_failed");
    expect(out.error?.severity).toBe("low");
  });

  it("escalates a required module failure to the user", () => {
    const out = guardMount(
      "initApp",
      () => {
        throw new Error("controller boot failed");
      },
      { required: true },
    );
    expect(out.error?.severity).toBe("high");
    expect(recentErrors()).toHaveLength(1);
  });

  it("returns the module value untouched on success", async () => {
    expect(guardMount("ok", () => 42).value).toBe(42);
    expect((await guardMountAsync("okAsync", async () => "v")).value).toBe("v");
  });

  it("never rejects for an async module and never lets an onError escalate", async () => {
    const out = await guardMountAsync(
      "crm",
      async () => {
        throw new Error("crm boot failed");
      },
      {
        onError: () => {
          throw new Error("handler exploded");
        },
      },
    );
    expect(out.ok).toBe(false);
    expect(out.value).toBeNull();
  });
});
