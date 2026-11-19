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
