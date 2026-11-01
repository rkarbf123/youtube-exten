import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/v1.2';await mkdir(output,{recursive:true});const extension=resolve('dist');
const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--autoplay-policy=no-user-gesture-required']});
const report={date:new Date().toISOString(),browser:context.browser()?.version(),cases:[]};
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 for(const id of ['jNQXAC9IVRw','aqz-KE-bpKQ','YE7VzlLtp-4']){
  const row={url:'https://www.youtube.com/watch?v='+id,errors:[]};report.cases.push(row);
  try{
   await worker.evaluate(()=>chrome.storage.local.set({'clarity.settings.v1':{enabled:true,adaptive:true,engine:'auto',profile:'balanced',targetResolution:'1080p',targetFPS:'100',saturation:100,brightness:100,comparison:false}}));
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
   try{await page.goto(row.url,{waitUntil:'domcontentloaded',timeout:30000});}catch(e){row.navigationError=String(e);}
   const reject=page.getByRole('button',{name:/Reject all|모두 거부/}).first();if(await reject.isVisible())await reject.click();
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.videoWidth>0;},{},{timeout:25000});
   await page.locator('video').first().evaluate(async v=>{v.muted=true;await v.play();});await page.waitForTimeout(9000);
   row.title=await page.title();row.video=await page.locator('video').first().evaluate(v=>({width:v.videoWidth,height:v.videoHeight,paused:v.paused,mediaKeys:!!v.mediaKeys,time:v.currentTime,quality:v.getVideoPlaybackQuality().totalVideoFrames}));
   const tabs=await worker.evaluate(()=>chrome.tabs.query({active:true,currentWindow:true}));const tab=tabs[0].id;
   const stats=()=>worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'clarity:stats'}),tab);
   row.motion=await stats();
   await worker.evaluate(()=>chrome.storage.local.set({'clarity.settings.v1':{enabled:true,adaptive:true,engine:'auto',profile:'balanced',targetResolution:'1080p',targetFPS:'original',saturation:0,brightness:100,comparison:false}}));
   await page.waitForTimeout(1500);await page.locator('video').first().evaluate(v=>v.pause());await page.waitForTimeout(350);row.color=await stats();
   if(!row.video.mediaKeys&&await page.locator('.clarity-gpu-overlay').isVisible()){
    const box=await page.locator('.clarity-gpu-overlay').boundingBox();const clip={x:Math.ceil(box.x+10),y:Math.ceil(box.y+10),width:Math.floor(box.width-20),height:Math.floor(box.height-65)};
    const enhanced=await page.screenshot({clip});await page.locator('.clarity-gpu-overlay').evaluate(c=>{c.style.visibility='hidden';});const original=await page.screenshot({clip});await page.locator('.clarity-gpu-overlay').evaluate(c=>{c.style.visibility='visible';});
    row.chroma=await page.evaluate(async({a,b})=>{const values=[];for(const bytes of [a,b]){const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let sum=0;for(let i=0;i<p.length;i+=4)sum+=Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2]);values.push(sum/(p.length/4));image.close();}return {processedMeanChroma:values[0],sourceMeanChroma:values[1]};},{a:[...enhanced],b:[...original]});
    await writeFile(`${output}/youtube-${id}-gray.png`,enhanced);await writeFile(`${output}/youtube-${id}-source.png`,original);
   }
   await page.screenshot({path:`${output}/youtube-${id}.png`});await page.close();
  }catch(e){row.error=String(e);}
 }
}finally{await context.close();await writeFile(`${output}/youtube-v12.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
