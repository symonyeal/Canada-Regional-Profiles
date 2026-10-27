// Census Profile 2021 characteristic identifiers (codelist CL_CHARACTERISTIC) behind each exhibit.
// These are classification identifiers and bin edges, not observations. Groups sum published components only.
import {MAP_SCALE} from './palette.js';

const ids=(a,b)=>Array.from({length:b-a+1},(_,i)=>String(a+i));
const money=v=>v==null?'+':`$${v.toLocaleString('en-CA')}`;

export const KPI={population:'1',populationChange:'3',medianAge:'40',households:'50',householdSize:'56',dwellings:'5',
  medianHouseholdIncome:'229',medianIndividualIncome:'113',dwellingValue:'1474',rent:'1480',
  participation:'2228',employmentRate:'2229',unemployment:'2230',labourForce:'2224'};

// Ten-year age bands as sums of published five-year groups (total 8).
export const AGE10={total:'8',groups:[['0 to 9',['10','11']],['10 to 19',['12','14']],['20 to 29',['15','16']],['30 to 39',['17','18']],
  ['40 to 49',['19','20']],['50 to 59',['21','22']],['60 to 69',['23','25']],['70 to 79',['26','27']],['80 and older',['28','29']]]};
// The reference's five household-income bands, as sums of published 2020 income groups (total 246).
export const HH_INCOME5={total:'246',groups:[['Under $40K',ids(247,254)],['$40K–$80K',ids(255,259)],['$80K–$125K',['260','261','263']],
  ['$125K–$200K',['264','265']],['$200K+',['266']]]};
export const HH_TYPE={total:'100',groups:[['One-person households',['110']],['Couple-family, with children',['103']],['Couple-family, without children',['104']],
  ['One-parent-family households',['105']],['Two-or-more-person non-census-family',['109']],['One-census-family with additional persons',['108']],
  ['Multigenerational households',['106']],['Multiple-census-family households',['107']]]};
export const HH_SIZE={total:'50',groups:[['1 person',['51']],['2 persons',['52']],['3 persons',['53']],['4 persons',['54']],['5 or more persons',['55']]]};
export const TENURE={total:'1400',groups:[['Owner',['1401']],['Renter',['1402']],['Band or government housing',['1403']]]};
export const CONSTRUCTION={total:'1426',groups:[['1960 or before',['1427']],['1961 to 1980',['1428']],['1981 to 1990',['1429']],['1991 to 2000',['1430']],
  ['2001 to 2005',['1431']],['2006 to 2010',['1432']],['2011 to 2015',['1433']],['2016 to 2021',['1434']]]};
export const DWELLING={total:'41',groups:[['Single-detached house',['42']],['Apartment, fewer than 5 storeys',['46']],['Apartment, 5 or more storeys',['47']],
  ['Row house',['44']],['Semi-detached house',['43']],['Apartment or flat in a duplex',['45']],['Movable dwelling',['49']],['Other single-attached house',['48']]]};
export const COMMUTE_MODE={total:'2603',groups:[['Car, truck or van, as driver',['2605']],['Car, truck or van, as passenger',['2606']],['Public transit',['2607']],
  ['Walked',['2608']],['Bicycle',['2609']],['Other method',['2610']]]};
export const PLACE_OF_WORK={total:'2593',groups:[['Usual place of work',['2597']],['Worked at home',['2594']],['No fixed workplace address',['2596']],['Worked outside Canada',['2595']]]};
export const COMMUTE_TIME={total:'2611',groups:[['Less than 15 minutes',['2612']],['15 to 29 minutes',['2613']],['30 to 44 minutes',['2614']],['45 to 59 minutes',['2615']],['60 minutes and over',['2616']]]};
// Population aged 25 to 64 (total 2014). The four reference indicators are nested, not a partition.
export const EDUCATION={total:'2014',groups:[['Postsecondary certificate, diploma or degree',['2017']],['Bachelor’s degree or higher',['2024']],
  ['Master’s degree or higher',['2028','2029']],['Other above bachelor’s degree',['2026','2027']]]};
export const OCCUPATION={total:'2248',groups:ids(2249,2258).map(id=>[null,[id]])};
export const INDUSTRY={total:'2261',groups:ids(2262,2281).map(id=>[null,[id]])};

// Market and catchment filters. kind range: ordered bins chosen as a contiguous interval; kind toggle: any subset.
// lo/hi are the bin edges used for the interval label.
export const FILTERS={
  consumers:{title:'Local consumers',unit:'Consumers',icon:'household',description:'People counted in the selected Census bins. The map shows each census subdivision’s count or share; the card shows the selected area’s own published total.',maps:{
    income:{label:'by Individual income',icon:'dollar',kind:'range',total:'150',ramp:MAP_SCALE,default:[3,6],
      bins:[...ids(151,160),'162','163'].map((id,i)=>({id,lo:[0,1e4,2e4,3e4,4e4,5e4,6e4,7e4,8e4,9e4,1e5,1.5e5][i],hi:[1e4,2e4,3e4,4e4,5e4,6e4,7e4,8e4,9e4,1e5,1.5e5,null][i]})),
      text:(a,b)=>b.hi==null?`${money(a.lo)} and over`:`${money(a.lo)} - ${money(b.hi)}`,ends:['$0','$150,000+'],universe:'Population aged 15+ with total income, 2020'},
    age:{label:'by Individual age',icon:'user',kind:'range',total:'8',ramp:MAP_SCALE,default:[2,11],
      bins:[...ids(10,12),...ids(14,23),...ids(25,29)].map((id,i)=>({id,lo:i*5,hi:i===17?null:i*5+4})),
      text:(a,b)=>b.hi==null?`${a.lo}+`:`${a.lo} - ${b.hi}`,ends:['0','85+'],universe:'Total population, 2021'},
    hhincome:{label:'by Household income',icon:'home',kind:'range',total:'246',ramp:MAP_SCALE,default:[4,10],
      bins:[...ids(247,261),...ids(263,266)].map((id,i)=>({id,lo:[0,5e3,1e4,1.5e4,2e4,2.5e4,3e4,3.5e4,4e4,4.5e4,5e4,6e4,7e4,8e4,9e4,1e5,1.25e5,1.5e5,2e5][i],
        hi:[5e3,1e4,1.5e4,2e4,2.5e4,3e4,3.5e4,4e4,4.5e4,5e4,6e4,7e4,8e4,9e4,1e5,1.25e5,1.5e5,2e5,null][i]})),
      text:(a,b)=>b.hi==null?`${money(a.lo)} and over`:`${money(a.lo)} - ${money(b.hi)}`,ends:['$0','$200,000+'],unit:'Households',universe:'Private households, 2020 income'},
    hhtype:{label:'by Household type',icon:'household',kind:'toggle',total:'100',ramp:MAP_SCALE,default:[0],
      bins:HH_TYPE.groups.map(([name,[id]])=>({id,name})),unit:'Households',universe:'Private households, 2021'},
  }},
  dwellings:{title:'Local dwellings',unit:'Dwellings',icon:'dwelling',description:'Occupied private dwellings counted in the selected Census bins.',maps:{
    period:{label:'by Construction period',icon:'clock',kind:'range',total:'1426',ramp:MAP_SCALE,default:[3,6],
      bins:CONSTRUCTION.groups.map(([name,[id]],i)=>({id,name,lo:[null,1961,1981,1991,2001,2006,2011,2016][i],hi:[1960,1980,1990,2000,2005,2010,2015,2021][i]})),
      text:(a,b)=>a.lo==null?`1960 or before - ${b.hi}`:`${a.lo} - ${b.hi}`,ends:['< 1960','2021'],universe:'Occupied private dwellings, 2021'},
    structure:{label:'by Structure type',icon:'building',kind:'toggle',total:'41',ramp:MAP_SCALE,default:[0],
      bins:DWELLING.groups.map(([name,[id]])=>({id,name})),universe:'Occupied private dwellings, 2021'},
    tenure:{label:'by Tenure',icon:'key',kind:'toggle',total:'1400',ramp:MAP_SCALE,default:[1],
      bins:TENURE.groups.map(([name,[id]])=>({id,name})),unit:'Households',universe:'Private households, 2021'},
    bedrooms:{label:'by No. of bedrooms',icon:'bed',kind:'range',total:'1407',ramp:MAP_SCALE,default:[2,3],
      bins:ids(1408,1412).map((id,i)=>({id,lo:i,hi:i===4?null:i})),text:(a,b)=>b.hi==null?`${a.lo}+ bedrooms`:a.lo===b.hi?`${a.lo} bedroom${a.lo===1?'':'s'}`:`${a.lo} - ${b.hi} bedrooms`,
      ends:['0','4+'],universe:'Occupied private dwellings, 2021'},
  }},
  businesses:{title:'Local businesses',unit:'Businesses',icon:'store',description:'Employer business locations in the selected industries, from the latest Canadian Business Counts release.',maps:{
    industry:{label:'by Industry',icon:'store',kind:'toggle',source:'business',ramp:MAP_SCALE,default:[0],bins:null,universe:'Employer locations with employees'},
  }},
  workforce:{title:'Workforce',unit:'Workers',icon:'workforce',description:'Three independent maps. Pick one, then switch its groups on or off.',maps:{
    education:{label:'by Education',icon:'graduation',kind:'toggle',total:'2014',ramp:MAP_SCALE,default:[1],
      bins:[['No certificate, diploma or degree','2015'],['High school diploma or equivalent','2016'],['Apprenticeship or trades certificate','2019'],
        ['College, CEGEP or other non-university diploma','2022'],['University certificate below bachelor level','2023'],['Bachelor’s degree','2025'],
        ['University certificate above bachelor level','2026'],['Medicine, dentistry, veterinary or optometry','2027'],['Master’s degree','2028'],['Earned doctorate','2029']].map(([name,id])=>({id,name})),
      unit:'People',universe:'Population aged 25 to 64, 2021'},
    occupation:{label:'by Occupation',icon:'briefcase',kind:'toggle',total:'2248',ramp:MAP_SCALE,default:[1],
      bins:ids(2249,2258).map(id=>({id,name:null})),unit:'Workers',universe:'Labour force aged 15+, 2021'},
    industry:{label:'by Industry',icon:'factory',kind:'toggle',total:'2261',ramp:MAP_SCALE,default:[15],
      bins:ids(2262,2281).map(id=>({id,name:null})),unit:'Workers',universe:'Labour force aged 15+, 2021'},
  }},
};

// Every characteristic an exhibit reads: one request per area instead of the 2,600-characteristic profile.
export const PROFILE_IDS=(()=>{
  const s=new Set(Object.values(KPI).concat(['2225','2226']));
  for(const g of [AGE10,HH_INCOME5,HH_TYPE,HH_SIZE,TENURE,CONSTRUCTION,DWELLING,COMMUTE_MODE,PLACE_OF_WORK,COMMUTE_TIME,EDUCATION,OCCUPATION,INDUSTRY]){s.add(g.total);for(const [,ids] of g.groups)ids.forEach(i=>s.add(i));}
  for(const group of Object.values(FILTERS))for(const m of Object.values(group.maps)){if(m.total)s.add(m.total);for(const b of m.bins??[])s.add(b.id);}
  return [...s].sort((a,b)=>a-b);
})();
