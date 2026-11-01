@group(0) @binding(0) var a:texture_2d<f32>;
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
