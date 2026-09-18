import type { FastifyInstance } from "fastify";

import type { LiveTimingReader } from "../services/f1-live-timing.ts";

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  };
}

export async function liveTimingRoutes(
  app: FastifyInstance,
  liveTiming: LiveTimingReader,
): Promise<void> {
  app.get("/api/live", async (_request, reply) => {
    return reply.headers(noStoreHeaders()).send(liveTiming.getState());
  });

  app.get("/api/live-timing", async (_request, reply) => {
    return reply
      .headers({
        ...noStoreHeaders(),
        Deprecation: "true",
        Link: '</api/live>; rel="successor-version"',
      })
      .send(liveTiming.getState());
  });

  app.get("/api/live-timing/status", async (_request, reply) => {
    const state = liveTiming.getState();

    return reply.headers(noStoreHeaders()).send({
      running: liveTiming.isRunning(),
      connected: state.connected,
      subscribed: state.subscribed,
      handshakeCompleted: state.handshakeCompleted,
      lastMessageAt: state.lastMessageAt,
      lastUpdateAt: state.lastUpdateAt,
    });
  });
}
