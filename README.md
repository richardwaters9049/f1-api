# F1 API

A dedicated Formula 1 data service built with TypeScript, Fastify, and Bun.

The service sits between external Formula 1 data providers and the F1 Next.js application. It fetches external data, normalises it into application-owned models, and exposes a consistent REST API for the frontend.

## Architecture

```text
External F1 APIs
       │
       ▼
    F1 API
       │
       ├── Fetch
       ├── Normalise
       ├── Validate
       └── Serve
       │
       ▼
Next.js F1 Application
       │
       ▼
      UI
```

The F1 API is deliberately separated from the Next.js application so that external data providers are not coupled directly to the frontend.

This gives the project a single place to handle:

- External API integration
- Data normalisation
- API contracts
- Error handling
- Future caching
- Future live timing aggregation
- Additional F1 data providers

## Technology

- TypeScript
- Fastify
- Bun
- Native `fetch`
- REST API
- Strict TypeScript configuration
- F1 API.dev as the current external data provider

## Project Structure

```text
f1-api/
├── .gitignore
├── AGENTS.md
├── bun-env.d.ts
├── bun.lock
├── CLAUDE.md
├── package.json
├── README.md
├── src/
│   ├── index.ts
│   ├── routes/
│   │   ├── constructors.ts
│   │   └── drivers.ts
│   ├── services/
│   │   └── f1Api.ts
│   └── types/
│       └── f1.ts
└── tsconfig.json
```

## API

### Health

```text
GET /api/health
```

Returns the health status of the F1 API service.

Example:

```json
{
  "status": "ok",
  "service": "f1-api",
  "port": 8787,
  "timestamp": "2026-09-10T18:00:00.000Z"
}
```

### Drivers

```text
GET /api/drivers
```

Returns the current season drivers using the application's own driver model.

Example:

```json
{
  "season": 2026,
  "count": 22,
  "drivers": [
    {
      "driverId": "stroll",
      "number": "18",
      "code": "STR",
      "firstName": "Lance",
      "lastName": "Stroll",
      "fullName": "Lance Stroll",
      "nationality": "Canada",
      "dateOfBirth": "1998-10-29",
      "permanentNumber": "18",
      "url": "https://en.wikipedia.org/wiki/Lance_Stroll"
    }
  ]
}
```

### Constructors

```text
GET /api/constructors
```

Returns the current season constructors using the application's own constructor model.

Example:

```json
{
  "season": 2026,
  "count": 11,
  "constructors": [
    {
      "constructorId": "mercedes",
      "name": "Mercedes Formula 1 Team",
      "nationality": "Germany",
      "url": "https://en.wikipedia.org/wiki/Mercedes-Benz_in_Formula_One"
    }
  ]
}
```

## External Data Provider

The current external provider is:

```text
https://f1api.dev/api
```

The service currently consumes:

```text
GET /current/drivers?limit=100
GET /current/teams?limit=100
```

The external provider's response is not exposed directly to the Next.js application.

Instead, the service maps the provider response into application-owned TypeScript models.

## Data Normalisation

External driver data is converted into the internal `Driver` model.

The service currently maps:

| External field   | Internal field    |
| ---------------- | ----------------- |
| `driverId`       | `driverId`        |
| `name`           | `firstName`       |
| `surname`        | `lastName`        |
| `name + surname` | `fullName`        |
| `nationality`    | `nationality`     |
| `birthday`       | `dateOfBirth`     |
| `number`         | `number`          |
| `number`         | `permanentNumber` |
| `shortName`      | `code`            |
| `url`            | `url`             |

Constructor data is similarly normalised into the internal `Constructor` model.

This means the Next.js application does not need to understand the external provider's schema.

## Next.js Integration

The main F1 Next.js application communicates with this service through an environment variable:

```text
F1_LIVE_SERVICE_URL=http://127.0.0.1:8787
```

The Next.js API layer then requests data from this service.

For example:

```text
Browser
   ↓
Next.js
   ↓
/api/f1/live
   ↓
F1 API
   ↓
External F1 provider
```

This keeps external API access on the server side.

The Next.js application should not directly depend on the external provider's response format.

## Local Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun --hot src/index.ts
```

The preferred port is:

```text
8787
```

If that port is already in use, the service automatically attempts the next available port.

You can also set a custom port:

```bash
PORT=9000 bun --hot src/index.ts
```

## Testing the API

Health:

```bash
curl http://127.0.0.1:8787/api/health
```

Drivers:

```bash
curl http://127.0.0.1:8787/api/drivers
```

Constructors:

```bash
curl http://127.0.0.1:8787/api/constructors
```

## Type Checking

Run:

```bash
bun run typecheck
```

This runs TypeScript without generating build output.

## Production

Start the service with:

```bash
bun run start
```

The production command runs:

```text
NODE_ENV=production bun src/index.ts
```

## Error Handling

External API failures are handled by the route layer.

If the upstream provider cannot be reached or returns an unsuccessful HTTP status, the service returns an appropriate `502` response to the application.

Example:

```json
{
  "error": "Failed to fetch F1 driver data"
}
```

The external provider's error response is intentionally not exposed directly to the frontend.

## Future API

The service is being built toward a broader F1 data platform.

Planned endpoints include:

```text
GET /api/races
GET /api/races/:round

GET /api/standings/drivers
GET /api/standings/constructors

GET /api/live
```

The live endpoint will eventually provide normalised real-time session data for the Next.js F1 application.

## Live Data Architecture

The intended live data architecture is:

```text
Multiple F1 Data Providers
          │
          ▼
     F1 API Service
          │
          ├── Provider adapters
          ├── Normalisation
          ├── Validation
          ├── Aggregation
          └── Caching
          │
          ▼
       Next.js API
          │
          ▼
      F1DataHub UI
```

The service is therefore intended to become the application's dedicated F1 data layer rather than simply acting as a proxy.

## Caching

There is currently no database or persistent cache.

Caching can be introduced later once the required data sources and refresh intervals are established.

Potential future caching targets include:

- Driver data
- Constructor data
- Race calendars
- Championship standings
- Session information
- Live timing
- Track status

## Current Status

Currently implemented:

- Fastify server
- Bun runtime
- Strict TypeScript
- Health endpoint
- Driver endpoint
- Constructor endpoint
- F1 API.dev integration
- Driver normalisation
- Constructor normalisation
- Basic upstream error handling
- Automatic port fallback

Next development priorities:

1. Race calendar
2. Race details
3. Driver standings
4. Constructor standings
5. Live session data
6. Multiple provider support
7. Caching
8. Production deployment

## Development Principle

The F1 API owns the data contract consumed by the application.

External providers may change their response structures. The goal of this service is to isolate those changes here so the Next.js application remains stable.

The frontend should consume application-owned models rather than external API schemas.
