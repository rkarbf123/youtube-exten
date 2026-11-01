import { describe,it,expect } from 'vitest';
import { AdaptiveController,ADAPTIVE_DEFAULTS } from '../../src/adaptive/AdaptiveController';
import { DEFAULTS } from '../../src/settings/SettingsManager';
function feed(c:AdaptiveController,latency:number,interval:number,from:number,windows:number,missed=false):number{
  let now=from;for(let w=0;w<windows;w++)for(let i=0;i<40;i++){now+=60;c.sample(latency,interval,missed,now);}return now;
}
describe('adaptive profiles',()=>{
  it('starts at conservative Eco',()=>{expect(new AdaptiveController().profile).toBe('eco');});
  it('promotes only after sustained headroom',()=>{const c=new AdaptiveController();c.reset(0);let now=feed(c,2,40,0,1);expect(c.profile).toBe('eco');now=feed(c,2,40,now,3);expect(c.profile).toBe('balanced');feed(c,2,40,now,4);expect(c.profile).toBe('quality');});
  it('demotes after consecutive overload windows',()=>{const c=new AdaptiveController();c.reset(0);c.profile='quality';feed(c,40,33,0,4,true);expect(c.profile).not.toBe('quality');});
  it('responds to missed deadlines even when submission is fast',()=>{const c=new AdaptiveController();c.reset(0);c.profile='balanced';feed(c,1,33,0,4,true);expect(c.profile).toBe('eco');});
  it('reduces output workload at Eco under sustained overload',()=>{const c=new AdaptiveController();c.reset(0);feed(c,80,33,0,5,true);expect(c.workload).toBeLessThan(1);expect(c.workload).toBeGreaterThanOrEqual(.4);});
  it('does not change profiles per frame or during cooldown',()=>{const c=new AdaptiveController();c.reset(0);c.profile='quality';for(let i=0;i<20;i++)c.sample(200,16,true,i*20);expect(c.profile).toBe('quality');});
  it('avoids oscillation in the neutral hysteresis band',()=>{const c=new AdaptiveController();c.reset(0);c.profile='balanced';feed(c,14,33,0,15);expect(c.profile).toBe('balanced');});
  it('normalizes load by actual frame interval',()=>{const slow=new AdaptiveController(),fast=new AdaptiveController();slow.reset(0);fast.reset(0);feed(slow,12,100,0,8);feed(fast,12,8,0,8);expect(slow.profile).toBe('quality');expect(fast.profile).toBe('eco');});
  it('applies configured thresholds',()=>{const c=new AdaptiveController({...ADAPTIVE_DEFAULTS,promoteWindows:1,cooldownMs:0});c.reset(0);feed(c,1,40,0,1);expect(c.profile).toBe('balanced');});
  it('reports unsupported engines with an explicit functional fallback',()=>{const c=new AdaptiveController();const result=c.options({...DEFAULTS,engine:'anime4k'});expect(result.unavailable).toBe(true);expect(result.options.engine).toBe('fast');expect(c.options({...DEFAULTS,profile:'ultra',adaptive:false}).unavailable).toBe(true);});
  it('passes real manual strength to shaders',()=>{const c=new AdaptiveController();const result=c.options({...DEFAULTS,adaptive:false,automaticStrength:false,sharpness:73,denoise:38});expect(result.options.sharpness).toBe(.73);expect(result.options.denoise).toBe(.38);});
});
