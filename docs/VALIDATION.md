# Validation record — 2026-10-31 (Asia/Seoul)

This is the historical **v1.0** record. See [v1.1 검증·개선 보고서](review/REVIEW.ko.md) for the current implementation and new test results.

## Build and automated tests

Environment: Windows, Node.js 24.18.1, npm 11.16.0. Locked dependencies include TypeScript 5.9.3, Vite 7.3.7, Vitest 3.2.7 and Playwright 1.64.1.

| Check | Actual result |
| --- | --- |
| `npm install` | Succeeded |
| `npm run dev` | Vite harness served and exercised by Playwright |
| `npm run build` | Strict TypeScript and all runtime/Manifest V3 asset checks passed |
| `npm run test` | 34 tests passed in 5 files |
| `npm run test:browser` | 10 tests passed, zero skipped |
| Built extension loading | Loaded in isolated Chromium 156.0.8078.4; service worker, popup, storage and production content script exercised |

The unit suite covers settings normalization and persistence, configurable adaptive thresholds, promotions/demotions, hysteresis, cooldown, frame-rate-dependent budgets, workload reduction, engine fallback selection, resolution/DPR limits, bounded scheduling, paused refresh coalescing, error classification and bounded/accurate measurement history.

The browser suite compiles real WGSL and GLSL and checks GPU pixel output. Uniform-color error was 0/255; the interior linear-ramp maximum error was 0.50/255 in installed Chrome/Edge; the step-edge range stayed within the input range (50–200). Both sliders changed actual output. Fast and Balanced produced distinct pixels. These are correctness checks, not perceptual quality scores.

Live browser regressions cover WebGPU and WebGL2 video compositing, same-frame comparison via compositor screenshots, pausing, seeking, speed changes, resize, actual cross-origin canvas taint, injected access failure, missing GPU APIs, real GPUDevice destruction and WebGL2 recovery, three-texture reuse, texture replacement on resize and zero remaining owned textures after destruction. The actual built popup persists settings, resets defaults, updates from content-script metrics, disables immediately and handles video DOM replacement without duplicate overlays. The integration fixture reproduces YouTube's zero-height absolute-video container.

`test-results/results.json` contains the most recent Playwright results. `test-results/popup-live.png` and `test-results/local-harness.png` are visual QA artifacts; this directory is intentionally ignored by source control.

## Installed browser checks

The built local harness was independently exercised in installed **Chrome 156.0.8078.76** and **Edge 156.0.4314.50**, both in isolated headless sessions. All 9 deterministic checks passed on each backend in each browser (36 check outcomes). The packaged video produced accepted WebGPU output frames in both browsers. Full data: [browser-validation.json](browser-validation.json).

These are API/pixel/local-playback compatibility checks, not long-duration performance benchmarks or a claim that an unpacked extension was manually installed into the user's existing Chrome/Edge profile. Those profiles were not touched.

## Real YouTube evidence

The **production extension** was loaded in isolated Chromium 156.0.8078.4 and navigated to the public video [Me at the zoo](https://www.youtube.com/watch?v=jNQXAC9IVRw), without signing in or modifying the stream. The video was genuinely playing at 320 × 240, with no attached MediaKeys. The extension reported WebGPU/Balanced processing, and completed current frames were displayed over that real video.

The recorded sample had approximately 15 source FPS and 14.86 accepted presentations/second, output 1046 × 784, and EMA completion latency about 6.50 ms. These are one observed runtime sample, include scheduling/queue overhead, and are not guaranteed hardware performance or pure GPU execution time. No GPU timestamp was available; its value remains null.

After pausing, the browser compositor was captured with the processed overlay visible and again with it hidden. The unenhanced comparison half differed from the original by about **0.87/255 mean RGB channel units**; the enhanced half differed by about **1.88/255**. Actual visible differences, correct geometry and the independently validated shaders establish that processed pixels reached the page. They do not establish a subjective quality improvement score.

Evidence files:

- [youtube-validation.json](youtube-validation.json): actual source, settings-derived engine/profile, dimensions, measurements, pixel comparison and layout coordinates.
- [youtube-enhanced.png](youtube-enhanced.png): paused compositor capture with same-frame comparison.
- [youtube-original.png](youtube-original.png): same paused video with the overlay hidden.
- [youtube-check.png](youtube-check.png): final browser-page screenshot.

The initial validation uncovered and fixed a zero-height-parent scaling defect. Delayed WebGPU canvas readback also proved unsuitable for display validation because the swap texture expires after presentation; the final verification uses compositor screenshots instead. Neither of those initial results is reported as successful visual validation.

## Compatibility checklist

| Scenario | Verification |
| --- | --- |
| Real YouTube standard watch | Processed pixels displayed and compared on the public video above |
| Theater mode | Actual YouTube control clicked; overlay and video geometry matched |
| Fullscreen | Actual YouTube control clicked; `document.fullscreenElement` present and overlay geometry matched |
| Seeking / 1.25× playback | Real video sought to 5 seconds, resumed at 1.25×; overlay resynchronized |
| Browser window / player resize | Real page resized; geometry updated correctly |
| Paused-frame rendering | Local and real-page compositor checks; local continuous work stops after pause |
| GPU fallback and device loss | Local actual device destruction → fresh WebGL2 surface; original preserved during recovery |
| Cross-origin restricted video | Browser-enforced taint on local cross-origin fixture; original continued playing |
| Settings and primary-video change | Built MV3 popup/storage/content-script integration fixture passed |
| Real YouTube new-video SPA navigation | Implemented; unverified on a second real video |
| Real YouTube stream-resolution switch | Implemented dimension-aware texture replacement; actual quality-menu switch unverified |
| Subtitles/captions | Overlay is a pointer-transparent sibling within the video container; actual timed-caption readability unverified |
| Browser zoom / monitor-DPR transition | Implemented resize/DPR invalidation and tested DPR calculations; real zoom/multi-monitor transition unverified |
| YouTube Shorts / mobile layout | Visible-video selection and SPA support implemented; real Shorts/mobile playback unverified |
| DRM / protected streams / live streams | MediaKeys rejected and errors handled; no real protected/live stream tested |
| Long sessions, 4K/60, varied hardware | Unverified; no throughput/quality guarantees |
| Anime4K / Neural / Ultra | Unavailable; no implementation/model is represented as active |

One accessible YouTube video is not evidence that every stream or browser permits pixel access. Original-video fallback remains the expected behavior for restricted content. No security workarounds are implemented.
