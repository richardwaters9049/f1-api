import type { FastifyInstance } from "fastify";

import {
  getCurrentConstructorStandings,
  getCurrentDriverStandings,
} from "../services/f1Api.ts";

export async function standingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/standings/drivers", async (_request, reply) => {
    try {
      const data = await getCurrentDriverStandings();

      return reply.send({
        season: data.season,
        championshipId: data.championshipId,
        count: data.standings.length,
        standings: data.standings,
      });
    } catch (error) {
      app.log.error(error, "Failed to fetch F1 driver standings");

      return reply.status(502).send({
        error: "Failed to fetch F1 driver standings",
      });
    }
  });

  app.get("/api/standings/constructors", async (_request, reply) => {
    try {
      const data = await getCurrentConstructorStandings();

      return reply.send({
        season: data.season,
        championshipId: data.championshipId,
        count: data.standings.length,
        standings: data.standings,
      });
    } catch (error) {
      app.log.error(error, "Failed to fetch F1 constructor standings");

      return reply.status(502).send({
        error: "Failed to fetch F1 constructor standings",
      });
    }
  });
}
