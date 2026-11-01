@group(0) @binding(0) var input: texture_2d<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if(any(id.xy>=textureDimensions(output))) { return; }
  let p=(vec2f(id.xy)+0.5)*params.dims.xy/params.dims.zw-0.5;
  textureStore(output,vec2i(id.xy),vec4f(reconstruct(input,p,params.settings.z>0.5,params.extra.y>0.5,params.settings.y),1));
}
