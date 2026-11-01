import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {preview} from 'vite';
let server:Awaited<ReturnType<typeof preview>>;
const baseURL='http://127.0.0.1:5208';
test.beforeAll(async()=>{server=await preview({preview:{host:'127.0.0.1',port:5208,strictPort:true}});});
test.afterAll(async()=>{await server?.close();});
async function fixture(name:string,count:number){
 const root='docs/v1.3/input-isolation',m=JSON.parse(await readFile(root+'/manifest.json','utf8')),c=m.cases.find((x:{name:string})=>x.name===name),source=m.sources.find((x:{name:string})=>x.name===c.source),pairs=c.pairs.slice(0,count),frames=Math.max(...pairs.map((x:{c:number})=>x.c))+1;
 return {pairs,source:{...source,frames:source.frames.slice(0,frames),url:'/isolation-fixture.rgba'},bytes:(await readFile(root+'/'+source.file)).subarray(0,frames*source.width*source.height*4)};
}
test('identical real 24fps A/C inputs match raw bytes across offline and realtime GPU paths',async({browser})=>{
 const f=await fixture('youtube24-consecutive',3);
 // Match the independent-context experiment. Each helper owns and destroys its
 // device; its canvas must not be reused by the other runtime instance.
 const outputs=[];for(const mode of ['offline','realtime']as const){const page=await browser.newPage();page.on('console',m=>{if(m.text().includes('[input-isolation]'))console.log(m.text());});try{await page.route('**/isolation-fixture.rgba',r=>r.fulfill({body:f.bytes}));await page.goto(baseURL+'/harness/framegen.html');outputs.push(await page.evaluate(c=>window.framegenInputIsolation(c),{source:f.source,pairs:f.pairs,mode}));}finally{await page.close();}}
 const [offline,rt]=outputs;expect(rt.discarded).toEqual([]);expect(rt.errors).toEqual([]);expect(rt.canvasSubmissions).toBe(3);expect(rt.postprocessing).toBe(false);expect(rt.guardApplied).toBe(false);
 for(const r of rt.rows){const o=offline.rows.find(x=>x.pair.id===r.pair.id)!;expect(r.inputMatchesDecodedA&&r.inputMatchesDecodedC).toBe(true);expect(r.outputHash).toBe(o.outputHash);expect(r.inputHashA).toBe(o.inputHashA);expect(r.inputHashC).toBe(o.inputHashC);expect(r.pair.ptsC-r.pair.ptsA).toBeCloseTo(1/24,6);}
});
test('native 60fps held-out B has actual 30fps A/C spacing and all GPU resources are released',async({page})=>{
 const f=await fixture('bbb60-heldout',2);await page.route('**/isolation-fixture.rgba',r=>r.fulfill({body:f.bytes}));await page.goto(baseURL+'/harness/framegen.html');
 const result=await page.evaluate(async config=>{
  const buffers=new Set<GPUBuffer>(),textures=new Set<GPUTexture>(),cb=GPUDevice.prototype.createBuffer,ct=GPUDevice.prototype.createTexture,db=GPUBuffer.prototype.destroy,dt=GPUTexture.prototype.destroy;
  GPUDevice.prototype.createBuffer=function(desc){const b=cb.call(this,desc);buffers.add(b);return b;};GPUDevice.prototype.createTexture=function(desc){const t=ct.call(this,desc);textures.add(t);return t;};GPUBuffer.prototype.destroy=function(){buffers.delete(this);db.call(this);};GPUTexture.prototype.destroy=function(){textures.delete(this);dt.call(this);};
  try{const output=await window.framegenInputIsolation(config);return {output,buffers:buffers.size,textures:textures.size};}finally{GPUDevice.prototype.createBuffer=cb;GPUDevice.prototype.createTexture=ct;GPUBuffer.prototype.destroy=db;GPUTexture.prototype.destroy=dt;}
 },{source:f.source,pairs:f.pairs,mode:'realtime' as const});
 expect(result.buffers).toBe(0);expect(result.textures).toBe(0);expect(result.output.truthNotUploadedToInference).toBe(true);expect(result.output.errors).toEqual([]);
 for(const r of result.output.rows){expect(r.pair.c-r.pair.a).toBe(2);expect(r.pair.truth).toBe(r.pair.a+1);expect(r.pair.inputFPS).toBeCloseTo(30,6);expect(r.pair.outputPTS).toBe(f.source.frames[r.pair.truth!].pts);expect(r.inputFrameA).not.toBe(f.source.frames[r.pair.truth!].id);expect(r.inputFrameC).not.toBe(f.source.frames[r.pair.truth!].id);}
});
