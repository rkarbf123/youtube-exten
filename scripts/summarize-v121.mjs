import {readFile,writeFile} from 'node:fs/promises';
const root='docs/v1.2.1/';
const read=async name=>JSON.parse((await readFile(root+name+'.json','utf8')).replace(/^\uFEFF/,''));
const before=await read('baseline-matrix'),after=await read('optimized-matrix'),retry=await read('baseline-retry');
const key=r=>[r.height,r.source,r.target,!!r.diagnostic].join(':');
const baseline=new Map(before.rows.map(r=>[key(r),r]));for(const r of retry.rows)baseline.set(key(r),r);
const f=(v,n=2)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(n):'—';
const mean=(r,s)=>r?.profile?.stages?.[s]?.mean;
const rows=after.rows.filter(r=>!r.diagnostic).map(a=>({before:baseline.get(key(a)),after:a}));
const lines=['# v1.2.1 동일 입력 성능 비교','',`생성: ${new Date().toISOString()}`,'',
'고정 VP8 입력 15개를 전후에 동일하게 사용했습니다. 각 조건 3초 준비 후 10초 이상 관찰했습니다. 일반 모드, Fast, 원본 해상도, 공간 확대·색상 변화·샤프닝·노이즈 감소 없음, 자동 품질 조절 끔입니다. 수치는 Canvas 제출이며 물리 표시 FPS가 아닙니다. 낮은 구간 p10/p01과 중앙값은 약 250ms 구간별 FPS의 분위수입니다. 짧은 구간 양자화와 브라우저 작업 지연도 포함됩니다.','',
'| 크기 | 원본→목표 | 전 평균 | 후 평균 | 후 p50 / p10 / p01 | 후 생성 수 | 후 보정 표시 % | 판정 |',
'| --- | --- | ---: | ---: | --- | ---: | ---: | --- |'];
for(const {before:b,after:a} of rows)lines.push(`| ${a.width}×${a.height} | ${a.source}→${a.target} | ${f(b?.meanSubmittedFPS)} | ${f(a.meanSubmittedFPS)} | ${f(a.fps?.p50)} / ${f(a.fps?.p10)} / ${f(a.fps?.p01)} | ${a.generated??'—'} | ${f(a.visible?.mean)} | ${a.error?'실패':a.meanSubmittedFPS>=a.target*.98?'평균 목표 98% 이상':'목표 미달'} |`);
lines.push('','기준 640×360 24→75 최초 실행은 준비 단계 timeout으로 측정되지 않았습니다. 원본 오류를 baseline-matrix.json에 유지하고 동일 조건 재시도 baseline-retry.json의 관찰값을 위 표에 사용했습니다.','',
'## 일반 / 선택적 진단 모드','',
'진단은 timestamp-query를 켜고 서명 읽기는 끕니다. 서명 켬은 별도 after-signature.json에 있습니다. 일반 모드에는 GPU 시간 질의·서명 readback이 없습니다.','',
'| 크기, 60→120 | 전 일반 | 전 진단 | 후 일반 | 후 진단 | 후 flow GPU 평균 ms | 후 출력 CPU 평균 ms | 후 비동기 완료 통지 평균 ms |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const height of [144,360,720,1080,1440]){const n=after.rows.find(r=>r.height===height&&r.source===60&&r.target===120&&!r.diagnostic),d=after.rows.find(r=>r.height===height&&r.diagnostic),bn=baseline.get(key(n)),bd=before.rows.find(r=>r.height===height&&r.diagnostic);lines.push(`| ${n.width}×${height} | ${f(bn?.meanSubmittedFPS)} | ${f(bd?.meanSubmittedFPS)} | ${f(n.meanSubmittedFPS)} | ${f(d.meanSubmittedFPS)} | ${f(mean(d,'gpu.flowMs'),4)} | ${f(mean(d,'outputSubmitCpuMs'),4)} | ${f(mean(d,'asyncCompletionLatencyMs'),4)} |`);}
lines.push('','## 출력 시도별 폐기·생략 사유','',
'분모는 outputAttempts입니다. 원본 교체는 source callback 수가 다른 별도 사건이므로 이 분모로 계산하지 않습니다. 정상 정적/컷 출력·GPU 완료/읽기 통지는 폐기와 별개입니다. 서로 다른 단계에서 발생한 카운터를 합쳐 총 폐기율로 부풀리지 않습니다. 전체 카운터는 원본 JSON을 참조하세요.','',
'| 조건 | 시도 | 제출 | 제출/시도 % | GPU 대기 | CPU 바쁨 | 쌍 없음 | 마감 | 추가 지연 | 전체 지연 | 불연속 | 버퍼 오류 | 끝점 중복 |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const r of after.rows.filter(r=>r.diagnostic)){for(const [name,x] of [['전',before.rows.find(b=>key(b)===key(r))],['후',r]]){const c=x?.profile?.counters??{},count=k=>c[k]??0,percent=k=>`${count(k)} (${f(count(k)*100/count('outputAttempts'),1)}%)`;lines.push(`| ${name} ${r.width}×${r.height} 60→120 | ${count('outputAttempts')} | ${count('canvasSubmissions')} | ${f(count('canvasSubmissions')*100/count('outputAttempts'))} | ${percent('discard.gpuBackpressure')} | ${percent('discard.queueBusy')} | ${percent('discard.planUnavailable')} | ${percent('discard.submitDeadline')} | ${percent('discard.tooLate')} | ${percent('discard.totalMediaSkew')} | ${percent('discard.clockDiscontinuity')} | ${percent('discard.bufferMismatch')} | ${percent('duplicateEndpoint')} |`);}}
lines.push('','전 버전의 discard.outputDeadline는 이전 마감 정책의 카운터입니다. 추가 지연·총 시간차 분리 카운터는 후 버전에만 있으므로 전 버전 0이 동일 기준 통과를 뜻하지 않습니다.','',
'## 단계별 시간: 256×144 60→120 진단','',
'| 단계 | 전 평균 / p95 ms | 후 평균 / p95 ms |','| --- | ---: | ---: |');
const bp=(await read('baseline-probe')).rows[0],ap=after.rows.find(r=>r.height===144&&r.diagnostic);
for(const stage of ['rvfcIntervalMs','rafIntervalMs','videoFrameAcquireCpuMs','uploadCpuMs','flowPrepareCpuMs','gpu.downsampleMs','gpu.flowMs','gpu.warpMs','gpu.compositeMs','gpu.signatureMs','signatureReadbackWaitMs','flowReadbackWaitMs','renderErrorScopeWaitMs','presentErrorScopeWaitMs','presentFenceWaitMs','serialBusyMs','outputSubmitCpuMs','asyncCompletionLatencyMs','validityCpuMs','readyToCanvasSubmitMs','timeline.additionalDelayMs','timeline.totalMediaSkewMs']){const b=bp.profile.stages[stage],a=ap.profile.stages[stage];lines.push(`| ${stage} | ${b?`${f(b.mean,4)} / ${f(b.p95,4)}`:'—'} | ${a?`${f(a.mean,4)} / ${f(a.p95,4)}`:'—'} |`);}
lines.push('','flowReadbackWaitMs는 후 버전에도 남는 32바이트 분석 요약의 비동기 통지 지연입니다. CPU foreground 대기가 아닙니다. asyncCompletionLatencyMs도 GPU 커널 실행 시간과 다릅니다. 출력 warp와 composite는 동일 encoder 안에 연속 배치되므로 중간 GPU 완료→Canvas 별도 CPU 대기는 없습니다. readyToCanvasSubmitMs의 후 버전 공란은 0ms라는 측정이 아닙니다. 실제 GPU 실행 완료→모니터 scanout은 측정 불가입니다.','');
await writeFile(root+'PERFORMANCE.md',lines.join('\n'));
await writeFile(root+'comparison.csv','width,height,source,target,beforeFPS,afterFPS,p50,p10,p01,generated,visiblePercent\n'+rows.map(({before:b,after:a})=>[a.width,a.height,a.source,a.target,b?.meanSubmittedFPS,a.meanSubmittedFPS,a.fps?.p50,a.fps?.p10,a.fps?.p01,a.generated,a.visible?.mean].join(',')).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,errors:after.rows.filter(r=>r.error),below98percent:rows.filter(({after:a})=>a.meanSubmittedFPS<a.target*.98).map(({after:a})=>({height:a.height,source:a.source,target:a.target,FPS:a.meanSubmittedFPS}))}));
