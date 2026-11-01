import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { mkdir,writeFile } from 'node:fs/promises';
const server=await preview({preview:{host:'127.0.0.1',port:5180,strictPort:true}});
const results=[];
const output=process.argv[2]??'docs';
try{
  for(const channel of ['chrome','msedge']){
    let browser;const result={channel};
    try{
      browser=await chromium.launch({channel,headless:true,args:['--autoplay-policy=no-user-gesture-required']});result.version=browser.version();
      const page=await browser.newPage();await page.goto('http://127.0.0.1:5180/harness/');
      result.webgpu=await page.evaluate(()=>window.clarityHarness.runPixelChecks('webgpu')).catch(error=>({error:String(error)}));
      result.webgl2=await page.evaluate(()=>window.clarityHarness.runPixelChecks('webgl2')).catch(error=>({error:String(error)}));
      if(await page.evaluate(()=>typeof window.clarityHarness.runMotionChecks==='function')){
        result.motion=await page.evaluate(()=>window.clarityHarness.runMotionChecks()).catch(error=>({error:String(error)}));
        result.color=await page.evaluate(()=>window.clarityHarness.runColorChecks()).catch(error=>({error:String(error)}));
      }
      await page.click('#packaged');await page.waitForFunction(()=>window.clarityHarness.stats()?.presented>3,{},{timeout:12000});
      result.video=await page.evaluate(()=>window.clarityHarness.stats());
    }catch(error){result.error=String(error);}finally{await browser?.close();results.push(result);}
  }
}finally{await server.close();await mkdir(output,{recursive:true});await writeFile(`${output}/browser-validation.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}
