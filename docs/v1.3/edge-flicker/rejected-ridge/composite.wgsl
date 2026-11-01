@group(0) @binding(0) var original: texture_2d<f32>;
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
  var gain=params.settings.x*1.25;
  // AI-only thin ridges: suppress extra unsharp amplification where the centre
  // is an extremum on BOTH sides. A step edge and the unsharpened AI pixels are
  // untouched. No history, blur, temporal mixing, or native-frame attenuation.
  if(params.extra.w>0.5){
    let lc=luma(c);let ln=luma(n);let ls=luma(s);let le=luma(e);let lw=luma(w);
    let vertical=max(max(0.0,min(lc-ln,lc-ls)),max(0.0,min(ln-lc,ls-lc)));
    let horizontal=max(max(0.0,min(lc-le,lc-lw)),max(0.0,min(le-lc,lw-lc)));
    gain*=1.0-smoothstep(0.02,0.10,max(vertical,horizontal));
  }
  var color=clamp(c+vec3f(detail*gain),low,high);
  return vec4f(adjustColor(clamp(color,vec3f(0),vec3f(1)),params.color.x,params.color.y),1);
}
