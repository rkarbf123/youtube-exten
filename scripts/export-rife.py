"""Export the actual MIT-licensed Practical-RIFE 4.25.lite checkpoint.
CPU ORT here is a numerical reference, never a browser inference fallback.
"""
import sys, json, hashlib, time
from pathlib import Path
import numpy as np
import torch
import onnx
import onnxruntime as ort
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'references/rife/export-source'))
from train_log.IFNet_HDv3 import IFNet

torch.set_num_threads(4)
torch.manual_seed(123)
OUT = ROOT / 'public/models/rife'
FIX = ROOT / 'public/rife-validation'
DOC = ROOT / 'docs/v1.3'
for p in (OUT, FIX, DOC):
    p.mkdir(parents=True, exist_ok=True)
checkpoint = ROOT / 'references/rife/4.25-lite/train_log/flownet.pkl'
state = torch.load(checkpoint, map_location='cpu', weights_only=True)
state = {k.removeprefix('module.'): v for k, v in state.items()}
# The official IFNet source explicitly comments out these training-only modules.
# Exclude only those documented prefixes; every inference key remains strict.
excluded_training_keys = [k for k in state if k.startswith(('teacher.', 'caltime.'))]
state = {k: v for k, v in state.items() if k not in excluded_training_keys}
net = IFNet().eval()
net.load_state_dict(state, strict=True)

class ExportRife(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
    def forward(self, frames, timestep):
        return self.model(frames, timestep=timestep, scale_list=[32, 16, 8, 4, 1])[2][-1]

model = ExportRife(net).eval()
def image(t):
    im = Image.new('RGB', (128, 128), (16, 24, 32))
    d = ImageDraw.Draw(im)
    x = 28 + int(8*t)
    d.rectangle((x, 40, x+39, 79), fill=(238, 238, 238))
    d.rectangle((x+7, 47, x+18, 58), fill=(64, 128, 192))
    d.rectangle((x+24, 64, x+32, 72), fill=(128, 192, 64))
    return im

a, b = image(0), image(1)
# Official inference_img.py uses OpenCV BGR ordering; preserve it explicitly.
arrays = [np.asarray(im, dtype=np.float32)[:, :, ::-1].transpose(2, 0, 1)/255 for im in (a, b)]
x = torch.from_numpy(np.concatenate(arrays, axis=0).copy()[None])
t = torch.tensor([[[[.5]]]], dtype=torch.float32)
with torch.inference_mode():
    model(x, t)
    start = time.perf_counter()
    torch.onnx.export(model, (x, t), str(OUT/'rife-4.25-lite-128.onnx'),
                      input_names=['frames', 'timestep'], output_names=['frame'],
                      opset_version=17, do_constant_folding=True, dynamo=False)
graph = onnx.load(str(OUT/'rife-4.25-lite-128.onnx'))
onnx.checker.check_model(graph)
session = ort.InferenceSession(str(OUT/'rife-4.25-lite-128.onnx'), providers=['CPUExecutionProvider'])
x.numpy().tofile(FIX/'frames.f32')
a.save(FIX/'source-a.png'); b.save(FIX/'source-b.png')
rows = []
for alpha in (.25, .5, .75):
    step = np.array([[[[alpha]]]], dtype=np.float32)
    with torch.inference_mode():
        reference = model(x, torch.from_numpy(step)).numpy()
    output = session.run(None, {'frames': x.numpy(), 'timestep': step})[0]
    diff = np.abs(output-reference)
    row = {'timestep': alpha, 'maxAbs': float(diff.max()), 'mae': float(diff.mean()),
           'rmse': float(np.sqrt(np.mean((output-reference)**2)))}
    rows.append(row)
    reference.tofile(FIX/f'pytorch-{alpha}.f32')
    rgb = np.clip(reference[0][::-1].transpose(1, 2, 0)*255, 0, 255).astype(np.uint8)
    Image.fromarray(rgb).save(FIX/f'pytorch-{alpha}.png')
    image(alpha).save(FIX/f'truth-{alpha}.png')
    if row['maxAbs'] > .001 or row['mae'] > .0001:
        raise RuntimeError('ONNX conversion accuracy check failed: '+str(row))

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
report = {'model': 'Practical-RIFE 4.25.lite (1018)', 'license': 'MIT',
 'upstream': 'https://github.com/hzwer/Practical-RIFE',
 'checkpointUrl': 'https://drive.google.com/file/d/1zlKblGuKNatulJNFf5jdB-emp9AqGK05/view',
 'checkpointSha256': sha(checkpoint), 'onnxSha256': sha(OUT/'rife-4.25-lite-128.onnx'),
 'onnxBytes': (OUT/'rife-4.25-lite-128.onnx').stat().st_size,
 'parameters': sum(p.numel() for p in net.parameters()), 'strictInferenceCheckpointLoad': True,
 'excludedTrainingKeys': excluded_training_keys,
 'torch': torch.__version__, 'onnx': onnx.__version__, 'ortCpuReference': ort.__version__,
 'shape': [1, 6, 128, 128], 'timestepShape': [1, 1, 1, 1], 'channelOrder': 'BGR',
 'scaleList': [32, 16, 8, 4, 1], 'opset': 17,
 'operators': sorted(set(n.op_type for n in graph.graph.node)),
 'conversionSeconds': time.perf_counter()-start, 'comparison': rows,
 'browserWebGpuVerified': False, 'productIntegrationComplete': False}
(DOC/'model-conversion.json').write_text(json.dumps(report, indent=2), encoding='utf8')
(OUT/'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps(report, indent=2))
