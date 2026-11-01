import { createEngine } from '../gpu/createEngine';
import type { Dimensions, RenderOptions } from '../shared/types';
import common from '../../tests/fixtures/v1/common.wgsl?raw';
import denoise from '../../tests/fixtures/v1/denoise.wgsl?raw';
import upscale from '../../tests/fixtures/v1/upscale.wgsl?raw';
import composite from '../../tests/fixtures/v1/composite.wgsl?raw';
import * as legacyGL from '../../tests/fixtures/v1/webgl';
import { easuReference } from './easuReference';
const legacy={webgpu:{common,denoise,upscale,composite},webgl:legacyGL};
function dimensions(sw:number,sh:number,ow:number,oh:number):Dimensions{return {source:{width:sw,height:sh},processing:{width:ow,height:oh},output:{width:ow,height:oh},display:{width:ow,height:oh},css:{width:ow,height:oh},screen:null,limited:false};}
const options:RenderOptions={engine:'balanced',sharpness:0,denoise:0,comparison:false,divider:.5,contentMode:'natural'};
const canvas=(width:number,height:number)=>Object.assign(document.createElement('canvas'),{width,height});
function scores(a:Uint8ClampedArray,b:Uint8ClampedArray){let s=0,abs=0;for(let i=0;i<a.length;i++)if(i%4!==3){const d=a[i]-b[i];s+=d*d;abs+=Math.abs(d);}const count=a.length*3/4;return {psnr:s===0?99:10*Math.log10(255*255/(s/count)),mae:abs/count};}
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export async function runQualityReview(force:'webgpu'|'webgl2'='webgpu'){
  const previous=await createEngine(()=>canvas(1,1),()=>{},force,legacy);
  const improved=await createEngine(()=>canvas(1,1),()=>{},force);
  const read=async(which:typeof previous,source:HTMLCanvasElement,d:Dimensions,patch:Partial<RenderOptions>={})=>{
    await which.engine.render(source,d,{...options,...patch});await which.engine.present();
    const copy=canvas(d.output.width,d.output.height),ctx=copy.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(which.canvas,0,0);
    return {data:ctx.getImageData(0,0,copy.width,copy.height).data,png:copy.toDataURL('image/png')};
  };
  try{
    const random=canvas(9,7),rctx=random.getContext('2d')!,rd=rctx.createImageData(9,7);
    for(let i=0;i<rd.data.length;i++)rd.data[i]=i%4===3?255:(i*73+(i%11)*31)%256;rctx.putImageData(rd,0,0);
    const port=await read(improved,random,dimensions(9,7,23,19),{contentMode:'animation'});const ref=easuReference(rd.data,9,7,23,19,true);
    const maxReferenceError=Math.max(...Array.from(ref,(v,i)=>Math.abs(v-port.data[i])));
    const cases=[];
    for(const name of ['line-art','natural-texture','compressed-texture']){
      const high=canvas(768,432),ctx=high.getContext('2d')!;
      if(name==='line-art'){
        ctx.fillStyle='#e4e8db';ctx.fillRect(0,0,768,432);
        for(let n=0;n<14;n++){ctx.strokeStyle=n%3?'#1d2834':'#537789';ctx.lineWidth=2+(n%3)*1.4;ctx.beginPath();ctx.moveTo(15+n*51,45);ctx.lineTo(90+n*46,390);ctx.stroke();}
        ctx.strokeStyle='#252b3e';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(355,200,165,105,.25,0,Math.PI*2);ctx.stroke();ctx.font='bold 28px sans-serif';ctx.fillStyle='#172b3b';ctx.fillText('Edge reconstruction 0123',30,35);
      }else{
        const image=ctx.createImageData(768,432);
        for(let y=0;y<432;y++)for(let x=0;x<768;x++){const i=(y*768+x)*4;const wave=18*Math.sin(x*.18+y*.07)+11*Math.sin(x*.055-y*.14);const ridge=55*Math.tanh((x-300-y*.43)/3);const v=125+wave+ridge+15*Math.sin(y*.025);image.data[i]=v*.94;image.data[i+1]=v;image.data[i+2]=v*.84;image.data[i+3]=255;}ctx.putImageData(image,0,0);
      }
      // Deterministic 3x3 area downsample, identical for both algorithms.
      const truth=ctx.getImageData(0,0,768,432).data,low=canvas(256,144),lc=low.getContext('2d')!,input=lc.createImageData(256,144);
      for(let y=0;y<144;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;for(let c=0;c<3;c++){let v=0;for(let yy=0;yy<3;yy++)for(let xx=0;xx<3;xx++)v+=truth[((y*3+yy)*768+x*3+xx)*4+c];const noise=name==='compressed-texture'?(((x*17+y*23)%13)-6)*1.3:0;input.data[i+c]=v/9+noise;}input.data[i+3]=255;}lc.putImageData(input,0,0);
      const d=dimensions(256,144,768,432),mode=name==='line-art'?'animation':'natural';
      const before=await read(previous,low,d,{denoise:name==='compressed-texture'?.35:0});
      const after=await read(improved,low,d,{denoise:name==='compressed-texture'?.35:0,contentMode:mode});
      cases.push({name,sharpness:0,baseline:scores(before.data,truth),improved:scores(after.data,truth),difference:scores(before.data,after.data).mae,images:{source:low.toDataURL(),truth:high.toDataURL(),baseline:before.png,improved:after.png}});
    }
    const input=canvas(640,360),ctx=input.getContext('2d')!;ctx.fillStyle='#9ab9ad';ctx.fillRect(0,0,640,360);ctx.fillStyle='#304857';for(let i=0;i<40;i++)ctx.fillRect(i*17,10,2,340);
    const d=dimensions(640,360,1920,1080);const latency:{baseline:number[];improved:number[]}={baseline:[],improved:[]};
    for(let i=0;i<36;i++)for(const [key,which] of (i%2?[['improved',improved],['baseline',previous]]:[['baseline',previous],['improved',improved]]) as ['baseline'|'improved',typeof improved][]){const start=performance.now();await which.engine.render(input,d,{...options,denoise:.2});await which.engine.present();if(i>=6)latency[key].push(performance.now()-start);}
    const benchmark={source:'640×360',output:'1920×1080',samples:30,includes:'CPU + queue + GPU completion; not pure GPU timestamp',baselineMedianMs:median(latency.baseline),improvedMedianMs:median(latency.improved),baselineP95Ms:[...latency.baseline].sort((a,b)=>a-b)[28],improvedP95Ms:[...latency.improved].sort((a,b)=>a-b)[28]};
    return {backend:improved.engine.backend,maxReferenceError,cases,benchmark};
  }finally{previous.engine.destroy();improved.engine.destroy();}
}
export async function compareCapturedFrame(dataURL:string,force:'webgpu'|'webgl2'='webgpu'){
  const image=new Image();image.src=dataURL;await image.decode();const source=canvas(image.width,image.height);source.getContext('2d')!.drawImage(image,0,0);
  const d=dimensions(image.width,image.height,image.width*3,image.height*3);
  const before=await createEngine(()=>canvas(1,1),()=>{},force,legacy),after=await createEngine(()=>canvas(1,1),()=>{},force);
  const copy=canvas(d.output.width,d.output.height),ctx=copy.getContext('2d',{willReadFrequently:true})!;
  const capture=async(which:typeof before,mode:'natural'|'animation')=>{await which.engine.render(source,d,{...options,denoise:.2,contentMode:mode});await which.engine.present();ctx.drawImage(which.canvas,0,0);return {data:ctx.getImageData(0,0,copy.width,copy.height).data,png:copy.toDataURL()};};
  try{
    const old=await capture(before,'natural'),natural=await capture(after,'natural'),animation=await capture(after,'animation');
    return {backend:after.engine.backend,source:d.source,output:d.output,sharpness:0,denoise:20,baselineToNaturalMAE:scores(old.data,natural.data).mae,naturalToAnimationMAE:scores(natural.data,animation.data).mae,images:{baseline:old.png,natural:natural.png,animation:animation.png}};
  }finally{before.engine.destroy();after.engine.destroy();}
}
