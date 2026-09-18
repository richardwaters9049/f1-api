import { describe, expect, test } from "bun:test";

import { mergeFeedData } from "./f1-live-timing.ts";

describe("mergeFeedData", () => {
  test("preserves untouched timing lines during an incremental update", () => {
    const current = {
      Lines: {
        "1": { Position: "1", BestLapTime: { Value: "1:20.000" } },
        "4": { Position: "2" },
      },
    };

    const incoming = {
      Lines: {
        "1": { BestLapTime: { Value: "1:19.500" } },
      },
    };

    expect(mergeFeedData(current, incoming)).toEqual({
      Lines: {
        "1": { Position: "1", BestLapTime: { Value: "1:19.500" } },
        "4": { Position: "2" },
      },
    });
  });

  test("replaces arrays and primitive values", () => {
    expect(mergeFeedData({ Messages: [1, 2] }, { Messages: [3] })).toEqual({
      Messages: [3],
    });
    expect(mergeFeedData("old", "new")).toBe("new");
  });
});
