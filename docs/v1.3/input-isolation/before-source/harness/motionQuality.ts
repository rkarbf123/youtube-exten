import {WebGPUEngine} from '../gpu/WebGPUEngine';
import {WebGPUEngine as BeforeEngine} from '../../tests/fixtures/v1.2.1-final/gpu/WebGPUEngine';
import type {Dimensions,RenderOptions} from '../shared/types';
export const motionCases=['horizontal','vertical','diagonal','opposed','occlusion','fast','repeating','animation','scaled','border','flash','cut'] as const;
type Scene=typeof motionCases[number];
const width=320,height=192;
export function motionInput(scene:Scene,t:number):HTMLCanvasElement{
 const scaled=scene==='scaled'?2:1,c=Object.assign(document.createElement('canvas'),{width:width*scaled,height:height*scaled}),ctx=c.getContext('2d')!;ctx.scale(scaled,scaled);ctx.fillStyle='#101820';ctx.fillRect(0,0,width,height);
 if(['occlusion','repeating'].includes(scene))for(let y=-8;y<height+8;y+=8)for(let x=-32;x<width+32;x+=8){const v=scene==='repeating'?((x/8+y/8)%2?40:110):30+((x*17+y*13)%47+47)%47;ctx.fillStyle=`rgb(${v},${v+5},${v+10})`;ctx.fillRect(x+(scene==='repeating'?t*20:0),y,8,8);}
 if(scene==='repeating')return c;
 const dx=scene==='vertical'?0:scene==='fast'?32:scene==='border'?24:16,dy=['vertical','diagonal','animation'].includes(scene)?12:0;
 const box=(x:number,y:number,reverse=false)=>{ctx.fillStyle=reverse?'#d0c0b0':'#eeeeee';ctx.fillRect(x,y,60,48);ctx.fillStyle='#4080c0';ctx.fillRect(x+8,y+8,16,16);ctx.fillStyle='#80c040';ctx.fillRect(x+36,y+28,12,12);ctx.strokeStyle='#202030';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,58,46);};
 if(scene==='animation'){
  const x=88+dx*t,y=64+dy*t;ctx.fillStyle='#c1c6ff';ctx.strokeStyle='#28304e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,28,36,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff0df';ctx.beginPath();ctx.ellipse(x+2,y+4,21,26,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#305aac';for(const ox of [-9,10]){ctx.fillRect(x+ox,y,5,9);ctx.fillStyle='#222b40';ctx.fillRect(x+ox-2,y-3,9,2);ctx.fillStyle='#305aac';}ctx.strokeStyle='#353050';ctx.beginPath();ctx.moveTo(x-4,y+17);ctx.lineTo(x+6,y+18);ctx.stroke();ctx.strokeStyle='#dedfff';for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(x-24+i*6,y-26);ctx.quadraticCurveTo(x-30+i*8+t*8,y+20,x-40+i*10+t*10,y+63);ctx.stroke();}ctx.fillStyle='#e0e8ff';ctx.beginPath();ctx.moveTo(x-16,y+33);ctx.lineTo(x+28+t*6,y+83);ctx.lineTo(x-40-t*8,y+75);ctx.fill();
 }else{box((scene==='border'?264:44)+dx*t,54+dy*t);if(scene==='opposed')box(215-20*t,115-8*t,true);}
 if(scene==='occlusion'){ctx.fillStyle='#ad5060';ctx.fillRect(100,35,34,116);ctx.fillStyle='#f0d0d0';ctx.fillRect(104,45,4,96);}
 if(scene==='flash'){ctx.fillStyle=`rgba(255,255,255,${t*.6})`;ctx.fillRect(0,0,width,height);}
 if(scene==='cut'&&t>0){ctx.fillStyle='#d0a080';ctx.fillRect(0,0,width,height);ctx.fillStyle='#204080';ctx.fillRect(180,20,90,130);}
 return c;
}
const pixels=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
export function metrics(actual:Uint8ClampedArray,truth:Uint8ClampedArray,a:Uint8ClampedArray,b:Uint8ClampedArray,w:number,h:number){
 let abs=0,sq=0,seam=0,n=0,ghost=0,ghostN=0,ssim=0,windows=0,cx=0,cy=0,weight=0,tx=0,ty=0,tw=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=Math.max(0,actual[i]-180),tv=Math.max(0,truth[i]-180);cx+=(x+.5)*v;cy+=(y+.5)*v;weight+=v;tx+=(x+.5)*tv;ty+=(y+.5)*tv;tw+=tv;for(let k=0;k<3;k++){const e=actual[i+k]-truth[i+k];abs+=Math.abs(e);sq+=e*e;if(x>0&&x%8===0){seam+=Math.abs(e-(actual[i+k-4]-truth[i+k-4]));n++;}if(truth[i+k]<80&&(a[i+k]>180||b[i+k]>180)){ghost+=Math.abs(e);ghostN++;}}}
 for(let y=0;y+8<=h;y+=8)for(let x=0;x+8<=w;x+=8){let ma=0,mt=0,va=0,vt=0,cov=0;for(let j=0;j<8;j++)for(let i=0;i<8;i++){const at=((y+j)*w+x+i)*4;ma+=actual[at];mt+=truth[at];}ma/=64;mt/=64;for(let j=0;j<8;j++)for(let i=0;i<8;i++){const at=((y+j)*w+x+i)*4,u=actual[at]-ma,v=truth[at]-mt;va+=u*u;vt+=v*v;cov+=u*v;}ssim+=((2*ma*mt+6.5025)*(2*cov/64+58.5225))/((ma*ma+mt*mt+6.5025)*(va/64+vt/64+58.5225));windows++;}
 const mse=sq/(w*h*3);return {mae:abs/(w*h*3),rmse:Math.sqrt(mse),psnr:mse?10*Math.log10(255*255/mse):null,ssim:ssim/windows,boundaryResidual:seam/n,ghostError:ghostN?ghost/ghostN:0,positionError:weight&&tw?Math.hypot(cx/weight-tx/tw,cy/weight-ty/tw):null};
}
export async function runMotionQuality(variant:'before'|'after',only?:Scene[]){
 const out=document.createElement('canvas'),errors:string[]=[],engine=await(variant==='before'?BeforeEngine:WebGPUEngine).create(out,e=>errors.push(e)),rows=[];
 const options:RenderOptions={engine:'fast',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100};
 try{for(const scene of only??motionCases){engine.resetTemporal();const a=motionInput(scene,0),b=motionInput(scene,1),size={width:a.width,height:a.height},d:Dimensions={source:size,output:size,processing:size,display:size,css:size,screen:null,limited:false};await engine.captureFrame(a,size,0,{width:scene==='scaled'?160:320,tier:1});const pair=await engine.captureFrame(b,size,1/60,{width:scene==='scaled'?160:320,tier:1});
  const vectors=engine instanceof WebGPUEngine?await engine.diagnoseMotion():undefined;
  for(const alpha of [.25,.5,.75]){await engine.renderTemporal(d,options,alpha);await engine.present('full');const actual=engine.lastPixels!,truth=motionInput(scene,scene==='cut'?1:alpha),image=Object.assign(document.createElement('canvas'),size);image.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(actual),a.width,a.height),0,0);rows.push({scene,alpha,...size,...metrics(actual,pixels(truth),pixels(a),pixels(b),a.width,a.height),vectors:alpha===.5?vectors:undefined,dynamic:pair.dynamic,sceneCut:pair.sceneCut,image:image.toDataURL(),reference:truth.toDataURL(),sourceA:a.toDataURL(),sourceB:b.toDataURL()});}
 }return {variant,rows,errors};}finally{engine.destroy();}
}
export async function diagnoseQuality(scene:Scene){
 const out=document.createElement('canvas'),engine=await WebGPUEngine.create(out,()=>{}),a=motionInput(scene,0),b=motionInput(scene,1),size={width:a.width,height:a.height},d:Dimensions={source:size,output:size,processing:size,display:size,css:size,screen:null,limited:false},options:RenderOptions={engine:'fast',sharpness:0,denoise:0,comparison:false,divider:.5,upscale:false,saturation:100,brightness:100};
 try{await engine.captureFrame(a,size,0,{width:scene==='scaled'?160:320,tier:1});await engine.captureFrame(b,size,1/60,{width:scene==='scaled'?160:320,tier:1});await engine.renderTemporal(d,options,.5);await engine.present('full');const actual=engine.lastPixels!,truth=pixels(motionInput(scene,.5)),c=Object.assign(document.createElement('canvas'),size),ctx=c.getContext('2d')!,diff=new Uint8ClampedArray(actual.length);let bad=0;for(let i=0;i<actual.length;i+=4){let e=0;for(let k=0;k<3;k++){diff[i+k]=Math.min(255,Math.abs(actual[i+k]-truth[i+k])*2);e+=Math.abs(actual[i+k]-truth[i+k]);}diff[i+3]=255;if(e>90)bad++;}ctx.putImageData(new ImageData(diff,a.width,a.height),0,0);const error=c.toDataURL();engine.setMotionDebug(true);await engine.renderTemporal(d,options,.5);await engine.present('full');ctx.putImageData(new ImageData(new Uint8ClampedArray(engine.lastPixels!),a.width,a.height),0,0);const counts={normal:0,fallback:0,ambiguous:0};for(let i=0;i<engine.lastPixels!.length;i+=4){const p=engine.lastPixels!;if(p[i+1]>200&&p[i]<100)counts.normal++;else if(p[i+1]>200)counts.ambiguous++;else counts.fallback++;}return {error,heatmap:c.toDataURL(),badPixels:bad,counts};}finally{engine.destroy();}
}
