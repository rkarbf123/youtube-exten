@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_2d<f32>;
@group(0) @binding(3) var backward:texture_2d<f32>;
@group(0) @binding(4) var output:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(5) var<uniform> m:MotionParams;
struct SceneAnalysis { error:u32, difference:u32, confidence:u32, moving:u32, blocks:u32 }
@group(0) @binding(6) var<storage,read> analysis:SceneAnalysis;
fn deltaColor(x:vec3f,y:vec3f)->f32{return dot(abs(x-y),vec3f(0.25,0.5,0.25));}
fn inside(p:vec2f)->bool{return all(p>=vec2f(0))&&all(p<=m.full.xy-1.0);}
fn patchResidual(p:vec2f,d:vec2f,phase:f32)->f32{
 let pa=p-d*(m.full.xy/m.full.zw)*phase;let pb=p+d*(m.full.xy/m.full.zw)*(1.0-phase);
 if(!inside(pa)||!inside(pb)){return 10.0;}
 let ia=vec2i(round(pa));let ib=vec2i(round(pb));
 let center=deltaColor(rgbAt(a,ia),rgbAt(b,ib));
 let surround=deltaColor(rgbAt(a,ia+vec2i(6,0)),rgbAt(b,ib+vec2i(6,0)))+deltaColor(rgbAt(a,ia-vec2i(6,0)),rgbAt(b,ib-vec2i(6,0)))+deltaColor(rgbAt(a,ia+vec2i(0,6)),rgbAt(b,ib+vec2i(0,6)))+deltaColor(rgbAt(a,ia-vec2i(0,6)),rgbAt(b,ib-vec2i(0,6)));
 return center*0.5+surround*0.125;
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
 if(any(id.xy>=textureDimensions(output))){return;}let p=vec2f(id.xy);let phase=m.grid.w;
 let blocks=f32(max(1u,analysis.blocks));let cut=f32(analysis.difference)/blocks/65535.0>0.24&&f32(analysis.error)/blocks/65535.0>0.12;
 let dynamic=analysis.moving>0u&&f32(analysis.difference)/blocks/65535.0>0.0005;
 if(phase<=0.0001){textureStore(output,vec2i(id.xy),vec4f(rgbAt(a,vec2i(id.xy)),1));return;}
 if(m.control.z>0.5||cut||!dynamic||phase>=0.9999){textureStore(output,vec2i(id.xy),vec4f(rgbAt(b,vec2i(id.xy)),1));return;}
 let scale=m.full.xy/m.full.zw;
 let grid=(p+0.5)/scale/m.grid.z-0.5;let at=vec2i(floor(grid));let hi=vec2i(textureDimensions(forward))-1;
 var best=vec2f(0);var error=patchResidual(p,best,phase);var score=error+0.009;var second=10.0;
 // Flat/static agreement is already exact. Other pixels test discrete source-anchored
 // hypotheses, avoiding foreground/background vector averaging and its rubber-sheet warp.
 {for(var direction=0;direction<2;direction++){for(var y=0;y<2;y++){for(var x=0;x<2;x++){
  let uv=clamp(at+vec2i(x,y),vec2i(0),hi);var v=textureLoad(forward,uv,0);if(direction==1){v=textureLoad(backward,uv,0);v=vec4f(-v.xy,v.zw);}
  if(v.z<0.05){continue;}let e=patchResidual(p,v.xy,phase);let candidate=e+0.01*(1.0-v.z)+0.000002*dot(v.xy,v.xy);
  if(candidate<score){if(length(v.xy-best)>2.0){second=score;}best=v.xy;error=e;score=candidate;}
  else if(length(v.xy-best)>2.0){second=min(second,candidate);}
 }}}}
 let pa=p-best*scale*phase;let pb=p+best*scale*(1.0-phase);
 let ca=bilinear(a,pa);let cb=bilinear(b,pb);
 let matched=error<0.04&&deltaColor(ca,cb)<0.07;
 let ambiguous=length(best)>1.0&&second-score<0.001;
 var color=select(rgbAt(a,vec2i(id.xy)),rgbAt(b,vec2i(id.xy)),phase>=0.5);
 if(matched&&!ambiguous){color=mix(ca,cb,phase);}
 if(m.control.w>1.5){color=select(vec3f(1,0,0),vec3f(0,1,0),matched&&!ambiguous);if(ambiguous){color=vec3f(1,1,0);}}
 textureStore(output,vec2i(id.xy),vec4f(color,1));
}
