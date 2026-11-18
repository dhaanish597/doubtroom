# Nexconn Build Challenge 2026: Winning Strategy and 3-Day Solo Build Plan

Build **DoubtRoom**: exam-season study rooms for Anna University-affiliated colleges, where students drop doubts into subject group chats, an AI TA answers inside the same Nexconn channel as a real bot user, and seniors verify or take the doubt to a 1:1 DM. Ship it as a Next.js PWA on Vercel with a `/try` judge mode, and launch it to your own college tonight-plus-one so the App Key shows real users before judging starts. This is the one idea that hits all three scored criteria and the traction bonus at the same time, and it is buildable solo in roughly 75 hours if you freeze features on Saturday night.

## TL;DR

- **Pick DoubtRoom, Web-first (Next.js 15 + `@nexconn/chat`/`@nexconn/engine` + Nexconn Server API + Supabase + an LLM bot), and nothing else.** It uses group channels, direct channels, an open channel, custom message cards, message history, mentions, read receipts, typing, metadata and server-side bot messages naturally, which is what "real, measurable SDK usage" looks like when judges open your App Key.
- **The field is stronger than you think.** Public repos already show polished entries (SameBall's spoiler-free match chat with a `/try` judge mode, MandiLink's multilingual farmer deal rooms with an AI agent, ClaimIt's live-drop queue with a 200-claim race test). You win on two things they mostly lack: genuine active users from a real community, and a tight, flawless 90-second demo.
- **Blunt odds:** if you execute this plan and get 150+ genuine users, roughly a 20 to 30% chance of a top-5 finish and about 5% for first. Without real traction, drop that to under 10%. The hard feature freeze is **Sat 21 Nov, 22:00 IST**; submit by **Sun 22 Nov, 18:00 IST**.

## Key Findings

1. **Nexconn is RongCloud's global, English-language brand.** RongCloud's own docs say "Starting March 27, 2026, RC is rebranded as Nexconn."\[1\] The Nexconn privacy policy names the operator as RCLOUD GLOBAL PTE. LTD. in Singapore.\[2\] Baidu's encyclopedia entry says RongCloud "launched Nexconn, an English-language communication cloud brand for global developers" between 2025 and 2026, and traces the team back to China Mobile's Fetion project.\[3\] Tracxn lists RongCloud as a Series D company that has raised $22.3M over 4 rounds, with Ying Han as CEO (Tracxn says founded 2014; Baidu says 2015, a minor conflict).\[4\]
2. **The hackathon is a launch vehicle for the Free Chat Plan.** Nexconn announced the 10,000-MAU Free Chat Plan by press release on 22 October 2026, the day before the challenge opened.\[5\] The plan activates when a team sends its first in-app message before 31 December 2026, 23:59 SGT, and includes 500 peak concurrent connections, 10 GB storage and 180 days of searchable history.\[5\]\[6\]\[7\] Will Song, Head of Global Business, framed it as: "A free tier should empower teams to validate their business model, not just verify that an SDK compiles."\[6\] Read that as the judging brief: they want apps that look like real products with real MAU.
3. **Nexconn's own narrative is "AI agents as native chat citizens."** Their OpenClaw blog says bots get "its own unique User ID and a specific is_bot: true flag,"\[8\] and that custom messages let an AI "pop up a quick form in the chat," turning conversation into a workflow.\[8\] An AI TA that posts structured answer cards into group channels is exactly the story their product team is selling.
4. **The Web SDK is real and well-trodden by now.** Install with `npm install @nexconn/engine@latest @nexconn/chat@latest`, connect with `NCEngine.connect({ token })`,\[9\] and use `DirectChannel`, `GroupChannel`, `OpenChannel` and `CommunityChannel` classes.\[9\] Tokens must come from your server: "Never call the Server API to obtain tokens directly from client code."\[9\]\[10\]
5. **Some features are narrower than the marketing implies.** Typing indicators work in direct channels only, rate-limited to one per 6 seconds per channel (Android docs and the ChatUI Web matrix agree).\[11\]\[12\] Group read receipts are request-based. Mentions are client-side only.\[13\] I could not verify a Web presence API, a native reactions API, or how built-in translation is invoked on Web. Design around these gaps instead of betting on them.
6. **Your competitors are AI-native too.** Public repos for this challenge include SameBall, MandiLink, ClaimIt, Floor (live audience Q&A), Pollroom, Vaani Room (multilingual lecture Q&A), DisputeGuard, Accord, Agentic WarRoom, CourtCall, SquadShield, GuardRail Buyer and Obligate.\[14\]\[15\]\[16\]\[17\]\[18\] Several have judge modes, architecture docs and AGENTS.md files. Classroom Q&A is already taken twice (Floor, Vaani Room),\[16\]\[19\] so DoubtRoom must be pitched as peer plus AI study during exams, not lecture Q&A.

## 1. Nexconn: Who They Are and What They Want

**Company.** RongCloud is a Beijing-rooted IM and RTC cloud vendor whose predecessor team came from China Mobile's Fetion project (2007 to 2014). It moved overseas from 2021, delivered overseas projects in 2024, and launched Nexconn as its global brand,\[3\] with the RC docs carrying the 27 March 2026 rebrand notice. The Nexconn about page claims more than ten years of "serving hundreds of thousands of businesses,"\[20\] and the homepage claims 250K+ apps and 99.99% availability.\[21\] Treat those as marketing figures. The flagship testimonial is Jaco, a Middle East social platform with "tens of millions of users,"\[22\] which tells you their sweet spot: social, live streaming, voice rooms and emerging-market networks.\[22\]

**Positioning.** Nexconn's blog is mostly competitor-displacement content: "Sendbird Alternatives in 2026," "5 Top Stream Chat Alternatives," "Best Twilio Alternatives."\[23\]\[24\]\[25\] Their claimed edges:
- 10,000 free MAU versus Sendbird 100, CometChat 100, Stream 1,000 to 2,000, PubNub 200 and Tencent RTC Chat 1,000 (their own comparison table, so treat with care).\[26\]
- Community Channels with sub-channels, roles and persistent history ("Discord-style hierarchy").\[23\]
- Moderation built into the communication layer, claimed across "text, voice, and video in 20+ languages."\[23\]
- Free migration from Sendbird, Stream, CometChat, PubNub, Agora or Twilio.\[5\]\[27\]

**What the hackathon is for.** Developer acquisition for the Free Chat Plan, a gallery of showcase apps, real MAU on their platform, and proof that their AI coding Skill works. The Skill is installed with `npx skills add https://github.com/NexconnAI-Dev/nexconn-skills.git --skill nexconn-chat`,\[28\] and Nexconn says it works with Claude Code, Cursor, Codex, Windsurf and Copilot by reading live docs via llms.txt.\[26\]\[28\]\[29\]

**Who will judge.** The rules say "Nexconn judges." Named Nexconn people in public material include Leo (Product Director, Chat and Call suites),\[30\] Ryan Yang (infrastructure engineer),\[31\] an unnamed AI Product Manager, Will Song (Head of Global Business), and "Lin · Nexconn" answering in the challenge page's chat widget.\[32\] I found no published judge list. Expect product and DevRel people who will open your live URL, check your App Key in their console, and care about (a) does it work, (b) is it a believable product, (c) does it make Nexconn look good.

## 2. Nexconn SDK Technical Deep Dive

### Packages and repos

| Item | Package / repo | Notes |
|---|---|---|
| Web Chat SDK | `@nexconn/engine`, `@nexconn/chat` | TypeScript; `NCEngine`, `DirectChannel`, `GroupChannel`, `OpenChannel`, `CommunityChannel`, `MessageHandler`, `ConnectionStatusHandler`\[9\] |
| Web ChatUI | `nexconn-chatui-web` (Lit web components) | Direct, group and system channels only; works alongside React\[11\]\[28\] |
| Web Call SDK | `@nexconn/call` (`NCCallEngine`) | 1:1 and group (`NCCallType.MULTI`); video up to 16, audio up to 32 participants\[33\] |
| Node server SDK | `@nexconn/server-sdk` (`nexconn-server-sdk-node`) | Auto-signs App-Key / Nonce / Timestamp / Signature, primary/backup domain failover\[34\]\[35\]\[36\] |
| Other server SDKs | Go, Java, Python, PHP | Generated from `nexconn-openapi`\[28\]\[35\]\[37\] |
| Samples | `nexconn-chat-sample-web`, `-ios`, `-android`, `-flutter`\[37\] | |
| Flutter | `ai_nexconn_chat_plugin` (pub.dev) | Wraps `rongcloud_im_wrapper_plugin`\[38\] |
| AI Skill | `nexconn-skills` | Install via `npx skills add`\[29\] |

### Auth and tokens

Your server calls `POST /v4/auth/access-token/issue`\[39\]\[40\] with signed headers: `App-Key`, `Nonce`, `Timestamp` (milliseconds) and `Signature`. Official docs say "All server API requests require signature verification."\[41\] Multiple participant repos describe the signature as `SHA1(AppSecret + Nonce + Timestamp)`,\[14\]\[39\] which matches the 40-hex-character example in the docs.\[14\] Use `@nexconn/server-sdk` so you never hand-roll it. The SG API host seen in docs and repos is `https://api.sg-light-api.com`; use whatever domain your Console shows,\[17\]\[41\] and configure the backup domain. Choose the **Singapore** data center, as it is the closest to Chennai.

### Channel types and limits

| Type | Use in DoubtRoom | Key facts |
|---|---|---|
| Direct | Student to senior mentor DM | Typing indicators work here only\[12\] |
| Group | Subject rooms (one per course code per year) | Default 300 members on Free (ChatUI Web docs);\[11\] a user can join up to 1,000 groups on Free;\[13\] history via `createMessagesQuery` (pageSize 1 to 100);\[9\] 180-day history on the Free Chat Plan\[26\] |
| Open | "Exam Eve" live room the night before each paper | SDK does not save open channel messages; users stop receiving after leaving\[42\] |
| Community | Not needed | Up to 100 community channels per user;\[42\] skip to save time |
| System | Announcements/digest inbox | ChatUI treats as read-only\[11\] |

### Messaging features you can rely on

- Text, image, file and voice messages, plus **custom messages** (Nexconn's blog explicitly pitches custom cards for agents).\[8\]\[43\]
- **Group read receipts:** "send a read receipt request to retrieve read status data from recipients" (Web group overview).\[13\]
- **Group @ mentions:** "Specify @ target users when sending a group message," with no Server API equivalent.\[13\]
- **Targeted group messages:** send to specific members only, and other members do not receive it.\[13\]
- **Message metadata** (key-value tags on existing messages): server endpoint `POST /v4/channel-type/message/metadata/set`.\[34\] ChatUI Web does not render it,\[11\] so build your own UI. Use it for "Verified by senior" and upvote counts.
- **Recall and edit:** `POST /v4/message/delete` and `POST /v4/group-channel/message/update` exist on the server.\[35\] Web client method names were not verified.
- **Bot posting:** `/v4/group-channel/message/send` and `/v4/direct-channel/message/send` let your server post as a bot user. SameBall and MandiLink both do this.\[17\]\[40\]
- **Group admin:** `/v4/group-channel/create`, `/join`, `/leave`, `/user/mute-list/add`, freeze lists.\[34\]\[40\]
- **Webhooks:** configured in Console under **Chat → Chat settings → Webhooks**, subscribing to `message:send` (per the GuardRail Buyer repo).\[18\] A `user:connection_status` webhook reports online/offline/logged out, with offline events "delivered within 5 minutes."\[44\] The exact webhook signature formula is not in any official doc I could reach, so verify it against the docs on day one and dedupe on message ID regardless.

### What I could not verify (do not depend on these)

- A Web client API for presence/online status.
- A native emoji reactions API (use metadata instead).
- How built-in translation is called on Web and whether it needs Console setup (the Web docs sidebar has a "Translation" section; MandiLink skipped it and used its own LLM translation).\[17\]
- Per-endpoint rate limits beyond the 100 requests/second shown for one friend endpoint.\[41\]
- Open issues on `NexconnAI-Dev/hackathon`. The repo exists but showed 0 issues when I checked. Post blockers there early, since replies are promised within 12 hours.

### Free plan limits that matter for traction

10,000 MAU, unlimited messages, 500 peak concurrent connections, 10 GB storage, 180-day history, no card.\[5\]\[7\]\[27\] The Call SDK needs a card to claim free minutes, and "Billing starts as soon as the group call is created successfully."\[33\] That is why calls are optional in this plan.

## 3. Reskilll: Platform and Screening

Reskilll bills itself as "India's leading hackathon platform"\[45\] and runs a long list of sponsor and college events (Health-a-thon 2026 with Koita Foundation and IIT Bombay, Digithon with Samsung SDS, Meta Llama and Google Cloud events, Naval Hackathon). Results on past events have been announced as winner lists on the event page or by email ("Every team has received its result by email" on Health-a-thon).\[46\] I found no published judging transcripts or AI-screening policy from Reskilll. The submission form, however, clearly has automated gates (field length limits, App Key length 8 to 64, a live check that the repo is public). Assume a first-pass filter that drops incomplete or broken submissions before any human sees them.

### Pass-both-screens checklist

| Check | Human judge | Automated/AI screen |
|---|---|---|
| Live HTTPS URL loads in under 3 s on mobile, no login wall for judges | ✔ | ✔ link check |
| `/try` judge mode works alone on one device | ✔ | |
| Repo root URL public, README at top, licence, `.env.example` | ✔ | ✔ public check |
| README states "Built during Nexconn Build Challenge 2026," lists SDK features with file paths | ✔ | ✔ keyword match |
| App Key in PDF matches the app actually serving traffic | ✔ console | ✔ |
| Video link is Public, under 3 min, plays without sign-in | ✔ | ✔ link check |
| PDF under 25 MB, text-selectable (not a scanned image) | ✔ | ✔ parse |
| No secrets in git history (run gitleaks) | ✔ | ✔ |
| Prior-work declaration filled honestly ("all built Nov 18 to 22") | ✔ | ✔ |
| Every form field inside its length limits | | ✔ |

## 4. What Wins Sponsor Chat/RTC Hackathons

- **Agora at DeveloperWeek SF 2018:** GarageBoard, a real-time collaborative whiteboard, won both Agora's challenge and the whole event among 160 teams. Agora's evangelist praised it as a "much-needed tool that marries modern productivity with real-time collaboration."\[47\]\[48\] Lesson: RTC woven into a workflow beats RTC as the product.
- **Agora Voice AI Hackathon (India, finale 4 Oct 2026):** 250 registered, 35 projects submitted, 2 judges, ₹30,000 pool. The winner was Pillion, a hands-free voice co-pilot for riders in "Hindi, English or Hinglish"; second was Sahara, a multilingual voice ecosystem for elderly patients.\[49\] Lessons: completion rate is around 14% of registrations, and India-specific, multilingual, clearly-defined users win.
- **WeMakeDevs × Stream (2022):** 1,810 participants, mandatory Stream usage, a 2-minute demo video, and a separate "Best use of chat API" prize.\[50\] Huge registration, small prize: most registrants never ship.
- **Twitch Streamer Tools Hackathon 2024:** paid three $6,000 bonuses for the apps with the most user authorizations.\[51\] Sponsors that count real users reward distribution, not just code. Nexconn's "they count early users as active users on Nexconn" is the same mechanic.

**Patterns across winners:** a named user with a sharp pain point; the sponsor SDK carrying the core interaction rather than being bolted on; a working live demo the judge can use alone; and, where measured, real usage. **What loses:** generic chat clones, "AI chatbot in a chat app" with no workflow, demo mode that runs without the sponsor's backend (MandiLink's README literally warns its own demo mode does not count),\[17\] and broken links.

## 5. Idea Selection

Scored 1 to 5 on each factor. "Solo feasibility" maps to the 50% completeness criterion, since a smaller, finished scope scores higher than an ambitious broken one.

| # | Idea | Solo feasibility (72h) | Innovation | Business | Real users in 72h | SDK depth | Low field overlap | Total /30 |
|---|---|---|---|---|---|---|---|---|
| A | **DoubtRoom: exam study rooms + AI TA + senior mentors** | 4 | 4 | 4 | 5 | 5 | 4 | **26** |
| B | Hackathon team-finder + team rooms | 4 | 3 | 3 | 3 | 4 | 4 | 21 |
| C | Tamil/English large-font chat for seniors and families | 3 | 4 | 3 | 2 | 4 | 3 | 19 |
| D | Campus symposium live Q&A | 5 | 2 | 3 | 4 | 3 | 1 | 18 |
| E | Hostel/mess complaint and warden dispatch | 4 | 3 | 3 | 3 | 4 | 4 | 21 |
| F | Campus ride-pooling to airport/Central | 4 | 3 | 4 | 2 | 3 | 5 | 21 |
| G | Club coordination with AI recap | 4 | 2 | 2 | 3 | 4 | 3 | 18 |
| H | Blood donor / volunteer dispatch rooms | 3 | 4 | 3 | 2 | 4 | 4 | 20 |
| I | Spoiler-free watch party | 4 | 4 | 3 | 3 | 3 | 0 | 17 |
| J | Placement mock-interview rooms with calls | 2 | 3 | 4 | 3 | 4 | 4 | 20 |

**Why A wins, bluntly.**
- **Timing.** Kalvi Nesan's 22 October 2026 summary of the Anna University Controller of Examinations' 158-page Regulation 2021 timetable puts the end-semester exam period at "18 November 2026 – 21 December 2026" for B.E., B.Tech., B.Arch. and B.Des. across 55 branches (check RMK's own timetable). Exams have already started and run through the whole judging window, which is the only window in which you can plausibly get hundreds of genuine active users in three days.
- **Distribution.** You already sit in class and department WhatsApp groups. Nobody else in the field has your section.
- **SDK depth comes for free.** Subject rooms are group channels, mentor help is direct channels, "Exam Eve" is an open channel, doubts and answers are custom cards, verification is metadata, the AI TA is a server-side bot. No feature is there just to tick a box.
- **The AI is the workflow, not a gimmick.** It answers first, seniors verify, and verified answers become the room's reusable knowledge.
- **Business story.** Every Indian college has the same problem. B2C free for students, B2B for colleges and coaching centres, and Nexconn's 10K MAU free tier covers roughly a mid-sized college.

**The risks of A, and how they are handled.** AI answers can be wrong, so every AI answer is labelled "AI draft, not verified" until a senior taps Verify. Lecture Q&A overlap is avoided by positioning on peer and AI study, not live lectures.

## 6. Solution Design: DoubtRoom

**Problem statement.** During exams, students' doubts get buried in 200-message class WhatsApp groups, seniors who could answer are not in those groups, and nobody knows which answer is right. Doubts asked at 1 a.m. go unanswered.

**Personas.**
- *Priya, 3rd-year CSE:* revising Computer Networks at midnight; wants a fast, trustworthy answer and the diagram explained.
- *Arun, 4th-year mentor:* happy to help juniors for 15 minutes a night, hates being spammed; wants to see only unanswered doubts in his subjects.
- *Class rep:* wants to push "Exam hall changed" and see who has read it.

**Core journeys.**
1. Sign in with Google → pick department, year, section → auto-joined to subject rooms.
2. Post a doubt card (subject unit, text, optional photo of the textbook problem) → the AI TA replies in under 10 s inside the room with a structured answer card → peers upvote → a senior taps Verify, or opens a DM to explain.
3. The night before a paper, everyone in that subject joins "Exam Eve" (open channel) for live panic-hour help; at 07:00 the AI posts a recap of the top verified answers into the subject room.

### Feature → SDK API → rubric mapping

| Feature | Priority | Nexconn API | Rubric hit |
|---|---|---|---|
| Google sign-in, server-issued Nexconn token, connect/reconnect | MUST | `/v4/auth/access-token/issue`, `NCEngine.connect`, `ConnectionStatusHandler` | Completeness |
| Auto-provisioned subject rooms by dept/year/section | MUST | `/v4/group-channel/create`, `/v4/group-channel/join` | Completeness, SDK depth |
| Room chat with history, image upload, unread badges | MUST | `GroupChannel.sendMessage`, `createMessagesQuery`, image message | Completeness, UX |
| Doubt card and AI answer card | MUST | Custom message types (e.g. `DR:Doubt`, `DR:Answer`) | Innovation |
| AI TA bot replies when a doubt is posted or `@TA` is mentioned | MUST | Webhook `message:send` → LLM → `/v4/group-channel/message/send` as bot user; group @ mentions | Innovation, SDK depth |
| Verify and upvote on answers | MUST | `/v4/channel-type/message/metadata/set` | Innovation |
| Student to mentor DM with typing indicator and read receipts | MUST | `DirectChannel`, typing status, read receipts | Completeness, SDK depth |
| Class rep announcement with "seen by N" | MUST | Group read receipt request | Scenario value |
| `/try` judge mode (sandbox user, seeded room, bot live) | MUST | Same as above, per-visitor user | Completeness (50%) |
| `/impact` live stats page | MUST | Webhook-counted messages, active users | Business 20% + traction bonus |
| "Exam Eve" live room | NICE | `OpenChannel` | SDK depth |
| Morning AI recap of verified answers | NICE | Server-sent custom message | Innovation |
| Answers grounded in uploaded notes/syllabus | NICE | (Own pgvector, not Nexconn) | Innovation |
| Tamil / Tanglish answer toggle | NICE | LLM-side; text message `extra.lang` | Scenario value |
| Class rep mute for spam | NICE | `/v4/group-channel/user/mute-list/add` | Viability |
| Voice-note doubts | NICE | Voice message | UX |
| "Study huddle" group audio call | NICE, only after freeze-ready | `@nexconn/call`, `NCCallType.MULTI` | Matches Nexconn's demo; does not count alone |
| Native mobile apps, payments, college admin console, community channels | DEFERRED | | Not scored |

## 7. Architecture

**Platform: Web PWA, not Flutter or React Native.** Judges click a link; any install step costs you completeness points. A PWA installs from the browser on Android, which is what your users carry. You already ship Next.js to Vercel.

**System diagram, in words.**
- Browser (Next.js client, `@nexconn/chat`) ↔ Nexconn Cloud (SG) over the SDK's long connection for all messaging.
- Browser → Next.js API routes on Vercel for: `/api/session` (verifies Supabase session, registers or looks up the Nexconn user, issues token, joins rooms), `/api/doubt` (optional relay), `/api/admin/*`.
- Nexconn → `/api/nexconn/webhook` (`message:send`) → verify signature and nonce, dedupe on message UID in Postgres → if doubt or `@TA`, call the LLM → post the answer card via `/v4/group-channel/message/send` as `bot_ta`.
- Supabase: Auth (Google), Postgres for app data and webhook ledger, Storage for images if you do not use Nexconn's file upload, pgvector for notes.
- LLM provider: called only from the server.

**Exact stack.**
- Next.js 15 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Framer Motion for card entrance only.
- `@nexconn/engine` + `@nexconn/chat` (latest), `@nexconn/server-sdk` on the server.
- Supabase (Auth, Postgres 15 + pgvector, Storage), Drizzle ORM.
- `next-pwa` or a hand-written manifest + service worker.
- PostHog (free cloud tier) for funnels, plus your own `/impact` counters.
- Sentry free tier for client and server errors.
- Vercel Hobby for hosting. Vercel's Functions Limits docs (updated 24 Aug 2026) set the Hobby "Maximum duration" at "300s default and maximum," so a short LLM call will not hit the timeout. The real limits are slow webhook acks and the 4 CPU-hours/month of Active CPU in the Hobby plan, so ack the webhook fast and move the bot worker to a Supabase Edge Function or Cloud Run if CPU use climbs.

**AI model.** Use Gemini Flash-Lite through Google AI Studio as the default (you already have GCP; MandiLink used Gemini for the same kind of job), with Groq-hosted Llama as a hot fallback behind one `answer()` function. imisofts (21 Oct 2026), reading their own AI Studio free project, reports "Gemini 3.8 Flash 5 RPM and 20 requests a day" against "15 RPM, 500 a day" for the Flash-Lite models, with limits per project and reset at midnight Pacific. Other blogs still quote 1,500 RPD, so confirm in your own console. Groq's rate-limits page, as read on 9 Aug 2026, gives llama-3.1-8b-instant "30 requests/minute, 14,400 requests/day, 6,000 tokens/minute, 500,000 tokens/day," and llama-3.3-70b-versatile "1,000 requests/day … 100,000 tokens/day," per organisation. Put a per-user rate limit (e.g. 20 AI answers/day) in front of both. Embeddings: Gemini text embeddings into pgvector. Nexconn also lists its own "AI & LLM Capabilities (Model access)" in llms.txt, but pricing for that is not public, so do not depend on it.

**Data model (Postgres).**
- `users(id, supabase_uid, nexconn_uid, name, dept, year, section, role[student|mentor|rep], created_at)`
- `rooms(id, channel_id, channel_type, course_code, title, dept, year, section)`
- `memberships(user_id, room_id, joined_at)`
- `doubts(msg_uid PK, room_id, asker_id, unit, status[open|ai_answered|verified], answer_msg_uid, verified_by, upvotes)`
- `notes_chunks(id, course_code, content, embedding vector(768))`
- `webhook_events(msg_uid PK, received_at)` for dedupe
- `daily_metrics(date, active_users, messages, doubts, verified)`

**Security.**
- App Secret lives only in Vercel env vars; the client receives only the App Key and a per-user token.\[17\]
- `/api/session` requires a valid Supabase JWT; never mint tokens for arbitrary IDs (SquadShield's README admits this exact gap in its MVP).\[52\]
- Webhook: verify signature, reject stale timestamps, store nonce/UID to block replays.
- Bot prompt treats student text as untrusted input; the bot cannot call admin endpoints.
- Judge mode users are prefixed `try_` and expire after 24 h.
- Run gitleaks before the repo goes public.

**Cost.** Nexconn free, Supabase free, PostHog and Sentry free tiers, LLM free tier or a few hundred rupees. Vercel's Hobby Plan docs include "Function Invocations: First 1,000,000" and "Active CPU: 4 CPU-hrs" with no paid overages (go over and you usually wait 30 days), so expected total is ₹0 to ₹500. Vercel's fair-use guidelines limit Hobby to non-commercial, personal use, so move to Pro before any paid B2B rollout.

## 8. Traction Plan (Genuine Users Only)

**Targets.** Floor: 100 real users who sent at least one message. Good: 200. Standout: 300+ with 50+ verified answers and 5 written testimonials. Every user who connects is counted as an active user on your Nexconn app, and Nexconn's MAU metric is monthly, so users active during judging (Nov 23 to 27) still count.

**Tactics, in order.**
1. **Thu 20:00 seed (10 to 15 friends):** they test, you fix.
2. **Fri 19:00 department launch:** a 30-second screen recording plus a one-line pitch in your section, year and department WhatsApp groups: "Exam doubts at midnight? DoubtRoom answers in 10 seconds and seniors verify. Your CN, OS and DBMS rooms are already set up." Pre-create rooms for the actual papers on your timetable.
3. **Recruit 5 to 8 seniors as mentors** personally, before launch. A verified-by-senior badge is your trust moat.
4. **Sat: expand** to other departments via class reps, the coding club, and your college's ACM/IEEE/GDG chapters. One LinkedIn post with the demo GIF, tagging Nexconn and Reskilll.
5. **Keep it alive Nov 23 to 27:** post the morning recap daily; exams continue through judging.

**Do not:** create fake accounts, script bots to inflate MAU, or ask friends to sign in from multiple accounts. Judges can see the console, and padded numbers look obvious (many users, zero messages).

**Proof to submit.**
- Nexconn Console screenshots: MAU / connected users and message counts (whatever the console exposes; check on Thursday).
- PostHog funnel: visited → signed in → posted doubt → received answer.
- `/impact` page live link: active users, doubts, AI answers, verified answers, median time to first answer.
- 3 to 5 named testimonials with year and department (with consent), plus screenshots of real verified answers.

## 9. Submission Package

### Write-up PDF (6 to 8 pages)
1. One-line pitch + hero screenshot + live URL + **App Key**.
2. The problem (one real WhatsApp-chaos screenshot with names blurred).
3. Who it is for (three personas).
4. How it works (3-step journey diagram).
5. **Nexconn SDK usage table** (the feature → API table above, trimmed).
6. Architecture diagram + security notes (secret server-only, token issuance, webhook verification).
7. Traction: numbers, funnel, testimonials, screenshots.
8. Business model and growth: free for students, ₹/student/year for colleges and coaching centres, expansion to other Anna University colleges; Nexconn's 10K MAU free tier covers early growth.
9. What was built during the challenge (prior-work declaration) and what is next.

### Demo video script (2:30)
- **0:00 to 0:20:** Cold open on a phone. A real doubt posted at "11:48 pm"; the AI TA answer card appears; a senior taps Verify. Caption: "DoubtRoom: exam doubts answered in seconds, verified by seniors. Built on Nexconn Chat."
- **0:20 to 0:45:** The problem: 200-message class group, doubt lost.
- **0:45 to 1:45:** Walkthrough: sign in, auto-joined rooms, doubt card, AI answer, upvote, verify, DM to mentor with typing and read receipts, class rep announcement "seen by 42," Exam Eve room.
- **1:45 to 2:10:** Under the hood: 15-second architecture shot, SDK feature list overlay, App Key shown in Nexconn console.
- **2:10 to 2:30:** Traction: `/impact` live numbers, two testimonial quotes, `/try` URL on screen.
Record at 1080p, phone in a browser frame, real data, voice-over in clear English.

### README structure
Title + one-liner + live link + `/try` link + video link → GIF → Problem → Features → **Nexconn integration table with file paths** → Architecture diagram (Mermaid) → Run locally (5 commands, `.env.example`) → Deploy → Security → Traction → Prior-work declaration → AI tools disclosure (Claude Code + Nexconn Skill) → Licence (MIT).

### Form field drafts
- **Project name:** DoubtRoom: exam doubts answered by AI, verified by seniors
- **Summary:** "DoubtRoom gives every subject in a college its own Nexconn group channel for exam season. Students post a doubt card with text or a photo; an AI TA, running as a real Nexconn bot user, answers inside the room within seconds; senior mentors verify the answer or take it to a 1:1 DM. Class reps push announcements with read receipts, and an Exam Eve live room opens the night before each paper. Launched at R.M.K. Engineering College during the challenge with [N] real students."
- **Packages used:** `@nexconn/engine`, `@nexconn/chat`, `@nexconn/server-sdk`, (`@nexconn/call` if shipped), next, @supabase/supabase-js, drizzle-orm, posthog-js.
- **SDK features used:** "Group channels (auto-provisioned per subject via Server API), direct channels (student to mentor DMs), open channel (Exam Eve live room), custom message types for doubt and answer cards, image messages, message history, group @mentions, typing indicators in DMs, read receipts (direct and group), message metadata for verify/upvote, server-side bot messages via Server API, message:send webhooks, group mute, token issuance via Server API."

### Pre-submission QA (Sunday 15:00)
Fresh incognito on Android Chrome and desktop: sign in, post doubt, AI reply, verify, DM, announcement receipt, `/try` from zero, reconnect after airplane mode, every README link, video link logged out, PDF opens, App Key in PDF equals Vercel env value, repo public, no secrets.

### Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token/signature errors block day one | Medium | Critical | Use `@nexconn/server-sdk`; error 1004 means wrong App Secret (CourtCall repo);\[53\] post on GitHub issues by Thu 09:00 if stuck |
| Webhook not firing or unverifiable | Medium | High | Client relay fallback: client calls `/api/doubt` after send, server dedupes on message UID (GuardRail pattern)\[18\] |
| LLM quota exhausted mid-launch | Medium | High | Two providers behind one function; per-user daily cap; cached answers for repeated doubts |
| Vercel Hobby limits on bot (300 s max duration is ample; 4 CPU-hrs/month Active CPU is the real cap) | Medium | Medium | Ack webhooks fast, short prompts, low max tokens; move worker to Supabase Edge Function if needed |
| Low adoption | Medium | High | Pre-recruit mentors; launch Friday evening, not Sunday; rooms pre-built for real papers |
| Wrong AI answer embarrasses you | High | Medium | "AI draft" label until verified; grounded answers from notes; report button |
| Demo breaks during judging | Low | Critical | `/try` sandbox isolated from real rooms; uptime check; no deploys after submission except hotfixes |
| Deadline timezone confusion | Medium | Critical | Public page says 23:59 AoE,\[32\] deployed code says IST. Treat **22 Nov 23:59 IST** as binding; submit by 18:00 IST |
| Exam timing differs from assumption | Low | Medium | Pitch also works for internal tests and lab viva prep |
| Call SDK requires card / billing | Medium | Low | Optional; only after freeze-ready; skip if any doubt |

## 10. Build Schedule (IST)

**Minimum winning slice, in order:** (1) sign-in + token + live group room deployed; (2) AI TA answering in the room; (3) `/try` judge mode; (4) DMs with typing and receipts; (5) doubt/answer cards + verify; (6) real users; (7) grounding, recap, Exam Eve; (8) call huddle. If time runs out, stop at whatever number you reached and polish that.

| When | Block | Exit criterion |
|---|---|---|
| **Wed 18, 21:30 to 22:30** | Console: create app in SG, copy App Key/Secret, send first message (activates Free Chat Plan). Install Nexconn Skill; scaffold Next.js + Supabase | Repo created, env set |
| Wed 22:30 to 01:30 | `/api/session` token route, `NCEngine.connect`, create one group channel, send/receive between two browsers, deploy to Vercel | Two phones chatting on the live URL |
| **Thu 19, 09:00 to 12:00** | Google auth, onboarding (dept/year/section), server auto-join to subject rooms | New user lands in their rooms |
| Thu 12:00 to 15:00 | Room UI: message list, history paging, image upload, unread, empty/loading states | Feels like a real app |
| Thu 15:00 to 18:00 | Bot user, webhook + relay fallback, LLM call, answer card via Server API, `@TA` | AI reply in under 10 s |
| Thu 18:00 to 20:00 | DMs, typing, read receipts, mentor role | DM flow complete |
| Thu 20:00 to 22:00 | Phone testing, soft launch to 10 to 15 friends | Bug list |
| **Fri 20, 09:00 to 12:00** | Doubt card, verify/upvote via metadata, doubt status filter (open/AI/verified) | Core loop done |
| Fri 12:00 to 15:00 | Notes upload → pgvector grounding; Tamil/Tanglish toggle | Grounded answers |
| Fri 15:00 to 17:00 | `/try` judge mode, PWA manifest, PostHog, `/impact` | Judge can try alone |
| Fri 17:00 to 19:00 | Polish: error states, reconnect banner, mobile layout | |
| Fri 19:00 | **Department launch** + mentor onboarding | First 50 users |
| Fri 21:00 to 24:00 | Live bug fixing | |
| **Sat 21, 09:00 to 12:00** | Morning recap, class rep announcements with receipts, mute, Exam Eve open channel | |
| Sat 12:00 to 14:00 | Optional call huddle, only if everything above is green | |
| Sat 14:00 to 18:00 | Traction round 2 (other departments, clubs, LinkedIn); collect testimonials | 150+ users |
| Sat 18:00 to 22:00 | Bug bash on 3 devices | |
| **Sat 22:00** | **HARD FEATURE FREEZE** | |
| Sat 22:00 to 01:00 | README, Mermaid diagram, screen captures | |
| **Sun 22, 09:00 to 12:00** | Record and edit video, upload as Public | |
| Sun 12:00 to 15:00 | Write-up PDF | |
| Sun 15:00 to 17:00 | QA checklist, traction screenshots, fill form | |
| **Sun 18:00** | **SUBMIT** | |
| Sun 18:00 to 23:59 | Buffer only; edit submission if needed | |

Sleep at least 6 hours a night. A tired solo dev at 3 a.m. breaks auth, and breaking auth on Saturday loses the hackathon.

## 11. Honest Win-Probability Assessment

**Field size.** No registration count is published for this challenge. The comparable India-based Agora Voice AI Hackathon converted 250 registrations into 35 submissions; WeMakeDevs × Stream drew 1,810 participants.\[49\]\[50\] With a $5,000 pool, a free SDK and Reskilll's student reach, my estimate is 300 to 1,500 registrations and **40 to 150 complete submissions**. That is an inference, not a sourced number.

**Quality of the field.** At least a dozen public repos are already strong: judge modes, architecture docs, race-condition tests, AI agents, multilingual support. Expect the top 10 to be tight on completeness. Most will be thin on real users, because building is easier than distributing.

**Odds with this plan executed well:**
- Top 5: **20 to 30%** with 150+ genuine active users; **under 10%** with fewer than 30.
- First place: **about 5%**. SameBall-level polish plus traction would be needed.
- Disqualification risk: near zero if the App Key shows real traffic and the links work.

**Where you can actually beat them:** real users from an exam-season community (20% business plus "significant bonus"), a demo that never breaks (50%), and an AI-agent-in-chat story that mirrors Nexconn's own blog (30%). Do not chase extra features after Saturday 22:00. The winning move from here is a finished, boringly reliable product in the hands of 200 classmates.

## Caveats

- docs.nexconn.ai blocks automated fetching; SDK details here come from search snippets of official docs, official GitHub READMEs and participant repos. Confirm method names in the live docs (or via the Nexconn Skill) before coding.
- The signature formula and webhook verification details come partly from participant repos, not official specs.
- Nexconn's competitor comparisons and scale claims are vendor marketing.
- Exam dates, field size and odds are estimates; adjust if your college timetable differs.
- The deadline: the public page says AoE, the user's extraction of deployed code says IST. IST is earlier, so planning to IST is the safe choice.

## Sources

1. [Integrate IMLib](https://docs.rongcloud.io/guides/client-setup/client-setup-imlib)
2. [Service Level Agreement - Nexconn Instant Messaging Cloud](https://www.nexconn.ai/privacy)
3. [RongCloud AICP Intelligent Communication Platform（A global intelligent communication cloud platform launched by RongCloud）\_Baiduwiki](https://baike.baidu.com/en/item/RongCloud%20AICP%20Intelligent%20Communication%20Platform/6661466)
4. [RongCloud - 2026 Company Profile, Team, Funding & Competitors - Tracxn](https://tracxn.com/d/companies/rongcloud/__5PS6lCARIII2GyCIz9S6JNfKcHmh_RZgiEiApzp6CY8)
5. [Nexconn Launches Free Chat Plan for Up to 10,000 MAU With Full Pro Features and Additional Cloud Discounts](https://www.manilatimes.net/2026/10/22/tmt-newswire/media-outreach-newswire/nexconn-launches-free-chat-plan-for-up-to-10000-mau-with-full-pro-features-and-additional-cloud-discounts/2451544/amp)
6. [Nexconn Launches Free Chat Plan for Up to 10,000 MAU With Full Pro Features and Additional Cloud Discounts](https://www.voiceofalexandria.com/news/national_business_news/nexconn-launches-free-chat-plan-for-up-to-10-000-mau-with-full-pro-features/article_de6c3d3d-0fdc-5058-bc84-4356ac2b0d24.html)
7. [Nexconn Launches Free Chat Plan for Up to 10,000 MAU With Full Pro Features and Additional Cloud Discounts](https://baytobaynews.com/stories/nexconn-launches-free-chat-plan-for-up-to-10000-mau-with-full-pro-features-and-additional-cloud,356583)
8. [What is OpenClaw? Powering Action-Oriented Chat via Nexconn APIs\<!-- --\> - Nexconn Blog](https://www.nexconn.ai/blog/what-is-openclaw)
9. [Send your first message](https://docs.nexconn.ai/chatsdk-web)
10. [Send your first message](https://docs.nexconn.ai/chatsdk-ios)
11. [ChatUI for Web](https://docs.nexconn.ai/chatui-web)
12. [Send typing indicators](https://docs.nexconn.ai/chatsdk-android/message/typing-status)
13. [Group channel overview](https://docs.nexconn.ai/chatsdk-web/group-channel/overview)
14. [GitHub - Digitalspy12/AgenticWarRoom: Colabration War Room with AI Agent and DEV Teams · GitHub](https://github.com/Digitalspy12/AgenticWarRoom)
15. [GitHub - drnaz-tech/Obligate-: OBLIGATE is a cooperative mystery-solving web application where two players receive different clues, investigate shared case files, and collaborate through real-time chat to uncover the truth. Built for the NexCon Challenge using Nexon Chat SDK. · GitHub](https://github.com/drnaz-tech/Obligate-)
16. [GitHub - Jiteshhh08/NEXCONN · GitHub](https://github.com/Jiteshhh08/NEXCONN)
17. [GitHub - teamvidyut/mandilink](https://github.com/teamvidyut/mandilink)
18. [GitHub - mubudot/guardrail-buyer-nexconn: GuardRail Buyer, Nexconn edition: approve AI purchases in a Nexconn chat room (Nexconn Build Challenge 2026) · GitHub](https://github.com/mubudot/guardrail-buyer-nexconn)
19. [GitHub - Joe-Simo/floor: Questions from the room, best first. Live audience Q&A on Nexconn. · GitHub](https://github.com/Joe-Simo/floor)
20. [Company Profile - Nexconn Instant Messaging Cloud](https://www.rongcloud.io/about)
21. [Nexconn](https://www.rongcloud.io/)
22. [Nexconn](https://www.nexconn.ai/)
23. [Sendbird Alternatives in 2026: Why Engineering Teams Are Moving On\<!-- --\> - Nexconn Blog](https://www.nexconn.ai/blog/sendbird-alternatives-2026)
24. [Nexconn-Chat SDK & API For Messaging](https://www.nexconn.ai/product/chat)
25. [5 Top Stream Chat Alternatives: Best Chat APIs\<!-- --\> - Nexconn Blog](https://www.nexconn.ai/blog/best-stream-chat-alternatives-2026)
26. [Free Chat API & Messaging SDK: Production-Ready with 10K MAU/mo\<!-- --\> - Nexconn Blog](https://www.nexconn.ai/blog/free-chat-sdk)
27. [Nexconn Launches Free Chat Plan for Up to 10,000 MAU With Full Pro Features and Additional Cloud Discounts - European Business Magazine](https://europeanbusinessmagazine.com/nexconn-launches-free-chat-plan-for-up-to-10000-mau-with-full-pro-features-and-additional-cloud-discounts)
28. [NexconnAI · GitHub](https://github.com/NexConnAI-Dev)
29. [Nexconn Skills — Claude Updates](https://mortaf3.com/posts/nexconn-skills-yxk88)
30. [Easily Add Chat to your iOS App with the Nexconn Swift Chat SDK\<!-- --\> - Nexconn Blog](https://www.nexconn.ai/blog/easily-add-chat-to-your-ios-app-with-the-nexconn-swift-chat-sdk)
31. [Blog](https://www.nexconn.ai/blog)
32. [Nexconn Build Challenge 2026 · Build with the Nexconn Chat SDK · \$5,000](https://reskilll.com/hack/nexconn/)
33. [Make your first call](https://docs.nexconn.ai/callsdk-web)
34. [GitHub - NexconnAI-Dev/nexconn-server-sdk-node: Nexconn Server SDK for Node.js — integrate the Chat API from your backend with TypeScript client models. · GitHub](https://github.com/NexconnAI-Dev/nexconn-server-sdk-node)
35. [GitHub - NexconnAI-Dev/nexconn-server-sdk-java: Nexconn Server SDK for Java — integrate the Chat API from your backend with a typed client and generated models. · GitHub](https://github.com/NexconnAI-Dev/nexconn-server-sdk-java)
36. [GitHub - NexconnAI-Dev/nexconn-server-sdk-go: Nexconn Server SDK for Go — integrate the Chat API from your backend with typed client models and signed requests. · GitHub](https://github.com/NexconnAI-Dev/nexconn-server-sdk-go)
37. [free-chat-api · GitHub Topics · GitHub](https://github.com/topics/free-chat-api)
38. [ai\_nexconn\_chat\_plugin](https://pub.dev/packages/ai_nexconn_chat_plugin)
39. [GitHub - sohail12345621/accord-marketplace: Conversational marketplace platform that turns buyer-seller agreements into verifiable transaction commitments and evidence-driven dispute resolution. · GitHub](https://github.com/sohail12345621/accord-marketplace)
40. [GitHub - Fushiguro6286/SameBall: The group chat that never spoils the match. Nexconn Build Challenge 2026. · GitHub](https://github.com/Fushiguro6286/SameBall)
41. [Add a friend - Nexconn-Chat SDK & API For Messaging](http://docs.nexconn.ai/platform-chat-api/user/friend-profile/add-friend)
42. [Group channel overview](https://docs.nexconn.ai/chatsdk-ios/group-channels/overview)
43. [In-app Chat API & SDK](https://www.nexconn.ai/product/chat#chat)
44. [User connection status](https://docs.nexconn.ai/platform-chat-api/webhook/events/user/connection-status)
45. [Reskilll - India's #1 Hackathon Platform](https://reskilll.com/)
46. [Health-a-thon 2026 · India's First Doctor × Technology Health Hackathon](https://healthathon.reskilll.com/)
47. [AND THE WINNER IS: Agora Announces Winner of DeveloperWeek SF Hackathon](https://medium.com/agora-io/pr-agora-announces-winner-of-developerweek-sf-hackathon-9bc2c55e2812)
48. [Live Streaming Provider Agora Announces Winner of DeveloperWeek SF Hackathon](https://www.prnewswire.com/news-releases/live-streaming-provider-agora-announces-winner-of-developerweek-sf-hackathon-300596437.html)
49. [Agora Voice AI Hackathon — AI Mobile Coders](https://www.aimobilecoders.com/hackathons/agora-voice-ai-hackathon)
50. [WeMakeDevs \<\> Stream Hackathon: If you're looking to learn new skills, meet interesting people, and push yourself to create something truly innovative, then you should definitely taking part in our hackathon! - Devpost](https://wemakedevs-stream.devpost.com/)
51. [Streamer Tools Hackathon 2024 - Winners and Runner Ups - Announcements - Twitch Developer Forums](https://discuss.dev.twitch.com/t/streamer-tools-hackathon-2024-winners-and-runner-ups/61823)
52. [GitHub - shraddhakolate30-maker/SQUADSHIELD: Gaming squad communication safety platform with real-time Nexconn chat, smart moderation, player safety controls, and tactical callouts. · GitHub](https://github.com/shraddhakolate30-maker/SQUADSHIELD)
53. [GitHub - Urjagajera/CourtCall · GitHub](https://github.com/Urjagajera/CourtCall)
