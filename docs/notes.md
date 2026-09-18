# F1 API engineering notes

## 18 September 2026

### Summary

This maintenance pass reconciled the documented architecture with the running service, removed a duplicate live-timing implementation and strengthened provider and live-feed correctness without breaking the API consumed by Fast Girls Club.

### Live timing

- Confirmed that the official Formula 1 SignalR integration is operational through `/api/live`.
- Corrected `/api/meta`, `README.md` and `AGENTS.md`, which incorrectly reported live timing as unavailable.
- Added live connection fields to metadata: running, connected, subscribed, last message and last data update.
- Added `Cache-Control: no-store` and `Pragma: no-cache` to live endpoints.
- Retained `/api/live-timing` as a deprecated compatibility alias with a successor link to `/api/live`.
- Added finite timeouts to the SignalR negotiation requests.
- Replaced the five-attempt reconnect limit with an indefinite capped exponential back-off so a temporary outage cannot permanently stop timing until process restart.
- Deep-merged incremental topic updates. A patch for one driver now preserves the other timing lines and unchanged nested values.
- Removed noisy per-ping logging.

### REST provider and normalisation

- Centralised the provider name, base URL, service version and timeout configuration in `src/config.ts`.
- Added `F1_PROVIDER_BASE_URL` and `UPSTREAM_TIMEOUT_MS` configuration.
- Rejected whitespace-only required numeric fields instead of coercing them to zero.
- Preserved missing schedule sessions as explicit null date/time objects.
- Added concurrent-request coalescing so simultaneous cache misses share one upstream request.
- Reconciled current race-detail identity with the cached calendar by round, avoiding ambiguous or malformed provider identities.
- Changed latest-result fallback to continue only after a genuine provider `404`. Timeouts and provider failures now remain visible.
- Exposed available constructor history consistently in the constructors response.

### Code and dependency removal

- Removed the unused second live-timing service (`live-timing.service.ts`).
- Removed the standalone 431-line SignalR probe that duplicated production connection logic.
- Kept one manual probe built on the production service and exposed it as `bun run probe:live`.
- Moved the live route into the standard `src/routes` directory.
- Removed the unused `tsx` dependency and unused Bun starter declarations.
- Refreshed `bun.lock`.

### Tests and verification

The test suite grew from 23 to 38 passing tests. New coverage includes:

- live route cache headers and compatibility alias;
- live connection status;
- incremental feed merging;
- constructor and standings routes;
- blank numeric values;
- missing session schedules;
- concurrent request coalescing;
- race identity reconciliation; and
- upstream failures during latest-result selection.

Verification completed successfully with:

```text
bun run typecheck
bun run test
```

A separate service process was started on port `8877` and checked against real provider data. Health, metadata, drivers, constructors, both standings, calendar, race detail, current results, specific results and live timing all returned successful responses. The official timing connection negotiated, connected and subscribed successfully.

### Recommended next steps

1. Add lightweight runtime schemas at the provider boundary so malformed upstream objects fail with field-level diagnostics.
2. Add a freshness field derived from session dates and status, while keeping the raw feed available to consumers.
3. Add metrics for provider latency, cache hit rate, reconnect count and live-feed age.
4. Define a removal date for the deprecated `/api/live-timing` alias after all consumers use `/api/live`.
5. Add graceful readiness reporting if deployments need to distinguish process health from provider or live-feed availability.

## 14 September 2026

- Established the Bun, TypeScript and Fastify service.
- Added the `f1api.dev` provider boundary, normalisation, caching and controlled errors.
- Added drivers, constructors, standings, calendar, race detail, results, health and metadata endpoints.
- Added the first route and service tests.
