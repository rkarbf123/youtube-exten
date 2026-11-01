struct MotionParams { full:vec4f, grid:vec4f, control:vec4f }
fn rgbAt(t:texture_2d<f32>,p:vec2i)->vec3f{return textureLoad(t,clamp(p,vec2i(0),vec2i(textureDimensions(t))-1),0).rgb;}
fn bilinear(t:texture_2d<f32>,p:vec2f)->vec3f{let i=vec2i(floor(p));let f=fract(p);return mix(mix(rgbAt(t,i),rgbAt(t,i+vec2i(1,0)),f.x),mix(rgbAt(t,i+vec2i(0,1)),rgbAt(t,i+vec2i(1,1)),f.x),f.y);}
