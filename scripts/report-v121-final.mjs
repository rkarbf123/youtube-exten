import {readFile,writeFile} from 'node:fs/promises';
const root='docs/v1.2.1/',read=async n=>JSON.parse((await readFile(root+n+'.json','utf8')).replace(/^\uFEFF/,''));
const f=(x,n=2)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(n):'—';
const after=await read('after-matrix'),before=await read('baseline-matrix'),br=await read('baseline-repeat'),ar=await read('after-repeat'),sustain=await read('after-sustain'),signature=await read('after-signature'),ab=await read('ablation'),yt=await read('youtube-v121'),browsers=await read('browser-validation'),layout=await read('youtube-validation'),positions=await read('regression/stream-positions');
const lines=['# 최종 측정 요약','',`작성: ${new Date().toISOString()} (UTC; 한국 시각은 +9시간)`,'',
'## 검증 환경과 우선 목표','',`WebGPU adapter: ${JSON.stringify(ar.adapter??br.adapter)}. 일반 모드의 feature 목록은 adapter 지원 기능이며 device에서 모든 기능을 켰다는 뜻은 아닙니다. Chromium ${after.browser}, headless, RTX 4060 Ti, Windows 2560×1440, WMI 143Hz. 합성 입력 rAF는 약 144Hz입니다.`,'',
'| 크기 | 60→120 전 평균 | 후 평균 | 후 p50 / p10 / p01 | 후 생성 수 | 후 보정 표시 % | 후 총 시간차 평균 ms |','| --- | ---: | ---: | --- | ---: | ---: | ---: |'];
for(const h of [144,360,720,1080,1440]){const a=after.rows.find(r=>r.height===h&&r.source===60&&r.target===120&&!r.diagnostic),b=before.rows.find(r=>r.height===h&&r.source===60&&r.target===120&&!r.diagnostic);lines.push(`| ${a.width}×${h} | ${f(b?.meanSubmittedFPS)} | ${f(a.meanSubmittedFPS)} | ${f(a.fps?.p50)} / ${f(a.fps?.p10)} / ${f(a.fps?.p01)} | ${a.generated} | ${f(a.visible?.mean)} | ${f(a.delay?.mean)} |`);}
lines.push('','60→120 진단의 제출별 총 시간차 최대 / 원본 표시 대비 추가 지연 최대(ms): '+after.rows.filter(r=>r.diagnostic).map(r=>`${r.height}p ${f(r.profile?.stages?.['timeline.totalMediaSkewMs']?.max)} / ${f(r.profile?.stages?.['timeline.additionalDelayMs']?.max)}`).join('; ')+'. 총 시간차가 기존 45ms보다 작은 조건의 개선은 100ms 총 상한 완화가 필요한 결과가 아닙니다. 화면 유지 중의 지연은 이 제출 시점 값에 포함되지 않습니다.');
const normal=after.rows.filter(r=>!r.diagnostic),limited=normal.filter(r=>r.error||r.meanSubmittedFPS<r.target*.98);
lines.push('',`일반 45조건 중 평균이 목표의 98% 미만이거나 실행 실패한 조건: ${limited.length}개. ${limited.map(r=>`${r.height}p ${r.source}→${r.target}: ${f(r.meanSubmittedFPS)} ${r.error??''}`).join('; ')||'이 기준의 미달 없음'}. 모든 구간의 매 프레임 마감 달성을 뜻하지 않습니다. [전체 45조건·진단·폐기 표](PERFORMANCE.md).`,'',
'## 반복 및 지속성','',
'720p 60→120, 각 3초 준비 후 10초 이상을 3회 반복했습니다. 전후를 동시 실행하지 않았습니다.','',
'| 버전 / 회차 | 평균 | p10 / p01 | 중간 생성 수 | 보정 표시 % | active / created / maximum textures |','| --- | ---: | --- | ---: | ---: | --- |');
for(const [name,report]of [['전',br],['후',ar]])for(const r of report.rows)lines.push(`| ${name} ${(r.repeat??0)+1} | ${f(r.meanSubmittedFPS)} | ${f(r.fps?.p10)} / ${f(r.fps?.p01)} | ${r.generated} | ${f(r.visible?.mean)} | ${r.resources?.active} / ${r.resources?.created} / ${r.resources?.maximum} |`);
for(const r of sustain.rows)lines.push('',`60초 지속 관찰: 실제 ${f(r.elapsedMs/1000)}초, 평균 ${f(r.meanSubmittedFPS)}FPS, p50/p10/p01 ${f(r.fps?.p50)}/${f(r.fps?.p10)}/${f(r.fps?.p01)}, 생성 ${r.generated}, 보정 표시 ${f(r.visible?.mean)}%. 텍스처 active/created/maximum ${r.resources?.active}/${r.resources?.created}/${r.resources?.maximum}. 16초 입력의 루프 초기화를 포함합니다.`);
lines.push('','[전 반복](baseline-repeat.json), [후 반복](after-repeat.json), [60초](after-sustain.json).','',
'## 분리 벤치마크 A/B/C/D','',
'A는 원본 해상도·원본 FPS GPU 출력이며 공간 확대·색상 변화·보간을 끕니다. B는 진단 전용 120FPS 시간축과 Canvas2D 원본 반복 출력입니다. B의 생성 프레임 수는 0입니다. A/B는 3초 준비 후 10초 관찰했습니다.','',
'| 모드 | 전 FPS | 후 FPS | 의미 |','| --- | ---: | ---: | --- |');
for(const mode of ['A','B']){const b=ab.find(r=>r.variant==='baseline'&&r.mode===mode),a=ab.find(r=>r.variant==='after'&&r.mode===mode);lines.push(`| ${mode} | ${f(b?.FPS)} | ${f(a?.FPS)} | ${mode==='A'?'원본 FPS 출력 회귀':'반복 출력만; 실제 보간 아님'} |`);}
lines.push('','C는 두 입력의 움직임 계산과 중간 warp만 실행하며 Canvas present와 출력 스케줄러를 제외했습니다. 2초 준비, 10초 측정입니다. 반복 처리에는 테스트용 Canvas 입력 생성·업로드·분석 readback·오류 scope 완료가 포함되므로 최대 비동기 보간 처리량으로 해석하지 않습니다. GPU timestamp pass 값을 별도로 제시합니다.','',
'| 버전 / 크기 | 쌍/초 | downsample GPU 평균 ms | flow GPU 평균 / p95 ms | warp GPU 평균 ms |','| --- | ---: | ---: | --- | ---: |');
for(const r of ab.filter(r=>r.mode==='C')){const s=r.profile.stages;lines.push(`| ${r.variant} ${r.width}×${r.height} | ${f(r.pairs*1000/r.elapsedMs)} | ${f(s['gpu.capture.pass0Ms']?.mean,4)} | ${f(s['gpu.capture.pass1Ms']?.mean,4)} / ${f(s['gpu.capture.pass1Ms']?.p95,4)} | ${f(s['gpu.warp.pass0Ms']?.mean,4)} |`);}
lines.push('','D는 위 45조건 전체 파이프라인입니다. A가 원본 FPS를 유지하고 B가 약 120개 반복 화면을 제출하는지, C의 GPU 커널 시간이 8.33ms 예산에 비해 어떤지, D가 어디에서 제출을 놓치는지 함께 비교하세요. GPU 커널·CPU 통지·화면 타이밍을 같은 수치로 합치지 않았습니다. [원시 A/B/C](ablation.json).','',
'## 진단 비용 및 정상 경로','',
'| 60→120 크기 | 일반 FPS | 진단 FPS (서명 끔) | 차이 % |','| --- | ---: | ---: | ---: |');
for(const h of [144,360,720,1080,1440]){const a=after.rows.find(r=>r.height===h&&r.source===60&&r.target===120&&!r.diagnostic),d=after.rows.find(r=>r.height===h&&r.diagnostic);lines.push(`| ${a.width}×${h} | ${f(a.meanSubmittedFPS)} | ${f(d.meanSubmittedFPS)} | ${f((d.meanSubmittedFPS/a.meanSubmittedFPS-1)*100)} |`);}
for(const r of signature.rows)lines.push('',`선택적 서명 켬 별도 조건 256×144 60→120: ${f(r.meanSubmittedFPS)}FPS, 최근 고유 표본 ${r.finalStats?.temporal?.uniqueSamples}. 서명 readback 통지 평균 ${f(r.profile?.stages?.signatureReadbackWaitMs?.mean,4)}ms이며 비동기입니다. 일반/진단 표의 단일 실행 차이는 실행 변동을 포함하므로 순수 계측 비용의 정밀 추정이 아닙니다.`);
lines.push('','## 실제 YouTube','',
'실제 공개 URL을 확장 프로그램을 로드한 Chromium으로 열었습니다. 1080p 목표, 자동 품질 조절, Balanced/auto, 120FPS 목표, 색상 중립입니다. 가능한 영상은 45초로 탐색한 뒤 3초 준비하고 각 모드를 10초 이상 측정했습니다. URL·플레이어·디코드 프레임 수·스크린샷은 [원시 기록](youtube-v121.json)에 있습니다. 합성 페이지나 가짜 개선 이미지를 사용하지 않았습니다. 오디오는 muted이며 실제 청각적 동기화는 검증하지 않았습니다.','',
'| 실제 URL | 모드 | 측정 원본 FPS | Canvas FPS | 생성 수 | 보정 표시 % | 전체 / 추가 지연 ms | 최종 상태·이유 |','| --- | --- | ---: | ---: | ---: | ---: | --- | --- |');
for(const c of yt.cases){if(c.error)lines.push(`| ${c.url} | 실패 | — | — | — | — | — | ${c.error.replaceAll('|','/')} |`);for(const r of c.modes??[])lines.push(`| ${c.url} | ${r.diagnostic?'진단':'일반'} | ${f(r.end?.metrics?.sourceFPS)} | ${f(r.submittedFPS)} | ${r.generated} | ${f(r.meanVisible)} | ${f(r.meanRawSkew)} / ${f(r.meanAdditional)} | ${r.end?.temporal?.state}: ${r.end?.temporal?.reason?.replaceAll('|','/')} |`);}
lines.push('','실제 영상은 정지·장면 전환·광고·네트워크·YouTube 자체 품질 변경으로 출력 수가 달라질 수 있습니다. 원본 FPS는 URL 제목이 아니라 rVFC 측정값으로 분류합니다. 원본이 30FPS가 아니면 그 URL을 30FPS 성공 사례로 세지 않습니다.','',
'## 기존 기능 / 정확성 / 명령 결과','',
`새 streaming compositor 6개 위상의 최대 중심 오차: ${f(Math.max(...positions.map(r=>r.errorPixels)),4)}픽셀. [실제 화면 위치](regression/stream-positions.json).`,'',
'| 브라우저 | 버전 | WebGPU / WebGL2 픽셀 | 보간 GPU 검사 | 오류 |','| --- | --- | --- | --- | --- |');
for(const b of browsers)lines.push(`| ${b.channel} | ${b.version} | ${JSON.stringify(b.webgpu?.checks?.every(x=>x.passed))} / ${JSON.stringify(b.webgl2?.checks?.every(x=>x.passed))} | ${b.motion?.error??(b.motion?.results?.length?'위치·컷 결과 수집':'결과 없음')} | ${b.error??'없음'} |`);
lines.push('',`실제 YouTube 비교 픽셀 확인: ${layout.verifiedEnhancedPixels}. 원본/보정 screenshot 평균 채널 차이: 왼쪽 ${f(layout.pixelEvidence?.leftMeanChannelDifference,4)}, 오른쪽 ${f(layout.pixelEvidence?.rightMeanChannelDifference,4)}. 레이아웃: ${(layout.layoutChecks??[]).map(c=>`${c.name}=${c.processedVisible}`).join(', ')}. ${layout.error??''} [원시 기록](youtube-validation.json).`,'',
'`npm run build`: 빌드·MV3/로컬 자산 검사 통과. `npm run test`: 9파일 73개 통과. `npm run test:browser`: 30개 통과. [빌드](build-final.log), [단위](unit-test-final.log), [브라우저](browser-test-release.log).','',
'최종 ZIP·소스와 측정본의 해시는 package-verification.json과 measured-build.json에 기록했습니다. 패키징 전에 실행 코드는 동일한지 확인하고, 팝업 버전 표기 같은 문서/표시 변경은 따로 기록합니다. 물리 scanout, 고유 120개 패널 표시, 청각적 A/V 동기화, 수 시간 지속 품질은 통과로 보고하지 않습니다.');
await writeFile(root+'FINAL-RESULTS.md',lines.join('\n')+'\n');console.log({normalCases:normal.length,limited:limited.length,youtubeCases:yt.cases.length});
