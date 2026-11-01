# Third-party notices

The Balanced algorithm in `src/shaders/common.wgsl` and `src/shaders/easu.glsl`, and the independent CPU reference in `src/harness/easuReference.ts`, are adapted from **AMD FidelityFX FSR1 EASU**, copyright (c) 2021 Advanced Micro Devices, Inc., under the MIT license. The full license is preserved in `references/FSR-LICENSE.txt` and packaged in `dist/licenses/FSR-LICENSE.txt`. Upstream: https://github.com/GPUOpen-Effects/FidelityFX-FSR/blob/master/ffx-fsr/ffx_fsr1.h . Exact reciprocals, integer texture fetches, coordinate snapping, texture/noise blending and animation tuning are project modifications. This is not an AMD certification or a claim of complete FSR/RCAS integration.

The preserved v1 shaders in `tests/fixtures/v1` are original project code, including a Mitchell–Netravali B=C=1/3 kernel. They are used only by the diagnostic harness and regression tests, not the YouTube content script.

Official Anime4K Thin shaders and their license were downloaded under `references` for review. They are **not used or packaged** in the runtime, and Anime4K remains unavailable. No neural-model code or weights are incorporated.

The diagnostic WebM and extension icon PNGs are generated locally by the included scripts and are covered by this project's MIT license. YouTube screenshots under `docs` are validation evidence from public playback, not redistributable sample video or extension runtime assets. Rights to that content remain with its owners.

Development dependencies are not included in the loaded extension. Their package licenses are present in `node_modules` after installation; the lockfile records versions and transitive dependencies. Key dependencies:

| Package | License |
| --- | --- |
| TypeScript | Apache-2.0 |
| Vite, Rollup, esbuild | MIT |
| Vitest | MIT |
| Playwright | Apache-2.0 |
| @types/chrome, @types/node | MIT |
| @webgpu/types | BSD-3-Clause |

The final runtime bundles may include Vite's small module-preload helper (MIT). The installed Vite package's full license and bundled notices are copied to `dist/licenses/Vite-LICENSE.md`. Normal playback remains separate from the experimental AI validation harnesses described below.

## Experimental AI validation (not connected to production playback)

Framegen 1.4.0 code is MIT (`public/models/framegen/LICENSE`). Its original v7-small weights are separately restricted to non-commercial research and personal use; unchanged redistribution requires `public/models/framegen/WEIGHTS_LICENSE.md`. They must not be sold or bundled into a paid product/service. Clarity MIT does not relicense those weights. Source: https://github.com/MONZikWasTaken/Framegen.

Practical-RIFE 4.25.lite uses the upstream MIT terms, explicitly applied to linked model files in its Trained Model README. Notice: `public/models/rife/LICENSE`; provenance and conversion: `docs/v1.3/model-conversion.json`. Source: https://github.com/hzwer/Practical-RIFE.

ONNX Runtime Web 1.22.0 is MIT; original notice in `public/ort/LICENSE`, from https://github.com/microsoft/onnxruntime/tree/v1.22.0. All validation code and weights are local; no runtime CDN or inference server is used. Current scope and missing integration are in `RIFE_PROGRESS.md`.
