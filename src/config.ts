export const SERVICE_NAME = "f1-api";
export const API_VERSION = "0.1.0";
export const F1_PROVIDER_NAME = "f1api.dev";

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const F1_PROVIDER_BASE_URL = withoutTrailingSlash(
  process.env.F1_PROVIDER_BASE_URL ?? "https://f1api.dev/api",
);

export const UPSTREAM_TIMEOUT_MS = positiveInteger(
  process.env.UPSTREAM_TIMEOUT_MS,
  10_000,
);

export const LIVE_TIMING_NEGOTIATE_URL =
  "https://livetiming.formula1.com/signalrcore/negotiate";

export const LIVE_TIMING_WEBSOCKET_URL =
  "wss://livetiming.formula1.com/signalrcore";
