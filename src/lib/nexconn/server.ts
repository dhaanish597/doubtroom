import "server-only";

import {
  ApiException,
  Configuration,
  GroupChannelManagementApi,
  GroupChannelModerationApi,
  MessageManagementApi,
  ModerationApi,
  OpenChannelManagementApi,
  UserManagementApi,
  type GroupChannelMessageSendRequest,
} from "@nexconn/server-sdk";

import { TA_AVATAR } from "./bot-avatar";
import { nexconnEnvSchema } from "./config-env";
import { BOT_IDS } from "./ids";
import type { MSG } from "./messages";

const config = new Configuration({ baseOptions: { timeout: 5_000 } });
const settings = nexconnEnvSchema.safeParse(process.env);

if (settings.success) {
  const { NEXCONN_APP_KEY, NEXCONN_APP_SECRET, NEXCONN_PRIMARY_API_DOMAIN, NEXCONN_SECONDARY_API_DOMAIN } =
    settings.data;
  config.setNexconnCredentials(NEXCONN_APP_KEY, NEXCONN_APP_SECRET);
  config.setPrimaryBackupDomains(
    `https://${NEXCONN_PRIMARY_API_DOMAIN}`,
    `https://${NEXCONN_SECONDARY_API_DOMAIN}`,
  );
}

export const users = new UserManagementApi(config);
export const groups = new GroupChannelManagementApi(config);
export const groupModeration = new GroupChannelModerationApi(config);
export const messages = new MessageManagementApi(config);
export const openChannels = new OpenChannelManagementApi(config);
export const moderation = new ModerationApi(config);

export class NexconnError extends Error {
  constructor(
    public readonly errorCode: number | "NOT_CONFIGURED" | "INVALID_RESPONSE",
    public readonly errorMessage: string,
    public readonly httpStatus?: number,
  ) {
    super(errorMessage);
    this.name = "NexconnError";
  }
}

const SUCCESS = 0;
const GROUP_ALREADY_EXISTS = 25409;
const GROUP_NOT_FOUND = 25410;
const ALREADY_MEMBER = 25412;
let loggedIssueResponse = false;

export async function request<T extends { code: number }>(
  operation: string,
  run: () => Promise<{ data: T }>,
): Promise<T> {
  if (!settings.success) {
    throw new NexconnError("NOT_CONFIGURED", "Nexconn server credentials or domains are missing or invalid");
  }
  try {
    const { data } = await run();
    if (data?.code !== SUCCESS) {
      throw new NexconnError(typeof data?.code === "number" ? data.code : "INVALID_RESPONSE", `Nexconn could not ${operation}`);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiException) {
      throw new NexconnError(error.errorCode, error.errorMessage ?? `Nexconn could not ${operation}`, error.httpStatus);
    }
    throw error;
  }
}

export async function issueToken(userId: string, name: string, avatarUrl?: string): Promise<string> {
  const data = await request("issue a token", () => users.issueAccessToken({ userId, name, avatarUrl }));
  const token = data.result?.accessToken;
  if (process.env.NODE_ENV === "development" && !loggedIssueResponse) {
    loggedIssueResponse = true;
    // Allowlist response fields so undocumented fields cannot leak credentials.
    console.info("Nexconn issueAccessToken response", {
      code: data.code,
      result: data.result ? { userId: data.result.userId, accessToken: token ? "[redacted]" : undefined } : undefined,
    });
  }
  if (!token || (data.result?.userId && data.result.userId !== userId)) {
    throw new NexconnError("INVALID_RESPONSE", "Nexconn did not return a token for the requested user");
  }
  return token;
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const data = await request("check the user's connection", () => users.getUserConnectionStatus({ userId }));
  return data.result?.status === "1";
}

function hasCode(error: unknown, code: number): boolean {
  return error instanceof NexconnError && error.errorCode === code;
}

export async function ensureGroup(channelId: string, name: string, ownerRegistered = false): Promise<void> {
  try {
    const data = await request("look up the group", () => groups.batchGetGroupChannelProfiles({ channelIds: [channelId] }));
    if (data.result?.profiles?.some((profile) => profile.channelId === channelId)) return;
  } catch (error) {
    if (!hasCode(error, GROUP_NOT_FOUND)) throw error;
  }

  if (!ownerRegistered) await issueToken(BOT_IDS.TA, "DoubtRoom TA", TA_AVATAR);
  try {
    await request("create the group", () => groups.createGroupChannel({ channelId, name, owner: BOT_IDS.TA }));
  } catch (error) {
    // Another request may have created the group after our lookup.
    if (!hasCode(error, GROUP_ALREADY_EXISTS)) throw error;
  }
}

export async function joinGroup(channelId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await request("join the group", () => groups.joinGroupChannel({ channelId, userIds }));
  } catch (error) {
    if (!hasCode(error, ALREADY_MEMBER)) throw error;
    if (userIds.length > 1) {
      for (const userId of new Set(userIds)) await joinGroup(channelId, [userId]);
    }
  }
}

type CustomType = (typeof MSG)[keyof typeof MSG] | typeof TEXT_MESSAGE;
const TEXT_MESSAGE = "RC:TxtMsg";
// The wire format of RC:TxtMsg uses `content`; the Web SDK maps it to `text` for clients (D-013).

/** Plain text group message, for example seeded demo chatter. */
export function sendGroupText(fromUserId: string, channelId: string, text: string, opts: SendGroupOptions = {}) {
  return sendGroupCustom(fromUserId, channelId, TEXT_MESSAGE, { content: text }, opts);
}

/** Plain text DM from a server identity (the demo mentor). Returns the delivered message ID. */
export async function sendDirectText(fromUserId: string, toUserId: string, text: string): Promise<string | undefined> {
  const content = JSON.stringify({ content: text });
  if (Buffer.byteLength(content, "utf8") > 128 * 1024) {
    throw new RangeError("Nexconn message content exceeds 128 KB");
  }
  const { result } = await request("send the direct message", () => messages.sendDirectChannelMessage({
    fromUserId,
    toUserIds: [toUserId],
    messageType: TEXT_MESSAGE,
    content,
    isEchoToSender: 0,
    shouldPersist: 1,
    pushContent: "New message from a senior",
  }));
  return result?.messageIds?.find((delivery) => delivery.userId === toUserId)?.messageId;
}
type SendGroupOptions = Pick<GroupChannelMessageSendRequest,
  "pushContent" | "hasMetadata" | "hasMention" | "needReadReceipt" | "isEchoToSender" | "shouldPersist"
> & { metadata?: Record<string, string> };

export async function sendGroupCustom(
  fromUserId: string,
  channelId: string,
  type: CustomType,
  payload: object,
  opts: SendGroupOptions = {},
) {
  const content = JSON.stringify(payload);
  if (Buffer.byteLength(content, "utf8") > 128 * 1024) {
    throw new RangeError("Nexconn message content exceeds 128 KB");
  }
  const { result } = await request("send the group message", () => messages.sendGroupChannelMessage({
    ...opts,
    hasMetadata: opts.hasMetadata ?? (opts.metadata ? true : undefined),
    fromUserId,
    toChannelIds: [channelId],
    messageType: type,
    content,
  }));
  return result;
}

export async function setMessageMetadata(
  channelType: 1 | 3,
  channelId: string,
  messageId: string,
  userId: string,
  metadata: Record<string, string>,
): Promise<void> {
  await request("set message metadata", () =>
    messages.setChannelTypeMessageMetadata({ channelType, channelId, messageId, userId, metadata }));
}

export async function listGroupMemberIds(channelId: string) {
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let pageToken: string | undefined;

  do {
    const { result } = await request("list group members", () =>
      groups.listGroupChannelMembers({ channelId, pageSize: 100, pageToken }));
    if (!result?.members) throw new NexconnError("INVALID_RESPONSE", "Group member list is missing");
    for (const { userId } of result.members) {
      if (userId && /^[a-z0-9_]{1,64}$/.test(userId)) ids.add(userId);
    }
    pageToken = result.pageToken || undefined;
    if (pageToken) {
      if (cursors.has(pageToken)) throw new NexconnError("INVALID_RESPONSE", "Group member cursor repeated");
      cursors.add(pageToken);
    }
  } while (pageToken);

  return [...ids];
}

/** Open channel destroy types from the server SDK docs: 0 after inactivity, 1 at a fixed time. */
const OPEN_CHANNEL_FIXED_DESTROY = 1;

export async function createOpenChannel(channelId: string, ttlMinutes: number): Promise<void> {
  await request("create the open channel", () => openChannels.createOpenChannel({
    channelId, destroyType: OPEN_CHANNEL_FIXED_DESTROY, ttlMinutes,
  }));
}

export async function openChannelParticipantCount(channelId: string): Promise<number | null> {
  const { result } = await request("look up the open channel", () => openChannels.getOpenChannel({ channelId }));
  return typeof result?.participantCount === "number" ? result.participantCount : null;
}

export async function sendOpenCustom(
  fromUserId: string,
  channelId: string,
  type: CustomType,
  payload: object,
  opts: { shouldPersist?: number; isEchoToSender?: number } = {},
) {
  const content = JSON.stringify(payload);
  if (Buffer.byteLength(content, "utf8") > 128 * 1024) {
    throw new RangeError("Nexconn message content exceeds 128 KB");
  }
  const { result } = await request("send the open channel message", () => messages.sendOpenChannelMessage({
    ...opts, fromUserId, toChannelIds: [channelId], messageType: type, content,
  }));
  return result;
}
