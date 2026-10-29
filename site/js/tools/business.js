// Business-count adapters shared by industry summaries and maps. Missing cells need evidence before becoming zero.
import {catalog,tablePair,businessSlice,memoRequest,coord} from '../api.js';
import {CANADA,PT,completeSum,locationQuotient} from '../model.js';
const provinceOf=place=>({id:`2021A0002${String(place.province).split('_')[0]}`,type:'PR',name:PT.find(p=>p[0]===String(place.province).split('_')[0])?.[2]});

// Business Counts row for the industry: national table for Canada and provinces, local table for CMAs and CSDs.
const estCache=new Map();
export function businessIndustry(place,code) {
  return memoRequest(estCache,`${place.id}:${code}`,async()=>{
    const local=['CSD','CMACA'].includes(place.type),geo=local||place.type==='PR'?place:provinceOf(place),cat=await catalog(),pair=tablePair(cat,local),nat=tablePair(cat,false);
    const level=String(code.length);
    const [cur,prev,ca]=await Promise.all([businessSlice(pair.current,geo,level),pair.previous?businessSlice(pair.previous,geo,level).catch(()=>null):null,businessSlice(nat.current,CANADA,level)]);
    const row=cur.rows.find(r=>r.code===code),before=prev?.rows.find(r=>r.code===code),natRow=ca.rows.find(r=>r.code===code);
    const tot=completeSum(cur.rows.map(r=>r.locations)),natTot=completeSum(ca.rows.map(r=>r.locations));
    return {geoName:local||place.type==='PR'?place.name:geo.name,table:pair.current,period:pair.current.cubeTitleEn.match(/(June|December) \d{4}$/)[0],prior:pair.previous?.cubeTitleEn.match(/(June|December) \d{4}$/)[0],
      current:row?.locations??null,previous:before?.locations??null,N:row?.N??[],sizes:cur.sizes,lq:locationQuotient(row?.locations??null,tot,natRow?.locations??null,natTot)};
  });
}

export const clearBusiness=()=>estCache.clear();

// matched: [{g, mem}] maps official geography to its table member; points are keyed by WDS coordinate.
export function businessMatrix(matched,points,industry,subtotal) {
  const at=(member,code)=>points.get(coord([member,1,code]))?.at(-1)?.value??null;
  return new Map(matched.map(({g,mem})=>{
    const total=at(mem.memberId,subtotal),n=at(mem.memberId,industry);
    return [g.id,{name:g.name,total,values:[n??(total===0?0:null)]}];
  }));
}
