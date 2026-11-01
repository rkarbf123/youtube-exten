export type Profile = 'eco' | 'balanced' | 'quality' | 'ultra';
export type EngineChoice = 'auto' | 'fast' | 'balanced' | 'anime4k' | 'neural';
export type Scale = 'auto' | '1.5' | '2' | '3' | '4';
export type TargetResolution = 'original' | '720p' | '1080p' | '1440p' | '2160p';
export type TargetFPS = 'original' | '75' | '100' | '120';
export type ContentMode = 'natural' | 'animation';
export type Presentation = 'enhanced' | 'split' | 'original' | 'fallback';
export type Status = 'Disabled' | 'Initializing' | 'Active' | 'Performance Limited' | 'Video Access Restricted' | 'Unsupported GPU' | 'Engine Unavailable' | 'Rendering Error' | 'Original Video Fallback' | 'Original Comparison';
export interface Settings {
  enabled: boolean; adaptive: boolean; profile: Profile; engine: EngineChoice;
  scale: Scale; sharpness: number; denoise: number; automaticStrength: boolean;
  comparison: boolean; divider: number;
  contentMode: ContentMode; original: boolean;
  targetResolution: TargetResolution; targetFPS: TargetFPS; saturation: number; brightness: number;
}
export interface Size { width: number; height: number }
export interface Dimensions { source: Size; processing: Size; output: Size; display: Size; screen: Size | null; css: Size; limited: boolean; requested?:Size; eligible?:boolean; resolutionReason?:string; estimatedBytes?:number }
export interface TemporalStats {
  state:'off'|'warming'|'active'|'limited'|'unsupported'|'error';reason:string;engine:string;
  requestedFPS:number|null;refreshHz:number|null;physicalFPS:null;submittedFPS:number;generatedFPS:number;
  generated:number;submitted:number;uniqueSamples:number;sourceFrames:number;dropped:number;
  flowMs:number|null;interpolationMs:number|null;upscaleMs:number|null;delayMs:number;flowSize:Size|null;
  totalMs?:number|null;
  sceneCuts:number;confidence:number;queueDepth:number;
}
export const emptyTemporal=():TemporalStats=>({state:'off',reason:'프레임 보간을 사용하지 않습니다.',engine:'없음',requestedFPS:null,refreshHz:null,physicalFPS:null,submittedFPS:0,generatedFPS:0,generated:0,submitted:0,uniqueSamples:0,sourceFrames:0,dropped:0,flowMs:null,interpolationMs:null,upscaleMs:null,delayMs:0,flowSize:null,sceneCuts:0,confidence:0,queueDepth:0});
export interface Metrics {
  sourceFPS: number | null; processedFPS: number; latencyMs: number | null;
  cpuSubmitMs: number | null; gpuMs: number | null; latenessMs: number;
  missedDeadlines: number; skippedFrames: number; queueDepth: number; failures: number;
  enhancedVisiblePercent: number;
}
export interface RuntimeStats {
  status: Status; reason: string; backend: string; engine: string; profile: Profile;
  dimensions: Dimensions | null; metrics: Metrics; presented: number;
  effectiveSharpness: number; effectiveDenoise: number;
  algorithm: string; presentation: Presentation; fallback: boolean;
  upscalingActive: boolean; scaleRatio: number; frameAgeMs: number | null;
  temporal?:TemporalStats;
}
export interface RenderOptions { engine: 'fast' | 'balanced'; sharpness: number; denoise: number; comparison: boolean; divider: number; contentMode?: ContentMode; original?: boolean; saturation?:number;brightness?:number;upscale?:boolean;measureSignature?:boolean }
export interface RenderTiming { cpuSubmitMs: number; latencyMs: number; gpuMs: number | null }
export interface UpscaleEngine {
  readonly backend: string; readonly maxDimension: number;
  readonly maxPixels: number;
  render(source: HTMLVideoElement | HTMLCanvasElement, dimensions: Dimensions, options: RenderOptions): Promise<RenderTiming>;
  present(readback?:'none'|'pixel'|'full'): Promise<number>;
  destroy(): void;
}
export const emptyMetrics = (): Metrics => ({ sourceFPS: null, processedFPS: 0, latencyMs: null, cpuSubmitMs: null, gpuMs: null, latenessMs: 0, missedDeadlines: 0, skippedFrames: 0, queueDepth: 0, failures: 0, enhancedVisiblePercent: 0 });
