/**
 * Behaviour of the connection-level transition record behind the Transition
 * modal: the stored value is always a real transition (never "Auto"), the
 * duration and how it was chosen survive a reload, Apply To All touches every
 * live pair, and a reorder never re-points a transition at the wrong pair.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoPick, OFFERED_TRANSITIONS } from "./transitions";

type Row = {
  from_key: string;
  to_key: string;
  type: string;
  duration_ms: number;
  settings: Record<string, any>;
  status: string;
};

const db = new Map<string, Row>();
const key = (f: string, t: string) => `${f}→${t}`;

vi.mock("./transitions.functions", () => ({
  listTransitions: async () => ({ transitions: [...db.values()] }),
  saveTransition: async ({ data }: any) => {
    const row: Row = {
      from_key: data.from_key,
      to_key: data.to_key,
      type: data.type,
      duration_ms: data.type === "cut" ? 0 : data.duration_ms,
      settings: data.settings ?? {},
      status: "configured",
    };
    db.set(key(row.from_key, row.to_key), row);
    return { transition: row };
  },
  applyTransitions: async ({ data }: any) => {
    const out: Row[] = [];
    for (const c of data.connections) {
      const row: Row = {
        from_key: c.from_key,
        to_key: c.to_key,
        type: data.type,
        duration_ms: data.type === "cut" ? 0 : data.duration_ms,
        settings: data.settings ?? {},
        status: "configured",
      };
      db.set(key(row.from_key, row.to_key), row);
      out.push(row);
    }
    return { transitions: out };
  },
  deleteTransition: async ({ data }: any) => {
    db.delete(key(data.from_key, data.to_key));
    return { ok: true };
  },
  pruneTransitions: async ({ data }: any) => {
    const live = new Set(data.keep.map((k: any) => key(k.from_key, k.to_key)));
    for (const k of [...db.keys()]) if (!live.has(k)) db.delete(k);
    return { removed: 0 };
  },
  startAiTransition: async () => ({ ok: false, transition: null }),
}));

const { TransitionStore } = await import("./transition-store");

const PROJECT = "11111111-1111-1111-1111-111111111111";
const scenes = (...keys: string[]) => keys.map((k) => ({ key: k }));

let store: any;
beforeEach(async () => {
  db.clear();
  store = new TransitionStore();
  await store.load(PROJECT);
});

describe("Auto Select", () => {
  it("only ever recommends a transition the user could pick by hand", () => {
    const ids = OFFERED_TRANSITIONS.map(([id]) => id);
    expect(ids).toEqual(["cut", "dissolve", "fade"]);
    for (const pair of [
      [
        { key: "a", room_name: "Front Exterior" },
        { key: "b", room_name: "Foyer" },
      ],
      [
        { key: "a", room_name: "Kitchen" },
        { key: "b", room_name: "Kitchen" },
      ],
      [
        { key: "a", room_name: "Living Room" },
        { key: "b", room_name: "Backyard" },
      ],
      [{ key: "a" }, { key: "b" }],
    ] as const) {
      expect(ids).toContain(autoPick(pair[0], pair[1]));
    }
  });

  it("stores the chosen transition, not the word auto", async () => {
    const pick = autoPick(
      { key: "a", room_name: "Front Exterior" },
      { key: "b", room_name: "Foyer" },
    );
    await store.set("a", "b", pick, 600, { mode: "auto" });
    const saved = db.get("a→b")!;
    expect(saved.type).toBe(pick);
    expect(saved.type).not.toBe("auto");
    expect(saved.settings["mode"]).toBe("auto");
  });
});

describe("saving and restoring", () => {
  it("keeps type, duration and selection mode across a reload", async () => {
    await store.set("a", "b", "fade", 1200, { mode: "manual" });
    const fresh = new TransitionStore();
    await fresh.load(PROJECT);
    const row = fresh.get("a", "b")!;
    expect(row.type).toBe("fade");
    expect(row.duration_ms).toBe(1200);
    expect(row.settings?.["mode"]).toBe("manual");
  });

  it("keeps a cut instant no matter what duration is sent", async () => {
    await store.set("a", "b", "cut", 1500, { mode: "manual" });
    expect(store.get("a", "b").duration_ms).toBe(0);
  });

  it("writes to the exact pair and leaves its neighbours alone", async () => {
    await store.set("a", "b", "fade", 900, { mode: "manual" });
    expect(store.get("b", "c")).toBeNull();
  });
});

describe("apply to all", () => {
  it("covers every live connection and no more", async () => {
    const list = scenes("a", "b", "c", "d");
    await store.set("a", "b", "cut", 0, { mode: "manual" });
    await store.applyAll(list, "dissolve", 800, { mode: "manual" });
    expect([...db.keys()].sort()).toEqual(["a→b", "b→c", "c→d"]);
    for (const k of db.keys()) {
      expect(db.get(k)!.type).toBe("dissolve");
      expect(db.get(k)!.duration_ms).toBe(800);
    }
  });
});

describe("reordering", () => {
  it("keeps valid pairs, drops orphans and never re-points a transition", async () => {
    await store.set("a", "b", "fade", 900, { mode: "manual" });
    await store.set("b", "c", "cut", 0, { mode: "manual" });
    await store.reconcile(scenes("b", "c", "a"));
    expect(store.get("b", "c")!.type).toBe("cut");
    expect(store.get("a", "b")).toBeNull();
    expect(store.get("c", "a")).toBeNull();
    const fresh = new TransitionStore();
    await fresh.load(PROJECT);
    expect(fresh.get("b", "c")!.type).toBe("cut");
    expect(fresh.get("a", "b")).toBeNull();
  });
});
