import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
const tag=process.argv[2]??'improved',extension=resolve(process.argv[3]??'dist');
const target=process.env.VIDEO_URL??'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--autoplay-policy=no-user-gesture-required']});
const report={tag,url:target,date:new Date().toISOString(),browser:context.browser()?.version(),verifiedEnhancedPixels:false};
try {
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:10000});
  let settings={enabled:true,adaptive:false,profile:'balanced',engine:'balanced',scale:'auto',sharpness:40,denoise:20,automaticStrength:false,comparison:true,divider:.5,contentMode:'natural',original:false};
  const set=async patch=>{settings={...settings,...patch};await worker.evaluate(s=>chrome.storage.local.set({'clarity.settings.v1':s}),settings);};await set({});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
  const reject=page.getByRole('button',{name:/Reject all|모두 거부/}).first();if(await reject.isVisible())await reject.click();
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2,{},{timeout:30000});
  // Reapply after first-install listeners settle; the v1 worker rewrites defaults.
  await set({});await page.waitForTimeout(300);
  await page.locator('video').first().evaluate(async v=>{v.muted=true;v.loop=true;v.currentTime=3;await v.play();});
  const tabs=await worker.evaluate(()=>chrome.tabs.query({active:true,currentWindow:true}));const stats=()=>worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'clarity:stats'}),tabs[0].id);
  await page.waitForTimeout(3500);
  report.playback=await stats();
  report.coverage=await page.evaluate(async()=>{
    let visibleMs=0,totalMs=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now(),c=document.querySelector('.clarity-gpu-overlay');const dt=now-last;totalMs+=dt;if(c&&c.style.display!=='none')visibleMs+=dt;last=now;},4);
    await new Promise(r=>setTimeout(r,5000));clearInterval(timer);return {sampleMs:totalMs,enhancedVisiblePercent:visibleMs/totalMs*100};
  });
  report.afterPlayback=await stats();
  await page.locator('video').first().evaluate(v=>v.pause());await page.waitForTimeout(450);
  await page.addStyleTag({content:'.ytp-chrome-bottom,.ytp-chrome-top,.ytp-gradient-bottom,.ytp-gradient-top,.ytp-pause-overlay{visibility:hidden!important}'});
  try{
    const source=await page.locator('video').first().evaluate(v=>{const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL();});
    await mkdir('docs/review',{recursive:true});await writeFile(`docs/review/${tag}-youtube-source.png`,Buffer.from(source.split(',')[1],'base64'));
  }catch(error){report.sourceCaptureError=String(error);}
  const overlay=page.locator('.clarity-gpu-overlay');
  if(await overlay.isVisible()){
    const box=await overlay.boundingBox(),clip={x:Math.ceil(box.x),y:Math.ceil(box.y),width:Math.floor(box.width)-2,height:Math.floor(box.height)-50};
    const capture=()=>page.screenshot({clip});const split=await capture();
    await overlay.evaluate(c=>{c.style.visibility='hidden';});const raw=await capture();await overlay.evaluate(c=>{c.style.visibility='visible';});
    async function difference(a,b){return page.evaluate(async({a,b})=>{
      const images=await Promise.all([a,b].map(bytes=>createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}))));
      const c=document.createElement('canvas');c.width=images[0].width;c.height=images[0].height;const ctx=c.getContext('2d',{willReadFrequently:true});
      const pixels=images.map(image=>{ctx.drawImage(image,0,0);image.close();return ctx.getImageData(0,0,c.width,c.height).data;});
      let left=0,right=0,lc=0,rc=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(Math.abs(x-c.width/2)<6)continue;const i=(y*c.width+x)*4;const d=Math.abs(pixels[0][i]-pixels[1][i])+Math.abs(pixels[0][i+1]-pixels[1][i+1])+Math.abs(pixels[0][i+2]-pixels[1][i+2]);if(x<c.width/2){left+=d;lc+=3;}else{right+=d;rc+=3;}}
      return {left:left/lc,right:right/rc,total:left+right};
    },{a:Array.from(a),b:Array.from(b)});}
    report.compositor=await difference(split,raw);report.verifiedEnhancedPixels=report.compositor.left<8&&report.compositor.right>.05&&report.compositor.right<30;
    await mkdir('docs/review',{recursive:true});await writeFile(`docs/review/${tag}-youtube-split.png`,split);await writeFile(`docs/review/${tag}-youtube-original.png`,raw);
    const variants=[];
    for(const [name,patch] of [['no-sharpen',{comparison:false,original:false,sharpness:0,denoise:0,contentMode:'natural'}],['sharpen',{sharpness:70}],['denoise',{sharpness:0,denoise:80}],['natural',{sharpness:0,denoise:0,contentMode:'natural'}],['animation',{contentMode:'animation'}],['fast',{engine:'fast',contentMode:'natural'}],['original',{engine:'balanced',original:true}]]){
      await set(patch);await page.waitForTimeout(350);if(await overlay.isVisible()){variants.push({name,png:await capture(),stats:await stats()});}
    }
    report.settingsChanges=[];
    for(const v of variants){report.settingsChanges.push({name:v.name,differenceFromNoSharpen:await difference(v.png,variants[0].png),stats:v.stats});await writeFile(`docs/review/${tag}-youtube-${v.name}.png`,v.png);}
  }
  report.errors=errors;
  report.video=await page.locator('video').first().evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,paused:v.paused,mediaKeys:!!v.mediaKeys}));
}catch(error){report.error=String(error);}finally{await context.close();await mkdir('docs/review',{recursive:true});await writeFile(`docs/review/${tag}-youtube.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
