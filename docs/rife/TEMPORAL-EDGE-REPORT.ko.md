# Temporal Edge Flicker 진단 및 후보 검증

**윤곽선 떨림 감소라는 최종 목표는 달성하지 못했습니다.** 두 후보 모두 실측 개선이 없어 채택하지 않았습니다. 기존 Framegen 1.4.0/v7-small, GPU 런타임, 업스케일링·색상·스케줄러와 과거 FPS 기록을 보존했습니다. 실패를 성공으로 보고하거나 기준을 완화하지 않았습니다.

## 현재 소스와 보존

FramegenSession의 실제 사용처는 src/harness/framegenValidation.ts와 새 진단 하네스입니다. 제품 InterpolationSession/WebGPUEngine에는 Framegen 연결이 없습니다. 체크포인트만 믿지 않고 import/call site를 검색해 확인했습니다. 이번 범위에서 제품 통합이나 엔진 교체를 다시 구현하지 않았습니다.

모델·런타임·패키지 및 이전 원시 FPS/기존 60→90 benchmark 보존 해시: 모두 일치. [보존 목록](../v1.3/edge-flicker/baseline-hashes.json). 원본 소스는 before-source에 보관했습니다. 버려진 AI 얇은 ridge 제한 후보는 [셰이더](../v1.3/edge-flicker/rejected-ridge/composite.wgsl) 및 같은 폴더의 엔진/타입/하네스에 남겼습니다. 최종 production composite/WebGPUEngine/types는 수정 전과 byte-identical입니다.

## 공식 변경의 실제 코드 검토

- [v1.4.7 diff](https://github.com/MONZikWasTaken/Framegen/compare/v1.4.6...v1.4.7): edgeUpsample의 가중치 합이 너무 작거나 유효하지 않으면 기존 bilinearFlow를 반환합니다. 가중치 합을 작은 상수로만 clamp해 잘못된 flow로 바뀌는 경로를 막습니다. 현재 npm 1.4.0의 native-size 직접 warp에는 이 edgeUpsample 함수가 없으므로 해당 수정이 이미 포함됐다고 말할 수 없고, 활성 버그라고 단정할 수도 없습니다.
- [v1.5.4 diff](https://github.com/MONZikWasTaken/Framegen/compare/v1.5.3...v1.5.4): static guard의 halo 항까지 motion이 클 때 꺼지도록 수정했습니다. flowUpsample gate는 색상 매칭 신뢰도가 낮으면 bilinear로 돌아갑니다. 현재 Clarity는 staticGuard 기본 false, 모델/출력 동일 native 크기를 사용합니다. 새 옵션을 1.4.0 API에 존재한다고 가정하거나 런타임을 교체하지 않았습니다. 같은 릴리스 content.js의 컷 후 slot 유지·전달 지연 대책은 확장 스케줄러 수정이며 npm 신경망 호출과 구분됩니다.
- [v1.5.5 diff](https://github.com/MONZikWasTaken/Framegen/compare/v1.5.4...v1.5.5): 마지막 할당 pool 크기를 기준으로 max(16px, 약 2%) dead-band를 적용해 미세 레이아웃 변화 때 frame pool과 표시 queue를 재생성하지 않습니다. 확장 content.js의 변경이며 현재의 고정 native-size Framegen 하네스에는 CSS 크기 기반 pool 재생성 경로가 없습니다.
- 원본 비교 JSON은 references/framegen/edge-review에 저장했습니다. 실제 채택한 외부 코드 없음. 기존 코드 MIT / 가중치 비상업 조건은 유지합니다.

## A/B/C/D 분리와 측정 정의

각 장면은 실제 VP8 keyframe으로 인코딩·디코딩한 24FPS 원본 시각과 48FPS 정답 시각입니다. 8개 연속 쌍, 17개 출력 시점, 선화/반복 무늬/가림/광량 변화/컷/방향 전환 6장면입니다. B는 Framegen 입력에서 제외합니다. A=원본 hold, B=AI만, C=AI+기존 2×업스케일, D=AI+기존 2×업스케일+balanced denoise .25+sharpness .35+색상 pass(100/100). A의 원본 반복을 AI나 실제 제출 FPS로 세지 않습니다.

C/D는 모델 GPU 출력 readback 후 기존 production WebGPUEngine에 진단용으로 다시 업로드했습니다. 후처리 전후 비교는 실제 GPU 픽셀이지만, 이 직렬 CPU 왕복을 실시간 제품 경로라고 주장하지 않습니다. 정답 B도 별도의 후처리 엔진에 같은 기존 설정으로 넣어 비교하며, 후보에 유리하도록 정답을 바꾸지 않았습니다.

윤곽선은 Sobel magnitude >20/source-pixel의 고정 검출기와 대칭 최근접 edge 거리로 계산했습니다. 2× 결과는 gradient 검출 단위와 거리를 원본 픽셀 단위로 정규화합니다. p95 표는 AI 프레임별 p95의 평균이며 전체 모든 edge의 pooled p95와 다릅니다. 정답 edge→생성 edge 거리의 평균이 가장 큰 16px 영역 좌표와 hair/face/eyesMouth/hand/thinLines ROI는 원시 JSON에 있습니다. 얇은 선 두께는 합성 흰 선 4개의 threshold 폭 proxy입니다. 모든 선화의 의미론적 두께 측정은 아닙니다.

시간적 지표는 알려진 강체 이동으로 정렬한 뒤 정답의 raster 변화까지 뺀 edge-distance 잔차 및 밝기 잔차의 절댓값입니다. 가림·컷·광량·방향 변화는 정렬 신뢰도가 낮아 해당 시간 지표를 미측정으로 분리했습니다. Gaussian 휘도 SSIM과 RGB PSNR도 기록했습니다. 검출 임계값에 따른 민감성이 있으므로 작은 차이를 체감 개선이라고 확대하지 않습니다. 최초 해상도 정규화 전 측정은 edge-metrics-first-dense.json에 별도 보존했습니다.

## 원인 분리 및 후보 결과

| 장면/모드 | 후보 | AI PSNR | AI SSIM | edge 평균 px | 프레임 p95 평균 px | 정렬 edge flicker | 밝기 flicker | edge-band 잔상 proxy | 얇은 선 폭 오차 px |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| lineart/B | before | 32.047 | 0.96976 | 0.3047 | 1.7949 | 0.4903 | 7.5037 | 10.5349 | -0.4172 |
| lineart/D | before | 32.486 | 0.97064 | 0.1471 | 0.6875 | 0.2498 | 8.4502 | 10.4726 | -0.2993 |
| lineart/B | dense | 32.042 | 0.96973 | 0.3047 | 1.7949 | 0.4903 | 7.5037 | 10.5349 | -0.4172 |
| lineart/D | dense | 32.481 | 0.97059 | 0.1471 | 0.6875 | 0.2497 | 8.4502 | 10.4725 | -0.2993 |
| lineart/B | edge | 32.047 | 0.96976 | 0.3047 | 1.7949 | 0.4903 | 7.5037 | 10.5349 | -0.4172 |
| lineart/D | edge | 32.485 | 0.97063 | 0.1471 | 0.6875 | 0.2498 | 8.4513 | 10.4739 | -0.2993 |
| repeating/B | before | 18.716 | -0.18881 | 6.3248 | 25.7372 | 7.8893 | 21.8541 | 24.6206 | -0.2898 |
| repeating/D | before | 18.604 | -0.08244 | 1.2598 | 6.2562 | 1.6228 | 24.3154 | 25.3245 | -0.2027 |
| repeating/B | dense | 18.716 | -0.18881 | 6.3248 | 25.7372 | 7.8893 | 21.8541 | 24.6206 | -0.2898 |
| repeating/D | dense | 18.604 | -0.08244 | 1.2598 | 6.2562 | 1.6228 | 24.3154 | 25.3245 | -0.2027 |
| repeating/B | edge | 18.716 | -0.18881 | 6.3248 | 25.7372 | 7.8893 | 21.8541 | 24.6206 | -0.2898 |
| repeating/D | edge | 18.604 | -0.08244 | 1.2598 | 6.2562 | 1.6228 | 24.3154 | 25.3245 | -0.2027 |

1. B에서 이미 오차가 있으므로 모든 문제를 후처리나 출력 타이밍 탓으로 돌릴 수 없습니다. 반복 무늬는 특히 큰 모델 재구성 오차가 남습니다. 오프라인 출력에서도 나타나므로 표시 스케줄러가 유일한 원인은 아닙니다.
2. 선화 D의 밝기 flicker 8.450은 B의 7.504보다 큽니다. 후처리가 밝기 변동을 강조할 수 있지만, 공간 edge-distance flicker는 D에서 줄었습니다. 따라서 샤프닝이 모든 윤곽선 위치 흔들림의 원인이라는 결론도 내리지 않았습니다.
3. dense 후보: 공개 sparseRefine=false만 적용. 원본 모델/런타임 bytes 유지. 선화 raw edge flicker는 0.490286으로 동일했고 PSNR은 32.0468→32.0421dB로 소폭 악화했습니다. 채택하지 않았습니다.
4. edge 후보: AI 생성된 얇은 ridge에서만 기존 unsharp 추가 이득을 제한했습니다. 전체 화면 blur·시간 평균·원본 교체는 쓰지 않았습니다. 선화 D의 밝기 flicker 8.45020→8.45129, edge-band 잔상 proxy 10.47258→10.47389로 개선이 없었습니다. 얇은 선 폭 오차도 그대로였습니다. 후보를 제거했고 production 후처리는 원래 파일과 동일합니다.
5. 컷/광량 제어: 기존 white-C 강한 차이 보호는 실제 C 복사 확인. 이 6장면 중 중간 정도의 컷은 기존 .24 보호 임계값을 넘지 않아 AI 처리가 남았습니다. 기준을 임의로 내려 해결했다고 표시하지 않았습니다.

## PTS·쌍 소유권·보호 전환

각 연속 프레임에는 pairID, A/C PTS, t, plannedPTS, 실제 outputPTS, generated, guard, GPU 출력 readback 완료 시각을 기록했습니다. 진단은 직렬 실행이므로 lateDiscard=false는 실시간 마감 검증의 증거가 아닙니다. 실제 지연·queue·누락은 아래 FPS 하네스에서 따로 검사합니다.

FramegenSession.diagnoseOutput(t,key)를 추가했습니다. GPU 보호 판정과 쌍 메타데이터를 묶어 C 보호 출력이면 C의 실제 PTS와 generated=false/source-C를 반환합니다. 이미 바뀐 pair key는 거부합니다. 기본 runT 경로에는 CPU readback을 추가하지 않았습니다. 이 진단 API는 제품 제출 스케줄러 연결이나 미래 PTS 프레임의 조기 표시 방지를 대신하지 않습니다. 제품 AI 연결 자체가 아직 없어 해당 통합은 남겨 둡니다.

## 같은 6조건 FPS 회귀

이 표의 after는 **후보를 제거한 유지 설정**입니다. 후보를 채택한 개선 엔진 성능이라고 읽으면 안 됩니다. 기존 36초 입력과 3초 준비+30초 관찰, 전수 RGB 진단을 재사용했습니다. 새로운 경로에 저장해 과거 기록을 덮어쓰지 않았습니다.

| 조건 | 기존→현재 Canvas FPS | AI 호출 | 유효 AI RGB | 고유 지문 | 완료 평균/p95 ms | 누락/지연 | queue | GPU 오류 | 종료 buffer/texture |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | --- |
| 720p-24-48 | 47.999→48.000 | 1418 | 1418 | 1440 | 7.692/12.100 | 0/0 | 2 | 0 | 0/0 |
| 720p-30-60 | 60.027→59.999 | 1642 | 1642 | 1796 | 6.614/11.200 | 0/0 | 2 | 0 | 0/0 |
| 720p-60-90 | 89.256→89.798 | 2557 | 2557 | 2692 | 5.726/7.500 | 6/1 | 2 | 0 | 0/0 |
| 1080p-24-48 | 48.000→47.999 | 1440 | 1440 | 1440 | 8.360/13.400 | 0/1 | 1 | 0 | 0/0 |
| 1080p-30-60 | 59.999→59.999 | 1800 | 1800 | 1800 | 7.272/11.200 | 0/0 | 2 | 0 | 0/0 |
| 1080p-60-90 | 88.425→89.665 | 2465 | 2465 | 2689 | 9.023/12.900 | 6/611 | 2 | 0 | 0/0 |

Canvas 평균과 AI 호출·유효 RGB·고유 지문·물리 표시 수는 다릅니다. GPU queue 완료는 커널만의 시간이 아니며, 오디오 및 물리 scanout은 미검증입니다. 60→90은 이번에도 누락·지연과 간격 분포를 보고하며 98% 근접도만으로 안정 통과 판정을 하지 않습니다. 프레임 수 차이는 rAF 위상과 지연에 영향을 받아 모델 품질 개선 수치가 아닙니다.

## 실제 YouTube

지정 [YouTube 2:10~2:16](https://www.youtube.com/watch?v=JuosxgOtXNU&t=130s)는 격리 Chromium에서 재생했습니다. 854×428, rVFC 141개, origin-clean true. [원본 접근 결과](../v1.3/edge-flicker/youtube.json), [원본 프레임](../v1.3/edge-flicker/youtube-native.png). 로그인·DRM·CORS 우회는 없었습니다. CUA 연결 브라우저와 Windows native pipe는 사용 불가여서 개발용 자동 테스트 브라우저를 사용했습니다.

실제 영상에서 캔버스 crop/captureStream으로 기록한 클립의 A/C-only Framegen GPU 추론도 실행했습니다. **라이브 YouTube overlay 통합 검증은 아닙니다.** 실제 추론 입력 쌍 FPS 5.780, PSNR 15.895dB. B를 숨겨 두므로 원본 source pair cadence는 낮아지며, 재기록의 PTS와 원래 YouTube PTS는 동일하다고 주장하지 않습니다. 원본 rVFC PTS는 sidecar에 보존합니다. [실제 AI 결과](../v1.3/edge-flicker/youtube-framegen.json).

추가 제한: 실제 캡처에서 원본 PTS 최대 간격은 458.333ms였습니다. 현재 A/C 입력 간격도 nominal 24FPS와 다릅니다. 실제 영상 AI 출력이 A/C와 다른지는 전체 RGB로 별도 확인했지만, 이 샘플을 정상 원본 FPS의 품질 개선 증거로 사용하지 않습니다. 실제 샘플 ghost proxy 기존 105.972→AI 121.694로 악화했습니다.

자연 영상의 신뢰할 수 있는 움직임 정렬·연속 윤곽선 개선·머리카락 안정화는 확인하지 못했습니다. 현재 출력 모델의 근본적인 contour 안정성 개선은 미해결입니다.

## 검사·파일·재개

빌드 통과, 단위 86개 통과, 브라우저 44개 통과. [빌드](../v1.3/edge-flicker/final-build.log), [단위](../v1.3/edge-flicker/final-unit.log), [브라우저](../v1.3/edge-flicker/final-browser.log). 컷 실제 PTS/폐기된 쌍 key 및 연속 A/C·기존 후처리·GPU 해제 검사를 추가했습니다.

- [같은 프레임의 정답·기존·실패 후보 실제 픽셀 crop](../v1.3/edge-flicker/lineart-candidate-contact.png)
- [버린 ridge 후보의 고정 측정 보존본](../v1.3/edge-flicker/rejected-ridge/edge-metrics.json)
- [전체 edge 수치·최악 ROI·전환별 프레임 기록](../v1.3/edge-flicker/edge-metrics.json)
- GPU 프레임과 진단 JSON: docs/v1.3/edge-flicker/{lineart,repeating,occlusion,flash,cut,turn}.json 및 같은 이름의 PNG.
- 소스: src/harness/framegenEdges.ts, src/ai/FramegenSession.ts, src/harness/framegenValidation.ts, tests/browser/rife.spec.ts.
- 스크립트: framegen-edges.mjs, analyze-framegen-edges.py(SciPy 1.16.3), verify-youtube-edge.mjs, verify-youtube-framegen.mjs, report-framegen-edges.mjs. FPS runner는 별도 output/input root 환경변수만 추가.

```powershell
npm run build
node scripts/framegen-edges.mjs # 현재 before/dense 재현; 버린 edge 후보 소스는 rejected-ridge 참고
.venv-rife/Scripts/python.exe scripts/analyze-framegen-edges.py
node scripts/verify-youtube-edge.mjs
node scripts/verify-youtube-framegen.mjs
.venv-rife/Scripts/python.exe scripts/analyze-youtube-edges.py
$env:CLARITY_FPS_ROOT='docs/v1.3/edge-flicker/fps-new-run'
$env:CLARITY_FPS_INPUT_ROOT='docs/v1.3/framegen-fps'
node scripts/framegen-fps-matrix.mjs
npm run test
npm run test:browser
node scripts/report-framegen-edges.mjs
```

다음에는 현재 npm에 없는 flow/mask 신뢰도 API를 있다고 가정하지 말고, 실제 영상의 움직임 정렬과 raw 신경망 출력의 endpoint 불일치부터 조사해야 합니다. 실패한 dense/ridge 후보를 기본 적용하지 마세요. 새 학습/모델 교체/ONNX 재변환/제품 엔진 재작성은 하지 않았습니다.
