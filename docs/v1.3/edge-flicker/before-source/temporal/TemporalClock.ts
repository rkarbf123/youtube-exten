export const MAX_VISUAL_DELAY_MS=45;
export const nativeClockLimit=(periodMs:number):number=>Math.max(MAX_VISUAL_DELAY_MS,Math.min(MAX_VISUAL_DELAY_MS,Math.max(0,periodMs))*2);
export const totalMediaLimit=(periodMs:number):number=>nativeClockLimit(periodMs)+MAX_VISUAL_DELAY_MS;
export interface TemporalPlan{alpha:number;mediaTime:number;delayMs:number;generated:boolean}
export function planTemporal(a:number,b:number,current:number,rate:number,workMs:number,sceneCut=false,dynamic=true):TemporalPlan|null{
  const period=(b-a)*1000/Math.max(.1,rate);
  if(period<4||period>MAX_VISUAL_DELAY_MS||!Number.isFinite(current))return null;
  if(sceneCut||!dynamic)return {alpha:1,mediaTime:b,delayMs:(current-b)*1000/rate,generated:false};
  const predicted=current+Math.min(12,Math.max(0,workMs))*rate/1000;
  const delay=Math.max(0,period-3); // completion jitter margin inside the 45ms safety bound
  const t=predicted-delay*rate/1000;if(t<a-.002||t>b+.008)return null;
  const alpha=Math.max(0,Math.min(1,(t-a)/(b-a)));
  return {alpha,mediaTime:a+(b-a)*alpha,delayMs:delay,generated:alpha>.001&&alpha<.999};
}
export function synchronized(current:number,content:number,rate:number):boolean{const skew=(current-content)*1000/Math.max(.1,rate);return skew>=-2&&skew<=MAX_VISUAL_DELAY_MS;}
export class RefreshClock{
  private previous=0;private intervals:number[]=[];hz:number|null=null;
  tick(time:number):void{if(this.previous){const dt=time-this.previous;if(dt>=4&&dt<=50){this.intervals.push(dt);if(this.intervals.length>40)this.intervals.shift();if(this.intervals.length>=10){const sorted=[...this.intervals].sort((a,b)=>a-b);this.hz=1000/sorted[Math.floor(sorted.length/2)];}}}this.previous=time;}
  reset():void{this.previous=0;this.intervals=[];this.hz=null;}
}
/** Dropped callbacks must not make a 60fps source appear to be 15fps to overload protection. */
export class SourceCadence{
  private intervals:number[]=[];
  get samples():number{return this.intervals.length;}
  add(ms:number):void{if(ms>=4&&ms<=250){this.intervals.push(ms);if(this.intervals.length>40)this.intervals.shift();}}
  get period():number|null{if(!this.intervals.length)return null;const s=[...this.intervals].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];}
  reset():void{this.intervals=[];}
}
