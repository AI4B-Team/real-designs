import { describe, expect, it } from "vitest";

import { redactText, redactUrl, redactValue, containsSensitive } from "./redact";
import { correlationIdFrom, isCorrelationId, newCorrelationId } from "./correlation";
import { classifyProbe, overallState, type ProviderStatus } from "./providers";
import { canTransition, isStuck, isTerminal, jobStatusMessage } from "./jobs";
import { backoffMs, isRetryable, isTransient, retrySafe } from "./retry";
import { ALERT_RULES, evaluateAlert, evaluateAll } from "./alerts";
import { userFailure } from "./messages";

describe("redaction", () => {
  it("removes bearer tokens, keys and card numbers", () => {
    const text = redactText(
      "failed with sk_live_ABCDEFGH12345678 and eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM card 4242424242424242",
    );
    expect(text).not.toContain("sk_live_");
    expect(text).not.toContain("eyJhbGciOi");
    expect(text).not.toContain("4242424242424242");
  });

  it("strips signed storage URLs down to a non-usable form", () => {
    const signed =
      "https://example.supabase.co/storage/v1/object/sign/room-photos/user/a.jpg?token=abc.def.ghi";
    expect(redactUrl(signed)).not.toContain("token=");
    expect(redactUrl(signed)).not.toContain("a.jpg");
  });

  it("redacts secret-looking object keys", () => {
    const out = redactValue({ apiKey: "x", password: "y", nested: { authorization: "z", safe: 1 } }) as Record<
      string,
      unknown
    >;
    expect(out["apiKey"]).toBe("[redacted]");
    expect(out["password"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["authorization"]).toBe("[redacted]");
    expect((out["nested"] as Record<string, unknown>)["safe"]).toBe(1);
  });

  it("flags payloads that still carry sensitive values", () => {
    expect(containsSensitive({ token: "abc" })).toBe(true);
    expect(containsSensitive({ route: "/studio", count: 2 })).toBe(false);
  });
});

describe("correlation IDs", () => {
  it("mints traceable, readable IDs", () => {
    const id = newCorrelationId();
    expect(isCorrelationId(id)).toBe(true);
  });

  it("reuses a valid inbound ID", () => {
    const id = newCorrelationId();
    const headers = new Headers({ "x-correlation-id": id });
    expect(correlationIdFrom(headers)).toBe(id);
    expect(correlationIdFrom(new Headers({ "x-correlation-id": "nope" }))).not.toBe("nope");
  });
});

describe("provider health", () => {
  it("classifies configured, slow and failing providers", () => {
    expect(classifyProbe({ key: "ai", configured: false, ok: false, latencyMs: 0 }).state).toBe(
      "not_configured",
    );
    expect(classifyProbe({ key: "ai", configured: true, ok: true, latencyMs: 100 }).state).toBe(
      "operational",
    );
    expect(classifyProbe({ key: "ai", configured: true, ok: true, latencyMs: 9999 }).state).toBe(
      "degraded",
    );
    expect(classifyProbe({ key: "ai", configured: true, ok: false, latencyMs: 20 }).state).toBe("down");
  });

  it("treats a critical outage as an outage overall", () => {
    const down = classifyProbe({ key: "storage", configured: true, ok: false, latencyMs: 5 });
    const fine = classifyProbe({ key: "email", configured: true, ok: true, latencyMs: 5 });
    expect(overallState([down, fine] as ProviderStatus[])).toBe("outage");
    expect(overallState([fine] as ProviderStatus[])).toBe("operational");
  });
});

describe("job lifecycle", () => {
  it("only allows forward transitions", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("completed", "running")).toBe(false);
    expect(isTerminal("timed_out")).toBe(true);
  });

  it("detects jobs stuck beyond twice their expected duration", () => {
    const startedAt = 0;
    expect(isStuck({ kind: "design", state: "running", startedAt }, 60_000)).toBe(false);
    expect(isStuck({ kind: "design", state: "running", startedAt }, 400_000)).toBe(true);
    expect(isStuck({ kind: "design", state: "completed", startedAt }, 400_000)).toBe(false);
  });

  it("explains a timeout in plain language", () => {
    expect(jobStatusMessage("video", "timed_out")).toMatch(/credits were returned/i);
  });
});

describe("retry policy", () => {
  it("never retries credit charges or generations", () => {
    expect(isRetryable("credit_charge")).toBe(false);
    expect(isRetryable("ai_generate")).toBe(false);
    expect(isRetryable("read")).toBe(true);
  });

  it("only treats transport failures as transient", () => {
    expect(isTransient(500)).toBe(true);
    expect(isTransient(429)).toBe(true);
    expect(isTransient(404)).toBe(false);
    expect(isTransient("fetch failed")).toBe(true);
  });

  it("retries a safe read and gives up on an unsafe one", async () => {
    let reads = 0;
    const value = await retrySafe(
      "read",
      async () => {
        reads += 1;
        if (reads < 3) throw Object.assign(new Error("upstream connect error"), { status: 503 });
        return "ok";
      },
      { sleep: async () => {} },
    );
    expect(value).toBe("ok");
    expect(reads).toBe(3);

    let charges = 0;
    await expect(
      retrySafe(
        "credit_charge",
        async () => {
          charges += 1;
          throw Object.assign(new Error("upstream connect error"), { status: 503 });
        },
        { sleep: async () => {} },
      ),
    ).rejects.toThrow();
    expect(charges).toBe(1);
  });

  it("backs off within bounds", () => {
    expect(backoffMs(0)).toBeLessThanOrEqual(250);
    expect(backoffMs(10)).toBeLessThanOrEqual(4000);
  });
});

describe("alerts", () => {
  it("does not fire on a small sample", () => {
    const rule = ALERT_RULES.find((r) => r.key === "high_failure_rate")!;
    expect(evaluateAlert(rule, { total: 3, failures: 3 }).firing).toBe(false);
    expect(evaluateAlert(rule, { total: 100, failures: 40 }).firing).toBe(true);
  });

  it("covers every required alert type", () => {
    const keys = evaluateAll({}).map((a) => a.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "high_failure_rate",
        "upload_failures",
        "generation_timeouts",
        "webhook_failures",
        "credit_ledger_mismatch",
        "auth_failures",
      ]),
    );
    expect(evaluateAll({}).some((a) => a.firing)).toBe(false);
  });
});

describe("user messages", () => {
  it("includes a support reference when a correlation ID exists", () => {
    const id = newCorrelationId();
    const failure = userFailure("generation_timeout", id);
    expect(failure.reference).toContain(id);
    expect(failure.body).toMatch(/credits/i);
    expect(userFailure("upload_failed").reference).toBeNull();
  });
});
