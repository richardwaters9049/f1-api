import type { FastifyInstance } from "fastify";
import { getCurrentSeasonConstructors } from "../services/f1Api.ts";

export async function constructorsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/constructors", async (_request, reply) => {
    try {
      const constructors = await getCurrentSeasonConstructors();

      return reply.send({
        season: new Date().getFullYear(),
        count: constructors.length,
        constructors,
      });
    } catch (error) {
      app.log.error(error, "Failed to fetch F1 constructors");

      return reply.status(502).send({
        error: "Failed to fetch F1 constructor data",
      });
    }
  });
}
