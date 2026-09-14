import type { FastifyInstance } from "fastify";

const SERVICE_NAME = "f1-api";

interface HealthDependencies {
  getActivePort: () => number | null;
}

export async function healthRoutes(
  app: FastifyInstance,
  dependencies: HealthDependencies,
): Promise<void> {
  app.get("/api/health", async (_request, reply) => {
    return reply.send({
      status: "ok",
      service: SERVICE_NAME,
      port: dependencies.getActivePort(),
      timestamp: new Date().toISOString(),
    });
  });
}
