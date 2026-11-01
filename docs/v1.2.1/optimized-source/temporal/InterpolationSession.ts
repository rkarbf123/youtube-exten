import {PresentationClock,OutputPacer,selectTemporalPair} from './PresentationClock';
import {temporalPerf} from './TemporalProfiler';
import {emptyTemporal,type TemporalStats,type Settings,type RenderTiming} from '../shared/types';
import {WebGPUEngine} from '../gpu/WebGPUEngine';
import type {MotionPair} from '../gpu/MotionEstimator';
import type {FrameTicket} from '../content/FrameScheduler';
import {RefreshClock,SourceCadence,type TemporalPlan,MAX_VISUAL_DELAY_MS} from './TemporalClock';
import {TemporalAdaptiveController} from '../adaptive/TemporalAdaptiveController';
export interface TemporalOutput{plan:TemporalPlan;intervalMs:number;pair:MotionPair;current:()=>boolean}
interface Hooks{
  settings:()=>Settings;observe:(m:VideoFrameCallbackMetadata,now:number)=>void;
  spatial:(ticket:FrameTicket)=>Promise<void>;output:(job:TemporalOutput)=>Promise<RenderTiming|null>;
  hide:(reason:string)=>void;fatal:(error:unknown)=>void;
}
export class InterpolationSession{
  readonly budget=new TemporalAdaptiveController();private clock=new RefreshClock();private stats:TemporalStats=emptyTemporal();
  private lastRaf=0;private lastRvfc=0;private busyStarted=0;private callback=0;private raf=0;private running=false;private busy=false;private revision=0;private pending:{frame:VideoFrame;meta:VideoFrameCallbackMetadata}|null=null;private still=false;
  private pair?:MotionPair;private lastKey='';private lastSource=-1;private previousSource:number|null=null;private sourcePeriod=0;private disabled=false;private estimatedMs=3;
  private submissions:number[]=[];private generated:number[]=[];private signatures:{time:number;hash:string}[]=[];private sceneKey='';
  private began=performance.now();private poorSince=0;private recoveryUntil=0;
  private resetPending=false;
  private submittedAt=0;private outputIntervalMs=1000/60;
  private cadence=new SourceCadence();private presentation=new PresentationClock();private pacer=new OutputPacer();
  expired(mediaTime:number):boolean{const now=performance.now(),hold=this.outputIntervalMs+1000/(this.clock.hz??60)+1;return !this.presentation.ready||now-this.submittedAt>hold||(this.presentation.mediaAt(now)-mediaTime)*1000/this.video.playbackRate>MAX_VISUAL_DELAY_MS+hold;}
  private resetMotion():void{if(this.busy)this.resetPending=true;else{this.engine.resetTemporal();this.resetPending=false;}}
  private finished():void{temporalPerf.elapsed('serialBusyMs',this.busyStarted);this.busy=false;this.stats.queueDepth=0;if(this.resetPending)this.resetMotion();void this.drain();}
  constructor(private video:HTMLVideoElement,private engine:WebGPUEngine,private hooks:Hooks){this.stats.state='warming';this.stats.reason='연속된 원본 프레임 두 개와 화면 갱신 주기를 확인하고 있습니다.';this.stats.engine='WebGPU 양방향 블록 움직임 추정';}
  start():void{if(this.running)return;this.engine.onStreamAvailable=()=>this.drain();this.running=true;this.requestSource();if(!this.video.paused&&!document.hidden)this.requestOutput();else this.requestStill();}
  private requestSource():void{
    if(!this.running)return;
    this.callback=this.video.requestVideoFrameCallback((now,meta)=>{
      if(this.lastRvfc)temporalPerf.sample('rvfcIntervalMs',now-this.lastRvfc);this.lastRvfc=now;temporalPerf.count('rvfcCallbacks');this.callback=0;this.requestSource();if(document.hidden||this.video.seeking||meta.mediaTime===this.lastSource)return;
      if(this.presentation.observe(meta.mediaTime,meta.expectedDisplayTime,this.video.playbackRate)){this.invalidate();this.presentation.observe(meta.mediaTime,meta.expectedDisplayTime,this.video.playbackRate);}
      this.lastSource=meta.mediaTime;this.stats.sourceFrames++;this.hooks.observe(meta,now);
      if(this.previousSource!==null&&meta.mediaTime>this.previousSource)this.sourcePeriod=(meta.mediaTime-this.previousSource)*1000/this.video.playbackRate;this.previousSource=meta.mediaTime;
      this.cadence.add(this.sourcePeriod);
      if(this.hooks.settings().adaptive&&this.sourcePeriod>0&&now-this.began>5000&&now>this.recoveryUntil){
        this.trim(now);const rate=this.submissions.length<2?0:(this.submissions.length-1)*1000/Math.max(1,now-this.submissions[0]);
        if(rate<900/(this.cadence.period??this.sourcePeriod)){if(!this.poorSince)this.poorSince=now;if(now-this.poorSince>3000){this.recoveryUntil=now+10000;this.poorSince=0;this.pair=undefined;this.resetMotion();this.limited('보간 출력이 원본 FPS보다 느려 10초간 원본 FPS의 공간·색상 보정으로 복구합니다.');}}else this.poorSince=0;
      }
      try{
        if(this.video.mediaKeys)throw new DOMException('보호된 영상은 프레임에 접근할 수 없습니다.','SecurityError');
        const acquired=temporalPerf.mark();const frame=new VideoFrame(this.video,{timestamp:Math.round(meta.mediaTime*1e6)});
        temporalPerf.elapsed('videoFrameAcquireCpuMs',acquired);if(this.pending){temporalPerf.count('discard.sourceReplaced');this.pending.frame.close();this.stats.dropped++;}this.pending={frame,meta};this.drain();
      }catch(error){this.hooks.fatal(error);}
    });
  }
  private limited(reason:string):void{this.stats.state='limited';this.stats.reason=reason;}
  private async drain():Promise<void>{
    if(!this.running||this.busy)return;
    if(!this.engine.canCapture({width:this.video.videoWidth,height:this.video.videoHeight},this.budget.config))return;
    if(this.still){this.still=false;this.busy=true;this.busyStarted=temporalPerf.mark();const revision=this.revision;try{await this.hooks.spatial({metadata:null,current:()=>this.running&&revision===this.revision});}catch(e){this.hooks.fatal(e);}finally{this.finished();}return;}
    if(!this.pending)return;const input=this.pending;this.pending=null;this.busy=true;this.busyStarted=temporalPerf.mark();this.stats.queueDepth=1;const revision=this.revision;
    try{
      const refresh=this.clock.hz??60,period=this.cadence.period??this.sourcePeriod;const noBenefit=period>0&&1000/period>=refresh*.98;
      if(this.disabled||performance.now()<this.recoveryUntil||(this.hooks.settings().original||this.hooks.settings().comparison)||period>MAX_VISUAL_DELAY_MS||noBenefit||this.video.paused){
        if(!this.disabled&&performance.now()>=this.recoveryUntil)this.limited((this.hooks.settings().original||this.hooks.settings().comparison)?'동일 원본 프레임 비교를 위해 보간을 생략합니다.':period>MAX_VISUAL_DELAY_MS?'한 프레임의 대기가 45ms를 초과하여 보간 대신 원본 FPS 보정을 유지합니다.':noBenefit?'브라우저 갱신률이 원본 FPS 이하이므로 불필요한 보간을 생략합니다.':'일시정지 상태입니다.');
        await this.hooks.spatial({metadata:null,sourceDriven:true,current:()=>this.running&&revision===this.revision});return;
      }
      let timeout=0;
      const expiry=new Promise<never>((_resolve,reject)=>{timeout=window.setTimeout(()=>reject(new Error('움직임 추정 GPU 응답 시간 초과')),1500);});
      let pair:MotionPair;
      try{pair=await Promise.race([this.engine.enqueueFrame(input.frame,{width:input.frame.displayWidth,height:input.frame.displayHeight},input.meta.mediaTime,this.budget.config),expiry]);}finally{clearTimeout(timeout);}
      if(!this.running||revision!==this.revision)return;this.pair={...pair};this.stats.flowMs=pair.flowMs;this.stats.flowSize=pair.flowSize;this.stats.confidence=pair.confidence;
      void pair.analysis?.then(analysis=>{if(!this.running||revision!==this.revision)return;if(analysis.sceneCut&&this.sceneKey!==String(pair.id)){this.sceneKey=String(pair.id);this.stats.sceneCuts++;temporalPerf.count('sceneCuts');}if(this.pair?.b===pair.b){Object.assign(this.pair,analysis,{flowMs:pair.flowMs});this.stats.flowMs=pair.flowMs;this.stats.confidence=analysis.confidence;}});
      if(pair.sceneCut&&this.sceneKey!==String(pair.b)){temporalPerf.count('sceneCuts');this.stats.sceneCuts++;this.sceneKey=String(pair.b);}
      if(!pair.ready)await this.hooks.spatial({metadata:null,sourceDriven:true,current:()=>this.running&&revision===this.revision});
    }catch(error){
      if(!this.running)return;
      if(error instanceof Error&&error.message.includes('응답 시간 초과')){this.hooks.fatal(error);return;}
      temporalPerf.count('discard.gpuError');if(error instanceof DOMException&&error.name==='SecurityError'){this.hooks.fatal(error);return;}
      this.disabled=true;this.stats.state='error';this.stats.reason='프레임 보간에 실패하여 공간·색상 보정만 유지합니다: '+String(error);this.engine.releaseTemporal();this.pair=undefined;
      this.hooks.hide(this.stats.reason);
    }finally{input.frame.close();this.finished();}
  }
  private requestOutput():void{if(!this.running||this.disabled||this.video.paused||document.hidden)return;this.raf=requestAnimationFrame(time=>{this.raf=0;this.tick(time);this.requestOutput();});}
  private tick(time:number):void{
    if(this.lastRaf)temporalPerf.sample('rafIntervalMs',time-this.lastRaf);this.lastRaf=time;temporalPerf.count('rafCallbacks');this.clock.tick(time);this.stats.refreshHz=this.clock.hz;void this.drain();const settings=this.hooks.settings();const requested=Number(settings.targetFPS);this.stats.requestedFPS=requested;
    if(settings.original||settings.comparison||this.disabled||performance.now()<this.recoveryUntil||!this.presentation.ready||!this.pair?.ready||this.video.seeking||this.video.paused||document.hidden)return;
    const fps=Math.min(requested,this.clock.hz??60)*this.budget.frequency;const interval=1000/fps;
    this.outputIntervalMs=interval;
    if(!this.pacer.due(time,fps))return;
    temporalPerf.count('outputAttempts');if(this.busy||this.pending){temporalPerf.count('discard.queueBusy');this.stats.dropped++;return;}
    if(!this.engine.canStream){temporalPerf.count('discard.gpuBackpressure');this.budget.sample(interval*2,interval,true,performance.now(),settings.adaptive);return;}
    const native=this.presentation.mediaAt(time),period=this.cadence.period??this.sourcePeriod;const selected=selectTemporalPair(this.engine.temporalPairs(),native,period,this.video.playbackRate);
    if(!selected){temporalPerf.count('discard.planUnavailable');this.limited('표시 시간에 맞는 원본 프레임 쌍을 기다립니다.');return;}
    const {pair,plan}=selected;temporalPerf.sample('timeline.nativeOffsetMs',(this.video.currentTime-this.presentation.mediaAt(performance.now()))*1000/this.video.playbackRate);
    temporalPerf.sample('timeline.currentMinusPairBMs',(this.video.currentTime-pair.b)*1000/this.video.playbackRate);
    const key=`${pair.b}:${plan.alpha.toFixed(5)}`;if(key===this.lastKey){temporalPerf.count('duplicateEndpoint');return;}
    this.lastKey=key;const revision=this.revision;this.busy=true;this.busyStarted=temporalPerf.mark();this.stats.queueDepth=1;
    const deadline=time+Math.max(4,1000/(this.clock.hz??60));let rejected=false;const current=()=>{const begin=temporalPerf.mark(),now=performance.now();const skew=(this.presentation.mediaAt(now)-plan.mediaTime)*1000/this.video.playbackRate;const nativeOffset=(this.video.currentTime-this.presentation.mediaAt(now))*1000/this.video.playbackRate;const reason=!this.running||revision!==this.revision?'invalidated':this.video.seeking?'seek':document.hidden?'hidden':now>deadline?'submitDeadline':nativeOffset>Math.max(45,period*2)||nativeOffset< -period?'clockDiscontinuity':(this.video.currentTime-plan.mediaTime)*1000/this.video.playbackRate>100?'totalMediaSkew':skew< -2?'tooEarly':skew>MAX_VISUAL_DELAY_MS?'tooLate':null;const valid=reason===null;if(reason&&!rejected){rejected=true;temporalPerf.count('discard.'+reason);}temporalPerf.elapsed('validityCpuMs',begin);return valid;};
    void this.hooks.output({plan,pair,intervalMs:interval,current}).then(timing=>{
      const sampleBudget=(latency:number)=>{if(this.running&&revision===this.revision)this.budget.sample(latency+pair.flowMs*Math.min(1,(1000/Math.max(1,this.sourcePeriod))/fps),interval,!timing,performance.now(),settings.adaptive);};
      if(timing?.completion)void timing.completion.then(latency=>sampleBudget(latency+timing.cpuSubmitMs));else sampleBudget(timing?.latencyMs??this.estimatedMs*1.5);
      if(!timing||!this.running||revision!==this.revision){if(this.running&&revision===this.revision&&this.lastKey===key)this.lastKey='';return;}
      this.estimatedMs=this.estimatedMs*.8+timing.latencyMs*.2;
      if(timing.completion)void timing.completion.then(latency=>{if(this.running&&revision===this.revision)this.stats.totalMs=latency+timing.cpuSubmitMs;});else this.stats.totalMs=timing.latencyMs;this.stats.interpolationMs=null;this.stats.upscaleMs=null;this.stats.delayMs=(this.video.currentTime-plan.mediaTime)*1000/this.video.playbackRate;this.stats.additionalDelayMs=(this.presentation.mediaAt(performance.now())-plan.mediaTime)*1000/this.video.playbackRate;this.stats.nativeOffsetMs=this.stats.delayMs-this.stats.additionalDelayMs;temporalPerf.sample('timeline.totalMediaSkewMs',this.stats.delayMs);temporalPerf.sample('timeline.additionalDelayMs',(this.presentation.mediaAt(performance.now())-plan.mediaTime)*1000/this.video.playbackRate);
      if((this.clock.hz??60)<requested*.98)this.limited('목표 '+requested+'FPS보다 브라우저 갱신률이 낮습니다. 실제 제출률을 확인하세요.');
      else{this.stats.state='active';this.stats.reason='시간이 다른 두 원본 프레임의 움직임 추정·워핑 결과를 제출합니다.';}
    }).catch(error=>{if(this.running){this.disabled=true;this.stats.state='error';this.stats.reason='보간 출력 오류로 공간·색상 보정만 유지합니다: '+String(error);this.engine.releaseTemporal();this.pair=undefined;this.hooks.hide(this.stats.reason);}})
    .finally(()=>this.finished());
  }
  submittedFrame(generated:boolean,pair?:MotionPair):void{
    const now=performance.now();this.submittedAt=now;temporalPerf.count('submitted');this.submissions.push(now);this.stats.submitted++;
    const classify=(dynamic:boolean,cut:boolean)=>{if(!this.running)return;if(cut)temporalPerf.count('skip.sceneCut');if(!dynamic)temporalPerf.count('skip.static');if(generated&&dynamic&&!cut){temporalPerf.count('generatedSubmitted');this.generated.push(now);this.stats.generated++;}else temporalPerf.count('nativeSubmitted');};
    if(generated&&pair?.analysisAvailable===false)temporalPerf.count('unclassifiedGenerated');else if(pair?.analysis)void pair.analysis.then(a=>classify(a.dynamic,a.sceneCut));else classify(pair?.dynamic??false,pair?.sceneCut??false);
    if(this.engine.lastSignature)this.signatures.push({time:now,hash:this.engine.lastSignature});this.trim(now);
  }
  private trim(now:number):void{while(this.submissions.length&&now-this.submissions[0]>=2000)this.submissions.shift();while(this.generated.length&&now-this.generated[0]>=2000)this.generated.shift();while(this.signatures.length&&now-this.signatures[0].time>=2000)this.signatures.shift();}
  snapshot():TemporalStats{const now=performance.now();this.trim(now);const fps=(events:number[])=>events.length<2?0:(events.length-1)*1000/Math.max(1,now-events[0]);const submittedFPS=fps(this.submissions);const slow=this.stats.state==='active'&&this.submissions.length>20&&submittedFPS<Math.min(Number(this.hooks.settings().targetFPS),this.clock.hz??60)*.85;return {...this.stats,...(slow?{state:'limited' as const,reason:'처리 비용·출력 타이밍 때문에 목표 FPS에 미치지 못했습니다. 실제 제출 FPS를 확인하세요.'}:{}),signatureSampled:temporalPerf.enabled&&temporalPerf.signatures,submittedFPS,generatedFPS:fps(this.generated),uniqueSamples:new Set(this.signatures.map(x=>x.hash)).size,requestedFPS:Number(this.hooks.settings().targetFPS),physicalFPS:null};}
  invalidate():void{temporalPerf.count('bufferResets');this.revision++;this.pending?.frame.close();this.pending=null;this.pair=undefined;this.previousSource=null;this.lastSource=-1;this.resetMotion();this.lastKey='';this.pacer.reset();this.presentation.reset();this.cadence.reset();}
  invalidateOutput():void{this.revision++;this.lastKey='';}
  requestStill():void{this.still=true;void this.drain();}
  playbackChanged():void{this.invalidate();this.still=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.clock.reset();if(this.video.paused)this.requestStill();else this.requestOutput();}
  visibilityChanged():void{this.playbackChanged();}
  destroy():void{if(!this.running)return;this.running=false;this.revision++;this.pending?.frame.close();this.pending=null;if(this.callback)this.video.cancelVideoFrameCallback(this.callback);if(this.raf)cancelAnimationFrame(this.raf);this.callback=this.raf=0;this.engine.onStreamAvailable=undefined;}
}







