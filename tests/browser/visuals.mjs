// Map/chart regression checks. Legend: p = page; M = real MapLibre instances; R = observed results.
// Usage: node tests/browser/visuals.mjs <base-url> <evidence-path>.
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [base='http://127.0.0.1:8773/',out]=process.argv.slice(2);
if(!out)throw Error('Provide an evidence path.');
const b=await chromium.launch({executablePath:process.env.BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),R=[];
async function check(name,fn){
  if(process.env.VISUAL_FILTER&&!name.includes(process.env.VISUAL_FILTER))return;
  const p=await b.newPage({viewport:{width:1440,height:1050}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{let lib;window.__maps=[];Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>lib,set:v=>{
    const M=v.Map;v.Map=class extends M{constructor(...a){super(...a);window.__maps.push(this);}};lib=v;
  }});});
  try{const detail=await fn(p);if(errors.length)throw Error(errors.join('; '));R.push({name,pass:true,detail});console.log('PASS',name);}
  catch(e){R.push({name,pass:false,error:e.message,errors});console.log('FAIL',name,e.message.split('\n')[0]);}
  finally{await p.close();fs.writeFileSync(out,JSON.stringify({base,results:R},null,2));}
}
const open=async(p,g='2021A000246')=>{await p.goto(`${base}?geo=${g}`,{waitUntil:'domcontentloaded'});await p.locator('#explore-map').click();await p.waitForFunction(()=>window.__maps.length>0);};
const size=async p=>{
  const s=await p.locator('.map-dialog .map').evaluate(e=>({w:e.clientWidth,h:e.clientHeight,canvas:e.querySelector('canvas')?.getBoundingClientRect().height}));
  if(s.w<200||s.h<250||Math.abs(s.canvas-s.h)>2)throw Error(`Map/canvas do not fill their viewport: ${JSON.stringify(s)}`);return s;
};
await check('late map stylesheet leaves an actual full-height map',async p=>{
  await p.route(/maplibre-gl\.css/,async r=>{await new Promise(done=>setTimeout(done,1200));await r.continue();});
  await open(p);await p.waitForTimeout(2500);return size(p);
});
await check('boundaries render with the basemap offline; switching and closing dispose maps',async p=>{
  await p.route(/https:\/\/tiles\.openfreemap\.org\//,r=>r.abort());await open(p);
  await p.waitForFunction(()=>window.__maps.at(-1).getLayer('areas-fill'),undefined,{timeout:90000});
  await size(p);
  await p.waitForFunction(()=>window.__maps.at(-1).queryRenderedFeatures({layers:['areas-fill']}).length>0,undefined,{timeout:15000});
  const n=await p.evaluate(()=>window.__maps.at(-1).queryRenderedFeatures({layers:['areas-fill']}).length);
  await p.getByRole('button',{name:'Find communities',exact:true}).click();
  await p.waitForFunction(()=>window.__maps.at(-1).getLayer('csd-fill'),undefined,{timeout:90000});
  await size(p);await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('.map-dialog'));
  if(p.url().includes('map='))throw Error('Map URL state not cleared');return {features:n};
});
await check('phone map keeps a usable viewport',async p=>{
  await p.setViewportSize({width:390,height:844});await open(p);await p.waitForTimeout(1200);
  const map=await p.locator('.map-cell').boundingBox(),filters=await p.locator('.filters').boundingBox();
  if(map.y>=filters.y)throw Error('The long filter list precedes the phone map');return size(p);
});
await check('clicking a province on the national map opens a provincial profile',async p=>{
  await open(p,'2021A000011124');
  await p.waitForFunction(()=>{const m=window.__maps.at(-1);return m.getLayer('areas-fill')&&m.queryRenderedFeatures({layers:['areas-fill']}).length>0;},undefined,{timeout:90000});
  const point=await p.evaluate(()=>{const m=window.__maps.at(-1),q=m.project([-115,55]),r=m.getCanvas().getBoundingClientRect();return {x:r.x+q.x,y:r.y+q.y};});
  await p.mouse.click(point.x,point.y);await p.waitForFunction(()=>document.querySelector('#place-name').textContent==='Alberta');
  const type=await p.evaluate(async()=>{const {parse}=await import('./js/state.js');return parse(location.search,location.hash).geo.type;});
  if(type!=='PR')throw Error(`National map opened ${type} instead of PR`);return {type,place:'Alberta'};
});
await check('a delayed OECD source leaves Statistics Canada findings and histories visible',async p=>{
  let release;const gate=new Promise(r=>{release=r;});
  await p.route('**/sdmx.oecd.org/**',async r=>{await gate;await r.abort();});
  try{
    await p.goto(`${base}?geo=2021A000246`,{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>document.querySelector('#overview .findings.recent .finding-history svg path'),undefined,{timeout:90000});
    const n=await p.locator('#overview .findings.recent .finding').count();
    if(!await p.locator('#overview .findings.recent .state.loading').count())throw Error('The intended slow source was not pending');
    return {independentFindings:n};
  }finally{release();}
});
await check('regional rankings expose actual Census values and the selectors change the chart',async p=>{
  await p.goto(`${base}?geo=2021A000246`,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.querySelectorAll('.cohort-charts .bar-row').length>=20,undefined,{timeout:90000});
  const chart=p.locator('.cohort-chart').first(),selected=chart.locator('.bar-row').filter({has:p.locator('.bar-label',{hasText:'Manitoba'})});
  const shown=await selected.locator('.bar-value').textContent();
  const raw=await p.evaluate(async()=>{const {census}=await import('./js/api.js');return (await census({id:'2021A000246',type:'PR'})).value('2229');});
  if(shown!==`${raw.toFixed(1)}%`)throw Error(`Ranking ${shown} differs from source ${raw}`);
  await chart.locator('select').selectOption('burden');
  if(!/Tenants spending/.test(await chart.locator('h4').textContent()))throw Error('Measure did not update');
  return {shown,raw};
});
await b.close();if(R.some(r=>!r.pass))process.exitCode=1;
