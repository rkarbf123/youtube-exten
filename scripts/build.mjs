import { build } from 'vite';
import { copyFile, mkdir } from 'node:fs/promises';
await build();
for (const [name, entry] of [['content', 'src/content/index.ts'], ['background', 'src/background/index.ts']]) {
  await build({ configFile: false, build: { emptyOutDir: false, lib: { entry, formats: ['iife'], name: `Clarity_${name}`, fileName: () => `${name}.js` }, outDir: 'dist' } });
}
await copyFile('manifest.json', 'dist/manifest.json');
await copyFile('LICENSE', 'dist/LICENSE');
await copyFile('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md');
await mkdir('dist/licenses', { recursive: true });
await copyFile('node_modules/vite/LICENSE.md', 'dist/licenses/Vite-LICENSE.md');
await copyFile('references/FSR-LICENSE.txt', 'dist/licenses/FSR-LICENSE.txt');
