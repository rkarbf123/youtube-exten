@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var low:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(2) var<uniform> m:MotionParams;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=textureDimensions(low))){return;}
  let step=m.full.xy/m.full.zw;let p=(vec2f(id.xy)+0.5)*step-0.5;
  let d=step*0.25;let c=(bilinear(source,p-d)+bilinear(source,p+vec2f(d.x,-d.y))+bilinear(source,p+vec2f(-d.x,d.y))+bilinear(source,p+d))*0.25;
  textureStore(low,vec2i(id.xy),vec4f(c,1));
}
