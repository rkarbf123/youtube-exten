import {describe,it,expect} from 'vitest';
import {planTemporal,synchronized,RefreshClock,SourceCadence} from '../../src/temporal/TemporalClock';
import {TemporalAdaptiveController} from '../../src/adaptive/TemporalAdaptiveController';
describe('bounded motion timeline',()=>{
  for(const source of [24,30,60])for(const target of [75,100,120])it(source+'→'+target+' uses actual pair time and fractional phases',()=>{
    const dt=1/source,phases=[];for(let time=dt;time<2*dt-.003;time+=1/target){const p=planTemporal(0,dt,time,1,0)!;expect(p.mediaTime).toBeCloseTo(time-dt+.003);expect(synchronized(time,p.mediaTime,1)).toBe(true);phases.push(p.alpha);}expect(phases.some(p=>p>0&&p<1)).toBe(true);
  });
  it('rejects excessive delay and extrapolation; cuts and stills use latest source',()=>{expect(planTemporal(0,1/15,.08,1,0)).toBeNull();expect(planTemporal(0,1/30,.2,1,0)).toBeNull();for(const [cut,dynamic]of [[true,true],[false,false]])expect(planTemporal(0,1/30,.04,1,0,cut,dynamic)?.generated).toBe(false);expect(synchronized(.1,0,1)).toBe(false);expect(synchronized(.07,.05,2)).toBe(true);});
  it('measures browser cadence without treating requested FPS as hardware cadence',()=>{const clock=new RefreshClock();for(let i=1;i<=40;i++)clock.tick(i*1000/60);expect(clock.hz).toBeCloseTo(60);clock.reset();expect(clock.hz).toBeNull();});
});
it('estimates native cadence robustly when isolated source callbacks are dropped',()=>{const c=new SourceCadence();for(let i=0;i<40;i++)c.add(i%5===0?66.667:16.667);expect(c.period).toBeCloseTo(16.667);c.reset();expect(c.period).toBeNull();});
it('reduces motion cost before spatial workload and output frequency, with cooldown',()=>{const c=new TemporalAdaptiveController();let now=0;const pressure=()=>{for(let n=0;n<48;n++){now+=100;c.sample(20,10,true,now,true);}};pressure();expect(c.tier).toBe(0);expect(c.scale).toBe(1);expect(c.allowSpatial).toBe(false);pressure();expect(c.scale).toBeLessThan(1);expect(c.frequency).toBe(1);for(let i=0;i<4;i++)pressure();expect(c.allowSpatial).toBe(true);expect(c.frequency).toBeLessThan(1);const old=c.frequency;c.sample(100,10,true,now+1,false);expect(c.frequency).toBe(old);});
