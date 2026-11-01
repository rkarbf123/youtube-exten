import type { UpscaleEngine } from '../shared/types';
import { WebGPUEngine, type GPUShaderSources } from './WebGPUEngine';
import { WebGLEngine } from './WebGLEngine';
export async function createEngine(makeCanvas: () => HTMLCanvasElement, onLoss: (reason: string) => void, force?: 'webgpu' | 'webgl2', sources?:{webgpu:GPUShaderSources;webgl:ConstructorParameters<typeof WebGLEngine>[2]}): Promise<{ engine: UpscaleEngine; canvas: HTMLCanvasElement; reason: string }> {
  let reason = '';
  if (force !== 'webgl2') {
    const canvas = makeCanvas();
    try { return { engine: await WebGPUEngine.create(canvas,onLoss,sources?.webgpu), canvas, reason }; }
    catch (error) { canvas.remove(); reason = error instanceof Error ? error.message : String(error); if(force==='webgpu')throw error; }
  }
  // A canvas cannot switch context types, so use a fresh surface for fallback.
  const canvas = makeCanvas();
  try { return { engine: new WebGLEngine(canvas,onLoss,sources?.webgl), canvas, reason }; }
  catch (error) { canvas.remove(); throw new Error(`${reason ? `WebGPU: ${reason}. ` : ''}WebGL2: ${error instanceof Error ? error.message : String(error)}`); }
}
