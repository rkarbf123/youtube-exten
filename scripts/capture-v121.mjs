import {chromium} from '@playwright/test';
import {preview} from 'vite';
import {writeFile,mkdir} from 'node:fs/promises';
const out='docs/v1.2.1/regression';await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5192,strictPort:true}});
const browser=await chromium.launch({channel:'chromium',headless:true});const rows=[];
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5192/harness/');
 for(const which of ['previous','latest'])for(const alpha of [.25,.5,.75]){
  const r=await page.evaluate(({which,alpha})=>window.clarityPerf.cachedPhase(which,alpha),{which,alpha});
  const bytes=await page.screenshot({clip:{x:0,y:0,width:128,height:72}}),file=`stream-${which}-${alpha.toFixed(2)}.png`;await writeFile(out+'/'+file,bytes);
  const measured=await page.evaluate(async bytes=>{const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'})),c=document.createElement('canvas');c.width=128;c.height=72;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();const p=ctx.getImageData(0,0,128,72).data;let sum=0,weight=0;for(let y=0;y<72;y++)for(let x=0;x<128;x++){const w=Math.max(0,p[(y*128+x)*4]-16);sum+=(x+.5)*w;weight+=w;}return sum/weight;},[...bytes]);
  rows.push({which,alpha,...r,measured,errorPixels:Math.abs(measured-r.expected),file});
 }
 if(rows.some(r=>r.errorPixels>=1.5))throw new Error('Streaming centroid failed');
 console.log(JSON.stringify(rows));
}finally{await browser.close();await server.close();await writeFile(out+'/stream-positions.json',JSON.stringify(rows,null,2));}
