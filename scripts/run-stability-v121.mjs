import {spawn} from 'node:child_process';import {createWriteStream} from 'node:fs';import {writeFile} from 'node:fs/promises';
const root='docs/v1.2.1/',jobs=[
 ['stability-matrix','scripts/stability-v121.mjs','after','matrix'],
 ['stability-combinations','scripts/stability-v121.mjs','after','combinations'],
 ['stability-long','scripts/stability-v121.mjs','after','long'],
 ['stability-fast','scripts/stability-v121.mjs','after','fast'],
 ['artifacts-final','scripts/artifacts-v121.mjs'],
 ['stream-capture','scripts/capture-v121.mjs'],
 ['ablation','scripts/ablation-v121.mjs'],
 ['baseline-retry','scripts/benchmark-v121.mjs','baseline','retry'],
 ['initial-performance-summary','scripts/summarize-v121.mjs'],
 ['browser-validation','scripts/verify-browsers.mjs','docs/v1.2.1'],
 ['youtube-v121','scripts/verify-v121-youtube.mjs'],
 ['youtube-validation','scripts/verify-youtube.mjs','docs/v1.2.1']
],results=[];
for(const [name,...args] of jobs){console.log(`START ${name} ${new Date().toISOString()}`);const log=createWriteStream(root+name+'.log'),start=Date.now();const exit=await new Promise(resolve=>{const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.on('data',b=>{log.write(b);process.stdout.write(b);});child.stderr.on('data',b=>{log.write(b);process.stderr.write(b);});child.on('error',e=>{log.write(String(e));resolve(-1);});child.on('exit',code=>resolve(code));});await new Promise(resolve=>log.end(resolve));results.push({name,args,start:new Date(start).toISOString(),elapsedMs:Date.now()-start,exit});await writeFile(root+'stability-validation-status.json',JSON.stringify(results,null,2));console.log(`END ${name} exit=${exit}`);}
if(results.some(r=>r.exit!==0))process.exitCode=1;
