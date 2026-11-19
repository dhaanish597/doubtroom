import "server-only";

import { GoogleGenAI, Type, type Part } from "@google/genai";
import { adminSupabase } from "@/lib/supabase/admin";
import { doubtImageLimit, isDoubtImageType } from "../rooms/doubt-images";
import { answerOutput, doubtPrompt, type AnswerInput, type AnswerOutput } from "./prompt";

type Provider = "gemini" | "groq";
type Tokens = { input?: number; output?: number };
type Usage = { provider: Provider; model: string; tokens?: Tokens; latency: number; ok: boolean };
type Result = ({ ok: true; model: string } & AnswerOutput) | { ok: false };

async function photoPart(url: string, signal: AbortSignal): Promise<Part> {
  const response = await fetch(url, { signal, redirect: "error" });
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!response.ok || !isDoubtImageType(mimeType) || !response.body) throw new Error("Photo unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > doubtImageLimit) throw new Error("Photo too large");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (!size) throw new Error("Photo is empty");
  return { inlineData: { mimeType, data: Buffer.concat(chunks).toString("base64") } };
}

async function gemini(input: AnswerInput, model: string, key: string, signal: AbortSignal) {
  const prompt = doubtPrompt(input, Boolean(input.imageUrl));
  const parts: Part[] = [{ text: prompt.user }];
  if (input.imageUrl) parts.push(await photoPart(input.imageUrl, signal));
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      abortSignal: signal,
      systemInstruction: prompt.system,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["markdown", "examTip", "confidence"],
        properties: {
          markdown: { type: Type.STRING },
          examTip: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
        },
      },
    },
  });
  return { text: response.text, tokens: { input: response.usageMetadata?.promptTokenCount, output: response.usageMetadata?.candidatesTokenCount } };
}

async function groq(input: AnswerInput, model: string, key: string, signal: AbortSignal) {
  const prompt = doubtPrompt(input, false);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error("Groq request failed");
  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return { text: data.choices?.[0]?.message?.content, tokens: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens } };
}

export async function answerDoubt(
  input: AnswerInput & { profileId: string },
  recordUsage = (usage: Usage) => logUsage(input, usage),
): Promise<Result> {
  const order: Provider[] = !input.imageUrl && process.env.LLM_PRIMARY === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  const deadline = Date.now() + 24_000;
  const usage: Promise<void>[] = [];
  try {
    for (const provider of order) {
      if (provider === "groq" && !input.text.trim()) continue;
      const [model, key] = provider === "gemini"
        ? [process.env.GEMINI_MODEL, process.env.GEMINI_API_KEY]
        : [process.env.GROQ_MODEL, process.env.GROQ_API_KEY];
      const started = Date.now();
      if (!model || !key || started >= deadline) continue;
      const signal = AbortSignal.timeout(Math.min(20_000, deadline - started));
      let tokens: Tokens | undefined;
      let ok = false;
      try {
        const response = await (provider === "gemini" ? gemini : groq)(input, model, key, signal);
        tokens = response.tokens;
        const answer = answerOutput.parse(JSON.parse(response.text ?? ""));
        ok = true;
        return { ok: true, model, ...answer,
          markdown: provider === "groq" && input.imageUrl ? `I couldn’t read the photo. Based on your text:\n\n${answer.markdown}` : answer.markdown,
        };
      } catch {
        console.warn("TA provider attempt failed", { provider, model });
      } finally {
        usage.push(Promise.resolve().then(() => recordUsage({ provider, model, tokens, latency: Date.now() - started, ok }))
          .catch(() => console.error("Could not log TA provider usage")));
      }
    }
    return { ok: false };
  } finally {
    await Promise.all(usage);
  }
}

async function logUsage(input: AnswerInput & { profileId: string }, usage: Usage) {
  const { error } = await adminSupabase().from("ai_usage").insert({
    profile_id: input.profileId, kind: input.mention ? "mention" : "doubt",
    provider: usage.provider, model: usage.model, latency_ms: usage.latency,
    tokens_in: usage.tokens?.input, tokens_out: usage.tokens?.output, ok: usage.ok,
  }).abortSignal(AbortSignal.timeout(2000));
  if (error) throw error;
}
