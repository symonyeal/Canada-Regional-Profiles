// Browser checks for the regional findings. Legend: p = page; b = browser; R = results.
// Usage: node tests/browser/workflows.mjs <base-url> <report-path>.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [base='http://127.0.0.1:8772/',out]=process.argv.slice(2);
if(!out)throw new Error('Provide a report path in the working evidence folder.');
const b=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const R=[];
// Reuse successful public responses in this test process; the application still exercises its real adapters.
const responses=new Map(process.env.PUBLIC_RESPONSES?JSON.parse(fs.readFileSync(process.env.PUBLIC_RESPONSES,'utf8')):[]),key=r=>`${r.method()}:${r.url()}:${r.postData()??''}`;
const mode=process.env.PUBLIC_RESPONSES?'captured public responses plus live cache misses':'live public sources with in-process response reuse';
const until=(p,fn,t=90000)=>p.waitForFunction(fn,undefined,{timeout:t});
const nav=(p,k)=>p.locator(`#section-links a[href="#${k}"]`).click();
async function check(name,fn){
  if(process.env.WORKFLOW_FILTER&&!name.includes(process.env.WORKFLOW_FILTER))return;
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],resources=[];
  p.on('requestfailed',r=>{if(r.url().startsWith(base))resources.push({url:r.url(),error:r.failure()?.errorText});});
  p.on('console',m=>{if(m.type()==='error')resources.push({console:m.text()});});
  await p.route(/https:\/\/(api|www150)\.statcan\.gc\.ca\//,r=>{
    const cached=responses.get(key(r.request()));return cached?r.fulfill(cached):r.continue();
  });
  p.on('response',async r=>{if(!/^https:\/\/(api|www150)\.statcan\.gc\.ca\//.test(r.url())||r.status()!==200)return;
    try{responses.set(key(r.request()),{status:200,contentType:r.headers()['content-type']??'application/json',headers:{'access-control-allow-origin':'*'},body:await r.body()});}catch{}});
  p.on('pageerror',e=>errors.push(e.message));
  try{const detail=await fn(p);if(errors.length)throw Error(errors.join('; '));R.push({name,pass:true,detail});console.log('PASS',name);}
  catch(e){const state=await p.locator('main').innerText().catch(()=>''),requests=await p.evaluate(async()=>{const {journal}=await import('./js/transport.js');return journal.slice(-12);}).catch(()=>[]);
    R.push({name,pass:false,error:e.message.split('\n')[0],errors,resources,state:state.slice(0,2000),requests});console.log('FAIL',name,e.message.split('\n')[0]);}
  finally{await p.close();fs.writeFileSync(out,JSON.stringify({base,mode,results:R},null,2));}
}
await check('findings rank six measures among comparable areas, four destinations, no map requests',async p=>{
  const maps=[];p.on('request',r=>{if(/maplibre|openfreemap/.test(r.url()))maps.push(r.url());});
  await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelectorAll('#overview .findings.census .finding').length===6&&/of 13 provinces/.test(document.querySelector('#overview .findings.census').textContent));
  if(await p.locator('#section-links a').count()!==4||maps.length)throw Error('Unexpected navigation or eager map request');
  await p.locator('#overview summary',{hasText:'All 20 measures'}).click();
  const age=await p.locator('#overview tbody tr',{hasText:'Median age'}).locator('td').first().textContent();
  const raw=await p.evaluate(async()=>{const {census}=await import('./js/api.js');return (await census({id:'2021A000246',type:'PR'})).value('40');});
  if(Number(age)!==raw)throw Error('Median age differs from live adapter');
  return {age,raw,maps:maps.length};
});
// The front shows the latest annual year, ranked in that year; the value is the adapter's for that year.
await check('latest annual values lead the findings, ranked among provinces in their own year',async p=>{
  await p.goto(`${base}?geo=2021A000246`);
  await until(p,()=>[...document.querySelectorAll('#overview .findings.recent .finding')].some(e=>/Unemployment rate/.test(e.textContent)&&/of 10 provinces and territories publishing it/.test(e.textContent)));
  const card=p.locator('#overview .findings.recent .finding',{hasText:'Unemployment rate'}),year=Number(await card.locator('.finding-period').textContent());
  const shown=await card.locator('.finding-value').textContent();
  const raw=await p.evaluate(async()=>{const {trendSeries}=await import('./js/api.js'),{trend}=await import('./js/trend-model.js');
    return (await trendSeries(trend('unemployment'),[{id:'2021A000246',type:'PR',name:'Manitoba'}])).get('2021A000246').values.filter(v=>v.value!=null).at(-1);});
  if(year<2024||raw.year!==year||shown!==`${raw.value.toFixed(1)}%`)throw Error(`Card ${shown} ${year}, adapter ${raw.value} ${raw.year}`);
  const first=await p.locator('#overview h3.subhead').first().textContent();if(first!=='Latest published year')throw Error(`First heading ${first}`);
  return {year,shown,cards:await p.locator('#overview .findings.recent .finding').count()};
});
await check('a municipality leads with its latest population estimate, ranked in its province',async p=>{
  await p.goto(`${base}?geo=2021A00054602044`);
  await until(p,()=>/Manitoba municipalities with 1,000\+ residents in 20\d\d/.test(document.querySelector('#overview .findings.recent')?.textContent??''));
  const year=Number(await p.locator('#overview .findings.recent .finding-period').first().textContent());if(year<2024)throw Error(`Year ${year}`);
  return {year,text:await p.locator('#overview .findings.recent .finding-text').first().textContent()};
});
await check('national findings name the provinces at each end of a measure',async p=>{
  await p.goto(base);await until(p,()=>[...document.querySelectorAll('#overview .findings.census .finding-text')].filter(e=>/range from .+ to /.test(e.textContent)).length===6);
  return {findings:await p.locator('#overview .findings.census .finding').count()};
});
await check('a municipality is ranked within its province and compared with similar places and neighbours',async p=>{
  await p.goto(`${base}?geo=2021A00054602044`);await until(p,()=>/Manitoba municipalities with 1,000\+ residents/.test(document.querySelector('#overview .findings.census')?.textContent??''));
  await nav(p,'compare');await until(p,()=>document.querySelectorAll('#compare .comparison-table tbody tr').length===7);
  const similar=await p.locator('#compare .comparison-table tbody th').allTextContents();
  await p.getByRole('button',{name:'Neighbours'}).click();await until(p,()=>/sharing a border/.test(document.querySelector('#compare').textContent));
  const near=await p.locator('#compare .comparison-table tbody th').allTextContents();
  if(!p.url().includes('pm=near')||!near.includes('Hanover'))throw Error('Neighbours missing');
  return {similar,near};
});
await check('provincial payroll change is decomposed into national, mix and regional effects',async p=>{
  await p.goto(`${base}?geo=2021A000246#industries`);await until(p,()=>/payroll jobs from 2019 to/.test(document.querySelector('#industries .economy-cards')?.textContent??''));
  const text=await p.locator('#industries .economy-cards').textContent();if(!/At Canada’s rate/.test(text)||!/Regional shift/i.test(text))throw Error('Decomposition missing');
  return {headline:await p.locator('#industries .economy-cards h4').first().textContent()};
});
// The Over time range is the full intersection of the published years, not a fixed window.
const span=p=>p.evaluate(()=>{const e=[...document.querySelectorAll('#overview .trend-range .range-ends span, #compare .trend-range .range-ends span')].map(x=>Number(x.textContent));return e;});
await check('province history spans every year published for it and Canada, and the range is shared',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelector('#overview .trend-panel .chart-card'));
  const [a,c]=await span(p);if(!(a<=1971&&c>=2025))throw Error(`Population range ${a}-${c}`);
  // The summary names the place and the benchmark; no area name or empty slot renders as undefined or null.
  const sub=await p.locator('#overview .trend-panel .card-sub').first().textContent(),panel=await p.locator('#overview .trend-panel').innerText();
  if(!/^Manitoba: [\d,]+ in \d{4}/.test(sub)||!/Canada: /.test(sub)||/\b(undefined|null)\b/.test(panel))throw Error(`Summary: ${sub}`);
  const raw=await p.evaluate(async()=>{const {populationSeries}=await import('./js/api.js');const d=await populationSeries({id:'2021A000246',type:'PR'});return d.values.filter(v=>v.value!=null).length;});
  await p.selectOption('#overview [aria-label="Annual measure"]','unemployment');await until(p,()=>/Unemployment rate, \d{4}–\d{4}/.test(document.querySelector('#overview .trend-panel h4')?.textContent??''));
  await p.goto(`${base}?geo=2021A000246&tm=unemployment&yr=2015-2020`);await until(p,()=>/Unemployment rate, 2015–2020/.test(document.querySelector('#overview .trend-panel h4')?.textContent??''));
  return {population:[a,c],years:raw};
});
await check('a municipality is ranked on change over its common years among its cohort',async p=>{
  await p.goto(`${base}?geo=2021A00054602044`);await until(p,()=>/among Manitoba municipalities/.test(document.querySelector('#overview .trend-panel')?.textContent??''),120000);
  const [a,c]=await span(p);if(!(a<=2001&&c>=2025))throw Error(`Municipal range ${a}-${c}`);
  return {range:[a,c],subtitle:await p.locator('#overview .trend-panel .card-sub').first().textContent()};
});
await check('economic regions read 2021-boundary estimates and Compare intersects every shown area',async p=>{
  const pids=[];p.on('request',r=>{const m=/"productId":"?(\d{8})/.exec(r.postData()??'');if(m)pids.push(m[1]);});
  await p.goto(`${base}?geo=2021S05004610`);await until(p,()=>document.querySelector('#overview .trend-panel .chart-card'));
  if(pids.includes('17100137')||!pids.includes('17100150'))throw Error(`Population table ${[...new Set(pids)]}`);
  await p.goto(`${base}?tm=employment#compare`);await until(p,()=>document.querySelector('#compare .trend-panel .chart-card,#compare .trend-panel .notice'));
  return {compare:await p.locator('#compare .trend-panel').innerText().then(t=>t.slice(0,300))};
});
await check('payroll shift-share takes a chosen base year from the published SEPH years',async p=>{
  await p.goto(`${base}?geo=2021A000246&py=2015-2024#industries`);await until(p,()=>/payroll jobs from 2015 to 2024/.test(document.querySelector('#industries .economy-cards')?.textContent??''));
  const [a]=await p.evaluate(()=>[...document.querySelectorAll('#industries .trend-range .range-ends span')].map(x=>Number(x.textContent)));
  return {first:a};
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
  await p.goto(`${base}?geo=2021A000246&iv=largest#industries`);await until(p,()=>document.querySelector('.industry-name'));
  const name=await p.locator('.industry-name').first().textContent(),jobs=await p.locator('.rank-value>span').first().textContent();
  await p.locator('.industry-brief .kebab').click();await p.getByRole('menuitem',{name:'View data table'}).click();
  const row=await p.locator('dialog tbody tr').first().locator('td,th').allTextContents();
  if(row[0]!==name||row[1]!==jobs)throw Error('Displayed and source-table values differ');
  await p.keyboard.press('Escape');await p.locator('.industry-brief .kebab').click();
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
  await p.goto(`${base}?geo=2021A000246&pm=chosen#compare`);
  await p.getByRole('searchbox',{name:'Find a peer'}).fill('Ontario');
  await until(p,()=>document.querySelector('.peer-result'));await p.locator('.peer-result').first().click();
  await until(p,()=>document.querySelector('.comparison-table')?.querySelectorAll('tbody tr').length===3);
  const url=p.url();if(!url.includes('peers=2021A000235'))throw Error('Peer missing from URL');
  await p.reload();await until(p,()=>document.querySelector('.comparison-table')?.querySelectorAll('tbody tr').length===3);
  await p.getByRole('button',{name:'Remove Ontario'}).click();await until(p,()=>document.querySelector('.comparison-table')?.querySelectorAll('tbody tr').length===2);
  return {url};
});
await check('keyboard geography selection, province benchmark and inactive-tab refresh',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await p.locator('#place-input').fill('Brandon');
  await until(p,()=>document.querySelector('#place-list [role=option]'));await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
  await until(p,()=>document.querySelector('#place-name').textContent==='Brandon');await p.selectOption('#bench','PT');
  await until(p,()=>/Manitoba [\d$]/.test(document.querySelector('#overview .findings.census')?.textContent??''));
  await nav(p,'detail');await p.getByRole('button',{name:'Work and education',exact:true}).click();
  await until(p,()=>document.querySelector('#detail .legend')?.textContent.includes('Manitoba'));
  return {url:p.url(),place:await p.locator('#place-name').textContent()};
});
await check('Back and Forward restore geography without stale headings',async p=>{
  await p.goto(`${base}?geo=2021A000246`);await p.selectOption('#province','35');await until(p,()=>document.querySelector('#place-name').textContent==='Ontario');
  await p.goBack();await until(p,()=>document.querySelector('#place-name').textContent==='Manitoba');
  await p.goForward();await until(p,()=>document.querySelector('#place-name').textContent==='Ontario');return {restored:true};
});
await check('Census outage leaves payroll independent and Retry recovers',async p=>{
  let block=true;await p.route('**/api.statcan.gc.ca/**',r=>block?r.abort():r.continue());
  await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelector('#overview .state.failure')&&document.querySelector('#overview .findings.recent .finding-value'));
  await nav(p,'industries');await until(p,()=>document.querySelector('.industry-name'));block=false;
  await nav(p,'overview');await until(p,()=>document.querySelector('#overview .findings.census .finding-value'));return {recovered:true};
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
// The industry Location tab is a second map entry point: it must load the map library itself.
await check('industry location map draws without the explore dialog having opened',async p=>{
  await p.goto(`${base}?geo=2021A000246&ins=6221&inst=location#industries`);
  await until(p,()=>document.querySelector('.overlay .maplibregl-canvas')||/could not load/.test(document.querySelector('.overlay')?.textContent??''));
  if(!await p.locator('.overlay .maplibregl-canvas').count())throw Error('Location map did not draw');
  return {kpi:await p.locator('.overlay .map-kpi b').textContent()};
});
for(const width of [1440,768,390])await check(`four views fit ${width}px and labels remain readable`,async p=>{
  await p.setViewportSize({width,height:900});await p.goto(`${base}?geo=2021A000246`);await until(p,()=>document.querySelector('#overview .finding-value'));
  for(const k of ['overview','industries','compare','detail']){await nav(p,k);await p.waitForTimeout(1000);
    if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${k}: page overflow`);
  }
  return {width};
});
await check('a province can benchmark another province across findings, trends, detail and shared URLs',async p=>{
  await p.goto(`${base}?geo=2021A000246`,{waitUntil:'domcontentloaded'});
  await until(p,()=>document.querySelector('#bench option[value="2021A000235"]'));
  await p.selectOption('#bench','2021A000235');
  await until(p,()=>/Ontario/.test(document.querySelector('#overview .findings.census')?.textContent??'')&&/Ontario/.test(document.querySelector('#overview .trend-panel .legend')?.textContent??''));
  const cells=await p.locator('#overview .recent-detail .chart-card tbody tr',{hasText:'Employment rate, age 15+'}).locator('td').allTextContents();
  const raw=await p.evaluate(async()=>{const {census}=await import('./js/api.js');return (await census({id:'2021A000235',type:'PR'})).value('2229');});
  if(cells[1]!==`${raw.toFixed(1)}%`)throw Error(`Benchmark value ${cells[1]} differs from Ontario ${raw}`);
  await nav(p,'detail');await until(p,()=>[...document.querySelectorAll('#detail .legend')].some(e=>/Ontario/.test(e.textContent)));
  await nav(p,'compare');await until(p,()=>[...document.querySelectorAll('#compare .comparison-table tbody th')].some(e=>e.textContent==='Ontario'));
  const count=await p.locator('#compare .comparison-table').first().locator('tbody th',{hasText:/^Ontario$/}).count();
  if(count!==1)throw Error(`Benchmark duplicated ${count} times`);
  const url=p.url();await p.reload({waitUntil:'domcontentloaded'});
  await until(p,()=>document.querySelector('#bench').value==='2021A000235'&&document.querySelector('#compare .bar-row'));
  return {benchmark:'Ontario',url};
});
await check('county benchmarks search the same level across provinces and history restores the selection',async p=>{
  await p.goto(`${base}?geo=2021A00034611`,{waitUntil:'domcontentloaded'});
  await until(p,()=>document.querySelector('#bench option[value="custom"]'));
  await p.selectOption('#bench','custom');await p.locator('#bench-input').fill('Toronto');
  await until(p,()=>/Toronto/.test(document.querySelector('#bench-list [role=option]')?.textContent??''));
  await p.locator('#bench-input').press('ArrowDown');await p.locator('#bench-input').press('Enter');
  await until(p,()=>/Toronto/.test(document.querySelector('#overview .findings.census')?.textContent??''));
  if(!p.url().includes('bench=2021A00033520'))throw Error('Wrong benchmark geography');
  await p.selectOption('#province','35');await until(p,()=>document.querySelector('#place-name').textContent==='Ontario'&&document.querySelector('#bench').value==='CA');
  await p.goBack();await until(p,()=>document.querySelector('#bench-input').value==='Toronto'&&document.querySelector('#place-name').textContent==='Division No. 11');
  await p.reload({waitUntil:'domcontentloaded'});await until(p,()=>document.querySelector('#bench-input').value==='Toronto'&&document.querySelector('#overview .cohort-charts .bench-tick'));
  return {benchmark:'Toronto census division',url:p.url()};
});
await check('municipal benchmark selection is keyboard accessible and applies on phones',async p=>{
  await p.setViewportSize({width:390,height:900});await p.goto(`${base}?geo=2021A00054602044`,{waitUntil:'domcontentloaded'});
  await until(p,()=>document.querySelector('#bench option[value="custom"]'));
  await p.selectOption('#bench','custom');await p.locator('#bench-input').fill('Winnipeg');
  await until(p,()=>/Winnipeg/.test(document.querySelector('#bench-list [role=option]')?.textContent??''));
  await p.locator('#bench-input').press('Enter');await until(p,()=>/Winnipeg/.test(document.querySelector('#overview .findings.census')?.textContent??''));
  if(!p.url().includes('bench=2021A00054611040')||await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Wrong municipal benchmark or page overflow');
  return {benchmark:'Winnipeg',width:390};
});
await b.close();console.log(`${R.filter(r=>r.pass).length}/${R.length} passed`);
if(R.some(r=>!r.pass))process.exitCode=1;
