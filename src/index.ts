import { buildApp } from "./app.ts";
import { f1LiveTiming } from "./services/f1-live-timing.ts";

let activePort: number | null = null;

const getActivePort = (): number | null => activePort;

const app = await buildApp({ getActivePort });

const preferredPort = Number(process.env.PORT ?? 8787);

const host = process.env.HOST ?? "127.0.0.1";

async function startServer(): Promise<void> {
  let port = preferredPort;

  while (true) {
    try {
      await app.listen({
        port,
        host,
      });

      activePort = port;

      console.log(`F1 API running at http://${host}:${port}`);

      void f1LiveTiming.start();

      return;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EADDRINUSE"
      ) {
        console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);

        port += 1;
        continue;
      }

      app.log.error(error);
      process.exit(1);
    }
  }
}

await startServer();

async function shutdown(signal: string): Promise<void> {
  console.log(`[F1 API] ${signal} received. Shutting down...`);

  await f1LiveTiming.stop();
  await app.close();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
