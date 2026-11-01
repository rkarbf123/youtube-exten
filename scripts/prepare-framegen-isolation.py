"""Decode original MSE bytes; no MediaRecorder, interpolation, or timestamp synthesis."""
import av,json,hashlib,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent.parent/'docs/v1.3/input-isolation'
sha=lambda b:hashlib.sha256(b).hexdigest()
def cadence(pts):
    d=np.diff(pts);return {'frames':len(pts),'meanFPS':float(1/d.mean()) if len(d) else None,'medianMs':float(np.median(d)*1000) if len(d) else None,'maxMs':float(d.max()*1000) if len(d) else None,'reverseOrDuplicate':int(np.count_nonzero(d<=0))}
sources=[];cases=[]
for name,directory,sid,fps,start in [('youtube24','youtube-mse',1,24,133),('bbb30','bbb60',1,30,132),('bbb60','bbb60',3,60,132)]:
    folder=ROOT/directory;trace=json.loads((folder/'trace.json').read_text(encoding='utf8'));parts=[p for p in trace['mse']['parts']if p['id']==sid]
    encoded=b''.join((folder/p['file']).read_bytes()for p in parts);media=folder/f'stream-{sid}.media';media.write_bytes(encoded)
    c=av.open(str(media));s=c.streams.video[0];selected=[];segment=[];all_pts=[]
    # Stop after the requested interval. A response interrupted after playback is
    # paused may contain an incomplete later fragment; it is outside this range.
    for f in c.decode(s):
        pts=float(f.pts*f.time_base);all_pts.append(pts)
        if 130<=pts<136:segment.append(pts)
        if start<=pts and len(selected)<33:
            rgba=f.to_ndarray(format='rgba');h,w=rgba.shape[:2];cw=min(640,w//16*16);ch=min(384,h//16*16);x=(w-cw)//2;y=(h-ch)//2
            rgba=np.ascontiguousarray(rgba[y:y+ch,x:x+cw]);b=rgba.tobytes();selected.append({'id':f'{name}:{f.pts}@{f.time_base}', 'pts':pts,'ptsInteger':f.pts,'timeBase':[f.time_base.numerator,f.time_base.denominator],'sha256':sha(b),'crop':[x,y,cw,ch],'nativeSize':[w,h],'bytes':b})
        if pts>=136:break
    c.close();audit=cadence(segment)
    if len(segment)!=6*fps or max(abs(np.diff(segment)-1/fps))>1e-6:raise RuntimeError(f'Non-CFR original source {name}: {audit}')
    if len(selected)!=33:raise RuntimeError('Insufficient decoded consecutive originals')
    path=f'{name}.rgba';(ROOT/path).write_bytes(b''.join(f.pop('bytes')for f in selected));cw,ch=selected[0]['crop'][2:];source={'name':name,'fps':fps,'width':cw,'height':ch,'file':path,'frames':selected,'segmentAudit':audit,'selectedAudit':cadence([f['pts']for f in selected]),'nativeBytesSha256':sha(encoded),'originalURL':trace['url'],'uniqueRGBFrames':len({f['sha256']for f in selected}),'conversion':'PyAV original decode to RGBA; fixed 1:1 centre crop, no resize or frame-rate conversion'};sources.append(source)
    def pair(a,c,b=None):
        A,C=selected[a],selected[c];time=selected[b]['pts']if b is not None else (A['pts']+C['pts'])/2
        return {'id':f'{name}/{A["id"]}->{C["id"]}/B={b}', 'a':a,'c':c,'truth':b,'ptsA':A['pts'],'ptsC':C['pts'],'outputPTS':time,'t':(time-A['pts'])/(C['pts']-A['pts']),'inputFPS':1/(C['pts']-A['pts'])}
    cases.append({'name':name+'-consecutive','source':name,'kind':'consecutive','realTime':True,'pairs':[pair(i,i+1)for i in range(16)]})
    cases.append({'name':name+'-heldout','source':name,'kind':'heldout','realTime':True,'pairs':[pair(i,i+2,i+1)for i in range(0,32,2)],'note':f'Actual input pair cadence {fps/2} FPS, not {fps}. B is hidden from inference.'})
    # Same B as the first six normal held-out pairs, but a wider A/C interval.
    cases.append({'name':name+'-widegap','source':name,'kind':'widegap','realTime':False,'pairs':[pair(i,i+11,i+1)for i in range(0,12,2)],'note':'Controlled missing-input burst, 11 native intervals; same B as regular held-out counterpart.'})
prior=json.loads((ROOT.parent/'edge-flicker/youtube-framegen.json').read_text(encoding='utf8'));old=av.open(str(ROOT.parent/'edge-flicker/youtube-cropped.webm'));old_pts=[float(f.pts*f.time_base)for f in old.decode(video=0)];old.close();a,b,c=[prior['triplet']['decodedPts'][k]for k in ['A','B','C']];between=[t for t in old_pts if b<t<c];source_pts=prior['capture']['pts'];trace=json.loads((ROOT/'youtube-mse/trace.json').read_text(encoding='utf8'));passive=trace['video']['pts'];skipped=sum(max(0,q['presentedFrames']-p['presentedFrames']-1)for p,q in zip(passive,passive[1:]));diagnosis={'priorRecorder':cadence(old_pts),'priorSourceCallbacks':cadence(source_pts),'priorTriplet':{'A':a,'B':b,'C':c,'pairFPS':1/(c-a),'decodedButNotSelectedBetweenBAndC':between},'passiveOriginalCallbacks':cadence([x['pts']for x in passive]),'presentedFrameCounterSkippedBetweenCallbacks':skipped,'finding':'Native video packets are CFR. Legacy rVFC observation loses presentation callbacks; MediaRecorder creates a different non-CFR clock and playback rVFC selection skips a decoded frame again. Startup/seek and main-thread observation are implicated; the experiment does not isolate all browser scheduling causes.'}
(ROOT/'manifest.json').write_text(json.dumps({'sources':sources,'cases':cases,'legacyDiagnosis':diagnosis,'tools':{'av':av.__version__},'rawModelOnly':True},ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps({'sources':[{k:s[k]for k in ['name','segmentAudit','selectedAudit','uniqueRGBFrames']}for s in sources],'legacy':diagnosis},ensure_ascii=False,indent=2))
