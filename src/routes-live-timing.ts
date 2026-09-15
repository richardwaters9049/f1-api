import type { FastifyInstance } from "fastify";

import { f1LiveTiming } from "./services/f1-live-timing.ts";

export async function liveTimingRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/api/live", async () => {
    return f1LiveTiming.getState();
  });

  fastify.get("/api/live-timing", async () => {
    return f1LiveTiming.getState();
  });

  fastify.get("/api/live-timing/status", async () => {
    const state = f1LiveTiming.getState();

    return {
      running: f1LiveTiming.isRunning(),
      connected: state.connected,
      subscribed: state.subscribed,
      handshakeCompleted: state.handshakeCompleted,
      lastMessageAt: state.lastMessageAt,
      lastUpdateAt: state.lastUpdateAt,
    };
  });
}
