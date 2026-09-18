import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.ts";
import { clearCache } from "../services/f1Api.ts";

const originalFetch = globalThis.fetch;
let app: FastifyInstance;

beforeEach(async () => {
  clearCache();
  app = await buildApp({ logger: false });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

const driver = {
  driverId: "driver",
  name: "Test",
  surname: "Driver",
  nationality: "British",
  birthday: null,
  number: "7",
  shortName: "TDR",
  url: null,
};

const team = {
  teamId: "team",
  teamName: "Test Team",
  country: "British",
  firstAppareance: "2024",
  constructorsChampionships: "0",
  driversChampionships: "0",
  url: null,
};

describe("standings routes", () => {
  test("normalises driver standings", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        season: "2026",
        championshipId: "f1_2026",
        drivers_championship: [
          {
            classificationId: "1",
            position: "1",
            points: "25",
            wins: "1",
            driverId: "driver",
            teamId: "team",
            driver,
            team,
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/standings/drivers",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.season).toBe(2026);
    expect(body.standings[0]).toMatchObject({ position: 1, points: 25 });
  });

  test("normalises constructor standings", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        season: "2026",
        championshipId: "f1_2026",
        constructors_championship: [
          {
            classificationId: "1",
            position: "1",
            points: "43",
            wins: "2",
            teamId: "team",
            team,
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/standings/constructors",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.count).toBe(1);
    expect(body.standings[0]).toMatchObject({ position: 1, points: 43 });
  });

  test("returns 502 for an upstream failure", async () => {
    globalThis.fetch = mock(async () => new Response("failed", { status: 500 })) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/standings/drivers",
    });

    expect(response.statusCode).toBe(502);
  });
});
