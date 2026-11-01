import easu from './easu.glsl?raw';
export const vertex = `#version 300 es
precision highp float;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }
`;
const common = `
precision highp float;
precision highp int;
uniform sampler2D inputTex;
uniform sampler2D originalTex;
uniform vec4 dims;
uniform vec4 settings;
uniform float divider;
uniform float contentMode;
uniform float originalView;
out vec4 color;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 pixel(sampler2D t,ivec2 p){ivec2 size=textureSize(t,0);p=clamp(p,ivec2(0),size-1);p.y=size.y-1-p.y;return texelFetch(t,p,0).rgb;}
vec3 linearSample(sampler2D t,vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);return mix(mix(pixel(t,i),pixel(t,i+ivec2(1,0)),f.x),mix(pixel(t,i+ivec2(0,1)),pixel(t,i+ivec2(1)),f.x),f.y);}
float cubic(float v){float x=abs(v);if(x<1.)return(7.*x*x*x-12.*x*x+5.3333333)/6.;if(x<2.)return(-2.3333333*x*x*x+12.*x*x-20.*x+10.6666667)/6.;return 0.;}
`;
export const denoise = '#version 300 es\n' + common + `
void main(){ivec2 p=ivec2(gl_FragCoord.x,dims.y-gl_FragCoord.y);vec3 c=pixel(inputTex,p),sum=vec3(0);float weights=0.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 s=pixel(inputTex,p+ivec2(x,y));float delta=luma(s)-luma(c),chroma=dot(s-c,s-c)/3.;float sigma=contentMode>.5?.0024:.0025;float w=(1./(1.+float(x*x+y*y)*1.5))/(1.+delta*delta/sigma+chroma/(sigma*2.));sum+=s*w;weights+=w;}
color=vec4(mix(c,sum/weights,min(1.,settings.y*(contentMode>.5?.7:1.25))),1);}`;
export const upscale = '#version 300 es\n' + common + easu + `
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);vec2 p=q*dims.xy/dims.zw-.5;ivec2 i=ivec2(floor(p));vec2 f=fract(p);
vec3 a=pixel(inputTex,i),b=pixel(inputTex,i+ivec2(1,0)),c=pixel(inputTex,i+ivec2(0,1)),d=pixel(inputTex,i+ivec2(1));
vec3 base=mix(mix(a,b,f.x),mix(c,d,f.x),f.y),lo=min(min(a,b),min(c,d)),hi=max(max(a,b),max(c,d));
if(settings.z<.5){float ad=abs(luma(a)-luma(d)),bc=abs(luma(b)-luma(c));float edge=abs(ad-bc)/(ad+bc+.02);vec3 diag=mix(b,c,(1.-f.x+f.y)*.5);float proximity=1.-abs(f.x+f.y-1.);if(ad<bc){diag=mix(a,d,(f.x+f.y)*.5);proximity=1.-abs(f.x-f.y);}color=vec4(clamp(mix(base,diag,.35*edge*proximity),lo,hi),1);}
else{color=vec4(easu(inputTex,p,contentMode>.5,settings.y),1);}}
`;
export const composite = '#version 300 es\n' + common + `
void main(){vec2 q=vec2(gl_FragCoord.x,dims.w-gl_FragCoord.y);
if(originalView>.5||(settings.w>.5&&gl_FragCoord.x/dims.z<divider)){color=vec4(linearSample(originalTex,q*dims.xy/dims.zw-.5),1);return;}
ivec2 p=ivec2(q);vec3 c=pixel(inputTex,p),n=pixel(inputTex,p+ivec2(0,-1)),s=pixel(inputTex,p+ivec2(0,1)),e=pixel(inputTex,p+ivec2(1,0)),w=pixel(inputTex,p+ivec2(-1,0));
vec3 lo=min(c,min(min(n,s),min(e,w))),hi=max(c,max(max(n,s),max(e,w)));float detail=luma(c)-luma((n+s+e+w)*.25);
vec3 result=clamp(c+vec3(detail*settings.x*1.25),lo,hi);
color=vec4(clamp(result,0.,1.),1);}`;
