import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chromium',headless:true});
try{
  const page=await browser.newPage();
  for(const size of [16,32,48,128]){
    const png=await page.evaluate(size=>{
      const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.scale(size/128,size/128);
      const gradient=ctx.createLinearGradient(0,0,128,128);gradient.addColorStop(0,'#355143');gradient.addColorStop(1,'#111e17');ctx.fillStyle=gradient;ctx.beginPath();ctx.roundRect(0,0,128,128,30);ctx.fill();
      ctx.strokeStyle='#b7e4c9';ctx.lineWidth=11;ctx.lineCap='round';ctx.beginPath();ctx.arc(65,63,31,.23*Math.PI,1.77*Math.PI);ctx.stroke();ctx.fillStyle='#b7e4c9';ctx.beginPath();ctx.arc(96,96,6,0,Math.PI*2);ctx.fill();
      return c.toDataURL('image/png').split(',')[1];
    },size);
    await mkdir('public/icons',{recursive:true});await writeFile(`public/icons/icon${size}.png`,Buffer.from(png,'base64'));
  }
}finally{await browser.close();}
