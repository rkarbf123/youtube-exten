import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const tag=process.argv[2]??'current';
const outDir=resolve(process.argv[3]??'dist');
const server=await preview({configFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5182,strictPort:true}});
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:5182/harness/');
  await page.click('#packaged');
  await page.evaluate(()=>window.clarityHarness.settings({adaptive:false,engine:'balanced',automaticStrength:false,comparison:false}));
  await page.waitForFunction(()=>window.clarityHarness.stats()?.presented>5);
  const result=await page.evaluate(async()=>{
    let visibleMs=0,totalMs=0;let last=performance.now();const start=window.clarityHarness.stats();
    const timer=setInterval(()=>{const now=performance.now(),canvas=document.querySelector('.clarity-gpu-overlay');const dt=now-last;totalMs+=dt;if(canvas&&canvas.style.display!=='none'&&canvas.style.visibility!=='hidden')visibleMs+=dt;last=now;},4);
    await new Promise(r=>setTimeout(r,6000));clearInterval(timer);
    return {sampleMs:totalMs,enhancedVisiblePercent:100*visibleMs/totalMs,start,end:window.clarityHarness.stats()};
  });
  const report={tag,browser:browser.version(),...result};
  await mkdir('docs/review',{recursive:true});await writeFile(`docs/review/${tag}-presentation.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await server.close();}
