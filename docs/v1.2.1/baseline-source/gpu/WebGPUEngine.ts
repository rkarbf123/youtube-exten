import type { Dimensions, RenderOptions, RenderTiming, UpscaleEngine } from '../shared/types';
import common from '../shaders/common.wgsl?raw';
import denoise from '../shaders/denoise.wgsl?raw';
import upscale from '../shaders/upscale.wgsl?raw';
import composite from '../shaders/composite.wgsl?raw';
import colorCorrection from '../shaders/color.wgsl?raw';
import {MotionEstimator,type MotionConfig,type MotionPair} from './MotionEstimator';
import {FrameSignature} from './FrameSignature';
export interface GPUShaderSources { common: string; denoise: string; upscale: string; composite: string }

export class WebGPUEngine implements UpscaleEngine {
  readonly backend = 'WebGPU'; readonly maxPixels = 8_294_400;
  readonly maxDimension: number;
  private context: GPUCanvasContext;
  private uniform: GPUBuffer;
  private textures: GPUTexture[] = [];
  private denoiseGroup?: GPUBindGroup; private upscaleRaw?: GPUBindGroup; private upscaleClean?: GPUBindGroup; private compositeGroup?: GPUBindGroup;
  private compositeRaw?:GPUBindGroup;private compositeClean?:GPUBindGroup;
  private key = ''; private dead = false;
  private motion?:MotionEstimator;private signature?:FrameSignature;private measureSignature=false;
  lastSignature:string|null=null;
  lastPixels:Uint8ClampedArray|null=null;
  private constructor(private canvas: HTMLCanvasElement, private device: GPUDevice, private clean: GPUComputePipeline, private reconstruct: GPUComputePipeline, private presentPipeline: GPURenderPipeline) {
    this.maxDimension = device.limits.maxTextureDimension2D;
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('WebGPU canvas context unavailable.');
    this.context = context;
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque', colorSpace: 'srgb',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC });
    this.uniform = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }
  static async create(canvas: HTMLCanvasElement, onLoss: (reason: string) => void, sources:GPUShaderSources={common,denoise,upscale,composite}): Promise<WebGPUEngine> {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser/context.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) throw new Error('No WebGPU adapter.');
    const device = await adapter.requestDevice();
    try {
      const modules = [sources.denoise, sources.upscale, sources.composite].map(code => device.createShaderModule({ code: sources.common + '\n'+colorCorrection+'\n' + code }));
      for (const module of modules) {
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter(m => m.type === 'error');
        if (errors.length) throw new Error(errors.map(e => `WGSL ${e.lineNum}: ${e.message}`).join('; '));
      }
      const [clean, reconstruct, present] = await Promise.all([
        device.createComputePipelineAsync({ layout: 'auto', compute: { module: modules[0], entryPoint: 'main' } }),
        device.createComputePipelineAsync({ layout: 'auto', compute: { module: modules[1], entryPoint: 'main' } }),
        device.createRenderPipelineAsync({ layout: 'auto', vertex: { module: modules[2], entryPoint: 'vertex' }, fragment: { module: modules[2], entryPoint: 'fragment', targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }] }, primitive: { topology: 'triangle-list' } })
      ]);
      const engine = new WebGPUEngine(canvas, device, clean, reconstruct, present);
      void device.lost.then(info => { if (!engine.dead) onLoss(`WebGPU device lost: ${info.message || info.reason}`); });
      device.addEventListener('uncapturederror', event => { if (!engine.dead) onLoss(`WebGPU: ${event.error.message}`); });
      return engine;
    } catch (error) { device.destroy(); throw error; }
  }
  private resize(d: Dimensions): void {
    const { source: s, output: o } = d; const key = `${s.width},${s.height},${o.width},${o.height}`;
    if (key === this.key) return;
    this.textures.forEach(t => t.destroy()); this.textures = []; this.key = '';
    if (Math.max(s.width, s.height, o.width, o.height) > this.maxDimension || s.width * s.height * 8 + o.width * o.height * 8 > 160 * 1024 * 1024) throw new Error('Resolution exceeds safe GPU memory or texture limits.');
    this.canvas.width = o.width; this.canvas.height = o.height;
    for (const [index, size] of [s, s, o].entries()) {
      this.textures.push(this.device.createTexture({ label: ['source', 'denoised', 'reconstructed'][index], size: [size.width, size.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING }));
    }
    const [raw, clean, output] = this.textures.map(t => t.createView());
    const group = (layout: GPUBindGroupLayout, a: GPUTextureView, b: GPUTextureView) => this.device.createBindGroup({ layout, entries: [{ binding: 0, resource: a }, { binding: 1, resource: b }, { binding: 2, resource: { buffer: this.uniform } }] });
    this.denoiseGroup = group(this.clean.getBindGroupLayout(0), raw, clean);
    this.upscaleRaw = group(this.reconstruct.getBindGroupLayout(0), raw, output);
    this.upscaleClean = group(this.reconstruct.getBindGroupLayout(0), clean, output);
    this.compositeGroup = group(this.presentPipeline.getBindGroupLayout(0), raw, output);
    this.compositeRaw=group(this.presentPipeline.getBindGroupLayout(0),raw,raw);
    this.compositeClean=group(this.presentPipeline.getBindGroupLayout(0),raw,clean);
    this.key = key;
  }
  async render(source: HTMLVideoElement | HTMLCanvasElement, d: Dimensions, options: RenderOptions): Promise<RenderTiming> {
    return this.renderInternal(source,d,options);
  }
  async captureFrame(frame:VideoFrame|HTMLCanvasElement,size:{width:number;height:number},time:number,config:MotionConfig):Promise<MotionPair>{
    if(this.dead)throw new Error('GPU 엔진이 종료되었습니다.');
    if(!this.motion){const motion=await MotionEstimator.create(this.device);if(this.dead){motion.destroy();throw new Error('GPU 엔진이 종료되었습니다.');}this.motion=motion;}
    return this.motion.capture(frame,size,time,config);
  }
  resetTemporal():void{this.motion?.reset();}
  releaseTemporal():void{this.motion?.destroy();this.motion=undefined;this.signature?.destroy();this.signature=undefined;this.lastSignature=null;}
  async renderTemporal(d:Dimensions,options:RenderOptions,alpha:number):Promise<RenderTiming>{
    if(!this.motion)throw new Error('움직임 추정이 준비되지 않았습니다.');return this.renderInternal(null,d,{...options,measureSignature:true},alpha);
  }
  private async renderInternal(source:HTMLVideoElement|HTMLCanvasElement|null,d:Dimensions,options:RenderOptions,alpha=1):Promise<RenderTiming>{
    if (this.dead) throw new Error('GPU engine has been destroyed.');
    const start = performance.now(); const device = this.device;
    device.pushErrorScope('validation'); device.pushErrorScope('out-of-memory');
    let thrown: unknown;
    try {
      this.resize(d);
      this.measureSignature=!!options.measureSignature;
      if(this.measureSignature&&!this.signature){const signature=await FrameSignature.create(this.device);if(this.dead){signature.destroy();throw new Error('GPU 엔진이 종료되었습니다.');}this.signature=signature;}
      const { source: s, output: o } = d;
      device.queue.writeBuffer(this.uniform, 0, new Float32Array([s.width,s.height,o.width,o.height,options.sharpness,options.denoise,options.engine === 'balanced' ? 1 : 0,options.comparison ? 1 : 0,options.divider,options.contentMode==='animation'?1:0,options.original?1:0,0,(options.saturation??100)/100,(options.brightness??100)/100,options.upscale===false?0:1,0]));
      // The browser enforces origin-clean and protected-media restrictions here.
      if(source)device.queue.copyExternalImageToTexture({ source }, { texture: this.textures[0], colorSpace: 'srgb' }, [s.width, s.height]);
      const encoder = device.createCommandEncoder();
      if(!source)this.motion!.encodeWarp(encoder,this.textures[0],alpha);
      const doDenoise = !options.original && options.engine === 'balanced' && options.denoise > 0;
      if (doDenoise) {
        const pass = encoder.beginComputePass(); pass.setPipeline(this.clean); pass.setBindGroup(0, this.denoiseGroup!);
        pass.dispatchWorkgroups(Math.ceil(s.width/8),Math.ceil(s.height/8)); pass.end();
      }
      if(!options.original&&options.upscale!==false){
        const pass = encoder.beginComputePass(); pass.setPipeline(this.reconstruct); pass.setBindGroup(0, doDenoise ? this.upscaleClean! : this.upscaleRaw!);
        pass.dispatchWorkgroups(Math.ceil(o.width/8),Math.ceil(o.height/8)); pass.end();
      }
      this.selectedComposite=options.upscale===false?(doDenoise?this.compositeClean:this.compositeRaw):this.compositeGroup;
      device.queue.submit([encoder.finish()]);
    } catch (error) { thrown = error; }
    const cpuSubmitMs = performance.now() - start;
    const memoryError = await device.popErrorScope(); const validationError = await device.popErrorScope();
    if (thrown) throw thrown;
    if (memoryError || validationError) throw new Error((memoryError || validationError)!.message);
    // Temporal output is followed immediately by present() on this same queue.
    // Its signature readback fences both submissions; avoid a redundant CPU/GPU round trip.
    if(source)await device.queue.onSubmittedWorkDone();
    if (this.dead) throw new Error('GPU was destroyed during processing.');
    // Completion latency includes CPU, queue and GPU work. It is NOT a GPU timestamp.
    return { cpuSubmitMs, latencyMs: performance.now() - start, gpuMs: null };
  }
  private selectedComposite?:GPUBindGroup;
  async present(readback:'none'|'pixel'|'full'='none'):Promise<number>{
    if(this.dead||!this.compositeGroup)throw new Error('No completed GPU frame to present.');
    const start=performance.now();this.device.pushErrorScope('validation');
    const encoder=this.device.createCommandEncoder();
    const texture=this.context.getCurrentTexture();
    const pass=encoder.beginRenderPass({colorAttachments:[{view:texture.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    pass.setPipeline(this.presentPipeline);pass.setBindGroup(0,this.selectedComposite??this.compositeGroup);pass.draw(3);pass.end();
    if(this.measureSignature)this.signature!.encode(encoder,texture);
    const width=readback==='full'?this.canvas.width:1,height=readback==='full'?this.canvas.height:1,row=Math.ceil(width*4/256)*256;
    const copy=readback!=='none'?this.device.createBuffer({size:row*height,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;
    if(copy)encoder.copyTextureToBuffer({texture},{buffer:copy,bytesPerRow:row},[width,height]);
    this.device.queue.submit([encoder.finish()]);const cpu=performance.now()-start;
    const error=await this.device.popErrorScope();if(error)throw new Error(error.message);
    if(this.measureSignature)this.lastSignature=await this.signature!.read();else{await this.device.queue.onSubmittedWorkDone();this.lastSignature=null;}
    this.lastPixels=null;
    if(copy){try{await copy.mapAsync(GPUMapMode.READ);const data=new Uint8Array(copy.getMappedRange()),pixels=new Uint8ClampedArray(width*height*4);const bgra=navigator.gpu.getPreferredCanvasFormat().startsWith('bgra');for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*row+x*4,j=(y*width+x)*4;pixels[j]=data[i+(bgra?2:0)];pixels[j+1]=data[i+1];pixels[j+2]=data[i+(bgra?0:2)];pixels[j+3]=data[i+3];}this.lastPixels=pixels;copy.unmap();}finally{copy.destroy();}}
    return cpu;
  }
  destroy(): void {
    if (this.dead) return; this.dead = true;
    this.releaseTemporal();
    this.textures.forEach(t => t.destroy()); this.textures = [];
    this.uniform.destroy(); this.context.unconfigure(); this.device.destroy();
  }
}
