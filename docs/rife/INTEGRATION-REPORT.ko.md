# 통합 상태

실제 모델을 사용하는 독립 하네스까지 구현했습니다. **Clarity 제품의 VideoProcessor/InterpolationSession에 AI 엔진을 아직 연결하지 않았습니다.** 기존 Optical Flow와 공간·색상 경로는 보존합니다. 설치 ZIP은 기존 v1.2.1이며 새 v1.3 완성 ZIP을 만들지 않았습니다.

Framegen 모델 로드·고정 해시·GPU texture 입출력·쌍 ID/PTS 검증·GPU 컷 보호·실제 A/B/C 평가·720p 30초 관찰을 수행했습니다. ONNX RIFE 대안도 별도 하네스로 보존합니다. 일반 추론에는 readback이 없고 품질 진단에서만 명시적으로 사용합니다.

남은 단계: 자연 애니메이션 정답 A/B/C와 반복 무늬 안전성, 제품 엔진 선택/상태 UI, 모델별 성능 예산, 기존 GPU 장치·출력 pass 연결, late-result 폐기와 복구 정책, YouTube content-script의 로컬 자산 접근·CSP 연결, YouTube, 1080p, 장시간 자원 검증. 1080는 Framegen /16 요구 때문에 1088 padding/crop 또는 별도 내부 크기의 정확한 검증이 필요합니다.

최종 빌드 통과 기록 [final-build.log](../v1.3/final-build.log), 단위 86개, 브라우저 통과 40개/실패 0개(진행 중이면 미집계). [전체 브라우저 로그](../v1.3/browser-tests.log). 과거 v1.2.1 결과를 이번 통과로 대신하지 않습니다. [재개 문서](../../RIFE_PROGRESS.md).
