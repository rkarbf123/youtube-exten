import { describe,it,expect } from 'vitest';
import { DEFAULTS, normalizeSettings, loadSettings, saveSettings, SETTINGS_KEY, type StorageArea } from '../../src/settings/SettingsManager';
describe('settings',()=>{
  it('provides safe defaults for absent or malformed data',()=>{expect(normalizeSettings(null)).toEqual(DEFAULTS);expect(normalizeSettings({engine:'fake',scale:'8',enabled:'true'})).toEqual(DEFAULTS);});
  it('clamps sliders and rejects NaN',()=>{const s=normalizeSettings({sharpness:Infinity,denoise:120,divider:-1});expect(s.sharpness).toBe(DEFAULTS.sharpness);expect(s.denoise).toBe(100);expect(s.divider).toBe(0);});
  it('round-trips through storage without overwriting unrelated keys',async()=>{
    const data:Record<string,unknown>={other:'preserved'};
    const storage:StorageArea={get:async key=>({[key]:data[key]}),set:async value=>{Object.assign(data,value);}};
    await saveSettings({...DEFAULTS,sharpness:64,engine:'fast',enabled:false},storage);
    expect((await loadSettings(storage)).sharpness).toBe(64);expect((await loadSettings(storage)).enabled).toBe(false);expect(data.other).toBe('preserved');expect(data[SETTINGS_KEY]).toBeDefined();
  });
  it('does not mutate shared defaults',()=>{const s=normalizeSettings({sharpness:1});s.denoise=99;expect(DEFAULTS.denoise).toBe(20);});
});
