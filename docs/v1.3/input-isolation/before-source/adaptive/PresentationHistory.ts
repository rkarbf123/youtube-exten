/** DOM presentation duty over a bounded rolling window, not GPU utilization. */
export class PresentationHistory {
  private changes:{at:number;visible:boolean}[];
  private start:number;
  constructor(now=performance.now()){this.start=now;this.changes=[{at:now,visible:false}];}
  set(visible:boolean,now=performance.now()):void{
    if(this.changes[this.changes.length-1].visible!==visible)this.changes.push({at:now,visible});
    this.trim(now);
  }
  private trim(now:number):void{while(this.changes.length>1&&this.changes[1].at<=now-2000)this.changes.shift();}
  percent(now=performance.now()):number{
    this.trim(now);const from=Math.max(this.start,now-2000);let visible=0;
    for(let i=0;i<this.changes.length;i++)if(this.changes[i].visible)visible+=Math.max(0,(this.changes[i+1]?.at??now)-Math.max(from,this.changes[i].at));
    return now>from?visible/(now-from)*100:0;
  }
}
