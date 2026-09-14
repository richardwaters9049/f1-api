import type { FastifyInstance } from "fastify";

import {
  getCurrentSeason,
  getCurrentSeasonDrivers,
} from "../services/f1Api.ts";

export async function driversRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/drivers", async (_request, reply) => {
    try {
      const [season, drivers] = await Promise.all([
        getCurrentSeason(),
        getCurrentSeasonDrivers(),
      ]);

      return reply.send({
        season,
        count: drivers.length,
        drivers,
      });
    } catch (error) {
      app.log.error(error, "Failed to fetch F1 drivers");

      return reply.status(502).send({
        error: "Failed to fetch F1 driver data",
      });
    }
  });
}
