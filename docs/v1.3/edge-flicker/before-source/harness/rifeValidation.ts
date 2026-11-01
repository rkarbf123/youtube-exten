import {RifeSession} from '../ai/RifeSession';
import {runMotionQuality} from './motionQuality';
async function validate(){
 const result:{[key:string]:unknown}={status:'running',productIntegrationComplete:false,cpuFallbackAllowed:false},base=new URL('./',location.href),runtime=await RifeSession.create(base),canvas=document.querySelector('canvas')!,ctx=canvas.getContext('webgpu')!;
 result.model=runtime.manifest;result.loadMs=runtime.loadMs;result.adapter={vendor:runtime.adapterInfo.vendor,architecture:runtime.adapterInfo.architecture};
 const device=runtime.device;ctx.configure({device,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:'opaque'});
 const module=device.createShaderModule({code:`@group(0) @binding(0) var<storage,read> image:array<f32>;
 @vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);}
 @fragment fn fragment(@builtin(position) p:vec4f)->@location(0) vec4f{let at=min(u32(p.y),127u)*128u+min(u32(p.x),127u);return vec4f(image[32768u+at],image[16384u+at],image[at],1);}`});
 const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]}});
 const errors:string[]=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));const rows=[];
 try{const inputs=await fetch(new URL('../rife-validation/frames.f32',base));runtime.uploadFrames(new Float32Array(await inputs.arrayBuffer()));
  for(const alpha of [.25,.5,.75]){const {output,completionMs}=await runtime.infer(alpha);const inferenceLocation=output.location;try{
   const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:output.gpuBuffer}}]}),encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();
   // Explicit diagnostic readback; the Canvas above consumes the GPU buffer directly.
   const data=await output.getData(),ref=new Float32Array(await(await fetch(new URL(`../rife-validation/pytorch-${alpha}.f32`,base))).arrayBuffer());let max=0,mae=0,square=0;for(let i=0;i<data.length;i++){const d=Math.abs(Number(data[i])-ref[i]);max=Math.max(max,d);mae+=d;square+=d*d;}
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Float32Array(data as Float32Array).buffer)),v=>v.toString(16).padStart(2,'0')).join('');
   rows.push({timestep:alpha,location:inferenceLocation,locationAfterDiagnosticReadback:output.location,shape:output.dims,completionMs,maxAbs:max,mae:mae/data.length,rmse:Math.sqrt(square/data.length),hash,passed:max<.01&&mae/data.length<.0002});
  }finally{output.dispose();}}
  result.rows=rows;result.gpuErrors=errors;result.distinctOutputs=new Set(rows.map(r=>r.hash)).size;result.status=rows.every(r=>r.passed)&&errors.length===0?'passed':'failed';
  // Retain the last rendered image for screenshot, then explicitly release resources.
  await new Promise<void>(r=>requestAnimationFrame(()=>r()));return result;
 }finally{await runtime.release();result.released=true;}
}
declare global{interface Window{rifeValidation:typeof validate;rifeCompare:typeof runMotionQuality}}
window.rifeValidation=validate;window.rifeCompare=runMotionQuality;
document.querySelector('button')!.addEventListener('click',()=>{const status=document.querySelector('pre')!;status.textContent='실제 RIFE 검증 중…';void validate().then(r=>status.textContent=JSON.stringify(r,null,2)).catch(e=>status.textContent=String(e));});
