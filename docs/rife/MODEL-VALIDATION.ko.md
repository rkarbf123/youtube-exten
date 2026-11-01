# 모델 검증

갱신 2026-11-01 (한국 날짜). 제품 통합 미완료.

Framegen의 Manifest V3 확장 페이지 로컬 모델 검증도 통과했습니다. 원격 요청 0, CSP 오류 0, GPU 오류 0. [MV3 원시 기록](../v1.3/framegen/mv3.json). YouTube content-script 연결을 뜻하지 않습니다.

Framegen 1.4.0, v7-small, 2945824바이트. npm에 실제 설치한 버전을 고정했습니다. 가중치 SHA-256: `76428e1769f742a2aaad79996f2eb57cc29388a6dc21c242386ca9110c0bb397`. JSON SHA-256: `6fa80133638949109d11fec3efb0421fbbc556f9bcff2fe2239b410154d8e7e3`. 런타임 SHA-256: `da2d3fa8f97d8628b7d5a47c01aa1cad99095ad3d2247220d7142718ab1110c8`. 실제 타입 정의의 createRT/prepPair/runT/destroy를 사용합니다. exports에서 types가 빠진 1.4.0 패키지는 tsconfig paths로 **패키지의 원래 index.d.ts**를 지정했습니다.

코드는 MIT, 가중치는 비상업 연구·개인 사용이며 고지를 동봉한 원본 재배포만 허용됩니다. 원본 bin/json은 수정하지 않았고, [가중치 고지](../../public/models/framegen/WEIGHTS_LICENSE.md)와 [코드 고지](../../public/models/framegen/LICENSE)를 포함했습니다. [공식 가중치 조건](https://github.com/MONZikWasTaken/Framegen/blob/main/WEIGHTS_LICENSE.md). 가중치 고지에는 교사 모델·학습 자료의 라이선스 체인이 완전히 자유롭다고 확인되지 않았다는 설명도 있습니다. 현재 로컬 비상업 평가 범위이며 공개 배포 전 이 조건을 다시 검토해야 합니다. 단순히 무료로 배포하면 모든 권리 문제가 해소된다고 판단하지 않습니다.

추가로 공식 Practical-RIFE 4.25.lite 실제 checkpoint도 확보·검증했습니다. 추론 가중치는 strict 로드했고 공식 소스가 주석으로 제외한 teacher/caltime 학습 전용 키만 제외했습니다. 원본 5622700 파라미터, ONNX 24966876바이트, 128×128 BGR NCHW 고정. 세 시점 CPU PyTorch→ONNX 최대 오차 0.000007808208465576172. 체크포인트 SHA: `81cdba223fe72a120130cc8552e5d2ecac824259d406f0c15323b3decf96b8b1`, ONNX SHA: `c9b214e7b36b3721d28994221e551240580b9916b2f49da7bdc983b9a166c8e5`. [변환 원본](../v1.3/model-conversion.json).

ONNX Runtime Web **1.22.0**에서 실제 GPU-buffer 입력/출력과 GPU Canvas 표시 후 PyTorch 대비 정확도를 통과했습니다. CPU fallback은 session config로 금지했습니다. readback은 이 검증의 오차 측정에만 사용합니다. GPU 버퍼를 getData()로 읽으면 location이 cpu로 바뀌므로 최종 기록은 추론 직후 위치와 진단 후 위치를 구분합니다. [GPU 기록](../v1.3/webgpu-validation.json).

1.31.1은 큰 수치 오차로 채택하지 않았습니다([실패](../v1.3/ort-1.31-numerical-failure.json)). 특정 GridSample 연산만의 버그라고 확정하지 않았습니다. 1.23.2의 native/JSEP 파일 조합 오류도 [보존](../v1.3/ort-1.23-runtime-failure.json)했습니다. 이 단계는 독립 검증이며 고해상도 ONNX 실시간 성공을 의미하지 않습니다.
