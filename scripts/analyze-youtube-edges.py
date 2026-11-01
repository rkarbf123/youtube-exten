"""Independent full-RGB endpoint comparison; does not modify any video pixel."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent.parent/'docs/v1.3/edge-flicker'
path=root/'youtube-framegen.json';q=json.loads(path.read_text(encoding='utf8'))
if q.get('verifiedAI'):
    r=q['triplet'];output=np.array(Image.open(root/r['framegenImage']).convert('RGB'),dtype=float);novel={}
    for key in ['sourceA','sourceC']:
        source=np.array(Image.open(root/r[key]).convert('RGB'),dtype=float);novel[key]={'differentChannels':int(np.count_nonzero(source!=output)),'mae':float(np.abs(source-output).mean())}
    pts=q['capture']['pts'];q['pixelNovelty']=novel;q['capture']['maxSourcePtsGapMs']=max((b-a)*1000 for a,b in zip(pts,pts[1:]));q['validForNominalFPSQuality']=False
    q['captureWarning']='Capture and rVFC callback gaps present. This decoded triplet does not prove nominal 24fps inference quality or temporal improvement.'
    path.write_text(json.dumps(q,ensure_ascii=False,indent=2),encoding='utf8');print(novel,'maxSourceGapMs',q['capture']['maxSourcePtsGapMs'])
