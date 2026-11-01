import { DEFAULTS, loadSettings, normalizeSettings, saveSettings, SETTINGS_KEY } from '../settings/SettingsManager';
import { emptyMetrics, type Settings, type RuntimeStats } from '../shared/types';
import { YouTubeObserver } from './YouTubeObserver';
import { VideoProcessor } from './VideoProcessor';
// Content scripts execute in their own isolated world; no page-script bridge is required.
let settings:Settings={...DEFAULTS};let video:HTMLVideoElement|null=null;let processor:VideoProcessor|undefined;let disposed=false;let dividerTimer=0;let contextTimer=0;let observer:YouTubeObserver|undefined;let session=0;
const idle=():RuntimeStats=>({status:settings.enabled?'Original Video Fallback':'Disabled',reason:settings.enabled?'Waiting for a visible YouTube video.':'Enhancement is disabled.',backend:'—',engine:'—',profile:settings.profile,dimensions:null,metrics:emptyMetrics(),presented:0,effectiveSharpness:0,effectiveDenoise:0,algorithm:'—',presentation:'fallback',fallback:true,upscalingActive:false,scaleRatio:0,frameAgeMs:null});
function attach(next:HTMLVideoElement|null):void{
  processor?.destroy();processor=undefined;video=next;
  if(video&&settings.enabled){processor=new VideoProcessor(video,settings,value=>{
    settings={...settings,divider:value};clearTimeout(dividerTimer);dividerTimer=window.setTimeout(()=>{void saveSettings(settings).catch(()=>dispose());},350);
  });void processor.start();}
}
function apply(value:unknown):void{
  const next=normalizeSettings(value);const restart=settings.enabled!==next.enabled||(!processor&&next.enabled);settings=next;
  if(restart)attach(video);else processor?.update(settings);
}
const storageListener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes[SETTINGS_KEY])apply(changes[SETTINGS_KEY].newValue);};
const messageListener=(message:unknown,_sender:chrome.runtime.MessageSender,send:(response:unknown)=>void)=>{if(message&&typeof message==='object'&&(message as {type?:string}).type==='clarity:stats'){send(processor?.stats()??idle());}return false;};
function dispose():void{if(disposed)return;disposed=true;session++;observer?.destroy();observer=undefined;processor?.destroy();processor=undefined;video=null;clearTimeout(dividerTimer);clearInterval(contextTimer);chrome.storage.onChanged.removeListener(storageListener);chrome.runtime.onMessage.removeListener(messageListener);}
function boot():void{
  disposed=false;
  const current=++session;
  chrome.storage.onChanged.addListener(storageListener);chrome.runtime.onMessage.addListener(messageListener);
  void loadSettings().then(value=>{if(disposed||current!==session)return;settings=value;observer=new YouTubeObserver(attach);observer.start();}).catch(()=>{if(current===session)dispose();});
  contextTimer=window.setInterval(()=>{if(!chrome.runtime?.id)dispose();},1500);
}
boot();window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&disposed&&chrome.runtime?.id)boot();});
