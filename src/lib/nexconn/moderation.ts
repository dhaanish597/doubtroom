import "server-only";

import type { ProfanityWordItem } from "@nexconn/server-sdk";
import { groupModeration, moderation, request } from "./server";

/** GroupChannelModerationApi.addGroupChannelUserMuteList (verified in server SDK v0.1.2). */
export async function muteGroupMember(channelId: string, userId: string, durationMinutes: number) {
  await request("mute the member", () => groupModeration.addGroupChannelUserMuteList({
    channelId, userIds: [userId], durationMinutes,
  }));
}

/** GroupChannelModerationApi.removeGroupChannelUserMuteList. */
export async function unmuteGroupMember(channelId: string, userId: string) {
  await request("unmute the member", () => groupModeration.removeGroupChannelUserMuteList({
    channelId, userIds: [userId],
  }));
}

/**
 * Adds the words that are not configured yet with ModerationApi.batchAddProfanityWords.
 * listProfanityWords filterType "2" lists replacement and blocked words.
 */
export async function addProfanityWords(words: readonly ProfanityWordItem[]) {
  const listed = await request("list profanity words", () => moderation.listProfanityWords({ filterType: "2" }));
  const existing = new Set((listed.result?.words ?? []).map(({ word }) => word?.toLowerCase()).filter(Boolean));
  const missing = words.filter(({ word }) => !existing.has(word.toLowerCase()));
  if (!missing.length) return { added: 0, remainingQuota: undefined };
  const added = await request("add profanity words", () => moderation.batchAddProfanityWords({ words: [...missing] }));
  return { added: missing.length, remainingQuota: added.result?.remainingQuota };
}
