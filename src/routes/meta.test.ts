import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.ts";
import { clearCache } from "../services/f1Api.ts";

const originalFetch = globalThis.fetch;

let app: FastifyInstance;

beforeEach(async (): Promise<void> => {
  clearCache();

  app = await buildApp({
    logger: false,
    startedAt: new Date("2026-09-14T00:00:00.000Z"),
  });
});

afterEach((): void => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("GET /api/meta", () => {
  test("returns full metadata when the provider is reachable", async (): Promise<void> => {
    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: 2026,
            races: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/meta",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.service).toBe("f1-api");
    expect(body.version).toBe("0.1.0");
    expect(body.status).toBe("ok");
    expect(body.season).toBe(2026);
    expect(body.provider.name).toBe("f1api.dev");
    expect(body.provider.baseUrl).toBe("https://f1api.dev/api");
    expect(body.capabilities.drivers).toBe(true);
    expect(body.capabilities.liveTiming).toBe(false);
    expect(body.liveTiming.available).toBe(false);
    expect(body.startedAt).toBe("2026-09-14T00:00:00.000Z");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  test("degrades to 200 with status degraded when the provider is unreachable", async (): Promise<void> => {
    globalThis.fetch = mock(async (): Promise<Response> => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const response = await app.inject({
      method: "GET",
      url: "/api/meta",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.status).toBe("degraded");
    expect(body.season).toBeNull();
    expect(body.error).toBe("Unable to verify current season data");
    expect(body.service).toBe("f1-api");
    expect(body.version).toBe("0.1.0");
    expect(body.capabilities.liveTiming).toBe(false);
  });
});
