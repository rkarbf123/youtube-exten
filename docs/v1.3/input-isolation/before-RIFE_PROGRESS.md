# RIFE_PROGRESS — 현재 체크포인트

갱신 2026-11-01 (한국 날짜). **Clarity v1.3 제품 통합 미완료.** 기존 작업을 초기화하거나 되돌리지 않았습니다. Git 저장소는 없습니다. 아래가 현재 상태이며 이전 초기 조사 메모를 대체합니다.

## 검증된 성과

1. Framegen npm **1.4.0**을 실제 설치하고 고정. v7-small 원본 가중치·manifest를 그대로 복사. 2945824바이트, SHA-256 `76428e1769f742a2aaad79996f2eb57cc29388a6dc21c242386ca9110c0bb397`.
2. 공식 타입의 createRT/prepPair/runT/destroy로 WebGPU 추론. shader-f16 필수. 공개 runtime API를 새로 흉내 내거나 신경망을 자체 구현하지 않음.
3. 11 합성 장면×3시점 A/C 평가. B는 모델 입력에서 제외. 컷 보호는 신경망이 아닌 별도 GPU 안전 후처리. 반복 무늬·애니메이션 비강체 윤곽의 잔여 문제와 광량 변화의 원본 선택 부작용을 보고함.
4. 실제 디코드 A/B/C PTS 0.5/0.517/0.533, t=0.5151515151515151. PSNR 기존 33.774→AI 40.050dB. 일부 국소 잔상/경계 지표는 악화.
5. 720p 실제 약 60.001FPS 입력, 30초 관찰, Canvas 89.998FPS, AI 경로 86.498FPS. 계획 누락 0, 지연 완료 3, queue 최대 3, GPU 오류 0. GPU 커널·고유 scanout·모든 프레임 고유성 검증과 구분.
6. Practical-RIFE 4.25.lite의 PyTorch→ONNX 정확도와 ONNX Runtime Web **1.22.0** GPU 추론도 성공. 128×128 고정 모델이며 720p 실시간 ONNX 성공을 뜻하지 않음.

## 모델·라이선스·환경

- Framegen: public/models/framegen/{rt_v7s.bin,rt_v7s.json,provenance.json,LICENSE,WEIGHTS_LICENSE.md}. 코드 MIT와 가중치 비상업 조건을 구분. 무료 제품이어도 원본 재배포 고지 유지; 유료 제품/서비스 번들 금지. weights 자체를 변경하지 않음.
- Framegen manifest SHA 6fa80133638949109d11fec3efb0421fbbc556f9bcff2fe2239b410154d8e7e3, runtime SHA da2d3fa8f97d8628b7d5a47c01aa1cad99095ad3d2247220d7142718ab1110c8. 공급원 node_modules/framegen/weights (npm 1.4.0).
- 공식 RIFE ZIP references/rife/upstream.zip SHA e84366c23e0eb1a637a55aad2e4f3442ec2bf4c388043b4aabbf590be289e6e8. 실제 checkpoint references/rife/4.25-lite/train_log/flownet.pkl SHA 81cdba223fe72a120130cc8552e5d2ecac824259d406f0c15323b3decf96b8b1.
- ONNX public/models/rife/rife-4.25-lite-128.onnx SHA c9b214e7b36b3721d28994221e551240580b9916b2f49da7bdc983b9a166c8e5. BGR NCHW [1,6,128,128], timestep [1,1,1,1], output [1,3,128,128]. scale [32,16,8,4,1]. teacher/caltime 학습 전용 키만 제외한 모든 추론 파라미터 strict load.
- Python .venv-rife/Scripts/python.exe (3.11.16), torch 2.8.0+cpu, onnx 1.19.1, onnxruntime 1.23.2. CPU ORT는 변환 비교에만 사용. .python/.uv-cache/.venv-rife는 작업용이며 배포 금지.
- CPU ONNX max error 0.000007808208465576172. 실제 WebGPU 결과 docs/v1.3/webgpu-validation.json. ORT Web은 **1.22.0** 유지. 1.31.1 큰 수치 오차/장치 불일치, 1.23.2 runtime 파일 조합 실패는 별도 JSON 보존. 기준을 낮춰 성공시키지 않았음.

## 주요 저장 파일

- src/ai/FramegenSession.ts: 로컬 가중치 검증·실제 라이브러리·프레임 쌍 serial/PTS·GPU 큰 차이 원본 선택·명시적 정리.
- src/ai/RifeSession.ts: 실제 ONNX 모델/shape/hash·WebGPU provider·GPU buffer 입출력·단일 추론.
- src/harness/framegenValidation.ts 및 rifeValidation.ts, harness/framegen.html 및 rife.html: 제품과 독립된 검증 화면.
- scripts/verify-framegen.mjs (quality/abc/benchmark), verify-rife-webgpu.mjs, export-rife.py.
- tests/unit/rife-assets.test.ts, tests/browser/rife.spec.ts: 실제 모델·기준 비교·가중치 불변·A/B/C 테스트.
- package.json/package-lock.json, tsconfig.json(Framegen exports의 원래 타입 경로 해결), vite.config.ts(별도 entry), .gitignore, README, THIRD_PARTY_NOTICES.
- v1.2.2 수정 보존: gpu/MotionEstimator.ts, WebGPUEngine.ts, shaders/motion-flow.wgsl 및 motion-warp.wgsl, harness/motionQuality.ts 및 perf.ts, tests/browser/motion-quality.spec.ts. 피라미드·벡터 정련·세대/ID·실제 패치 검증·진단 히트맵.

## 테스트 / 실패 기록

- 최신 회귀(윤곽선 진단): 빌드 통과, 단위 86개 통과, 브라우저 44개 통과. docs/v1.3/edge-flicker/final-{build,unit,browser}.log. 이전 FPS 확장 86/42 로그도 보존.
- 최초 전체 회귀는 38통과/2실패. 실제 중심 위치는 정확했으나 256점 희소 서명은 같은 값이어서 전체 픽셀 해시 검증으로 강화했습니다. 자원 수는 피라미드/정련의 추가 11개로 13→24가 된 의도된 변경이며, 24개 안정 재사용→보간 끔 3개→종료 0개를 검사합니다. 실패 로그 browser-tests-before-assertion-fix.log 보존.
- 모델의 가짜 placeholder 없음. Framegen 최초 texture usage 실패는 framegen-texture-usage-failure.json. RenderAttachment 비트 추가 후 재검증.
- 실제 A/B/C를 paused seek로 포착할 때 콜백 timeout/PTS 혼선이 있었음. 연속 재생의 서로 다른 세 rVFC로 수정. framegen-abc-*-failure.json 보존.
- 첫 720p 시험 64.76FPS는 최신 한 쌍만 남긴 하네스의 시점 공급 문제. framegen/benchmark-before-pair-cache.json 보존. 최근 두 쌍 + snapshot 3개로 한 번 수정 후 위 결과.
- 기존 품질 보고서 SSIM은 8×8 적색 채널 방식. 추가 FPS 보고서는 표준 Gaussian 휘도 SSIM을 별도 계산. LPIPS 미측정. 자연 영상 정답/실사용 사용자 원본은 미확보.

## Gate 상태

- Gate 1 실제 Framegen 가중치·GPU·MV3 확장 페이지: 통과.
- Gate 2: 합성 및 실제 디코드 합성 A/B/C는 확인, 자연 애니메이션·반복 무늬·일부 국소 잔상은 미완료. 일반 품질 통과로 확대하지 않음.
- Gate 3: 독립 720p 30초 Canvas 제출 기준 근접, 추가 행렬에서 RGB 지문 및 원본 차이를 전수 확인. 물리 표시·음향 동기화는 미검증.
- Gate 4 제품 통합 미완료. Gate 5의 독립 1080p FPS 검증은 아래 추가 결과 참조; 제품 1080p는 미검증.

## 미완료 / 다음 우선순위

1. 추가 FPS 보고서의 60→90 누락·지연 원인을 GPU 커널/진단 비용/rAF 지연으로 분리. 기준을 낮추지 말고 기존 성공 기록과 제품 기능 보존.
2. Framegen 품질: 반복 무늬/빠른 비강체 애니메이션/가림의 안전 출력, 잘못된 컷 판정과 광량 변화 부작용 검증. 모델보다 기존이 나은 국소 결과도 보존.
3. Framegen MV3 확장 페이지는 실제 실행 통과 (docs/v1.3/framegen/mv3.json), 원격 요청/CSP/GPU 오류 0. 아직 YouTube content-script의 자산 URL 및 허용 범위 연결은 없음. ONNX WASM 하네스의 확장 페이지 실행은 미검증이며 현재 CSP의 wasm 정책을 검토해야 함. 보안 우회 금지.
4. 기존 WebGPUEngine과 GPUDevice를 공유하는 AI adapter 및 frame store, InterpolationSession의 실제 AI 완료/제출/late-discard 연결. 현재 제품에는 **아직 없음**. 자동 fallback은 원본 FPS 우선; 심각한 왜곡 이력이 있는 Optical Flow는 자동 선택 금지.
5. GPU 컷 보호에서 원본 C를 출력한 경우에는 C의 실제 PTS와 generated=false를 제품 메타데이터에 전파해야 함. 현재 하네스의 픽셀 보호만으로 완료하지 말 것. AI 경로 제출 수를 무조건 유효 고유 프레임 수로 표시하지 말 것. 모델/엔진 선택 UI 및 측정된 상태만 표시. 기존 업스케일·색상 pass 유지.
6. 독립 FPS 행렬의 1080p 3조건 측정 완료(아래 보고서). 제품 1080p·실제 YouTube·음향 동기화는 미검증.

## 재개 명령

~~~powershell
npm run build
npm run test
npm run test:browser
node scripts/verify-framegen.mjs quality
node scripts/verify-framegen.mjs abc
node scripts/verify-framegen.mjs benchmark
node scripts/verify-rife-webgpu.mjs
.venv-rife/Scripts/python.exe scripts/export-rife.py
node scripts/report-framegen-fps.mjs # FPS 최신 결과 보존; 이전 checkpoint 생성기는 기존 메모를 덮어쓰므로 그대로 재실행하지 말 것
~~~

이미 기록한 30초 시험을 무조건 반복하지 말고 변경 영향이 있을 때만 실행. Windows sandbox EPERM spawn이면 승인된 require_escalated 빌드/브라우저 실행을 사용. source 편집 중 Playwright dev server HMR로 실행 중 테스트를 초기화하지 말 것. 큰 Python 환경은 Vite watcher 제외 검토 대상.

## 보존 및 주의

- 사용자 녹화 C:\Users\yhuij\Videos\2026-11-01 08-18-06.mp4 (1920×1080/25.783초), 추출 docs/v1.2.2/recording. 10초 심각한 얼굴/배경 왜곡. 최종 화면 녹화는 원본 A/C가 아님.
- docs/v1.2.2/before-source, before-dist, tests/fixtures/v1.2.1-final에 이전 코드를 보존. 과거 docs/v1.2.1 원시 자료와 기존 ZIP도 그대로 유지.
- clarity-extension-v1.2.1.zip / clarity-extension.zip은 기존 검증 배포본. 현재 dist는 **미완성 개발 빌드**이며 기존 ZIP과 다름. v1.3 배포 완료로 표시하지 말 것.
- FramegenSession은 제공받은 GPUDevice를 파괴하지 않고 자기 runtime/texture/buffer만 정리. RifeSession은 하네스 전용으로 자기 device도 파괴하므로 같은 페이지 재실행 전 reload 필요. 제품 연결 전 공유 장치 소유권 설계 필수.
- 성능의 generated는 GPU 모델 경로 제출 수이며 물리 고유 프레임 수가 아님. 순수 GPU 커널 시간/전체 VRAM peak/음향 동기화/수 시간 누수는 검증하지 않음.


















<!-- EDGE_FLICKER_UPDATE_BEGIN -->
## 윤곽선 떨림 작업 — 개선 미달성

[보고서](docs/rife/TEMPORAL-EDGE-REPORT.ko.md). 두 후보(dense refine / AI 얇은 ridge unsharp 제한)는 개선 없어 채택하지 않았습니다. 모델 1.4.0/v7-small 및 production 후처리 bytes 유지. 선화 raw edge flicker 0.490286, dense 동일. D 밝기 flicker 8.45020→ridge8.45129로 실패. 반복 무늬 raw flicker 7.88925 미해결.

추가: framegenEdges.ts의 6장면×연속8쌍×A/B/C/D GPU 캡처, analyze-framegen-edges.py의 위치/p95/최악ROI/정렬 temporal/PSNR/SSIM. 불확실 정렬은 별도 제외. FramegenSession.diagnoseOutput은 GPU 원본 C 보호 시 실제 C PTS/generated=false 반환, stale pair 거부. 기본 runT에 readback 추가 없음. 제품 AI 통합은 현재 소스에서도 없음.

이전 FPS JSON/hash 유지, 이번 회귀는 docs/v1.3/edge-flicker/fps. 최신 검사: 빌드 통과, 단위 86개 통과, 브라우저 44개 통과. 실제 YouTube 원본 접근 성공, 영상 AI 독립 진단 실행 성공; live overlay·자연 영상 temporal 개선은 미검증.

재개: node scripts/report-framegen-edges.mjs, node scripts/verify-youtube-framegen.mjs. 상세 재현 명령/수정 파일/남은 문제는 보고서 참조. 후보 재현 시 rejected-ridge 스냅샷과 동일 고정 정답을 사용하고 기존 FPS 기록을 덮어쓰지 말 것. 새 ZIP 미생성.
<!-- EDGE_FLICKER_UPDATE_END -->

<!-- FPS_MATRIX_UPDATE -->
## 추가 FPS 검증 최신 결과

[전체 보고서](docs/rife/FPS-MATRIX-REPORT.ko.md), docs/v1.3/framegen-fps/matrix-all.json 및 matrix.csv. 6개 조건의 30초 결과를 저장했습니다. 원본FPS별 하네스 매개변수화/1088행 복제패딩/전체RGB 지문/실제 VP8 A/B/C reference를 추가했고 새 보간 엔진은 만들지 않았습니다. 기존 720p60→90 원시 기록은 보존했습니다.

- 720p-24-48: Canvas 47.999FPS, model calls 1440, RGB novel AI 1440, unique fingerprints 1440, GPU errors 0, post buffers/textures 0/0.
- 720p-30-60: Canvas 60.027FPS, model calls 1637, RGB novel AI 1637, unique fingerprints 1801, GPU errors 0, post buffers/textures 0/0.
- 720p-60-90: Canvas 89.256FPS, model calls 2473, RGB novel AI 2473, unique fingerprints 2675, GPU errors 0, post buffers/textures 0/0.
- 1080p-24-48: Canvas 48.000FPS, model calls 1440, RGB novel AI 1440, unique fingerprints 1440, GPU errors 0, post buffers/textures 0/0.
- 1080p-30-60: Canvas 59.999FPS, model calls 1638, RGB novel AI 1638, unique fingerprints 1800, GPU errors 0, post buffers/textures 0/0.
- 1080p-60-90: Canvas 88.425FPS, model calls 2452, RGB novel AI 2452, unique fingerprints 2653, GPU errors 0, post buffers/textures 0/0.

재개 명령(변경한 조건만 필요 시 재실행):

~~~powershell
node scripts/framegen-fps-matrix.mjs 1080-60
node scripts/framegen-fps-matrix.mjs 720-24 accuracy-only
.venv-rife/Scripts/python.exe scripts/analyze-fps-reference.py
node scripts/report-framegen-fps.mjs
~~~

추가 파일: src/harness/framegenDiagnostics.ts, framegenReference.ts, scripts/framegen-fps-matrix.mjs, analyze-fps-reference.py, report-framegen-fps.mjs. framegenValidation.ts와 tests/browser/rife.spec.ts도 수정했습니다. 실제 오디오·물리 scanout·자연 영상 전반의 품질·제품 YouTube 통합은 미검증입니다. 60→90은 진단을 포함한 이번 측정에서 누락·지연이 있어 안정 유지 성공으로 판정하지 않았습니다.

FPS 확장 당시 회귀: 빌드 통과, 단위 86개 통과, 브라우저 42개 통과. 로그 docs/v1.3/fps-final-{build,unit,browser}.log.
