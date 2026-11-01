import{e as Fe,a as Te,D as ze}from"./types-BmV7dO3q.js";class Be{enabled=!1;signatures=!0;generation=0;timestampSupported=null;values=new Map;counts=new Map;configure(e,t=!0){this.enabled=e,this.signatures=t,this.reset()}reset(){this.generation++,this.values.clear(),this.counts.clear()}mark(){return this.enabled?performance.now():0}elapsed(e,t){this.enabled&&this.sample(e,performance.now()-t)}sample(e,t){if(!this.enabled||!Number.isFinite(t))return;let i=this.values.get(e);i||(i=[],this.values.set(e,i)),i.length<8192&&i.push(t)}count(e,t=1){this.counts.set(e,(this.counts.get(e)??0)+t)}snapshot(){const e={};for(const[t,i]of this.values){const n=[...i].sort((a,o)=>a-o),s=i.reduce((a,o)=>a+o,0);e[t]={count:i.length,mean:s/i.length,p50:n[Math.floor(n.length*.5)],p95:n[Math.min(n.length-1,Math.floor(n.length*.95))],max:n[n.length-1],total:s}}return{enabled:this.enabled,timestampSupported:this.timestampSupported,stages:e,counters:Object.fromEntries(this.counts)}}}const p=new Be,de=r=>{const e=[];do e.unshift(r%256),r=Math.floor(r/256);while(r);return new Uint8Array(e)},X=r=>{const e=new Uint8Array(r.reduce((i,n)=>i+n.length,0));let t=0;for(const i of r)e.set(i,t),t+=i.length;return e};function q(r,e){let t=1;for(;e.length>=2**(7*t)-1;)t++;const i=de(e.length),n=new Uint8Array(t);return n.set(i,t-i.length),n[0]|=1<<8-t,X([de(r),n,e])}const G=(r,e)=>q(r,de(e)),ue=(r,e)=>q(r,new TextEncoder().encode(e));async function Ie(r,e,t,i=16){const n=new OffscreenCanvas(r,e),s=n.getContext("2d"),a=[],o=new VideoEncoder({output:m=>{const x=new Uint8Array(m.byteLength);m.copyTo(x),a.push({time:m.timestamp,key:m.type==="key",data:x})},error:m=>{throw m}});o.configure({codec:"vp8",width:r,height:e,framerate:t,bitrate:Math.max(4e5,r*e*2),latencyMode:"realtime"});for(let m=0;m<t*i;m++){const x=m/t*120/204.8%1,b=1-Math.abs(x*2-1),f=r*(.15+.4*b),v=e*.3,g=r/256;s.fillStyle="#101010",s.fillRect(0,0,r,e),s.fillStyle="#eeeeee",s.fillRect(f,v,48*g,48*g),s.fillStyle="#4080c0",s.fillRect(f+8*g,v+8*g,16*g,16*g),s.fillStyle="#80c040",s.fillRect(f+28*g,v+28*g,12*g,12*g);const S=new VideoFrame(n,{timestamp:Math.round(m*1e6/t),duration:Math.round(1e6/t)});o.encode(S,{keyFrame:m%t===0}),S.close(),o.encodeQueueSize>6&&await o.flush()}await o.flush(),o.close();const l=q(440786851,X([G(17030,1),G(17143,1),G(17138,4),G(17139,8),ue(17026,"webm"),G(17031,4),G(17029,2)])),u=new Uint8Array(8);new DataView(u.buffer).setFloat64(0,i*1e3);const c=q(357149030,X([G(2807729,1e6),q(17545,u),ue(19840,"Clarity diagnostic"),ue(22337,"Clarity diagnostic")])),h=q(374648427,q(174,X([G(215,1),G(29637,1),G(131,1),ue(134,"V_VP8"),G(2352003,Math.round(1e9/t)),q(224,X([G(176,r),G(186,e)]))]))),d=[];for(let m=0;m<i;m++){const x=a.filter(b=>Math.floor(b.time/1e6)===m).map(b=>{const f=new Uint8Array(b.data.length+4),v=Math.round(b.time/1e3)-m*1e3;return f[0]=129,f[1]=v>>8&255,f[2]=v&255,f[3]=b.key?128:0,f.set(b.data,4),q(163,f)});d.push(q(524531317,X([G(231,m*1e3),...x])))}return Array.from(X([l,q(408125543,X([c,h,...d]))]))}function qe(r){window.clarityPerf={makeClip:Ie,configure:(e,t=!0)=>p.configure(e,t),reset:()=>p.reset(),snapshot:()=>p.snapshot(),load:r}}const Oe=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
`,We=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,$e=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Ne=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Ve=`fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
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
`,je=`struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
`,Xe=`@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
`,He=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`,Ye=`@group(0) @binding(0) var a:texture_2d<f32>;
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
`;class me{constructor(e,t,i,n,s){this.device=e,this.timer=t,this.down=i,this.estimate=n,this.interpolate=s,this.uniform=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.summary=e.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;timer;down;estimate;interpolate;frames=[];low=[];flows=[];uniform;summary;readback;key="";count=0;newest=0;dead=!1;times=[0,0];downGroups=[];flowGroups=[];warpGroups=[];warpTarget;full={width:1,height:1};lowSize={width:1,height:1};grid={width:1,height:1};config={width:256,tier:1};pair={a:0,b:0,ready:!1,sceneCut:!1,dynamic:!1,confidence:0,flowMs:0,flowSize:{width:0,height:0}};static async create(e,t){e.pushErrorScope("validation");try{const i=[];for(const n of[Xe,He,Ye]){const s=e.createShaderModule({code:je+`
`+n}),o=(await s.getCompilationInfo()).messages.filter(l=>l.type==="error");if(o.length)throw new Error("움직임 셰이더 컴파일 실패: "+o.map(l=>l.message).join("; "));i.push(await e.createComputePipelineAsync({layout:"auto",compute:{module:s,entryPoint:"main"}}))}return new me(e,t,i[0],i[1],i[2])}finally{const i=await e.popErrorScope();if(i)throw new Error("움직임 셰이더 초기화 실패: "+i.message)}}params(e=1,t=!1){return new Float32Array([this.full.width,this.full.height,this.lowSize.width,this.lowSize.height,this.grid.width,this.grid.height,8,e,4+4*this.config.tier,this.config.tier===0?3:4,t?1:0,0])}resize(e,t){const i=Math.min(e.width,t.width),n=Math.max(8,Math.round(e.height*i/e.width)),s=`${e.width},${e.height},${i},${n}`;if(this.config=t,s===this.key)return;this.destroyTextures(),this.full=e,this.lowSize={width:i,height:n},this.grid={width:Math.ceil(i/8),height:Math.ceil(n/8)};const a=(o,l)=>this.device.createTexture({size:[o.width,o.height],format:l,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING});this.frames=[a(e,"rgba8unorm"),a(e,"rgba8unorm")],this.low=[a(this.lowSize,"rgba8unorm"),a(this.lowSize,"rgba8unorm")],this.flows=[a(this.grid,"rgba16float"),a(this.grid,"rgba16float")],this.downGroups=this.frames.map((o,l)=>this.device.createBindGroup({layout:this.down.getBindGroupLayout(0),entries:[{binding:0,resource:o.createView()},{binding:1,resource:this.low[l].createView()},{binding:2,resource:{buffer:this.uniform}}]})),this.flowGroups=[0,1].map(o=>this.device.createBindGroup({layout:this.estimate.getBindGroupLayout(0),entries:[{binding:0,resource:this.low[1-o].createView()},{binding:1,resource:this.low[o].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:{buffer:this.uniform}},{binding:5,resource:{buffer:this.summary}}]})),this.key=s,this.reset()}async capture(e,t,i,n){if(this.dead)throw new Error("움직임 추정 엔진이 종료되었습니다.");const s=performance.now();this.device.pushErrorScope("validation");try{this.resize(t,n),this.newest=this.count===0?0:1-this.newest,this.times[this.newest]=i,this.device.queue.writeBuffer(this.uniform,0,this.params());const a=p.mark();this.device.queue.copyExternalImageToTexture({source:e},{texture:this.frames[this.newest],colorSpace:"srgb"},[t.width,t.height]),p.elapsed("uploadCpuMs",a);const o=p.mark(),l=this.timer?.begin(),u=this.device.createCommandEncoder();let c=u.beginComputePass({timestampWrites:l?.stamp("downsample")});c.setPipeline(this.down),c.setBindGroup(0,this.downGroups[this.newest]),c.dispatchWorkgroups(Math.ceil(this.lowSize.width/8),Math.ceil(this.lowSize.height/8)),c.end(),this.count>0&&(u.clearBuffer(this.summary),c=u.beginComputePass({timestampWrites:l?.stamp("flow")}),c.setPipeline(this.estimate),c.setBindGroup(0,this.flowGroups[this.newest]),c.dispatchWorkgroups(Math.ceil(this.grid.width/8),Math.ceil(this.grid.height/8),2),c.end(),u.copyBufferToBuffer(this.summary,0,this.readback,0,32)),p.elapsed("flowPrepareCpuMs",o),l?.resolve(u),this.device.queue.submit([u.finish()]),l?.submitted(),p.count("flowDispatches",this.count>0?1:0);let h=!1,d=!1,m=0;if(this.count>0){const x=p.mark();await this.readback.mapAsync(GPUMapMode.READ),p.elapsed("flowReadbackWaitMs",x);const b=new Uint32Array(this.readback.getMappedRange()),f=Math.max(1,b[4]),v=b[0]/f/65535,g=b[1]/f/65535;m=b[2]/f/65535,d=b[3]>0&&g>1e-4,h=g>.24&&v>.12,this.readback.unmap()}else await this.device.queue.onSubmittedWorkDone();this.count++,this.pair={a:this.times[1-this.newest],b:i,ready:this.count>1,sceneCut:h,dynamic:d,confidence:m,flowMs:performance.now()-s,flowSize:{...this.lowSize}}}finally{const a=await this.device.popErrorScope();if(a)throw new Error("움직임 추정 GPU 오류: "+a.message)}return this.pair}encodeWarp(e,t,i,n){if(!this.pair.ready)throw new Error("서로 다른 두 원본 프레임을 기다리고 있습니다.");this.warpTarget!==t&&(this.warpTarget=t,this.warpGroups=[0,1].map(a=>this.device.createBindGroup({layout:this.interpolate.getBindGroupLayout(0),entries:[{binding:0,resource:this.frames[1-a].createView()},{binding:1,resource:this.frames[a].createView()},{binding:2,resource:this.flows[0].createView()},{binding:3,resource:this.flows[1].createView()},{binding:4,resource:t.createView()},{binding:5,resource:{buffer:this.uniform}}]}))),this.device.queue.writeBuffer(this.uniform,0,this.params(i,this.pair.sceneCut));const s=e.beginComputePass({timestampWrites:n?.stamp("warp")});s.setPipeline(this.interpolate),s.setBindGroup(0,this.warpGroups[this.newest]),s.dispatchWorkgroups(Math.ceil(this.full.width/8),Math.ceil(this.full.height/8)),s.end()}reset(){this.count=0,this.times=[0,0],this.pair.ready=!1,this.warpTarget=void 0}destroyTextures(){for(const e of[...this.frames,...this.low,...this.flows])e.destroy();this.frames=[],this.low=[],this.flows=[],this.warpTarget=void 0,this.warpGroups=[]}destroy(){this.dead||(this.dead=!0,this.destroyTextures(),this.uniform.destroy(),this.summary.destroy(),this.readback.destroy())}}class Ke{slots=[];dead=!1;constructor(e){if(p.enabled&&e.features.has("timestamp-query"))for(let t=0;t<4;t++)this.slots.push({query:e.createQuerySet({type:"timestamp",count:16}),resolve:e.createBuffer({size:256,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:e.createBuffer({size:256,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1})}begin(){if(this.dead||!p.enabled)return null;const e=this.slots.find(t=>!t.busy);return e?(e.busy=!0,new Qe(e,p.generation,()=>this.dead)):(p.count("timestampSkipped"),null)}destroy(){this.dead=!0;for(const e of this.slots)e.query.destroy(),e.resolve.destroy(),e.read.destroy();this.slots=[]}}class Qe{constructor(e,t,i){this.slot=e,this.generation=t,this.dead=i}slot;generation;dead;names=[];stamp(e){const t=this.names.length*2;return this.names.push(e),{querySet:this.slot.query,beginningOfPassWriteIndex:t,endOfPassWriteIndex:t+1}}resolve(e){this.names.length&&(e.resolveQuerySet(this.slot.query,0,this.names.length*2,this.slot.resolve,0),e.copyBufferToBuffer(this.slot.resolve,0,this.slot.read,0,this.names.length*16))}submitted(){if(!this.names.length){this.slot.busy=!1;return}const e=p.mark();this.slot.read.mapAsync(GPUMapMode.READ).then(()=>{if(!this.dead()&&this.generation===p.generation){const t=new BigUint64Array(this.slot.read.getMappedRange());this.names.forEach((i,n)=>p.sample("gpu."+i+"Ms",Number(t[n*2+1]-t[n*2])/1e6)),p.elapsed("diagnosticReadbackWaitMs",e)}this.slot.read.unmap()}).catch(()=>{this.dead()||p.count("timestampReadError")}).finally(()=>{this.slot.busy=!1})}}const Je=`@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
`;class pe{constructor(e,t){this.device=e,this.pipeline=t,this.value=e.createBuffer({size:8,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.readback=e.createBuffer({size:8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}device;pipeline;value;readback;static async create(e){const t=e.createShaderModule({code:Je}),i=await e.createComputePipelineAsync({layout:"auto",compute:{module:t,entryPoint:"main"}});return new pe(e,i)}encode(e,t,i){e.clearBuffer(this.value);const n=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:{buffer:this.value}}]}),s=e.beginComputePass({timestampWrites:i?.stamp("signature")});s.setPipeline(this.pipeline),s.setBindGroup(0,n),s.dispatchWorkgroups(4),s.end(),e.copyBufferToBuffer(this.value,0,this.readback,0,8)}async read(){const e=p.mark();await this.readback.mapAsync(GPUMapMode.READ),p.elapsed("signatureReadbackWaitMs",e);const t=new Uint32Array(this.readback.getMappedRange()),i=t[0].toString(16)+":"+t[1].toString(16);return this.readback.unmap(),i}destroy(){this.value.destroy(),this.readback.destroy()}}class D{constructor(e,t,i,n,s){this.canvas=e,this.device=t,this.clean=i,this.reconstruct=n,this.presentPipeline=s,this.timer=new Ke(t),this.maxDimension=t.limits.maxTextureDimension2D;const a=e.getContext("webgpu");if(!a)throw new Error("WebGPU canvas context unavailable.");this.context=a,a.configure({device:t,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:"opaque",colorSpace:"srgb",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),this.uniform=t.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}canvas;device;clean;reconstruct;presentPipeline;backend="WebGPU";maxPixels=8294400;maxDimension;context;uniform;textures=[];denoiseGroup;upscaleRaw;upscaleClean;compositeGroup;compositeRaw;compositeClean;key="";dead=!1;timer;motion;signature;measureSignature=!1;lastSignature=null;lastPixels=null;static async create(e,t,i={common:Oe,denoise:We,upscale:$e,composite:Ne}){if(!navigator.gpu)throw new Error("WebGPU is unavailable in this browser/context.");const n=await navigator.gpu.requestAdapter({powerPreference:"low-power"});if(!n)throw new Error("No WebGPU adapter.");p.timestampSupported=n.features.has("timestamp-query");const s=await n.requestDevice({requiredFeatures:p.enabled&&p.timestampSupported?["timestamp-query"]:[]});try{const a=[i.denoise,i.upscale,i.composite].map(h=>s.createShaderModule({code:i.common+`
`+Ve+`
`+h}));for(const h of a){const m=(await h.getCompilationInfo()).messages.filter(x=>x.type==="error");if(m.length)throw new Error(m.map(x=>`WGSL ${x.lineNum}: ${x.message}`).join("; "))}const[o,l,u]=await Promise.all([s.createComputePipelineAsync({layout:"auto",compute:{module:a[0],entryPoint:"main"}}),s.createComputePipelineAsync({layout:"auto",compute:{module:a[1],entryPoint:"main"}}),s.createRenderPipelineAsync({layout:"auto",vertex:{module:a[2],entryPoint:"vertex"},fragment:{module:a[2],entryPoint:"fragment",targets:[{format:navigator.gpu.getPreferredCanvasFormat()}]},primitive:{topology:"triangle-list"}})]),c=new D(e,s,o,l,u);return s.lost.then(h=>{c.dead||t(`WebGPU device lost: ${h.message||h.reason}`)}),s.addEventListener("uncapturederror",h=>{c.dead||t(`WebGPU: ${h.error.message}`)}),c}catch(a){throw s.destroy(),a}}resize(e){const{source:t,output:i}=e,n=`${t.width},${t.height},${i.width},${i.height}`;if(n===this.key)return;if(this.textures.forEach(u=>u.destroy()),this.textures=[],this.key="",Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe GPU memory or texture limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const[u,c]of[t,t,i].entries())this.textures.push(this.device.createTexture({label:["source","denoised","reconstructed"][u],size:[c.width,c.height],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.STORAGE_BINDING}));const[s,a,o]=this.textures.map(u=>u.createView()),l=(u,c,h)=>this.device.createBindGroup({layout:u,entries:[{binding:0,resource:c},{binding:1,resource:h},{binding:2,resource:{buffer:this.uniform}}]});this.denoiseGroup=l(this.clean.getBindGroupLayout(0),s,a),this.upscaleRaw=l(this.reconstruct.getBindGroupLayout(0),s,o),this.upscaleClean=l(this.reconstruct.getBindGroupLayout(0),a,o),this.compositeGroup=l(this.presentPipeline.getBindGroupLayout(0),s,o),this.compositeRaw=l(this.presentPipeline.getBindGroupLayout(0),s,s),this.compositeClean=l(this.presentPipeline.getBindGroupLayout(0),s,a),this.key=n}async render(e,t,i){return this.renderInternal(e,t,i)}async captureFrame(e,t,i,n){if(this.dead)throw new Error("GPU 엔진이 종료되었습니다.");if(!this.motion){const s=await me.create(this.device,this.timer);if(this.dead)throw s.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.motion=s}return this.motion.capture(e,t,i,n)}resetTemporal(){this.motion?.reset()}releaseTemporal(){this.motion?.destroy(),this.motion=void 0,this.signature?.destroy(),this.signature=void 0,this.lastSignature=null}async renderTemporal(e,t,i){if(!this.motion)throw new Error("움직임 추정이 준비되지 않았습니다.");return this.renderInternal(null,e,{...t,measureSignature:!0},i)}async renderInternal(e,t,i,n=1){if(this.dead)throw new Error("GPU engine has been destroyed.");const s=performance.now(),a=this.device;a.pushErrorScope("validation"),a.pushErrorScope("out-of-memory");let o;try{if(this.resize(t),this.measureSignature=!!i.measureSignature,this.measureSignature&&!this.signature){const v=await pe.create(this.device);if(this.dead)throw v.destroy(),new Error("GPU 엔진이 종료되었습니다.");this.signature=v}const{source:d,output:m}=t;a.queue.writeBuffer(this.uniform,0,new Float32Array([d.width,d.height,m.width,m.height,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0,i.divider,i.contentMode==="animation"?1:0,i.original?1:0,0,(i.saturation??100)/100,(i.brightness??100)/100,i.upscale===!1?0:1,0])),e&&a.queue.copyExternalImageToTexture({source:e},{texture:this.textures[0],colorSpace:"srgb"},[d.width,d.height]);const x=a.createCommandEncoder(),b=this.timer.begin();e||this.motion.encodeWarp(x,this.textures[0],n,b);const f=!i.original&&i.engine==="balanced"&&i.denoise>0;if(f){const v=x.beginComputePass({timestampWrites:b?.stamp("denoise")});v.setPipeline(this.clean),v.setBindGroup(0,this.denoiseGroup),v.dispatchWorkgroups(Math.ceil(d.width/8),Math.ceil(d.height/8)),v.end()}if(!i.original&&i.upscale!==!1){const v=x.beginComputePass({timestampWrites:b?.stamp("upscale")});v.setPipeline(this.reconstruct),v.setBindGroup(0,f?this.upscaleClean:this.upscaleRaw),v.dispatchWorkgroups(Math.ceil(m.width/8),Math.ceil(m.height/8)),v.end()}this.selectedComposite=i.upscale===!1?f?this.compositeClean:this.compositeRaw:this.compositeGroup,b?.resolve(x),a.queue.submit([x.finish()]),b?.submitted()}catch(d){o=d}const l=performance.now()-s,u=p.mark(),c=await a.popErrorScope(),h=await a.popErrorScope();if(p.elapsed("renderErrorScopeWaitMs",u),o)throw o;if(c||h)throw new Error((c||h).message);if(e){const d=p.mark();await a.queue.onSubmittedWorkDone(),p.elapsed("renderFenceWaitMs",d)}if(this.dead)throw new Error("GPU was destroyed during processing.");return{cpuSubmitMs:l,latencyMs:performance.now()-s,gpuMs:null}}selectedComposite;async present(e="none"){if(this.dead||!this.compositeGroup)throw new Error("No completed GPU frame to present.");const t=performance.now();this.device.pushErrorScope("validation");const i=this.device.createCommandEncoder(),n=this.timer.begin(),s=this.context.getCurrentTexture(),a=i.beginRenderPass({timestampWrites:n?.stamp("composite"),colorAttachments:[{view:s.createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});a.setPipeline(this.presentPipeline),a.setBindGroup(0,this.selectedComposite??this.compositeGroup),a.draw(3),a.end(),this.measureSignature&&this.signature.encode(i,s,n);const o=e==="full"?this.canvas.width:1,l=e==="full"?this.canvas.height:1,u=Math.ceil(o*4/256)*256,c=e!=="none"?this.device.createBuffer({size:u*l,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}):null;c&&i.copyTextureToBuffer({texture:s},{buffer:c,bytesPerRow:u},[o,l]),n?.resolve(i),this.device.queue.submit([i.finish()]),n?.submitted(),p.count("canvasSubmissions");const h=performance.now()-t,d=p.mark(),m=await this.device.popErrorScope();if(p.elapsed("presentErrorScopeWaitMs",d),m)throw new Error(m.message);const x=p.mark();if(this.measureSignature?this.lastSignature=await this.signature.read():(await this.device.queue.onSubmittedWorkDone(),this.lastSignature=null),p.elapsed("presentFenceWaitMs",x),this.lastPixels=null,c)try{await c.mapAsync(GPUMapMode.READ);const b=new Uint8Array(c.getMappedRange()),f=new Uint8ClampedArray(o*l*4),v=navigator.gpu.getPreferredCanvasFormat().startsWith("bgra");for(let g=0;g<l;g++)for(let S=0;S<o;S++){const C=g*u+S*4,U=(g*o+S)*4;f[U]=b[C+(v?2:0)],f[U+1]=b[C+1],f[U+2]=b[C+(v?0:2)],f[U+3]=b[C+3]}this.lastPixels=f,c.unmap()}finally{c.destroy()}return h}destroy(){this.dead||(this.dead=!0,this.timer.destroy(),this.releaseTemporal(),this.textures.forEach(e=>e.destroy()),this.textures=[],this.uniform.destroy(),this.context.unconfigure(),this.device.destroy())}}const Ze=`// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
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
`,et=`vec3 toLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(.04045)));}
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
`,tt=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,ge=`
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
`,it=`#version 300 es
`+ge+`
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`,st=`#version 300 es
`+ge+Ze+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`,nt=`#version 300 es
`+ge+et+`
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(adjustColor(clamp(result,0.,1.),colorSettings.x,colorSettings.y),1);}`,at=Object.freeze(Object.defineProperty({__proto__:null,composite:nt,denoise:it,upscale:st,vertex:tt},Symbol.toStringTag,{value:"Module"}));class ke{constructor(e,t,i=at){this.canvas=e;const n=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,powerPreference:"low-power"});if(!n)throw new Error("WebGL2 unavailable.");this.gl=n,this.maxDimension=n.getParameter(n.MAX_TEXTURE_SIZE),this.completionChannel.port2.onmessage=()=>this.completionPoll?.(),this.fb=n.createFramebuffer(),this.vao=n.createVertexArray(),n.bindVertexArray(this.vao),this.onContextLost=s=>{s.preventDefault(),this.dead||t("WebGL context lost.")},e.addEventListener("webglcontextlost",this.onContextLost);try{for(const s of[i.denoise,i.upscale,i.composite]){const a=this.compile(s,i.vertex);this.programs.push(a),this.uniforms.push(Object.fromEntries(["inputTex","originalTex","dims","settings","divider","contentMode","originalView","colorSettings"].map(o=>[o,n.getUniformLocation(a,o)])))}n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!0),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL)}catch(s){throw this.destroy(),s}}canvas;backend="WebGL2";maxPixels=8294400;maxDimension;gl;programs=[];textures=[];uniforms=[];pendingPresent;completionChannel=new MessageChannel;completionPoll;cancelWait;pollTimer=0;fb;vao;key="";dead=!1;onContextLost;compile(e,t){const i=this.gl,n=i.createProgram(),s=[];try{for(const[a,o]of[[i.VERTEX_SHADER,t],[i.FRAGMENT_SHADER,e]]){const l=i.createShader(a);if(s.push(l),i.shaderSource(l,o),i.compileShader(l),!i.getShaderParameter(l,i.COMPILE_STATUS))throw new Error(i.getShaderInfoLog(l)||"GLSL compilation failed");i.attachShader(n,l)}if(i.linkProgram(n),!i.getProgramParameter(n,i.LINK_STATUS))throw new Error(i.getProgramInfoLog(n)||"GLSL link failed");return n}catch(a){throw i.deleteProgram(n),a}finally{s.forEach(a=>i.deleteShader(a))}}resize(e){const{source:t,output:i}=e,n=`${t.width},${t.height},${i.width},${i.height}`;if(this.key===n)return;const s=this.gl;if(this.textures.forEach(a=>s.deleteTexture(a)),this.textures=[],Math.max(t.width,t.height,i.width,i.height)>this.maxDimension||t.width*t.height*8+i.width*i.height*8>160*1024*1024)throw new Error("Resolution exceeds safe texture/memory limits.");this.canvas.width=i.width,this.canvas.height=i.height;for(const a of[t,t,i]){const o=s.createTexture();this.textures.push(o),s.bindTexture(s.TEXTURE_2D,o),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.NEAREST),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),s.texStorage2D(s.TEXTURE_2D,1,s.RGBA8,a.width,a.height)}this.key=n}async render(e,t,i){if(this.dead)throw new Error("WebGL engine destroyed.");const n=performance.now(),s=this.gl;this.resize(t),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,s.RGBA,s.UNSIGNED_BYTE,e);const a=(c,h,d,m,x)=>{const b=this.programs[c],f=this.uniforms[c];if(s.useProgram(b),s.bindVertexArray(this.vao),s.bindFramebuffer(s.FRAMEBUFFER,d?this.fb:null),d&&(s.framebufferTexture2D(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,d,0),s.checkFramebufferStatus(s.FRAMEBUFFER)!==s.FRAMEBUFFER_COMPLETE))throw new Error("Incomplete GPU framebuffer.");s.viewport(0,0,m,x),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,h),s.uniform1i(f.inputTex,0),s.activeTexture(s.TEXTURE1),s.bindTexture(s.TEXTURE_2D,this.textures[0]),s.uniform1i(f.originalTex,1),s.uniform4f(f.dims,t.source.width,t.source.height,t.output.width,t.output.height),s.uniform4f(f.settings,i.sharpness,i.denoise,i.engine==="balanced"?1:0,i.comparison?1:0),s.uniform1f(f.divider,i.divider),s.uniform1f(f.contentMode,i.contentMode==="animation"?1:0),s.uniform1f(f.originalView,i.original?1:0),s.uniform2f(f.colorSettings,(i.saturation??100)/100,(i.brightness??100)/100),s.drawArrays(s.TRIANGLES,0,3)},o=!i.original&&i.engine==="balanced"&&i.denoise>0;o&&a(0,this.textures[0],this.textures[1],t.source.width,t.source.height),!i.original&&i.upscale!==!1&&a(1,this.textures[o?1:0],this.textures[2],t.output.width,t.output.height),this.pendingPresent=()=>a(2,this.textures[i.upscale===!1?o?1:0:2],null,t.output.width,t.output.height);const l=s.getError();if(l!==s.NO_ERROR)throw new Error(`WebGL rendering error 0x${l.toString(16)}`);const u=performance.now()-n;return await this.waitGPU(n),{cpuSubmitMs:u,latencyMs:performance.now()-n,gpuMs:null}}async present(){if(this.dead||!this.pendingPresent)throw new Error("No completed WebGL frame to present.");const e=performance.now();this.pendingPresent();const t=performance.now()-e,i=this.gl.getError();if(i!==this.gl.NO_ERROR)throw new Error(`WebGL presentation error 0x${i.toString(16)}`);return await this.waitGPU(e),t}async waitGPU(e){const t=this.gl,i=t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE,0);if(t.flush(),!i)throw new Error("GPU synchronization unavailable.");try{await new Promise((n,s)=>{let a=0;this.cancelWait=()=>s(new Error("WebGL engine destroyed during GPU work."));const o=()=>{if(this.dead||t.isContextLost()){s(new Error("WebGL context unavailable."));return}const l=t.clientWaitSync(i,0,0);l===t.ALREADY_SIGNALED||l===t.CONDITION_SATISFIED?n():l===t.WAIT_FAILED||performance.now()-e>1200?s(new Error("GPU completion timed out.")):++a%8===0?this.pollTimer=window.setTimeout(()=>this.completionChannel.port1.postMessage(0),0):this.completionChannel.port1.postMessage(0)};this.completionPoll=o,o()})}finally{this.completionPoll=void 0,this.cancelWait=void 0,clearTimeout(this.pollTimer),t.deleteSync(i)}}destroy(){if(this.dead)return;this.dead=!0;const e=this.gl;this.cancelWait?.(),clearTimeout(this.pollTimer),this.completionChannel.port1.close(),this.completionChannel.port2.close(),this.canvas.removeEventListener("webglcontextlost",this.onContextLost),this.textures.forEach(t=>e.deleteTexture(t)),this.programs.forEach(t=>e.deleteProgram(t)),e.deleteFramebuffer(this.fb),e.deleteVertexArray(this.vao),e.getExtension("WEBGL_lose_context")?.loseContext()}}async function Z(r,e,t,i){let n="";if(t!=="webgl2"){const a=r();try{return{engine:await D.create(a,e,i?.webgpu),canvas:a,reason:n}}catch(o){if(a.remove(),n=o instanceof Error?o.message:String(o),t==="webgpu")throw o}}const s=r();try{return{engine:new ke(s,e,i?.webgl),canvas:s,reason:n}}catch(a){throw s.remove(),new Error(`${n?`WebGPU: ${n}. `:""}WebGL2: ${a instanceof Error?a.message:String(a)}`)}}const Me={eco:{engine:"fast",sharpness:.55,denoise:0,budget:.5},balanced:{engine:"balanced",sharpness:.8,denoise:.7,budget:.65},quality:{engine:"balanced",sharpness:1,denoise:1,budget:.8}},rt={windowMs:2200,cooldownMs:5e3,promoteWindows:2,demoteWindows:2,low:.46,high:.9,maxMiss:.15};class ot{constructor(e=rt){this.config=e}config;profile="eco";workload=1;ema=0;start=0;lastChange=-1/0;count=0;misses=0;good=0;bad=0;warmup=0;reset(e=performance.now()){this.profile="eco",this.workload=1,this.ema=0,this.start=e,this.lastChange=-1/0,this.count=this.misses=this.good=this.bad=this.warmup=0}sample(e,t,i,n){if(this.warmup++<6)return!1;const s=e/Math.max(4,t*Me[this.profile].budget);if(this.ema=this.count===0&&this.ema===0?s:.12*s+.88*this.ema,this.count++,i&&this.misses++,n-this.start<this.config.windowMs||this.count<12)return!1;const a=this.misses/this.count;if(this.bad=this.ema>this.config.high||a>this.config.maxMiss?this.bad+1:0,this.good=this.ema<this.config.low&&a<.03?this.good+1:0,this.start=n,this.count=this.misses=0,n-this.lastChange<this.config.cooldownMs)return!1;const o=["eco","balanced","quality"];let l=o.indexOf(this.profile),u=!1;return this.bad>=this.config.demoteWindows?(l>0?this.profile=o[--l]:this.workload=Math.max(.4,this.workload*.8),u=!0):this.good>=this.config.promoteWindows&&(this.workload<1?(this.workload=Math.min(1,this.workload/.8),u=!0):l<o.length-1&&(this.profile=o[++l],u=!0)),u&&(this.lastChange=n,this.bad=this.good=0),u}options(e){const t=e.profile==="ultra"||e.engine==="anime4k"||e.engine==="neural",i=e.adaptive?this.profile:e.profile==="ultra"?"quality":e.profile,n=Me[i];return{profile:i,unavailable:t,options:{engine:e.engine==="fast"||e.engine==="balanced"?e.engine:n.engine,sharpness:e.sharpness/100*(e.automaticStrength?n.sharpness:1),denoise:e.denoise/100*(e.automaticStrength?n.denoise:1),comparison:e.comparison,divider:e.divider,contentMode:e.contentMode,original:e.original||e.comparison&&e.divider>=1,saturation:e.saturation,brightness:e.brightness}}}}const lt={"720p":{height:720,maxSource:480},"1080p":{height:1080,maxSource:720},"1440p":{height:1440,maxSource:1080},"2160p":{height:2160,maxSource:1440}};function Ce(r,e,t,i,n=8192,s=8294400,a=1,o=null,l=!1,u=r.height){const c=i==="original"?null:lt[i],h=!!c&&u<=c.maxSource&&r.height<c.height,d=h?{width:Math.round(r.width*c.height/r.height),height:c.height}:{...r},m=r.width*r.height*(l?16:8),x=224*1024*1024,b=Math.max(0,(x-m-(l?4*1024*1024:0))/8),f=h?Math.max(r.width/d.width,a):1,v=Math.min(f,n/d.width,n/d.height,Math.sqrt(Math.min(s,b)/(d.width*d.height)));if(!h&&v<.999)throw new Error("원본 해상도가 GPU 텍스처 또는 메모리 한도를 초과하여 원본 플레이어로 복귀합니다.");const g={width:Math.max(1,Math.floor(d.width*v)),height:Math.max(1,Math.floor(d.height*v))};return{source:{...r},processing:{...g},output:g,requested:d,display:{width:Math.round(e.width*t),height:Math.round(e.height*t)},css:e,screen:o,eligible:h,limited:v<.98,estimatedBytes:m+g.width*g.height*8+(l?4*1024*1024:0),resolutionReason:i==="original"?"원본 해상도: 업스케일링을 생략합니다.":h?v<.98?"GPU 성능·메모리 한도로 실제 처리 해상도를 낮췄습니다.":"선택한 목표 해상도로 GPU 재구성합니다.":"현재 원본에는 선택한 업스케일링 조건이 적용되지 않습니다."}}class ct{metrics=Fe();intervalMs=1e3/30;previousMedia=null;previousFrames=0;outputs=[];frame(e,t,i,n){if(this.previousMedia!==null){const s=e-this.previousMedia,a=t-this.previousFrames;if(s>0&&s<1&&a>0&&a<120){const o=s*1e3/a;o>=4&&o<=500&&(this.intervalMs=this.intervalMs*.85+o*.15),this.metrics.sourceFPS=1e3/this.intervalMs}}this.previousMedia=e,this.previousFrames=t,this.metrics.latenessMs=Math.max(0,i-n)}discontinuity(){this.previousMedia=null,this.previousFrames=0,this.outputs=[],this.metrics.sourceFPS=null}complete(e,t,i){const n=(s,a)=>s===null?a:.15*a+.85*s;if(this.metrics.latencyMs=n(this.metrics.latencyMs,e.latencyMs),this.metrics.cpuSubmitMs=n(this.metrics.cpuSubmitMs,e.cpuSubmitMs),this.metrics.gpuMs=e.gpuMs===null?null:n(this.metrics.gpuMs,e.gpuMs),t)for(this.outputs.push(i);this.outputs.length>0&&i-this.outputs[0]>=2e3;)this.outputs.shift()}snapshot(e=performance.now()){return this.outputs=this.outputs.filter(t=>e-t<2e3),this.metrics.processedFPS=this.outputs.length<2?0:(this.outputs.length-1)*1e3/Math.max(1,e-this.outputs[0]),{...this.metrics}}}class ut{changes;start;constructor(e=performance.now()){this.start=e,this.changes=[{at:e,visible:!1}]}set(e,t=performance.now()){this.changes[this.changes.length-1].visible!==e&&this.changes.push({at:t,visible:e}),this.trim(t)}trim(e){for(;this.changes.length>1&&this.changes[1].at<=e-2e3;)this.changes.shift()}percent(e=performance.now()){this.trim(e);const t=Math.max(this.start,e-2e3);let i=0;for(let n=0;n<this.changes.length;n++)this.changes[n].visible&&(i+=Math.max(0,(this.changes[n+1]?.at??e)-Math.max(t,this.changes[n].at)));return e>t?i/(e-t)*100:0}}class ht{constructor(e,t,i,n){this.video=e,this.process=t,this.skip=i,this.error=n}video;process;skip;error;callback=0;running=!1;busy=!1;revision=0;lastTime=-1;refreshPending=!1;start(){this.running||(this.running=!0,this.schedule())}schedule(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{this.callback=0,this.schedule(),t.mediaTime!==this.lastTime&&(this.lastTime=t.mediaTime,this.dispatch(t))}))}refresh(){this.running&&this.video.readyState>=2&&this.dispatch(null)}invalidate(){this.revision++,this.lastTime=-1}dispatch(e){const t=++this.revision;if(this.busy){(!e||this.video.paused)&&(this.refreshPending=!0),this.skip();return}this.busy=!0,this.process({metadata:e,current:()=>this.running&&t===this.revision}).catch(i=>{this.running&&this.error(i)}).finally(()=>{this.busy=!1,this.refreshPending&&this.running&&(this.refreshPending=!1,this.refresh())})}stop(){this.running=!1,this.refreshPending=!1,this.invalidate(),this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.callback=0}}class dt{constructor(e,t,i){this.video=e,this.moveDivider=i,this.canvas=t,this.parent=e.parentElement,getComputedStyle(this.parent).position==="static"&&(this.originalPosition=this.parent.style.position,this.parent.style.position="relative"),t.className="clarity-gpu-overlay";const n=Number.parseInt(getComputedStyle(e).zIndex,10);Object.assign(t.style,{position:"absolute",pointerEvents:"none",zIndex:String(Number.isFinite(n)?n+1:1),display:"none",maxWidth:"none",maxHeight:"none",filter:"none",opacity:"1",transform:"none"}),t.setAttribute("aria-hidden","true"),this.parent.append(t),this.line=document.createElement("div"),this.handle=document.createElement("div"),Object.assign(this.line.style,{position:"absolute",display:"none",pointerEvents:"none",zIndex:String(Number.isFinite(n)?n+2:2),borderLeft:"1px solid rgba(255,255,255,.8)"}),Object.assign(this.handle.style,{position:"absolute",top:"12%",height:"65%",left:"-9px",width:"18px",pointerEvents:"auto",cursor:"ew-resize",touchAction:"none"}),this.handle.role="slider",this.handle.tabIndex=0,this.handle.setAttribute("aria-label","원본과 보정 영상 비교 경계"),this.handle.setAttribute("aria-valuemin","0"),this.handle.setAttribute("aria-valuemax","100"),this.line.append(this.handle),this.parent.append(this.line);const s=a=>{const o=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(a-o.left)/o.width)),this.moveDivider(this.divider),this.align()};this.handle.addEventListener("pointerdown",a=>{a.stopPropagation(),a.preventDefault(),this.handle.setPointerCapture(a.pointerId),s(a.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("pointermove",a=>{this.handle.hasPointerCapture(a.pointerId)&&s(a.clientX)},{signal:this.abort.signal}),this.handle.addEventListener("keydown",a=>{(a.key==="ArrowLeft"||a.key==="ArrowRight")&&(a.preventDefault(),a.stopPropagation(),this.divider=Math.max(.02,Math.min(.98,this.divider+(a.key==="ArrowLeft"?-.02:.02))),this.moveDivider(this.divider),this.align())},{signal:this.abort.signal}),this.align()}video;moveDivider;canvas;line;handle;parent;abort=new AbortController;originalPosition=null;visible=!1;comparing=!1;divider=.5;css={width:1,height:1};get displayed(){return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=="none"}align(){const e=this.video.getBoundingClientRect(),t=this.parent.getBoundingClientRect(),i=this.parent.offsetWidth>0&&t.width>0?t.width/this.parent.offsetWidth:1,n=this.parent.offsetHeight>0&&t.height>0?t.height/this.parent.offsetHeight:1,s=this.video.videoWidth||e.width,a=this.video.videoHeight||e.height,o=Math.min(e.width/s,e.height/a),l=s*o,u=a*o,c=(e.left-t.left+(e.width-l)/2)/Math.max(.01,i)+this.parent.scrollLeft-this.parent.clientLeft,h=(e.top-t.top+(e.height-u)/2)/Math.max(.01,n)+this.parent.scrollTop-this.parent.clientTop;return this.css={width:l/Math.max(.01,i),height:u/Math.max(.01,n)},Object.assign(this.canvas.style,{left:`${c}px`,top:`${h}px`,width:`${this.css.width}px`,height:`${this.css.height}px`}),Object.assign(this.line.style,{left:`${c+this.css.width*this.divider}px`,top:`${h}px`,height:`${this.css.height}px`}),this.handle.setAttribute("aria-valuenow",String(Math.round(this.divider*100))),{width:l,height:u}}compare(e,t){e===this.comparing&&t===this.divider||(this.comparing=e,this.divider=t,this.align(),this.line.style.display=this.visible&&e?"block":"none")}show(){this.visible=!0,this.canvas.style.display="block",this.line.style.display=this.comparing?"block":"none"}hide(){this.visible=!1,this.canvas.style.display="none",this.line.style.display="none"}destroy(){this.hide(),this.abort.abort(),this.canvas.remove(),this.line.remove(),this.originalPosition!==null&&(this.parent.style.position=this.originalPosition)}}const oe=45;function ft(r,e,t,i,n,s=!1,a=!0){const o=(e-r)*1e3/Math.max(.1,i);if(o<4||o>oe||!Number.isFinite(t))return null;if(s||!a)return{alpha:1,mediaTime:e,delayMs:(t-e)*1e3/i,generated:!1};const l=t+Math.min(12,Math.max(0,n))*i/1e3,u=Math.max(0,o-3),c=l-u*i/1e3;if(c<r-.002||c>e+.008)return null;const h=Math.max(0,Math.min(1,(c-r)/(e-r)));return{alpha:h,mediaTime:r+(e-r)*h,delayMs:u,generated:h>.001&&h<.999}}function mt(r,e,t){const i=(r-e)*1e3/Math.max(.1,t);return i>=-2&&i<=oe}class pt{previous=0;intervals=[];hz=null;tick(e){if(this.previous){const t=e-this.previous;if(t>=4&&t<=50&&(this.intervals.push(t),this.intervals.length>40&&this.intervals.shift(),this.intervals.length>=10)){const i=[...this.intervals].sort((n,s)=>n-s);this.hz=1e3/i[Math.floor(i.length/2)]}}this.previous=e}reset(){this.previous=0,this.intervals=[],this.hz=null}}class gt{intervals=[];add(e){e>=4&&e<=250&&(this.intervals.push(e),this.intervals.length>40&&this.intervals.shift())}get period(){if(!this.intervals.length)return null;const e=[...this.intervals].sort((t,i)=>t-i);return e[Math.floor(e.length/2)]}reset(){this.intervals=[]}}class vt{tier=1;scale=1;frequency=1;allowSpatial=!1;ema=0;count=0;misses=0;start=0;last=-1/0;bad=0;good=0;sample(e,t,i,n,s){s&&(this.ema=this.ema===0?e/t:this.ema*.9+e/t*.1,this.count++,i&&this.misses++,!(n-this.start<2e3||this.count<24)&&(this.bad=this.ema>.9||this.misses/this.count>.15?this.bad+1:0,this.good=this.ema<.45&&this.misses===0?this.good+1:0,this.start=n,this.count=this.misses=0,!(n-this.last<4e3)&&(this.bad>=2?(this.tier>0?this.tier--:this.scale>.51?this.scale*=.75:this.allowSpatial?this.frequency=Math.max(.4,this.frequency*.8):this.allowSpatial=!0,this.last=n,this.bad=this.good=0):this.good>=3&&(this.frequency<1?this.frequency=Math.min(1,this.frequency/.8):this.allowSpatial?this.allowSpatial=!1:this.scale<1?this.scale=Math.min(1,this.scale/.75):this.tier<2&&this.tier++,this.last=n,this.bad=this.good=0))))}get config(){return{tier:this.tier,width:Math.max(96,Math.round(256*this.scale))}}}class xt{constructor(e,t,i){this.video=e,this.engine=t,this.hooks=i,this.stats.state="warming",this.stats.reason="연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.",this.stats.engine="WebGPU 양방향 블록 움직임 추정"}video;engine;hooks;budget=new vt;clock=new pt;stats=Te();lastRaf=0;lastRvfc=0;busyStarted=0;callback=0;raf=0;running=!1;busy=!1;revision=0;pending=null;still=!1;pair;nextOutput=0;lastKey="";lastSource=-1;previousSource=null;sourcePeriod=0;disabled=!1;estimatedMs=3;submissions=[];generated=[];signatures=[];sceneKey="";began=performance.now();poorSince=0;recoveryUntil=0;resetPending=!1;cadence=new gt;resetMotion(){this.busy?this.resetPending=!0:(this.engine.resetTemporal(),this.resetPending=!1)}finished(){p.elapsed("serialBusyMs",this.busyStarted),this.busy=!1,this.stats.queueDepth=0,this.resetPending&&this.resetMotion(),this.drain()}start(){this.running||(this.running=!0,this.requestSource(),!this.video.paused&&!document.hidden?this.requestOutput():this.requestStill())}requestSource(){this.running&&(this.callback=this.video.requestVideoFrameCallback((e,t)=>{if(this.lastRvfc&&p.sample("rvfcIntervalMs",e-this.lastRvfc),this.lastRvfc=e,p.count("rvfcCallbacks"),this.callback=0,this.requestSource(),!(document.hidden||this.video.seeking||t.mediaTime===this.lastSource)){this.lastSource=t.mediaTime,this.stats.sourceFrames++,this.hooks.observe(t,e),this.previousSource!==null&&t.mediaTime>this.previousSource&&(this.sourcePeriod=(t.mediaTime-this.previousSource)*1e3/this.video.playbackRate),this.previousSource=t.mediaTime,this.cadence.add(this.sourcePeriod),this.hooks.settings().adaptive&&this.sourcePeriod>0&&e-this.began>5e3&&e>this.recoveryUntil&&(this.trim(e),(this.submissions.length<2?0:(this.submissions.length-1)*1e3/Math.max(1,e-this.submissions[0]))<900/(this.cadence.period??this.sourcePeriod)?(this.poorSince||(this.poorSince=e),e-this.poorSince>3e3&&(this.recoveryUntil=e+1e4,this.poorSince=0,this.pair=void 0,this.resetMotion(),this.limited("보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다."))):this.poorSince=0);try{if(this.video.mediaKeys)throw new DOMException("보호된 영상은 프레임에 접근할 수 없습니다.","SecurityError");const i=p.mark(),n=new VideoFrame(this.video,{timestamp:Math.round(t.mediaTime*1e6)});p.elapsed("videoFrameAcquireCpuMs",i),this.pending&&(p.count("discard.sourceReplaced"),this.pending.frame.close(),this.stats.dropped++),this.pending={frame:n,meta:t},this.drain()}catch(i){this.hooks.fatal(i)}}}))}limited(e){this.stats.state="limited",this.stats.reason=e}async drain(){if(!this.running||this.busy)return;if(this.still){this.still=!1,this.busy=!0,this.busyStarted=p.mark();const i=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&i===this.revision})}catch(n){this.hooks.fatal(n)}finally{this.finished()}return}if(!this.pending)return;const e=this.pending;this.pending=null,this.busy=!0,this.busyStarted=p.mark(),this.stats.queueDepth=1;const t=this.revision;try{const i=this.clock.hz??60,n=this.sourcePeriod>0&&1e3/this.sourcePeriod>=i*.98;if(this.disabled||performance.now()<this.recoveryUntil||this.hooks.settings().original||this.hooks.settings().comparison||this.sourcePeriod>oe||n||this.video.paused){!this.disabled&&performance.now()>=this.recoveryUntil&&this.limited(this.hooks.settings().original||this.hooks.settings().comparison?"동일 원본 프레임 비교를 위해 보간을 생략합니다.":this.sourcePeriod>oe?"한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.":n?"브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.":"일시정지 상태입니다."),await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision});return}let s=0;const a=new Promise((l,u)=>{s=window.setTimeout(()=>u(new Error("움직임 추정 GPU 응답 시간 초과")),1500)});let o;try{o=await Promise.race([this.engine.captureFrame(e.frame,{width:this.video.videoWidth,height:this.video.videoHeight},e.meta.mediaTime,this.budget.config),a])}finally{clearTimeout(s)}if(!this.running||t!==this.revision)return;this.pair={...o},this.stats.flowMs=o.flowMs,this.stats.flowSize=o.flowSize,this.stats.confidence=o.confidence,o.sceneCut&&this.sceneKey!==String(o.b)&&(p.count("sceneCuts"),this.stats.sceneCuts++,this.sceneKey=String(o.b)),o.ready||await this.hooks.spatial({metadata:null,sourceDriven:!0,current:()=>this.running&&t===this.revision})}catch(i){if(!this.running)return;if(i instanceof Error&&i.message.includes("응답 시간 초과")){this.hooks.fatal(i);return}if(p.count("discard.gpuError"),i instanceof DOMException&&i.name==="SecurityError"){this.hooks.fatal(i);return}this.disabled=!0,this.stats.state="error",this.stats.reason="프레임 보간에 실패하여 공간·색상 보정만 유지합니다: "+String(i),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason)}finally{e.frame.close(),this.finished()}}requestOutput(){!this.running||this.disabled||this.video.paused||document.hidden||(this.raf=requestAnimationFrame(e=>{this.raf=0,this.tick(e),this.requestOutput()}))}tick(e){this.lastRaf&&p.sample("rafIntervalMs",e-this.lastRaf),this.lastRaf=e,p.count("rafCallbacks"),this.clock.tick(e),this.stats.refreshHz=this.clock.hz;const t=this.hooks.settings(),i=Number(t.targetFPS);if(this.stats.requestedFPS=i,t.original||t.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden)return;const n=Math.min(i,this.clock.hz??60)*this.budget.frequency,s=1e3/n;if(e+.1<this.nextOutput)return;if(this.nextOutput=Math.max(this.nextOutput+s,e),p.count("outputAttempts"),this.busy||this.pending){p.count("discard.queueBusy"),this.stats.dropped++;return}const a=this.pair;p.sample("timeline.currentMinusPairBMs",(this.video.currentTime-a.b)*1e3/this.video.playbackRate),p.sample("timeline.pairPeriodMs",(a.b-a.a)*1e3/this.video.playbackRate);const o=ft(a.a,a.b,this.video.currentTime,this.video.playbackRate,this.estimatedMs,a.sceneCut,a.dynamic);if(!o){p.count("discard.planUnavailable"),this.limited("동기화 가능한 프레임 구간을 벗어나 보간 출력을 건너뜁니다.");return}const l=`${a.b}:${o.alpha.toFixed(5)}`;if(l===this.lastKey){p.count("duplicateEndpoint");return}this.lastKey=l;const u=this.revision;this.busy=!0,this.busyStarted=p.mark(),this.stats.queueDepth=1;let c=!1;const h=()=>{const d=p.mark(),m=(this.video.currentTime-o.mediaTime)*1e3/this.video.playbackRate,x=this.running&&u===this.revision&&!this.video.seeking&&!document.hidden&&mt(this.video.currentTime,o.mediaTime,this.video.playbackRate);return!x&&!c&&(c=!0,p.count("discard."+(u!==this.revision?"invalidated":this.video.seeking?"seek":m<-2?"tooEarly":m>45?"tooLate":"hidden"))),p.elapsed("validityCpuMs",d),x};this.hooks.output({plan:o,pair:a,intervalMs:s,current:h}).then(d=>{this.running&&u===this.revision&&this.budget.sample((d?.latencyMs??this.estimatedMs*1.5)+a.flowMs*Math.min(1,1e3/Math.max(1,this.sourcePeriod)/n),s,!d,performance.now(),t.adaptive),!(!d||!this.running||u!==this.revision)&&(this.estimatedMs=this.estimatedMs*.8+d.latencyMs*.2,this.stats.totalMs=d.latencyMs,this.stats.interpolationMs=null,this.stats.upscaleMs=null,this.stats.delayMs=(this.video.currentTime-o.mediaTime)*1e3/this.video.playbackRate,(this.clock.hz??60)<i*.98?this.limited("목표 "+i+"FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요."):(this.stats.state="active",this.stats.reason="시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다."))}).catch(d=>{this.running&&(this.disabled=!0,this.stats.state="error",this.stats.reason="보간 출력 오류로 공간·색상 보정만 유지합니다: "+String(d),this.engine.releaseTemporal(),this.pair=void 0,this.hooks.hide(this.stats.reason))}).finally(()=>this.finished())}submittedFrame(e){const t=performance.now();p.count("submitted"),p.count(e?"generatedSubmitted":"nativeSubmitted"),this.submissions.push(t),this.stats.submitted++,e&&(this.generated.push(t),this.stats.generated++),this.engine.lastSignature&&this.signatures.push({time:t,hash:this.engine.lastSignature}),this.trim(t)}trim(e){for(;this.submissions.length&&e-this.submissions[0]>=2e3;)this.submissions.shift();for(;this.generated.length&&e-this.generated[0]>=2e3;)this.generated.shift();for(;this.signatures.length&&e-this.signatures[0].time>=2e3;)this.signatures.shift()}snapshot(){const e=performance.now();this.trim(e);const t=s=>s.length<2?0:(s.length-1)*1e3/Math.max(1,e-s[0]),i=t(this.submissions),n=this.stats.state==="active"&&this.submissions.length>20&&i<Math.min(Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return{...this.stats,...n?{state:"limited",reason:"처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요."}:{},submittedFPS:i,generatedFPS:t(this.generated),uniqueSamples:new Set(this.signatures.map(s=>s.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null}}invalidate(){p.count("bufferResets"),this.revision++,this.pending?.frame.close(),this.pending=null,this.pair=void 0,this.previousSource=null,this.lastSource=-1,this.resetMotion(),this.lastKey="",this.nextOutput=0}invalidateOutput(){this.revision++,this.lastKey=""}requestStill(){this.still=!0,this.drain()}playbackChanged(){this.invalidate(),this.still=!1,this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.clock.reset(),this.video.paused?this.requestStill():this.requestOutput()}visibilityChanged(){this.playbackChanged()}destroy(){this.running&&(this.running=!1,this.revision++,this.pending?.frame.close(),this.pending=null,this.callback&&this.video.cancelVideoFrameCallback(this.callback),this.raf&&cancelAnimationFrame(this.raf),this.callback=this.raf=0)}}function bt(r){const e=r instanceof Error?r.message:String(r);return{status:r instanceof DOMException&&r.name==="SecurityError"||/origin.clean|cross.origin|taint|protected|DRM/i.test(e)?"Video Access Restricted":"Rendering Error",reason:e}}class yt{constructor(e,t,i,n){this.video=e,this.settings=t,this.persistDivider=i,this.preferredBackend=n,this.resize=new ResizeObserver(()=>this.onResize()),this.resize.observe(e);const s=this.abort.signal;for(const a of["seeking","waiting","emptied","loadstart"])e.addEventListener(a,()=>{this.invalidate("Original Video Fallback","Waiting for a fresh decoded frame."),this.monitor.discontinuity()},{signal:s});for(const a of["loadeddata","seeked","playing","pause","ratechange","loadedmetadata"])e.addEventListener(a,()=>{(a==="loadedmetadata"||a==="loadeddata")&&(this.probed=!1,!this.engine&&!this.starting&&this.initialize()),a==="ratechange"&&this.monitor.discontinuity(),["playing","pause","ratechange","seeked","loadedmetadata"].includes(a)&&this.temporal?.playbackChanged(),this.video.paused&&this.scheduler?.refresh()},{signal:s});e.addEventListener("resize",()=>{this.probed=!1,this.invalidate("Original Video Fallback","원본 해상도가 변경되어 프레임 버퍼를 초기화합니다."),e.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},{signal:s}),document.addEventListener("visibilitychange",()=>{this.invalidate("Original Video Fallback",document.hidden?"Suspended while the tab is hidden.":"Resuming from original video."),document.hidden?this.scheduler?.stop():(this.scheduler?.start(),this.video.paused&&this.scheduler?.refresh()),this.temporal?.visibilityChanged()},{signal:s}),document.addEventListener("fullscreenchange",()=>this.onResize(),{signal:s}),window.addEventListener("resize",()=>this.onResize(),{signal:s}),this.watchdog=window.setInterval(()=>{if(this.dead)return;devicePixelRatio!==this.lastDpr&&(this.lastDpr=devicePixelRatio,this.onResize());const a=this.temporalMediaTime!==null&&(e.currentTime-this.temporalMediaTime)*1e3/Math.max(.1,e.playbackRate)>oe;!e.paused&&this.lastPresented&&(a||performance.now()-this.frameStarted>Math.max(40,Math.min(250,this.monitor.intervalMs/e.playbackRate*1.5+10)))&&(this.hide(),this.lastPresented=0,this.setState("Original Video Fallback","처리 화면이 오래되어 새 결과가 도착할 때까지 원본 재생을 표시합니다."))},20)}video;settings;persistDivider;preferredBackend;engine;overlay;scheduler;abort=new AbortController;resize;monitor=new ct;adaptive=new ot;status="Initializing";reason="Waiting for an accessible video frame.";dimensions=null;dead=!1;generation=0;lastPresented=0;presented=0;probed=!1;watchdog=0;resizeTimer=0;recoveryTimer=0;recoveries=0;lastDpr=devicePixelRatio;backendReason="";starting=!1;effectiveSharpness=0;effectiveDenoise=0;currentEngine="—";visibility=new ut;frameStarted=0;outputKey="";temporal;restartPending=!1;submissionTimes=[];totalSubmissions=0;decodedHeight=0;temporalMediaTime=null;async start(){await this.initialize()}async initialize(e){if(this.dead||this.starting||!this.settings.enabled)return;this.starting=!0;const t=++this.generation;this.setState("Initializing","Initializing local GPU processing.");try{const i=await Z(()=>document.createElement("canvas"),n=>this.lost(n),e??this.preferredBackend);if(this.dead||t!==this.generation){i.engine.destroy();return}this.engine=i.engine,this.backendReason=i.reason,this.overlay=new dt(this.video,i.canvas,n=>{this.settings={...this.settings,divider:n},this.persistDivider?.(n),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}),this.adaptive.reset(),this.probed=!1,this.settings.targetFPS!=="original"&&i.engine instanceof D?(this.temporal=new xt(this.video,i.engine,{settings:()=>this.settings,observe:(n,s)=>{this.decodedHeight=n.height,this.monitor.frame(n.mediaTime,n.presentedFrames,s,n.expectedDisplayTime)},spatial:async n=>{await this.process(n)},output:n=>this.process({metadata:null,current:n.current},n),hide:n=>{this.hide(),this.setState("Performance Limited",n)},fatal:n=>this.fail(n)}),this.temporal.start()):(this.scheduler=new ht(this.video,async n=>{await this.process(n)},()=>{this.monitor.metrics.skippedFrames++,this.monitor.metrics.missedDeadlines++,this.hide(),this.setState("Performance Limited","Newer source frame arrived; discarding outdated output.")},n=>this.fail(n)),document.hidden||(this.scheduler.start(),this.video.paused&&this.scheduler.refresh()))}catch(i){!this.dead&&t===this.generation&&(this.releaseGPU(),this.setState("Unsupported GPU",i instanceof Error?i.message:String(i)))}finally{this.starting=!1,this.restartPending&&!this.dead&&(this.restartPending=!1,this.initialize())}}probe(){if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");const e=document.createElement("canvas");e.width=e.height=1;const t=e.getContext("2d",{willReadFrequently:!0});if(!t)throw new Error("Cannot validate source pixel access.");t.drawImage(this.video,0,0,1,1),t.getImageData(0,0,1,1),this.probed=!0}async process(e,t){const i=this.engine,n=this.overlay;if(this.dead||!i||!n||document.hidden||this.video.readyState<2||this.video.seeking)return null;if(this.video.closest(".ad-showing,.ad-interrupting"))return this.invalidate("Original Video Fallback","광고 중에는 원본 재생을 유지합니다."),null;if(this.video.videoWidth<1||this.video.videoHeight<1)return null;const s=this.generation;if(this.video.mediaKeys)throw new DOMException("Protected media (DRM) is not supported.","SecurityError");this.probed||this.probe();const a=performance.now();e.metadata&&(this.decodedHeight=e.metadata.height,this.monitor.frame(e.metadata.mediaTime,e.metadata.presentedFrames,a,e.metadata.expectedDisplayTime));const o=this.adaptive.options(this.settings);this.currentEngine=o.options.engine,this.effectiveSharpness=o.options.sharpness*100,this.effectiveDenoise=o.options.engine==="fast"?0:o.options.denoise*100;const l=Ce({width:this.video.videoWidth,height:this.video.videoHeight},n.align(),devicePixelRatio,this.settings.targetResolution,i.maxDimension,i.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)},!!this.temporal,this.decodedHeight||this.video.videoHeight);o.options.upscale=!!l.eligible&&l.output.width>l.source.width,this.dimensions=l,n.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);const u=`${l.source.width},${l.source.height},${l.output.width},${l.output.height}`;u!==this.outputKey&&(this.hide(),this.outputKey=u),n.displayed||this.setState("Original Video Fallback","Processing the latest frame; showing original playback."),this.monitor.metrics.queueDepth=1;let c=0;try{const h=new Promise((g,S)=>{c=window.setTimeout(()=>S(new Error("GPU processing timed out; original playback restored.")),1500)}),d=await Promise.race([t&&i instanceof D?i.renderTemporal(l,o.options,t.plan.alpha):i.render(this.video,l,o.options),h]);if(this.dead||s!==this.generation)return null;const m=t?.intervalMs??this.monitor.intervalMs/Math.max(.1,this.video.playbackRate),x=p.mark();let b=!this.video.paused&&performance.now()-a>m*1.25||!e.current();if(!b&&!document.hidden&&!this.video.seeking){p.elapsed("readyToCanvasSubmitMs",x);const g=p.mark();for(d.cpuSubmitMs+=await Promise.race([i.present(),h]),p.elapsed("canvasPresentAwaitMs",g),this.totalSubmissions++,this.submissionTimes.push(performance.now());this.submissionTimes.length&&performance.now()-this.submissionTimes[0]>=2e3;)this.submissionTimes.shift();this.temporal?.submittedFrame(!!t?.plan.generated)}if(this.dead||s!==this.generation)return null;d.latencyMs=performance.now()-a,b=b||!this.video.paused&&d.latencyMs>m*1.25||!e.current();const f=!b&&!document.hidden&&!this.video.seeking;this.monitor.complete(d,f&&!o.options.original&&(e.metadata!==null||!!t||!!this.temporal&&!this.video.paused),performance.now()),b&&(p.count("discard.outputDeadline"),this.monitor.metrics.missedDeadlines++);const v=d.latencyMs+(t?t.pair.flowMs*Math.min(1,m/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))):0);return this.settings.adaptive&&!this.video.paused&&(e.metadata||e.sourceDriven||t&&(this.temporal?.budget.allowSpatial||v<m*.2))&&this.adaptive.sample(v,m,b,performance.now()),f?(p.count("acceptedDisplay"),this.temporalMediaTime=t?.plan.mediaTime??null,n.show(),this.visibility.set(!o.options.original),this.lastPresented=performance.now(),this.frameStarted=a,o.options.original||this.presented++,this.setState(o.options.original?"Original Comparison":o.unavailable?"Engine Unavailable":l.limited?"Performance Limited":"Active",o.options.original?"Showing the unenhanced acquired frame for comparison.":o.unavailable?"Requested engine/profile is unavailable; using "+o.options.engine+".":l.limited?"Output reduced to fit display, memory and measured processing limits.":`${i.backend} processed frames are being presented.${this.backendReason?" WebGPU unavailable; using WebGL2 fallback.":""}`)):(this.hide(),this.setState("Performance Limited","Processing missed its frame deadline; showing the original video.")),f?d:null}finally{clearTimeout(c),this.monitor.metrics.queueDepth=0}}onResize(){this.invalidate("Original Video Fallback","플레이어 크기에 맞춰 표시 위치를 조절합니다.",!1),clearTimeout(this.resizeTimer),this.resizeTimer=window.setTimeout(()=>{this.overlay?.align(),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())},120)}setState(e,t){this.status=e,this.reason=t}hide(){this.overlay?.hide(),this.visibility.set(!1)}invalidate(e,t,i=!0){this.hide(),this.scheduler?.invalidate(),i?this.temporal?.invalidate():this.temporal?.invalidateOutput(),this.lastPresented=0,this.setState(e,t)}fail(e){if(this.dead)return;const t=bt(e);this.monitor.metrics.failures++,this.invalidate(t.status,t.reason),this.releaseGPU()}lost(e){if(this.dead)return;const t=this.engine?.backend==="WebGPU";this.fail(new Error(e)),this.recoveries++<1&&(this.recoveryTimer=window.setTimeout(()=>{this.dead||this.initialize(t?"webgl2":void 0)},1e3))}releaseGPU(){this.generation++,this.temporal?.destroy(),this.temporal=void 0,this.scheduler?.stop(),this.scheduler=void 0,this.hide(),this.overlay?.destroy(),this.overlay=void 0,this.engine?.destroy(),this.engine=void 0,this.outputKey="",this.monitor.metrics.queueDepth=0}update(e){const t=e.adaptive!==this.settings.adaptive,i=e.targetFPS!==this.settings.targetFPS;if(this.settings=e,t&&this.adaptive.reset(),i){this.releaseGPU(),this.starting?this.restartPending=!0:this.initialize();return}this.invalidate("Original Video Fallback","설정을 GPU 처리에 적용합니다.",!1),this.video.paused&&(this.scheduler?.refresh(),this.temporal?.requestStill())}stats(){const e=!!this.overlay?.displayed,t=this.monitor.snapshot();t.enhancedVisiblePercent=this.visibility.percent();const i=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0,n=this.dimensions?.eligible?this.currentEngine==="balanced"?`FSR1 EASU · ${this.settings.contentMode==="animation"?"애니메이션":"실사"}`:this.currentEngine==="fast"?"고속 경계선 재구성":"—":"원본 해상도 · 노이즈/색상 보정",s=this.settings.original||this.settings.comparison&&this.settings.divider>=1,a=this.temporal?.snapshot()??Te();return this.temporal||(a.submitted=this.totalSubmissions,a.submittedFPS=this.submissionTimes.length<2?0:(this.submissionTimes.length-1)*1e3/Math.max(1,performance.now()-this.submissionTimes[0]),this.settings.targetFPS!=="original"&&(a.requestedFPS=Number(this.settings.targetFPS),a.state="unsupported",a.reason="이 백엔드는 움직임 보간을 지원하지 않아 업스케일링·색상 보정만 유지합니다.")),{status:this.status,reason:this.reason,backend:this.engine?.backend??"—",engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics:t,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm:n,presentation:e?s?"original":this.settings.comparison?"split":"enhanced":"fallback",fallback:!e,upscalingActive:e&&!s&&i>1.01,scaleRatio:i,frameAgeMs:e?performance.now()-this.frameStarted:null,temporal:a}}destroy(){this.dead||(this.dead=!0,this.abort.abort(),this.resize.disconnect(),clearInterval(this.watchdog),clearTimeout(this.resizeTimer),clearTimeout(this.recoveryTimer),this.releaseGPU())}}async function Re(r){let e="";const{engine:t,canvas:i}=await Z(()=>document.createElement("canvas"),c=>{e=c},r),n=document.createElement("canvas");n.width=n.height=8;const s=n.getContext("2d"),a={source:{width:8,height:8},processing:{width:32,height:32},output:{width:32,height:32},display:{width:32,height:32},screen:null,css:{width:32,height:32},limited:!1},o={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5},l=[],u=async(c={})=>{await t.render(n,a,{...o,...c}),await t.present();const h=document.createElement("canvas");h.width=h.height=32;const d=h.getContext("2d",{willReadFrequently:!0});return d.drawImage(i,0,0),d.getImageData(0,0,32,32).data};try{for(const w of["fast","balanced"]){s.fillStyle="rgb(64,128,192)",s.fillRect(0,0,8,8);const M=await u({engine:w}),k=Math.max(...Array.from(M,(z,N)=>Math.abs(z-[64,128,192,255][N%4])));l.push({name:`${w}: constant field / color / alpha`,passed:k<=2,detail:`Maximum channel error ${k}/255`})}for(let w=0;w<8;w++)for(let M=0;M<8;M++){const k=20+M*28;s.fillStyle=`rgb(${k},${k},${k})`,s.fillRect(M,w,1,1)}const c=await u();let h=0;for(let w=6;w<26;w++)h=Math.max(h,Math.abs(c[(512+w)*4]-(20+((w+.5)/4-.5)*28)));l.push({name:"Balanced: linear-ramp reconstruction",passed:h<=3,detail:`Maximum interior error ${h.toFixed(2)}/255`}),s.fillStyle="black",s.fillRect(0,0,8,4),s.fillStyle="white",s.fillRect(0,4,8,4);const d=await u();l.push({name:"Video orientation preserved",passed:d[0]<3&&d[992*4]>252,detail:`Top ${d[0]}, bottom ${d[992*4]}`});for(let w=0;w<8;w++)for(let M=0;M<8;M++){const k=80+(M*17+w*13)%7*11;s.fillStyle=`rgb(${k},${k},${k})`,s.fillRect(M,w,1,1)}const m=await u(),x=await u({sharpness:1}),b=await u({denoise:1}),f=await u({engine:"fast"}),v=await u({sharpness:1,comparison:!0,divider:1}),g=(w,M)=>Array.from(w).reduce((k,z,N)=>k+Math.abs(z-M[N]),0);for(const[w,M]of[["Sharpening changes processed pixels",x],["Denoising changes processed pixels",b],["Fast and Balanced are distinct",f],["Comparison uses unenhanced pixels",v]]){const k=g(m,M);l.push({name:w,passed:k>0,detail:`Absolute channel difference ${k}`})}s.fillStyle="rgb(50,50,50)",s.fillRect(0,0,4,8),s.fillStyle="rgb(200,200,200)",s.fillRect(4,0,4,8);const S=await u({sharpness:1}),C=Math.min(...Array.from(S).filter((w,M)=>M%4!==3)),U=Math.max(...Array.from(S).filter((w,M)=>M%4!==3));if(l.push({name:"Step edge remains bounded (anti-ringing)",passed:C>=49&&U<=201,detail:`Range ${C}…${U}; source 50…200`}),e)throw new Error(e);return{backend:t.backend,checks:l}}finally{t.destroy(),i.remove()}}const wt=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
    let w=exp(-f32(x*x+y*y)*0.7-delta*delta/0.0018);
    total+=c*w; weights+=w;
  }}
  textureStore(output,p,vec4f(mix(center,total/weights,params.settings.y*0.7),1));
}
`,Mt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5),1));
}
`,Pt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Et=`#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`,ve=`
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
`,Tt=`#version 300 es
`+ve+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c);float w=exp(-float(x*x+y*y)*.7-delta*delta/.0018);sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,settings.y*.7),1);}`,kt=`#version 300 es
`+ve+`
void main(){vec2 p=gl_FragCoord.xy*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{vec3 sum=vec3(0);float weight=0.;for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){float w=cubic(float(x)-f.x)*cubic(float(y)-f.y);sum+=pixel(inputTex,i+ivec2(x,y))*w;weight+=w;}color=vec4(clamp(sum/max(weight,.0001),lo,hi),1);}}
`,Ct=`#version 300 es
`+ve+`
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
if(settings.w>.5&&gl_FragCoord.x/dims.z<divider)result=linearSample(originalTex,gl_FragCoord.xy*dims.xy/dims.zw-.5);
color=vec4(clamp(result,0.,1.),1);}`,Rt=Object.freeze(Object.defineProperty({__proto__:null,composite:Ct,denoise:Tt,upscale:kt,vertex:Et},Symbol.toStringTag,{value:"Module"}));function _t(r,e,t,i,n,s=!1){const a=new Uint8ClampedArray(i*n*4),o=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]],l=(c,h)=>{const d=(Math.max(0,Math.min(t-1,h))*e+Math.max(0,Math.min(e-1,c)))*4;return[r[d]/255,r[d+1]/255,r[d+2]/255]},u=c=>c[1]+(c[0]+c[2])*.5;for(let c=0;c<n;c++)for(let h=0;h<i;h++){let d=(h+.5)*e/i-.5,m=(c+.5)*t/n-.5;Math.abs(d-Math.round(d))<1e-5&&(d=Math.round(d)),Math.abs(m-Math.round(m))<1e-5&&(m=Math.round(m));const x=Math.floor(d),b=Math.floor(m),f=d-x,v=m-b,g=o.map(([L,$])=>l(x+L,b+$)),[S,C,U,w,M,k,z,N,T,R,B,I]=g.map(u);let A=0,F=0,W=0;for(const[L,$,V,te,ie,Q]of[[S,k,M,R,w,(1-f)*(1-v)],[C,M,R,T,z,f*(1-v)],[M,U,w,z,I,(1-f)*v],[R,w,z,N,B,f*v]]){const se=te-$,ne=ie-L,ae=Math.min(1,Math.abs(se)/Math.max(Math.abs(te-V),Math.abs(V-$),1e-6)),H=Math.min(1,Math.abs(ne)/Math.max(Math.abs(ie-V),Math.abs(V-L),1e-6));A+=se*Q,F+=ne*Q,W+=(ae*ae+H*H)*Q}const j=Math.hypot(A,F);j*j<1/32768?(A=1,F=0):(A/=j,F/=j);let ee=(W*.5)**2;s&&(ee=Math.min(1,ee*1.2));const Ae=(A*A+F*F)/Math.max(Math.abs(A),Math.abs(F)),Ge=1+(Ae-1)*ee,De=1-.5*ee,be=.5-.29*ee,ye=[0,0,0];let we=0;for(let L=0;L<12;L++){const $=o[L][0]-f,V=o[L][1]-v,te=($*A+V*F)*Ge,ie=(-$*F+V*A)*De,Q=Math.min(te*te+ie*ie,1/be),se=.4*Q-1,ne=be*Q-1,ae=(1.5625*se*se-.5625)*ne*ne;for(let H=0;H<3;H++)ye[H]+=g[L][H]*ae;we+=ae}const Se=(c*i+h)*4;for(let L=0;L<3;L++){const $=[4,9,3,6].map(V=>g[V][L]);a[Se+L]=Math.round(Math.max(Math.min(...$),Math.min(Math.max(...$),ye[L]/Math.max(we,1e-6)))*255)}a[Se+3]=255}return a}const _e={webgpu:{common:wt,denoise:St,upscale:Mt,composite:Pt},webgl:Rt};function he(r,e,t,i){return{source:{width:r,height:e},processing:{width:t,height:i},output:{width:t,height:i},display:{width:t,height:i},css:{width:t,height:i},screen:null,limited:!1}}const fe={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,contentMode:"natural"},O=(r,e)=>Object.assign(document.createElement("canvas"),{width:r,height:e});function re(r,e){let t=0,i=0;for(let s=0;s<r.length;s++)if(s%4!==3){const a=r[s]-e[s];t+=a*a,i+=Math.abs(a)}const n=r.length*3/4;return{psnr:t===0?99:10*Math.log10(65025/(t/n)),mae:i/n}}const Pe=r=>[...r].sort((e,t)=>e-t)[Math.floor(r.length/2)];async function Le(r="webgpu"){const e=await Z(()=>O(1,1),()=>{},r,_e),t=await Z(()=>O(1,1),()=>{},r),i=async(n,s,a,o={})=>{await n.engine.render(s,a,{...fe,...o}),await n.engine.present();const l=O(a.output.width,a.output.height),u=l.getContext("2d",{willReadFrequently:!0});return u.drawImage(n.canvas,0,0),{data:u.getImageData(0,0,l.width,l.height).data,png:l.toDataURL("image/png")}};try{const n=O(9,7),s=n.getContext("2d"),a=s.createImageData(9,7);for(let f=0;f<a.data.length;f++)a.data[f]=f%4===3?255:(f*73+f%11*31)%256;s.putImageData(a,0,0);const o=await i(t,n,he(9,7,23,19),{contentMode:"animation"}),l=_t(a.data,9,7,23,19,!0),u=Math.max(...Array.from(l,(f,v)=>Math.abs(f-o.data[v]))),c=[];for(const f of["line-art","natural-texture","compressed-texture"]){const v=O(768,432),g=v.getContext("2d");if(f==="line-art"){g.fillStyle="#e4e8db",g.fillRect(0,0,768,432);for(let T=0;T<14;T++)g.strokeStyle=T%3?"#1d2834":"#537789",g.lineWidth=2+T%3*1.4,g.beginPath(),g.moveTo(15+T*51,45),g.lineTo(90+T*46,390),g.stroke();g.strokeStyle="#252b3e",g.lineWidth=3,g.beginPath(),g.ellipse(355,200,165,105,.25,0,Math.PI*2),g.stroke(),g.font="bold 28px sans-serif",g.fillStyle="#172b3b",g.fillText("Edge reconstruction 0123",30,35)}else{const T=g.createImageData(768,432);for(let R=0;R<432;R++)for(let B=0;B<768;B++){const I=(R*768+B)*4,A=18*Math.sin(B*.18+R*.07)+11*Math.sin(B*.055-R*.14),F=55*Math.tanh((B-300-R*.43)/3),W=125+A+F+15*Math.sin(R*.025);T.data[I]=W*.94,T.data[I+1]=W,T.data[I+2]=W*.84,T.data[I+3]=255}g.putImageData(T,0,0)}const S=g.getImageData(0,0,768,432).data,C=O(256,144),U=C.getContext("2d"),w=U.createImageData(256,144);for(let T=0;T<144;T++)for(let R=0;R<256;R++){const B=(T*256+R)*4;for(let I=0;I<3;I++){let A=0;for(let W=0;W<3;W++)for(let j=0;j<3;j++)A+=S[((T*3+W)*768+R*3+j)*4+I];const F=f==="compressed-texture"?((R*17+T*23)%13-6)*1.3:0;w.data[B+I]=A/9+F}w.data[B+3]=255}U.putImageData(w,0,0);const M=he(256,144,768,432),k=f==="line-art"?"animation":"natural",z=await i(e,C,M,{denoise:f==="compressed-texture"?.35:0}),N=await i(t,C,M,{denoise:f==="compressed-texture"?.35:0,contentMode:k});c.push({name:f,sharpness:0,baseline:re(z.data,S),improved:re(N.data,S),difference:re(z.data,N.data).mae,images:{source:C.toDataURL(),truth:v.toDataURL(),baseline:z.png,improved:N.png}})}const h=O(640,360),d=h.getContext("2d");d.fillStyle="#9ab9ad",d.fillRect(0,0,640,360),d.fillStyle="#304857";for(let f=0;f<40;f++)d.fillRect(f*17,10,2,340);const m=he(640,360,1920,1080),x={baseline:[],improved:[]};for(let f=0;f<36;f++)for(const[v,g]of f%2?[["improved",t],["baseline",e]]:[["baseline",e],["improved",t]]){const S=performance.now();await g.engine.render(h,m,{...fe,denoise:.2}),await g.engine.present(),f>=6&&x[v].push(performance.now()-S)}const b={source:"640×360",output:"1920×1080",samples:30,includes:"CPU + queue + GPU completion; not pure GPU timestamp",baselineMedianMs:Pe(x.baseline),improvedMedianMs:Pe(x.improved),baselineP95Ms:[...x.baseline].sort((f,v)=>f-v)[28],improvedP95Ms:[...x.improved].sort((f,v)=>f-v)[28]};return{backend:t.engine.backend,maxReferenceError:u,cases:c,benchmark:b}}finally{e.engine.destroy(),t.engine.destroy()}}async function Lt(r,e="webgpu"){const t=new Image;t.src=r,await t.decode();const i=O(t.width,t.height);i.getContext("2d").drawImage(t,0,0);const n=he(t.width,t.height,t.width*3,t.height*3),s=await Z(()=>O(1,1),()=>{},e,_e),a=await Z(()=>O(1,1),()=>{},e),o=O(n.output.width,n.output.height),l=o.getContext("2d",{willReadFrequently:!0}),u=async(c,h)=>(await c.engine.render(i,n,{...fe,denoise:.2,contentMode:h}),await c.engine.present(),l.drawImage(c.canvas,0,0),{data:l.getImageData(0,0,o.width,o.height).data,png:o.toDataURL()});try{const c=await u(s,"natural"),h=await u(a,"natural"),d=await u(a,"animation");return{backend:a.engine.backend,source:n.source,output:n.output,sharpness:0,denoise:20,baselineToNaturalMAE:re(c.data,h.data).mae,naturalToAnimationMAE:re(h.data,d.data).mae,images:{baseline:c.png,natural:h.png,animation:d.png}}}finally{s.engine.destroy(),a.engine.destroy()}}const Ut=`struct Params { dims: vec4f, settings: vec4f, extra: vec4f }
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
`,At=`@group(0) @binding(0) var input: texture_2d<f32>;
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
`,Gt=`@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
`,Dt=`@group(0) @binding(0) var original: texture_2d<f32>;
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
`,Y=(r,e)=>({source:{width:r,height:e},processing:{width:r,height:e},output:{width:r,height:e},display:{width:r,height:e},css:{width:r,height:e},screen:null,limited:!1}),_=(r,e)=>Object.assign(document.createElement("canvas"),{width:r,height:e}),K={engine:"balanced",sharpness:0,denoise:0,comparison:!1,divider:.5,upscale:!1,saturation:100,brightness:100};async function Ft(r,e,t,i,n){if(await r.render(t,i,n),await r.present(r instanceof D?"full":"none"),r instanceof D)return r.lastPixels;const s=_(i.output.width,i.output.height),a=s.getContext("2d");return a.drawImage(e,0,0),a.getImageData(0,0,s.width,s.height).data}async function zt(r="webgpu"){const e=_(1,1),t=r==="webgpu"?await D.create(e,()=>{}):new ke(e,()=>{}),i=_(8,8),n=i.getContext("2d"),s=[];try{n.fillStyle="rgb(64,128,192)",n.fillRect(0,0,8,8);for(const a of["saturation","brightness"])for(const o of[0,50,100,150,200]){const l=await Ft(t,e,i,Y(8,8),{...K,[a]:o});s.push({control:a,value:o,rgb:Array.from(l.slice(0,3))})}return{backend:r,results:s}}finally{t.destroy()}}async function Bt(){const r=_(1,1),e=await D.create(r,()=>{}),t=_(128,72),i=_(128,72);function n(s,a){const o=s.getContext("2d");o.fillStyle="#101010",o.fillRect(0,0,128,72),o.fillStyle="#eeeeee",o.fillRect(a,24,32,24)}try{n(t,24),n(i,32),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1});const s=await e.captureFrame(i,{width:128,height:72},1/24,{width:128,tier:1}),a=[];for(const l of[0,.25,.5,.75,1]){await e.renderTemporal(Y(128,72),K,l),await e.present("full");const u=e.lastPixels;let c=0,h=0;for(let d=0;d<72;d++)for(let m=0;m<128;m++){const x=Math.max(0,u[(d*128+m)*4]-16);c+=(m+.5)*x,h+=x}a.push({phase:l,centroid:c/h,expected:40+8*l,signature:e.lastSignature})}i.getContext("2d").fillStyle="white",i.getContext("2d").fillRect(0,0,128,72);const o=await e.captureFrame(i,{width:128,height:72},2/24,{width:128,tier:1});return await e.renderTemporal(Y(128,72),K,.5),await e.present("full"),{pair:s,results:a,sceneCut:o.sceneCut,cutPixel:Array.from(e.lastPixels.slice(0,3))}}finally{e.destroy()}}async function It(){const r=_(1,1),e=await D.create(r,()=>{}),t=[];try{for(const[i,n]of[[480,"720p"],[720,"1080p"],[1080,"1440p"],[1440,"2160p"]]){const s=i*16/9,a=_(Math.round(s),i);a.getContext("2d").fillStyle="#4080c0",a.getContext("2d").fillRect(0,0,a.width,a.height);const o=Ce({width:a.width,height:i},{width:400,height:225},1,n,e.maxDimension,e.maxPixels);await e.render(a,o,{...K,upscale:!0}),await e.present("pixel"),t.push({source:o.source,target:n,actual:{width:r.width,height:r.height},pixel:Array.from(e.lastPixels),estimatedBytes:o.estimatedBytes})}return t}finally{e.destroy()}}async function qt(){const r=_(1,1),e=await D.create(r,()=>{}),t=_(128,72),i=_(128,72),n=[],s=(o,l)=>{const u=o.getContext("2d");u.fillStyle="#101010",u.fillRect(0,0,128,72),u.fillStyle="#eeeeee",u.fillRect(l,24,32,24)};s(t,24),s(i,32);const a=o=>{const l=_(128,72);return l.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(o),128,72),0,0),l.toDataURL()};try{for(const o of[24,30,60])for(const l of[75,100,120]){e.resetTemporal(),await e.captureFrame(t,{width:128,height:72},0,{width:128,tier:1}),await e.captureFrame(i,{width:128,height:72},1/o,{width:128,tier:1});const u=[];for(let c=0;c/l<=1/o+1e-6;c++){const h=c*o/l;await e.renderTemporal(Y(128,72),K,h),await e.present("full");const d=e.lastPixels;let m=0,x=0,b=2166136261,f=0,v=0;for(let g=0;g<72;g++)for(let S=0;S<128;S++){const C=(g*128+S)*4,U=Math.max(0,d[C]-16);m+=(S+.5)*U,x+=U,b=Math.imul(b^d[C],16777619);const w=g>=24&&g<48&&S+.5>=24+8*h&&S+.5<56+8*h?238:16,M=16+(g>=24&&g<48?222*((S>=24&&S<56?1-h:0)+(S>=32&&S<64?h:0)):0);f+=Math.abs(d[C]-w),v+=Math.abs(M-w)}u.push({alpha:h,centroid:m/x,expected:40+8*h,hash:b>>>0,mae:f/9216,unwarpedBlendMAE:v/9216,image:o===24&&l===75?a(d):void 0})}n.push({source:o,target:l,samples:u})}return n}finally{e.destroy()}}async function Ot(){const r=await D.create(_(1,1),()=>{},{common:Ut,denoise:At,upscale:Gt,composite:Dt}),e=await D.create(_(1,1),()=>{}),t=_(640,360),i=t.getContext("2d"),n=i.createImageData(640,360);for(let l=0;l<n.data.length;l++)n.data[l]=l%4===3?255:(l*37+l%17*19)%256;i.putImageData(n,0,0);const s={...Y(1920,1080),source:{width:640,height:360}},a={...K,upscale:!0,sharpness:.25,denoise:.15},o=[];try{for(const[u,c]of[["1.1",r],["1.2",e]]){const h=[];for(let m=0;m<50;m++){const x=performance.now();await c.render(t,s,a),await c.present(),m>=10&&h.push(performance.now()-x)}const d=[...h].sort((m,x)=>m-x);o.push({version:u,times:h,median:d[20],p95:d[38]})}await r.render(t,s,a),await r.present("full"),await e.render(t,s,a),await e.present("full");let l=0;for(let u=0;u<r.lastPixels.length;u++)r.lastPixels[u]!==e.lastPixels[u]&&l++;return{method:"same current host, frozen v1.1 shaders vs v1.2 shaders; interpolation off; neutral color; 640x360→1920x1080; 10 warmup, 40 measurements; wall completion including CPU/queue/GPU",rows:o,changedChannels:l}}finally{r.destroy(),e.destroy()}}async function Wt(){const r=_(1,1),e=await D.create(r,()=>{}),t=_(8,8),i=t.getContext("2d"),n=[];i.fillStyle="rgb(64,128,192)",i.fillRect(0,0,8,8);try{await e.captureFrame(t,{width:8,height:8},0,{width:8,tier:0}),await e.captureFrame(t,{width:8,height:8},1/30,{width:8,tier:0});for(const s of[!1,!0])for(const a of[!1,!0])for(const o of[!1,!0]){const l=a?{...Y(16,16),source:{width:8,height:8}}:Y(8,8),u={...K,upscale:a,saturation:o?0:100,brightness:100};s?await e.renderTemporal(l,u,.5):await e.render(t,l,u),await e.present("pixel"),n.push({motion:s,upscale:a,color:o,size:{width:r.width,height:r.height},pixel:Array.from(e.lastPixels)})}return n}finally{e.destroy()}}const y=r=>document.getElementById(r),le=y("video");let P={...ze,adaptive:!1,automaticStrength:!1,comparison:!0},E,J="";function xe(){if(E?.destroy(),E=void 0,P.enabled){const r=y("backend").value;E=new yt(le,P,void 0,r==="auto"?void 0:r),E.start()}}async function Ue(){y("notice").textContent="로컬 진단 영상 생성 중 · 3초";const r=document.createElement("canvas");r.width=320,r.height=180;const e=r.getContext("2d"),t=r.captureStream(24),i=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(c=>MediaRecorder.isTypeSupported(c)),n=new MediaRecorder(t,{mimeType:i,videoBitsPerSecond:5e5}),s=[];n.ondataavailable=c=>{c.data.size&&s.push(c.data)};const a=new Promise(c=>{n.onstop=()=>c(new Blob(s,{type:n.mimeType}))});n.start();let o=0;const l=window.setInterval(()=>{const c=e.createLinearGradient(0,0,320,180);c.addColorStop(0,"#122b3e"),c.addColorStop(1,"#c9dec7"),e.fillStyle=c,e.fillRect(0,0,320,180),e.strokeStyle="#eef4df",e.lineWidth=1;for(let h=0;h<18;h++)e.beginPath(),e.moveTo(h*13+o%12,35),e.lineTo(h*13+55,145),e.stroke();e.fillStyle="#121d26",e.fillRect(10,8,300,23),e.fillStyle="#e5edeb",e.font="13px monospace",e.fillText(`CLARITY 320×180 · frame ${String(o).padStart(3,"0")}`,16,24);for(let h=145;h<175;h++)for(let d=15;d<130;d++){const m=90+(d*13+h*7+o*3)%23;e.fillStyle=`rgb(${m},${m},${m})`,e.fillRect(d,h,1,1)}e.fillStyle="#f1b36e",e.beginPath(),e.arc(200+Math.sin(o/12)*60,113,18,0,Math.PI*2),e.fill(),o++},1e3/24);await new Promise(c=>setTimeout(c,3e3)),clearInterval(l),n.stop();const u=await a;t.getTracks().forEach(c=>c.stop()),ce(URL.createObjectURL(u)),y("notice").textContent="로컬 320 × 180 진단 WebM 생성 완료. 실제 HTML 영상 플레이어가 디코딩합니다."}const Ee=new Map;async function $t(r){E?.destroy(),E=void 0,le.pause();let e=Ee.get(r);if(!e){const t=Object.assign(document.createElement("canvas"),{width:256,height:144}),i=t.getContext("2d"),n=t.captureStream(0),s=n.getVideoTracks()[0],a=new MediaRecorder(n,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:2e6}),o=[];a.ondataavailable=c=>{c.data.size&&o.push(c.data)};const l=new Promise(c=>{a.onstop=()=>c(new Blob(o,{type:a.mimeType}))});a.start();const u=performance.now();for(let c=0;c<r*2;c++){await new Promise(d=>setTimeout(d,Math.max(0,u+c*1e3/r-performance.now()))),i.fillStyle="#101010",i.fillRect(0,0,256,144);const h=24+c*80/(r*2);i.fillStyle="#eeeeee",i.fillRect(h,48,48,48),i.fillStyle="#4080c0",i.fillRect(h+8,56,16,16),i.fillStyle="#80c040",i.fillRect(h+28,76,12,12),s.requestFrame()}await new Promise(c=>setTimeout(c,1e3/r)),a.stop(),e=await l,n.getTracks().forEach(c=>c.stop()),Ee.set(r,e)}ce(URL.createObjectURL(e)),await le.play()}function ce(r){J&&URL.revokeObjectURL(J),J=r,le.src=J,xe(),le.play().catch(e=>{y("notice").textContent=String(e)})}y("sample").addEventListener("click",()=>{y("sample").disabled=!0,Ue().catch(r=>{y("notice").textContent=String(r)}).finally(()=>{y("sample").disabled=!1})});y("packaged").addEventListener("click",()=>{ce(new URL("../diagnostic.webm",location.href).href),y("notice").textContent="포함된 로컬 320 × 180 진단 영상을 재생합니다."});y("backend").addEventListener("change",xe);y("file").addEventListener("change",r=>{const e=r.target.files?.[0];e&&ce(URL.createObjectURL(e))});y("toggle").addEventListener("click",()=>{P.enabled=!P.enabled,y("toggle").textContent=P.enabled?"보정 끄기":"보정 켜기",xe()});y("engine").addEventListener("change",()=>{P.engine=y("engine").value,E?.update(P)});y("contentMode").addEventListener("change",()=>{P.contentMode=y("contentMode").value,E?.update(P)});y("original").addEventListener("change",()=>{P.original=y("original").checked,E?.update(P)});for(const r of["targetResolution","targetFPS"])y(r).addEventListener("change",()=>{P={...P,[r]:y(r).value},E?.update(P)});for(const r of["saturation","brightness"])y(r).addEventListener("input",()=>{P[r]=Number(y(r).value),y(r+"-value").textContent=P[r]+"%",E?.update(P)});for(const[r,e]of[["sharp","sharpness"],["noise","denoise"]])y(r).addEventListener("input",()=>{P[e]=Number(y(r).value),y(r==="sharp"?"sharp-value":"noise-value").textContent=String(P[e]),E?.update(P)});y("compare").addEventListener("change",()=>{P.comparison=y("compare").checked,E?.update(P)});y("validate").addEventListener("click",()=>{const r=y("backend").value;y("pixel-results").textContent="셰이더 컴파일 및 픽셀 확인 중…",Re(r==="auto"?void 0:r).then(e=>{y("pixel-results").textContent=`${e.backend}
`+e.checks.map(t=>`${t.passed?"PASS":"FAIL"} ${t.name}
${t.detail}`).join(`
`)}).catch(e=>{y("pixel-results").textContent=String(e)})});y("quality-review").addEventListener("click",()=>{const r=y("backend").value;E?.destroy(),E=void 0,y("quality-results").textContent="동일 조건 비교 중 · 재생 보정 일시 중지",Le(r==="webgl2"?"webgl2":"webgpu").then(e=>{y("quality-results").textContent=JSON.stringify({...e,cases:e.cases.map(({images:t,...i})=>i)},null,2)}).catch(e=>{y("quality-results").textContent=String(e)})});const Nt=window.setInterval(()=>{y("stats").textContent=E?JSON.stringify(E.stats(),null,2):"보정 사용 안 함"},1e3);window.addEventListener("pagehide",()=>{clearInterval(Nt),E?.destroy(),J&&URL.revokeObjectURL(J)});window.clarityHarness={runPipelineCombinations:Wt,runMotionMatrix:qt,runV11Benchmark:Ot,runPixelChecks:Re,runQualityReview:Le,compareCapturedFrame:Lt,runMotionChecks:Bt,runColorChecks:zt,runResolutionChecks:It,motionSample:$t,sample:Ue,stats:()=>E?.stats()??null,destroy:()=>{E?.destroy(),E=void 0},settings:r=>{P={...P,...r},E?.update(P)}};qe((r,e)=>{P={...P,...e},ce(r)});
