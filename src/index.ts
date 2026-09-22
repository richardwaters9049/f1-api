import { buildApp } from "./app.ts";
import { f1LiveTiming } from "./services/f1-live-timing.ts";

let activePort: number | null = null;

const getActivePort = (): number | null => activePort;

const app = await buildApp({ getActivePort });

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 8787);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

const preferredPort = parsePort(process.env.PORT);

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
        if (process.env.NODE_ENV === "production") {
          throw new Error(`Port ${port} is already in use`, { cause: error });
        }

        if (port >= 65_535) {
          throw new Error("No available port could be found");
        }

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
  if (app.server.listening === false) {
    return;
  }

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
