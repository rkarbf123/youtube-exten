import {temporalPerf} from '../temporal/TemporalProfiler';
interface Slot{query:GPUQuerySet;resolve:GPUBuffer;read:GPUBuffer;busy:boolean}
/** Diagnostic only: bounded asynchronous timestamp readback, never a presentation dependency. */
export class GpuTimer{
  private slots:Slot[]=[];private dead=false;
  constructor(device:GPUDevice){if(temporalPerf.enabled&&device.features.has('timestamp-query'))for(let i=0;i<4;i++)this.slots.push({query:device.createQuerySet({type:'timestamp',count:16}),resolve:device.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:device.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:false});}
  begin():GpuRecording|null{if(this.dead||!temporalPerf.enabled)return null;const slot=this.slots.find(s=>!s.busy);if(!slot){temporalPerf.count('timestampSkipped');return null;}slot.busy=true;return new GpuRecording(slot,temporalPerf.generation,()=>this.dead);}
  destroy():void{this.dead=true;for(const s of this.slots){s.query.destroy();s.resolve.destroy();s.read.destroy();}this.slots=[];}
}
export class GpuRecording{
  private names:string[]=[];
  constructor(private slot:Slot,private generation:number,private dead:()=>boolean){}
  stamp(name:string):GPUComputePassTimestampWrites{const begin=this.names.length*2;this.names.push(name);return {querySet:this.slot.query,beginningOfPassWriteIndex:begin,endOfPassWriteIndex:begin+1};}
  resolve(encoder:GPUCommandEncoder):void{if(this.names.length){encoder.resolveQuerySet(this.slot.query,0,this.names.length*2,this.slot.resolve,0);encoder.copyBufferToBuffer(this.slot.resolve,0,this.slot.read,0,this.names.length*16);}}
  abort():void{this.names=[];this.slot.busy=false;}
  submitted():void{if(!this.names.length){this.slot.busy=false;return;}const start=temporalPerf.mark();void this.slot.read.mapAsync(GPUMapMode.READ).then(()=>{if(!this.dead()&&this.generation===temporalPerf.generation){const times=new BigUint64Array(this.slot.read.getMappedRange());this.names.forEach((name,i)=>temporalPerf.sample('gpu.'+name+'Ms',Number(times[i*2+1]-times[i*2])/1e6));temporalPerf.elapsed('diagnosticReadbackWaitMs',start);}this.slot.read.unmap();}).catch(()=>{if(!this.dead())temporalPerf.count('timestampReadError');}).finally(()=>{this.slot.busy=false;});}
}

