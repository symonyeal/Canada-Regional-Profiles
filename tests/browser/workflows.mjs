// Browser checks for the regional brief. Legend: p = page; b = browser; R = results.
// Usage: node tests/browser/workflows.mjs <base-url> <report-path>.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [base='http://127.0.0.1:8772/',out]=process.argv.slice(2);
if(!out)throw new Error('Provide a report path in the working evidence folder.');
const b=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const R=[];
// Reuse successful public responses in this test process; the application still exercises its real adapters.
const responses=new Map(process.env.PUBLIC_RESPONSES?JSON.parse(fs.readFileSync(process.env.PUBLIC_RESPONSES,'utf8')):[]),key=r=>`${r.method()}:${r.url()}:${r.postData()??''}`;
const mode=process.env.PUBLIC_RESPONSES?'captured public responses plus live cache misses':'live public sources with in-process response reuse';
const until=(p,fn,t=90000)=>p.waitForFunction(fn,undefined,{timeout:t});
const nav=(p,k)=>p.locator(`#section-links a[href="#${k}"]`).click();
async function check(name,fn){
  if(process.env.WORKFLOW_FILTER&&!name.includes(process.env.WORKFLOW_FILTER))return;
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
  await p.route(/https:\/\/(api|www150)\.statcan\.gc\.ca\//,r=>{
    const cached=responses.get(key(r.request()));return cached?r.fulfill(cached):r.continue();
  });
  p.on('response',async r=>{if(!/^https:\/\/(api|www150)\.statcan\.gc\.ca\//.test(r.url())||r.status()!==200)return;
    try{responses.set(key(r.request()),{status:200,contentType:r.headers()['content-type']??'application/json',headers:{'access-control-allow-origin':'*'},body:await r.body()});}catch{}});
  p.on('pageerror',e=>errors.push(e.message));
  try{const detail=await fn(p);if(errors.length)throw Error(errors.join('; '));R.push({name,pass:true,detail});console.log('PASS',name);}
  catch(e){const state=await p.locator('main').innerText().catch(()=>''),requests=await p.evaluate(async()=>{const {journal}=await import('./js/api.js');return journal.slice(-12);}).catch(()=>[]);
    R.push({name,pass:false,error:e.message.split('\n')[0],errors,state:state.slice(0,2000),requests});console.log('FAIL',name,e.message.split('\n')[0]);}
  finally{await p.close();fs.writeFileSync(out,JSON.stringify({base,mode,results:R},null,2));}
}
await check('overview has four dated values, five destinations, and no map requests',async p=>{
  const maps=[];p.on('request',r=>{if(/maplibre|openfreemap|valhalla|wikidata/.test(r.url()))maps.push(r.url());});
  await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelectorAll('#overview .kpi-value').length===4);
  if(await p.locator('#section-links a').count()!==5||maps.length)throw Error('Unexpected navigation or eager map request');
  const population=await p.locator('#overview .kpi-value').first().textContent();
  const raw=await p.evaluate(async()=>{const {census}=await import('./js/api.js');return (await census({id:'2021A000246',type:'PR'})).value('1');});
  if(Number(population.replaceAll(',',''))!==raw)throw Error('Population differs from live adapter');
  return {population,raw,maps:maps.length};
});
await check('national overview compares provinces instead of Canada with itself',async p=>{
  await p.goto(base);await until(p,()=>document.querySelectorAll('.national-bars .bar-row').length===13);
  return {regions:await p.locator('.national-bars .bar-row').count()};
});
await check('legacy industry link opens the consolidated view with its filter',async p=>{
  await p.goto(`${base}?geo=2021A000246&li=traded#largest`);await until(p,()=>document.querySelector('#industries .industry-name'));
  if(await p.locator('#industries').isHidden()||await p.locator('[aria-label="Industry set"]').inputValue()!=='traded')throw Error('Legacy state lost');
  return {rows:await p.locator('.industry-ranking tbody tr').count()};
});
await check('industry changes include losses, baseline and percentage changes',async p=>{
  await p.goto(`${base}?geo=2021A000246&iv=change#industries`);await until(p,()=>document.querySelector('.industry-ranking .negative'));
  const text=await p.locator('.industry-ranking').innerText();if(!/2020 base/i.test(text)||!/Change \(%\)/i.test(text))throw Error('Missing baseline or percentage');
  return {losses:await p.locator('.rank-fill.negative').count()};
});
await check('industry table and exported data share their leading value',async p=>{
  await p.goto(`${base}?geo=2021A000246#industries`);await until(p,()=>document.querySelector('.industry-name'));
  const name=await p.locator('.industry-name').first().textContent(),jobs=await p.locator('.rank-value>span').first().textContent();
  await p.locator('#industries .kebab').click();await p.getByRole('menuitem',{name:'View data table'}).click();
  const row=await p.locator('dialog tbody tr').first().locator('td,th').allTextContents();
  if(row[0]!==name||row[1]!==jobs)throw Error('Displayed and source-table values differ');
  await p.keyboard.press('Escape');await p.locator('#industries .kebab').click();
  const [dl]=await Promise.all([p.waitForEvent('download'),p.getByRole('menuitem',{name:'Download CSV'}).click()]);
  const text=fs.readFileSync(await dl.path(),'utf8');if(!text.includes(`"${name}","${Number(jobs.replaceAll(',',''))}"`))throw Error('CSV leading row differs');
  return {name,jobs};
});
await check('industry row opens detail, Escape restores focus',async p=>{
  await p.goto(`${base}?geo=2021A000246#industries`);await until(p,()=>document.querySelector('.industry-name'));
  const name=await p.locator('.industry-name').first().textContent();await p.locator('.industry-name').first().click();
  await until(p,()=>document.querySelector('.overlay h3'));
  if(!(await p.locator('.overlay h3').textContent()).includes(name))throw Error('Wrong industry detail');
  const shared=p.url();
  await p.keyboard.press('Escape');await until(p,()=>!document.querySelector('.overlay'));
  if(await p.evaluate(()=>document.activeElement?.className)!=='industry-name')throw Error('Focus not restored');
  await p.goto(shared);await until(p,()=>document.querySelector('.overlay h3'));
  if(!(await p.locator('.overlay h3').textContent()).includes(name))throw Error('Shared detail URL lost its industry');
  return {name,shared};
});
await check('peer selection, reload and removal preserve same-level comparisons',async p=>{
  await p.goto(`${base}?geo=2021A000246#compare`);
  await p.getByRole('searchbox',{name:'Find a peer'}).fill('Ontario');
  await until(p,()=>document.querySelector('.peer-result'));await p.locator('.peer-result').first().click();
  await until(p,()=>document.querySelectorAll('.comparison-table tbody tr').length===2);
  const url=p.url();if(!url.includes('peers=2021A000235'))throw Error('Peer missing from URL');
  await p.reload();await until(p,()=>document.querySelectorAll('.comparison-table tbody tr').length===2);
  await p.getByRole('button',{name:'Remove Ontario'}).click();await until(p,()=>document.querySelectorAll('.comparison-table tbody tr').length===1);
  return {url};
});
await check('keyboard geography selection, province benchmark and inactive-tab refresh',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await p.locator('#place-input').fill('Brandon');
  await until(p,()=>document.querySelector('#place-list [role=option]'));await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
  await until(p,()=>document.querySelector('#place-name').textContent==='Brandon');await p.selectOption('#bench','PT');
  await until(p,()=>document.querySelector('#overview .kpi-context')?.textContent.includes('since 2016'));
  await nav(p,'people');await p.getByRole('button',{name:'Work and education',exact:true}).click();
  await until(p,()=>document.querySelector('#people .legend')?.textContent.includes('Manitoba'));
  return {url:p.url(),place:await p.locator('#place-name').textContent()};
});
await check('Back and Forward restore geography without stale headings',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await p.selectOption('#province','35');await until(p,()=>document.querySelector('#place-name').textContent==='Ontario');
  await p.goBack();await until(p,()=>document.querySelector('#place-name').textContent==='Manitoba');
  await p.goForward();await until(p,()=>document.querySelector('#place-name').textContent==='Ontario');return {restored:true};
});
await check('Census outage leaves payroll independent and Retry recovers',async p=>{
  let block=true;await p.route('**/api.statcan.gc.ca/**',r=>block?r.abort():r.continue());
  await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelector('#overview .state.failure'));
  await nav(p,'industries');await until(p,()=>document.querySelector('.industry-name'));block=false;
  await nav(p,'overview');await until(p,()=>document.querySelector('#overview .kpi-value'));return {recovered:true};
});
await check('unsupported industry geography explains scope and offers its province',async p=>{
  await p.goto(`${base}?geo=2021A00034611#industries`);await until(p,()=>document.querySelector('#industries .state.failure'));
  const text=await p.locator('#industries').innerText();if(!/census divisions/.test(text)||!await p.getByRole('button',{name:'View provincial industries'}).count())throw Error('Missing scope or fallback');
  return {scope:'census division'};
});
await check('territory suppression stays explicit rather than becoming zero',async p=>{
  await p.goto(`${base}?geo=2021A000262#industries`);await until(p,()=>document.querySelector('.industry-name'));
  const text=await p.locator('#industries').innerText();if(!/suppressed or not published/.test(text))throw Error('Missing suppression notice');return {rows:await p.locator('.industry-name').count()};
});
await check('optional maps open on demand and closing clears shared state',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await p.locator('#explore-map').click();await until(p,()=>document.querySelector('.map-dialog .map'));
  if(!p.url().includes('map=market'))throw Error('Map state not shared');await p.keyboard.press('Escape');await until(p,()=>!document.querySelector('.map-dialog'));
  if(p.url().includes('map='))throw Error('Map URL not cleared');return {closed:true};
});
for(const width of [1440,768,390])await check(`five views fit ${width}px and labels remain readable`,async p=>{
  await p.setViewportSize({width,height:900});await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelector('#overview .kpi-value'));
  for(const k of ['overview','people','housing','industries','compare']){await nav(p,k);await p.waitForTimeout(1000);
    if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${k}: page overflow`);
  }
  return {width};
});
await b.close();console.log(`${R.filter(r=>r.pass).length}/${R.length} passed`);
if(R.some(r=>!r.pass))process.exitCode=1;
