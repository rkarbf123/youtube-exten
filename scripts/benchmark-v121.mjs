import {chromium} from '@playwright/test';
import {preview} from 'vite';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
const variant=process.argv[2]??'baseline',suite=process.argv[3]??'probe';
const output='docs/v1.2.1';await mkdir(output+'/inputs-v2',{recursive:true});
const server=await preview({build:{outDir:variant==='baseline'?'docs/v1.2.1/baseline-instrumented':'dist'},preview:{host:'127.0.0.1',port:5185,strictPort:true}});
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const report={variant,suite,date:new Date().toISOString(),browser:browser.version(),headless:true,warmupSeconds:3,observationSeconds:10,rows:[]};
const cases=suite==='static'?[{height:720,source:60,target:100,diagnostic:true},{height:720,source:60,target:120,diagnostic:true}]:suite==='retry'?JSON.parse((await readFile(output+'/baseline-matrix.json','utf8')).replace(/^\\uFEFF/,'')).rows.filter(x=>x.error).map(({height,source,target,diagnostic})=>({height,source,target,diagnostic})):suite==='repeat'?Array.from({length:3},(_,repeat)=>({height:720,source:60,target:120,diagnostic:false,repeat})):suite==='signature'?[{height:144,source:60,target:120,diagnostic:true,signatures:true}]:suite==='matrix'?[...[144,360,720,1080,1440].flatMap(height=>[24,30,60].flatMap(source=>[75,100,120].map(target=>({height,source,target,diagnostic:false})))),...[144,360,720,1080,1440].map(height=>({height,source:60,target:120,diagnostic:true}))]:suite==='sustain'?[{height:720,source:60,target:120,diagnostic:false,seconds:60}]:[{height:144,source:60,target:120,diagnostic:true},{height:144,source:60,target:120,diagnostic:false},{height:144,source:24,target:120,diagnostic:true}];
const summary=values=>{const a=[...values].sort((x,y)=>x-y);return {mean:values.reduce((s,x)=>s+x,0)/values.length,p50:a[Math.floor(a.length*.5)],p10:a[Math.floor(a.length*.1)],p01:a[Math.floor(a.length*.01)],p95:a[Math.floor(a.length*.95)]};};
try{
 for(const c of cases){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(()=>{const active=new Set(),create=GPUDevice.prototype.createTexture,destroy=GPUTexture.prototype.destroy;let created=0,maximum=0;GPUDevice.prototype.createTexture=function(d){const texture=create.call(this,d);active.add(texture);created++;maximum=Math.max(maximum,active.size);return texture;};GPUTexture.prototype.destroy=function(){active.delete(this);destroy.call(this);};window.benchResources=()=>({active:active.size,created,maximum});});
   await page.goto('http://127.0.0.1:5185/harness/');if(!report.adapter)report.adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter(/^Win/i.test(navigator.platform)?undefined:{powerPreference:'low-power'});return a?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description,features:[...a.features]}:null;});const width=Math.round(c.height*16/9),file=output+`/inputs-v2/${width}x${c.height}-${c.source}.webm`;
   try{await access(file);}catch{const data=await page.evaluate(async({width,height,source})=>window.clarityPerf.makeClip(width,height,source),{width,height:c.height,source:c.source});await writeFile(file,Buffer.from(data));}
   const bytes=await readFile(file);await page.route('**/bench-input.webm*',route=>route.fulfill({body:bytes,contentType:'video/webm'}));
   await page.evaluate(c=>{window.clarityPerf.configure(c.diagnostic,c.signatures===true);window.clarityPerf.load('/bench-input.webm?case='+Math.random(),{targetFPS:String(c.target),targetResolution:'original',comparison:false,original:false,adaptive:false,engine:'fast',sharpness:0,denoise:0,saturation:100,brightness:100});},c);
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2&&window.clarityHarness.stats()?.temporal,{},{timeout:15000});await page.waitForTimeout(3000);
   const begin=await page.evaluate(()=>{window.clarityPerf.reset();return {time:performance.now(),stats:window.clarityHarness.stats()};});const samples=[];let previous=begin;
   const until=Date.now()+(c.seconds??10)*1000;
   while(Date.now()<until){await page.waitForTimeout(250);const sample=await page.evaluate(()=>({time:performance.now(),stats:window.clarityHarness.stats()}));sample.fps=(sample.stats.temporal.submitted-previous.stats.temporal.submitted)*1000/(sample.time-previous.time);samples.push(sample);previous=sample;}
   const end=await page.evaluate(()=>({time:performance.now(),stats:window.clarityHarness.stats(),profile:window.clarityPerf.snapshot(),resources:window.benchResources()}));
   const row={...c,width,elapsedMs:end.time-begin.time,meanSubmittedFPS:(end.stats.temporal.submitted-begin.stats.temporal.submitted)*1000/(end.time-begin.time),fps:summary(samples.map(x=>x.fps)),generated:end.stats.temporal.generated-begin.stats.temporal.generated,visible:summary(samples.map(x=>x.stats.metrics.enhancedVisiblePercent)),delay:summary(samples.map(x=>x.stats.temporal.delayMs)),sourceFPS:summary(samples.map(x=>x.stats.metrics.sourceFPS??0)),profile:end.profile,finalStats:end.stats,errors,samples};
   row.resources=end.resources;report.rows.push(row);console.log(JSON.stringify({variant,...c,fps:row.meanSubmittedFPS,generated:row.generated,visible:row.visible.mean,gpu:row.profile.stages['gpu.flowMs']?.mean,wait:row.profile.stages.signatureReadbackWaitMs?.mean,drops:row.profile.counters}));
  }catch(error){report.rows.push({...c,error:String(error),errors});console.log(JSON.stringify({variant,...c,error:String(error)}));}
  finally{await page.close();await writeFile(`${output}/${variant}-${suite}.json`,JSON.stringify(report,null,2));}
 }
}finally{await browser.close();await server.close();}



