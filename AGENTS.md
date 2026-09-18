# AGENTS.md — F1 API Project Instructions

## Project Overview

This repository contains the dedicated Formula 1 data API used as the backend data layer for the Fast Girls Club F1 experience.

The service is built with:

- Bun
- TypeScript
- Fastify

The API consumes Formula 1 data from the REST provider and the official timing feed:

```text
https://f1api.dev/api
https://livetiming.formula1.com/signalrcore
```

The service normalises, validates, caches and exposes that data through a small internal API.

---

## Core Principle

**Never fabricate Formula 1 data.**

This is a data service, not a mock-data service.

Do not invent or hard-code:

- Drivers
- Constructors
- Championship points
- Race results
- Positions
- Lap times
- Session states
- Circuit information
- Dates
- Times
- Live timing
- Track status

If the provider does not supply a value, preserve the missing value or return an appropriate error.

Do not replace missing upstream data with a plausible-looking value.

---

## Current Provider

The current upstream provider is:

```text
f1api.dev
```

Base URL:

```text
https://f1api.dev/api
```

Do not add a second provider without a clear architectural reason.

Provider changes should be documented in `docs/notes.md`.

---

## Current API Version

```text
0.1.0
```

The current Formula 1 season is determined from provider data.

Do not hard-code the current season in application logic when it can be obtained from the provider.

---

## Runtime

Development:

```bash
bun run dev
```

Production:

```bash
bun run start
```

Type checking:

```bash
bun run typecheck
```

Tests:

```bash
bun run test
```

There is currently no separate build script.

---

## Server

The preferred development port is:

```text
8787
```

The server automatically attempts the next available port if the preferred port is already occupied.

Environment variables:

```text
PORT
HOST
F1_PROVIDER_BASE_URL
UPSTREAM_TIMEOUT_MS
```

Defaults:

```text
PORT=8787
HOST=127.0.0.1
F1_PROVIDER_BASE_URL=https://f1api.dev/api
UPSTREAM_TIMEOUT_MS=10000
```

---

## API Endpoints

The API currently provides:

```text
GET /api/health
GET /api/meta

GET /api/drivers
GET /api/constructors

GET /api/standings/drivers
GET /api/standings/constructors

GET /api/races
GET /api/races/:round

GET /api/results/current
GET /api/results/:season/:round

GET /api/live
GET /api/live-timing/status
```

`GET /api/live-timing` is a deprecated compatibility alias for `/api/live`.

Do not document an endpoint as available unless it actually exists in the current source.

---

## Metadata Endpoint

The metadata endpoint is:

```text
GET /api/meta
```

It must accurately report:

- Service name
- API version
- Current season
- Provider information
- Supported capabilities
- Live timing status
- Service uptime
- Timestamps

If a capability is unavailable, report it as unavailable.

Do not claim that an unfinished feature is operational.

---

## Live Timing

Live timing is provided by the official Formula 1 SignalR timing feed.

The metadata endpoint must report the implemented capability separately from the current connection state:

```text
capabilities.liveTiming = true
liveTiming.available = true
liveTiming.running
liveTiming.connected
liveTiming.subscribed
```

The timing service may retain the most recent session snapshot between events. A connected feed is not proof that a race session is currently live. Consumers must use session dates and status and must never present historical or scheduled data as live.

Incremental timing updates must merge into the retained topic state. Replacing a full timing object with a one-driver patch loses valid data and is not acceptable.

---

## External Requests

External provider requests must have a finite timeout.

An unavailable provider must not cause API requests to hang indefinitely.

Provider failures should be logged and converted into controlled API responses.

Do not expose unnecessary provider implementation details directly to consumers.

---

## Data Normalisation

The provider can return inconsistent primitive types.

For example:

```text
number
```

and:

```text
string
```

may both represent numeric fields.

Normalise provider data into the project's TypeScript data contracts.

Use explicit conversion and validation.

Do not use unsafe coercion that can turn invalid data into believable numbers.

---

## Missing Data

Missing data is valid data.

If the provider returns:

```text
null
```

the API should normally preserve that `null`.

Do not replace missing values with:

```text
0
999
---
Unknown
N/A
```

unless that value is genuinely part of the provider's data contract and has a clear semantic meaning.

Presentation-specific fallback text belongs in the frontend, not in the data service.

---

## Results

Race results must represent actual provider data.

The `/api/results/current` endpoint may fall back to an earlier completed race when the newest completed round returns `404` because results are not yet available.

This is acceptable.

Do not fall back when the provider times out or returns another failure. That would hide an outage behind stale data.

Fabricating results for a scheduled but incomplete race is not acceptable.

---

## Caching

The current service uses in-memory caching.

Current intended TTLs:

```text
Drivers              30 minutes
Constructors         30 minutes
Race calendar         5 minutes
Race details         10 minutes
Standings             1 minute
Race results         10 minutes
```

Do not remove caching without a reason.

Do not assume the cache survives process restarts.

---

## TypeScript

Maintain strict TypeScript correctness.

Avoid:

- `any` without a strong reason
- Unsafe casts
- Suppression comments
- Ignoring compiler errors

Prefer explicit interfaces and normalisation functions.

If the provider response differs from the public API contract, define a provider-specific type and normalise it before returning the public type.

---

## Error Handling

Use appropriate HTTP status codes.

General guidance:

```text
400 = invalid request parameters
502 = upstream provider failure
```

Do not return HTTP `200` when the service failed to obtain required upstream data.

Do not silently convert errors into fake data.

---

## Documentation

Keep these documents current:

```text
README.md
docs/notes.md
AGENTS.md
```

`README.md` should explain how to install, run, validate and consume the API.

`docs/notes.md` should record important development decisions, provider limitations, architecture changes and dated project progress.

`AGENTS.md` should contain project-level development rules and constraints.

When a significant architectural decision is made, add it to `docs/notes.md`.

---

## Testing And Validation

After changing TypeScript source files, run:

```bash
bun run typecheck
bun run test
```

When the server is running, manually verify:

```bash
curl -s http://127.0.0.1:8787/api/health
```

and:

```bash
curl -s http://127.0.0.1:8787/api/meta
```

For endpoint changes, test the affected endpoint with real provider data.

Do not consider a feature complete merely because the TypeScript compiler passes.

---

## Code Changes

Prefer small, focused changes.

Do not refactor unrelated code while implementing a specific feature.

Preserve existing API contracts unless there is a clear reason to change them.

When changing a response contract:

1. Update the TypeScript type.
2. Update normalisation logic.
3. Update the route if required.
4. Update the README.
5. Update `docs/notes.md`.
6. Run the typecheck.
7. Test the endpoint.

---

## Production Mindset

This API is intended to become a real data service.

Prioritise:

- Correctness
- Honest data
- Predictable contracts
- Defensive external integration
- Clear errors
- Maintainability
- Small surface area
- Reliable documentation

Do not prioritise visual completeness over data correctness.

A missing feature is better than a misleading feature.

---

## Git

Use the project's commit message convention:

```text
Type/Area: Description
```

Examples:

```text
Docs/API: Document metadata and endpoint contracts
Feat/Results: Add current race result fallback
Fix/Provider: Handle missing upstream race results
Chore/Docs: Update development notes
```

Keep commits focused and descriptive.
