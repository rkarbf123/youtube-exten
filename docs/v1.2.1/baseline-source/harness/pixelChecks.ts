import { createEngine } from '../gpu/createEngine';
import type { Dimensions, RenderOptions } from '../shared/types';
export interface PixelCheck { name: string; passed: boolean; detail: string }
export async function runPixelChecks(force?:'webgpu'|'webgl2'):Promise<{backend:string;checks:PixelCheck[]}>{
  let lost='';const {engine,canvas}=await createEngine(()=>document.createElement('canvas'),reason=>{lost=reason;},force);
  const source=document.createElement('canvas');source.width=source.height=8;
  const ctx=source.getContext('2d')!;
  const dimensions:Dimensions={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:false};
  const options:RenderOptions={engine:'balanced',sharpness:0,denoise:0,comparison:false,divider:.5};
  const checks:PixelCheck[]=[];
  const read=async(patch:Partial<RenderOptions>={})=>{
    await engine.render(source,dimensions,{...options,...patch});
    await engine.present();
    const copy=document.createElement('canvas');copy.width=copy.height=32;
    const context=copy.getContext('2d',{willReadFrequently:true})!;context.drawImage(canvas,0,0);return context.getImageData(0,0,32,32).data;
  };
  try{
    for(const mode of ['fast','balanced'] as const){
      ctx.fillStyle='rgb(64,128,192)';ctx.fillRect(0,0,8,8);const result=await read({engine:mode});
      const maxError=Math.max(...Array.from(result,(v,i)=>Math.abs(v-[64,128,192,255][i%4])));
      checks.push({name:`${mode}: constant field / color / alpha`,passed:maxError<=2,detail:`Maximum channel error ${maxError}/255`});
    }
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=20+x*28;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
    const ramp=await read();let error=0;
    // Interior Mitchell kernel reproduces linear ramps. Pixel centers: (x+.5)/4-.5.
    for(let x=6;x<26;x++)error=Math.max(error,Math.abs(ramp[(16*32+x)*4]-(20+((x+.5)/4-.5)*28)));
    checks.push({name:'Balanced: linear-ramp reconstruction',passed:error<=3,detail:`Maximum interior error ${error.toFixed(2)}/255`});
    ctx.fillStyle='black';ctx.fillRect(0,0,8,4);ctx.fillStyle='white';ctx.fillRect(0,4,8,4);
    const orientation=await read();
    checks.push({name:'Video orientation preserved',passed:orientation[0]<3&&orientation[(31*32)*4]>252,detail:`Top ${orientation[0]}, bottom ${orientation[(31*32)*4]}`});
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=80+((x*17+y*13)%7)*11;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
    const base=await read();const sharp=await read({sharpness:1});const noise=await read({denoise:1});const fast=await read({engine:'fast'});const comparison=await read({sharpness:1,comparison:true,divider:1});
    const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>Array.from(a).reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
    for(const [name,result] of [['Sharpening changes processed pixels',sharp],['Denoising changes processed pixels',noise],['Fast and Balanced are distinct',fast],['Comparison uses unenhanced pixels',comparison]] as const){const delta=difference(base,result);checks.push({name,passed:delta>0,detail:`Absolute channel difference ${delta}`});}
    // A discontinuity must not overshoot the source range (anti-ringing bound).
    ctx.fillStyle='rgb(50,50,50)';ctx.fillRect(0,0,4,8);ctx.fillStyle='rgb(200,200,200)';ctx.fillRect(4,0,4,8);
    const edge=await read({sharpness:1});const min=Math.min(...Array.from(edge).filter((_,i)=>i%4!==3)),max=Math.max(...Array.from(edge).filter((_,i)=>i%4!==3));
    checks.push({name:'Step edge remains bounded (anti-ringing)',passed:min>=49&&max<=201,detail:`Range ${min}…${max}; source 50…200`});
    if(lost)throw new Error(lost);
    return {backend:engine.backend,checks};
  }finally{engine.destroy();canvas.remove();}
}
