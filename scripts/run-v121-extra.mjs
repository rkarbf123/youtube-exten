import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {writeFile} from 'node:fs/promises';
const root='docs/v1.2.1/';
const jobs=[
 ['baseline-retry','scripts/benchmark-v121.mjs','baseline','retry'],
 ['baseline-repeat','scripts/benchmark-v121.mjs','baseline','repeat'],
 ['after-repeat','scripts/benchmark-v121.mjs','after','repeat'],
 ['after-signature','scripts/benchmark-v121.mjs','after','signature'],
 ['after-sustain','scripts/benchmark-v121.mjs','after','sustain'],
 ['ablation','scripts/ablation-v121.mjs'],
 ['stream-capture','scripts/capture-v121.mjs'],
 ['browser-validation','scripts/verify-browsers.mjs','docs/v1.2.1'],
 ['youtube-v121','scripts/verify-v121-youtube.mjs'],
 ['youtube-validation','scripts/verify-youtube.mjs','docs/v1.2.1'],
 ['summary','scripts/summarize-v121.mjs'],
 ['final-report','scripts/report-v121-final.mjs']
];
const results=[];
for(const [name,...args] of jobs){
 console.log(`START ${name} ${new Date().toISOString()}`);const log=createWriteStream(root+name+'.log');const start=Date.now();
 const exit=await new Promise(resolve=>{const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.on('data',b=>{log.write(b);process.stdout.write(b);});child.stderr.on('data',b=>{log.write(b);process.stderr.write(b);});child.on('error',e=>{log.write(String(e));resolve(-1);});child.on('exit',code=>resolve(code));});
 await new Promise(resolve=>log.end(resolve));results.push({name,args,start:new Date(start).toISOString(),elapsedMs:Date.now()-start,exit});await writeFile(root+'extra-validation-status.json',JSON.stringify(results,null,2));console.log(`END ${name} exit=${exit}`);
}
if(results.some(r=>r.exit!==0))process.exitCode=1;
