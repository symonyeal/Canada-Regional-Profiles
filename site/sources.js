import {journal} from './api.js';
import {heading,notice,card,table,sourceLink} from './charts.js';
export async function sources(root) {
  heading(root,'Data & coverage','What is queried, what each measure means, and where this public-data implementation differs from the reference.', 'Sources & methods');
  notice(root,'The interface queries public services directly. No downloaded observation files, prebuilt jurisdiction bundles, local storage or background data refresh are used. An in-memory cache lasts until this tab is reloaded or Refresh is selected. The classification JSON contains NAICS rules, not observations.');
  const node=card(root,{title:'Reference tools and public equivalents'}),body=document.createElement('div');body.className='source-table';
  body.innerHTML=table(['Reference tool','This site','Coverage / distinction'],[
    ['Logistics & access','Live boundary / OSM map; airports, roads, rail stations, harbours, schools','Viewport queries capped at 500; OAG routes are not reproduced; broadband links to ISED, without a household aggregate.'],
    ['Community profile','Economic, resident, household, dwelling, workforce and livability dashboards; station climate normals','Country, province/territory, municipality, census division, metro/agglomeration, economic region, population centre. Each series retains its own period and geographic scope.'],
    ['Community explorer','Search, population filters, live multi-place comparison','Official Census geographies; population centres are not a municipal rural/urban classification.'],
    ['Market advantages','Consumer, dwelling and business catchment maps; filterable bins, natural breaks, counts and shares','One marginal distribution at a time, as in the recovered reference. Province maps show municipalities; Canada maps provinces. No inferred intersections.'],
    ['Workforce advantages','Four education donuts, resident-industry treemap, top occupations, catchment maps and detailed indicators','Resident labour force in 2021; all genders, Men+, Women+. Recent LFS rates are separately labelled.'],
    ['Industry insights','Location quotients, specialization/growth bubbles and treemap','Published SEPH employment at national/provincial level; Business Register midpoint estimates are a separate option.'],
    ['Fast-growing industries','Absolute/percentage five-year changes; minimum-base filter; sector-coloured bubbles','SEPH annual comparison, or matched June/December Business Counts releases. Missing or recoded industries have no invented rate.'],
    ['Largest industries','Sector-grouped employment treemap; rankings, traded/local and tables','SEPH at Canada/provinces; Business Counts at published CMA/CSD geographies. Other local levels show a labelled Census sector view. Traded/local mapping is approximate.'],
    ['Talent pipeline','PSIS fields and trends; institution, type, registration, status, gender; institution map','Whole-institution counts attach only to exact facility-name matches. Groups with missing components stay unavailable. Resident qualifications remain separate.'],
  ]);node.append(body);root.append(node);
  notice(root,'The recovered reference charts and source definitions informed this implementation. Live Manitoba checks matched its largest-industry codes/counts, education counts, resident-industry distribution, participation series and family-income series. This does not establish universal visual or data parity. OAG routes, drive-time areas, complete facility inventories and broadband household aggregates remain unavailable here.',true);
  const refs=card(root,{title:'Public services and documentation'}),list=document.createElement('div');list.className='source-table';list.innerHTML=[
    ['https://www.statcan.gc.ca/en/developers','Statistics Canada developer services'],
    ['https://www12.statcan.gc.ca/wds-sdw/2021profile-profil2021-eng.cfm','Census Profile 2021 Web Data Service guide'],
    ['https://www.statcan.gc.ca/en/developers/wds/user-guide','Statistics Canada WDS guide'],
    ['https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite','Live table catalogue used to discover Business Counts releases'],
    ['https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710027701','PSIS institutional enrolments'],
    ['https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410020201','SEPH annual industry employment'],
    ['https://api.weather.gc.ca/collections/climate-normals?f=json','ECCC station normals; period read from collection metadata'],
    ['https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer','Census cartographic boundary service'],
    ['https://www.openstreetmap.org/copyright','OpenStreetMap licensing and attribution'],
    ['https://ised-isde.canada.ca/app/scr/sittibc/web/bbmap/hm.html?lang=eng','ISED National Broadband Map'],
    ['https://advanceruralmanitoba.ca/why-rural-manitoba/','Advance Rural Manitoba reference'],
  ].map(([u,t])=>`<p>${sourceLink(u,t)}</p>`).join('');refs.append(list);
  const requests=card(root,{title:'Requests made in this browser session',subtitle:'Retrieval time is not the observation period.'}),log=document.createElement('div');log.className='source-table source-log';
  log.innerHTML=table(['Public endpoint','HTTP status','Retrieved (UTC)'],journal.slice(-50).map(r=>[r.url,r.status,r.retrieved]));requests.append(log);
}
