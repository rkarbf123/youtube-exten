"""Raw output accuracy and motion-compensated residuals; never used for rendering."""
import json,math
from pathlib import Path
import numpy as np,cv2
from PIL import Image,ImageDraw
from scipy.ndimage import distance_transform_edt,gaussian_filter,binary_dilation
ROOT=Path(__file__).resolve().parent.parent/'docs/v1.3/input-isolation'
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'));sources={s['name']:s for s in manifest['sources']}
def stats(a):
    a=np.asarray(a);a=a[np.isfinite(a)]
    return {'mean':float(a.mean()),'p95':float(np.percentile(a,95)),'max':float(a.max())} if a.size else None
def image(path):return np.array(Image.open(ROOT/path).convert('RGB'),dtype=np.float64)
def y(a):return a@np.array([.2126,.7152,.0722])
def edge(a):return np.hypot(cv2.Sobel(a,cv2.CV_64F,1,0)/8,cv2.Sobel(a,cv2.CV_64F,0,1)/8)>20
def quality(a,b):
    ya,yb=y(a),y(b);ea,eb=edge(ya),edge(yb);ea[:3]=ea[-3:]=False;ea[:,:3]=ea[:,-3:]=False;eb[:3]=eb[-3:]=False;eb[:,:3]=eb[:,-3:]=False;da,db=distance_transform_edt(~ea),distance_transform_edt(~eb);err=np.mean((a-b)**2,axis=2);mse=float(err.mean());ma,mb=gaussian_filter(ya,1.5,truncate=10/3),gaussian_filter(yb,1.5,truncate=10/3);va=gaussian_filter(ya*ya,1.5,truncate=10/3)-ma*ma;vb=gaussian_filter(yb*yb,1.5,truncate=10/3)-mb*mb;cov=gaussian_filter(ya*yb,1.5,truncate=10/3)-ma*mb
    ss=((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225));dist=np.r_[da[eb],db[ea]];worst={'mean':0}
    for yy in range(0,len(eb),16):
        for xx in range(0,eb.shape[1],16):
            values=da[yy:yy+16,xx:xx+16][eb[yy:yy+16,xx:xx+16]]
            if values.size and values.mean()>worst['mean']:worst={'mean':float(values.mean()),'x':xx,'y':yy}
    band=binary_dilation(eb,iterations=2)
    return {'psnr':10*math.log10(255**2/mse) if mse else None,'ssim':float(ss[5:-5,5:-5].mean()),'rmse':math.sqrt(mse),'edgeDistance':stats(dist),'edgeBandMae':float(np.abs(ya-yb)[band].mean()) if band.any() else None,'worst16px':worst}, {'actualY':ya,'truthY':yb,'distanceError':da-db,'truthEdges':eb}
def temporal(previous,current):
    p=np.clip(previous['truthY'],0,255).astype(np.uint8);c=np.clip(current['truthY'],0,255).astype(np.uint8)
    back=cv2.calcOpticalFlowFarneback(c,p,None,.5,4,21,5,7,1.5,0);forward=cv2.calcOpticalFlowFarneback(p,c,None,.5,4,21,5,7,1.5,0);h,w=p.shape;yy,xx=np.mgrid[:h,:w].astype(np.float32);mx,my=xx+back[...,0],yy+back[...,1]
    remap=lambda a:cv2.remap(a.astype(np.float32),mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=float('nan'))
    fb=np.linalg.norm(back+remap(forward),axis=2);warpedTruth=remap(previous['truthY']);photo=np.abs(current['truthY']-warpedTruth);texture=cv2.cornerMinEigenVal(c.astype(np.float32)/255,5,3)
    edgeBand=binary_dilation(current['truthEdges'],iterations=2);valid=(mx>=3)&(mx<w-3)&(my>=3)&(my<h-3);trusted=valid&(fb<.75)&(photo<12)&(texture>1e-4)&edgeBand
    actualChange=current['actualY']-remap(previous['actualY']);truthChange=current['truthY']-warpedTruth;distanceChange=current['distanceError']-remap(previous['distanceError'])
    return {'edgeCoverage':float(trusted.sum()/max(1,edgeBand.sum())),'trustedPixels':int(trusted.sum()),'uncertainEdgePixels':int(edgeBand.sum()-trusted.sum()),'edgeFlicker':stats(np.abs(distanceChange[trusted])),'lumaFlicker':stats(np.abs((actualChange-truthChange)[trusted])),'rawWarpingError':stats(np.abs(actualChange[trusted])),'truthWarpingError':stats(np.abs(truthChange[trusted])),'alignment':'offline Farneback on truth only; FB<.75px, photo<12/255, min structure eigenvalue>1e-4; untrusted regions excluded'}
results=[];comparison=[]
for case in manifest['cases']:
    source=sources[case['source']];frames=np.memmap(ROOT/source['file'],mode='r',dtype=np.uint8,shape=(len(source['frames']),source['height'],source['width'],4));off=json.loads((ROOT/(case['name']+'-offline.json')).read_text(encoding='utf8'));rtPath=ROOT/(case['name']+'-realtime.json');rt=json.loads(rtPath.read_text(encoding='utf8'))if rtPath.exists()else None
    if rt:
        mismatches=[];maxDiff=0
        for row in rt['rows']:
            ref=next(x for x in off['rows']if x['kind']=='mid'and x['pair']['id']==row['pair']['id']);a,b=image(ref['image']),image(row['image']);diff=int(np.max(np.abs(a-b)));maxDiff=max(maxDiff,diff)
            if diff or ref['inputHashA']!=row['inputHashA']or ref['inputHashC']!=row['inputHashC']:mismatches.append(row['pair']['id'])
        comparison.append({'case':case['name'],'pairs':len(rt['rows']),'expected':len(case['pairs']),'maxChannelDifference':maxDiff,'mismatchedPairs':mismatches,'allGPUInputsMatchDecoded':all(x['inputMatchesDecodedA']and x['inputMatchesDecodedC']for x in off['rows']+rt['rows']),'discarded':rt['discarded'],'gpuErrors':off['errors']+rt['errors'],'maxPending':rt['maxPending'],'completionMs':stats([x['completionMs']for x in rt['rows']]),'submitLatenessMs':stats([x['submitLatenessMs']for x in rt['rows']])})
    rows=[];previous=None
    for row in off['rows']:
        pair=row['pair'];truth=pair['truth'] if row['kind']=='mid'else(pair['a']if row['kind']=='near-A'else pair['c'])
        entry={'pair':pair,'kind':row['kind'],'image':row['image'],'metrics':None,'temporal':None}
        if truth is not None:
            b=np.asarray(frames[truth,:,:,:3],dtype=float);a=image(row['image']);m,arrays=quality(a,b);entry['metrics']=m
            if row['kind']=='mid':
                if previous is not None:entry['temporal']=temporal(previous,arrays)
                previous=arrays
            entry['referenceFrameID']=source['frames'][truth]['id']
        rows.append(entry)
    mid=[r for r in rows if r['kind']=='mid'and r['metrics']];temps=[r['temporal']for r in mid if r['temporal']];probes=[r for r in rows if r['kind']!='mid'];avg=lambda v:float(np.mean(v))if v else None
    summary={'case':case['name'],'kind':case['kind'],'sourceFPS':source['fps'],'inputPairFPS':stats([p['inputFPS']for p in case['pairs']]),'truthAvailableForMids':bool(mid),'meanPSNR':avg([r['metrics']['psnr']for r in mid if r['metrics']['psnr']is not None]),'meanSSIM':avg([r['metrics']['ssim']for r in mid]),'meanEdgeDistance':avg([r['metrics']['edgeDistance']['mean']for r in mid if r['metrics']['edgeDistance']]),'meanFrameEdgeP95':avg([r['metrics']['edgeDistance']['p95']for r in mid if r['metrics']['edgeDistance']]),'meanEdgeBandMae':avg([r['metrics']['edgeBandMae']for r in mid if r['metrics']['edgeBandMae']is not None]),'meanEdgeFlicker':avg([r['edgeFlicker']['mean']for r in temps if r['edgeFlicker']]),'meanLumaFlicker':avg([r['lumaFlicker']['mean']for r in temps if r['lumaFlicker']]),'meanMotionMaskCoverage':avg([r['edgeCoverage']for r in temps]),'endpointAnchorDistance':avg([r['metrics']['edgeDistance']['mean']for r in probes if r['metrics']['edgeDistance']]),'endpointNote':'t=.001/.999 versus actual A/C anchor, not true midpoint ground truth'if probes else None}
    results.append({'summary':summary,'rows':rows});print(summary,flush=True)
paired=[]
for source in sources:
    regular=next(r for r in results if r['summary']['case']==source+'-heldout');wide=next(r for r in results if r['summary']['case']==source+'-widegap');pairs=[]
    for r in wide['rows']:
        ref=next(p for p in regular['rows']if p['pair']['truth']==r['pair']['truth']);pairs.append({'truthIndex':r['pair']['truth'],'normalPSNR':ref['metrics']['psnr'],'widePSNR':r['metrics']['psnr'],'normalEdge':ref['metrics']['edgeDistance']['mean'],'wideEdge':r['metrics']['edgeDistance']['mean']})
    selected=[r for r in regular['rows']if r['pair']['truth']in {p['truthIndex']for p in pairs}];wt=[r['temporal']for r in wide['rows']if r['temporal']];nt=[r['temporal']for r in selected if r['temporal']]
    avgtemp=lambda rows,key:float(np.mean([r[key]['mean']for r in rows if r.get(key)])) if any(r.get(key)for r in rows) else None
    paired.append({'source':source,'sameTruthPairs':pairs,'meanNormalPSNR':float(np.mean([r['normalPSNR']for r in pairs])),'meanWidePSNR':float(np.mean([r['widePSNR']for r in pairs])),'meanNormalEdge':float(np.mean([r['normalEdge']for r in pairs])),'meanWideEdge':float(np.mean([r['wideEdge']for r in pairs])),'meanNormalEdgeFlicker':avgtemp(nt,'edgeFlicker'),'meanWideEdgeFlicker':avgtemp(wt,'edgeFlicker'),'meanNormalLumaFlicker':avgtemp(nt,'lumaFlicker'),'meanWideLumaFlicker':avgtemp(wt,'lumaFlicker'),'comparison':'Same six B references and same five truth-motion alignment transitions; only A/C spacing and corresponding t change.'})
(ROOT/'analysis.json').write_text(json.dumps({'comparison':comparison,'cases':results,'sameTruthWideGap':paired,'definitions':{'edge':'symmetric distance between Sobel magnitude>20 edge bands, source pixels; per-frame p95 and worst 16px truth-edge region','ssim':'Rec709 gamma-coded luma Gaussian11 sigma1.5 border5 excluded','temporal':'truth-only independent motion, forward/backward and texture/photometric confidence mask; true native change subtracted','unavailable':'Consecutive native source pairs have no real half-time B. Midpoint ground-truth metrics deliberately omitted. Held-out inputs are half native FPS.','probes':'Near-endpoint anchor consistency is not exact interpolation ground truth.'},'cv2':cv2.__version__},ensure_ascii=False,indent=2),encoding='utf8')
print('PATH COMPARISONS',comparison);print('CONTROLLED WIDE GAP',paired)
