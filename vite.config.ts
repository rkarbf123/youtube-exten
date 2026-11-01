import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { popup: 'src/popup/index.html', harness: 'harness/index.html', rife:'harness/rife.html',framegen:'harness/framegen.html' } }, emptyOutDir: true },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' }
} as Parameters<typeof defineConfig>[0]);
