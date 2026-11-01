"""Offline evaluation only; no reference pixels are passed to the AI runtime."""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent/'docs/v1.3/framegen-fps'
kernel=np.exp(-(np.arange(11)-5)**2/(2*1.5**2));kernel/=kernel.sum()
def gaussian(a):
    h,w=a.shape;p=np.pad(a,((0,0),(5,5)),mode='reflect');x=np.zeros_like(a)
    for i,k in enumerate(kernel):x+=p[:,i:i+w]*k
    p=np.pad(x,((5,5),(0,0)),mode='reflect');y=np.zeros_like(a)
    for i,k in enumerate(kernel):y+=p[i:i+h,:]*k
    return y
def metrics(p,b,a,c):
    e=(p-b);square=np.mean(e*e,axis=2);mse=float(square.mean());yp=p@np.array([.2126,.7152,.0722]);yb=b@np.array([.2126,.7152,.0722])
    mp,mb=gaussian(yp),gaussian(yb);vp=np.maximum(0,gaussian(yp*yp)-mp*mp);vb=np.maximum(0,gaussian(yb*yb)-mb*mb);cov=gaussian(yp*yb)-mp*mb
    ssim=((2*mp*mb+6.5025)*(2*cov+58.5225))/((mp*mp+mb*mb+6.5025)*(vp+vb+58.5225))
    h,w=square.shape;worst=0;at=None
    for y in range(0,h,16):
        for x in range(0,w,16):
            value=float(np.sqrt(square[y:y+16,x:x+16].mean()))
            if value>worst:worst=value;at={'x':x,'y':y,'width':min(16,w-x),'height':min(16,h-y)}
    motion=np.max(np.abs(a-c),axis=2)>8;edge=np.zeros((h,w),bool);edge[:,1:]|=np.abs(np.diff(yb,axis=1))>8;edge[1:,:]|=np.abs(np.diff(yb,axis=0))>8
    return {'mae':float(np.abs(e).mean()),'rmse':math.sqrt(mse),'psnr':10*math.log10(255**2/mse) if mse else None,'ssimGaussianLuma':float(ssim[5:-5,5:-5].mean()),'worst16x16Rmse':worst,'worstTile':at,'motionRoiFraction':float(motion.mean()),'motionRoiMae':float(np.abs(e)[motion].mean()) if motion.any() else 0,'truthEdgeMae':float(np.abs(e)[edge].mean()) if edge.any() else 0}
for height in (720,1080):
    for source,target in ((24,48),(30,60),(60,90)):
        path=ROOT/f'{height}p-{source}-{target}.json'
        if not path.exists():continue
        row=json.loads(path.read_text(encoding='utf8'));q=row.get('accuracy')
        if not q or row.get('error'):continue
        def image(key):return np.array(Image.open(ROOT/q[key]).convert('RGB'),dtype=np.float64)
        a,b,c=image('sourceA'),image('truthB'),image('sourceC');t=q['decodedPts']['t']
        q['standardMetrics']={'definition':'RGB 0..255 PSNR; Rec.709 gamma-coded luma SSIM with Gaussian 11x11 sigma=1.5, 5px border excluded; local 16px tiles. Offline evaluation only.','optical':metrics(image('opticalImage'),b,a,c),'framegen':metrics(image('framegenImage'),b,a,c),'naiveBlend':metrics(np.rint(a*(1-t)+c*t),b,a,c),'sourceAHold':metrics(a,b,a,c),'sourceCHold':metrics(c,b,a,c),'lpips':None}
        for label,key in (('optical','opticalImage'),('framegen','framegenImage')):
            name=f'{height}p-{source}-{target}-{label}-error.png';Image.fromarray(np.clip(np.abs(image(key)-b)*3,0,255).astype(np.uint8)).save(ROOT/name);q[label+'ErrorImage']=name
        path.write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf8');print(path.name,q['standardMetrics']['framegen']['psnr'],q['standardMetrics']['framegen']['ssimGaussianLuma'])
