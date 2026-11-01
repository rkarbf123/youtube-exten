import {WebGPUEngine} from '../gpu/WebGPUEngine';
import {WebGPUEngine as PreviousEngine} from '../../tests/fixtures/v121-optimized/gpu/WebGPUEngine';
import type {Dimensions,RenderOptions} from '../shared/types';
type Pattern='object'|'pan'|'occlusion'|'opposed';
function input(pattern:Pattern,phase:number,offset=0):HTMLCanvasElement{
 const c=Object.assign(document.createElement('canvas'),{width:256,height:144}),ctx=c.getContext('2d')!;
 ctx.fillStyle='#101010';ctx.fillRect(0,0,256,144);
 if(pattern==='pan'||pattern==='occlusion')for(let y=0;y<144;y+=4)for(let x=-16;x<272;x+=4){const v=25+((x*17+y*13)%47+47)%47;ctx.fillStyle=`rgb(${v},${v+8},${v+16})`;ctx.fillRect(x+(pattern==='pan'?phase*8:0),y,4,4);}
 if(pattern!=='pan'){
  const box=(x:number,y:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,55,43);ctx.fillStyle='#4080c0';ctx.fillRect(x+8,y+8,16,16);ctx.fillStyle='#80c040';ctx.fillRect(x+31,y+24,12,12);};
  box(29+offset+phase*12,43+offset,'#eeeeee');if(pattern==='opposed')box(153+offset-phase*8,85+offset,'#dddddd');
 }
 return c;
}
const data=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,256,144).data;
export async function runArtifactChecks(variant:'previous'|'after'){
 const output=document.createElement('canvas'),engine=await(variant==='previous'?PreviousEngine:WebGPUEngine).create(output,()=>{}),rows=[];
 const size={width:256,height:144},d:Dimensions={source:size,output:size,processing:size,display:size,css:size,screen:null,limited:false};
 const opts:RenderOptions={engine:'fast',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100};
 try{for(const pattern of ['object','pan','occlusion','opposed'] as const)for(const offset of pattern==='pan'?[0]:[0,3]){
  engine.resetTemporal();const a=input(pattern,0,offset),b=input(pattern,1,offset);await engine.captureFrame(a,size,0,{width:256,tier:1});const pair=await engine.captureFrame(b,size,1/60,{width:256,tier:1});
  for(const alpha of [.25,.5,.75]){await engine.renderTemporal(d,opts,alpha);await engine.present('full');const pixels=engine.lastPixels!,reference=input(pattern,alpha,offset),truth=data(reference);let absolute=0,square=0,seam=0,seamN=0;
   for(let y=0;y<144;y++)for(let x=0;x<256;x++)for(let channel=0;channel<3;channel++){const i=(y*256+x)*4+channel,error=pixels[i]-truth[i];absolute+=Math.abs(error);square+=error*error;if(x>0&&x%8===0){seam+=Math.abs(error-(pixels[i-4]-truth[i-4]));seamN++;}}
   const c=Object.assign(document.createElement('canvas'),size);c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels),256,144),0,0);
   rows.push({pattern,offset,alpha,mae:absolute/(256*144*3),rmse:Math.sqrt(square/(256*144*3)),boundaryResidual:seam/seamN,confidence:pair.confidence,image:c.toDataURL(),reference:reference.toDataURL(),sourceA:a.toDataURL(),sourceB:b.toDataURL()});
  }
 }return rows;}finally{engine.destroy();}
}
