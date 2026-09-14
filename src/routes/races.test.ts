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

function providerRace(round: number): Record<string, unknown> {
  return {
    raceId: `race-2026-${round}`,
    championshipId: "f1",
    raceName: `Round ${round}`,
    round: String(round),
    url: null,
    schedule: {
      race: { date: null, time: null },
      qualy: { date: null, time: null },
      fp1: { date: null, time: null },
      fp2: { date: null, time: null },
      fp3: { date: null, time: null },
      sprintQualy: { date: null, time: null },
      sprintRace: { date: null, time: null },
    },
    laps: null,
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
    fastestLap: null,
    winner: null,
    constructorWinner: null,
  };
}

describe("GET /api/races", () => {
  test("returns the provider-resolved season", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: 2026,
            races: [providerRace(1), providerRace(2)],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/races",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.season).toBe(2026);
    expect(body.count).toBe(2);
    expect(body.races).toHaveLength(2);
  });
});

describe("GET /api/races/:round", () => {
  test("returns 400 for a non-integer round", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/races/abc",
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();

    expect(body.error).toBe("Race round must be a positive integer");
  });

  test("returns 400 for round zero", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/races/0",
    });

    expect(response.statusCode).toBe(400);
  });

  test("returns 404 when the provider returns 404", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return new Response(
            JSON.stringify({
              season: 2026,
              races: [providerRace(1)],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("not found", { status: 404 });
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/races/99",
    });

    expect(response.statusCode).toBe(404);

    const body = response.json();

    expect(body.error).toBe("Race round 99 was not found");
  });

  test("returns 502 when the provider returns 500", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return new Response(
            JSON.stringify({
              season: 2026,
              races: [providerRace(1)],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("boom", { status: 500 });
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/races/1",
    });

    expect(response.statusCode).toBe(502);

    const body = response.json();

    expect(body.error).toBe("Failed to fetch F1 race round 1");
  });

  test("returns the race for a valid round", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return new Response(
            JSON.stringify({
              season: 2026,
              races: [providerRace(1)],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            season: "2026",
            races: providerRace(1),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/races/1",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.season).toBe(2026);
    expect(body.round).toBe(1);
    expect(body.race.round).toBe(1);
  });
});
