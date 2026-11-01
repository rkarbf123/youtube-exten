import './styles.css';
import {DEFAULTS,loadSettings,saveSettings} from '../settings/SettingsManager';
import {statusKo,errorKo,profileKo,engineKo} from '../shared/localize';
import {emptyTemporal,type RuntimeStats,type Settings,type Size} from '../shared/types';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let settings:Settings={...DEFAULTS},tabId:number|undefined,timer=0,writeTimer=0,writing=Promise.resolve();
function drawSettings():void{
  for(const key of ['enabled','adaptive','automaticStrength','comparison','original'] as const)el<HTMLInputElement>(key).checked=settings[key];
  for(const key of ['profile','engine','contentMode'] as const)el<HTMLSelectElement>(key).value=settings[key];
  el<HTMLInputElement>('comparison').disabled=settings.original;el<HTMLSelectElement>('contentMode').disabled=settings.engine==='fast';el<HTMLSelectElement>('profile').disabled=settings.adaptive;
  for(const key of ['sharpness','denoise','saturation','brightness'] as const){el<HTMLInputElement>(key).value=String(settings[key]);el(key+'-value').textContent=settings[key]+'%';}
  el('sharp-auto').hidden=el('denoise-auto').hidden=!settings.automaticStrength;
  el<HTMLInputElement>('denoise').disabled=settings.engine==='fast';
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-resolution]'))button.setAttribute('aria-pressed',String(button.dataset.resolution===settings.targetResolution));
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-fps]'))button.setAttribute('aria-pressed',String(button.dataset.fps===settings.targetFPS));
}
function commit():void{drawSettings();clearTimeout(writeTimer);writeTimer=window.setTimeout(()=>{writeTimer=0;const next={...settings};writing=writing.then(()=>saveSettings(next)).catch(()=>{el('reason').textContent='설정을 저장하지 못했습니다.';});},80);}
const size=(s:Size|null|undefined)=>s?Math.round(s.width)+' × '+Math.round(s.height):'측정 대기';
const number=(n:number|null|undefined,unit='')=>n==null?'측정 불가':(n.toFixed(1)+' '+unit).trim();
function display(stats:RuntimeStats):void{
  el('status').textContent=statusKo[stats.status];el('reason').textContent=errorKo(stats.reason);
  el('status-dot').className='dot '+(stats.status==='Active'&&!stats.fallback?'active':stats.fallback?'warning':'');el('backend').textContent=stats.backend;
  const t=stats.temporal??emptyTemporal(),m=stats.metrics,d=stats.dimensions;
  const rows:Record<string,string>={
    '화면 표시':stats.upscalingActive?'업스케일링 작동 중':stats.fallback?'원본 재생 중':stats.presentation==='original'?'원본 비교 중':'원본 해상도 보정 중',
    '원본 대체 출력':stats.fallback?'예':'아니요','알고리즘':stats.algorithm,'원본 해상도':size(d?.source),'선택 목표 해상도':size(d?.requested),'처리 해상도':size(d?.processing),'출력 텍스처':size(d?.output),'플레이어 표시 픽셀':size(d?.display),'해상도 적용 사유':d?.resolutionReason??'측정 대기',
    '원본 / 처리 FPS':number(m.sourceFPS)+' / '+number(m.processedFPS),'평균 완료 시간':number(m.latencyMs,'ms'),'CPU 제출 시간':number(m.cpuSubmitMs,'ms'),'GPU 타임스탬프':number(m.gpuMs,'ms'),'화질 / 재구성':profileKo[stats.profile]+' / '+engineKo(stats.engine),'보정 표시 시간 (최근 2초)':m.enhancedVisiblePercent.toFixed(1)+'%','기한 초과 / 생략':(m.missedDeadlines+(t.deadlineMisses??0))+' / '+(m.skippedFrames+t.dropped),'처리 대기 / 오류':m.queueDepth+' / '+m.failures,
    '보간 상태':({off:'사용 안 함',warming:'준비 중',active:'출력 중',limited:'제한됨',unsupported:'미지원',error:'오류'})[t.state],'보간 사유':t.reason,'보간 엔진':t.engine,'선택 목표 FPS':t.requestedFPS===null?'원본':String(t.requestedFPS),'실제 적용 상한 FPS':t.effectiveFPS==null?(t.nativeFPS==null?'원본 / 확인 중':'원본 FPS ('+number(t.nativeFPS)+')'):number(t.effectiveFPS),'원본 분류 FPS':number(t.nativeFPS),'FPS 적용 사유':t.effectiveFPS==null?t.reason:(t.policyReason??t.reason),'보간 보호 전환':String(t.recoveries??0),'Canvas 표시 / 숨김':(stats.canvasTransitions?.shows??0)+' / '+(stats.canvasTransitions?.hides??0),'GPU 복구 횟수':String(stats.recoveries??0),'브라우저 갱신률 추정':number(t.refreshHz,'Hz'),'Canvas 제출 FPS':number(t.submittedFPS),'중간 프레임 제출 FPS':number(t.generatedFPS),'제출 / 중간 프레임 누적':t.submitted+' / '+t.generated,'고유 출력 표본 (2초)':t.signatureSampled===false?'진단 모드에서만 측정':t.uniqueSamples+'개 · 프레임당 256픽셀 서명','물리 화면 표시 FPS':'측정 불가','움직임 추정 크기':size(t.flowSize),'움직임 추정 완료 시간':number(t.flowMs,'ms'),'보간·재구성 전체 시간':number(t.totalMs,'ms'),'보간 / 확대 개별 GPU 시간':'측정 불가 · 통합 작업','마지막 제출 시 시간차':number(t.delayMs,'ms'),'원본 표시 대비 추가 지연':number(t.additionalDelayMs,'ms'),'전체 시간차 보호 한도':number(t.totalDelayLimitMs,'ms'),'장면 전환 / 보간 생략':t.sceneCuts+' / '+t.dropped
  };
  el('metrics').replaceChildren(...Object.entries(rows).map(([label,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;}));
  el('strength-note').textContent='실제 선명도 '+stats.effectiveSharpness.toFixed(0)+'%, 노이즈 감소 '+stats.effectiveDenoise.toFixed(0)+'%. 노이즈 감소와 영상 종류별 재구성은 균형 방식에서 적용됩니다.';
}
async function poll():Promise<void>{try{if(tabId===undefined)throw Error();const stats=await chrome.tabs.sendMessage(tabId,{type:'clarity:stats'}) as RuntimeStats;if(!stats?.metrics)throw Error();display(stats);}catch{el('status').textContent=settings.enabled?'원본 재생 · 연결 대기':'사용 안 함';el('reason').textContent='유튜브 영상을 열어 주세요. 확장 프로그램 설치·업데이트 후에는 유튜브 탭을 새로고침하세요.';el('status-dot').className='dot';el('metrics').replaceChildren();}}
async function main():Promise<void>{
  settings=await loadSettings();drawSettings();const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id;
  for(const key of ['enabled','adaptive','automaticStrength','comparison','original'] as const)el<HTMLInputElement>(key).addEventListener('change',()=>{settings[key]=el<HTMLInputElement>(key).checked;commit();});
  for(const key of ['profile','engine','contentMode'] as const)el<HTMLSelectElement>(key).addEventListener('change',()=>{settings={...settings,[key]:el<HTMLSelectElement>(key).value};commit();});
  for(const key of ['sharpness','denoise','saturation','brightness'] as const)el<HTMLInputElement>(key).addEventListener('input',()=>{settings[key]=Number(el<HTMLInputElement>(key).value);commit();});
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-resolution]'))button.addEventListener('click',()=>{settings.targetResolution=button.dataset.resolution as Settings['targetResolution'];commit();});
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-fps]'))button.addEventListener('click',()=>{settings.targetFPS=button.dataset.fps as Settings['targetFPS'];commit();});
  el('reset-color').addEventListener('click',()=>{settings.saturation=settings.brightness=100;commit();});el('reset').addEventListener('click',()=>{settings={...DEFAULTS};commit();});await poll();timer=window.setInterval(()=>{void poll();},1000);
}
window.addEventListener('pagehide',()=>{clearInterval(timer);if(writeTimer){clearTimeout(writeTimer);void writing.then(()=>saveSettings(settings));}});
void main().catch(()=>{el('status').textContent='설정 불러오기 실패';el('reason').textContent='확장 프로그램을 다시 로드해 주세요.';});



