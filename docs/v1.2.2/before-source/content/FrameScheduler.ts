export interface FrameTicket { metadata: VideoFrameCallbackMetadata | null; current: () => boolean; sourceDriven?:boolean;sourceFrame?:VideoFrame;sourceTime?:number }
export interface SchedulableVideo {
  currentTime: number; readyState: number; paused: boolean;
  requestVideoFrameCallback(callback: VideoFrameRequestCallback): number;
  cancelVideoFrameCallback(id: number): void;
}
// Exactly one job in flight. New frames invalidate old output; skipped jobs are never queued.
export class FrameScheduler {
  private callback = 0; private running = false; private busy = false; private revision = 0; private lastTime = -1; private refreshPending = false;
  constructor(private video: SchedulableVideo, private process: (ticket: FrameTicket) => Promise<void>, private skip: () => void, private error: (error: unknown) => void) {}
  start(): void { if(this.running)return; this.running=true; this.schedule(); }
  private schedule(): void {
    if(!this.running)return;
    this.callback=this.video.requestVideoFrameCallback((_now,metadata)=>{
      this.callback=0; this.schedule();
      if(metadata.mediaTime===this.lastTime)return;
      this.lastTime=metadata.mediaTime; this.dispatch(metadata);
    });
  }
  refresh(): void { if(this.running&&this.video.readyState>=2)this.dispatch(null); }
  invalidate(): void { this.revision++; this.lastTime=-1; }
  private dispatch(metadata: VideoFrameCallbackMetadata | null): void {
    const revision=++this.revision;
    if(this.busy){if(!metadata||this.video.paused)this.refreshPending=true;this.skip();return;}
    this.busy=true;
    void this.process({metadata,current:()=>this.running&&revision===this.revision})
      .catch(error=>{if(this.running)this.error(error);})
      .finally(()=>{this.busy=false;if(this.refreshPending&&this.running){this.refreshPending=false;this.refresh();}});
  }
  stop(): void {
    this.running=false; this.refreshPending=false; this.invalidate();
    if(this.callback)this.video.cancelVideoFrameCallback(this.callback); this.callback=0;
  }
}
