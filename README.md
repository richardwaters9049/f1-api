# F1 API

A lightweight Formula 1 data service built with **TypeScript**, **Fastify** and **Bun**.

The service provides a clean API layer between the Fast Girls Club F1 experience and the external Formula 1 data provider. It normalises provider responses, validates numeric fields, handles upstream failures, and caches frequently requested data.

## Current Status

**Version:** `0.1.0`
**Current season:** `2026`
**Status:** Operational
**Primary provider:** `f1api.dev`

The service currently provides:

- Driver data
- Constructor data
- Current-season race calendar
- Race details
- Driver championship standings
- Constructor championship standings
- Race results
- Current/latest available race results
- API health information
- API metadata

Live timing is **not currently enabled**.

No simulated, placeholder or fabricated live timing data is used.

## Technology

- Bun
- TypeScript
- Fastify
- Node-compatible Web APIs
- `f1api.dev`

## Project Structure

```text
f1-api/
├── docs/
│   └── notes.md
├── src/
│   ├── routes/
│   │   ├── constructors.ts
│   │   ├── drivers.ts
│   │   ├── races.ts
│   │   ├── results.ts
│   │   └── standings.ts
│   ├── services/
│   │   └── f1Api.ts
│   ├── types/
│   │   └── f1.ts
│   └── index.ts
├── .env
├── .env.example
├── AGENTS.md
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

Install dependencies with:

```bash
bun install
```

## Development

Start the API in development mode:

```bash
bun run dev
```

The server prefers port `8787`.

If that port is already in use, the service automatically tries the next available port.

The default development address is:

```text
http://127.0.0.1:8787
```

## Production

Start the service with:

```bash
bun run start
```

The server honours the following environment variables:

```text
PORT
HOST
```

Defaults:

```text
PORT=8787
HOST=127.0.0.1
```

## Validation

Run the TypeScript typecheck with:

```bash
bun run typecheck
```

The project does not currently have a separate build script.

A change should not be considered complete until the typecheck passes.

## API

### Health

```http
GET /api/health
```

Returns basic service health information.

Example:

```json
{
  "status": "ok",
  "service": "f1-api",
  "port": 8787,
  "timestamp": "2026-09-14T02:44:34.401Z"
}
```

### Metadata

```http
GET /api/meta
```

Returns service metadata, current season information, provider information and supported capabilities.

Example:

```json
{
  "service": "f1-api",
  "version": "0.1.0",
  "status": "ok",
  "season": 2026,
  "provider": {
    "name": "f1api.dev",
    "baseUrl": "https://f1api.dev/api"
  },
  "capabilities": {
    "drivers": true,
    "constructors": true,
    "calendar": true,
    "raceDetails": true,
    "driverStandings": true,
    "constructorStandings": true,
    "raceResults": true,
    "liveTiming": false
  },
  "liveTiming": {
    "available": false,
    "reason": "No verified free live timing source is currently available for this service."
  }
}
```

The metadata endpoint is intended to give consuming applications a reliable way to understand what the API currently supports.

## Data Endpoints

### Drivers

```http
GET /api/drivers
```

Returns driver data from the configured Formula 1 provider.

### Constructors

```http
GET /api/constructors
```

Returns constructor/team data.

### Driver Standings

```http
GET /api/standings/drivers
```

Returns driver championship standings.

### Constructor Standings

```http
GET /api/standings/constructors
```

Returns constructor championship standings.

### Current Race Results

```http
GET /api/results/current
```

Returns the most recent completed race for which results are available from the upstream provider.

The service checks recent completed races and falls back to the latest race with available results when the newest scheduled race does not yet have provider results.

### Specific Race Results

```http
GET /api/results/:season/:round
```

Example:

```text
/api/results/2026/13
```

Returns the results for the requested season and round.

## Data Normalisation

The external provider does not always return identical primitive types.

For example, numeric fields may be returned as either numbers or numeric strings.

The service normalises these values before exposing them through the API.

Numeric fields are converted to numbers where the application contract requires numeric data.

Values that cannot be safely converted are not fabricated.

Provider data that is unavailable remains unavailable.

## Caching

The API uses an in-memory cache to reduce unnecessary requests to the upstream provider.

Current cache periods include:

| Data                   |      Cache |
| ---------------------- | ---------: |
| Drivers                | 30 minutes |
| Constructors           | 30 minutes |
| Race calendar          |  5 minutes |
| Race details           | 10 minutes |
| Championship standings |   1 minute |
| Race results           | 10 minutes |

The cache is intentionally simple at this stage.

It is process-local and is cleared when the service restarts.

## Upstream Provider

The current provider is:

```text
f1api.dev
```

Base API:

```text
https://f1api.dev/api
```

The service is deliberately separated from the provider so that the frontend does not need to communicate directly with the external API.

This also gives the project a single place for:

- Provider requests
- Error handling
- Timeouts
- Caching
- Data normalisation
- Type definitions
- Future provider changes

## Request Timeouts

Upstream requests use a finite timeout.

The service must not allow an unavailable upstream provider to leave API requests hanging indefinitely.

Upstream failures are converted into appropriate API errors rather than exposing raw provider failures to consumers.

## Live Timing

Live timing is currently disabled.

The API does **not** generate fake timing information and does not pretend that historical or scheduled data is live.

The current metadata response explicitly reports:

```json
{
  "available": false
}
```

A live timing implementation should only be added when there is a verified source that:

1. Can legally and reliably be consumed by this service.
2. Is available without requiring a paid subscription.
3. Works reliably from the intended deployment environment.
4. Provides sufficiently current session data.
5. Can be implemented without fabricating missing values.

Until those conditions are satisfied, `liveTiming` remains disabled.

## Error Handling

The API validates route parameters before making upstream requests.

Invalid season and round values return a `400` response.

Upstream provider failures return a `502` response.

The service logs upstream failures using Fastify's logger while returning a controlled response to API consumers.

## Design Principles

This project follows a few important rules.

### No fabricated data

Data must come from a real source.

Do not invent:

- Drivers
- Teams
- Results
- Points
- Lap times
- Positions
- Session states
- Circuit information
- Live timing

If the upstream provider does not provide a value, the API should preserve that absence.

### Provider independence

Frontend applications should consume this API rather than depending directly on the external provider.

### Explicit capabilities

The `/api/meta` endpoint should accurately describe what the service can currently provide.

### Defensive integration

External APIs can fail, change response types or temporarily lack data.

The service should handle those situations without crashing or silently producing incorrect information.

### Small API surface

Only expose endpoints that have a clear purpose for the consuming applications.

Avoid adding endpoints simply because the upstream provider exposes them.

## Development Workflow

Typical development workflow:

```bash
bun install
bun run dev
```

Then validate changes with:

```bash
bun run typecheck
```

Check service health:

```bash
curl -s http://127.0.0.1:8787/api/health
```

Check API metadata:

```bash
curl -s http://127.0.0.1:8787/api/meta
```

## Current Version

### `0.1.0`

Initial service foundation including:

- Fastify server
- Automatic port fallback
- Health endpoint
- API metadata endpoint
- Driver endpoint
- Constructor endpoint
- Race calendar integration
- Race detail integration
- Driver standings
- Constructor standings
- Race results
- Current race result lookup
- Upstream timeout handling
- Provider error handling
- Response normalisation
- In-memory caching
- Explicit live timing capability status
