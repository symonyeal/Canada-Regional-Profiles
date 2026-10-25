// Browser workflows against a served copy of site/. Requires playwright-core and a Chromium-based browser.
// Usage: node tests/browser/workflows.mjs <base-url> <report.json>   (BROWSER env var: path to msedge/chrome)
// Each check records pass/fail with the observed state; failures are reported, never retried into passes.
import {chromium} from 'playwright-core';
import fs from 'node:fs';

const base=process.argv[2]??'http://localhost:8765/',out=process.argv[3]??'workflows.json';
const browser=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
async function check(name,fn) {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const t0=Date.now();
  try {const detail=await fn(page);results.push({name,pass:true,ms:Date.now()-t0,detail,pageErrors:errors});console.log('PASS',name,JSON.stringify(detail??'').slice(0,160));}
  catch(e) {results.push({name,pass:false,ms:Date.now()-t0,error:e.message.split('\n')[0],pageErrors:errors});console.log('FAIL',name,e.message.split('\n')[0]);}
  finally {await page.close();}
}
const heading=page=>page.locator('#place-name').textContent();
const until=async(page,fn,arg,timeout=45000)=>page.waitForFunction(fn,arg,{timeout,polling:300});
const section=async(page,id)=>{await page.evaluate(i=>document.getElementById(i).scrollIntoView(),id);};

await check('shared URL reconstructs geography, section and industry view',async page=>{
  await page.goto(`${base}?geo=2021A000246&li=traded&liv=list#largest`);
  await until(page,()=>document.querySelector('#largest .exhibit h4')?.textContent==='Traded industries'&&document.querySelectorAll('#largest tbody tr').length>0);
  return {heading:await heading(page),rows:await page.locator('#largest tbody tr').count(),scrolled:await page.evaluate(()=>scrollY>1000)};
});
await check('option card and view toggle update the exhibit and the URL',async page=>{
  await page.goto(`${base}?geo=2021A000246#largest`);await section(page,'largest');
  await until(page,()=>document.querySelector('#largest .tile'));
  await page.locator('#largest').getByRole('button',{name:/^Local industries/}).click();
  await until(page,()=>document.querySelector('#largest .exhibit h4')?.textContent==='Local industries');
  await page.locator('#largest').getByRole('button',{name:'Bars',exact:true}).click();
  await until(page,()=>document.querySelector('#largest .bar-list'));
  const url=page.url();if(!/li=local/.test(url)||!/liv=bars/.test(url))throw Error(`URL not updated: ${url}`);
  return {url};
});
await check('geography changes push history; Back and Forward restore them',async page=>{
  await page.goto(`${base}?geo=2021A000246`);await until(page,()=>document.getElementById('place-name').textContent==='Manitoba');
  await page.selectOption('#province','35');await until(page,()=>document.getElementById('place-name').textContent==='Ontario');
  await page.goBack();await until(page,()=>document.getElementById('place-name').textContent==='Manitoba');
  const back=page.url();await page.goForward();await until(page,()=>document.getElementById('place-name').textContent==='Ontario');
  return {back,forward:page.url()};
});
await check('rapid successive selections end on the last one without stale content',async page=>{
  await page.goto(`${base}?geo=2021A000246#largest`);await section(page,'largest');await until(page,()=>document.querySelector('#largest .tile'));
  for(const c of ['60','61','62','59'])await page.selectOption('#province',c);
  await until(page,()=>document.getElementById('place-name').textContent==='British Columbia'&&/British Columbia/.test(document.querySelector('#largest .industry-side')?.textContent??''));
  await until(page,()=>document.querySelector('#largest .tile, #largest .state'));
  const side=await page.locator('#largest .industry-side').textContent();
  if(/Manitoba|Yukon|Nunavut|Northwest/.test(side))throw Error('stale geography text in industry panel');
  return {heading:await heading(page),url:page.url()};
});
await check('keyboard combobox selects a municipality and reloads intact',async page=>{
  await page.goto(`${base}?geo=2021A000246`);await until(page,()=>document.getElementById('place-name').textContent==='Manitoba');
  await page.focus('#place-input');await page.keyboard.type('Brandon');
  await until(page,()=>document.querySelectorAll('#place-list [role=option]').length>0);
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await until(page,()=>document.getElementById('place-name').textContent==='Brandon');
  const url=page.url();await page.reload();await until(page,()=>document.getElementById('place-name').textContent==='Brandon');
  return {url,meta:await page.locator('#place-meta').textContent()};
});
await check('malformed parameters fall back to Canada and valid defaults without errors',async page=>{
  await page.goto(`${base}?geo=../../x&lg=boats&cp=%3Cscript%3E&li=everything`);
  await until(page,()=>document.getElementById('place-name').textContent==='Canada');
  return {heading:await heading(page)};
});
await check('benchmark switch compares a municipality with its province',async page=>{
  await page.goto(`${base}?geo=2021A00054611040&cp=dwelling&bench=PT#profile`);await section(page,'profile');
  await until(page,()=>[...document.querySelectorAll('#profile .legend')].some(l=>/Manitoba/.test(l.textContent)));
  return {legend:await page.locator('#profile .legend').first().textContent()};
});
await check('chart, data table and CSV give the same leading values',async page=>{
  await page.goto(`${base}?geo=2021A000246&liv=list#largest`);await section(page,'largest');
  await until(page,()=>document.querySelectorAll('#largest tbody tr').length>0);
  const listFirst=await page.locator('#largest tbody tr').first().locator('td,th').allTextContents();
  await page.locator('#largest .kebab').click();await page.getByRole('menuitem',{name:'View data table'}).click();
  const dialogFirst=await page.locator('dialog tbody tr').first().locator('td,th').allTextContents();
  await page.keyboard.press('Escape');
  await page.locator('#largest .kebab').click();
  const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('menuitem',{name:'Download CSV'}).click()]);
  const text=fs.readFileSync(await dl.path(),'utf8'),row=text.split('\r\n').find(l=>/^"1",/.test(l));
  // List cells: rank, industry, NAICS, jobs, LQ. Dialog and CSV: rank, industry, NAICS, jobs, baseline, LQ, traded/local.
  const [,name,code,jobs]=listFirst,cells=row?.split('","').map(c=>c.replace(/"/g,''));
  if(dialogFirst[1]!==name||dialogFirst[2]!==code||dialogFirst[3]!==jobs||cells?.[1]!==name||cells?.[2]!==code||Number(cells?.[3])!==Number(jobs.replace(/,/g,'')))
    throw Error(`mismatch: list ${listFirst} | dialog ${dialogFirst} | csv ${row}`);
  return {listFirst,dialogFirst,csv:row};
});
await check('a Census outage fails only Census cards; payroll industries still render; retry recovers',async page=>{
  let block=true;await page.route('**/api.statcan.gc.ca/**',r=>block?r.abort():r.continue());
  await page.goto(`${base}?geo=2021A000246&cp=dwelling#profile`);await section(page,'profile');
  await until(page,()=>document.querySelector('#profile .state.failure'),undefined,60000);
  await section(page,'largest');await until(page,()=>document.querySelector('#largest .tile'),undefined,60000);
  block=false;await section(page,'profile');
  await page.locator('#profile .state.failure button').first().click();
  await until(page,()=>document.querySelectorAll('#profile .stack-row').length>0,undefined,60000);
  return {recovered:true};
});
await check('a boundary outage keeps the market card, legend and table',async page=>{
  await page.route('**/boundaries/**',r=>r.abort());
  await page.goto(`${base}?geo=2021A000246#market`);await section(page,'market');
  await until(page,()=>/Boundaries unavailable/.test(document.querySelector('#market .map-note')?.textContent??''),undefined,90000);
  const kpi=await page.locator('#market .map-kpi b').textContent();
  await page.locator('#market .map-tools .kebab').click();await page.getByRole('menuitem',{name:'View data table'}).click();
  const rows=await page.locator('dialog tbody tr').count();if(rows<10)throw Error(`table rows ${rows}`);
  return {kpi,rows};
});
await check('visible keyboard focus on navigation and controls',async page=>{
  await page.goto(`${base}?geo=2021A000246`);await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  const style=await page.evaluate(()=>{const a=document.activeElement,s=getComputedStyle(a);return {tag:a.tagName,text:a.textContent.trim().slice(0,30),outline:s.outlineStyle,width:s.outlineWidth};});
  if(style.outline==='none')throw Error('no focus outline');
  return style;
});
await check('territory with suppressed payroll data shows published industries and an explicit count',async page=>{
  await page.goto(`${base}?geo=2021A000262#largest`);await section(page,'largest');
  await until(page,()=>document.querySelector('#largest .tile, #largest .state.failure, #largest .state.empty'),undefined,60000);
  const note=await page.locator('#largest .exhibit').textContent();
  if(!/suppressed or not published/.test(note))throw Error(note.replace(/\s+/g,' ').slice(0,200));
  return {tiles:await page.locator('#largest .tile').count(),excerpt:note.replace(/\s+/g,' ').slice(-140)};
});
await check('a level without industry data explains itself and offers the province',async page=>{
  await page.goto(`${base}?geo=2021A00034611#largest`);await section(page,'largest');
  await until(page,()=>document.querySelector('#largest .state.failure'),undefined,60000);
  const text=await page.locator('#largest .state').textContent();
  if(!/census divisions/.test(text))throw Error(text);
  return {text:text.replace(/\s+/g,' ').slice(0,180),offersProvince:await page.locator('#largest .state').getByRole('button',{name:/View Manitoba/}).count()};
});
await check('explorer on Canada (no map) fills the selected community panel',async page=>{
  await page.goto(`${base}?geo=2021A000011124#explorer`);await section(page,'explorer');
  await until(page,()=>document.querySelector('#explorer .community'),undefined,60000);
  await page.locator('#explorer .community').first().click();
  await until(page,()=>document.querySelector('#explorer .selected-panel dl'));
  return {panel:(await page.locator('#explorer .selected-panel').textContent()).slice(0,120)};
});
await check('a 15 s burst of reset WDS connections delays the industries but does not fail them',async page=>{
  // Replays the outage observed on 2026-10-25: every WDS connection reset for about 15 s, then normal service.
  const t0=Date.now();let reset=0;
  await page.route(/www150\.statcan\.gc\.ca\/t1\/wds/,r=>Date.now()-t0<15000?(reset++,r.abort('connectionreset')):r.continue());
  await page.goto(`${base}?geo=2021A000262#largest`);
  await until(page,()=>document.querySelector('#largest .tile')||document.querySelector('#largest .state.failure'),undefined,90000);
  const failed=await page.locator('#largest .state.failure').count();if(failed)throw Error(`industries failed after ${reset} resets`);
  return {reset,tiles:await page.locator('#largest .tile').count(),ms:Date.now()-t0};
});
await check('at 768 px the explorer map ends above the community list',async page=>{
  await page.setViewportSize({width:768,height:900});
  await page.goto(`${base}?geo=2021A000246#explorer`);await section(page,'explorer');
  await until(page,()=>document.querySelector('#explorer .community'),undefined,60000);
  const [map,list]=await page.evaluate(()=>['.map-wrap','.community-list'].map(s=>document.querySelector(`#explorer ${s}`).getBoundingClientRect()).map(r=>[r.top,r.bottom]));
  if(map[1]>list[0]+1)throw Error(`map bottom ${map[1]} below list top ${list[0]}`);
  return {map,list};
});
fs.writeFileSync(out,JSON.stringify({base,at:new Date().toISOString(),results},null,1));
console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);
await browser.close();
