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
