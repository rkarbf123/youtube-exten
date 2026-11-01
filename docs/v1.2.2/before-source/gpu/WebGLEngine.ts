import type { Dimensions, RenderOptions, RenderTiming, UpscaleEngine } from '../shared/types';
import * as shader from '../shaders/webgl';
export class WebGLEngine implements UpscaleEngine {
  readonly backend = 'WebGL2'; readonly maxPixels = 8_294_400; readonly maxDimension: number;
  private gl: WebGL2RenderingContext; private programs: WebGLProgram[] = []; private textures: WebGLTexture[] = [];
  private uniforms: Record<'inputTex'|'originalTex'|'dims'|'settings'|'divider'|'contentMode'|'originalView'|'colorSettings',WebGLUniformLocation|null>[]=[];
  private pendingPresent?:()=>void;
  private completionChannel=new MessageChannel();private completionPoll?:()=>void;
  private cancelWait?:()=>void;private pollTimer=0;
  private fb: WebGLFramebuffer; private vao: WebGLVertexArrayObject; private key = ''; private dead = false;
  private onContextLost: (event: Event) => void;
  constructor(private canvas: HTMLCanvasElement, onLoss: (reason: string) => void, sources:Pick<typeof shader,'vertex'|'denoise'|'upscale'|'composite'>=shader) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL2 unavailable.');
    this.gl = gl; this.maxDimension = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.completionChannel.port2.onmessage=()=>this.completionPoll?.();
    this.fb = gl.createFramebuffer()!; this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao);
    this.onContextLost = event => { event.preventDefault(); if (!this.dead) onLoss('WebGL context lost.'); };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    try {
      for (const fragment of [sources.denoise, sources.upscale, sources.composite]) {
        const program=this.compile(fragment,sources.vertex);this.programs.push(program);
        this.uniforms.push(Object.fromEntries(['inputTex','originalTex','dims','settings','divider','contentMode','originalView','colorSettings'].map(name=>[name,gl.getUniformLocation(program,name)])) as typeof this.uniforms[number]);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    } catch (error) { this.destroy(); throw error; }
  }
  private compile(fragment: string,vertex:string): WebGLProgram {
    const gl = this.gl; const program = gl.createProgram()!; const shaders: WebGLShader[] = [];
    try {
      for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const s = gl.createShader(type)!; shaders.push(s); gl.shaderSource(s, code); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'GLSL compilation failed');
        gl.attachShader(program, s);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'GLSL link failed');
      return program;
    } catch (e) { gl.deleteProgram(program); throw e; }
    finally { shaders.forEach(s => gl.deleteShader(s)); }
  }
  private resize(d: Dimensions): void {
    const { source: s, output: o } = d; const key = `${s.width},${s.height},${o.width},${o.height}`;
    if (this.key === key) return;
    const gl = this.gl; this.textures.forEach(t => gl.deleteTexture(t)); this.textures = [];
    if (Math.max(s.width,s.height,o.width,o.height) > this.maxDimension || s.width*s.height*8+o.width*o.height*8 > 160*1024*1024) throw new Error('Resolution exceeds safe texture/memory limits.');
    this.canvas.width = o.width; this.canvas.height = o.height;
    for (const size of [s,s,o]) {
      const t = gl.createTexture()!; this.textures.push(t); gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,size.width,size.height);
    }
    this.key = key;
  }
  async render(source: HTMLVideoElement | HTMLCanvasElement, d: Dimensions, options: RenderOptions): Promise<RenderTiming> {
    if (this.dead) throw new Error('WebGL engine destroyed.');
    const start = performance.now(); const gl = this.gl; this.resize(d);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
    const draw = (index: number, input: WebGLTexture, output: WebGLTexture | null, width: number, height: number) => {
      const p = this.programs[index],u=this.uniforms[index]; gl.useProgram(p); gl.bindVertexArray(this.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER,output ? this.fb : null);
      if (output) { gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,output,0); if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete GPU framebuffer.'); }
      gl.viewport(0,0,width,height);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,input); gl.uniform1i(u.inputTex,0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,this.textures[0]); gl.uniform1i(u.originalTex,1);
      gl.uniform4f(u.dims,d.source.width,d.source.height,d.output.width,d.output.height);
      gl.uniform4f(u.settings,options.sharpness,options.denoise,options.engine==='balanced'?1:0,options.comparison?1:0);
      gl.uniform1f(u.divider,options.divider);gl.uniform1f(u.contentMode,options.contentMode==='animation'?1:0);gl.uniform1f(u.originalView,options.original?1:0);
      gl.uniform2f(u.colorSettings,(options.saturation??100)/100,(options.brightness??100)/100);
      gl.drawArrays(gl.TRIANGLES,0,3);
    };
    const clean = !options.original && options.engine === 'balanced' && options.denoise > 0;
    if (clean) draw(0,this.textures[0],this.textures[1],d.source.width,d.source.height);
    if(!options.original&&options.upscale!==false)draw(1,this.textures[clean?1:0],this.textures[2],d.output.width,d.output.height);
    this.pendingPresent=()=>draw(2,this.textures[options.upscale===false?(clean?1:0):2],null,d.output.width,d.output.height);
    const error = gl.getError(); if (error !== gl.NO_ERROR) throw new Error(`WebGL rendering error 0x${error.toString(16)}`);
    const cpuSubmitMs = performance.now() - start;
    await this.waitGPU(start);
    return { cpuSubmitMs, latencyMs: performance.now()-start, gpuMs: null };
  }
  async present():Promise<number>{
    if(this.dead||!this.pendingPresent)throw new Error('No completed WebGL frame to present.');
    const start=performance.now();this.pendingPresent();const cpu=performance.now()-start;
    const error=this.gl.getError();if(error!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${error.toString(16)}`);
    await this.waitGPU(start);return cpu;
  }
  private async waitGPU(start:number):Promise<void>{
    const gl=this.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0); gl.flush();
    if (!sync) throw new Error('GPU synchronization unavailable.');
    try {
      await new Promise<void>((resolve,reject) => {
        let polls=0;
        this.cancelWait=()=>reject(new Error('WebGL engine destroyed during GPU work.'));
        const check = () => {
          if (this.dead || gl.isContextLost()) { reject(new Error('WebGL context unavailable.')); return; }
          const result = gl.clientWaitSync(sync,0,0);
          if(result===gl.ALREADY_SIGNALED||result===gl.CONDITION_SATISFIED) resolve();
          else if(result===gl.WAIT_FAILED||performance.now()-start>1200) reject(new Error('GPU completion timed out.'));
          // Posted tasks avoid the 4ms nested-timer clamp, which can dominate a
          // small GPU pass. Yield through a timer every eight polls to bound CPU work.
          else if(++polls%8===0)this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0);
          else this.completionChannel.port1.postMessage(0);
        };this.completionPoll=check;check();
      });
    } finally {this.completionPoll=undefined;this.cancelWait=undefined;clearTimeout(this.pollTimer);gl.deleteSync(sync);}
  }
  destroy(): void {
    if(this.dead)return; this.dead=true; const gl=this.gl;
    this.cancelWait?.();clearTimeout(this.pollTimer);this.completionChannel.port1.close();this.completionChannel.port2.close();
    this.canvas.removeEventListener('webglcontextlost',this.onContextLost);
    this.textures.forEach(t=>gl.deleteTexture(t)); this.programs.forEach(p=>gl.deleteProgram(p));
    gl.deleteFramebuffer(this.fb); gl.deleteVertexArray(this.vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
