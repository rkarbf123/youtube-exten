export interface StageSummary{count:number;mean:number;p50:number;p95:number;max:number;total:number}
export class TemporalProfiler{
  enabled=false;signatures=true;generation=0;timestampSupported:boolean|null=null;
  private values=new Map<string,number[]>();private counts=new Map<string,number>();
  configure(enabled:boolean,signatures=true):void{this.enabled=enabled;this.signatures=signatures;this.reset();}
  reset():void{this.generation++;this.values.clear();this.counts.clear();}
  mark():number{return this.enabled?performance.now():0;}
  elapsed(name:string,start:number):void{if(this.enabled)this.sample(name,performance.now()-start);}
  sample(name:string,value:number):void{if(!this.enabled||!Number.isFinite(value))return;let a=this.values.get(name);if(!a){a=[];this.values.set(name,a);}if(a.length<8192)a.push(value);}
  count(name:string,amount=1):void{this.counts.set(name,(this.counts.get(name)??0)+amount);}
  snapshot(){const stages:Record<string,StageSummary>={};for(const [name,a]of this.values){const s=[...a].sort((x,y)=>x-y),total=a.reduce((x,y)=>x+y,0);stages[name]={count:a.length,mean:total/a.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],max:s[s.length-1],total};}return {enabled:this.enabled,timestampSupported:this.timestampSupported,stages,counters:Object.fromEntries(this.counts)};}
}
export const temporalPerf=new TemporalProfiler();
