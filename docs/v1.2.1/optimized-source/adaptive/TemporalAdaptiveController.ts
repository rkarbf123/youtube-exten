export class TemporalAdaptiveController{
  tier=1;scale=1;frequency=1;allowSpatial=false;private ema=0;private count=0;private misses=0;private start=0;private last=-Infinity;private bad=0;private good=0;
  sample(ms:number,budget:number,missed:boolean,now:number,enabled:boolean):void{
    if(!enabled)return;this.ema=this.ema===0?ms/budget:this.ema*.9+ms/budget*.1;this.count++;if(missed)this.misses++;
    if(now-this.start<2000||this.count<24)return;
    this.bad=this.ema>.9||this.misses/this.count>.15?this.bad+1:0;this.good=this.ema<.45&&this.misses===0?this.good+1:0;this.start=now;this.count=this.misses=0;
    if(now-this.last<4000)return;
    if(this.bad>=2){if(this.tier>0)this.tier--;else if(this.scale>.51)this.scale*=.75;else if(!this.allowSpatial)this.allowSpatial=true;else this.frequency=Math.max(.4,this.frequency*.8);this.last=now;this.bad=this.good=0;}
    else if(this.good>=3){if(this.frequency<1)this.frequency=Math.min(1,this.frequency/.8);else if(this.allowSpatial)this.allowSpatial=false;else if(this.scale<1)this.scale=Math.min(1,this.scale/.75);else if(this.tier<2)this.tier++;this.last=now;this.bad=this.good=0;}
  }
  get config(){return {tier:this.tier,width:Math.max(96,Math.round(256*this.scale))};}
}
