import type { Settings } from '../shared/types';
export const DEFAULTS: Settings = {
  enabled: true, adaptive: true, profile: 'balanced', engine: 'auto', scale: 'auto',
  sharpness: 40, denoise: 20, automaticStrength: true, comparison: false, divider: 0.5,
  contentMode: 'natural', original: false,
  targetResolution:'1080p',targetFPS:'original',saturation:100,brightness:100
};
export const SETTINGS_KEY = 'clarity.settings.v1';
export function normalizeSettings(value: unknown): Settings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const s = { ...DEFAULTS };
  for (const key of ['enabled', 'adaptive', 'automaticStrength', 'comparison', 'original'] as const) if (typeof raw[key] === 'boolean') s[key] = raw[key];
  if(raw.contentMode==='natural'||raw.contentMode==='animation')s.contentMode=raw.contentMode;
  if(['original','720p','1080p','1440p','2160p'].includes(String(raw.targetResolution)))s.targetResolution=raw.targetResolution as Settings['targetResolution'];
  else if(raw.scale==='3')s.targetResolution='1440p';else if(raw.scale==='4')s.targetResolution='2160p';
  if(['original','48','60','75','90','100','120','144'].includes(String(raw.targetFPS)))s.targetFPS=raw.targetFPS as Settings['targetFPS'];
  for(const key of ['saturation','brightness'] as const)if(typeof raw[key]==='number'&&Number.isFinite(raw[key]))s[key]=Math.round(Math.max(0,Math.min(200,raw[key]))/5)*5;
  for (const key of ['sharpness', 'denoise', 'divider'] as const) if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) s[key] = Math.max(0, Math.min(key === 'divider' ? 1 : 100, raw[key]));
  if (['eco', 'balanced', 'quality', 'ultra'].includes(String(raw.profile))) s.profile = raw.profile as Settings['profile'];
  if (['auto', 'fast', 'balanced', 'anime4k', 'neural'].includes(String(raw.engine))) s.engine = raw.engine as Settings['engine'];
  if (['auto', '1.5', '2', '3', '4'].includes(String(raw.scale))) s.scale = raw.scale as Settings['scale'];
  return s;
}
export interface StorageArea { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> }
export async function loadSettings(storage: StorageArea = chrome.storage.local): Promise<Settings> {
  return normalizeSettings((await storage.get(SETTINGS_KEY))[SETTINGS_KEY]);
}
export async function saveSettings(settings: Settings, storage: StorageArea = chrome.storage.local): Promise<void> {
  await storage.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}
