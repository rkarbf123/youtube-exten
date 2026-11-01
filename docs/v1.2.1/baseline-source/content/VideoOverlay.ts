import type { Size } from '../shared/types';
export class VideoOverlay {
  readonly canvas: HTMLCanvasElement;
  private line: HTMLDivElement; private handle: HTMLDivElement; private parent: HTMLElement; private abort=new AbortController();
  private originalPosition: string | null=null; private visible=false; private comparing=false; private divider=.5;
  css: Size={width:1,height:1};
  get displayed():boolean{return this.visible&&this.canvas.isConnected&&this.canvas.style.display!=='none';}
  constructor(private video: HTMLVideoElement, canvas: HTMLCanvasElement, private moveDivider: (value: number) => void) {
    this.canvas=canvas; this.parent=video.parentElement!;
    if(getComputedStyle(this.parent).position==='static'){this.originalPosition=this.parent.style.position;this.parent.style.position='relative';}
    canvas.className='clarity-gpu-overlay';
    const videoZ=Number.parseInt(getComputedStyle(video).zIndex,10);
    Object.assign(canvas.style,{position:'absolute',pointerEvents:'none',zIndex:String(Number.isFinite(videoZ)?videoZ+1:1),display:'none',maxWidth:'none',maxHeight:'none',filter:'none',opacity:'1',transform:'none'});
    canvas.setAttribute('aria-hidden','true'); this.parent.append(canvas);
    this.line=document.createElement('div'); this.handle=document.createElement('div');
    Object.assign(this.line.style,{position:'absolute',display:'none',pointerEvents:'none',zIndex:String(Number.isFinite(videoZ)?videoZ+2:2),borderLeft:'1px solid rgba(255,255,255,.8)'});
    Object.assign(this.handle.style,{position:'absolute',top:'12%',height:'65%',left:'-9px',width:'18px',pointerEvents:'auto',cursor:'ew-resize',touchAction:'none'});
    this.handle.role='slider'; this.handle.tabIndex=0; this.handle.setAttribute('aria-label','원본과 보정 영상 비교 경계');this.handle.setAttribute('aria-valuemin','0');this.handle.setAttribute('aria-valuemax','100');
    this.line.append(this.handle); this.parent.append(this.line);
    const set = (x: number) => {const r=this.canvas.getBoundingClientRect();this.divider=Math.max(.02,Math.min(.98,(x-r.left)/r.width));this.moveDivider(this.divider);this.align();};
    this.handle.addEventListener('pointerdown',event=>{event.stopPropagation();event.preventDefault();this.handle.setPointerCapture(event.pointerId);set(event.clientX);},{signal:this.abort.signal});
    this.handle.addEventListener('pointermove',event=>{if(this.handle.hasPointerCapture(event.pointerId))set(event.clientX);},{signal:this.abort.signal});
    this.handle.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();this.divider=Math.max(.02,Math.min(.98,this.divider+(event.key==='ArrowLeft'?-.02:.02)));this.moveDivider(this.divider);this.align();}},{signal:this.abort.signal});
    this.align();
  }
  align(): Size {
    const r=this.video.getBoundingClientRect(),p=this.parent.getBoundingClientRect();
    // YouTube's absolute-positioned video container can have zero layout height.
    // Zero height is not a scale transform; use unit scale on that axis.
    const sx=this.parent.offsetWidth>0&&p.width>0?p.width/this.parent.offsetWidth:1;
    const sy=this.parent.offsetHeight>0&&p.height>0?p.height/this.parent.offsetHeight:1;
    const sw=this.video.videoWidth||r.width,sh=this.video.videoHeight||r.height;
    const factor=Math.min(r.width/sw,r.height/sh);
    const width=sw*factor,height=sh*factor;
    // YouTube uses contain/center presentation. Do not cover the letterbox or controls.
    const left=(r.left-p.left+(r.width-width)/2)/Math.max(.01,sx)+this.parent.scrollLeft-this.parent.clientLeft;
    const top=(r.top-p.top+(r.height-height)/2)/Math.max(.01,sy)+this.parent.scrollTop-this.parent.clientTop;
    this.css={width:width/Math.max(.01,sx),height:height/Math.max(.01,sy)};
    Object.assign(this.canvas.style,{left:`${left}px`,top:`${top}px`,width:`${this.css.width}px`,height:`${this.css.height}px`});
    Object.assign(this.line.style,{left:`${left+this.css.width*this.divider}px`,top:`${top}px`,height:`${this.css.height}px`});
    this.handle.setAttribute('aria-valuenow',String(Math.round(this.divider*100)));
    return {width,height};
  }
  compare(enabled: boolean,divider: number): void {if(enabled===this.comparing&&divider===this.divider)return;this.comparing=enabled;this.divider=divider;this.align();this.line.style.display=this.visible&&enabled?'block':'none';}
  show(): void {this.visible=true;this.canvas.style.display='block';this.line.style.display=this.comparing?'block':'none';}
  hide(): void {this.visible=false;this.canvas.style.display='none';this.line.style.display='none';}
  destroy(): void {this.hide();this.abort.abort();this.canvas.remove();this.line.remove();if(this.originalPosition!==null)this.parent.style.position=this.originalPosition;}
}
