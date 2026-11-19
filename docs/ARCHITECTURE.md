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

```mermaid
sequenceDiagram
    participant B as Student
    participant A as DoubtRoom API
    participant S as Supabase
    participant N as Nexconn
    participant L as Model provider
    opt Attach a photo
        B->>A: Request signed upload for room
        A-->>B: Signed upload destination
        B->>S: Upload image
    end
    B->>N: Send dr:doubt with question and unit
    B->>A: POST /api/ta/ask with message reference
    A->>S: Check membership, reserve quota and look up cache
    opt New answer needed
        A->>L: Ask configured provider with deadline and fallback
        L-->>A: Draft answer or provider failure
    end
    A->>N: Post dr:answer as bot_ta
    A->>S: Record result
    A->>N: Update doubt status metadata
    N-->>B: Deliver answer and metadata
```

A provider or quota failure produces a visible status card. The seven-day cache can reuse eligible text answers. Photos take the image-aware provider path.

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

```mermaid
sequenceDiagram
    participant B as Student
    participant N as Nexconn
    participant A as TA route
    B->>N: Send text mentioning bot_ta
    B->>A: POST /api/ta/ask in mention mode
    A->>A: Check actor, membership, mention and quota
    A->>N: Post answer from bot_ta
    N-->>B: Display reply in timeline
```

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
