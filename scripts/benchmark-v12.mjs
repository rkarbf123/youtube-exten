import {chromium} from '@playwright/test';
import {preview} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const results=[];await mkdir('docs/v1.2',{recursive:true});
for(const [version,outDir,port] of [['1.1','docs/v1.2/baseline-dist',5182],['1.2','dist',5183]]){
 const server=await preview({build:{outDir},preview:{host:'127.0.0.1',port,strictPort:true}});let browser;
 try{
  browser=await chromium.launch({channel:'chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:2400,height:1450}});await page.goto(`http://127.0.0.1:${port}/harness/`);
  const gpu=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description,fallback:a.isFallbackAdapter};});
  await page.evaluate(()=>{const p=document.querySelector('#player'),v=document.querySelector('video');p.style.width='1920px';p.style.height='1080px';v.style.width='1920px';v.style.height='1080px';window.clarityHarness.settings({adaptive:false,automaticStrength:false,profile:'quality',engine:'balanced',scale:'auto',targetResolution:'1080p',targetFPS:'original',saturation:100,brightness:100,comparison:false});});
  await page.click('#packaged');await page.waitForFunction(()=>window.clarityHarness.stats()?.presented>5,{},{timeout:12000});await page.waitForTimeout(1500);const samples=[];
  for(let i=0;i<16;i++){await page.waitForTimeout(500);samples.push(await page.evaluate(()=>window.clarityHarness.stats()));}
  const mean=key=>samples.reduce((s,x)=>s+(x.metrics[key]??0),0)/samples.length;
  results.push({version,browser:browser.version(),gpu,source:samples[15].dimensions.source,output:samples[15].dimensions.output,mean:{sourceFPS:mean('sourceFPS'),processedFPS:mean('processedFPS'),latencyMs:mean('latencyMs'),visiblePercent:mean('enhancedVisiblePercent')},samples});
 }catch(e){results.push({version,error:String(e)});}finally{await browser?.close();await server.close();}
}
await writeFile('docs/v1.2/full-v11-benchmark.json',JSON.stringify({method:'frozen v1.1 distribution versus v1.2 distribution; same 320x180 packaged decoded clip and 1920x1080 output, manual quality/balanced, interpolation off, neutral color; 1.5s warmup plus 8s observed per version',results},null,2));console.log(JSON.stringify(results.map(({samples:_,...r})=>r),null,2));
