import {describe,it,expect} from 'vitest';
import {DEFAULTS,normalizeSettings} from '../../src/settings/SettingsManager';
import {resolveTargetDimensions} from '../../src/adaptive/Resolution';
describe('v1.2 settings and explicit resolution',()=>{
  it('retains native 4K with bounded three-frame interpolation resources',()=>{const source={width:3840,height:2160};const d=resolveTargetDimensions(source,{width:1280,height:720},1,'original',8192,8_294_400,1,null,true);expect(d.output).toEqual(source);expect(d.estimatedBytes).toBeLessThanOrEqual(256*1024*1024);});
  it('preserves prior controls and migrates legacy scale without enabling interpolation',()=>{const s=normalizeSettings({sharpness:63,denoise:42,engine:'balanced',scale:'4',enabled:false});expect(s.targetResolution).toBe('2160p');expect(s.targetFPS).toBe('original');expect(s.sharpness).toBe(63);expect(s.enabled).toBe(false);expect(s.saturation).toBe(100);});
  it('validates and quantizes color controls',()=>{const s=normalizeSettings({saturation:333,brightness:127,targetFPS:'999'});expect(s.saturation).toBe(200);expect(s.brightness).toBe(125);expect(s.targetFPS).toBe(DEFAULTS.targetFPS);});
  for(const [height,target,out] of [[360,'720p',720],[480,'720p',720],[720,'1080p',1080],[1080,'1440p',1440],[1440,'2160p',2160]] as const){it(`${height}p to ${target} uses requested internal size even in a small player`,()=>{const d=resolveTargetDimensions({width:Math.round(height*16/9),height},{width:400,height:225},1,target);expect(d.output.height).toBe(out);expect(d.eligible).toBe(true);});}
  for(const [height,target] of [[1080,'720p'],[1440,'1080p'],[2160,'2160p'],[720,'original']] as const){it(`${height}p with ${target} retains native detail`,()=>{const source={width:height*16/9,height};const d=resolveTargetDimensions(source,{width:400,height:225},1,target);expect(d.output).toEqual(source);expect(d.eligible).toBe(false);});}
  it('preserves 4:3 aspect',()=>{expect(resolveTargetDimensions({width:640,height:480},{width:400,height:300},1,'1080p').output).toEqual({width:1440,height:1080});});
});
