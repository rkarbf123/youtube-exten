# Third-party notices

The GPU algorithms in `src/shaders` are original implementations of the approaches documented in the README. The cubic kernel is the published Mitchell–Netravali B=C=1/3 reconstruction filter; no AMD FSR, Anime4K or neural-model code/weights are incorporated.

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

The final runtime bundles may include Vite's small module-preload helper (MIT). The installed Vite package's full license and bundled notices are copied to `dist/licenses/Vite-LICENSE.md`. No external runtime service, downloaded model or inference library is required.
