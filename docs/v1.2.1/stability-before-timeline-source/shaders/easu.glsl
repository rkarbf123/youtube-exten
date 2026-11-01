// AMD FSR1 EASU float32 port. Copyright (c) 2021 AMD, MIT.
// Reference: references/ffx_fsr1.h. Same 12-tap footprint as the upstream scalar.
float easuLuma(vec3 c){return c.g+(c.r+c.b)*.5;}
vec3 easuSet(float a,float b,float c,float d,float e,float w){
  float dx=d-b,dy=e-a;
  float lx=clamp(abs(dx)/max(max(abs(d-c),abs(c-b)),.000001),0.,1.);
  float ly=clamp(abs(dy)/max(max(abs(e-c),abs(c-a)),.000001),0.,1.);
  return vec3(dx,dy,lx*lx+ly*ly)*w;
}
float easuTap(vec2 off,vec2 dir,vec2 len,float lob){
  vec2 v=vec2(dot(off,dir),dot(off,vec2(-dir.y,dir.x)))*len;
  float d2=min(dot(v,v),1./lob),b=.4*d2-1.,a=lob*d2-1.;
  return (1.5625*b*b-.5625)*a*a;
}
float textureCubic(float v,float blur){float x=abs(v),b=blur/3.,c=.5-blur/6.;if(x<1.)return((12.-9.*b-6.*c)*x*x*x+(-18.+12.*b+6.*c)*x*x+6.-2.*b)/6.;if(x<2.)return((-b-6.*c)*x*x*x+(6.*b+30.*c)*x*x+(-12.*b-48.*c)*x+8.*b+24.*c)/6.;return 0.;}
vec3 easu(sampler2D t,vec2 p,bool animation,float noise){
  p=mix(p,round(p),lessThan(abs(p-round(p)),vec2(.00001)));
  ivec2 i=ivec2(floor(p));vec2 f=fract(p);
  vec3 b=pixel(t,i+ivec2(0,-1)),c=pixel(t,i+ivec2(1,-1));
  vec3 e=pixel(t,i+ivec2(-1,0)),a=pixel(t,i),g=pixel(t,i+ivec2(1,0)),h=pixel(t,i+ivec2(2,0));
  vec3 ii=pixel(t,i+ivec2(-1,1)),j=pixel(t,i+ivec2(0,1)),k=pixel(t,i+ivec2(1,1)),l=pixel(t,i+ivec2(2,1));
  vec3 n=pixel(t,i+ivec2(0,2)),o=pixel(t,i+ivec2(1,2));
  vec3 field=easuSet(easuLuma(b),easuLuma(e),easuLuma(a),easuLuma(g),easuLuma(j),(1.-f.x)*(1.-f.y))
    +easuSet(easuLuma(c),easuLuma(a),easuLuma(g),easuLuma(h),easuLuma(k),f.x*(1.-f.y))
    +easuSet(easuLuma(a),easuLuma(ii),easuLuma(j),easuLuma(k),easuLuma(n),(1.-f.x)*f.y)
    +easuSet(easuLuma(g),easuLuma(j),easuLuma(k),easuLuma(l),easuLuma(o),f.x*f.y);
  vec2 dir=vec2(1,0);if(dot(field.xy,field.xy)>=1./32768.)dir=normalize(field.xy);
  float edge=field.z*.5;edge*=edge;if(animation)edge=min(1.,edge*1.2);
  float stretch=dot(dir,dir)/max(abs(dir.x),abs(dir.y));vec2 len=vec2(1.+(stretch-1.)*edge,1.-.5*edge);float lob=.5-.29*edge;
  vec3 colors[12]=vec3[12](b,c,ii,j,a,e,k,l,h,g,o,n);
  vec2 offsets[12]=vec2[12](vec2(0,-1),vec2(1,-1),vec2(-1,1),vec2(0,1),vec2(0,0),vec2(-1,0),vec2(1,1),vec2(2,1),vec2(2,0),vec2(1,0),vec2(1,2),vec2(0,2));
  vec3 lo=min(min(a,g),min(j,k)),hi=max(max(a,g),max(j,k));float contrast=luma(hi-lo);vec3 reconstructed=mix(mix(a,g,f.x),mix(j,k,f.x),f.y);
  if(animation||contrast>.035){vec3 sum=vec3(0);float weights=0.;for(int v=0;v<12;v++){float w=easuTap(offsets[v]-f,dir,len,lob);sum+=colors[v]*w;weights+=w;}reconstructed=clamp(sum/max(weights,.000001),lo,hi);}
  if(animation)return reconstructed;
  if(contrast>=.16)return reconstructed;
  float blur=clamp((1.-edge)*noise*4.,0.,1.);
  float wx[4]=float[4](textureCubic(-1.-f.x,blur),textureCubic(-f.x,blur),textureCubic(1.-f.x,blur),textureCubic(2.-f.x,blur));
  float wy[4]=float[4](textureCubic(-1.-f.y,blur),textureCubic(-f.y,blur),textureCubic(1.-f.y,blur),textureCubic(2.-f.y,blur));
  vec3 smoothColor=vec3(0);float sw=0.;
  for(int v=0;v<12;v++){ivec2 at=ivec2(offsets[v])+1;float w=wx[at.x]*wy[at.y];smoothColor+=colors[v]*w;sw+=w;}
  return mix(clamp(smoothColor/max(sw,.000001),lo,hi),reconstructed,smoothstep(.035,.16,contrast)*edge);
}
