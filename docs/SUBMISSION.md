# Reskilll submission drafts

Paste-ready text for each form field (PLAN section 15.3), checked against the app as of 20 Nov 2026. Replace every `[N]` and `[link]` before submitting.

## Project name

DoubtRoom: exam doubts answered by AI, verified by seniors

## Summary

DoubtRoom gives each subject at an Anna University college its own Nexconn group channel for exam season. Students post a doubt card with text or a photo, or mention @TA. An AI teaching assistant, running as a Nexconn bot user, answers in the room. Text doubts use Groq gpt-oss-120b. Photos are read by Gemini, and answers can cite uploaded course notes as [S1], [S2]. Senior mentors verify an answer or take it to a 1:1 direct chat with typing status and read receipts. Class reps post announcements with group read receipts (the card falls back to "Delivered to N" if the plan does not expose receipts). An Exam Eve open channel opens before each paper, and a morning recap posts eligible answers. Judges can try a 24-hour sandbox at /try without signing in. Live figures are at /impact: [N] real students so far.

## Packages used

Chat SDK (`@nexconn/engine` and `@nexconn/chat`, both 26.2.1) and the Nexconn Server SDK (`@nexconn/server-sdk` v0.1.2). No Call SDK.

## App Key

[App Key from the Nexconn Console. Must match the PDF and the Vercel value.]

## SDK features used

- Group channels created per subject and section through the Server SDK
- Direct channels for student to mentor chats, with typing status and read receipts
- Open channel for the Exam Eve room
- Custom message types for doubt, answer, announcement and recap cards
- Bot messages sent from `bot_ta` through the Server SDK
- Message metadata for live upvotes and verification
- Image messages, message history paging, group @mentions
- Group read receipts for announcements, with a "Delivered to N" fallback
- Online-status subscription, with server `getUserConnectionStatus` polling as a fallback
- Group mute list and profanity list
- Token issuance through the Server SDK
- `message:send` webhook (src/app/api/nexconn/webhook/route.ts) that triggers the TA, with a client relay fallback
- Connection status handler and history backfill on reconnect

## App URL

https://doubtroom-ochre.vercel.app

## Repo

https://github.com/dhaanish597/doubtroom

## Demo video

[link]

## Traction proof

https://doubtroom-ochre.vercel.app/impact

## Active users

[N] (read from /impact or the Nexconn Console, whichever is lower)

## Prior work

No, built for this challenge. Open-source libraries are listed in package.json.

## Do not claim

- Message recall or edit
- Targeted group messages
- Streaming answers
- Voice notes
- Calls or huddles (no `@nexconn/call`)
- Sentry
- Drizzle ORM (the app uses supabase-js)
- Community channels
- Any user count that is not on /impact
- Group read receipts or presence as verified live, until the checks below are done

## Verify before submitting

- [ ] Group read receipts: send an announcement with 3 real accounts and confirm "Seen by X of Y" (otherwise word it as the fallback)
- [ ] Presence dot for a mentor changes when the mentor goes online and offline
- [ ] Google sign-in works on production
- [ ] App Key in the PDF matches the Vercel value
- [ ] Regenerate public/downloads/doubtroom.pdf and doubtroom-demo.mp4, which predate the 20 Nov changes
- [ ] Make the GitHub repo public
- [ ] Active users and /impact figures match
