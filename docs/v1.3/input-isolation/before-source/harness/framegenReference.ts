import {motionInput} from './motionQuality';
export interface ReferenceFrame{time:number;canvas:HTMLCanvasElement}
/** Three independently coded real VP8 frames. B has a target-output PTS but is
 * never passed to the interpolation runtime. This avoids evaluating half the
 * requested source FPS by withholding a frame from an already-low-FPS clip. */
export async function decodeReference(width:number,height:number,sourceFPS:number,targetFPS:number){
 const times=[.5,.5+1/targetFPS,.5+1/sourceFPS],chunks:{timestamp:number;duration:number;data:Uint8Array<ArrayBuffer>}[]=[],canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d')!;
 const encoder=new VideoEncoder({output:c=>{const data=new Uint8Array(c.byteLength);c.copyTo(data);chunks.push({timestamp:c.timestamp,duration:c.duration??1,data});},error:e=>{throw e;}});
 try{encoder.configure({codec:'vp8',width,height,framerate:Math.max(sourceFPS,targetFPS),bitrate:Math.max(1_000_000,width*height*4),latencyMode:'realtime'});for(let i=0;i<times.length;i++){const time=times[i],duration=Math.round((times[i+1]??time+1/sourceFPS)*1e6)-Math.round(time*1e6);ctx.drawImage(motionInput('horizontal',time*9.375),0,0,width,height);const frame=new VideoFrame(canvas,{timestamp:Math.round(time*1e6),duration});encoder.encode(frame,{keyFrame:true});frame.close();}await encoder.flush();}finally{encoder.close();}
 const frames:ReferenceFrame[]=[],decoder=new VideoDecoder({output:frame=>{try{const canvas=Object.assign(document.createElement('canvas'),{width,height});canvas.getContext('2d')!.drawImage(frame,0,0);frames.push({time:frame.timestamp/1e6,canvas});}finally{frame.close();}},error:e=>{throw e;}});
 try{decoder.configure({codec:'vp8',codedWidth:width,codedHeight:height});for(const c of chunks)decoder.decode(new EncodedVideoChunk({type:'key',timestamp:c.timestamp,duration:c.duration,data:c.data}));await decoder.flush();}finally{decoder.close();}
 frames.sort((a,b)=>a.time-b.time);if(frames.length!==3)throw new Error('Reference decoder did not produce A/B/C.');
 const hashes=await Promise.all(chunks.map(async c=>({ptsUs:c.timestamp,bytes:c.data.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.data)),v=>v.toString(16).padStart(2,'0')).join('')})));
 return {frames,metadata:{kind:'independently encoded and decoded variable-PTS VP8 reference, not natural footage',sourceFPS,targetFPS,keyframesOnly:true,chunkHashes:hashes,inputPairFPS:1/(frames[2].time-frames[0].time)}};
}
