import {chromium} from '@playwright/test';import {preview} from 'vite';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
const variant=process.argv[2]??'after',suite=process.argv[3]??'quick',root='docs/v1.2.1/';await mkdir(root+'inputs-stability',{recursive:true});
const base={source:60,target:120,diagnostic:true,height:1080,pattern:'motion'};
const cases=suite==='prepare'?[
 {...base,height:144,source:24,pattern:'static'},{...base,height:144,pattern:'held'},{...base,pattern:'fast-cut'},
 {...base,length:65},{...base,height:1440,length:65}
]:suite==='retry-recheck'?[
 {...base,height:1440,target:144},{...base,height:144,source:24,target:48},{...base,height:360,target:144,targetResolution:'original',brightness:100,saturation:150,mode:2}
]:suite==='long-final'?[{...base,height:1440,target:144,length:65,seconds:60,saturation:150,brightness:125}]:suite==='normal'?[1080,1440].map(height=>({...base,height,target:144,diagnostic:false})):suite==='pressure'?[{...base,target:144,length:65,adaptive:true,ackDelayMs:15,seconds:15}]:suite==='flicker'?[
 {...base,height:144,source:24,target:60,pattern:'static'},{...base,height:144,target:144,pattern:'held'},{...base,height:720}
]:suite==='long'?[
 {...base,length:65,seconds:60},{...base,height:1440,target:144,length:65,seconds:60,saturation:150,brightness:125}
]:suite==='low-repeat'?[48,60].flatMap(target=>Array.from({length:2},(_,repeat)=>({...base,height:144,source:24,target,repeat:repeat+1})))
:suite==='combinations'?Array.from({length:6},(_,mode)=>({...base,height:360,target:144,targetResolution:mode>=4?'720p':'original',brightness:[100,125,100,125,100,125][mode],saturation:[100,100,150,150,100,150][mode],mode}))
:suite==='matrix'?[
 ...[75,100,120].map(target=>({...base,height:720,target})),
 ...[1080,1440].flatMap(height=>[120,144].map(target=>({...base,height,target}))),
 ...[{source:24,target:48},{source:24,target:60},{source:30,target:60},{source:30,target:90}].map(c=>({...base,height:144,...c}))
]:suite==='fast'?[{...base,pattern:'fast-cut'}]:[1080,1440].map(height=>({...base,height,target:144}));
const percentile=(array,p)=>{const a=[...array].sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null;};
const summary=a=>({count:a.length,mean:a.length?a.reduce((s,x)=>s+x,0)/a.length:null,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99),max:a.length?Math.max(...a):null});
const report={variant,suite,date:new Date().toISOString(),warmupSeconds:3,observationSeconds:10,rows:[]};
const server=await preview({build:{outDir:variant==='previous'?root+'optimized-dist':'dist'},preview:{host:'127.0.0.1',port:5194,strictPort:true}}),browser=await chromium.launch({channel:'chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});report.browser=browser.version();
try{for(const c of cases){const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>{
   const encoders=new WeakSet(),buffers=new WeakSet(),render=GPUCommandEncoder.prototype.beginRenderPass,finish=GPUCommandEncoder.prototype.finish,submit=GPUQueue.prototype.submit;
   let times=[],shows=0,hides=0,visible=false,active=new Set(),created=0,maximum=0;
   GPUCommandEncoder.prototype.beginRenderPass=function(d){encoders.add(this);return render.call(this,d);};GPUCommandEncoder.prototype.finish=function(d){const b=finish.call(this,d);if(encoders.has(this))buffers.add(b);return b;};
   GPUQueue.prototype.submit=function(iterable){const a=[...iterable];submit.call(this,a);if(a.some(b=>buffers.has(b)))times.push(performance.now());};
   const create=GPUDevice.prototype.createTexture,destroy=GPUTexture.prototype.destroy;GPUDevice.prototype.createTexture=function(d){const t=create.call(this,d);active.add(t);created++;maximum=Math.max(maximum,active.size);return t;};GPUTexture.prototype.destroy=function(){active.delete(this);destroy.call(this);};
   new MutationObserver(()=>{const c=document.querySelector('.clarity-gpu-overlay'),next=!!c&&c.style.display!=='none';if(next!==visible){if(next)shows++;else hides++;visible=next;}}).observe(document,{attributes:true,attributeFilter:['style'],childList:true,subtree:true});
   window.stabilityAudit={reset:()=>{times=[];shows=hides=0;},snapshot:()=>({times,shows,hides,active:active.size,created,maximum})};
  });
  await page.goto('http://127.0.0.1:5194/harness/');if(!report.adapter)report.adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter(/^Win/i.test(navigator.platform)?undefined:{powerPreference:'low-power'});return a?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description,features:[...a.features]}:null;});const width=Math.round(c.height*16/9),length=c.length??16,file=c.pattern==='motion'&&length===16?root+`inputs-v2/${width}x${c.height}-${c.source}.webm`:root+`inputs-stability/${width}x${c.height}-${c.source}-${c.pattern}-${length}.webm`;
  try{await access(file);}catch{if(variant==='previous')throw new Error('Prepare identical inputs with after prepare first');const bytes=await page.evaluate(async c=>window.clarityPerf.makeClip(c.width,c.height,c.source,c.length,c.pattern),{...c,width,length});await writeFile(file,Buffer.from(bytes));console.log('INPUT '+file);}
  if(suite==='prepare')continue;
  const bytes=await readFile(file);await page.route('**/stability-input.webm',r=>r.fulfill({body:bytes,contentType:'video/webm'}));
  await page.evaluate(c=>{window.clarityPerf.configure(c.diagnostic,false);window.clarityPerf.load('/stability-input.webm',{targetFPS:String(c.target),targetResolution:c.targetResolution??'original',comparison:false,original:false,adaptive:c.adaptive===true,engine:c.targetResolution?'balanced':'fast',sharpness:0,denoise:0,saturation:c.saturation??100,brightness:c.brightness??100});},c);
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2&&window.clarityHarness.stats()?.temporal,{},{timeout:15000});await page.waitForTimeout(3000);
  if(c.ackDelayMs)await page.evaluate(delay=>{const done=GPUQueue.prototype.onSubmittedWorkDone;GPUQueue.prototype.onSubmittedWorkDone=function(){return done.call(this).then(()=>new Promise(resolve=>setTimeout(resolve,delay)));};},c.ackDelayMs);
  const begin=await page.evaluate(()=>{window.clarityPerf.reset();window.stabilityAudit.reset();return {time:performance.now(),stats:window.clarityHarness.stats()};}),samples=[];let previous=begin;const until=Date.now()+(c.seconds??10)*1000;
  while(Date.now()<until){await page.waitForTimeout(250);const sample=await page.evaluate(()=>({time:performance.now(),stats:window.clarityHarness.stats()}));sample.fps=(sample.stats.temporal.submitted-previous.stats.temporal.submitted)*1000/(sample.time-previous.time);samples.push(sample);previous=sample;}
  const end=await page.evaluate(()=>({time:performance.now(),stats:window.clarityHarness.stats(),profile:window.clarityPerf.snapshot(),audit:window.stabilityAudit.snapshot(),videoTime:document.querySelector('video').currentTime}));
  const times=end.audit.times;const row={...c,width,elapsedMs:end.time-begin.time,submittedFPS:(end.stats.temporal.submitted-begin.stats.temporal.submitted)*1000/(end.time-begin.time),generated:end.stats.temporal.generated-begin.stats.temporal.generated,generatedFPS:(end.stats.temporal.generated-begin.stats.temporal.generated)*1000/(end.time-begin.time),fps:summary(samples.map(s=>s.fps)),intervals:summary(times.slice(1).map((t,i)=>t-times[i])),visible:summary(samples.map(s=>s.stats.metrics.enhancedVisiblePercent)),audit:{...end.audit,times:undefined},profile:end.profile,stats:end.stats,videoTime:end.videoTime,errors,samples};
  report.rows.push(row);console.log(JSON.stringify({...c,fps:row.submittedFPS,generatedFPS:row.generatedFPS,visible:row.visible.mean,intervals:row.intervals,audit:row.audit,effective:row.stats.temporal.effectiveFPS,gpu:row.profile.stages['gpu.warpMs']?.mean,counters:row.profile.counters}));
 }catch(error){report.rows.push({...c,error:String(error),errors});console.log(JSON.stringify({...c,error:String(error)}));}finally{await page.close();await writeFile(root+`${variant}-stability-${suite}.json`,JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();}
