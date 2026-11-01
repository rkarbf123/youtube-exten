@group(0) @binding(0) var a:texture_2d<f32>;
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
