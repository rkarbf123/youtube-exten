import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir,writeFile } from 'node:fs/promises';
const extension=resolve('dist');
const output=process.argv[2]??'docs';
const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--autoplay-policy=no-user-gesture-required']});
const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',verifiedEnhancedPixels:false};
try{
  report.browserVersion=context.browser()?.version();
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({'clarity.settings.v1':{enabled:true,adaptive:true,profile:'balanced',engine:'auto',scale:'auto',sharpness:40,denoise:20,automaticStrength:true,comparison:true,divider:.5}}));
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:30000});}catch(error){report.navigationError=String(error);}
  const reject=page.getByRole('button',{name:/Reject all|모두 거부/}).first();if(await reject.isVisible())await reject.click();
  await page.waitForTimeout(12000);
  report.title=await page.title();
  report.video=await page.locator('video').first().evaluate(async video=>{
    video.muted=true;await video.play().catch(()=>{});return {width:video.videoWidth,height:video.videoHeight,readyState:video.readyState,paused:video.paused,mediaKeys:!!video.mediaKeys};
  }).catch(error=>({error:String(error)}));
  await page.waitForTimeout(5000);
  const tabs=await worker.evaluate(()=>chrome.tabs.query({active:true,currentWindow:true}));
  report.stats=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'clarity:stats'}),tabs[0]?.id).catch(error=>({error:String(error)}));
  if(report.stats.presented>0){
    await page.locator('video').first().evaluate(video=>video.pause());await page.waitForTimeout(500);
    const canvas=page.locator('.clarity-gpu-overlay');
    report.pixelEvidence={displayed:await canvas.isVisible(),method:'Compositor screenshots of paused video; comparison left side unenhanced, right side processed.'};
    if(report.pixelEvidence.displayed){
      const box=await canvas.boundingBox();const clip={x:Math.ceil(box.x),y:Math.ceil(box.y),width:Math.floor(box.width)-2,height:Math.floor(box.height)-40};
      const a=await page.screenshot({clip});
      await canvas.evaluate(c=>{c.style.visibility='hidden';});const b=await page.screenshot({clip});await canvas.evaluate(c=>{c.style.visibility='visible';});
      const differences=await page.evaluate(async({a,b})=>{
        const images=await Promise.all([a,b].map(bytes=>createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}))));
        const copy=document.createElement('canvas');copy.width=images[0].width;copy.height=images[0].height;const ctx=copy.getContext('2d',{willReadFrequently:true});
        const pixels=images.map(image=>{ctx.drawImage(image,0,0);image.close();return ctx.getImageData(0,0,copy.width,copy.height).data;});
        let left=0,right=0,lc=0,rc=0;
        for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++){if(Math.abs(x-copy.width/2)<5)continue;const i=(y*copy.width+x)*4;const d=Math.abs(pixels[0][i]-pixels[1][i])+Math.abs(pixels[0][i+1]-pixels[1][i+1])+Math.abs(pixels[0][i+2]-pixels[1][i+2]);if(x<copy.width/2){left+=d;lc+=3;}else{right+=d;rc+=3;}}
        return {leftMeanChannelDifference:left/lc,rightMeanChannelDifference:right/rc,absoluteChannelDifference:left+right};
      },{a:Array.from(a),b:Array.from(b)});
      report.pixelEvidence={...report.pixelEvidence,...differences,overlayRect:box};
      report.verifiedEnhancedPixels=differences.leftMeanChannelDifference<8&&differences.rightMeanChannelDifference>.05&&differences.rightMeanChannelDifference<30;
      await mkdir(output,{recursive:true});await writeFile(`${output}/youtube-enhanced.png`,a);await writeFile(`${output}/youtube-original.png`,b);
      const checks=[];
      const layout=async name=>{
        await page.waitForTimeout(200);
        let ready=true;try{await page.waitForFunction(()=>{
          const v=document.querySelector('video'),c=document.querySelector('.clarity-gpu-overlay');if(!v||v.seeking||v.readyState<2||!c||getComputedStyle(c).display==='none')return false;
          const r=v.getBoundingClientRect(),o=c.getBoundingClientRect(),fit=Math.min(r.width/v.videoWidth,r.height/v.videoHeight),w=v.videoWidth*fit,h=v.videoHeight*fit;
          return Math.abs(o.x-(r.x+(r.width-w)/2))<2&&Math.abs(o.y-(r.y+(r.height-h)/2))<2&&Math.abs(o.width-w)<2&&Math.abs(o.height-h)<2;
        },{},{timeout:6000});}catch{ready=false;}
        checks.push({name,processedVisible:ready,...await page.evaluate(()=>{const v=document.querySelector('video').getBoundingClientRect(),c=document.querySelector('.clarity-gpu-overlay')?.getBoundingClientRect();return {video:{x:v.x,y:v.y,width:v.width,height:v.height},overlay:c?{x:c.x,y:c.y,width:c.width,height:c.height}:null,fullscreen:!!document.fullscreenElement};})});
      };
      await layout('standard');
      const theater=page.locator('.ytp-size-button').first();if(await theater.isVisible()){await theater.click();await layout('theater');await theater.click();}
      const full=page.locator('.ytp-fullscreen-button').first();if(await full.isVisible()){await full.click();await layout('fullscreen');await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});}
      await page.locator('video').first().evaluate(async video=>{video.currentTime=5;video.playbackRate=1.25;await video.play();});await layout('seek and playback speed 1.25x');
      await page.setViewportSize({width:1280,height:850});await layout('window resize');
      report.layoutChecks=checks;
    }
  }
  report.errors=errors;
  await mkdir(output,{recursive:true});await page.screenshot({path:`${output}/youtube-check.png`,fullPage:false});
}catch(error){report.error=String(error);}finally{await context.close();await mkdir(output,{recursive:true});await writeFile(`${output}/youtube-validation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
