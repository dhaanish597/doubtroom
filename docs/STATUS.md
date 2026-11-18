# STATUS

Last updated: 19 Nov 2026 by Codex
Current phase: 3, Google sign-in, onboarding and room provisioning
Live URL: https://doubtroom-ochre.vercel.app
Last good tag: phase-1

## Done
- Phase 1 scaffold, branded landing page, shadcn components, environment validation and example catalog.
- Created the exact PLAN §7 migration and applied it in the DoubtRoom Supabase SQL editor. Verified 15 public tables with RLS enabled and zero public table policies.
- Typecheck, lint, 14 unit tests and Next.js production build passed.
- Vercel built from the frozen lockfile, including the server SDK, and served the landing page at the production URL.

- Phase 2 SDK client and server adapters, protected dev token endpoint, and `/dev/chat` room. Typecheck, lint, 16 tests and production build passed. Local production smoke verified the route guard. With real Nexconn credentials in `.env.local`, Alice and Bob joined `devroom`, exchanged messages in both directions, and reloaded message history after reconnecting. The same checks passed on Vercel after the Production credential redeploy.

- Phase 3 implements Google OAuth, protected SSR routes, profile resolution, chat sessions, onboarding, room provisioning, and the room list and chat shell. Typecheck, lint, 24 unit tests, and the production build passed. Local production HTTP checks used Supabase fixtures. PostgreSQL checks covered cache and refresh behavior, duplicate event prevention, onboarding finalization, and RPC grants.

## In progress
- Apply `supabase/migrations/0002_phase3.sql` after the initial schema, configure the Supabase credentials and invite codes in `.env.local`, then run `pnpm seed`. Live Google sign-in and Nexconn room provisioning and messaging still need the two-account acceptance check.
- The seed uses the four requested Anna University R2021 core courses. RMKEC's 2026 third-year timetable names R2024. See [catalog sources](../data/catalog-sources.md) before using the catalog for the live cohort.

## Known bugs (P0 blocks demo, P1 visible, P2 cosmetic)
- No blocking issue found in the production token, live delivery, or history checks.

## Deviations from PLAN (details in DECISIONS.md)
- D-002 records the pnpm approval required for the pinned Nexconn server SDK.
- D-003 records the supporting dependencies for server-only environment validation and the generated shadcn components.
- D-004 records HTTPS URL handling, endpoint success codes, and the reserved dev identity namespace.
- D-005 records the Phase 3 database migration and development-only chat tooling.

## Env vars added since plan
- None. All 26 application variables are listed in `.env.example`.

## Verified SDK notes learned during build
- Nexconn engine and chat are pinned to `26.2.1`. The server SDK built successfully from tag `v0.1.2`, and `dist/index.d.ts` exists.
- The installed types confirm the nested `data.result.accessToken` shape and the client handler, history, and send signatures. The live token endpoint returned body `code: 0` with HTTP 200. The development log redacted the token.
- Nexconn allowed two simultaneous `dev_bob` sessions during the duplicate-login test. Both received the same live message, so the `31010` kicked-session path remains unverified.

## Traction snapshot
- Users: 0 | Active 24h: 0 | Doubts: 0 | AI answers: 0 | Verified: 0
