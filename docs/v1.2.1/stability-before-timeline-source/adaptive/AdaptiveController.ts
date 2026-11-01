import type { Profile, Settings, RenderOptions } from '../shared/types';
export const PROFILES = {
  eco: { engine: 'fast', sharpness: 0.55, denoise: 0, budget: 0.5 },
  balanced: { engine: 'balanced', sharpness: 0.8, denoise: 0.7, budget: 0.65 },
  quality: { engine: 'balanced', sharpness: 1, denoise: 1, budget: 0.8 }
} as const;
export const ADAPTIVE_DEFAULTS = { windowMs: 2200, cooldownMs: 5000, promoteWindows: 2, demoteWindows: 2, low: 0.46, high: 0.9, maxMiss: 0.15 };
export class AdaptiveController {
  profile: Exclude<Profile, 'ultra'> = 'eco';
  workload = 1;
  ema = 0;
  private start = 0; private lastChange = -Infinity; private count = 0; private misses = 0; private good = 0; private bad = 0;private warmup=0;
  constructor(private config = ADAPTIVE_DEFAULTS) {}
  reset(now = performance.now()): void { this.profile = 'eco'; this.workload = 1; this.ema = 0; this.start = now; this.lastChange = -Infinity; this.count = this.misses = this.good = this.bad = this.warmup = 0; }
  sample(latencyMs: number, intervalMs: number, missed: boolean, now: number): boolean {
    // Initial driver compilation/allocation is not representative steady-state load.
    // Playback deadlines are still enforced independently during these six samples.
    if(this.warmup++<6)return false;
    const load = latencyMs / Math.max(4, intervalMs * PROFILES[this.profile].budget);
    this.ema = this.count === 0 && this.ema === 0 ? load : 0.12 * load + 0.88 * this.ema;
    this.count++; if (missed) this.misses++;
    if (now - this.start < this.config.windowMs || this.count < 12) return false;
    const miss = this.misses / this.count;
    this.bad = this.ema > this.config.high || miss > this.config.maxMiss ? this.bad + 1 : 0;
    this.good = this.ema < this.config.low && miss < 0.03 ? this.good + 1 : 0;
    this.start = now; this.count = this.misses = 0;
    if (now - this.lastChange < this.config.cooldownMs) return false;
    const levels = ['eco', 'balanced', 'quality'] as const;
    let index = levels.indexOf(this.profile); let changed = false;
    if (this.bad >= this.config.demoteWindows) {
      if (index > 0) this.profile = levels[--index];
      else this.workload = Math.max(0.4, this.workload * 0.8);
      changed = true;
    } else if (this.good >= this.config.promoteWindows) {
      if (this.workload < 1) { this.workload = Math.min(1, this.workload / 0.8); changed = true; }
      else if (index < levels.length - 1) { this.profile = levels[++index]; changed = true; }
    }
    if (changed) { this.lastChange = now; this.bad = this.good = 0; }
    return changed;
  }
  options(settings: Settings): { profile: Exclude<Profile, 'ultra'>; options: RenderOptions; unavailable: boolean } {
    const unavailable = settings.profile === 'ultra' || settings.engine === 'anime4k' || settings.engine === 'neural';
    const profile = settings.adaptive ? this.profile : settings.profile === 'ultra' ? 'quality' : settings.profile;
    const p = PROFILES[profile];
    return { profile, unavailable, options: {
      engine: settings.engine === 'fast' || settings.engine === 'balanced' ? settings.engine : p.engine,
      sharpness: settings.sharpness / 100 * (settings.automaticStrength ? p.sharpness : 1),
      denoise: settings.denoise / 100 * (settings.automaticStrength ? p.denoise : 1),
      comparison: settings.comparison, divider: settings.divider,
      contentMode: settings.contentMode, original: settings.original||(settings.comparison&&settings.divider>=1),saturation:settings.saturation,brightness:settings.brightness
    } };
  }
}
