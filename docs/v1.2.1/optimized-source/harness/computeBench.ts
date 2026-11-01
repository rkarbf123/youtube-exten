import {WebGPUEngine} from '../gpu/WebGPUEngine';
import {WebGPUEngine as BaselineEngine} from '../../tests/fixtures/v1.2/gpu/WebGPUEngine';
import {GpuTimer} from '../gpu/GpuTimer';
import {temporalPerf} from '../temporal/TemporalProfiler';
import type {Dimensions,RenderOptions} from '../shared/types';
export async function classifySmallMotion(variant:'baseline'|'after'){
  temporalPerf.configure(false,false);const out=document.createElement('canvas'),engine=await (variant==='baseline'?BaselineEngine:WebGPUEngine).create(out,()=>{}),rows=[];
  try{for(let x=32;x<40;x++)for(const shift of [0,2]){
    engine.resetTemporal();const a=Object.assign(document.createElement('canvas'),{width:256,height:144}),b=Object.assign(document.createElement('canvas'),{width:256,height:144});
    for(const [c,at]of [[a,x],[b,x+shift]] as const){const ctx=c.getContext('2d')!;ctx.fillStyle='#101010';ctx.fillRect(0,0,256,144);ctx.fillStyle='#eeeeee';ctx.fillRect(at,43,48,48);ctx.fillStyle='#4080c0';ctx.fillRect(at+8,51,16,16);ctx.fillStyle='#80c040';ctx.fillRect(at+28,71,12,12);}
    const pa=a.getContext('2d')!.getImageData(0,0,256,144).data,pb=b.getContext('2d')!.getImageData(0,0,256,144).data;let changed=0;for(let i=0;i<pa.length;i++)if(pa[i]!==pb[i])changed++;
    await engine.captureFrame(a,{width:256,height:144},0,{width:256,tier:1});const p=await engine.captureFrame(b,{width:256,height:144},1/60,{width:256,tier:1});rows.push({x,shift,changedChannels:changed,dynamic:p.dynamic,confidence:p.confidence});
  }return rows;}finally{engine.destroy();}
}
export async function computeOnly(variant:'baseline'|'after',width:number,height:number,seconds=10){
  // Same external timestamp observer for both preserved and current engines.
  const request=GPUAdapter.prototype.requestDevice,create=GPUDevice.prototype.createCommandEncoder,begin=GPUCommandEncoder.prototype.beginComputePass,finish=GPUCommandEncoder.prototype.finish,submit=GPUQueue.prototype.submit;
  let timer:GpuTimer|undefined,scope='capture';const records=new WeakMap<GPUCommandEncoder,{record:ReturnType<GpuTimer['begin']>;scope:string;index:number}>(),buffers=new WeakMap<GPUCommandBuffer,ReturnType<GpuTimer['begin']>>();
  GPUAdapter.prototype.requestDevice=function(d={}){return request.call(this,{...d,requiredFeatures:this.features.has('timestamp-query')?['timestamp-query']:[]});};
  temporalPerf.configure(false,false);const canvas=Object.assign(document.createElement('canvas'),{width:1,height:1});const engine=await (variant==='baseline'?BaselineEngine:WebGPUEngine).create(canvas,()=>{});
  temporalPerf.configure(true,false);const device=(engine as unknown as {device:GPUDevice}).device;temporalPerf.timestampSupported=device.features.has('timestamp-query');timer=new GpuTimer(device);
  GPUDevice.prototype.createCommandEncoder=function(d){const e=create.call(this,d);records.set(e,{record:timer!.begin(),scope,index:0});return e;};
  GPUCommandEncoder.prototype.beginComputePass=function(d={}){const r=records.get(this);return begin.call(this,{...d,timestampWrites:r?.record?.stamp(r.scope+'.pass'+r.index++)});};
  GPUCommandEncoder.prototype.finish=function(d){const r=records.get(this);r?.record?.resolve(this);const b=finish.call(this,d);buffers.set(b,r?.record??null);return b;};
  GPUQueue.prototype.submit=function(items){const a=Array.from(items);submit.call(this,a);for(const b of a)buffers.get(b)?.submitted();};
  const input=Object.assign(document.createElement('canvas'),{width,height}),ctx=input.getContext('2d')!;
  const d:Dimensions={source:{width,height},processing:{width,height},output:{width,height},display:{width,height},css:{width,height},screen:null,limited:false};
  const opts:RenderOptions={engine:'fast',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100};let frames=0;
  try{const warm=performance.now()+2000;while(performance.now()<warm){ctx.fillStyle='#101010';ctx.fillRect(0,0,width,height);ctx.fillStyle='#eeeeee';ctx.fillRect((frames%20)*width/256,height/3,width/4,height/4);scope='capture';await engine.captureFrame(input,{width,height},frames/60,{width:256,tier:1});if(frames>0){scope='warp';await engine.renderTemporal(d,opts,.5);}frames++;}
    temporalPerf.reset();const start=performance.now();let measured=0;while(performance.now()-start<seconds*1000){ctx.fillStyle='#101010';ctx.fillRect(0,0,width,height);ctx.fillStyle='#eeeeee';ctx.fillRect((frames%20)*width/256,height/3,width/4,height/4);scope='capture';await engine.captureFrame(input,{width,height},frames/60,{width:256,tier:1});scope='warp';await engine.renderTemporal(d,opts,.5);frames++;measured++;}await device.queue.onSubmittedWorkDone();return {variant,width,height,seconds,elapsedMs:performance.now()-start,pairs:measured,profile:temporalPerf.snapshot(),note:'compute only; no Canvas present and no output scheduler'};
  }finally{GPUAdapter.prototype.requestDevice=request;GPUDevice.prototype.createCommandEncoder=create;GPUCommandEncoder.prototype.beginComputePass=begin;GPUCommandEncoder.prototype.finish=finish;GPUQueue.prototype.submit=submit;timer.destroy();engine.destroy();}
}
