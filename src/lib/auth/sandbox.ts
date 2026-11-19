import { BOT_IDS } from "../nexconn/identities";

/**
 * Try (judge) sessions live in a sandbox: demo rooms and the demo mentor only.
 * Every server route that touches a room or a DM peer checks these rules.
 */
export type ActorKind = "user" | "try";

const DEMO_ROOM_PREFIX = "demo_";
const CHAT_ID = /^[a-z0-9_]{1,64}$/;

export function isDemoRoomId(roomId: string) {
  return roomId.startsWith(DEMO_ROOM_PREFIX) && CHAT_ID.test(roomId);
}

/** Whether an actor may open a room. Membership is still checked separately. */
export function canUseRoom(kind: ActorKind, roomId: string, roomKind?: string) {
  if (!CHAT_ID.test(roomId)) return false;
  if (kind === "user") return true;
  return isDemoRoomId(roomId) && (roomKind === undefined || roomKind === "demo");
}

/** Whether an actor may start or continue a DM with a peer. */
export function canDirectMessage(kind: ActorKind, selfId: string, peerId: string) {
  if (!CHAT_ID.test(peerId) || peerId === selfId) return false;
  if (kind === "try") return peerId === BOT_IDS.DEMO_MENTOR;
  // Real students never DM the scripted demo mentor, another bot identity or a sandbox visitor.
  return !Object.values(BOT_IDS).some((id) => id === peerId) && !peerId.startsWith("try_");
}
