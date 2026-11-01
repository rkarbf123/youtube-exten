export function detectVideo(root: ParentNode = document): HTMLVideoElement | null {
  const candidates = [...root.querySelectorAll<HTMLVideoElement>('video')].filter(video=>{
    const r=video.getBoundingClientRect();
    return video.isConnected && r.width>60&&r.height>60&&getComputedStyle(video).visibility!=='hidden' && getComputedStyle(video).display!=='none';
  });
  const score = (v: HTMLVideoElement) => {
    const r=v.getBoundingClientRect();
    const area=Math.max(0,Math.min(r.right,innerWidth)-Math.max(0,r.left))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(0,r.top));
    const primary=v.matches('.html5-main-video')?1.4:1;
    return area*primary*(v.paused?1:1.25);
  };
  candidates.sort((a,b)=>score(b)-score(a));
  return candidates[0] && score(candidates[0])>0 ? candidates[0] : null;
}
