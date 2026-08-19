import { describe, expect, it } from "vitest";
import {
  connectionsFor,
  reconcileTransitions,
  resolveAuto,
  resolveTransition,
  transitionDurationMs,
  transitionMap,
  AI_TRANSITION_AVAILABLE,
  AI_TRANSITION_CREDITS,
  reserveCredits,
  releaseCredits,
  commitCredits,
} from "./transitions";

const sc = (key: string) => ({ key });

describe("transition connections", () => {
  it("creates one connection per gap, never one after the last scene", () => {
    expect(connectionsFor([sc("a"), sc("b"), sc("c")]).map((c) => c.key)).toEqual(["a→b", "b→c"]);
    expect(connectionsFor([sc("a")])).toEqual([]);
  });

  it("keeps configured pairs across a reorder and drops the ones that broke", () => {
    const rows = [
      { from_key: "a", to_key: "b", type: "fade", duration_ms: 900 },
      { from_key: "b", to_key: "c", type: "push", duration_ms: 600 },
    ];
    const { keep, stale } = reconcileTransitions([sc("b"), sc("c"), sc("a")], rows);
    expect(keep.map((r) => r.type)).toEqual(["push"]);
    expect(stale.map((r) => r.type)).toEqual(["fade"]);
  });

  it("never lets one connection hold two rows", () => {
    const map = transitionMap(
      [sc("a"), sc("b")],
      [
        { from_key: "a", to_key: "b", type: "fade", duration_ms: 600 },
        { from_key: "a", to_key: "b", type: "cut", duration_ms: 0 },
      ],
    );
    expect(map.size).toBe(1);
    expect(map.get("a→b")!.type).toBe("fade");
  });
});

describe("auto and durations", () => {
  it("chooses restrained moves from the room pairing", () => {
    expect(
      resolveAuto({ key: "1", room_name: "Front Exterior" }, { key: "2", room_name: "Foyer" }),
    ).toBe("push");
    expect(
      resolveAuto({ key: "1", room_name: "Living Room" }, { key: "2", room_name: "Backyard" }),
    ).toBe("fade");
    expect(
      resolveAuto({ key: "1", room_name: "Kitchen" }, { key: "2", room_name: "Kitchen" }),
    ).toBe("match_move");
  });

  it("resolves Auto to a drawable move and passes explicit picks through", () => {
    expect(
      resolveTransition("auto", { key: "1", room_name: "Foyer" }, { key: "2", room_name: "Den" }),
    ).toBe("dissolve");
    expect(resolveTransition("wipe")).toBe("wipe");
    expect(resolveTransition("nonsense")).toBe("dissolve");
  });

  it("clamps lengths and keeps a cut instant", () => {
    expect(transitionDurationMs("cut", 900)).toBe(0);
    expect(transitionDurationMs("fade", 99_999)).toBe(2000);
    expect(transitionDurationMs("fade", null)).toBe(600);
  });
});

describe("AI transition credits", () => {
  it("charges nothing while the bridge is unavailable", () => {
    expect(AI_TRANSITION_AVAILABLE).toBe(false);
    const line = reserveCredits(AI_TRANSITION_CREDITS);
    expect(line.reserved).toBe(AI_TRANSITION_CREDITS);
    const released = releaseCredits(line);
    expect(released.charged).toBe(0);
    expect(released.released).toBe(AI_TRANSITION_CREDITS);
  });

  it("charges only on a committed generation", () => {
    const done = commitCredits(reserveCredits(AI_TRANSITION_CREDITS));
    expect(done.charged).toBe(AI_TRANSITION_CREDITS);
    expect(done.reserved).toBe(0);
  });
});
