import { BOT_IDS } from "../nexconn/identities";
import { MSG, safeParseAnswer } from "../nexconn/messages";

export const TOUR_STEPS = ["doubt", "answer", "upvote", "senior", "announce"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

export const EXAMPLE_DOUBT = "Why does TCP need a 3-way handshake?";
export const EXAMPLE_UNIT = "Unit 2: TRANSPORT LAYER";

type TourMessage = { messageId: string; messageType: string; senderUserId: string; content: unknown };

export function isTourStep(value: unknown): value is TourStep {
  return typeof value === "string" && (TOUR_STEPS as readonly string[]).includes(value);
}

/** Steps that can be read straight from the demo room and the demo mentor DM. */
export function detectTourSteps(input: {
  userId: string;
  roomMessages: readonly TourMessage[];
  dmMessages: readonly TourMessage[];
}): { steps: TourStep[]; myDoubtIds: string[] } {
  const sent = (message: TourMessage) => message.senderUserId === input.userId && !message.messageId.startsWith("local:");
  const myDoubtIds = input.roomMessages.filter((message) => message.messageType === MSG.DOUBT && sent(message))
    .map(({ messageId }) => messageId);
  const doubts = new Set(myDoubtIds);
  const answered = input.roomMessages.some((message) => message.messageType === MSG.ANSWER
    && message.senderUserId === BOT_IDS.TA
    && doubts.has(safeParseAnswer(message.content).data?.doubtMessageId ?? ""));
  const messagedSenior = input.dmMessages.some(sent);

  const steps: TourStep[] = [];
  if (doubts.size) steps.push("doubt");
  if (answered) steps.push("answer");
  if (messagedSenior) steps.push("senior");
  return { steps, myDoubtIds };
}

/** Answer messages whose upvote count went up since the last snapshot. */
export function upvoteIncreased(previous: ReadonlyMap<string, number>, next: ReadonlyMap<string, number>): boolean {
  for (const [messageId, count] of next) {
    const before = previous.get(messageId);
    if (before !== undefined && count > before) return true;
  }
  return false;
}
