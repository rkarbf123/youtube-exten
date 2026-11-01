import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
for (const path of [manifest.action.default_popup, manifest.background.service_worker, ...manifest.content_scripts.flatMap(s => s.js), ...Object.values(manifest.icons), 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'INSTALL.txt']) await access(`dist/${path}`);
const content = await readFile('dist/content.js', 'utf8');
assert(!/^import\s/m.test(content), 'Content script must be self-contained');
// Asset resolution is checked relative to each generated HTML file.
const { resolve, dirname } = await import('node:path');
for (const page of ['dist/src/popup/index.html', 'dist/harness/index.html']) {
  for (const match of (await readFile(page, 'utf8')).matchAll(/(?:src|href)="([^"]+)"/g)) await access(resolve(dirname(page), match[1]));
}
await access('dist/diagnostic.webm');
await access('dist/licenses/Vite-LICENSE.md');
await access('dist/licenses/FSR-LICENSE.txt');
console.log('Build verified: Manifest V3, bundled content script, popup, harness and local assets.');
