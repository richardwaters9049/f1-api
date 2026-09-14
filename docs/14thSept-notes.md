# F1 API Development Notes

## 14 September 2026

### Current State

The F1 API service is operational and currently running as a dedicated Fastify/Bun service.

The API is responsible for providing a stable data layer between the Fast Girls Club application and the external Formula 1 data provider.

The service currently uses:

```text
f1api.dev
https://f1api.dev/api
```

The current API version is:

```text
0.1.0
```

The current Formula 1 season is:

```text
2026
```

## Completed Work

The following API foundations are currently implemented.

### Server

- Fastify server
- Bun runtime
- TypeScript
- Automatic port fallback
- Configurable `HOST`
- Configurable `PORT`
- Fastify logging

The preferred port is `8787`.

If the preferred port is unavailable, the server automatically attempts the next port.

### Health Endpoint

Implemented:

```http
GET /api/health
```

The endpoint confirms that the service is running and reports the active port and timestamp.

### Metadata Endpoint

Implemented:

```http
GET /api/meta
```

The metadata endpoint reports:

- Service name
- API version
- Service status
- Current season
- Upstream provider
- Provider base URL
- Supported capabilities
- Live timing availability
- Service start time
- Process uptime
- Current timestamp

This gives frontend applications a reliable way to determine the current state of the API without making assumptions.

## Current Capabilities

The API currently supports:

- Drivers
- Constructors
- Race calendar
- Race details
- Driver standings
- Constructor standings
- Race results
- Current/latest available race results

Live timing is currently unavailable.

This is intentional.

## Live Timing Decision

Live timing was investigated before being exposed through the API.

The main requirement is that live data must be real and current.

The project must not use:

- Fake timing data
- Randomly generated positions
- Placeholder lap times
- Hard-coded session states
- Old historical data presented as live
- A paid source where a free source is required

The current service therefore reports:

```json
{
  "liveTiming": {
    "available": false
  }
}
```

This is preferable to exposing a technically impressive but unreliable live endpoint.

A future live timing implementation should only be added after the source and deployment environment have been verified.

## Provider Behaviour

The upstream provider does not always return every scheduled race result immediately.

For example, a race can exist in the calendar while results for that race are not yet available from the provider.

The service therefore distinguishes between:

1. A race existing in the schedule.
2. Results being available for that race.

The `/api/results/current` endpoint checks recent completed races and returns the newest race for which actual results are available.

This prevents the API from fabricating results when the provider has not supplied them.

## Data Normalisation

Provider responses can contain inconsistent primitive types.

Numeric values may arrive as either:

```text
number
```

or:

```text
string
```

The service normalises these values into the application's typed data model.

Invalid numeric values are not converted into arbitrary fallback numbers.

Missing provider data remains missing.

This is important because the API is intended to be a trusted data layer rather than a presentation layer that hides incomplete upstream information.

## Caching

The service uses an in-memory cache.

Current cache durations:

| Resource      |        TTL |
| ------------- | ---------: |
| Drivers       | 30 minutes |
| Constructors  | 30 minutes |
| Race calendar |  5 minutes |
| Race details  | 10 minutes |
| Standings     |   1 minute |
| Results       | 10 minutes |

The cache reduces unnecessary upstream traffic while keeping championship data relatively fresh.

The cache is process-local and is reset whenever the API process restarts.

## Error Handling

External requests use a finite timeout.

Upstream failures are logged by Fastify and converted into controlled `502` responses.

Invalid route parameters are rejected with `400` responses before an upstream request is attempted.

The API should never silently turn an upstream failure into fake application data.

## Important Provider Limitation

The external provider is the current source of truth for the service.

That means the service can only expose information that the provider actually supplies.

If the provider:

- Has not published a result
- Returns incomplete circuit metadata
- Returns a temporary error
- Changes its response format
- Becomes unavailable

the service must handle the situation honestly rather than inventing a replacement value.

## Architecture Direction

The intended architecture is:

```text
Fast Girls Club Next.js
          |
          v
       F1 API
          |
          v
      f1api.dev
```

The frontend should not need to understand provider-specific response formats.

The API owns:

- Provider communication
- Normalisation
- Caching
- Validation
- Error handling
- Service metadata

The frontend owns:

- Presentation
- Interaction
- Responsive layout
- Formatting
- User experience

## Next Development Priorities

The API foundation is now strong enough to move towards production-quality documentation and integration.

Recommended next priorities:

1. Verify all public endpoints consistently return the documented data shapes.
2. Add API response schemas where useful.
3. Improve route-level documentation.
4. Add automated tests for normalisation and validation.
5. Add provider failure tests.
6. Add cache behaviour tests.
7. Consider structured API logging.
8. Consider OpenAPI documentation once the response contracts have stabilised.

Live timing should remain a separate investigation and should not block the rest of the API.

## Validation

Current validation command:

```bash
bun run typecheck
```

The API should pass TypeScript validation before changes are committed.

Manual health check:

```bash
curl -s http://127.0.0.1:8787/api/health
```

Manual metadata check:

```bash
curl -s http://127.0.0.1:8787/api/meta
```

## Current Metadata Verification

On 14 September 2026 the metadata endpoint returned:

```text
service: f1-api
version: 0.1.0
status: ok
season: 2026
provider: f1api.dev
liveTiming: false
```

This confirms that the service metadata endpoint is operational and correctly identifies the current 2026 season.

## Notes

The API should remain deliberately small.

The goal is not to mirror every endpoint offered by the upstream provider.

The goal is to provide the Fast Girls Club application with a reliable, typed and maintainable Formula 1 data boundary.
