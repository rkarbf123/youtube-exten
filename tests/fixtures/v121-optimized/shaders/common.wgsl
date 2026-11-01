struct Params { dims: vec4f, settings: vec4f, extra: vec4f, color: vec4f }
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
