import type {Size} from '../shared/types';
import {temporalPerf} from '../temporal/TemporalProfiler';
import type {GpuTimer,GpuRecording} from './GpuTimer';
import common from '../shaders/motion-common.wgsl?raw';
import downsample from '../shaders/motion-downsample.wgsl?raw';
import flow from '../shaders/motion-flow.wgsl?raw';
import warp from '../shaders/motion-warp.wgsl?raw';
export interface MotionConfig{width:number;tier:number}
export interface MotionAnalysis{sceneCut:boolean;dynamic:boolean;confidence:number}
export interface MotionPair extends MotionAnalysis{id?:number;owner?:number;generation?:number;frameA?:number;frameB?:number;a:number;b:number;ready:boolean;flowMs:number;flowSize:Size;analysis?:Promise<MotionAnalysis>;analysisAvailable?:boolean}
interface CachedPair extends MotionPair{id:number;newest:number;previous:number;bank:number}
let nextOwner=0;
export class MotionEstimator{
  private frames:GPUTexture[]=[];private low:GPUTexture[]=[];private flows:GPUTexture[]=[];private pyramid:GPUTexture[]=[];private coarseFlows:GPUTexture[]=[];private refinedFlows:GPUTexture[]=[];private refineGroups:GPUBindGroup[]=[];
  private debug=false;setDebug(enabled:boolean):void{this.debug=enabled;}
  private coarseUniform:GPUBuffer;private uniform:GPUBuffer;private summaries:GPUBuffer[];private key='';private count=0;private serial=0;private dead=false;
  private times=[0,0,0];private frameIds=[0,0,0];private frameSerial=0;private generation=0;private readonly owner=++nextOwner;private pyramidGroups:GPUBindGroup[]=[];private coarseGroups:GPUBindGroup[]=[];private downGroups:GPUBindGroup[]=[];private flowGroups:GPUBindGroup[]=[];private warpGroups=new Map<number,GPUBindGroup>();private warpTarget?:GPUTexture;
  private banks:(CachedPair|undefined)[]=[undefined,undefined];private reads:{buffer:GPUBuffer;busy:boolean}[]=[];
  private full:Size={width:1,height:1};private lowSize:Size={width:1,height:1};private grid:Size={width:1,height:1};private config:MotionConfig={width:256,tier:1};
  pair:MotionPair={a:0,b:0,ready:false,sceneCut:false,dynamic:false,confidence:0,flowMs:0,flowSize:{width:0,height:0}};
  private constructor(private device:GPUDevice,private timer:GpuTimer|undefined,private down:GPUComputePipeline,private estimate:GPUComputePipeline,private interpolate:GPUComputePipeline,private refine:GPUComputePipeline){
    this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.coarseUniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.summaries=[0,1].map(()=>device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}));
    this.reads=[0,1,2].map(()=>({buffer:device.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:false}));
  }
  static async create(device:GPUDevice,timer?:GpuTimer):Promise<MotionEstimator>{
    device.pushErrorScope('validation');try{const pipelines=[];for(const code of [downsample,flow,warp]){const module=device.createShaderModule({code:common+'\n'+code}),info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error('움직임 셰이더 컴파일 실패: '+errors.map(e=>e.message).join('; '));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}const refine=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:common+'\n'+flow}),entryPoint:'refine'}});return new MotionEstimator(device,timer,pipelines[0],pipelines[1],pipelines[2],refine);}finally{const error=await device.popErrorScope();if(error)throw new Error('움직임 셰이더 초기화 실패: '+error.message);}
  }
  private sizeKey(size:Size,config:MotionConfig):string{const w=Math.min(size.width,config.width);return [size.width,size.height,w,Math.max(8,Math.round(size.height*w/size.width))].join(',');}
  needsResize(size:Size,config:MotionConfig):boolean{return this.key!==this.sizeKey(size,config);}
  matchesSource(size:Size):boolean{return this.full.width===size.width&&this.full.height===size.height;}
  pairs():MotionPair[]{return this.banks.filter((p):p is CachedPair=>!!p&&p.ready).sort((a,b)=>a.a-b.a);}
  contains(pair:MotionPair):boolean{return pair.owner===this.owner&&pair.generation===this.generation&&this.banks.some(p=>!!p&&p.id===pair.id&&p.a===pair.a&&p.b===pair.b&&p.frameA===pair.frameA&&p.frameB===pair.frameB&&this.frameIds[p.previous]===p.frameA&&this.frameIds[p.newest]===p.frameB);}
  private params(alpha=1,cut=false,debug=false):Float32Array<ArrayBuffer>{return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,alpha,this.config.tier===0?4:8+4*this.config.tier,this.config.tier===0?3:4,cut?1:0,debug?2:1]);}
  private resize(size:Size,config:MotionConfig):void{
    this.config=config;const key=this.sizeKey(size,config);if(key===this.key)return;this.destroyTextures();
    const width=Math.min(size.width,config.width),height=Math.max(8,Math.round(size.height*width/size.width));this.full=size;this.lowSize={width,height};this.grid={width:Math.ceil(width/8),height:Math.ceil(height/8)};
    const make=(s:Size,format:GPUTextureFormat)=>this.device.createTexture({size:[s.width,s.height],format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});
    const coarse={width:Math.ceil(width/2),height:Math.ceil(height/2)},coarseGrid={width:Math.ceil(coarse.width/8),height:Math.ceil(coarse.height/8)};this.pyramid=[0,1,2].map(()=>make(coarse,'rgba8unorm'));this.coarseFlows=[0,1,2,3].map(()=>make(coarseGrid,'rgba16float'));
    this.frames=[0,1,2].map(()=>make(size,'rgba8unorm'));this.low=[0,1,2].map(()=>make(this.lowSize,'rgba8unorm'));this.flows=[0,1,2,3].map(()=>make(this.grid,'rgba16float'));this.refinedFlows=[0,1,2,3].map(()=>make(this.grid,'rgba16float'));
    this.downGroups=this.frames.map((t,i)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:this.low[i].createView()},{binding:2,resource:{buffer:this.uniform}}]}));
    this.pyramidGroups=this.low.map((t,i)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:this.pyramid[i].createView()},{binding:2,resource:{buffer:this.coarseUniform}}]}));
    const groups=(coarseLevel:boolean)=>[0,1,2].flatMap(newest=>[0,1].map(bank=>{const images=coarseLevel?this.pyramid:this.low,output=coarseLevel?this.coarseFlows:this.flows,seed=coarseLevel?this.flows:this.coarseFlows;return this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:images[(newest+2)%3].createView()},{binding:1,resource:images[newest].createView()},{binding:2,resource:output[bank*2].createView()},{binding:3,resource:output[bank*2+1].createView()},{binding:4,resource:{buffer:coarseLevel?this.coarseUniform:this.uniform}},{binding:5,resource:{buffer:this.summaries[bank]}},{binding:6,resource:seed[bank*2].createView()},{binding:7,resource:seed[bank*2+1].createView()}]});}));
    this.coarseGroups=groups(true);this.flowGroups=groups(false);
    this.refineGroups=[0,1,2].flatMap(newest=>[0,1].map(bank=>this.device.createBindGroup({layout:this.refine.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[(newest+2)%3].createView()},{binding:1,resource:this.low[newest].createView()},{binding:2,resource:this.refinedFlows[bank*2].createView()},{binding:3,resource:this.refinedFlows[bank*2+1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:6,resource:this.flows[bank*2].createView()},{binding:7,resource:this.flows[bank*2+1].createView()}]})));
    this.key=key;this.reset();
  }
  enqueue(frame:VideoFrame|HTMLCanvasElement,size:Size,time:number,config:MotionConfig,onError:(e:unknown)=>void):MotionPair{
    if(this.dead)throw new Error('움직임 추정 엔진이 종료되었습니다.');const began=performance.now();this.device.pushErrorScope('validation');
    try{
      this.resize(size,config);if(!Number.isFinite(time))throw new Error('???? ?? ??? PTS');if(this.count>0&&(time<=this.times[(this.count+2)%3]||time-this.times[(this.count+2)%3]>.25)){temporalPerf.count('discard.sourceOrder');this.reset();}const newest=this.count%3,previous=(newest+2)%3,bank=Math.max(0,this.count-1)%2;this.times[newest]=time;this.frameIds[newest]=++this.frameSerial;
      this.device.queue.writeBuffer(this.uniform,0,this.params());const cw=Math.ceil(this.lowSize.width/2),ch=Math.ceil(this.lowSize.height/2);this.device.queue.writeBuffer(this.coarseUniform,0,new Float32Array([this.lowSize.width,this.lowSize.height,cw,ch,Math.ceil(cw/8),Math.ceil(ch/8),8,1,this.config.tier===0?4:this.config.tier===1?16:20,this.config.tier===0?3:4,0,0]));const upload=temporalPerf.mark();this.device.queue.copyExternalImageToTexture({source:frame},{texture:this.frames[newest],colorSpace:'srgb'},[size.width,size.height]);temporalPerf.elapsed('uploadCpuMs',upload);
      const prep=temporalPerf.mark(),gpu=this.timer?.begin(),encoder=this.device.createCommandEncoder();let pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('downsample')});pass.setPipeline(this.down);pass.setBindGroup(0,this.downGroups[newest]);pass.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8));pass.end();
      pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('pyramid')});pass.setPipeline(this.down);pass.setBindGroup(0,this.pyramidGroups[newest]);pass.dispatchWorkgroups(Math.ceil(cw/8),Math.ceil(ch/8));pass.end();
      let read:{buffer:GPUBuffer;busy:boolean}|undefined;
      if(this.count>0){
        encoder.clearBuffer(this.summaries[bank]);pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('coarseFlow')});pass.setPipeline(this.estimate);pass.setBindGroup(0,this.coarseGroups[newest*2+bank]);pass.dispatchWorkgroups(Math.ceil(cw/64),Math.ceil(ch/64),2);pass.end();pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('flow')});pass.setPipeline(this.estimate);pass.setBindGroup(0,this.flowGroups[newest*2+bank]);pass.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2);pass.end();pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('refineFlow')});pass.setPipeline(this.refine);pass.setBindGroup(0,this.refineGroups[newest*2+bank]);pass.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2);pass.end();temporalPerf.count('flowDispatches');
        read=this.reads.find(r=>!r.busy);if(read){read.busy=true;encoder.copyBufferToBuffer(this.summaries[bank],0,read.buffer,0,32);}else temporalPerf.count('analysisReadSkipped');
      }
      temporalPerf.elapsed('flowPrepareCpuMs',prep);gpu?.resolve(encoder);this.device.queue.submit([encoder.finish()]);gpu?.submitted();
      const pair:CachedPair={id:++this.serial,owner:this.owner,generation:this.generation,frameA:this.frameIds[previous],frameB:this.frameIds[newest],newest,previous,bank,a:this.times[previous],b:time,ready:++this.count>1,sceneCut:false,dynamic:true,confidence:0,flowMs:performance.now()-began,flowSize:{...this.lowSize}};
      pair.analysisAvailable=!!read;
      if(read){const slot=read,wait=temporalPerf.mark();pair.analysis=slot.buffer.mapAsync(GPUMapMode.READ).then(()=>{const v=new Uint32Array(slot.buffer.getMappedRange()),n=Math.max(1,v[4]),error=v[0]/n/65535,diff=v[1]/n/65535;temporalPerf.sample('motionDifference',diff);temporalPerf.sample('movingBlockFraction',v[3]/n);temporalPerf.sample('motionImprovement',diff>0?Math.max(0,1-error/diff):0);const result={sceneCut:diff>.24&&error>.12,dynamic:v[3]>0&&diff>.0005,confidence:v[2]/n/65535};slot.buffer.unmap();temporalPerf.elapsed('flowReadbackWaitMs',wait);Object.assign(pair,result,{flowMs:performance.now()-began});return result;}).catch(error=>{if(!this.dead)onError(error);return {sceneCut:false,dynamic:false,confidence:0};}).finally(()=>{slot.busy=false;});}
      if(pair.ready)this.banks[bank]=pair;this.pair=pair;return pair;
    }finally{void this.device.popErrorScope().then(error=>{if(error&&!this.dead)onError(error);});}
  }
  async capture(frame:VideoFrame|HTMLCanvasElement,size:Size,time:number,config:MotionConfig):Promise<MotionPair>{
    const pair=this.enqueue(frame,size,time,config,error=>{throw error;});if(pair.analysis)await pair.analysis;else await this.device.queue.onSubmittedWorkDone();return pair;
  }
  encodeWarp(encoder:GPUCommandEncoder,output:GPUTexture,alpha:number,gpu?:GpuRecording|null,selected:MotionPair=this.pair):void{
    const pair=this.banks.find(p=>p?.id===selected.id);if(!pair?.ready||!this.contains(selected))throw new Error('유효한 원본 프레임 쌍을 기다리고 있습니다.');
    if(this.warpTarget!==output){this.warpTarget=output;this.warpGroups.clear();}
    const key=pair.newest*2+pair.bank;let group=this.warpGroups.get(key);
    if(!group){group=this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[pair.previous].createView()},{binding:1,resource:this.frames[pair.newest].createView()},{binding:2,resource:this.refinedFlows[pair.bank*2].createView()},{binding:3,resource:this.refinedFlows[pair.bank*2+1].createView()},{binding:4,resource:output.createView()},{binding:5,resource:{buffer:this.uniform}},{binding:6,resource:{buffer:this.summaries[pair.bank]}}]});this.warpGroups.set(key,group);}
    this.device.queue.writeBuffer(this.uniform,0,this.params(alpha,pair.sceneCut,this.debug));const pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('warp')});pass.setPipeline(this.interpolate);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8));pass.end();
  }
  /** Explicit local diagnostics only; normal playback never reads vector textures. */
  async readVectors(){
    const pair=this.banks.find(p=>p?.id===this.pair.id);if(!pair||!this.contains(pair))throw new Error('진단할 프레임 쌍이 없습니다.');
    const half=(v:number)=>{const sign=v&32768?-1:1,e=(v>>10)&31,f=v&1023;return sign*(e===0?2**-14*f/1024:e===31?Infinity:2**(e-15)*(1+f/1024));};
    const fields=[];for(const direction of [0,1]){const row=Math.ceil(this.grid.width*8/256)*256,buffer=this.device.createBuffer({size:row*this.grid.height,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});try{const encoder=this.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:this.refinedFlows[pair.bank*2+direction]},{buffer,bytesPerRow:row},[this.grid.width,this.grid.height]);this.device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);const bytes=new DataView(buffer.getMappedRange()),values=[];for(let y=0;y<this.grid.height;y++)for(let x=0;x<this.grid.width;x++){const at=y*row+x*8;values.push({x:x*8+4,y:y*8+4,dx:half(bytes.getUint16(at,true)),dy:half(bytes.getUint16(at+2,true)),confidence:half(bytes.getUint16(at+4,true)),error:half(bytes.getUint16(at+6,true))});}fields.push(values);buffer.unmap();}finally{buffer.destroy();}}
    return {owner:pair.owner,generation:pair.generation,frameA:pair.frameA,frameB:pair.frameB,a:pair.a,b:pair.b,source:this.full,analysis:this.lowSize,fields};
  }
  reset():void{this.generation++;this.frameIds=[0,0,0];this.count=0;this.times=[0,0,0];this.banks=[undefined,undefined];this.pair.ready=false;this.warpTarget=undefined;this.warpGroups.clear();}
  private destroyTextures():void{for(const t of [...this.frames,...this.low,...this.flows,...this.pyramid,...this.coarseFlows,...this.refinedFlows])t.destroy();this.frames=[];this.low=[];this.flows=[];this.pyramid=[];this.coarseFlows=[];this.refinedFlows=[];this.refineGroups=[];this.pyramidGroups=[];this.coarseGroups=[];this.warpTarget=undefined;this.warpGroups.clear();}
  destroy():void{if(this.dead)return;this.dead=true;this.destroyTextures();this.uniform.destroy();this.coarseUniform.destroy();for(const b of this.summaries)b.destroy();for(const r of this.reads)r.buffer.destroy();this.reads=[];}
}


