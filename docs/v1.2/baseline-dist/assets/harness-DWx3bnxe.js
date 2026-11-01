import{D as we}from"./SettingsManager-CaD6oZiW.js";const ye=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn pixel(t: texture_2d<f32>, p: vec2i) -> vec3f {
  return textureLoad(t, clamp(p, vec2i(0), vec2i(textureDimensions(t)) - vec2i(1)), 0).rgb;
}
fn linearSample(t: texture_2d<f32>, p: vec2f) -> vec3f {
  let i = vec2i(floor(p)); let f = fract(p);
  return mix(mix(pixel(t,i),pixel(t,i+vec2i(1,0)),f.x),mix(pixel(t,i+vec2i(0,1)),pixel(t,i+vec2i(1,1)),f.x),f.y);
}
// Mitchell-Netravali reconstruction, B=C=1/3. Negative lobes are bounded below.
fn cubic(v: f32) -> f32 {
  let x = abs(v);
  if (x < 1.0) { return (7.0*x*x*x - 12.0*x*x + 5.3333333)/6.0; }
  if (x < 2.0) { return (-2.3333333*x*x*x + 12.0*x*x - 20.0*x + 10.6666667)/6.0; }
  return 0.0;
}
fn fastReconstruct(t: texture_2d<f32>, p: vec2f) -> vec3f {
  let i = vec2i(floor(p)); let f = fract(p);
  let a=pixel(t,i); let b=pixel(t,i+vec2i(1,0)); let c=pixel(t,i+vec2i(0,1)); let d=pixel(t,i+vec2i(1,1));
  let base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  let lo=min(min(a,b),min(c,d)); let hi=max(max(a,b),max(c,d));
    let ad=abs(luma(a)-luma(d)); let bc=abs(luma(b)-luma(c));
    let edge=abs(ad-bc)/(ad+bc+0.02);
    var diagonal=mix(b,c,(1.0-f.x+f.y)*0.5);
    var proximity=1.0-abs(f.x+f.y-1.0);
    if(ad<bc) { diagonal=mix(a,d,(f.x+f.y)*0.5); proximity=1.0-abs(f.x-f.y); }
    return clamp(mix(base,diagonal,0.35*edge*proximity),lo,hi);
}

// AMD FidelityFX FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
// Reference: references/ffx_fsr1.h, FsrEasuSetF/FsrEasuTapF/FsrEasuF.
// Integer loads replace gather4; exact reciprocal/rsqrt replace bit approximations.
fn easuLuma(c: vec3f) -> f32 { return c.g+(c.r+c.b)*0.5; }
fn easuSet(a:f32,b:f32,c:f32,d:f32,e:f32,w:f32) -> vec3f {
  let dx=d-b; let dy=e-a;
  let lx=clamp(abs(dx)/max(max(abs(d-c),abs(c-b)),0.000001),0.0,1.0);
  let ly=clamp(abs(dy)/max(max(abs(e-c),abs(c-a)),0.000001),0.0,1.0);
  return vec3f(dx,dy,lx*lx+ly*ly)*w;
}
fn easuTap(off:vec2f,dir:vec2f,len:vec2f,lob:f32) -> f32 {
  let v=vec2f(dot(off,dir),dot(off,vec2f(-dir.y,dir.x)))*len;
  let d2=min(dot(v,v),1.0/lob);
  let b=0.4*d2-1.0;let a=lob*d2-1.0;
  return (1.5625*b*b-0.5625)*a*a;
}
fn weighted(c:vec3f,w:f32)->vec4f{return vec4f(c*w,w);}
fn easuColor(c:vec3f,off:vec2f,dir:vec2f,len:vec2f,lob:f32)->vec4f{return weighted(c,easuTap(off,dir,len,lob));}
fn easu(t:texture_2d<f32>,p:vec2f,animation:bool,noise:f32) -> vec3f {
  let q=select(p,round(p),abs(p-round(p))<vec2f(0.00001));
  let i=vec2i(floor(q));let f=fract(q);
  let b=pixel(t,i+vec2i(0,-1));let c=pixel(t,i+vec2i(1,-1));
  let e=pixel(t,i+vec2i(-1,0));let a=pixel(t,i);let g=pixel(t,i+vec2i(1,0));let h=pixel(t,i+vec2i(2,0));
  let j=pixel(t,i+vec2i(0,1));let k=pixel(t,i+vec2i(1,1));let n=pixel(t,i+vec2i(0,2));let o=pixel(t,i+vec2i(1,2));
  let ii=pixel(t,i+vec2i(-1,1));let l=pixel(t,i+vec2i(2,1));
  let field=easuSet(easuLuma(b),easuLuma(e),easuLuma(a),easuLuma(g),easuLuma(j),(1.0-f.x)*(1.0-f.y))
    +easuSet(easuLuma(c),easuLuma(a),easuLuma(g),easuLuma(h),easuLuma(k),f.x*(1.0-f.y))
    +easuSet(easuLuma(a),easuLuma(ii),easuLuma(j),easuLuma(k),easuLuma(n),(1.0-f.x)*f.y)
    +easuSet(easuLuma(g),easuLuma(j),easuLuma(k),easuLuma(l),easuLuma(o),f.x*f.y);
  var dir=vec2f(1,0);if(dot(field.xy,field.xy)>=1.0/32768.0){dir=normalize(field.xy);}
  var edge=field.z*0.5;edge*=edge;
  // Animation retains coherent line anisotropy; natural uses the unmodified EASU response.
  if(animation){edge=min(1.0,edge*1.2);}
  let stretch=dot(dir,dir)/max(abs(dir.x),abs(dir.y));
  let len=vec2f(1.0+(stretch-1.0)*edge,1.0-0.5*edge);let lob=0.5-0.29*edge;
  let lo=min(min(a,g),min(j,k));let hi=max(max(a,g),max(j,k));
  let contrast=luma(hi-lo);
  var reconstructed=mix(mix(a,g,f.x),mix(j,k,f.x),f.y);
  if(animation || contrast>0.035){
    // Explicit taps avoid dynamic private-array indexing/spills in WGSL drivers.
    let sum=easuColor(b,vec2f(0,-1)-f,dir,len,lob)+easuColor(c,vec2f(1,-1)-f,dir,len,lob)
      +easuColor(ii,vec2f(-1,1)-f,dir,len,lob)+easuColor(j,vec2f(0,1)-f,dir,len,lob)
      +easuColor(a,vec2f(0,0)-f,dir,len,lob)+easuColor(e,vec2f(-1,0)-f,dir,len,lob)
      +easuColor(k,vec2f(1,1)-f,dir,len,lob)+easuColor(l,vec2f(2,1)-f,dir,len,lob)
      +easuColor(h,vec2f(2,0)-f,dir,len,lob)+easuColor(g,vec2f(1,0)-f,dir,len,lob)
      +easuColor(o,vec2f(1,2)-f,dir,len,lob)+easuColor(n,vec2f(0,2)-f,dir,len,lob);
    reconstructed=clamp(sum.rgb/max(sum.a,0.000001),lo,hi);
  }
  if(animation){return reconstructed;}
  // Natural mode: preserve smooth texture with an interpolating cubic kernel,
  // while retaining EASU's directional reconstruction on stronger boundaries.
  // Reuse the SAME twelve texels; no extra texture fetches or render passes.
  if(contrast>=0.16){return reconstructed;}
  let blur=clamp((1.0-edge)*noise*4.0,0.0,1.0);
  let wx=array<f32,4>(textureCubic(-1.0-f.x,blur),textureCubic(-f.x,blur),textureCubic(1.0-f.x,blur),textureCubic(2.0-f.x,blur));
  let wy=array<f32,4>(textureCubic(-1.0-f.y,blur),textureCubic(-f.y,blur),textureCubic(1.0-f.y,blur),textureCubic(2.0-f.y,blur));
  let filtered=weighted(b,wx[1]*wy[0])+weighted(c,wx[2]*wy[0])
    +weighted(ii,wx[0]*wy[2])+weighted(j,wx[1]*wy[2])+weighted(a,wx[1]*wy[1])+weighted(e,wx[0]*wy[1])
    +weighted(k,wx[2]*wy[2])+weighted(l,wx[3]*wy[2])+weighted(h,wx[3]*wy[1])+weighted(g,wx[2]*wy[1])
    +weighted(o,wx[2]*wy[3])+weighted(n,wx[1]*wy[3]);
  let textureColor=clamp(filtered.rgb/max(filtered.a,0.000001),lo,hi);
  return mix(textureColor,reconstructed,smoothstep(0.035,0.16,contrast)*edge);
}
fn textureCubic(v:f32,blur:f32)->f32{
  let x=abs(v);let b=blur/3.0;let c=0.5-blur/6.0;
  if(x<1.0){return ((12.0-9.0*b-6.0*c)*x*x*x+(-18.0+12.0*b+6.0*c)*x*x+6.0-2.0*b)/6.0;}
  if(x<2.0){return ((-b-6.0*c)*x*x*x+(6.0*b+30.0*c)*x*x+(-12.0*b-48.0*c)*x+8.0*b+24.0*c)/6.0;}return 0.0;
}
fn reconstruct(t:texture_2d<f32>,p:vec2f,balanced:bool,animation:bool,noise:f32) -> vec3f {
  if(balanced){return easu(t,p,animation,noise);}return fastReconstruct(t,p);
}
`,Ee=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=vec2i(id.xy); let center=pixel(input,p);
  var total=vec3f(0); var weights=0.0;
  for(var y=-1;y<=1;y++) { for(var x=-1;x<=1;x++) {
    let c=pixel(input,p+vec2i(x,y)); let delta=luma(c)-luma(center);
    // A rational range kernel avoids nine exponentials. Reject chroma edges too,
    // so equal-luma colored boundaries and fine natural texture are not smeared.
    let chroma=dot(c-center,c-center)/3.0;
    let sigma=select(0.0025,0.0024,params.extra.y>0.5);
    let w=(1.0/(1.0+f32(x*x+y*y)*1.5))/(1.0+delta*delta/sigma+chroma/(sigma*2.0));
    total+=c*w; weights+=w;
  }}
  let strength=select(1.25,0.7,params.extra.y>0.5);
  textureStore(output,p,vec4f(mix(center,total/weights,min(1.0,params.settings.y*strength)),1));
}
`,Me=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Te=`@group(0) @binding(0) var original: texture_2d<f32>;
@group(0) @binding(1) var enhanced: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return vec4f(positions[index],0,1);
}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if(params.extra.z>0.5 || (params.settings.w>0.5 && pos.x/params.dims.z<params.extra.x)) {
    return vec4f(linearSample(original,pos.xy*params.dims.xy/params.dims.zw-0.5),1);
  }
  let p=vec2i(pos.xy); let c=pixel(enhanced,p);
  let n=pixel(enhanced,p+vec2i(0,-1)); let s=pixel(enhanced,p+vec2i(0,1));
  let e=pixel(enhanced,p+vec2i(1,0)); let w=pixel(enhanced,p+vec2i(-1,0));
  let low=min(c,min(min(n,s),min(e,w))); let high=max(c,max(max(n,s),max(e,w)));
  // Luminance-only unsharp mask, bounded by the local range to suppress halos.
  let detail=luma(c)-luma((n+s+e+w)*0.25);
  var color=clamp(c+vec3f(detail*params.settings.x*1.25),low,high);
  return vec4f(clamp(color,vec3f(0),vec3f(1)),1);
}
`;class ie{constructor(e,t,n,a,i){this.canvas=e,this.device=t,this.clean=n,this.reconstruct=a,this.presentPipeline=i,this.maxDimension=t.limits.maxTextureDimension2D;const s=e.getContext("webgpu");if(!s)throw new Error("WebGPU canvas context unavailable.");this.context=s,s.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb"}),this.uniform=t.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;key="";dead=!1;static async create(e,t,n={common:ye,denoise:Ee,upscale:Me,composite:Te}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const a=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!a)throw new Error("No WebGPU adapter.");const i=await a.requestDevice();try{const s=[n.denoise,n.upscale,n.composite].map(l=>i.createShaderModule({code:n.common+`
`+l}));for(const l of s){const f=(await l.getCompilationInfo()).messages.filter(g=>g.type==="error");if(f.length)throw new Error(f.map(g=>`WGSL ${g.lineNum}: ${g.message}`).join("; "))}const[r,d,h]=await Promise.all([i.createComputePipelineAsync({layout:"auto",compute:{module:s[0],entryPoint:"main"}}),i.createComputePipelineAsync({layout:"auto",compute:{module:s[1],entryPoint:"main"}}),i.createRenderPipelineAsync({layout:"auto",vertex:{module:s[2],entryPoint:"vertex"},fragment:{module:s[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),o=new ie(e,i,r,d,h);return i.lost.then(l=>{o.dead||t(`WebGPU device lost: ${l.message||l.reason}`)}),i.addEventListener("uncapturederror",l=>{o.dead||t(`WebGPU: ${l.error.message}`)}),o}catch(s){throw i.destroy(),s}}resize(e){const{source:t,output:n}=e,a=`${t.width},${t.height},${n.width},${n.height}`;if(a===this.key)return;if(this.textures.forEach(h=>h.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,n.width,n.height)>this.maxDimension||t.width*t.height*8+n.width*n.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=n.width,this.canvas.height=n.height;for(const[h,o]of[t,t,n].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][h],size:[o.width,o.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[i,s,r]=this.textures.map(h=>h.createView()),d=(h,o,l)=>this.device.createBindGroup({layout:h,entries:[{binding:0,resource:o},{binding:1,resource:l},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=d(this.clean.getBindGroupLayout(0),i,s),this.upscaleRaw=d(this.reconstruct.getBindGroupLayout(0),i,r),this.upscaleClean=d(this.reconstruct.getBindGroupLayout(0),s,r),this.compositeGroup=d(this.presentPipeline.getBindGroupLayout(0),i,r),this.key=a}async render(e,t,n){if(this.dead)throw new Error("GPU engine has been destroyed.");const a=performance.now(),i=this.device;i.pushErrorScope("validation"),i.pushErrorScope("out-of-memory");let s;try{this.resize(t);const{source:o,output:l}=t;i.queue.writeBuffer(this.uniform,0,new Float32Array([o.width,o.height,l.width,l.height,n.sharpness,n.denoise,n.engine==="balanced"?1:0,n.comparison?1:0,n.divider,n.contentMode==="animation"?1:0,n.original?1:0,0])),i.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[o.width,o.height]);const u=i.createCommandEncoder(),f=!n.original&&n.engine==="balanced"&&n.denoise>0;if(f){const g=u.beginComputePass();g.setPipeline(this.clean),g.setBindGroup(0,this.denoiseGroup),g.dispatchWorkgroups(Math.ceil(o.width/8),Math.ceil(o.height/8)),g.end()}if(!n.original){const g=u.beginComputePass();g.setPipeline(this.reconstruct),g.setBindGroup(0,f?this.upscaleClean:this.upscaleRaw),g.dispatchWorkgroups(Math.ceil(l.width/8),Math.ceil(l.height/8)),g.end()}i.queue.submit([u.finish()])}catch(o){s=o}const r=performance.now()-a,d=await i.popErrorScope(),h=await i.popErrorScope();if(s)throw s;if(d||h)throw new Error((d||h).message);if(await i.queue.onSubmittedWorkDone(),this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:r,latencyMs:performance.now()-a,gpuMs:null}}async present(){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const e=performance.now();this.device.pushErrorScope("validation");const t=this.device.createCommandEncoder(),n=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(this.presentPipeline),n.setBindGroup(0,this.compositeGroup),n.draw(3),n.end(),this.device.queue.submit([t.finish()]);const a=performance.now()-e,i=await this.device.popErrorScope();if(i)throw new Error(i.message);return await this.device.queue.onSubmittedWorkDone(),a}destroy(){this.dead||(this.dead=!0,this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy())}}const Se=`// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
// Reference: references/ffx_fsr1.h. Same 12-tap footprint as the upstream scalar.
float easuLuma(vec3 c){return c.g+(c.r+c.b)*.5;}
vec3 easuSet(float a,float b,float c,float d,float e,float w){
  float dx=d-b,dy=e-a;
  float lx=clamp(abs(dx)/max(max(abs(d-c),abs(c-b)),.000001),0.,1.);
  float ly=clamp(abs(dy)/max(max(abs(e-c),abs(c-a)),.000001),0.,1.);
  return vec3(dx,dy,lx*lx+ly*ly)*w;
}
float easuTap(vec2 off,vec2 dir,vec2 len,float lob){
  vec2 v=vec2(dot(off,dir),dot(off,vec2(-dir.y,dir.x)))*len;
  float d2=min(dot(v,v),1./lob),b=.4*d2-1.,a=lob*d2-1.;
  return (1.5625*b*b-.5625)*a*a;
}
float textureCubic(float v,float blur){float x=abs(v),b=blur/3.,c=.5-blur/6.;if(x<1.)return((12.-9.*b-6.*c)*x*x*x+(-18.+12.*b+6.*c)*x*x+6.-2.*b)/6.;if(x<2.)return((-b-6.*c)*x*x*x+(6.*b+30.*c)*x*x+(-12.*b-48.*c)*x+8.*b+24.*c)/6.;return 0.;}
vec3 easu(sampler2D t,vec2 p,bool animation,float noise){
  p=mix(p,round(p),lessThan(abs(p-round(p)),vec2(.00001)));
  ivec2 i=ivec2(floor(p));vec2 f=fract(p);
  vec3 b=pixel(t,i+ivec2(0,-1)),c=pixel(t,i+ivec2(1,-1));
  vec3 e=pixel(t,i+ivec2(-1,0)),a=pixel(t,i),g=pixel(t,i+ivec2(1,0)),h=pixel(t,i+ivec2(2,0));
  vec3 ii=pixel(t,i+ivec2(-1,1)),j=pixel(t,i+ivec2(0,1)),k=pixel(t,i+ivec2(1,1)),l=pixel(t,i+ivec2(2,1));
  vec3 n=pixel(t,i+ivec2(0,2)),o=pixel(t,i+ivec2(1,2));
  vec3 field=easuSet(easuLuma(b),easuLuma(e),easuLuma(a),easuLuma(g),easuLuma(j),(1.-f.x)*(1.-f.y))
    +easuSet(easuLuma(c),easuLuma(a),easuLuma(g),easuLuma(h),easuLuma(k),f.x*(1.-f.y))
    +easuSet(easuLuma(a),easuLuma(ii),easuLuma(j),easuLuma(k),easuLuma(n),(1.-f.x)*f.y)
    +easuSet(easuLuma(g),easuLuma(j),easuLuma(k),easuLuma(l),easuLuma(o),f.x*f.y);
  vec2 dir=vec2(1,0);if(dot(field.xy,field.xy)>=1./32768.)dir=normalize(field.xy);
  float edge=field.z*.5;edge*=edge;if(animation)edge=min(1.,edge*1.2);
  float stretch=dot(dir,dir)/max(abs(dir.x),abs(dir.y));vec2 len=vec2(1.+(stretch-1.)*edge,1.-.5*edge);float lob=.5-.29*edge;
  vec3 colors[12]=vec3[12](b,c,ii,j,a,e,k,l,h,g,o,n);
  vec2 offsets[12]=vec2[12](vec2(0,-1),vec2(1,-1),vec2(-1,1),vec2(0,1),vec2(0,0),vec2(-1,0),vec2(1,1),vec2(2,1),vec2(2,0),vec2(1,0),vec2(1,2),vec2(0,2));
  vec3 lo=min(min(a,g),min(j,k)),hi=max(max(a,g),max(j,k));float contrast=luma(hi-lo);vec3 reconstructed=mix(mix(a,g,f.x),mix(j,k,f.x),f.y);
  if(animation||contrast>.035){vec3 sum=vec3(0);float weights=0.;for(int v=0;v<12;v++){float w=easuTap(offsets[v]-f,dir,len,lob);sum+=colors[v]*w;weights+=w;}reconstructed=clamp(sum/max(weights,.000001),lo,hi);}
  if(animation)return reconstructed;
  if(contrast>=.16)return reconstructed;
  float blur=clamp((1.-edge)*noise*4.,0.,1.);
  float wx[4]=float[4](textureCubic(-1.-f.x,blur),textureCubic(-f.x,blur),textureCubic(1.-f.x,blur),textureCubic(2.-f.x,blur));
  float wy[4]=float[4](textureCubic(-1.-f.y,blur),textureCubic(-f.y,blur),textureCubic(1.-f.y,blur),textureCubic(2.-f.y,blur));
  vec3 smoothColor=vec3(0);float sw=0.;
  for(int v=0;v<12;v++){ivec2 at=ivec2(offsets[v])+1;float w=wx[at.x]*wy[at.y];smoothColor+=colors[v]*w;sw+=w;}
  return mix(clamp(smoothColor/max(sw,.000001),lo,hi),reconstructed,smoothstep(.035,.16,contrast)*edge);
}
`,Pe=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,ne=`
precision highp float;
precision highp int;
uniform sampler2D inputTex;
uniform sampler2D originalTex;
uniform vec4 dims;
uniform vec4 settings;
uniform float divider;
uniform float contentMode;
uniform float originalView;
out vec4 color;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 pixel(sampler2D t,ivec2 p){ivec2 size=textureSize(t,0);p=clamp(p,ivec2(0),size-1);p.y=size.y-1-p.y;return texelFetch(t,p,0).rgb;}
vec3 linearSample(sampler2D t,vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);return mix(mix(pixel(t,i),pixel(t,i+ivec2(1,0)),f.x),mix(pixel(t,i+ivec2(0,1)),pixel(t,i+ivec2(1)),f.x),f.y);}
float cubic(float v){float x=abs(v);if(x<1.)return(7.*x*x*x-12.*x*x+5.3333333)/6.;if(x<2.)return(-2.3333333*x*x*x+12.*x*x-20.*x+10.6666667)/6.;return 0.;}
`,Ce=`#version 300 es
`+ne+`
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`,Le=`#version 300 es
`+ne+Se+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`,Re=`#version 300 es
`+ne+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(clamp(result,0.,1.),1);}`,ke=Object.freeze(Object.defineProperty({__proto__:null,composite:Re,denoise:Ce,upscale:Le,vertex:Pe},Symbol.toStringTag,{value:"Module"}));class _e{constructor(e,t,n=ke){this.canvas=e;const a=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"low-power"});if(!a)throw new Error("WebGL2 unavailable.");this.gl=a,this.maxDimension=a.getParameter(a.MAX_TEXTURE_SIZE),this.completionChannel.port2.onmessage=()=>this.completionPoll?.(),this.fb=a.createFramebuffer(),this.vao=a.createVertexArray(),a.bindVertexArray(this.vao),this.onContextLost=i=>{i.preventDefault(),this.dead||t("WebGL context lost.")},e.addEventListener("webglcontextlost",this.onContextLost);try{for(const i of[n.denoise,n.upscale,n.composite]){const s=this.compile(i,n.vertex);this.programs.push(s),this.uniforms.push(Object.fromEntries(["inputTex","originalTex","dims","settings","divider","contentMode","originalView"].map(r=>[r,a.getUniformLocation(s,r)])))}a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,!0),a.pixelStorei(a.UNPACK_COLORSPACE_CONVERSION_WEBGL,a.BROWSER_DEFAULT_WEBGL)}catch(i){throw this.destroy(),i}}canvas;backend="WebGL2";maxPixels=8294400;maxDimension;gl;programs=[];textures=[];uniforms=[];pendingPresent;completionChannel=new MessageChannel;completionPoll;cancelWait;pollTimer=0;fb;vao;key="";dead=!1;onContextLost;compile(e,t){const n=this.gl,a=n.createProgram(),i=[];try{for(const[s,r]of[[n.VERTEX_SHADER,t],[n.FRAGMENT_SHADER,e]]){const d=n.createShader(s);if(i.push(d),n.shaderSource(d,r),n.compileShader(d),!n.getShaderParameter(d,n.COMPILE_STATUS))throw new Error(n.getShaderInfoLog(d)||"GLSL compilation failed");n.attachShader(a,d)}if(n.linkProgram(a),!n.getProgramParameter(a,n.LINK_STATUS))throw new Error(n.getProgramInfoLog(a)||"GLSL link failed");return a}catch(s){throw n.deleteProgram(a),s}finally{i.forEach(s=>n.deleteShader(s))}}resize(e){const{source:t,output:n}=e,a=`${t.width},${t.height},${n.width},${n.height}`;if(this.key===a)return;const i=this.gl;if(this.textures.forEach(s=>i.deleteTexture(s)),this.textures=[],Math.max(t.width,t.height,n.width,n.height)>this.maxDimension||t.width*t.height*8+n.width*n.height*8>160*1024*1024)throw new Error("Resolution exceeds safe texture/memory limits.");this.canvas.width=n.width,this.canvas.height=n.height;for(const s of[t,t,n]){const r=i.createTexture();this.textures.push(r),i.bindTexture(i.TEXTURE_2D,r),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.texStorage2D(i.TEXTURE_2D,1,i.RGBA8,s.width,s.height)}this.key=a}async render(e,t,n){if(this.dead)throw new Error("WebGL engine destroyed.");const a=performance.now(),i=this.gl;this.resize(t),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.textures[0]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,i.RGBA,i.UNSIGNED_BYTE,e);const s=(o,l,u,f,g)=>{const R=this.programs[o],m=this.uniforms[o];if(i.useProgram(R),i.bindVertexArray(this.vao),i.bindFramebuffer(i.FRAMEBUFFER,u?this.fb:null),u&&(i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,u,0),i.checkFramebufferStatus(i.FRAMEBUFFER)!==i.FRAMEBUFFER_COMPLETE))throw new Error("Incomplete GPU framebuffer.");i.viewport(0,0,f,g),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,l),i.uniform1i(m.inputTex,0),i.activeTexture(i.TEXTURE1),i.bindTexture(i.TEXTURE_2D,this.textures[0]),i.uniform1i(m.originalTex,1),i.uniform4f(m.dims,t.source.width,t.source.height,t.output.width,t.output.height),i.uniform4f(m.settings,n.sharpness,n.denoise,n.engine==="balanced"?1:0,n.comparison?1:0),i.uniform1f(m.divider,n.divider),i.uniform1f(m.contentMode,n.contentMode==="animation"?1:0),i.uniform1f(m.originalView,n.original?1:0),i.drawArrays(i.TRIANGLES,0,3)},r=!n.original&&n.engine==="balanced"&&n.denoise>0;r&&s(0,this.textures[0],this.textures[1],t.source.width,t.source.height),n.original||s(1,this.textures[r?1:0],this.textures[2],t.output.width,t.output.height),this.pendingPresent=()=>s(2,this.textures[2],null,t.output.width,t.output.height);const d=i.getError();if(d!==i.NO_ERROR)throw new Error(`WebGL rendering error 0x${d.toString(16)}`);const h=performance.now()-a;return await this.waitGPU(a),{cpuSubmitMs:h,latencyMs:performance.now()-a,gpuMs:null}}async present(){if(this.dead||!this.pendingPresent)throw new Error("No completed WebGL frame to present.");const e=performance.now();this.pendingPresent();const t=performance.now()-e,n=this.gl.getError();if(n!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${n.toString(16)}`);return await this.waitGPU(e),t}async waitGPU(e){const t=this.gl,n=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0);if(t.flush(),!n)throw new Error("GPU synchronization unavailable.");try{await new Promise((a,i)=>{let s=0;this.cancelWait=()=>i(new Error("WebGL engine destroyed during GPU work."));const r=()=>{if(this.dead||t.isContextLost()){i(new Error("WebGL context unavailable."));return}const d=t.clientWaitSync(n,0,0);d===t.ALREADY_SIGNALED||d===t.CONDITION_SATISFIED?a():d===t.WAIT_FAILED||performance.now()-e>1200?i(new Error("GPU completion timed out.")):++s%8===0?this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0):this.completionChannel.port1.postMessage(0)};this.completionPoll=r,r()})}finally{this.completionPoll=void 0,this.cancelWait=void 0,clearTimeout(this.pollTimer),t.deleteSync(n)}}destroy(){if(this.dead)return;this.dead=!0;const e=this.gl;this.cancelWait?.(),clearTimeout(this.pollTimer),this.completionChannel.port1.close(),this.completionChannel.port2.close(),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.textures.forEach(t=>e.deleteTexture(t)),this.programs.forEach(t=>e.deleteProgram(t)),e.deleteFramebuffer(this.fb),e.deleteVertexArray(this.vao),e.getExtension("WEBGL_lose_context")?.loseContext()}}async function j(c,e,t,n){let a="";if(t!=="webgl2"){const s=c();try{return{engine:await ie.create(s,e,n?.webgpu),canvas:s,reason:a}}catch(r){if(s.remove(),a=r instanceof Error?r.message:String(r),t==="webgpu")throw r}}const i=c();try{return{engine:new _e(i,e,n?.webgl),canvas:i,reason:a}}catch(s){throw i.remove(),new Error(`${a?`WebGPU: ${a}. `:""}WebGL2: ${s instanceof Error?s.message:String(s)}`)}}const he={eco:{engine:"fast",sharpness:.55,denoise:0,budget:.5},balanced:{engine:"balanced",sharpness:.8,denoise:.7,budget:.65},quality:{engine:"balanced",sharpness:1,denoise:1,budget:.8}},De={windowMs:2200,cooldownMs:5e3,promoteWindows:2,demoteWindows:2,low:.46,high:.9,maxMiss:.15};class Ue{constructor(e=De){this.config=e}config;profile="eco";workload=1;ema=0;start=0;lastChange=-1/0;count=0;misses=0;good=0;bad=0;warmup=0;reset(e=performance.now()){this.profile="eco",this.workload=1,this.ema=0,this.start=e,this.lastChange=-1/0,this.count=this.misses=this.good=this.bad=this.warmup=0}sample(e,t,n,a){if(this.warmup++<6)return!1;const i=e/Math.max(4,t*he[this.profile].budget);if(this.ema=this.count===0&&this.ema===0?i:.12*i+.88*this.ema,this.count++,n&&this.misses++,a-this.start<this.config.windowMs||this.count<12)return!1;const s=this.misses/this.count;if(this.bad=this.ema>this.config.high||s>this.config.maxMiss?this.bad+1:0,this.good=this.ema<this.config.low&&s<.03?this.good+1:0,this.start=a,this.count=this.misses=0,a-this.lastChange<this.config.cooldownMs)return!1;const r=["eco","balanced","quality"];let d=r.indexOf(this.profile),h=!1;return this.bad>=this.config.demoteWindows?(d>0?this.profile=r[--d]:this.workload=Math.max(.4,this.workload*.8),h=!0):this.good>=this.config.promoteWindows&&(this.workload<1?(this.workload=Math.min(1,this.workload/.8),h=!0):d<r.length-1&&(this.profile=r[++d],h=!0)),h&&(this.lastChange=a,this.bad=this.good=0),h}options(e){const t=e.profile==="ultra"||e.engine==="anime4k"||e.engine==="neural",n=e.adaptive?this.profile:e.profile==="ultra"?"quality":e.profile,a=he[n];return{profile:n,unavailable:t,options:{engine:e.engine==="fast"||e.engine==="balanced"?e.engine:a.engine,sharpness:e.sharpness/100*(e.automaticStrength?a.sharpness:1),denoise:e.denoise/100*(e.automaticStrength?a.denoise:1),comparison:e.comparison,divider:e.divider,contentMode:e.contentMode,original:e.original||e.comparison&&e.divider>=1}}}}function Ae(c,e,t,n,a=8192,i=8294400,s=1,r=null){const d=Math.max(1,c.width),h=Math.max(1,c.height),o={width:Math.max(1,Math.round(e.width*t)),height:Math.max(1,Math.round(e.height*t))},l=Math.min(o.width/d,o.height/h),u=n==="auto"?l:Math.min(l,Number(n));let f=Math.max(.01,u)*s;const g=Math.max(1,(160*1024*1024-d*h*8)/8);f=Math.min(f,a/d,a/h,Math.sqrt(Math.min(i,g)/(d*h)));const R={width:Math.max(1,Math.floor(d*f)),height:Math.max(1,Math.floor(h*f))};return{source:{width:d,height:h},processing:{...R},output:R,display:o,screen:r,css:e,limited:f<u*.98}}const Fe=()=>({sourceFPS:null,processedFPS:0,latencyMs:null,cpuSubmitMs:null,gpuMs:null,latenessMs:0,missedDeadlines:0,skippedFrames:0,queueDepth:0,failures:0,enhancedVisiblePercent:0});class Ge{metrics=Fe();intervalMs=1e3/30;previousMedia=null;previousFrames=0;outputs=[];frame(e,t,n,a){if(this.previousMedia!==null){const i=e-this.previousMedia,s=t-this.previousFrames;if(i>0&&i<1&&s>0&&s<120){const r=i*1e3/s;r>=4&&r<=500&&(this.intervalMs=this.intervalMs*.85+r*.15),this.metrics.sourceFPS=1e3/this.intervalMs}}this.previousMedia=e,this.previousFrames=t,this.metrics.latenessMs=Math.max(0,n-a)}discontinuity(){this.previousMedia=null,this.previousFrames=0,this.outputs=[],this.metrics.sourceFPS=null}complete(e,t,n){const a=(i,s)=>i===null?s:.15*s+.85*i;if(this.metrics.latencyMs=a(this.metrics.latencyMs,e.latencyMs),this.metrics.cpuSubmitMs=a(this.metrics.cpuSubmitMs,e.cpuSubmitMs),this.metrics.gpuMs=e.gpuMs===null?null:a(this.metrics.gpuMs,e.gpuMs),t)for(this.outputs.push(n);this.outputs.length>0&&n-this.outputs[0]>=2e3;)this.outputs.shift()}snapshot(e=performance.now()){return this.outputs=this.outputs.filter(t=>e-t<2e3),this.metrics.processedFPS=this.outputs.length<2?0:(this.outputs.length-1)*1e3/Math.max(1,e-this.outputs[0]),{...this.metrics}}}class Ie{changes;start;constructor(e=performance.now()){this.start=e,this.changes=[{at:e,visible:!1}]}set(e,t=performance.now()){this.changes[this.changes.length-1].visible!==e&&this.changes.push({at:t,visible:e}),this.trim(t)}trim(e){for(;this.changes.length>1&&this.changes[1].at<=e-2e3;)this.changes.shift()}percent(e=performance.now()){this.trim(e);const t=Math.max(this.start,e-2e3);let n=0;for(let a=0;a<this.changes.length;a++)this.changes[a].visible&&(n+=Math.max(0,(this.changes[a+1]?.at??e)-Math.max(t,this.changes[a].at)));return e>t?n/(e-t)*100:0}}class ze{constructor(e,t,n,a){this.video=e,this.process=t,this.skip=n,this.error=a}video;process;skip;error;callback=0;running=!1;busy=!1;revision=0;lastTime=-1;refreshPending=!1;start(){this.running||(this.running=!0,this.schedule())}schedule(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{this.callback=0,this.schedule(),t.mediaTime!==this.lastTime&&(this.lastTime=t.mediaTime,this.dispatch(t))}))}refresh(){this.running&&this.video.readyState>=2&&this.dispatch(null)}invalidate(){this.revision++,this.lastTime=-1}dispatch(e){const t=++this.revision;if(this.busy){(!e||this.video.paused)&&(this.refreshPending=!0),this.skip();return}this.busy=!0,this.process({metadata:e,current:()=>this.running&&t===this.revision}).catch(n=>{this.running&&this.error(n)}).finally(()=>{this.busy=!1,this.refreshPending&&this.running&&(this.refreshPending=!1,this.refresh())})}stop(){this.running=!1,this.refreshPending=!1,this.invalidate(),this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.callback=0}}class $e{constructor(e,t,n){this.video=e,this.moveDivider=n,this.canvas=t,this.parent=e.parentElement,getComputedStyle(this.parent).position==="static"&&(this.originalPosition=this.parent.style.position,this.parent.style.position="relative"),t.className="clarity-gpu-overlay";const a=Number.parseInt(getComputedStyle(e).zIndex,10);Object.assign(t.style,{position:"absolute",pointerEvents:"none",zIndex:String(Number.isFinite(a)?a+1:1),display:"none",maxWidth:"none",maxHeight:"none",filter:"none",opacity:"1",transform:"none"}),t.setAttribute("aria-hidden","true"),this.parent.append(t),this.line=document.createElement("div"),this.handle=document.createElement("div"),Object.assign(this.line.style,{position:"absolute",display:"none",pointerEvents:"none",zIndex:String(Number.isFinite(a)?a+2:2),borderLeft:"1px solid rgba(255,255,255,.8)"}),Object.assign(this.handle.style,{position:"absolute",top:"12%",height:"65%",left:"-9px",width:"18px",pointerEvents:"auto",cursor:"ew-resize",touchAction:"none"}),this.handle.role="slider",this.handle.tabIndex=0,this.handle.setAttribute("aria-label","Original and enhanced comparison divider"),this.handle.setAttribute("aria-valuemin","0"),this.handle.setAttribute("aria-valuemax","100"),this.line.append(this.handle),this.parent.append(this.line);const i=s=>{const r=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(s-r.left)/r.width)),this.moveDivider(this.divider),this.align()};this.handle.addEventListener("pointerdown",s=>{s.stopPropagation(),s.preventDefault(),this.handle.setPointerCapture(s.pointerId),i(s.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("pointermove",s=>{this.handle.hasPointerCapture(s.pointerId)&&i(s.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("keydown",s=>{(s.key==="ArrowLeft"||s.key==="ArrowRight")&&(s.preventDefault(),s.stopPropagation(),this.divider=Math.max(.02,Math.min(.98,this.divider+(s.key==="ArrowLeft"?-.02:.02))),this.moveDivider(this.divider),this.align())},{signal:this.abort.signal}),this.align()}video;moveDivider;canvas;line;handle;parent;abort=new AbortController;originalPosition=null;visible=!1;comparing=!1;divider=.5;css={width:1,height:1};get displayed(){return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=="none"}align(){const e=this.video.getBoundingClientRect(),t=this.parent.getBoundingClientRect(),n=this.parent.offsetWidth>0&&t.width>0?t.width/this.parent.offsetWidth:1,a=this.parent.offsetHeight>0&&t.height>0?t.height/this.parent.offsetHeight:1,i=this.video.videoWidth||e.width,s=this.video.videoHeight||e.height,r=Math.min(e.width/i,e.height/s),d=i*r,h=s*r,o=(e.left-t.left+(e.width-d)/2)/Math.max(.01,n)+this.parent.scrollLeft-this.parent.clientLeft,l=(e.top-t.top+(e.height-h)/2)/Math.max(.01,a)+this.parent.scrollTop-this.parent.clientTop;return this.css={width:d/Math.max(.01,n),height:h/Math.max(.01,a)},Object.assign(this.canvas.style,{left:`${o}px`,top:`${l}px`,width:`${this.css.width}px`,height:`${this.css.height}px`}),Object.assign(this.line.style,{left:`${o+this.css.width*this.divider}px`,top:`${l}px`,height:`${this.css.height}px`}),this.handle.setAttribute("aria-valuenow",String(Math.round(this.divider*100))),{width:d,height:h}}compare(e,t){e===this.comparing&&t===this.divider||(this.comparing=e,this.divider=t,this.align(),this.line.style.display=this.visible&&e?"block":"none")}show(){this.visible=!0,this.canvas.style.display="block",this.line.style.display=this.comparing?"block":"none"}hide(){this.visible=!1,this.canvas.style.display="none",this.line.style.display="none"}destroy(){this.hide(),this.abort.abort(),this.canvas.remove(),this.line.remove(),this.originalPosition!==null&&(this.parent.style.position=this.originalPosition)}}function Oe(c){const e=c instanceof Error?c.message:String(c);return{status:c instanceof DOMException&&c.name==="SecurityError"||/origin.clean|cross.origin|taint|protected|DRM/i.test(e)?"Video Access Restricted":"Rendering Error",reason:e}}class We{constructor(e,t,n,a){this.video=e,this.settings=t,this.persistDivider=n,this.preferredBackend=a,this.resize=new ResizeObserver(()=>this.onResize()),this.resize.observe(e);const i=this.abort.signal;for(const s of["seeking","waiting","emptied","loadstart"])e.addEventListener(s,()=>{this.invalidate("Original Video Fallback","Waiting for a fresh decoded frame."),this.monitor.discontinuity()},{signal:i});for(const s of["loadeddata","seeked","playing","pause","ratechange","loadedmetadata"])e.addEventListener(s,()=>{(s==="loadedmetadata"||s==="loadeddata")&&(this.probed=!1,!this.engine&&!this.starting&&this.initialize()),s==="ratechange"&&this.monitor.discontinuity(),this.video.paused&&this.scheduler?.refresh()},{signal:i});document.addEventListener("visibilitychange",()=>{this.invalidate("Original Video Fallback",document.hidden?"Suspended while the tab is hidden.":"Resuming from original video."),document.hidden?this.scheduler?.stop():(this.scheduler?.start(),this.video.paused&&this.scheduler?.refresh())},{signal:i}),document.addEventListener("fullscreenchange",()=>this.onResize(),{signal:i}),window.addEventListener("resize",()=>this.onResize(),{signal:i}),this.watchdog=window.setInterval(()=>{this.dead||(devicePixelRatio!==this.lastDpr&&(this.lastDpr=devicePixelRatio,this.onResize()),!e.paused&&this.lastPresented&&performance.now()-this.frameStarted>Math.max(40,Math.min(250,this.monitor.intervalMs/e.playbackRate*1.5+10))&&this.invalidate("Original Video Fallback","Processed output is stale; showing original playback."))},20)}video;settings;persistDivider;preferredBackend;engine;overlay;scheduler;abort=new AbortController;resize;monitor=new Ge;adaptive=new Ue;status="Initializing";reason="Waiting for an accessible video frame.";dimensions=null;dead=!1;generation=0;lastPresented=0;presented=0;probed=!1;watchdog=0;resizeTimer=0;recoveryTimer=0;recoveries=0;lastDpr=devicePixelRatio;backendReason="";starting=!1;effectiveSharpness=0;effectiveDenoise=0;currentEngine="—";visibility=new Ie;frameStarted=0;outputKey="";async start(){await this.initialize()}async initialize(e){if(this.dead||this.starting||!this.settings.enabled)return;this.starting=!0;const t=++this.generation;this.setState("Initializing","Initializing local GPU processing.");try{const n=await j(()=>document.createElement("canvas"),a=>this.lost(a),e??this.preferredBackend);if(this.dead||t!==this.generation){n.engine.destroy();return}this.engine=n.engine,this.backendReason=n.reason,this.overlay=new $e(this.video,n.canvas,a=>{this.settings={...this.settings,divider:a},this.persistDivider?.(a),this.video.paused&&this.scheduler?.refresh()}),this.scheduler=new ze(this.video,a=>this.process(a),()=>{this.monitor.metrics.skippedFrames++,this.monitor.metrics.missedDeadlines++,this.hide(),this.setState("Performance Limited","Newer source frame arrived; discarding outdated output.")},a=>this.fail(a)),this.adaptive.reset(),this.probed=!1,document.hidden||(this.scheduler.start(),this.video.paused&&this.scheduler.refresh())}catch(n){!this.dead&&t===this.generation&&(this.releaseGPU(),this.setState("Unsupported GPU",n instanceof Error?n.message:String(n)))}finally{this.starting=!1}}probe(){if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");const e=document.createElement("canvas");e.width=e.height=1;const t=e.getContext("2d",{willReadFrequently:!0});if(!t)throw new Error("Cannot validate source pixel access.");t.drawImage(this.video,0,0,1,1),t.getImageData(0,0,1,1),this.probed=!0}async process(e){const t=this.engine,n=this.overlay;if(this.dead||!t||!n||document.hidden||this.video.readyState<2||this.video.seeking)return;if(this.video.closest(".ad-showing,.ad-interrupting")){this.invalidate("Original Video Fallback","Enhancement suspended during advertisements.");return}if(this.video.videoWidth<1||this.video.videoHeight<1)return;const a=this.generation;if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");this.probed||this.probe();const i=performance.now();e.metadata&&this.monitor.frame(e.metadata.mediaTime,e.metadata.presentedFrames,i,e.metadata.expectedDisplayTime);const s=this.adaptive.options(this.settings);this.currentEngine=s.options.engine,this.effectiveSharpness=s.options.sharpness*100,this.effectiveDenoise=s.options.engine==="fast"?0:s.options.denoise*100;const r=Ae({width:this.video.videoWidth,height:this.video.videoHeight},n.align(),devicePixelRatio,this.settings.scale,t.maxDimension,t.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)});this.dimensions=r,n.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);const d=`${r.source.width},${r.source.height},${r.output.width},${r.output.height}`;d!==this.outputKey&&(this.hide(),this.outputKey=d),n.displayed||this.setState("Original Video Fallback","Processing the latest frame; showing original playback."),this.monitor.metrics.queueDepth=1;let h=0;try{const o=new Promise((R,m)=>{h=window.setTimeout(()=>m(new Error("GPU processing timed out; original playback restored.")),1500)}),l=await Promise.race([t.render(this.video,r,s.options),o]);if(this.dead||a!==this.generation)return;const u=this.monitor.intervalMs/Math.max(.1,this.video.playbackRate);let f=!this.video.paused&&performance.now()-i>u*1.25||!e.current();if(!f&&!document.hidden&&!this.video.seeking&&(l.cpuSubmitMs+=await Promise.race([t.present(),o])),this.dead||a!==this.generation)return;l.latencyMs=performance.now()-i,f=f||!this.video.paused&&l.latencyMs>u*1.25||!e.current();const g=!f&&!document.hidden&&!this.video.seeking;this.monitor.complete(l,g&&!s.options.original&&e.metadata!==null,performance.now()),f&&this.monitor.metrics.missedDeadlines++,this.settings.adaptive&&!this.video.paused&&e.metadata&&this.adaptive.sample(l.latencyMs,u,f,performance.now()),g?(n.show(),this.visibility.set(!s.options.original),this.lastPresented=performance.now(),this.frameStarted=i,s.options.original||this.presented++,this.setState(s.options.original?"Original Comparison":s.unavailable?"Engine Unavailable":r.limited?"Performance Limited":"Active",s.options.original?"Showing the unenhanced acquired frame for comparison.":s.unavailable?"Requested engine/profile is unavailable; using "+s.options.engine+".":r.limited?"Output reduced to fit display, memory and measured processing limits.":`${t.backend} processed frames are being presented.${this.backendReason?" WebGPU unavailable; using WebGL2 fallback.":""}`)):(this.hide(),this.setState("Performance Limited","Processing missed its frame deadline; showing the original video."))}finally{clearTimeout(h),this.monitor.metrics.queueDepth=0}}onResize(){this.invalidate("Original Video Fallback","Synchronizing output with the player."),clearTimeout(this.resizeTimer),this.resizeTimer=window.setTimeout(()=>{this.overlay?.align(),this.video.paused&&this.scheduler?.refresh()},120)}setState(e,t){this.status=e,this.reason=t}hide(){this.overlay?.hide(),this.visibility.set(!1)}invalidate(e,t){this.hide(),this.scheduler?.invalidate(),this.lastPresented=0,this.setState(e,t)}fail(e){if(this.dead)return;const t=Oe(e);this.monitor.metrics.failures++,this.invalidate(t.status,t.reason),this.releaseGPU()}lost(e){if(this.dead)return;const t=this.engine?.backend==="WebGPU";this.fail(new Error(e)),this.recoveries++<1&&(this.recoveryTimer=window.setTimeout(()=>{this.dead||this.initialize(t?"webgl2":void 0)},1e3))}releaseGPU(){this.generation++,this.scheduler?.stop(),this.scheduler=void 0,this.hide(),this.overlay?.destroy(),this.overlay=void 0,this.engine?.destroy(),this.engine=void 0,this.outputKey="",this.monitor.metrics.queueDepth=0}update(e){const t=e.adaptive!==this.settings.adaptive;this.settings=e,t&&this.adaptive.reset(),this.invalidate("Original Video Fallback","Applying enhancement settings."),this.video.paused&&this.scheduler?.refresh()}stats(){const e=!!this.overlay?.displayed,t=this.monitor.snapshot();t.enhancedVisiblePercent=this.visibility.percent();const n=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0,a=this.currentEngine==="balanced"?`FSR1 EASU hybrid · ${this.settings.contentMode==="animation"?"animation":"natural"}`:this.currentEngine==="fast"?"Fast edge-directed":"—",i=this.settings.original||this.settings.comparison&&this.settings.divider>=1;return{status:this.status,reason:this.reason,backend:this.engine?.backend??"—",engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics:t,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm:a,presentation:e?i?"original":this.settings.comparison?"split":"enhanced":"fallback",fallback:!e,upscalingActive:e&&!i&&n>1.01,scaleRatio:n,frameAgeMs:e?performance.now()-this.frameStarted:null}}destroy(){this.dead||(this.dead=!0,this.abort.abort(),this.resize.disconnect(),clearInterval(this.watchdog),clearTimeout(this.resizeTimer),clearTimeout(this.recoveryTimer),this.releaseGPU())}}async function me(c){let e="";const{engine:t,canvas:n}=await j(()=>document.createElement("canvas"),o=>{e=o},c),a=document.createElement("canvas");a.width=a.height=8;const i=a.getContext("2d"),s={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:!1},r={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5},d=[],h=async(o={})=>{await t.render(a,s,{...r,...o}),await t.present();const l=document.createElement("canvas");l.width=l.height=32;const u=l.getContext("2d",{willReadFrequently:!0});return u.drawImage(n,0,0),u.getImageData(0,0,32,32).data};try{for(const x of["fast","balanced"]){i.fillStyle="rgb(64,128,192)",i.fillRect(0,0,8,8);const b=await h({engine:x}),y=Math.max(...Array.from(b,(k,z)=>Math.abs(k-[64,128,192,255][z%4])));d.push({name:`${x}: constant field / color / alpha`,passed:y<=2,detail:`Maximum channel error ${y}/255`})}for(let x=0;x<8;x++)for(let b=0;b<8;b++){const y=20+b*28;i.fillStyle=`rgb(${y},${y},${y})`,i.fillRect(b,x,1,1)}const o=await h();let l=0;for(let x=6;x<26;x++)l=Math.max(l,Math.abs(o[(512+x)*4]-(20+((x+.5)/4-.5)*28)));d.push({name:"Balanced: linear-ramp reconstruction",passed:l<=3,detail:`Maximum interior error ${l.toFixed(2)}/255`}),i.fillStyle="black",i.fillRect(0,0,8,4),i.fillStyle="white",i.fillRect(0,4,8,4);const u=await h();d.push({name:"Video orientation preserved",passed:u[0]<3&&u[992*4]>252,detail:`Top ${u[0]}, bottom ${u[992*4]}`});for(let x=0;x<8;x++)for(let b=0;b<8;b++){const y=80+(b*17+x*13)%7*11;i.fillStyle=`rgb(${y},${y},${y})`,i.fillRect(b,x,1,1)}const f=await h(),g=await h({sharpness:1}),R=await h({denoise:1}),m=await h({engine:"fast"}),M=await h({sharpness:1,comparison:!0,divider:1}),v=(x,b)=>Array.from(x).reduce((y,k,z)=>y+Math.abs(k-b[z]),0);for(const[x,b]of[["Sharpening changes processed pixels",g],["Denoising changes processed pixels",R],["Fast and Balanced are distinct",m],["Comparison uses unenhanced pixels",M]]){const y=v(f,b);d.push({name:x,passed:y>0,detail:`Absolute channel difference ${y}`})}i.fillStyle="rgb(50,50,50)",i.fillRect(0,0,4,8),i.fillStyle="rgb(200,200,200)",i.fillRect(4,0,4,8);const A=await h({sharpness:1}),I=Math.min(...Array.from(A).filter((x,b)=>b%4!==3)),W=Math.max(...Array.from(A).filter((x,b)=>b%4!==3));if(d.push({name:"Step edge remains bounded (anti-ringing)",passed:I>=49&&W<=201,detail:`Range ${I}…${W}; source 50…200`}),e)throw new Error(e);return{backend:t.backend,checks:d}}finally{t.destroy(),n.remove()}}const Ne=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn pixel(t: texture_2d<f32>, p: vec2i) -> vec3f {
  return textureLoad(t, clamp(p, vec2i(0), vec2i(textureDimensions(t)) - vec2i(1)), 0).rgb;
}
fn linearSample(t: texture_2d<f32>, p: vec2f) -> vec3f {
  let i = vec2i(floor(p)); let f = fract(p);
  return mix(mix(pixel(t,i),pixel(t,i+vec2i(1,0)),f.x),mix(pixel(t,i+vec2i(0,1)),pixel(t,i+vec2i(1,1)),f.x),f.y);
}
// Mitchell-Netravali reconstruction, B=C=1/3. Negative lobes are bounded below.
fn cubic(v: f32) -> f32 {
  let x = abs(v);
  if (x < 1.0) { return (7.0*x*x*x - 12.0*x*x + 5.3333333)/6.0; }
  if (x < 2.0) { return (-2.3333333*x*x*x + 12.0*x*x - 20.0*x + 10.6666667)/6.0; }
  return 0.0;
}
fn reconstruct(t: texture_2d<f32>, p: vec2f, balanced: bool) -> vec3f {
  let i = vec2i(floor(p)); let f = fract(p);
  let a=pixel(t,i); let b=pixel(t,i+vec2i(1,0)); let c=pixel(t,i+vec2i(0,1)); let d=pixel(t,i+vec2i(1,1));
  let base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  let lo=min(min(a,b),min(c,d)); let hi=max(max(a,b),max(c,d));
  if (!balanced) {
    let ad=abs(luma(a)-luma(d)); let bc=abs(luma(b)-luma(c));
    let edge=abs(ad-bc)/(ad+bc+0.02);
    var diagonal=mix(b,c,(1.0-f.x+f.y)*0.5);
    var proximity=1.0-abs(f.x+f.y-1.0);
    if(ad<bc) { diagonal=mix(a,d,(f.x+f.y)*0.5); proximity=1.0-abs(f.x-f.y); }
    return clamp(mix(base,diagonal,0.35*edge*proximity),lo,hi);
  }
  var sum=vec3f(0); var weight=0.0;
  for(var y=-1;y<=2;y++) { for(var x=-1;x<=2;x++) {
    let w=cubic(f32(x)-f.x)*cubic(f32(y)-f.y);
    sum+=pixel(t,i+vec2i(x,y))*w; weight+=w;
  }}
  return clamp(sum/max(weight,0.0001),lo,hi);
}
`,qe=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=vec2i(id.xy); let center=pixel(input,p);
  var total=vec3f(0); var weights=0.0;
  for(var y=-1;y<=1;y++) { for(var x=-1;x<=1;x++) {
    let c=pixel(input,p+vec2i(x,y)); let delta=luma(c)-luma(center);
    let w=exp(-f32(x*x+y*y)*0.7-delta*delta/0.0018);
    total+=c*w; weights+=w;
  }}
  textureStore(output,p,vec4f(mix(center,total/weights,params.settings.y*0.7),1));
}
`,Be=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5),1));
}
`,je=`@group(0) @binding(0) var original: texture_2d<f32>;
@group(0) @binding(1) var enhanced: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return vec4f(positions[index],0,1);
}
@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p=vec2i(pos.xy); let c=pixel(enhanced,p);
  let n=pixel(enhanced,p+vec2i(0,-1)); let s=pixel(enhanced,p+vec2i(0,1));
  let e=pixel(enhanced,p+vec2i(1,0)); let w=pixel(enhanced,p+vec2i(-1,0));
  let low=min(c,min(min(n,s),min(e,w))); let high=max(c,max(max(n,s),max(e,w)));
  // Luminance-only unsharp mask, bounded by the local range to suppress halos.
  let detail=luma(c)-luma((n+s+e+w)*0.25);
  var color=clamp(c+vec3f(detail*params.settings.x*1.25),low,high);
  if(params.settings.w>0.5 && pos.x/params.dims.z<params.extra.x) {
    color=linearSample(original,pos.xy*params.dims.xy/params.dims.zw-0.5);
  }
  return vec4f(clamp(color,vec3f(0),vec3f(1)),1);
}
`,Ve=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,ae=`
precision highp float;
precision highp int;
uniform sampler2D inputTex;
uniform sampler2D originalTex;
uniform vec4 dims;
uniform vec4 settings;
uniform float divider;
out vec4 color;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 pixel(sampler2D t,ivec2 p){return texelFetch(t,clamp(p,ivec2(0),textureSize(t,0)-1),0).rgb;}
vec3 linearSample(sampler2D t,vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);return mix(mix(pixel(t,i),pixel(t,i+ivec2(1,0)),f.x),mix(pixel(t,i+ivec2(0,1)),pixel(t,i+ivec2(1)),f.x),f.y);}
float cubic(float v){float x=abs(v);if(x<1.)return(7.*x*x*x-12.*x*x+5.3333333)/6.;if(x<2.)return(-2.3333333*x*x*x+12.*x*x-20.*x+10.6666667)/6.;return 0.;}
`,Xe=`#version 300 es
`+ae+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c);float w=exp(-float(x*x+y*y)*.7-delta*delta/.0018);sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,settings.y*.7),1);}`,He=`#version 300 es
`+ae+`
void main(){vec2 p=gl_FragCoord.xy*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{vec3 sum=vec3(0);float weight=0.;for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){float w=cubic(float(x)-f.x)*cubic(float(y)-f.y);sum+=pixel(inputTex,i+ivec2(x,y))*w;weight+=w;}color=vec4(clamp(sum/max(weight,.0001),lo,hi),1);}}
`,Ke=`#version 300 es
`+ae+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
if(settings.w>.5&&gl_FragCoord.x/dims.z<divider)result=linearSample(originalTex,gl_FragCoord.xy*dims.xy/dims.zw-.5);
color=vec4(clamp(result,0.,1.),1);}`,Ye=Object.freeze(Object.defineProperty({__proto__:null,composite:Ke,denoise:Xe,upscale:He,vertex:Ve},Symbol.toStringTag,{value:"Module"}));function Je(c,e,t,n,a,i=!1){const s=new Uint8ClampedArray(n*a*4),r=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]],d=(o,l)=>{const u=(Math.max(0,Math.min(t-1,l))*e+Math.max(0,Math.min(e-1,o)))*4;return[c[u]/255,c[u+1]/255,c[u+2]/255]},h=o=>o[1]+(o[0]+o[2])*.5;for(let o=0;o<a;o++)for(let l=0;l<n;l++){let u=(l+.5)*e/n-.5,f=(o+.5)*t/a-.5;Math.abs(u-Math.round(u))<1e-5&&(u=Math.round(u)),Math.abs(f-Math.round(f))<1e-5&&(f=Math.round(f));const g=Math.floor(u),R=Math.floor(f),m=u-g,M=f-R,v=r.map(([P,G])=>d(g+P,R+G)),[A,I,W,x,b,y,k,z,w,S,_,D]=v.map(h);let C=0,L=0,F=0;for(const[P,G,$,X,H,q]of[[A,y,b,S,x,(1-m)*(1-M)],[I,b,S,w,k,m*(1-M)],[b,W,x,k,D,(1-m)*M],[S,x,k,z,_,m*M]]){const K=X-G,Y=H-P,J=Math.min(1,Math.abs(K)/Math.max(Math.abs(X-$),Math.abs($-G),1e-6)),N=Math.min(1,Math.abs(Y)/Math.max(Math.abs(H-$),Math.abs($-P),1e-6));C+=K*q,L+=Y*q,F+=(J*J+N*N)*q}const O=Math.hypot(C,L);O*O<1/32768?(C=1,L=0):(C/=O,L/=O);let V=(F*.5)**2;i&&(V=Math.min(1,V*1.2));const xe=(C*C+L*L)/Math.max(Math.abs(C),Math.abs(L)),ve=1+(xe-1)*V,be=1-.5*V,oe=.5-.29*V,ce=[0,0,0];let le=0;for(let P=0;P<12;P++){const G=r[P][0]-m,$=r[P][1]-M,X=(G*C+$*L)*ve,H=(-G*L+$*C)*be,q=Math.min(X*X+H*H,1/oe),K=.4*q-1,Y=oe*q-1,J=(1.5625*K*K-.5625)*Y*Y;for(let N=0;N<3;N++)ce[N]+=v[P][N]*J;le+=J}const de=(o*n+l)*4;for(let P=0;P<3;P++){const G=[4,9,3,6].map($=>v[$][P]);s[de+P]=Math.round(Math.max(Math.min(...G),Math.min(Math.max(...G),ce[P]/Math.max(le,1e-6)))*255)}s[de+3]=255}return s}const pe={webgpu:{common:Ne,denoise:qe,upscale:Be,composite:je},webgl:Ye};function Q(c,e,t,n){return{source:{width:c,height:e},processing:{width:t,height:n},output:{width:t,height:n},display:{width:t,height:n},css:{width:t,height:n},screen:null,limited:!1}}const ee={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,contentMode:"natural"},U=(c,e)=>Object.assign(document.createElement("canvas"),{width:c,height:e});function Z(c,e){let t=0,n=0;for(let i=0;i<c.length;i++)if(i%4!==3){const s=c[i]-e[i];t+=s*s,n+=Math.abs(s)}const a=c.length*3/4;return{psnr:t===0?99:10*Math.log10(65025/(t/a)),mae:n/a}}const ue=c=>[...c].sort((e,t)=>e-t)[Math.floor(c.length/2)];async function fe(c="webgpu"){const e=await j(()=>U(1,1),()=>{},c,pe),t=await j(()=>U(1,1),()=>{},c),n=async(a,i,s,r={})=>{await a.engine.render(i,s,{...ee,...r}),await a.engine.present();const d=U(s.output.width,s.output.height),h=d.getContext("2d",{willReadFrequently:!0});return h.drawImage(a.canvas,0,0),{data:h.getImageData(0,0,d.width,d.height).data,png:d.toDataURL("image/png")}};try{const a=U(9,7),i=a.getContext("2d"),s=i.createImageData(9,7);for(let m=0;m<s.data.length;m++)s.data[m]=m%4===3?255:(m*73+m%11*31)%256;i.putImageData(s,0,0);const r=await n(t,a,Q(9,7,23,19),{contentMode:"animation"}),d=Je(s.data,9,7,23,19,!0),h=Math.max(...Array.from(d,(m,M)=>Math.abs(m-r.data[M]))),o=[];for(const m of["line-art","natural-texture","compressed-texture"]){const M=U(768,432),v=M.getContext("2d");if(m==="line-art"){v.fillStyle="#e4e8db",v.fillRect(0,0,768,432);for(let w=0;w<14;w++)v.strokeStyle=w%3?"#1d2834":"#537789",v.lineWidth=2+w%3*1.4,v.beginPath(),v.moveTo(15+w*51,45),v.lineTo(90+w*46,390),v.stroke();v.strokeStyle="#252b3e",v.lineWidth=3,v.beginPath(),v.ellipse(355,200,165,105,.25,0,Math.PI*2),v.stroke(),v.font="bold 28px sans-serif",v.fillStyle="#172b3b",v.fillText("Edge reconstruction 0123",30,35)}else{const w=v.createImageData(768,432);for(let S=0;S<432;S++)for(let _=0;_<768;_++){const D=(S*768+_)*4,C=18*Math.sin(_*.18+S*.07)+11*Math.sin(_*.055-S*.14),L=55*Math.tanh((_-300-S*.43)/3),F=125+C+L+15*Math.sin(S*.025);w.data[D]=F*.94,w.data[D+1]=F,w.data[D+2]=F*.84,w.data[D+3]=255}v.putImageData(w,0,0)}const A=v.getImageData(0,0,768,432).data,I=U(256,144),W=I.getContext("2d"),x=W.createImageData(256,144);for(let w=0;w<144;w++)for(let S=0;S<256;S++){const _=(w*256+S)*4;for(let D=0;D<3;D++){let C=0;for(let F=0;F<3;F++)for(let O=0;O<3;O++)C+=A[((w*3+F)*768+S*3+O)*4+D];const L=m==="compressed-texture"?((S*17+w*23)%13-6)*1.3:0;x.data[_+D]=C/9+L}x.data[_+3]=255}W.putImageData(x,0,0);const b=Q(256,144,768,432),y=m==="line-art"?"animation":"natural",k=await n(e,I,b,{denoise:m==="compressed-texture"?.35:0}),z=await n(t,I,b,{denoise:m==="compressed-texture"?.35:0,contentMode:y});o.push({name:m,sharpness:0,baseline:Z(k.data,A),improved:Z(z.data,A),difference:Z(k.data,z.data).mae,images:{source:I.toDataURL(),truth:M.toDataURL(),baseline:k.png,improved:z.png}})}const l=U(640,360),u=l.getContext("2d");u.fillStyle="#9ab9ad",u.fillRect(0,0,640,360),u.fillStyle="#304857";for(let m=0;m<40;m++)u.fillRect(m*17,10,2,340);const f=Q(640,360,1920,1080),g={baseline:[],improved:[]};for(let m=0;m<36;m++)for(const[M,v]of m%2?[["improved",t],["baseline",e]]:[["baseline",e],["improved",t]]){const A=performance.now();await v.engine.render(l,f,{...ee,denoise:.2}),await v.engine.present(),m>=6&&g[M].push(performance.now()-A)}const R={source:"640×360",output:"1920×1080",samples:30,includes:"CPU + queue + GPU completion; not pure GPU timestamp",baselineMedianMs:ue(g.baseline),improvedMedianMs:ue(g.improved),baselineP95Ms:[...g.baseline].sort((m,M)=>m-M)[28],improvedP95Ms:[...g.improved].sort((m,M)=>m-M)[28]};return{backend:t.engine.backend,maxReferenceError:h,cases:o,benchmark:R}}finally{e.engine.destroy(),t.engine.destroy()}}async function Ze(c,e="webgpu"){const t=new Image;t.src=c,await t.decode();const n=U(t.width,t.height);n.getContext("2d").drawImage(t,0,0);const a=Q(t.width,t.height,t.width*3,t.height*3),i=await j(()=>U(1,1),()=>{},e,pe),s=await j(()=>U(1,1),()=>{},e),r=U(a.output.width,a.output.height),d=r.getContext("2d",{willReadFrequently:!0}),h=async(o,l)=>(await o.engine.render(n,a,{...ee,denoise:.2,contentMode:l}),await o.engine.present(),d.drawImage(o.canvas,0,0),{data:d.getImageData(0,0,r.width,r.height).data,png:r.toDataURL()});try{const o=await h(i,"natural"),l=await h(s,"natural"),u=await h(s,"animation");return{backend:s.engine.backend,source:a.source,output:a.output,sharpness:0,denoise:20,baselineToNaturalMAE:Z(o.data,l.data).mae,naturalToAnimationMAE:Z(l.data,u.data).mae,images:{baseline:o.png,natural:l.png,animation:u.png}}}finally{i.engine.destroy(),s.engine.destroy()}}const p=c=>document.getElementById(c),te=p("video");let E={...we,adaptive:!1,automaticStrength:!1,comparison:!0},T,B="";function se(){if(T?.destroy(),T=void 0,E.enabled){const c=p("backend").value;T=new We(te,E,void 0,c==="auto"?void 0:c),T.start()}}async function ge(){p("notice").textContent="Recording a local diagnostic clip (3 seconds)…";const c=document.createElement("canvas");c.width=320,c.height=180;const e=c.getContext("2d"),t=c.captureStream(24),n=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(o=>MediaRecorder.isTypeSupported(o)),a=new MediaRecorder(t,{mimeType:n,videoBitsPerSecond:5e5}),i=[];a.ondataavailable=o=>{o.data.size&&i.push(o.data)};const s=new Promise(o=>{a.onstop=()=>o(new Blob(i,{type:a.mimeType}))});a.start();let r=0;const d=window.setInterval(()=>{const o=e.createLinearGradient(0,0,320,180);o.addColorStop(0,"#122b3e"),o.addColorStop(1,"#c9dec7"),e.fillStyle=o,e.fillRect(0,0,320,180),e.strokeStyle="#eef4df",e.lineWidth=1;for(let l=0;l<18;l++)e.beginPath(),e.moveTo(l*13+r%12,35),e.lineTo(l*13+55,145),e.stroke();e.fillStyle="#121d26",e.fillRect(10,8,300,23),e.fillStyle="#e5edeb",e.font="13px monospace",e.fillText(`CLARITY 320×180 · frame ${String(r).padStart(3,"0")}`,16,24);for(let l=145;l<175;l++)for(let u=15;u<130;u++){const f=90+(u*13+l*7+r*3)%23;e.fillStyle=`rgb(${f},${f},${f})`,e.fillRect(u,l,1,1)}e.fillStyle="#f1b36e",e.beginPath(),e.arc(200+Math.sin(r/12)*60,113,18,0,Math.PI*2),e.fill(),r++},1e3/24);await new Promise(o=>setTimeout(o,3e3)),clearInterval(d),a.stop();const h=await s;t.getTracks().forEach(o=>o.stop()),re(URL.createObjectURL(h)),p("notice").textContent="Generated local 320 × 180 WebM. The sample is decoded by the original HTML video player."}function re(c){B&&URL.revokeObjectURL(B),B=c,te.src=B,se(),te.play().catch(e=>{p("notice").textContent=String(e)})}p("sample").addEventListener("click",()=>{p("sample").disabled=!0,ge().catch(c=>{p("notice").textContent=String(c)}).finally(()=>{p("sample").disabled=!1})});p("packaged").addEventListener("click",()=>{re(new URL("../diagnostic.webm",location.href).href),p("notice").textContent="Playing the packaged local 320 × 180 diagnostic WebM."});p("backend").addEventListener("change",se);p("file").addEventListener("change",c=>{const e=c.target.files?.[0];e&&re(URL.createObjectURL(e))});p("toggle").addEventListener("click",()=>{E.enabled=!E.enabled,p("toggle").textContent=E.enabled?"Disable enhancement":"Enable enhancement",se()});p("engine").addEventListener("change",()=>{E.engine=p("engine").value,T?.update(E)});p("contentMode").addEventListener("change",()=>{E.contentMode=p("contentMode").value,T?.update(E)});p("original").addEventListener("change",()=>{E.original=p("original").checked,T?.update(E)});for(const[c,e]of[["sharp","sharpness"],["noise","denoise"]])p(c).addEventListener("input",()=>{E[e]=Number(p(c).value),p(c==="sharp"?"sharp-value":"noise-value").textContent=String(E[e]),T?.update(E)});p("compare").addEventListener("change",()=>{E.comparison=p("compare").checked,T?.update(E)});p("validate").addEventListener("click",()=>{const c=p("backend").value;p("pixel-results").textContent="Compiling shaders and checking pixels…",me(c==="auto"?void 0:c).then(e=>{p("pixel-results").textContent=`${e.backend}
`+e.checks.map(t=>`${t.passed?"PASS":"FAIL"} ${t.name}
${t.detail}`).join(`
`)}).catch(e=>{p("pixel-results").textContent=String(e)})});p("quality-review").addEventListener("click",()=>{const c=p("backend").value;T?.destroy(),T=void 0,p("quality-results").textContent="Running deterministic comparison; playback enhancement suspended…",fe(c==="webgl2"?"webgl2":"webgpu").then(e=>{p("quality-results").textContent=JSON.stringify({...e,cases:e.cases.map(({images:t,...n})=>n)},null,2)}).catch(e=>{p("quality-results").textContent=String(e)})});const Qe=window.setInterval(()=>{p("stats").textContent=T?JSON.stringify(T.stats(),null,2):"Enhancement disabled."},1e3);window.addEventListener("pagehide",()=>{clearInterval(Qe),T?.destroy(),B&&URL.revokeObjectURL(B)});window.clarityHarness={runPixelChecks:me,runQualityReview:fe,compareCapturedFrame:Ze,sample:ge,stats:()=>T?.stats()??null,destroy:()=>{T?.destroy(),T=void 0},settings:c=>{E={...E,...c},T?.update(E)}};
