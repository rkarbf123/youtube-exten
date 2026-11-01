fn toLinear(c:vec3f)->vec3f{return select(pow((c+0.055)/1.055,vec3f(2.4)),c/12.92,c<=vec3f(0.04045));}
fn toSRGB(c:vec3f)->vec3f{return select(1.055*pow(max(c,vec3f(0)),vec3f(1.0/2.4))-0.055,c*12.92,c<=vec3f(0.0031308));}
fn gamutScale(chroma:vec3f,y:f32,requested:f32)->f32{
  var s=requested;
  for(var axis=0;axis<3;axis++){let d=chroma[axis];if(d>0.000001){s=min(s,(1.0-y)/d);}else if(d< -0.000001){s=min(s,-y/d);}}
  return max(0.0,s);
}
fn adjustColor(c:vec3f,saturation:f32,brightness:f32)->vec3f{
  if(saturation==1.0&&brightness==1.0){return c;}
  let rgb=toLinear(clamp(c,vec3f(0),vec3f(1)));let y=dot(rgb,vec3f(0.2126,0.7152,0.0722));
  let chroma=rgb-vec3f(y);let saturated=vec3f(y)+chroma*gamutScale(chroma,y,saturation);
  var luminanceGoal=y*brightness;if(brightness>1.0){luminanceGoal=y*brightness/(1.0+(brightness-1.0)*y);}
  let bright=saturated*select(brightness,luminanceGoal/max(y,0.000001),y>0.000001);
  let outChroma=bright-vec3f(luminanceGoal);
  return toSRGB(clamp(vec3f(luminanceGoal)+outChroma*gamutScale(outChroma,luminanceGoal,1.0),vec3f(0),vec3f(1)));
}
