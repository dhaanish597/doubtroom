import "server-only";
import { GoogleGenAI } from "@google/genai";

export async function embedTexts(texts: string[], task: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT", signal: AbortSignal) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBED_MODEL;
  if (!apiKey || !model) throw new Error("Gemini embeddings are not configured");
  const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 3, initialDelay: 0.3, maxDelay: 2 } } });
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const modern = model.includes("embedding-2");
    const contents = batch.map((text) => ({ parts: [{ text: modern
      ? (task === "RETRIEVAL_QUERY" ? "task: search result | query: " : "title: none | text: ") + text : text }] }));
    const response = await ai.models.embedContent({ model, contents, config: {
      ...(modern ? {} : { taskType: task }), outputDimensionality: 768, abortSignal: signal,
    } });
    if (response.embeddings?.length !== batch.length) throw new Error("Incomplete embedding response");
    for (const { values } of response.embeddings) {
      if (values?.length !== 768 || !values.every(Number.isFinite)) throw new Error("Invalid embedding");
      vectors.push(values);
    }
  }
  return vectors;
}
