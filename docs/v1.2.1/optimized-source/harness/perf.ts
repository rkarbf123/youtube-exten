import {temporalPerf} from '../temporal/TemporalProfiler';
import {computeOnly,classifySmallMotion} from './computeBench';
import {WebGPUEngine} from '../gpu/WebGPUEngine';
import type {Settings} from '../shared/types';
const bytes=(n:number)=>{const a=[];do{a.unshift(n%256);n=Math.floor(n/256);}while(n);return new Uint8Array(a);};
const concat=(a:Uint8Array[])=>{const out=new Uint8Array(a.reduce((s,x)=>s+x.length,0));let at=0;for(const x of a){out.set(x,at);at+=x.length;}return out;};
function element(id:number,data:Uint8Array):Uint8Array{let length=1;while(data.length>=2**(7*length)-1)length++;const size=bytes(data.length);const vint=new Uint8Array(length);vint.set(size,length-size.length);vint[0]|=1<<(8-length);return concat([bytes(id),vint,data]);}
const uint=(id:number,n:number)=>element(id,bytes(n));const string=(id:number,s:string)=>element(id,new TextEncoder().encode(s));
/** Deterministic timestamps, unlike MediaRecorder real-time pacing. Synthetic diagnostic input. */
async function makeClip(width:number,height:number,fps:number,seconds=16):Promise<number[]>{
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d')!,chunks:{time:number;key:boolean;data:Uint8Array}[]=[];
  const encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);chunks.push({time:chunk.timestamp,key:chunk.type==='key',data});},error:error=>{throw error;}});
  encoder.configure({codec:'vp8',width,height,framerate:fps,bitrate:Math.max(400_000,width*height*2),latencyMode:'realtime'});
  for(let i=0;i<fps*seconds;i++){
    const phase=(i/fps*120/(256*.4*2))%1,triangle=1-Math.abs(phase*2-1);
    const x=width*(.15+.4*triangle),y=height*.3,unit=width/256;
    ctx.fillStyle='#101010';ctx.fillRect(0,0,width,height);ctx.fillStyle='#eeeeee';ctx.fillRect(x,y,48*unit,48*unit);ctx.fillStyle='#4080c0';ctx.fillRect(x+8*unit,y+8*unit,16*unit,16*unit);ctx.fillStyle='#80c040';ctx.fillRect(x+28*unit,y+28*unit,12*unit,12*unit);
    const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});encoder.encode(frame,{keyFrame:i%fps===0});frame.close();if(encoder.encodeQueueSize>6)await encoder.flush();
  }await encoder.flush();encoder.close();
  const header=element(0x1a45dfa3,concat([uint(0x4286,1),uint(0x42f7,1),uint(0x42f2,4),uint(0x42f3,8),string(0x4282,'webm'),uint(0x4287,4),uint(0x4285,2)]));
  const duration=new Uint8Array(8);new DataView(duration.buffer).setFloat64(0,seconds*1000);
  const info=element(0x1549a966,concat([uint(0x2ad7b1,1_000_000),element(0x4489,duration),string(0x4d80,'Clarity diagnostic'),string(0x5741,'Clarity diagnostic')]));
  const track=element(0x1654ae6b,element(0xae,concat([uint(0xd7,1),uint(0x73c5,1),uint(0x83,1),string(0x86,'V_VP8'),uint(0x23e383,Math.round(1e9/fps)),element(0xe0,concat([uint(0xb0,width),uint(0xba,height)]))])));
  const clusters=[];for(let second=0;second<seconds;second++){const blocks=chunks.filter(c=>Math.floor(c.time/1e6)===second).map(c=>{const block=new Uint8Array(c.data.length+4),delta=Math.round(c.time/1000)-second*1000;block[0]=0x81;block[1]=(delta>>8)&255;block[2]=delta&255;block[3]=c.key?0x80:0;block.set(c.data,4);return element(0xa3,block);});clusters.push(element(0x1f43b675,concat([uint(0xe7,second*1000),...blocks])));}
  return Array.from(concat([header,element(0x18538067,concat([info,track,...clusters]))]));
}
let cacheEngine:WebGPUEngine|undefined,cacheCanvas:HTMLCanvasElement|undefined;
async function cachedPhase(which:'previous'|'latest',alpha:number){
  cacheEngine?.destroy();cacheCanvas?.remove();const out=document.createElement('canvas');Object.assign(out.style,{position:'fixed',top:'0',left:'0',width:'128px',height:'72px',zIndex:'2147483647'});document.body.append(out);cacheCanvas=out;cacheEngine=await WebGPUEngine.create(out,()=>{});
  for(let i=0;i<3;i++){const c=Object.assign(document.createElement('canvas'),{width:128,height:72}),ctx=c.getContext('2d')!;ctx.fillStyle='#101010';ctx.fillRect(0,0,128,72);ctx.fillStyle='#eeeeee';ctx.fillRect(24+i*8,24,32,24);await cacheEngine.captureFrame(c,{width:128,height:72},i/24,{width:128,tier:1});}
  const pairs=cacheEngine.temporalPairs(),pair=pairs[which==='previous'?0:1],size={width:128,height:72};const timing=cacheEngine.submitTemporal({source:size,output:size,processing:size,display:size,css:size,screen:null,limited:false},{engine:'fast',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100},alpha,pair);if(!timing)throw new Error('캐시 프레임 제출 실패');await timing.completion;return {expected:(which==='previous'?40:48)+8*alpha,pairs:pairs.map(p=>({a:p.a,b:p.b,id:p.id}))};
}
export function installPerfHarness(load:(url:string,patch:Partial<Settings>)=>void){window.clarityPerf={classifySmallMotion,cachedPhase,computeOnly,makeClip,configure:(enabled,signatures=true)=>temporalPerf.configure(enabled,signatures),reset:()=>temporalPerf.reset(),snapshot:()=>temporalPerf.snapshot(),load};window.addEventListener('pagehide',()=>cacheEngine?.destroy());}
declare global{interface Window{clarityPerf:{classifySmallMotion:typeof classifySmallMotion;cachedPhase:typeof cachedPhase;computeOnly:typeof computeOnly;makeClip:typeof makeClip;configure:(enabled:boolean,signatures?:boolean)=>void;reset:()=>void;snapshot:()=>ReturnType<typeof temporalPerf.snapshot>;load:(url:string,patch:Partial<Settings>)=>void}}}
