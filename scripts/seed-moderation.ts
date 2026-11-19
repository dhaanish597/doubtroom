import { addProfanityWords } from "@/lib/nexconn/moderation";

/**
 * A short, non-exhaustive Nexconn profanity list (PLAN Phase 11A). Matching words are replaced
 * with "***", so a message still arrives. English plus common romanized Tamil slang.
 * Reps can mute repeat offenders, and anyone can report a message.
 */
export const PROFANITY_WORDS: readonly string[] = [
  // English
  "fuck", "motherfucker", "shit", "bitch", "bastard", "asshole", "cunt", "slut", "whore",
  // Romanized Tamil
  "otha", "ommala", "thevidiya", "thayoli", "punda", "sunni", "koothi", "baadu",
];

export async function seedProfanityWords() {
  const { added, remainingQuota } = await addProfanityWords(PROFANITY_WORDS.map((word) => ({ word, replacement: "***" })));
  const quota = remainingQuota === undefined ? "" : ` (${remainingQuota} slots left)`;
  return added
    ? `Added ${added} profanity words to Nexconn${quota}.`
    : `Profanity list already has all ${PROFANITY_WORDS.length} words.`;
}
