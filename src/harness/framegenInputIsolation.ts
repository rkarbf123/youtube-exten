import {FramegenSession} from '../ai/FramegenSession';
import {FramegenSurfaces} from './framegenDiagnostics';
interface Frame{ id:string;pts:number;sha256:string }
interface Source{name:string;width:number;height:number;frames:Frame[];url:string}
interface Pair{id:string;a:number;c:number;truth:number|null;ptsA:number;ptsC:number;outputPTS:number;t:number;inputFPS:number}
interface Config{source:Source;pairs:Pair[];mode:'offline'|'realtime';probes?:boolean}
interface Dependencies{read:(d:GPUDevice,t:GPUTexture)=>Promise<Uint8ClampedArray>;renderer:(d:GPUDevice,c:HTMLCanvasElement)=>Promise<(t:GPUTexture)=>void>}
const digest=async(b:Uint8ClampedArray)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(b).buffer)),x=>x.toString(16).padStart(2,'0')).join('');
function png(b:Uint8ClampedArray,w:number,h:number){const c=Object.assign(document.createElement('canvas'),{width:w,height:h});c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b),w,h),0,0);return c.toDataURL();}
/** Diagnostic replay, not a replacement for the production scheduler. */
export function installFramegenInputIsolation(deps:Dependencies){
 async function run(config:Config){
  const {source,mode}=config;const stage=(s:string)=>console.info('[input-isolation]',mode,s);stage('fetch');const bytes=await(await fetch(source.url)).arrayBuffer(),stride=source.width*source.height*4;stage('input-ready');
  if(bytes.byteLength!==stride*source.frames.length)throw new Error('Decoded frame store size mismatch');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('WebGPU unavailable');const d=await adapter.requestDevice({requiredFeatures:['shader-f16']}),errors:string[]=[];d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
  stage('runtime-create');const session=await FramegenSession.create(d,source.width,source.height);stage('runtime-ready');const surface=await FramegenSurfaces.create(d,source.width,source.height),canvas=document.querySelector('canvas')!;canvas.width=source.width;canvas.height=source.height;const show=mode==='realtime'?await deps.renderer(d,canvas):undefined;
  const pixels=(index:number)=>new Uint8Array(bytes,index*stride,stride),upload=(index:number,t:GPUTexture)=>{
   if(mode==='offline'){d.queue.writeTexture({texture:t},pixels(index),{bytesPerRow:source.width*4},[source.width,source.height]);return;}
   const frame=new VideoFrame(pixels(index),{format:'RGBA',codedWidth:source.width,codedHeight:source.height,timestamp:Math.round(source.frames[index].pts*1e6),colorSpace:{primaries:'bt709',transfer:'iec61966-2-1',matrix:'rgb',fullRange:true}});
   try{d.queue.copyExternalImageToTexture({source:frame},{texture:t,colorSpace:'srgb'},[source.width,source.height]);}finally{frame.close();}
  };
  const rows:{pair:Pair;submittedAt:number;dueAt:number;completedAt:number;completionMs:number;inputA:Uint8ClampedArray;inputC:Uint8ClampedArray;output:Uint8ClampedArray;kind:string}[]=[],jobs:Promise<void>[]=[],discarded:{pairID:string;reason:string}[]=[];let pending=0,maxPending=0,canvasSubmissions=0;
  function submit(pair:Pair,index:number,dueAt:number,kind='mid'){
   const ta=surface.inputs[index%3],tc=surface.inputs[(index+1)%3],start=performance.now();upload(pair.a,ta);upload(pair.c,tc);
   // Queue copies before reusing the pool. The GPU snapshot, not only its CPU
   // source descriptor, is hashed in each path to prove identical A/C bytes.
   const A=deps.read(d,ta),C=deps.read(d,tc);session.runtime.prepPair(ta,tc);session.runtime.runT(pair.t,surface.output);show?.(surface.output);if(show)canvasSubmissions++;
   const output=deps.read(d,surface.output);pending++;maxPending=Math.max(maxPending,pending);const submittedAt=performance.now();
   const job=Promise.all([A,C,output]).then(([inputA,inputC,output])=>{const completedAt=performance.now();rows.push({pair,submittedAt,dueAt,completedAt,completionMs:completedAt-start,inputA,inputC,output,kind});}).finally(()=>pending--);jobs.push(job);void job.catch(()=>{});return job;
  }
  try{
   // Same one-pair warmup in both instances; excluded from measured outputs.
   stage('warmup');const first=config.pairs[0];upload(first.a,surface.inputs[0]);upload(first.c,surface.inputs[1]);session.runtime.prepPair(surface.inputs[0],surface.inputs[1]);session.runtime.runT(first.t,surface.output);await d.queue.onSubmittedWorkDone();stage('warmup-ready');
   if(mode==='offline'){for(let i=0;i<config.pairs.length;i++)await submit(config.pairs[i],i,performance.now());}
   else{const epoch=performance.now()+50,firstC=config.pairs[0].ptsC;let index=0;await new Promise<void>((resolve,reject)=>{function tick(now:number){try{while(index<config.pairs.length&&now>=epoch+(config.pairs[index].ptsC-firstC)*1000){const p=config.pairs[index],due=epoch+(p.ptsC-firstC)*1000;if(pending>=3)discarded.push({pairID:p.id,reason:'bounded GPU queue full'});else void submit(p,index,due);index++;}if(index<config.pairs.length)requestAnimationFrame(tick);else resolve();}catch(e){reject(e);}}requestAnimationFrame(tick);});await Promise.all(jobs);}
   if(config.probes&&mode==='offline')for(let i=0;i<config.pairs.length;i++){const p=config.pairs[i];for(const t of [.001,.999])await submit({...p,id:p.id+`/endpoint-${t}`,t,outputPTS:p.ptsA+(p.ptsC-p.ptsA)*t},i,performance.now(),t<.5?'near-A':'near-C');}
   stage('gpu-ready');const serialized=[];for(const row of rows){const {inputA,inputC,output,...r}=row;const [a,c,o]=await Promise.all([digest(inputA),digest(inputC),digest(output)]);serialized.push({...r,inputFrameA:source.frames[r.pair.a].id,inputFrameC:source.frames[r.pair.c].id,inputHashA:a,inputHashC:c,inputMatchesDecodedA:a===source.frames[r.pair.a].sha256,inputMatchesDecodedC:c===source.frames[r.pair.c].sha256,outputHash:o,outputEqualsEndpoint:o===a||o===c,image:png(output,source.width,source.height),submitLatenessMs:Math.max(0,r.submittedAt-r.dueAt)});}stage('serialized');
   return {mode,source:source.name,modelHash:session.modelHash,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture},rows:serialized,discarded,maxPending,canvasSubmissions,errors,rawModelOnly:true,guardApplied:false,postprocessing:false,truthNotUploadedToInference:true,note:'Offline direct RGBA upload versus rAF-paced VideoFrame external-texture upload on independent device/runtime instances. GPU snapshots are compared byte-for-byte. Diagnostic readback overhead is included; not a product FPS benchmark or physical scanout proof.'};
  }finally{await Promise.allSettled(jobs);session.destroy();surface.destroy();await d.queue.onSubmittedWorkDone();d.destroy();}
 }
 window.framegenInputIsolation=run;
 return run;
}
declare global{interface Window{framegenInputIsolation:ReturnType<typeof installFramegenInputIsolation>}}
