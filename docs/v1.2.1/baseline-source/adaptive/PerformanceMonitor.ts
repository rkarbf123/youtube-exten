import { emptyMetrics, type Metrics, type RenderTiming } from '../shared/types';
export class PerformanceMonitor {
  metrics: Metrics = emptyMetrics();
  intervalMs = 1000 / 30;
  private previousMedia: number | null = null; private previousFrames = 0;
  private outputs: number[] = [];
  frame(mediaTime: number, presentedFrames: number, now: number, expected: number): void {
    if (this.previousMedia !== null) {
      const delta = mediaTime - this.previousMedia, frames = presentedFrames - this.previousFrames;
      if (delta > 0 && delta < 1 && frames > 0 && frames < 120) {
        const interval = delta * 1000 / frames;
        if (interval >= 4 && interval <= 500) this.intervalMs = this.intervalMs * 0.85 + interval * 0.15;
        this.metrics.sourceFPS = 1000 / this.intervalMs;
      }
    }
    this.previousMedia = mediaTime; this.previousFrames = presentedFrames;
    this.metrics.latenessMs = Math.max(0, now - expected);
  }
  discontinuity(): void { this.previousMedia = null; this.previousFrames = 0; this.outputs = []; this.metrics.sourceFPS = null; }
  complete(timing: RenderTiming, displayed: boolean, now: number): void {
    const average = (old: number | null, sample: number) => old === null ? sample : 0.15 * sample + 0.85 * old;
    this.metrics.latencyMs = average(this.metrics.latencyMs, timing.latencyMs);
    this.metrics.cpuSubmitMs = average(this.metrics.cpuSubmitMs, timing.cpuSubmitMs);
    this.metrics.gpuMs = timing.gpuMs === null ? null : average(this.metrics.gpuMs, timing.gpuMs);
    if (displayed) {
      this.outputs.push(now);
      // Bound history even when the popup is closed and nobody requests snapshots.
      while(this.outputs.length>0&&now-this.outputs[0]>=2000)this.outputs.shift();
    }
  }
  snapshot(now = performance.now()): Metrics {
    this.outputs = this.outputs.filter(t => now - t < 2000);
    this.metrics.processedFPS = this.outputs.length < 2 ? 0 : (this.outputs.length - 1) * 1000 / Math.max(1, now - this.outputs[0]);
    return { ...this.metrics };
  }
}
