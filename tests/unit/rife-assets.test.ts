import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
test('Framegen local weights remain identical to the pinned package with separate weight notice',()=>{
 expect(sha('public/models/framegen/rt_v7s.bin')).toBe('76428e1769f742a2aaad79996f2eb57cc29388a6dc21c242386ca9110c0bb397');
 expect(sha('public/models/framegen/rt_v7s.bin')).toBe(sha('node_modules/framegen/weights/rt_v7s.bin'));
 expect(sha('public/models/framegen/rt_v7s.json')).toBe(sha('node_modules/framegen/weights/rt_v7s.json'));
 expect(readFileSync('public/models/framegen/WEIGHTS_LICENSE.md','utf8')).toContain('Non-commercial research and personal use only.');
});
test('real RIFE checkpoint and exported ONNX match the verified conversion hashes',()=>{
 const report=JSON.parse(readFileSync('docs/v1.3/model-conversion.json','utf8'));
 expect(sha('references/rife/4.25-lite/train_log/flownet.pkl')).toBe(report.checkpointSha256);
 expect(sha('public/models/rife/rife-4.25-lite-128.onnx')).toBe(report.onnxSha256);
 expect(report.strictInferenceCheckpointLoad).toBe(true);expect(report.comparison).toHaveLength(3);
 for(const row of report.comparison){expect(row.maxAbs).toBeLessThan(.001);expect(row.mae).toBeLessThan(.0001);}
});
