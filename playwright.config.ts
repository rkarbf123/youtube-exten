import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/browser',timeout:45_000,workers:1,
  use:{baseURL:'http://127.0.0.1:5173',channel:'chromium',headless:true,viewport:{width:1280,height:900},launchOptions:{args:['--autoplay-policy=no-user-gesture-required']}},
  webServer:{command:'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173/harness/',reuseExistingServer:!process.env.CI},
  reporter:[['list'],['json',{outputFile:'test-results/results.json'}]]
});
