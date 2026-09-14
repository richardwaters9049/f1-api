import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.ts";
import { clearCache } from "../services/f1Api.ts";

const originalFetch = globalThis.fetch;

let app: FastifyInstance;

beforeEach(async (): Promise<void> => {
  clearCache();

  app = await buildApp({ logger: false });
});

afterEach((): void => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

function resultsPayload(
  season: number,
  round: number,
): Record<string, unknown> {
  return {
    season: String(season),
    races: {
      raceId: `race-${season}-${round}`,
      raceName: `Round ${round}`,
      round: String(round),
      date: "2026-01-01",
      time: "12:00:00Z",
      url: null,
      circuit: {
        circuitId: "c",
        circuitName: "Circuit",
        country: "Country",
        city: "City",
        length: null,
        lapRecord: null,
        firstParticipationYear: null,
        corners: null,
        fastestLapDriverId: null,
        fastestLapTeamId: null,
        fastestLapYear: null,
        url: null,
      },
      results: [],
    },
  };
}

describe("GET /api/results/current", () => {
  test("returns 404 when no completed races have results", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return new Response(JSON.stringify({ season: 2026, races: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("not found", { status: 404 });
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/results/current",
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe(
      "No race results are available yet for the current season",
    );
  });
});

describe("GET /api/results/:season/:round", () => {
  test("returns 400 for a non-numeric season", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/results/abc/1",
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("Season and round must be valid numbers");
  });

  test("returns 400 for round zero", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/results/2026/0",
    });

    expect(response.statusCode).toBe(400);
  });

  test("returns 400 for a season before 1950", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/results/1949/1",
    });

    expect(response.statusCode).toBe(400);
  });

  test("returns 404 when the provider returns 404", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> => new Response("not found", { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/results/2026/99",
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe("No results found for season 2026, round 99");
  });

  test("returns 502 when the provider returns 500", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> => new Response("boom", { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/results/2026/1",
    });

    expect(response.statusCode).toBe(502);

    const body = response.json();

    expect(body.error).toBe("Failed to fetch race results");
  });

  test("returns results for a valid season and round", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(JSON.stringify(resultsPayload(2026, 5)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/results/2026/5",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.season).toBe(2026);
    expect(body.round).toBe(5);
    expect(body.raceId).toBe("race-2026-5");
    expect(body.results).toEqual([]);
  });
});
