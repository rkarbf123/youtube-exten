import { readFile,writeFile,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const quality=await read('docs/review/quality-comparison.json');
const before=await read('docs/review/baseline-balanced-youtube.json'),after=await read('docs/review/improved-youtube.json');
const units=await read('docs/review/unit-results.json'),browsers=await read('test-results/results.json');
await copyFile('test-results/results.json','docs/review/browser-results.json');
const localBefore=await read('docs/review/baseline-presentation.json'),localAfter=await read('docs/review/improved-presentation.json');
const compatibility=await read('docs/review/compatibility/youtube-validation.json'),installed=await read('docs/review/browser-validation.json');
const fmt=(v,n=2)=>Number(v).toFixed(n);
const q=quality.results[0];
const qualityRows=q.cases.map(c=>`| ${c.name} | ${fmt(c.baseline.psnr)} | ${fmt(c.improved.psnr)} | +${fmt(c.improved.psnr-c.baseline.psnr)} |`).join('\n');
const range=values=>`${fmt(Math.min(...values))}–${fmt(Math.max(...values))}`;
const performanceRows=quality.results.map(r=>{
  const repeats=r.benchmarkRepeats??[r.benchmark];
  return `| ${r.backend} | ${range(repeats.map(x=>x.baselineMedianMs))} | ${range(repeats.map(x=>x.improvedMedianMs))} | ${fmt(Math.max(...repeats.map(x=>x.baselineP95Ms)))} → ${fmt(Math.max(...repeats.map(x=>x.improvedP95Ms)))} |`;
}).join('\n');
const verified=before.verifiedEnhancedPixels&&after.verifiedEnhancedPixels;
const md=`# 업스케일링 검증 및 개선 보고서 — v1.1

검증일: 2026-10-31, Asia/Seoul. 이전 배포본은 <code>baseline-dist</code>에 보존하고 원본 셰이더 SHA256을 확인한 뒤 비교했습니다. 이전 코드나 실제 실행 결과를 추정으로 대체하지 않았습니다.

## 1. 기존 기능이 작동했는가

**검증한 영상에서는 실제로 작동했습니다.** 보존한 v1.0 확장 프로그램을 별도 Chromium 프로필에 로드하고 공개 유튜브 영상 [Me at the zoo](${before.url})의 실제 320 × 240 프레임을 처리했습니다. GPU 처리 후 화면 캡처와 원본 표시 캡처의 픽셀이 달랐습니다. [기존 실행 기록](baseline-balanced-youtube.json), [기존 좌우 비교](baseline-balanced-youtube-split.png).

사용자가 실행 중이던 개인 브라우저의 상태를 직접 검사한 것은 아닙니다. 이 결과는 모든 영상·GPU·DRM 스트림의 호환성을 의미하지 않습니다.

체감이 약할 수 있는 코드상의 이유는 다음과 같습니다.

- 기본 적응형은 낮은 강도의 Eco/Fast로 시작합니다. 기존 Balanced의 Mitchell B=C=1/3 필터도 선을 부드럽게 만들 수 있었습니다. 기존 Fast는 AI 복원이 아니라 매우 가벼운 공간 보간입니다.
- 기존 코드는 매 프레임 처리 중 캔버스를 숨겼습니다. 로컬 동일 클립에서 보정 화면 표시 시간은 ${fmt(localBefore.enhancedVisiblePercent)}%, 실제 유튜브 Balanced 측정에서는 ${fmt(before.coverage.enhancedVisiblePercent)}%였습니다. 나머지 시간에는 원본이 보이므로 효과가 섞였습니다.
- 플레이어가 소스보다 작거나 배율이 화면 크기로 제한되면, 2×/4×를 선택해도 실제 출력이 달라지지 않을 수 있습니다. 이 제한은 불필요한 과대 텍스처 할당을 피하기 위한 것이며, 새 UI는 실제 배율과 ‘확대 없음’을 명시합니다.
- 설치 시 비동기 기본값 저장이 최신 설정 저장과 경합할 수 있는 경로도 제거했습니다. 기본값은 읽을 때 제공하므로 설치 이벤트가 사용자 변경을 다시 덮어쓰지 않습니다.

이 검증 영상에서 프레임 접근/CORS/셰이더 실패가 지속된 것은 아니며, ‘유튜브 프레임을 전혀 처리하지 않는다’는 결론은 근거가 없었습니다.

## 2. 수정 내용

- **Balanced 재구성 교체:** AMD FSR1 EASU 기반 12탭 방향·비등방성 재구성. 4개 인접 소스 픽셀의 범위로 결과를 제한하여 링잉을 억제합니다. 별도 샤프닝 강도를 올리는 방식이 아닙니다.
- **실사:** 같은 12개 샘플을 재사용하여 약한 대비의 질감에는 보간형 cubic 커널을, 강한 경계에는 EASU를 적용합니다. 노이즈 설정과 경계 일관성에 따라 커널을 조절합니다.
- **애니메이션:** 윤곽의 방향성을 더 유지하며, 색 경계가 번지지 않도록 RGB/휘도 차이를 함께 사용한 양방향 노이즈 완화를 적용합니다. 실제 Anime4K로 표시하지 않습니다.
- **표시 구조:** <code>render()</code>는 재사용하는 오프스크린 텍스처까지만 계산합니다. 완료·유효성·최신 프레임 여부를 확인한 뒤 <code>present()</code>가 화면에 제출합니다. 다음 프레임 계산 중에는 아직 신선한 직전 결과를 유지하고, 오래되거나 실패하면 원본으로 전환합니다.
- **작업량:** 재생 중 설정/resize 이벤트로 동일 프레임을 강제 중복 처리하지 않습니다. 정지 상태의 명시적 재처리만 한 번 수행합니다. 큐 깊이는 여전히 최대 1입니다. 원본 비교 모드는 불필요한 재구성·노이즈 패스를 생략합니다.
- **적응형 유지:** 측정 기반 승급/강등, EMA, 최소 관찰창, 히스테리시스와 쿨다운을 유지합니다. 최초 6개 드라이버 준비 샘플은 정상 상태 판단과 분리하고, 성능 여유가 지속되면 두 관찰창 후 품질을 올립니다. 초기에도 표시 마감 시간은 지킵니다.
- **WebGL:** 기준 영상 좌표를 WebGPU와 같은 좌상단 기준으로 통일했고, 완료 확인의 중첩 타이머 지연을 줄였습니다. 완료 메시지 채널/동기 객체는 종료 시 정리합니다.
- **UI:** 실사/애니메이션 선택, 원본 전환, 동일 프레임 좌우 슬라이더, 실제 알고리즘·배율·보정 표시 시간·원본 대체 여부를 추가했습니다. 정지/설정 재그리기는 처리 FPS를 부풀리지 않습니다. 실제 보정 화면과 확대 배율이 모두 유효할 때만 ‘업스케일링 작동 중’입니다.

AMD 원본과 MIT 라이선스는 <code>references</code> 및 배포본 <code>licenses/FSR-LICENSE.txt</code>에 포함했습니다. 공식 Anime4K Thin 구현은 검토했으나 다중 패스 포트를 별도로 검증하지 않았으므로 활성화하지 않았습니다. Neural/Ultra/HDR도 사용할 수 없다고 명시합니다.

- **정지 화면 결함 수정:** 정지 중 전체화면/resize의 첫 준비 프레임에도 재생 중 마감 시간을 적용하여 결과를 버리던 경로를 수정했습니다. 정지된 동일 프레임에는 재생 마감 대신 1.5초 실패 제한을 적용하고, 준비 지연은 재생 품질 강등 판단에서 제외합니다. 실제 GPU 완료를 지연시키는 회귀 테스트를 추가했습니다.
- **해상도 표기:** 처리 해상도를 입력 전처리 크기와 혼동하지 않도록 실제 재구성 대상 크기로 표시합니다. 노이즈 전처리는 원본 크기, 재구성과 최종 합성은 출력 크기입니다. 원본 비교에서는 재구성 생략이라고 표시합니다.

## 3. 실제 재구성 품질 비교

샤프닝 **0**으로 비교했습니다. 동일한 고해상도 합성 원본을 결정적인 3×3 면적 평균으로 축소한 뒤, 보존한 기존 셰이더와 새 셰이더를 동일 소스/출력 크기로 실행했습니다. 기준 원본 대비 PSNR(dB, 높을수록 작은 제곱 오차):

| 입력 | 기존 | 개선 | 차이 |
| --- | ---: | ---: | ---: |
${qualityRows}

선화 개선은 약 1.25dB, 질감은 약 2.23dB였고 노이즈 케이스의 개선은 약 0.07dB로 작았습니다. 이 세 합성 입력의 결과를 실제 영화/애니메이션 전체의 품질 점수로 일반화할 수 없습니다. 흐릿한 선과 텍스처가 더 잘 보존되는지 PNG도 시각적으로 확인했습니다.

독립적인 CPU EASU 기준 구현과 GPU 결과의 최대 채널 오차는 **WebGPU ${quality.results[0].maxReferenceError}/255, WebGL2 ${quality.results[1].maxReferenceError}/255**였습니다. [원시 수치](quality-comparison.json), [비교 이미지 페이지](comparison.html).

실제 유튜브에서 접근이 허용된 단일 프레임도 PNG로 캡처하여 기존/개선 알고리즘에 같은 입력으로 공급했습니다. 이 실제 프레임은 고해상도 정답이 없으므로 화질 점수 향상이라고 주장하지 않고, 출력 차이와 육안 비교 자료로만 제공합니다. [기존](captured-youtube-baseline.png), [실사 개선](captured-youtube-natural.png), [애니메이션 처리](captured-youtube-animation.png), [조건/차이 수치](captured-frame-comparison.json).

## 4. 성능과 실제 표시

검증 GPU API 어댑터: ${quality.adapter?.vendor??'unknown'} / ${quality.adapter?.architecture??'unknown'}, software fallback=${String(quality.adapter?.isFallbackAdapter)}. 제조사 정보는 진단 기록에만 쓰며 자동 품질 판단에는 사용하지 않습니다.

동일 640 × 360 → 1920 × 1080 입력/출력, 각 실행 6회 준비 후 30회 측정, 백엔드별 3회 반복. 아래 값은 **CPU + 큐 + GPU 완료 대기 시간**이며 GPU timestamp가 아닙니다. 두 알고리즘에 같은 현행 백엔드/완료 확인 방식을 사용해 재구성 비용을 비교했습니다.

| 백엔드 | 기존 중앙값 범위(ms) | 개선 중앙값 범위(ms) | 세 실행 중 최대 P95: 기존 → 개선(ms) |
| --- | ---: | ---: | ---: |
${performanceRows}

일부 P95는 증가했고 실행 간 편차도 있습니다. 모든 환경에서 추가 비용이 없다고 주장하지 않습니다. 처리 패스와 대형 텍스처 수를 늘리지 않았고(기본 3개), 16탭 재구성의 샘플 수를 12개로 줄였지만 새 방향/질감 계산의 ALU 비용은 있습니다. 실제 GPU 실행 시간만을 분리한 측정도 아닙니다.

실제 유튜브 재생의 마지막 측정은 소스 ${fmt(after.afterPlayback.metrics.sourceFPS)} FPS, 처리 ${fmt(after.afterPlayback.metrics.processedFPS)} FPS, 완료 지연 EMA ${fmt(after.afterPlayback.metrics.latencyMs)}ms, 렌더링 실패 ${after.afterPlayback.metrics.failures}회였습니다. 5초 구간의 보정 표시 비율은 ${fmt(after.coverage.enhancedVisiblePercent)}%였습니다. 기존 ${before.playback.dimensions.output.width} × ${before.playback.dimensions.output.height}와 개선 ${after.playback.dimensions.output.width} × ${after.playback.dimensions.output.height}로 플레이어 크기가 약간 달라 이 수치를 정밀한 전후 속도 비교로 취급하지 않습니다.

로컬 동일 클립·동일 855 × 480 출력의 표시 시간은 ${fmt(localBefore.enhancedVisiblePercent)}% → ${fmt(localAfter.enhancedVisiblePercent)}%였습니다. 이는 ‘효과가 약한 프레임과 원본이 섞여 보이는’ 표시 경로를 개선한 근거입니다. DOM 표시 비율은 실제 모니터 스캔아웃 측정이나 GPU 사용률이 아닙니다.

## 5. 실제 유튜브와 오류 처리 검증

실제 처리 픽셀 표시 검증: **${verified?'기존/개선 모두 확인':'보고서의 상세 실패 사유 확인 필요'}**. 개선판은 실제 320 × 240 유튜브 프레임을 ${after.playback.dimensions.output.width} × ${after.playback.dimensions.output.height} 출력으로 표시했습니다. 정지된 같은 프레임에서 보정 캔버스 표시/숨김 compositor 캡처를 비교했습니다. 원본 비교 쪽 평균 차이 ${fmt(after.compositor.left,3)}/255, 처리 쪽 ${fmt(after.compositor.right,3)}/255. 이는 처리 픽셀이 화면에 도달했다는 증거이며 주관적 화질 점수는 아닙니다.

샤프닝, 노이즈 제거, Fast/Balanced, 실사/애니메이션 선택별로 실제 화면 픽셀이 바뀌었습니다. 기준으로 다시 돌아간 natural 설정은 차이가 0이었고, 원본 전환에서는 <code>upscalingActive=false</code>, <code>presentation=original</code>이었습니다. [개선 실행 기록](improved-youtube.json), [실제 유튜브 좌우 화면](improved-youtube-split.png).

브라우저 보안이나 DRM을 우회하지 않았습니다. 실제 cross-origin taint를 일으키는 로컬 fixture, SecurityError, GPU 미지원과 장치 손실 테스트에서 보정 화면을 제거하고 원본 재생을 유지했습니다. 보호된 실제 DRM 스트림을 직접 테스트한 것은 아닙니다.

## 6. 빌드 및 테스트 결과

- <code>npm run build</code>: strict TypeScript, Manifest V3, 번들/셰이더/아이콘/샘플/라이선스 경로 검사 통과.
- <code>npm run test</code>: **${units.numPassedTests}개 통과**, 실패 ${units.numFailedTests}개. [원시 기록](unit-results.json)
- <code>npm run test:browser</code>: **${browsers.stats.expected}개 통과**, 실패 ${browsers.stats.unexpected}개, 건너뜀 ${browsers.stats.skipped}개. [원시 기록](browser-results.json)
- 실제 WGSL/GLSL 컴파일, 픽셀/색/방향/링잉, 기준 EASU 오차, 샤프닝 없는 재구성 오차, 팝업 저장, 원본 비교/레이어, seek/resize/pause, 실제 CORS 제한, 장치 손실 복구, 텍스처 재사용/해제, bounded queue/measurement history를 포함합니다.
- 최종 실제 유튜브의 표준/극장/전체화면/탐색·1.25배속/창 크기 변경: **${compatibility.layoutChecks.every(c=>c.processedVisible)?'5개 조건 모두 보정 표시와 정렬 조건 확인':'상세 기록에서 미확인 조건 확인 필요'}**. 정지 상태 전체화면도 포함하며, 적응형은 실제로 **${compatibility.stats.profile}** 프로필까지 승급했습니다. [최종 화면 전환 기록](compatibility/youtube-validation.json)
- 설치된 Chrome ${installed[0].version}, Edge ${installed[1].version}: 로컬 GPU 픽셀 검사 9개 × 두 백엔드 × 두 브라우저가 모두 통과했고 실제 로컬 영상 처리도 확인했습니다. 확장 프로그램 전체 연동 검사는 bundled Chromium에서 수행했으며, 개인 Chrome/Edge 프로필에 자동 설치하지 않았습니다. [설치 브라우저 기록](browser-validation.json)

## 7. 확인하지 못한 범위와 사용법

개인 브라우저 프로필에서 현재 설치된 구버전의 상태, 다양한 GPU/드라이버, 장시간 4K/60, HDR, 실제 DRM/라이브/Shorts, 실제 화질 메뉴 변경과 브라우저 줌·다중 모니터, 자막의 모든 레이아웃, 실제 영상의 객관적 고해상도 정답 대비 화질은 검증하지 못했습니다. 합성 테스트의 PSNR 개선은 이 한계를 없애지 않습니다. 존재하지 않는 디테일을 복원하거나 모든 영상이 확연히 좋아진다고 보장하지 않습니다.

Chrome <code>chrome://extensions</code> 또는 Edge <code>edge://extensions</code>에서 **Clarity 다시 로드** 후 **유튜브 탭도 새로고침**하십시오. 새로 설치한다면 개발자 모드 → 압축해제된 확장 프로그램 로드 → 프로젝트 <code>dist</code> 폴더를 선택합니다. GPU 여유에 따라 자동 조절하려면 Adaptive + Engine Auto를 유지합니다. 효과를 정지 프레임에서 확인할 때는 Engine Balanced, 영상 종류 선택, 원본 전환/좌우 비교를 사용하십시오. 출력 배율이 1× 이하이면 UI에 확대 없음으로 표시됩니다.
`;
await writeFile('docs/review/REVIEW.ko.md',md);
const groups=[['실제 유튜브에서 캡처한 동일 프레임',['captured-youtube-baseline.png','captured-youtube-natural.png','captured-youtube-animation.png'],['기존 Balanced · 샤프닝 0','새 실사 모드 · 샤프닝 0','새 애니메이션 모드 · 샤프닝 0']],...q.cases.map(c=>[c.name,[`webgpu-${c.name}-truth.png`,`webgpu-${c.name}-baseline.png`,`webgpu-${c.name}-improved.png`],['고해상도 합성 기준','기존 Balanced','개선 Balanced']])];
const html=`<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Clarity 1.1 실제 픽셀 비교</title><style>body{margin:0;background:#111a15;color:#e4eee7;font:15px/1.7 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:32px}h1{font-size:29px}h2{font-size:20px;margin-top:45px}p{color:#afc3b6}a{color:#b4e3c6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{display:block;width:100%;height:auto;border:1px solid #405547;border-radius:8px}figcaption{font-size:13px;margin:8px 0;color:#acc5b4}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style><main><h1>Clarity 1.1 — 실제 GPU 출력 비교</h1><p>미리 만든 개선 효과가 아닌, 동일 소스에 실제 기존/개선 셰이더를 실행한 PNG입니다. 모든 비교는 샤프닝 0입니다. 이미지를 클릭하면 원본 크기로 열립니다. 실제 유튜브 프레임에는 고해상도 정답이 없습니다.</p><a href="REVIEW.ko.md">검증 조건·수치·한계 보고서</a>${groups.map(([title,files,labels])=>`<h2>${title}</h2><div class="grid">${files.map((file,i)=>`<figure><a href="${file}"><img src="${file}" alt="${labels[i]}" loading="lazy"></a><figcaption>${labels[i]}</figcaption></figure>`).join('')}</div>`).join('')}</main></html>`;
await writeFile('docs/review/comparison.html',html);
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
await writeFile('docs/review/release-validation.json',JSON.stringify({version:(await read('dist/manifest.json')).version,unitTests:units.numPassedTests,unitFailures:units.numFailedTests,browserTests:browsers.stats,actualYouTubePixels:verified,actualYouTubeLayoutChecks:compatibility.layoutChecks.map(c=>({name:c.name,passed:c.processedVisible})),adapter:quality.adapter,hashes:{content:await sha('dist/content.js'),currentWGSL:await sha('src/shaders/common.wgsl'),preservedV1WGSL:await sha('tests/fixtures/v1/common.wgsl')}},null,2));
console.log(`Review written: ${units.numPassedTests} unit tests, ${browsers.stats.expected} browser tests, YouTube pixels verified=${verified}.`);
