import "server-only";

import { GoogleGenAI, Type } from "@google/genai";
import { adminSupabase } from "@/lib/supabase/admin";
import { parseRecapSummaries, recapPrompt, type RecapPromptItem } from "./recap-prompt";

type Provider = "gemini" | "groq";
const ATTEMPT_MS = 12_000;
const BUDGET_MS = 15_000;

async function gemini(prompt: { system: string; user: string }, model: string, key: string, signal: AbortSignal) {
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt.user }] }],
    config: {
      abortSignal: signal,
      systemInstruction: prompt.system,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["summaries"],
        properties: { summaries: { type: Type.ARRAY, items: { type: Type.STRING } } },
      },
    },
  });
  return response.text;
}

async function groq(prompt: { system: string; user: string }, model: string, key: string, signal: AbortSignal) {
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
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content;
}

async function logUsage(provider: Provider, model: string, latency: number, ok: boolean) {
  const { error } = await adminSupabase().from("ai_usage").insert({
    profile_id: null, kind: "recap", provider, model, latency_ms: latency, ok,
  }).abortSignal(AbortSignal.timeout(2_000));
  if (error) console.warn("Could not log recap usage", { code: error.code });
}

/**
 * One-line summaries for a room's recap in a single LLM call. Returns null when no provider is
 * configured or every attempt fails, so the caller can fall back to first sentences.
 */
export async function summarizeRecap(courseTitle: string, items: readonly RecapPromptItem[]): Promise<string[] | null> {
  if (!items.length) return [];
  const prompt = recapPrompt(courseTitle, items);
  const order: Provider[] = process.env.LLM_PRIMARY === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  const deadline = Date.now() + BUDGET_MS;
  for (const provider of order) {
    const [model, key] = provider === "gemini"
      ? [process.env.GEMINI_MODEL, process.env.GEMINI_API_KEY]
      : [process.env.GROQ_MODEL, process.env.GROQ_API_KEY];
    const started = Date.now();
    if (!model || !key || started >= deadline) continue;
    let ok = false;
    try {
      const signal = AbortSignal.timeout(Math.min(ATTEMPT_MS, deadline - started));
      const text = await (provider === "gemini" ? gemini : groq)(prompt, model, key, signal);
      const summaries = parseRecapSummaries(text, items.length);
      ok = Boolean(summaries);
      if (summaries) return summaries;
    } catch {
      console.warn("Recap summary attempt failed", { provider, model });
    } finally {
      await logUsage(provider, model, Date.now() - started, ok).catch(() => undefined);
    }
  }
  return null;
}
