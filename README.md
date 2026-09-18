# F1 API

F1 API is the dedicated Formula 1 data service for Fast Girls Club. It uses Bun, TypeScript and Fastify to provide a stable boundary around the `f1api.dev` REST provider and the official Formula 1 SignalR timing feed.

The service never invents missing motorsport data. Provider values are normalised where safe; unavailable values remain `null` or produce a controlled error.

## Capabilities

- Current-season drivers and constructors
- Driver and constructor championship standings
- Current-season calendar and race detail
- Specific and latest available race results
- Official Formula 1 live timing state
- In-memory caching and concurrent-request coalescing
- Upstream timeouts and controlled provider errors
- Health and runtime capability metadata

## Architecture

```text
f1api.dev REST API ──────────────┐
                                 ├──→ Fastify routes ──→ Fast Girls Club
Formula 1 SignalR timing feed ───┘
```

REST provider handling, caching and normalisation live in `src/services/f1Api.ts`. The SignalR connection and incremental feed state live in `src/services/f1-live-timing.ts`. Route modules expose only the application-facing contracts.

## Installation and development

```bash
bun install
bun run dev
```

The default address is `http://127.0.0.1:8787`. If the preferred port is occupied, the development server tries the next available port.

For production:

```bash
bun run start
```

## Configuration

All settings are optional:

```dotenv
PORT=8787
HOST=127.0.0.1
F1_PROVIDER_BASE_URL=https://f1api.dev/api
UPSTREAM_TIMEOUT_MS=10000
```

`F1_PROVIDER_BASE_URL` is configurable for testing or a controlled provider migration. Do not point it at an unverified source.

## Validation

```bash
bun run typecheck
bun run test
```

There is no compilation build step; the strict TypeScript check and route/service tests are the automated validation boundary.

The live timing integration can be observed manually with:

```bash
PROBE_DURATION_SECONDS=30 bun run probe:live
```

## Endpoints

All routes are prefixed with `/api`.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Process liveness and active port |
| `GET /api/meta` | Provider, season, capabilities, uptime and live connection status |
| `GET /api/drivers` | Current-season drivers |
| `GET /api/constructors` | Current-season constructors |
| `GET /api/standings/drivers` | Current driver standings |
| `GET /api/standings/constructors` | Current constructor standings |
| `GET /api/races` | Current-season calendar |
| `GET /api/races/:round` | Current-season race detail |
| `GET /api/results/current` | Latest completed race with available results |
| `GET /api/results/:season/:round` | Results for a season and round |
| `GET /api/live` | Current live-timing state; never cached |
| `GET /api/live-timing/status` | SignalR connection status without the full feed |

`GET /api/live-timing` remains temporarily available as a deprecated alias for `/api/live` and returns deprecation and successor headers.

### Metadata semantics

`/api/meta` reports the live-timing capability separately from its current connection state:

```json
{
  "capabilities": {
    "liveTiming": true
  },
  "liveTiming": {
    "available": true,
    "running": true,
    "connected": true,
    "subscribed": true,
    "lastMessageAt": "2026-09-18T18:48:51.533Z",
    "lastUpdateAt": "2026-09-18T18:48:35.766Z"
  }
}
```

`available` means the integration and endpoint exist. `connected` and `subscribed` describe the current upstream connection. Historical session snapshots are not labelled as live by this service.

### Results behaviour

`/api/results/current` examines completed calendar rounds from newest to oldest. It falls back only when a round genuinely has no published results (`404`). Timeouts and other upstream failures are returned as controlled errors rather than being hidden by older data.

### Live timing behaviour

The service negotiates with the official Formula 1 SignalR endpoint, subscribes to the required topics and retains the latest state. Incremental object patches are deep-merged so an update for one driver does not remove the rest of the timing field.

Negotiation requests have a finite timeout. A dropped connection reconnects indefinitely with a capped exponential delay. Live routes send `Cache-Control: no-store`.

The timing endpoint may contain the most recent session snapshot when no event is live. Consumers must use session dates and status when deciding whether to display a session as live.

## Caching

| Data | Cache duration |
| --- | ---: |
| Drivers | 30 minutes |
| Constructors | 30 minutes |
| Race calendar | 5 minutes |
| Race detail | 10 minutes |
| Championship standings | 1 minute |
| Race results | 10 minutes |

The cache is process-local and is cleared on restart. Concurrent misses for the same key share one upstream request to prevent request stampedes. Live timing is never put into the REST cache.

## Errors and data rules

- Invalid route parameters return `400`.
- Missing provider resources return `404` where the route supports absence.
- Provider failures and invalid required provider data return `502` from API routes.
- External requests have a finite timeout.
- Numeric strings are converted only when they contain valid numeric data.
- Blank or invalid required numbers are rejected; they are never converted into zero.
- Optional missing schedule values are returned as `null`.
- Race-detail identity is reconciled with the current calendar by round.

## Project structure

```text
src/
  app.ts                       Fastify composition root
  config.ts                    Service and provider configuration
  index.ts                     Process start-up and shutdown
  routes/                      HTTP route modules and route tests
  services/f1Api.ts            REST provider, cache and normalisation
  services/f1-live-timing.ts   SignalR client and live state
  types/f1.ts                  Public data contracts
scripts/
  live-timing-service-test.ts  Manual live-feed probe
docs/
  notes.md                     Dated engineering decisions
```
