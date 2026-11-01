import './styles.css';
import { DEFAULTS } from '../settings/SettingsManager';
import type { Settings } from '../shared/types';
import { VideoProcessor } from '../content/VideoProcessor';
import { runPixelChecks } from './pixelChecks';
import { runQualityReview,compareCapturedFrame } from './qualityReview';
import {runPipelineCombinations,runMotionMatrix,runV11Benchmark,runMotionChecks,runColorChecks,runResolutionChecks} from './v12Checks';
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const video=element<HTMLVideoElement>('video');
let settings:Settings={...DEFAULTS,adaptive:false,automaticStrength:false,comparison:true};let processor:VideoProcessor|undefined;let url='';
function start():void{processor?.destroy();processor=undefined;if(settings.enabled){const backend=element<HTMLSelectElement>('backend').value;processor=new VideoProcessor(video,settings,undefined,backend==='auto'?undefined:backend as 'webgpu'|'webgl2');void processor.start();}}
async function sample():Promise<void>{
  element('notice').textContent='로컬 진단 영상 생성 중 · 3초';
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d')!;const stream=canvas.captureStream(24);
  const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:500_000});const parts:Blob[]=[];
  recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};
  const ready=new Promise<Blob>(resolve=>{recorder.onstop=()=>resolve(new Blob(parts,{type:recorder.mimeType}));});
  recorder.start();let frame=0;
  const timer=window.setInterval(()=>{
    const g=ctx.createLinearGradient(0,0,320,180);g.addColorStop(0,'#122b3e');g.addColorStop(1,'#c9dec7');ctx.fillStyle=g;ctx.fillRect(0,0,320,180);
    ctx.strokeStyle='#eef4df';ctx.lineWidth=1;
    for(let n=0;n<18;n++){ctx.beginPath();ctx.moveTo(n*13+frame%12,35);ctx.lineTo(n*13+55,145);ctx.stroke();}
    ctx.fillStyle='#121d26';ctx.fillRect(10,8,300,23);ctx.fillStyle='#e5edeb';ctx.font='13px monospace';ctx.fillText(`CLARITY 320×180 · frame ${String(frame).padStart(3,'0')}`,16,24);
    for(let y=145;y<175;y++)for(let x=15;x<130;x++){const v=90+(x*13+y*7+frame*3)%23;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);}
    ctx.fillStyle='#f1b36e';ctx.beginPath();ctx.arc(200+Math.sin(frame/12)*60,113,18,0,Math.PI*2);ctx.fill();frame++;
  },1000/24);
  await new Promise(resolve=>setTimeout(resolve,3000));clearInterval(timer);recorder.stop();const blob=await ready;stream.getTracks().forEach(t=>t.stop());
  load(URL.createObjectURL(blob));element('notice').textContent='로컬 320 × 180 진단 WebM 생성 완료. 실제 HTML 영상 플레이어가 디코딩합니다.';
}
const motionClips=new Map<number,Blob>();
async function motionSample(fps:number):Promise<void>{
  processor?.destroy();processor=undefined;video.pause();
  let blob=motionClips.get(fps);
  if(!blob){
    const c=Object.assign(document.createElement('canvas'),{width:256,height:144}),ctx=c.getContext('2d')!,stream=c.captureStream(0),track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2_000_000}),parts:Blob[]=[];
    recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};const done=new Promise<Blob>(resolve=>{recorder.onstop=()=>resolve(new Blob(parts,{type:recorder.mimeType}));});recorder.start();
    const began=performance.now();
    for(let i=0;i<fps*2;i++){
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,began+i*1000/fps-performance.now())));
      ctx.fillStyle='#101010';ctx.fillRect(0,0,256,144);const x=24+i*80/(fps*2);ctx.fillStyle='#eeeeee';ctx.fillRect(x,48,48,48);ctx.fillStyle='#4080c0';ctx.fillRect(x+8,56,16,16);ctx.fillStyle='#80c040';ctx.fillRect(x+28,76,12,12);track.requestFrame();
    }
    await new Promise(resolve=>setTimeout(resolve,1000/fps));recorder.stop();blob=await done;stream.getTracks().forEach(t=>t.stop());motionClips.set(fps,blob);
  }
  load(URL.createObjectURL(blob));await video.play();
}
function load(next:string):void{if(url)URL.revokeObjectURL(url);url=next;video.src=url;start();void video.play().catch(error=>{element('notice').textContent=String(error);});}
element('sample').addEventListener('click',()=>{element<HTMLButtonElement>('sample').disabled=true;void sample().catch(error=>{element('notice').textContent=String(error);}).finally(()=>{element<HTMLButtonElement>('sample').disabled=false;});});
element('packaged').addEventListener('click',()=>{load(new URL('../diagnostic.webm',location.href).href);element('notice').textContent='포함된 로컬 320 × 180 진단 영상을 재생합니다.';});
element('backend').addEventListener('change',start);
element<HTMLInputElement>('file').addEventListener('change',event=>{const file=(event.target as HTMLInputElement).files?.[0];if(file)load(URL.createObjectURL(file));});
element('toggle').addEventListener('click',()=>{settings.enabled=!settings.enabled;element('toggle').textContent=settings.enabled?'보정 끄기':'보정 켜기';start();});
element<HTMLSelectElement>('engine').addEventListener('change',()=>{settings.engine=element<HTMLSelectElement>('engine').value as Settings['engine'];processor?.update(settings);});
element<HTMLSelectElement>('contentMode').addEventListener('change',()=>{settings.contentMode=element<HTMLSelectElement>('contentMode').value as Settings['contentMode'];processor?.update(settings);});
element<HTMLInputElement>('original').addEventListener('change',()=>{settings.original=element<HTMLInputElement>('original').checked;processor?.update(settings);});
for(const key of ['targetResolution','targetFPS'] as const)element<HTMLSelectElement>(key).addEventListener('change',()=>{settings={...settings,[key]:element<HTMLSelectElement>(key).value};processor?.update(settings);});
for(const key of ['saturation','brightness'] as const)element<HTMLInputElement>(key).addEventListener('input',()=>{settings[key]=Number(element<HTMLInputElement>(key).value);element(key+'-value').textContent=settings[key]+'%';processor?.update(settings);});
for(const [id,key] of [['sharp','sharpness'],['noise','denoise']] as const)element<HTMLInputElement>(id).addEventListener('input',()=>{settings[key]=Number(element<HTMLInputElement>(id).value);element(id==='sharp'?'sharp-value':'noise-value').textContent=String(settings[key]);processor?.update(settings);});
element<HTMLInputElement>('compare').addEventListener('change',()=>{settings.comparison=element<HTMLInputElement>('compare').checked;processor?.update(settings);});
element('validate').addEventListener('click',()=>{
  const force=element<HTMLSelectElement>('backend').value as 'auto'|'webgpu'|'webgl2';element('pixel-results').textContent='셰이더 컴파일 및 픽셀 확인 중…';
  void runPixelChecks(force==='auto'?undefined:force).then(result=>{element('pixel-results').textContent=`${result.backend}\n`+result.checks.map(check=>`${check.passed?'PASS':'FAIL'} ${check.name}\n${check.detail}`).join('\n');}).catch(error=>{element('pixel-results').textContent=String(error);});
});
element('quality-review').addEventListener('click',()=>{
  const backend=element<HTMLSelectElement>('backend').value;processor?.destroy();processor=undefined;
  element('quality-results').textContent='동일 조건 비교 중 · 재생 보정 일시 중지';
  void runQualityReview(backend==='webgl2'?'webgl2':'webgpu').then(report=>{element('quality-results').textContent=JSON.stringify({...report,cases:report.cases.map(({images:_,...rest})=>rest)},null,2);}).catch(error=>{element('quality-results').textContent=String(error);});
});
const timer=window.setInterval(()=>{element('stats').textContent=processor?JSON.stringify(processor.stats(),null,2):'보정 사용 안 함';},1000);
window.addEventListener('pagehide',()=>{clearInterval(timer);processor?.destroy();if(url)URL.revokeObjectURL(url);});
declare global{interface Window{clarityHarness:{runPipelineCombinations:typeof runPipelineCombinations;runPixelChecks:typeof runPixelChecks;runQualityReview:typeof runQualityReview;compareCapturedFrame:typeof compareCapturedFrame;runMotionMatrix:typeof runMotionMatrix;runV11Benchmark:typeof runV11Benchmark;runMotionChecks:typeof runMotionChecks;runColorChecks:typeof runColorChecks;runResolutionChecks:typeof runResolutionChecks;motionSample:typeof motionSample;sample:typeof sample;stats:()=>ReturnType<VideoProcessor['stats']>|null;destroy:()=>void;settings:(patch:Partial<Settings>)=>void}}}
window.clarityHarness={runPipelineCombinations,runMotionMatrix,runV11Benchmark,runPixelChecks,runQualityReview,compareCapturedFrame,runMotionChecks,runColorChecks,runResolutionChecks,motionSample,sample,stats:()=>processor?.stats()??null,destroy:()=>{processor?.destroy();processor=undefined;},settings:patch=>{settings={...settings,...patch};processor?.update(settings);}};


