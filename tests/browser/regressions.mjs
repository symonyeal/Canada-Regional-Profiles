// Deterministic UI checks at real rendering seams; synthetic observations never leave this test.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [base='http://127.0.0.1:8772/',out]=process.argv.slice(2);
if(!out)throw Error('Provide an evidence report path.');
const b=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
async function check(name,fn){
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(`${base}__test__`,r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));
  try {
    await p.goto(`${base}__test__`);await fn(p);
    if(errors.length)throw Error(errors.join('; '));
    results.push({name,pass:true});console.log('PASS',name);
  } catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);}
  finally {await p.close();}
}
await check('suppressed benchmark sectors leave the resident-sector table available',async p=>{
  await p.evaluate(async()=>{
    const {industries}=await import('./js/tools/industries.js');
    const {parse}=await import('./js/state.js');
    const g={id:'2021A00054602044',type:'CSD',name:'Selected'},bench={id:'2021A00054611040',type:'CSD',name:'Benchmark'};
    // Drive the view through its actual pair/adapters, including a valid profile with suppressed benchmark cells.
    globalThis.fetch=async url=>{
      const selected=String(url).includes(g.id),ids=['2261','2262','2263','2264'];
      const values=selected?[100,50,30,20]:[100,null,0,null];
      return new Response(JSON.stringify({data:{structure:{dimensions:{series:[
        {id:'REF_AREA',values:[selected?g:bench]},{id:'GENDER',values:[{id:'1'}]},
        {id:'CHARACTERISTIC',values:ids.map(id=>({id,name:`Sector ${id}`}))},{id:'STATISTIC',values:[{id:'1'}]}
      ],observation:[{id:'TIME_PERIOD',values:[{id:'2021'}]}]}},dataSets:[{series:Object.fromEntries(ids.map((_,i)=>[
        `0:0:${i}:0`,{observations:{0:[values[i]]}}
      ]))}]}}));
    };
    const el=document.createElement('div');document.body.append(el);
    const app={state:parse(`?geo=${g.id}`,'#industries'),bench,resolved:async()=>g,set(){}};
    industries(el,app).update(new Set(['geo']));
  });
  await p.waitForFunction(()=>document.querySelector('.economy-cards table,.economy-cards .state.failure'));
  if(await p.locator('.economy-cards .state.failure').count())throw Error(await p.locator('.economy-cards .state.failure').innerText());
  if(await p.locator('.economy-cards tbody tr').count()!==3)throw Error('Published resident sectors missing');
});
await check('annual gaps keep calendar spacing and missing values in the chart and data table',async p=>{
  await p.evaluate(async()=>{
    const {trendPanel}=await import('./js/tools/trends.js'),{parse}=await import('./js/state.js');
    const g={id:'2021A00054602044',type:'CSD',name:'Selected'};
    const bench={id:'2021A00054611040',type:'CSD',name:'Benchmark',bench:true};
    globalThis.fetch=async(url,opts)=>{
      const metadata={productId:'17100155',cubeStartDate:'2000-01-01',cubeEndDate:'2004-01-01',cubeTitleEn:'Population',dimension:[
        {dimensionNameEn:'Geography',member:[{memberId:1,classificationCode:'4602044',memberNameEn:g.name},{memberId:2,classificationCode:'4611040',memberNameEn:bench.name}]}
      ]};
      const value=url.endsWith('getCubeMetadata')?[{status:'SUCCESS',object:metadata}]:JSON.parse(opts.body).map(x=>({status:'SUCCESS',object:{coordinate:x.coordinate,
        vectorDataPoint:[{refPer:'2000',value:100},{refPer:'2002',value:120},{refPer:'2004',value:140}]}}));
      return new Response(JSON.stringify(value));
    };
    const el=document.createElement('div');document.body.append(el);
    trendPanel(el,{state:parse(''),set(){}},{g,rows:async()=>[g,bench],alive:()=>true});
  });
  await p.waitForFunction(()=>document.querySelector('.chart-svg path'));
  const path=await p.locator('.chart-svg path').first().getAttribute('d');
  if((path.match(/M/g)??[]).length!==3)throw Error(`Missing years were bridged: ${path}`);
  await p.getByRole('button',{name:/Options for Population/}).click();
  await p.getByRole('menuitem',{name:'View data table',exact:true}).click();
  const rows=await p.locator('dialog tbody tr').allTextContents();
  if(rows.length!==5||!rows[1].includes('2001')||!rows[1].includes('Not available'))throw Error(`Calendar gaps missing from table: ${rows}`);
});
await check('line charts preserve missing observations and use the series units for accessible values',async p=>{
  await p.evaluate(async()=>{
    const {lines}=await import('./js/charts.js');
    document.body.append(lines({x:['2000','2001'],series:[{name:'Income',color:'#000',values:[null,1234],fmt:v=>`$${v.toFixed(0)}`}],fmt:v=>v.toFixed(1)}));
  });
  await p.waitForFunction(()=>document.querySelector('.chart-svg circle'));
  const chart=await p.locator('.chart-svg').getAttribute('aria-label'),point=await p.locator('circle').getAttribute('aria-label');
  if(!chart.includes('2000 Not available')||!chart.includes('$1234')||!point.includes('$1234'))throw Error(`${chart}; ${point}`);
});
await check('shared search ignores stale results, cancels on Escape and selects by keyboard',async p=>{
  await p.evaluate(async()=>{
    const {h,combobox}=await import('./js/ui.js'),input=h('input',{id:'search'}),list=h('ul',{id:'matches',hidden:true});
    document.body.append(input,list);window.searches=new Map();window.chosen='';
    combobox(input,list,{load:q=>new Promise(resolve=>searches.set(q,resolve)),choose:r=>{window.chosen=r.name;},
      describe:r=>[r.name,''],pending:'Loading',empty:'No matches',error:'Search unavailable'});
  });
  const input=p.locator('#search');await input.fill('old');await input.fill('new');
  await p.evaluate(()=>searches.get('new')([{name:'Latest'}]));
  await p.getByRole('option',{name:'Latest',exact:true}).waitFor();
  await p.evaluate(()=>searches.get('old')([{name:'Stale'}]));
  if(await p.getByRole('option',{name:'Stale',exact:true}).count())throw Error('Stale results replaced the current search');
  await input.press('ArrowDown');await input.press('Enter');
  if(await p.evaluate(()=>chosen)!=='Latest')throw Error('Keyboard selection failed');
  await p.evaluate(()=>{window.chosen='';});await input.fill('cancelled');await input.press('Enter');await input.press('Escape');
  await p.evaluate(()=>searches.get('cancelled')([{name:'Cancelled'}]));
  if(await p.evaluate(()=>chosen!==''||!document.querySelector('#matches').hidden))throw Error('Pending search survived cancellation');
});
await b.close();fs.writeFileSync(out,JSON.stringify({base,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
