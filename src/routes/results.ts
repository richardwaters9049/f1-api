import type { FastifyInstance } from "fastify";

import {
  F1ApiError,
  getCurrentRaceResults,
  getRaceResults,
} from "../services/f1Api.ts";

export async function resultsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/results/current", async (_request, reply) => {
    try {
      const results = await getCurrentRaceResults();

      return reply.send(results);
    } catch (error) {
      if (error instanceof F1ApiError && error.status === 404) {
        return reply.status(404).send({
          error: "No race results are available yet for the current season",
        });
      }

      app.log.error(error, "Failed to fetch current race results");

      return reply.status(502).send({
        error: "Failed to fetch current race results",
      });
    }
  });

  app.get<{
    Params: {
      season: string;
      round: string;
    };
  }>("/api/results/:season/:round", async (request, reply) => {
    const season = Number(request.params.season);
    const round = Number(request.params.round);

    if (
      !Number.isInteger(season) ||
      season < 1950 ||
      !Number.isInteger(round) ||
      round < 1
    ) {
      return reply.status(400).send({
        error: "Season and round must be valid numbers",
      });
    }

    try {
      const results = await getRaceResults(season, round);

      return reply.send(results);
    } catch (error) {
      if (error instanceof F1ApiError && error.status === 404) {
        return reply.status(404).send({
          error: `No results found for season ${season}, round ${round}`,
        });
      }

      app.log.error(
        error,
        `Failed to fetch race results for ${season}/${round}`,
      );

      return reply.status(502).send({
        error: "Failed to fetch race results",
      });
    }
  });
}
