@group(0) @binding(0) var a:texture_2d<f32>;
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
  let radius=i32(m.control.x);var best=vec2i(0);let zeroError=patchError(p,best,reverse);var bestError=zeroError;var bestScore=bestError;
  // Coarse translation search, then a 5x5 full-pixel refinement. Bounded work.
  for(var y=-radius;y<=radius;y+=4){for(var x=-radius;x<=radius;x+=4){let d=vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(x*x+y*y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let coarse=best;
  for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=coarse+vec2i(x,y);let error=patchError(p,d,reverse);let score=error+0.000035*f32(d.x*d.x+d.y*d.y);if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let ex0=patchError(p,best-vec2i(1,0),reverse);let ex1=patchError(p,best+vec2i(1,0),reverse);
  let ey0=patchError(p,best-vec2i(0,1),reverse);let ey1=patchError(p,best+vec2i(0,1),reverse);
  var sub=vec2f(0);let cx=ex0+ex1-2.0*bestError;let cy=ey0+ey1-2.0*bestError;
  if(cx>0.0001){sub.x=clamp(0.5*(ex0-ex1)/cx,-0.5,0.5);}if(cy>0.0001){sub.y=clamp(0.5*(ey0-ey1)/cy,-0.5,0.5);}
  let textureStrength=difference(sampleFirst(p+vec2i(5,0),reverse),sampleFirst(p-vec2i(5,0),reverse))+difference(sampleFirst(p+vec2i(0,5),reverse),sampleFirst(p-vec2i(0,5),reverse));
  let rawConfidence=clamp(1.0-bestError/0.16,0.0,1.0)*(0.12+0.88*clamp(textureStrength*5.0,0.0,1.0));
  // A poor match pinned to the search edge is not a reliable fast-motion vector.
  let confidence=select(rawConfidence,0.0,any(abs(best)>=vec2i(radius-1))&&bestError>0.015);
  let value=vec4f(vec2f(best)+sub,confidence,bestError);
  if(reverse){textureStore(backward,vec2i(id.xy),value);}else{
    textureStore(forward,vec2i(id.xy),value);
    atomicAdd(&stats.error,u32(bestError*65535.0));atomicAdd(&stats.difference,u32(zeroError*65535.0));
    atomicAdd(&stats.confidence,u32(confidence*65535.0));if(length(value.xy)>0.2&&confidence>0.15){atomicAdd(&stats.moving,1u);}atomicAdd(&stats.blocks,1u);
  }
}
