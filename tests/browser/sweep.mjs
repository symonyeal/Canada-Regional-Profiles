// Coverage smoke checks. Legend: g = geography; p = page; R = observed states.
// Usage: node tests/browser/sweep.mjs <base-url> <report-path> [DGUID ...].
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [base='http://127.0.0.1:8772/',out,...only]=process.argv.slice(2);
if(!out)throw Error('Provide an evidence report path.');
const geos=['2021A000011124',...['60','61','62','59','48','47','46','35','24','13','12','11','10'].map(c=>`2021A0002${c}`),
  '2021A00054611040','2021A00034611','2021S0503505','2021S05004650','2021S05100091'];
const b=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),R=[];
for(const g of geos.filter(g=>!only.length||only.includes(g))){
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${base}?geo=${g}`,{waitUntil:'domcontentloaded'});
  const views={};
  for(const k of ['overview','people','housing','industries','compare']){
    await p.locator(`#section-links a[href="#${k}"]`).click();
    await p.waitForFunction(k=>{const e=document.getElementById(k);return e.querySelector('.kpi-value,.industry-name,.bar-row,.state.failure,.unpublished');},k,{timeout:90000}).catch(()=>{});
    views[k]=await p.locator(`#${k}`).evaluate(e=>({loading:e.querySelectorAll('.state.loading').length,failures:[...e.querySelectorAll('.state.failure')].map(x=>x.textContent),
      values:[...e.querySelectorAll('.kpi-value,.rank-value>span')].slice(0,4).map(x=>x.textContent),rows:e.querySelectorAll('.bar-row,tbody tr').length,text:e.innerText.slice(-350)}));
  }
  R.push({geo:g,place:await p.locator('#place-name').textContent(),views,errors});console.log(g,R.at(-1).place,JSON.stringify(Object.fromEntries(Object.entries(views).map(([k,v])=>[k,{loading:v.loading,failures:v.failures.length,rows:v.rows}]))));
  fs.writeFileSync(out,JSON.stringify({base,results:R},null,2));await p.close();
}
await b.close();if(R.some(r=>r.errors.length))process.exitCode=1;
