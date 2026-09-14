import Fastify from "fastify";
import { constructorsRoutes } from "./routes/constructors.ts";
import { driversRoutes } from "./routes/drivers.ts";
import { racesRoutes } from "./routes/races.ts";
import { resultsRoutes } from "./routes/results.ts";
import { standingsRoutes } from "./routes/standings.ts";
import { getCurrentSeasonRaces } from "./services/f1Api.ts";

const app = Fastify({
  logger: true,
});

const SERVICE_NAME = "f1-api";
const API_VERSION = "0.1.0";
const F1_API_PROVIDER = "f1api.dev";
const F1_API_BASE_URL = "https://f1api.dev/api";

const startedAt = new Date();

let activePort: number | null = null;

app.get("/api/health", async () => {
  return {
    status: "ok",
    service: SERVICE_NAME,
    port: activePort,
    timestamp: new Date().toISOString(),
  };
});

app.get("/api/meta", async (_request, reply) => {
  try {
    const races = await getCurrentSeasonRaces();

    const season = races[0]?.season ?? null;

    return reply.send({
      service: SERVICE_NAME,
      version: API_VERSION,
      status: "ok",
      season,
      provider: {
        name: F1_API_PROVIDER,
        baseUrl: F1_API_BASE_URL,
      },
      capabilities: {
        drivers: true,
        constructors: true,
        calendar: true,
        raceDetails: true,
        driverStandings: true,
        constructorStandings: true,
        raceResults: true,
        liveTiming: false,
      },
      liveTiming: {
        available: false,
        reason:
          "No verified free live timing source is currently available for this service.",
      },
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    app.log.error(error, "Failed to build API metadata");

    return reply.status(502).send({
      service: SERVICE_NAME,
      version: API_VERSION,
      status: "degraded",
      season: null,
      provider: {
        name: F1_API_PROVIDER,
        baseUrl: F1_API_BASE_URL,
      },
      capabilities: {
        drivers: true,
        constructors: true,
        calendar: true,
        raceDetails: true,
        driverStandings: true,
        constructorStandings: true,
        raceResults: true,
        liveTiming: false,
      },
      liveTiming: {
        available: false,
        reason:
          "No verified free live timing source is currently available for this service.",
      },
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
      error: "Unable to verify current season data",
    });
  }
});

await driversRoutes(app);
await constructorsRoutes(app);
await racesRoutes(app);
await resultsRoutes(app);
await standingsRoutes(app);

const preferredPort = Number(process.env.PORT ?? 8787);

const host = process.env.HOST ?? "127.0.0.1";

async function startServer(): Promise<void> {
  let port = preferredPort;

  while (true) {
    try {
      await app.listen({
        port,
        host,
      });

      activePort = port;

      console.log(`F1 API running at http://${host}:${port}`);

      return;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);

        port += 1;
        continue;
      }

      app.log.error(error);
      process.exit(1);
    }
  }
}

await startServer();
