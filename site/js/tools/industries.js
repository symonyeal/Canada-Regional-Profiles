// Detailed industry employment: SEPH payroll employment for Canada and provinces; Business Register employee
// estimates for metropolitan areas and census subdivisions, labelled as estimates.
import {seph,catalog,tablePair,businessSlice,request,table,SourceError} from '../api.js';
import {CANADA,estimate,rankIndustries,tradedShare} from '../model.js';

let rules;
const classification=()=>rules??=request('classification.json').catch(e=>{rules=null;throw e;});
// Traded when at least half of the code's US 2017 six-digit descendants are in Delgado-Porter-Stern traded clusters.
const isTraded=(code,c)=>{const s=tradedShare(code,c.codes,c.traded);return s==null?null:s>=.5;};

const cache=new Map();
async function industryData(place) {
  const key=place.id;if(cache.has(key))return cache.get(key);
  const p=(async()=>{
    const c=await classification();
    if(place.type==='PR'){
      const d=await seph(place,'4'),y=d.year;
      const all=d.rows.map(r=>({...r,traded:isTraded(r.code,c)}));
      const ranked=rankIndustries(all.filter(r=>r.value!=null),'value',{total:d.total,nationalTotal:d.nationalTotal});
      return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:y-5,measure:'jobs',
        source:{source:'Statistics Canada, table 14-10-0202: Employment by industry, annual (SEPH)',url:table('14100202'),
          universe:'All employees on payrolls, annual average, by establishment industry (NAICS 4-digit)',period:`${y}; growth compares ${y-5} and ${y}`,
          notes:`Location quotient: the area's share of its industrial aggregate [00-91N] divided by Canada's share. Traded/local follows a mapped US cluster classification and is approximate. ${all.filter(r=>r.value==null).length} of ${all.length} industries are suppressed or not published for ${place.name}.`}};
    }
    if(!['CSD','CMACA'].includes(place.type)) throw new SourceError('unsupported',`Industry employment is published for Canada, provinces and territories (SEPH) and as Business Register estimates for metropolitan areas and municipalities. It is not published for ${place.type==='CD'?'census divisions':place.type==='ER'?'economic regions':'population centres'}.`);
    const cat=await catalog(),local=tablePair(cat,true),nat=tablePair(cat,false);
    const [cur,prev,canada]=await Promise.all([businessSlice(local.current,place,'4'),local.previous?businessSlice(local.previous,place,'4').catch(()=>null):null,businessSlice(nat.current,CANADA,'4')]);
    const before=new Map(prev?.rows.map(r=>[r.code,estimate(r.N).value])??[]),ca=new Map(canada.rows.map(r=>[r.code,estimate(r.N).value]));
    const all=cur.rows.map(r=>({code:r.code,name:r.name,value:estimate(r.N).value,previous:before.get(r.code)??null,national:ca.get(r.code)??null,traded:isTraded(r.code,c)}));
    const ranked=rankIndustries(all.filter(r=>r.value!=null),'value',{total:cur.totalEstimate.value,nationalTotal:canada.totalEstimate.value});
    const y=Number(local.current.cubeTitleEn.slice(-4));
    return {rows:ranked,suppressed:all.filter(r=>r.value==null).length,count:all.length,year:y,prior:local.previous?y-5:null,measure:'estimated employees',estimate:true,
      source:{source:`Statistics Canada, ${local.current.cubeTitleEn}${local.previous?` and ${local.previous.cubeTitleEn.match(/(June|December) \d{4}$/)[0]}`:''}`,url:table(local.current.productId),
        universe:'Employer business locations by employment-size class, converted to employees at class midpoints (500 for 500+)',period:local.current.cubeTitleEn.match(/(June|December) \d{4}$/)[0],
        notes:'These are estimates from size classes, not payroll counts. Industries recoded between releases have no growth value. Traded/local is approximate.'}};
  })();
  cache.set(key,p);p.catch(()=>cache.delete(key));return p;
}

export const industryCache={data:industryData,classification,clear:()=>cache.clear()};
