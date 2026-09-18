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

describe("GET /api/constructors", () => {
  test("returns normalised constructor history", async () => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return Response.json({ season: "2026", races: [] });
        }

        return Response.json({
          teams: [
            {
              teamId: "team",
              teamName: "Test Team",
              country: "British",
              firstAppareance: "2024",
              constructorsChampionships: "1",
              driversChampionships: null,
              url: null,
            },
          ],
        });
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/constructors",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.season).toBe(2026);
    expect(body.constructors[0]).toMatchObject({
      constructorId: "team",
      firstAppearance: 2024,
      constructorsChampionships: 1,
      driversChampionships: null,
    });
  });

  test("returns 502 when the provider fails", async () => {
    globalThis.fetch = mock(
      async () => new Response("failed", { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/constructors",
    });

    expect(response.statusCode).toBe(502);
  });
});
