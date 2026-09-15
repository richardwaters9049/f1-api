import type { FastifyInstance } from "fastify";
import { f1LiveTiming } from "./services/f1-live-timing";

export async function liveTimingRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/api/live-timing", async () => {
    return {
      success: true,
      data: f1LiveTiming.getState(),
    };
  });

  fastify.get("/api/live-timing/status", async () => {
    const state = f1LiveTiming.getState();

    return {
      success: true,
      data: {
        running: f1LiveTiming.isRunning(),
        connected: state.connected,
        subscribed: state.subscribed,
        lastMessageAt: state.lastMessageAt,
        lastUpdateAt: state.lastUpdateAt,
      },
    };
  });
}
