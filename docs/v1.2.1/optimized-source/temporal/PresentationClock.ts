import type {MotionPair} from '../gpu/MotionEstimator';
import {MAX_VISUAL_DELAY_MS,type TemporalPlan} from './TemporalClock';
/** Media timestamps are anchored to the native video's expected presentation, not its audio clock. */
export class PresentationClock{
  private offsets:number[]=[];private offset=0;private rate=1;private previous=-1;ready=false;
  observe(media:number,expected:number,rate:number):boolean{
    const discontinuity=this.previous>=0&&(media<this.previous||rate!==this.rate);if(discontinuity)this.reset();this.rate=rate;this.previous=media;
    this.offsets.push(media*1000-expected*rate);if(this.offsets.length>24)this.offsets.shift();const sorted=[...this.offsets].sort((a,b)=>a-b);this.offset=sorted[Math.floor(sorted.length/2)];this.ready=this.offsets.length>=2;return discontinuity;
  }
  mediaAt(wall:number):number{return (wall*this.rate+this.offset)/1000;}
  reset():void{this.offsets=[];this.offset=0;this.previous=-1;this.ready=false;}
}
export function selectTemporalPair(pairs:MotionPair[],nativeTime:number,periodMs:number,rate:number):{pair:MotionPair;plan:TemporalPlan}|null{
  if(periodMs<4||periodMs>MAX_VISUAL_DELAY_MS||!pairs.length)return null;
  const target=nativeTime-periodMs*rate/1000;
  const pair=pairs.find(p=>target>=p.a-.001&&target<=p.b+.001)??(target>pairs[pairs.length-1].b?pairs[pairs.length-1]:undefined);
  if(!pair)return null;
  const alpha=pair.sceneCut||!pair.dynamic?1:Math.max(0,Math.min(1,(target-pair.a)/(pair.b-pair.a)));
  return {pair,plan:{alpha,mediaTime:pair.a+(pair.b-pair.a)*alpha,delayMs:periodMs,generated:alpha>.001&&alpha<.999}};
}
export class OutputPacer{
  private next=0;private fps=0;
  due(time:number,fps:number):boolean{if(this.fps!==fps){this.fps=fps;this.next=time;}if(time+.1<this.next)return false;const interval=1000/fps;this.next+=(Math.max(0,Math.floor((time-this.next)/interval))+1)*interval;return true;}
  reset():void{this.next=0;this.fps=0;}
}
