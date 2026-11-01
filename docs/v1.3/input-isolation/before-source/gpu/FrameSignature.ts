import {temporalPerf} from '../temporal/TemporalProfiler';
import type {GpuRecording} from './GpuTimer';
import code from '../shaders/signature.wgsl?raw';
/** Optional interpolation diagnostics only. 256 displayed RGB samples, not a full-frame proof. */
export class FrameSignature {
  private value:GPUBuffer;private readback:GPUBuffer;
  private constructor(private device:GPUDevice,private pipeline:GPUComputePipeline){this.value=device.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});this.readback=device.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});}
  static async create(device:GPUDevice):Promise<FrameSignature>{const module=device.createShaderModule({code});const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});return new FrameSignature(device,pipeline);}
  encode(encoder:GPUCommandEncoder,texture:GPUTexture,gpu?:GpuRecording|null):void{
    encoder.clearBuffer(this.value);const group=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:texture.createView()},{binding:1,resource:{buffer:this.value}}]});
    const pass=encoder.beginComputePass({timestampWrites:gpu?.stamp('signature')});pass.setPipeline(this.pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(4);pass.end();encoder.copyBufferToBuffer(this.value,0,this.readback,0,8);
  }
  async read():Promise<string>{const start=temporalPerf.mark();await this.readback.mapAsync(GPUMapMode.READ);temporalPerf.elapsed('signatureReadbackWaitMs',start);const n=new Uint32Array(this.readback.getMappedRange());const text=n[0].toString(16)+':'+n[1].toString(16);this.readback.unmap();return text;}
  destroy():void{this.value.destroy();this.readback.destroy();}
}
