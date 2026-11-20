# DoubtRoom architecture

The browser owns the Nexconn connection. The Next.js server controls room enrolment, model calls, moderation and persistence. Each diagram follows an action from its UI to its durable record or chat message.

## Connect a browser

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Session route
    participant D as Supabase
    participant N as Nexconn
    B->>A: GET /api/session with session cookie
    A->>D: Resolve actor and profile
    opt Token expired, missing or refresh requested
        A->>N: issueAccessToken for the actor
        N-->>A: Access token
    end
    A->>D: Record session and cache token
    A-->>B: App Key, profile, ID and token
    B->>N: Initialize, register custom types and connect
    opt Token refresh needed
        B->>A: GET /api/session?refresh=1
        B->>N: Retry with fresh token
    end
```

## Onboard a student

```mermaid
sequenceDiagram
    participant B as Onboarding form
    participant A as Onboarding route
    participant D as Supabase
    participant N as Nexconn
    B->>A: Department, year, section and optional role code
    A->>D: Resolve actor, catalog and role
    loop Subject, section and mentor course rooms
        A->>N: Ensure group exists and join user
    end
    A->>D: Finalize enrolment and room memberships
    A-->>B: Open room list
```

## Ask a doubt

Two triggers lead to the same work. Nexconn's `message:send` webhook is the primary path. The browser relay (`/api/ta/ask`) is a fallback. Both call `acceptTaRequest` ([src/lib/ta/accept.ts](../src/lib/ta/accept.ts)), which checks room membership and the unit and photo URL, then calls the `reserve_ta_request` database function. That function reserves the message ID, so a doubt is answered once even when both triggers fire.

```mermaid
sequenceDiagram
    participant B as Student
    participant N as Nexconn
    participant W as POST /api/nexconn/webhook
    participant R as POST /api/ta/ask (relay)
    participant S as Supabase
    participant L as Model provider
    opt Attach a photo
        B->>S: Upload image through a signed URL
    end
    B->>N: Send dr:doubt (or text mentioning @TA)
    par Webhook, primary
        N->>W: message:send with Signature
        W->>W: Check AppKey, sha1(AppSecret+Nonce+Timestamp) and 5 min skew
        W-->>N: 200 at once, work continues in after()
        W->>S: Record message in webhook_events (duplicates dropped)
        W->>S: acceptTaRequest, then reserve_ta_request
    and Browser relay, fallback
        B->>R: POST with message reference
        R->>S: acceptTaRequest, then reserve_ta_request
    end
    Note over S: reserve_ta_request lets one caller through per message ID and applies quotas
    opt Reserved and not cached
        S->>S: Look up notes (pgvector) and the 7-day answer cache
        S->>L: answerDoubt with deadline and provider fallback
        L-->>S: Draft answer or provider failure
    end
    S->>N: Post dr:answer as bot_ta
    S->>S: Record answer (finish_ta_answer or finish_grounded_answer)
    S->>N: Update doubt status metadata
    N-->>B: Deliver answer and metadata
```

Model providers: text doubts, @TA mentions, Exam Eve answers and recaps go to Groq `openai/gpt-oss-120b` (`LLM_PRIMARY=groq`). A photo doubt always tries Gemini `gemini-3.5-flash-lite` first, and Gemini is the fallback for text. Notes are embedded with `gemini-embedding-2` for grounded answers with [S#] sources. See D-016 and D-017 in [DECISIONS.md](DECISIONS.md) and [src/lib/ai/answer.ts](../src/lib/ai/answer.ts).

A provider or quota failure produces a visible status card. The seven-day cache can reuse eligible text answers. Photos take the image-aware provider path. Nexconn's signature does not cover the body, so membership, quota and message-ID checks bound any replayed delivery (D-018).

## Sync rooms

```mermaid
sequenceDiagram
    participant A as Admin (/admin)
    participant R as POST /api/admin/sync-rooms
    participant S as Supabase
    participant N as Nexconn
    A->>R: Sync rooms
    R->>R: Check admin, origin and 45 s budget
    R->>S: Upsert catalog courses and rooms
    R->>N: Find existing groups, create missing ones (owner bot_ta)
    R->>S: Read real members of catalog rooms
    R->>N: Join members whose Nexconn membership is missing
    R-->>A: created, joined, deferred
```

The job lives in [src/lib/rooms/sync.ts](../src/lib/rooms/sync.ts). It is idempotent, joins up to 100 members per batch call, and returns `deferred` when the time budget ends, so the admin runs it again until `deferred` is 0. Demo rooms and try visitors are skipped.

## Verify or upvote

```mermaid
sequenceDiagram
    participant B as Room member
    participant A as Answer API
    participant D as Postgres
    participant N as Nexconn
    B->>A: Verify or toggle vote on answer ID
    A->>D: Check actor, room and course role
    A->>D: Apply vote or verification transaction
    A->>N: Update group message metadata
    N-->>B: Metadata event refreshes card
```

The mentor inbox and room board use the stored answers. The chat card uses message metadata so a reader can see the result without opening the board.

## Mention the TA in normal chat

A text message that mentions `bot_ta` follows the same two triggers as a doubt (webhook first, browser relay as fallback) in `mention` mode. `acceptTaRequest` checks the actor, membership, the mention and the quota. The answer is posted by `bot_ta` and shows in the timeline.

## Read an announcement

```mermaid
sequenceDiagram
    participant R as Class rep
    participant N as Nexconn group
    participant A as Announcement API
    participant B as Reader
    R->>N: Send dr:announce requesting receipts
    R->>A: Record announcement with room and message ID
    A->>A: Check rep role, membership and mute status
    N-->>B: Display announcement
    B->>N: Acknowledge after visible dwell
    N-->>R: Receipt counts
    R->>N: Query counts and reader list when reopened
```

## Enter the judge sandbox

```mermaid
sequenceDiagram
    participant B as Visitor
    participant A as Try API
    participant D as Supabase
    participant N as Nexconn
    B->>A: POST /api/try
    A->>D: Check rate limit and demo readiness
    A->>N: Register temporary identity and join demo_cn
    A->>D: Save try profile and membership
    A-->>B: Signed 24-hour cookie
    B->>N: Connect to shared demo room
    B->>N: Send direct message to demo mentor
    B->>A: Request demo mentor response
    A->>N: Deliver scripted reply from demo_mentor
```

## Exam Eve and the morning recap

Vercel schedules `/api/cron/recap` at 01:30 UTC (07:00 IST). The job provisions upcoming Exam Eve open channels and selects recap candidates from the preceding 24 hours. Within each room, it ranks verified answers first, then by upvotes, and selects at most five distinct doubts. A room/day claim coordinates overlapping invocations. [Selection rules](../src/lib/recap/rules.ts) · [Job](../src/lib/recap/server.ts) · [Schedule](../vercel.json)
