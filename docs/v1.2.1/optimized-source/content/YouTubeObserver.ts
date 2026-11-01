import { detectVideo } from './VideoDetector';
export class YouTubeObserver {
  private observer: MutationObserver; private timer=0; private poll=0; private current: HTMLVideoElement | null = null; private abort=new AbortController();
  constructor(private onChange: (video: HTMLVideoElement | null) => void) {
    this.observer=new MutationObserver(records=>{
      if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n instanceof Element&&(n.matches('video')||n.querySelector('video')))))this.queue();
    });
  }
  start(): void {
    this.observer.observe(document.documentElement,{childList:true,subtree:true});
    for(const name of ['yt-navigate-finish','yt-player-updated','resize','fullscreenchange','scroll']) window.addEventListener(name,()=>this.queue(),{signal:this.abort.signal,passive:true});
    // Also detects Shorts activation, ads, source swaps and extension context invalidation.
    this.poll=window.setInterval(()=>this.scan(),1200); this.scan();
  }
  private queue(): void { if(!this.timer)this.timer=window.setTimeout(()=>{this.timer=0;this.scan();},120); }
  private scan(): void { const video=detectVideo(); if(video!==this.current){this.current=video;this.onChange(video);} }
  destroy(): void {this.observer.disconnect();this.abort.abort();clearTimeout(this.timer);clearInterval(this.poll);this.current=null;}
}
