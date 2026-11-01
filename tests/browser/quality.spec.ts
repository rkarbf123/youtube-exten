import { test,expect } from '@playwright/test';
for(const backend of ['webgpu','webgl2'] as const){
  test(`${backend}: EASU scalar reference and sharper reconstruction without sharpening`,async({page})=>{
    await page.goto('/harness/');const report=await page.evaluate(backend=>window.clarityHarness.runQualityReview(backend),backend);
    expect(report.maxReferenceError,'12-tap port agrees with independent scalar reference').toBeLessThanOrEqual(2);
    for(const item of report.cases){expect(item.sharpness).toBe(0);expect(item.improved.psnr,`${item.name}: ground-truth reconstruction`).toBeGreaterThan(item.baseline.psnr);}
  });
}
test('actual presentation state, content modes, original toggle, and freshness',async({page})=>{
  await page.goto('/harness/');await page.click('#packaged');
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(5);
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.upscalingActive)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.metrics.enhancedVisiblePercent??0)).toBeGreaterThan(90);
  await page.evaluate(()=>document.querySelector('video')!.pause());
  await page.selectOption('#contentMode','animation');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.algorithm)).toContain('애니메이션');
  await page.check('#original');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presentation)).toBe('original');
  const original=await page.evaluate(()=>window.clarityHarness.stats()!);expect(original.upscalingActive).toBe(false);expect(original.fallback).toBe(false);expect(original.status).toBe('Original Comparison');
  await page.uncheck('#original');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.upscalingActive)).toBe(true);
  // No processing output may remain covering a stalled/invalidated moving source.
  await page.evaluate(()=>document.querySelector('video')!.dispatchEvent(new Event('waiting')));
  await expect(page.locator('.clarity-gpu-overlay')).toBeHidden();expect(await page.evaluate(()=>window.clarityHarness.stats()!.fallback)).toBe(true);
});
test('a positioned video cannot cover the processed canvas or comparison divider',async({page})=>{
  await page.goto('/harness/');await page.evaluate(()=>{const v=document.querySelector('video')!;v.style.position='relative';v.style.zIndex='10';});
  await page.click('#packaged');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(3);
  expect(await page.locator('.clarity-gpu-overlay').evaluate(c=>Number(getComputedStyle(c).zIndex))).toBeGreaterThan(10);
  const divider=page.getByRole('slider',{name:'원본과 보정 영상 비교 경계'});expect(await divider.evaluate(h=>Number(getComputedStyle(h.parentElement!).zIndex))).toBeGreaterThan(11);
});
test('a paused frame survives slow fullscreen/resize preparation without a playback deadline',async({page})=>{
  await page.goto('/harness/');await page.click('#packaged');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(3);
  await page.evaluate(()=>document.querySelector('video')!.pause());await page.waitForTimeout(150);
  const count=await page.evaluate(()=>window.clarityHarness.stats()!.presented);
  await page.evaluate(()=>{
    const completed=GPUQueue.prototype.onSubmittedWorkDone;
    GPUQueue.prototype.onSubmittedWorkDone=async function(){await completed.call(this);await new Promise(r=>setTimeout(r,120));};
    window.clarityHarness.settings({sharpness:60});
  });
  await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.presented??0)).toBeGreaterThan(count);
  await expect(page.locator('.clarity-gpu-overlay')).toBeVisible();expect(await page.evaluate(()=>window.clarityHarness.stats()!.upscalingActive)).toBe(true);
});

