import { describe, expect, it, vi } from "vitest";
import {
  DraftAutosaver,
  cacheKey,
  migrateLegacyStagingDraft,
  readRecoveryCache,
  LEGACY_STAGING_KEY,
  type DraftPayload,
} from "@/lib/project-draft";

/* A stand-in for the database: rows keyed by draft id, scoped to a user. */
function fakeServer() {
  const rows = new Map<string, DraftPayload & { user_id: string; updated_at: number }>();
  let fail = 0;
  let user = "user-1";
  return {
    rows,
    signInAs(u: string) {
      user = u;
    },
    failNext(n: number) {
      fail = n;
    },
    calls: 0,
    async save(payload: DraftPayload) {
      this.calls += 1;
      if (fail > 0) {
        fail -= 1;
        throw new Error("network down");
      }
      const prev = rows.get(payload.id);
      rows.set(payload.id, { ...(prev ?? {}), ...payload, user_id: user, updated_at: Date.now() });
      return { id: payload.id };
    },
    list(u = user) {
      return [...rows.values()].filter((r) => r.user_id === u);
    },
  };
}

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    size: () => m.size,
  };
}

const base = (id: string, over: Record<string, any> = {}): DraftPayload => ({
  id,
  project_type: "photo_staging",
  status: "draft",
  builder_step: "review",
  assets: [
    {
      key: "p1",
      path: "u1/a.jpg",
      room: "Kitchen",
      room_source: "ai",
      confidence: 0.9,
      selected: true,
      done: false,
      status: "ready",
    },
  ],
  ...over,
});

describe("draft autosave", () => {
  it("persists to the server and clears the recovery cache", async () => {
    const server = fakeServer();
    const store = memStorage();
    const states: string[] = [];
    const a = new DraftAutosaver("d1", {
      save: (p) => server.save(p),
      debounceMs: 0,
      storage: store,
      onState: (s) => states.push(s),
    });
    a.queue(base("d1"));
    await a.flush();
    expect(server.rows.get("d1")?.["builder_step"]).toBe("review");
    expect(store.getItem(cacheKey("d1"))).toBeNull();
    expect(states).toEqual(["saving", "saved"]);
  });

  it("survives a refresh: the row is read back from the server, not the browser", async () => {
    const server = fakeServer();
    const store = memStorage();
    const a = new DraftAutosaver("d2", {
      save: (p) => server.save(p),
      debounceMs: 0,
      storage: store,
    });
    a.queue(base("d2", { builder_step: "canvas" }));
    await a.flush();
    a.destroy();
    /* Refresh: nothing left in the browser at all. */
    store.removeItem(cacheKey("d2"));
    const reloaded = server.list().find((r) => r.id === "d2");
    expect(reloaded?.["builder_step"]).toBe("canvas");
    expect(reloaded?.["assets"]?.[0].path).toBe("u1/a.jpg");
  });

  it("survives sign-out and sign-in, and is retrievable on another device", async () => {
    const server = fakeServer();
    const a = new DraftAutosaver("d3", {
      save: (p) => server.save(p),
      debounceMs: 0,
      storage: memStorage(),
    });
    a.queue(base("d3"));
    await a.flush();
    server.signInAs("user-2");
    expect(server.list()).toHaveLength(0); // another account sees nothing
    server.signInAs("user-1");
    /* A fresh device has an empty browser but the same account. */
    expect(server.list().map((r) => r.id)).toEqual(["d3"]);
    expect(readRecoveryCache("d3", memStorage())).toBeNull();
  });

  it("reports Couldn't Save, retries, and eventually persists", async () => {
    vi.useFakeTimers();
    const server = fakeServer();
    const store = memStorage();
    const states: string[] = [];
    server.failNext(2);
    const a = new DraftAutosaver("d4", {
      save: (p) => server.save(p),
      debounceMs: 0,
      retryMs: [10, 10],
      storage: store,
      onState: (s) => states.push(s),
    });
    a.queue(base("d4"));
    await a.flush();
    expect(states).toContain("error");
    /* The unconfirmed payload stays in the recovery cache while it is failing. */
    expect(store.getItem(cacheKey("d4"))).not.toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    await vi.advanceTimersByTimeAsync(20);
    expect(server.rows.has("d4")).toBe(true);
    expect(states[states.length - 1]).toBe("saved");
    expect(store.getItem(cacheKey("d4"))).toBeNull();
    vi.useRealTimers();
  });

  it("never creates a duplicate draft across rerenders and rapid edits", async () => {
    const server = fakeServer();
    const a = new DraftAutosaver("d5", {
      save: (p) => server.save(p),
      debounceMs: 0,
      storage: memStorage(),
    });
    for (let i = 0; i < 8; i++) {
      a.queue(base("d5", { title: "Kitchen Refresh " + i }));
      await a.flush();
    }
    a.queue(base("d5", { title: "Kitchen Refresh 7" })); // identical payload, ignored
    await a.flush();
    expect(server.rows.size).toBe(1);
    expect(server.calls).toBe(8);
    expect(server.rows.get("d5")?.["title"]).toBe("Kitchen Refresh 7");
  });
});

describe("legacy localStorage migration", () => {
  it("moves a local staging draft to the server once, then removes the local copy", async () => {
    const server = fakeServer();
    const store = memStorage();
    store.setItem(
      LEGACY_STAGING_KEY,
      JSON.stringify({
        address: "12 Oak St",
        items: [
          {
            key: "p1",
            name: "a.jpg",
            path: "u1/a.jpg",
            room: "Kitchen",
            roomSource: "manual",
            selected: true,
          },
        ],
      }),
    );
    const out = await migrateLegacyStagingDraft({
      save: (p) => server.save(p),
      storage: store,
      newId: () => "11111111-1111-1111-1111-111111111111",
    });
    expect(out.migrated).toBe(true);
    expect(store.getItem(LEGACY_STAGING_KEY)).toBeNull();
    const row = server.rows.get("11111111-1111-1111-1111-111111111111")!;
    expect(row["property_address"]).toBe("12 Oak St");
    expect(row["assets"][0].room_source).toBe("manual");
  });

  it("keeps the local copy when the server rejects the migration", async () => {
    const server = fakeServer();
    const store = memStorage();
    server.failNext(1);
    store.setItem(LEGACY_STAGING_KEY, JSON.stringify({ items: [{ key: "p1", path: "u1/a.jpg" }] }));
    await expect(
      migrateLegacyStagingDraft({ save: (p) => server.save(p), storage: store }),
    ).rejects.toThrow();
    expect(store.getItem(LEGACY_STAGING_KEY)).not.toBeNull();
  });

  it("drops local entries that only ever had temporary blob URLs", async () => {
    const server = fakeServer();
    const store = memStorage();
    store.setItem(
      LEGACY_STAGING_KEY,
      JSON.stringify({ items: [{ key: "p1", path: "blob:http://x/1" }] }),
    );
    const out = await migrateLegacyStagingDraft({ save: (p) => server.save(p), storage: store });
    expect(out.migrated).toBe(false);
    expect(store.getItem(LEGACY_STAGING_KEY)).toBeNull();
    expect(server.calls).toBe(0);
  });
});
