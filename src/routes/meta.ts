import type { FastifyInstance } from "fastify";

import { getCurrentSeason } from "../services/f1Api.ts";

const SERVICE_NAME = "f1-api";
const API_VERSION = "0.1.0";
const F1_API_PROVIDER = "f1api.dev";
const F1_API_BASE_URL = "https://f1api.dev/api";

const LIVE_TIMING_REASON =
  "No verified free live timing source is currently available for this service.";

interface MetaDependencies {
  startedAt: Date;
}

const CAPABILITIES = {
  drivers: true,
  constructors: true,
  calendar: true,
  raceDetails: true,
  driverStandings: true,
  constructorStandings: true,
  raceResults: true,
  liveTiming: false,
} as const;

export async function metaRoutes(
  app: FastifyInstance,
  dependencies: MetaDependencies,
): Promise<void> {
  const { startedAt } = dependencies;

  app.get("/api/meta", async (_request, reply) => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

    const base = {
      service: SERVICE_NAME,
      version: API_VERSION,
      provider: {
        name: F1_API_PROVIDER,
        baseUrl: F1_API_BASE_URL,
      },
      capabilities: CAPABILITIES,
      liveTiming: {
        available: false,
        reason: LIVE_TIMING_REASON,
      },
      startedAt: startedAt.toISOString(),
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    };

    try {
      const season = await getCurrentSeason();

      return reply.send({
        ...base,
        status: "ok",
        season,
      });
    } catch (error) {
      app.log.error(error, "Failed to build API metadata");

      return reply.status(200).send({
        ...base,
        status: "degraded",
        season: null,
        error: "Unable to verify current season data",
      });
    }
  });
}
