// Draws site/data/<CODE>.js (written by analysis/build_site.py). The page filters and draws; it computes
// nothing the analysis computes. Each section draws when in view and redraws when a control it reads changes.
"use strict";

const $ = (id) => document.getElementById(id);
const css = getComputedStyle(document.documentElement), tok = (k) => css.getPropertyValue("--" + k).trim();
const T = Object.fromEntries(["bg", "surface", "text", "text-2", "muted", "border", "context", "accent", "negative", "font"].map((k) => [k, tok(k)]));
const CAT = [1, 2, 3, 4, 5, 6].map((i) => tok("c" + i));
const AX = { gridcolor: T.border, zerolinecolor: T.muted, linecolor: T.muted, automargin: true, tickfont: { color: T["text-2"] } };
const nf = (v, d = 0) => v == null ? "n/a" : v.toLocaleString("en-CA", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmt = (v, u) => v == null ? "n/a" : u === "%" ? nf(100 * v, 1) + "%" : u === "$" ? "$" + nf(v) : u === "yrs" ? nf(v, 1) : nf(v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function plot(id, data, layout = {}) {
  const narrow = innerWidth < 700;
  Plotly.react($(id), data, {
    height: layout.height || (narrow ? 380 : 480), paper_bgcolor: T.bg, plot_bgcolor: T.bg, colorway: CAT, showlegend: false,
    font: { family: T.font, color: T.text, size: 13 }, margin: { t: 8, r: narrow ? 16 : 40, b: 40, l: 8 },
    hoverlabel: { bgcolor: T.bg, bordercolor: T.border, font: { color: T.text } },
    ...layout, xaxis: { ...AX, ...layout.xaxis }, yaxis: { ...AX, ...layout.yaxis },
  }, { responsive: true, displaylogo: false });
}

// State S; a control writes S and marks the sections that read it.
const S = { pt: null, layer: "airports", region: null, trade: "all", level: "4", trade2: "all", growth: "abs", inst: "All", market: null };
let D = null;
function seg(id, key, values, label, after) {
  const el = $(id);
  el.innerHTML = values.map((v) => `<button data-v="${v}">${label(v)}</button>`).join("");
  const sync = () => el.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === S[key]));
  el.onclick = (e) => { if (e.target.dataset.v == null) return; S[key] = e.target.dataset.v; sync(); after(); };
  sync();
}
function select(id, key, values, label, after) {
  const el = $(id);
  el.innerHTML = values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join("");
  el.value = S[key]; el.onchange = () => { S[key] = el.value; after(); };
}

// Map: Lambert conformal conic with the Atlas of Canada's standard parallels, fitted to the traces.
const GEO = () => ({ projection: { type: "conic conformal", parallels: [49, 77] }, fitbounds: "locations", resolution: 50,
  showland: true, landcolor: T.surface, showocean: true, oceancolor: T.bg, showlakes: true, lakecolor: T.bg,
  showcountries: true, countrycolor: T.border, showsubunits: true, subunitcolor: T.border, showcoastlines: false,
  showframe: false, bgcolor: T.bg });
const LAYERS = { airports: "Airports", roads: "Roads", ports: "Ports", rail: "Rail", broadband: "Broadband" };

const SECTIONS = {
  logistics() {
    const L = D.logistics, k = S.layer, el = $("map");
    const tr = [{ type: "scattergeo", mode: "lines", lat: L.outline.lat, lon: L.outline.lon, line: { color: T.muted, width: 1 }, hoverinfo: "skip" }];
    let list = "";
    const pts = (P, text, c) => tr.push({ type: "scattergeo", mode: "markers", lat: P.lat, lon: P.lon, text,
      marker: { size: 10, color: c }, hovertemplate: "%{text}<extra></extra>" });
    const lines = (G, cols) => Object.entries(G).forEach(([c, g], i) => tr.push({ type: "scattergeo", mode: "lines", lat: g.lat, lon: g.lon,
      name: c, line: { color: cols[i % cols.length], width: i ? 1.5 : 2.5 }, hovertemplate: `${esc(c)}<extra></extra>` }));
    if (k === "airports") {
      const A = L.airports;
      const px = (i) => (A.pax[i] != null ? `${nf(A.pax[i])} passengers (${A.pax_year[i]})` : "");
      pts(A, A.name.map((n, i) => `${esc(n)}${A.iata[i] ? " (" + A.iata[i] + ")" : ""}${px(i) ? "<br>" + px(i) : ""}`), T.accent);
      list = `<div><b>${nf(L.air_total.pax)}</b><span>passengers enplaned and deplaned in ${L.air_total.year}, all airports</span></div>` +
        A.name.map((n, i) => [n, i]).sort((a, b) => ((A.pax[b[1]] ?? -1) - (A.pax[a[1]] ?? -1)) || a[0].localeCompare(b[0]))
          .map(([n, i]) => `<div><b>${esc(n)}</b><span>${A.iata[i] ? "IATA " + A.iata[i] + " · " : ""}${esc(A.city[i])}${px(i) ? " · " + px(i) : ""}</span></div>`).join("");
    } else if (k === "roads" || k === "rail") {
      const G = L[k], cols = [T.accent, CAT[1], CAT[2], CAT[3], T.context];
      lines(G, cols);
      list = Object.entries(G).map(([c, g], i) => `<div><b style="color:${cols[i % cols.length]}">${esc(c)}</b><span>${nf(g.km)} km</span></div>`).join("")
        || "<div><span>No features of this layer in the region at 1:1,000,000.</span></div>";
    } else if (k === "ports") {
      const P = L.ports;
      pts(P, P.name.map((n, i) => `${esc(n)}<br>${esc(P.kind[i])}`), CAT[2]);
      list = P.name.map((n, i) => `<div><b>${esc(n)}</b><span>${esc(P.kind[i])}</span></div>`).join("")
        || "<div><span>No port or small craft harbour in the source lists.</span></div>";
    } else {
      const B = L.broadband, H = B.hex, smax = Math.max(...H.households);
      tr.push({ type: "scattergeo", mode: "markers", lat: H.lat, lon: H.lon,
        marker: { size: H.households.map((w) => 5 + 22 * Math.sqrt(w / smax)), color: H.share50, cmin: 0, cmax: 1,
          colorscale: [[0, T.negative], [0.5, CAT[1]], [1, T.accent]], opacity: 0.8,
          colorbar: { title: { text: "50/10" }, tickformat: ".0%", len: 0.6, thickness: 10 } },
        customdata: H.households, hovertemplate: "%{customdata:,.0f} households<br>50/10 available: %{marker.color:.0%}<extra></extra>" });
      list = `<div><b>${fmt(B.share50, "%")}</b><span>of ${nf(B.households)} households can get 50/10 Mbps</span></div>` +
        `<div><b>${fmt(B.shareLTE, "%")}</b><span>have LTE mobile coverage</span></div>` +
        B.cd.id.map((c, i) => `<div><b>${esc(D.cdnames?.[c] ?? "Division " + c)}</b><span>${fmt(B.cd.share50[i], "%")} of ${nf(B.cd.households[i])} households</span></div>`).join("");
    }
    Plotly.react(el, tr, { height: el.clientHeight, margin: { t: 0, r: 0, b: 0, l: 0 }, paper_bgcolor: T.bg, showlegend: false,
      font: { family: T.font, color: T.text }, geo: GEO() },
      { responsive: true, displaylogo: false });
    $("layer-list").innerHTML = list;
    $("layer-src").textContent = "Source: " + L.src[k];
  },

  workforce() {
    const W = D.workforce, r = S.region;
    $("wf-tiles").innerHTML = W.ind.map((x) => `<div><b>${fmt(x.v[r], x.unit)}</b><span>${esc(x.label)}</span>` +
      `<small>${[x.ca != null ? "Canada " + fmt(x.ca, x.unit) : "", x.note ? esc(x.note) : ""].filter(Boolean).join(" · ")}</small></div>`).join("");
    $("wf-src").textContent = "Source: " + W.src;
  },

  largest() { industries("largest-chart", S.trade, (I, i) => I.e[i], "estimated employees", "largest-src"); },
  growing() {
    const g = S.growth === "abs";
    industries("growing-chart", S.trade2, (I, i) => I.e0[i] == null ? null : g ? I.e[i] - I.e0[i] : (I.e0[i] >= D.min_base ? I.e[i] / I.e0[i] - 1 : null),
      g ? "change in estimated employees" : `growth (2021 base ≥ ${D.min_base})`, "growing-src", !g);
  },

  talent() {
    const P = D.talent, n = P.n[S.inst], o = P.fields.map((_, i) => i).filter((i) => n[i] > 0).sort((a, b) => n[a] - n[b]);
    plot("talent-chart", [{ type: "bar", orientation: "h", y: o.map((i) => P.fields[i]), x: o.map((i) => n[i]), marker: { color: T.accent },
      hovertemplate: "%{y}<br>%{x:,} students<extra></extra>" }], { height: 120 + 26 * o.length, xaxis: { title: { text: "students enrolled" } } });
    $("talent-list").innerHTML = P.inst.map((x) => `<div><b>${esc(x.name)}</b><span>${nf(x.total)} students</span></div>`).join("")
      || "<div><span>No institution reports enrolments in this region.</span></div>";
    $("talent-src").textContent = "Source: " + P.src;
  },

  market() {
    const M = D.market.groups[S.market];
    $("mk-tiles").innerHTML = M.map((x) => `<div><b>${fmt(x.v, x.unit)}</b><span>${esc(x.label)}</span>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("");
    $("mk-src").textContent = "Source: " + D.market.src;
  },
};

function industries(id, trade, val, xlab, src, pct = false) {
  const I = D.industries[S.level];
  const J = I.name.map((_, i) => i).filter((i) => (trade === "all" || I.traded[i] === (trade === "traded")) && val(I, i) != null)
    .sort((a, b) => val(I, b) - val(I, a)).slice(0, 15).reverse();
  plot(id, [{ type: "bar", orientation: "h", y: J.map((i) => I.name[i]), x: J.map((i) => val(I, i)),
    marker: { color: J.map((i) => (I.traded[i] ? T.accent : CAT[1])) },
    customdata: J.map((i) => [I.n[i], I.lo[i], I.hi[i] ?? "500+", I.lq[i], I.traded[i] ? "traded" : "local", I.e0[i], I.e[i]]),
    hovertemplate: "<b>%{y}</b> (%{customdata[4]})<br>" + (pct ? "%{x:.0%}" : "%{x:,.0f}") + " " + xlab +
      "<br>employer locations: %{customdata[0]:,}<br>employees 2026: %{customdata[6]:,.0f} (bounds %{customdata[1]:,}–%{customdata[2]:,})" +
      "<br>employees 2021: %{customdata[5]:,.0f}<br>LQ vs Canada: %{customdata[3]:.2f}<extra></extra>" }],
    { height: 150 + 28 * J.length, xaxis: { title: { text: xlab }, tickformat: pct ? ".0%" : ",.0f" }, yaxis: { automargin: true } });
  $(src).textContent = "Source: " + D.ind_src + " Blue: traded; orange: local.";
}

const dirty = new Set(Object.keys(SECTIONS)), seen = new Set();
function flush() { if (D) for (const id of dirty) if (seen.has(id)) { dirty.delete(id); SECTIONS[id](); } }
function mark(...ids) { ids.forEach((id) => dirty.add(id)); flush(); }

function show(code) {
  D = window.DATA[code]; S.pt = code; location.hash = code;
  document.querySelectorAll("#pts button").forEach((b) => b.classList.toggle("on", b.dataset.v === code));
  document.title = `${D.name} · Canada Regional Profiles`;
  $("h1").textContent = D.h1; $("lede").textContent = D.lede;
  $("facts").innerHTML = D.facts.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
  document.querySelectorAll("[data-claim]").forEach((h) => (h.textContent = D.claims[h.dataset.claim]));
  S.region = D.workforce.regions[0].id; S.inst = "All"; S.market = Object.keys(D.market.groups)[0];
  seg("c-layer", "layer", Object.keys(LAYERS), (k) => LAYERS[k], () => mark("logistics"));
  select("c-region", "region", D.workforce.regions.map((r) => r.id), (id) => D.workforce.regions.find((r) => r.id === id).name, () => mark("workforce"));
  seg("c-trade", "trade", ["all", "traded", "local"], (v) => v[0].toUpperCase() + v.slice(1), () => mark("largest"));
  seg("c-level", "level", Object.keys(D.industries), (v) => ({ 2: "Sectors", 3: "Subsectors", 4: "Industry groups" }[v]), () => mark("largest", "growing"));
  seg("c-trade2", "trade2", ["all", "traded", "local"], (v) => v[0].toUpperCase() + v.slice(1), () => mark("growing"));
  seg("c-growth", "growth", ["abs", "pct"], (v) => (v === "abs" ? "Jobs added" : "Percent"), () => mark("growing"));
  select("c-inst", "inst", Object.keys(D.talent.n), (v) => (v === "All" ? "All institutions" : v), () => mark("talent"));
  seg("c-market", "market", Object.keys(D.market.groups), (v) => v, () => mark("market"));
  mark(...Object.keys(SECTIONS));
}

function load(code) {
  if (window.DATA?.[code]) return show(code);
  const s = document.createElement("script");
  s.src = `data/${code}.js`; s.onload = () => show(code);
  document.head.appendChild(s);
}

window.DATA = window.DATA || {};
$("pts").innerHTML = INDEX.order.map(([c, n]) => c === "|" ? '<span class="sep"></span>' :
  `<button data-v="${c}" title="${esc(n)}" ${INDEX.built.includes(c) ? "" : "disabled"}>${c}</button>`).join("");
$("pts").onclick = (e) => { const c = e.target.dataset.v; if (c && !e.target.disabled) load(c); };
const io = new IntersectionObserver((es) => {
  es.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
  flush();
}, { rootMargin: "400px 0px" });
Object.keys(SECTIONS).forEach((id) => io.observe($(id)));
const h = location.hash.slice(1);
load(INDEX.built.includes(h) ? h : INDEX.built[0]);
