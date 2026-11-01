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
  var color=clamp(c+vec3f(detail*params.settings.x*1.25),low,high);
  return vec4f(adjustColor(clamp(color,vec3f(0),vec3f(1)),params.color.x,params.color.y),1);
}
