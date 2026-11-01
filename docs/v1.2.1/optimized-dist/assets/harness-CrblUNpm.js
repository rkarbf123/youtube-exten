import{e as je,a as Re,D as Ve}from"./types-BmV7dO3q.js";class Xe{enabled=!1;signatures=!0;generation=0;timestampSupported=null;values=new Map;counts=new Map;configure(e,t=!0){this.enabled=e,this.signatures=t,this.reset()}reset(){this.generation++,this.values.clear(),this.counts.clear()}mark(){return this.enabled?performance.now():0}elapsed(e,t){this.enabled&&this.sample(e,performance.now()-t)}sample(e,t){if(!this.enabled||!Number.isFinite(t))return;let i=this.values.get(e);i||(i=[],this.values.set(e,i)),i.length<8192&&i.push(t)}count(e,t=1){this.counts.set(e,(this.counts.get(e)??0)+t)}snapshot(){const e={};for(const[t,i]of this.values){const r=[...i].sort((n,a)=>n-a),s=i.reduce((n,a)=>n+a,0);e[t]={count:i.length,mean:s/i.length,p50:r[Math.floor(r.length*.5)],p95:r[Math.min(r.length-1,Math.floor(r.length*.95))],max:r[r.length-1],total:s}}return{enabled:this.enabled,timestampSupported:this.timestampSupported,stages:e,counters:Object.fromEntries(this.counts)}}}const m=new Xe,Ye=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,He=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Ke=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Qe=`@group(0) @binding(0) var original: texture_2d<f32>;
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
  return vec4f(adjustColor(clamp(color,vec3f(0),vec3f(1)),params.color.x,params.color.y),1);
}
`,Je=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
fn toSRGB(c:vec3f)->vec3f{return select(1.055*pow(max(c,vec3f(0)),vec3f(1.0/2.4))-0.055,c*12.92,c<=vec3f(0.0031308));}
fn gamutScale(chroma:vec3f,y:f32,requested:f32)->f32{
  var s=requested;
  for(var axis=0;axis<3;axis++){let d=chroma[axis];if(d>0.000001){s=min(s,(1.0-y)/d);}else if(d< -0.000001){s=min(s,-y/d);}}
  return max(0.0,s);
}
fn adjustColor(c:vec3f,saturation:f32,brightness:f32)->vec3f{
  if(saturation==1.0&&brightness==1.0){return c;}
  let rgb=toLinear(clamp(c,vec3f(0),vec3f(1)));let y=dot(rgb,vec3f(0.2126,0.7152,0.0722));
  let chroma=rgb-vec3f(y);let saturated=vec3f(y)+chroma*gamutScale(chroma,y,saturation);
  var luminanceGoal=y*brightness;if(brightness>1.0){luminanceGoal=y*brightness/(1.0+(brightness-1.0)*y);}
  let bright=saturated*select(brightness,luminanceGoal/max(y,0.000001),y>0.000001);
  let outChroma=bright-vec3f(luminanceGoal);
  return toSRGB(clamp(vec3f(luminanceGoal)+outChroma*gamutScale(outChroma,luminanceGoal,1.0),vec3f(0),vec3f(1)));
}
`,Ze=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,et=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,tt=`@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(3) var backward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(4) var<uniform> m:MotionParams;
struct Analysis { error:atomic<u32>, difference:atomic<u32>, confidence:atomic<u32>, moving:atomic<u32>, blocks:atomic<u32> }
@group(0) @binding(5) var<storage,read_write> stats:Analysis;
fn sampleFirst(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(b,p);}return rgbAt(a,p);}
fn sampleSecond(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(a,p);}return rgbAt(b,p);}
fn difference(x:vec3f,y:vec3f)->f32{return dot(abs(x-y),vec3f(0.25,0.5,0.25));}
fn patchError(p:vec2i,delta:vec2i,reverse:bool)->f32{
  let count=i32(m.control.y);var sum=0.0;
  for(var y=0;y<4;y++){for(var x=0;x<4;x++){if(x<count&&y<count){let at=p+vec2i(x*2-(count-1),y*2-(count-1));sum+=difference(sampleFirst(at,reverse),sampleSecond(at+delta,reverse));}}}
  return sum/f32(count*count);
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=vec2u(m.grid.xy))){return;}
  let reverse=id.z==1u;let p=vec2i((vec2f(id.xy)+0.5)*m.grid.z);
  let radius=i32(m.control.x);var best=vec2i(0);let zeroError=patchError(p,best,reverse);var bestError=zeroError;var bestScore=bestError;
  // Coarse translation search, then a 5x5 full-pixel refinement. Bounded work.
  for(var y=-radius;y<=radius;y+=4){for(var x=-radius;x<=radius;x+=4){let d=vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(x*x+y*y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let coarse=best;
  for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=coarse+vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(d.x*d.x+d.y*d.y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let ex0=patchError(p,best-vec2i(1,0),reverse);let ex1=patchError(p,best+vec2i(1,0),reverse);
  let ey0=patchError(p,best-vec2i(0,1),reverse);let ey1=patchError(p,best+vec2i(0,1),reverse);
  var sub=vec2f(0);let cx=ex0+ex1-2.0*bestError;let cy=ey0+ey1-2.0*bestError;
  if(cx>0.0001){sub.x=clamp(0.5*(ex0-ex1)/cx,-0.5,0.5);}if(cy>0.0001){sub.y=clamp(0.5*(ey0-ey1)/cy,-0.5,0.5);}
  let textureStrength=difference(sampleFirst(p+vec2i(5,0),reverse),sampleFirst(p-vec2i(5,0),reverse))+difference(sampleFirst(p+vec2i(0,5),reverse),sampleFirst(p-vec2i(0,5),reverse));
  let confidence=clamp(1.0-bestError/0.16,0.0,1.0)*(0.12+0.88*clamp(textureStrength*5.0,0.0,1.0));
  let value=vec4f(vec2f(best)+sub,confidence,bestError);
  if(reverse){textureStore(backward,vec2i(id.xy),value);}else{
    textureStore(forward,vec2i(id.xy),value);
    atomicAdd(&stats.error,u32(bestError*65535.0));atomicAdd(&stats.difference,u32(zeroError*65535.0));
    atomicAdd(&stats.confidence,u32(confidence*65535.0));if(length(value.xy)>0.2&&confidence>0.15){atomicAdd(&stats.moving,1u);}atomicAdd(&stats.blocks,1u);
  }
}
`,it=`@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_2d<f32>;
@group(0) @binding(3) var backward:texture_2d<f32>;
@group(0) @binding(4) var output:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(5) var<uniform> m:MotionParams;
struct SceneAnalysis { error:u32, difference:u32, confidence:u32, moving:u32, blocks:u32 }
@group(0) @binding(6) var<storage,read> analysis:SceneAnalysis;
fn flow(t:texture_2d<f32>,p:vec2f)->vec4f{let at=vec2i(floor((p+0.5)*m.full.zw/m.full.xy/m.grid.z));return textureLoad(t,clamp(at,vec2i(0),vec2i(textureDimensions(t))-1),0);}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(output))){return;}let p=vec2f(id.xy);let phase=m.grid.w;
  let blocks=f32(max(1u,analysis.blocks));
  let cut=f32(analysis.difference)/blocks/65535.0>0.24&&f32(analysis.error)/blocks/65535.0>0.12;
  if(m.control.z>0.5||cut||phase>=0.9999){textureStore(output,vec2i(id.xy),vec4f(rgbAt(b,vec2i(id.xy)),1));return;}
  if(phase<=0.0001){textureStore(output,vec2i(id.xy),vec4f(rgbAt(a,vec2i(id.xy)),1));return;}
  let fa=flow(forward,p);let fb=flow(backward,p);let scale=m.full.xy/m.full.zw;
  let pa=p-fa.xy*scale*phase;let pb=p-fb.xy*scale*(1.0-phase);
  let ca=bilinear(a,pa);let cb=bilinear(b,pb);
  let opposite=flow(backward,pa+fa.xy*scale);
  let consistent=length(fa.xy+opposite.xy)<1.75;
  var color=select(rgbAt(a,vec2i(id.xy)),rgbAt(b,vec2i(id.xy)),phase>=0.5);
  if(fa.z>0.08||fb.z>0.08){
    if(consistent&&abs(fa.z-fb.z)<0.35&&dot(abs(ca-cb),vec3f(0.25,0.5,0.25))<0.2){color=mix(ca,cb,phase);}
    else if(fa.z>fb.z){color=ca;}else{color=cb;}
  }
  textureStore(output,vec2i(id.xy),vec4f(color,1));
}
`;let Ee=class _e{constructor(e,t,i,r,s){this.device=e,this.timer=t,this.down=i,this.estimate=r,this.interpolate=s,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summaries=[0,1].map(()=>e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})),this.reads=[0,1,2].map(()=>({buffer:e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1}))}device;timer;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summaries;key="";count=0;serial=0;dead=!1;times=[0,0,0];downGroups=[];flowGroups=[];warpGroups=new Map;warpTarget;banks=[void 0,void 0];reads=[];full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e,t){e.pushErrorScope("validation");try{const i=[];for(const r of[et,tt,it]){const s=e.createShaderModule({code:Ze+`
`+r}),a=(await s.getCompilationInfo()).messages.filter(o=>o.type==="error");if(a.length)throw new Error("움직임 셰이더 컴파일 실패: "+a.map(o=>o.message).join("; "));i.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:s,entryPoint:"main"}}))}return new _e(e,t,i[0],i[1],i[2])}finally{const i=await e.popErrorScope();if(i)throw new Error("움직임 셰이더 초기화 실패: "+i.message)}}sizeKey(e,t){const i=Math.min(e.width,t.width);return[e.width,e.height,i,Math.max(8,Math.round(e.height*i/e.width))].join(",")}needsResize(e,t){return this.key!==this.sizeKey(e,t)}matchesSource(e){return this.full.width===e.width&&this.full.height===e.height}pairs(){return this.banks.filter(e=>!!e&&e.ready).sort((e,t)=>e.a-t.a)}contains(e){return this.banks.some(t=>t?.id===e.id)}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){this.config=t;const i=this.sizeKey(e,t);if(i===this.key)return;this.destroyTextures();const r=Math.min(e.width,t.width),s=Math.max(8,Math.round(e.height*r/e.width));this.full=e,this.lowSize={width:r,height:s},this.grid={width:Math.ceil(r/8),height:Math.ceil(s/8)};const n=(a,o)=>this.device.createTexture({size:[a.width,a.height],format:o,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[0,1,2].map(()=>n(e,"rgba8unorm")),this.low=[0,1,2].map(()=>n(this.lowSize,"rgba8unorm")),this.flows=[0,1,2,3].map(()=>n(this.grid,"rgba16float")),this.downGroups=this.frames.map((a,o)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1,2].flatMap(a=>[0,1].map(o=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[(a+2)%3].createView()},{binding:1,resource:this.low[a].createView()},{binding:2,resource:this.flows[o*2].createView()},{binding:3,resource:this.flows[o*2+1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summaries[o]}}]}))),this.key=i,this.reset()}enqueue(e,t,i,r,s){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const n=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,r);const a=this.count%3,o=(a+2)%3,d=Math.max(0,this.count-1)%2;this.times[a]=i,this.device.queue.writeBuffer(this.uniform,0,this.params());const l=m.mark();this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[a],colorSpace:"srgb"},[t.width,t.height]),m.elapsed("uploadCpuMs",l);const u=m.mark(),h=this.timer?.begin(),p=this.device.createCommandEncoder();let g=p.beginComputePass({timestampWrites:h?.stamp("downsample")});g.setPipeline(this.down),g.setBindGroup(0,this.downGroups[a]),g.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),g.end();let b;this.count>0&&(p.clearBuffer(this.summaries[d]),g=p.beginComputePass({timestampWrites:h?.stamp("flow")}),g.setPipeline(this.estimate),g.setBindGroup(0,this.flowGroups[a*2+d]),g.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),g.end(),m.count("flowDispatches"),b=this.reads.find(v=>!v.busy),b?(b.busy=!0,p.copyBufferToBuffer(this.summaries[d],0,b.buffer,0,32)):m.count("analysisReadSkipped")),m.elapsed("flowPrepareCpuMs",u),h?.resolve(p),this.device.queue.submit([p.finish()]),h?.submitted();const f={id:++this.serial,newest:a,previous:o,bank:d,a:this.times[o],b:i,ready:++this.count>1,sceneCut:!1,dynamic:!0,confidence:0,flowMs:performance.now()-n,flowSize:{...this.lowSize}};if(f.analysisAvailable=!!b,b){const v=b,x=m.mark();f.analysis=v.buffer.mapAsync(GPUMapMode.READ).then(()=>{const w=new Uint32Array(v.buffer.getMappedRange()),M=Math.max(1,w[4]),E=w[0]/M/65535,y=w[1]/M/65535,P={sceneCut:y>.24&&E>.12,dynamic:w[3]>0&&y>1e-4,confidence:w[2]/M/65535};return v.buffer.unmap(),m.elapsed("flowReadbackWaitMs",x),Object.assign(f,P,{flowMs:performance.now()-n}),P}).catch(w=>(this.dead||s(w),{sceneCut:!1,dynamic:!1,confidence:0})).finally(()=>{v.busy=!1})}return f.ready&&(this.banks[d]=f),this.pair=f,f}finally{this.device.popErrorScope().then(a=>{a&&!this.dead&&s(a)})}}async capture(e,t,i,r){const s=this.enqueue(e,t,i,r,n=>{throw n});return s.analysis?await s.analysis:await this.device.queue.onSubmittedWorkDone(),s}encodeWarp(e,t,i,r,s=this.pair){const n=this.banks.find(l=>l?.id===s.id);if(!n?.ready)throw new Error("유효한 원본 프레임 쌍을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups.clear());const a=n.newest*2+n.bank;let o=this.warpGroups.get(a);o||(o=this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[n.previous].createView()},{binding:1,resource:this.frames[n.newest].createView()},{binding:2,resource:this.flows[n.bank*2].createView()},{binding:3,resource:this.flows[n.bank*2+1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}},{binding:6,resource:{buffer:this.summaries[n.bank]}}]}),this.warpGroups.set(a,o)),this.device.queue.writeBuffer(this.uniform,0,this.params(i,n.sceneCut));const d=e.beginComputePass({timestampWrites:r?.stamp("warp")});d.setPipeline(this.interpolate),d.setBindGroup(0,o),d.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),d.end()}reset(){this.count=0,this.times=[0,0,0],this.banks=[void 0,void 0],this.pair.ready=!1,this.warpTarget=void 0,this.warpGroups.clear()}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups.clear()}destroy(){if(!this.dead){this.dead=!0,this.destroyTextures(),this.uniform.destroy();for(const e of this.summaries)e.destroy();for(const e of this.reads)e.buffer.destroy();this.reads=[]}}};class Ae{slots=[];dead=!1;constructor(e){if(m.enabled&&e.features.has("timestamp-query"))for(let t=0;t<4;t++)this.slots.push({query:e.createQuerySet({type:"timestamp",count:16}),resolve:e.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:e.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1})}begin(){if(this.dead||!m.enabled)return null;const e=this.slots.find(t=>!t.busy);return e?(e.busy=!0,new st(e,m.generation,()=>this.dead)):(m.count("timestampSkipped"),null)}destroy(){this.dead=!0;for(const e of this.slots)e.query.destroy(),e.resolve.destroy(),e.read.destroy();this.slots=[]}}class st{constructor(e,t,i){this.slot=e,this.generation=t,this.dead=i}slot;generation;dead;names=[];stamp(e){const t=this.names.length*2;return this.names.push(e),{querySet:this.slot.query,beginningOfPassWriteIndex:t,endOfPassWriteIndex:t+1}}resolve(e){this.names.length&&(e.resolveQuerySet(this.slot.query,0,this.names.length*2,this.slot.resolve,0),e.copyBufferToBuffer(this.slot.resolve,0,this.slot.read,0,this.names.length*16))}abort(){this.names=[],this.slot.busy=!1}submitted(){if(!this.names.length){this.slot.busy=!1;return}const e=m.mark();this.slot.read.mapAsync(GPUMapMode.READ).then(()=>{if(!this.dead()&&this.generation===m.generation){const t=new BigUint64Array(this.slot.read.getMappedRange());this.names.forEach((i,r)=>m.sample("gpu."+i+"Ms",Number(t[r*2+1]-t[r*2])/1e6)),m.elapsed("diagnosticReadbackWaitMs",e)}this.slot.read.unmap()}).catch(()=>{this.dead()||m.count("timestampReadError")}).finally(()=>{this.slot.busy=!1})}}const rt=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;let Ce=class Le{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:rt}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new Le(e,i)}encode(e,t,i){e.clearBuffer(this.value);const r=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),s=e.beginComputePass({timestampWrites:i?.stamp("signature")});s.setPipeline(this.pipeline),s.setBindGroup(0,r),s.dispatchWorkgroups(4),s.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){const e=m.mark();await this.readback.mapAsync(GPUMapMode.READ),m.elapsed("signatureReadbackWaitMs",e);const t=new Uint32Array(this.readback.getMappedRange()),i=t[0].toString(16)+":"+t[1].toString(16);return this.readback.unmap(),i}destroy(){this.value.destroy(),this.readback.destroy()}},R=class De{constructor(e,t,i,r,s){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=r,this.presentPipeline=s,this.timer=new Ae(t),this.maxDimension=t.limits.maxTextureDimension2D;const n=e.getContext("webgpu");if(!n)throw new Error("WebGPU canvas context unavailable.");this.context=n,n.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;timer;inflight=0;streamSignatureBusy=!1;submissionId=0;pendingSince=new Map;temporalEpoch=0;retired=new Set;onStreamAvailable;get pendingGPU(){return this.inflight}get canStream(){return!this.dead&&this.inflight<3}stalled(e=performance.now()){const t=this.pendingSince.values().next().value;return t!==void 0&&e-t>1500}canCapture(e,t){return this.canStream&&(!this.motion?.needsResize(e,t)||this.inflight===0)}temporalPairs(){return this.motion?.pairs()??[]}loss=()=>{};motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:Ye,denoise:He,upscale:Ke,composite:Qe}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const r=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!r)throw new Error("No WebGPU adapter.");m.timestampSupported=r.features.has("timestamp-query");const s=await r.requestDevice({requiredFeatures:m.enabled&&m.timestampSupported?["timestamp-query"]:[]});try{const n=[i.denoise,i.upscale,i.composite].map(u=>s.createShaderModule({code:i.common+`
`+Je+`
`+u}));for(const u of n){const p=(await u.getCompilationInfo()).messages.filter(g=>g.type==="error");if(p.length)throw new Error(p.map(g=>`WGSL ${g.lineNum}: ${g.message}`).join("; "))}const[a,o,d]=await Promise.all([s.createComputePipelineAsync({layout:"auto",compute:{module:n[0],entryPoint:"main"}}),s.createComputePipelineAsync({layout:"auto",compute:{module:n[1],entryPoint:"main"}}),s.createRenderPipelineAsync({layout:"auto",vertex:{module:n[2],entryPoint:"vertex"},fragment:{module:n[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),l=new De(e,s,a,o,d);return l.loss=t,s.lost.then(u=>{l.dead||t(`WebGPU device lost: ${u.message||u.reason}`)}),s.addEventListener("uncapturederror",u=>{l.dead||t(`WebGPU: ${u.error.message}`)}),l}catch(n){throw s.destroy(),n}}resize(e){const{source:t,output:i}=e,r=`${t.width},${t.height},${i.width},${i.height}`;if(r===this.key)return;if(this.textures.forEach(d=>d.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[d,l]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][d],size:[l.width,l.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[s,n,a]=this.textures.map(d=>d.createView()),o=(d,l,u)=>this.device.createBindGroup({layout:d,entries:[{binding:0,resource:l},{binding:1,resource:u},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=o(this.clean.getBindGroupLayout(0),s,n),this.upscaleRaw=o(this.reconstruct.getBindGroupLayout(0),s,a),this.upscaleClean=o(this.reconstruct.getBindGroupLayout(0),n,a),this.compositeGroup=o(this.presentPipeline.getBindGroupLayout(0),s,a),this.compositeRaw=o(this.presentPipeline.getBindGroupLayout(0),s,s),this.compositeClean=o(this.presentPipeline.getBindGroupLayout(0),s,n),this.key=r}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,r){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const s=await Ee.create(this.device,this.timer);if(this.dead)throw s.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=s}return this.motion.capture(e,t,i,r)}streamError(e){this.dead||this.loss("WebGPU 보간 오류: "+(e instanceof Error?e.message:String(e)))}completion(){const e=performance.now(),t=++this.submissionId;return this.pendingSince.set(t,e),this.inflight++,m.sample("inflightDepth",this.inflight),this.device.queue.onSubmittedWorkDone().then(()=>{const i=performance.now()-e;return m.sample("asyncCompletionLatencyMs",i),i},i=>(this.streamError(i),performance.now()-e)).finally(()=>{this.pendingSince.delete(t),this.inflight--,this.dead||this.onStreamAvailable?.()})}async enqueueFrame(e,t,i,r){if(!this.motion){const n=await Ee.create(this.device,this.timer);if(this.dead)throw n.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=n}m.enabled&&m.signatures&&!this.signature&&(this.signature=await Ce.create(this.device));const s=this.motion.enqueue(e,t,i,r,n=>this.streamError(n));return this.completion(),s}submitTemporal(e,t,i,r,s){if(!this.canStream||!this.motion?.pair.ready)return null;if(!this.motion.matchesSource(e.source))return m.count("discard.resolutionChanged"),null;if(!this.motion.contains(r))return m.count("discard.bufferMismatch"),null;if(`${e.source.width},${e.source.height},${e.output.width},${e.output.height}`!==this.key&&this.inflight>0)return null;const a=performance.now();this.device.pushErrorScope("validation"),this.device.pushErrorScope("out-of-memory");try{this.resize(e);const{source:o,output:d}=e;this.device.queue.writeBuffer(this.uniform,0,new Float32Array([o.width,o.height,d.width,d.height,t.sharpness,t.denoise,t.engine==="balanced"?1:0,t.comparison?1:0,t.divider,t.contentMode==="animation"?1:0,t.original?1:0,0,(t.saturation??100)/100,(t.brightness??100)/100,t.upscale===!1?0:1,0]));const l=this.device.createCommandEncoder(),u=this.timer.begin();this.motion.encodeWarp(l,this.textures[0],i,u,r);const h=!t.original&&t.engine==="balanced"&&t.denoise>0;if(h){const v=l.beginComputePass({timestampWrites:u?.stamp("denoise")});v.setPipeline(this.clean),v.setBindGroup(0,this.denoiseGroup),v.dispatchWorkgroups(Math.ceil(o.width/8),Math.ceil(o.height/8)),v.end()}if(!t.original&&t.upscale!==!1){const v=l.beginComputePass({timestampWrites:u?.stamp("upscale")});v.setPipeline(this.reconstruct),v.setBindGroup(0,h?this.upscaleClean:this.upscaleRaw),v.dispatchWorkgroups(Math.ceil(d.width/8),Math.ceil(d.height/8)),v.end()}if(s&&!s())return u?.abort(),null;const p=this.context.getCurrentTexture(),g=l.beginRenderPass({timestampWrites:u?.stamp("composite"),colorAttachments:[{view:p.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});g.setPipeline(this.presentPipeline),g.setBindGroup(0,t.upscale===!1?h?this.compositeClean:this.compositeRaw:this.compositeGroup),g.draw(3),g.end();const b=!!this.signature&&m.enabled&&m.signatures&&!this.streamSignatureBusy;b&&(this.streamSignatureBusy=!0,this.signature.encode(l,p,u)),u?.resolve(l),this.device.queue.submit([l.finish()]),u?.submitted(),m.count("canvasSubmissions");const f=this.completion();if(b){const v=m.generation,x=this.temporalEpoch;this.signature.read().then(w=>{!this.dead&&x===this.temporalEpoch&&v===m.generation&&(this.lastSignature=w)}).catch(w=>{this.dead||this.streamError(w)}).finally(()=>{x===this.temporalEpoch&&(this.streamSignatureBusy=!1)})}return m.sample("outputSubmitCpuMs",performance.now()-a),{cpuSubmitMs:performance.now()-a,latencyMs:performance.now()-a,gpuMs:null,completion:f}}finally{this.device.popErrorScope().then(o=>{o&&this.streamError(o)}),this.device.popErrorScope().then(o=>{o&&this.streamError(o)})}}resetTemporal(){this.motion?.reset()}releaseTemporal(){const e=this.motion,t=this.signature;this.motion=void 0,this.signature=void 0,this.lastSignature=null,this.streamSignatureBusy=!1,this.temporalEpoch++;let i=!1;const r=()=>{i||(i=!0,e?.destroy(),t?.destroy(),this.retired.delete(r))};this.dead||this.inflight===0?r():(this.retired.add(r),this.device.queue.onSubmittedWorkDone().then(r,r))}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,r=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const s=performance.now(),n=this.device;n.pushErrorScope("validation"),n.pushErrorScope("out-of-memory");let a;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const v=await Ce.create(this.device);if(this.dead)throw v.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=v}const{source:h,output:p}=t;n.queue.writeBuffer(this.uniform,0,new Float32Array([h.width,h.height,p.width,p.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&n.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[h.width,h.height]);const g=n.createCommandEncoder(),b=this.timer.begin();e||this.motion.encodeWarp(g,this.textures[0],r,b);const f=!i.original&&i.engine==="balanced"&&i.denoise>0;if(f){const v=g.beginComputePass({timestampWrites:b?.stamp("denoise")});v.setPipeline(this.clean),v.setBindGroup(0,this.denoiseGroup),v.dispatchWorkgroups(Math.ceil(h.width/8),Math.ceil(h.height/8)),v.end()}if(!i.original&&i.upscale!==!1){const v=g.beginComputePass({timestampWrites:b?.stamp("upscale")});v.setPipeline(this.reconstruct),v.setBindGroup(0,f?this.upscaleClean:this.upscaleRaw),v.dispatchWorkgroups(Math.ceil(p.width/8),Math.ceil(p.height/8)),v.end()}this.selectedComposite=i.upscale===!1?f?this.compositeClean:this.compositeRaw:this.compositeGroup,b?.resolve(g),n.queue.submit([g.finish()]),b?.submitted()}catch(h){a=h}const o=performance.now()-s,d=m.mark(),l=await n.popErrorScope(),u=await n.popErrorScope();if(m.elapsed("renderErrorScopeWaitMs",d),a)throw a;if(l||u)throw new Error((l||u).message);if(e){const h=m.mark();await n.queue.onSubmittedWorkDone(),m.elapsed("renderFenceWaitMs",h)}if(this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:o,latencyMs:performance.now()-s,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),r=this.timer.begin(),s=this.context.getCurrentTexture(),n=i.beginRenderPass({timestampWrites:r?.stamp("composite"),colorAttachments:[{view:s.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(this.presentPipeline),n.setBindGroup(0,this.selectedComposite??this.compositeGroup),n.draw(3),n.end(),this.measureSignature&&this.signature.encode(i,s,r);const a=e==="full"?this.canvas.width:1,o=e==="full"?this.canvas.height:1,d=Math.ceil(a*4/256)*256,l=e!=="none"?this.device.createBuffer({size:d*o,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;l&&i.copyTextureToBuffer({texture:s},{buffer:l,bytesPerRow:d},[a,o]),r?.resolve(i),this.device.queue.submit([i.finish()]),r?.submitted(),m.count("canvasSubmissions");const u=performance.now()-t,h=m.mark(),p=await this.device.popErrorScope();if(m.elapsed("presentErrorScopeWaitMs",h),p)throw new Error(p.message);const g=m.mark();if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),m.elapsed("presentFenceWaitMs",g),this.lastPixels=null,l)try{await l.mapAsync(GPUMapMode.READ);const b=new Uint8Array(l.getMappedRange()),f=new Uint8ClampedArray(a*o*4),v=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let x=0;x<o;x++)for(let w=0;w<a;w++){const M=x*d+w*4,E=(x*a+w)*4;f[E]=b[M+(v?2:0)],f[E+1]=b[M+1],f[E+2]=b[M+(v?0:2)],f[E+3]=b[M+3]}this.lastPixels=f,l.unmap()}finally{l.destroy()}return u}destroy(){if(!this.dead){this.dead=!0,this.device.destroy();for(const e of[...this.retired])e();this.timer.destroy(),this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy()}}};const nt=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,at=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,ot=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,ct=`@group(0) @binding(0) var original: texture_2d<f32>;
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
  return vec4f(adjustColor(clamp(color,vec3f(0),vec3f(1)),params.color.x,params.color.y),1);
}
`,lt=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
fn toSRGB(c:vec3f)->vec3f{return select(1.055*pow(max(c,vec3f(0)),vec3f(1.0/2.4))-0.055,c*12.92,c<=vec3f(0.0031308));}
fn gamutScale(chroma:vec3f,y:f32,requested:f32)->f32{
  var s=requested;
  for(var axis=0;axis<3;axis++){let d=chroma[axis];if(d>0.000001){s=min(s,(1.0-y)/d);}else if(d< -0.000001){s=min(s,-y/d);}}
  return max(0.0,s);
}
fn adjustColor(c:vec3f,saturation:f32,brightness:f32)->vec3f{
  if(saturation==1.0&&brightness==1.0){return c;}
  let rgb=toLinear(clamp(c,vec3f(0),vec3f(1)));let y=dot(rgb,vec3f(0.2126,0.7152,0.0722));
  let chroma=rgb-vec3f(y);let saturated=vec3f(y)+chroma*gamutScale(chroma,y,saturation);
  var luminanceGoal=y*brightness;if(brightness>1.0){luminanceGoal=y*brightness/(1.0+(brightness-1.0)*y);}
  let bright=saturated*select(brightness,luminanceGoal/max(y,0.000001),y>0.000001);
  let outChroma=bright-vec3f(luminanceGoal);
  return toSRGB(clamp(vec3f(luminanceGoal)+outChroma*gamutScale(outChroma,luminanceGoal,1.0),vec3f(0),vec3f(1)));
}
`,ut=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,dt=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,ht=`@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(3) var backward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(4) var<uniform> m:MotionParams;
struct Analysis { error:atomic<u32>, difference:atomic<u32>, confidence:atomic<u32>, moving:atomic<u32>, blocks:atomic<u32> }
@group(0) @binding(5) var<storage,read_write> stats:Analysis;
fn sampleFirst(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(b,p);}return rgbAt(a,p);}
fn sampleSecond(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(a,p);}return rgbAt(b,p);}
fn difference(x:vec3f,y:vec3f)->f32{return dot(abs(x-y),vec3f(0.25,0.5,0.25));}
fn patchError(p:vec2i,delta:vec2i,reverse:bool)->f32{
  let count=i32(m.control.y);var sum=0.0;
  for(var y=0;y<4;y++){for(var x=0;x<4;x++){if(x<count&&y<count){let at=p+vec2i(x*2-(count-1),y*2-(count-1));sum+=difference(sampleFirst(at,reverse),sampleSecond(at+delta,reverse));}}}
  return sum/f32(count*count);
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=vec2u(m.grid.xy))){return;}
  let reverse=id.z==1u;let p=vec2i((vec2f(id.xy)+0.5)*m.grid.z);
  let radius=i32(m.control.x);var best=vec2i(0);var bestError=patchError(p,best,reverse);var bestScore=bestError;
  // Coarse translation search, then a 5x5 full-pixel refinement. Bounded work.
  for(var y=-radius;y<=radius;y+=4){for(var x=-radius;x<=radius;x+=4){let d=vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(x*x+y*y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let coarse=best;
  for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=coarse+vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(d.x*d.x+d.y*d.y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let ex0=patchError(p,best-vec2i(1,0),reverse);let ex1=patchError(p,best+vec2i(1,0),reverse);
  let ey0=patchError(p,best-vec2i(0,1),reverse);let ey1=patchError(p,best+vec2i(0,1),reverse);
  var sub=vec2f(0);let cx=ex0+ex1-2.0*bestError;let cy=ey0+ey1-2.0*bestError;
  if(cx>0.0001){sub.x=clamp(0.5*(ex0-ex1)/cx,-0.5,0.5);}if(cy>0.0001){sub.y=clamp(0.5*(ey0-ey1)/cy,-0.5,0.5);}
  let center=sampleFirst(p,reverse);let textureStrength=difference(sampleFirst(p+vec2i(5,0),reverse),sampleFirst(p-vec2i(5,0),reverse))+difference(sampleFirst(p+vec2i(0,5),reverse),sampleFirst(p-vec2i(0,5),reverse));
  let confidence=clamp(1.0-bestError/0.16,0.0,1.0)*(0.12+0.88*clamp(textureStrength*5.0,0.0,1.0));
  let value=vec4f(vec2f(best)+sub,confidence,bestError);
  if(reverse){textureStore(backward,vec2i(id.xy),value);}else{
    textureStore(forward,vec2i(id.xy),value);
    atomicAdd(&stats.error,u32(bestError*65535.0));atomicAdd(&stats.difference,u32(difference(center,sampleSecond(p,false))*65535.0));
    atomicAdd(&stats.confidence,u32(confidence*65535.0));if(length(value.xy)>0.2&&confidence>0.15){atomicAdd(&stats.moving,1u);}atomicAdd(&stats.blocks,1u);
  }
}
`,ft=`@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_2d<f32>;
@group(0) @binding(3) var backward:texture_2d<f32>;
@group(0) @binding(4) var output:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(5) var<uniform> m:MotionParams;
fn flow(t:texture_2d<f32>,p:vec2f)->vec4f{let at=vec2i(floor((p+0.5)*m.full.zw/m.full.xy/m.grid.z));return textureLoad(t,clamp(at,vec2i(0),vec2i(textureDimensions(t))-1),0);}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(output))){return;}let p=vec2f(id.xy);let phase=m.grid.w;
  if(m.control.z>0.5||phase>=0.9999){textureStore(output,vec2i(id.xy),vec4f(rgbAt(b,vec2i(id.xy)),1));return;}
  if(phase<=0.0001){textureStore(output,vec2i(id.xy),vec4f(rgbAt(a,vec2i(id.xy)),1));return;}
  let fa=flow(forward,p);let fb=flow(backward,p);let scale=m.full.xy/m.full.zw;
  let pa=p-fa.xy*scale*phase;let pb=p-fb.xy*scale*(1.0-phase);
  let ca=bilinear(a,pa);let cb=bilinear(b,pb);
  let opposite=flow(backward,pa+fa.xy*scale);
  let consistent=length(fa.xy+opposite.xy)<1.75;
  var color=select(rgbAt(a,vec2i(id.xy)),rgbAt(b,vec2i(id.xy)),phase>=0.5);
  if(fa.z>0.08||fb.z>0.08){
    if(consistent&&abs(fa.z-fb.z)<0.35&&dot(abs(ca-cb),vec3f(0.25,0.5,0.25))<0.2){color=mix(ca,cb,phase);}
    else if(fa.z>fb.z){color=ca;}else{color=cb;}
  }
  textureStore(output,vec2i(id.xy),vec4f(color,1));
}
`;class ge{constructor(e,t,i,r){this.device=e,this.down=t,this.estimate=i,this.interpolate=r,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summary=e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summary;readback;key="";count=0;newest=0;dead=!1;times=[0,0];downGroups=[];flowGroups=[];warpGroups=[];warpTarget;full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e){e.pushErrorScope("validation");try{const t=[];for(const i of[dt,ht,ft]){const r=e.createShaderModule({code:ut+`
`+i}),n=(await r.getCompilationInfo()).messages.filter(a=>a.type==="error");if(n.length)throw new Error("움직임 셰이더 컴파일 실패: "+n.map(a=>a.message).join("; "));t.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:r,entryPoint:"main"}}))}return new ge(e,t[0],t[1],t[2])}finally{const t=await e.popErrorScope();if(t)throw new Error("움직임 셰이더 초기화 실패: "+t.message)}}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){const i=Math.min(e.width,t.width),r=Math.max(8,Math.round(e.height*i/e.width)),s=`${e.width},${e.height},${i},${r}`;if(this.config=t,s===this.key)return;this.destroyTextures(),this.full=e,this.lowSize={width:i,height:r},this.grid={width:Math.ceil(i/8),height:Math.ceil(r/8)};const n=(a,o)=>this.device.createTexture({size:[a.width,a.height],format:o,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[n(e,"rgba8unorm"),n(e,"rgba8unorm")],this.low=[n(this.lowSize,"rgba8unorm"),n(this.lowSize,"rgba8unorm")],this.flows=[n(this.grid,"rgba16float"),n(this.grid,"rgba16float")],this.downGroups=this.frames.map((a,o)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1].map(a=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[1-a].createView()},{binding:1,resource:this.low[a].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summary}}]})),this.key=s,this.reset()}async capture(e,t,i,r){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const s=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,r),this.newest=this.count===0?0:1-this.newest,this.times[this.newest]=i,this.device.queue.writeBuffer(this.uniform,0,this.params()),this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[this.newest],colorSpace:"srgb"},[t.width,t.height]);const n=this.device.createCommandEncoder();let a=n.beginComputePass();a.setPipeline(this.down),a.setBindGroup(0,this.downGroups[this.newest]),a.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),a.end(),this.count>0&&(n.clearBuffer(this.summary),a=n.beginComputePass(),a.setPipeline(this.estimate),a.setBindGroup(0,this.flowGroups[this.newest]),a.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),a.end(),n.copyBufferToBuffer(this.summary,0,this.readback,0,32)),this.device.queue.submit([n.finish()]);let o=!1,d=!1,l=0;if(this.count>0){await this.readback.mapAsync(GPUMapMode.READ);const u=new Uint32Array(this.readback.getMappedRange()),h=Math.max(1,u[4]),p=u[0]/h/65535,g=u[1]/h/65535;l=u[2]/h/65535,d=u[3]>0&&g>1e-4,o=g>.24&&p>.12,this.readback.unmap()}else await this.device.queue.onSubmittedWorkDone();this.count++,this.pair={a:this.times[1-this.newest],b:i,ready:this.count>1,sceneCut:o,dynamic:d,confidence:l,flowMs:performance.now()-s,flowSize:{...this.lowSize}}}finally{const n=await this.device.popErrorScope();if(n)throw new Error("움직임 추정 GPU 오류: "+n.message)}return this.pair}encodeWarp(e,t,i){if(!this.pair.ready)throw new Error("서로 다른 두 원본 프레임을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups=[0,1].map(s=>this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[1-s].createView()},{binding:1,resource:this.frames[s].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}}]}))),this.device.queue.writeBuffer(this.uniform,0,this.params(i,this.pair.sceneCut));const r=e.beginComputePass();r.setPipeline(this.interpolate),r.setBindGroup(0,this.warpGroups[this.newest]),r.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),r.end()}reset(){this.count=0,this.times=[0,0],this.pair.ready=!1,this.warpTarget=void 0}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups=[]}destroy(){this.dead||(this.dead=!0,this.destroyTextures(),this.uniform.destroy(),this.summary.destroy(),this.readback.destroy())}}const pt=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;class ve{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:pt}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new ve(e,i)}encode(e,t){e.clearBuffer(this.value);const i=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),r=e.beginComputePass();r.setPipeline(this.pipeline),r.setBindGroup(0,i),r.dispatchWorkgroups(4),r.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){await this.readback.mapAsync(GPUMapMode.READ);const e=new Uint32Array(this.readback.getMappedRange()),t=e[0].toString(16)+":"+e[1].toString(16);return this.readback.unmap(),t}destroy(){this.value.destroy(),this.readback.destroy()}}class fe{constructor(e,t,i,r,s){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=r,this.presentPipeline=s,this.maxDimension=t.limits.maxTextureDimension2D;const n=e.getContext("webgpu");if(!n)throw new Error("WebGPU canvas context unavailable.");this.context=n,n.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:nt,denoise:at,upscale:ot,composite:ct}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const r=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!r)throw new Error("No WebGPU adapter.");const s=await r.requestDevice();try{const n=[i.denoise,i.upscale,i.composite].map(u=>s.createShaderModule({code:i.common+`
`+lt+`
`+u}));for(const u of n){const p=(await u.getCompilationInfo()).messages.filter(g=>g.type==="error");if(p.length)throw new Error(p.map(g=>`WGSL ${g.lineNum}: ${g.message}`).join("; "))}const[a,o,d]=await Promise.all([s.createComputePipelineAsync({layout:"auto",compute:{module:n[0],entryPoint:"main"}}),s.createComputePipelineAsync({layout:"auto",compute:{module:n[1],entryPoint:"main"}}),s.createRenderPipelineAsync({layout:"auto",vertex:{module:n[2],entryPoint:"vertex"},fragment:{module:n[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),l=new fe(e,s,a,o,d);return s.lost.then(u=>{l.dead||t(`WebGPU device lost: ${u.message||u.reason}`)}),s.addEventListener("uncapturederror",u=>{l.dead||t(`WebGPU: ${u.error.message}`)}),l}catch(n){throw s.destroy(),n}}resize(e){const{source:t,output:i}=e,r=`${t.width},${t.height},${i.width},${i.height}`;if(r===this.key)return;if(this.textures.forEach(d=>d.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[d,l]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][d],size:[l.width,l.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[s,n,a]=this.textures.map(d=>d.createView()),o=(d,l,u)=>this.device.createBindGroup({layout:d,entries:[{binding:0,resource:l},{binding:1,resource:u},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=o(this.clean.getBindGroupLayout(0),s,n),this.upscaleRaw=o(this.reconstruct.getBindGroupLayout(0),s,a),this.upscaleClean=o(this.reconstruct.getBindGroupLayout(0),n,a),this.compositeGroup=o(this.presentPipeline.getBindGroupLayout(0),s,a),this.compositeRaw=o(this.presentPipeline.getBindGroupLayout(0),s,s),this.compositeClean=o(this.presentPipeline.getBindGroupLayout(0),s,n),this.key=r}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,r){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const s=await ge.create(this.device);if(this.dead)throw s.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=s}return this.motion.capture(e,t,i,r)}resetTemporal(){this.motion?.reset()}releaseTemporal(){this.motion?.destroy(),this.motion=void 0,this.signature?.destroy(),this.signature=void 0,this.lastSignature=null}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,r=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const s=performance.now(),n=this.device;n.pushErrorScope("validation"),n.pushErrorScope("out-of-memory");let a;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const b=await ve.create(this.device);if(this.dead)throw b.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=b}const{source:u,output:h}=t;n.queue.writeBuffer(this.uniform,0,new Float32Array([u.width,u.height,h.width,h.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&n.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[u.width,u.height]);const p=n.createCommandEncoder();e||this.motion.encodeWarp(p,this.textures[0],r);const g=!i.original&&i.engine==="balanced"&&i.denoise>0;if(g){const b=p.beginComputePass();b.setPipeline(this.clean),b.setBindGroup(0,this.denoiseGroup),b.dispatchWorkgroups(Math.ceil(u.width/8),Math.ceil(u.height/8)),b.end()}if(!i.original&&i.upscale!==!1){const b=p.beginComputePass();b.setPipeline(this.reconstruct),b.setBindGroup(0,g?this.upscaleClean:this.upscaleRaw),b.dispatchWorkgroups(Math.ceil(h.width/8),Math.ceil(h.height/8)),b.end()}this.selectedComposite=i.upscale===!1?g?this.compositeClean:this.compositeRaw:this.compositeGroup,n.queue.submit([p.finish()])}catch(u){a=u}const o=performance.now()-s,d=await n.popErrorScope(),l=await n.popErrorScope();if(a)throw a;if(d||l)throw new Error((d||l).message);if(e&&await n.queue.onSubmittedWorkDone(),this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:o,latencyMs:performance.now()-s,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),r=this.context.getCurrentTexture(),s=i.beginRenderPass({colorAttachments:[{view:r.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});s.setPipeline(this.presentPipeline),s.setBindGroup(0,this.selectedComposite??this.compositeGroup),s.draw(3),s.end(),this.measureSignature&&this.signature.encode(i,r);const n=e==="full"?this.canvas.width:1,a=e==="full"?this.canvas.height:1,o=Math.ceil(n*4/256)*256,d=e!=="none"?this.device.createBuffer({size:o*a,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;d&&i.copyTextureToBuffer({texture:r},{buffer:d,bytesPerRow:o},[n,a]),this.device.queue.submit([i.finish()]);const l=performance.now()-t,u=await this.device.popErrorScope();if(u)throw new Error(u.message);if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),this.lastPixels=null,d)try{await d.mapAsync(GPUMapMode.READ);const h=new Uint8Array(d.getMappedRange()),p=new Uint8ClampedArray(n*a*4),g=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let b=0;b<a;b++)for(let f=0;f<n;f++){const v=b*o+f*4,x=(b*n+f)*4;p[x]=h[v+(g?2:0)],p[x+1]=h[v+1],p[x+2]=h[v+(g?0:2)],p[x+3]=h[v+3]}this.lastPixels=p,d.unmap()}finally{d.destroy()}return l}destroy(){this.dead||(this.dead=!0,this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy())}}async function mt(c){m.configure(!1,!1);const e=document.createElement("canvas"),t=await(c==="baseline"?fe:R).create(e,()=>{}),i=[];try{for(let r=32;r<40;r++)for(const s of[0,2]){t.resetTemporal();const n=Object.assign(document.createElement("canvas"),{width:256,height:144}),a=Object.assign(document.createElement("canvas"),{width:256,height:144});for(const[h,p]of[[n,r],[a,r+s]]){const g=h.getContext("2d");g.fillStyle="#101010",g.fillRect(0,0,256,144),g.fillStyle="#eeeeee",g.fillRect(p,43,48,48),g.fillStyle="#4080c0",g.fillRect(p+8,51,16,16),g.fillStyle="#80c040",g.fillRect(p+28,71,12,12)}const o=n.getContext("2d").getImageData(0,0,256,144).data,d=a.getContext("2d").getImageData(0,0,256,144).data;let l=0;for(let h=0;h<o.length;h++)o[h]!==d[h]&&l++;await t.captureFrame(n,{width:256,height:144},0,{width:256,tier:1});const u=await t.captureFrame(a,{width:256,height:144},1/60,{width:256,tier:1});i.push({x:r,shift:s,changedChannels:l,dynamic:u.dynamic,confidence:u.confidence})}return i}finally{t.destroy()}}async function gt(c,e,t,i=10){const r=GPUAdapter.prototype.requestDevice,s=GPUDevice.prototype.createCommandEncoder,n=GPUCommandEncoder.prototype.beginComputePass,a=GPUCommandEncoder.prototype.finish,o=GPUQueue.prototype.submit;let d,l="capture";const u=new WeakMap,h=new WeakMap;GPUAdapter.prototype.requestDevice=function(E={}){return r.call(this,{...E,requiredFeatures:this.features.has("timestamp-query")?["timestamp-query"]:[]})},m.configure(!1,!1);const p=Object.assign(document.createElement("canvas"),{width:1,height:1}),g=await(c==="baseline"?fe:R).create(p,()=>{});m.configure(!0,!1);const b=g.device;m.timestampSupported=b.features.has("timestamp-query"),d=new Ae(b),GPUDevice.prototype.createCommandEncoder=function(E){const y=s.call(this,E);return u.set(y,{record:d.begin(),scope:l,index:0}),y},GPUCommandEncoder.prototype.beginComputePass=function(E={}){const y=u.get(this);return n.call(this,{...E,timestampWrites:y?.record?.stamp(y.scope+".pass"+y.index++)})},GPUCommandEncoder.prototype.finish=function(E){const y=u.get(this);y?.record?.resolve(this);const P=a.call(this,E);return h.set(P,y?.record??null),P},GPUQueue.prototype.submit=function(E){const y=Array.from(E);o.call(this,y);for(const P of y)h.get(P)?.submitted()};const f=Object.assign(document.createElement("canvas"),{width:e,height:t}),v=f.getContext("2d"),x={source:{width:e,height:t},processing:{width:e,height:t},output:{width:e,height:t},display:{width:e,height:t},css:{width:e,height:t},screen:null,limited:!1},w={engine:"fast",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};let M=0;try{const E=performance.now()+2e3;for(;performance.now()<E;)v.fillStyle="#101010",v.fillRect(0,0,e,t),v.fillStyle="#eeeeee",v.fillRect(M%20*e/256,t/3,e/4,t/4),l="capture",await g.captureFrame(f,{width:e,height:t},M/60,{width:256,tier:1}),M>0&&(l="warp",await g.renderTemporal(x,w,.5)),M++;m.reset();const y=performance.now();let P=0;for(;performance.now()-y<i*1e3;)v.fillStyle="#101010",v.fillRect(0,0,e,t),v.fillStyle="#eeeeee",v.fillRect(M%20*e/256,t/3,e/4,t/4),l="capture",await g.captureFrame(f,{width:e,height:t},M/60,{width:256,tier:1}),l="warp",await g.renderTemporal(x,w,.5),M++,P++;return await b.queue.onSubmittedWorkDone(),{variant:c,width:e,height:t,seconds:i,elapsedMs:performance.now()-y,pairs:P,profile:m.snapshot(),note:"compute only; no Canvas present and no output scheduler"}}finally{GPUAdapter.prototype.requestDevice=r,GPUDevice.prototype.createCommandEncoder=s,GPUCommandEncoder.prototype.beginComputePass=n,GPUCommandEncoder.prototype.finish=a,GPUQueue.prototype.submit=o,d.destroy(),g.destroy()}}const pe=c=>{const e=[];do e.unshift(c%256),c=Math.floor(c/256);while(c);return new Uint8Array(e)},X=c=>{const e=new Uint8Array(c.reduce((i,r)=>i+r.length,0));let t=0;for(const i of c)e.set(i,t),t+=i.length;return e};function I(c,e){let t=1;for(;e.length>=2**(7*t)-1;)t++;const i=pe(e.length),r=new Uint8Array(t);return r.set(i,t-i.length),r[0]|=1<<8-t,X([pe(c),r,e])}const D=(c,e)=>I(c,pe(e)),de=(c,e)=>I(c,new TextEncoder().encode(e));async function vt(c,e,t,i=16){const r=new OffscreenCanvas(c,e),s=r.getContext("2d"),n=[],a=new VideoEncoder({output:p=>{const g=new Uint8Array(p.byteLength);p.copyTo(g),n.push({time:p.timestamp,key:p.type==="key",data:g})},error:p=>{throw p}});a.configure({codec:"vp8",width:c,height:e,framerate:t,bitrate:Math.max(4e5,c*e*2),latencyMode:"realtime"});for(let p=0;p<t*i;p++){const g=p/t*120/204.8%1,b=1-Math.abs(g*2-1),f=c*(.15+.4*b),v=e*.3,x=c/256;s.fillStyle="#101010",s.fillRect(0,0,c,e),s.fillStyle="#eeeeee",s.fillRect(f,v,48*x,48*x),s.fillStyle="#4080c0",s.fillRect(f+8*x,v+8*x,16*x,16*x),s.fillStyle="#80c040",s.fillRect(f+28*x,v+28*x,12*x,12*x);const w=new VideoFrame(r,{timestamp:Math.round(p*1e6/t),duration:Math.round(1e6/t)});a.encode(w,{keyFrame:p%t===0}),w.close(),a.encodeQueueSize>6&&await a.flush()}await a.flush(),a.close();const o=I(440786851,X([D(17030,1),D(17143,1),D(17138,4),D(17139,8),de(17026,"webm"),D(17031,4),D(17029,2)])),d=new Uint8Array(8);new DataView(d.buffer).setFloat64(0,i*1e3);const l=I(357149030,X([D(2807729,1e6),I(17545,d),de(19840,"Clarity diagnostic"),de(22337,"Clarity diagnostic")])),u=I(374648427,I(174,X([D(215,1),D(29637,1),D(131,1),de(134,"V_VP8"),D(2352003,Math.round(1e9/t)),I(224,X([D(176,c),D(186,e)]))]))),h=[];for(let p=0;p<i;p++){const g=n.filter(b=>Math.floor(b.time/1e6)===p).map(b=>{const f=new Uint8Array(b.data.length+4),v=Math.round(b.time/1e3)-p*1e3;return f[0]=129,f[1]=v>>8&255,f[2]=v&255,f[3]=b.key?128:0,f.set(b.data,4),I(163,f)});h.push(I(524531317,X([D(231,p*1e3),...g])))}return Array.from(X([o,I(408125543,X([l,u,...h]))]))}let J,Te;async function xt(c,e){J?.destroy(),Te?.remove();const t=document.createElement("canvas");Object.assign(t.style,{position:"fixed",top:"0",left:"0",width:"128px",height:"72px",zIndex:"2147483647"}),document.body.append(t),Te=t,J=await R.create(t,()=>{});for(let a=0;a<3;a++){const o=Object.assign(document.createElement("canvas"),{width:128,height:72}),d=o.getContext("2d");d.fillStyle="#101010",d.fillRect(0,0,128,72),d.fillStyle="#eeeeee",d.fillRect(24+a*8,24,32,24),await J.captureFrame(o,{width:128,height:72},a/24,{width:128,tier:1})}const i=J.temporalPairs(),r=i[c==="previous"?0:1],s={width:128,height:72},n=J.submitTemporal({source:s,output:s,processing:s,display:s,css:s,screen:null,limited:!1},{engine:"fast",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100},e,r);if(!n)throw new Error("캐시 프레임 제출 실패");return await n.completion,{expected:(c==="previous"?40:48)+8*e,pairs:i.map(a=>({a:a.a,b:a.b,id:a.id}))}}function bt(c){window.clarityPerf={classifySmallMotion:mt,cachedPhase:xt,computeOnly:gt,makeClip:vt,configure:(e,t=!0)=>m.configure(e,t),reset:()=>m.reset(),snapshot:()=>m.snapshot(),load:c},window.addEventListener("pagehide",()=>J?.destroy())}const yt=`// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
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
`,wt=`vec3 toLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(.04045)));}
vec3 toSRGB(vec3 c){return mix(1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,c*12.92,lessThanEqual(c,vec3(.0031308)));}
float gamutScale(vec3 chroma,float y,float requested){float s=requested;for(int axis=0;axis<3;axis++){float d=chroma[axis];if(d>.000001)s=min(s,(1.-y)/d);else if(d<-.000001)s=min(s,-y/d);}return max(0.,s);}
vec3 adjustColor(vec3 c,float saturation,float brightness){
  if(saturation==1.&&brightness==1.)return c;
  vec3 rgb=toLinear(clamp(c,0.,1.));float y=dot(rgb,vec3(.2126,.7152,.0722));vec3 chroma=rgb-y;
  vec3 saturated=vec3(y)+chroma*gamutScale(chroma,y,saturation);
  float target=brightness>1.?y*brightness/(1.+(brightness-1.)*y):y*brightness;
  vec3 bright=saturated*(y>.000001?target/max(y,.000001):brightness),outChroma=bright-target;
  return toSRGB(clamp(vec3(target)+outChroma*gamutScale(outChroma,target,1.),0.,1.));
}
`,St=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,xe=`
precision highp float;
precision highp int;
uniform sampler2D inputTex;
uniform sampler2D originalTex;
uniform vec4 dims;
uniform vec4 settings;
uniform float divider;
uniform float contentMode;
uniform float originalView;
uniform vec2 colorSettings;
out vec4 color;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 pixel(sampler2D t,ivec2 p){ivec2 size=textureSize(t,0);p=clamp(p,ivec2(0),size-1);p.y=size.y-1-p.y;return texelFetch(t,p,0).rgb;}
vec3 linearSample(sampler2D t,vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);return mix(mix(pixel(t,i),pixel(t,i+ivec2(1,0)),f.x),mix(pixel(t,i+ivec2(0,1)),pixel(t,i+ivec2(1)),f.x),f.y);}
float cubic(float v){float x=abs(v);if(x<1.)return(7.*x*x*x-12.*x*x+5.3333333)/6.;if(x<2.)return(-2.3333333*x*x*x+12.*x*x-20.*x+10.6666667)/6.;return 0.;}
`,Pt=`#version 300 es
`+xe+`
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`,Mt=`#version 300 es
`+xe+yt+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`,Et=`#version 300 es
`+xe+wt+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(adjustColor(clamp(result,0.,1.),colorSettings.x,colorSettings.y),1);}`,Ct=Object.freeze(Object.defineProperty({__proto__:null,composite:Et,denoise:Pt,upscale:Mt,vertex:St},Symbol.toStringTag,{value:"Module"}));class Fe{constructor(e,t,i=Ct){this.canvas=e;const r=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"low-power"});if(!r)throw new Error("WebGL2 unavailable.");this.gl=r,this.maxDimension=r.getParameter(r.MAX_TEXTURE_SIZE),this.completionChannel.port2.onmessage=()=>this.completionPoll?.(),this.fb=r.createFramebuffer(),this.vao=r.createVertexArray(),r.bindVertexArray(this.vao),this.onContextLost=s=>{s.preventDefault(),this.dead||t("WebGL context lost.")},e.addEventListener("webglcontextlost",this.onContextLost);try{for(const s of[i.denoise,i.upscale,i.composite]){const n=this.compile(s,i.vertex);this.programs.push(n),this.uniforms.push(Object.fromEntries(["inputTex","originalTex","dims","settings","divider","contentMode","originalView","colorSettings"].map(a=>[a,r.getUniformLocation(n,a)])))}r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!0),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,r.BROWSER_DEFAULT_WEBGL)}catch(s){throw this.destroy(),s}}canvas;backend="WebGL2";maxPixels=8294400;maxDimension;gl;programs=[];textures=[];uniforms=[];pendingPresent;completionChannel=new MessageChannel;completionPoll;cancelWait;pollTimer=0;fb;vao;key="";dead=!1;onContextLost;compile(e,t){const i=this.gl,r=i.createProgram(),s=[];try{for(const[n,a]of[[i.VERTEX_SHADER,t],[i.FRAGMENT_SHADER,e]]){const o=i.createShader(n);if(s.push(o),i.shaderSource(o,a),i.compileShader(o),!i.getShaderParameter(o,i.COMPILE_STATUS))throw new Error(i.getShaderInfoLog(o)||"GLSL compilation failed");i.attachShader(r,o)}if(i.linkProgram(r),!i.getProgramParameter(r,i.LINK_STATUS))throw new Error(i.getProgramInfoLog(r)||"GLSL link failed");return r}catch(n){throw i.deleteProgram(r),n}finally{s.forEach(n=>i.deleteShader(n))}}resize(e){const{source:t,output:i}=e,r=`${t.width},${t.height},${i.width},${i.height}`;if(this.key===r)return;const s=this.gl;if(this.textures.forEach(n=>s.deleteTexture(n)),this.textures=[],Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe texture/memory limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const n of[t,t,i]){const a=s.createTexture();this.textures.push(a),s.bindTexture(s.TEXTURE_2D,a),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.texStorage2D(s.TEXTURE_2D,1,s.RGBA8,n.width,n.height)}this.key=r}async render(e,t,i){if(this.dead)throw new Error("WebGL engine destroyed.");const r=performance.now(),s=this.gl;this.resize(t),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,s.RGBA,s.UNSIGNED_BYTE,e);const n=(l,u,h,p,g)=>{const b=this.programs[l],f=this.uniforms[l];if(s.useProgram(b),s.bindVertexArray(this.vao),s.bindFramebuffer(s.FRAMEBUFFER,h?this.fb:null),h&&(s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,h,0),s.checkFramebufferStatus(s.FRAMEBUFFER)!==s.FRAMEBUFFER_COMPLETE))throw new Error("Incomplete GPU framebuffer.");s.viewport(0,0,p,g),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,u),s.uniform1i(f.inputTex,0),s.activeTexture(s.TEXTURE1),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.uniform1i(f.originalTex,1),s.uniform4f(f.dims,t.source.width,t.source.height,t.output.width,t.output.height),s.uniform4f(f.settings,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0),s.uniform1f(f.divider,i.divider),s.uniform1f(f.contentMode,i.contentMode==="animation"?1:0),s.uniform1f(f.originalView,i.original?1:0),s.uniform2f(f.colorSettings,(i.saturation??100)/100,(i.brightness??100)/100),s.drawArrays(s.TRIANGLES,0,3)},a=!i.original&&i.engine==="balanced"&&i.denoise>0;a&&n(0,this.textures[0],this.textures[1],t.source.width,t.source.height),!i.original&&i.upscale!==!1&&n(1,this.textures[a?1:0],this.textures[2],t.output.width,t.output.height),this.pendingPresent=()=>n(2,this.textures[i.upscale===!1?a?1:0:2],null,t.output.width,t.output.height);const o=s.getError();if(o!==s.NO_ERROR)throw new Error(`WebGL rendering error 0x${o.toString(16)}`);const d=performance.now()-r;return await this.waitGPU(r),{cpuSubmitMs:d,latencyMs:performance.now()-r,gpuMs:null}}async present(){if(this.dead||!this.pendingPresent)throw new Error("No completed WebGL frame to present.");const e=performance.now();this.pendingPresent();const t=performance.now()-e,i=this.gl.getError();if(i!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${i.toString(16)}`);return await this.waitGPU(e),t}async waitGPU(e){const t=this.gl,i=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0);if(t.flush(),!i)throw new Error("GPU synchronization unavailable.");try{await new Promise((r,s)=>{let n=0;this.cancelWait=()=>s(new Error("WebGL engine destroyed during GPU work."));const a=()=>{if(this.dead||t.isContextLost()){s(new Error("WebGL context unavailable."));return}const o=t.clientWaitSync(i,0,0);o===t.ALREADY_SIGNALED||o===t.CONDITION_SATISFIED?r():o===t.WAIT_FAILED||performance.now()-e>1200?s(new Error("GPU completion timed out.")):++n%8===0?this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0):this.completionChannel.port1.postMessage(0)};this.completionPoll=a,a()})}finally{this.completionPoll=void 0,this.cancelWait=void 0,clearTimeout(this.pollTimer),t.deleteSync(i)}}destroy(){if(this.dead)return;this.dead=!0;const e=this.gl;this.cancelWait?.(),clearTimeout(this.pollTimer),this.completionChannel.port1.close(),this.completionChannel.port2.close(),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.textures.forEach(t=>e.deleteTexture(t)),this.programs.forEach(t=>e.deleteProgram(t)),e.deleteFramebuffer(this.fb),e.deleteVertexArray(this.vao),e.getExtension("WEBGL_lose_context")?.loseContext()}}async function ee(c,e,t,i){let r="";if(t!=="webgl2"){const n=c();try{return{engine:await R.create(n,e,i?.webgpu),canvas:n,reason:r}}catch(a){if(n.remove(),r=a instanceof Error?a.message:String(a),t==="webgpu")throw a}}const s=c();try{return{engine:new Fe(s,e,i?.webgl),canvas:s,reason:r}}catch(n){throw s.remove(),new Error(`${r?`WebGPU: ${r}. `:""}WebGL2: ${n instanceof Error?n.message:String(n)}`)}}const ke={eco:{engine:"fast",sharpness:.55,denoise:0,budget:.5},balanced:{engine:"balanced",sharpness:.8,denoise:.7,budget:.65},quality:{engine:"balanced",sharpness:1,denoise:1,budget:.8}},Tt={windowMs:2200,cooldownMs:5e3,promoteWindows:2,demoteWindows:2,low:.46,high:.9,maxMiss:.15};class kt{constructor(e=Tt){this.config=e}config;profile="eco";workload=1;ema=0;start=0;lastChange=-1/0;count=0;misses=0;good=0;bad=0;warmup=0;reset(e=performance.now()){this.profile="eco",this.workload=1,this.ema=0,this.start=e,this.lastChange=-1/0,this.count=this.misses=this.good=this.bad=this.warmup=0}sample(e,t,i,r){if(this.warmup++<6)return!1;const s=e/Math.max(4,t*ke[this.profile].budget);if(this.ema=this.count===0&&this.ema===0?s:.12*s+.88*this.ema,this.count++,i&&this.misses++,r-this.start<this.config.windowMs||this.count<12)return!1;const n=this.misses/this.count;if(this.bad=this.ema>this.config.high||n>this.config.maxMiss?this.bad+1:0,this.good=this.ema<this.config.low&&n<.03?this.good+1:0,this.start=r,this.count=this.misses=0,r-this.lastChange<this.config.cooldownMs)return!1;const a=["eco","balanced","quality"];let o=a.indexOf(this.profile),d=!1;return this.bad>=this.config.demoteWindows?(o>0?this.profile=a[--o]:this.workload=Math.max(.4,this.workload*.8),d=!0):this.good>=this.config.promoteWindows&&(this.workload<1?(this.workload=Math.min(1,this.workload/.8),d=!0):o<a.length-1&&(this.profile=a[++o],d=!0)),d&&(this.lastChange=r,this.bad=this.good=0),d}options(e){const t=e.profile==="ultra"||e.engine==="anime4k"||e.engine==="neural",i=e.adaptive?this.profile:e.profile==="ultra"?"quality":e.profile,r=ke[i];return{profile:i,unavailable:t,options:{engine:e.engine==="fast"||e.engine==="balanced"?e.engine:r.engine,sharpness:e.sharpness/100*(e.automaticStrength?r.sharpness:1),denoise:e.denoise/100*(e.automaticStrength?r.denoise:1),comparison:e.comparison,divider:e.divider,contentMode:e.contentMode,original:e.original||e.comparison&&e.divider>=1,saturation:e.saturation,brightness:e.brightness}}}}const Gt={"720p":{height:720,maxSource:480},"1080p":{height:1080,maxSource:720},"1440p":{height:1440,maxSource:1080},"2160p":{height:2160,maxSource:1440}};function Be(c,e,t,i,r=8192,s=8294400,n=1,a=null,o=!1,d=c.height){const l=i==="original"?null:Gt[i],u=!!l&&d<=l.maxSource&&c.height<l.height,h=u?{width:Math.round(c.width*l.height/c.height),height:l.height}:{...c},p=c.width*c.height*(o?20:8),g=(o?256:224)*1024*1024,b=Math.max(0,(g-p-(o?4*1024*1024:0))/8),f=u?Math.max(c.width/h.width,n):1,v=Math.min(f,r/h.width,r/h.height,Math.sqrt(Math.min(s,b)/(h.width*h.height)));if(!u&&v<.999)throw new Error("원본 해상도가 GPU 텍스처 또는 메모리 한도를 초과하여 원본 플레이어로 복귀합니다.");const x={width:Math.max(1,Math.floor(h.width*v)),height:Math.max(1,Math.floor(h.height*v))};return{source:{...c},processing:{...x},output:x,requested:h,display:{width:Math.round(e.width*t),height:Math.round(e.height*t)},css:e,screen:a,eligible:u,limited:v<.98,estimatedBytes:p+x.width*x.height*8+(o?4*1024*1024:0),resolutionReason:i==="original"?"원본 해상도: 업스케일링을 생략합니다.":u?v<.98?"GPU 성능·메모리 한도로 실제 처리 해상도를 낮췄습니다.":"선택한 목표 해상도로 GPU 재구성합니다.":"현재 원본에는 선택한 업스케일링 조건이 적용되지 않습니다."}}class Ut{metrics=je();intervalMs=1e3/30;previousMedia=null;previousFrames=0;outputs=[];frame(e,t,i,r){if(this.previousMedia!==null){const s=e-this.previousMedia,n=t-this.previousFrames;if(s>0&&s<1&&n>0&&n<120){const a=s*1e3/n;a>=4&&a<=500&&(this.intervalMs=this.intervalMs*.85+a*.15),this.metrics.sourceFPS=1e3/this.intervalMs}}this.previousMedia=e,this.previousFrames=t,this.metrics.latenessMs=Math.max(0,i-r)}discontinuity(){this.previousMedia=null,this.previousFrames=0,this.outputs=[],this.metrics.sourceFPS=null}complete(e,t,i){this.recordTiming(e),this.submission(t,i)}recordTiming(e){const t=(i,r)=>i===null?r:.15*r+.85*i;this.metrics.latencyMs=t(this.metrics.latencyMs,e.latencyMs),this.metrics.cpuSubmitMs=t(this.metrics.cpuSubmitMs,e.cpuSubmitMs),this.metrics.gpuMs=e.gpuMs===null?null:t(this.metrics.gpuMs,e.gpuMs)}submission(e,t){if(e)for(this.outputs.push(t);this.outputs.length>0&&t-this.outputs[0]>=2e3;)this.outputs.shift()}snapshot(e=performance.now()){return this.outputs=this.outputs.filter(t=>e-t<2e3),this.metrics.processedFPS=this.outputs.length<2?0:(this.outputs.length-1)*1e3/Math.max(1,e-this.outputs[0]),{...this.metrics}}}class Rt{changes;start;constructor(e=performance.now()){this.start=e,this.changes=[{at:e,visible:!1}]}set(e,t=performance.now()){this.changes[this.changes.length-1].visible!==e&&this.changes.push({at:t,visible:e}),this.trim(t)}trim(e){for(;this.changes.length>1&&this.changes[1].at<=e-2e3;)this.changes.shift()}percent(e=performance.now()){this.trim(e);const t=Math.max(this.start,e-2e3);let i=0;for(let r=0;r<this.changes.length;r++)this.changes[r].visible&&(i+=Math.max(0,(this.changes[r+1]?.at??e)-Math.max(t,this.changes[r].at)));return e>t?i/(e-t)*100:0}}class _t{constructor(e,t,i,r){this.video=e,this.process=t,this.skip=i,this.error=r}video;process;skip;error;callback=0;running=!1;busy=!1;revision=0;lastTime=-1;refreshPending=!1;start(){this.running||(this.running=!0,this.schedule())}schedule(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{this.callback=0,this.schedule(),t.mediaTime!==this.lastTime&&(this.lastTime=t.mediaTime,this.dispatch(t))}))}refresh(){this.running&&this.video.readyState>=2&&this.dispatch(null)}invalidate(){this.revision++,this.lastTime=-1}dispatch(e){const t=++this.revision;if(this.busy){(!e||this.video.paused)&&(this.refreshPending=!0),this.skip();return}this.busy=!0,this.process({metadata:e,current:()=>this.running&&t===this.revision}).catch(i=>{this.running&&this.error(i)}).finally(()=>{this.busy=!1,this.refreshPending&&this.running&&(this.refreshPending=!1,this.refresh())})}stop(){this.running=!1,this.refreshPending=!1,this.invalidate(),this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.callback=0}}class At{constructor(e,t,i){this.video=e,this.moveDivider=i,this.canvas=t,this.parent=e.parentElement,getComputedStyle(this.parent).position==="static"&&(this.originalPosition=this.parent.style.position,this.parent.style.position="relative"),t.className="clarity-gpu-overlay";const r=Number.parseInt(getComputedStyle(e).zIndex,10);Object.assign(t.style,{position:"absolute",pointerEvents:"none",zIndex:String(Number.isFinite(r)?r+1:1),display:"none",maxWidth:"none",maxHeight:"none",filter:"none",opacity:"1",transform:"none"}),t.setAttribute("aria-hidden","true"),this.parent.append(t),this.line=document.createElement("div"),this.handle=document.createElement("div"),Object.assign(this.line.style,{position:"absolute",display:"none",pointerEvents:"none",zIndex:String(Number.isFinite(r)?r+2:2),borderLeft:"1px solid rgba(255,255,255,.8)"}),Object.assign(this.handle.style,{position:"absolute",top:"12%",height:"65%",left:"-9px",width:"18px",pointerEvents:"auto",cursor:"ew-resize",touchAction:"none"}),this.handle.role="slider",this.handle.tabIndex=0,this.handle.setAttribute("aria-label","원본과 보정 영상 비교 경계"),this.handle.setAttribute("aria-valuemin","0"),this.handle.setAttribute("aria-valuemax","100"),this.line.append(this.handle),this.parent.append(this.line);const s=n=>{const a=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(n-a.left)/a.width)),this.moveDivider(this.divider),this.align()};this.handle.addEventListener("pointerdown",n=>{n.stopPropagation(),n.preventDefault(),this.handle.setPointerCapture(n.pointerId),s(n.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("pointermove",n=>{this.handle.hasPointerCapture(n.pointerId)&&s(n.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("keydown",n=>{(n.key==="ArrowLeft"||n.key==="ArrowRight")&&(n.preventDefault(),n.stopPropagation(),this.divider=Math.max(.02,Math.min(.98,this.divider+(n.key==="ArrowLeft"?-.02:.02))),this.moveDivider(this.divider),this.align())},{signal:this.abort.signal}),this.align()}video;moveDivider;canvas;line;handle;parent;abort=new AbortController;originalPosition=null;visible=!1;comparing=!1;divider=.5;css={width:1,height:1};get displayed(){return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=="none"}align(){const e=this.video.getBoundingClientRect(),t=this.parent.getBoundingClientRect(),i=this.parent.offsetWidth>0&&t.width>0?t.width/this.parent.offsetWidth:1,r=this.parent.offsetHeight>0&&t.height>0?t.height/this.parent.offsetHeight:1,s=this.video.videoWidth||e.width,n=this.video.videoHeight||e.height,a=Math.min(e.width/s,e.height/n),o=s*a,d=n*a,l=(e.left-t.left+(e.width-o)/2)/Math.max(.01,i)+this.parent.scrollLeft-this.parent.clientLeft,u=(e.top-t.top+(e.height-d)/2)/Math.max(.01,r)+this.parent.scrollTop-this.parent.clientTop;return this.css={width:o/Math.max(.01,i),height:d/Math.max(.01,r)},Object.assign(this.canvas.style,{left:`${l}px`,top:`${u}px`,width:`${this.css.width}px`,height:`${this.css.height}px`}),Object.assign(this.line.style,{left:`${l+this.css.width*this.divider}px`,top:`${u}px`,height:`${this.css.height}px`}),this.handle.setAttribute("aria-valuenow",String(Math.round(this.divider*100))),{width:o,height:d}}compare(e,t){e===this.comparing&&t===this.divider||(this.comparing=e,this.divider=t,this.align(),this.line.style.display=this.visible&&e?"block":"none")}show(){this.visible=!0,this.canvas.style.display="block",this.line.style.display=this.comparing?"block":"none"}hide(){this.visible=!1,this.canvas.style.display="none",this.line.style.display="none"}destroy(){this.hide(),this.abort.abort(),this.canvas.remove(),this.line.remove(),this.originalPosition!==null&&(this.parent.style.position=this.originalPosition)}}const oe=45;class Lt{previous=0;intervals=[];hz=null;tick(e){if(this.previous){const t=e-this.previous;if(t>=4&&t<=50&&(this.intervals.push(t),this.intervals.length>40&&this.intervals.shift(),this.intervals.length>=10)){const i=[...this.intervals].sort((r,s)=>r-s);this.hz=1e3/i[Math.floor(i.length/2)]}}this.previous=e}reset(){this.previous=0,this.intervals=[],this.hz=null}}class Dt{intervals=[];add(e){e>=4&&e<=250&&(this.intervals.push(e),this.intervals.length>40&&this.intervals.shift())}get period(){if(!this.intervals.length)return null;const e=[...this.intervals].sort((t,i)=>t-i);return e[Math.floor(e.length/2)]}reset(){this.intervals=[]}}class Ft{offsets=[];offset=0;rate=1;previous=-1;ready=!1;observe(e,t,i){const r=this.previous>=0&&(e<this.previous||i!==this.rate);r&&this.reset(),this.rate=i,this.previous=e,this.offsets.push(e*1e3-t*i),this.offsets.length>24&&this.offsets.shift();const s=[...this.offsets].sort((n,a)=>n-a);return this.offset=s[Math.floor(s.length/2)],this.ready=this.offsets.length>=2,r}mediaAt(e){return(e*this.rate+this.offset)/1e3}reset(){this.offsets=[],this.offset=0,this.previous=-1,this.ready=!1}}function Bt(c,e,t,i){if(t<4||t>oe||!c.length)return null;const r=e-t*i/1e3,s=c.find(a=>r>=a.a-.001&&r<=a.b+.001)??(r>c[c.length-1].b?c[c.length-1]:void 0);if(!s)return null;const n=s.sceneCut||!s.dynamic?1:Math.max(0,Math.min(1,(r-s.a)/(s.b-s.a)));return{pair:s,plan:{alpha:n,mediaTime:s.a+(s.b-s.a)*n,delayMs:t,generated:n>.001&&n<.999}}}class zt{next=0;fps=0;due(e,t){if(this.fps!==t&&(this.fps=t,this.next=e),e+.1<this.next)return!1;const i=1e3/t;return this.next+=(Math.max(0,Math.floor((e-this.next)/i))+1)*i,!0}reset(){this.next=0,this.fps=0}}class qt{tier=1;scale=1;frequency=1;allowSpatial=!1;ema=0;count=0;misses=0;start=0;last=-1/0;bad=0;good=0;sample(e,t,i,r,s){s&&(this.ema=this.ema===0?e/t:this.ema*.9+e/t*.1,this.count++,i&&this.misses++,!(r-this.start<2e3||this.count<24)&&(this.bad=this.ema>.9||this.misses/this.count>.15?this.bad+1:0,this.good=this.ema<.45&&this.misses===0?this.good+1:0,this.start=r,this.count=this.misses=0,!(r-this.last<4e3)&&(this.bad>=2?(this.tier>0?this.tier--:this.scale>.51?this.scale*=.75:this.allowSpatial?this.frequency=Math.max(.4,this.frequency*.8):this.allowSpatial=!0,this.last=r,this.bad=this.good=0):this.good>=3&&(this.frequency<1?this.frequency=Math.min(1,this.frequency/.8):this.allowSpatial?this.allowSpatial=!1:this.scale<1?this.scale=Math.min(1,this.scale/.75):this.tier<2&&this.tier++,this.last=r,this.bad=this.good=0))))}get config(){return{tier:this.tier,width:Math.max(96,Math.round(256*this.scale))}}}class It{constructor(e,t,i){this.video=e,this.engine=t,this.hooks=i,this.stats.state="warming",this.stats.reason="연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.",this.stats.engine="WebGPU 양방향 블록 움직임 추정"}video;engine;hooks;budget=new qt;clock=new Lt;stats=Re();lastRaf=0;lastRvfc=0;busyStarted=0;callback=0;raf=0;running=!1;busy=!1;revision=0;pending=null;still=!1;pair;lastKey="";lastSource=-1;previousSource=null;sourcePeriod=0;disabled=!1;estimatedMs=3;submissions=[];generated=[];signatures=[];sceneKey="";began=performance.now();poorSince=0;recoveryUntil=0;resetPending=!1;submittedAt=0;outputIntervalMs=1e3/60;cadence=new Dt;presentation=new Ft;pacer=new zt;expired(e){const t=performance.now(),i=this.outputIntervalMs+1e3/(this.clock.hz??60)+1;return!this.presentation.ready||t-this.submittedAt>i||(this.presentation.mediaAt(t)-e)*1e3/this.video.playbackRate>oe+i}resetMotion(){this.busy?this.resetPending=!0:(this.engine.resetTemporal(),this.resetPending=!1)}finished(){m.elapsed("serialBusyMs",this.busyStarted),this.busy=!1,this.stats.queueDepth=0,this.resetPending&&this.resetMotion(),this.drain()}start(){this.running||(this.engine.onStreamAvailable=()=>this.drain(),this.running=!0,this.requestSource(),!this.video.paused&&!document.hidden?this.requestOutput():this.requestStill())}requestSource(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{if(this.lastRvfc&&m.sample("rvfcIntervalMs",e-this.lastRvfc),this.lastRvfc=e,m.count("rvfcCallbacks"),this.callback=0,this.requestSource(),!(document.hidden||this.video.seeking||t.mediaTime===this.lastSource)){this.presentation.observe(t.mediaTime,t.expectedDisplayTime,this.video.playbackRate)&&(this.invalidate(),this.presentation.observe(t.mediaTime,t.expectedDisplayTime,this.video.playbackRate)),this.lastSource=t.mediaTime,this.stats.sourceFrames++,this.hooks.observe(t,e),this.previousSource!==null&&t.mediaTime>this.previousSource&&(this.sourcePeriod=(t.mediaTime-this.previousSource)*1e3/this.video.playbackRate),this.previousSource=t.mediaTime,this.cadence.add(this.sourcePeriod),this.hooks.settings().adaptive&&this.sourcePeriod>0&&e-this.began>5e3&&e>this.recoveryUntil&&(this.trim(e),(this.submissions.length<2?0:(this.submissions.length-1)*1e3/Math.max(1,e-this.submissions[0]))<900/(this.cadence.period??this.sourcePeriod)?(this.poorSince||(this.poorSince=e),e-this.poorSince>3e3&&(this.recoveryUntil=e+1e4,this.poorSince=0,this.pair=void 0,this.resetMotion(),this.limited("보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다."))):this.poorSince=0);try{if(this.video.mediaKeys)throw new DOMException("보호된 영상은 프레임에 접근할 수 없습니다.","SecurityError");const i=m.mark(),r=new VideoFrame(this.video,{timestamp:Math.round(t.mediaTime*1e6)});m.elapsed("videoFrameAcquireCpuMs",i),this.pending&&(m.count("discard.sourceReplaced"),this.pending.frame.close(),this.stats.dropped++),this.pending={frame:r,meta:t},this.drain()}catch(i){this.hooks.fatal(i)}}}))}limited(e){this.stats.state="limited",this.stats.reason=e}async drain(){if(!this.running||this.busy||!this.engine.canCapture({width:this.video.videoWidth,height:this.video.videoHeight},this.budget.config))return;if(this.still){this.still=!1,this.busy=!0,this.busyStarted=m.mark();const i=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&i===this.revision})}catch(r){this.hooks.fatal(r)}finally{this.finished()}return}if(!this.pending)return;const e=this.pending;this.pending=null,this.busy=!0,this.busyStarted=m.mark(),this.stats.queueDepth=1;const t=this.revision;try{const i=this.clock.hz??60,r=this.cadence.period??this.sourcePeriod,s=r>0&&1e3/r>=i*.98;if(this.disabled||performance.now()<this.recoveryUntil||this.hooks.settings().original||this.hooks.settings().comparison||r>oe||s||this.video.paused){!this.disabled&&performance.now()>=this.recoveryUntil&&this.limited(this.hooks.settings().original||this.hooks.settings().comparison?"동일 원본 프레임 비교를 위해 보간을 생략합니다.":r>oe?"한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.":s?"브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.":"일시정지 상태입니다."),await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision});return}let n=0;const a=new Promise((d,l)=>{n=window.setTimeout(()=>l(new Error("움직임 추정 GPU 응답 시간 초과")),1500)});let o;try{o=await Promise.race([this.engine.enqueueFrame(e.frame,{width:e.frame.displayWidth,height:e.frame.displayHeight},e.meta.mediaTime,this.budget.config),a])}finally{clearTimeout(n)}if(!this.running||t!==this.revision)return;this.pair={...o},this.stats.flowMs=o.flowMs,this.stats.flowSize=o.flowSize,this.stats.confidence=o.confidence,o.analysis?.then(d=>{!this.running||t!==this.revision||(d.sceneCut&&this.sceneKey!==String(o.id)&&(this.sceneKey=String(o.id),this.stats.sceneCuts++,m.count("sceneCuts")),this.pair?.b===o.b&&(Object.assign(this.pair,d,{flowMs:o.flowMs}),this.stats.flowMs=o.flowMs,this.stats.confidence=d.confidence))}),o.sceneCut&&this.sceneKey!==String(o.b)&&(m.count("sceneCuts"),this.stats.sceneCuts++,this.sceneKey=String(o.b)),o.ready||await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision})}catch(i){if(!this.running)return;if(i instanceof Error&&i.message.includes("응답 시간 초과")){this.hooks.fatal(i);return}if(m.count("discard.gpuError"),i instanceof DOMException&&i.name==="SecurityError"){this.hooks.fatal(i);return}this.disabled=!0,this.stats.state="error",this.stats.reason="프레임 보간에 실패하여 공간·색상 보정만 유지합니다: "+String(i),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason)}finally{e.frame.close(),this.finished()}}requestOutput(){!this.running||this.disabled||this.video.paused||document.hidden||(this.raf=requestAnimationFrame(e=>{this.raf=0,this.tick(e),this.requestOutput()}))}tick(e){this.lastRaf&&m.sample("rafIntervalMs",e-this.lastRaf),this.lastRaf=e,m.count("rafCallbacks"),this.clock.tick(e),this.stats.refreshHz=this.clock.hz,this.drain();const t=this.hooks.settings(),i=Number(t.targetFPS);if(this.stats.requestedFPS=i,t.original||t.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.presentation.ready||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden)return;const r=Math.min(i,this.clock.hz??60)*this.budget.frequency,s=1e3/r;if(this.outputIntervalMs=s,!this.pacer.due(e,r))return;if(m.count("outputAttempts"),this.busy||this.pending){m.count("discard.queueBusy"),this.stats.dropped++;return}if(!this.engine.canStream){m.count("discard.gpuBackpressure"),this.budget.sample(s*2,s,!0,performance.now(),t.adaptive);return}const n=this.presentation.mediaAt(e),a=this.cadence.period??this.sourcePeriod,o=Bt(this.engine.temporalPairs(),n,a,this.video.playbackRate);if(!o){m.count("discard.planUnavailable"),this.limited("표시 시간에 맞는 원본 프레임 쌍을 기다립니다.");return}const{pair:d,plan:l}=o;m.sample("timeline.nativeOffsetMs",(this.video.currentTime-this.presentation.mediaAt(performance.now()))*1e3/this.video.playbackRate),m.sample("timeline.currentMinusPairBMs",(this.video.currentTime-d.b)*1e3/this.video.playbackRate);const u=`${d.b}:${l.alpha.toFixed(5)}`;if(u===this.lastKey){m.count("duplicateEndpoint");return}this.lastKey=u;const h=this.revision;this.busy=!0,this.busyStarted=m.mark(),this.stats.queueDepth=1;const p=e+Math.max(4,1e3/(this.clock.hz??60));let g=!1;const b=()=>{const f=m.mark(),v=performance.now(),x=(this.presentation.mediaAt(v)-l.mediaTime)*1e3/this.video.playbackRate,w=(this.video.currentTime-this.presentation.mediaAt(v))*1e3/this.video.playbackRate,M=!this.running||h!==this.revision?"invalidated":this.video.seeking?"seek":document.hidden?"hidden":v>p?"submitDeadline":w>Math.max(45,a*2)||w<-a?"clockDiscontinuity":(this.video.currentTime-l.mediaTime)*1e3/this.video.playbackRate>100?"totalMediaSkew":x<-2?"tooEarly":x>oe?"tooLate":null,E=M===null;return M&&!g&&(g=!0,m.count("discard."+M)),m.elapsed("validityCpuMs",f),E};this.hooks.output({plan:l,pair:d,intervalMs:s,current:b}).then(f=>{const v=x=>{this.running&&h===this.revision&&this.budget.sample(x+d.flowMs*Math.min(1,1e3/Math.max(1,this.sourcePeriod)/r),s,!f,performance.now(),t.adaptive)};if(f?.completion?f.completion.then(x=>v(x+f.cpuSubmitMs)):v(f?.latencyMs??this.estimatedMs*1.5),!f||!this.running||h!==this.revision){this.running&&h===this.revision&&this.lastKey===u&&(this.lastKey="");return}this.estimatedMs=this.estimatedMs*.8+f.latencyMs*.2,f.completion?f.completion.then(x=>{this.running&&h===this.revision&&(this.stats.totalMs=x+f.cpuSubmitMs)}):this.stats.totalMs=f.latencyMs,this.stats.interpolationMs=null,this.stats.upscaleMs=null,this.stats.delayMs=(this.video.currentTime-l.mediaTime)*1e3/this.video.playbackRate,this.stats.additionalDelayMs=(this.presentation.mediaAt(performance.now())-l.mediaTime)*1e3/this.video.playbackRate,this.stats.nativeOffsetMs=this.stats.delayMs-this.stats.additionalDelayMs,m.sample("timeline.totalMediaSkewMs",this.stats.delayMs),m.sample("timeline.additionalDelayMs",(this.presentation.mediaAt(performance.now())-l.mediaTime)*1e3/this.video.playbackRate),(this.clock.hz??60)<i*.98?this.limited("목표 "+i+"FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요."):(this.stats.state="active",this.stats.reason="시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다.")}).catch(f=>{this.running&&(this.disabled=!0,this.stats.state="error",this.stats.reason="보간 출력 오류로 공간·색상 보정만 유지합니다: "+String(f),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason))}).finally(()=>this.finished())}submittedFrame(e,t){const i=performance.now();this.submittedAt=i,m.count("submitted"),this.submissions.push(i),this.stats.submitted++;const r=(s,n)=>{this.running&&(n&&m.count("skip.sceneCut"),s||m.count("skip.static"),e&&s&&!n?(m.count("generatedSubmitted"),this.generated.push(i),this.stats.generated++):m.count("nativeSubmitted"))};e&&t?.analysisAvailable===!1?m.count("unclassifiedGenerated"):t?.analysis?t.analysis.then(s=>r(s.dynamic,s.sceneCut)):r(t?.dynamic??!1,t?.sceneCut??!1),this.engine.lastSignature&&this.signatures.push({time:i,hash:this.engine.lastSignature}),this.trim(i)}trim(e){for(;this.submissions.length&&e-this.submissions[0]>=2e3;)this.submissions.shift();for(;this.generated.length&&e-this.generated[0]>=2e3;)this.generated.shift();for(;this.signatures.length&&e-this.signatures[0].time>=2e3;)this.signatures.shift()}snapshot(){const e=performance.now();this.trim(e);const t=s=>s.length<2?0:(s.length-1)*1e3/Math.max(1,e-s[0]),i=t(this.submissions),r=this.stats.state==="active"&&this.submissions.length>20&&i<Math.min(Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return{...this.stats,...r?{state:"limited",reason:"처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요."}:{},signatureSampled:m.enabled&&m.signatures,submittedFPS:i,generatedFPS:t(this.generated),uniqueSamples:new Set(this.signatures.map(s=>s.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null}}invalidate(){m.count("bufferResets"),this.revision++,this.pending?.frame.close(),this.pending=null,this.pair=void 0,this.previousSource=null,this.lastSource=-1,this.resetMotion(),this.lastKey="",this.pacer.reset(),this.presentation.reset(),this.cadence.reset()}invalidateOutput(){this.revision++,this.lastKey=""}requestStill(){this.still=!0,this.drain()}playbackChanged(){this.invalidate(),this.still=!1,this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.clock.reset(),this.video.paused?this.requestStill():this.requestOutput()}visibilityChanged(){this.playbackChanged()}destroy(){this.running&&(this.running=!1,this.revision++,this.pending?.frame.close(),this.pending=null,this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.raf&&cancelAnimationFrame(this.raf),this.callback=this.raf=0,this.engine.onStreamAvailable=void 0)}}function Ot(c){const e=c instanceof Error?c.message:String(c);return{status:c instanceof DOMException&&c.name==="SecurityError"||/origin.clean|cross.origin|taint|protected|DRM/i.test(e)?"Video Access Restricted":"Rendering Error",reason:e}}class Wt{constructor(e,t,i,r){this.video=e,this.settings=t,this.persistDivider=i,this.preferredBackend=r,this.resize=new ResizeObserver(()=>this.onResize()),this.resize.observe(e);const s=this.abort.signal;for(const n of["seeking","waiting","emptied","loadstart"])e.addEventListener(n,()=>{this.invalidate("Original Video Fallback","Waiting for a fresh decoded frame."),this.monitor.discontinuity()},{signal:s});for(const n of["loadeddata","seeked","playing","pause","ratechange","loadedmetadata"])e.addEventListener(n,()=>{(n==="loadedmetadata"||n==="loadeddata")&&(this.probed=!1,!this.engine&&!this.starting&&this.initialize()),n==="ratechange"&&this.monitor.discontinuity(),["playing","pause","ratechange","seeked","loadedmetadata"].includes(n)&&this.temporal?.playbackChanged(),this.video.paused&&this.scheduler?.refresh()},{signal:s});e.addEventListener("resize",()=>{this.probed=!1,this.invalidate("Original Video Fallback","원본 해상도가 변경되어 프레임 버퍼를 초기화합니다."),e.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},{signal:s}),document.addEventListener("visibilitychange",()=>{this.invalidate("Original Video Fallback",document.hidden?"Suspended while the tab is hidden.":"Resuming from original video."),document.hidden?this.scheduler?.stop():(this.scheduler?.start(),this.video.paused&&this.scheduler?.refresh()),this.temporal?.visibilityChanged()},{signal:s}),document.addEventListener("fullscreenchange",()=>this.onResize(),{signal:s}),window.addEventListener("resize",()=>this.onResize(),{signal:s}),this.watchdog=window.setInterval(()=>{if(this.dead)return;if(this.engine instanceof R&&this.engine.stalled()){this.lost("WebGPU 보간 처리 응답 시간이 초과되어 원본 재생으로 복구합니다.");return}devicePixelRatio!==this.lastDpr&&(this.lastDpr=devicePixelRatio,this.onResize());const n=this.temporalMediaTime!==null&&!!this.temporal?.expired(this.temporalMediaTime);!e.paused&&this.lastPresented&&(n||performance.now()-this.frameStarted>Math.max(40,Math.min(250,this.monitor.intervalMs/e.playbackRate*1.5+10)))&&(this.hide(),this.lastPresented=0,this.setState("Original Video Fallback","처리 화면이 오래되어 새 결과가 도착할 때까지 원본 재생을 표시합니다."))},20)}video;settings;persistDivider;preferredBackend;engine;overlay;scheduler;abort=new AbortController;resize;monitor=new Ut;adaptive=new kt;status="Initializing";reason="Waiting for an accessible video frame.";dimensions=null;dead=!1;generation=0;lastPresented=0;presented=0;probed=!1;watchdog=0;resizeTimer=0;recoveryTimer=0;recoveries=0;lastDpr=devicePixelRatio;backendReason="";starting=!1;effectiveSharpness=0;effectiveDenoise=0;currentEngine="—";visibility=new Rt;frameStarted=0;outputKey="";temporal;restartPending=!1;submissionTimes=[];totalSubmissions=0;decodedHeight=0;temporalMediaTime=null;async start(){await this.initialize()}async initialize(e){if(this.dead||this.starting||!this.settings.enabled)return;this.starting=!0;const t=++this.generation;this.setState("Initializing","Initializing local GPU processing.");try{const i=await ee(()=>document.createElement("canvas"),r=>this.lost(r),e??this.preferredBackend);if(this.dead||t!==this.generation){i.engine.destroy();return}this.engine=i.engine,this.backendReason=i.reason,this.overlay=new At(this.video,i.canvas,r=>{this.settings={...this.settings,divider:r},this.persistDivider?.(r),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}),this.adaptive.reset(),this.probed=!1,this.settings.targetFPS!=="original"&&i.engine instanceof R?(this.temporal=new It(this.video,i.engine,{settings:()=>this.settings,observe:(r,s)=>{this.decodedHeight=r.height,this.monitor.frame(r.mediaTime,r.presentedFrames,s,r.expectedDisplayTime)},spatial:async r=>{await this.process(r)},output:r=>this.process({metadata:null,current:r.current},r),hide:r=>{this.hide(),this.setState("Performance Limited",r)},fatal:r=>this.fail(r)}),this.temporal.start()):(this.scheduler=new _t(this.video,async r=>{await this.process(r)},()=>{this.monitor.metrics.skippedFrames++,this.monitor.metrics.missedDeadlines++,this.hide(),this.setState("Performance Limited","Newer source frame arrived; discarding outdated output.")},r=>this.fail(r)),document.hidden||(this.scheduler.start(),this.video.paused&&this.scheduler.refresh()))}catch(i){!this.dead&&t===this.generation&&(this.releaseGPU(),this.setState("Unsupported GPU",i instanceof Error?i.message:String(i)))}finally{this.starting=!1,this.restartPending&&!this.dead&&(this.restartPending=!1,this.initialize())}}probe(){if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");const e=document.createElement("canvas");e.width=e.height=1;const t=e.getContext("2d",{willReadFrequently:!0});if(!t)throw new Error("Cannot validate source pixel access.");t.drawImage(this.video,0,0,1,1),t.getImageData(0,0,1,1),this.probed=!0}async process(e,t){const i=this.engine,r=this.overlay;if(this.dead||!i||!r||document.hidden||this.video.readyState<2||this.video.seeking)return null;if(this.video.closest(".ad-showing,.ad-interrupting"))return this.invalidate("Original Video Fallback","광고 중에는 원본 재생을 유지합니다."),null;if(this.video.videoWidth<1||this.video.videoHeight<1)return null;const s=this.generation;if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");this.probed||this.probe();const n=performance.now();e.metadata&&(this.decodedHeight=e.metadata.height,this.monitor.frame(e.metadata.mediaTime,e.metadata.presentedFrames,n,e.metadata.expectedDisplayTime));const a=this.adaptive.options(this.settings);this.currentEngine=a.options.engine,this.effectiveSharpness=a.options.sharpness*100,this.effectiveDenoise=a.options.engine==="fast"?0:a.options.denoise*100;const o=Be({width:this.video.videoWidth,height:this.video.videoHeight},r.align(),devicePixelRatio,this.settings.targetResolution,i.maxDimension,i.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)},!!this.temporal,this.decodedHeight||this.video.videoHeight);a.options.upscale=!!o.eligible&&o.output.width>o.source.width,this.dimensions=o,r.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);const d=`${o.source.width},${o.source.height},${o.output.width},${o.output.height}`;if(d!==this.outputKey&&(this.hide(),this.outputKey=d),r.displayed||this.setState("Original Video Fallback","Processing the latest frame; showing original playback."),this.monitor.metrics.queueDepth=1,t&&i instanceof R)try{if(!e.current())return null;const u=i.submitTemporal(o,a.options,t.plan.alpha,t.pair,e.current);if(!u)return m.count("discard.gpuBackpressure"),null;const h=performance.now();for(this.totalSubmissions++,this.submissionTimes.push(h);this.submissionTimes.length&&h-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();return this.temporal?.submittedFrame(t.plan.generated,t.pair),this.monitor.submission(!a.options.original,h),this.temporalMediaTime=t.plan.mediaTime,this.frameStarted=n,this.lastPresented=h,this.presented++,r.show(),this.visibility.set(!a.options.original),m.count("acceptedDisplay"),this.setState(a.unavailable?"Engine Unavailable":o.limited?"Performance Limited":"Active",a.unavailable?"선택한 처리 방식은 미지원이므로 지원되는 GPU 방식으로 처리합니다.":`${i.backend} processed frames are being presented.`),u.completion?.then(p=>{this.dead||s!==this.generation||(this.monitor.recordTiming({...u,latencyMs:p+u.cpuSubmitMs}),m.count("completedOutputs"),this.settings.adaptive&&this.temporal?.budget.allowSpatial&&!this.video.paused&&this.adaptive.sample(p+t.pair.flowMs*Math.min(1,t.intervalMs/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))),t.intervalMs,!1,performance.now()))}),u}finally{this.monitor.metrics.queueDepth=0}let l=0;try{const u=new Promise((x,w)=>{l=window.setTimeout(()=>w(new Error("GPU processing timed out; original playback restored.")),1500)}),h=await Promise.race([t&&i instanceof R?i.renderTemporal(o,a.options,t.plan.alpha):i.render(this.video,o,a.options),u]);if(this.dead||s!==this.generation)return null;const p=t?.intervalMs??this.monitor.intervalMs/Math.max(.1,this.video.playbackRate),g=m.mark();let b=!this.video.paused&&performance.now()-n>p*1.25||!e.current();if(!b&&!document.hidden&&!this.video.seeking){m.elapsed("readyToCanvasSubmitMs",g);const x=m.mark();for(h.cpuSubmitMs+=await Promise.race([i.present(),u]),m.elapsed("canvasPresentAwaitMs",x),this.totalSubmissions++,this.submissionTimes.push(performance.now());this.submissionTimes.length&&performance.now()-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();this.temporal?.submittedFrame(!!t?.plan.generated)}if(this.dead||s!==this.generation)return null;h.latencyMs=performance.now()-n,b=b||!this.video.paused&&h.latencyMs>p*1.25||!e.current();const f=!b&&!document.hidden&&!this.video.seeking;this.monitor.complete(h,f&&!a.options.original&&(e.metadata!==null||!!t||!!this.temporal&&!this.video.paused),performance.now()),b&&(m.count("discard.outputDeadline"),this.monitor.metrics.missedDeadlines++);const v=h.latencyMs+(t?t.pair.flowMs*Math.min(1,p/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))):0);return this.settings.adaptive&&!this.video.paused&&(e.metadata||e.sourceDriven||t&&(this.temporal?.budget.allowSpatial||v<p*.2))&&this.adaptive.sample(v,p,b,performance.now()),f?(m.count("acceptedDisplay"),this.temporalMediaTime=t?.plan.mediaTime??null,r.show(),this.visibility.set(!a.options.original),this.lastPresented=performance.now(),this.frameStarted=n,a.options.original||this.presented++,this.setState(a.options.original?"Original Comparison":a.unavailable?"Engine Unavailable":o.limited?"Performance Limited":"Active",a.options.original?"Showing the unenhanced acquired frame for comparison.":a.unavailable?"Requested engine/profile is unavailable; using "+a.options.engine+".":o.limited?"Output reduced to fit display, memory and measured processing limits.":`${i.backend} processed frames are being presented.${this.backendReason?" WebGPU unavailable; using WebGL2 fallback.":""}`)):(this.hide(),this.setState("Performance Limited","Processing missed its frame deadline; showing the original video.")),f?h:null}finally{clearTimeout(l),this.monitor.metrics.queueDepth=0}}onResize(){this.invalidate("Original Video Fallback","플레이어 크기에 맞춰 표시 위치를 조절합니다.",!1),clearTimeout(this.resizeTimer),this.resizeTimer=window.setTimeout(()=>{this.overlay?.align(),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},120)}setState(e,t){this.status=e,this.reason=t}hide(){this.overlay?.hide(),this.visibility.set(!1)}invalidate(e,t,i=!0){this.hide(),this.scheduler?.invalidate(),i?this.temporal?.invalidate():this.temporal?.invalidateOutput(),this.lastPresented=0,this.setState(e,t)}fail(e){if(this.dead)return;const t=Ot(e);this.monitor.metrics.failures++,this.invalidate(t.status,t.reason),this.releaseGPU()}lost(e){if(this.dead)return;const t=this.engine?.backend==="WebGPU";this.fail(new Error(e)),this.recoveries++<1&&(this.recoveryTimer=window.setTimeout(()=>{this.dead||this.initialize(t?"webgl2":void 0)},1e3))}releaseGPU(){this.generation++,this.temporal?.destroy(),this.temporal=void 0,this.scheduler?.stop(),this.scheduler=void 0,this.hide(),this.overlay?.destroy(),this.overlay=void 0,this.engine?.destroy(),this.engine=void 0,this.outputKey="",this.monitor.metrics.queueDepth=0}update(e){const t=e.adaptive!==this.settings.adaptive,i=e.targetFPS!==this.settings.targetFPS;if(this.settings=e,t&&this.adaptive.reset(),i){this.releaseGPU(),this.starting?this.restartPending=!0:this.initialize();return}this.invalidate("Original Video Fallback","설정을 GPU 처리에 적용합니다.",!1),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}stats(){const e=!!this.overlay?.displayed,t=this.monitor.snapshot();t.enhancedVisiblePercent=this.visibility.percent();const i=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0,r=this.dimensions?.eligible?this.currentEngine==="balanced"?`FSR1 EASU · ${this.settings.contentMode==="animation"?"애니메이션":"실사"}`:this.currentEngine==="fast"?"고속 경계선 재구성":"—":"원본 해상도 · 노이즈/색상 보정",s=this.settings.original||this.settings.comparison&&this.settings.divider>=1,n=this.temporal?.snapshot()??Re();return this.temporal||(n.submitted=this.totalSubmissions,n.submittedFPS=this.submissionTimes.length<2?0:(this.submissionTimes.length-1)*1e3/Math.max(1,performance.now()-this.submissionTimes[0]),this.settings.targetFPS!=="original"&&(n.requestedFPS=Number(this.settings.targetFPS),n.state="unsupported",n.reason="이 백엔드는 움직임 보간을 지원하지 않아 업스케일링·색상 보정만 유지합니다.")),{status:this.status,reason:this.reason,backend:this.engine?.backend??"—",engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics:t,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm:r,presentation:e?s?"original":this.settings.comparison?"split":"enhanced":"fallback",fallback:!e,upscalingActive:e&&!s&&i>1.01,scaleRatio:i,frameAgeMs:e?performance.now()-this.frameStarted:null,temporal:n}}destroy(){this.dead||(this.dead=!0,this.abort.abort(),this.resize.disconnect(),clearInterval(this.watchdog),clearTimeout(this.resizeTimer),clearTimeout(this.recoveryTimer),this.releaseGPU())}}async function ze(c){let e="";const{engine:t,canvas:i}=await ee(()=>document.createElement("canvas"),l=>{e=l},c),r=document.createElement("canvas");r.width=r.height=8;const s=r.getContext("2d"),n={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:!1},a={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5},o=[],d=async(l={})=>{await t.render(r,n,{...a,...l}),await t.present();const u=document.createElement("canvas");u.width=u.height=32;const h=u.getContext("2d",{willReadFrequently:!0});return h.drawImage(i,0,0),h.getImageData(0,0,32,32).data};try{for(const y of["fast","balanced"]){s.fillStyle="rgb(64,128,192)",s.fillRect(0,0,8,8);const P=await d({engine:y}),G=Math.max(...Array.from(P,(B,N)=>Math.abs(B-[64,128,192,255][N%4])));o.push({name:`${y}: constant field / color / alpha`,passed:G<=2,detail:`Maximum channel error ${G}/255`})}for(let y=0;y<8;y++)for(let P=0;P<8;P++){const G=20+P*28;s.fillStyle=`rgb(${G},${G},${G})`,s.fillRect(P,y,1,1)}const l=await d();let u=0;for(let y=6;y<26;y++)u=Math.max(u,Math.abs(l[(512+y)*4]-(20+((y+.5)/4-.5)*28)));o.push({name:"Balanced: linear-ramp reconstruction",passed:u<=3,detail:`Maximum interior error ${u.toFixed(2)}/255`}),s.fillStyle="black",s.fillRect(0,0,8,4),s.fillStyle="white",s.fillRect(0,4,8,4);const h=await d();o.push({name:"Video orientation preserved",passed:h[0]<3&&h[992*4]>252,detail:`Top ${h[0]}, bottom ${h[992*4]}`});for(let y=0;y<8;y++)for(let P=0;P<8;P++){const G=80+(P*17+y*13)%7*11;s.fillStyle=`rgb(${G},${G},${G})`,s.fillRect(P,y,1,1)}const p=await d(),g=await d({sharpness:1}),b=await d({denoise:1}),f=await d({engine:"fast"}),v=await d({sharpness:1,comparison:!0,divider:1}),x=(y,P)=>Array.from(y).reduce((G,B,N)=>G+Math.abs(B-P[N]),0);for(const[y,P]of[["Sharpening changes processed pixels",g],["Denoising changes processed pixels",b],["Fast and Balanced are distinct",f],["Comparison uses unenhanced pixels",v]]){const G=x(p,P);o.push({name:y,passed:G>0,detail:`Absolute channel difference ${G}`})}s.fillStyle="rgb(50,50,50)",s.fillRect(0,0,4,8),s.fillStyle="rgb(200,200,200)",s.fillRect(4,0,4,8);const w=await d({sharpness:1}),M=Math.min(...Array.from(w).filter((y,P)=>P%4!==3)),E=Math.max(...Array.from(w).filter((y,P)=>P%4!==3));if(o.push({name:"Step edge remains bounded (anti-ringing)",passed:M>=49&&E<=201,detail:`Range ${M}…${E}; source 50…200`}),e)throw new Error(e);return{backend:t.backend,checks:o}}finally{t.destroy(),i.remove()}}const $t=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,Nt=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,jt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5),1));
}
`,Vt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Xt=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,be=`
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
`,Yt=`#version 300 es
`+be+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c);float w=exp(-float(x*x+y*y)*.7-delta*delta/.0018);sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,settings.y*.7),1);}`,Ht=`#version 300 es
`+be+`
void main(){vec2 p=gl_FragCoord.xy*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{vec3 sum=vec3(0);float weight=0.;for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){float w=cubic(float(x)-f.x)*cubic(float(y)-f.y);sum+=pixel(inputTex,i+ivec2(x,y))*w;weight+=w;}color=vec4(clamp(sum/max(weight,.0001),lo,hi),1);}}
`,Kt=`#version 300 es
`+be+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
if(settings.w>.5&&gl_FragCoord.x/dims.z<divider)result=linearSample(originalTex,gl_FragCoord.xy*dims.xy/dims.zw-.5);
color=vec4(clamp(result,0.,1.),1);}`,Qt=Object.freeze(Object.defineProperty({__proto__:null,composite:Kt,denoise:Yt,upscale:Ht,vertex:Xt},Symbol.toStringTag,{value:"Module"}));function Jt(c,e,t,i,r,s=!1){const n=new Uint8ClampedArray(i*r*4),a=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]],o=(l,u)=>{const h=(Math.max(0,Math.min(t-1,u))*e+Math.max(0,Math.min(e-1,l)))*4;return[c[h]/255,c[h+1]/255,c[h+2]/255]},d=l=>l[1]+(l[0]+l[2])*.5;for(let l=0;l<r;l++)for(let u=0;u<i;u++){let h=(u+.5)*e/i-.5,p=(l+.5)*t/r-.5;Math.abs(h-Math.round(h))<1e-5&&(h=Math.round(h)),Math.abs(p-Math.round(p))<1e-5&&(p=Math.round(p));const g=Math.floor(h),b=Math.floor(p),f=h-g,v=p-b,x=a.map(([A,$])=>o(g+A,b+$)),[w,M,E,y,P,G,B,N,k,U,z,q]=x.map(d);let L=0,F=0,W=0;for(const[A,$,j,ie,se,Q]of[[w,G,P,U,y,(1-f)*(1-v)],[M,P,U,k,B,f*(1-v)],[P,E,y,B,q,(1-f)*v],[U,y,B,N,z,f*v]]){const re=ie-$,ne=se-A,ae=Math.min(1,Math.abs(re)/Math.max(Math.abs(ie-j),Math.abs(j-$),1e-6)),Y=Math.min(1,Math.abs(ne)/Math.max(Math.abs(se-j),Math.abs(j-A),1e-6));L+=re*Q,F+=ne*Q,W+=(ae*ae+Y*Y)*Q}const V=Math.hypot(L,F);V*V<1/32768?(L=1,F=0):(L/=V,F/=V);let te=(W*.5)**2;s&&(te=Math.min(1,te*1.2));const We=(L*L+F*F)/Math.max(Math.abs(L),Math.abs(F)),$e=1+(We-1)*te,Ne=1-.5*te,we=.5-.29*te,Se=[0,0,0];let Pe=0;for(let A=0;A<12;A++){const $=a[A][0]-f,j=a[A][1]-v,ie=($*L+j*F)*$e,se=(-$*F+j*L)*Ne,Q=Math.min(ie*ie+se*se,1/we),re=.4*Q-1,ne=we*Q-1,ae=(1.5625*re*re-.5625)*ne*ne;for(let Y=0;Y<3;Y++)Se[Y]+=x[A][Y]*ae;Pe+=ae}const Me=(l*i+u)*4;for(let A=0;A<3;A++){const $=[4,9,3,6].map(j=>x[j][A]);n[Me+A]=Math.round(Math.max(Math.min(...$),Math.min(Math.max(...$),Se[A]/Math.max(Pe,1e-6)))*255)}n[Me+3]=255}return n}const qe={webgpu:{common:$t,denoise:Nt,upscale:jt,composite:Vt},webgl:Qt};function he(c,e,t,i){return{source:{width:c,height:e},processing:{width:t,height:i},output:{width:t,height:i},display:{width:t,height:i},css:{width:t,height:i},screen:null,limited:!1}}const me={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,contentMode:"natural"},O=(c,e)=>Object.assign(document.createElement("canvas"),{width:c,height:e});function ce(c,e){let t=0,i=0;for(let s=0;s<c.length;s++)if(s%4!==3){const n=c[s]-e[s];t+=n*n,i+=Math.abs(n)}const r=c.length*3/4;return{psnr:t===0?99:10*Math.log10(65025/(t/r)),mae:i/r}}const Ge=c=>[...c].sort((e,t)=>e-t)[Math.floor(c.length/2)];async function Ie(c="webgpu"){const e=await ee(()=>O(1,1),()=>{},c,qe),t=await ee(()=>O(1,1),()=>{},c),i=async(r,s,n,a={})=>{await r.engine.render(s,n,{...me,...a}),await r.engine.present();const o=O(n.output.width,n.output.height),d=o.getContext("2d",{willReadFrequently:!0});return d.drawImage(r.canvas,0,0),{data:d.getImageData(0,0,o.width,o.height).data,png:o.toDataURL("image/png")}};try{const r=O(9,7),s=r.getContext("2d"),n=s.createImageData(9,7);for(let f=0;f<n.data.length;f++)n.data[f]=f%4===3?255:(f*73+f%11*31)%256;s.putImageData(n,0,0);const a=await i(t,r,he(9,7,23,19),{contentMode:"animation"}),o=Jt(n.data,9,7,23,19,!0),d=Math.max(...Array.from(o,(f,v)=>Math.abs(f-a.data[v]))),l=[];for(const f of["line-art","natural-texture","compressed-texture"]){const v=O(768,432),x=v.getContext("2d");if(f==="line-art"){x.fillStyle="#e4e8db",x.fillRect(0,0,768,432);for(let k=0;k<14;k++)x.strokeStyle=k%3?"#1d2834":"#537789",x.lineWidth=2+k%3*1.4,x.beginPath(),x.moveTo(15+k*51,45),x.lineTo(90+k*46,390),x.stroke();x.strokeStyle="#252b3e",x.lineWidth=3,x.beginPath(),x.ellipse(355,200,165,105,.25,0,Math.PI*2),x.stroke(),x.font="bold 28px sans-serif",x.fillStyle="#172b3b",x.fillText("Edge reconstruction 0123",30,35)}else{const k=x.createImageData(768,432);for(let U=0;U<432;U++)for(let z=0;z<768;z++){const q=(U*768+z)*4,L=18*Math.sin(z*.18+U*.07)+11*Math.sin(z*.055-U*.14),F=55*Math.tanh((z-300-U*.43)/3),W=125+L+F+15*Math.sin(U*.025);k.data[q]=W*.94,k.data[q+1]=W,k.data[q+2]=W*.84,k.data[q+3]=255}x.putImageData(k,0,0)}const w=x.getImageData(0,0,768,432).data,M=O(256,144),E=M.getContext("2d"),y=E.createImageData(256,144);for(let k=0;k<144;k++)for(let U=0;U<256;U++){const z=(k*256+U)*4;for(let q=0;q<3;q++){let L=0;for(let W=0;W<3;W++)for(let V=0;V<3;V++)L+=w[((k*3+W)*768+U*3+V)*4+q];const F=f==="compressed-texture"?((U*17+k*23)%13-6)*1.3:0;y.data[z+q]=L/9+F}y.data[z+3]=255}E.putImageData(y,0,0);const P=he(256,144,768,432),G=f==="line-art"?"animation":"natural",B=await i(e,M,P,{denoise:f==="compressed-texture"?.35:0}),N=await i(t,M,P,{denoise:f==="compressed-texture"?.35:0,contentMode:G});l.push({name:f,sharpness:0,baseline:ce(B.data,w),improved:ce(N.data,w),difference:ce(B.data,N.data).mae,images:{source:M.toDataURL(),truth:v.toDataURL(),baseline:B.png,improved:N.png}})}const u=O(640,360),h=u.getContext("2d");h.fillStyle="#9ab9ad",h.fillRect(0,0,640,360),h.fillStyle="#304857";for(let f=0;f<40;f++)h.fillRect(f*17,10,2,340);const p=he(640,360,1920,1080),g={baseline:[],improved:[]};for(let f=0;f<36;f++)for(const[v,x]of f%2?[["improved",t],["baseline",e]]:[["baseline",e],["improved",t]]){const w=performance.now();await x.engine.render(u,p,{...me,denoise:.2}),await x.engine.present(),f>=6&&g[v].push(performance.now()-w)}const b={source:"640×360",output:"1920×1080",samples:30,includes:"CPU + queue + GPU completion; not pure GPU timestamp",baselineMedianMs:Ge(g.baseline),improvedMedianMs:Ge(g.improved),baselineP95Ms:[...g.baseline].sort((f,v)=>f-v)[28],improvedP95Ms:[...g.improved].sort((f,v)=>f-v)[28]};return{backend:t.engine.backend,maxReferenceError:d,cases:l,benchmark:b}}finally{e.engine.destroy(),t.engine.destroy()}}async function Zt(c,e="webgpu"){const t=new Image;t.src=c,await t.decode();const i=O(t.width,t.height);i.getContext("2d").drawImage(t,0,0);const r=he(t.width,t.height,t.width*3,t.height*3),s=await ee(()=>O(1,1),()=>{},e,qe),n=await ee(()=>O(1,1),()=>{},e),a=O(r.output.width,r.output.height),o=a.getContext("2d",{willReadFrequently:!0}),d=async(l,u)=>(await l.engine.render(i,r,{...me,denoise:.2,contentMode:u}),await l.engine.present(),o.drawImage(l.canvas,0,0),{data:o.getImageData(0,0,a.width,a.height).data,png:a.toDataURL()});try{const l=await d(s,"natural"),u=await d(n,"natural"),h=await d(n,"animation");return{backend:n.engine.backend,source:r.source,output:r.output,sharpness:0,denoise:20,baselineToNaturalMAE:ce(l.data,u.data).mae,naturalToAnimationMAE:ce(u.data,h.data).mae,images:{baseline:l.png,natural:u.png,animation:h.png}}}finally{s.engine.destroy(),n.engine.destroy()}}const ei=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,ti=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,ii=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,si=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,H=(c,e)=>({source:{width:c,height:e},processing:{width:c,height:e},output:{width:c,height:e},display:{width:c,height:e},css:{width:c,height:e},screen:null,limited:!1}),_=(c,e)=>Object.assign(document.createElement("canvas"),{width:c,height:e}),K={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};async function ri(c,e,t,i,r){if(await c.render(t,i,r),await c.present(c instanceof R?"full":"none"),c instanceof R)return c.lastPixels;const s=_(i.output.width,i.output.height),n=s.getContext("2d");return n.drawImage(e,0,0),n.getImageData(0,0,s.width,s.height).data}async function ni(c="webgpu"){const e=_(1,1),t=c==="webgpu"?await R.create(e,()=>{}):new Fe(e,()=>{}),i=_(8,8),r=i.getContext("2d"),s=[];try{r.fillStyle="rgb(64,128,192)",r.fillRect(0,0,8,8);for(const n of["saturation","brightness"])for(const a of[0,50,100,150,200]){const o=await ri(t,e,i,H(8,8),{...K,[n]:a});s.push({control:n,value:a,rgb:Array.from(o.slice(0,3))})}return{backend:c,results:s}}finally{t.destroy()}}async function ai(){const c=_(1,1),e=await R.create(c,()=>{}),t=_(128,72),i=_(128,72);function r(s,n){const a=s.getContext("2d");a.fillStyle="#101010",a.fillRect(0,0,128,72),a.fillStyle="#eeeeee",a.fillRect(n,24,32,24)}try{r(t,24),r(i,32),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1});const s=await e.captureFrame(i,{width:128,height:72},1/24,{width:128,tier:1}),n=[];for(const o of[0,.25,.5,.75,1]){await e.renderTemporal(H(128,72),K,o),await e.present("full");const d=e.lastPixels;let l=0,u=0;for(let h=0;h<72;h++)for(let p=0;p<128;p++){const g=Math.max(0,d[(h*128+p)*4]-16);l+=(p+.5)*g,u+=g}n.push({phase:o,centroid:l/u,expected:40+8*o,signature:e.lastSignature})}i.getContext("2d").fillStyle="white",i.getContext("2d").fillRect(0,0,128,72);const a=await e.captureFrame(i,{width:128,height:72},2/24,{width:128,tier:1});return await e.renderTemporal(H(128,72),K,.5),await e.present("full"),{pair:s,results:n,sceneCut:a.sceneCut,cutPixel:Array.from(e.lastPixels.slice(0,3))}}finally{e.destroy()}}async function oi(){const c=_(1,1),e=await R.create(c,()=>{}),t=[];try{for(const[i,r]of[[480,"720p"],[720,"1080p"],[1080,"1440p"],[1440,"2160p"]]){const s=i*16/9,n=_(Math.round(s),i);n.getContext("2d").fillStyle="#4080c0",n.getContext("2d").fillRect(0,0,n.width,n.height);const a=Be({width:n.width,height:i},{width:400,height:225},1,r,e.maxDimension,e.maxPixels);await e.render(n,a,{...K,upscale:!0}),await e.present("pixel"),t.push({source:a.source,target:r,actual:{width:c.width,height:c.height},pixel:Array.from(e.lastPixels),estimatedBytes:a.estimatedBytes})}return t}finally{e.destroy()}}async function ci(){const c=_(1,1),e=await R.create(c,()=>{}),t=_(128,72),i=_(128,72),r=[],s=(a,o)=>{const d=a.getContext("2d");d.fillStyle="#101010",d.fillRect(0,0,128,72),d.fillStyle="#eeeeee",d.fillRect(o,24,32,24)};s(t,24),s(i,32);const n=a=>{const o=_(128,72);return o.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(a),128,72),0,0),o.toDataURL()};try{for(const a of[24,30,60])for(const o of[75,100,120]){e.resetTemporal(),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1}),await e.captureFrame(i,{width:128,height:72},1/a,{width:128,tier:1});const d=[];for(let l=0;l/o<=1/a+1e-6;l++){const u=l*a/o;await e.renderTemporal(H(128,72),K,u),await e.present("full");const h=e.lastPixels;let p=0,g=0,b=2166136261,f=0,v=0;for(let x=0;x<72;x++)for(let w=0;w<128;w++){const M=(x*128+w)*4,E=Math.max(0,h[M]-16);p+=(w+.5)*E,g+=E,b=Math.imul(b^h[M],16777619);const y=x>=24&&x<48&&w+.5>=24+8*u&&w+.5<56+8*u?238:16,P=16+(x>=24&&x<48?222*((w>=24&&w<56?1-u:0)+(w>=32&&w<64?u:0)):0);f+=Math.abs(h[M]-y),v+=Math.abs(P-y)}d.push({alpha:u,centroid:p/g,expected:40+8*u,hash:b>>>0,mae:f/9216,unwarpedBlendMAE:v/9216,image:a===24&&o===75?n(h):void 0})}r.push({source:a,target:o,samples:d})}return r}finally{e.destroy()}}async function li(){const c=await R.create(_(1,1),()=>{},{common:ei,denoise:ti,upscale:ii,composite:si}),e=await R.create(_(1,1),()=>{}),t=_(640,360),i=t.getContext("2d"),r=i.createImageData(640,360);for(let o=0;o<r.data.length;o++)r.data[o]=o%4===3?255:(o*37+o%17*19)%256;i.putImageData(r,0,0);const s={...H(1920,1080),source:{width:640,height:360}},n={...K,upscale:!0,sharpness:.25,denoise:.15},a=[];try{for(const[d,l]of[["1.1",c],["1.2",e]]){const u=[];for(let p=0;p<50;p++){const g=performance.now();await l.render(t,s,n),await l.present(),p>=10&&u.push(performance.now()-g)}const h=[...u].sort((p,g)=>p-g);a.push({version:d,times:u,median:h[20],p95:h[38]})}await c.render(t,s,n),await c.present("full"),await e.render(t,s,n),await e.present("full");let o=0;for(let d=0;d<c.lastPixels.length;d++)c.lastPixels[d]!==e.lastPixels[d]&&o++;return{method:"same current host, frozen v1.1 shaders vs v1.2 shaders; interpolation off; neutral color; 640x360→1920x1080; 10 warmup, 40 measurements; wall completion including CPU/queue/GPU",rows:a,changedChannels:o}}finally{c.destroy(),e.destroy()}}async function ui(){const c=_(1,1),e=await R.create(c,()=>{}),t=_(8,8),i=t.getContext("2d"),r=[];i.fillStyle="rgb(64,128,192)",i.fillRect(0,0,8,8);try{await e.captureFrame(t,{width:8,height:8},0,{width:8,tier:0}),await e.captureFrame(t,{width:8,height:8},1/30,{width:8,tier:0});for(const s of[!1,!0])for(const n of[!1,!0])for(const a of[!1,!0]){const o=n?{...H(16,16),source:{width:8,height:8}}:H(8,8),d={...K,upscale:n,saturation:a?0:100,brightness:100};s?await e.renderTemporal(o,d,.5):await e.render(t,o,d),await e.present("pixel"),r.push({motion:s,upscale:n,color:a,size:{width:c.width,height:c.height},pixel:Array.from(e.lastPixels)})}return r}finally{e.destroy()}}const S=c=>document.getElementById(c),le=S("video");let C={...Ve,adaptive:!1,automaticStrength:!1,comparison:!0},T,Z="";function ye(){if(T?.destroy(),T=void 0,C.enabled){const c=S("backend").value;T=new Wt(le,C,void 0,c==="auto"?void 0:c),T.start()}}async function Oe(){S("notice").textContent="로컬 진단 영상 생성 중 · 3초";const c=document.createElement("canvas");c.width=320,c.height=180;const e=c.getContext("2d"),t=c.captureStream(24),i=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(l=>MediaRecorder.isTypeSupported(l)),r=new MediaRecorder(t,{mimeType:i,videoBitsPerSecond:5e5}),s=[];r.ondataavailable=l=>{l.data.size&&s.push(l.data)};const n=new Promise(l=>{r.onstop=()=>l(new Blob(s,{type:r.mimeType}))});r.start();let a=0;const o=window.setInterval(()=>{const l=e.createLinearGradient(0,0,320,180);l.addColorStop(0,"#122b3e"),l.addColorStop(1,"#c9dec7"),e.fillStyle=l,e.fillRect(0,0,320,180),e.strokeStyle="#eef4df",e.lineWidth=1;for(let u=0;u<18;u++)e.beginPath(),e.moveTo(u*13+a%12,35),e.lineTo(u*13+55,145),e.stroke();e.fillStyle="#121d26",e.fillRect(10,8,300,23),e.fillStyle="#e5edeb",e.font="13px monospace",e.fillText(`CLARITY 320×180 · frame ${String(a).padStart(3,"0")}`,16,24);for(let u=145;u<175;u++)for(let h=15;h<130;h++){const p=90+(h*13+u*7+a*3)%23;e.fillStyle=`rgb(${p},${p},${p})`,e.fillRect(h,u,1,1)}e.fillStyle="#f1b36e",e.beginPath(),e.arc(200+Math.sin(a/12)*60,113,18,0,Math.PI*2),e.fill(),a++},1e3/24);await new Promise(l=>setTimeout(l,3e3)),clearInterval(o),r.stop();const d=await n;t.getTracks().forEach(l=>l.stop()),ue(URL.createObjectURL(d)),S("notice").textContent="로컬 320 × 180 진단 WebM 생성 완료. 실제 HTML 영상 플레이어가 디코딩합니다."}const Ue=new Map;async function di(c){T?.destroy(),T=void 0,le.pause();let e=Ue.get(c);if(!e){const t=Object.assign(document.createElement("canvas"),{width:256,height:144}),i=t.getContext("2d"),r=t.captureStream(0),s=r.getVideoTracks()[0],n=new MediaRecorder(r,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:2e6}),a=[];n.ondataavailable=l=>{l.data.size&&a.push(l.data)};const o=new Promise(l=>{n.onstop=()=>l(new Blob(a,{type:n.mimeType}))});n.start();const d=performance.now();for(let l=0;l<c*2;l++){await new Promise(h=>setTimeout(h,Math.max(0,d+l*1e3/c-performance.now()))),i.fillStyle="#101010",i.fillRect(0,0,256,144);const u=24+l*80/(c*2);i.fillStyle="#eeeeee",i.fillRect(u,48,48,48),i.fillStyle="#4080c0",i.fillRect(u+8,56,16,16),i.fillStyle="#80c040",i.fillRect(u+28,76,12,12),s.requestFrame()}await new Promise(l=>setTimeout(l,1e3/c)),n.stop(),e=await o,r.getTracks().forEach(l=>l.stop()),Ue.set(c,e)}ue(URL.createObjectURL(e)),await le.play()}function ue(c){Z&&URL.revokeObjectURL(Z),Z=c,le.src=Z,ye(),le.play().catch(e=>{S("notice").textContent=String(e)})}S("sample").addEventListener("click",()=>{S("sample").disabled=!0,Oe().catch(c=>{S("notice").textContent=String(c)}).finally(()=>{S("sample").disabled=!1})});S("packaged").addEventListener("click",()=>{ue(new URL("../diagnostic.webm",location.href).href),S("notice").textContent="포함된 로컬 320 × 180 진단 영상을 재생합니다."});S("backend").addEventListener("change",ye);S("file").addEventListener("change",c=>{const e=c.target.files?.[0];e&&ue(URL.createObjectURL(e))});S("toggle").addEventListener("click",()=>{C.enabled=!C.enabled,S("toggle").textContent=C.enabled?"보정 끄기":"보정 켜기",ye()});S("engine").addEventListener("change",()=>{C.engine=S("engine").value,T?.update(C)});S("contentMode").addEventListener("change",()=>{C.contentMode=S("contentMode").value,T?.update(C)});S("original").addEventListener("change",()=>{C.original=S("original").checked,T?.update(C)});for(const c of["targetResolution","targetFPS"])S(c).addEventListener("change",()=>{C={...C,[c]:S(c).value},T?.update(C)});for(const c of["saturation","brightness"])S(c).addEventListener("input",()=>{C[c]=Number(S(c).value),S(c+"-value").textContent=C[c]+"%",T?.update(C)});for(const[c,e]of[["sharp","sharpness"],["noise","denoise"]])S(c).addEventListener("input",()=>{C[e]=Number(S(c).value),S(c==="sharp"?"sharp-value":"noise-value").textContent=String(C[e]),T?.update(C)});S("compare").addEventListener("change",()=>{C.comparison=S("compare").checked,T?.update(C)});S("validate").addEventListener("click",()=>{const c=S("backend").value;S("pixel-results").textContent="셰이더 컴파일 및 픽셀 확인 중…",ze(c==="auto"?void 0:c).then(e=>{S("pixel-results").textContent=`${e.backend}
`+e.checks.map(t=>`${t.passed?"PASS":"FAIL"} ${t.name}
${t.detail}`).join(`
`)}).catch(e=>{S("pixel-results").textContent=String(e)})});S("quality-review").addEventListener("click",()=>{const c=S("backend").value;T?.destroy(),T=void 0,S("quality-results").textContent="동일 조건 비교 중 · 재생 보정 일시 중지",Ie(c==="webgl2"?"webgl2":"webgpu").then(e=>{S("quality-results").textContent=JSON.stringify({...e,cases:e.cases.map(({images:t,...i})=>i)},null,2)}).catch(e=>{S("quality-results").textContent=String(e)})});const hi=window.setInterval(()=>{S("stats").textContent=T?JSON.stringify(T.stats(),null,2):"보정 사용 안 함"},1e3);window.addEventListener("pagehide",()=>{clearInterval(hi),T?.destroy(),Z&&URL.revokeObjectURL(Z)});window.clarityHarness={runPipelineCombinations:ui,runMotionMatrix:ci,runV11Benchmark:li,runPixelChecks:ze,runQualityReview:Ie,compareCapturedFrame:Zt,runMotionChecks:ai,runColorChecks:ni,runResolutionChecks:oi,motionSample:di,sample:Oe,stats:()=>T?.stats()??null,destroy:()=>{T?.destroy(),T=void 0},settings:c=>{C={...C,...c},T?.update(C)}};bt((c,e)=>{C={...C,...e},ue(c)});
