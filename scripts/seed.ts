import catalog from "../data/catalog.json";
import { seedProfanityWords } from "./seed-moderation";
import { TA_AVATAR } from "@/lib/nexconn/bot-avatar";
import { BOT_IDS, DEMO_ROOM_ID } from "@/lib/nexconn/ids";
import { issueToken, joinGroup, NexconnError } from "@/lib/nexconn/server";
import type { RoomDefinition } from "@/lib/rooms/definitions";
import { provisionRooms } from "@/lib/rooms/provision";
import { syncCatalogRooms } from "@/lib/rooms/sync";
import { catalogRooms } from "@/lib/rooms/sync-plan";
import { adminSupabase } from "@/lib/supabase/admin";
import { readFile } from "node:fs/promises";
import { DEMO_NOTE_TITLE } from "@/lib/ai/demo-note";
import { ingestPdf } from "@/lib/ai/ingest";
import { loadDemoScript, seedDemoConversation } from "./demo-seed";

async function seed() {
  console.info(await seedProfanityWords());
  const cohorts = catalog.depts.flatMap(({ dept, years }) => years.map((year) => ({ dept, ...year })));
  const courses = cohorts.flatMap(({ dept, year, semester, courses }) =>
    courses.map(({ code, title, examDate, units }) => ({ code, title, dept, year, semester, exam_date: examDate, units })),
  );
  if (!courses.length || courses.some(({ code, units }) => code === "EXAMPLE" || units.length !== 5)) {
    throw new Error("The catalog needs real courses with five units each");
  }

  const db = adminSupabase();
  const bots: { nexconn_user_id: string; display_name: string; avatar_url: string | null; dept: string | null; year: number | null }[] = [
    { nexconn_user_id: BOT_IDS.TA, display_name: "DoubtRoom TA", avatar_url: TA_AVATAR, dept: null, year: null },
    { nexconn_user_id: BOT_IDS.DEMO_MENTOR, display_name: "Arun (IV CSE, demo)", avatar_url: null, dept: "CSE", year: 4 },
    { nexconn_user_id: BOT_IDS.DEMO_PRIYA, display_name: "Priya (III CSE, demo)", avatar_url: null, dept: "CSE", year: 3 },
  ];

  const { data: existing, error: profileError } = await db.from("profiles").select("nexconn_user_id,nexconn_token")
    .in("nexconn_user_id", bots.map(({ nexconn_user_id }) => nexconn_user_id));
  if (profileError) throw profileError;
  const tokens = new Map<string, string | null>(existing.map(({ nexconn_user_id, nexconn_token }) => [nexconn_user_id, nexconn_token]));
  const profileIds = new Map<string, string>();
  for (const bot of bots) {
    const cached = tokens.get(bot.nexconn_user_id);
    const token = cached ?? await issueToken(bot.nexconn_user_id, bot.display_name, bot.avatar_url ?? undefined);
    const { data, error } = await db.from("profiles").upsert({
      ...bot, college: catalog.college, role: "bot", nexconn_token: token,
      ...(cached ? {} : { token_issued_at: new Date().toISOString() }),
    }, { onConflict: "nexconn_user_id" }).select("id").single<{ id: string }>();
    if (error) throw error;
    profileIds.set(bot.nexconn_user_id, data.id);
  }

  // The demo room borrows the real CN course so the composer shows units and "Ask a senior" appears.
  const demoScript = loadDemoScript();
  if (demoScript.roomId !== DEMO_ROOM_ID) throw new Error(`data/demo-seed.json must target ${DEMO_ROOM_ID}`);
  const demoCourse = courses.some(({ code }) => code === demoScript.courseCode) ? demoScript.courseCode : null;
  const demo: RoomDefinition = {
    id: DEMO_ROOM_ID, kind: "demo", title: "Demo: Computer Networks",
    course_code: demoCourse, dept: null, year: null, section: null,
  };
  const catalogRoomList = catalogRooms(catalog);
  const sections = catalogRoomList.filter(({ kind }) => kind === "section");
  const rooms = [...catalogRoomList, demo];
  // Courses and catalog rooms go through the same function as POST /api/admin/sync-rooms.
  await syncCatalogRooms({ ownerRegistered: true, syncMembers: false });
  await provisionRooms([demo], true);
  await joinGroup(demo.id, [BOT_IDS.DEMO_MENTOR, BOT_IDS.DEMO_PRIYA]);

  const ownerId = profileIds.get(BOT_IDS.TA);
  const membership = [
    ...rooms.map(({ id }) => ({ room_id: id, profile_id: ownerId })),
    ...[BOT_IDS.DEMO_MENTOR, BOT_IDS.DEMO_PRIYA].map((id) => ({ room_id: demo.id, profile_id: profileIds.get(id) })),
  ];
  const { error: memberError } = await db.from("room_members").upsert(membership, { ignoreDuplicates: true });
  if (memberError) throw memberError;

  if (demoCourse && process.env.GEMINI_API_KEY && process.env.GEMINI_EMBED_MODEL) {
    const sample = await db.from("notes_chunks").select("id").eq("course_code", demoCourse).eq("source_title", DEMO_NOTE_TITLE).limit(1);
    if (sample.error) throw sample.error;
    if (!sample.data.length) await ingestPdf(demoCourse, DEMO_NOTE_TITLE, new Uint8Array(await readFile("public/notes/tcp-revision.pdf")));
  }
  const conversation = await seedDemoConversation(profileIds, demoScript);
  console.info(`Seeded ${profileIds.size} bot profiles, ${courses.length} courses, and ${rooms.length} rooms (${sections.length} sections, 1 demo).`);
  console.info(conversation.delivered
    ? `Sent ${conversation.delivered} demo messages to ${DEMO_ROOM_ID} (${conversation.skipped} already there).`
    : `Demo conversation already seeded in ${DEMO_ROOM_ID}. Skipped.`);
}

void seed().catch((error: unknown) => {
  const code = error instanceof NexconnError ? ` (Nexconn ${error.errorCode})` : "";
  console.error(`Seed failed${code}. Check the Supabase and Nexconn configuration, then rerun pnpm seed.`);
  process.exitCode = 1;
});
