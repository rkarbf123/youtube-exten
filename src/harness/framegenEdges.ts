import {FramegenSession} from '../ai/FramegenSession';
import {FramegenSurfaces} from './framegenDiagnostics';
import {WebGPUEngine} from '../gpu/WebGPUEngine';
import type {Dimensions,RenderOptions} from '../shared/types';
export type EdgeScene='lineart'|'repeating'|'occlusion'|'flash'|'cut'|'turn';
const W=320,H=192;
/** Controlled geometry, never presented as natural footage. Units are source pixels. */
export function edgeScene(scene:EdgeScene,time:number,scale=1){
 const canvas=Object.assign(document.createElement('canvas'),{width:W*scale,height:H*scale}),c=canvas.getContext('2d')!;
 c.scale(scale,scale);c.fillStyle='#687685';c.fillRect(0,0,W,H);
 const dx=64*(scene==='turn'&&time>.16?.32-time:time),dy=18*time;
 if(scene==='repeating'){c.save();c.translate(dx,dy);c.strokeStyle='#202430';c.lineWidth=1;for(let x=-64;x<384;x+=5){c.beginPath();c.moveTo(x,-32);c.lineTo(x+32,224);c.stroke();}c.restore();}
 c.save();c.translate(dx,dy);c.fillStyle='#eac6ab';c.strokeStyle='#172135';c.lineWidth=1.2;
 c.beginPath();c.ellipse(118,80,28,37,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#243047';c.beginPath();c.moveTo(86,78);c.bezierCurveTo(82,22,151,25,150,86);c.lineTo(134,51);c.lineTo(122,66);c.lineTo(116,48);c.lineTo(99,65);c.closePath();c.fill();
 c.strokeStyle='#e0deed';c.lineWidth=.8;for(let i=0;i<9;i++){c.beginPath();c.moveTo(90+i*6,48);c.bezierCurveTo(80+i*8,75,94+i*4,116,84+i*8,133);c.stroke();}
 c.strokeStyle='#182238';c.lineWidth=1;for(const x of [103,124]){c.beginPath();c.moveTo(x,80);c.quadraticCurveTo(x+5,76,x+10,81);c.stroke();c.fillStyle='#35577d';c.fillRect(x+4,81,2,5);}
 c.beginPath();c.moveTo(113,103);c.quadraticCurveTo(119,106,126,101);c.stroke();
 c.fillStyle='#d9d9ea';c.beginPath();c.moveTo(95,118);c.lineTo(151,124);c.lineTo(176,151);c.lineTo(165,158);c.lineTo(140,140);c.lineTo(94,159);c.closePath();c.fill();c.stroke();
 c.fillStyle='#ebc7ae';c.fillRect(165,150,15,7);c.strokeRect(165,150,15,7);
 c.strokeStyle='#faf6e7';c.lineWidth=1;for(let i=0;i<4;i++){c.beginPath();c.moveTo(188+i*7,44);c.lineTo(199+i*7,143);c.stroke();}c.restore();
 if(scene==='occlusion'){c.fillStyle='#835061';c.fillRect(141,20,35,154);}
 if(scene==='flash'){c.fillStyle=`rgba(255,255,255,${.2+.18*Math.sin(time*24)})`;c.fillRect(0,0,W,H);}
 if(scene==='cut'&&time>=.16){c.fillStyle='#e2aa82';c.fillRect(0,0,W,H);c.fillStyle='#22375e';c.fillRect(210,24,72,130);}
 return {canvas,dx,dy,alignmentTrusted:!['occlusion','flash','cut','turn'].includes(scene)};
}
async function read(d:GPUDevice,t:GPUTexture){const stride=Math.ceil(t.width*4/256)*256,b=d.createBuffer({size:stride*t.height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const e=d.createCommandEncoder();e.copyTextureToBuffer({texture:t},{buffer:b,bytesPerRow:stride},[t.width,t.height]);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const src=new Uint8Array(b.getMappedRange()),out=new Uint8ClampedArray(t.width*t.height*4);for(let y=0;y<t.height;y++)out.set(src.subarray(y*stride,y*stride+t.width*4),y*t.width*4);b.unmap();return out;}finally{b.destroy();}}
const image=(p:Uint8ClampedArray,w=W,h=H)=>{const c=Object.assign(document.createElement('canvas'),{width:w,height:h});c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p),w,h),0,0);return c;};
/** Independent keyframes ensure hidden truth is not a decoder dependency of C. */
async function decode(scene:EdgeScene,times:number[]){
 const chunks:EncodedVideoChunk[]=[],frames=new Map<number,HTMLCanvasElement>();const encoder=new VideoEncoder({output:c=>chunks.push(c),error:e=>{throw e;}});
 try{encoder.configure({codec:'vp8',width:W,height:H,bitrate:2_000_000,framerate:120,latencyMode:'realtime'});for(const time of times){const f=new VideoFrame(edgeScene(scene,time).canvas,{timestamp:Math.round(time*1e6),duration:8333});encoder.encode(f,{keyFrame:true});f.close();}await encoder.flush();}finally{encoder.close();}
 const decoder=new VideoDecoder({output:f=>{try{const c=Object.assign(document.createElement('canvas'),{width:W,height:H});c.getContext('2d')!.drawImage(f,0,0);frames.set(f.timestamp,c);}finally{f.close();}},error:e=>{throw e;}});
 try{decoder.configure({codec:'vp8',codedWidth:W,codedHeight:H});for(const c of chunks)decoder.decode(c);await decoder.flush();}finally{decoder.close();}return frames;
}
export async function framegenEdges(config:{scene?:EdgeScene;sourceFPS?:number;targetFPS?:number;pairs?:number;post?:boolean}={}){
 const scene=config.scene??'lineart',sourceFPS=config.sourceFPS??24,targetFPS=config.targetFPS??48,pairs=config.pairs??8;
 const times=new Set<number>();for(let i=0;i<=pairs;i++)times.add(Math.round(i/sourceFPS*1e6));for(let i=0;i<=Math.floor(pairs*targetFPS/sourceFPS);i++)times.add(Math.round(i/targetFPS*1e6));
 const decoded=await decode(scene,[...times].sort((a,b)=>a-b).map(t=>t/1e6)),adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('WebGPU unavailable');const d=await adapter.requestDevice({requiredFeatures:['shader-f16']}),errors:string[]=[];d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
 const surface=await FramegenSurfaces.create(d,W,H),sessions={before:await FramegenSession.create(d,W,H),dense:await FramegenSession.create(d,W,H,new URL('./',location.href),{sparseRefine:false})};
 const post=config.post===false?undefined:await WebGPUEngine.create(document.createElement('canvas'),e=>errors.push(e));
 const rows=[];let id=0;
 try{for(const variant of ['before','dense'] as const){const session=sessions[variant];let pair=-1,key='',guard:{difference:number;originalOnly:boolean}={difference:0,originalOnly:false};
  for(let i=0;i<=Math.floor(pairs*targetFPS/sourceFPS);i++){
   const planned=Math.round(i/targetFPS*1e6)/1e6,index=Math.min(pairs-1,Math.floor(planned*sourceFPS+1e-5)),a=Math.round(index/sourceFPS*1e6)/1e6,c=Math.round((index+1)/sourceFPS*1e6)/1e6,t=(planned-a)/(c-a),A=decoded.get(Math.round(a*1e6))!,C=decoded.get(Math.round(c*1e6))!,truth=decoded.get(Math.round(planned*1e6))!;
   if(index!==pair){pair=index;surface.upload(A,0);surface.upload(C,1);key=session.prepPair(surface.inputs[0],surface.inputs[1],a,c,1);guard=await session.diagnoseGuard();}
   const interpolated=t>.0001&&t<.9999,protectedOutput=interpolated&&guard.originalOnly,generated=interpolated&&!protectedOutput,outputPTS=protectedOutput?c:planned,start=performance.now();let canvas:HTMLCanvasElement;
   if(t<=.0001)canvas=A;else if(t>=.9999)canvas=C;else{session.runT(t,surface.output,key);canvas=image(await read(d,surface.output));}
   const geometry=edgeScene(scene,outputPTS);const base={id:++id,variant,scene,index:i,pairID:key,ptsA:a,ptsC:c,t,plannedPTS:planned,outputPTS,generated,guard:protectedOutput,completedAt:performance.now(),completionMs:performance.now()-start,lateDiscard:false,diagnosticOnly:true,dx:geometry.dx,dy:geometry.dy,alignmentTrusted:geometry.alignmentTrusted,source:canvas.toDataURL(),truth:truth.toDataURL(),width:W,height:H};
   rows.push({...base,mode:'B',image:canvas.toDataURL()});
   if(variant==='before'){const originalPTS=t>=.9999?c:a,original=t>=.9999?C:A;rows.push({...base,variant:'original',mode:'A',generated:false,guard:false,outputPTS:originalPTS,image:original.toDataURL(),dx:edgeScene(scene,originalPTS).dx,dy:edgeScene(scene,originalPTS).dy});}
   if(post){const size={width:W,height:H},out={width:W*2,height:H*2},dims:Dimensions={source:size,processing:out,output:out,display:out,css:out,screen:null,limited:false};
    for(const mode of ['C','D']as const){const options:RenderOptions={engine:mode==='D'?'balanced':'fast',sharpness:mode==='D'?.35:0,denoise:mode==='D'?.25:0,comparison:false,divider:.5,upscale:true,contentMode:'animation',saturation:100,brightness:100};await post.render(canvas,dims,options);await post.present('full');const output=image(post.lastPixels!,out.width,out.height).toDataURL();await post.render(truth,dims,options);await post.present('full');rows.push({...base,mode,width:out.width,height:out.height,options,image:output,truth:image(post.lastPixels!,out.width,out.height).toDataURL()});}
   }
  }
 }return {scene,sourceFPS,targetFPS,pairs,rows,errors,modelHash:sessions.before.modelHash,candidate:'public sparseRefine=false; weights and runtime bytes unchanged',truthExcludedFromInference:true,note:'Controlled decoded VP8 line art; serial diagnostic readbacks, not a real-time FPS benchmark. C/D use the existing production WebGPUEngine after diagnostic CPU transfer; B goes only through the separate postprocessor after inference, never into Framegen. Untrusted alignment scenes are excluded from motion-compensated metrics.'};
 }finally{post?.destroy();sessions.before.destroy();sessions.dense.destroy();surface.destroy();await d.queue.onSubmittedWorkDone();d.destroy();}
}
