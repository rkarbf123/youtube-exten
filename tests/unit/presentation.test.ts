import { describe,it,expect } from 'vitest';
import { PresentationHistory } from '../../src/adaptive/PresentationHistory';
import { DEFAULTS,normalizeSettings } from '../../src/settings/SettingsManager';
import { AdaptiveController } from '../../src/adaptive/AdaptiveController';
describe('actual enhancement presentation history',()=>{
  it('measures original fallback time separately from GPU completion',()=>{const h=new PresentationHistory(0);h.set(true,200);h.set(false,800);expect(h.percent(1000)).toBe(60);});
  it('handles a stable retained frame without requiring per-frame toggles',()=>{const h=new PresentationHistory(0);h.set(true,100);expect(h.percent(5000)).toBe(100);h.set(false,5000);expect(h.percent(6000)).toBe(50);});
  it('does not retain an unbounded transition history',()=>{const h=new PresentationHistory(0);for(let i=0;i<10000;i++)h.set(i%2===0,i*16);expect((h as unknown as {changes:unknown[]}).changes.length).toBeLessThan(128);});
  it('migrates existing settings without falsely enabling a new engine',()=>{expect(normalizeSettings({comparison:true})).toEqual({...DEFAULTS,comparison:true});expect(normalizeSettings({contentMode:'animation',original:true}).contentMode).toBe('animation');expect(normalizeSettings({contentMode:'ai'}).contentMode).toBe('natural');});
  it('does not call a fully-original comparison enhanced',()=>{expect(new AdaptiveController().options({...DEFAULTS,comparison:true,divider:1}).options.original).toBe(true);});
});
