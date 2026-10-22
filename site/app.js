// Canada Regional Profiles: draws site/data/<CODE>.js, <CODE>-csd.js, <CODE>-geo.js and meta.js (written by
// analysis/build_site.py) in the layout of the reference dashboard (docs/REFERENCE.md). The page filters, sums
// selected census bins and draws; it estimates nothing.
"use strict";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nf = (v, d = 0) => (v == null || Number.isNaN(v) ? "n/a" : Number(v).toLocaleString("en-CA", { maximumFractionDigits: d, minimumFractionDigits: d }));
const K = (v) => (v == null ? "n/a" : Math.abs(v) >= 1e6 ? nf(v / 1e6, 1) + "M" : Math.abs(v) >= 1e3 ? nf(v / 1e3, 1) + "K" : nf(v));
const pct = (v, d = 1) => (v == null || Number.isNaN(v) ? "n/a" : nf(100 * v, d) + "%");
const BROWN = "#473729", OCHRE = "#7d622e", GREY = "#D3D3D3", PURPLE = "#826af6";
const YLORRD = ["#FFFFB2", "#FED976", "#FEB24C", "#FD8D3C", "#F03B20", "#BD0026"];
const SECTOR_COLOR = { 11: "#3A9E52", 21: "#696969", 22: "#BFB028", 23: "#BE8417", "31-33": "#8769FF", 41: "#AB2F62", "44-45": "#FE5F4E",
  "48-49": "#63C7B2", 51: "#FFEC36", 52: "#13DABC", 53: "#0D68BF", 54: "#BEC0C3", 55: "#BE473A", 56: "#0DA38C", 61: "#FEB11F",
  62: "#128bff", 71: "#E54084", 72: "#4ED36E", 81: "#564EFE", 91: "#7d622e" };
const FONT = "Roboto, system-ui, sans-serif";

// ---------- state, data loading ----------
const S = { code: null, lg: "airports", air: 0, cp: "economic", geo: null, ex: { q: "", type: "All", all: false },
  mk: "consumers", mkDim: null, mkSel: {}, mkUnit: "#", wf: "indicators", wfDim: "education", li: "all", liView: "chart",
  fg: "all", fgView: "chart", tp: -1 };
let D, C, G;
window.DATA = window.DATA || {}; window.CSD = window.CSD || {}; window.GEO = window.GEO || {};
const script = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function load(code, csd = null) {
  if (!DATA[code]) await Promise.all([script(`data/${code}.js`), script(`data/${code}-csd.js`), script(`data/${code}-geo.js`)]);
  D = DATA[code]; C = CSD[code]; G = GEO[code]; S.code = code; S.air = 0; S.tp = -1;
  const i = C.id.indexOf(csd); S.geo = i >= 0 ? i : null;
  hash();
  for (const k of ["pr", "csd"]) echarts.registerMap(`${k}-${code}`, G[k]);
  render();
}

// ---------- census access ----------
const M = META, ONE = META.one;
const bins = (g) => M.group[g].bins;
const lab = (id) => M.label[id].replace(/^\d+(-\d+)? /, "");
function cen(geo) {                    // geo: null (jurisdiction), "ca", or CSD index
  if (geo === "ca") return (k) => D.profile.census.ca[k];
  if (geo == null) return (k) => D.profile.census.pt[k];
  return (k) => (C.census[k] ? C.census[k][geo] : null);
}
const geoName = (geo) => (geo == null ? D.name : `${C.name[geo]} (${C.type[geo]})`);

// ---------- projection: spherical Lambert conformal conic, standard parallels 49° and 77° (Atlas of Canada) ----------
function lcc(lon0) {
  const r = Math.PI / 180, p1 = 49 * r, p2 = 77 * r, t = (p) => Math.tan(Math.PI / 4 + p / 2);
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1)), F = (Math.cos(p1) * t(p1) ** n) / n;
  return {   // ρ = F / tanⁿ(π/4 + φ/2), θ = n(λ − λ0); screen y grows downward
    project: ([lo, la]) => { const rho = F / t(la * r) ** n, th = n * (lo - lon0) * r; return [rho * Math.sin(th), rho * Math.cos(th)]; },
    unproject: ([x, y]) => { const rho = Math.hypot(x, y), th = Math.atan2(x, y);
      return [lon0 + th / n / r, (2 * Math.atan((F / rho) ** (1 / n)) - Math.PI / 2) / r]; },
  };
}
function centerLon(gj) {
  let lo = 180, hi = -180;
  const walk = (a) => (typeof a[0] === "number" ? ((lo = Math.min(lo, a[0])), (hi = Math.max(hi, a[0]))) : a.forEach(walk));
  gj.features.forEach((f) => f.geometry && walk(f.geometry.coordinates));
  return (lo + hi) / 2;
}
const geoBase = (map, extra = {}) => ({ map, nameProperty: map.startsWith("csd") ? "CSDUID" : "PRUID",
  projection: lcc(centerLon(G.pr)), roam: true, layoutCenter: ["50%", "50%"], layoutSize: "96%",
  itemStyle: { areaColor: "#f7f7f5", borderColor: "#bdbdbd", borderWidth: 0.6 }, emphasis: { itemStyle: { areaColor: "#efe6d8" }, label: { show: false } },
  select: { disabled: true }, label: { show: false }, ...extra });

// ---------- charts ----------
const ec = (el) => echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: "canvas" });
const draw = (el, opt) => { const c = ec(el); c.setOption({ textStyle: { fontFamily: FONT }, animation: false, ...opt }, true); return c; };
addEventListener("resize", () => document.querySelectorAll("[_echarts_instance_]").forEach((el) => echarts.getInstanceByDom(el)?.resize()));
const AXIS = { axisLine: { lineStyle: { color: "#999" } }, axisLabel: { color: "#555", fontSize: 11 }, splitLine: { lineStyle: { color: "#eee" } } };

function spark(el, x, y, bar = false) {
  draw(el, { grid: { left: 4, right: 4, top: 6, bottom: 4 }, xAxis: { type: "category", data: x, show: false },
    yAxis: { type: "value", show: false, scale: !bar }, tooltip: { trigger: "axis", valueFormatter: (v) => nf(v, 1) },
    series: [bar ? { type: "bar", data: y, itemStyle: { color: BROWN }, barCategoryGap: "25%" }
      : { type: "line", data: y, symbol: "emptyCircle", symbolSize: 5, lineStyle: { color: BROWN, width: 2 }, itemStyle: { color: BROWN },
        areaStyle: { color: "#e9e7e4" } }] });
}
function hbar(el, names, vals, fmt = nf) {   // inverted bar, browns darkening downward, labels above bars
  const o = names.map((_, i) => i);
  draw(el, { grid: { left: 8, right: 16, top: 8, bottom: 36 }, tooltip: { valueFormatter: fmt },
    xAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, rotate: 45, formatter: (v) => nf(v) } },
    yAxis: { type: "category", data: [...o].reverse().map((i) => names[i]), show: false },
    series: [{ type: "bar", data: o.map((i, k) => ({ value: vals[i], itemStyle: { color: echarts.color.lerp(k / Math.max(o.length - 1, 1), [BROWN, "#241b14"]) } })).reverse(),
      barWidth: "50%", label: { show: true, position: [0, -14], formatter: (p) => p.name, color: "#222", fontSize: 11 } }] });
}
function vbars(el, cats, series, pctAxis = true) {
  draw(el, { grid: { left: 44, right: 12, top: 30, bottom: 64 }, legend: { top: 0, itemWidth: 22, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis", valueFormatter: (v) => (pctAxis ? pct(v) : nf(v)) },
    xAxis: { type: "category", data: cats, ...AXIS, axisLabel: { ...AXIS.axisLabel, rotate: 40, interval: 0 } },
    yAxis: { type: "value", ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: (v) => (pctAxis ? pct(v, 0) : nf(v)) } },
    series: series.map((s, i) => ({ type: "bar", name: s.name, data: s.data, itemStyle: { color: [BROWN, OCHRE, "#b8913f"][i] } })) });
}
function donut(el, v, label) {
  draw(el, { title: { text: pct(v), subtext: label, left: "center", top: "30%", textStyle: { fontSize: 20, fontWeight: 600 },
    subtextStyle: { fontSize: 10, color: "#333", width: 84, overflow: "break", lineHeight: 11 }, itemGap: 2 },
    series: [{ type: "pie", radius: ["72%", "88%"], silent: true, label: { show: false }, startAngle: 90,
      data: [{ value: v, itemStyle: { color: BROWN } }, { value: 1 - v, itemStyle: { color: GREY } }] }] });
}

// Fisher–Jenks natural breaks (Jenks 1967): k classes minimising the within-class sum of squared deviations,
// by dynamic programming over sorted values. O(k n²).
function jenks(x, k) {
  x = x.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  const n = x.length; if (!n) return [];
  k = Math.min(k, new Set(x).size);
  if (k < 2) return [x[0], x[n - 1]];
  const L = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0)), V = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { L[1][j] = 1; V[1][j] = 0; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, v = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1, val = x[i3 - 1];
      s2 += val * val; s1 += val; w++; v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) for (let j = 2; j <= k; j++) if (V[l][j] >= v + V[i4][j - 1]) { L[l][j] = i3; V[l][j] = v + V[i4][j - 1]; }
    }
    L[l][1] = 1; V[l][1] = v;
  }
  const b = new Array(k + 1); b[k] = x[n - 1]; b[0] = x[0];
  for (let j = k, c = n; j >= 2; j--) { b[j - 1] = x[L[c][j] - 2]; c = L[c][j] - 1; }
  return b;
}
function choropleth(el, map, values, fmt) {
  const b = jenks(values.map((d) => d.value), 6), pieces = [];
  for (let i = 1; i < b.length; i++) pieces.push({ min: b[i - 1], max: b[i], color: YLORRD[Math.round(((i - 1) * (YLORRD.length - 1)) / Math.max(b.length - 2, 1))],
    label: `${fmt(b[i - 1])} – ${fmt(b[i])}` });
  return draw(el, { tooltip: { trigger: "item", formatter: (p) => `${esc(p.data?.label ?? p.name)}<br>${p.value == null || Number.isNaN(p.value) ? "n/a" : fmt(p.value)}` },
    visualMap: pieces.length ? { type: "piecewise", pieces, right: 12, bottom: 16, itemWidth: 16, itemHeight: 10, textStyle: { fontSize: 10 } } : undefined,
    geo: geoBase(map), series: [{ type: "map", geoIndex: 0, data: values }] });
}

// ---------- 1. logistics ----------
const LG = { airports: "Airport network", roads: "Major road network", ports: "Sea port network", rail: "Rail and freight network", broadband: "Broadband network" };
function polylines(L) {
  const out = []; let cur = [];
  L.lat.forEach((y, i) => { if (y == null) { if (cur.length > 1) out.push({ coords: cur }); cur = []; } else cur.push([L.lon[i], y]); });
  if (cur.length > 1) out.push({ coords: cur }); return out;
}
function airportOrder() { const A = D.logistics.airports; return A.name.map((_, j) => j).sort((a, b) => (A.pax[b] ?? -1) - (A.pax[a] ?? -1)); }
function logistics() {
  const L = D.logistics, k = S.lg;
  $("lg-opts").innerHTML = Object.entries(LG).map(([v, t]) => `<button class="opt${v === k ? " on" : ""}" data-v="${v}">${t}</button>`).join("");
  $("lg-opts").onclick = (e) => { const v = e.target.closest("button")?.dataset.v; if (v) { S.lg = v; logistics(); } };
  const series = [], card = [];
  if (k === "airports") {
    const A = L.airports, order = airportOrder(), i = Math.min(S.air, order.length - 1), j = order[i];
    series.push({ type: "scatter", coordinateSystem: "geo", data: order.map((o) => ({ value: [A.lon[o], A.lat[o]], j: o, name: A.name[o] })),
      symbol: "pin", symbolSize: (v, p) => (p.data.j === j ? 30 : 20), itemStyle: { color: (p) => (p.data.j === j ? BROWN : PURPLE) },
      tooltip: { formatter: (p) => `${esc(p.name)}${A.pax[p.data.j] != null ? `<br>${nf(A.pax[p.data.j])} passengers (${A.pax_year[p.data.j]})` : ""}` } });
    if (j != null) card.push(`<h4>${esc(A.name[j])}</h4><div>IATA Code: <b>${esc(A.iata[j] || "–")}</b> · ${esc(A.city[j])}</div>`,
      A.pax[j] != null ? `<div class="kp"><div><b>${K(A.domestic[j])}</b>Domestic passengers</div><div><b>${K(A.transborder[j])}</b>Transborder</div>
        <div><b>${K(A.international[j])}</b>International</div></div><div class="note">${nf(A.pax[j])} passengers enplaned and deplaned, ${A.pax_year[j]}; the sectors are those of the passenger sector and need not sum to this total</div>`
        : `<div class="note">Passenger count suppressed by Statistics Canada.</div>`,
      `<select id="lg-air" aria-label="Airport">${order.map((o, n) => `<option value="${n}"${n === i ? " selected" : ""}>${esc(A.name[o])}</option>`).join("")}</select>`,
      `<div class="note">${nf(L.air_total.pax)} passengers at all airports in ${L.air_total.year}</div>`);
  } else if (k === "roads" || k === "rail") {
    const cols = [BROWN, OCHRE, "#b8913f", "#999", PURPLE];
    Object.entries(L[k]).forEach(([c, g], n) => series.push({ type: "lines", coordinateSystem: "geo", polyline: true, name: c, data: polylines(g),
      lineStyle: { color: cols[n % cols.length], width: n ? 1.2 : 2.2, opacity: 0.9 }, tooltip: { formatter: () => esc(c) } }));
    card.push(`<h4>${LG[k]}</h4>`, Object.entries(L[k]).map(([c, g], n) => `<div><span style="color:${cols[n % cols.length]}">■</span> ${esc(c)}: <b>${nf(g.km)} km</b></div>`).join("")
      || `<div class="note">No ${k === "rail" ? "railway" : "road"} at 1:1,000,000 in this region.</div>`);
  } else if (k === "ports") {
    const P = L.ports, by = {};
    series.push({ type: "scatter", coordinateSystem: "geo", data: P.name.map((n, j) => ({ value: [P.lon[j], P.lat[j]], name: n, kind: P.kind[j] })),
      symbolSize: 9, itemStyle: { color: "#0d68bf" }, tooltip: { formatter: (p) => `${esc(p.name)}<br>${esc(p.data.kind)}` } });
    P.kind.forEach((x) => (by[x] = (by[x] || 0) + 1));
    card.push(`<h4>Sea ports and harbours: ${P.name.length}</h4>`, Object.entries(by).sort((a, b) => b[1] - a[1]).map(([x, n]) => `<div>${esc(x)}: <b>${n}</b></div>`).join("")
      || `<div class="note">No port or small craft harbour in the source lists.</div>`);
  } else {
    const B = L.broadband, H = B.hex, mx = Math.max(...H.households);
    series.push({ type: "scatter", coordinateSystem: "geo", data: H.lat.map((y, j) => [H.lon[j], y, H.share50[j], H.households[j]]),
      symbolSize: (v) => 4 + 16 * Math.sqrt(v[3] / mx), tooltip: { formatter: (p) => `${nf(p.value[3])} households<br>50/10 available: ${pct(p.value[2], 0)}` } });
    card.push(`<h4>Broadband: 50/10 Mbps</h4><div class="kp"><div><b>${pct(B.share50, 0)}</b>households with 50/10</div><div><b>${pct(B.shareLTE, 0)}</b>LTE coverage</div></div>
      <div class="note">${nf(B.households)} households (2021)</div>`);
  }
  const opt = { tooltip: { trigger: "item" }, geo: geoBase(`pr-${S.code}`), series };
  if (k === "broadband") opt.visualMap = { type: "continuous", min: 0, max: 1, dimension: 2, seriesIndex: 0, inRange: { color: ["#BD0026", "#FEB24C", "#3A9E52"] },
    right: 12, bottom: 16, text: ["100%", "0%"], itemHeight: 90 };
  const ch = draw($("lg-map"), opt);
  ch.off("click"); ch.on("click", (p) => { if (k === "airports" && p.data?.j != null) { S.air = airportOrder().indexOf(p.data.j); logistics(); } });
  $("lg-card").innerHTML = card.join("");
  const sel = $("lg-air"); if (sel) sel.onchange = () => { S.air = +sel.value; logistics(); };
  $("lg-src").textContent = "Source: " + L.src[k];
}

// ---------- shared rail and boxes ----------
const ICON = {
  economic: '<svg viewBox="0 0 32 32"><circle cx="10" cy="20" r="6"/><path d="M18 26V16M23 26V12M28 26V8M17 10l6-5 5 2"/></svg>',
  resident: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12"/><circle cx="16" cy="13" r="4"/><path d="M8 24c2-4 5-5 8-5s6 1 8 5"/></svg>',
  household: '<svg viewBox="0 0 32 32"><circle cx="11" cy="9" r="4"/><circle cx="22" cy="9" r="4"/><path d="M3 24c1-6 4-8 8-8s7 2 8 8M14 24c1-6 4-8 8-8s7 2 8 8"/></svg>',
  dwelling: '<svg viewBox="0 0 32 32"><path d="M4 28h24M6 28V16l8-6 8 6v12M20 28V6h8v22M10 28v-6h6v6"/></svg>',
  workforce: '<svg viewBox="0 0 32 32"><circle cx="9" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><circle cx="23" cy="7" r="3"/><path d="M5 28V14h8v14M12 28V14h8v14M19 28V14h8v14"/></svg>',
  livability: '<svg viewBox="0 0 32 32"><circle cx="10" cy="9" r="4"/><path d="M10 1v3M10 14v3M2 9h3M15 9h3M24 28V18M24 18c-3 0-4-3-4-6s2-6 4-6 4 3 4 6-1 6-4 6M4 28h24M6 28v-6h10v6"/></svg>',
  consumers: '<svg viewBox="0 0 32 32"><circle cx="11" cy="9" r="4"/><circle cx="22" cy="9" r="4"/><path d="M3 24c1-6 4-8 8-8s7 2 8 8M14 24c1-6 4-8 8-8s7 2 8 8"/></svg>',
  dwellings: '<svg viewBox="0 0 32 32"><path d="M4 28h24M6 28V16l8-6 8 6v12M20 28V6h8v22M10 28v-6h6v6"/></svg>',
  businesses: '<svg viewBox="0 0 32 32"><path d="M4 12l3-6h18l3 6M4 12h24v16H4zM12 28v-8h8v8"/></svg>',
  indicators: '<svg viewBox="0 0 32 32"><path d="M4 26l7-9 6 5 9-13M4 26h24"/><circle cx="11" cy="17" r="2"/><circle cx="17" cy="22" r="2"/><circle cx="26" cy="9" r="2"/></svg>',
  catchment: '<svg viewBox="0 0 32 32"><path d="M16 29s9-9 9-16a9 9 0 00-18 0c0 7 9 16 9 16z"/><circle cx="16" cy="13" r="3"/></svg>',
};
function rail(id, items, key, after) {
  $(id).innerHTML = items.map(([v, t]) => `<button data-v="${v}" class="${S[key] === v ? "on" : ""}">${ICON[v]}${t}</button>`).join("");
  $(id).onclick = (e) => { const v = e.target.closest("button")?.dataset.v; if (v) { S[key] = v; after(); } };
}
const box = (w, title, inner = "") => `<div class="box ${w}"><h5>${title}</h5>${inner}</div>`;   // w: width class, optionally "tall"
let uid = 0;
function boards() {      // collects chart jobs so they draw after the HTML exists
  const jobs = [];
  const chart = (w, t, cls, fn, note = "") => { const id = `c${++uid}`; jobs.push(() => fn($(id))); return box(w, t, `<div id="${id}" class="${cls}"></div>` + (note ? `<div class="note">${note}</div>` : "")); };
  const kpi = (w, t, val, sp, bar, note = "") => { const id = `c${++uid}`; if (sp && sp.y.some((x) => x != null)) jobs.push(() => spark($(id), sp.x, sp.y, bar));
    return box(w, t, `<div class="big">${val}</div>${sp ? `<div id="${id}" class="spark"></div>` : ""}${note ? `<div class="note">${note}</div>` : ""}`); };
  return { jobs, chart, kpi, run: () => jobs.forEach((f) => f()) };
}

// ---------- 2. community profile ----------
function profile() {
  rail("cp-rail", [["economic", "Economic"], ["resident", "Resident"], ["household", "Household"], ["dwelling", "Dwelling"], ["workforce", "Workforce"], ["livability", "Livability"]], "cp", profile);
  const g = S.geo, v = cen(g), ca = cen("ca"), P = D.profile, SR = P.series, B = boards(), last = (a) => a[a.length - 1];
  const sum = (ids, f = v) => ids.reduce((a, k) => a + (f(k) ?? 0), 0);
  const tail = (o) => ({ x: o.x.slice(-20), y: o.y.slice(-20) });
  const pop = tail(g != null ? { x: C.pop_series.year, y: C.pop_series.v[g] } : { x: SR.population.year, y: SR.population.v });
  let html = `<div class="geo-label">Showing <b>${esc(geoName(g))}</b>${g != null ? `<button id="cp-back">Back to ${esc(D.name)}</button>` : " · choose a community in the explorer below"}</div>`;
  if (S.cp === "economic") {
    const L = SR.lfs, inc = bins("household_income");
    const top5 = bins("household_income_top");                 // $100–125K, $125–150K, $150–200K, $200K+
    const hh = (f) => { const t = f(M.group.household_income.parent) || 1, b = inc.map((k) => f(k) ?? 0), c = top5.map((k) => f(k) ?? 0),
      s = (a) => a.reduce((x, y) => x + y, 0) / t;              // the reference's five bins
      return [s(b.slice(0, 8)), s(b.slice(8, 13)), s([...b.slice(13, 15), c[0], c[1]]), s([c[2]]), s([c[3]])]; };
    const top = bins("industry").map((k) => [lab(k), v(k)]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]).slice(0, 5);
    html += B.kpi("w3", "Labour force participation", pct((g == null ? last(L.participation) : v(ONE.participation)) / 100),
      g == null ? { x: L.year, y: L.participation } : null, false, g == null ? `LFS, ${last(L.year)}` : "Census 2021");
    html += B.kpi("w3", "Population", K(last(pop.y) ?? v(ONE.population)), pop, true, `July 1, ${last(pop.x)}`);
    html += B.kpi("w3", "Median household income", "$" + K(g == null ? last(SR.income.v) : v(ONE.household_median_income)),
      g == null ? { x: SR.income.year, y: SR.income.v } : null, false, g == null ? `Census families, ${last(SR.income.year)}` : "Households, 2020 (Census 2021)");
    html += B.chart("w3 tall", "Top employment sectors", "ch-t", (el) => hbar(el, top.map((x) => x[0]), top.map((x) => x[1])), "Residents' industry, Census 2021");
    html += B.chart("w6", "Household income distribution", "ch", (el) => vbars(el, ["$0–$40K", "$40K–$80K", "$80K–$125K", "$125K–$200K", "Over $200K"],
      [{ name: geoName(g), data: hh(v) }, { name: "Canada", data: hh(ca) }]), "Households by total income in 2020 (Census 2021)");
    if (g == null) {
      html += B.kpi("w3", "Unemployment rate", pct(last(L.unemployment) / 100), { x: L.year, y: L.unemployment }, false, `LFS, ${last(L.year)}`);
      html += B.kpi("w3", "Total employment", K(last(L.employment)), { x: L.year, y: L.employment }, false, `LFS, ${last(L.year)}`);
      html += B.kpi("w3", "Total establishments", nf(last(SR.establishments.v)), { x: SR.establishments.year, y: SR.establishments.v }, false, "Employer locations, June");
    } else {
      html += B.kpi("w3", "Unemployment rate", pct(v(ONE.unemployment) / 100), null, false, "Census 2021");
      html += B.kpi("w3", "Employer locations", nf(C.biz_size.v[g].reduce((a, b) => a + b, 0)), null, false, "Business Register, June 2026");
    }
  } else if (S.cp === "resident") {
    const a5 = M.age5;
    html += B.kpi("w4", "Population", K(last(pop.y) ?? v(ONE.population)), pop, true, `July 1, ${last(pop.x)}`);
    html += B.kpi("w4", "Median individual income", "$" + K(v(ONE.individual_median_income)), null, false, "Recipients aged 15+, 2020 (Census 2021)");
    html += B.kpi("w4", "Median age", nf(v(ONE.median_age), 1), null, false, `Canada ${nf(ca(ONE.median_age), 1)}`);
    html += B.chart("w7", "Population by community", "ch-t", (el) => choropleth(el, `csd-${S.code}`, C.id.map((id, i) => ({ name: id, value: C.census[ONE.population][i], label: C.name[i] })), K), "Census 2021");
    html += B.chart("w5", "Age distribution", "ch-t", (el) => hbar(el, a5.map(lab), a5.map(v)));
  } else if (S.cp === "household") {
    const hs = bins("household_size");
    html += B.kpi("w4", "Median household income", "$" + K(v(ONE.household_median_income)), null, false, "2020 (Census 2021)");
    html += B.kpi("w4", "Average household size", nf(v(ONE.household_avg_size), 1), null, false, `Canada ${nf(ca(ONE.household_avg_size), 1)}`);
    html += B.kpi("w4", "Households", nf(v(M.group.household_size.parent)), null, false, "Census 2021");
    html += B.chart("w7", "Median household income by community", "ch-t", (el) => choropleth(el, `csd-${S.code}`, C.id.map((id, i) => ({ name: id, value: C.census[ONE.household_median_income][i], label: C.name[i] })), (x) => "$" + K(x)));
    html += B.chart("w5", "Household size", "ch-t", (el) => hbar(el, hs.map(lab), hs.map(v)));
  } else if (S.cp === "dwelling") {
    const te = bins("tenure"), pe = bins("period"), st = bins("structure"), tot = (f, k) => f(M.group[k].parent) || 1;
    html += B.chart("w4", "Home ownership", "ch", (el) => draw(el, { tooltip: { valueFormatter: nf }, legend: { bottom: 0, textStyle: { fontSize: 10 } },
      series: [{ type: "pie", radius: ["0%", "64%"], label: { formatter: "{d}%" }, data: te.map((k, i) => ({ name: lab(k), value: v(k), itemStyle: { color: [BROWN, OCHRE, GREY][i] } })) }] }));
    html += B.chart("w8", "Construction period", "ch", (el) => vbars(el, pe.map(lab), [{ name: geoName(g), data: pe.map((k) => v(k) / tot(v, "period")) },
      { name: "Canada", data: pe.map((k) => ca(k) / tot(ca, "period")) }]));
    html += B.chart("w12", "Dwelling type", "ch", (el) => hbar(el, st.map(lab), st.map(v)));
  } else if (S.cp === "workforce") {
    html += workforceBoards(v, B);
  } else {
    const cm = bins("commute_mode"), ct = bins("commute_time"), long = (f) => sum(ct.slice(2), f) / (f(M.group.commute_time.parent) || 1);
    const cl = g == null ? P.climate : C.climate[g] >= 0 ? C.stations[C.climate[g]] : null;
    html += B.kpi("w4", "Average owner monthly costs", "$" + nf(v(ONE.owner_cost)), null, false, "Shelter costs, owned dwellings (Census 2021)");
    html += B.kpi("w4", "Average monthly rent", "$" + nf(v(ONE.renter_cost)), null, false, "Shelter costs, rented dwellings (Census 2021)");
    html += B.kpi("w4", "Commutes of 30 minutes or more", pct(long(v)), null, false, `Canada ${pct(long(ca))}`);
    html += B.chart("w7", "Climate summary", "ch-t", (el) => cl && draw(el, { tooltip: { trigger: "axis" }, legend: { bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: 44, right: 44, top: 24, bottom: 54 }, xAxis: { type: "category", data: "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" "), ...AXIS },
      yAxis: [{ type: "value", name: "°C", ...AXIS }, { type: "value", name: "mm", ...AXIS, splitLine: { show: false } }],
      series: [{ type: "bar", name: "Precipitation (mm)", yAxisIndex: 1, data: cl.precip, itemStyle: { color: "#a7c5e2" } },
        { type: "line", name: "Mean temperature (°C)", data: cl.mean, lineStyle: { color: BROWN }, itemStyle: { color: BROWN } },
        { type: "line", name: "Mean daily max", data: cl.max, lineStyle: { color: OCHRE, type: "dashed" }, itemStyle: { color: OCHRE }, symbol: "none" },
        { type: "line", name: "Mean daily min", data: cl.min, lineStyle: { color: "#999", type: "dashed" }, itemStyle: { color: "#999" }, symbol: "none" }] }),
      cl ? `ECCC Canadian Climate Normals 1981–2010, ${esc(cl.station)} (${cl.km} km away)` : "No climate station with complete normals nearby");
    html += B.chart("w5", "Main mode of commuting", "ch-t", (el) => hbar(el, cm.map(lab), cm.map(v)));
  }
  $("cp-board").innerHTML = html; B.run();
  const back = $("cp-back"); if (back) back.onclick = () => { S.geo = null; hash(); profile(); explorer(); };
  $("cp-src").textContent = "Sources: Statistics Canada, Census of Population 2021 (Census Profile); " + Object.values(SR.src).join("; ") + "; ECCC climate normals.";
}
function workforceBoards(v, B) {
  const T = v(ONE.edu_total) || 1;
  const ed = [[v(ONE.postsecondary) / T, "Postsecondary Certificate, Diploma or Degree"], [v(ONE.bachelor_plus) / T, "Bachelor's Degree or Higher"],
    [(v(ONE.masters) + v(ONE.doctorate)) / T, "Masters Degree or Higher"], [(v(ONE.above_bachelor_cert) + v(ONE.medicine)) / T, "Others Above Bachelors Degree"]];
  const ind = bins("industry"), occ = bins("occupation").map((k) => [lab(k), v(k)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ids = ed.map(() => `c${++uid}`);
  B.jobs.push(() => ids.forEach((id, i) => donut($(id), ed[i][0], ed[i][1])));
  return box("w8", "Education levels", `<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">${ids.map((id) => `<div id="${id}" style="height:170px"></div>`).join("")}</div>`
      + `<div class="note">Population aged 25 to 64, Census 2021</div>`)
    + B.chart("w4 tall", "Top occupations", "ch-t", (el) => hbar(el, occ.map((x) => x[0]), occ.map((x) => x[1])), "Labour force, NOC 2021 broad categories")
    + B.chart("w8", "Residents' industry of employment", "ch-t", (el) => draw(el, { tooltip: { formatter: (p) => `${esc(p.name)}<br>${nf(p.value)}` },
      series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, width: "100%", height: "100%",
        label: { formatter: (p) => `${p.name}\n{b|${nf(p.value)}}`, rich: { b: { fontWeight: 700, fontSize: 13 } }, fontSize: 11 },
        data: ind.map((k) => ({ name: lab(k), value: v(k), itemStyle: { color: SECTOR_COLOR[M.label[k].split(" ")[0]] || OCHRE } })).filter((d) => d.value > 0) }] }),
      "Labour force aged 15+ by industry sector, Census 2021");
}

// ---------- 3. explorer ----------
function explorer() {
  const q = S.ex.q.toLowerCase(), types = {};
  C.type.forEach((t) => (types[t] = (types[t] || 0) + 1));
  const chips = ["All", ...Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]).sort()];
  $("ex-chips").innerHTML = chips.map((t) => `<button data-v="${esc(t)}" class="${S.ex.type === t ? "on" : ""}">${esc(t)}</button>`).join("");
  $("ex-chips").onclick = (e) => { const v = e.target.closest("button")?.dataset.v; if (v) { S.ex.type = v; explorer(); } };
  const pop = C.census[ONE.population];
  const I = C.id.map((_, i) => i).filter((i) => (S.ex.type === "All" || C.type[i] === S.ex.type) && C.name[i].toLowerCase().includes(q)).sort((a, b) => (pop[b] ?? 0) - (pop[a] ?? 0));
  $("ex-list").innerHTML = I.slice(0, S.ex.all ? 1e9 : 8).map((i) => `<div data-i="${i}" class="${S.geo === i ? "on" : ""}"><span>${esc(C.name[i])}
    <small>${esc(C.type[i])} · ${nf(pop[i])} residents (2021)</small></span><span>›</span></div>`).join("") || "<div>No community matches.</div>";
  $("ex-more").textContent = S.ex.all ? "Show fewer" : `View all ${I.length} communities ›`;
  $("ex-more").onclick = () => { S.ex.all = !S.ex.all; explorer(); };
  $("ex-q").oninput = () => { S.ex.q = $("ex-q").value; explorer(); };
  $("ex-list").onclick = (e) => { const i = e.target.closest("[data-i]")?.dataset.i; if (i != null) pick(+i); };
  const keep = new Set(I);
  const ch = draw($("ex-map"), { tooltip: { trigger: "item", formatter: (p) => esc(p.data?.label ?? "") }, geo: geoBase(`csd-${S.code}`),
    series: [{ type: "map", geoIndex: 0, data: C.id.map((id, i) => ({ name: id, label: `${C.name[i]} (${C.type[i]})`, i,
      itemStyle: { areaColor: i === S.geo ? BROWN : keep.has(i) ? "#e8dccb" : "#f7f7f5" } })) }] });
  ch.off("click"); ch.on("click", (p) => { if (p.data?.i != null) pick(p.data.i); });
}
function pick(i) { S.geo = i; hash(); explorer(); profile(); $("profile").scrollIntoView(); }
const hash = () => history.replaceState(null, "", "#" + S.code + (S.geo != null ? "/" + C.id[S.geo] : ""));   // #MB or #MB/4611040

// ---------- 4. market and 5. workforce catchment: summed census bins by subdivision ----------
const MK = {
  consumers: { t: "Local Consumers", sub: "Assess your target consumers with the criteria below", total: "Total Consumers", target: "Target Consumers",
    dims: [["individual_income", "Individual income", "range"], ["age5", "Individual age", "range"], ["household_income", "Household income", "range"], ["household_type", "Household type", "check"]] },
  dwellings: { t: "Local Dwellings", sub: "Assess your target dwellings with the criteria below", total: "Total Dwellings", target: "Target Dwellings",
    dims: [["period", "Construction period", "range"], ["structure", "Structure type", "check"], ["tenure", "Tenure", "check"], ["bedrooms", "No. of bedrooms", "range"]] },
  businesses: { t: "Local Businesses", sub: "Assess your target businesses with the criteria below", total: "Total Businesses", target: "Target Businesses",
    dims: [["biz_sector", "Industry", "check"], ["biz_size", "Number of employees", "range"]] },
  workforce: { t: "Workforce", sub: "Assess your target workforce with the criteria below", total: "Total Workforce", target: "Target Workforce",
    dims: [["education", "Education type", "check"], ["occupation", "Occupation type", "check"], ["industry", "Industry type", "check"]] },
};
function dimBins(d) {          // [labels, value(i, j) for subdivision i and bin j]
  if (d === "biz_sector") return [C.biz_sector.code.map((c) => { const k = bins("industry").find((x) => M.label[x].startsWith(c + " ")); return k ? lab(k) : c; }), (i, j) => C.biz_sector.v[i][j]];
  if (d === "biz_size") return [C.biz_size.code.map((x) => x.replace(" employees", "")), (i, j) => C.biz_size.v[i][j]];
  const ids = d === "age5" ? M.age5 : bins(d);
  return [ids.map(lab), (i, j) => C.census[ids[j]]?.[i] ?? null];
}
function censusSum(set, dimKey, after, el, kpiEl, unitEl, filtersEl) {
  const F = MK[set], dim = F.dims.some((x) => x[0] === S[dimKey]) ? S[dimKey] : F.dims[0][0];
  S[dimKey] = dim;
  const sel = (S.mkSel[set] ||= {});
  F.dims.forEach(([d, , kind]) => { if (!sel[d]) { const n = dimBins(d)[0].length; sel[d] = kind === "range" ? (d === "individual_income" ? [3, 6] : [0, n - 1]) : new Array(n).fill(true); } });
  filtersEl.innerHTML = `<p class="sur">Accessible</p><p class="tt">${F.t}</p><p>${F.sub}</p>` + F.dims.map(([d, t, kind]) => {
    const [L] = dimBins(d), s = sel[d], open = d === dim;
    const body = kind === "range"
      ? `<div class="rng"><span>${esc(L[s[0]])} – ${esc(L[s[1]])}</span><a data-clear="${d}">Clear</a></div>
         <input type="range" min="0" max="${L.length - 1}" value="${s[0]}" data-r="${d}" data-k="0" aria-label="${t}: from">
         <input type="range" min="0" max="${L.length - 1}" value="${s[1]}" data-r="${d}" data-k="1" aria-label="${t}: to">`
      : L.map((x, j) => `<label><input type="checkbox" data-c="${d}" data-j="${j}"${s[j] ? " checked" : ""}> ${esc(x)}</label>`).join("") + `<div class="rng"><span></span><a data-clear="${d}">Clear</a></div>`;
    return `<div class="acc${open ? " open" : ""}"><button data-open="${d}">${t}<span>${open ? "▴" : "▾"}</span></button><div>${body}</div></div>`;
  }).join("");
  filtersEl.onclick = (e) => { const o = e.target.closest("[data-open]")?.dataset.open, c = e.target.dataset.clear;
    if (o) { S[dimKey] = o; after(); } if (c) { delete sel[c]; S[dimKey] = c; after(); } };
  filtersEl.onchange = (e) => { const t = e.target;
    if (t.dataset.r) { const s = sel[t.dataset.r]; s[+t.dataset.k] = +t.value; if (s[0] > s[1]) s.reverse(); }
    if (t.dataset.c) sel[t.dataset.c][+t.dataset.j] = t.checked;
    after(); };
  const [L, val] = dimBins(dim), s = sel[dim], kind = F.dims.find((x) => x[0] === dim)[2];
  const on = L.map((_, j) => (kind === "range" ? j >= s[0] && j <= s[1] : s[j]));
  let tot = 0, tgt = 0;
  const data = C.id.map((id, i) => { let a = 0, b = 0, ok = false;
    L.forEach((_, j) => { const x = val(i, j); if (x != null) { ok = true; a += x; if (on[j]) b += x; } });
    tot += a; tgt += b;
    return { name: id, label: C.name[i], value: !ok ? null : S.mkUnit === "%" ? (a ? b / a : null) : b }; });
  kpiEl.innerHTML = `<div>${F.total}<b>${nf(tot)}</b></div><div>${F.target}<b>${nf(tgt)}</b></div>`;
  unitEl.innerHTML = ["#", "%"].map((u) => `<button class="${S.mkUnit === u ? "on" : ""}" data-u="${u}">${u}</button>`).join("");
  unitEl.onclick = (e) => { const u = e.target.dataset.u; if (u) { S.mkUnit = u; after(); } };
  choropleth(el, `csd-${S.code}`, data, S.mkUnit === "%" ? (x) => pct(x, 0) : K);
}
function market() {
  rail("mk-rail", [["consumers", "Local Consumers"], ["dwellings", "Local Dwellings"], ["businesses", "Local Businesses"]], "mk", () => { S.mkDim = null; market(); });
  censusSum(S.mk, "mkDim", market, $("mk-map"), $("mk-kpis"), $("mk-unit"), $("mk-filters"));
  $("mk-src").textContent = S.mk === "businesses" ? "Source: Statistics Canada, Canadian Business Counts with employees, by census subdivision, June 2026 (table 33-10-1176)."
    : "Source: Statistics Canada, Census of Population 2021, Census Profile by census subdivision (counts randomly rounded; small areas suppressed).";
}
function workforce() {
  rail("wf-rail", [["indicators", "Indicators"], ["catchment", "Catchment"]], "wf", workforce);
  if (S.wf === "indicators") {
    const B = boards();
    $("wf-body").innerHTML = `<div class="board">${workforceBoards(cen(null), B)}</div>`; B.run();
  } else {
    $("wf-body").innerHTML = `<div class="mk"><div class="filters" id="wf-filters"></div><div class="map" style="height:640px"><div class="mapc" id="wf-map"></div>
      <div class="kpis" id="wf-kpis"></div><div class="unit" id="wf-unit"></div></div></div>`;
    censusSum("workforce", "wfDim", workforce, $("wf-map"), $("wf-kpis"), $("wf-unit"), $("wf-filters"));
  }
  $("wf-src").textContent = "Source: Statistics Canada, Census of Population 2021, Census Profile (education: population aged 25 to 64; occupation and industry: labour force aged 15+).";
}

// ---------- 6, 7. industries ----------
const kind = () => (["60", "61", "62"].includes(D.pruid) ? "territory" : "province");
function opts(id, key, desc, after) {
  const sub = { all: `These are the ${desc} industries in the ${kind()}. It shows traded and local industries.`,
    traded: `These are the ${kind()}'s ${desc} traded industries that sell products or services across regions or countries.`,
    local: `These are the ${desc} local industries that primarily sell products within the ${kind()}.` };
  const T = { all: "All industries", traded: "Traded industries", local: "Local industries" };
  $(id).innerHTML = Object.keys(sub).map((v) => `<button class="opt${S[key] === v ? " on" : ""}" data-v="${v}"><b style="font-family:var(--head)">${T[v]}</b><small>${sub[v]}</small></button>`).join("");
  $(id).onclick = (e) => { const v = e.target.closest("button")?.dataset.v; if (v) { S[key] = v; after(); } };
}
function viewToggle(id, key, after) {
  $(id).innerHTML = ["chart", "list"].map((v) => `<button class="${S[key] === v ? "on" : ""}" data-v="${v}">${v.toUpperCase()}</button>`).join("");
  $(id).onclick = (e) => { const v = e.target.dataset.v; if (v) { S[key] = v; after(); } };
}
function top20(sel, by) {
  const I = D.industries;
  return I.code.map((_, i) => i).filter((i) => (sel === "all" || I.traded[i] === (sel === "traded")) && by(i) != null).sort((a, b) => by(b) - by(a)).slice(0, 20);
}
const sectorName = (s) => { const k = bins("industry").find((x) => M.label[x].startsWith(s + " ")); return k ? lab(k) : s; };
function table(J, head, row) {
  return `<table class="lst"><thead><tr><th>#</th>${head.map((h, k) => `<th class="${k ? "r" : ""}">${h}</th>`).join("")}</tr></thead><tbody>`
    + J.map((i, n) => `<tr><td>${n + 1}</td>${row(i).map((c, k) => `<td class="${k ? "r" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
}
function largest() {
  opts("li-opts", "li", "largest", largest); viewToggle("li-view", "liView", largest);
  $("li-desc").textContent = `Identify the largest industries driving employment in the ${kind()}.`;
  const I = D.industries, J = top20(S.li, (i) => I.e[i]), list = S.liView === "list";
  $("li-chart").style.display = list ? "none" : ""; $("li-list").style.display = list ? "" : "none";
  if (list) $("li-list").innerHTML = table(J, ["Industry", `Employment ${I.year}`, "LQ"], (i) => [I.name[i], nf(I.e[i]), nf(I.lq[i], 2)]);
  else {
    const by = {}; J.forEach((i) => (by[I.sector[i]] ||= []).push(i));
    draw($("li-chart"), { tooltip: { formatter: (p) => (p.data?.i == null ? esc(p.name)
      : `<b>${esc(p.name)}</b><br>NAICS ${I.code[p.data.i]} · ${I.traded[p.data.i] ? "Traded" : "Local"}<br>Employment: ${nf(I.e[p.data.i])}<br>LQ: ${nf(I.lq[p.data.i], 2)}`) },
      series: [{ type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, width: "100%", height: "94%", top: 24,
        upperLabel: { show: true, height: 22, color: "#111", fontWeight: 600, backgroundColor: "#fff" },
        levels: [{ itemStyle: { gapWidth: 10, borderColor: "#fff", borderWidth: 0 } }, { itemStyle: { gapWidth: 2, borderColor: "#fff" } }],
        label: { formatter: (p) => `${p.name}\n{b|${nf(p.value)}}`, rich: { b: { fontWeight: 800, fontSize: 14, lineHeight: 22 } }, fontSize: 12, overflow: "truncate", color: "#fff" },
        data: Object.entries(by).map(([s, ii]) => ({ name: sectorName(s), itemStyle: { color: SECTOR_COLOR[s] || OCHRE },
          children: ii.map((i) => ({ name: I.name[i], value: I.e[i], i, itemStyle: { color: SECTOR_COLOR[s] || OCHRE } })) })) }] });
  }
  $("li-src").textContent = "Source: " + I.src;
}
function fastest() {
  opts("fg-opts", "fg", "fastest growing", fastest); viewToggle("fg-view", "fgView", fastest);
  $("fg-desc").textContent = `Identify the fast growing industries creating new opportunities in the ${kind()}.`;
  const I = D.industries, ch = (i) => (I.e0[i] == null ? null : I.e[i] - I.e0[i]), J = top20(S.fg, ch), list = S.fgView === "list", y0 = I.year - 5;
  $("fg-chart").style.display = list ? "none" : ""; $("fg-list").style.display = list ? "" : "none";
  if (list) $("fg-list").innerHTML = table(J, ["Industry", `Change ${y0}–${I.year}`, `Employment ${I.year}`, `Employment ${y0}`, "LQ"],
    (i) => [I.name[i], nf(ch(i)), nf(I.e[i]), nf(I.e0[i]), nf(I.lq[i], 2)]);
  else {
    const mx = Math.max(1, ...J.map((i) => Math.abs(ch(i))));
    draw($("fg-chart"), { grid: { left: 64, right: 56, top: 30, bottom: 90 },
      tooltip: { formatter: (p) => { const i = p.data.i; return `<b>${esc(I.name[i])}</b><br>Employment ${I.year}: ${nf(I.e[i])}<br>Employment ${y0}: ${nf(I.e0[i])}<br>Change: ${nf(ch(i))}<br>LQ: ${nf(I.lq[i], 2)}`; } },
      xAxis: { type: "value", name: `Employment Growth (${y0} – ${I.year})`, nameLocation: "middle", nameGap: 30, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: K }, splitLine: { lineStyle: { type: "dashed", color: "#e3e6f0" } } },
      yAxis: { type: "value", name: "Total Employment", nameLocation: "middle", nameGap: 48, ...AXIS, axisLabel: { ...AXIS.axisLabel, formatter: K }, splitLine: { lineStyle: { type: "dashed", color: "#e3e6f0" } } },
      dataZoom: [{ type: "slider", xAxisIndex: 0, bottom: 10, height: 24 }, { type: "slider", yAxisIndex: 0, right: 10, width: 18 }, { type: "inside" }],
      series: [{ type: "scatter", data: J.map((i) => ({ value: [ch(i), I.e[i]], i, itemStyle: { color: SECTOR_COLOR[I.sector[i]] || OCHRE, opacity: 0.85 } })),
        symbolSize: (val) => 18 + 25 * Math.sqrt(Math.abs(val[0]) / mx) }] });
  }
  $("fg-src").textContent = "Source: " + I.src;
}

// ---------- 8. talent ----------
function talent() {
  const T = D.talent, order = T.groups.map((_, j) => j).sort((a, b) => T.n[b] - T.n[a]);
  $("tp-opts").innerHTML = [-1, ...order].map((j) => `<button class="opt${S.tp === j ? " on" : ""}" data-v="${j}">
    <b class="n">${K(j < 0 ? T.total : T.n[j])}<span>STUDENTS</span></b>${j < 0 ? "All programs" : esc(T.groups[j])}</button>`).join("");
  $("tp-opts").onclick = (e) => { const v = e.target.closest("button")?.dataset.v; if (v != null) { S.tp = +v; talent(); } };
  const val = (x) => (S.tp < 0 ? x.total : x.n[S.tp]), pts = [];
  T.inst.forEach((x) => x.campus.lat.forEach((la, k) => pts.push({ value: [x.campus.lon[k], la, val(x) ?? 0], name: x.name, campus: x.campus.name[k], city: x.campus.city[k] })));
  const mx = Math.max(1, ...T.inst.map((x) => val(x) ?? 0));
  draw($("tp-map"), { tooltip: { trigger: "item", formatter: (p) => `<b>${esc(p.name)}</b><br>${esc(p.data.campus)}, ${esc(p.data.city)}<br>${nf(p.value[2])} students` },
    geo: geoBase(`pr-${S.code}`), series: [{ type: "scatter", coordinateSystem: "geo", data: pts, symbolSize: (v) => 6 + 26 * Math.sqrt(v[2] / mx),
      itemStyle: { color: BROWN, opacity: 0.75, borderColor: "#fff", borderWidth: 1 } }] });
  const unmapped = T.inst.filter((x) => !x.campus.lat.length).map((x) => x.name);
  $("tp-card").innerHTML = `<h4>${S.tp < 0 ? "All programs" : esc(T.groups[S.tp])}, ${esc(T.year)}</h4>` + [...T.inst].sort((a, b) => (val(b) ?? 0) - (val(a) ?? 0)).slice(0, 6)
    .map((x) => `<div>${esc(x.name)}: <b>${nf(val(x))}</b></div>`).join("") + (unmapped.length ? `<div class="note">Not located: ${unmapped.map(esc).join(", ")}</div>` : "");
  $("tp-src").textContent = "Source: " + T.src;
}

// ---------- page ----------
function leads() {
  const L = D.logistics, P = D.profile, I = D.industries, T = D.talent, last = (a) => a[a.length - 1], pt = cen(null), ca = cen("ca");
  const big = I.code.map((_, i) => i).sort((a, b) => I.e[b] - I.e[a])[0];
  const km = (o) => nf(Object.values(o).reduce((a, r) => a + r.km, 0));
  const txt = {
    logistics: `${L.airports.name.length} airports with scheduled passenger service, ${km(L.roads)} km of major roads, ${km(L.rail)} km of railway, and 50/10 Mbps internet available to ${pct(L.broadband.share50, 0)} of households.`,
    profile: `${nf(last(P.series.population.v))} residents on July 1, ${last(P.series.population.year)}; labour force participation of ${nf(last(P.series.lfs.participation), 1)}% in ${last(P.series.lfs.year)}.`,
    explorer: `${C.id.length} communities (census subdivisions): search by name or type, and open any community's own profile.`,
    market: "Consumers, dwellings and businesses by community: choose the criteria and the map counts them.",
    workforce: `${pct(pt(ONE.postsecondary) / (pt(ONE.edu_total) || 1))} of residents aged 25 to 64 hold a postsecondary credential (Canada ${pct(ca(ONE.postsecondary) / ca(ONE.edu_total))}).`,
    fastest: `Employment change by industry between ${I.year - 5} and ${I.year}.`,
    largest: `${I.name[big]} is the largest industry by employment, with ${nf(I.e[big])} employees in ${I.year}.`,
    talent: `${nf(T.total)} students enrolled at ${T.inst.length} postsecondary institution${T.inst.length === 1 ? "" : "s"} in ${T.year}.`,
  };
  document.querySelectorAll("[data-lead]").forEach((p) => (p.textContent = txt[p.dataset.lead] || ""));
}
function render() {
  document.title = `Why ${D.name}? · Canada Regional Profiles`;
  $("h1").textContent = `Why ${D.name}?`;
  $("lede").textContent = `The logistics, demographics, communities, markets, workforce, industries and talent of ${D.name}, rebuilt from public data in the layout of a regional investment-attraction dashboard.`;
  document.querySelectorAll("#pts button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.code));
  leads(); logistics(); profile(); explorer(); market(); workforce(); fastest(); largest(); talent();
}
$("pts").innerHTML = INDEX.order.map(([c, n]) => `<button data-v="${c}" title="${esc(n)}"${INDEX.built.includes(c) ? "" : " disabled"}>${c}</button>`).join("");
$("pts").onclick = (e) => { const c = e.target.dataset.v; if (c) load(c); };
const [h, csd] = location.hash.slice(1).split("/");
load(INDEX.built.includes(h) ? h : INDEX.built[0], csd);
