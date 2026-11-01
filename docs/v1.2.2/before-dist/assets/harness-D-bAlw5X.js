import{e as et,a as Le,D as tt}from"./types-D6ydw_jh.js";let it=class{enabled=!1;signatures=!0;generation=0;timestampSupported=null;values=new Map;counts=new Map;configure(e,t=!0){this.enabled=e,this.signatures=t,this.reset()}reset(){this.generation++,this.values.clear(),this.counts.clear()}mark(){return this.enabled?performance.now():0}elapsed(e,t){this.enabled&&this.sample(e,performance.now()-t)}sample(e,t){if(!this.enabled||!Number.isFinite(t))return;let i=this.values.get(e);i||(i=[],this.values.set(e,i)),i.length<8192&&i.push(t)}count(e,t=1){this.counts.set(e,(this.counts.get(e)??0)+t)}snapshot(){const e={};for(const[t,i]of this.values){const s=[...i].sort((n,a)=>n-a),r=i.reduce((n,a)=>n+a,0);e[t]={count:i.length,mean:r/i.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],p99:s[Math.min(s.length-1,Math.floor(s.length*.99))],max:s[s.length-1],total:r}}return{enabled:this.enabled,timestampSupported:this.timestampSupported,stages:e,counters:Object.fromEntries(this.counts)}}};const v=new it,st=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,rt=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,nt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,at=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,ot=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
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
`,ct=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,lt=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,ut=`@group(0) @binding(0) var a:texture_2d<f32>;
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
  let rawConfidence=clamp(1.0-bestError/0.16,0.0,1.0)*(0.12+0.88*clamp(textureStrength*5.0,0.0,1.0));
  // A poor match pinned to the search edge is not a reliable fast-motion vector.
  let confidence=select(rawConfidence,0.0,any(abs(best)>=vec2i(radius-1))&&bestError>0.015);
  let value=vec4f(vec2f(best)+sub,confidence,bestError);
  if(reverse){textureStore(backward,vec2i(id.xy),value);}else{
    textureStore(forward,vec2i(id.xy),value);
    atomicAdd(&stats.error,u32(bestError*65535.0));atomicAdd(&stats.difference,u32(zeroError*65535.0));
    atomicAdd(&stats.confidence,u32(confidence*65535.0));if(length(value.xy)>0.2&&confidence>0.15){atomicAdd(&stats.moving,1u);}atomicAdd(&stats.blocks,1u);
  }
}
`,dt=`@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_2d<f32>;
@group(0) @binding(3) var backward:texture_2d<f32>;
@group(0) @binding(4) var output:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(5) var<uniform> m:MotionParams;
struct SceneAnalysis { error:u32, difference:u32, confidence:u32, moving:u32, blocks:u32 }
@group(0) @binding(6) var<storage,read> analysis:SceneAnalysis;
fn flow(t:texture_2d<f32>,source:texture_2d<f32>,p:vec2f)->vec4f{
  let grid=(p+0.5)*m.full.zw/m.full.xy/m.grid.z-0.5;let at=vec2i(floor(grid));let f=fract(grid);let hi=vec2i(textureDimensions(t))-1;
  let v00=textureLoad(t,clamp(at,vec2i(0),hi),0);let v10=textureLoad(t,clamp(at+vec2i(1,0),vec2i(0),hi),0);
  let v01=textureLoad(t,clamp(at+vec2i(0,1),vec2i(0),hi),0);let v11=textureLoad(t,clamp(at+vec2i(1,1),vec2i(0),hi),0);
  let center=rgbAt(source,vec2i(p));let scale=m.grid.z*m.full.xy/m.full.zw;
  let c00=rgbAt(source,vec2i((vec2f(clamp(at,vec2i(0),hi))+0.5)*scale-0.5));
  let c10=rgbAt(source,vec2i((vec2f(clamp(at+vec2i(1,0),vec2i(0),hi))+0.5)*scale-0.5));
  let c01=rgbAt(source,vec2i((vec2f(clamp(at+vec2i(0,1),vec2i(0),hi))+0.5)*scale-0.5));
  let c11=rgbAt(source,vec2i((vec2f(clamp(at+vec2i(1,1),vec2i(0),hi))+0.5)*scale-0.5));
  let spatial=vec4f((1.0-f.x)*(1.0-f.y),f.x*(1.0-f.y),(1.0-f.x)*f.y,f.x*f.y);
  let edge=vec4f(dot(abs(center-c00),vec3f(0.25,0.5,0.25)),dot(abs(center-c10),vec3f(0.25,0.5,0.25)),dot(abs(center-c01),vec3f(0.25,0.5,0.25)),dot(abs(center-c11),vec3f(0.25,0.5,0.25)));
  let rejection=1.0+edge*200.0;
  let weight=spatial*max(vec4f(0.01),vec4f(v00.z,v10.z,v01.z,v11.z)-0.1)/(rejection*rejection);
  let total=max(0.000001,dot(weight,vec4f(1)));let value=(v00*weight.x+v10*weight.y+v01*weight.z+v11*weight.w)/total;
  let spread=dot(weight,vec4f(length(v00.xy-value.xy),length(v10.xy-value.xy),length(v01.xy-value.xy),length(v11.xy-value.xy)))/total;
  return vec4f(value.xy,value.z*(1.0-smoothstep(2.0,8.0,spread)),value.w);
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(output))){return;}let p=vec2f(id.xy);let phase=m.grid.w;
  let blocks=f32(max(1u,analysis.blocks));
  let cut=f32(analysis.difference)/blocks/65535.0>0.24&&f32(analysis.error)/blocks/65535.0>0.12;
  let dynamic=analysis.moving>0u&&f32(analysis.difference)/blocks/65535.0>0.0005;
  if(phase<=0.0001){textureStore(output,vec2i(id.xy),vec4f(rgbAt(a,vec2i(id.xy)),1));return;}
  if(m.control.z>0.5||cut||!dynamic||phase>=0.9999){textureStore(output,vec2i(id.xy),vec4f(rgbAt(b,vec2i(id.xy)),1));return;}
  let fa=flow(forward,a,p);let fb=flow(backward,b,p);let scale=m.full.xy/m.full.zw;
  let pa=p-fa.xy*scale*phase;let pb=p-fb.xy*scale*(1.0-phase);
  let ca=bilinear(a,pa);let cb=bilinear(b,pb);
  let opposite=flow(backward,b,pa+fa.xy*scale);
  let consistent=length(fa.xy+opposite.xy)<1.75;
  var color=select(rgbAt(a,vec2i(id.xy)),rgbAt(b,vec2i(id.xy)),phase>=0.5);
  if(fa.z>0.08||fb.z>0.08){
    if(consistent&&abs(fa.z-fb.z)<0.35&&dot(abs(ca-cb),vec3f(0.25,0.5,0.25))<0.2){color=mix(ca,cb,phase);}
    else if(fa.z>fb.z){color=ca;}else{color=cb;}
  }
  textureStore(output,vec2i(id.xy),vec4f(color,1));
}
`;let Ge=class Be{constructor(e,t,i,s,r){this.device=e,this.timer=t,this.down=i,this.estimate=s,this.interpolate=r,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summaries=[0,1].map(()=>e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})),this.reads=[0,1,2].map(()=>({buffer:e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1}))}device;timer;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summaries;key="";count=0;serial=0;dead=!1;times=[0,0,0];downGroups=[];flowGroups=[];warpGroups=new Map;warpTarget;banks=[void 0,void 0];reads=[];full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e,t){e.pushErrorScope("validation");try{const i=[];for(const s of[lt,ut,dt]){const r=e.createShaderModule({code:ct+`
`+s}),a=(await r.getCompilationInfo()).messages.filter(o=>o.type==="error");if(a.length)throw new Error("움직임 셰이더 컴파일 실패: "+a.map(o=>o.message).join("; "));i.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:r,entryPoint:"main"}}))}return new Be(e,t,i[0],i[1],i[2])}finally{const i=await e.popErrorScope();if(i)throw new Error("움직임 셰이더 초기화 실패: "+i.message)}}sizeKey(e,t){const i=Math.min(e.width,t.width);return[e.width,e.height,i,Math.max(8,Math.round(e.height*i/e.width))].join(",")}needsResize(e,t){return this.key!==this.sizeKey(e,t)}matchesSource(e){return this.full.width===e.width&&this.full.height===e.height}pairs(){return this.banks.filter(e=>!!e&&e.ready).sort((e,t)=>e.a-t.a)}contains(e){return this.banks.some(t=>t?.id===e.id)}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,this.config.tier===0?4:8+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){this.config=t;const i=this.sizeKey(e,t);if(i===this.key)return;this.destroyTextures();const s=Math.min(e.width,t.width),r=Math.max(8,Math.round(e.height*s/e.width));this.full=e,this.lowSize={width:s,height:r},this.grid={width:Math.ceil(s/8),height:Math.ceil(r/8)};const n=(a,o)=>this.device.createTexture({size:[a.width,a.height],format:o,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[0,1,2].map(()=>n(e,"rgba8unorm")),this.low=[0,1,2].map(()=>n(this.lowSize,"rgba8unorm")),this.flows=[0,1,2,3].map(()=>n(this.grid,"rgba16float")),this.downGroups=this.frames.map((a,o)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1,2].flatMap(a=>[0,1].map(o=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[(a+2)%3].createView()},{binding:1,resource:this.low[a].createView()},{binding:2,resource:this.flows[o*2].createView()},{binding:3,resource:this.flows[o*2+1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summaries[o]}}]}))),this.key=i,this.reset()}enqueue(e,t,i,s,r){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const n=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,s);const a=this.count%3,o=(a+2)%3,u=Math.max(0,this.count-1)%2;this.times[a]=i,this.device.queue.writeBuffer(this.uniform,0,this.params());const l=v.mark();this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[a],colorSpace:"srgb"},[t.width,t.height]),v.elapsed("uploadCpuMs",l);const d=v.mark(),h=this.timer?.begin(),g=this.device.createCommandEncoder();let f=g.beginComputePass({timestampWrites:h?.stamp("downsample")});f.setPipeline(this.down),f.setBindGroup(0,this.downGroups[a]),f.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),f.end();let x;this.count>0&&(g.clearBuffer(this.summaries[u]),f=g.beginComputePass({timestampWrites:h?.stamp("flow")}),f.setPipeline(this.estimate),f.setBindGroup(0,this.flowGroups[a*2+u]),f.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),f.end(),v.count("flowDispatches"),x=this.reads.find(m=>!m.busy),x?(x.busy=!0,g.copyBufferToBuffer(this.summaries[u],0,x.buffer,0,32)):v.count("analysisReadSkipped")),v.elapsed("flowPrepareCpuMs",d),h?.resolve(g),this.device.queue.submit([g.finish()]),h?.submitted();const p={id:++this.serial,newest:a,previous:o,bank:u,a:this.times[o],b:i,ready:++this.count>1,sceneCut:!1,dynamic:!0,confidence:0,flowMs:performance.now()-n,flowSize:{...this.lowSize}};if(p.analysisAvailable=!!x,x){const m=x,b=v.mark();p.analysis=m.buffer.mapAsync(GPUMapMode.READ).then(()=>{const w=new Uint32Array(m.buffer.getMappedRange()),S=Math.max(1,w[4]),M=w[0]/S/65535,y=w[1]/S/65535;v.sample("motionDifference",y),v.sample("movingBlockFraction",w[3]/S),v.sample("motionImprovement",y>0?Math.max(0,1-M/y):0);const P={sceneCut:y>.24&&M>.12,dynamic:w[3]>0&&y>5e-4,confidence:w[2]/S/65535};return m.buffer.unmap(),v.elapsed("flowReadbackWaitMs",b),Object.assign(p,P,{flowMs:performance.now()-n}),P}).catch(w=>(this.dead||r(w),{sceneCut:!1,dynamic:!1,confidence:0})).finally(()=>{m.busy=!1})}return p.ready&&(this.banks[u]=p),this.pair=p,p}finally{this.device.popErrorScope().then(a=>{a&&!this.dead&&r(a)})}}async capture(e,t,i,s){const r=this.enqueue(e,t,i,s,n=>{throw n});return r.analysis?await r.analysis:await this.device.queue.onSubmittedWorkDone(),r}encodeWarp(e,t,i,s,r=this.pair){const n=this.banks.find(l=>l?.id===r.id);if(!n?.ready)throw new Error("유효한 원본 프레임 쌍을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups.clear());const a=n.newest*2+n.bank;let o=this.warpGroups.get(a);o||(o=this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[n.previous].createView()},{binding:1,resource:this.frames[n.newest].createView()},{binding:2,resource:this.flows[n.bank*2].createView()},{binding:3,resource:this.flows[n.bank*2+1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}},{binding:6,resource:{buffer:this.summaries[n.bank]}}]}),this.warpGroups.set(a,o)),this.device.queue.writeBuffer(this.uniform,0,this.params(i,n.sceneCut));const u=e.beginComputePass({timestampWrites:s?.stamp("warp")});u.setPipeline(this.interpolate),u.setBindGroup(0,o),u.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),u.end()}reset(){this.count=0,this.times=[0,0,0],this.banks=[void 0,void 0],this.pair.ready=!1,this.warpTarget=void 0,this.warpGroups.clear()}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups.clear()}destroy(){if(!this.dead){this.dead=!0,this.destroyTextures(),this.uniform.destroy();for(const e of this.summaries)e.destroy();for(const e of this.reads)e.buffer.destroy();this.reads=[]}}},Fe=class{slots=[];dead=!1;constructor(e){if(v.enabled&&e.features.has("timestamp-query"))for(let t=0;t<4;t++)this.slots.push({query:e.createQuerySet({type:"timestamp",count:16}),resolve:e.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:e.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1})}begin(){if(this.dead||!v.enabled)return null;const e=this.slots.find(t=>!t.busy);return e?(e.busy=!0,new ht(e,v.generation,()=>this.dead)):(v.count("timestampSkipped"),null)}destroy(){this.dead=!0;for(const e of this.slots)e.query.destroy(),e.resolve.destroy(),e.read.destroy();this.slots=[]}},ht=class{constructor(e,t,i){this.slot=e,this.generation=t,this.dead=i}slot;generation;dead;names=[];stamp(e){const t=this.names.length*2;return this.names.push(e),{querySet:this.slot.query,beginningOfPassWriteIndex:t,endOfPassWriteIndex:t+1}}resolve(e){this.names.length&&(e.resolveQuerySet(this.slot.query,0,this.names.length*2,this.slot.resolve,0),e.copyBufferToBuffer(this.slot.resolve,0,this.slot.read,0,this.names.length*16))}abort(){this.names=[],this.slot.busy=!1}submitted(){if(!this.names.length){this.slot.busy=!1;return}const e=v.mark();this.slot.read.mapAsync(GPUMapMode.READ).then(()=>{if(!this.dead()&&this.generation===v.generation){const t=new BigUint64Array(this.slot.read.getMappedRange());this.names.forEach((i,s)=>v.sample("gpu."+i+"Ms",Number(t[s*2+1]-t[s*2])/1e6)),v.elapsed("diagnosticReadbackWaitMs",e)}this.slot.read.unmap()}).catch(()=>{this.dead()||v.count("timestampReadError")}).finally(()=>{this.slot.busy=!1})}};const ft=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;let Ue=class ze{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:ft}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new ze(e,i)}encode(e,t,i){e.clearBuffer(this.value);const s=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),r=e.beginComputePass({timestampWrites:i?.stamp("signature")});r.setPipeline(this.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(4),r.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){const e=v.mark();await this.readback.mapAsync(GPUMapMode.READ),v.elapsed("signatureReadbackWaitMs",e);const t=new Uint32Array(this.readback.getMappedRange()),i=t[0].toString(16)+":"+t[1].toString(16);return this.readback.unmap(),i}destroy(){this.value.destroy(),this.readback.destroy()}},A=class qe{constructor(e,t,i,s,r){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=s,this.presentPipeline=r,this.timer=new Fe(t),this.maxDimension=t.limits.maxTextureDimension2D;const n=e.getContext("webgpu");if(!n)throw new Error("WebGPU canvas context unavailable.");this.context=n,n.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;timer;inflight=0;streamSignatureBusy=!1;submissionId=0;pendingSince=new Map;temporalEpoch=0;retired=new Set;onStreamAvailable;get pendingGPU(){return this.inflight}get canStream(){return!this.dead&&this.inflight<3}pendingAge(e=performance.now()){const t=this.pendingSince.values().next().value;return t===void 0?0:e-t}stalled(e=performance.now()){const t=this.pendingSince.values().next().value;return t!==void 0&&e-t>1500}canCapture(e,t){return this.canStream&&(!this.motion?.needsResize(e,t)||this.inflight===0)}temporalPairs(){return this.motion?.pairs()??[]}loss=()=>{};motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:st,denoise:rt,upscale:nt,composite:at}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const s=/^Win/i.test(navigator.platform)?void 0:{powerPreference:"low-power"},r=await navigator.gpu.requestAdapter(s);if(!r)throw new Error("No WebGPU adapter.");v.timestampSupported=r.features.has("timestamp-query");const n=await r.requestDevice({requiredFeatures:v.enabled&&v.timestampSupported?["timestamp-query"]:[]});try{const a=[i.denoise,i.upscale,i.composite].map(h=>n.createShaderModule({code:i.common+`
`+ot+`
`+h}));for(const h of a){const f=(await h.getCompilationInfo()).messages.filter(x=>x.type==="error");if(f.length)throw new Error(f.map(x=>`WGSL ${x.lineNum}: ${x.message}`).join("; "))}const[o,u,l]=await Promise.all([n.createComputePipelineAsync({layout:"auto",compute:{module:a[0],entryPoint:"main"}}),n.createComputePipelineAsync({layout:"auto",compute:{module:a[1],entryPoint:"main"}}),n.createRenderPipelineAsync({layout:"auto",vertex:{module:a[2],entryPoint:"vertex"},fragment:{module:a[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),d=new qe(e,n,o,u,l);return d.loss=t,n.lost.then(h=>{d.dead||t(`WebGPU device lost: ${h.message||h.reason}`)}),n.addEventListener("uncapturederror",h=>{d.dead||t(`WebGPU: ${h.error.message}`)}),d}catch(a){throw n.destroy(),a}}resize(e){const{source:t,output:i}=e,s=`${t.width},${t.height},${i.width},${i.height}`;if(s===this.key)return;if(this.textures.forEach(u=>u.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[u,l]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][u],size:[l.width,l.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[r,n,a]=this.textures.map(u=>u.createView()),o=(u,l,d)=>this.device.createBindGroup({layout:u,entries:[{binding:0,resource:l},{binding:1,resource:d},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=o(this.clean.getBindGroupLayout(0),r,n),this.upscaleRaw=o(this.reconstruct.getBindGroupLayout(0),r,a),this.upscaleClean=o(this.reconstruct.getBindGroupLayout(0),n,a),this.compositeGroup=o(this.presentPipeline.getBindGroupLayout(0),r,a),this.compositeRaw=o(this.presentPipeline.getBindGroupLayout(0),r,r),this.compositeClean=o(this.presentPipeline.getBindGroupLayout(0),r,n),this.key=s}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,s){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const r=await Ge.create(this.device,this.timer);if(this.dead)throw r.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=r}return this.motion.capture(e,t,i,s)}streamError(e){this.dead||this.loss("WebGPU 보간 오류: "+(e&&typeof e=="object"&&"message"in e?String(e.message):String(e)))}completion(){const e=performance.now(),t=++this.submissionId;return this.pendingSince.set(t,e),this.inflight++,v.sample("inflightDepth",this.inflight),this.device.queue.onSubmittedWorkDone().then(()=>{const i=performance.now()-e;return v.sample("asyncCompletionLatencyMs",i),i},i=>(this.streamError(i),performance.now()-e)).finally(()=>{this.pendingSince.delete(t),this.inflight--,this.dead||this.onStreamAvailable?.()})}async enqueueFrame(e,t,i,s){if(!this.motion){const n=await Ge.create(this.device,this.timer);if(this.dead)throw n.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=n}v.enabled&&v.signatures&&!this.signature&&(this.signature=await Ue.create(this.device));const r=this.motion.enqueue(e,t,i,s,n=>this.streamError(n));return this.completion(),r}submitTemporal(e,t,i,s,r){return this.canStream?this.motion?.pair.ready?this.motion.matchesSource(e.source)?this.motion.contains(s)?this.submitFrame(e,t,r,(n,a)=>this.motion.encodeWarp(n,this.textures[0],i,a,s)):(v.count("discard.bufferMismatch"),null):(v.count("discard.resolutionChanged"),null):(v.count("discard.planUnavailable"),null):(v.count("discard.gpuBackpressure"),null)}submitSource(e,t,i,s){return e.displayWidth!==t.source.width||e.displayHeight!==t.source.height?(v.count("discard.resolutionChanged"),null):this.submitFrame(t,i,s,()=>{const r=v.mark();this.device.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[t.source.width,t.source.height]),v.elapsed("nativeUploadCpuMs",r)})}submitFrame(e,t,i,s){if(!this.canStream)return v.count("discard.gpuBackpressure"),null;if(i&&!i()||`${e.source.width},${e.source.height},${e.output.width},${e.output.height}`!==this.key&&this.inflight>0)return null;const n=performance.now();this.device.pushErrorScope("validation"),this.device.pushErrorScope("out-of-memory");try{this.resize(e);const{source:a,output:o}=e;this.device.queue.writeBuffer(this.uniform,0,new Float32Array([a.width,a.height,o.width,o.height,t.sharpness,t.denoise,t.engine==="balanced"?1:0,t.comparison?1:0,t.divider,t.contentMode==="animation"?1:0,t.original?1:0,0,(t.saturation??100)/100,(t.brightness??100)/100,t.upscale===!1?0:1,0]));const u=this.device.createCommandEncoder(),l=this.timer.begin();s(u,l);const d=!t.original&&t.engine==="balanced"&&t.denoise>0;if(d){const p=u.beginComputePass({timestampWrites:l?.stamp("denoise")});p.setPipeline(this.clean),p.setBindGroup(0,this.denoiseGroup),p.dispatchWorkgroups(Math.ceil(a.width/8),Math.ceil(a.height/8)),p.end()}if(!t.original&&t.upscale!==!1){const p=u.beginComputePass({timestampWrites:l?.stamp("upscale")});p.setPipeline(this.reconstruct),p.setBindGroup(0,d?this.upscaleClean:this.upscaleRaw),p.dispatchWorkgroups(Math.ceil(o.width/8),Math.ceil(o.height/8)),p.end()}if(i&&!i())return l?.abort(),this.completion(),null;const h=this.context.getCurrentTexture(),g=u.beginRenderPass({timestampWrites:l?.stamp("composite"),colorAttachments:[{view:h.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});g.setPipeline(this.presentPipeline),g.setBindGroup(0,t.upscale===!1?d?this.compositeClean:this.compositeRaw:this.compositeGroup),g.draw(3),g.end();const f=!!this.signature&&v.enabled&&v.signatures&&!this.streamSignatureBusy;f&&(this.streamSignatureBusy=!0,this.signature.encode(u,h,l)),l?.resolve(u),this.device.queue.submit([u.finish()]),l?.submitted(),v.count("canvasSubmissions");const x=this.completion();if(f){const p=v.generation,m=this.temporalEpoch;this.signature.read().then(b=>{!this.dead&&m===this.temporalEpoch&&p===v.generation&&(this.lastSignature=b)}).catch(b=>{this.dead||this.streamError(b)}).finally(()=>{m===this.temporalEpoch&&(this.streamSignatureBusy=!1)})}return v.sample("outputSubmitCpuMs",performance.now()-n),{cpuSubmitMs:performance.now()-n,latencyMs:performance.now()-n,gpuMs:null,completion:x}}finally{this.device.popErrorScope().then(a=>{a&&this.streamError(a)}),this.device.popErrorScope().then(a=>{a&&this.streamError(a)})}}resetTemporal(){this.motion?.reset()}releaseTemporal(){const e=this.motion,t=this.signature;this.motion=void 0,this.signature=void 0,this.lastSignature=null,this.streamSignatureBusy=!1,this.temporalEpoch++;let i=!1;const s=()=>{i||(i=!0,e?.destroy(),t?.destroy(),this.retired.delete(s))};this.dead||this.inflight===0?s():(this.retired.add(s),this.device.queue.onSubmittedWorkDone().then(s,s))}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,s=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const r=performance.now(),n=this.device;n.pushErrorScope("validation"),n.pushErrorScope("out-of-memory");let a;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const m=await Ue.create(this.device);if(this.dead)throw m.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=m}const{source:h,output:g}=t;n.queue.writeBuffer(this.uniform,0,new Float32Array([h.width,h.height,g.width,g.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&n.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[h.width,h.height]);const f=n.createCommandEncoder(),x=this.timer.begin();e||this.motion.encodeWarp(f,this.textures[0],s,x);const p=!i.original&&i.engine==="balanced"&&i.denoise>0;if(p){const m=f.beginComputePass({timestampWrites:x?.stamp("denoise")});m.setPipeline(this.clean),m.setBindGroup(0,this.denoiseGroup),m.dispatchWorkgroups(Math.ceil(h.width/8),Math.ceil(h.height/8)),m.end()}if(!i.original&&i.upscale!==!1){const m=f.beginComputePass({timestampWrites:x?.stamp("upscale")});m.setPipeline(this.reconstruct),m.setBindGroup(0,p?this.upscaleClean:this.upscaleRaw),m.dispatchWorkgroups(Math.ceil(g.width/8),Math.ceil(g.height/8)),m.end()}this.selectedComposite=i.upscale===!1?p?this.compositeClean:this.compositeRaw:this.compositeGroup,x?.resolve(f),n.queue.submit([f.finish()]),x?.submitted()}catch(h){a=h}const o=performance.now()-r,u=v.mark(),l=await n.popErrorScope(),d=await n.popErrorScope();if(v.elapsed("renderErrorScopeWaitMs",u),a)throw a;if(l||d)throw new Error((l||d).message);if(e){const h=v.mark();await n.queue.onSubmittedWorkDone(),v.elapsed("renderFenceWaitMs",h)}if(this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:o,latencyMs:performance.now()-r,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),s=this.timer.begin(),r=this.context.getCurrentTexture(),n=i.beginRenderPass({timestampWrites:s?.stamp("composite"),colorAttachments:[{view:r.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(this.presentPipeline),n.setBindGroup(0,this.selectedComposite??this.compositeGroup),n.draw(3),n.end(),this.measureSignature&&this.signature.encode(i,r,s);const a=e==="full"?this.canvas.width:1,o=e==="full"?this.canvas.height:1,u=Math.ceil(a*4/256)*256,l=e!=="none"?this.device.createBuffer({size:u*o,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;l&&i.copyTextureToBuffer({texture:r},{buffer:l,bytesPerRow:u},[a,o]),s?.resolve(i),this.device.queue.submit([i.finish()]),s?.submitted(),v.count("canvasSubmissions");const d=performance.now()-t,h=v.mark(),g=await this.device.popErrorScope();if(v.elapsed("presentErrorScopeWaitMs",h),g)throw new Error(g.message);const f=v.mark();if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),v.elapsed("presentFenceWaitMs",f),this.lastPixels=null,l)try{await l.mapAsync(GPUMapMode.READ);const x=new Uint8Array(l.getMappedRange()),p=new Uint8ClampedArray(a*o*4),m=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let b=0;b<o;b++)for(let w=0;w<a;w++){const S=b*u+w*4,M=(b*a+w)*4;p[M]=x[S+(m?2:0)],p[M+1]=x[S+1],p[M+2]=x[S+(m?0:2)],p[M+3]=x[S+3]}this.lastPixels=p,l.unmap()}finally{l.destroy()}return d}destroy(){if(!this.dead){this.dead=!0,this.device.destroy();for(const e of[...this.retired])e();this.timer.destroy(),this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy()}}};const pt=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,mt=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,gt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,vt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,xt=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
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
`,bt=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,yt=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,wt=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`,St=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`;let Pt=class We{constructor(e,t,i,s){this.device=e,this.down=t,this.estimate=i,this.interpolate=s,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summary=e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summary;readback;key="";count=0;newest=0;dead=!1;times=[0,0];downGroups=[];flowGroups=[];warpGroups=[];warpTarget;full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e){e.pushErrorScope("validation");try{const t=[];for(const i of[yt,wt,St]){const s=e.createShaderModule({code:bt+`
`+i}),n=(await s.getCompilationInfo()).messages.filter(a=>a.type==="error");if(n.length)throw new Error("움직임 셰이더 컴파일 실패: "+n.map(a=>a.message).join("; "));t.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:s,entryPoint:"main"}}))}return new We(e,t[0],t[1],t[2])}finally{const t=await e.popErrorScope();if(t)throw new Error("움직임 셰이더 초기화 실패: "+t.message)}}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){const i=Math.min(e.width,t.width),s=Math.max(8,Math.round(e.height*i/e.width)),r=`${e.width},${e.height},${i},${s}`;if(this.config=t,r===this.key)return;this.destroyTextures(),this.full=e,this.lowSize={width:i,height:s},this.grid={width:Math.ceil(i/8),height:Math.ceil(s/8)};const n=(a,o)=>this.device.createTexture({size:[a.width,a.height],format:o,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[n(e,"rgba8unorm"),n(e,"rgba8unorm")],this.low=[n(this.lowSize,"rgba8unorm"),n(this.lowSize,"rgba8unorm")],this.flows=[n(this.grid,"rgba16float"),n(this.grid,"rgba16float")],this.downGroups=this.frames.map((a,o)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1].map(a=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[1-a].createView()},{binding:1,resource:this.low[a].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summary}}]})),this.key=r,this.reset()}async capture(e,t,i,s){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const r=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,s),this.newest=this.count===0?0:1-this.newest,this.times[this.newest]=i,this.device.queue.writeBuffer(this.uniform,0,this.params()),this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[this.newest],colorSpace:"srgb"},[t.width,t.height]);const n=this.device.createCommandEncoder();let a=n.beginComputePass();a.setPipeline(this.down),a.setBindGroup(0,this.downGroups[this.newest]),a.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),a.end(),this.count>0&&(n.clearBuffer(this.summary),a=n.beginComputePass(),a.setPipeline(this.estimate),a.setBindGroup(0,this.flowGroups[this.newest]),a.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),a.end(),n.copyBufferToBuffer(this.summary,0,this.readback,0,32)),this.device.queue.submit([n.finish()]);let o=!1,u=!1,l=0;if(this.count>0){await this.readback.mapAsync(GPUMapMode.READ);const d=new Uint32Array(this.readback.getMappedRange()),h=Math.max(1,d[4]),g=d[0]/h/65535,f=d[1]/h/65535;l=d[2]/h/65535,u=d[3]>0&&f>1e-4,o=f>.24&&g>.12,this.readback.unmap()}else await this.device.queue.onSubmittedWorkDone();this.count++,this.pair={a:this.times[1-this.newest],b:i,ready:this.count>1,sceneCut:o,dynamic:u,confidence:l,flowMs:performance.now()-r,flowSize:{...this.lowSize}}}finally{const n=await this.device.popErrorScope();if(n)throw new Error("움직임 추정 GPU 오류: "+n.message)}return this.pair}encodeWarp(e,t,i){if(!this.pair.ready)throw new Error("서로 다른 두 원본 프레임을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups=[0,1].map(r=>this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[1-r].createView()},{binding:1,resource:this.frames[r].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}}]}))),this.device.queue.writeBuffer(this.uniform,0,this.params(i,this.pair.sceneCut));const s=e.beginComputePass();s.setPipeline(this.interpolate),s.setBindGroup(0,this.warpGroups[this.newest]),s.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),s.end()}reset(){this.count=0,this.times=[0,0],this.pair.ready=!1,this.warpTarget=void 0}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups=[]}destroy(){this.dead||(this.dead=!0,this.destroyTextures(),this.uniform.destroy(),this.summary.destroy(),this.readback.destroy())}};const Mt=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;let Et=class Ie{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:Mt}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new Ie(e,i)}encode(e,t){e.clearBuffer(this.value);const i=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),s=e.beginComputePass();s.setPipeline(this.pipeline),s.setBindGroup(0,i),s.dispatchWorkgroups(4),s.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){await this.readback.mapAsync(GPUMapMode.READ);const e=new Uint32Array(this.readback.getMappedRange()),t=e[0].toString(16)+":"+e[1].toString(16);return this.readback.unmap(),t}destroy(){this.value.destroy(),this.readback.destroy()}},Oe=class $e{constructor(e,t,i,s,r){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=s,this.presentPipeline=r,this.maxDimension=t.limits.maxTextureDimension2D;const n=e.getContext("webgpu");if(!n)throw new Error("WebGPU canvas context unavailable.");this.context=n,n.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:pt,denoise:mt,upscale:gt,composite:vt}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const s=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!s)throw new Error("No WebGPU adapter.");const r=await s.requestDevice();try{const n=[i.denoise,i.upscale,i.composite].map(d=>r.createShaderModule({code:i.common+`
`+xt+`
`+d}));for(const d of n){const g=(await d.getCompilationInfo()).messages.filter(f=>f.type==="error");if(g.length)throw new Error(g.map(f=>`WGSL ${f.lineNum}: ${f.message}`).join("; "))}const[a,o,u]=await Promise.all([r.createComputePipelineAsync({layout:"auto",compute:{module:n[0],entryPoint:"main"}}),r.createComputePipelineAsync({layout:"auto",compute:{module:n[1],entryPoint:"main"}}),r.createRenderPipelineAsync({layout:"auto",vertex:{module:n[2],entryPoint:"vertex"},fragment:{module:n[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),l=new $e(e,r,a,o,u);return r.lost.then(d=>{l.dead||t(`WebGPU device lost: ${d.message||d.reason}`)}),r.addEventListener("uncapturederror",d=>{l.dead||t(`WebGPU: ${d.error.message}`)}),l}catch(n){throw r.destroy(),n}}resize(e){const{source:t,output:i}=e,s=`${t.width},${t.height},${i.width},${i.height}`;if(s===this.key)return;if(this.textures.forEach(u=>u.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[u,l]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][u],size:[l.width,l.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[r,n,a]=this.textures.map(u=>u.createView()),o=(u,l,d)=>this.device.createBindGroup({layout:u,entries:[{binding:0,resource:l},{binding:1,resource:d},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=o(this.clean.getBindGroupLayout(0),r,n),this.upscaleRaw=o(this.reconstruct.getBindGroupLayout(0),r,a),this.upscaleClean=o(this.reconstruct.getBindGroupLayout(0),n,a),this.compositeGroup=o(this.presentPipeline.getBindGroupLayout(0),r,a),this.compositeRaw=o(this.presentPipeline.getBindGroupLayout(0),r,r),this.compositeClean=o(this.presentPipeline.getBindGroupLayout(0),r,n),this.key=s}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,s){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const r=await Pt.create(this.device);if(this.dead)throw r.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=r}return this.motion.capture(e,t,i,s)}resetTemporal(){this.motion?.reset()}releaseTemporal(){this.motion?.destroy(),this.motion=void 0,this.signature?.destroy(),this.signature=void 0,this.lastSignature=null}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,s=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const r=performance.now(),n=this.device;n.pushErrorScope("validation"),n.pushErrorScope("out-of-memory");let a;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const x=await Et.create(this.device);if(this.dead)throw x.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=x}const{source:d,output:h}=t;n.queue.writeBuffer(this.uniform,0,new Float32Array([d.width,d.height,h.width,h.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&n.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[d.width,d.height]);const g=n.createCommandEncoder();e||this.motion.encodeWarp(g,this.textures[0],s);const f=!i.original&&i.engine==="balanced"&&i.denoise>0;if(f){const x=g.beginComputePass();x.setPipeline(this.clean),x.setBindGroup(0,this.denoiseGroup),x.dispatchWorkgroups(Math.ceil(d.width/8),Math.ceil(d.height/8)),x.end()}if(!i.original&&i.upscale!==!1){const x=g.beginComputePass();x.setPipeline(this.reconstruct),x.setBindGroup(0,f?this.upscaleClean:this.upscaleRaw),x.dispatchWorkgroups(Math.ceil(h.width/8),Math.ceil(h.height/8)),x.end()}this.selectedComposite=i.upscale===!1?f?this.compositeClean:this.compositeRaw:this.compositeGroup,n.queue.submit([g.finish()])}catch(d){a=d}const o=performance.now()-r,u=await n.popErrorScope(),l=await n.popErrorScope();if(a)throw a;if(u||l)throw new Error((u||l).message);if(e&&await n.queue.onSubmittedWorkDone(),this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:o,latencyMs:performance.now()-r,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),s=this.context.getCurrentTexture(),r=i.beginRenderPass({colorAttachments:[{view:s.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});r.setPipeline(this.presentPipeline),r.setBindGroup(0,this.selectedComposite??this.compositeGroup),r.draw(3),r.end(),this.measureSignature&&this.signature.encode(i,s);const n=e==="full"?this.canvas.width:1,a=e==="full"?this.canvas.height:1,o=Math.ceil(n*4/256)*256,u=e!=="none"?this.device.createBuffer({size:o*a,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;u&&i.copyTextureToBuffer({texture:s},{buffer:u,bytesPerRow:o},[n,a]),this.device.queue.submit([i.finish()]);const l=performance.now()-t,d=await this.device.popErrorScope();if(d)throw new Error(d.message);if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),this.lastPixels=null,u)try{await u.mapAsync(GPUMapMode.READ);const h=new Uint8Array(u.getMappedRange()),g=new Uint8ClampedArray(n*a*4),f=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let x=0;x<a;x++)for(let p=0;p<n;p++){const m=x*o+p*4,b=(x*n+p)*4;g[b]=h[m+(f?2:0)],g[b+1]=h[m+1],g[b+2]=h[m+(f?0:2)],g[b+3]=h[m+3]}this.lastPixels=g,u.unmap()}finally{u.destroy()}return l}destroy(){this.dead||(this.dead=!0,this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy())}};async function Ct(c){v.configure(!1,!1);const e=document.createElement("canvas"),t=await(c==="baseline"?Oe:A).create(e,()=>{}),i=[];try{for(let s=32;s<40;s++)for(const r of[0,2]){t.resetTemporal();const n=Object.assign(document.createElement("canvas"),{width:256,height:144}),a=Object.assign(document.createElement("canvas"),{width:256,height:144});for(const[h,g]of[[n,s],[a,s+r]]){const f=h.getContext("2d");f.fillStyle="#101010",f.fillRect(0,0,256,144),f.fillStyle="#eeeeee",f.fillRect(g,43,48,48),f.fillStyle="#4080c0",f.fillRect(g+8,51,16,16),f.fillStyle="#80c040",f.fillRect(g+28,71,12,12)}const o=n.getContext("2d").getImageData(0,0,256,144).data,u=a.getContext("2d").getImageData(0,0,256,144).data;let l=0;for(let h=0;h<o.length;h++)o[h]!==u[h]&&l++;await t.captureFrame(n,{width:256,height:144},0,{width:256,tier:1});const d=await t.captureFrame(a,{width:256,height:144},1/60,{width:256,tier:1});i.push({x:s,shift:r,changedChannels:l,dynamic:d.dynamic,confidence:d.confidence})}return i}finally{t.destroy()}}async function Tt(c,e,t,i=10){const s=GPUAdapter.prototype.requestDevice,r=GPUDevice.prototype.createCommandEncoder,n=GPUCommandEncoder.prototype.beginComputePass,a=GPUCommandEncoder.prototype.finish,o=GPUQueue.prototype.submit;let u,l="capture";const d=new WeakMap,h=new WeakMap;GPUAdapter.prototype.requestDevice=function(M={}){return s.call(this,{...M,requiredFeatures:this.features.has("timestamp-query")?["timestamp-query"]:[]})},v.configure(!1,!1);const g=Object.assign(document.createElement("canvas"),{width:1,height:1}),f=await(c==="baseline"?Oe:A).create(g,()=>{});v.configure(!0,!1);const x=f.device;v.timestampSupported=x.features.has("timestamp-query"),u=new Fe(x),GPUDevice.prototype.createCommandEncoder=function(M){const y=r.call(this,M);return d.set(y,{record:u.begin(),scope:l,index:0}),y},GPUCommandEncoder.prototype.beginComputePass=function(M={}){const y=d.get(this);return n.call(this,{...M,timestampWrites:y?.record?.stamp(y.scope+".pass"+y.index++)})},GPUCommandEncoder.prototype.finish=function(M){const y=d.get(this);y?.record?.resolve(this);const P=a.call(this,M);return h.set(P,y?.record??null),P},GPUQueue.prototype.submit=function(M){const y=Array.from(M);o.call(this,y);for(const P of y)h.get(P)?.submitted()};const p=Object.assign(document.createElement("canvas"),{width:e,height:t}),m=p.getContext("2d"),b={source:{width:e,height:t},processing:{width:e,height:t},output:{width:e,height:t},display:{width:e,height:t},css:{width:e,height:t},screen:null,limited:!1},w={engine:"fast",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};let S=0;try{const M=performance.now()+2e3;for(;performance.now()<M;)m.fillStyle="#101010",m.fillRect(0,0,e,t),m.fillStyle="#eeeeee",m.fillRect(S%20*e/256,t/3,e/4,t/4),l="capture",await f.captureFrame(p,{width:e,height:t},S/60,{width:256,tier:1}),S>0&&(l="warp",await f.renderTemporal(b,w,.5)),S++;v.reset();const y=performance.now();let P=0;for(;performance.now()-y<i*1e3;)m.fillStyle="#101010",m.fillRect(0,0,e,t),m.fillStyle="#eeeeee",m.fillRect(S%20*e/256,t/3,e/4,t/4),l="capture",await f.captureFrame(p,{width:e,height:t},S/60,{width:256,tier:1}),l="warp",await f.renderTemporal(b,w,.5),S++,P++;return await x.queue.onSubmittedWorkDone(),{variant:c,width:e,height:t,seconds:i,elapsedMs:performance.now()-y,pairs:P,profile:v.snapshot(),note:"compute only; no Canvas present and no output scheduler"}}finally{GPUAdapter.prototype.requestDevice=s,GPUDevice.prototype.createCommandEncoder=r,GPUCommandEncoder.prototype.beginComputePass=n,GPUCommandEncoder.prototype.finish=a,GPUQueue.prototype.submit=o,u.destroy(),f.destroy()}}const kt=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,Gt=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Ut=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Rt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,At=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
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
`;class _t{enabled=!1;signatures=!0;generation=0;timestampSupported=null;values=new Map;counts=new Map;configure(e,t=!0){this.enabled=e,this.signatures=t,this.reset()}reset(){this.generation++,this.values.clear(),this.counts.clear()}mark(){return this.enabled?performance.now():0}elapsed(e,t){this.enabled&&this.sample(e,performance.now()-t)}sample(e,t){if(!this.enabled||!Number.isFinite(t))return;let i=this.values.get(e);i||(i=[],this.values.set(e,i)),i.length<8192&&i.push(t)}count(e,t=1){this.counts.set(e,(this.counts.get(e)??0)+t)}snapshot(){const e={};for(const[t,i]of this.values){const s=[...i].sort((n,a)=>n-a),r=i.reduce((n,a)=>n+a,0);e[t]={count:i.length,mean:r/i.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],max:s[s.length-1],total:r}}return{enabled:this.enabled,timestampSupported:this.timestampSupported,stages:e,counters:Object.fromEntries(this.counts)}}}const E=new _t,Dt=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,Lt=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,Bt=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`,Ft=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`;class me{constructor(e,t,i,s,r){this.device=e,this.timer=t,this.down=i,this.estimate=s,this.interpolate=r,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summaries=[0,1].map(()=>e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})),this.reads=[0,1,2].map(()=>({buffer:e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1}))}device;timer;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summaries;key="";count=0;serial=0;dead=!1;times=[0,0,0];downGroups=[];flowGroups=[];warpGroups=new Map;warpTarget;banks=[void 0,void 0];reads=[];full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e,t){e.pushErrorScope("validation");try{const i=[];for(const s of[Lt,Bt,Ft]){const r=e.createShaderModule({code:Dt+`
`+s}),a=(await r.getCompilationInfo()).messages.filter(o=>o.type==="error");if(a.length)throw new Error("움직임 셰이더 컴파일 실패: "+a.map(o=>o.message).join("; "));i.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:r,entryPoint:"main"}}))}return new me(e,t,i[0],i[1],i[2])}finally{const i=await e.popErrorScope();if(i)throw new Error("움직임 셰이더 초기화 실패: "+i.message)}}sizeKey(e,t){const i=Math.min(e.width,t.width);return[e.width,e.height,i,Math.max(8,Math.round(e.height*i/e.width))].join(",")}needsResize(e,t){return this.key!==this.sizeKey(e,t)}matchesSource(e){return this.full.width===e.width&&this.full.height===e.height}pairs(){return this.banks.filter(e=>!!e&&e.ready).sort((e,t)=>e.a-t.a)}contains(e){return this.banks.some(t=>t?.id===e.id)}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){this.config=t;const i=this.sizeKey(e,t);if(i===this.key)return;this.destroyTextures();const s=Math.min(e.width,t.width),r=Math.max(8,Math.round(e.height*s/e.width));this.full=e,this.lowSize={width:s,height:r},this.grid={width:Math.ceil(s/8),height:Math.ceil(r/8)};const n=(a,o)=>this.device.createTexture({size:[a.width,a.height],format:o,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[0,1,2].map(()=>n(e,"rgba8unorm")),this.low=[0,1,2].map(()=>n(this.lowSize,"rgba8unorm")),this.flows=[0,1,2,3].map(()=>n(this.grid,"rgba16float")),this.downGroups=this.frames.map((a,o)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:a.createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1,2].flatMap(a=>[0,1].map(o=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[(a+2)%3].createView()},{binding:1,resource:this.low[a].createView()},{binding:2,resource:this.flows[o*2].createView()},{binding:3,resource:this.flows[o*2+1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summaries[o]}}]}))),this.key=i,this.reset()}enqueue(e,t,i,s,r){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const n=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,s);const a=this.count%3,o=(a+2)%3,u=Math.max(0,this.count-1)%2;this.times[a]=i,this.device.queue.writeBuffer(this.uniform,0,this.params());const l=E.mark();this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[a],colorSpace:"srgb"},[t.width,t.height]),E.elapsed("uploadCpuMs",l);const d=E.mark(),h=this.timer?.begin(),g=this.device.createCommandEncoder();let f=g.beginComputePass({timestampWrites:h?.stamp("downsample")});f.setPipeline(this.down),f.setBindGroup(0,this.downGroups[a]),f.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),f.end();let x;this.count>0&&(g.clearBuffer(this.summaries[u]),f=g.beginComputePass({timestampWrites:h?.stamp("flow")}),f.setPipeline(this.estimate),f.setBindGroup(0,this.flowGroups[a*2+u]),f.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),f.end(),E.count("flowDispatches"),x=this.reads.find(m=>!m.busy),x?(x.busy=!0,g.copyBufferToBuffer(this.summaries[u],0,x.buffer,0,32)):E.count("analysisReadSkipped")),E.elapsed("flowPrepareCpuMs",d),h?.resolve(g),this.device.queue.submit([g.finish()]),h?.submitted();const p={id:++this.serial,newest:a,previous:o,bank:u,a:this.times[o],b:i,ready:++this.count>1,sceneCut:!1,dynamic:!0,confidence:0,flowMs:performance.now()-n,flowSize:{...this.lowSize}};if(p.analysisAvailable=!!x,x){const m=x,b=E.mark();p.analysis=m.buffer.mapAsync(GPUMapMode.READ).then(()=>{const w=new Uint32Array(m.buffer.getMappedRange()),S=Math.max(1,w[4]),M=w[0]/S/65535,y=w[1]/S/65535,P={sceneCut:y>.24&&M>.12,dynamic:w[3]>0&&y>1e-4,confidence:w[2]/S/65535};return m.buffer.unmap(),E.elapsed("flowReadbackWaitMs",b),Object.assign(p,P,{flowMs:performance.now()-n}),P}).catch(w=>(this.dead||r(w),{sceneCut:!1,dynamic:!1,confidence:0})).finally(()=>{m.busy=!1})}return p.ready&&(this.banks[u]=p),this.pair=p,p}finally{this.device.popErrorScope().then(a=>{a&&!this.dead&&r(a)})}}async capture(e,t,i,s){const r=this.enqueue(e,t,i,s,n=>{throw n});return r.analysis?await r.analysis:await this.device.queue.onSubmittedWorkDone(),r}encodeWarp(e,t,i,s,r=this.pair){const n=this.banks.find(l=>l?.id===r.id);if(!n?.ready)throw new Error("유효한 원본 프레임 쌍을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups.clear());const a=n.newest*2+n.bank;let o=this.warpGroups.get(a);o||(o=this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[n.previous].createView()},{binding:1,resource:this.frames[n.newest].createView()},{binding:2,resource:this.flows[n.bank*2].createView()},{binding:3,resource:this.flows[n.bank*2+1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}},{binding:6,resource:{buffer:this.summaries[n.bank]}}]}),this.warpGroups.set(a,o)),this.device.queue.writeBuffer(this.uniform,0,this.params(i,n.sceneCut));const u=e.beginComputePass({timestampWrites:s?.stamp("warp")});u.setPipeline(this.interpolate),u.setBindGroup(0,o),u.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),u.end()}reset(){this.count=0,this.times=[0,0,0],this.banks=[void 0,void 0],this.pair.ready=!1,this.warpTarget=void 0,this.warpGroups.clear()}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups.clear()}destroy(){if(!this.dead){this.dead=!0,this.destroyTextures(),this.uniform.destroy();for(const e of this.summaries)e.destroy();for(const e of this.reads)e.buffer.destroy();this.reads=[]}}}class zt{slots=[];dead=!1;constructor(e){if(E.enabled&&e.features.has("timestamp-query"))for(let t=0;t<4;t++)this.slots.push({query:e.createQuerySet({type:"timestamp",count:16}),resolve:e.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:e.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1})}begin(){if(this.dead||!E.enabled)return null;const e=this.slots.find(t=>!t.busy);return e?(e.busy=!0,new qt(e,E.generation,()=>this.dead)):(E.count("timestampSkipped"),null)}destroy(){this.dead=!0;for(const e of this.slots)e.query.destroy(),e.resolve.destroy(),e.read.destroy();this.slots=[]}}class qt{constructor(e,t,i){this.slot=e,this.generation=t,this.dead=i}slot;generation;dead;names=[];stamp(e){const t=this.names.length*2;return this.names.push(e),{querySet:this.slot.query,beginningOfPassWriteIndex:t,endOfPassWriteIndex:t+1}}resolve(e){this.names.length&&(e.resolveQuerySet(this.slot.query,0,this.names.length*2,this.slot.resolve,0),e.copyBufferToBuffer(this.slot.resolve,0,this.slot.read,0,this.names.length*16))}abort(){this.names=[],this.slot.busy=!1}submitted(){if(!this.names.length){this.slot.busy=!1;return}const e=E.mark();this.slot.read.mapAsync(GPUMapMode.READ).then(()=>{if(!this.dead()&&this.generation===E.generation){const t=new BigUint64Array(this.slot.read.getMappedRange());this.names.forEach((i,s)=>E.sample("gpu."+i+"Ms",Number(t[s*2+1]-t[s*2])/1e6)),E.elapsed("diagnosticReadbackWaitMs",e)}this.slot.read.unmap()}).catch(()=>{this.dead()||E.count("timestampReadError")}).finally(()=>{this.slot.busy=!1})}}const Wt=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;class ge{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:Wt}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new ge(e,i)}encode(e,t,i){e.clearBuffer(this.value);const s=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),r=e.beginComputePass({timestampWrites:i?.stamp("signature")});r.setPipeline(this.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(4),r.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){const e=E.mark();await this.readback.mapAsync(GPUMapMode.READ),E.elapsed("signatureReadbackWaitMs",e);const t=new Uint32Array(this.readback.getMappedRange()),i=t[0].toString(16)+":"+t[1].toString(16);return this.readback.unmap(),i}destroy(){this.value.destroy(),this.readback.destroy()}}class we{constructor(e,t,i,s,r){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=s,this.presentPipeline=r,this.timer=new zt(t),this.maxDimension=t.limits.maxTextureDimension2D;const n=e.getContext("webgpu");if(!n)throw new Error("WebGPU canvas context unavailable.");this.context=n,n.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;timer;inflight=0;streamSignatureBusy=!1;submissionId=0;pendingSince=new Map;temporalEpoch=0;retired=new Set;onStreamAvailable;get pendingGPU(){return this.inflight}get canStream(){return!this.dead&&this.inflight<3}stalled(e=performance.now()){const t=this.pendingSince.values().next().value;return t!==void 0&&e-t>1500}canCapture(e,t){return this.canStream&&(!this.motion?.needsResize(e,t)||this.inflight===0)}temporalPairs(){return this.motion?.pairs()??[]}loss=()=>{};motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:kt,denoise:Gt,upscale:Ut,composite:Rt}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const s=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!s)throw new Error("No WebGPU adapter.");E.timestampSupported=s.features.has("timestamp-query");const r=await s.requestDevice({requiredFeatures:E.enabled&&E.timestampSupported?["timestamp-query"]:[]});try{const n=[i.denoise,i.upscale,i.composite].map(d=>r.createShaderModule({code:i.common+`
`+At+`
`+d}));for(const d of n){const g=(await d.getCompilationInfo()).messages.filter(f=>f.type==="error");if(g.length)throw new Error(g.map(f=>`WGSL ${f.lineNum}: ${f.message}`).join("; "))}const[a,o,u]=await Promise.all([r.createComputePipelineAsync({layout:"auto",compute:{module:n[0],entryPoint:"main"}}),r.createComputePipelineAsync({layout:"auto",compute:{module:n[1],entryPoint:"main"}}),r.createRenderPipelineAsync({layout:"auto",vertex:{module:n[2],entryPoint:"vertex"},fragment:{module:n[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),l=new we(e,r,a,o,u);return l.loss=t,r.lost.then(d=>{l.dead||t(`WebGPU device lost: ${d.message||d.reason}`)}),r.addEventListener("uncapturederror",d=>{l.dead||t(`WebGPU: ${d.error.message}`)}),l}catch(n){throw r.destroy(),n}}resize(e){const{source:t,output:i}=e,s=`${t.width},${t.height},${i.width},${i.height}`;if(s===this.key)return;if(this.textures.forEach(u=>u.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[u,l]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][u],size:[l.width,l.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[r,n,a]=this.textures.map(u=>u.createView()),o=(u,l,d)=>this.device.createBindGroup({layout:u,entries:[{binding:0,resource:l},{binding:1,resource:d},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=o(this.clean.getBindGroupLayout(0),r,n),this.upscaleRaw=o(this.reconstruct.getBindGroupLayout(0),r,a),this.upscaleClean=o(this.reconstruct.getBindGroupLayout(0),n,a),this.compositeGroup=o(this.presentPipeline.getBindGroupLayout(0),r,a),this.compositeRaw=o(this.presentPipeline.getBindGroupLayout(0),r,r),this.compositeClean=o(this.presentPipeline.getBindGroupLayout(0),r,n),this.key=s}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,s){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const r=await me.create(this.device,this.timer);if(this.dead)throw r.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=r}return this.motion.capture(e,t,i,s)}streamError(e){this.dead||this.loss("WebGPU 보간 오류: "+(e instanceof Error?e.message:String(e)))}completion(){const e=performance.now(),t=++this.submissionId;return this.pendingSince.set(t,e),this.inflight++,E.sample("inflightDepth",this.inflight),this.device.queue.onSubmittedWorkDone().then(()=>{const i=performance.now()-e;return E.sample("asyncCompletionLatencyMs",i),i},i=>(this.streamError(i),performance.now()-e)).finally(()=>{this.pendingSince.delete(t),this.inflight--,this.dead||this.onStreamAvailable?.()})}async enqueueFrame(e,t,i,s){if(!this.motion){const n=await me.create(this.device,this.timer);if(this.dead)throw n.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=n}E.enabled&&E.signatures&&!this.signature&&(this.signature=await ge.create(this.device));const r=this.motion.enqueue(e,t,i,s,n=>this.streamError(n));return this.completion(),r}submitTemporal(e,t,i,s,r){if(!this.canStream||!this.motion?.pair.ready)return null;if(!this.motion.matchesSource(e.source))return E.count("discard.resolutionChanged"),null;if(!this.motion.contains(s))return E.count("discard.bufferMismatch"),null;if(`${e.source.width},${e.source.height},${e.output.width},${e.output.height}`!==this.key&&this.inflight>0)return null;const a=performance.now();this.device.pushErrorScope("validation"),this.device.pushErrorScope("out-of-memory");try{this.resize(e);const{source:o,output:u}=e;this.device.queue.writeBuffer(this.uniform,0,new Float32Array([o.width,o.height,u.width,u.height,t.sharpness,t.denoise,t.engine==="balanced"?1:0,t.comparison?1:0,t.divider,t.contentMode==="animation"?1:0,t.original?1:0,0,(t.saturation??100)/100,(t.brightness??100)/100,t.upscale===!1?0:1,0]));const l=this.device.createCommandEncoder(),d=this.timer.begin();this.motion.encodeWarp(l,this.textures[0],i,d,s);const h=!t.original&&t.engine==="balanced"&&t.denoise>0;if(h){const m=l.beginComputePass({timestampWrites:d?.stamp("denoise")});m.setPipeline(this.clean),m.setBindGroup(0,this.denoiseGroup),m.dispatchWorkgroups(Math.ceil(o.width/8),Math.ceil(o.height/8)),m.end()}if(!t.original&&t.upscale!==!1){const m=l.beginComputePass({timestampWrites:d?.stamp("upscale")});m.setPipeline(this.reconstruct),m.setBindGroup(0,h?this.upscaleClean:this.upscaleRaw),m.dispatchWorkgroups(Math.ceil(u.width/8),Math.ceil(u.height/8)),m.end()}if(r&&!r())return d?.abort(),null;const g=this.context.getCurrentTexture(),f=l.beginRenderPass({timestampWrites:d?.stamp("composite"),colorAttachments:[{view:g.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});f.setPipeline(this.presentPipeline),f.setBindGroup(0,t.upscale===!1?h?this.compositeClean:this.compositeRaw:this.compositeGroup),f.draw(3),f.end();const x=!!this.signature&&E.enabled&&E.signatures&&!this.streamSignatureBusy;x&&(this.streamSignatureBusy=!0,this.signature.encode(l,g,d)),d?.resolve(l),this.device.queue.submit([l.finish()]),d?.submitted(),E.count("canvasSubmissions");const p=this.completion();if(x){const m=E.generation,b=this.temporalEpoch;this.signature.read().then(w=>{!this.dead&&b===this.temporalEpoch&&m===E.generation&&(this.lastSignature=w)}).catch(w=>{this.dead||this.streamError(w)}).finally(()=>{b===this.temporalEpoch&&(this.streamSignatureBusy=!1)})}return E.sample("outputSubmitCpuMs",performance.now()-a),{cpuSubmitMs:performance.now()-a,latencyMs:performance.now()-a,gpuMs:null,completion:p}}finally{this.device.popErrorScope().then(o=>{o&&this.streamError(o)}),this.device.popErrorScope().then(o=>{o&&this.streamError(o)})}}resetTemporal(){this.motion?.reset()}releaseTemporal(){const e=this.motion,t=this.signature;this.motion=void 0,this.signature=void 0,this.lastSignature=null,this.streamSignatureBusy=!1,this.temporalEpoch++;let i=!1;const s=()=>{i||(i=!0,e?.destroy(),t?.destroy(),this.retired.delete(s))};this.dead||this.inflight===0?s():(this.retired.add(s),this.device.queue.onSubmittedWorkDone().then(s,s))}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,s=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const r=performance.now(),n=this.device;n.pushErrorScope("validation"),n.pushErrorScope("out-of-memory");let a;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const m=await ge.create(this.device);if(this.dead)throw m.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=m}const{source:h,output:g}=t;n.queue.writeBuffer(this.uniform,0,new Float32Array([h.width,h.height,g.width,g.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&n.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[h.width,h.height]);const f=n.createCommandEncoder(),x=this.timer.begin();e||this.motion.encodeWarp(f,this.textures[0],s,x);const p=!i.original&&i.engine==="balanced"&&i.denoise>0;if(p){const m=f.beginComputePass({timestampWrites:x?.stamp("denoise")});m.setPipeline(this.clean),m.setBindGroup(0,this.denoiseGroup),m.dispatchWorkgroups(Math.ceil(h.width/8),Math.ceil(h.height/8)),m.end()}if(!i.original&&i.upscale!==!1){const m=f.beginComputePass({timestampWrites:x?.stamp("upscale")});m.setPipeline(this.reconstruct),m.setBindGroup(0,p?this.upscaleClean:this.upscaleRaw),m.dispatchWorkgroups(Math.ceil(g.width/8),Math.ceil(g.height/8)),m.end()}this.selectedComposite=i.upscale===!1?p?this.compositeClean:this.compositeRaw:this.compositeGroup,x?.resolve(f),n.queue.submit([f.finish()]),x?.submitted()}catch(h){a=h}const o=performance.now()-r,u=E.mark(),l=await n.popErrorScope(),d=await n.popErrorScope();if(E.elapsed("renderErrorScopeWaitMs",u),a)throw a;if(l||d)throw new Error((l||d).message);if(e){const h=E.mark();await n.queue.onSubmittedWorkDone(),E.elapsed("renderFenceWaitMs",h)}if(this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:o,latencyMs:performance.now()-r,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),s=this.timer.begin(),r=this.context.getCurrentTexture(),n=i.beginRenderPass({timestampWrites:s?.stamp("composite"),colorAttachments:[{view:r.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});n.setPipeline(this.presentPipeline),n.setBindGroup(0,this.selectedComposite??this.compositeGroup),n.draw(3),n.end(),this.measureSignature&&this.signature.encode(i,r,s);const a=e==="full"?this.canvas.width:1,o=e==="full"?this.canvas.height:1,u=Math.ceil(a*4/256)*256,l=e!=="none"?this.device.createBuffer({size:u*o,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;l&&i.copyTextureToBuffer({texture:r},{buffer:l,bytesPerRow:u},[a,o]),s?.resolve(i),this.device.queue.submit([i.finish()]),s?.submitted(),E.count("canvasSubmissions");const d=performance.now()-t,h=E.mark(),g=await this.device.popErrorScope();if(E.elapsed("presentErrorScopeWaitMs",h),g)throw new Error(g.message);const f=E.mark();if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),E.elapsed("presentFenceWaitMs",f),this.lastPixels=null,l)try{await l.mapAsync(GPUMapMode.READ);const x=new Uint8Array(l.getMappedRange()),p=new Uint8ClampedArray(a*o*4),m=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let b=0;b<o;b++)for(let w=0;w<a;w++){const S=b*u+w*4,M=(b*a+w)*4;p[M]=x[S+(m?2:0)],p[M+1]=x[S+1],p[M+2]=x[S+(m?0:2)],p[M+3]=x[S+3]}this.lastPixels=p,l.unmap()}finally{l.destroy()}return d}destroy(){if(!this.dead){this.dead=!0,this.device.destroy();for(const e of[...this.retired])e();this.timer.destroy(),this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy()}}}function ve(c,e,t=0){const i=Object.assign(document.createElement("canvas"),{width:256,height:144}),s=i.getContext("2d");if(s.fillStyle="#101010",s.fillRect(0,0,256,144),c==="pan"||c==="occlusion")for(let r=0;r<144;r+=4)for(let n=-16;n<272;n+=4){const a=25+((n*17+r*13)%47+47)%47;s.fillStyle=`rgb(${a},${a+8},${a+16})`,s.fillRect(n+(c==="pan"?e*8:0),r,4,4)}if(c!=="pan"){const r=(n,a,o)=>{s.fillStyle=o,s.fillRect(n,a,55,43),s.fillStyle="#4080c0",s.fillRect(n+8,a+8,16,16),s.fillStyle="#80c040",s.fillRect(n+31,a+24,12,12)};r(29+t+e*12,43+t,"#eeeeee"),c==="opposed"&&r(153+t-e*8,85+t,"#dddddd")}return i}const It=c=>c.getContext("2d").getImageData(0,0,256,144).data;async function Ot(c){const e=document.createElement("canvas"),t=await(c==="previous"?we:A).create(e,()=>{}),i=[],s={width:256,height:144},r={source:s,output:s,processing:s,display:s,css:s,screen:null,limited:!1},n={engine:"fast",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};try{for(const a of["object","pan","occlusion","opposed"])for(const o of a==="pan"?[0]:[0,3]){t.resetTemporal();const u=ve(a,0,o),l=ve(a,1,o);await t.captureFrame(u,s,0,{width:256,tier:1});const d=await t.captureFrame(l,s,1/60,{width:256,tier:1});for(const h of[.25,.5,.75]){await t.renderTemporal(r,n,h),await t.present("full");const g=t.lastPixels,f=ve(a,h,o),x=It(f);let p=0,m=0,b=0,w=0;for(let M=0;M<144;M++)for(let y=0;y<256;y++)for(let P=0;P<3;P++){const T=(M*256+y)*4+P,R=g[T]-x[T];p+=Math.abs(R),m+=R*R,y>0&&y%8===0&&(b+=Math.abs(R-(g[T-4]-x[T-4])),w++)}const S=Object.assign(document.createElement("canvas"),s);S.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(g),256,144),0,0),i.push({pattern:a,offset:o,alpha:h,mae:p/(256*144*3),rmse:Math.sqrt(m/(256*144*3)),boundaryResidual:b/w,confidence:d.confidence,image:S.toDataURL(),reference:f.toDataURL(),sourceA:u.toDataURL(),sourceB:l.toDataURL()})}}return i}finally{t.destroy()}}const be=c=>{const e=[];do e.unshift(c%256),c=Math.floor(c/256);while(c);return new Uint8Array(e)},H=c=>{const e=new Uint8Array(c.reduce((i,s)=>i+s.length,0));let t=0;for(const i of c)e.set(i,t),t+=i.length;return e};function $(c,e){let t=1;for(;e.length>=2**(7*t)-1;)t++;const i=be(e.length),s=new Uint8Array(t);return s.set(i,t-i.length),s[0]|=1<<8-t,H([be(c),s,e])}const z=(c,e)=>$(c,be(e)),he=(c,e)=>$(c,new TextEncoder().encode(e));async function $t(c,e,t,i=16,s="motion"){const r=new OffscreenCanvas(c,e),n=r.getContext("2d"),a=[],o=new VideoEncoder({output:f=>{const x=new Uint8Array(f.byteLength);f.copyTo(x),a.push({time:f.timestamp,key:f.type==="key",data:x})},error:f=>{throw f}});o.configure({codec:"vp8",width:c,height:e,framerate:t,bitrate:Math.max(4e5,c*e*2),latencyMode:"realtime"});for(let f=0;f<t*i;f++){const x=s==="static"?0:s==="held"?Math.floor(f/t*6)/6:f/t,p=x*(s==="fast-cut"?360:120)/(256*.4*2)%1,m=1-Math.abs(p*2-1),b=c*(.15+.4*m),w=e*.3,S=c/256;n.fillStyle=s==="fast-cut"&&Math.floor(x/8)%2?"#c0d0e0":"#101010",n.fillRect(0,0,c,e),n.fillStyle="#eeeeee",n.fillRect(b,w,48*S,48*S),n.fillStyle="#4080c0",n.fillRect(b+8*S,w+8*S,16*S,16*S),n.fillStyle="#80c040",n.fillRect(b+28*S,w+28*S,12*S,12*S);const M=new VideoFrame(r,{timestamp:Math.round(f*1e6/t),duration:Math.round(1e6/t)});o.encode(M,{keyFrame:f%t===0}),M.close(),o.encodeQueueSize>6&&await o.flush()}await o.flush(),o.close();const u=$(440786851,H([z(17030,1),z(17143,1),z(17138,4),z(17139,8),he(17026,"webm"),z(17031,4),z(17029,2)])),l=new Uint8Array(8);new DataView(l.buffer).setFloat64(0,i*1e3);const d=$(357149030,H([z(2807729,1e6),$(17545,l),he(19840,"Clarity diagnostic"),he(22337,"Clarity diagnostic")])),h=$(374648427,$(174,H([z(215,1),z(29637,1),z(131,1),he(134,"V_VP8"),z(2352003,Math.round(1e9/t)),$(224,H([z(176,c),z(186,e)]))]))),g=[];for(let f=0;f<i;f++){const x=a.filter(p=>Math.floor(p.time/1e6)===f).map(p=>{const m=new Uint8Array(p.data.length+4),b=Math.round(p.time/1e3)-f*1e3;return m[0]=129,m[1]=b>>8&255,m[2]=b&255,m[3]=p.key?128:0,m.set(p.data,4),$(163,m)});g.push($(524531317,H([z(231,f*1e3),...x])))}return Array.from(H([u,$(408125543,H([d,h,...g]))]))}let ee,Re;async function Nt(c,e,t={},i="#eeeeee"){ee?.destroy(),Re?.remove();const s=document.createElement("canvas");Object.assign(s.style,{position:"fixed",top:"0",left:"0",width:"128px",height:"72px",zIndex:"2147483647"}),document.body.append(s),Re=s,ee=await A.create(s,()=>{});for(let l=0;l<3;l++){const d=Object.assign(document.createElement("canvas"),{width:128,height:72}),h=d.getContext("2d");h.fillStyle="#101010",h.fillRect(0,0,128,72),h.fillStyle=i,h.fillRect(24+l*8,24,32,24),await ee.captureFrame(d,{width:128,height:72},l/24,{width:128,tier:1})}const r=ee.temporalPairs(),n=r[c==="previous"?0:1],a={width:128,height:72},o=t.upscale?{width:256,height:144}:a,u=ee.submitTemporal({source:a,output:o,processing:o,display:a,css:a,screen:null,limited:!1},{engine:"fast",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100,...t},e,n);if(!u)throw new Error("캐시 프레임 제출 실패");return await u.completion,{expected:(c==="previous"?40:48)+8*e,pairs:r.map(l=>({a:l.a,b:l.b,id:l.id})),output:o}}function jt(c){window.clarityPerf={runArtifactChecks:Ot,classifySmallMotion:Ct,cachedPhase:Nt,computeOnly:Tt,makeClip:$t,configure:(e,t=!0)=>v.configure(e,t),reset:()=>v.reset(),snapshot:()=>v.snapshot(),load:c},window.addEventListener("pagehide",()=>ee?.destroy())}const Vt=`// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
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
`,Yt=`vec3 toLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(.04045)));}
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
`,Xt=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,Se=`
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
`,Ht=`#version 300 es
`+Se+`
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`,Kt=`#version 300 es
`+Se+Vt+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`,Qt=`#version 300 es
`+Se+Yt+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(adjustColor(clamp(result,0.,1.),colorSettings.x,colorSettings.y),1);}`,Jt=Object.freeze(Object.defineProperty({__proto__:null,composite:Qt,denoise:Ht,upscale:Kt,vertex:Xt},Symbol.toStringTag,{value:"Module"}));class Ne{constructor(e,t,i=Jt){this.canvas=e;const s=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"low-power"});if(!s)throw new Error("WebGL2 unavailable.");this.gl=s,this.maxDimension=s.getParameter(s.MAX_TEXTURE_SIZE),this.completionChannel.port2.onmessage=()=>this.completionPoll?.(),this.fb=s.createFramebuffer(),this.vao=s.createVertexArray(),s.bindVertexArray(this.vao),this.onContextLost=r=>{r.preventDefault(),this.dead||t("WebGL context lost.")},e.addEventListener("webglcontextlost",this.onContextLost);try{for(const r of[i.denoise,i.upscale,i.composite]){const n=this.compile(r,i.vertex);this.programs.push(n),this.uniforms.push(Object.fromEntries(["inputTex","originalTex","dims","settings","divider","contentMode","originalView","colorSettings"].map(a=>[a,s.getUniformLocation(n,a)])))}s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!0),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL)}catch(r){throw this.destroy(),r}}canvas;backend="WebGL2";maxPixels=8294400;maxDimension;gl;programs=[];textures=[];uniforms=[];pendingPresent;completionChannel=new MessageChannel;completionPoll;cancelWait;pollTimer=0;fb;vao;key="";dead=!1;onContextLost;compile(e,t){const i=this.gl,s=i.createProgram(),r=[];try{for(const[n,a]of[[i.VERTEX_SHADER,t],[i.FRAGMENT_SHADER,e]]){const o=i.createShader(n);if(r.push(o),i.shaderSource(o,a),i.compileShader(o),!i.getShaderParameter(o,i.COMPILE_STATUS))throw new Error(i.getShaderInfoLog(o)||"GLSL compilation failed");i.attachShader(s,o)}if(i.linkProgram(s),!i.getProgramParameter(s,i.LINK_STATUS))throw new Error(i.getProgramInfoLog(s)||"GLSL link failed");return s}catch(n){throw i.deleteProgram(s),n}finally{r.forEach(n=>i.deleteShader(n))}}resize(e){const{source:t,output:i}=e,s=`${t.width},${t.height},${i.width},${i.height}`;if(this.key===s)return;const r=this.gl;if(this.textures.forEach(n=>r.deleteTexture(n)),this.textures=[],Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe texture/memory limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const n of[t,t,i]){const a=r.createTexture();this.textures.push(a),r.bindTexture(r.TEXTURE_2D,a),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),r.texStorage2D(r.TEXTURE_2D,1,r.RGBA8,n.width,n.height)}this.key=s}async render(e,t,i){if(this.dead)throw new Error("WebGL engine destroyed.");const s=performance.now(),r=this.gl;this.resize(t),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.textures[0]),r.texSubImage2D(r.TEXTURE_2D,0,0,0,r.RGBA,r.UNSIGNED_BYTE,e);const n=(l,d,h,g,f)=>{const x=this.programs[l],p=this.uniforms[l];if(r.useProgram(x),r.bindVertexArray(this.vao),r.bindFramebuffer(r.FRAMEBUFFER,h?this.fb:null),h&&(r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,h,0),r.checkFramebufferStatus(r.FRAMEBUFFER)!==r.FRAMEBUFFER_COMPLETE))throw new Error("Incomplete GPU framebuffer.");r.viewport(0,0,g,f),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,d),r.uniform1i(p.inputTex,0),r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,this.textures[0]),r.uniform1i(p.originalTex,1),r.uniform4f(p.dims,t.source.width,t.source.height,t.output.width,t.output.height),r.uniform4f(p.settings,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0),r.uniform1f(p.divider,i.divider),r.uniform1f(p.contentMode,i.contentMode==="animation"?1:0),r.uniform1f(p.originalView,i.original?1:0),r.uniform2f(p.colorSettings,(i.saturation??100)/100,(i.brightness??100)/100),r.drawArrays(r.TRIANGLES,0,3)},a=!i.original&&i.engine==="balanced"&&i.denoise>0;a&&n(0,this.textures[0],this.textures[1],t.source.width,t.source.height),!i.original&&i.upscale!==!1&&n(1,this.textures[a?1:0],this.textures[2],t.output.width,t.output.height),this.pendingPresent=()=>n(2,this.textures[i.upscale===!1?a?1:0:2],null,t.output.width,t.output.height);const o=r.getError();if(o!==r.NO_ERROR)throw new Error(`WebGL rendering error 0x${o.toString(16)}`);const u=performance.now()-s;return await this.waitGPU(s),{cpuSubmitMs:u,latencyMs:performance.now()-s,gpuMs:null}}async present(){if(this.dead||!this.pendingPresent)throw new Error("No completed WebGL frame to present.");const e=performance.now();this.pendingPresent();const t=performance.now()-e,i=this.gl.getError();if(i!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${i.toString(16)}`);return await this.waitGPU(e),t}async waitGPU(e){const t=this.gl,i=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0);if(t.flush(),!i)throw new Error("GPU synchronization unavailable.");try{await new Promise((s,r)=>{let n=0;this.cancelWait=()=>r(new Error("WebGL engine destroyed during GPU work."));const a=()=>{if(this.dead||t.isContextLost()){r(new Error("WebGL context unavailable."));return}const o=t.clientWaitSync(i,0,0);o===t.ALREADY_SIGNALED||o===t.CONDITION_SATISFIED?s():o===t.WAIT_FAILED||performance.now()-e>1200?r(new Error("GPU completion timed out.")):++n%8===0?this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0):this.completionChannel.port1.postMessage(0)};this.completionPoll=a,a()})}finally{this.completionPoll=void 0,this.cancelWait=void 0,clearTimeout(this.pollTimer),t.deleteSync(i)}}destroy(){if(this.dead)return;this.dead=!0;const e=this.gl;this.cancelWait?.(),clearTimeout(this.pollTimer),this.completionChannel.port1.close(),this.completionChannel.port2.close(),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.textures.forEach(t=>e.deleteTexture(t)),this.programs.forEach(t=>e.deleteProgram(t)),e.deleteFramebuffer(this.fb),e.deleteVertexArray(this.vao),e.getExtension("WEBGL_lose_context")?.loseContext()}}async function ie(c,e,t,i){let s="";if(t!=="webgl2"){const n=c();try{return{engine:await A.create(n,e,i?.webgpu),canvas:n,reason:s}}catch(a){if(n.remove(),s=a instanceof Error?a.message:String(a),t==="webgpu")throw a}}const r=c();try{return{engine:new Ne(r,e,i?.webgl),canvas:r,reason:s}}catch(n){throw r.remove(),new Error(`${s?`WebGPU: ${s}. `:""}WebGL2: ${n instanceof Error?n.message:String(n)}`)}}const Ae={eco:{engine:"fast",sharpness:.55,denoise:0,budget:.5},balanced:{engine:"balanced",sharpness:.8,denoise:.7,budget:.65},quality:{engine:"balanced",sharpness:1,denoise:1,budget:.8}},Zt={windowMs:2200,cooldownMs:5e3,promoteWindows:2,demoteWindows:2,low:.46,high:.9,maxMiss:.15};class ei{constructor(e=Zt){this.config=e}config;profile="eco";workload=1;ema=0;start=0;lastChange=-1/0;count=0;misses=0;good=0;bad=0;warmup=0;reset(e=performance.now()){this.profile="eco",this.workload=1,this.ema=0,this.start=e,this.lastChange=-1/0,this.count=this.misses=this.good=this.bad=this.warmup=0}sample(e,t,i,s){if(this.warmup++<6)return!1;const r=e/Math.max(4,t*Ae[this.profile].budget);if(this.ema=this.count===0&&this.ema===0?r:.12*r+.88*this.ema,this.count++,i&&this.misses++,s-this.start<this.config.windowMs||this.count<12)return!1;const n=this.misses/this.count;if(this.bad=this.ema>this.config.high||n>this.config.maxMiss?this.bad+1:0,this.good=this.ema<this.config.low&&n<.03?this.good+1:0,this.start=s,this.count=this.misses=0,s-this.lastChange<this.config.cooldownMs)return!1;const a=["eco","balanced","quality"];let o=a.indexOf(this.profile),u=!1;return this.bad>=this.config.demoteWindows?(o>0?this.profile=a[--o]:this.workload=Math.max(.4,this.workload*.8),u=!0):this.good>=this.config.promoteWindows&&(this.workload<1?(this.workload=Math.min(1,this.workload/.8),u=!0):o<a.length-1&&(this.profile=a[++o],u=!0)),u&&(this.lastChange=s,this.bad=this.good=0),u}options(e){const t=e.profile==="ultra"||e.engine==="anime4k"||e.engine==="neural",i=e.adaptive?this.profile:e.profile==="ultra"?"quality":e.profile,s=Ae[i];return{profile:i,unavailable:t,options:{engine:e.engine==="fast"||e.engine==="balanced"?e.engine:s.engine,sharpness:e.sharpness/100*(e.automaticStrength?s.sharpness:1),denoise:e.denoise/100*(e.automaticStrength?s.denoise:1),comparison:e.comparison,divider:e.divider,contentMode:e.contentMode,original:e.original||e.comparison&&e.divider>=1,saturation:e.saturation,brightness:e.brightness}}}}const ti={"720p":{height:720,maxSource:480},"1080p":{height:1080,maxSource:720},"1440p":{height:1440,maxSource:1080},"2160p":{height:2160,maxSource:1440}};function je(c,e,t,i,s=8192,r=8294400,n=1,a=null,o=!1,u=c.height){const l=i==="original"?null:ti[i],d=!!l&&u<=l.maxSource&&c.height<l.height,h=d?{width:Math.round(c.width*l.height/c.height),height:l.height}:{...c},g=c.width*c.height*(o?20:8),f=(o?256:224)*1024*1024,x=Math.max(0,(f-g-(o?4*1024*1024:0))/8),p=d?Math.max(c.width/h.width,n):1,m=Math.min(p,s/h.width,s/h.height,Math.sqrt(Math.min(r,x)/(h.width*h.height)));if(!d&&m<.999)throw new Error("원본 해상도가 GPU 텍스처 또는 메모리 한도를 초과하여 원본 플레이어로 복귀합니다.");const b={width:Math.max(1,Math.floor(h.width*m)),height:Math.max(1,Math.floor(h.height*m))};return{source:{...c},processing:{...b},output:b,requested:h,display:{width:Math.round(e.width*t),height:Math.round(e.height*t)},css:e,screen:a,eligible:d,limited:m<.98,estimatedBytes:g+b.width*b.height*8+(o?4*1024*1024:0),resolutionReason:i==="original"?"원본 해상도: 업스케일링을 생략합니다.":d?m<.98?"GPU 성능·메모리 한도로 실제 처리 해상도를 낮췄습니다.":"선택한 목표 해상도로 GPU 재구성합니다.":"현재 원본에는 선택한 업스케일링 조건이 적용되지 않습니다."}}class ii{metrics=et();intervalMs=1e3/30;previousMedia=null;previousFrames=0;outputs=[];frame(e,t,i,s){if(this.previousMedia!==null){const r=e-this.previousMedia,n=t-this.previousFrames;if(r>0&&r<1&&n>0&&n<120){const a=r*1e3/n;a>=4&&a<=500&&(this.intervalMs=this.intervalMs*.85+a*.15),this.metrics.sourceFPS=1e3/this.intervalMs}}this.previousMedia=e,this.previousFrames=t,this.metrics.latenessMs=Math.max(0,i-s)}discontinuity(){this.previousMedia=null,this.previousFrames=0,this.outputs=[],this.metrics.sourceFPS=null}complete(e,t,i){this.recordTiming(e),this.submission(t,i)}recordTiming(e){const t=(i,s)=>i===null?s:.15*s+.85*i;this.metrics.latencyMs=t(this.metrics.latencyMs,e.latencyMs),this.metrics.cpuSubmitMs=t(this.metrics.cpuSubmitMs,e.cpuSubmitMs),this.metrics.gpuMs=e.gpuMs===null?null:t(this.metrics.gpuMs,e.gpuMs)}submission(e,t){if(e)for(this.outputs.push(t);this.outputs.length>0&&t-this.outputs[0]>=2e3;)this.outputs.shift()}snapshot(e=performance.now()){return this.outputs=this.outputs.filter(t=>e-t<2e3),this.metrics.processedFPS=this.outputs.length<2?0:(this.outputs.length-1)*1e3/Math.max(1,e-this.outputs[0]),{...this.metrics}}}class si{changes;start;constructor(e=performance.now()){this.start=e,this.changes=[{at:e,visible:!1}]}set(e,t=performance.now()){this.changes[this.changes.length-1].visible!==e&&this.changes.push({at:t,visible:e}),this.trim(t)}trim(e){for(;this.changes.length>1&&this.changes[1].at<=e-2e3;)this.changes.shift()}percent(e=performance.now()){this.trim(e);const t=Math.max(this.start,e-2e3);let i=0;for(let s=0;s<this.changes.length;s++)this.changes[s].visible&&(i+=Math.max(0,(this.changes[s+1]?.at??e)-Math.max(t,this.changes[s].at)));return e>t?i/(e-t)*100:0}}class ri{constructor(e,t,i,s){this.video=e,this.process=t,this.skip=i,this.error=s}video;process;skip;error;callback=0;running=!1;busy=!1;revision=0;lastTime=-1;refreshPending=!1;start(){this.running||(this.running=!0,this.schedule())}schedule(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{this.callback=0,this.schedule(),t.mediaTime!==this.lastTime&&(this.lastTime=t.mediaTime,this.dispatch(t))}))}refresh(){this.running&&this.video.readyState>=2&&this.dispatch(null)}invalidate(){this.revision++,this.lastTime=-1}dispatch(e){const t=++this.revision;if(this.busy){(!e||this.video.paused)&&(this.refreshPending=!0),this.skip();return}this.busy=!0,this.process({metadata:e,current:()=>this.running&&t===this.revision}).catch(i=>{this.running&&this.error(i)}).finally(()=>{this.busy=!1,this.refreshPending&&this.running&&(this.refreshPending=!1,this.refresh())})}stop(){this.running=!1,this.refreshPending=!1,this.invalidate(),this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.callback=0}}class ni{constructor(e,t,i){this.video=e,this.moveDivider=i,this.canvas=t,this.parent=e.parentElement,getComputedStyle(this.parent).position==="static"&&(this.originalPosition=this.parent.style.position,this.parent.style.position="relative"),t.className="clarity-gpu-overlay";const s=Number.parseInt(getComputedStyle(e).zIndex,10);Object.assign(t.style,{position:"absolute",pointerEvents:"none",zIndex:String(Number.isFinite(s)?s+1:1),display:"none",maxWidth:"none",maxHeight:"none",filter:"none",opacity:"1",transform:"none"}),t.setAttribute("aria-hidden","true"),this.parent.append(t),this.line=document.createElement("div"),this.handle=document.createElement("div"),Object.assign(this.line.style,{position:"absolute",display:"none",pointerEvents:"none",zIndex:String(Number.isFinite(s)?s+2:2),borderLeft:"1px solid rgba(255,255,255,.8)"}),Object.assign(this.handle.style,{position:"absolute",top:"12%",height:"65%",left:"-9px",width:"18px",pointerEvents:"auto",cursor:"ew-resize",touchAction:"none"}),this.handle.role="slider",this.handle.tabIndex=0,this.handle.setAttribute("aria-label","원본과 보정 영상 비교 경계"),this.handle.setAttribute("aria-valuemin","0"),this.handle.setAttribute("aria-valuemax","100"),this.line.append(this.handle),this.parent.append(this.line);const r=n=>{const a=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(n-a.left)/a.width)),this.moveDivider(this.divider),this.align()};this.handle.addEventListener("pointerdown",n=>{n.stopPropagation(),n.preventDefault(),this.handle.setPointerCapture(n.pointerId),r(n.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("pointermove",n=>{this.handle.hasPointerCapture(n.pointerId)&&r(n.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("keydown",n=>{(n.key==="ArrowLeft"||n.key==="ArrowRight")&&(n.preventDefault(),n.stopPropagation(),this.divider=Math.max(.02,Math.min(.98,this.divider+(n.key==="ArrowLeft"?-.02:.02))),this.moveDivider(this.divider),this.align())},{signal:this.abort.signal}),this.align()}video;moveDivider;canvas;line;handle;parent;abort=new AbortController;originalPosition=null;visible=!1;comparing=!1;divider=.5;css={width:1,height:1};shows=0;hides=0;get transitions(){return{shows:this.shows,hides:this.hides}}get displayed(){return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=="none"}align(){const e=this.video.getBoundingClientRect(),t=this.parent.getBoundingClientRect(),i=this.parent.offsetWidth>0&&t.width>0?t.width/this.parent.offsetWidth:1,s=this.parent.offsetHeight>0&&t.height>0?t.height/this.parent.offsetHeight:1,r=this.video.videoWidth||e.width,n=this.video.videoHeight||e.height,a=Math.min(e.width/r,e.height/n),o=r*a,u=n*a,l=(e.left-t.left+(e.width-o)/2)/Math.max(.01,i)+this.parent.scrollLeft-this.parent.clientLeft,d=(e.top-t.top+(e.height-u)/2)/Math.max(.01,s)+this.parent.scrollTop-this.parent.clientTop;return this.css={width:o/Math.max(.01,i),height:u/Math.max(.01,s)},Object.assign(this.canvas.style,{left:`${l}px`,top:`${d}px`,width:`${this.css.width}px`,height:`${this.css.height}px`}),Object.assign(this.line.style,{left:`${l+this.css.width*this.divider}px`,top:`${d}px`,height:`${this.css.height}px`}),this.handle.setAttribute("aria-valuenow",String(Math.round(this.divider*100))),{width:o,height:u}}compare(e,t){e===this.comparing&&t===this.divider||(this.comparing=e,this.divider=t,this.align(),this.line.style.display=this.visible&&e?"block":"none")}show(){this.visible||(this.shows++,v.count("overlay.show")),this.visible=!0,this.canvas.style.display="block",this.line.style.display=this.comparing?"block":"none"}hide(){this.visible&&(this.hides++,v.count("overlay.hide")),this.visible=!1,this.canvas.style.display="none",this.line.style.display="none"}destroy(){this.hide(),this.abort.abort(),this.canvas.remove(),this.line.remove(),this.originalPosition!==null&&(this.parent.style.position=this.originalPosition)}}const W=45,Ve=c=>Math.max(W,Math.min(W,Math.max(0,c))*2),fe=c=>Ve(c)+W;class ai{previous=0;intervals=[];hz=null;tick(e){if(this.previous){const t=e-this.previous;if(t>=4&&t<=50&&(this.intervals.push(t),this.intervals.length>40&&this.intervals.shift(),this.intervals.length>=10)){const i=[...this.intervals].sort((s,r)=>s-r);this.hz=1e3/i[Math.floor(i.length/2)]}}this.previous=e}reset(){this.previous=0,this.intervals=[],this.hz=null}}class oi{intervals=[];get samples(){return this.intervals.length}add(e){e>=4&&e<=250&&(this.intervals.push(e),this.intervals.length>40&&this.intervals.shift())}get period(){if(!this.intervals.length)return null;const e=[...this.intervals].sort((t,i)=>t-i);return e[Math.floor(e.length/2)]}reset(){this.intervals=[]}}class ci{offsets=[];offset=0;rate=1;previous=-1;ready=!1;observe(e,t,i){const s=this.previous>=0&&(e<this.previous||i!==this.rate);s&&this.reset(),this.rate=i,this.previous=e,this.offsets.push(e*1e3-t*i),this.offsets.length>24&&this.offsets.shift();const r=[...this.offsets].sort((n,a)=>n-a);return this.offset=r[Math.floor(r.length/2)],this.ready=this.offsets.length>=2,s}mediaAt(e){return(e*this.rate+this.offset)/1e3}reset(){this.offsets=[],this.offset=0,this.previous=-1,this.ready=!1}}function li(c,e,t,i){if(t<4||t>W||!c.length)return null;const s=e-t*i/1e3,r=c.find(a=>s>=a.a-.001&&s<=a.b+.001)??(s>c[c.length-1].b?c[c.length-1]:void 0);if(!r)return null;const n=r.sceneCut||!r.dynamic?1:Math.max(0,Math.min(1,(s-r.a)/(r.b-r.a)));return{pair:r,plan:{alpha:n,mediaTime:r.a+(r.b-r.a)*n,delayMs:t,generated:n>.001&&n<.999}}}function xe(c,e,t=-1/0,i=1){const r=c.flatMap(n=>[{pair:n,alpha:0,time:n.a},{pair:n,alpha:1,time:n.b}]).filter(n=>n.time<=e+.002&&n.time>=t-1e-6).sort((n,a)=>a.time-n.time)[0];return r?{pair:r.pair,plan:{alpha:r.alpha,mediaTime:r.time,delayMs:(e-r.time)*1e3/i,generated:!1}}:null}class ui{next=0;fps=0;due(e,t){if(this.fps!==t&&(this.fps=t,this.next=e),e+.1<this.next)return!1;const i=1e3/t;return this.next+=(Math.max(0,Math.floor((e-this.next)/i))+1)*i,!0}reset(){this.next=0,this.fps=0}}function di(c,e){if(c===null)return{effective:null,reason:"원본 프레임 타임스탬프를 확인하고 있습니다."};const i=(c>=22&&c<=26?[48,60]:c>=27&&c<=33?[60,90]:c>=50&&c<=65?[75,100,120,144]:[]).filter(s=>s<=e).at(-1)??null;return{effective:i,reason:i===e?"원본 FPS에 맞는 목표입니다.":i===null?"이 원본 FPS에서는 선택 목표의 보간을 생략하고 원본 FPS 보정을 유지합니다.":`선택 ${e}FPS 유지 · 원본 약 ${c.toFixed(2)}FPS 정책에 따라 ${i}FPS를 적용합니다.`}}class hi{tier=1;scale=1;frequency=1;allowSpatial=!1;ema=0;count=0;misses=0;start=0;last=-1/0;bad=0;good=0;sample(e,t,i,s,r){r&&(this.ema=this.ema===0?e/t:this.ema*.9+e/t*.1,this.count++,i&&this.misses++,!(s-this.start<2e3||this.count<24)&&(this.bad=this.ema>.9||this.misses/this.count>.15?this.bad+1:0,this.good=this.ema<.45&&this.misses===0?this.good+1:0,this.start=s,this.count=this.misses=0,!(s-this.last<4e3)&&(this.bad>=2?(this.tier>0?this.tier--:this.scale>.51?this.scale*=.75:this.allowSpatial?this.frequency=Math.max(.4,this.frequency*.8):this.allowSpatial=!0,this.last=s,this.bad=this.good=0):this.good>=3&&(this.frequency<1?this.frequency=Math.min(1,this.frequency/.8):this.allowSpatial?this.allowSpatial=!1:this.scale<1?this.scale=Math.min(1,this.scale/.75):this.tier<2&&this.tier++,this.last=s,this.bad=this.good=0))))}get config(){return{tier:this.tier,width:Math.max(96,Math.round(256*this.scale))}}}class fi{constructor(e,t,i){this.video=e,this.engine=t,this.hooks=i,this.stats.state="warming",this.stats.reason="연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.",this.stats.engine="WebGPU 양방향 블록 움직임 추정"}video;engine;hooks;budget=new hi;clock=new ai;stats=Le();lastRaf=0;lastRvfc=0;busyStarted=0;callback=0;raf=0;running=!1;busy=!1;revision=0;pending=null;still=!1;pair;lastKey="";lastSource=-1;previousSource=null;sourcePeriod=0;disabled=!1;estimatedMs=3;submissions=[];generated=[];signatures=[];sceneKey="";began=performance.now();poorSince=0;recoveryUntil=0;resetPending=!1;submittedAt=0;outputIntervalMs=1e3/60;lastWasGenerated=!1;lastMediaTime=-1/0;catchupUntil=0;nativeRetry=!1;cadence=new oi;presentation=new ci;pacer=new ui;policy(){const e=this.cadence.period,t=e&&this.cadence.samples>=8?1e3/(e*this.video.playbackRate):null;return{...di(t,Number(this.hooks.settings().targetFPS)),nativeFPS:t}}protectPresentation(e){const t=performance.now(),i=this.cadence.period??this.sourcePeriod;if(!this.running||this.disabled||this.video.paused||t<this.recoveryUntil||i<=0||this.engine.pendingGPU<2||this.engine.pendingAge(t)<Math.min(i,this.outputIntervalMs*1.5))return!1;const s=i+this.outputIntervalMs+1e3/(this.clock.hz??60)+1;return t-this.submittedAt>s||(this.video.currentTime-e)*1e3/this.video.playbackRate>fe(i)?!1:(this.recoveryUntil=t+1e4,this.poorSince=0,this.revision++,this.pair=void 0,this.lastKey="",this.lastWasGenerated=!1,this.resetMotion(),this.stats.effectiveFPS=null,this.stats.recoveries=(this.stats.recoveries??0)+1,this.limited("GPU 제출 지연이 반복되어 10초간 같은 Canvas에서 원본 FPS의 공간·색상 보정을 유지합니다."),v.count("protection.nativeRecovery"),!0)}expired(e){const t=performance.now(),i=this.cadence.period??this.sourcePeriod,s=1e3/(this.clock.hz??60),r=this.outputIntervalMs+(this.lastWasGenerated&&t>this.catchupUntil?0:Math.min(W,i||W))+s+1;return this.lastWasGenerated&&!this.presentation.ready||t-this.submittedAt>r||this.presentation.ready&&(this.presentation.mediaAt(t)-e)*1e3/this.video.playbackRate>W+r||(this.video.currentTime-e)*1e3/this.video.playbackRate>fe(i)+s+1}resetMotion(){this.busy?this.resetPending=!0:(this.engine.resetTemporal(),this.resetPending=!1)}finished(){v.elapsed("serialBusyMs",this.busyStarted),this.busy=!1,this.stats.queueDepth=0,this.resetPending&&this.resetMotion(),this.drain()}start(){this.running||(this.engine.onStreamAvailable=()=>this.drain(),this.running=!0,this.requestSource(),!this.video.paused&&!document.hidden?this.requestOutput():this.requestStill())}requestSource(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{if(this.lastRvfc&&v.sample("rvfcIntervalMs",e-this.lastRvfc),this.lastRvfc=e,v.count("rvfcCallbacks"),this.callback=0,this.requestSource(),!(document.hidden||this.video.seeking||this.video.paused||t.mediaTime===this.lastSource)){this.presentation.observe(t.mediaTime,t.expectedDisplayTime,this.video.playbackRate)&&(this.invalidate(),this.presentation.observe(t.mediaTime,t.expectedDisplayTime,this.video.playbackRate)),this.lastSource=t.mediaTime,this.stats.sourceFrames++,this.hooks.observe(t,e),this.previousSource!==null&&t.mediaTime>this.previousSource&&(this.sourcePeriod=(t.mediaTime-this.previousSource)*1e3/this.video.playbackRate),this.previousSource=t.mediaTime,this.cadence.add(this.sourcePeriod),this.hooks.settings().adaptive&&this.sourcePeriod>0&&e-this.began>5e3&&e>this.recoveryUntil&&(this.trim(e),(this.submissions.length<2?0:(this.submissions.length-1)*1e3/Math.max(1,e-this.submissions[0]))<900/(this.cadence.period??this.sourcePeriod)?(this.poorSince||(this.poorSince=e),e-this.poorSince>3e3&&(this.recoveryUntil=e+1e4,this.poorSince=0,this.pair=void 0,this.resetMotion(),this.limited("보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다."))):this.poorSince=0);try{if(this.video.mediaKeys)throw new DOMException("보호된 영상은 프레임에 접근할 수 없습니다.","SecurityError");const i=v.mark(),s=new VideoFrame(this.video,{timestamp:Math.round(t.mediaTime*1e6)});v.elapsed("videoFrameAcquireCpuMs",i),this.pending&&(v.count("discard.sourceReplaced"),this.pending.frame.close(),this.stats.dropped++),this.pending={frame:s,meta:t},this.drain()}catch(i){this.hooks.fatal(i)}}}))}limited(e){this.stats.state="limited",this.stats.reason=e}async drain(){if(!this.running||this.busy||!this.engine.canCapture({width:this.video.videoWidth,height:this.video.videoHeight},this.budget.config))return;if(this.still){this.still=!1,this.busy=!0,this.busyStarted=v.mark();const i=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&i===this.revision})}catch(s){this.hooks.fatal(s)}finally{this.finished()}return}if(!this.pending)return;const e=this.pending;this.pending=null,this.busy=!0,this.busyStarted=v.mark(),this.stats.queueDepth=1;const t=this.revision;try{const i=this.clock.hz??60,s=this.cadence.period??this.sourcePeriod,r=this.policy(),n=s>0&&1e3/s>=i*.98;if(this.disabled||performance.now()<this.recoveryUntil||this.hooks.settings().original||this.hooks.settings().comparison||s>W||n||r.effective===null||this.video.paused){this.stats.effectiveFPS=null,!this.disabled&&performance.now()>=this.recoveryUntil&&this.limited(this.hooks.settings().original||this.hooks.settings().comparison?"동일 원본 프레임 비교를 위해 보간을 생략합니다.":s>W?"한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.":n?"브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.":r.effective===null?r.reason:"일시정지 상태입니다."),await this.hooks.spatial({metadata:null,sourceDriven:!0,sourceFrame:e.frame,sourceTime:e.meta.mediaTime,current:()=>this.running&&t===this.revision&&!this.video.seeking&&!document.hidden&&(this.video.currentTime-e.meta.mediaTime)*1e3/this.video.playbackRate<=100});return}let a=0;const o=new Promise((l,d)=>{a=window.setTimeout(()=>d(new Error("움직임 추정 GPU 응답 시간 초과")),1500)});let u;try{u=await Promise.race([this.engine.enqueueFrame(e.frame,{width:e.frame.displayWidth,height:e.frame.displayHeight},e.meta.mediaTime,this.budget.config),o])}finally{clearTimeout(a)}if(!this.running||t!==this.revision)return;this.pair={...u},this.stats.flowMs=u.flowMs,this.stats.flowSize=u.flowSize,this.stats.confidence=u.confidence,u.analysis?.then(l=>{!this.running||t!==this.revision||(l.sceneCut&&this.sceneKey!==String(u.id)&&(this.sceneKey=String(u.id),this.stats.sceneCuts++,v.count("sceneCuts")),this.pair?.b===u.b&&(Object.assign(this.pair,l,{flowMs:u.flowMs}),this.stats.flowMs=u.flowMs,this.stats.confidence=l.confidence))}),u.sceneCut&&this.sceneKey!==String(u.b)&&(v.count("sceneCuts"),this.stats.sceneCuts++,this.sceneKey=String(u.b)),u.ready||(this.lastWasGenerated=!1,await this.hooks.spatial({metadata:null,sourceDriven:!0,sourceFrame:e.frame,sourceTime:e.meta.mediaTime,current:()=>this.running&&t===this.revision&&!this.video.seeking&&!document.hidden&&(this.video.currentTime-e.meta.mediaTime)*1e3/this.video.playbackRate<=100}))}catch(i){if(!this.running)return;if(i instanceof Error&&i.message.includes("응답 시간 초과")){this.hooks.fatal(i);return}if(v.count("discard.gpuError"),i instanceof DOMException&&i.name==="SecurityError"){this.hooks.fatal(i);return}this.disabled=!0,this.stats.state="error",this.stats.reason="프레임 보간에 실패하여 공간·색상 보정만 유지합니다: "+String(i),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason)}finally{e.frame.close(),this.finished()}}requestOutput(){!this.running||this.disabled||this.video.paused||document.hidden||(this.raf=requestAnimationFrame(e=>{this.raf=0,this.tick(e),this.requestOutput()}))}tick(e){this.lastRaf&&v.sample("rafIntervalMs",e-this.lastRaf),this.lastRaf=e,v.count("rafCallbacks"),this.clock.tick(e),this.stats.refreshHz=this.clock.hz,this.drain();const t=this.hooks.settings(),i=Number(t.targetFPS),s=this.policy();if(this.stats.requestedFPS=i,this.stats.nativeFPS=s.nativeFPS,this.stats.policyReason=s.reason,t.original||t.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.presentation.ready||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden||s.effective===null)return;const r=this.clock.hz??60,n=this.budget.frequency===1&&Math.abs(s.effective-r)<=r*.02,a=(n?s.effective:Math.min(s.effective,r))*this.budget.frequency;this.stats.effectiveFPS=a;const o=1e3/a;this.outputIntervalMs=o;const u=this.nativeRetry;if(!u&&!n&&!this.pacer.due(e,a))return;if(v.count("outputAttempts"),this.busy||this.pending){v.count("discard.queueBusy"),this.stats.dropped++;return}if(!this.engine.canStream){v.count("discard.gpuBackpressure"),this.budget.sample(o*2,o,!0,performance.now(),t.adaptive);return}const l=this.presentation.mediaAt(u?performance.now():e),d=this.cadence.period??this.sourcePeriod;let h=li(this.engine.temporalPairs(),l,d,this.video.playbackRate),g=u;const f=xe(this.engine.temporalPairs(),l,-1/0,this.video.playbackRate);if(u?(v.count("nativeRetryAttempts"),h=xe(this.engine.temporalPairs(),l,this.lastMediaTime,this.video.playbackRate)):f&&(f.pair.sceneCut||!f.pair.dynamic)&&(h=f),h&&h.plan.mediaTime<this.lastMediaTime-1e-6){v.count("defer.timelineCatchup"),this.catchupUntil=performance.now()+Math.min(W,d);return}if(!h){if(v.count("discard.planUnavailable"),this.catchupUntil=performance.now()+Math.min(W,d),h=xe(this.engine.temporalPairs(),l,this.lastMediaTime,this.video.playbackRate),!h){this.limited("현재 표시 시각에 맞는 유효 원본 프레임을 기다립니다.");return}g=!0}const{pair:x,plan:p}=h;v.sample("timeline.nativeOffsetMs",(this.video.currentTime-this.presentation.mediaAt(performance.now()))*1e3/this.video.playbackRate),v.sample("timeline.currentMinusPairBMs",(this.video.currentTime-x.b)*1e3/this.video.playbackRate);const m=p.mediaTime.toFixed(6);if(m===this.lastKey){v.count("duplicateEndpoint");return}this.lastKey=m;const b=this.revision;this.busy=!0,this.busyStarted=v.mark(),this.stats.queueDepth=1;const w=(g?performance.now():e)+Math.max(4,1e3/(this.clock.hz??60));let S=!1;const M=()=>{const y=v.mark(),P=performance.now(),T=(this.presentation.mediaAt(P)-p.mediaTime)*1e3/this.video.playbackRate,R=(this.video.currentTime-this.presentation.mediaAt(P))*1e3/this.video.playbackRate,B=!this.running||b!==this.revision?"invalidated":this.video.seeking?"seek":document.hidden?"hidden":P>w?"submitDeadline":R>Ve(d)||R<-d?"clockDiscontinuity":(this.video.currentTime-p.mediaTime)*1e3/this.video.playbackRate>fe(d)?"totalMediaSkew":T<-2?"tooEarly":T>W?"tooLate":null,G=B===null;return B&&!S&&(S=!0,B==="submitDeadline"&&(this.stats.deadlineMisses=(this.stats.deadlineMisses??0)+1),v.count("discard."+B)),v.elapsed("validityCpuMs",y),G};this.hooks.output({plan:p,pair:x,intervalMs:o,current:M}).then(y=>{const P=T=>{this.running&&b===this.revision&&this.budget.sample(T+x.flowMs*Math.min(1,1e3/Math.max(1,this.sourcePeriod)/a),o,!y,performance.now(),t.adaptive)};if(y?.completion?y.completion.then(T=>P(T+y.cpuSubmitMs)):P(y?.latencyMs??this.estimatedMs*1.5),!y||!this.running||b!==this.revision){this.running&&b===this.revision&&(this.lastKey===m&&(this.lastKey=""),this.nativeRetry=!0,this.catchupUntil=performance.now()+Math.min(W,d));return}g&&(v.count("nativeCanvasFallback"),this.stats.nativeFallbacks=(this.stats.nativeFallbacks??0)+1),this.estimatedMs=this.estimatedMs*.8+y.latencyMs*.2,y.completion?y.completion.then(T=>{this.running&&b===this.revision&&(this.stats.totalMs=T+y.cpuSubmitMs)}):this.stats.totalMs=y.latencyMs,this.stats.interpolationMs=null,this.stats.upscaleMs=null,this.stats.delayMs=(this.video.currentTime-p.mediaTime)*1e3/this.video.playbackRate,this.stats.additionalDelayMs=(this.presentation.mediaAt(performance.now())-p.mediaTime)*1e3/this.video.playbackRate,this.stats.nativeOffsetMs=this.stats.delayMs-this.stats.additionalDelayMs,v.sample("timeline.totalMediaSkewMs",this.stats.delayMs),v.sample("timeline.additionalDelayMs",(this.presentation.mediaAt(performance.now())-p.mediaTime)*1e3/this.video.playbackRate),s.effective!==i?this.limited(s.reason):g?this.limited("중간 프레임 대신 최신 유효 원본을 같은 Canvas 경로로 출력합니다."):x.sceneCut||!x.dynamic?this.limited(x.sceneCut?"장면 전환에서는 최신 원본을 같은 Canvas 경로로 출력합니다.":"정지 화면 또는 미세한 압축 차이에서는 최신 원본을 같은 Canvas 경로로 출력합니다."):(this.clock.hz??60)<i*.98?this.limited("목표 "+i+"FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요."):(this.stats.state="active",this.stats.reason="시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다.")}).catch(y=>{this.running&&(this.disabled=!0,this.stats.state="error",this.stats.reason="보간 출력 오류로 공간·색상 보정만 유지합니다: "+String(y),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason))}).finally(()=>this.finished())}submittedFrame(e,t,i,s){const r=performance.now();this.submittedAt&&v.sample("submittedIntervalMs",r-this.submittedAt),this.submittedAt=r,this.lastWasGenerated=e,v.count("submitted"),this.submissions.push(r),this.stats.submitted++;const n=s??i;n!==void 0&&(this.lastMediaTime=n),this.catchupUntil=0,this.nativeRetry=!1,i!==void 0&&(this.stats.delayMs=(this.video.currentTime-i)*1e3/this.video.playbackRate,this.stats.additionalDelayMs=this.presentation.ready?(this.presentation.mediaAt(r)-i)*1e3/this.video.playbackRate:0,this.stats.nativeOffsetMs=this.stats.delayMs-this.stats.additionalDelayMs,v.sample("timeline.totalMediaSkewMs",this.stats.delayMs),v.sample("timeline.additionalDelayMs",this.stats.additionalDelayMs));const a=(o,u)=>{this.running&&(t&&u&&v.count("skip.sceneCut"),t&&!o&&v.count("skip.static"),e&&o&&!u?(v.count("generatedSubmitted"),this.generated.push(r),this.stats.generated++):v.count("nativeSubmitted"))};e&&t?.analysisAvailable===!1?v.count("unclassifiedGenerated"):t?.analysis?t.analysis.then(o=>a(o.dynamic,o.sceneCut)):a(t?.dynamic??!1,t?.sceneCut??!1),this.engine.lastSignature&&this.signatures.push({time:r,hash:this.engine.lastSignature}),this.trim(r)}trim(e){for(;this.submissions.length&&e-this.submissions[0]>=2e3;)this.submissions.shift();for(;this.generated.length&&e-this.generated[0]>=2e3;)this.generated.shift();for(;this.signatures.length&&e-this.signatures[0].time>=2e3;)this.signatures.shift()}snapshot(){const e=performance.now();this.trim(e);const t=r=>r.length<2?0:(r.length-1)*1e3/Math.max(1,e-r[0]),i=t(this.submissions),s=this.stats.state==="active"&&this.submissions.length>20&&i<Math.min(this.stats.effectiveFPS??Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return{...this.stats,...this.video.paused||document.hidden?{state:"limited",reason:"일시정지 또는 숨김 상태에서는 보간 출력을 대기합니다.",effectiveFPS:null}:s?{state:"limited",reason:"처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요."}:{},totalDelayLimitMs:fe(this.cadence.period??this.sourcePeriod),quality:{...this.budget.config,frequency:this.budget.frequency,allowSpatial:this.budget.allowSpatial},signatureSampled:v.enabled&&v.signatures,submittedFPS:i,generatedFPS:t(this.generated),uniqueSamples:new Set(this.signatures.map(r=>r.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null}}invalidate(){v.count("bufferResets"),this.lastMediaTime=-1/0,this.catchupUntil=0,this.nativeRetry=!1,this.stats.state="warming",this.stats.effectiveFPS=null,this.stats.nativeFPS=null,this.revision++,this.pending?.frame.close(),this.pending=null,this.pair=void 0,this.previousSource=null,this.lastSource=-1,this.resetMotion(),this.lastKey="",this.pacer.reset(),this.presentation.reset(),this.cadence.reset()}invalidateOutput(){this.revision++,this.lastKey=""}requestStill(){this.still=!0,this.drain()}playbackChanged(){this.invalidate(),this.still=!1,this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.clock.reset(),this.video.paused?this.requestStill():this.requestOutput()}visibilityChanged(){this.playbackChanged()}destroy(){this.running&&(this.running=!1,this.revision++,this.pending?.frame.close(),this.pending=null,this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.raf&&cancelAnimationFrame(this.raf),this.callback=this.raf=0,this.engine.onStreamAvailable=void 0)}}function pi(c){const e=c instanceof Error?c.message:String(c);return{status:c instanceof DOMException&&c.name==="SecurityError"||/origin.clean|cross.origin|taint|protected|DRM/i.test(e)?"Video Access Restricted":"Rendering Error",reason:e}}class mi{constructor(e,t,i,s){this.video=e,this.settings=t,this.persistDivider=i,this.preferredBackend=s,this.resize=new ResizeObserver(()=>this.onResize()),this.resize.observe(e);const r=this.abort.signal;for(const n of["seeking","waiting","emptied","loadstart"])e.addEventListener(n,()=>{this.invalidate("Original Video Fallback","Waiting for a fresh decoded frame."),this.monitor.discontinuity()},{signal:r});for(const n of["loadeddata","seeked","playing","pause","ratechange","loadedmetadata"])e.addEventListener(n,()=>{n==="playing"&&(this.pausedFramePosition!==null&&this.overlay?.displayed&&Math.abs(e.currentTime-this.pausedFramePosition)*1e3/Math.max(.1,e.playbackRate)<=45&&(this.frameStarted=performance.now(),this.temporalMediaTime=null),this.pausedFramePosition=null),(n==="loadedmetadata"||n==="loadeddata")&&(this.probed=!1,!this.engine&&!this.starting&&this.initialize()),n==="ratechange"&&this.monitor.discontinuity(),["playing","pause","ratechange","seeked","loadedmetadata"].includes(n)&&this.temporal?.playbackChanged(),this.video.paused&&this.scheduler?.refresh()},{signal:r});e.addEventListener("resize",()=>{this.probed=!1,this.invalidate("Original Video Fallback","원본 해상도가 변경되어 프레임 버퍼를 초기화합니다."),e.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},{signal:r}),document.addEventListener("visibilitychange",()=>{this.invalidate("Original Video Fallback",document.hidden?"Suspended while the tab is hidden.":"Resuming from original video."),document.hidden?this.scheduler?.stop():(this.scheduler?.start(),this.video.paused&&this.scheduler?.refresh()),this.temporal?.visibilityChanged()},{signal:r}),document.addEventListener("fullscreenchange",()=>this.onResize(),{signal:r}),window.addEventListener("resize",()=>this.onResize(),{signal:r}),this.watchdog=window.setInterval(()=>{if(this.dead)return;if(this.engine instanceof A&&this.engine.stalled()){this.lost("WebGPU 보간 처리 응답 시간이 초과되어 원본 재생으로 복구합니다.");return}devicePixelRatio!==this.lastDpr&&(this.lastDpr=devicePixelRatio,this.onResize());const n=this.temporalMediaTime!==null&&!!this.temporal?.expired(this.temporalMediaTime);n&&this.temporalMediaTime!==null&&this.temporal?.protectPresentation(this.temporalMediaTime)||!e.paused&&this.lastPresented&&(n||performance.now()-this.frameStarted>this.freshHoldMs())&&(this.hide(n?"temporalExpired":"sourceExpired"),this.lastPresented=0,this.setState("Original Video Fallback","처리 화면이 오래되어 새 결과가 도착할 때까지 원본 재생을 표시합니다."))},20)}video;settings;persistDivider;preferredBackend;engine;overlay;scheduler;abort=new AbortController;resize;monitor=new ii;adaptive=new ei;status="Initializing";reason="Waiting for an accessible video frame.";dimensions=null;dead=!1;generation=0;lastPresented=0;presented=0;probed=!1;watchdog=0;resizeTimer=0;recoveryTimer=0;recoveries=0;lastDpr=devicePixelRatio;backendReason="";starting=!1;effectiveSharpness=0;effectiveDenoise=0;currentEngine="—";visibility=new si;frameStarted=0;outputKey="";temporal;restartPending=!1;submissionTimes=[];totalSubmissions=0;decodedHeight=0;temporalMediaTime=null;pausedFramePosition=null;async start(){await this.initialize()}async initialize(e){if(this.dead||this.starting||!this.settings.enabled)return;this.starting=!0;const t=++this.generation;this.setState("Initializing","Initializing local GPU processing.");try{const i=await ie(()=>document.createElement("canvas"),s=>this.lost(s),e??this.preferredBackend);if(this.dead||t!==this.generation){i.engine.destroy();return}this.engine=i.engine,this.backendReason=i.reason,this.overlay=new ni(this.video,i.canvas,s=>{this.settings={...this.settings,divider:s},this.persistDivider?.(s),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}),this.adaptive.reset(),this.probed=!1,this.settings.targetFPS!=="original"&&i.engine instanceof A?(this.temporal=new fi(this.video,i.engine,{settings:()=>this.settings,observe:(s,r)=>{this.decodedHeight=s.height,this.monitor.frame(s.mediaTime,s.presentedFrames,r,s.expectedDisplayTime)},spatial:async s=>{await this.process(s)},output:s=>this.process({metadata:null,current:s.current},s),hide:s=>{this.hide(),this.setState("Performance Limited",s)},fatal:s=>this.fail(s)}),this.temporal.start()):(this.scheduler=new ri(this.video,async s=>{await this.process(s)},()=>{this.monitor.metrics.skippedFrames++,this.monitor.metrics.missedDeadlines++,this.retainFresh()||this.hide("sourceReplaced"),this.setState("Performance Limited","Newer source frame arrived; discarding outdated output.")},s=>this.fail(s)),document.hidden||(this.scheduler.start(),this.video.paused&&this.scheduler.refresh()))}catch(i){!this.dead&&t===this.generation&&(this.releaseGPU(),this.setState("Unsupported GPU",i instanceof Error?i.message:String(i)))}finally{this.starting=!1,this.restartPending&&!this.dead&&(this.restartPending=!1,this.initialize())}}probe(){if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");const e=document.createElement("canvas");e.width=e.height=1;const t=e.getContext("2d",{willReadFrequently:!0});if(!t)throw new Error("Cannot validate source pixel access.");t.drawImage(this.video,0,0,1,1),t.getImageData(0,0,1,1),this.probed=!0}async process(e,t){const i=this.engine,s=this.overlay;if(this.dead||!i||!s||document.hidden||this.video.readyState<2||this.video.seeking)return null;if(this.video.closest(".ad-showing,.ad-interrupting"))return this.invalidate("Original Video Fallback","광고 중에는 원본 재생을 유지합니다."),null;if(this.video.videoWidth<1||this.video.videoHeight<1)return null;const r=this.generation;if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");this.probed||this.probe();const n=performance.now();e.metadata&&(this.decodedHeight=e.metadata.height,this.monitor.frame(e.metadata.mediaTime,e.metadata.presentedFrames,n,e.metadata.expectedDisplayTime));const a=this.adaptive.options(this.settings);this.currentEngine=a.options.engine,this.effectiveSharpness=a.options.sharpness*100,this.effectiveDenoise=a.options.engine==="fast"?0:a.options.denoise*100;const o=je({width:this.video.videoWidth,height:this.video.videoHeight},s.align(),devicePixelRatio,this.settings.targetResolution,i.maxDimension,i.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)},!!this.temporal,this.decodedHeight||this.video.videoHeight);a.options.upscale=!!o.eligible&&o.output.width>o.source.width,this.dimensions=o,s.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);const u=`${o.source.width},${o.source.height},${o.output.width},${o.output.height}`;if(u!==this.outputKey&&(this.hide(),this.outputKey=u),s.displayed||this.setState("Original Video Fallback","Processing the latest frame; showing original playback."),this.monitor.metrics.queueDepth=1,(t||e.sourceFrame)&&i instanceof A)try{if(!e.current())return null;const d=t?i.submitTemporal(o,a.options,t.plan.alpha,t.pair,e.current):i.submitSource(e.sourceFrame,o,a.options,e.current);if(!d)return null;const h=performance.now();for(this.totalSubmissions++,this.submissionTimes.push(h);this.submissionTimes.length&&h-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();return this.temporal?.submittedFrame(t?.plan.generated??!1,t?.pair,t?void 0:e.sourceTime,t?.plan.mediaTime),this.monitor.submission(!a.options.original,h),this.temporalMediaTime=t?.plan.mediaTime??e.sourceTime??this.video.currentTime,this.frameStarted=n,this.lastPresented=h,this.presented++,s.show(),this.visibility.set(!a.options.original),v.count("acceptedDisplay"),this.setState(a.unavailable?"Engine Unavailable":o.limited?"Performance Limited":"Active",a.unavailable?"선택한 처리 방식은 미지원이므로 지원되는 GPU 방식으로 처리합니다.":`${i.backend} processed frames are being presented.`),v.count(t?"temporalCanvasSubmissions":"nativeCanvasSubmissions"),d.completion?.then(g=>{this.dead||r!==this.generation||(this.monitor.recordTiming({...d,latencyMs:g+d.cpuSubmitMs}),v.count("completedOutputs"),this.settings.adaptive&&!this.video.paused&&(t&&this.temporal?.budget.allowSpatial?this.adaptive.sample(g+t.pair.flowMs*Math.min(1,t.intervalMs/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))),t.intervalMs,!1,performance.now()):t||this.adaptive.sample(g+d.cpuSubmitMs,this.monitor.intervalMs/Math.max(.1,this.video.playbackRate),!1,performance.now())))}),d}finally{this.monitor.metrics.queueDepth=0}let l=0;try{const d=new Promise((b,w)=>{l=window.setTimeout(()=>w(new Error("GPU processing timed out; original playback restored.")),1500)}),h=await Promise.race([t&&i instanceof A?i.renderTemporal(o,a.options,t.plan.alpha):i.render(this.video,o,a.options),d]);if(this.dead||r!==this.generation)return null;const g=t?.intervalMs??this.monitor.intervalMs/Math.max(.1,this.video.playbackRate),f=v.mark();let x=!this.video.paused&&performance.now()-n>g*1.25||!e.current();if(!x&&!document.hidden&&!this.video.seeking){v.elapsed("readyToCanvasSubmitMs",f);const b=v.mark();for(h.cpuSubmitMs+=await Promise.race([i.present(),d]),v.elapsed("canvasPresentAwaitMs",b),this.totalSubmissions++,this.submissionTimes.push(performance.now());this.submissionTimes.length&&performance.now()-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();this.temporal?.submittedFrame(!!t?.plan.generated)}if(this.dead||r!==this.generation)return null;h.latencyMs=performance.now()-n,x=x||!this.video.paused&&h.latencyMs>g*1.25||!e.current();const p=!x&&!document.hidden&&!this.video.seeking;this.monitor.complete(h,p&&!a.options.original&&(e.metadata!==null||!!t||!!this.temporal&&!this.video.paused),performance.now()),x&&(v.count("discard.outputDeadline"),this.monitor.metrics.missedDeadlines++);const m=h.latencyMs+(t?t.pair.flowMs*Math.min(1,g/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))):0);return this.settings.adaptive&&!this.video.paused&&(e.metadata||e.sourceDriven||t&&(this.temporal?.budget.allowSpatial||m<g*.2))&&this.adaptive.sample(m,g,x,performance.now()),p?(this.video.paused&&(this.pausedFramePosition=this.video.currentTime),v.count("acceptedDisplay"),this.temporalMediaTime=t?.plan.mediaTime??null,s.show(),this.visibility.set(!a.options.original),this.lastPresented=performance.now(),this.frameStarted=n,a.options.original||this.presented++,this.setState(a.options.original?"Original Comparison":a.unavailable?"Engine Unavailable":o.limited?"Performance Limited":"Active",a.options.original?"Showing the unenhanced acquired frame for comparison.":a.unavailable?"Requested engine/profile is unavailable; using "+a.options.engine+".":o.limited?"Output reduced to fit display, memory and measured processing limits.":`${i.backend} processed frames are being presented.${this.backendReason?" WebGPU unavailable; using WebGL2 fallback.":""}`)):(this.retainFresh()||this.hide("deadline"),this.setState("Performance Limited","처리 마감 시간을 놓쳐 아직 유효한 완료 화면을 유지하거나 원본 재생을 표시합니다.")),p?h:null}finally{clearTimeout(l),this.monitor.metrics.queueDepth=0}}onResize(){this.overlay?.align(),this.temporal?.invalidateOutput(),clearTimeout(this.resizeTimer),this.resizeTimer=window.setTimeout(()=>{this.overlay?.align(),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},120)}setState(e,t){this.status=e,this.reason=t}freshHoldMs(){return Math.max(40,Math.min(250,this.monitor.intervalMs/Math.max(.1,this.video.playbackRate)*1.5+10))}retainFresh(){return!!this.overlay?.displayed&&!this.video.seeking&&!document.hidden&&performance.now()-this.frameStarted<=this.freshHoldMs()}hide(e="invalidate"){this.overlay?.displayed&&v.count("overlayHide."+e),this.overlay?.hide(),this.visibility.set(!1)}invalidate(e,t,i=!0){this.pausedFramePosition=null,this.hide(),this.scheduler?.invalidate(),i?this.temporal?.invalidate():this.temporal?.invalidateOutput(),this.lastPresented=0,this.setState(e,t)}fail(e){if(this.dead)return;const t=pi(e);this.monitor.metrics.failures++,this.invalidate(t.status,t.reason),this.releaseGPU()}lost(e){if(this.dead)return;const t=this.engine?.backend==="WebGPU";this.fail(new Error(e)),this.recoveries++<1&&(this.recoveryTimer=window.setTimeout(()=>{this.dead||this.initialize(t?"webgl2":void 0)},1e3))}releaseGPU(){this.generation++,this.temporal?.destroy(),this.temporal=void 0,this.scheduler?.stop(),this.scheduler=void 0,this.hide(),this.overlay?.destroy(),this.overlay=void 0,this.engine?.destroy(),this.engine=void 0,this.outputKey="",this.monitor.metrics.queueDepth=0}update(e){const t=e.adaptive!==this.settings.adaptive,i=e.targetFPS!==this.settings.targetFPS;if(this.settings=e,t&&this.adaptive.reset(),i){this.releaseGPU(),this.starting?this.restartPending=!0:this.initialize();return}this.invalidate("Original Video Fallback","설정을 GPU 처리에 적용합니다.",!1),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}stats(){const e=!!this.overlay?.displayed,t=this.monitor.snapshot();t.enhancedVisiblePercent=this.visibility.percent();const i=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0,s=this.dimensions?.eligible?this.currentEngine==="balanced"?`FSR1 EASU · ${this.settings.contentMode==="animation"?"애니메이션":"실사"}`:this.currentEngine==="fast"?"고속 경계선 재구성":"—":"원본 해상도 · 노이즈/색상 보정",r=this.settings.original||this.settings.comparison&&this.settings.divider>=1,n=this.temporal?.snapshot()??Le();return this.temporal||(n.submitted=this.totalSubmissions,n.submittedFPS=this.submissionTimes.length<2?0:(this.submissionTimes.length-1)*1e3/Math.max(1,performance.now()-this.submissionTimes[0]),this.settings.targetFPS!=="original"&&(n.requestedFPS=Number(this.settings.targetFPS),n.state="unsupported",n.reason="이 백엔드는 움직임 보간을 지원하지 않아 업스케일링·색상 보정만 유지합니다.")),{status:this.status,reason:this.reason,backend:this.engine?.backend??"—",engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics:t,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm:s,presentation:e?r?"original":this.settings.comparison?"split":"enhanced":"fallback",fallback:!e,upscalingActive:e&&!r&&i>1.01,scaleRatio:i,frameAgeMs:e?performance.now()-this.frameStarted:null,temporal:n,canvasTransitions:this.overlay?.transitions,recoveries:this.recoveries}}destroy(){this.dead||(this.dead=!0,this.abort.abort(),this.resize.disconnect(),clearInterval(this.watchdog),clearTimeout(this.resizeTimer),clearTimeout(this.recoveryTimer),this.releaseGPU())}}async function Ye(c){let e="";const{engine:t,canvas:i}=await ie(()=>document.createElement("canvas"),l=>{e=l},c),s=document.createElement("canvas");s.width=s.height=8;const r=s.getContext("2d"),n={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:!1},a={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5},o=[],u=async(l={})=>{await t.render(s,n,{...a,...l}),await t.present();const d=document.createElement("canvas");d.width=d.height=32;const h=d.getContext("2d",{willReadFrequently:!0});return h.drawImage(i,0,0),h.getImageData(0,0,32,32).data};try{for(const y of["fast","balanced"]){r.fillStyle="rgb(64,128,192)",r.fillRect(0,0,8,8);const P=await u({engine:y}),T=Math.max(...Array.from(P,(R,B)=>Math.abs(R-[64,128,192,255][B%4])));o.push({name:`${y}: constant field / color / alpha`,passed:T<=2,detail:`Maximum channel error ${T}/255`})}for(let y=0;y<8;y++)for(let P=0;P<8;P++){const T=20+P*28;r.fillStyle=`rgb(${T},${T},${T})`,r.fillRect(P,y,1,1)}const l=await u();let d=0;for(let y=6;y<26;y++)d=Math.max(d,Math.abs(l[(512+y)*4]-(20+((y+.5)/4-.5)*28)));o.push({name:"Balanced: linear-ramp reconstruction",passed:d<=3,detail:`Maximum interior error ${d.toFixed(2)}/255`}),r.fillStyle="black",r.fillRect(0,0,8,4),r.fillStyle="white",r.fillRect(0,4,8,4);const h=await u();o.push({name:"Video orientation preserved",passed:h[0]<3&&h[992*4]>252,detail:`Top ${h[0]}, bottom ${h[992*4]}`});for(let y=0;y<8;y++)for(let P=0;P<8;P++){const T=80+(P*17+y*13)%7*11;r.fillStyle=`rgb(${T},${T},${T})`,r.fillRect(P,y,1,1)}const g=await u(),f=await u({sharpness:1}),x=await u({denoise:1}),p=await u({engine:"fast"}),m=await u({sharpness:1,comparison:!0,divider:1}),b=(y,P)=>Array.from(y).reduce((T,R,B)=>T+Math.abs(R-P[B]),0);for(const[y,P]of[["Sharpening changes processed pixels",f],["Denoising changes processed pixels",x],["Fast and Balanced are distinct",p],["Comparison uses unenhanced pixels",m]]){const T=b(g,P);o.push({name:y,passed:T>0,detail:`Absolute channel difference ${T}`})}r.fillStyle="rgb(50,50,50)",r.fillRect(0,0,4,8),r.fillStyle="rgb(200,200,200)",r.fillRect(4,0,4,8);const w=await u({sharpness:1}),S=Math.min(...Array.from(w).filter((y,P)=>P%4!==3)),M=Math.max(...Array.from(w).filter((y,P)=>P%4!==3));if(o.push({name:"Step edge remains bounded (anti-ringing)",passed:S>=49&&M<=201,detail:`Range ${S}…${M}; source 50…200`}),e)throw new Error(e);return{backend:t.backend,checks:o}}finally{t.destroy(),i.remove()}}const gi=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,vi=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,xi=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5),1));
}
`,bi=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,yi=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,Pe=`
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
`,wi=`#version 300 es
`+Pe+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c);float w=exp(-float(x*x+y*y)*.7-delta*delta/.0018);sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,settings.y*.7),1);}`,Si=`#version 300 es
`+Pe+`
void main(){vec2 p=gl_FragCoord.xy*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{vec3 sum=vec3(0);float weight=0.;for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){float w=cubic(float(x)-f.x)*cubic(float(y)-f.y);sum+=pixel(inputTex,i+ivec2(x,y))*w;weight+=w;}color=vec4(clamp(sum/max(weight,.0001),lo,hi),1);}}
`,Pi=`#version 300 es
`+Pe+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
if(settings.w>.5&&gl_FragCoord.x/dims.z<divider)result=linearSample(originalTex,gl_FragCoord.xy*dims.xy/dims.zw-.5);
color=vec4(clamp(result,0.,1.),1);}`,Mi=Object.freeze(Object.defineProperty({__proto__:null,composite:Pi,denoise:wi,upscale:Si,vertex:yi},Symbol.toStringTag,{value:"Module"}));function Ei(c,e,t,i,s,r=!1){const n=new Uint8ClampedArray(i*s*4),a=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]],o=(l,d)=>{const h=(Math.max(0,Math.min(t-1,d))*e+Math.max(0,Math.min(e-1,l)))*4;return[c[h]/255,c[h+1]/255,c[h+2]/255]},u=l=>l[1]+(l[0]+l[2])*.5;for(let l=0;l<s;l++)for(let d=0;d<i;d++){let h=(d+.5)*e/i-.5,g=(l+.5)*t/s-.5;Math.abs(h-Math.round(h))<1e-5&&(h=Math.round(h)),Math.abs(g-Math.round(g))<1e-5&&(g=Math.round(g));const f=Math.floor(h),x=Math.floor(g),p=h-f,m=g-x,b=a.map(([L,V])=>o(f+L,x+V)),[w,S,M,y,P,T,R,B,G,_,I,O]=b.map(u);let F=0,q=0,j=0;for(const[L,V,Y,re,ne,Z]of[[w,T,P,_,y,(1-p)*(1-m)],[S,P,_,G,R,p*(1-m)],[P,M,y,R,O,(1-p)*m],[_,y,R,B,I,p*m]]){const ae=re-V,oe=ne-L,ce=Math.min(1,Math.abs(ae)/Math.max(Math.abs(re-Y),Math.abs(Y-V),1e-6)),K=Math.min(1,Math.abs(oe)/Math.max(Math.abs(ne-Y),Math.abs(Y-L),1e-6));F+=ae*Z,q+=oe*Z,j+=(ce*ce+K*K)*Z}const X=Math.hypot(F,q);X*X<1/32768?(F=1,q=0):(F/=X,q/=X);let se=(j*.5)**2;r&&(se=Math.min(1,se*1.2));const Qe=(F*F+q*q)/Math.max(Math.abs(F),Math.abs(q)),Je=1+(Qe-1)*se,Ze=1-.5*se,Ee=.5-.29*se,Ce=[0,0,0];let Te=0;for(let L=0;L<12;L++){const V=a[L][0]-p,Y=a[L][1]-m,re=(V*F+Y*q)*Je,ne=(-V*q+Y*F)*Ze,Z=Math.min(re*re+ne*ne,1/Ee),ae=.4*Z-1,oe=Ee*Z-1,ce=(1.5625*ae*ae-.5625)*oe*oe;for(let K=0;K<3;K++)Ce[K]+=b[L][K]*ce;Te+=ce}const ke=(l*i+d)*4;for(let L=0;L<3;L++){const V=[4,9,3,6].map(Y=>b[Y][L]);n[ke+L]=Math.round(Math.max(Math.min(...V),Math.min(Math.max(...V),Ce[L]/Math.max(Te,1e-6)))*255)}n[ke+3]=255}return n}const Xe={webgpu:{common:gi,denoise:vi,upscale:xi,composite:bi},webgl:Mi};function pe(c,e,t,i){return{source:{width:c,height:e},processing:{width:t,height:i},output:{width:t,height:i},display:{width:t,height:i},css:{width:t,height:i},screen:null,limited:!1}}const ye={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,contentMode:"natural"},N=(c,e)=>Object.assign(document.createElement("canvas"),{width:c,height:e});function le(c,e){let t=0,i=0;for(let r=0;r<c.length;r++)if(r%4!==3){const n=c[r]-e[r];t+=n*n,i+=Math.abs(n)}const s=c.length*3/4;return{psnr:t===0?99:10*Math.log10(65025/(t/s)),mae:i/s}}const _e=c=>[...c].sort((e,t)=>e-t)[Math.floor(c.length/2)];async function He(c="webgpu"){const e=await ie(()=>N(1,1),()=>{},c,Xe),t=await ie(()=>N(1,1),()=>{},c),i=async(s,r,n,a={})=>{await s.engine.render(r,n,{...ye,...a}),await s.engine.present();const o=N(n.output.width,n.output.height),u=o.getContext("2d",{willReadFrequently:!0});return u.drawImage(s.canvas,0,0),{data:u.getImageData(0,0,o.width,o.height).data,png:o.toDataURL("image/png")}};try{const s=N(9,7),r=s.getContext("2d"),n=r.createImageData(9,7);for(let p=0;p<n.data.length;p++)n.data[p]=p%4===3?255:(p*73+p%11*31)%256;r.putImageData(n,0,0);const a=await i(t,s,pe(9,7,23,19),{contentMode:"animation"}),o=Ei(n.data,9,7,23,19,!0),u=Math.max(...Array.from(o,(p,m)=>Math.abs(p-a.data[m]))),l=[];for(const p of["line-art","natural-texture","compressed-texture"]){const m=N(768,432),b=m.getContext("2d");if(p==="line-art"){b.fillStyle="#e4e8db",b.fillRect(0,0,768,432);for(let G=0;G<14;G++)b.strokeStyle=G%3?"#1d2834":"#537789",b.lineWidth=2+G%3*1.4,b.beginPath(),b.moveTo(15+G*51,45),b.lineTo(90+G*46,390),b.stroke();b.strokeStyle="#252b3e",b.lineWidth=3,b.beginPath(),b.ellipse(355,200,165,105,.25,0,Math.PI*2),b.stroke(),b.font="bold 28px sans-serif",b.fillStyle="#172b3b",b.fillText("Edge reconstruction 0123",30,35)}else{const G=b.createImageData(768,432);for(let _=0;_<432;_++)for(let I=0;I<768;I++){const O=(_*768+I)*4,F=18*Math.sin(I*.18+_*.07)+11*Math.sin(I*.055-_*.14),q=55*Math.tanh((I-300-_*.43)/3),j=125+F+q+15*Math.sin(_*.025);G.data[O]=j*.94,G.data[O+1]=j,G.data[O+2]=j*.84,G.data[O+3]=255}b.putImageData(G,0,0)}const w=b.getImageData(0,0,768,432).data,S=N(256,144),M=S.getContext("2d"),y=M.createImageData(256,144);for(let G=0;G<144;G++)for(let _=0;_<256;_++){const I=(G*256+_)*4;for(let O=0;O<3;O++){let F=0;for(let j=0;j<3;j++)for(let X=0;X<3;X++)F+=w[((G*3+j)*768+_*3+X)*4+O];const q=p==="compressed-texture"?((_*17+G*23)%13-6)*1.3:0;y.data[I+O]=F/9+q}y.data[I+3]=255}M.putImageData(y,0,0);const P=pe(256,144,768,432),T=p==="line-art"?"animation":"natural",R=await i(e,S,P,{denoise:p==="compressed-texture"?.35:0}),B=await i(t,S,P,{denoise:p==="compressed-texture"?.35:0,contentMode:T});l.push({name:p,sharpness:0,baseline:le(R.data,w),improved:le(B.data,w),difference:le(R.data,B.data).mae,images:{source:S.toDataURL(),truth:m.toDataURL(),baseline:R.png,improved:B.png}})}const d=N(640,360),h=d.getContext("2d");h.fillStyle="#9ab9ad",h.fillRect(0,0,640,360),h.fillStyle="#304857";for(let p=0;p<40;p++)h.fillRect(p*17,10,2,340);const g=pe(640,360,1920,1080),f={baseline:[],improved:[]};for(let p=0;p<36;p++)for(const[m,b]of p%2?[["improved",t],["baseline",e]]:[["baseline",e],["improved",t]]){const w=performance.now();await b.engine.render(d,g,{...ye,denoise:.2}),await b.engine.present(),p>=6&&f[m].push(performance.now()-w)}const x={source:"640×360",output:"1920×1080",samples:30,includes:"CPU + queue + GPU completion; not pure GPU timestamp",baselineMedianMs:_e(f.baseline),improvedMedianMs:_e(f.improved),baselineP95Ms:[...f.baseline].sort((p,m)=>p-m)[28],improvedP95Ms:[...f.improved].sort((p,m)=>p-m)[28]};return{backend:t.engine.backend,maxReferenceError:u,cases:l,benchmark:x}}finally{e.engine.destroy(),t.engine.destroy()}}async function Ci(c,e="webgpu"){const t=new Image;t.src=c,await t.decode();const i=N(t.width,t.height);i.getContext("2d").drawImage(t,0,0);const s=pe(t.width,t.height,t.width*3,t.height*3),r=await ie(()=>N(1,1),()=>{},e,Xe),n=await ie(()=>N(1,1),()=>{},e),a=N(s.output.width,s.output.height),o=a.getContext("2d",{willReadFrequently:!0}),u=async(l,d)=>(await l.engine.render(i,s,{...ye,denoise:.2,contentMode:d}),await l.engine.present(),o.drawImage(l.canvas,0,0),{data:o.getImageData(0,0,a.width,a.height).data,png:a.toDataURL()});try{const l=await u(r,"natural"),d=await u(n,"natural"),h=await u(n,"animation");return{backend:n.engine.backend,source:s.source,output:s.output,sharpness:0,denoise:20,baselineToNaturalMAE:le(l.data,d.data).mae,naturalToAnimationMAE:le(d.data,h.data).mae,images:{baseline:l.png,natural:d.png,animation:h.png}}}finally{r.engine.destroy(),n.engine.destroy()}}const Ti=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,ki=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Gi=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Ui=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Q=(c,e)=>({source:{width:c,height:e},processing:{width:c,height:e},output:{width:c,height:e},display:{width:c,height:e},css:{width:c,height:e},screen:null,limited:!1}),D=(c,e)=>Object.assign(document.createElement("canvas"),{width:c,height:e}),J={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};async function Ri(c,e,t,i,s){if(await c.render(t,i,s),await c.present(c instanceof A?"full":"none"),c instanceof A)return c.lastPixels;const r=D(i.output.width,i.output.height),n=r.getContext("2d");return n.drawImage(e,0,0),n.getImageData(0,0,r.width,r.height).data}async function Ai(c="webgpu"){const e=D(1,1),t=c==="webgpu"?await A.create(e,()=>{}):new Ne(e,()=>{}),i=D(8,8),s=i.getContext("2d"),r=[];try{s.fillStyle="rgb(64,128,192)",s.fillRect(0,0,8,8);for(const n of["saturation","brightness"])for(const a of[0,50,100,150,200]){const o=await Ri(t,e,i,Q(8,8),{...J,[n]:a});r.push({control:n,value:a,rgb:Array.from(o.slice(0,3))})}return{backend:c,results:r}}finally{t.destroy()}}async function _i(){const c=D(1,1),e=await A.create(c,()=>{}),t=D(128,72),i=D(128,72);function s(r,n){const a=r.getContext("2d");a.fillStyle="#101010",a.fillRect(0,0,128,72),a.fillStyle="#eeeeee",a.fillRect(n,24,32,24)}try{s(t,24),s(i,32),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1});const r=await e.captureFrame(i,{width:128,height:72},1/24,{width:128,tier:1}),n=[];for(const o of[0,.25,.5,.75,1]){await e.renderTemporal(Q(128,72),J,o),await e.present("full");const u=e.lastPixels;let l=0,d=0;for(let h=0;h<72;h++)for(let g=0;g<128;g++){const f=Math.max(0,u[(h*128+g)*4]-16);l+=(g+.5)*f,d+=f}n.push({phase:o,centroid:l/d,expected:40+8*o,signature:e.lastSignature})}i.getContext("2d").fillStyle="white",i.getContext("2d").fillRect(0,0,128,72);const a=await e.captureFrame(i,{width:128,height:72},2/24,{width:128,tier:1});return await e.renderTemporal(Q(128,72),J,.5),await e.present("full"),{pair:r,results:n,sceneCut:a.sceneCut,cutPixel:Array.from(e.lastPixels.slice(0,3))}}finally{e.destroy()}}async function Di(){const c=D(1,1),e=await A.create(c,()=>{}),t=[];try{for(const[i,s]of[[480,"720p"],[720,"1080p"],[1080,"1440p"],[1440,"2160p"]]){const r=i*16/9,n=D(Math.round(r),i);n.getContext("2d").fillStyle="#4080c0",n.getContext("2d").fillRect(0,0,n.width,n.height);const a=je({width:n.width,height:i},{width:400,height:225},1,s,e.maxDimension,e.maxPixels);await e.render(n,a,{...J,upscale:!0}),await e.present("pixel"),t.push({source:a.source,target:s,actual:{width:c.width,height:c.height},pixel:Array.from(e.lastPixels),estimatedBytes:a.estimatedBytes})}return t}finally{e.destroy()}}async function Li(){const c=D(1,1),e=await A.create(c,()=>{}),t=D(128,72),i=D(128,72),s=[],r=(a,o)=>{const u=a.getContext("2d");u.fillStyle="#101010",u.fillRect(0,0,128,72),u.fillStyle="#eeeeee",u.fillRect(o,24,32,24)};r(t,24),r(i,32);const n=a=>{const o=D(128,72);return o.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(a),128,72),0,0),o.toDataURL()};try{for(const a of[24,30,60])for(const o of[75,100,120]){e.resetTemporal(),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1}),await e.captureFrame(i,{width:128,height:72},1/a,{width:128,tier:1});const u=[];for(let l=0;l/o<=1/a+1e-6;l++){const d=l*a/o;await e.renderTemporal(Q(128,72),J,d),await e.present("full");const h=e.lastPixels;let g=0,f=0,x=2166136261,p=0,m=0;for(let b=0;b<72;b++)for(let w=0;w<128;w++){const S=(b*128+w)*4,M=Math.max(0,h[S]-16);g+=(w+.5)*M,f+=M,x=Math.imul(x^h[S],16777619);const y=b>=24&&b<48&&w+.5>=24+8*d&&w+.5<56+8*d?238:16,P=16+(b>=24&&b<48?222*((w>=24&&w<56?1-d:0)+(w>=32&&w<64?d:0)):0);p+=Math.abs(h[S]-y),m+=Math.abs(P-y)}u.push({alpha:d,centroid:g/f,expected:40+8*d,hash:x>>>0,mae:p/9216,unwarpedBlendMAE:m/9216,image:a===24&&o===75?n(h):void 0})}s.push({source:a,target:o,samples:u})}return s}finally{e.destroy()}}async function Bi(){const c=await A.create(D(1,1),()=>{},{common:Ti,denoise:ki,upscale:Gi,composite:Ui}),e=await A.create(D(1,1),()=>{}),t=D(640,360),i=t.getContext("2d"),s=i.createImageData(640,360);for(let o=0;o<s.data.length;o++)s.data[o]=o%4===3?255:(o*37+o%17*19)%256;i.putImageData(s,0,0);const r={...Q(1920,1080),source:{width:640,height:360}},n={...J,upscale:!0,sharpness:.25,denoise:.15},a=[];try{for(const[u,l]of[["1.1",c],["1.2",e]]){const d=[];for(let g=0;g<50;g++){const f=performance.now();await l.render(t,r,n),await l.present(),g>=10&&d.push(performance.now()-f)}const h=[...d].sort((g,f)=>g-f);a.push({version:u,times:d,median:h[20],p95:h[38]})}await c.render(t,r,n),await c.present("full"),await e.render(t,r,n),await e.present("full");let o=0;for(let u=0;u<c.lastPixels.length;u++)c.lastPixels[u]!==e.lastPixels[u]&&o++;return{method:"same current host, frozen v1.1 shaders vs v1.2 shaders; interpolation off; neutral color; 640x360→1920x1080; 10 warmup, 40 measurements; wall completion including CPU/queue/GPU",rows:a,changedChannels:o}}finally{c.destroy(),e.destroy()}}async function Fi(){const c=D(1,1),e=await A.create(c,()=>{}),t=D(8,8),i=t.getContext("2d"),s=[];i.fillStyle="rgb(64,128,192)",i.fillRect(0,0,8,8);try{await e.captureFrame(t,{width:8,height:8},0,{width:8,tier:0}),await e.captureFrame(t,{width:8,height:8},1/30,{width:8,tier:0});for(const r of[!1,!0])for(const n of[!1,!0])for(const a of[!1,!0]){const o=n?{...Q(16,16),source:{width:8,height:8}}:Q(8,8),u={...J,upscale:n,saturation:a?0:100,brightness:100};r?await e.renderTemporal(o,u,.5):await e.render(t,o,u),await e.present("pixel"),s.push({motion:r,upscale:n,color:a,size:{width:c.width,height:c.height},pixel:Array.from(e.lastPixels)})}return s}finally{e.destroy()}}const C=c=>document.getElementById(c),ue=C("video");let k={...tt,adaptive:!1,automaticStrength:!1,comparison:!0},U,te="";function Me(){if(U?.destroy(),U=void 0,k.enabled){const c=C("backend").value;U=new mi(ue,k,void 0,c==="auto"?void 0:c),U.start()}}async function Ke(){C("notice").textContent="로컬 진단 영상 생성 중 · 3초";const c=document.createElement("canvas");c.width=320,c.height=180;const e=c.getContext("2d"),t=c.captureStream(24),i=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(l=>MediaRecorder.isTypeSupported(l)),s=new MediaRecorder(t,{mimeType:i,videoBitsPerSecond:5e5}),r=[];s.ondataavailable=l=>{l.data.size&&r.push(l.data)};const n=new Promise(l=>{s.onstop=()=>l(new Blob(r,{type:s.mimeType}))});s.start();let a=0;const o=window.setInterval(()=>{const l=e.createLinearGradient(0,0,320,180);l.addColorStop(0,"#122b3e"),l.addColorStop(1,"#c9dec7"),e.fillStyle=l,e.fillRect(0,0,320,180),e.strokeStyle="#eef4df",e.lineWidth=1;for(let d=0;d<18;d++)e.beginPath(),e.moveTo(d*13+a%12,35),e.lineTo(d*13+55,145),e.stroke();e.fillStyle="#121d26",e.fillRect(10,8,300,23),e.fillStyle="#e5edeb",e.font="13px monospace",e.fillText(`CLARITY 320×180 · frame ${String(a).padStart(3,"0")}`,16,24);for(let d=145;d<175;d++)for(let h=15;h<130;h++){const g=90+(h*13+d*7+a*3)%23;e.fillStyle=`rgb(${g},${g},${g})`,e.fillRect(h,d,1,1)}e.fillStyle="#f1b36e",e.beginPath(),e.arc(200+Math.sin(a/12)*60,113,18,0,Math.PI*2),e.fill(),a++},1e3/24);await new Promise(l=>setTimeout(l,3e3)),clearInterval(o),s.stop();const u=await n;t.getTracks().forEach(l=>l.stop()),de(URL.createObjectURL(u)),C("notice").textContent="로컬 320 × 180 진단 WebM 생성 완료. 실제 HTML 영상 플레이어가 디코딩합니다."}const De=new Map;async function zi(c){U?.destroy(),U=void 0,ue.pause();let e=De.get(c);if(!e){const t=Object.assign(document.createElement("canvas"),{width:256,height:144}),i=t.getContext("2d"),s=t.captureStream(0),r=s.getVideoTracks()[0],n=new MediaRecorder(s,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:2e6}),a=[];n.ondataavailable=l=>{l.data.size&&a.push(l.data)};const o=new Promise(l=>{n.onstop=()=>l(new Blob(a,{type:n.mimeType}))});n.start();const u=performance.now();for(let l=0;l<c*2;l++){await new Promise(h=>setTimeout(h,Math.max(0,u+l*1e3/c-performance.now()))),i.fillStyle="#101010",i.fillRect(0,0,256,144);const d=24+l*80/(c*2);i.fillStyle="#eeeeee",i.fillRect(d,48,48,48),i.fillStyle="#4080c0",i.fillRect(d+8,56,16,16),i.fillStyle="#80c040",i.fillRect(d+28,76,12,12),r.requestFrame()}await new Promise(l=>setTimeout(l,1e3/c)),n.stop(),e=await o,s.getTracks().forEach(l=>l.stop()),De.set(c,e)}de(URL.createObjectURL(e)),await ue.play()}function de(c){te&&URL.revokeObjectURL(te),te=c,ue.src=te,Me(),ue.play().catch(e=>{C("notice").textContent=String(e)})}C("sample").addEventListener("click",()=>{C("sample").disabled=!0,Ke().catch(c=>{C("notice").textContent=String(c)}).finally(()=>{C("sample").disabled=!1})});C("packaged").addEventListener("click",()=>{de(new URL("../diagnostic.webm",location.href).href),C("notice").textContent="포함된 로컬 320 × 180 진단 영상을 재생합니다."});C("backend").addEventListener("change",Me);C("file").addEventListener("change",c=>{const e=c.target.files?.[0];e&&de(URL.createObjectURL(e))});C("toggle").addEventListener("click",()=>{k.enabled=!k.enabled,C("toggle").textContent=k.enabled?"보정 끄기":"보정 켜기",Me()});C("engine").addEventListener("change",()=>{k.engine=C("engine").value,U?.update(k)});C("contentMode").addEventListener("change",()=>{k.contentMode=C("contentMode").value,U?.update(k)});C("original").addEventListener("change",()=>{k.original=C("original").checked,U?.update(k)});for(const c of["targetResolution","targetFPS"])C(c).addEventListener("change",()=>{k={...k,[c]:C(c).value},U?.update(k)});for(const c of["saturation","brightness"])C(c).addEventListener("input",()=>{k[c]=Number(C(c).value),C(c+"-value").textContent=k[c]+"%",U?.update(k)});for(const[c,e]of[["sharp","sharpness"],["noise","denoise"]])C(c).addEventListener("input",()=>{k[e]=Number(C(c).value),C(c==="sharp"?"sharp-value":"noise-value").textContent=String(k[e]),U?.update(k)});C("compare").addEventListener("change",()=>{k.comparison=C("compare").checked,U?.update(k)});C("validate").addEventListener("click",()=>{const c=C("backend").value;C("pixel-results").textContent="셰이더 컴파일 및 픽셀 확인 중…",Ye(c==="auto"?void 0:c).then(e=>{C("pixel-results").textContent=`${e.backend}
`+e.checks.map(t=>`${t.passed?"PASS":"FAIL"} ${t.name}
${t.detail}`).join(`
`)}).catch(e=>{C("pixel-results").textContent=String(e)})});C("quality-review").addEventListener("click",()=>{const c=C("backend").value;U?.destroy(),U=void 0,C("quality-results").textContent="동일 조건 비교 중 · 재생 보정 일시 중지",He(c==="webgl2"?"webgl2":"webgpu").then(e=>{C("quality-results").textContent=JSON.stringify({...e,cases:e.cases.map(({images:t,...i})=>i)},null,2)}).catch(e=>{C("quality-results").textContent=String(e)})});const qi=window.setInterval(()=>{C("stats").textContent=U?JSON.stringify(U.stats(),null,2):"보정 사용 안 함"},1e3);window.addEventListener("pagehide",()=>{clearInterval(qi),U?.destroy(),te&&URL.revokeObjectURL(te)});window.clarityHarness={runPipelineCombinations:Fi,runMotionMatrix:Li,runV11Benchmark:Bi,runPixelChecks:Ye,runQualityReview:He,compareCapturedFrame:Ci,runMotionChecks:_i,runColorChecks:Ai,runResolutionChecks:Di,motionSample:zi,sample:Ke,stats:()=>U?.stats()??null,destroy:()=>{U?.destroy(),U=void 0},settings:c=>{k={...k,...c},U?.update(k)}};jt((c,e)=>{k={...k,...e},de(c)});
