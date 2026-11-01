@group(0) @binding(0) var image:texture_2d<f32>;
struct Signature{a:atomic<u32>,b:atomic<u32>}
@group(0) @binding(1) var<storage,read_write> signature:Signature;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
  if(id.x>=256u){return;}let size=textureDimensions(image);let uv=(vec2f(f32(id.x%16u),f32(id.x/16u))+0.5)/16.0;
  let p=min(vec2u(uv*vec2f(size)),size-1u);let c=vec3u(round(clamp(textureLoad(image,vec2i(p),0).rgb,vec3f(0),vec3f(1))*255.0));
  var h=c.x|(c.y<<8u)|(c.z<<16u);h=(h^(id.x*2654435761u))*2246822519u;h=(h^(h>>13u))*3266489917u;
  atomicAdd(&signature.a,h);atomicAdd(&signature.b,(h^(h>>16u))*(id.x+17u));
}
