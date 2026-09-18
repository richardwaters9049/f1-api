import { beforeEach, describe, expect, test } from "bun:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.ts";
import type {
  F1LiveState,
  LiveTimingReader,
} from "../services/f1-live-timing.ts";

const state: F1LiveState = {
  connected: true,
  subscribed: true,
  handshakeCompleted: true,
  lastMessageAt: "2026-09-18T12:00:00.000Z",
  lastUpdateAt: "2026-09-18T11:59:00.000Z",
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
};

const liveTiming: LiveTimingReader = {
  getState: () => structuredClone(state),
  isRunning: () => true,
};

let app: FastifyInstance;

beforeEach(async (): Promise<void> => {
  app = await buildApp({ logger: false, liveTiming });
});

describe("live timing routes", () => {
  test("returns uncached live state from the canonical route", async () => {
    const response = await app.inject({ method: "GET", url: "/api/live" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(response.json().connected).toBe(true);
  });

  test("keeps the legacy alias with a deprecation header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/live-timing",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.deprecation).toBe("true");
    expect(response.headers.link).toContain("/api/live");
  });

  test("reports connection status without returning the full feed", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/live-timing/status",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>;

    expect(body).toEqual({
      running: true,
      connected: true,
      subscribed: true,
      handshakeCompleted: true,
      lastMessageAt: "2026-09-18T12:00:00.000Z",
      lastUpdateAt: "2026-09-18T11:59:00.000Z",
    });
  });
});
