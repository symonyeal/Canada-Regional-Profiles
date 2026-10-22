import {journal} from './api.js';
import {heading,notice,card,table,sourceLink} from './charts.js';
export async function sources(root) {
  heading(root,'Data & coverage','What is queried, what each measure means, and where this public-data implementation differs from the reference.', 'Sources & methods');
  notice(root,'The interface queries public services directly. No downloaded observation files, prebuilt jurisdiction bundles, local storage or background data refresh are used. An in-memory cache lasts until this tab is reloaded or Refresh is selected. The classification JSON contains NAICS rules, not observations.');
  const node=card(root,{title:'Reference tools and public equivalents'}),body=document.createElement('div');body.className='source-table';
  body.innerHTML=table(['Reference tool','This site','Coverage / distinction'],[
    ['Logistics & access','Live boundary / OSM map; airports, roads, rail stations, harbours, schools','Viewport queries capped at 500; OAG routes are not reproduced; broadband links to ISED, without a household aggregate.'],
    ['Community profile','Age pyramid; housing, households, language, immigration, Indigenous identity','Country, province/territory, municipality, census division, metro/agglomeration, economic region, population centre.'],
    ['Community explorer','Search, population filters, live multi-place comparison','Official Census geographies; population centres are not a municipal rural/urban classification.'],
    ['Market advantages','Household income, housing costs, tenure, suitability and mobility','Income is for 2020. A Census profile, not a current real-estate price feed.'],
    ['Workforce advantages','Labour rates, NOC occupations, NAICS sectors, education and commuting','Resident labour force in 2021; all genders, Men+, Women+.'],
    ['Industry insights','Location quotients, specialization/growth bubble chart, treemap','Estimated employment from Business Register size classes; Canada benchmark at same industry level.'],
    ['Fast-growing industries','Absolute/percentage five-year changes; minimum-base filter','Matched June/December releases. Recoded or suppressed industries have no comparable rate.'],
    ['Largest industries','2/3/4-digit rankings; 6-digit where published; traded/local; bounds','Canada/provinces and published CMA/CSD geographies. Other levels show a labelled Census sector view.'],
    ['Talent pipeline','PSIS field enrolments and trends; institution, type, registration, status and gender','Institution or province scope; resident qualifications shown separately for local areas.'],
  ]);node.append(body);root.append(node);
  notice(root,'Exact Localintel chart parity remains unverified. The reference’s embeds returned HTTP 406 / browser navigation failures during inspection on 2026-10-22. This is an independently implemented public-data counterpart. Proprietary schedules, custom geographies, private classifications and unavailable aggregates are not fabricated.',true);
  const refs=card(root,{title:'Public services and documentation'}),list=document.createElement('div');list.className='source-table';list.innerHTML=[
    ['https://www.statcan.gc.ca/en/developers','Statistics Canada developer services'],
    ['https://www12.statcan.gc.ca/wds-sdw/2021profile-profil2021-eng.cfm','Census Profile 2021 Web Data Service guide'],
    ['https://www.statcan.gc.ca/en/developers/wds/user-guide','Statistics Canada WDS guide'],
    ['https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite','Live table catalogue used to discover Business Counts releases'],
    ['https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710027701','PSIS institutional enrolments'],
    ['https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer','Census cartographic boundary service'],
    ['https://www.openstreetmap.org/copyright','OpenStreetMap licensing and attribution'],
    ['https://ised-isde.canada.ca/app/scr/sittibc/web/bbmap/hm.html?lang=eng','ISED National Broadband Map'],
    ['https://advanceruralmanitoba.ca/why-rural-manitoba/','Advance Rural Manitoba reference'],
  ].map(([u,t])=>`<p>${sourceLink(u,t)}</p>`).join('');refs.append(list);
  const requests=card(root,{title:'Requests made in this browser session',subtitle:'Retrieval time is not the observation period.'}),log=document.createElement('div');log.className='source-table source-log';
  log.innerHTML=table(['Public endpoint','HTTP status','Retrieved (UTC)'],journal.slice(-50).map(r=>[r.url,r.status,r.retrieved]));requests.append(log);
}
