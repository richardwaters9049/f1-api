# F1 API agent guidance

Follow `AGENTS.md` as the authoritative project instructions.

Key commands:

```bash
bun install
bun run dev
bun run typecheck
bun run test
```

Use Bun rather than npm, pnpm or Yarn. This project intentionally uses Fastify for HTTP routing and the `ws` package for the Formula 1 SignalR client; do not replace either as an incidental refactor.

Preserve the public API contracts and never fabricate Formula 1 data. Provider-specific structures belong in `src/services`, public contracts belong in `src/types`, and HTTP concerns belong in `src/routes`.
