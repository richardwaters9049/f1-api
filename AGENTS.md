# AGENTS.md — F1 API Project Instructions

## Project Overview

This repository contains the dedicated Formula 1 data API used as the backend data layer for the Fast Girls Club F1 experience.

The service is built with:

- Bun
- TypeScript
- Fastify

The API consumes Formula 1 data from:

```text
https://f1api.dev/api
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
```

Defaults:

```text
PORT=8787
HOST=127.0.0.1
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

GET /api/results/current
GET /api/results/:season/:round
```

Race calendar and race detail routes are also provided by the race route module.

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

Live timing is currently disabled.

The API must report:

```text
liveTiming.available = false
```

Do not implement fake live timing to make the frontend appear complete.

A live timing source must be:

1. Real.
2. Current.
3. Reliably accessible.
4. Suitable for the intended deployment environment.
5. Available without requiring a paid service if the project requirement remains free live data.
6. Tested before being exposed through the API.

Historical data must never be presented as live data.

Scheduled data must never be presented as live data.

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

The `/api/results/current` endpoint may need to fall back to an earlier completed race when the newest scheduled race does not yet have results from the provider.

This is acceptable.

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
