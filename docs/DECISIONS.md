# DECISIONS

## D-001 Chat SDK with custom UI (not Chat UI)
Layer 3 of the Nexconn decision framework. Chat UI Web does not render custom message cards or
message metadata, and does not cover Open channels. We need all three.

## D-00X <title>
Date: | Phase: | Plan said: | We did: | Why: | Impact:

## D-002 Allow the pinned Nexconn server SDK build
Date: 18 Nov 2026 | Phase: 1

pnpm 12 blocked the Git dependency's `prepare` script with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`.
The workspace approves the script for the exact commit behind `v0.1.2`. Installation produced
`dist/index.d.ts`, so the project retains the official SDK. Vercel uses the same pinned pnpm
version and frozen lockfile.

## D-003 Phase 1 tooling dependencies
Date: 18 Nov 2026 | Phase: 1

`server-only` enforces the server environment boundary in Next.js. The shadcn registry adds
`class-variance-authority`, `radix-ui`, `next-themes`, `sonner`, `tw-animate-css` and the
`shadcn` stylesheet. The shadcn CLI is a development dependency.

## D-004 Nexconn Phase 2 API and test identities

Date: 18 Nov 2026 | Phase: 2

The integration uses the official Web Chat SDK with a custom React interface (Layer 3, as in D-001).
The endpoint-specific registration, create and join docs specify body `code: 0` with HTTP 200.
The installed server SDK appends paths to its configured URL without adding a scheme, so the
adapter adds `https://` to the validated hostnames. The temporary token route issues only
`dev_*` identities and still requires the shared dev key in production. This keeps application
and bot identities out of the test endpoint.

## D-005 Phase 3 onboarding retries and session events

Date: 19 Nov 2026 | Phase: 3

Migration `0002_phase3.sql` adds a pending onboarding selection. Retries and concurrent
submissions continue the same plan after Nexconn provisioning begins. A service-role-only
function finalizes memberships, mentor subjects, the profile, and its onboarding event in
one database transaction. Chat session updates use a second service-role function and a
unique event index for one `connected` event per profile per India Standard Time day.

Phase 3 keeps the existing Web Chat SDK and custom React UI from D-001. The production build
returns 404 for the Phase 2 dev chat page and token endpoint. The Try cookie verifier accepts
a signed profile ID with the `doubtroom-try` audience and an expiry. Phase 9 will issue cookies.

## D-006 Phase 4 media and timeline behavior

Date: 19 Nov 2026 | Phase: 4

The installed Web Chat SDK exposes `Helper.createSendImageMessageParams`, which prepares the photo and its thumbnail. The composer sends it through `sendMediaMessage` and uses `onUploadProgress`. If the browser cannot create the thumbnail, the existing file helper sends the photo as a downloadable attachment.

Live Nexconn history returned records oldest-first even with `isAscending: false`. The installed query advances using the last returned record, which caused overlapping pages. The room uses `BaseChannel.createMessagesQuery` with the oldest received timestamp as `startTime` for the next `loadNextPage` call. It merges messages by ID and keeps the first page at 30 while the SDK delivers its offline backlog.

The room list keeps the timestamp of the latest confirmed read so temporarily stale channel snapshots cannot restore the same unread badge. Events accept only the room ID and an allowlisted event name.

## D-007 Phase 5 TA delivery, uploads and quotas

Date: 19 Nov 2026 | Phase: 5

Phase 5 extends the existing Web Chat SDK and server SDK integration (Layer 3, D-001). The installed server SDK declares `shouldPersist` as numeric, so bot answers use `1`. An isolated Nexconn group confirmed that writing doubt metadata as the asker succeeds and updates the second user live. The asker missed its own update, so the timeline also derives status from a bot answer when both the doubt ID and the quoted message ID match. Nexconn server history is disabled on this app (403, code 1009). The endpoint uses authenticated room membership and rate limits as in the plan. The service cannot independently verify authorship of a supplied chat message ID. Phase 5 metadata includes the doubt ID so other cards ignore mismatched updates.

The upload request includes the room ID and doubt ID to authorize and construct the signed object path. The TA and doubt card accept only URLs that match that project's room and doubt path. Browser support for HEIC previews varies, so the photo dialog links to the original file if the preview fails.

Postgres reserves each request once and serializes quota checks across rooms, counting accepted requests by India Standard Time day. Photo requests try Gemini first and text requests honor `LLM_PRIMARY`. Groq may answer the accompanying text with a notice about the missing photo. Each attempt has a 20-second cap within a shared 24-second provider budget. Next.js `after()` runs delivery after HTTP 202 with a 45-second function ceiling for provider and Nexconn I/O. The seven-day cache is scoped by course, language and unit, skips photos, and avoids refreshing the age of unverified cached answers. Failed drafts use the Phase 5 `failed` card status. Report records answer feedback. Senior messaging and upvotes remain Phase 6 and 7 actions.

## D-008 Phase 6 mentor DMs, presence and receipts

Date: 19 Nov 2026 | Phase: 6

Phase 6 keeps the Web Chat SDK with custom UI (D-001) and uses `DirectChannel`. All names were checked in the installed `@nexconn/chat` 26.2.1 types: `sendTypingStatus`, `ChannelHandler.onTypingStatusChanged`, `sendReadReceiptResponse`, `getMessageReadReceiptInfo`, `MessageHandler.onMessageReceiptResponse`, `NCEngine.userModule.subscribeEvent`, `getSubscribeUsersOnlineStatus` and `UserHandler.onSubscriptionChanged`. `SubscriptionChangedEvent` carries an event value whose online code is undocumented. On every change the header asks `getSubscribeUsersOnlineStatus`, which returns a boolean `isOnline`.

Server SDK v0.1.2 `getUserConnectionStatus` checks one user per call (status `"1"` online, rate limit 100 per second). `/api/mentors` therefore looks users up 10 at a time and caches each result for 30 seconds per server instance. A failed lookup reports `online: null` and is not cached. `/api/mentors` also accepts `?ids=` (up to 20) for the DM header's 60-second polling fallback, which runs whenever `subscribeEvent` is refused. Try actors get an empty list and cannot open DMs until the Phase 9 demo mentor.

Read ticks: one tick for sent, two grey ticks once `sentStatus` reports received, and two indigo ticks after a receipt event, a read-info lookup or `sentStatus` READ. The message store never moves delivery status backward. Received messages are acknowledged after they are at least 60% visible in a foreground tab, batched with a 500 ms debounce.

`/api/rooms/[id]/doubts` is still reserved for Phase 7, so the DM prefill reads the doubt from the message store or `BaseChannel.getMessagesByIds`. The page uses the room title only when the actor is a member. Group and direct chats share a new `useChannelHistory` hook that contains the D-006 history cursor workaround unchanged. Events accept `dm_started` and `dm_message_sent` with a `peerId`, which must be an existing profile other than the sender.

## D-009 Phase 7 verify, upvote, board and inbox

Date: 19 Nov 2026 | Phase: 7

Phase 7 keeps the Web Chat SDK with custom UI (D-001). Migration `0004_phase7.sql` adds three service-role-only functions. `set_answer_vote` locks the answer, sets or toggles one vote and recounts. `set_answer_verification` verifies an AI answer or undoes the caller's own verification within 10 minutes, updates the doubt and records `answer_verified` or `answer_unverified`. `record_mentor_answer` stores a senior answer. It also adds indexes for answers by doubt, votes by profile and AI-answered doubts. No new dependencies or environment variables.

Upvote and verify accept an optional body: `{ voted }` or `{ verified }`. An explicit state keeps retries and double taps idempotent. No body toggles the vote or verifies, as in the plan. `{ verified: false }` is Unverify. Only an AI answer can be verified, and only by a mentor who has the room's course in `mentor_subjects` and is a member of the room, or by an admin. Try visitors never verify. These rules are pure functions in `src/lib/answers/rules.ts` with unit tests, and the database function re-checks the state under a row lock. Answer metadata adds `verAt`, the verification time in milliseconds, so the Undo button disappears after 10 minutes. Undo clears `verBy`, `verName` and `verAt` to empty strings and sets `ver` to `0`.

Metadata writers: the bot sent `dr:answer`, so `up` and `ver` are written as `bot_ta`. This should reach every member, the voter included. If the bot write fails, the voter or verifier writes instead, and the card reconciles with the API response. Doubt metadata keeps the D-007 order: the asker first, then the bot. The asker can miss its own update, so the timeline marks a doubt Verified when its TA answer has `ver = 1` or a senior has replied to it. Each verify call rewrites metadata from the stored state, so a retry after a failed Nexconn write (HTTP 502 `SYNC_FAILED`) repairs the room. An upvote that saved but failed the metadata write still returns 200 and logs a warning.

Senior answers use `SendReferenceMessageParams` and `Helper.wrapAsReferenceMessageContent`, checked in the installed `@nexconn/chat` 26.2.1 types (`text`, `referMsgId`, `referMsgType`, `referMsgSenderId`, `referMsg`). The client loads the quoted doubt with `BaseChannel.getMessagesByIds` and falls back to the store copy, because the helper only reads `content`, `messageType`, `messageId` and `senderUserId`. `RC:ReferenceMsg` is rendered as a quote. A reply to a `dr:doubt` by a mentor or admin profile gets the Senior answer style. `POST /api/answers` records it with `author_kind 'mentor'` and counts as verified by its author: the doubt moves to Verified and leaves the inbox. The plan does not define this. A doubt row exists only when the TA accepted the request, so a reply to a quota-refused doubt stays in the chat with a notice that the board did not update. Senior answers have no upvote button.

New routes not in Section 8: `POST /api/answers` and `GET /api/mentor/inbox` (`{ doubts, count }`, mentors only, which also drives the Mentor tab badge every 60 seconds). `GET /api/rooms/[id]/doubts` returns `{ doubts, counts }` with the latest 100 doubts. Exact counts are calculated for each tab. Failed doubts are listed under Open. Board rows link to `/app/room/[id]?m=<messageId>`. The room loads up to five older pages to find the message, then highlights it. If it is not found, a focused panel shows the message from `getMessagesByIds`. The DM prefill says "your doubt" when a senior opens it from someone else's doubt.
## D-010 Phase 9 judge mode, PWA, analytics and impact

Date: 19 Nov 2026 | Phase: 9

Phase 9 adds no dependencies, no environment variables and no migration. It keeps the Web Chat SDK with custom UI (D-001). The demo mentor reply uses `MessageManagementApi.sendDirectChannelMessage`, which was checked in the installed server SDK v0.1.2 `dist/api.d.ts`. Its fields are `fromUserId`, `toUserIds`, `messageType`, `content`, `isEchoToSender` and `shouldPersist`, and the result is `result.messageIds[].{userId,messageId}`.

**Try identity.** `POST /api/try` requires a same-origin request and `NEXT_PUBLIC_TRY_ENABLED`. A visitor who already has a valid `dr_try` session gets that sandbox back, and the request does not count against the limit. A signed-in Google user gets 409. Otherwise the route records a `try_attempt` event with a keyed IP hash, HMAC-SHA256 under `TRY_COOKIE_SECRET` and truncated to 32 hex characters, and then counts that hour's attempts. The insert comes first so parallel requests cannot bypass the 10-per-hour limit, and blocked attempts are counted too. The route then creates a `try_<nanoid10>` profile named "Judge XXXX", issues its token, joins only `demo_cn`, and sets the HS256 cookie. The cookie lasts 24 hours and is httpOnly, SameSite Lax, and Secure in production. The route returns 201 for a new sandbox and 503 if the demo room is missing. Try profiles skip onboarding and keep `onboarded_at` null.

**Sandbox.** `src/lib/auth/sandbox.ts` holds the rules: try actors use only `demo_*` rooms of kind `demo`, and they DM only `demo_mentor`. `roomsForActor`, `memberRoom`, the DM page, `/api/events`, `/api/mentors` and `/api/try/mentor-ping` all use it. Real students can no longer open DMs with bot identities or `try_*` users. Limitation: the browser sends chat directly to Nexconn. Group sends outside `demo_cn` fail because try users are members only there, but a crafted client could still DM an arbitrary user ID. There is no server hook to block that without the webhook.

**Demo room.** The seed now sets `demo_cn.course_code` to `CS3591` (Computer Networks), if it exists in the catalog. That gives the composer units and shows "Ask a senior" on answer cards without editing `AnswerCard`. `/api/mentors` returns only Arun to try actors, whatever course they ask for. He is reported as online because he replies within seconds. The DM page shows him with the mentor role, although his profile role stays `bot`. Real students never see him because he has no `mentor_subjects` row.

**Seed.** `data/demo-seed.json` contains seven messages: one announcement, two doubts, two TA answers, one verified by Arun with two upvotes, and two text messages. The plan described a single marker row. Instead, the seed writes one `demo_seed_message` event for each delivered message, with props `{room,key,messageId}`. A rerun skips sent messages and resumes after a partial failure without posting duplicate chat messages. Doubt, answer, vote and announcement rows use fixed UUIDs and are upserted, so Phase 7 upvote and verify routes can find the seeded answers. The doubt card metadata is written as the asker first and then as `bot_ta`, as in Phase 5. The announcement requests read receipts. "Seen by" counts still depend on the Phase 11A `AnnounceCard`, which is a placeholder, so the tour's fifth step ticks when the announcement card is at least 60% visible.

**Tour.** `TourChecklist` is mounted in the `/app` layout for try actors. It sits above the bottom nav on phones, showing only the current step, and floats at the bottom right from `lg` up. Doubt, answer and DM steps come from the message store. The upvote step ticks on a `track("upvoted")` event, or when an answer's `up` metadata rises while the tour is open. Phase 7 should call `track("upvoted")` and `track("verified")` from `@/lib/analytics`. Progress is stored in `localStorage` per sandbox user. The example doubt reaches the composer through a small zustand store. `Composer` gained optional `prefillMode` and `prefillUnit` props. After a demo visitor's text DM to Arun, `DirectChat` calls `/api/try/mentor-ping`. That route allows 4 pings per minute per profile and records events without message text, then `after()` sends a keyword-matched scripted reply 3 seconds later. Each reply says it is scripted.

**Analytics.** `track()` accepts only the twelve plan events and strips any prop whose key looks like text, a name or an email, or whose value contains whitespace or is longer than 64 characters. `posthog-js` (already a dependency) is loaded with a dynamic import only when `NEXT_PUBLIC_POSTHOG_KEY` is set. The config uses `person_profiles: "identified_only"` and `capture_pageview: "history_change"`. Autocapture, session recording and surveys are off, because clicks could capture message text. Users are identified by Nexconn ID with an `actor_kind` property only. `connected` and `answer_received`, with `latency_ms` measured from my doubt's `sentTime` and live messages only, fire in the Nexconn client. `room_opened`, `doubt_posted` and `dm_started` reuse the existing hooks. `signed_up` fires on the first onboarding view in each browser session, because the OAuth callback is server-side. Every tracked event is also dispatched in the page as `doubtroom:track`.

**PWA.** Icons were rasterized from `public/icons/*.svg` with macOS `sips`, so no image dependency was added. `public/sw.js` caches the `/offline` page, the manifest, icons and `/_next/static/*`. It never caches API responses or HTML pages, because pages may contain signed-in content. Offline navigations get `/offline`. The worker is registered from the `/app` layout in production builds only. `beforeinstallprompt` is captured there for the Install button on `/app/me`. iOS gets Share and "Add to Home Screen" instructions. The manifest uses `start_url: /app` and a white background.

**Impact.** Metrics are computed in TypeScript from existing tables, so no migration is required. Totals use head counts. Timestamps are read in pages of 1,000 rows, up to 20 pages. Medians use the latest 1,000 answers. Days follow India Standard Time. Demo rooms and try or bot profiles are excluded, and try profiles are counted separately as `demoSessions`. Results are cached in memory for 60 seconds per instance and sent with `s-maxage=60`, and failures are not cached. "Rooms with activity" means rooms with any doubt, or with a `message_sent` event in the last 7 days. `DEMO_ROOM_ID` moved to the browser-safe `identities.ts`, and `ids.ts` re-exports it.

## D-013 Server text format and group history settings

Date: 19 Nov 2026 | Phase: 9 follow-up

Server-sent `RC:TxtMsg` (demo chatter, the demo mentor's DM reply) rendered as "Unsupported message". The installed `@nexconn/chat` 26.2.1 types say the plain-text body is `text` on the client while the engine field is `content`, mapped internally. The server helpers now send `{ content }`, and the client text parser also accepts `content`, so the seven messages seeded earlier render without re-seeding.

The first live `/try` showed an empty demo room: new group members only see messages sent after they join. In the Nexconn Console (Chat settings, Group Channels) we turned on "Enable pre-join history access by new member", so judges and students who join later see earlier doubts. We also enabled "Restrict chat history access to members", so a crafted client cannot read a room it has not joined, which narrows the sandbox gap noted in D-010.
