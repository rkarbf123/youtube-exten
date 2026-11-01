import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
test('real RIFE WebGPU outputs match PyTorch without CPU fallback',async({page})=>{
 await page.goto('/harness/rife.html');const r=await page.evaluate(()=>window.rifeValidation());expect(r.status).toBe('passed');expect(r.cpuFallbackAllowed).toBe(false);expect(r.released).toBe(true);expect(r.distinctOutputs).toBe(3);
 for(const row of r.rows as {location:string;maxAbs:number;mae:number}[]){expect(row.location).toBe('gpu-buffer');expect(row.maxAbs).toBeLessThan(.001);expect(row.mae).toBeLessThan(.0001);}
});
test('Framegen uses only decoded A and C while actual B remains a PTS-based reference',async({page})=>{
 const bytes=await readFile('docs/v1.2.1/inputs-v2/1280x720-60.webm');await page.route('**/abc-test.webm',r=>r.fulfill({body:bytes,contentType:'video/webm'}));await page.goto('/harness/framegen.html');const r=await page.evaluate(()=>window.framegenTriplet('/abc-test.webm'));expect(r.modelInputs).toEqual(['A','C']);expect(r.truthExcludedFromGpu).toBe(true);expect(r.decodedPts.A).toBeLessThan(r.decodedPts.B);expect(r.decodedPts.B).toBeLessThan(r.decodedPts.C);expect(r.decodedPts.t).toBeCloseTo((r.decodedPts.B-r.decodedPts.A)/(r.decodedPts.C-r.decodedPts.A),8);expect(r.framegen.psnr!).toBeGreaterThan(r.optical.psnr!);expect(r.framegen.positionError!).toBeLessThan(1);
});
test('reference A/C spacing matches 24, 30 and 60 source FPS and B uses the requested output PTS',async({page})=>{
 await page.goto('/harness/framegen.html');for(const [sourceFPS,targetFPS]of [[24,48],[30,60],[60,90]]){const r=await page.evaluate(c=>window.framegenReference(c),{width:320,height:192,sourceFPS,targetFPS});expect(r.referenceEncoding.inputPairFPS).toBeCloseTo(sourceFPS,2);expect(r.decodedPts.B).toBeCloseTo(r.decodedPts.A+1/targetFPS,5);expect(r.decodedPts.t).toBeCloseTo((r.decodedPts.B-r.decodedPts.A)/(r.decodedPts.C-r.decodedPts.A),8);expect(r.modelInputs).toEqual(['A','C']);expect(r.sceneControls?.cut.originalCopied).toBe(true);}
});
test('1080p is inferred with 1088 replicated rows and cropped to native output',async({page})=>{
 await page.goto('/harness/framegen.html');const r=await page.evaluate(()=>window.framegenReference({width:1920,height:1080,sourceFPS:30,targetFPS:60}));expect(r.width).toBe(1920);expect(r.height).toBe(1080);expect(r.inference.height).toBe(1088);expect(r.inference.paddingRows).toBe(8);expect(r.sceneControls?.cut.originalCopied).toBe(true);expect(r.framegen.psnr).toBeGreaterThan(25);
});
