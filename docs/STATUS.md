# STATUS

Last updated: 20 Nov 2026 by Claude Code
Current phase: 14 done; next 15 (video) and 17 (submission)
Live URL: https://doubtroom-ochre.vercel.app
Latest implementation tag: phase-14

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

- Phase 14 (20 Nov): README and ARCHITECTURE updated for the webhook, room sync and model split; write-up PDF regenerated from `docs/writeup/` (7 pages, App Key on page 1); clean-clone install, typecheck, lint, tests and build pass; gitleaks over full history clean; repository made public.

## Current state
- **AI setup.** Text doubts, @TA mentions, Exam Eve answers and recap summaries use Groq `openai/gpt-oss-120b` (`LLM_PRIMARY=groq`). Photo doubts use Gemini `gemini-3.5-flash-lite`, which is also the text fallback. Notes grounding embeds with `gemini-embedding-2` and answers carry [S#] sources (D-016, D-017).
- **TA trigger.** The Nexconn `message:send` webhook (`POST /api/nexconn/webhook`) is primary. The browser relay (`/api/ta/ask`) is a fallback. Both go through `acceptTaRequest`, and `reserve_ta_request` answers each message once (D-018). See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Admin.** `/admin` has reports, roles, metrics CSV, notes upload, Exam Eve and a Sync rooms panel (`POST /api/admin/sync-rooms`).
- **Judge mode.** `/try` allows 40 sandboxes per hour per IP.
- **Verified on production (20 Nov).** Unsigned webhook returns 401, signed returns 200, anonymous sync-rooms returns 401. Photo doubt, notes citation, TA answer, two-user sync, mentor DM and API boundary e2e pass. Security headers present. gitleaks over full history found no leaks. PostHog events arrive. The morning recap ran once and posted a correct card in `demo_cn`.
- **Demo data.** The seeded 7-message script is in `demo_cn`. The TCP revision sheet is indexed for notes grounding.

## Not yet verified with real accounts
- Google sign-in and onboarding on production with a real Google account.
- Mentor verify flipping answer cards on two devices.
- Announcement "Seen by X of Y" with three or more readers.
- Mute and unmute by a rep.
- Exam Eve with two users.
- DM presence dot and typing on two devices.
- Physical phone check; the Nexconn `31010` kicked-session path.
- The Nexconn Console webhook delivering real `message:send` events to production (route verified with signed test requests only).

## Manual steps left
1. Nexconn Console: Chat > Chat settings > Webhooks, URL `https://doubtroom-ochre.vercel.app/api/nexconn/webhook`, event `message:send`.
2. Catalog: exam dates are null, and only CSE III A/B with R2021 course codes exist. RMKEC's 2026 timetable names R2024, so confirm the real codes in `data/catalog.json`, then run `pnpm seed` and Sync rooms.
3. Record the demo video (Phase 15).
4. Replace `public/downloads/doubtroom-demo.mp4` (or the README and PDF link) with the new video, then make the submission on the challenge form from `docs/SUBMISSION.md` (Phase 17).

## Known bugs (P0 blocks demo, P1 visible, P2 cosmetic)
- No P0 or P1 known.
- Fixed 20 Nov: e2e runs had left 13 test doubts and 11 TA answers in `demo_cn`, hiding the seeded demo. They were recalled through the Server API (recalls leave no placeholder in our client), their 11 doubt rows and 3 test photos were deleted, and the upvote-sync e2e passes again. Doubt-posting e2e tests now run only with `E2E_POST_DOUBTS=1`.

## Deviations from PLAN (details in DECISIONS.md)
- D-001: Chat SDK with custom UI instead of Chat UI.
- D-002: pnpm approval for the pinned Nexconn server SDK build.
- D-003: tooling dependencies for env validation and generated shadcn components.
- D-004: HTTPS URL handling, endpoint success codes, reserved dev identity namespace.
- D-005: Phase 3 migration, onboarding retries and development-only chat tooling.
- D-006: Phase 4 media helper and SDK history cursor workaround.
- D-007: Phase 5 upload authorization, provider deadlines and quotas.
- D-008: Phase 6 mentor DMs, presence and read receipts.
- D-009: Phase 7 verify, upvote, board and mentor inbox.
- D-010: Phase 9 judge mode, PWA, analytics and impact page.
- D-011: Phase 11A announcements, receipts and moderation.
- D-012: Phase 11B Exam Eve and the morning recap.
- D-013: server text format and group history settings.
- D-014: Phase 8 PDF ingestion and answer sources.
- (D-015 does not exist; the number was skipped.)
- D-016: Groq only, no Gemini (superseded in part by D-017).
- D-017: Gemini back for photos, text fallback and notes embeddings; Groq stays primary for text.
- D-018: webhook-triggered TA, admin room sync, /try limit raised to 40 per hour per IP.

## Env vars added since plan
- None. All 26 application variables are listed in `.env.example`; `GEMINI_API_KEY`, `GEMINI_MODEL` and `GEMINI_EMBED_MODEL` are now set in Production, Preview and Development.

## Verified SDK notes learned during build
- Nexconn engine and chat are pinned to `26.2.1`. The server SDK built successfully from tag `v0.1.2`, and `dist/index.d.ts` exists.
- The installed types confirm the nested `data.result.accessToken` shape and the client handler, history, and send signatures. The live token endpoint returned body `code: 0` with HTTP 200. The development log redacted the token.
- Nexconn allowed two simultaneous `dev_bob` sessions during the duplicate-login test. Both received the same live message, so the `31010` kicked-session path remains unverified.

- Live Phase 5 group metadata writes succeeded with the asker ID and reached the other user. The asker uses the matching bot answer to update its card when Nexconn omits the update event.
- The DoubtRoom Chat Free console showed no switch for online-status subscription or read receipts. Friends exposes a separate presence auto-messaging setting. SDK behavior for Phase 6 remains unverified.

## Traction snapshot
Read from `/api/impact` on 20 Nov 2026, 01:35 IST (data updated 19 Nov 20:03 UTC):
- Users: 3 (2 onboarded, 1 mentor) | Active 24h: 2 | Doubts: 0 | AI answers: 0 | Verified: 0 | Demo sessions: 48
- Real-user numbers are still zero. Pilot onboarding has not started.
