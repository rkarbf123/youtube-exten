import type { Dimensions } from '../shared/types';
/** Type-only extension point for an optional, locally packaged post-reconstruction stage.
 * No stage is instantiated in v1. Backend implementations own their texture/encoder types.
 * A future color module can encode before compositing without changing video acquisition.
 */
export interface OptionalProcessingStage<Context, Texture> {
  readonly id: string;
  initialize(context: Context): Promise<void>;
  resize(dimensions: Dimensions): void;
  encode(context: Context, input: Texture, output: Texture): void;
  destroy(): void;
}
