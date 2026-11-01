import { describe,it,expect } from 'vitest';
import { PerformanceMonitor } from '../../src/adaptive/PerformanceMonitor';
import { describeError } from '../../src/content/VideoProcessor';
describe('honest runtime measurements',()=>{
  it('estimates source FPS from media timestamps and presented frame deltas',()=>{const m=new PerformanceMonitor();for(let i=0;i<100;i++)m.frame(i/24,i,i*42,i*42);expect(m.metrics.sourceFPS).toBeCloseTo(24,1);expect(m.metrics.processedFPS).toBe(0);});
  it('accounts for frames skipped by the processor',()=>{const m=new PerformanceMonitor();for(let i=0;i<100;i++)m.frame(i*3/60,i*3,i*50,i*50);expect(m.metrics.sourceFPS).toBeCloseTo(60,1);});
  it('keeps GPU time unavailable without timestamp queries',()=>{const m=new PerformanceMonitor();m.complete({latencyMs:5,cpuSubmitMs:1,gpuMs:null},true,100);expect(m.snapshot(200).gpuMs).toBeNull();expect(m.metrics.latencyMs).toBe(5);expect(m.metrics.cpuSubmitMs).toBe(1);});
  it('does not count discarded frames as processed output',()=>{const m=new PerformanceMonitor();for(let i=0;i<30;i++)m.complete({latencyMs:40,cpuSubmitMs:1,gpuMs:null},false,i*40);expect(m.snapshot(1200).processedFPS).toBe(0);});
  it('ages presentation FPS to zero',()=>{const m=new PerformanceMonitor();m.complete({latencyMs:2,cpuSubmitMs:1,gpuMs:null},true,50);m.complete({latencyMs:2,cpuSubmitMs:1,gpuMs:null},true,100);expect(m.snapshot(110).processedFPS).toBeGreaterThan(0);expect(m.snapshot(3000).processedFPS).toBe(0);});
  it('bounds measurement history while no popup polls statistics',()=>{const m=new PerformanceMonitor();for(let i=0;i<10000;i++)m.complete({latencyMs:2,cpuSubmitMs:1,gpuMs:null},true,i*16);expect((m as unknown as {outputs:number[]}).outputs.length).toBeLessThanOrEqual(126);});
  it('classifies restricted video access distinctly',()=>{expect(describeError(new DOMException('Tainted canvas','SecurityError')).status).toBe('Video Access Restricted');expect(describeError(new Error('shader compile failed')).status).toBe('Rendering Error');});
});
