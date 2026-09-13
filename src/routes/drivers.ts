import type { FastifyInstance } from "fastify";
import { getCurrentSeasonDrivers } from "../services/f1Api.ts";

export async function driversRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/drivers", async (_request, reply) => {
    try {
      const drivers = await getCurrentSeasonDrivers();

      return reply.send({
        season: new Date().getFullYear(),
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
