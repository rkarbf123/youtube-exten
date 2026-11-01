import {WebGPUEngine} from '../gpu/WebGPUEngine';
import {WebGLEngine} from '../gpu/WebGLEngine';
import {resolveTargetDimensions} from '../adaptive/Resolution';
import type {Dimensions,RenderOptions,UpscaleEngine} from '../shared/types';
import common11 from '../../tests/fixtures/v1.1/common.wgsl?raw';
import denoise11 from '../../tests/fixtures/v1.1/denoise.wgsl?raw';
import upscale11 from '../../tests/fixtures/v1.1/upscale.wgsl?raw';
import composite11 from '../../tests/fixtures/v1.1/composite.wgsl?raw';
const dims=(w:number,h:number):Dimensions=>({source:{width:w,height:h},processing:{width:w,height:h},output:{width:w,height:h},display:{width:w,height:h},css:{width:w,height:h},screen:null,limited:false});
const canvas=(w:number,h:number)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const options:RenderOptions={engine:'balanced',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100};
async function pixels(engine:UpscaleEngine,target:HTMLCanvasElement,source:HTMLCanvasElement,d:Dimensions,opts:RenderOptions):Promise<Uint8ClampedArray>{await engine.render(source,d,opts);await engine.present(engine instanceof WebGPUEngine?'full':'none');if(engine instanceof WebGPUEngine)return engine.lastPixels!;const c=canvas(d.output.width,d.output.height),ctx=c.getContext('2d')!;ctx.drawImage(target,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
export async function runColorChecks(backend:'webgpu'|'webgl2'='webgpu'){
  const out=canvas(1,1),engine=backend==='webgpu'?await WebGPUEngine.create(out,()=>{}):new WebGLEngine(out,()=>{}),source=canvas(8,8),ctx=source.getContext('2d')!;const results=[];
  try{ctx.fillStyle='rgb(64,128,192)';ctx.fillRect(0,0,8,8);for(const control of ['saturation','brightness'] as const)for(const value of [0,50,100,150,200]){const p=await pixels(engine,out,source,dims(8,8),{...options,[control]:value});results.push({control,value,rgb:Array.from(p.slice(0,3))});}return {backend,results};}finally{engine.destroy();}
}
export async function runMotionChecks(){
  const out=canvas(1,1),engine=await WebGPUEngine.create(out,()=>{});const a=canvas(128,72),b=canvas(128,72);
  function draw(c:HTMLCanvasElement,x:number){const ctx=c.getContext('2d')!;ctx.fillStyle='#101010';ctx.fillRect(0,0,128,72);ctx.fillStyle='#eeeeee';ctx.fillRect(x,24,32,24);}
  try{
    draw(a,24);draw(b,32);await engine.captureFrame(a,{width:128,height:72},0,{width:128,tier:1});const pair=await engine.captureFrame(b,{width:128,height:72},1/24,{width:128,tier:1});
    const results=[];
    for(const phase of [0,.25,.5,.75,1]){await engine.renderTemporal(dims(128,72),options,phase);await engine.present('full');const p=engine.lastPixels!;let sum=0,weight=0;for(let y=0;y<72;y++)for(let x=0;x<128;x++){const w=Math.max(0,p[(y*128+x)*4]-16);sum+=(x+.5)*w;weight+=w;}let fullPixelHash=2166136261;for(const value of p)fullPixelHash=Math.imul(fullPixelHash^value,16777619);results.push({phase,centroid:sum/weight,expected:40+8*phase,signature:engine.lastSignature,fullPixelHash:fullPixelHash>>>0});}
    b.getContext('2d')!.fillStyle='white';b.getContext('2d')!.fillRect(0,0,128,72);const cut=await engine.captureFrame(b,{width:128,height:72},2/24,{width:128,tier:1});await engine.renderTemporal(dims(128,72),options,.5);await engine.present('full');
    return {pair,results,sceneCut:cut.sceneCut,cutPixel:Array.from(engine.lastPixels!.slice(0,3))};
  }finally{engine.destroy();}
}
export async function runResolutionChecks(){
  const out=canvas(1,1),engine=await WebGPUEngine.create(out,()=>{});const results=[];
  try{for(const [height,choice] of [[480,'720p'],[720,'1080p'],[1080,'1440p'],[1440,'2160p']] as const){const w=height*16/9,source=canvas(Math.round(w),height);source.getContext('2d')!.fillStyle='#4080c0';source.getContext('2d')!.fillRect(0,0,source.width,source.height);const d=resolveTargetDimensions({width:source.width,height},{width:400,height:225},1,choice,engine.maxDimension,engine.maxPixels);await engine.render(source,d,{...options,upscale:true});await engine.present('pixel');results.push({source:d.source,target:choice,actual:{width:out.width,height:out.height},pixel:Array.from(engine.lastPixels!),estimatedBytes:d.estimatedBytes});}return results;}finally{engine.destroy();}
}
export async function runMotionMatrix(){
  const out=canvas(1,1),engine=await WebGPUEngine.create(out,()=>{}),a=canvas(128,72),b=canvas(128,72),rows=[];
  const draw=(c:HTMLCanvasElement,x:number)=>{const ctx=c.getContext('2d')!;ctx.fillStyle='#101010';ctx.fillRect(0,0,128,72);ctx.fillStyle='#eeeeee';ctx.fillRect(x,24,32,24);};draw(a,24);draw(b,32);
  const png=(p:Uint8ClampedArray)=>{const c=canvas(128,72);c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p),128,72),0,0);return c.toDataURL();};
  try{for(const source of [24,30,60])for(const target of [75,100,120]){
    engine.resetTemporal();await engine.captureFrame(a,{width:128,height:72},0,{width:128,tier:1});await engine.captureFrame(b,{width:128,height:72},1/source,{width:128,tier:1});const samples=[];
    for(let tick=0;tick/target<=1/source+1e-6;tick++){
      const alpha=tick*source/target;await engine.renderTemporal(dims(128,72),options,alpha);await engine.present('full');const p=engine.lastPixels!;let weighted=0,weight=0,hash=2166136261,mae=0,blendMAE=0;
      for(let y=0;y<72;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,w=Math.max(0,p[i]-16);weighted+=(x+.5)*w;weight+=w;hash=Math.imul(hash^p[i],16777619);const expected=y>=24&&y<48&&x+.5>=24+8*alpha&&x+.5<56+8*alpha?238:16;const blended=16+(y>=24&&y<48?222*((x>=24&&x<56?1-alpha:0)+(x>=32&&x<64?alpha:0)):0);mae+=Math.abs(p[i]-expected);blendMAE+=Math.abs(blended-expected);}
      samples.push({alpha,centroid:weighted/weight,expected:40+8*alpha,hash:hash>>>0,mae:mae/(128*72),unwarpedBlendMAE:blendMAE/(128*72),image:source===24&&target===75?png(p):undefined});
    }rows.push({source,target,samples});
  }return rows;}finally{engine.destroy();}
}
export async function runV11Benchmark(){
  const before=await WebGPUEngine.create(canvas(1,1),()=>{},{common:common11,denoise:denoise11,upscale:upscale11,composite:composite11}),after=await WebGPUEngine.create(canvas(1,1),()=>{}),source=canvas(640,360),ctx=source.getContext('2d')!;
  const image=ctx.createImageData(640,360);for(let i=0;i<image.data.length;i++)image.data[i]=i%4===3?255:(i*37+(i%17)*19)%256;ctx.putImageData(image,0,0);
  const d={...dims(1920,1080),source:{width:640,height:360}},opts={...options,upscale:true,sharpness:.25,denoise:.15};const rows:{version:string;times:number[];median:number;p95:number}[]=[];
  try{for(const [version,engine]of [['1.1',before],['1.2',after]] as const){const times=[];for(let i=0;i<50;i++){const began=performance.now();await engine.render(source,d,opts);await engine.present();if(i>=10)times.push(performance.now()-began);}const sorted=[...times].sort((a,b)=>a-b);rows.push({version,times,median:sorted[20],p95:sorted[38]});}
    await before.render(source,d,opts);await before.present('full');await after.render(source,d,opts);await after.present('full');let changed=0;for(let i=0;i<before.lastPixels!.length;i++)if(before.lastPixels![i]!==after.lastPixels![i])changed++;
    return {method:'same current host, frozen v1.1 shaders vs v1.2 shaders; interpolation off; neutral color; 640x360→1920x1080; 10 warmup, 40 measurements; wall completion including CPU/queue/GPU',rows,changedChannels:changed};
  }finally{before.destroy();after.destroy();}
}
export async function runPipelineCombinations(){
  const out=canvas(1,1),engine=await WebGPUEngine.create(out,()=>{}),source=canvas(8,8),ctx=source.getContext('2d')!,results=[];ctx.fillStyle='rgb(64,128,192)';ctx.fillRect(0,0,8,8);
  try{await engine.captureFrame(source,{width:8,height:8},0,{width:8,tier:0});await engine.captureFrame(source,{width:8,height:8},1/30,{width:8,tier:0});
    for(const motion of [false,true])for(const upscale of [false,true])for(const color of [false,true]){const d=upscale?{...dims(16,16),source:{width:8,height:8}}:dims(8,8),opts={...options,upscale,saturation:color?0:100,brightness:100};if(motion)await engine.renderTemporal(d,opts,.5);else await engine.render(source,d,opts);await engine.present('pixel');results.push({motion,upscale,color,size:{width:out.width,height:out.height},pixel:Array.from(engine.lastPixels!)});}return results;
  }finally{engine.destroy();}
}
