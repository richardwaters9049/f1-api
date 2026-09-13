# AGENTS.md

## Project

This repository contains the dedicated Formula 1 API service for the F1 application.

The service is located at:

```text
~/Documents/Github/fast_girls_club/f1-api
```

Its responsibility is to retrieve Formula 1 data from external providers, normalise that data into application-owned models, and expose it through a stable REST API.

The Next.js F1 application consumes this service instead of communicating directly with external F1 data providers.

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
       ├── Aggregate
       └── Cache
       │
       ▼
Next.js F1 Application
       │
       ▼
      UI
```

The F1 API is the application's dedicated F1 data layer.

Do not move external provider-specific logic into the Next.js frontend.

## Technology

Use:

- Bun
- TypeScript
- Fastify
- Native `fetch`
- REST
- Strict TypeScript configuration

Do not introduce unnecessary frameworks or dependencies.

## Runtime

Development:

```bash
bun --hot src/index.ts
```

Type checking:

```bash
bun run typecheck
```

Production:

```bash
bun run start
```

Install dependencies with:

```bash
bun install
```

## Port

The default port is:

```text
8787
```

The service automatically attempts the next port when the preferred port is already occupied.

The port can be overridden with:

```bash
PORT=9000 bun --hot src/index.ts
```

The host can be overridden with:

```bash
HOST=0.0.0.0 bun --hot src/index.ts
```

## Project Structure

```text
src/
├── index.ts
├── routes/
│   ├── constructors.ts
│   └── drivers.ts
├── services/
│   └── f1Api.ts
└── types/
    └── f1.ts
```

### `src/index.ts`

Responsible for:

- Creating the Fastify application
- Registering routes
- Health endpoint
- Server startup
- Port handling

Do not put external F1 provider logic directly in this file.

### `src/routes/`

Routes expose application-facing HTTP endpoints.

Routes should:

- Call service functions
- Handle expected errors
- Return stable response structures
- Avoid containing provider-specific parsing logic

### `src/services/`

Services communicate with external F1 providers.

Provider-specific response interfaces belong here when they are only relevant to that provider.

Service functions should convert external responses into the application's internal models before returning them.

### `src/types/`

Contains application-owned F1 models.

Current models include:

```text
Driver
Constructor
```

Keep internal models independent from external provider response types.

## Current API

### Health

```text
GET /api/health
```

### Drivers

```text
GET /api/drivers
```

### Constructors

```text
GET /api/constructors
```

Future endpoints:

```text
GET /api/races
GET /api/races/:round
GET /api/standings/drivers
GET /api/standings/constructors
GET /api/live
```

## External Provider

Current provider:

```text
https://f1api.dev/api
```

Current upstream endpoints:

```text
/current/drivers?limit=100
/current/teams?limit=100
```

Do not assume an external response structure.

Inspect the actual provider response before implementing a new integration.

Do not invent provider fields.

## Data Normalisation

The external provider's models must not leak into the application's public API.

For example, external driver data is converted into:

```text
Driver
├── driverId
├── number
├── code
├── firstName
├── lastName
├── fullName
├── nationality
├── dateOfBirth
├── permanentNumber
└── url
```

External naming differences should be handled inside the service layer.

## Error Handling

External API failures should be handled by the route layer.

Upstream failures should normally result in an HTTP `502` response.

Do not expose raw provider error payloads to the frontend unless there is a deliberate reason to do so.

Log useful server-side error information.

## TypeScript Rules

Use strict TypeScript.

Prefer:

```typescript
import type { FastifyInstance } from "fastify";
```

when importing types.

Use explicit return types for exported service and route functions where practical.

Do not use `any` unless there is a clear technical reason.

Do not suppress TypeScript errors without understanding the underlying problem.

Use application-owned interfaces for data returned to the Next.js application.

## Route Development Workflow

When adding a new endpoint:

1. Confirm the external provider endpoint.
2. Inspect its real response.
3. Create or update the provider response type.
4. Create or update the internal application model.
5. Implement the provider fetch.
6. Normalise the response.
7. Add the Fastify route.
8. Add error handling.
9. Test with `curl`.
10. Run `bun run typecheck`.
11. Update `README.md` if the public API changed.

Do not skip provider response inspection.

## Live Data

The intended live architecture is:

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
      F1DataHub
```

The F1 API should eventually aggregate multiple data sources where appropriate.

Do not make the frontend responsible for combining provider responses.

## Caching

There is currently no database or persistent cache.

Do not introduce a database simply for the sake of adding one.

When caching becomes necessary, consider the refresh characteristics of each data type independently.

Potential cache targets:

- Drivers
- Constructors
- Race calendar
- Race results
- Driver standings
- Constructor standings
- Session information
- Live timing

## Database

No database is currently required.

If a database is introduced later, document:

- Why it is required
- What data is persisted
- Retention rules
- Migration strategy
- Local development setup

Do not store transient live timing data permanently without a clear reason.

## API Contract

The public API should be stable and application-owned.

External provider changes should normally require changes only inside the service layer.

Avoid returning raw upstream responses such as:

```text
return providerResponse
```

when an application-owned model exists.

Instead:

```text
provider response
      ↓
normalisation
      ↓
application model
      ↓
HTTP response
```

## Next.js Integration

The Next.js application communicates with the F1 API through:

```text
F1_LIVE_SERVICE_URL
```

Local development normally uses:

```text
F1_LIVE_SERVICE_URL=http://127.0.0.1:8787
```

The Next.js application should consume the F1 API rather than directly calling `f1api.dev`.

The F1 API owns the provider integration.

## Security

Do not expose unnecessary upstream implementation details.

Do not commit:

- API keys
- Secrets
- Credentials
- Private tokens
- `.env` files

Environment files are ignored by Git.

If a future provider requires credentials, use environment variables.

## Documentation

Update `README.md` whenever:

- A public endpoint is added
- An endpoint changes
- A new external provider is introduced
- Environment variables change
- Development commands change
- Deployment requirements change

Keep documentation aligned with the actual implementation.

## Testing

At minimum, manually test public endpoints with `curl`.

Examples:

```bash
curl http://127.0.0.1:8787/api/health
```

```bash
curl http://127.0.0.1:8787/api/drivers
```

```bash
curl http://127.0.0.1:8787/api/constructors
```

Always run:

```bash
bun run typecheck
```

before considering a TypeScript change complete.

## Code Changes

When modifying code:

- Prefer complete, focused changes.
- Do not invent files or APIs that are not required.
- Keep existing architecture intact unless there is a clear reason to change it.
- Preserve the separation between routes, services, and models.
- Do not move provider-specific types into shared application types unnecessarily.
- Do not bypass the service layer from routes.
- Do not couple the API to the Next.js UI.

When presenting code changes to the developer, provide the full replacement file rather than partial snippets.

## Git

Use the project's commit convention:

```text
Type/Area: Description
```

Examples:

```text
Feat/Races: Add race calendar endpoint
Feat/Live: Add live session aggregation
Fix/Drivers: Normalise driver numbers
Docs/API: Document race endpoints
Chore/Deps: Update Fastify
```

Keep commits focused.

## Current Status

Implemented:

- Fastify server
- Bun runtime
- Strict TypeScript
- Health endpoint
- Driver endpoint
- Constructor endpoint
- F1 API.dev integration
- Driver normalisation
- Constructor normalisation
- Upstream error handling
- Automatic port fallback

Planned:

1. Race calendar
2. Race details
3. Driver standings
4. Constructor standings
5. Live session data
6. Multiple provider support
7. Caching
8. Production deployment

## Agent Behaviour

Before implementing an external API integration, inspect the actual response.

Do not guess field names.

Do not expose provider-specific schemas directly to the frontend.

Do not add unnecessary dependencies.

Do not rewrite unrelated files.

Keep the service small, explicit, and easy to maintain.

The long-term goal is a reliable application-owned F1 data service that allows the Next.js frontend to remain independent of external F1 API implementations.
