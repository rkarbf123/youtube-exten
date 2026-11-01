import {it,expect} from 'vitest';
import {sourcePolicy} from '../../src/temporal/SourcePolicy';
import {SourceCadence} from '../../src/temporal/TemporalClock';
import {normalizeSettings} from '../../src/settings/SettingsManager';
for(const fps of [23.976,24,29.97,30,59.94,60])it(`keeps timestamp classification stable at ${fps}fps with missed callbacks`,()=>{const cadence=new SourceCadence();for(let i=0;i<40;i++)cadence.add(1000/fps*(i%7===0?2:1));const native=1000/cadence.period!;expect(sourcePolicy(native,144).effective).toBe(fps<26?60:fps<33?90:144);});
it('retains old user targets while exposing a distinct effective policy',()=>{const settings=normalizeSettings({targetFPS:'120'});expect(settings.targetFPS).toBe('120');expect(sourcePolicy(23.976,120).effective).toBe(60);expect(settings.targetFPS).toBe('120');expect(sourcePolicy(29.97,75).effective).toBe(60);expect(sourcePolicy(60,48).effective).toBeNull();expect(sourcePolicy(null,144).effective).toBeNull();});
it('persists all new allowed targets and keeps the neutral color baseline',()=>{for(const targetFPS of ['48','60','90','144']){const s=normalizeSettings({targetFPS,saturation:100,brightness:100});expect(s.targetFPS).toBe(targetFPS);expect(s.saturation).toBe(100);expect(s.brightness).toBe(100);}});
