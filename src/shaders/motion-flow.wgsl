@group(0) @binding(0) var a:texture_2d<f32>;
@group(0) @binding(1) var b:texture_2d<f32>;
@group(0) @binding(2) var forward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(3) var backward:texture_storage_2d<rgba16float,write>;
@group(0) @binding(4) var<uniform> m:MotionParams;
struct Analysis { error:atomic<u32>, difference:atomic<u32>, confidence:atomic<u32>, moving:atomic<u32>, blocks:atomic<u32> }
@group(0) @binding(5) var<storage,read_write> stats:Analysis;
@group(0) @binding(6) var priorForward:texture_2d<f32>;
@group(0) @binding(7) var priorBackward:texture_2d<f32>;
fn sampleFirst(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(b,p);}return rgbAt(a,p);}
fn sampleSecond(p:vec2i,reverse:bool)->vec3f{if(reverse){return rgbAt(a,p);}return rgbAt(b,p);}
fn difference(x:vec3f,y:vec3f)->f32{return dot(abs(x-y),vec3f(0.25,0.5,0.25));}
fn patchError(p:vec2i,delta:vec2i,reverse:bool)->f32{
  let count=i32(m.control.y);var sum=0.0;
  for(var y=0;y<4;y++){for(var x=0;x<4;x++){if(x<count&&y<count){let at=p+vec2i(x*2-(count-1),y*2-(count-1));sum+=difference(sampleFirst(at,reverse),sampleSecond(at+delta,reverse));}}}
  return sum/f32(count*count);
}
@compute @workgroup_size(8,8)
fn refine(@builtin(global_invocation_id) id:vec3u){
 if(any(id.xy>=vec2u(m.grid.xy))){return;}let reverse=id.z==1u;let p=vec2i((vec2f(id.xy)+0.5)*m.grid.z);let hi=vec2i(m.grid.xy)-1;
 var value=textureLoad(priorForward,vec2i(id.xy),0);if(reverse){value=textureLoad(priorBackward,vec2i(id.xy),0);}
 var error=patchError(p,vec2i(round(value.xy)),reverse);var score=error+0.006*(1.0-value.z);
 // Discrete edge-preserving propagation resolves the aperture problem. Every
 // neighbor hypothesis must still match THIS source patch to the other frame.
 for(var y=-3;y<=3;y++){for(var x=-3;x<=3;x++){
  let uv=clamp(vec2i(id.xy)+vec2i(x,y),vec2i(0),hi);var v=textureLoad(priorForward,uv,0);if(reverse){v=textureLoad(priorBackward,uv,0);}if(v.z<0.15){continue;}
  let e=patchError(p,vec2i(round(v.xy)),reverse);let cost=e+0.006*(1.0-v.z)+0.00003*f32(x*x+y*y);
  if(cost<score){score=cost;error=e;value=vec4f(v.xy,v.z,e);}
 }}
 value=vec4f(value.xy,value.z*clamp(1.0-error/0.12,0.0,1.0),error);
 if(reverse){textureStore(backward,vec2i(id.xy),value);}else{textureStore(forward,vec2i(id.xy),value);}
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(any(id.xy>=vec2u(m.grid.xy))){return;}
  let reverse=id.z==1u;let p=vec2i((vec2f(id.xy)+0.5)*m.grid.z);
  let fine=m.control.w>0.5;let radius=i32(m.control.x);var best=vec2i(0);let zeroError=patchError(p,best,reverse);var bestError=zeroError;var bestScore=bestError;
  if(fine){
    let at=vec2i(floor((vec2f(p)+0.5)*0.5/m.grid.z-0.5));let hi=vec2i(textureDimensions(priorForward))-1;
    // Preserve separate motion candidates at boundaries instead of averaging foreground/background.
    for(var y=0;y<2;y++){for(var x=0;x<2;x++){let uv=clamp(at+vec2i(x,y),vec2i(0),hi);var v=textureLoad(priorForward,uv,0);if(reverse){v=textureLoad(priorBackward,uv,0);}let d=vec2i(round(v.xy*2.0));let error=patchError(p,d,reverse);let score=error+select(0.000002,0.000035,fine)*f32(dot(vec2f(d),vec2f(d)));if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  }
  let origin=vec2i(0);let step=4;
  // Coarse translation search, then a 5x5 full-pixel refinement. Bounded work.
  for(var y=-radius;y<=radius;y+=step){for(var x=-radius;x<=radius;x+=step){let d=origin+vec2i(x,y);let error=patchError(p,d,reverse);let score=error+select(0.000002,0.000035,fine)*f32(dot(vec2f(d),vec2f(d)));if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let coarse=best;
  for(var y=-2;y<=2;y++){for(var x=-2;x<=2;x++){let d=coarse+vec2i(x,y);let error=patchError(p,d,reverse);let score=error+select(0.000002,0.000035,fine)*f32(dot(vec2f(d),vec2f(d)));if(score<bestScore){best=d;bestError=error;bestScore=score;}}}
  let ex0=patchError(p,best-vec2i(1,0),reverse);let ex1=patchError(p,best+vec2i(1,0),reverse);
  let ey0=patchError(p,best-vec2i(0,1),reverse);let ey1=patchError(p,best+vec2i(0,1),reverse);
  var sub=vec2f(0);let cx=ex0+ex1-2.0*bestError;let cy=ey0+ey1-2.0*bestError;
  if(bestError>0.0005&&cx>0.0001&&ex0>bestError+0.0001&&ex1>bestError+0.0001){sub.x=clamp(0.5*(ex0-ex1)/cx,-0.5,0.5);}if(bestError>0.0005&&cy>0.0001&&ey0>bestError+0.0001&&ey1>bestError+0.0001){sub.y=clamp(0.5*(ey0-ey1)/cy,-0.5,0.5);}
  var xx=0.0;var yy=0.0;var xy=0.0;
  for(var y=-3;y<=3;y+=2){for(var x=-3;x<=3;x+=2){let at=p+vec2i(x,y);let gx=dot(sampleFirst(at+vec2i(1,0),reverse)-sampleFirst(at-vec2i(1,0),reverse),vec3f(0.25,0.5,0.25));let gy=dot(sampleFirst(at+vec2i(0,1),reverse)-sampleFirst(at-vec2i(0,1),reverse),vec3f(0.25,0.5,0.25));xx+=gx*gx;yy+=gy*gy;xy+=gx*gy;}}
  let lambda=(xx+yy-sqrt((xx-yy)*(xx-yy)+4.0*xy*xy))/32.0;
  let rawConfidence=clamp(1.0-bestError/0.12,0.0,1.0)*(0.08+0.92*clamp(lambda*180.0,0.0,1.0));
  // A poor match pinned to the search edge is not a reliable fast-motion vector.
  let confidence=select(rawConfidence,0.0,!fine&&any(abs(best)>=vec2i(radius-1))&&bestError>0.015);
  let value=vec4f(vec2f(best)+sub,confidence,bestError);
  if(reverse){textureStore(backward,vec2i(id.xy),value);}else{
    textureStore(forward,vec2i(id.xy),value);
    if(fine){atomicAdd(&stats.error,u32(bestError*65535.0));atomicAdd(&stats.difference,u32(zeroError*65535.0));
    atomicAdd(&stats.confidence,u32(confidence*65535.0));if(length(value.xy)>0.2&&confidence>0.15){atomicAdd(&stats.moving,1u);}atomicAdd(&stats.blocks,1u);}
  }
}
