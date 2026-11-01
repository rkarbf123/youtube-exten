@group(0) @binding(0) var input: texture_2d<f32>;
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
