# DoubtRoom

Exam-season study rooms for Anna University colleges. Students post doubts in subject group
chats, an AI TA (Nexconn bot user `bot_ta`) answers inside the room, seniors verify.
Built for the Nexconn Build Challenge 2026. Deadline Sun 22 Nov 2026 23:59 IST.

## Source of truth
- docs/PLAN.md is the plan. Read the section a task points to before coding.
- docs/STATUS.md is the current state. Read it at the start of every session.
- docs/DECISIONS.md records every deviation from the plan. Add an entry when you deviate.
- If installed SDK code (node_modules/@nexconn/**/*.d.ts or the server SDK) disagrees with the
  plan, the installed code wins. Record the conflict in DECISIONS.md.

## Stack
Next.js (App Router, TS strict), Tailwind v4, shadcn/ui, zustand, zod, Supabase (auth, Postgres,
pgvector, storage), @nexconn/engine + @nexconn/chat pinned to 26.2.1, @nexconn/server-sdk v0.1.2
(git tag), @google/genai, Groq via OpenAI-compatible fetch, PostHog, Vercel.

## Commands
- pnpm dev / pnpm build / pnpm lint / pnpm typecheck / pnpm test
- pnpm seed  (runs scripts/seed.ts against the env in .env.local)

## Hard rules
1. Never put NEXCONN_APP_SECRET, SUPABASE_SERVICE_ROLE_KEY or LLM keys in client code or NEXT_PUBLIC_ vars.
2. The Nexconn client SDK is browser-only. Import it only in client components inside effects
   or via dynamic import with ssr:false. Initialize once. registerCustomMessages right after initialize.
3. Never guess Nexconn method names. Use docs/PLAN.md Section 4, then grep the installed .d.ts.
   The nexconn-chat skill in .claude/skills can fetch live docs.
4. Tokens are only issued by /api/session for the authenticated actor. Never accept a userId from the client.
5. Every mutating API route: getActor(), then authorization, then zod validation.
6. Custom message types and payloads live in src/lib/nexconn/messages.ts only.
7. Mobile first (360 px wide). Every screen needs loading, empty and error states.
8. Do not add dependencies outside the plan without noting why in DECISIONS.md.
9. At the end of a phase: pnpm typecheck && pnpm lint && pnpm build must pass, update
   docs/STATUS.md, commit with message "phase N: <summary>", push, tag phase-N.
10. Test with two different users. The same user connected twice gets kicked offline.
11. UI copy: short, plain English, friendly. No lorem ipsum anywhere.
