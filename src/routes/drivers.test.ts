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

describe("GET /api/drivers", () => {
  test("returns the provider-resolved season, not the calendar year", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.endsWith("/current?limit=100")) {
          return new Response(JSON.stringify({ season: 2026, races: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.endsWith("/current/drivers?limit=100")) {
          return new Response(
            JSON.stringify({
              drivers: [
                {
                  driverId: "d1",
                  name: "Test",
                  surname: "Driver",
                  nationality: "British",
                  birthday: null,
                  number: "44",
                  shortName: "TDR",
                  url: null,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("unexpected", { status: 500 });
      },
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/drivers",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.season).toBe(2026);
    expect(body.count).toBe(1);
    expect(body.drivers[0].driverId).toBe("d1");
    expect(body.drivers[0].fullName).toBe("Test Driver");
    expect(body.drivers[0].number).toBe("44");
  });

  test("returns 502 when the provider fails", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> => new Response("boom", { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/drivers",
    });

    expect(response.statusCode).toBe(502);

    const body = response.json();

    expect(body.error).toBe("Failed to fetch F1 driver data");
  });
});
