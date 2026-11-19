# STATUS

Last updated: 20 Nov 2026 by Claude Code
Current phase: 13 done; waiting on LLM and PostHog keys, then Phase 15–17 (video, PDF, submission)
Live URL: https://doubtroom-ochre.vercel.app
Latest implementation tag: phase-10 (phase 13 committed on main)

## Done
- Phase 1 scaffold, branded landing page, shadcn components, environment validation and example catalog.
- Created the exact PLAN §7 migration and applied it in the DoubtRoom Supabase SQL editor. Verified 15 public tables with RLS enabled and zero public table policies.
- Typecheck, lint, 14 unit tests and Next.js production build passed.
- Vercel built from the frozen lockfile, including the server SDK, and served the landing page at the production URL.

- Phase 2 SDK client and server adapters, protected dev token endpoint, and `/dev/chat` room. Typecheck, lint, 16 tests and production build passed. Local production smoke verified the route guard. With real Nexconn credentials in `.env.local`, Alice and Bob joined `devroom`, exchanged messages in both directions, and reloaded message history after reconnecting. The same checks passed on Vercel after the Production credential redeploy.

- Phase 3 implements Google OAuth, protected SSR routes, profile resolution, chat sessions, onboarding, room provisioning, and the room list and chat shell. Typecheck, lint, 24 unit tests, and the production build passed. Local production HTTP checks used Supabase fixtures. PostgreSQL checks covered cache and refresh behavior, duplicate event prevention, onboarding finalization, and RPC grants.

- Phase 4 adds the room header, paginated chat timeline, message rendering, retry, photo upload, mentions, live room previews and unread counts, and room analytics. Typecheck, lint, build, and 28 unit tests passed.
- Two distinct Nexconn users in an isolated test group passed the browser checks for history, new-message scrolling, desktop and mobile-width send, member mentions, unread clearing, photo viewing, invalid custom content, and analytics. Supabase used local fixtures. A forced Nexconn socket disconnect recovered an offline message exactly once, with unique IDs throughout the timeline. A physical phone and live Google account remain unverified.

- Phase 5 adds doubt composition with unit and photo, signed uploads, live cards, @TA replies, Gemini/Groq fallback, a seven-day answer cache, request quotas, and reporting.
- Created the production Supabase `doubt-images` bucket and verified public read, 5 MB, JPEG/PNG/WebP/HEIC and zero bucket policies. Applied `0003_phase5.sql` and verified the quota RPC is executable by the service role and denied to anon.
- Two distinct Nexconn test users received text and photo answers and live status updates with local Supabase auth/storage fixtures, real Postgres quota/answer functions, and mocked LLMs. Text reached both in 3.16 s, the textbook-photo answer in 3.43 s, and the @TA socket reply in 3.37 s after a mocked Gemini rejection. The daily quota at two, report form, 360 px layout, and answer quote navigation passed.
- [Phase 5 quality worksheet](PHASE-5-QA.md) contains ten exam-style doubts and a licensed textbook image. Prompt tests confirm that injected instructions are kept inside the student-data block.

- Phase 6 adds `/api/mentors` with cached server presence, the "Ask a senior" sheet on answers and subject room headers, 1:1 DMs with a doubt-quoting prefill, typing indicators, read ticks, header presence with a polling fallback, a home Direct messages list and the mentor tab placeholder. Typecheck, lint, 39 unit tests and the production build passed. A live `getUserConnectionStatus` call returned offline for the TA bot as expected.

- Phase 7 adds upvote and verify APIs with Nexconn metadata, mentor "Add a better answer" reference replies, a strong Verified state, the room doubt board with jump-to-message, and the mentor inbox with a nav badge. Migration `0004_phase7.sql` is applied to the live database; RPC grants were checked (anon denied, service role allowed).
- Phase 9 adds `/try` judge mode with a dr_try cookie, sandbox rules, an auto-ticking five-step tour and demo mentor replies, the PWA manifest, icons and an app-shell service worker, PostHog (no-op without a key), `/api/impact` and `/impact`, and the real landing page. `pnpm seed` posted the 7-message demo script to `demo_cn` on the live app.
- Merged main: typecheck, lint, 89 unit tests and the production build pass.

- Phase 11B adds Exam Eve open channels (admin create, auto-create for tomorrow's papers), the live Eve room with @TA, the morning recap cron and RecapCard, and a manual "Run recap now". Migration `0007_phase11b.sql` applied. CRON_SECRET rotated on 19 Nov.
- Phase 11A adds rep/admin announcements with group read receipts ("Seen by X of Y", reader sheet, "Delivered to Y" fallback), a 24 h pinned announcement, message reports, 1-hour mutes, a 17-word profanity list on Nexconn, and /admin (reports, roles, metrics CSV). Migration `0006_phase11a.sql` applied; `pnpm seed` pushed the profanity list.
- Phase 8 (notes grounding via unpdf + Gemini embeddings, [S#] sources on answers, EN/Tamil/Tanglish) and Phase 10 (welcome sheet, error pages, class edit, security headers) were built in the main checkout and committed after review. Their migrations 0008 and 0009 were already on the live DB. Security headers verified on production.
- Nexconn Console: "Enable pre-join history access by new member" and "Restrict chat history access to members" are on (D-013). Server-sent `RC:TxtMsg` now uses the engine `content` field (D-013).
- Phase 13: gitleaks over full history found no leaks. Anonymous calls to 8 mutating routes return 401 on production. E2E on production: landing/impact, guest boundaries and two-judge live upvote sync pass.
- Live `/try` walk-through at 375 px: demo history, upvote (tour ticks), Ask a senior DM with scripted reply in about 3 s, and a clear 429 message when the per-IP demo limit is hit.

## In progress
- BLOCKED on keys: GEMINI_API_KEY, GROQ_API_KEY (TA answers, recap summaries, notes embeddings) and NEXT_PUBLIC_POSTHOG_KEY/HOST (analytics). After adding them: redeploy, ingest demo notes, run the e2e "AI TA answers" and "second user" tests, run a manual recap in demo_cn.
- Not yet verified with real signed-in accounts: Google sign-in and onboarding on production, mentor verify flipping cards on two devices, announcement "Seen by" with 3+ readers, mute/unmute, Exam Eve with two users, DM presence dot and typing.
- The catalog has four Anna University R2021 courses. RMKEC's 2026 third-year timetable names R2024. Confirm the real course codes before launch (data/catalog.json, then `pnpm seed`).
- Manual phases left for you: 14 (make repo public, GIF check), 15 (video), 16 (PDF), 17 (submission form), 14 traction runbook.

## Known bugs (P0 blocks demo, P1 visible, P2 cosmetic)
- No P0 or P1 known. P2: the /try limit of 10 demos per hour per IP could block several judges on one office network.

## Deviations from PLAN (details in DECISIONS.md)
- D-002 records the pnpm approval required for the pinned Nexconn server SDK.
- D-003 records the supporting dependencies for server-only environment validation and the generated shadcn components.
- D-004 records HTTPS URL handling, endpoint success codes, and the reserved dev identity namespace.
- D-005 records the Phase 3 database migration and development-only chat tooling.
- D-006 records the verified Phase 4 media helper and the SDK history cursor workaround.
- D-007 records Phase 5 upload authorization, provider deadlines and live metadata findings.

## Env vars added since plan
- None. All 26 application variables are listed in `.env.example`.

## Verified SDK notes learned during build
- Nexconn engine and chat are pinned to `26.2.1`. The server SDK built successfully from tag `v0.1.2`, and `dist/index.d.ts` exists.
- The installed types confirm the nested `data.result.accessToken` shape and the client handler, history, and send signatures. The live token endpoint returned body `code: 0` with HTTP 200. The development log redacted the token.
- Nexconn allowed two simultaneous `dev_bob` sessions during the duplicate-login test. Both received the same live message, so the `31010` kicked-session path remains unverified.

- Live Phase 5 group metadata writes succeeded with the asker ID and reached the other user. The asker uses the matching bot answer to update its card when Nexconn omits the update event.
- The DoubtRoom Chat Free console showed no switch for online-status subscription or read receipts. Friends exposes a separate presence auto-messaging setting. SDK behavior for Phase 6 remains unverified.

## Traction snapshot
- Users: 0 | Active 24h: 0 | Doubts: 0 | AI answers: 0 | Verified: 0
