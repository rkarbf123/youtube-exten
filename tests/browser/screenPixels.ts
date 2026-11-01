import type { Page } from '@playwright/test';
/** Read the compositor screenshots. WebGPU's swap-chain texture expires after
 * presentation, so a later Canvas2D drawImage(canvas) is not a valid screenshot. */
export async function compareScreenPixels(page:Page):Promise<{left:number;right:number;total:number}>{
  const canvas=page.locator('.clarity-gpu-overlay');const box=(await canvas.boundingBox())!;
  const clip={x:Math.ceil(box.x),y:Math.ceil(box.y),width:Math.floor(box.width)-2,height:Math.floor(box.height)-40};
  const processed=await page.screenshot({clip});
  await page.evaluate(()=>{for(const c of document.querySelectorAll<HTMLElement>('.clarity-gpu-overlay'))c.style.visibility='hidden';});
  const original=await page.screenshot({clip});
  await page.evaluate(()=>{for(const c of document.querySelectorAll<HTMLElement>('.clarity-gpu-overlay'))c.style.visibility='visible';});
  return page.evaluate(async({a,b})=>{
    const images=await Promise.all([a,b].map(async bytes=>createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}))));
    const copy=document.createElement('canvas');copy.width=images[0].width;copy.height=images[0].height;const ctx=copy.getContext('2d',{willReadFrequently:true})!;
    const data=images.map(image=>{ctx.drawImage(image,0,0);image.close();return ctx.getImageData(0,0,copy.width,copy.height).data;});
    let left=0,right=0,lc=0,rc=0;
    for(let y=0;y<copy.height;y++)for(let x=0;x<copy.width;x++){if(Math.abs(x-copy.width/2)<5)continue;const i=(y*copy.width+x)*4;const d=Math.abs(data[0][i]-data[1][i])+Math.abs(data[0][i+1]-data[1][i+1])+Math.abs(data[0][i+2]-data[1][i+2]);if(x<copy.width/2){left+=d;lc+=3;}else{right+=d;rc+=3;}}
    return {left:left/lc,right:right/rc,total:left+right};
  },{a:Array.from(processed),b:Array.from(original)});
}
