# DoubtRoom

Exam doubts answered in seconds, verified by seniors.

## Run locally

Use Node.js 24 and pnpm 12.14.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The Phase 1 landing page runs without service credentials. Copy `.env.example` to `.env.local` and fill in the provider values when connecting services.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

See the [implementation plan](docs/PLAN.md) and [phase status](docs/STATUS.md).
