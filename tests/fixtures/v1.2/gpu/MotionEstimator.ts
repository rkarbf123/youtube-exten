import type { Size } from '../shared/types';
import common from '../shaders/motion-common.wgsl?raw';
import downsample from '../shaders/motion-downsample.wgsl?raw';
import flow from '../shaders/motion-flow.wgsl?raw';
import warp from '../shaders/motion-warp.wgsl?raw';
export interface MotionConfig {width:number;tier:number}
export interface MotionPair {a:number;b:number;ready:boolean;sceneCut:boolean;dynamic:boolean;confidence:number;flowMs:number;flowSize:Size}
export class MotionEstimator {
  private frames:GPUTexture[]=[];private low:GPUTexture[]=[];private flows:GPUTexture[]=[];
  private uniform:GPUBuffer;private summary:GPUBuffer;private readback:GPUBuffer;private key='';private count=0;private newest=0;private dead=false;
  private times=[0,0];private downGroups:GPUBindGroup[]=[];private flowGroups:GPUBindGroup[]=[];private warpGroups:GPUBindGroup[]=[];private warpTarget?:GPUTexture;
  private full:Size={width:1,height:1};private lowSize:Size={width:1,height:1};private grid:Size={width:1,height:1};private config:MotionConfig={width:256,tier:1};
  pair:MotionPair={a:0,b:0,ready:false,sceneCut:false,dynamic:false,confidence:0,flowMs:0,flowSize:{width:0,height:0}};
  private constructor(private device:GPUDevice,private down:GPUComputePipeline,private estimate:GPUComputePipeline,private interpolate:GPUComputePipeline){
    this.uniform=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.summary=device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});
    this.readback=device.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  }
  static async create(device:GPUDevice):Promise<MotionEstimator>{
    device.pushErrorScope('validation');
    try{
    const pipelines=[];
    for(const source of [downsample,flow,warp]){
      const module=device.createShaderModule({code:common+'\n'+source});const info=await module.getCompilationInfo();
      const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error('움직임 셰이더 컴파일 실패: '+errors.map(e=>e.message).join('; '));
      pipelines.push(await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));
    }
    return new MotionEstimator(device,pipelines[0],pipelines[1],pipelines[2]);
    }finally{const error=await device.popErrorScope();if(error)throw new Error('움직임 셰이더 초기화 실패: '+error.message);}
  }
  private params(alpha=1,cut=false):Float32Array<ArrayBuffer>{return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,alpha,4+4*this.config.tier,this.config.tier===0?3:4,cut?1:0,0]);}
  private resize(size:Size,config:MotionConfig):void{
    const width=Math.min(size.width,config.width);const height=Math.max(8,Math.round(size.height*width/size.width));
    const key=`${size.width},${size.height},${width},${height}`;this.config=config;if(key===this.key)return;
    this.destroyTextures();this.full=size;this.lowSize={width,height};this.grid={width:Math.ceil(width/8),height:Math.ceil(height/8)};
    const make=(s:Size,format:GPUTextureFormat)=>this.device.createTexture({size:[s.width,s.height],format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});
    this.frames=[make(size,'rgba8unorm'),make(size,'rgba8unorm')];this.low=[make(this.lowSize,'rgba8unorm'),make(this.lowSize,'rgba8unorm')];this.flows=[make(this.grid,'rgba16float'),make(this.grid,'rgba16float')];
    this.downGroups=this.frames.map((t,i)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:this.low[i].createView()},{binding:2,resource:{buffer:this.uniform}}]}));
    this.flowGroups=[0,1].map(newest=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[1-newest].createView()},{binding:1,resource:this.low[newest].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summary}}]}));
    this.key=key;this.reset();
  }
  async capture(frame:VideoFrame|HTMLCanvasElement,size:Size,time:number,config:MotionConfig):Promise<MotionPair>{
    if(this.dead)throw new Error('움직임 추정 엔진이 종료되었습니다.');const start=performance.now();
    this.device.pushErrorScope('validation');
    try{
      this.resize(size,config);this.newest=this.count===0?0:1-this.newest;this.times[this.newest]=time;
      this.device.queue.writeBuffer(this.uniform,0,this.params());
      this.device.queue.copyExternalImageToTexture({source:frame},{texture:this.frames[this.newest],colorSpace:'srgb'},[size.width,size.height]);
      const encoder=this.device.createCommandEncoder();let pass=encoder.beginComputePass();pass.setPipeline(this.down);pass.setBindGroup(0,this.downGroups[this.newest]);pass.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8));pass.end();
      if(this.count>0){encoder.clearBuffer(this.summary);pass=encoder.beginComputePass();pass.setPipeline(this.estimate);pass.setBindGroup(0,this.flowGroups[this.newest]);pass.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2);pass.end();encoder.copyBufferToBuffer(this.summary,0,this.readback,0,32);}
      this.device.queue.submit([encoder.finish()]);
      let sceneCut=false,dynamic=false,confidence=0;
      if(this.count>0){await this.readback.mapAsync(GPUMapMode.READ);const values=new Uint32Array(this.readback.getMappedRange());const blocks=Math.max(1,values[4]);const error=values[0]/blocks/65535,diff=values[1]/blocks/65535;confidence=values[2]/blocks/65535;dynamic=values[3]>0&&diff>.0001;sceneCut=diff>.24&&error>.12;this.readback.unmap();}
      else await this.device.queue.onSubmittedWorkDone();
      this.count++;this.pair={a:this.times[1-this.newest],b:time,ready:this.count>1,sceneCut,dynamic,confidence,flowMs:performance.now()-start,flowSize:{...this.lowSize}};
    }finally{const error=await this.device.popErrorScope();if(error)throw new Error('움직임 추정 GPU 오류: '+error.message);}
    return this.pair;
  }
  encodeWarp(encoder:GPUCommandEncoder,output:GPUTexture,alpha:number):void{
    if(!this.pair.ready)throw new Error('서로 다른 두 원본 프레임을 기다리고 있습니다.');
    if(this.warpTarget!==output){this.warpTarget=output;this.warpGroups=[0,1].map(newest=>this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[1-newest].createView()},{binding:1,resource:this.frames[newest].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:output.createView()},{binding:5,resource:{buffer:this.uniform}}]}));}
    this.device.queue.writeBuffer(this.uniform,0,this.params(alpha,this.pair.sceneCut));const pass=encoder.beginComputePass();pass.setPipeline(this.interpolate);pass.setBindGroup(0,this.warpGroups[this.newest]);pass.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8));pass.end();
  }
  reset():void{this.count=0;this.times=[0,0];this.pair.ready=false;this.warpTarget=undefined;}
  private destroyTextures():void{for(const t of [...this.frames,...this.low,...this.flows])t.destroy();this.frames=[];this.low=[];this.flows=[];this.warpTarget=undefined;this.warpGroups=[];}
  destroy():void{if(this.dead)return;this.dead=true;this.destroyTextures();this.uniform.destroy();this.summary.destroy();this.readback.destroy();}
}
