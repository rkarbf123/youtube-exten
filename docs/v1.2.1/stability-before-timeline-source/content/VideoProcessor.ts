import {emptyTemporal,type Dimensions,type RuntimeStats,type Settings,type Status,type UpscaleEngine,type RenderTiming} from '../shared/types';
import { createEngine } from '../gpu/createEngine';
import { AdaptiveController } from '../adaptive/AdaptiveController';
import { resolveTargetDimensions } from '../adaptive/Resolution';
import { PerformanceMonitor } from '../adaptive/PerformanceMonitor';
import { PresentationHistory } from '../adaptive/PresentationHistory';
import { FrameScheduler, type FrameTicket } from './FrameScheduler';
import { VideoOverlay } from './VideoOverlay';
import {WebGPUEngine} from '../gpu/WebGPUEngine';
import {InterpolationSession,type TemporalOutput} from '../temporal/InterpolationSession';
import {temporalPerf} from '../temporal/TemporalProfiler';
export function describeError(error: unknown): { status: Status; reason: string } {
  const reason=error instanceof Error?error.message:String(error);
  return {status: error instanceof DOMException && error.name==='SecurityError' || /origin.clean|cross.origin|taint|protected|DRM/i.test(reason) ? 'Video Access Restricted' : 'Rendering Error', reason};
}
export class VideoProcessor {
  private engine?: UpscaleEngine; private overlay?: VideoOverlay; private scheduler?: FrameScheduler;
  private abort=new AbortController(); private resize: ResizeObserver; private monitor=new PerformanceMonitor(); private adaptive=new AdaptiveController();
  private status: Status='Initializing'; private reason='Waiting for an accessible video frame.'; private dimensions: Dimensions | null=null;
  private dead=false; private generation=0; private lastPresented=0; private presented=0; private probed=false;
  private watchdog=0; private resizeTimer=0; private recoveryTimer=0; private recoveries=0; private lastDpr=devicePixelRatio; private backendReason=''; private starting=false;
  private effectiveSharpness=0;private effectiveDenoise=0; private currentEngine='—';
  private visibility=new PresentationHistory();private frameStarted=0;private outputKey='';
  private temporal?:InterpolationSession;private restartPending=false;private submissionTimes:number[]=[];private totalSubmissions=0;private decodedHeight=0;
  private temporalMediaTime:number|null=null;
  constructor(private video: HTMLVideoElement, private settings: Settings, private persistDivider?: (value:number)=>void, private preferredBackend?: 'webgpu'|'webgl2') {
    this.resize=new ResizeObserver(()=>this.onResize());this.resize.observe(video);
    const signal=this.abort.signal;
    for(const name of ['seeking','waiting','emptied','loadstart']) video.addEventListener(name,()=>{this.invalidate('Original Video Fallback','Waiting for a fresh decoded frame.');this.monitor.discontinuity();},{signal});
    for(const name of ['loadeddata','seeked','playing','pause','ratechange','loadedmetadata']) video.addEventListener(name,()=>{
      if(name==='loadedmetadata'||name==='loadeddata'){this.probed=false;if(!this.engine&&!this.starting)void this.initialize();}
      if(name==='ratechange')this.monitor.discontinuity();
      if(['playing','pause','ratechange','seeked','loadedmetadata'].includes(name))this.temporal?.playbackChanged();
      if(this.video.paused)this.scheduler?.refresh();
    },{signal});
    video.addEventListener('resize',()=>{this.probed=false;this.invalidate('Original Video Fallback','원본 해상도가 변경되어 프레임 버퍼를 초기화합니다.');if(video.paused){this.scheduler?.refresh();this.temporal?.requestStill();}},{signal});
    document.addEventListener('visibilitychange',()=>{
      this.invalidate('Original Video Fallback',document.hidden?'Suspended while the tab is hidden.':'Resuming from original video.');
      if(document.hidden)this.scheduler?.stop();else{this.scheduler?.start();if(this.video.paused)this.scheduler?.refresh();}
      this.temporal?.visibilityChanged();
    },{signal});
    document.addEventListener('fullscreenchange',()=>this.onResize(),{signal});
    window.addEventListener('resize',()=>this.onResize(),{signal});
    this.watchdog=window.setInterval(()=>{
      if(this.dead)return;
      if(this.engine instanceof WebGPUEngine&&this.engine.stalled()){this.lost('WebGPU 보간 처리 응답 시간이 초과되어 원본 재생으로 복구합니다.');return;}
      if(devicePixelRatio!==this.lastDpr){this.lastDpr=devicePixelRatio;this.onResize();}
      // Hiding an expired presentation must not reset motion pairs or cancel a newer GPU job.
      // Resetting those here creates a feedback loop at high source FPS.
      const temporalExpired=this.temporalMediaTime!==null&&!!this.temporal?.expired(this.temporalMediaTime);
      if(temporalExpired&&this.temporalMediaTime!==null&&this.temporal?.protectPresentation(this.temporalMediaTime))return;
      if(!video.paused&&this.lastPresented&&(temporalExpired||performance.now()-this.frameStarted>this.freshHoldMs())){this.hide(temporalExpired?'temporalExpired':'sourceExpired');this.lastPresented=0;this.setState('Original Video Fallback','처리 화면이 오래되어 새 결과가 도착할 때까지 원본 재생을 표시합니다.');}
    },20);
  }
  async start(): Promise<void> { await this.initialize(); }
  private async initialize(force?: 'webgpu'|'webgl2'): Promise<void> {
    if(this.dead||this.starting||!this.settings.enabled)return;
    this.starting=true; const generation=++this.generation;
    this.setState('Initializing','Initializing local GPU processing.');
    try {
      const result=await createEngine(()=>document.createElement('canvas'),reason=>this.lost(reason),force??this.preferredBackend);
      if(this.dead||generation!==this.generation){result.engine.destroy();return;}
      this.engine=result.engine;this.backendReason=result.reason;
      this.overlay=new VideoOverlay(this.video,result.canvas,value=>{this.settings={...this.settings,divider:value};this.persistDivider?.(value);if(this.video.paused){this.scheduler?.refresh();this.temporal?.requestStill();}});
      this.adaptive.reset();this.probed=false;
      if(this.settings.targetFPS!=='original'&&result.engine instanceof WebGPUEngine){
        this.temporal=new InterpolationSession(this.video,result.engine,{
          settings:()=>this.settings,
          observe:(m,now)=>{this.decodedHeight=m.height;this.monitor.frame(m.mediaTime,m.presentedFrames,now,m.expectedDisplayTime);},
          spatial:async ticket=>{await this.process(ticket);},
          output:job=>this.process({metadata:null,current:job.current},job),
          hide:reason=>{this.hide();this.setState('Performance Limited',reason);},fatal:error=>this.fail(error)
        });this.temporal.start();
      }else{
      this.scheduler=new FrameScheduler(this.video,async ticket=>{await this.process(ticket);},()=>{
        this.monitor.metrics.skippedFrames++;this.monitor.metrics.missedDeadlines++;if(!this.retainFresh())this.hide('sourceReplaced');this.setState('Performance Limited','Newer source frame arrived; discarding outdated output.');
      },error=>this.fail(error));
      if(!document.hidden){this.scheduler.start();if(this.video.paused)this.scheduler.refresh();}
      }
    } catch(error){if(!this.dead&&generation===this.generation){this.releaseGPU();this.setState('Unsupported GPU',error instanceof Error?error.message:String(error));}}
    finally{this.starting=false;if(this.restartPending&&!this.dead){this.restartPending=false;void this.initialize();}}
  }
  private probe(): void {
    if(this.video.mediaKeys)throw new DOMException('Protected media (DRM) is not supported.','SecurityError');
    const probe=document.createElement('canvas');probe.width=probe.height=1;
    const context=probe.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Cannot validate source pixel access.');
    context.drawImage(this.video,0,0,1,1);context.getImageData(0,0,1,1);this.probed=true;
  }
  private async process(ticket: FrameTicket,temporal?:TemporalOutput): Promise<RenderTiming|null> {
    const engine=this.engine,overlay=this.overlay;
    if(this.dead||!engine||!overlay||document.hidden||this.video.readyState<2||this.video.seeking)return null;
    if(this.video.closest('.ad-showing,.ad-interrupting')){this.invalidate('Original Video Fallback','광고 중에는 원본 재생을 유지합니다.');return null;}
    if(this.video.videoWidth<1||this.video.videoHeight<1)return null;
    const generation=this.generation;
    // Keys can be attached after a clear lead-in; recheck without reading pixels.
    if(this.video.mediaKeys)throw new DOMException('Protected media (DRM) is not supported.','SecurityError');
    if(!this.probed)this.probe();
    const now=performance.now();
    if(ticket.metadata){this.decodedHeight=ticket.metadata.height;this.monitor.frame(ticket.metadata.mediaTime,ticket.metadata.presentedFrames,now,ticket.metadata.expectedDisplayTime);}
    const selected=this.adaptive.options(this.settings);this.currentEngine=selected.options.engine;
    this.effectiveSharpness=selected.options.sharpness*100;this.effectiveDenoise=selected.options.engine==='fast'?0:selected.options.denoise*100;
    const dimensions=resolveTargetDimensions({width:this.video.videoWidth,height:this.video.videoHeight},overlay.align(),devicePixelRatio,this.settings.targetResolution,engine.maxDimension,engine.maxPixels,this.settings.adaptive?this.adaptive.workload:1,{width:Math.round(screen.width*devicePixelRatio),height:Math.round(screen.height*devicePixelRatio)},!!this.temporal,this.decodedHeight||this.video.videoHeight);
    selected.options.upscale=!!dimensions.eligible&&dimensions.output.width>dimensions.source.width;
    this.dimensions=dimensions;overlay.compare(this.settings.comparison&&!this.settings.original,this.settings.divider);
    const outputKey=`${dimensions.source.width},${dimensions.source.height},${dimensions.output.width},${dimensions.output.height}`;
    if(outputKey!==this.outputKey){this.hide();this.outputKey=outputKey;}
    // Keep a still-fresh completed frame while computing into reused offscreen textures.
    // Only present() touches the visible canvas, after validation and current-frame checks.
    if(!overlay.displayed)this.setState('Original Video Fallback','Processing the latest frame; showing original playback.');
    this.monitor.metrics.queueDepth=1;
    if((temporal||ticket.sourceFrame)&&engine instanceof WebGPUEngine){
      try{
        if(!ticket.current())return null;
        const timing=temporal?engine.submitTemporal(dimensions,selected.options,temporal.plan.alpha,temporal.pair,ticket.current):engine.submitSource(ticket.sourceFrame!,dimensions,selected.options,ticket.current);
        if(!timing)return null;
        const submitted=performance.now();this.totalSubmissions++;this.submissionTimes.push(submitted);while(this.submissionTimes.length&&submitted-this.submissionTimes[0]>=2000)this.submissionTimes.shift();
        this.temporal?.submittedFrame(temporal?.plan.generated??false,temporal?.pair,temporal?undefined:ticket.sourceTime);this.monitor.submission(!selected.options.original,submitted);
        this.temporalMediaTime=temporal?.plan.mediaTime??ticket.sourceTime??this.video.currentTime;this.frameStarted=now;this.lastPresented=submitted;this.presented++;
        overlay.show();this.visibility.set(!selected.options.original);temporalPerf.count('acceptedDisplay');
        this.setState(selected.unavailable?'Engine Unavailable':dimensions.limited?'Performance Limited':'Active',selected.unavailable?'선택한 처리 방식은 미지원이므로 지원되는 GPU 방식으로 처리합니다.':`${engine.backend} processed frames are being presented.`);
        temporalPerf.count(temporal?'temporalCanvasSubmissions':'nativeCanvasSubmissions');
        void timing.completion?.then(latency=>{if(this.dead||generation!==this.generation)return;this.monitor.recordTiming({...timing,latencyMs:latency+timing.cpuSubmitMs});temporalPerf.count('completedOutputs');if(this.settings.adaptive&&!this.video.paused){if(temporal&&this.temporal?.budget.allowSpatial)this.adaptive.sample(latency+temporal.pair.flowMs*Math.min(1,temporal.intervalMs/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))),temporal.intervalMs,false,performance.now());else if(!temporal)this.adaptive.sample(latency+timing.cpuSubmitMs,this.monitor.intervalMs/Math.max(.1,this.video.playbackRate),false,performance.now());}});
        return timing;
      }finally{this.monitor.metrics.queueDepth=0;}
    }
    let timeout=0;
    try {
      const deadline=new Promise<never>((_resolve,reject)=>{timeout=window.setTimeout(()=>reject(new Error('GPU processing timed out; original playback restored.')),1500);});
      const timing=await Promise.race([temporal&&engine instanceof WebGPUEngine?engine.renderTemporal(dimensions,selected.options,temporal.plan.alpha):engine.render(this.video,dimensions,selected.options),deadline]);
      if(this.dead||generation!==this.generation)return null;
      const interval=temporal?.intervalMs??this.monitor.intervalMs/Math.max(.1,this.video.playbackRate);
      const ready=temporalPerf.mark();let missed=(!this.video.paused&&performance.now()-now>interval*1.25)||!ticket.current();
      if(!missed&&!document.hidden&&!this.video.seeking){temporalPerf.elapsed('readyToCanvasSubmitMs',ready);const presenting=temporalPerf.mark();timing.cpuSubmitMs+=await Promise.race([engine.present(),deadline]);temporalPerf.elapsed('canvasPresentAwaitMs',presenting);this.totalSubmissions++;this.submissionTimes.push(performance.now());while(this.submissionTimes.length&&performance.now()-this.submissionTimes[0]>=2000)this.submissionTimes.shift();this.temporal?.submittedFrame(!!temporal?.plan.generated);}
      if(this.dead||generation!==this.generation)return null;
      timing.latencyMs=performance.now()-now;
      missed=missed||(!this.video.paused&&timing.latencyMs>interval*1.25)||!ticket.current();
      const display=!missed&&!document.hidden&&!this.video.seeking;
      // FPS counts accepted rVFC source frames, not duplicate paused/settings redraws.
      this.monitor.complete(timing,display&&!selected.options.original&&(ticket.metadata!==null||!!temporal||!!this.temporal&&!this.video.paused),performance.now());
      if(missed){temporalPerf.count('discard.outputDeadline');this.monitor.metrics.missedDeadlines++;}
      const combinedCost=timing.latencyMs+(temporal?temporal.pair.flowMs*Math.min(1,interval/(this.monitor.intervalMs/Math.max(.1,this.video.playbackRate))):0);
      // Native fallback retains normal adaptive quality. Motion headroom may promote spatial
      // quality, but spatial demotion waits until the motion controller has reduced its cost.
      if(this.settings.adaptive&&!this.video.paused&&(ticket.metadata||ticket.sourceDriven||temporal&&(this.temporal?.budget.allowSpatial||combinedCost<interval*.2)))this.adaptive.sample(combinedCost,interval,missed,performance.now());
      if(display){
        temporalPerf.count('acceptedDisplay');this.temporalMediaTime=temporal?.plan.mediaTime??null;
        overlay.show();this.visibility.set(!selected.options.original);this.lastPresented=performance.now();this.frameStarted=now;
        if(!selected.options.original)this.presented++;
        this.setState(selected.options.original?'Original Comparison':selected.unavailable?'Engine Unavailable':dimensions.limited?'Performance Limited':'Active',selected.options.original?'Showing the unenhanced acquired frame for comparison.':selected.unavailable?'Requested engine/profile is unavailable; using '+selected.options.engine+'.':dimensions.limited?'Output reduced to fit display, memory and measured processing limits.':`${engine.backend} processed frames are being presented.${this.backendReason?' WebGPU unavailable; using WebGL2 fallback.':''}`);
      }else {if(!this.retainFresh())this.hide('deadline');this.setState('Performance Limited','처리 마감 시간을 놓쳐 아직 유효한 완료 화면을 유지하거나 원본 재생을 표시합니다.');}
      return display?timing:null;
    } finally{clearTimeout(timeout);this.monitor.metrics.queueDepth=0;}
  }
  private onResize(): void {
    this.overlay?.align();this.temporal?.invalidateOutput();
    clearTimeout(this.resizeTimer);this.resizeTimer=window.setTimeout(()=>{this.overlay?.align();if(this.video.paused){this.scheduler?.refresh();this.temporal?.requestStill();}},120);
  }
  private setState(status:Status,reason:string):void{this.status=status;this.reason=reason;}
  private freshHoldMs():number{return Math.max(40,Math.min(250,this.monitor.intervalMs/Math.max(.1,this.video.playbackRate)*1.5+10));}
  private retainFresh():boolean{return !!this.overlay?.displayed&&!this.video.seeking&&!document.hidden&&performance.now()-this.frameStarted<=this.freshHoldMs();}
  private hide(reason='invalidate'):void{if(this.overlay?.displayed)temporalPerf.count('overlayHide.'+reason);this.overlay?.hide();this.visibility.set(false);}
  private invalidate(status:Status,reason:string,reset=true):void{this.hide();this.scheduler?.invalidate();if(reset)this.temporal?.invalidate();else this.temporal?.invalidateOutput();this.lastPresented=0;this.setState(status,reason);}
  private fail(error:unknown):void{if(this.dead)return;const detail=describeError(error);this.monitor.metrics.failures++;this.invalidate(detail.status,detail.reason);this.releaseGPU();}
  private lost(reason:string):void{
    if(this.dead)return;
    const wasWebGPU=this.engine?.backend==='WebGPU';this.fail(new Error(reason));
    if(this.recoveries++<1)this.recoveryTimer=window.setTimeout(()=>{if(!this.dead)void this.initialize(wasWebGPU?'webgl2':undefined);},1000);
  }
  private releaseGPU():void{this.generation++;this.temporal?.destroy();this.temporal=undefined;this.scheduler?.stop();this.scheduler=undefined;this.hide();this.overlay?.destroy();this.overlay=undefined;this.engine?.destroy();this.engine=undefined;this.outputKey='';this.monitor.metrics.queueDepth=0;}
  update(settings:Settings):void{
    const changedAdaptive=settings.adaptive!==this.settings.adaptive;
    const changedFPS=settings.targetFPS!==this.settings.targetFPS;
    this.settings=settings;if(changedAdaptive)this.adaptive.reset();
    if(changedFPS){this.releaseGPU();if(this.starting)this.restartPending=true;else void this.initialize();return;}
    this.invalidate('Original Video Fallback','설정을 GPU 처리에 적용합니다.',false);
    if(this.video.paused){this.scheduler?.refresh();this.temporal?.requestStill();}
  }
  stats():RuntimeStats{
    const visible=!!this.overlay?.displayed;const metrics=this.monitor.snapshot();metrics.enhancedVisiblePercent=this.visibility.percent();
    const scaleRatio=this.dimensions?Math.min(this.dimensions.output.width/this.dimensions.source.width,this.dimensions.output.height/this.dimensions.source.height):0;
    const algorithm=!this.dimensions?.eligible?'원본 해상도 · 노이즈/색상 보정':this.currentEngine==='balanced'?`FSR1 EASU · ${this.settings.contentMode==='animation'?'애니메이션':'실사'}`:this.currentEngine==='fast'?'고속 경계선 재구성':'—';
    const original=this.settings.original||(this.settings.comparison&&this.settings.divider>=1);
    const temporal=this.temporal?.snapshot()??emptyTemporal();if(!this.temporal){temporal.submitted=this.totalSubmissions;temporal.submittedFPS=this.submissionTimes.length<2?0:(this.submissionTimes.length-1)*1000/Math.max(1,performance.now()-this.submissionTimes[0]);if(this.settings.targetFPS!=='original'){temporal.requestedFPS=Number(this.settings.targetFPS);temporal.state='unsupported';temporal.reason='이 백엔드는 움직임 보간을 지원하지 않아 업스케일링·색상 보정만 유지합니다.';}}
    return {status:this.status,reason:this.reason,backend:this.engine?.backend??'—',engine:this.currentEngine,profile:this.settings.adaptive?this.adaptive.profile:this.settings.profile,dimensions:this.dimensions,metrics,presented:this.presented,effectiveSharpness:this.effectiveSharpness,effectiveDenoise:this.effectiveDenoise,algorithm,presentation:!visible?'fallback':original?'original':this.settings.comparison?'split':'enhanced',fallback:!visible,upscalingActive:visible&&!original&&scaleRatio>1.01,scaleRatio,frameAgeMs:visible?performance.now()-this.frameStarted:null,temporal,canvasTransitions:this.overlay?.transitions,recoveries:this.recoveries};
  }
  destroy():void{if(this.dead)return;this.dead=true;this.abort.abort();this.resize.disconnect();clearInterval(this.watchdog);clearTimeout(this.resizeTimer);clearTimeout(this.recoveryTimer);this.releaseGPU();}
}
