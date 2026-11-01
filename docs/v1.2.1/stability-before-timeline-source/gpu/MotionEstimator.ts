import type {Size} from '../shared/types';
import {temporalPerf} from '../temporal/TemporalProfiler';
import type {GpuTimer,GpuRecording} from './GpuTimer';
import common from '../shaders/motion-common.wgsl?raw';
import downsample from '../shaders/motion-downsample.wgsl?raw';
import flow from '../shaders/motion-flow.wgsl?raw';
import warp from '../shaders/motion-warp.wgsl?raw';
export interface MotionConfig{width:number;tier:number}
export interface MotionAnalysis{sceneCut:boolean;dynamic:boolean;confidence:number}
export interface MotionPair extends MotionAnalysis{id?:number;a:number;b:number;ready:boolean;flowMs:number;flowSize:Size;analysis?:Promise<MotionAnalysis>;analysisAvailable?:boolean}
interface CachedPair extends MotionPair{id:number;newest:number;previous:number;bank:number}
export class MotionEstimator{
  private frames:GPUTexture[]=[];private low:GPUTexture[]=[];private flows:GPUTexture[]=[];
  private uniform:GPUBuffer;private summaries:GPUBuffer[];private key='';private count=0;private serial=0;private dead=false;
  private times=[0,0,0];private downGroups:GPUBindGroup[]=[];private flowGroups:GPUBindGroup[]=[];private warpGroups=new Map<number,GPUBindGroup>();private warpTarget?:GPUTexture;
  private banks:(CachedPair|undefined)[]=[undefined,undefined];private reads:{buffer:GPUBuffer;busy:boolean}[]=[];
  private full:Size={width:1,height:1};private lowSize:Size={width:1,height:1};private grid:Size={width:1,height:1};private config:MotionConfig={width:256,tier:1};
  pair:MotionPair={a:0,b:0,ready:false,sceneCut:false,dynamic:false,confidence:0,flowMs:0,flowSize:{width:0,height:0}};
  private constructor(private device:GPUDevice,private timer:GpuTimer|undefined,private down:GPUComputePipeline,private estimate:GPUComputePipeline,private interpolate:GPUComputePipeline){
    this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.summaries=[0,1].map(()=>device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}));
    this.reads=[0,1,2].map(()=>({buffer:device.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:false}));
  }
  static async create(device:GPUDevice,timer?:GpuTimer):Promise<MotionEstimator>{
    device.pushErrorScope('validation');try{const pipelines=[];for(const code of [downsample,flow,warp]){const module=device.createShaderModule({code:common+'\n'+code}),info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error('움직임 셰이더 컴파일 실패: '+errors.map(e=>e.message).join('; '));pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));}return new MotionEstimator(device,timer,pipelines[0],pipelines[1],pipelines[2]);}finally{const error=await device.popErrorScope();if(error)throw new Error('움직임 셰이더 초기화 실패: '+error.message);}
  }
  private sizeKey(size:Size,config:MotionConfig):string{const w=Math.min(size.width,config.width);return [size.width,size.height,w,Math.max(8,Math.round(size.height*w/size.width))].join(',');}
  needsResize(size:Size,config:MotionConfig):boolean{return this.key!==this.sizeKey(size,config);}
  matchesSource(size:Size):boolean{return this.full.width===size.width&&this.full.height===size.height;}
  pairs():MotionPair[]{return this.banks.filter((p):p is CachedPair=>!!p&&p.ready).sort((a,b)=>a.a-b.a);}
  contains(pair:MotionPair):boolean{return this.banks.some(p=>p?.id===pair.id);}
  private params(alpha=1,cut=false):Float32Array<ArrayBuffer>{return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,alpha,this.config.tier===0?4:8+4*this.config.tier,this.config.tier===0?3:4,cut?1:0,0]);}
  private resize(size:Size,config:MotionConfig):void{
    this.config=config;const key=this.sizeKey(size,config);if(key===this.key)return;this.destroyTextures();
    const width=Math.min(size.width,config.width),height=Math.max(8,Math.round(size.height*width/size.width));this.full=size;this.lowSize={width,height};this.grid={width:Math.ceil(width/8),height:Math.ceil(height/8)};
    const make=(s:Size,format:GPUTextureFormat)=>this.device.createTexture({size:[s.width,s.height],format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});
    this.frames=[0,1,2].map(()=>make(size,'rgba8unorm'));this.low=[0,1,2].map(()=>make(this.lowSize,'rgba8unorm'));this.flows=[0,1,2,3].map(()=>make(this.grid,'rgba16float'));
    this.downGroups=this.frames.map((t,i)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:this.low[i].createView()},{binding:2,resource:{buffer:this.uniform}}]}));
    this.flowGroups=[0,1,2].flatMap(newest=>[0,1].map(bank=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[(newest+2)%3].createView()},{binding:1,resource:this.low[newest].createView()},{binding:2,resource:this.flows[bank*2].createView()},{binding:3,resource:this.flows[bank*2+1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summaries[bank]}}]})));
    this.key=key;this.reset();
  }
  enqueue(frame:VideoFrame|HTMLCanvasElement,size:Size,time:number,config:MotionConfig,onError:(e:unknown)=>void):MotionPair{
    if(this.dead)throw new Error('움직임 추정 엔진이 종료되었습니다.');const began=performance.now();this.device.pushErrorScope('validation');
    try{
      this.resize(size,config);const newest=this.count%3,previous=(newest+2)%3,bank=Math.max(0,this.count-1)%2;this.times[newest]=time;
      this.device.queue.writeBuffer(this.uniform,0,this.params());const upload=temporalPerf.mark();this.device.queue.copyExternalImageToTexture({source:frame},{texture:this.frames[newest],colorSpace:'srgb'},[size.width,size.height]);temporalPerf.elapsed('uploadCpuMs',upload);
      const prep=temporalPerf.mark(),gpu=this.timer?.begin(),encoder=this.device.createCommandEncoder();let pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('downsample')});pass.setPipeline(this.down);pass.setBindGroup(0,this.downGroups[newest]);pass.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8));pass.end();
      let read:{buffer:GPUBuffer;busy:boolean}|undefined;
      if(this.count>0){
        encoder.clearBuffer(this.summaries[bank]);pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('flow')});pass.setPipeline(this.estimate);pass.setBindGroup(0,this.flowGroups[newest*2+bank]);pass.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2);pass.end();temporalPerf.count('flowDispatches');
        read=this.reads.find(r=>!r.busy);if(read){read.busy=true;encoder.copyBufferToBuffer(this.summaries[bank],0,read.buffer,0,32);}else temporalPerf.count('analysisReadSkipped');
      }
      temporalPerf.elapsed('flowPrepareCpuMs',prep);gpu?.resolve(encoder);this.device.queue.submit([encoder.finish()]);gpu?.submitted();
      const pair:CachedPair={id:++this.serial,newest,previous,bank,a:this.times[previous],b:time,ready:++this.count>1,sceneCut:false,dynamic:true,confidence:0,flowMs:performance.now()-began,flowSize:{...this.lowSize}};
      pair.analysisAvailable=!!read;
      if(read){const slot=read,wait=temporalPerf.mark();pair.analysis=slot.buffer.mapAsync(GPUMapMode.READ).then(()=>{const v=new Uint32Array(slot.buffer.getMappedRange()),n=Math.max(1,v[4]),error=v[0]/n/65535,diff=v[1]/n/65535;temporalPerf.sample('motionDifference',diff);temporalPerf.sample('movingBlockFraction',v[3]/n);temporalPerf.sample('motionImprovement',diff>0?Math.max(0,1-error/diff):0);const result={sceneCut:diff>.24&&error>.12,dynamic:v[3]>0&&diff>.0005,confidence:v[2]/n/65535};slot.buffer.unmap();temporalPerf.elapsed('flowReadbackWaitMs',wait);Object.assign(pair,result,{flowMs:performance.now()-began});return result;}).catch(error=>{if(!this.dead)onError(error);return {sceneCut:false,dynamic:false,confidence:0};}).finally(()=>{slot.busy=false;});}
      if(pair.ready)this.banks[bank]=pair;this.pair=pair;return pair;
    }finally{void this.device.popErrorScope().then(error=>{if(error&&!this.dead)onError(error);});}
  }
  async capture(frame:VideoFrame|HTMLCanvasElement,size:Size,time:number,config:MotionConfig):Promise<MotionPair>{
    const pair=this.enqueue(frame,size,time,config,error=>{throw error;});if(pair.analysis)await pair.analysis;else await this.device.queue.onSubmittedWorkDone();return pair;
  }
  encodeWarp(encoder:GPUCommandEncoder,output:GPUTexture,alpha:number,gpu?:GpuRecording|null,selected:MotionPair=this.pair):void{
    const pair=this.banks.find(p=>p?.id===selected.id);if(!pair?.ready)throw new Error('유효한 원본 프레임 쌍을 기다리고 있습니다.');
    if(this.warpTarget!==output){this.warpTarget=output;this.warpGroups.clear();}
    const key=pair.newest*2+pair.bank;let group=this.warpGroups.get(key);
    if(!group){group=this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[pair.previous].createView()},{binding:1,resource:this.frames[pair.newest].createView()},{binding:2,resource:this.flows[pair.bank*2].createView()},{binding:3,resource:this.flows[pair.bank*2+1].createView()},{binding:4,resource:output.createView()},{binding:5,resource:{buffer:this.uniform}},{binding:6,resource:{buffer:this.summaries[pair.bank]}}]});this.warpGroups.set(key,group);}
    this.device.queue.writeBuffer(this.uniform,0,this.params(alpha,pair.sceneCut));const pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('warp')});pass.setPipeline(this.interpolate);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8));pass.end();
  }
  reset():void{this.count=0;this.times=[0,0,0];this.banks=[undefined,undefined];this.pair.ready=false;this.warpTarget=undefined;this.warpGroups.clear();}
  private destroyTextures():void{for(const t of [...this.frames,...this.low,...this.flows])t.destroy();this.frames=[];this.low=[];this.flows=[];this.warpTarget=undefined;this.warpGroups.clear();}
  destroy():void{if(this.dead)return;this.dead=true;this.destroyTextures();this.uniform.destroy();for(const b of this.summaries)b.destroy();for(const r of this.reads)r.buffer.destroy();this.reads=[];}
}


