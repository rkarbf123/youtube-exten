"""Offline edge/temporal measurements. No pixels are altered in the renderer."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import sobel, distance_transform_edt, shift, binary_dilation, gaussian_filter
ROOT=Path(__file__).resolve().parent.parent/'docs/v1.3/edge-flicker'
def load(name):return np.array(Image.open(ROOT/name).convert('RGB'),dtype=float)
def luma(a):return a@np.array([.2126,.7152,.0722])
def edges(y,scale=1):
    # Fixed measurement threshold; not an image-processing step in the extension.
    e=np.hypot(sobel(y,axis=0)/8,sobel(y,axis=1)/8)>(20/scale)
    e[:3]=False;e[-3:]=False;e[:,:3]=False;e[:,-3:]=False
    return e
def stats(a):
    a=np.asarray(a);a=a[np.isfinite(a)]
    return {'mean':float(a.mean()),'p95':float(np.percentile(a,95)),'max':float(a.max())} if a.size else None
def ssim(a,b):
    a,b=luma(a),luma(b);ma,mb=gaussian_filter(a,1.5,truncate=10/3),gaussian_filter(b,1.5,truncate=10/3)
    va=gaussian_filter(a*a,1.5,truncate=10/3)-ma*ma;vb=gaussian_filter(b*b,1.5,truncate=10/3)-mb*mb;cov=gaussian_filter(a*b,1.5,truncate=10/3)-ma*mb
    return float((((2*ma*mb+6.5025)*(2*cov+58.5225))/((ma*ma+mb*mb+6.5025)*(va+vb+58.5225)))[5:-5,5:-5].mean())
all_rows=[];summaries=[]
for scene in ['lineart','repeating','occlusion','flash','cut','turn']:
    path=ROOT/(scene+'.json')
    if not path.exists():continue
    data=json.loads(path.read_text(encoding='utf8'));previous={};measurements=[]
    for row in sorted(data['rows'],key=lambda r:(r['variant'],r['mode'],r['index'])):
        key=(row['variant'],row['mode']);a,b=load(row['image']),load(row['truth']);ya,yb=luma(a),luma(b);scale=row['width']/320;ea,eb=edges(ya,scale),edges(yb,scale)
        da,db=distance_transform_edt(~ea)/scale,distance_transform_edt(~eb)/scale
        displacement=np.r_[da[eb],db[ea]];sq=np.mean((a-b)**2,axis=2);mse=float(sq.mean());worst={'mean':0}
        for y in range(0,len(ea),int(16*scale)):
            for x in range(0,ea.shape[1],int(16*scale)):
                mask=eb[y:y+int(16*scale),x:x+int(16*scale)];v=da[y:y+int(16*scale),x:x+int(16*scale)][mask]
                if v.size and v.mean()>worst['mean']:worst={'mean':float(v.mean()),'x':x/scale,'y':y/scale}
        rois={}
        for name,(x,y,w,h)in {'hair':(82,36,76,100),'face':(94,57,57,57),'eyesMouth':(100,75,40,33),'hand':(153,137,35,29),'thinLines':(185,43,47,102)}.items():
            x,y=int((x+row['dx'])*scale),int((y+row['dy'])*scale);w,h=int(w*scale),int(h*scale);x,y=max(0,x),max(0,y);part=sq[y:y+h,x:x+w];mask=eb[y:y+h,x:x+w]
            rois[name]={'rmse':float(np.sqrt(part.mean())) if part.size else None,'edgeDistance':stats(da[y:y+h,x:x+w][mask])}
        edge_mask=binary_dilation(eb,iterations=max(1,int(2*scale)));ghost=float(np.abs(ya-yb)[edge_mask].mean()) if edge_mask.any() else None
        # Bright synthetic thin-line width proxy, one scanline averaged over four strokes.
        x0,x1=int((185+row['dx'])*scale),int((233+row['dx'])*scale);y0,y1=int((55+row['dy'])*scale),int((135+row['dy'])*scale)
        thickness=float(((ya[y0:y1,x0:x1]>210).sum(axis=1)-(yb[y0:y1,x0:x1]>210).sum(axis=1)).mean()/(4*scale)) if x1<row['width'] and y1<row['height'] else None
        m={k:row[k] for k in ['variant','mode','index','pairID','ptsA','ptsC','t','plannedPTS','outputPTS','generated','guard','dx','dy','alignmentTrusted']}
        m.update(psnr=10*math.log10(255**2/mse) if mse else None,ssim=ssim(a,b),rmse=math.sqrt(mse),edgeDisplacement=stats(displacement),worst16pxEdgeRegion=worst,edgeBandLumaMae=ghost,thinLineWidthError=thickness,rois=rois,temporal=None)
        prior=previous.get(key)
        if prior and row['alignmentTrusted'] and not row['guard'] and not prior['row']['guard']:
            r=prior['row'];delta=((r['dy']-row['dy'])*scale,(r['dx']-row['dx'])*scale);warp=lambda a:shift(a,delta,order=1,mode='constant',cval=np.nan,prefilter=False)
            ca,cb=warp(ya),warp(yb);distance_error=warp(da-db)-(prior['da']-prior['db']);mask=binary_dilation(prior['eb'],iterations=max(1,int(3*scale)))
            unexplained=(ca-prior['ya'])-(cb-prior['yb']);m['temporal']={'edgeDistanceResidual':stats(distance_error[mask]),'edgeFlickerAbs':stats(np.abs(distance_error[mask])),'lumaFlickerAbs':stats(np.abs(unexplained[mask])),'warpingMae':stats(np.abs(ca-prior['ya'])[mask]),'excessWarpingMae':stats(np.abs(unexplained)[mask]),'alignment':'known analytic rigid translation, truth raster change subtracted; source-pixel distance units'}
        previous[key]={'row':row,'ya':ya,'yb':yb,'eb':eb,'da':da,'db':db};measurements.append(m)
    for variant,mode in sorted({(r['variant'],r['mode'])for r in measurements}):
        rows=[r for r in measurements if r['variant']==variant and r['mode']==mode];ai=[r for r in rows if r['generated']];temporal=[r['temporal']for r in rows if r['temporal']]
        def avg(items,key):
            vals=[r[key]for r in items if r.get(key)is not None];return float(np.mean(vals)) if vals else None
        summaries.append({'scene':scene,'variant':variant,'mode':mode,'frames':len(rows),'aiFrames':len(ai),'aiRMSE':avg(ai,'rmse'),'aiPSNR':avg(ai,'psnr'),'aiSSIM':avg(ai,'ssim'),'edgeMean':avg([r['edgeDisplacement']for r in ai if r['edgeDisplacement']],'mean'),'edgeP95Mean':avg([r['edgeDisplacement']for r in ai if r['edgeDisplacement']],'p95'),'edgeFlicker':avg([r['edgeFlickerAbs']for r in temporal],'mean'),'lumaFlicker':avg([r['lumaFlickerAbs']for r in temporal],'mean'),'edgeGhostMae':avg(ai,'edgeBandLumaMae'),'thinWidthError':avg(ai,'thinLineWidthError'),'temporalPairs':len(temporal)})
    all_rows.append({'scene':scene,'rows':measurements});print(scene,flush=True)
(ROOT/'edge-metrics.json').write_text(json.dumps({'definitions':{'edge':'symmetric nearest gradient edge distance, Sobel magnitude >20/255; distances in source pixels','flicker':'mean absolute change of edge-distance error after known rigid motion alignment, truth raster variation subtracted','uncertainty':'occlusion/turn/flash/cut excluded from rigid temporal claims; spatial measurements retained','ssim':'Gaussian sigma1.5 truncate10/3, Rec.709 gamma-coded luma, border5 excluded','ghost':'luma MAE in 2-source-pixel truth-edge band; proxy, not semantic ghost detection','thickness':'synthetic 4 bright lines, mean thresholded scanline width error; not general stroke width','postTruth':'C/D truth uses identical production postprocess, after inference on separate GPU device'},'summaries':summaries,'scenes':all_rows},ensure_ascii=False,indent=2),encoding='utf8')
for s in summaries:
    if s['mode']=='B':print(s)
