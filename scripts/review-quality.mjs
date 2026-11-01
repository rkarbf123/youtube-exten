import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5184,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:'chromium',headless:true});
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5184/harness/');await mkdir('docs/review',{recursive:true});
  const adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter(/^Win/i.test(navigator.platform)?undefined:{powerPreference:'low-power'});return a?{vendor:a.info.vendor,architecture:a.info.architecture,description:a.info.description,isFallbackAdapter:a.info.isFallbackAdapter}:null;});
  const results=[];
  for(const backend of ['webgpu','webgl2']){
    let report;const benchmarkRepeats=[];
    for(let repetition=0;repetition<3;repetition++){
      const run=await page.evaluate(backend=>window.clarityHarness.runQualityReview(backend),backend);
      benchmarkRepeats.push(run.benchmark);if(!report)report=run;
    }
    report.benchmarkRepeats=benchmarkRepeats;
    for(const item of report.cases){for(const [kind,url] of Object.entries(item.images))await writeFile(`docs/review/${backend}-${item.name}-${kind}.png`,Buffer.from(url.split(',')[1],'base64'));delete item.images;}
    results.push(report);
  }
  await writeFile('docs/review/quality-comparison.json',JSON.stringify({browser:browser.version(),adapter,results},null,2));console.log(JSON.stringify({adapter,results},null,2));
  let frame;try{frame=await readFile('docs/review/baseline-balanced-youtube-source.png');}catch{console.log('No captured YouTube source frame; synthetic checks completed.');}
  if(frame){
    const captured=await page.evaluate(url=>window.clarityHarness.compareCapturedFrame(url),'data:image/png;base64,'+frame.toString('base64'));
    for(const [name,url] of Object.entries(captured.images))await writeFile(`docs/review/captured-youtube-${name}.png`,Buffer.from(url.split(',')[1],'base64'));delete captured.images;
    await writeFile('docs/review/captured-frame-comparison.json',JSON.stringify(captured,null,2));console.log(JSON.stringify(captured,null,2));
  }
}finally{await browser.close();await server.close();}
