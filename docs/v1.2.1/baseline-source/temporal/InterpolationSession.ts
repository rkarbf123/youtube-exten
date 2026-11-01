import {emptyTemporal,type TemporalStats,type Settings,type RenderTiming} from '../shared/types';
import {WebGPUEngine} from '../gpu/WebGPUEngine';
import type {MotionPair} from '../gpu/MotionEstimator';
import type {FrameTicket} from '../content/FrameScheduler';
import {RefreshClock,SourceCadence,planTemporal,synchronized,type TemporalPlan,MAX_VISUAL_DELAY_MS} from './TemporalClock';
import {TemporalAdaptiveController} from '../adaptive/TemporalAdaptiveController';
export interface TemporalOutput{plan:TemporalPlan;intervalMs:number;pair:MotionPair;current:()=>boolean}
interface Hooks{
  settings:()=>Settings;observe:(m:VideoFrameCallbackMetadata,now:number)=>void;
  spatial:(ticket:FrameTicket)=>Promise<void>;output:(job:TemporalOutput)=>Promise<RenderTiming|null>;
  hide:(reason:string)=>void;fatal:(error:unknown)=>void;
}
export class InterpolationSession{
  readonly budget=new TemporalAdaptiveController();private clock=new RefreshClock();private stats:TemporalStats=emptyTemporal();
  private callback=0;private raf=0;private running=false;private busy=false;private revision=0;private pending:{frame:VideoFrame;meta:VideoFrameCallbackMetadata}|null=null;private still=false;
  private pair?:MotionPair;private nextOutput=0;private lastKey='';private lastSource=-1;private previousSource:number|null=null;private sourcePeriod=0;private disabled=false;private estimatedMs=3;
  private submissions:number[]=[];private generated:number[]=[];private signatures:{time:number;hash:string}[]=[];private sceneKey='';
  private began=performance.now();private poorSince=0;private recoveryUntil=0;
  private resetPending=false;
  private cadence=new SourceCadence();
  private resetMotion():void{if(this.busy)this.resetPending=true;else{this.engine.resetTemporal();this.resetPending=false;}}
  private finished():void{this.busy=false;this.stats.queueDepth=0;if(this.resetPending)this.resetMotion();void this.drain();}
  constructor(private video:HTMLVideoElement,private engine:WebGPUEngine,private hooks:Hooks){this.stats.state='warming';this.stats.reason='연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.';this.stats.engine='WebGPU 양방향 블록 움직임 추정';}
  start():void{if(this.running)return;this.running=true;this.requestSource();if(!this.video.paused&&!document.hidden)this.requestOutput();else this.requestStill();}
  private requestSource():void{
    if(!this.running)return;
    this.callback=this.video.requestVideoFrameCallback((now,meta)=>{
      this.callback=0;this.requestSource();if(document.hidden||this.video.seeking||meta.mediaTime===this.lastSource)return;
      this.lastSource=meta.mediaTime;this.stats.sourceFrames++;this.hooks.observe(meta,now);
      if(this.previousSource!==null&&meta.mediaTime>this.previousSource)this.sourcePeriod=(meta.mediaTime-this.previousSource)*1000/this.video.playbackRate;this.previousSource=meta.mediaTime;
      this.cadence.add(this.sourcePeriod);
      if(this.hooks.settings().adaptive&&this.sourcePeriod>0&&now-this.began>5000&&now>this.recoveryUntil){
        this.trim(now);const rate=this.submissions.length<2?0:(this.submissions.length-1)*1000/Math.max(1,now-this.submissions[0]);
        if(rate<900/(this.cadence.period??this.sourcePeriod)){if(!this.poorSince)this.poorSince=now;if(now-this.poorSince>3000){this.recoveryUntil=now+10000;this.poorSince=0;this.pair=undefined;this.resetMotion();this.limited('보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다.');}}else this.poorSince=0;
      }
      try{
        if(this.video.mediaKeys)throw new DOMException('보호된 영상은 프레임에 접근할 수 없습니다.','SecurityError');
        const frame=new VideoFrame(this.video,{timestamp:Math.round(meta.mediaTime*1e6)});
        if(this.pending){this.pending.frame.close();this.stats.dropped++;}this.pending={frame,meta};this.drain();
      }catch(error){this.hooks.fatal(error);}
    });
  }
  private limited(reason:string):void{this.stats.state='limited';this.stats.reason=reason;}
  private async drain():Promise<void>{
    if(!this.running||this.busy)return;
    if(this.still){this.still=false;this.busy=true;const revision=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&revision===this.revision});}catch(e){this.hooks.fatal(e);}finally{this.finished();}return;}
    if(!this.pending)return;const input=this.pending;this.pending=null;this.busy=true;this.stats.queueDepth=1;const revision=this.revision;
    try{
      const refresh=this.clock.hz??60;const noBenefit=this.sourcePeriod>0&&1000/this.sourcePeriod>=refresh*.98;
      if(this.disabled||performance.now()<this.recoveryUntil||(this.hooks.settings().original||this.hooks.settings().comparison)||this.sourcePeriod>MAX_VISUAL_DELAY_MS||noBenefit||this.video.paused){
        if(!this.disabled&&performance.now()>=this.recoveryUntil)this.limited((this.hooks.settings().original||this.hooks.settings().comparison)?'동일 원본 프레임 비교를 위해 보간을 생략합니다.':this.sourcePeriod>MAX_VISUAL_DELAY_MS?'한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.':noBenefit?'브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.':'일시정지 상태입니다.');
        await this.hooks.spatial({metadata:null,sourceDriven:true,current:()=>this.running&&revision===this.revision});return;
      }
      let timeout=0;
      const expiry=new Promise<never>((_resolve,reject)=>{timeout=window.setTimeout(()=>reject(new Error('움직임 추정 GPU 응답 시간 초과')),1500);});
      let pair:MotionPair;
      try{pair=await Promise.race([this.engine.captureFrame(input.frame,{width:this.video.videoWidth,height:this.video.videoHeight},input.meta.mediaTime,this.budget.config),expiry]);}finally{clearTimeout(timeout);}
      if(!this.running||revision!==this.revision)return;this.pair={...pair};this.stats.flowMs=pair.flowMs;this.stats.flowSize=pair.flowSize;this.stats.confidence=pair.confidence;
      if(pair.sceneCut&&this.sceneKey!==String(pair.b)){this.stats.sceneCuts++;this.sceneKey=String(pair.b);}
      if(!pair.ready)await this.hooks.spatial({metadata:null,sourceDriven:true,current:()=>this.running&&revision===this.revision});
    }catch(error){
      if(!this.running)return;
      if(error instanceof Error&&error.message.includes('응답 시간 초과')){this.hooks.fatal(error);return;}
      if(error instanceof DOMException&&error.name==='SecurityError'){this.hooks.fatal(error);return;}
      this.disabled=true;this.stats.state='error';this.stats.reason='프레임 보간에 실패하여 공간·색상 보정만 유지합니다: '+String(error);this.engine.releaseTemporal();this.pair=undefined;
      this.hooks.hide(this.stats.reason);
    }finally{input.frame.close();this.finished();}
  }
  private requestOutput():void{if(!this.running||this.disabled||this.video.paused||document.hidden)return;this.raf=requestAnimationFrame(time=>{this.raf=0;this.tick(time);this.requestOutput();});}
  private tick(time:number):void{
    this.clock.tick(time);this.stats.refreshHz=this.clock.hz;const settings=this.hooks.settings();const requested=Number(settings.targetFPS);this.stats.requestedFPS=requested;
    if(settings.original||settings.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden)return;
    const fps=Math.min(requested,this.clock.hz??60)*this.budget.frequency;const interval=1000/fps;
    if(time+0.1<this.nextOutput)return;this.nextOutput=Math.max(this.nextOutput+interval,time);
    if(this.busy||this.pending){this.stats.dropped++;return;}
    const pair=this.pair;const plan=planTemporal(pair.a,pair.b,this.video.currentTime,this.video.playbackRate,this.estimatedMs,pair.sceneCut,pair.dynamic);
    if(!plan){this.limited('동기화 가능한 프레임 구간을 벗어나 보간 출력을 건너뜁니다.');return;}
    const key=`${pair.b}:${plan.alpha.toFixed(5)}`;if(key===this.lastKey)return;
    this.lastKey=key;const revision=this.revision;this.busy=true;this.stats.queueDepth=1;
    const current=()=>this.running&&revision===this.revision&&!this.video.seeking&&!document.hidden&&synchronized(this.video.currentTime,plan.mediaTime,this.video.playbackRate);
    void this.hooks.output({plan,pair,intervalMs:interval,current}).then(timing=>{
      if(this.running&&revision===this.revision)this.budget.sample((timing?.latencyMs??this.estimatedMs*1.5)+pair.flowMs*Math.min(1,(1000/Math.max(1,this.sourcePeriod))/fps),interval,!timing,performance.now(),settings.adaptive);
      if(!timing||!this.running||revision!==this.revision)return;
      this.estimatedMs=this.estimatedMs*.8+timing.latencyMs*.2;
      this.stats.totalMs=timing.latencyMs;this.stats.interpolationMs=null;this.stats.upscaleMs=null;this.stats.delayMs=(this.video.currentTime-plan.mediaTime)*1000/this.video.playbackRate;
      if((this.clock.hz??60)<requested*.98)this.limited('목표 '+requested+'FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요.');
      else{this.stats.state='active';this.stats.reason='시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다.';}
    }).catch(error=>{if(this.running){this.disabled=true;this.stats.state='error';this.stats.reason='보간 출력 오류로 공간·색상 보정만 유지합니다: '+String(error);this.engine.releaseTemporal();this.pair=undefined;this.hooks.hide(this.stats.reason);}})
    .finally(()=>this.finished());
  }
  submittedFrame(generated:boolean):void{
    const now=performance.now();this.submissions.push(now);this.stats.submitted++;
    if(generated){this.generated.push(now);this.stats.generated++;}
    if(this.engine.lastSignature)this.signatures.push({time:now,hash:this.engine.lastSignature});this.trim(now);
  }
  private trim(now:number):void{while(this.submissions.length&&now-this.submissions[0]>=2000)this.submissions.shift();while(this.generated.length&&now-this.generated[0]>=2000)this.generated.shift();while(this.signatures.length&&now-this.signatures[0].time>=2000)this.signatures.shift();}
  snapshot():TemporalStats{const now=performance.now();this.trim(now);const fps=(events:number[])=>events.length<2?0:(events.length-1)*1000/Math.max(1,now-events[0]);const submittedFPS=fps(this.submissions);const slow=this.stats.state==='active'&&this.submissions.length>20&&submittedFPS<Math.min(Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return {...this.stats,...(slow?{state:'limited' as const,reason:'처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요.'}:{}),submittedFPS,generatedFPS:fps(this.generated),uniqueSamples:new Set(this.signatures.map(x=>x.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null};}
  invalidate():void{this.revision++;this.pending?.frame.close();this.pending=null;this.pair=undefined;this.previousSource=null;this.lastSource=-1;this.resetMotion();this.lastKey='';this.nextOutput=0;}
  invalidateOutput():void{this.revision++;this.lastKey='';}
  requestStill():void{this.still=true;void this.drain();}
  playbackChanged():void{this.invalidate();this.still=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.clock.reset();if(this.video.paused)this.requestStill();else this.requestOutput();}
  visibilityChanged():void{this.playbackChanged();}
  destroy():void{if(!this.running)return;this.running=false;this.revision++;this.pending?.frame.close();this.pending=null;if(this.callback)this.video.cancelVideoFrameCallback(this.callback);if(this.raf)cancelAnimationFrame(this.raf);this.callback=this.raf=0;}
}



