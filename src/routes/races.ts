import type { FastifyInstance } from "fastify";
import { getCurrentSeasonRaces, getRaceByRound } from "../services/f1Api.ts";

interface RaceRoundParams {
  round: string;
}

export async function racesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/races", async (_request, reply) => {
    try {
      const races = await getCurrentSeasonRaces();

      return reply.send({
        season: races[0]?.season ?? new Date().getFullYear(),
        count: races.length,
        races,
      });
    } catch (error) {
      app.log.error(error, "Failed to fetch F1 race calendar");

      return reply.status(502).send({
        error: "Failed to fetch F1 race calendar",
      });
    }
  });

  app.get<{ Params: RaceRoundParams }>(
    "/api/races/:round",
    async (request, reply) => {
      const round = Number(request.params.round);

      if (!Number.isInteger(round) || round < 1) {
        return reply.status(400).send({
          error: "Race round must be a positive integer",
        });
      }

      try {
        const season = new Date().getFullYear();
        const race = await getRaceByRound(season, round);

        if (!race) {
          return reply.status(404).send({
            error: `Race round ${round} was not found`,
          });
        }

        return reply.send({
          season,
          round,
          race,
        });
      } catch (error) {
        app.log.error(error, `Failed to fetch F1 race round ${round}`);

        return reply.status(502).send({
          error: `Failed to fetch F1 race round ${round}`,
        });
      }
    },
  );
}
