import{e as _e,a as we,D as Le}from"./types-BmV7dO3q.js";const Ue=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,Ge=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Ae=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,De=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Fe=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
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
`,ze=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,Be=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,Ie=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`,Oe=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`;class le{constructor(e,t,i,n){this.device=e,this.down=t,this.estimate=i,this.interpolate=n,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summary=e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summary;readback;key="";count=0;newest=0;dead=!1;times=[0,0];downGroups=[];flowGroups=[];warpGroups=[];warpTarget;full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e){e.pushErrorScope("validation");try{const t=[];for(const i of[Be,Ie,Oe]){const n=e.createShaderModule({code:ze+`
`+i}),a=(await n.getCompilationInfo()).messages.filter(r=>r.type==="error");if(a.length)throw new Error("움직임 셰이더 컴파일 실패: "+a.map(r=>r.message).join("; "));t.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:n,entryPoint:"main"}}))}return new le(e,t[0],t[1],t[2])}finally{const t=await e.popErrorScope();if(t)throw new Error("움직임 셰이더 초기화 실패: "+t.message)}}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){const i=Math.min(e.width,t.width),n=Math.max(8,Math.round(e.height*i/e.width)),s=`${e.width},${e.height},${i},${n}`;if(this.config=t,s===this.key)return;this.destroyTextures(),this.full=e,this.lowSize={width:i,height:n},this.grid={width:Math.ceil(i/8),height:Math.ceil(n/8)};const a=(r,l)=>this.device.createTexture({size:[r.width,r.height],format:l,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[a(e,"rgba8unorm"),a(e,"rgba8unorm")],this.low=[a(this.lowSize,"rgba8unorm"),a(this.lowSize,"rgba8unorm")],this.flows=[a(this.grid,"rgba16float"),a(this.grid,"rgba16float")],this.downGroups=this.frames.map((r,l)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:r.createView()},{binding:1,resource:this.low[l].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1].map(r=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[1-r].createView()},{binding:1,resource:this.low[r].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summary}}]})),this.key=s,this.reset()}async capture(e,t,i,n){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const s=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,n),this.newest=this.count===0?0:1-this.newest,this.times[this.newest]=i,this.device.queue.writeBuffer(this.uniform,0,this.params()),this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[this.newest],colorSpace:"srgb"},[t.width,t.height]);const a=this.device.createCommandEncoder();let r=a.beginComputePass();r.setPipeline(this.down),r.setBindGroup(0,this.downGroups[this.newest]),r.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),r.end(),this.count>0&&(a.clearBuffer(this.summary),r=a.beginComputePass(),r.setPipeline(this.estimate),r.setBindGroup(0,this.flowGroups[this.newest]),r.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),r.end(),a.copyBufferToBuffer(this.summary,0,this.readback,0,32)),this.device.queue.submit([a.finish()]);let l=!1,u=!1,h=0;if(this.count>0){await this.readback.mapAsync(GPUMapMode.READ);const c=new Uint32Array(this.readback.getMappedRange()),d=Math.max(1,c[4]),m=c[0]/d/65535,g=c[1]/d/65535;h=c[2]/d/65535,u=c[3]>0&&g>1e-4,l=g>.24&&m>.12,this.readback.unmap()}else await this.device.queue.onSubmittedWorkDone();this.count++,this.pair={a:this.times[1-this.newest],b:i,ready:this.count>1,sceneCut:l,dynamic:u,confidence:h,flowMs:performance.now()-s,flowSize:{...this.lowSize}}}finally{const a=await this.device.popErrorScope();if(a)throw new Error("움직임 추정 GPU 오류: "+a.message)}return this.pair}encodeWarp(e,t,i){if(!this.pair.ready)throw new Error("서로 다른 두 원본 프레임을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups=[0,1].map(s=>this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[1-s].createView()},{binding:1,resource:this.frames[s].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}}]}))),this.device.queue.writeBuffer(this.uniform,0,this.params(i,this.pair.sceneCut));const n=e.beginComputePass();n.setPipeline(this.interpolate),n.setBindGroup(0,this.warpGroups[this.newest]),n.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),n.end()}reset(){this.count=0,this.times=[0,0],this.pair.ready=!1,this.warpTarget=void 0}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups=[]}destroy(){this.dead||(this.dead=!0,this.destroyTextures(),this.uniform.destroy(),this.summary.destroy(),this.readback.destroy())}}const qe=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;class ce{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:qe}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new ce(e,i)}encode(e,t){e.clearBuffer(this.value);const i=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),n=e.beginComputePass();n.setPipeline(this.pipeline),n.setBindGroup(0,i),n.dispatchWorkgroups(4),n.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){await this.readback.mapAsync(GPUMapMode.READ);const e=new Uint32Array(this.readback.getMappedRange()),t=e[0].toString(16)+":"+e[1].toString(16);return this.readback.unmap(),t}destroy(){this.value.destroy(),this.readback.destroy()}}class L{constructor(e,t,i,n,s){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=n,this.presentPipeline=s,this.maxDimension=t.limits.maxTextureDimension2D;const a=e.getContext("webgpu");if(!a)throw new Error("WebGPU canvas context unavailable.");this.context=a,a.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:Ue,denoise:Ge,upscale:Ae,composite:De}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const n=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!n)throw new Error("No WebGPU adapter.");const s=await n.requestDevice();try{const a=[i.denoise,i.upscale,i.composite].map(c=>s.createShaderModule({code:i.common+`
`+Fe+`
`+c}));for(const c of a){const m=(await c.getCompilationInfo()).messages.filter(g=>g.type==="error");if(m.length)throw new Error(m.map(g=>`WGSL ${g.lineNum}: ${g.message}`).join("; "))}const[r,l,u]=await Promise.all([s.createComputePipelineAsync({layout:"auto",compute:{module:a[0],entryPoint:"main"}}),s.createComputePipelineAsync({layout:"auto",compute:{module:a[1],entryPoint:"main"}}),s.createRenderPipelineAsync({layout:"auto",vertex:{module:a[2],entryPoint:"vertex"},fragment:{module:a[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),h=new L(e,s,r,l,u);return s.lost.then(c=>{h.dead||t(`WebGPU device lost: ${c.message||c.reason}`)}),s.addEventListener("uncapturederror",c=>{h.dead||t(`WebGPU: ${c.error.message}`)}),h}catch(a){throw s.destroy(),a}}resize(e){const{source:t,output:i}=e,n=`${t.width},${t.height},${i.width},${i.height}`;if(n===this.key)return;if(this.textures.forEach(u=>u.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[u,h]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][u],size:[h.width,h.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[s,a,r]=this.textures.map(u=>u.createView()),l=(u,h,c)=>this.device.createBindGroup({layout:u,entries:[{binding:0,resource:h},{binding:1,resource:c},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=l(this.clean.getBindGroupLayout(0),s,a),this.upscaleRaw=l(this.reconstruct.getBindGroupLayout(0),s,r),this.upscaleClean=l(this.reconstruct.getBindGroupLayout(0),a,r),this.compositeGroup=l(this.presentPipeline.getBindGroupLayout(0),s,r),this.compositeRaw=l(this.presentPipeline.getBindGroupLayout(0),s,s),this.compositeClean=l(this.presentPipeline.getBindGroupLayout(0),s,a),this.key=n}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,n){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const s=await le.create(this.device);if(this.dead)throw s.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=s}return this.motion.capture(e,t,i,n)}resetTemporal(){this.motion?.reset()}releaseTemporal(){this.motion?.destroy(),this.motion=void 0,this.signature?.destroy(),this.signature=void 0,this.lastSignature=null}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,n=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const s=performance.now(),a=this.device;a.pushErrorScope("validation"),a.pushErrorScope("out-of-memory");let r;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const x=await ce.create(this.device);if(this.dead)throw x.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=x}const{source:c,output:d}=t;a.queue.writeBuffer(this.uniform,0,new Float32Array([c.width,c.height,d.width,d.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&a.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[c.width,c.height]);const m=a.createCommandEncoder();e||this.motion.encodeWarp(m,this.textures[0],n);const g=!i.original&&i.engine==="balanced"&&i.denoise>0;if(g){const x=m.beginComputePass();x.setPipeline(this.clean),x.setBindGroup(0,this.denoiseGroup),x.dispatchWorkgroups(Math.ceil(c.width/8),Math.ceil(c.height/8)),x.end()}if(!i.original&&i.upscale!==!1){const x=m.beginComputePass();x.setPipeline(this.reconstruct),x.setBindGroup(0,g?this.upscaleClean:this.upscaleRaw),x.dispatchWorkgroups(Math.ceil(d.width/8),Math.ceil(d.height/8)),x.end()}this.selectedComposite=i.upscale===!1?g?this.compositeClean:this.compositeRaw:this.compositeGroup,a.queue.submit([m.finish()])}catch(c){r=c}const l=performance.now()-s,u=await a.popErrorScope(),h=await a.popErrorScope();if(r)throw r;if(u||h)throw new Error((u||h).message);if(e&&await a.queue.onSubmittedWorkDone(),this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:l,latencyMs:performance.now()-s,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),n=this.context.getCurrentTexture(),s=i.beginRenderPass({colorAttachments:[{view:n.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});s.setPipeline(this.presentPipeline),s.setBindGroup(0,this.selectedComposite??this.compositeGroup),s.draw(3),s.end(),this.measureSignature&&this.signature.encode(i,n);const a=e==="full"?this.canvas.width:1,r=e==="full"?this.canvas.height:1,l=Math.ceil(a*4/256)*256,u=e!=="none"?this.device.createBuffer({size:l*r,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;u&&i.copyTextureToBuffer({texture:n},{buffer:u,bytesPerRow:l},[a,r]),this.device.queue.submit([i.finish()]);const h=performance.now()-t,c=await this.device.popErrorScope();if(c)throw new Error(c.message);if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),this.lastPixels=null,u)try{await u.mapAsync(GPUMapMode.READ);const d=new Uint8Array(u.getMappedRange()),m=new Uint8ClampedArray(a*r*4),g=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let x=0;x<r;x++)for(let f=0;f<a;f++){const b=x*l+f*4,p=(x*a+f)*4;m[p]=d[b+(g?2:0)],m[p+1]=d[b+1],m[p+2]=d[b+(g?0:2)],m[p+3]=d[b+3]}this.lastPixels=m,u.unmap()}finally{u.destroy()}return h}destroy(){this.dead||(this.dead=!0,this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy())}}const $e=`// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
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
`,We=`vec3 toLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(.04045)));}
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
`,Ne=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,he=`
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
`,je=`#version 300 es
`+he+`
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`,Ve=`#version 300 es
`+he+$e+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`,Xe=`#version 300 es
`+he+We+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(adjustColor(clamp(result,0.,1.),colorSettings.x,colorSettings.y),1);}`,He=Object.freeze(Object.defineProperty({__proto__:null,composite:Xe,denoise:je,upscale:Ve,vertex:Ne},Symbol.toStringTag,{value:"Module"}));class ye{constructor(e,t,i=He){this.canvas=e;const n=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"low-power"});if(!n)throw new Error("WebGL2 unavailable.");this.gl=n,this.maxDimension=n.getParameter(n.MAX_TEXTURE_SIZE),this.completionChannel.port2.onmessage=()=>this.completionPoll?.(),this.fb=n.createFramebuffer(),this.vao=n.createVertexArray(),n.bindVertexArray(this.vao),this.onContextLost=s=>{s.preventDefault(),this.dead||t("WebGL context lost.")},e.addEventListener("webglcontextlost",this.onContextLost);try{for(const s of[i.denoise,i.upscale,i.composite]){const a=this.compile(s,i.vertex);this.programs.push(a),this.uniforms.push(Object.fromEntries(["inputTex","originalTex","dims","settings","divider","contentMode","originalView","colorSettings"].map(r=>[r,n.getUniformLocation(a,r)])))}n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!0),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL)}catch(s){throw this.destroy(),s}}canvas;backend="WebGL2";maxPixels=8294400;maxDimension;gl;programs=[];textures=[];uniforms=[];pendingPresent;completionChannel=new MessageChannel;completionPoll;cancelWait;pollTimer=0;fb;vao;key="";dead=!1;onContextLost;compile(e,t){const i=this.gl,n=i.createProgram(),s=[];try{for(const[a,r]of[[i.VERTEX_SHADER,t],[i.FRAGMENT_SHADER,e]]){const l=i.createShader(a);if(s.push(l),i.shaderSource(l,r),i.compileShader(l),!i.getShaderParameter(l,i.COMPILE_STATUS))throw new Error(i.getShaderInfoLog(l)||"GLSL compilation failed");i.attachShader(n,l)}if(i.linkProgram(n),!i.getProgramParameter(n,i.LINK_STATUS))throw new Error(i.getProgramInfoLog(n)||"GLSL link failed");return n}catch(a){throw i.deleteProgram(n),a}finally{s.forEach(a=>i.deleteShader(a))}}resize(e){const{source:t,output:i}=e,n=`${t.width},${t.height},${i.width},${i.height}`;if(this.key===n)return;const s=this.gl;if(this.textures.forEach(a=>s.deleteTexture(a)),this.textures=[],Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe texture/memory limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const a of[t,t,i]){const r=s.createTexture();this.textures.push(r),s.bindTexture(s.TEXTURE_2D,r),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.texStorage2D(s.TEXTURE_2D,1,s.RGBA8,a.width,a.height)}this.key=n}async render(e,t,i){if(this.dead)throw new Error("WebGL engine destroyed.");const n=performance.now(),s=this.gl;this.resize(t),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,s.RGBA,s.UNSIGNED_BYTE,e);const a=(h,c,d,m,g)=>{const x=this.programs[h],f=this.uniforms[h];if(s.useProgram(x),s.bindVertexArray(this.vao),s.bindFramebuffer(s.FRAMEBUFFER,d?this.fb:null),d&&(s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,d,0),s.checkFramebufferStatus(s.FRAMEBUFFER)!==s.FRAMEBUFFER_COMPLETE))throw new Error("Incomplete GPU framebuffer.");s.viewport(0,0,m,g),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,c),s.uniform1i(f.inputTex,0),s.activeTexture(s.TEXTURE1),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.uniform1i(f.originalTex,1),s.uniform4f(f.dims,t.source.width,t.source.height,t.output.width,t.output.height),s.uniform4f(f.settings,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0),s.uniform1f(f.divider,i.divider),s.uniform1f(f.contentMode,i.contentMode==="animation"?1:0),s.uniform1f(f.originalView,i.original?1:0),s.uniform2f(f.colorSettings,(i.saturation??100)/100,(i.brightness??100)/100),s.drawArrays(s.TRIANGLES,0,3)},r=!i.original&&i.engine==="balanced"&&i.denoise>0;r&&a(0,this.textures[0],this.textures[1],t.source.width,t.source.height),!i.original&&i.upscale!==!1&&a(1,this.textures[r?1:0],this.textures[2],t.output.width,t.output.height),this.pendingPresent=()=>a(2,this.textures[i.upscale===!1?r?1:0:2],null,t.output.width,t.output.height);const l=s.getError();if(l!==s.NO_ERROR)throw new Error(`WebGL rendering error 0x${l.toString(16)}`);const u=performance.now()-n;return await this.waitGPU(n),{cpuSubmitMs:u,latencyMs:performance.now()-n,gpuMs:null}}async present(){if(this.dead||!this.pendingPresent)throw new Error("No completed WebGL frame to present.");const e=performance.now();this.pendingPresent();const t=performance.now()-e,i=this.gl.getError();if(i!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${i.toString(16)}`);return await this.waitGPU(e),t}async waitGPU(e){const t=this.gl,i=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0);if(t.flush(),!i)throw new Error("GPU synchronization unavailable.");try{await new Promise((n,s)=>{let a=0;this.cancelWait=()=>s(new Error("WebGL engine destroyed during GPU work."));const r=()=>{if(this.dead||t.isContextLost()){s(new Error("WebGL context unavailable."));return}const l=t.clientWaitSync(i,0,0);l===t.ALREADY_SIGNALED||l===t.CONDITION_SATISFIED?n():l===t.WAIT_FAILED||performance.now()-e>1200?s(new Error("GPU completion timed out.")):++a%8===0?this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0):this.completionChannel.port1.postMessage(0)};this.completionPoll=r,r()})}finally{this.completionPoll=void 0,this.cancelWait=void 0,clearTimeout(this.pollTimer),t.deleteSync(i)}}destroy(){if(this.dead)return;this.dead=!0;const e=this.gl;this.cancelWait?.(),clearTimeout(this.pollTimer),this.completionChannel.port1.close(),this.completionChannel.port2.close(),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.textures.forEach(t=>e.deleteTexture(t)),this.programs.forEach(t=>e.deleteProgram(t)),e.deleteFramebuffer(this.fb),e.deleteVertexArray(this.vao),e.getExtension("WEBGL_lose_context")?.loseContext()}}async function K(o,e,t,i){let n="";if(t!=="webgl2"){const a=o();try{return{engine:await L.create(a,e,i?.webgpu),canvas:a,reason:n}}catch(r){if(a.remove(),n=r instanceof Error?r.message:String(r),t==="webgpu")throw r}}const s=o();try{return{engine:new ye(s,e,i?.webgl),canvas:s,reason:n}}catch(a){throw s.remove(),new Error(`${n?`WebGPU: ${n}. `:""}WebGL2: ${a instanceof Error?a.message:String(a)}`)}}const ve={eco:{engine:"fast",sharpness:.55,denoise:0,budget:.5},balanced:{engine:"balanced",sharpness:.8,denoise:.7,budget:.65},quality:{engine:"balanced",sharpness:1,denoise:1,budget:.8}},Ke={windowMs:2200,cooldownMs:5e3,promoteWindows:2,demoteWindows:2,low:.46,high:.9,maxMiss:.15};class Ye{constructor(e=Ke){this.config=e}config;profile="eco";workload=1;ema=0;start=0;lastChange=-1/0;count=0;misses=0;good=0;bad=0;warmup=0;reset(e=performance.now()){this.profile="eco",this.workload=1,this.ema=0,this.start=e,this.lastChange=-1/0,this.count=this.misses=this.good=this.bad=this.warmup=0}sample(e,t,i,n){if(this.warmup++<6)return!1;const s=e/Math.max(4,t*ve[this.profile].budget);if(this.ema=this.count===0&&this.ema===0?s:.12*s+.88*this.ema,this.count++,i&&this.misses++,n-this.start<this.config.windowMs||this.count<12)return!1;const a=this.misses/this.count;if(this.bad=this.ema>this.config.high||a>this.config.maxMiss?this.bad+1:0,this.good=this.ema<this.config.low&&a<.03?this.good+1:0,this.start=n,this.count=this.misses=0,n-this.lastChange<this.config.cooldownMs)return!1;const r=["eco","balanced","quality"];let l=r.indexOf(this.profile),u=!1;return this.bad>=this.config.demoteWindows?(l>0?this.profile=r[--l]:this.workload=Math.max(.4,this.workload*.8),u=!0):this.good>=this.config.promoteWindows&&(this.workload<1?(this.workload=Math.min(1,this.workload/.8),u=!0):l<r.length-1&&(this.profile=r[++l],u=!0)),u&&(this.lastChange=n,this.bad=this.good=0),u}options(e){const t=e.profile==="ultra"||e.engine==="anime4k"||e.engine==="neural",i=e.adaptive?this.profile:e.profile==="ultra"?"quality":e.profile,n=ve[i];return{profile:i,unavailable:t,options:{engine:e.engine==="fast"||e.engine==="balanced"?e.engine:n.engine,sharpness:e.sharpness/100*(e.automaticStrength?n.sharpness:1),denoise:e.denoise/100*(e.automaticStrength?n.denoise:1),comparison:e.comparison,divider:e.divider,contentMode:e.contentMode,original:e.original||e.comparison&&e.divider>=1,saturation:e.saturation,brightness:e.brightness}}}}const Je={"720p":{height:720,maxSource:480},"1080p":{height:1080,maxSource:720},"1440p":{height:1440,maxSource:1080},"2160p":{height:2160,maxSource:1440}};function Se(o,e,t,i,n=8192,s=8294400,a=1,r=null,l=!1,u=o.height){const h=i==="original"?null:Je[i],c=!!h&&u<=h.maxSource&&o.height<h.height,d=c?{width:Math.round(o.width*h.height/o.height),height:h.height}:{...o},m=o.width*o.height*(l?16:8),g=224*1024*1024,x=Math.max(0,(g-m-(l?4*1024*1024:0))/8),f=c?Math.max(o.width/d.width,a):1,b=Math.min(f,n/d.width,n/d.height,Math.sqrt(Math.min(s,x)/(d.width*d.height)));if(!c&&b<.999)throw new Error("원본 해상도가 GPU 텍스처 또는 메모리 한도를 초과하여 원본 플레이어로 복귀합니다.");const p={width:Math.max(1,Math.floor(d.width*b)),height:Math.max(1,Math.floor(d.height*b))};return{source:{...o},processing:{...p},output:p,requested:d,display:{width:Math.round(e.width*t),height:Math.round(e.height*t)},css:e,screen:r,eligible:c,limited:b<.98,estimatedBytes:m+p.width*p.height*8+(l?4*1024*1024:0),resolutionReason:i==="original"?"원본 해상도: 업스케일링을 생략합니다.":c?b<.98?"GPU 성능·메모리 한도로 실제 처리 해상도를 낮췄습니다.":"선택한 목표 해상도로 GPU 재구성합니다.":"현재 원본에는 선택한 업스케일링 조건이 적용되지 않습니다."}}class Ze{metrics=_e();intervalMs=1e3/30;previousMedia=null;previousFrames=0;outputs=[];frame(e,t,i,n){if(this.previousMedia!==null){const s=e-this.previousMedia,a=t-this.previousFrames;if(s>0&&s<1&&a>0&&a<120){const r=s*1e3/a;r>=4&&r<=500&&(this.intervalMs=this.intervalMs*.85+r*.15),this.metrics.sourceFPS=1e3/this.intervalMs}}this.previousMedia=e,this.previousFrames=t,this.metrics.latenessMs=Math.max(0,i-n)}discontinuity(){this.previousMedia=null,this.previousFrames=0,this.outputs=[],this.metrics.sourceFPS=null}complete(e,t,i){const n=(s,a)=>s===null?a:.15*a+.85*s;if(this.metrics.latencyMs=n(this.metrics.latencyMs,e.latencyMs),this.metrics.cpuSubmitMs=n(this.metrics.cpuSubmitMs,e.cpuSubmitMs),this.metrics.gpuMs=e.gpuMs===null?null:n(this.metrics.gpuMs,e.gpuMs),t)for(this.outputs.push(i);this.outputs.length>0&&i-this.outputs[0]>=2e3;)this.outputs.shift()}snapshot(e=performance.now()){return this.outputs=this.outputs.filter(t=>e-t<2e3),this.metrics.processedFPS=this.outputs.length<2?0:(this.outputs.length-1)*1e3/Math.max(1,e-this.outputs[0]),{...this.metrics}}}class Qe{changes;start;constructor(e=performance.now()){this.start=e,this.changes=[{at:e,visible:!1}]}set(e,t=performance.now()){this.changes[this.changes.length-1].visible!==e&&this.changes.push({at:t,visible:e}),this.trim(t)}trim(e){for(;this.changes.length>1&&this.changes[1].at<=e-2e3;)this.changes.shift()}percent(e=performance.now()){this.trim(e);const t=Math.max(this.start,e-2e3);let i=0;for(let n=0;n<this.changes.length;n++)this.changes[n].visible&&(i+=Math.max(0,(this.changes[n+1]?.at??e)-Math.max(t,this.changes[n].at)));return e>t?i/(e-t)*100:0}}class et{constructor(e,t,i,n){this.video=e,this.process=t,this.skip=i,this.error=n}video;process;skip;error;callback=0;running=!1;busy=!1;revision=0;lastTime=-1;refreshPending=!1;start(){this.running||(this.running=!0,this.schedule())}schedule(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{this.callback=0,this.schedule(),t.mediaTime!==this.lastTime&&(this.lastTime=t.mediaTime,this.dispatch(t))}))}refresh(){this.running&&this.video.readyState>=2&&this.dispatch(null)}invalidate(){this.revision++,this.lastTime=-1}dispatch(e){const t=++this.revision;if(this.busy){(!e||this.video.paused)&&(this.refreshPending=!0),this.skip();return}this.busy=!0,this.process({metadata:e,current:()=>this.running&&t===this.revision}).catch(i=>{this.running&&this.error(i)}).finally(()=>{this.busy=!1,this.refreshPending&&this.running&&(this.refreshPending=!1,this.refresh())})}stop(){this.running=!1,this.refreshPending=!1,this.invalidate(),this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.callback=0}}class tt{constructor(e,t,i){this.video=e,this.moveDivider=i,this.canvas=t,this.parent=e.parentElement,getComputedStyle(this.parent).position==="static"&&(this.originalPosition=this.parent.style.position,this.parent.style.position="relative"),t.className="clarity-gpu-overlay";const n=Number.parseInt(getComputedStyle(e).zIndex,10);Object.assign(t.style,{position:"absolute",pointerEvents:"none",zIndex:String(Number.isFinite(n)?n+1:1),display:"none",maxWidth:"none",maxHeight:"none",filter:"none",opacity:"1",transform:"none"}),t.setAttribute("aria-hidden","true"),this.parent.append(t),this.line=document.createElement("div"),this.handle=document.createElement("div"),Object.assign(this.line.style,{position:"absolute",display:"none",pointerEvents:"none",zIndex:String(Number.isFinite(n)?n+2:2),borderLeft:"1px solid rgba(255,255,255,.8)"}),Object.assign(this.handle.style,{position:"absolute",top:"12%",height:"65%",left:"-9px",width:"18px",pointerEvents:"auto",cursor:"ew-resize",touchAction:"none"}),this.handle.role="slider",this.handle.tabIndex=0,this.handle.setAttribute("aria-label","원본과 보정 영상 비교 경계"),this.handle.setAttribute("aria-valuemin","0"),this.handle.setAttribute("aria-valuemax","100"),this.line.append(this.handle),this.parent.append(this.line);const s=a=>{const r=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(a-r.left)/r.width)),this.moveDivider(this.divider),this.align()};this.handle.addEventListener("pointerdown",a=>{a.stopPropagation(),a.preventDefault(),this.handle.setPointerCapture(a.pointerId),s(a.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("pointermove",a=>{this.handle.hasPointerCapture(a.pointerId)&&s(a.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("keydown",a=>{(a.key==="ArrowLeft"||a.key==="ArrowRight")&&(a.preventDefault(),a.stopPropagation(),this.divider=Math.max(.02,Math.min(.98,this.divider+(a.key==="ArrowLeft"?-.02:.02))),this.moveDivider(this.divider),this.align())},{signal:this.abort.signal}),this.align()}video;moveDivider;canvas;line;handle;parent;abort=new AbortController;originalPosition=null;visible=!1;comparing=!1;divider=.5;css={width:1,height:1};get displayed(){return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=="none"}align(){const e=this.video.getBoundingClientRect(),t=this.parent.getBoundingClientRect(),i=this.parent.offsetWidth>0&&t.width>0?t.width/this.parent.offsetWidth:1,n=this.parent.offsetHeight>0&&t.height>0?t.height/this.parent.offsetHeight:1,s=this.video.videoWidth||e.width,a=this.video.videoHeight||e.height,r=Math.min(e.width/s,e.height/a),l=s*r,u=a*r,h=(e.left-t.left+(e.width-l)/2)/Math.max(.01,i)+this.parent.scrollLeft-this.parent.clientLeft,c=(e.top-t.top+(e.height-u)/2)/Math.max(.01,n)+this.parent.scrollTop-this.parent.clientTop;return this.css={width:l/Math.max(.01,i),height:u/Math.max(.01,n)},Object.assign(this.canvas.style,{left:`${h}px`,top:`${c}px`,width:`${this.css.width}px`,height:`${this.css.height}px`}),Object.assign(this.line.style,{left:`${h+this.css.width*this.divider}px`,top:`${c}px`,height:`${this.css.height}px`}),this.handle.setAttribute("aria-valuenow",String(Math.round(this.divider*100))),{width:l,height:u}}compare(e,t){e===this.comparing&&t===this.divider||(this.comparing=e,this.divider=t,this.align(),this.line.style.display=this.visible&&e?"block":"none")}show(){this.visible=!0,this.canvas.style.display="block",this.line.style.display=this.comparing?"block":"none"}hide(){this.visible=!1,this.canvas.style.display="none",this.line.style.display="none"}destroy(){this.hide(),this.abort.abort(),this.canvas.remove(),this.line.remove(),this.originalPosition!==null&&(this.parent.style.position=this.originalPosition)}}const se=45;function it(o,e,t,i,n,s=!1,a=!0){const r=(e-o)*1e3/Math.max(.1,i);if(r<4||r>se||!Number.isFinite(t))return null;if(s||!a)return{alpha:1,mediaTime:e,delayMs:(t-e)*1e3/i,generated:!1};const l=t+Math.min(12,Math.max(0,n))*i/1e3,u=Math.max(0,r-3),h=l-u*i/1e3;if(h<o-.002||h>e+.008)return null;const c=Math.max(0,Math.min(1,(h-o)/(e-o)));return{alpha:c,mediaTime:o+(e-o)*c,delayMs:u,generated:c>.001&&c<.999}}function st(o,e,t){const i=(o-e)*1e3/Math.max(.1,t);return i>=-2&&i<=se}class nt{previous=0;intervals=[];hz=null;tick(e){if(this.previous){const t=e-this.previous;if(t>=4&&t<=50&&(this.intervals.push(t),this.intervals.length>40&&this.intervals.shift(),this.intervals.length>=10)){const i=[...this.intervals].sort((n,s)=>n-s);this.hz=1e3/i[Math.floor(i.length/2)]}}this.previous=e}reset(){this.previous=0,this.intervals=[],this.hz=null}}class at{intervals=[];add(e){e>=4&&e<=250&&(this.intervals.push(e),this.intervals.length>40&&this.intervals.shift())}get period(){if(!this.intervals.length)return null;const e=[...this.intervals].sort((t,i)=>t-i);return e[Math.floor(e.length/2)]}reset(){this.intervals=[]}}class rt{tier=1;scale=1;frequency=1;allowSpatial=!1;ema=0;count=0;misses=0;start=0;last=-1/0;bad=0;good=0;sample(e,t,i,n,s){s&&(this.ema=this.ema===0?e/t:this.ema*.9+e/t*.1,this.count++,i&&this.misses++,!(n-this.start<2e3||this.count<24)&&(this.bad=this.ema>.9||this.misses/this.count>.15?this.bad+1:0,this.good=this.ema<.45&&this.misses===0?this.good+1:0,this.start=n,this.count=this.misses=0,!(n-this.last<4e3)&&(this.bad>=2?(this.tier>0?this.tier--:this.scale>.51?this.scale*=.75:this.allowSpatial?this.frequency=Math.max(.4,this.frequency*.8):this.allowSpatial=!0,this.last=n,this.bad=this.good=0):this.good>=3&&(this.frequency<1?this.frequency=Math.min(1,this.frequency/.8):this.allowSpatial?this.allowSpatial=!1:this.scale<1?this.scale=Math.min(1,this.scale/.75):this.tier<2&&this.tier++,this.last=n,this.bad=this.good=0))))}get config(){return{tier:this.tier,width:Math.max(96,Math.round(256*this.scale))}}}class ot{constructor(e,t,i){this.video=e,this.engine=t,this.hooks=i,this.stats.state="warming",this.stats.reason="연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.",this.stats.engine="WebGPU 양방향 블록 움직임 추정"}video;engine;hooks;budget=new rt;clock=new nt;stats=we();callback=0;raf=0;running=!1;busy=!1;revision=0;pending=null;still=!1;pair;nextOutput=0;lastKey="";lastSource=-1;previousSource=null;sourcePeriod=0;disabled=!1;estimatedMs=3;submissions=[];generated=[];signatures=[];sceneKey="";began=performance.now();poorSince=0;recoveryUntil=0;resetPending=!1;cadence=new at;resetMotion(){this.busy?this.resetPending=!0:(this.engine.resetTemporal(),this.resetPending=!1)}finished(){this.busy=!1,this.stats.queueDepth=0,this.resetPending&&this.resetMotion(),this.drain()}start(){this.running||(this.running=!0,this.requestSource(),!this.video.paused&&!document.hidden?this.requestOutput():this.requestStill())}requestSource(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{if(this.callback=0,this.requestSource(),!(document.hidden||this.video.seeking||t.mediaTime===this.lastSource)){this.lastSource=t.mediaTime,this.stats.sourceFrames++,this.hooks.observe(t,e),this.previousSource!==null&&t.mediaTime>this.previousSource&&(this.sourcePeriod=(t.mediaTime-this.previousSource)*1e3/this.video.playbackRate),this.previousSource=t.mediaTime,this.cadence.add(this.sourcePeriod),this.hooks.settings().adaptive&&this.sourcePeriod>0&&e-this.began>5e3&&e>this.recoveryUntil&&(this.trim(e),(this.submissions.length<2?0:(this.submissions.length-1)*1e3/Math.max(1,e-this.submissions[0]))<900/(this.cadence.period??this.sourcePeriod)?(this.poorSince||(this.poorSince=e),e-this.poorSince>3e3&&(this.recoveryUntil=e+1e4,this.poorSince=0,this.pair=void 0,this.resetMotion(),this.limited("보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다."))):this.poorSince=0);try{if(this.video.mediaKeys)throw new DOMException("보호된 영상은 프레임에 접근할 수 없습니다.","SecurityError");const i=new VideoFrame(this.video,{timestamp:Math.round(t.mediaTime*1e6)});this.pending&&(this.pending.frame.close(),this.stats.dropped++),this.pending={frame:i,meta:t},this.drain()}catch(i){this.hooks.fatal(i)}}}))}limited(e){this.stats.state="limited",this.stats.reason=e}async drain(){if(!this.running||this.busy)return;if(this.still){this.still=!1,this.busy=!0;const i=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&i===this.revision})}catch(n){this.hooks.fatal(n)}finally{this.finished()}return}if(!this.pending)return;const e=this.pending;this.pending=null,this.busy=!0,this.stats.queueDepth=1;const t=this.revision;try{const i=this.clock.hz??60,n=this.sourcePeriod>0&&1e3/this.sourcePeriod>=i*.98;if(this.disabled||performance.now()<this.recoveryUntil||this.hooks.settings().original||this.hooks.settings().comparison||this.sourcePeriod>se||n||this.video.paused){!this.disabled&&performance.now()>=this.recoveryUntil&&this.limited(this.hooks.settings().original||this.hooks.settings().comparison?"동일 원본 프레임 비교를 위해 보간을 생략합니다.":this.sourcePeriod>se?"한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.":n?"브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.":"일시정지 상태입니다."),await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision});return}let s=0;const a=new Promise((l,u)=>{s=window.setTimeout(()=>u(new Error("움직임 추정 GPU 응답 시간 초과")),1500)});let r;try{r=await Promise.race([this.engine.captureFrame(e.frame,{width:this.video.videoWidth,height:this.video.videoHeight},e.meta.mediaTime,this.budget.config),a])}finally{clearTimeout(s)}if(!this.running||t!==this.revision)return;this.pair={...r},this.stats.flowMs=r.flowMs,this.stats.flowSize=r.flowSize,this.stats.confidence=r.confidence,r.sceneCut&&this.sceneKey!==String(r.b)&&(this.stats.sceneCuts++,this.sceneKey=String(r.b)),r.ready||await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision})}catch(i){if(!this.running)return;if(i instanceof Error&&i.message.includes("응답 시간 초과")){this.hooks.fatal(i);return}if(i instanceof DOMException&&i.name==="SecurityError"){this.hooks.fatal(i);return}this.disabled=!0,this.stats.state="error",this.stats.reason="프레임 보간에 실패하여 공간·색상 보정만 유지합니다: "+String(i),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason)}finally{e.frame.close(),this.finished()}}requestOutput(){!this.running||this.disabled||this.video.paused||document.hidden||(this.raf=requestAnimationFrame(e=>{this.raf=0,this.tick(e),this.requestOutput()}))}tick(e){this.clock.tick(e),this.stats.refreshHz=this.clock.hz;const t=this.hooks.settings(),i=Number(t.targetFPS);if(this.stats.requestedFPS=i,t.original||t.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden)return;const n=Math.min(i,this.clock.hz??60)*this.budget.frequency,s=1e3/n;if(e+.1<this.nextOutput)return;if(this.nextOutput=Math.max(this.nextOutput+s,e),this.busy||this.pending){this.stats.dropped++;return}const a=this.pair,r=it(a.a,a.b,this.video.currentTime,this.video.playbackRate,this.estimatedMs,a.sceneCut,a.dynamic);if(!r){this.limited("동기화 가능한 프레임 구간을 벗어나 보간 출력을 건너뜁니다.");return}const l=`${a.b}:${r.alpha.toFixed(5)}`;if(l===this.lastKey)return;this.lastKey=l;const u=this.revision;this.busy=!0,this.stats.queueDepth=1;const h=()=>this.running&&u===this.revision&&!this.video.seeking&&!document.hidden&&st(this.video.currentTime,r.mediaTime,this.video.playbackRate);this.hooks.output({plan:r,pair:a,intervalMs:s,current:h}).then(c=>{this.running&&u===this.revision&&this.budget.sample((c?.latencyMs??this.estimatedMs*1.5)+a.flowMs*Math.min(1,1e3/Math.max(1,this.sourcePeriod)/n),s,!c,performance.now(),t.adaptive),!(!c||!this.running||u!==this.revision)&&(this.estimatedMs=this.estimatedMs*.8+c.latencyMs*.2,this.stats.totalMs=c.latencyMs,this.stats.interpolationMs=null,this.stats.upscaleMs=null,this.stats.delayMs=(this.video.currentTime-r.mediaTime)*1e3/this.video.playbackRate,(this.clock.hz??60)<i*.98?this.limited("목표 "+i+"FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요."):(this.stats.state="active",this.stats.reason="시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다."))}).catch(c=>{this.running&&(this.disabled=!0,this.stats.state="error",this.stats.reason="보간 출력 오류로 공간·색상 보정만 유지합니다: "+String(c),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason))}).finally(()=>this.finished())}submittedFrame(e){const t=performance.now();this.submissions.push(t),this.stats.submitted++,e&&(this.generated.push(t),this.stats.generated++),this.engine.lastSignature&&this.signatures.push({time:t,hash:this.engine.lastSignature}),this.trim(t)}trim(e){for(;this.submissions.length&&e-this.submissions[0]>=2e3;)this.submissions.shift();for(;this.generated.length&&e-this.generated[0]>=2e3;)this.generated.shift();for(;this.signatures.length&&e-this.signatures[0].time>=2e3;)this.signatures.shift()}snapshot(){const e=performance.now();this.trim(e);const t=s=>s.length<2?0:(s.length-1)*1e3/Math.max(1,e-s[0]),i=t(this.submissions),n=this.stats.state==="active"&&this.submissions.length>20&&i<Math.min(Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return{...this.stats,...n?{state:"limited",reason:"처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요."}:{},submittedFPS:i,generatedFPS:t(this.generated),uniqueSamples:new Set(this.signatures.map(s=>s.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null}}invalidate(){this.revision++,this.pending?.frame.close(),this.pending=null,this.pair=void 0,this.previousSource=null,this.lastSource=-1,this.resetMotion(),this.lastKey="",this.nextOutput=0}invalidateOutput(){this.revision++,this.lastKey=""}requestStill(){this.still=!0,this.drain()}playbackChanged(){this.invalidate(),this.still=!1,this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.clock.reset(),this.video.paused?this.requestStill():this.requestOutput()}visibilityChanged(){this.playbackChanged()}destroy(){this.running&&(this.running=!1,this.revision++,this.pending?.frame.close(),this.pending=null,this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.raf&&cancelAnimationFrame(this.raf),this.callback=this.raf=0)}}function lt(o){const e=o instanceof Error?o.message:String(o);return{status:o instanceof DOMException&&o.name==="SecurityError"||/origin.clean|cross.origin|taint|protected|DRM/i.test(e)?"Video Access Restricted":"Rendering Error",reason:e}}class ct{constructor(e,t,i,n){this.video=e,this.settings=t,this.persistDivider=i,this.preferredBackend=n,this.resize=new ResizeObserver(()=>this.onResize()),this.resize.observe(e);const s=this.abort.signal;for(const a of["seeking","waiting","emptied","loadstart"])e.addEventListener(a,()=>{this.invalidate("Original Video Fallback","Waiting for a fresh decoded frame."),this.monitor.discontinuity()},{signal:s});for(const a of["loadeddata","seeked","playing","pause","ratechange","loadedmetadata"])e.addEventListener(a,()=>{(a==="loadedmetadata"||a==="loadeddata")&&(this.probed=!1,!this.engine&&!this.starting&&this.initialize()),a==="ratechange"&&this.monitor.discontinuity(),["playing","pause","ratechange","seeked","loadedmetadata"].includes(a)&&this.temporal?.playbackChanged(),this.video.paused&&this.scheduler?.refresh()},{signal:s});e.addEventListener("resize",()=>{this.probed=!1,this.invalidate("Original Video Fallback","원본 해상도가 변경되어 프레임 버퍼를 초기화합니다."),e.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},{signal:s}),document.addEventListener("visibilitychange",()=>{this.invalidate("Original Video Fallback",document.hidden?"Suspended while the tab is hidden.":"Resuming from original video."),document.hidden?this.scheduler?.stop():(this.scheduler?.start(),this.video.paused&&this.scheduler?.refresh()),this.temporal?.visibilityChanged()},{signal:s}),document.addEventListener("fullscreenchange",()=>this.onResize(),{signal:s}),window.addEventListener("resize",()=>this.onResize(),{signal:s}),this.watchdog=window.setInterval(()=>{if(this.dead)return;devicePixelRatio!==this.lastDpr&&(this.lastDpr=devicePixelRatio,this.onResize());const a=this.temporalMediaTime!==null&&(e.currentTime-this.temporalMediaTime)*1e3/Math.max(.1,e.playbackRate)>se;!e.paused&&this.lastPresented&&(a||performance.now()-this.frameStarted>Math.max(40,Math.min(250,this.monitor.intervalMs/e.playbackRate*1.5+10)))&&(this.hide(),this.lastPresented=0,this.setState("Original Video Fallback","처리 화면이 오래되어 새 결과가 도착할 때까지 원본 재생을 표시합니다."))},20)}video;settings;persistDivider;preferredBackend;engine;overlay;scheduler;abort=new AbortController;resize;monitor=new Ze;adaptive=new Ye;status="Initializing";reason="Waiting for an accessible video frame.";dimensions=null;dead=!1;generation=0;lastPresented=0;presented=0;probed=!1;watchdog=0;resizeTimer=0;recoveryTimer=0;recoveries=0;lastDpr=devicePixelRatio;backendReason="";starting=!1;effectiveSharpness=0;effectiveDenoise=0;currentEngine="—";visibility=new Qe;frameStarted=0;outputKey="";temporal;restartPending=!1;submissionTimes=[];totalSubmissions=0;decodedHeight=0;temporalMediaTime=null;async start(){await this.initialize()}async initialize(e){if(this.dead||this.starting||!this.settings.enabled)return;this.starting=!0;const t=++this.generation;this.setState("Initializing","Initializing local GPU processing.");try{const i=await K(()=>document.createElement("canvas"),n=>this.lost(n),e??this.preferredBackend);if(this.dead||t!==this.generation){i.engine.destroy();return}this.engine=i.engine,this.backendReason=i.reason,this.overlay=new tt(this.video,i.canvas,n=>{this.settings={...this.settings,divider:n},this.persistDivider?.(n),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}),this.adaptive.reset(),this.probed=!1,this.settings.targetFPS!=="original"&&i.engine instanceof L?(this.temporal=new ot(this.video,i.engine,{settings:()=>this.settings,observe:(n,s)=>{this.decodedHeight=n.height,this.monitor.frame(n.mediaTime,n.presentedFrames,s,n.expectedDisplayTime)},spatial:async n=>{await this.process(n)},output:n=>this.process({metadata:null,current:n.current},n),hide:n=>{this.hide(),this.setState("Performance Limited",n)},fatal:n=>this.fail(n)}),this.temporal.start()):(this.scheduler=new et(this.video,async n=>{await this.process(n)},()=>{this.monitor.metrics.skippedFrames++,this.monitor.metrics.missedDeadlines++,this.hide(),this.setState("Performance Limited","Newer source frame arrived; discarding outdated output.")},n=>this.fail(n)),document.hidden||(this.scheduler.start(),this.video.paused&&this.scheduler.refresh()))}catch(i){!this.dead&&t===this.generation&&(this.releaseGPU(),this.setState("Unsupported GPU",i instanceof Error?i.message:String(i)))}finally{this.starting=!1,this.restartPending&&!this.dead&&(this.restartPending=!1,this.initialize())}}probe(){if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");const e=document.createElement("canvas");e.width=e.height=1;const t=e.getContext("2d",{willReadFrequently:!0});if(!t)throw new Error("Cannot validate source pixel access.");t.drawImage(this.video,0,0,1,1),t.getImageData(0,0,1,1),this.probed=!0}async process(e,t){const i=this.engine,n=this.overlay;if(this.dead||!i||!n||document.hidden||this.video.readyState<2||this.video.seeking)return null;if(this.video.closest(".ad-showing,.ad-interrupting"))return this.invalidate("Original Video Fallback","광고 중에는 원본 재생을 유지합니다."),null;if(this.video.videoWidth<1||this.video.videoHeight<1)return null;const s=this.generation;if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");this.probed||this.probe();const a=performance.now();e.metadata&&(this.decodedHeight=e.metadata.height,this.monitor.frame(e.metadata.mediaTime,e.metadata.presentedFrames,a,e.metadata.expectedDisplayTime));const r=this.adaptive.options(this.settings);this.currentEngine=r.options.engine,this.effectiveSharpness=r.options.sharpness*100,this.effectiveDenoise=r.options.engine==="fast"?0:r.options.denoise*100;const l=Se({width:this.video.videoWidth,height:this.video.videoHeight},n.align(),devicePixelRatio,this.settings.targetResolution,i.maxDimension,i.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)},!!this.temporal,this.decodedHeight||this.video.videoHeight);r.options.upscale=!!l.eligible&&l.output.width>l.source.width,this.dimensions=l,n.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);const u=`${l.source.width},${l.source.height},${l.output.width},${l.output.height}`;u!==this.outputKey&&(this.hide(),this.outputKey=u),n.displayed||this.setState("Original Video Fallback","Processing the latest frame; showing original playback."),this.monitor.metrics.queueDepth=1;let h=0;try{const c=new Promise((b,p)=>{h=window.setTimeout(()=>p(new Error("GPU processing timed out; original playback restored.")),1500)}),d=await Promise.race([t&&i instanceof L?i.renderTemporal(l,r.options,t.plan.alpha):i.render(this.video,l,r.options),c]);if(this.dead||s!==this.generation)return null;const m=t?.intervalMs??this.monitor.intervalMs/Math.max(.1,this.video.playbackRate);let g=!this.video.paused&&performance.now()-a>m*1.25||!e.current();if(!g&&!document.hidden&&!this.video.seeking){for(d.cpuSubmitMs+=await Promise.race([i.present(),c]),this.totalSubmissions++,this.submissionTimes.push(performance.now());this.submissionTimes.length&&performance.now()-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();this.temporal?.submittedFrame(!!t?.plan.generated)}if(this.dead||s!==this.generation)return null;d.latencyMs=performance.now()-a,g=g||!this.video.paused&&d.latencyMs>m*1.25||!e.current();const x=!g&&!document.hidden&&!this.video.seeking;this.monitor.complete(d,x&&!r.options.original&&(e.metadata!==null||!!t||!!this.temporal&&!this.video.paused),performance.now()),g&&this.monitor.metrics.missedDeadlines++;const f=d.latencyMs+(t?t.pair.flowMs*Math.min(1,m/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))):0);return this.settings.adaptive&&!this.video.paused&&(e.metadata||e.sourceDriven||t&&(this.temporal?.budget.allowSpatial||f<m*.2))&&this.adaptive.sample(f,m,g,performance.now()),x?(this.temporalMediaTime=t?.plan.mediaTime??null,n.show(),this.visibility.set(!r.options.original),this.lastPresented=performance.now(),this.frameStarted=a,r.options.original||this.presented++,this.setState(r.options.original?"Original Comparison":r.unavailable?"Engine Unavailable":l.limited?"Performance Limited":"Active",r.options.original?"Showing the unenhanced acquired frame for comparison.":r.unavailable?"Requested engine/profile is unavailable; using "+r.options.engine+".":l.limited?"Output reduced to fit display, memory and measured processing limits.":`${i.backend} processed frames are being presented.${this.backendReason?" WebGPU unavailable; using WebGL2 fallback.":""}`)):(this.hide(),this.setState("Performance Limited","Processing missed its frame deadline; showing the original video.")),x?d:null}finally{clearTimeout(h),this.monitor.metrics.queueDepth=0}}onResize(){this.invalidate("Original Video Fallback","플레이어 크기에 맞춰 표시 위치를 조절합니다.",!1),clearTimeout(this.resizeTimer),this.resizeTimer=window.setTimeout(()=>{this.overlay?.align(),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},120)}setState(e,t){this.status=e,this.reason=t}hide(){this.overlay?.hide(),this.visibility.set(!1)}invalidate(e,t,i=!0){this.hide(),this.scheduler?.invalidate(),i?this.temporal?.invalidate():this.temporal?.invalidateOutput(),this.lastPresented=0,this.setState(e,t)}fail(e){if(this.dead)return;const t=lt(e);this.monitor.metrics.failures++,this.invalidate(t.status,t.reason),this.releaseGPU()}lost(e){if(this.dead)return;const t=this.engine?.backend==="WebGPU";this.fail(new Error(e)),this.recoveries++<1&&(this.recoveryTimer=window.setTimeout(()=>{this.dead||this.initialize(t?"webgl2":void 0)},1e3))}releaseGPU(){this.generation++,this.temporal?.destroy(),this.temporal=void 0,this.scheduler?.stop(),this.scheduler=void 0,this.hide(),this.overlay?.destroy(),this.overlay=void 0,this.engine?.destroy(),this.engine=void 0,this.outputKey="",this.monitor.metrics.queueDepth=0}update(e){const t=e.adaptive!==this.settings.adaptive,i=e.targetFPS!==this.settings.targetFPS;if(this.settings=e,t&&this.adaptive.reset(),i){this.releaseGPU(),this.starting?this.restartPending=!0:this.initialize();return}this.invalidate("Original Video Fallback","설정을 GPU 처리에 적용합니다.",!1),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}stats(){const e=!!this.overlay?.displayed,t=this.monitor.snapshot();t.enhancedVisiblePercent=this.visibility.percent();const i=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0,n=this.dimensions?.eligible?this.currentEngine==="balanced"?`FSR1 EASU · ${this.settings.contentMode==="animation"?"애니메이션":"실사"}`:this.currentEngine==="fast"?"고속 경계선 재구성":"—":"원본 해상도 · 노이즈/색상 보정",s=this.settings.original||this.settings.comparison&&this.settings.divider>=1,a=this.temporal?.snapshot()??we();return this.temporal||(a.submitted=this.totalSubmissions,a.submittedFPS=this.submissionTimes.length<2?0:(this.submissionTimes.length-1)*1e3/Math.max(1,performance.now()-this.submissionTimes[0]),this.settings.targetFPS!=="original"&&(a.requestedFPS=Number(this.settings.targetFPS),a.state="unsupported",a.reason="이 백엔드는 움직임 보간을 지원하지 않아 업스케일링·색상 보정만 유지합니다.")),{status:this.status,reason:this.reason,backend:this.engine?.backend??"—",engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics:t,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm:n,presentation:e?s?"original":this.settings.comparison?"split":"enhanced":"fallback",fallback:!e,upscalingActive:e&&!s&&i>1.01,scaleRatio:i,frameAgeMs:e?performance.now()-this.frameStarted:null,temporal:a}}destroy(){this.dead||(this.dead=!0,this.abort.abort(),this.resize.disconnect(),clearInterval(this.watchdog),clearTimeout(this.resizeTimer),clearTimeout(this.recoveryTimer),this.releaseGPU())}}async function Me(o){let e="";const{engine:t,canvas:i}=await K(()=>document.createElement("canvas"),h=>{e=h},o),n=document.createElement("canvas");n.width=n.height=8;const s=n.getContext("2d"),a={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:!1},r={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5},l=[],u=async(h={})=>{await t.render(n,a,{...r,...h}),await t.present();const c=document.createElement("canvas");c.width=c.height=32;const d=c.getContext("2d",{willReadFrequently:!0});return d.drawImage(i,0,0),d.getImageData(0,0,32,32).data};try{for(const w of["fast","balanced"]){s.fillStyle="rgb(64,128,192)",s.fillRect(0,0,8,8);const y=await u({engine:w}),T=Math.max(...Array.from(y,(A,q)=>Math.abs(A-[64,128,192,255][q%4])));l.push({name:`${w}: constant field / color / alpha`,passed:T<=2,detail:`Maximum channel error ${T}/255`})}for(let w=0;w<8;w++)for(let y=0;y<8;y++){const T=20+y*28;s.fillStyle=`rgb(${T},${T},${T})`,s.fillRect(y,w,1,1)}const h=await u();let c=0;for(let w=6;w<26;w++)c=Math.max(c,Math.abs(h[(512+w)*4]-(20+((w+.5)/4-.5)*28)));l.push({name:"Balanced: linear-ramp reconstruction",passed:c<=3,detail:`Maximum interior error ${c.toFixed(2)}/255`}),s.fillStyle="black",s.fillRect(0,0,8,4),s.fillStyle="white",s.fillRect(0,4,8,4);const d=await u();l.push({name:"Video orientation preserved",passed:d[0]<3&&d[992*4]>252,detail:`Top ${d[0]}, bottom ${d[992*4]}`});for(let w=0;w<8;w++)for(let y=0;y<8;y++){const T=80+(y*17+w*13)%7*11;s.fillStyle=`rgb(${T},${T},${T})`,s.fillRect(y,w,1,1)}const m=await u(),g=await u({sharpness:1}),x=await u({denoise:1}),f=await u({engine:"fast"}),b=await u({sharpness:1,comparison:!0,divider:1}),p=(w,y)=>Array.from(w).reduce((T,A,q)=>T+Math.abs(A-y[q]),0);for(const[w,y]of[["Sharpening changes processed pixels",g],["Denoising changes processed pixels",x],["Fast and Balanced are distinct",f],["Comparison uses unenhanced pixels",b]]){const T=p(m,y);l.push({name:w,passed:T>0,detail:`Absolute channel difference ${T}`})}s.fillStyle="rgb(50,50,50)",s.fillRect(0,0,4,8),s.fillStyle="rgb(200,200,200)",s.fillRect(4,0,4,8);const P=await u({sharpness:1}),U=Math.min(...Array.from(P).filter((w,y)=>y%4!==3)),B=Math.max(...Array.from(P).filter((w,y)=>y%4!==3));if(l.push({name:"Step edge remains bounded (anti-ringing)",passed:U>=49&&B<=201,detail:`Range ${U}…${B}; source 50…200`}),e)throw new Error(e);return{backend:t.backend,checks:l}}finally{t.destroy(),i.remove()}}const ht=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,ut=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,dt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5),1));
}
`,ft=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,mt=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,ue=`
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
`,pt=`#version 300 es
`+ue+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c);float w=exp(-float(x*x+y*y)*.7-delta*delta/.0018);sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,settings.y*.7),1);}`,gt=`#version 300 es
`+ue+`
void main(){vec2 p=gl_FragCoord.xy*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{vec3 sum=vec3(0);float weight=0.;for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){float w=cubic(float(x)-f.x)*cubic(float(y)-f.y);sum+=pixel(inputTex,i+ivec2(x,y))*w;weight+=w;}color=vec4(clamp(sum/max(weight,.0001),lo,hi),1);}}
`,vt=`#version 300 es
`+ue+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
if(settings.w>.5&&gl_FragCoord.x/dims.z<divider)result=linearSample(originalTex,gl_FragCoord.xy*dims.xy/dims.zw-.5);
color=vec4(clamp(result,0.,1.),1);}`,xt=Object.freeze(Object.defineProperty({__proto__:null,composite:vt,denoise:pt,upscale:gt,vertex:mt},Symbol.toStringTag,{value:"Module"}));function bt(o,e,t,i,n,s=!1){const a=new Uint8ClampedArray(i*n*4),r=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]],l=(h,c)=>{const d=(Math.max(0,Math.min(t-1,c))*e+Math.max(0,Math.min(e-1,h)))*4;return[o[d]/255,o[d+1]/255,o[d+2]/255]},u=h=>h[1]+(h[0]+h[2])*.5;for(let h=0;h<n;h++)for(let c=0;c<i;c++){let d=(c+.5)*e/i-.5,m=(h+.5)*t/n-.5;Math.abs(d-Math.round(d))<1e-5&&(d=Math.round(d)),Math.abs(m-Math.round(m))<1e-5&&(m=Math.round(m));const g=Math.floor(d),x=Math.floor(m),f=d-g,b=m-x,p=r.map(([R,O])=>l(g+R,x+O)),[P,U,B,w,y,T,A,q,E,C,D,F]=p.map(u);let _=0,G=0,I=0;for(const[R,O,$,J,Z,X]of[[P,T,y,C,w,(1-f)*(1-b)],[U,y,C,E,A,f*(1-b)],[y,B,w,A,F,(1-f)*b],[C,w,A,q,D,f*b]]){const Q=J-O,ee=Z-R,te=Math.min(1,Math.abs(Q)/Math.max(Math.abs(J-$),Math.abs($-O),1e-6)),N=Math.min(1,Math.abs(ee)/Math.max(Math.abs(Z-$),Math.abs($-R),1e-6));_+=Q*X,G+=ee*X,I+=(te*te+N*N)*X}const W=Math.hypot(_,G);W*W<1/32768?(_=1,G=0):(_/=W,G/=W);let Y=(I*.5)**2;s&&(Y=Math.min(1,Y*1.2));const Ce=(_*_+G*G)/Math.max(Math.abs(_),Math.abs(G)),ke=1+(Ce-1)*Y,Re=1-.5*Y,fe=.5-.29*Y,me=[0,0,0];let pe=0;for(let R=0;R<12;R++){const O=r[R][0]-f,$=r[R][1]-b,J=(O*_+$*G)*ke,Z=(-O*G+$*_)*Re,X=Math.min(J*J+Z*Z,1/fe),Q=.4*X-1,ee=fe*X-1,te=(1.5625*Q*Q-.5625)*ee*ee;for(let N=0;N<3;N++)me[N]+=p[R][N]*te;pe+=te}const ge=(h*i+c)*4;for(let R=0;R<3;R++){const O=[4,9,3,6].map($=>p[$][R]);a[ge+R]=Math.round(Math.max(Math.min(...O),Math.min(Math.max(...O),me[R]/Math.max(pe,1e-6)))*255)}a[ge+3]=255}return a}const Pe={webgpu:{common:ht,denoise:ut,upscale:dt,composite:ft},webgl:xt};function ae(o,e,t,i){return{source:{width:o,height:e},processing:{width:t,height:i},output:{width:t,height:i},display:{width:t,height:i},css:{width:t,height:i},screen:null,limited:!1}}const oe={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,contentMode:"natural"},z=(o,e)=>Object.assign(document.createElement("canvas"),{width:o,height:e});function ie(o,e){let t=0,i=0;for(let s=0;s<o.length;s++)if(s%4!==3){const a=o[s]-e[s];t+=a*a,i+=Math.abs(a)}const n=o.length*3/4;return{psnr:t===0?99:10*Math.log10(65025/(t/n)),mae:i/n}}const xe=o=>[...o].sort((e,t)=>e-t)[Math.floor(o.length/2)];async function Ee(o="webgpu"){const e=await K(()=>z(1,1),()=>{},o,Pe),t=await K(()=>z(1,1),()=>{},o),i=async(n,s,a,r={})=>{await n.engine.render(s,a,{...oe,...r}),await n.engine.present();const l=z(a.output.width,a.output.height),u=l.getContext("2d",{willReadFrequently:!0});return u.drawImage(n.canvas,0,0),{data:u.getImageData(0,0,l.width,l.height).data,png:l.toDataURL("image/png")}};try{const n=z(9,7),s=n.getContext("2d"),a=s.createImageData(9,7);for(let f=0;f<a.data.length;f++)a.data[f]=f%4===3?255:(f*73+f%11*31)%256;s.putImageData(a,0,0);const r=await i(t,n,ae(9,7,23,19),{contentMode:"animation"}),l=bt(a.data,9,7,23,19,!0),u=Math.max(...Array.from(l,(f,b)=>Math.abs(f-r.data[b]))),h=[];for(const f of["line-art","natural-texture","compressed-texture"]){const b=z(768,432),p=b.getContext("2d");if(f==="line-art"){p.fillStyle="#e4e8db",p.fillRect(0,0,768,432);for(let E=0;E<14;E++)p.strokeStyle=E%3?"#1d2834":"#537789",p.lineWidth=2+E%3*1.4,p.beginPath(),p.moveTo(15+E*51,45),p.lineTo(90+E*46,390),p.stroke();p.strokeStyle="#252b3e",p.lineWidth=3,p.beginPath(),p.ellipse(355,200,165,105,.25,0,Math.PI*2),p.stroke(),p.font="bold 28px sans-serif",p.fillStyle="#172b3b",p.fillText("Edge reconstruction 0123",30,35)}else{const E=p.createImageData(768,432);for(let C=0;C<432;C++)for(let D=0;D<768;D++){const F=(C*768+D)*4,_=18*Math.sin(D*.18+C*.07)+11*Math.sin(D*.055-C*.14),G=55*Math.tanh((D-300-C*.43)/3),I=125+_+G+15*Math.sin(C*.025);E.data[F]=I*.94,E.data[F+1]=I,E.data[F+2]=I*.84,E.data[F+3]=255}p.putImageData(E,0,0)}const P=p.getImageData(0,0,768,432).data,U=z(256,144),B=U.getContext("2d"),w=B.createImageData(256,144);for(let E=0;E<144;E++)for(let C=0;C<256;C++){const D=(E*256+C)*4;for(let F=0;F<3;F++){let _=0;for(let I=0;I<3;I++)for(let W=0;W<3;W++)_+=P[((E*3+I)*768+C*3+W)*4+F];const G=f==="compressed-texture"?((C*17+E*23)%13-6)*1.3:0;w.data[D+F]=_/9+G}w.data[D+3]=255}B.putImageData(w,0,0);const y=ae(256,144,768,432),T=f==="line-art"?"animation":"natural",A=await i(e,U,y,{denoise:f==="compressed-texture"?.35:0}),q=await i(t,U,y,{denoise:f==="compressed-texture"?.35:0,contentMode:T});h.push({name:f,sharpness:0,baseline:ie(A.data,P),improved:ie(q.data,P),difference:ie(A.data,q.data).mae,images:{source:U.toDataURL(),truth:b.toDataURL(),baseline:A.png,improved:q.png}})}const c=z(640,360),d=c.getContext("2d");d.fillStyle="#9ab9ad",d.fillRect(0,0,640,360),d.fillStyle="#304857";for(let f=0;f<40;f++)d.fillRect(f*17,10,2,340);const m=ae(640,360,1920,1080),g={baseline:[],improved:[]};for(let f=0;f<36;f++)for(const[b,p]of f%2?[["improved",t],["baseline",e]]:[["baseline",e],["improved",t]]){const P=performance.now();await p.engine.render(c,m,{...oe,denoise:.2}),await p.engine.present(),f>=6&&g[b].push(performance.now()-P)}const x={source:"640×360",output:"1920×1080",samples:30,includes:"CPU + queue + GPU completion; not pure GPU timestamp",baselineMedianMs:xe(g.baseline),improvedMedianMs:xe(g.improved),baselineP95Ms:[...g.baseline].sort((f,b)=>f-b)[28],improvedP95Ms:[...g.improved].sort((f,b)=>f-b)[28]};return{backend:t.engine.backend,maxReferenceError:u,cases:h,benchmark:x}}finally{e.engine.destroy(),t.engine.destroy()}}async function wt(o,e="webgpu"){const t=new Image;t.src=o,await t.decode();const i=z(t.width,t.height);i.getContext("2d").drawImage(t,0,0);const n=ae(t.width,t.height,t.width*3,t.height*3),s=await K(()=>z(1,1),()=>{},e,Pe),a=await K(()=>z(1,1),()=>{},e),r=z(n.output.width,n.output.height),l=r.getContext("2d",{willReadFrequently:!0}),u=async(h,c)=>(await h.engine.render(i,n,{...oe,denoise:.2,contentMode:c}),await h.engine.present(),l.drawImage(h.canvas,0,0),{data:l.getImageData(0,0,r.width,r.height).data,png:r.toDataURL()});try{const h=await u(s,"natural"),c=await u(a,"natural"),d=await u(a,"animation");return{backend:a.engine.backend,source:n.source,output:n.output,sharpness:0,denoise:20,baselineToNaturalMAE:ie(h.data,c.data).mae,naturalToAnimationMAE:ie(c.data,d.data).mae,images:{baseline:h.png,natural:c.png,animation:d.png}}}finally{s.engine.destroy(),a.engine.destroy()}}const yt=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,St=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Mt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Pt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,j=(o,e)=>({source:{width:o,height:e},processing:{width:o,height:e},output:{width:o,height:e},display:{width:o,height:e},css:{width:o,height:e},screen:null,limited:!1}),k=(o,e)=>Object.assign(document.createElement("canvas"),{width:o,height:e}),V={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};async function Et(o,e,t,i,n){if(await o.render(t,i,n),await o.present(o instanceof L?"full":"none"),o instanceof L)return o.lastPixels;const s=k(i.output.width,i.output.height),a=s.getContext("2d");return a.drawImage(e,0,0),a.getImageData(0,0,s.width,s.height).data}async function Tt(o="webgpu"){const e=k(1,1),t=o==="webgpu"?await L.create(e,()=>{}):new ye(e,()=>{}),i=k(8,8),n=i.getContext("2d"),s=[];try{n.fillStyle="rgb(64,128,192)",n.fillRect(0,0,8,8);for(const a of["saturation","brightness"])for(const r of[0,50,100,150,200]){const l=await Et(t,e,i,j(8,8),{...V,[a]:r});s.push({control:a,value:r,rgb:Array.from(l.slice(0,3))})}return{backend:o,results:s}}finally{t.destroy()}}async function Ct(){const o=k(1,1),e=await L.create(o,()=>{}),t=k(128,72),i=k(128,72);function n(s,a){const r=s.getContext("2d");r.fillStyle="#101010",r.fillRect(0,0,128,72),r.fillStyle="#eeeeee",r.fillRect(a,24,32,24)}try{n(t,24),n(i,32),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1});const s=await e.captureFrame(i,{width:128,height:72},1/24,{width:128,tier:1}),a=[];for(const l of[0,.25,.5,.75,1]){await e.renderTemporal(j(128,72),V,l),await e.present("full");const u=e.lastPixels;let h=0,c=0;for(let d=0;d<72;d++)for(let m=0;m<128;m++){const g=Math.max(0,u[(d*128+m)*4]-16);h+=(m+.5)*g,c+=g}a.push({phase:l,centroid:h/c,expected:40+8*l,signature:e.lastSignature})}i.getContext("2d").fillStyle="white",i.getContext("2d").fillRect(0,0,128,72);const r=await e.captureFrame(i,{width:128,height:72},2/24,{width:128,tier:1});return await e.renderTemporal(j(128,72),V,.5),await e.present("full"),{pair:s,results:a,sceneCut:r.sceneCut,cutPixel:Array.from(e.lastPixels.slice(0,3))}}finally{e.destroy()}}async function kt(){const o=k(1,1),e=await L.create(o,()=>{}),t=[];try{for(const[i,n]of[[480,"720p"],[720,"1080p"],[1080,"1440p"],[1440,"2160p"]]){const s=i*16/9,a=k(Math.round(s),i);a.getContext("2d").fillStyle="#4080c0",a.getContext("2d").fillRect(0,0,a.width,a.height);const r=Se({width:a.width,height:i},{width:400,height:225},1,n,e.maxDimension,e.maxPixels);await e.render(a,r,{...V,upscale:!0}),await e.present("pixel"),t.push({source:r.source,target:n,actual:{width:o.width,height:o.height},pixel:Array.from(e.lastPixels),estimatedBytes:r.estimatedBytes})}return t}finally{e.destroy()}}async function Rt(){const o=k(1,1),e=await L.create(o,()=>{}),t=k(128,72),i=k(128,72),n=[],s=(r,l)=>{const u=r.getContext("2d");u.fillStyle="#101010",u.fillRect(0,0,128,72),u.fillStyle="#eeeeee",u.fillRect(l,24,32,24)};s(t,24),s(i,32);const a=r=>{const l=k(128,72);return l.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r),128,72),0,0),l.toDataURL()};try{for(const r of[24,30,60])for(const l of[75,100,120]){e.resetTemporal(),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1}),await e.captureFrame(i,{width:128,height:72},1/r,{width:128,tier:1});const u=[];for(let h=0;h/l<=1/r+1e-6;h++){const c=h*r/l;await e.renderTemporal(j(128,72),V,c),await e.present("full");const d=e.lastPixels;let m=0,g=0,x=2166136261,f=0,b=0;for(let p=0;p<72;p++)for(let P=0;P<128;P++){const U=(p*128+P)*4,B=Math.max(0,d[U]-16);m+=(P+.5)*B,g+=B,x=Math.imul(x^d[U],16777619);const w=p>=24&&p<48&&P+.5>=24+8*c&&P+.5<56+8*c?238:16,y=16+(p>=24&&p<48?222*((P>=24&&P<56?1-c:0)+(P>=32&&P<64?c:0)):0);f+=Math.abs(d[U]-w),b+=Math.abs(y-w)}u.push({alpha:c,centroid:m/g,expected:40+8*c,hash:x>>>0,mae:f/9216,unwarpedBlendMAE:b/9216,image:r===24&&l===75?a(d):void 0})}n.push({source:r,target:l,samples:u})}return n}finally{e.destroy()}}async function _t(){const o=await L.create(k(1,1),()=>{},{common:yt,denoise:St,upscale:Mt,composite:Pt}),e=await L.create(k(1,1),()=>{}),t=k(640,360),i=t.getContext("2d"),n=i.createImageData(640,360);for(let l=0;l<n.data.length;l++)n.data[l]=l%4===3?255:(l*37+l%17*19)%256;i.putImageData(n,0,0);const s={...j(1920,1080),source:{width:640,height:360}},a={...V,upscale:!0,sharpness:.25,denoise:.15},r=[];try{for(const[u,h]of[["1.1",o],["1.2",e]]){const c=[];for(let m=0;m<50;m++){const g=performance.now();await h.render(t,s,a),await h.present(),m>=10&&c.push(performance.now()-g)}const d=[...c].sort((m,g)=>m-g);r.push({version:u,times:c,median:d[20],p95:d[38]})}await o.render(t,s,a),await o.present("full"),await e.render(t,s,a),await e.present("full");let l=0;for(let u=0;u<o.lastPixels.length;u++)o.lastPixels[u]!==e.lastPixels[u]&&l++;return{method:"same current host, frozen v1.1 shaders vs v1.2 shaders; interpolation off; neutral color; 640x360→1920x1080; 10 warmup, 40 measurements; wall completion including CPU/queue/GPU",rows:r,changedChannels:l}}finally{o.destroy(),e.destroy()}}async function Lt(){const o=k(1,1),e=await L.create(o,()=>{}),t=k(8,8),i=t.getContext("2d"),n=[];i.fillStyle="rgb(64,128,192)",i.fillRect(0,0,8,8);try{await e.captureFrame(t,{width:8,height:8},0,{width:8,tier:0}),await e.captureFrame(t,{width:8,height:8},1/30,{width:8,tier:0});for(const s of[!1,!0])for(const a of[!1,!0])for(const r of[!1,!0]){const l=a?{...j(16,16),source:{width:8,height:8}}:j(8,8),u={...V,upscale:a,saturation:r?0:100,brightness:100};s?await e.renderTemporal(l,u,.5):await e.render(t,l,u),await e.present("pixel"),n.push({motion:s,upscale:a,color:r,size:{width:o.width,height:o.height},pixel:Array.from(e.lastPixels)})}return n}finally{e.destroy()}}const v=o=>document.getElementById(o),ne=v("video");let S={...Le,adaptive:!1,automaticStrength:!1,comparison:!0},M,H="";function de(){if(M?.destroy(),M=void 0,S.enabled){const o=v("backend").value;M=new ct(ne,S,void 0,o==="auto"?void 0:o),M.start()}}async function Te(){v("notice").textContent="로컬 진단 영상 생성 중 · 3초";const o=document.createElement("canvas");o.width=320,o.height=180;const e=o.getContext("2d"),t=o.captureStream(24),i=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(h=>MediaRecorder.isTypeSupported(h)),n=new MediaRecorder(t,{mimeType:i,videoBitsPerSecond:5e5}),s=[];n.ondataavailable=h=>{h.data.size&&s.push(h.data)};const a=new Promise(h=>{n.onstop=()=>h(new Blob(s,{type:n.mimeType}))});n.start();let r=0;const l=window.setInterval(()=>{const h=e.createLinearGradient(0,0,320,180);h.addColorStop(0,"#122b3e"),h.addColorStop(1,"#c9dec7"),e.fillStyle=h,e.fillRect(0,0,320,180),e.strokeStyle="#eef4df",e.lineWidth=1;for(let c=0;c<18;c++)e.beginPath(),e.moveTo(c*13+r%12,35),e.lineTo(c*13+55,145),e.stroke();e.fillStyle="#121d26",e.fillRect(10,8,300,23),e.fillStyle="#e5edeb",e.font="13px monospace",e.fillText(`CLARITY 320×180 · frame ${String(r).padStart(3,"0")}`,16,24);for(let c=145;c<175;c++)for(let d=15;d<130;d++){const m=90+(d*13+c*7+r*3)%23;e.fillStyle=`rgb(${m},${m},${m})`,e.fillRect(d,c,1,1)}e.fillStyle="#f1b36e",e.beginPath(),e.arc(200+Math.sin(r/12)*60,113,18,0,Math.PI*2),e.fill(),r++},1e3/24);await new Promise(h=>setTimeout(h,3e3)),clearInterval(l),n.stop();const u=await a;t.getTracks().forEach(h=>h.stop()),re(URL.createObjectURL(u)),v("notice").textContent="로컬 320 × 180 진단 WebM 생성 완료. 실제 HTML 영상 플레이어가 디코딩합니다."}const be=new Map;async function Ut(o){M?.destroy(),M=void 0,ne.pause();let e=be.get(o);if(!e){const t=Object.assign(document.createElement("canvas"),{width:256,height:144}),i=t.getContext("2d"),n=t.captureStream(0),s=n.getVideoTracks()[0],a=new MediaRecorder(n,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:2e6}),r=[];a.ondataavailable=h=>{h.data.size&&r.push(h.data)};const l=new Promise(h=>{a.onstop=()=>h(new Blob(r,{type:a.mimeType}))});a.start();const u=performance.now();for(let h=0;h<o*2;h++){await new Promise(d=>setTimeout(d,Math.max(0,u+h*1e3/o-performance.now()))),i.fillStyle="#101010",i.fillRect(0,0,256,144);const c=24+h*80/(o*2);i.fillStyle="#eeeeee",i.fillRect(c,48,48,48),i.fillStyle="#4080c0",i.fillRect(c+8,56,16,16),i.fillStyle="#80c040",i.fillRect(c+28,76,12,12),s.requestFrame()}await new Promise(h=>setTimeout(h,1e3/o)),a.stop(),e=await l,n.getTracks().forEach(h=>h.stop()),be.set(o,e)}re(URL.createObjectURL(e)),await ne.play()}function re(o){H&&URL.revokeObjectURL(H),H=o,ne.src=H,de(),ne.play().catch(e=>{v("notice").textContent=String(e)})}v("sample").addEventListener("click",()=>{v("sample").disabled=!0,Te().catch(o=>{v("notice").textContent=String(o)}).finally(()=>{v("sample").disabled=!1})});v("packaged").addEventListener("click",()=>{re(new URL("../diagnostic.webm",location.href).href),v("notice").textContent="포함된 로컬 320 × 180 진단 영상을 재생합니다."});v("backend").addEventListener("change",de);v("file").addEventListener("change",o=>{const e=o.target.files?.[0];e&&re(URL.createObjectURL(e))});v("toggle").addEventListener("click",()=>{S.enabled=!S.enabled,v("toggle").textContent=S.enabled?"보정 끄기":"보정 켜기",de()});v("engine").addEventListener("change",()=>{S.engine=v("engine").value,M?.update(S)});v("contentMode").addEventListener("change",()=>{S.contentMode=v("contentMode").value,M?.update(S)});v("original").addEventListener("change",()=>{S.original=v("original").checked,M?.update(S)});for(const o of["targetResolution","targetFPS"])v(o).addEventListener("change",()=>{S={...S,[o]:v(o).value},M?.update(S)});for(const o of["saturation","brightness"])v(o).addEventListener("input",()=>{S[o]=Number(v(o).value),v(o+"-value").textContent=S[o]+"%",M?.update(S)});for(const[o,e]of[["sharp","sharpness"],["noise","denoise"]])v(o).addEventListener("input",()=>{S[e]=Number(v(o).value),v(o==="sharp"?"sharp-value":"noise-value").textContent=String(S[e]),M?.update(S)});v("compare").addEventListener("change",()=>{S.comparison=v("compare").checked,M?.update(S)});v("validate").addEventListener("click",()=>{const o=v("backend").value;v("pixel-results").textContent="셰이더 컴파일 및 픽셀 확인 중…",Me(o==="auto"?void 0:o).then(e=>{v("pixel-results").textContent=`${e.backend}
`+e.checks.map(t=>`${t.passed?"PASS":"FAIL"} ${t.name}
${t.detail}`).join(`
`)}).catch(e=>{v("pixel-results").textContent=String(e)})});v("quality-review").addEventListener("click",()=>{const o=v("backend").value;M?.destroy(),M=void 0,v("quality-results").textContent="동일 조건 비교 중 · 재생 보정 일시 중지",Ee(o==="webgl2"?"webgl2":"webgpu").then(e=>{v("quality-results").textContent=JSON.stringify({...e,cases:e.cases.map(({images:t,...i})=>i)},null,2)}).catch(e=>{v("quality-results").textContent=String(e)})});const Gt=window.setInterval(()=>{v("stats").textContent=M?JSON.stringify(M.stats(),null,2):"보정 사용 안 함"},1e3);window.addEventListener("pagehide",()=>{clearInterval(Gt),M?.destroy(),H&&URL.revokeObjectURL(H)});window.clarityHarness={runPipelineCombinations:Lt,runMotionMatrix:Rt,runV11Benchmark:_t,runPixelChecks:Me,runQualityReview:Ee,compareCapturedFrame:wt,runMotionChecks:Ct,runColorChecks:Tt,runResolutionChecks:kt,motionSample:Ut,sample:Te,stats:()=>M?.stats()??null,destroy:()=>{M?.destroy(),M=void 0},settings:o=>{S={...S,...o},M?.update(S)}};
