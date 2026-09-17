# F1 API

A lightweight Formula 1 data service built with **TypeScript**, **Fastify** and **Bun**.

The service provides a clean API layer between the Fast Girls Club F1 experience and the external Formula 1 data provider. It handles upstream requests, response normalisation, numeric validation, caching, timeout handling and controlled error responses.

The service is designed to keep provider-specific implementation details away from the frontend while exposing a consistent application-facing API.

## Current Status

**Version:** `0.1.0`
**Current season:** `2026`
**Status:** Operational
**Primary provider:** `f1api.dev`
**Default port:** `8787`

The service currently provides:

- Driver data
- Constructor/team data
- Current-season race calendar
- Individual race details
- Driver championship standings
- Constructor championship standings
- Specific race results
- Current/latest available race results
- API health information
- API metadata
- In-memory response caching
- Upstream timeout and error handling
- Normalised application-facing response data

Live timing is **not provided by this service**.

The Fast Girls Club frontend currently consumes live timing through a separate live timing service. This API does not generate simulated, placeholder or fabricated live timing data.

## Technology

- **Bun**
- **TypeScript**
- **Fastify**
- **Node-compatible Web APIs**
- **f1api.dev**

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

The service prefers port `8787`.

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

The server supports the following environment variables:

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

The project does not currently have a separate production build script. The typecheck is the primary validation step.

A change should not be considered complete until the typecheck passes.

## API Overview

All application endpoints are prefixed with:

```text
/api
```

The service exposes endpoints for health, metadata, drivers, constructors, standings, races and results.

## Health

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

## Metadata

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
    "reason": "Live timing is provided by a separate service and is not part of this API."
  }
}
```

The metadata endpoint gives consuming applications a reliable way to understand what the service currently supports.

## Data Endpoints

### Drivers

```http
GET /api/drivers
```

Returns driver data for the current season from the configured Formula 1 provider.

The response includes driver metadata such as:

- Driver ID
- Driver name
- Short name
- Nationality
- Driver number
- Additional provider metadata where available

### Constructors

```http
GET /api/constructors
```

Returns constructor/team data for the current season.

The response includes constructor metadata such as:

- Constructor ID
- Team name
- Nationality
- First appearance
- Championship history where available
- Provider reference URL

### Driver Standings

```http
GET /api/standings/drivers
```

Returns the current-season driver championship standings.

The response includes:

- Championship position
- Driver information
- Team information
- Championship points
- Race wins
- Season information

### Constructor Standings

```http
GET /api/standings/constructors
```

Returns the current-season constructor championship standings.

The response includes:

- Championship position
- Constructor information
- Championship points
- Constructor wins
- Season information

### Race Calendar

```http
GET /api/races
```

Returns the current-season race calendar.

The response includes:

- Season
- Round
- Race name
- Race date and schedule
- Circuit information
- Race identity and provider metadata

### Race Details

```http
GET /api/races/:round
```

Returns details for a specific race round.

Example:

```text
/api/races/16
```

The service normalises race identity and circuit information before returning the response. This prevents malformed or inconsistent provider data from being passed directly to consuming applications.

### Current Race Results

```http
GET /api/results/current
```

Returns the most recent completed race for which results are available from the upstream provider.

The service checks recent completed races and falls back to the latest race with available results when the newest scheduled race does not yet have provider results.

This prevents upcoming races or races without published results from being incorrectly presented as completed.

### Specific Race Results

```http
GET /api/results/:season/:round
```

Returns the results for the requested season and round.

Example:

```text
/api/results/2026/13
```

Results are only returned when the upstream provider has actual results available. The service does not create estimated or placeholder results for upcoming races.

## Data Normalisation

External provider responses can contain inconsistent structures and primitive types.

For example:

- Numeric values may be returned as numbers or numeric strings.
- Some fields may be missing for upcoming races.
- Race identity information may not always be consistent.
- Provider objects may use different shapes for drivers, teams and circuits.
- Some results may not exist yet for a scheduled event.

The service normalises provider responses into stable application-facing structures.

Normalisation includes:

- Converting numeric values where numeric data is required
- Validating season and round parameters
- Normalising driver and constructor structures
- Normalising race and circuit identity
- Preserving unavailable values as unavailable
- Removing unnecessary provider-specific complexity from consumer responses

Values that cannot be safely converted or verified are not fabricated.

## Caching

The API uses an in-memory cache to reduce unnecessary requests to the upstream provider.

Current cache periods include:

| Data                   | Cache duration |
| ---------------------- | -------------: |
| Drivers                |     30 minutes |
| Constructors           |     30 minutes |
| Race calendar          |      5 minutes |
| Race details           |     10 minutes |
| Championship standings |       1 minute |
| Race results           |     10 minutes |

### Cache behaviour

The cache is:

- Process-local
- In-memory
- Shared by requests handled by the running service
- Cleared when the service restarts
- Intended for lightweight deployments and local development

The cache prevents repeated requests for the same data during its configured lifetime while still allowing frequently changing championship information to refresh more often than relatively static driver or constructor metadata.

Completed race results can be cached safely because they are not expected to change regularly after publication. Upcoming races and unavailable results are handled separately so that missing data does not become a long-lived false result.

The Next.js application also applies its own server-side caching layer when proxying this service. This provides an additional boundary between the frontend and upstream data provider.

## Upstream Provider

The current provider is:

```text
f1api.dev
```

Base API:

```text
https://f1api.dev/api
```

The service is deliberately separated from the provider so that frontend applications do not need to communicate directly with the external API.

This gives the project a single place for:

- Provider requests
- Error handling
- Request timeouts
- Caching
- Data normalisation
- Type definitions
- Race identity correction
- Future provider changes

The frontend should consume the F1 API service rather than relying on provider-specific response formats.

## Request Timeouts

Upstream requests use a finite timeout.

The service must not allow an unavailable provider to leave API requests hanging indefinitely.

When an upstream request fails or times out:

- The failure is logged by the service
- The raw provider error is not exposed directly to consumers
- The API returns a controlled error response
- No fabricated fallback data is generated

## Live Timing

Live timing is not currently provided by this API.

The service does not:

- Generate simulated timing data
- Treat scheduled sessions as live
- Reuse historical timing as current timing
- Invent driver positions, gaps or lap times
- Return placeholder session states

The `/api/meta` endpoint explicitly reports live timing as unavailable for this service.

A live timing implementation should only be integrated into this API if there is a verified source that:

1. Can legally and reliably be consumed by the service.
2. Is available without requiring an unsuitable paid subscription.
3. Works reliably from the intended deployment environment.
4. Provides sufficiently current session data.
5. Can be implemented without fabricating missing values.

Until those conditions are satisfied, live timing remains outside the responsibility of this API.

## Error Handling

The API validates route parameters before making upstream requests.

Expected behaviour includes:

- Invalid season values return `400`.
- Invalid round values return `400`.
- Invalid route parameters do not trigger unnecessary upstream requests.
- Upstream provider failures return controlled `502` responses where appropriate.
- Missing results are not represented as fabricated completed results.
- Upstream failures are logged using Fastify's logger.

The service aims to expose predictable errors rather than leaking raw provider responses or internal implementation details.

## Design Principles

This project follows several important rules.

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

If the upstream provider does not provide a value, the API should preserve that absence or return an appropriate error.

### Provider independence

Frontend applications should consume this API rather than depending directly on the external provider.

Provider-specific response changes should be handled inside the service wherever possible.

### Explicit capabilities

The `/api/meta` endpoint should accurately describe what the service currently supports.

Capabilities must not be advertised before they are implemented and verified.

### Defensive integration

External APIs can fail, change response types or temporarily lack data.

The service should handle those situations without crashing or silently producing incorrect information.

### Cache according to data freshness

Frequently changing data should use shorter cache periods, while relatively stable data can be cached for longer.

Caching must not compromise the accuracy of live or recently changing information.

### Small API surface

Only expose endpoints that have a clear purpose for consuming applications.

Avoid adding endpoints simply because the upstream provider exposes them.

## Development Workflow

Typical development workflow:

```bash
bun install
bun run dev
```

Validate changes with:

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

Check the current driver standings:

```bash
curl -s http://127.0.0.1:8787/api/standings/drivers
```

Check the current constructor standings:

```bash
curl -s http://127.0.0.1:8787/api/standings/constructors
```

Check the current race calendar:

```bash
curl -s http://127.0.0.1:8787/api/races
```

Check a specific race:

```bash
curl -s http://127.0.0.1:8787/api/races/16
```

Check specific race results:

```bash
curl -s http://127.0.0.1:8787/api/results/2026/13
```

## Current Version

### `0.1.0`

The current service foundation includes:

- Fastify server
- Bun runtime
- Automatic port fallback
- Configurable host and port
- Health endpoint
- API metadata endpoint
- Driver endpoint
- Constructor endpoint
- Current-season race calendar
- Individual race details
- Driver championship standings
- Constructor championship standings
- Specific race results
- Current/latest available race result lookup
- Upstream timeout handling
- Provider error handling
- Response normalisation
- Race identity normalisation
- In-memory caching
- Explicit live timing capability status

## Future Improvements

Potential future improvements include:

- More complete provider-independent schemas
- Stronger runtime response validation
- Persistent or shared caching for production deployments
- Improved cache invalidation
- More detailed race and circuit data
- Additional historical championship endpoints
- More comprehensive automated tests
- Provider fallback support
- Optional integration with a verified live timing source
