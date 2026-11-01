import { test,expect,chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

test('built MV3 popup persists settings and receives production content-script stats',async()=>{
  const path=resolve('dist');const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,timeout:15000,args:[`--disable-extensions-except=${path}`,`--load-extension=${path}`,'--autoplay-policy=no-user-gesture-required'],viewport:{width:1280,height:900}});
  context.setDefaultTimeout(5000);
  try{
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:10000});const id=new URL(worker.url()).host;
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/src/popup/index.html`);
    await expect(popup.locator('#status')).toHaveText('원본 재생 · 연결 대기');
    await popup.locator('#sharpness').fill('61');await popup.locator('#adaptive').uncheck();await popup.waitForTimeout(250);await popup.reload();
    await expect(popup.locator('#sharpness')).toHaveValue('61');await expect(popup.locator('#adaptive')).not.toBeChecked();await expect(popup.locator('#profile')).toBeEnabled();
    await popup.locator('[data-fps="144"]').click();await popup.waitForTimeout(150);await popup.reload();await expect(popup.locator('[data-fps="144"]')).toHaveAttribute('aria-pressed','true');
    await popup.locator('#saturation').fill('150');await popup.locator('#brightness').fill('125');await popup.locator('[data-fps="100"]').click();await popup.locator('[data-resolution="1440p"]').click();await popup.waitForTimeout(150);await popup.reload();await expect(popup.locator('#saturation')).toHaveValue('150');await expect(popup.locator('#brightness')).toHaveValue('125');await expect(popup.locator('[data-fps="100"]')).toHaveAttribute('aria-pressed','true');await expect(popup.locator('[data-resolution="1440p"]')).toHaveAttribute('aria-pressed','true');await popup.locator('#reset-color').click();await expect(popup.locator('#saturation')).toHaveValue('100');await popup.locator('[data-fps="original"]').click();await popup.locator('[data-resolution="1080p"]').click();await popup.waitForTimeout(150);
    await popup.screenshot({path:'test-results/popup.png',fullPage:true});
    const sample=await readFile('public/diagnostic.webm');
    await context.route('https://www.youtube.com/**',async route=>{
      if(route.request().url().endsWith('/diagnostic.webm'))await route.fulfill({body:sample,contentType:'video/webm'});
      else await route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>body{margin:0;background:#111}.html5-video-container{position:relative;width:960px;height:0}video{position:absolute;width:960px;height:540px}.captions{position:absolute;top:450px;left:20px;z-index:5;color:white}</style></head><body><div class="html5-video-container"><video class="html5-main-video" autoplay muted loop src="/diagnostic.webm"></video><div class="captions">Synthetic integration fixture — captions</div></div></body></html>'});
    });
    const youtube=await context.newPage();await youtube.goto('https://www.youtube.com/watch?v=local-fixture');
    const stats=()=>worker.evaluate(async()=>{const tabs=await chrome.tabs.query({active:true,currentWindow:true});return chrome.tabs.sendMessage(tabs[0].id!,{type:'clarity:stats'});});
    await expect.poll(async()=>(await stats()).presented).toBeGreaterThan(2);
    await expect(youtube.locator('.clarity-gpu-overlay')).toHaveCount(1);
    const css=(await stats()).dimensions.css;expect(css.width).toBe(960);expect(css.height).toBe(540);
    await popup.reload();await expect(popup.locator('dl div').filter({has:popup.locator('dt', {hasText:/^원본 해상도$/})}).locator('dd')).toHaveText('320 × 180');
    await popup.screenshot({path:'test-results/popup-live.png',fullPage:true});
    // Disabling from the actual popup must immediately remove all presentation resources.
    await popup.bringToFront();await popup.locator('#enabled').uncheck();await expect(youtube.locator('.clarity-gpu-overlay')).toHaveCount(0);
    expect(await youtube.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);
    await popup.locator('#enabled').check();await youtube.bringToFront();await expect.poll(async()=>(await stats()).presented).toBeGreaterThan(1);
    // Real DOM replacement must detach the old pipeline and select the new primary video.
    const oldCanvas=await youtube.locator('.clarity-gpu-overlay').elementHandle();
    await youtube.evaluate(()=>{const old=document.querySelector('video')!;const next=old.cloneNode(true) as HTMLVideoElement;old.replaceWith(next);void next.play();});
    await expect.poll(()=>oldCanvas!.evaluate(node=>node.isConnected)).toBe(false);
    await expect.poll(async()=>(await stats()).presented).toBeGreaterThan(1);await expect(youtube.locator('.clarity-gpu-overlay')).toHaveCount(1);
    await popup.locator('#reset').click();await expect(popup.locator('#sharpness')).toHaveValue('40');await expect(popup.locator('#adaptive')).toBeChecked();
  }finally{await context.close();}
});

