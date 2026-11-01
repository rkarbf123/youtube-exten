import {test,expect} from '@playwright/test';
test('inverse correspondence reduces diagonal silhouette and ghost error on identical GPU inputs',async({page})=>{
 await page.goto('/harness/');const before=await page.evaluate(()=>window.clarityPerf.runMotionQuality('before',['horizontal','vertical','diagonal','occlusion'])),after=await page.evaluate(()=>window.clarityPerf.runMotionQuality('after',['horizontal','vertical','diagonal','occlusion']));
 const average=(rows:typeof before.rows,k:'rmse'|'ghostError')=>rows.reduce((s,r)=>s+r[k],0)/rows.length;console.log(JSON.stringify({before:average(before.rows,'rmse'),after:average(after.rows,'rmse'),ghostBefore:average(before.rows,'ghostError'),ghostAfter:average(after.rows,'ghostError')}));expect(after.errors).toEqual([]);expect(average(after.rows,'rmse')).toBeLessThan(average(before.rows,'rmse')*.8);expect(average(after.rows,'ghostError')).toBeLessThan(average(before.rows,'ghostError')*.8);
});
