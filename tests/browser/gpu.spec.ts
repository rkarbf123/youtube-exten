import { test,expect } from '@playwright/test';
import { compareScreenPixels } from './screenPixels';
import { readFile } from 'node:fs/promises';
test('WGSL pipelines compile and deterministic GPU pixels are correct',async({page})=>{
  const adapterWarnings:string[]=[];page.on('console',message=>{if(/powerPreference.*ignored/i.test(message.text()))adapterWarnings.push(message.text());});
  await page.goto('/harness/');
  const result=await page.evaluate(()=>window.clarityHarness.runPixelChecks('webgpu'));
  expect(result.backend).toBe('WebGPU');for(const check of result.checks)expect(check.passed,`${check.name}: ${check.detail}`).toBe(true);
  expect(adapterWarnings).toEqual([]);
});
test('WebGL2 fallback compiles and produces correct pixels',async({page})=>{
  await page.goto('/harness/');const result=await page.evaluate(()=>window.clarityHarness.runPixelChecks('webgl2'));
  expect(result.backend).toBe('WebGL2');for(const check of result.checks)expect(check.passed,`${check.name}: ${check.detail}`).toBe(true);
});
test('WebGL2 video output reaches the compositor with matching comparison frames',async({page})=>{
  await page.goto('/harness/');await page.selectOption('#backend','webgl2');await page.click('#packaged');
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(3);
  await page.evaluate(()=>document.querySelector('video')!.pause());await expect(page.locator('.clarity-gpu-overlay')).toBeVisible();
  const fidelity=await compareScreenPixels(page);expect(fidelity.left).toBeLessThan(8);expect(fidelity.right).toBeGreaterThan(.05);expect(fidelity.right).toBeLessThan(30);
});
test('origin-clean video renders, resizes, seeks, compares, pauses and cleans up',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/harness/');await page.evaluate(()=>window.clarityHarness.sample());
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(3);
  await expect(page.locator('.clarity-gpu-overlay')).toBeVisible();
  const dimensions=await page.evaluate(()=>window.clarityHarness.stats()?.dimensions);expect(dimensions?.source).toEqual({width:320,height:180});
  await page.setViewportSize({width:1100,height:750});
  await page.evaluate(()=>{const video=document.querySelector('video')!;video.currentTime=.8;video.playbackRate=1.5;});
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.status)).toMatch(/Active|Performance Limited/);
  await page.evaluate(()=>document.querySelector('video')!.pause());
  await expect(page.locator('.clarity-gpu-overlay')).toBeVisible();
  const fidelity=await compareScreenPixels(page);
  expect(fidelity.left,'Original comparison side should match the same decoded video frame').toBeLessThan(8);
  expect(fidelity.right,'Processed pixels must actually reach the compositor').toBeGreaterThan(.05);
  expect(fidelity.right,'Processed output should preserve the source image').toBeLessThan(30);
  await page.waitForTimeout(200);const count=await page.evaluate(()=>window.clarityHarness.stats()!.presented);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.clarityHarness.stats()!.presented)).toBe(count);
  await page.evaluate(()=>window.clarityHarness.settings({engine:'fast',comparison:false}));
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.engine)).toBe('fast');
  await page.screenshot({path:'test-results/local-harness.png',fullPage:true});
  await page.evaluate(()=>window.clarityHarness.destroy());await expect(page.locator('.clarity-gpu-overlay')).toHaveCount(0);expect(await page.locator('video').evaluate(video=>(video as HTMLVideoElement).style.visibility)).toBe('');expect(errors).toEqual([]);
});
test('restricted acquisition restores the original and reports the reason',async({page})=>{
  await page.goto('/harness/');
  await page.evaluate(()=>{CanvasRenderingContext2D.prototype.getImageData=function(){throw new DOMException('Origin-clean access denied in regression test','SecurityError');};});
  await page.evaluate(()=>window.clarityHarness.sample());
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.status)).toBe('Video Access Restricted');
  await expect(page.locator('.clarity-gpu-overlay')).toHaveCount(0);expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);
});
test('actual browser origin-clean restrictions leave cross-origin video playable',async({page})=>{
  const bytes=await readFile('public/diagnostic.webm');
  await page.route('http://cross-origin.invalid/**',route=>route.fulfill({body:bytes,contentType:'video/webm'}));
  await page.goto('/harness/');await page.click('#packaged');
  await page.evaluate(async()=>{const video=document.querySelector('video')!;video.src='http://cross-origin.invalid/diagnostic.webm';await video.play();});
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.status)).toBe('Video Access Restricted');
  await expect(page.locator('.clarity-gpu-overlay')).toHaveCount(0);expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);
});
test('device loss recovers once with a fresh WebGL2 surface',async({page})=>{
  await page.goto('/harness/');
  await page.evaluate(()=>{
    const original=GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice=async function(descriptor){const device=await original.call(this,descriptor);(window as unknown as {testDevice:GPUDevice}).testDevice=device;return device;};
  });
  await page.evaluate(()=>window.clarityHarness.sample());
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(2);
  await page.evaluate(()=>(window as unknown as {testDevice:GPUDevice}).testDevice.destroy());
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.backend)).toBe('WebGL2');
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.status)).toMatch(/Active|Performance Limited/);
  await expect(page.locator('.clarity-gpu-overlay')).toHaveCount(1);
  expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).style.display)).not.toBe('none');
});
test('missing GPU backends preserve original playback',async({page})=>{
  await page.goto('/harness/');
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type==='webgl2')return null;return original.apply(this,[type,...args] as Parameters<typeof original>);} as typeof original;
  });
  await page.evaluate(()=>window.clarityHarness.sample());
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.status)).toBe('Unsupported GPU');
  await expect(page.locator('.clarity-gpu-overlay')).toHaveCount(0);
  expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);
});
test('textures are reused, resized, and released on shutdown',async({page})=>{
  await page.goto('/harness/');
  await page.evaluate(()=>{
    const active=new Set<GPUTexture>();let created=0;
    const create=GPUDevice.prototype.createTexture,destroy=GPUTexture.prototype.destroy;
    GPUDevice.prototype.createTexture=function(descriptor){const texture=create.call(this,descriptor);active.add(texture);created++;return texture;};
    GPUTexture.prototype.destroy=function(){active.delete(this);destroy.call(this);};
    (window as unknown as {textures:()=>{created:number;active:number}}).textures=()=>({created,active:active.size});
  });
  await page.click('#packaged');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(3);
  const before=await page.evaluate(()=>(window as unknown as {textures:()=>{created:number;active:number}}).textures());expect(before.active).toBe(3);
  const count=await page.evaluate(()=>window.clarityHarness.stats()!.presented);await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()!.presented)).toBeGreaterThan(count+5);
  expect(await page.evaluate(()=>(window as unknown as {textures:()=>{created:number}}).textures().created)).toBe(before.created);
  await page.setViewportSize({width:1000,height:800});await page.waitForTimeout(250);expect(await page.evaluate(()=>(window as unknown as {textures:()=>{created:number}}).textures().created)).toBe(before.created);
  await page.evaluate(()=>window.clarityHarness.settings({targetResolution:'720p'}));await expect.poll(()=>page.evaluate(()=>(window as unknown as {textures:()=>{created:number}}).textures().created)).toBeGreaterThan(before.created);
  expect(await page.evaluate(()=>(window as unknown as {textures:()=>{active:number}}).textures().active)).toBe(3);
  await page.evaluate(()=>window.clarityHarness.destroy());expect(await page.evaluate(()=>(window as unknown as {textures:()=>{active:number}}).textures().active)).toBe(0);
});

