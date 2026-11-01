vec3 toLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(.04045)));}
vec3 toSRGB(vec3 c){return mix(1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,c*12.92,lessThanEqual(c,vec3(.0031308)));}
float gamutScale(vec3 chroma,float y,float requested){float s=requested;for(int axis=0;axis<3;axis++){float d=chroma[axis];if(d>.000001)s=min(s,(1.-y)/d);else if(d<-.000001)s=min(s,-y/d);}return max(0.,s);}
vec3 adjustColor(vec3 c,float saturation,float brightness){
  if(saturation==1.&&brightness==1.)return c;
  vec3 rgb=toLinear(clamp(c,0.,1.));float y=dot(rgb,vec3(.2126,.7152,.0722));vec3 chroma=rgb-y;
  vec3 saturated=vec3(y)+chroma*gamutScale(chroma,y,saturation);
  float target=brightness>1.?y*brightness/(1.+(brightness-1.)*y):y*brightness;
  vec3 bright=saturated*(y>.000001?target/max(y,.000001):brightness),outChroma=bright-target;
  return toSRGB(clamp(vec3(target)+outChroma*gamutScale(outChroma,target,1.),0.,1.));
}
