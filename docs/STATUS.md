# STATUS

Last updated: 18 Nov 2026 23:30 IST by Codex
Current phase: 2, Token server and first live message
Live URL: https://doubtroom-ochre.vercel.app
Last good tag: phase-1

## Done
- Phase 1 scaffold, branded landing page, shadcn components, environment validation and example catalog.
- Created the exact PLAN §7 migration and applied it in the DoubtRoom Supabase SQL editor. Verified 15 public tables with RLS enabled and zero public table policies.
- Typecheck, lint, 14 unit tests and Next.js production build passed.
- Vercel built from the frozen lockfile, including the server SDK, and served the landing page at the production URL.

- Phase 2 SDK client and server adapters, protected dev token endpoint, and `/dev/chat` room. Typecheck, lint, 16 tests and production build passed. Local production smoke verified the route guard.

## In progress
- Live Nexconn token issuance, group membership, and two-browser messaging await credentials in Vercel. The real course catalog is pending.

## Known bugs (P0 blocks demo, P1 visible, P2 cosmetic)
- [P0] The first live chat test requires the Nexconn App Key, App Secret and both SG domains, plus `CRON_SECRET` for the production dev route.

## Deviations from PLAN (details in DECISIONS.md)
- D-002 records the pnpm approval required for the pinned Nexconn server SDK.
- D-003 records the supporting dependencies for server-only environment validation and the generated shadcn components.
- D-004 records HTTPS URL handling, endpoint success codes, and the reserved dev identity namespace.

## Env vars added since plan
- None. All 26 application variables are listed in `.env.example`.

## Verified SDK notes learned during build
- Nexconn engine and chat are pinned to `26.2.1`. The server SDK built successfully from tag `v0.1.2`, and `dist/index.d.ts` exists.
- The installed types confirm the nested `data.result.accessToken` shape and the client handler, history, and send signatures. The token endpoint documents body `code: 0` with HTTP 200. Live confirmation and a development response log are pending.

## Traction snapshot
- Users: 0 | Active 24h: 0 | Doubts: 0 | AI answers: 0 | Verified: 0
