// Renders docs/writeup/writeup.html to public/downloads/doubtroom.pdf with Playwright Chromium.
// Usage: APP_KEY=<public app key> node docs/writeup/build.mjs
// The key is public by design; read it from NEXT_PUBLIC_NEXCONN_APP_KEY in .env.local if APP_KEY is unset.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function appKey() {
  if (process.env.APP_KEY) return process.env.APP_KEY;
  const env = readFileSync(resolve(root, '.env.local'), 'utf8');
  const m = env.match(/^NEXT_PUBLIC_NEXCONN_APP_KEY=["']?([^"'\r\n]+)/m);
  if (!m) throw new Error('NEXT_PUBLIC_NEXCONN_APP_KEY not found');
  return m[1];
}

const html = readFileSync(resolve(here, 'writeup.html'), 'utf8').replaceAll('{{APP_KEY}}', appKey());
const tmp = resolve(here, '.render.html');
(await import('node:fs')).writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
await page.pdf({
  path: resolve(root, 'public/downloads/doubtroom.pdf'),
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();
(await import('node:fs')).rmSync(tmp);
console.log('wrote public/downloads/doubtroom.pdf');
