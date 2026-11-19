import { readFile, stat } from "node:fs/promises";
import { ingestPdf } from "../src/lib/ai/ingest";
import { pdfLimit } from "../src/lib/ai/notes";

async function main() {
  const [courseCode, file, title] = process.argv.slice(2);
  if (!courseCode || !file || !title) throw new Error('Usage: pnpm ingest-notes <courseCode> <pdfPath> "<title>"');
  if ((await stat(file)).size > pdfLimit) throw new Error("Choose a PDF up to 20 MB.");
  const result = await ingestPdf(courseCode, title, new Uint8Array(await readFile(file)));
  console.info(`Indexed ${result.chunks} chunks from ${result.pages} pages.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Note ingestion failed"); process.exitCode = 1; });
