import type { Dimensions, Scale, Size,TargetResolution } from '../shared/types';
export const RESOLUTION_RULES={ '720p':{height:720,maxSource:480},'1080p':{height:1080,maxSource:720},'1440p':{height:1440,maxSource:1080},'2160p':{height:2160,maxSource:1440} } as const;
export function resolveTargetDimensions(source:Size,css:Size,dpr:number,target:TargetResolution,maxDimension=8192,maxPixels=8_294_400,workload=1,screen:Size|null=null,interpolation=false,decodedHeight=source.height):Dimensions{
  const rule=target==='original'?null:RESOLUTION_RULES[target];
  const eligible=!!rule&&decodedHeight<=rule.maxSource&&source.height<rule.height;
  const requested=eligible?{width:Math.round(source.width*rule!.height/source.height),height:rule!.height}:{...source};
  const sourceBytes=source.width*source.height*(interpolation?20:8);
  const budget=(interpolation?256:224)*1024*1024;
  const available=Math.max(0,(budget-sourceBytes-(interpolation?4*1024*1024:0))/8);
  const desiredFactor=eligible?Math.max(source.width/requested.width,workload):1;
  const factor=Math.min(desiredFactor,maxDimension/requested.width,maxDimension/requested.height,Math.sqrt(Math.min(maxPixels,available)/(requested.width*requested.height)));
  // Never silently downsample an ineligible/native source and then call it upscale.
  if(!eligible&&factor<.999)throw new Error('원본 해상도가 GPU 텍스처 또는 메모리 한도를 초과하여 원본 플레이어로 복귀합니다.');
  const output={width:Math.max(1,Math.floor(requested.width*factor)),height:Math.max(1,Math.floor(requested.height*factor))};
  return {source:{...source},processing:{...output},output,requested,display:{width:Math.round(css.width*dpr),height:Math.round(css.height*dpr)},css,screen,eligible,limited:factor<.98,estimatedBytes:sourceBytes+output.width*output.height*8+(interpolation?4*1024*1024:0),resolutionReason:target==='original'?'원본 해상도: 업스케일링을 생략합니다.':!eligible?'현재 원본에는 선택한 업스케일링 조건이 적용되지 않습니다.':factor<.98?'GPU 성능·메모리 한도로 실제 처리 해상도를 낮췄습니다.':'선택한 목표 해상도로 GPU 재구성합니다.'};
}
export function resolveDimensions(source: Size, css: Size, dpr: number, scale: Scale, maxDimension = 8192, maxPixels = 8_294_400, workload = 1, screen: Size | null = null): Dimensions {
  const sw = Math.max(1, source.width), sh = Math.max(1, source.height);
  const display = { width: Math.max(1, Math.round(css.width * dpr)), height: Math.max(1, Math.round(css.height * dpr)) };
  const fit = Math.min(display.width / sw, display.height / sh);
  const requested = scale === 'auto' ? fit : Math.min(fit, Number(scale));
  let factor = Math.max(0.01, requested) * workload;
  // Two source textures, reconstructed texture and presentation buffer. 160 MiB cap.
  const memoryPixels = Math.max(1, (160 * 1024 * 1024 - sw * sh * 8) / 8);
  factor = Math.min(factor, maxDimension / sw, maxDimension / sh, Math.sqrt(Math.min(maxPixels, memoryPixels) / (sw * sh)));
  const output = { width: Math.max(1, Math.floor(sw * factor)), height: Math.max(1, Math.floor(sh * factor)) };
  return { source: { width: sw, height: sh }, processing: { ...output }, output, display, screen, css, limited: factor < requested * 0.98 };
}

