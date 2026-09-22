import { describe, expect, test } from "bun:test";

import {
  isStaleSessionSnapshot,
  mergeFeedData,
  type F1LiveState,
} from "./f1-live-timing.ts";

function createState(overrides: Partial<F1LiveState> = {}): F1LiveState {
  return {
    connected: true,
    subscribed: true,
    handshakeCompleted: true,
    lastMessageAt: null,
    lastUpdateAt: null,
    sessionInfo: null,
    sessionStatus: null,
    driverList: null,
    timingData: null,
    timingAppData: null,
    timingStats: null,
    trackStatus: null,
    weatherData: null,
    raceControlMessages: null,
    topThree: null,
    lapCount: null,
    latestFeeds: {},
    updateCounts: {},
    ...overrides,
  };
}

describe("mergeFeedData", () => {
  test("preserves untouched timing lines during an incremental update", () => {
    const current = {
      Lines: {
        "1": {
          Position: "1",
          BestLapTime: {
            Value: "1:20.000",
          },
        },
        "4": {
          Position: "2",
        },
      },
    };

    const incoming = {
      Lines: {
        "1": {
          BestLapTime: {
            Value: "1:19.500",
          },
        },
      },
    };

    expect(mergeFeedData(current, incoming)).toEqual({
      Lines: {
        "1": {
          Position: "1",
          BestLapTime: {
            Value: "1:19.500",
          },
        },
        "4": {
          Position: "2",
        },
      },
    });
  });

  test("replaces arrays and primitive values", () => {
    expect(
      mergeFeedData(
        {
          Messages: [1, 2],
        },
        {
          Messages: [3],
        },
      ),
    ).toEqual({
      Messages: [3],
    });

    expect(mergeFeedData("old", "new")).toBe("new");
  });
});

describe("isStaleSessionSnapshot", () => {
  const now = Date.parse("2026-09-22T13:00:00Z");

  test("treats an expired session as stale even when its cached status still says Started", () => {
    const state = createState({
      sessionInfo: {
        EndDate: "2026-09-13T15:00:00Z",
      },
      sessionStatus: {
        Status: "Started",
      },
    });

    expect(isStaleSessionSnapshot(state, now)).toBe(true);
  });

  test("keeps a session whose end time is still in the future", () => {
    const state = createState({
      sessionInfo: {
        EndDate: "2026-09-26T13:00:00Z",
      },
      sessionStatus: {
        Status: "Started",
      },
    });

    expect(isStaleSessionSnapshot(state, now)).toBe(false);
  });

  test("keeps a recently ended session during the grace period", () => {
    const state = createState({
      sessionInfo: {
        EndDate: "2026-09-22T12:45:00Z",
      },
      sessionStatus: {
        Status: "Started",
      },
    });

    expect(isStaleSessionSnapshot(state, now)).toBe(false);
  });

  test("reads the end date from a nested Session object", () => {
    const state = createState({
      sessionInfo: {
        Session: {
          EndDate: "2026-09-13T15:00:00Z",
        },
      },
    });

    expect(isStaleSessionSnapshot(state, now)).toBe(true);
  });

  test("does not discard a snapshot when no session end date is available", () => {
    const state = createState({
      sessionInfo: {
        Name: "Race",
      },
    });

    expect(isStaleSessionSnapshot(state, now)).toBe(false);
  });
});
