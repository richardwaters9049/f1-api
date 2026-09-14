import Fastify, { type FastifyInstance } from "fastify";

import { constructorsRoutes } from "./routes/constructors.ts";
import { driversRoutes } from "./routes/drivers.ts";
import { healthRoutes } from "./routes/health.ts";
import { metaRoutes } from "./routes/meta.ts";
import { racesRoutes } from "./routes/races.ts";
import { resultsRoutes } from "./routes/results.ts";
import { standingsRoutes } from "./routes/standings.ts";

export interface BuildAppOptions {
  logger?: boolean;
  getActivePort?: () => number | null;
  startedAt?: Date;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  const startedAt = options.startedAt ?? new Date();

  const getActivePort = options.getActivePort ?? ((): number | null => null);

  await healthRoutes(app, { getActivePort });
  await metaRoutes(app, { startedAt });
  await driversRoutes(app);
  await constructorsRoutes(app);
  await racesRoutes(app);
  await resultsRoutes(app);
  await standingsRoutes(app);

  return app;
}
