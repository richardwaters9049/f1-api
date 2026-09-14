import { beforeEach, describe, expect, test } from "bun:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.ts";
import { clearCache } from "../services/f1Api.ts";

let app: FastifyInstance;

beforeEach(async (): Promise<void> => {
  clearCache();

  app = await buildApp({
    logger: false,
    getActivePort: (): number | null => 8787,
  });
});

describe("GET /api/health", () => {
  test("reports status, service name, active port and timestamp", async (): Promise<void> => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.status).toBe("ok");
    expect(body.service).toBe("f1-api");
    expect(body.port).toBe(8787);
    expect(typeof body.timestamp).toBe("string");
  });
});
