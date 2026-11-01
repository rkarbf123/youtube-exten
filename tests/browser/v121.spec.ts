import {test,expect} from '@playwright/test';
test('moving edges between block centers are not mislabeled static',async({page})=>{
  await page.goto('/harness/');const before=await page.evaluate(()=>window.clarityPerf.classifySmallMotion('baseline')),after=await page.evaluate(()=>window.clarityPerf.classifySmallMotion('after'));expect(before.some(x=>x.shift===2&&!x.dynamic)).toBe(true);for(const x of after){expect(x.changedChannels>0).toBe(x.shift!==0);expect(x.dynamic).toBe(x.shift!==0);}
});
test('streaming path renders retained and latest pair at the correct intermediate position',async({page})=>{
  await page.goto('/harness/');for(const which of ['previous','latest'] as const)for(const alpha of [.25,.5,.75]){
    const result=await page.evaluate(({which,alpha})=>window.clarityPerf.cachedPhase(which,alpha),{which,alpha});const bytes=await page.screenshot({clip:{x:0,y:0,width:128,height:72}});
    const center=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),c=document.createElement('canvas');c.width=128;c.height=72;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,128,72).data;let sum=0,weight=0;for(let y=0;y<72;y++)for(let x=0;x<128;x++){const w=Math.max(0,p[(y*128+x)*4]-16);sum+=(x+.5)*w;weight+=w;}return sum/weight;},[...bytes]);
    expect(result.pairs).toHaveLength(2);expect(Math.abs(center-result.expected)).toBeLessThan(1.5);
  }
});
test('normal streaming does not require signature reads or synchronous completion fences',async({page})=>{
  await page.goto('/harness/');await page.evaluate(()=>{window.clarityHarness.settings({targetFPS:'120',comparison:false,targetResolution:'original',adaptive:false});});await page.evaluate(()=>window.clarityHarness.motionSample(60));await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.temporal?.submitted??0)).toBeGreaterThan(15);expect(await page.evaluate(()=>window.clarityHarness.stats()?.temporal?.signatureSampled)).toBe(false);const counters=await page.evaluate(()=>window.clarityPerf.snapshot().counters);expect(counters.completedOutputs).toBeGreaterThan(0);expect(counters['discard.bufferMismatch']??0).toBe(0);
});
test('stalled completion acknowledgements recover to WebGL2 while native playback continues',async({page})=>{
  await page.goto('/harness/');await page.evaluate(()=>window.clarityHarness.settings({targetFPS:'120',comparison:false,targetResolution:'original',adaptive:false}));await page.click('#packaged');await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.temporal?.generated??0)).toBeGreaterThan(3);await page.evaluate(()=>{GPUQueue.prototype.onSubmittedWorkDone=function(){return new Promise(()=>{});};});await expect.poll(()=>page.evaluate(()=>window.clarityHarness.stats()?.backend),{timeout:7000}).toBe('WebGL2');expect(await page.locator('video').evaluate(v=>(v as HTMLVideoElement).paused)).toBe(false);
});
