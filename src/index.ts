import Fastify from "fastify";
import { constructorsRoutes } from "./routes/constructors.ts";
import { driversRoutes } from "./routes/drivers.ts";
import { racesRoutes } from "./routes/races.ts";
import { resultsRoutes } from "./routes/results.ts";
import { standingsRoutes } from "./routes/standings.ts";

const app = Fastify({
  logger: true,
});

let activePort: number | null = null;

app.get("/api/health", async () => {
  return {
    status: "ok",
    service: "f1-api",
    port: activePort,
    timestamp: new Date().toISOString(),
  };
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
