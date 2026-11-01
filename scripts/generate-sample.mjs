import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { port: 5178, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage(); await page.goto('http://localhost:5178/harness/');
  await page.evaluate(() => window.clarityHarness.sample());
  const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('video').src)).arrayBuffer())));
  await mkdir('public', { recursive: true });
  await writeFile('public/diagnostic.webm', Buffer.from(bytes));
  console.log(`Packaged locally generated diagnostic video: ${bytes.length} bytes.`);
} finally { await browser.close(); await server.close(); }
