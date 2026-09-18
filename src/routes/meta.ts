import type { FastifyInstance } from "fastify";

import {
  API_VERSION,
  F1_PROVIDER_BASE_URL,
  F1_PROVIDER_NAME,
  SERVICE_NAME,
} from "../config.ts";
import { getCurrentSeason } from "../services/f1Api.ts";
import type { LiveTimingReader } from "../services/f1-live-timing.ts";

interface MetaDependencies {
  startedAt: Date;
  liveTiming: LiveTimingReader;
}

const CAPABILITIES = {
  drivers: true,
  constructors: true,
  calendar: true,
  raceDetails: true,
  driverStandings: true,
  constructorStandings: true,
  raceResults: true,
  liveTiming: true,
} as const;

export async function metaRoutes(
  app: FastifyInstance,
  dependencies: MetaDependencies,
): Promise<void> {
  const { startedAt } = dependencies;

  app.get("/api/meta", async (_request, reply) => {
    const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const liveState = dependencies.liveTiming.getState();

    const base = {
      service: SERVICE_NAME,
      version: API_VERSION,
      provider: {
        name: F1_PROVIDER_NAME,
        baseUrl: F1_PROVIDER_BASE_URL,
      },
      capabilities: CAPABILITIES,
      liveTiming: {
        available: true,
        running: dependencies.liveTiming.isRunning(),
        connected: liveState.connected,
        subscribed: liveState.subscribed,
        lastMessageAt: liveState.lastMessageAt,
        lastUpdateAt: liveState.lastUpdateAt,
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
