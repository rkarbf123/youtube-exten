import * as ort from 'onnxruntime-web/webgpu';

/** Experimental actual RIFE runtime. Not connected to YouTube playback yet. */
export class RifeSession {
  private busy=false;private closed=false;
  private constructor(readonly device:GPUDevice,readonly adapterInfo:GPUAdapterInfo,readonly manifest:{onnxSha256:string;model:string},private session:ort.InferenceSession,private frames:GPUBuffer,private timestep:GPUBuffer,private inputs:Record<string,ort.Tensor>,readonly loadMs:number){}
  static async create(base=new URL('./',location.href)){
    if(!navigator.gpu)throw new Error('WebGPU 미지원');
    const started=performance.now(),adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('WebGPU adapter 없음');
    let device:GPUDevice|undefined;
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths={mjs:new URL('../ort/ort-wasm-simd-threaded.jsep.mjs',base).href,wasm:new URL('../ort/ort-wasm-simd-threaded.jsep.wasm',base).href};
    ort.env.webgpu.adapter=adapter;
    const modelRoot=new URL('../models/rife/',base),response=await fetch(new URL('manifest.json',modelRoot));if(!response.ok)throw new Error('RIFE manifest 로딩 실패');
    const manifest=await response.json(),model=await fetch(new URL('rife-4.25-lite-128.onnx',modelRoot));if(!model.ok)throw new Error('RIFE 모델 로딩 실패');
    const bytes=await model.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==manifest.onnxSha256)throw new Error('RIFE 모델 SHA-256 불일치');
    let session:ort.InferenceSession|undefined;
    try{
      session=await ort.InferenceSession.create(bytes,{executionProviders:['webgpu'],preferredOutputLocation:'gpu-buffer',graphOptimizationLevel:'all',extra:{session:{disable_cpu_ep_fallback:'1'}}});
      device=await ort.env.webgpu.device;
      if(session.inputNames.join(',')!=='frames,timestep'||session.outputNames.join(',')!=='frame')throw new Error('RIFE 입출력 이름 불일치');
      const frameMeta=session.inputMetadata[0],timeMeta=session.inputMetadata[1],outMeta=session.outputMetadata[0];
      if(!frameMeta.isTensor||frameMeta.shape.join(',')!=='1,6,128,128'||!timeMeta.isTensor||timeMeta.shape.join(',')!=='1,1,1,1'||!outMeta.isTensor||outMeta.shape.join(',')!=='1,3,128,128')throw new Error('RIFE 정적 tensor shape 불일치');
      const frames=device.createBuffer({size:6*128*128*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),timestep=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
      const inputs={frames:ort.Tensor.fromGpuBuffer(frames,{dataType:'float32',dims:[1,6,128,128]}),timestep:ort.Tensor.fromGpuBuffer(timestep,{dataType:'float32',dims:[1,1,1,1]})};
      return new RifeSession(device,adapter.info,manifest,session,frames,timestep,inputs,performance.now()-started);
    }catch(error){await session?.release();device?.destroy();throw error;}
  }
  uploadFrames(data:Float32Array<ArrayBuffer>){if(this.closed||this.busy)throw new Error('RIFE 세션 busy/closed');if(data.length!==6*128*128||!data.every(Number.isFinite))throw new Error('RIFE 입력 크기/수치 오류');this.device.queue.writeBuffer(this.frames,0,data);}
  async infer(alpha:number){
    if(this.closed||this.busy)throw new Error('RIFE 단일 추론 큐 사용 중');if(!Number.isFinite(alpha)||alpha<=0||alpha>=1)throw new Error('RIFE t는 0과 1 사이여야 합니다. 원본 끝점은 모델 밖에서 처리합니다.');
    this.busy=true;const started=performance.now();
    try{this.device.queue.writeBuffer(this.timestep,0,new Float32Array([alpha]));const result=await this.session.run(this.inputs),output=result.frame;
      if(output.location!=='gpu-buffer'||output.dims.join(',')!=='1,3,128,128'){output.dispose();throw new Error('RIFE 출력이 예상한 GPU tensor가 아닙니다.');}
      await this.device.queue.onSubmittedWorkDone();return {output,completionMs:performance.now()-started};
    }finally{this.busy=false;}
  }
  /** Caller disposes every output after GPU presentation/readback. */
  async release(){if(this.closed)return;if(this.busy)throw new Error('추론 완료 후 해제해야 합니다.');this.closed=true;await this.session.release();for(const tensor of Object.values(this.inputs))tensor.dispose();this.frames.destroy();this.timestep.destroy();this.device.destroy();}
}
