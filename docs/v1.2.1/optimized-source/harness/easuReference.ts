// Scalar CPU validation port of AMD FSR1 FsrEasuF (MIT, AMD copyright 2021).
// Kept independent of shader text so upload/layout/translation mistakes are detectable.
export function easuReference(data:Uint8ClampedArray,sw:number,sh:number,ow:number,oh:number,animation=false):Uint8ClampedArray{
  const result=new Uint8ClampedArray(ow*oh*4);
  const offsets=[[0,-1],[1,-1],[-1,1],[0,1],[0,0],[-1,0],[1,1],[2,1],[2,0],[1,0],[1,2],[0,2]];
  const sample=(x:number,y:number)=>{const i=(Math.max(0,Math.min(sh-1,y))*sw+Math.max(0,Math.min(sw-1,x)))*4;return [data[i]/255,data[i+1]/255,data[i+2]/255];};
  const lum=(c:number[])=>c[1]+(c[0]+c[2])*.5;
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){
    let px=(x+.5)*sw/ow-.5,py=(y+.5)*sh/oh-.5;
    if(Math.abs(px-Math.round(px))<.00001)px=Math.round(px);if(Math.abs(py-Math.round(py))<.00001)py=Math.round(py);
    const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    const colors=offsets.map(([dx,dy])=>sample(ix+dx,iy+dy));const [b,c,ii,j,a,e,k,l,h,g,o,n]=colors.map(lum);
    let dx=0,dy=0,len=0;
    for(const [aa,bb,cc,dd,ee,w] of [[b,e,a,g,j,(1-fx)*(1-fy)],[c,a,g,h,k,fx*(1-fy)],[a,ii,j,k,n,(1-fx)*fy],[g,j,k,l,o,fx*fy]]){
      const vx=dd-bb,vy=ee-aa;
      const lx=Math.min(1,Math.abs(vx)/Math.max(Math.abs(dd-cc),Math.abs(cc-bb),1e-6));
      const ly=Math.min(1,Math.abs(vy)/Math.max(Math.abs(ee-cc),Math.abs(cc-aa),1e-6));
      dx+=vx*w;dy+=vy*w;len+=(lx*lx+ly*ly)*w;
    }
    const norm=Math.hypot(dx,dy);if(norm*norm<1/32768){dx=1;dy=0;}else{dx/=norm;dy/=norm;}
    let edge=(len*.5)**2;if(animation)edge=Math.min(1,edge*1.2);
    const stretch=(dx*dx+dy*dy)/Math.max(Math.abs(dx),Math.abs(dy)),lx=1+(stretch-1)*edge,ly=1-.5*edge,lob=.5-.29*edge;
    const sum=[0,0,0];let weights=0;
    for(let tap=0;tap<12;tap++){
      const ox=offsets[tap][0]-fx,oy=offsets[tap][1]-fy;
      const vx=(ox*dx+oy*dy)*lx,vy=(-ox*dy+oy*dx)*ly;
      const d2=Math.min(vx*vx+vy*vy,1/lob),b=.4*d2-1,a=lob*d2-1,w=(1.5625*b*b-.5625)*a*a;
      for(let channel=0;channel<3;channel++)sum[channel]+=colors[tap][channel]*w;weights+=w;
    }
    const at=(y*ow+x)*4;
    for(let ch=0;ch<3;ch++){const near=[4,9,3,6].map(i=>colors[i][ch]);result[at+ch]=Math.round(Math.max(Math.min(...near),Math.min(Math.max(...near),sum[ch]/Math.max(weights,1e-6)))*255);}
    result[at+3]=255;
  }
  return result;
}
