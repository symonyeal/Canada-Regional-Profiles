// Coverage sweep: load each geography, mount every tool, and record what each panel shows.
// Usage: node tests/browser/sweep.mjs <base-url> <report.json> [geo ...]   (BROWSER env var: path to msedge/chrome)
import {chromium} from 'playwright-core';
import fs from 'node:fs';

const [base='http://localhost:8765/',out='sweep.json',...only]=process.argv.slice(2);
const GEOS=[['Canada','2021A000011124'],['Yukon','2021A000260'],['Northwest Territories','2021A000261'],['Nunavut','2021A000262'],
  ['British Columbia','2021A000259'],['Alberta','2021A000248'],['Saskatchewan','2021A000247'],['Manitoba','2021A000246'],['Ontario','2021A000235'],
  ['Quebec','2021A000224'],['New Brunswick','2021A000213'],['Nova Scotia','2021A000212'],['Prince Edward Island','2021A000211'],['Newfoundland and Labrador','2021A000210'],
  ['Winnipeg (CSD)','2021A00054611040'],['Division No. 11, Manitoba (CD)','2021A00034611'],['Ottawa - Gatineau (cross-border CMA)','2021S0503505'],
  ['Winnipeg (economic region)','2021S05004650'],['Brandon (population centre)','2021S05100091'],['Iqaluit (small northern CSD)','2021A00056204003'],
  ['Richmond, British Columbia (duplicate name)','2021A00055915015']];
const TOOLS=['logistics','profile','explorer','market','workforce','insights','growing','largest','talent'];
const browser=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
for(const [label,geo] of GEOS.filter(([,g])=>!only.length||only.includes(g))) {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText??''))failed.push(new URL(r.url()).host);});
  const t0=Date.now();
  await page.goto(`${base}?geo=${geo}`);
  for(const id of TOOLS){await page.evaluate(i=>document.getElementById(i).scrollIntoView(),id);await page.waitForTimeout(1800);}
  await page.waitForTimeout(25000);
  const state=await page.evaluate(tools=>({heading:document.getElementById('place-name').textContent,meta:document.getElementById('place-meta').textContent,
    tools:Object.fromEntries(tools.map(id=>{const s=document.getElementById(id);
      return [id,{loading:s.querySelectorAll('.state.loading').length,failures:[...s.querySelectorAll('.state.failure')].map(f=>f.textContent.replace(/Retry$/,'').trim().slice(0,160)),
        empty:[...s.querySelectorAll('.state.empty')].map(f=>f.textContent.trim().slice(0,120)),notes:[...s.querySelectorAll('.map-note:not([hidden])')].map(n=>n.textContent.trim().slice(0,160)),
        cards:s.querySelectorAll('.card').length,tiles:s.querySelectorAll('.tile').length,rows:s.querySelectorAll('tbody tr, .bar-row, .community, .cip, .stack-row').length,
        kpi:[...s.querySelectorAll('.kpi-value, .map-kpi b, .map-card .stat b')].slice(0,4).map(k=>k.textContent)}];}))}),TOOLS);
  report.push({label,geo,ms:Date.now()-t0,...state,pageErrors:errors,failedHosts:[...new Set(failed)]});
  const summary=TOOLS.map(t=>{const x=state.tools[t];return `${t}:${x.failures.length?'F'+x.failures.length:''}${x.loading?'L'+x.loading:''}${!x.failures.length&&!x.loading?'ok':''}`;}).join(' ');
  console.log(label.padEnd(44),state.heading.padEnd(28),summary,errors.length?`pageErrors=${errors.length}`:'');
  await page.close();
}
fs.writeFileSync(out,JSON.stringify({base,at:new Date().toISOString(),report},null,1));
await browser.close();
