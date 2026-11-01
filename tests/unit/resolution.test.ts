import { describe,it,expect } from 'vitest';
import { resolveDimensions } from '../../src/adaptive/Resolution';
describe('output resolution',()=>{
  it('reports actual reconstruction size and respects DPR and aspect ratio',()=>{const d=resolveDimensions({width:640,height:360},{width:960,height:600},2,'auto');expect(d.output).toEqual({width:1920,height:1080});expect(d.processing).toEqual({width:1920,height:1080});expect(d.display).toEqual({width:1920,height:1200});});
  it('caps 4x to displayed size',()=>{expect(resolveDimensions({width:1920,height:1080},{width:960,height:540},1,'4').output).toEqual({width:960,height:540});});
  it('honors manual scale when below displayed size',()=>{expect(resolveDimensions({width:320,height:180},{width:1920,height:1080},1,'1.5').output).toEqual({width:480,height:270});});
  it('caps texture dimensions and pixels',()=>{const d=resolveDimensions({width:1280,height:720},{width:10000,height:5625},2,'auto',2048,1_000_000);expect(d.output.width).toBeLessThanOrEqual(2048);expect(d.output.width*d.output.height).toBeLessThanOrEqual(1_000_000);expect(d.limited).toBe(true);});
  it('applies adaptive workload and reports actual output',()=>{const d=resolveDimensions({width:640,height:360},{width:1920,height:1080},1,'auto',8192,8_294_400,.5);expect(d.output).toEqual({width:960,height:540});expect(d.limited).toBe(true);});
  it('stays bounded when the video is hidden',()=>{const d=resolveDimensions({width:640,height:360},{width:0,height:0},1,'auto');expect(d.output.width).toBeGreaterThan(0);expect(d.output.height).toBeGreaterThan(0);});
});
