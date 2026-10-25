//! Builds site/boundaries/: the 2021 Census cartographic boundaries as quantized TopoJSON.
//!
//! Usage: boundaries <cache-dir> <out-dir>
//!   csd-<pr>.json   census subdivisions of a province or territory, from the source geometry on the service's
//!                   1e-4 degree grid (see fetch.rs)
//!   cd-<pr>.json    census divisions as unions of their subdivisions (CDUID: first four digits of CSDUID)
//!   pr.json         provinces and territories as unions of their subdivisions, coarser
//!   er-, cma-, pc-<pr>.json   economic regions, metropolitan-area parts and population-centre parts, generalised
//!                   by the server; they are drawn one outline at a time, so they need no shared arcs
//! Divisions and provinces are dissolved from the subdivisions' shared arcs, then given their own topology so that
//! interior junctions no longer pin their outlines. Each level drops islands and holes under its smallest area, then
//! simplifies every arc once, so neighbours within a level share their borders exactly.
//! No statistics are written: the page asks the public services for every observation.

mod fetch;
mod simplify;
mod topo;
mod topojson;

use serde_json::{json, Map, Value};
use std::{collections::HashMap, env, path::{Path, PathBuf}, process};
use topo::{area2, Polygon, Shape, Topology, P};
use topojson::Feature;

/// Provinces and territories, territories first (the site's order).
const PT: [&str; 13] = ["60", "61", "62", "59", "48", "47", "46", "35", "24", "13", "12", "11", "10"];
/// Visvalingam thresholds, degrees²: subdivisions, divisions and local outlines; the Canada-wide province map.
const FINE: f64 = 1e-6;
const COARSE: f64 = 2e-5;
/// Smallest ring kept, km²: islands and holes below it vanish at the scale each level is drawn.
const MIN_FINE: f64 = 0.5;
const MIN_COARSE: f64 = 25.0;
/// Quantization grid per file (positions per axis).
const Q: f64 = 1e5;

struct Raw { props: Map<String, Value>, polys: Vec<Polygon> }

fn main() {
    let a: Vec<String> = env::args().collect();
    if a.len() != 3 { eprintln!("usage: boundaries <cache-dir> <out-dir>"); process::exit(2); }
    if let Err(e) = run(Path::new(&a[1]), Path::new(&a[2])) { eprintln!("error: {e}"); process::exit(1); }
}

/// A quantized Esri ring: the first position absolute, then deltas, in grid cells with y downward from (x0, y0);
/// k is the cell in P units. Returned open, without repeats; fewer than three positions is no ring.
fn ring(v: &Value, x0: i64, y0: i64, k: i64) -> Option<Vec<P>> {
    let (mut x, mut y, mut r) = (0i64, 0i64, Vec::<P>::new());
    for (n, d) in v.as_array()?.iter().enumerate() {
        // Integers, except in generalised responses (maxAllowableOffset), which send whole-valued floats.
        let (dx, dy) = (d[0].as_f64()?.round() as i64, d[1].as_f64()?.round() as i64);
        if n == 0 { (x, y) = (dx, dy); } else { x += dx; y += dy; }
        let p = [x0 + x * k, y0 - y * k];
        if r.last() != Some(&p) { r.push(p); }
    }
    if r.len() > 1 && r.first() == r.last() { r.pop(); }
    (r.len() >= 3).then_some(r)
}

/// Esri rings are a flat list with clockwise exteriors (negative shoelace area in lon/lat); each hole joins the
/// smallest exterior containing it.
fn group(rings: Vec<Vec<P>>) -> Vec<Polygon> {
    let closed = |r: &Vec<P>| { let mut c = r.clone(); c.push(r[0]); c };
    let a: Vec<f64> = rings.iter().map(|r| area2(&closed(r))).collect();
    let outer: Vec<usize> = (0..rings.len()).filter(|&i| a[i] < 0.0).collect();
    let mut polys: Vec<Polygon> = outer.iter().map(|&i| vec![rings[i].clone()]).collect();
    for h in (0..rings.len()).filter(|&i| a[i] >= 0.0) {
        let host = outer.iter().enumerate().filter(|(_, &o)| topo::inside(rings[h][0], &closed(&rings[o])))
            .min_by(|x, y| a[*x.1].abs().total_cmp(&a[*y.1].abs())).map(|(j, _)| j);
        if let Some(j) = host { polys[j].push(rings[h].clone()); }
    }
    polys
}

fn read(paths: &[PathBuf]) -> Result<Vec<Raw>, String> {
    let mut out = Vec::new();
    for path in paths {
        let v: Value = serde_json::from_str(&std::fs::read_to_string(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        let t = &v["transform"];
        let e7 = |x: &Value| (x.as_f64().unwrap_or(0.0) * 1e7).round() as i64;
        let (x0, y0, k) = (e7(&t["translate"][0]), e7(&t["translate"][1]), e7(&t["scale"][0]));
        for f in v["features"].as_array().ok_or("page without features")? {
            let rings: Vec<Vec<P>> = f["geometry"]["rings"].as_array().map(|rs| rs.iter().filter_map(|r| ring(r, x0, y0, k)).collect()).unwrap_or_default();
            out.push(Raw { props: f["attributes"].as_object().cloned().unwrap_or_default(), polys: group(rings) });
        }
    }
    Ok(out)
}

fn text(p: &Map<String, Value>, k: &str) -> String {
    match &p[k] { Value::String(s) => s.clone(), Value::Null => String::new(), v => v.to_string() }
}
fn pick(p: &Map<String, Value>, name: &str, keys: &[&str]) -> Value {
    let mut o = Map::new();
    o.insert("DGUID".into(), json!(text(p, "DGUID")));
    o.insert("name".into(), json!(text(p, name)));
    for k in keys { o.insert((*k).into(), json!(text(p, k))); }
    Value::Object(o)
}

/// Area of a closed ring in km², in the sinusoidal projection (x = λ cos φ, y = φ; equal-area, so areas add);
/// 1° = 111.32 km.
fn km2(r: &[P]) -> f64 {
    let xy: Vec<[f64; 2]> = r.iter().map(|p| { let (l, f) = (p[0] as f64 * 1e-7, p[1] as f64 * 1e-7); [l * f.to_radians().cos(), f] }).collect();
    xy.windows(2).map(|w| w[0][0] * w[1][1] - w[1][0] * w[0][1]).sum::<f64>().abs() / 2.0 * 111.32f64.powi(2)
}

/// Area of a shape in km²: exteriors less holes.
fn area(arcs: &[Vec<P>], s: &Shape) -> f64 {
    s.iter().flat_map(|p| p.iter().enumerate().map(|(k, r)| if k == 0 { 1.0 } else { -1.0 } * km2(&topo::positions(arcs, r)))).sum()
}

/// Largest relative difference between a union's area and the sum of its parts' areas, with its group.
fn check(t: &Topology, group: &[usize], u: &Topology) -> (f64, usize) {
    let mut parts = vec![0.0; u.shapes.len()];
    for (f, s) in t.shapes.iter().enumerate() { parts[group[f]] += area(&t.arcs, s); }
    (0..parts.len()).filter(|&g| parts[g] > 0.0).map(|g| ((area(&u.arcs, &u.shapes[g]) - parts[g]).abs() / parts[g], g))
        .fold((0.0, 0), |m, x| if x.0 > m.0 { x } else { m })
}

/// One output level of topology `t`: rings below `min` km² dropped (a feature keeps its largest polygon), arcs
/// simplified at `eps` degrees², then the ring guard. Returns the kept positions and the pruned shapes.
fn level(t: &Topology, eps: f64, min: f64) -> (Vec<Vec<bool>>, Vec<Shape>) {
    let a = |r: &Vec<i64>| km2(&topo::positions(&t.arcs, r));
    let shapes: Vec<Shape> = t.shapes.iter().map(|s| {
        // Exterior areas once per polygon: comparing against a running maximum of a million positions per island
        // made this step quadratic.
        let ex: Vec<f64> = s.iter().map(|p| a(&p[0])).collect();
        let big = (0..s.len()).max_by(|&i, &j| ex[i].total_cmp(&ex[j]));
        s.iter().enumerate().filter(|(i, _)| Some(*i) == big || ex[*i] >= min)
            .map(|(_, p)| p.iter().enumerate().filter(|(k, r)| *k == 0 || a(r) >= min).map(|(_, r)| r.clone()).collect())
            .collect()
    }).collect();
    let w: Vec<Vec<f64>> = t.arcs.iter().map(|a| simplify::areas(&simplify::planar(a))).collect();
    let mut kept: Vec<Vec<bool>> = w.iter().map(|x| simplify::keep(x, eps)).collect();
    let rings: Vec<&Vec<i64>> = shapes.iter().flat_map(|s| s.iter().flatten()).collect();
    simplify::guard(&w, &mut kept, &rings);
    (kept, shapes)
}

/// Topology of dissolved shapes rebuilt from their positions, so junctions of the parts no longer pin the outline.
fn rebuild(t: &Topology, shapes: &[Shape]) -> Topology {
    topo::build(&shapes.iter().map(|s| s.iter().map(|p| p.iter().map(|r| { let mut x = topo::positions(&t.arcs, r); x.pop(); x }).collect()).collect()).collect::<Vec<_>>())
}

fn emit(out: &Path, name: &str, arcs: &[Vec<P>], kept: &[Vec<bool>], fs: &[Feature]) -> Result<(), String> {
    let bytes = topojson::write(&out.join(name), arcs, kept, fs, Q).map_err(|e| e.to_string())?;
    eprintln!("{name}: {} features, {:.0} kB", fs.len(), bytes as f64 / 1e3);
    Ok(())
}

fn run(cache: &Path, out: &Path) -> Result<(), String> {
    std::fs::create_dir_all(out).map_err(|e| e.to_string())?;
    let q = |layer, filter: &str, page, offset, geometry| fetch::Query { layer, filter: Box::leak(filter.to_string().into_boxed_str()), page, offset, geometry };

    // Subdivisions of Canada; divisions and provinces are their unions.
    let mut csd = Vec::new();
    for pr in PT { csd.extend(read(&fetch::pages(&q(9, &format!("PRUID='{pr}'"), 100, None, true), &format!("csd-{pr}"), cache)?)?); }
    let t = topo::build(&csd.iter().map(|f| f.polys.clone()).collect::<Vec<_>>());
    // Orientation of exterior rings in the source (the majority sign of first rings).
    let ext: f64 = csd.iter().filter_map(|f| f.polys.first()).map(|p| { let mut r = p[0].clone(); r.push(r[0]); area2(&r).signum() }).sum::<f64>().signum();
    eprintln!("topology: {} subdivisions, {} arcs, {} positions; exterior sign {ext}", csd.len(), t.arcs.len(), t.arcs.iter().map(Vec::len).sum::<usize>());

    let cds = read(&fetch::pages(&q(4, "1=1", 6000, None, false), "cd-attributes", cache)?)?;
    let prs = read(&fetch::pages(&q(0, "1=1", 6000, None, false), "pr-attributes", cache)?)?;
    let cd_index: HashMap<String, usize> = cds.iter().enumerate().map(|(i, f)| (text(&f.props, "CDUID"), i)).collect();
    let pr_index: HashMap<String, usize> = prs.iter().enumerate().map(|(i, f)| (text(&f.props, "PRUID"), i)).collect();
    let cd_of: Vec<usize> = csd.iter().map(|f| cd_index[&text(&f.props, "CSDUID")[..4]]).collect();
    let pr_of: Vec<usize> = csd.iter().map(|f| pr_index[&text(&f.props, "PRUID")]).collect();
    let tcd = rebuild(&t, &topo::dissolve(&t, &cd_of, cds.len(), ext));
    let tpr = rebuild(&t, &topo::dissolve(&t, &pr_of, prs.len(), ext));
    // A union that lost a ring shows as an area deficit against its parts.
    for (name, u, of, fs, key) in [("divisions", &tcd, &cd_of, &cds, "CDNAME"), ("provinces", &tpr, &pr_of, &prs, "PRENAME")] {
        let (d, g) = check(&t, of, u);
        eprintln!("check: {name} within {:.3}% of the area of their subdivisions (largest difference: {})", 100.0 * d, text(&fs[g].props, key));
        if d > 0.01 { return Err(format!("{name}: {} differs from its subdivisions by {:.1}%", text(&fs[g].props, key), 100.0 * d)); }
    }

    let (k_csd, s_csd) = level(&t, FINE, MIN_FINE);
    let (k_cd, s_cd) = level(&tcd, FINE, MIN_FINE);
    let (k_pr, s_pr) = level(&tpr, COARSE, MIN_COARSE);
    for pr in PT {
        let fs: Vec<Feature> = csd.iter().zip(&s_csd).filter(|(f, _)| text(&f.props, "PRUID") == pr)
            .map(|(f, s)| Feature { props: pick(&f.props, "CSDNAME", &["PRUID"]), shape: s.clone() }).collect();
        emit(out, &format!("csd-{pr}.json"), &t.arcs, &k_csd, &fs)?;
        let fs: Vec<Feature> = cds.iter().zip(&s_cd).filter(|(f, s)| text(&f.props, "PRUID") == pr && !s.is_empty())
            .map(|(f, s)| Feature { props: pick(&f.props, "CDNAME", &["PRUID"]), shape: s.clone() }).collect();
        emit(out, &format!("cd-{pr}.json"), &tcd.arcs, &k_cd, &fs)?;
    }
    let fs: Vec<Feature> = prs.iter().zip(&s_pr).filter(|(_, s)| !s.is_empty())
        .map(|(f, s)| Feature { props: pick(&f.props, "PRENAME", &["PRUID"]), shape: s.clone() }).collect();
    emit(out, "pr.json", &tpr.arcs, &k_pr, &fs)?;

    // Outlines drawn one at a time: economic regions, metropolitan-area parts, population-centre parts.
    for (layer, key, name, keys) in [(2, "er", "ERNAME", &["PRUID"][..]), (6, "cma", "CMANAME", &["CMAUID", "CMAPUID", "PRUID"][..]), (7, "pc", "PCNAME", &["PCUID", "PCPUID", "PRUID"][..])] {
        for pr in PT {
            let raw = read(&fetch::pages(&q(layer, &format!("PRUID='{pr}'"), 1000, Some(".0005"), true), &format!("{key}-{pr}"), cache)?)?;
            if raw.is_empty() { continue; }
            let t = topo::build(&raw.iter().map(|f| f.polys.clone()).collect::<Vec<_>>());
            let (kept, shapes) = level(&t, FINE, MIN_FINE);
            let fs: Vec<Feature> = raw.iter().zip(&shapes).map(|(f, s)| Feature { props: pick(&f.props, name, keys), shape: s.clone() }).collect();
            emit(out, &format!("{key}-{pr}.json"), &t.arcs, &kept, &fs)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantized_rings_decode_on_the_grid_with_y_downward() {
        // Origin (-142°, 84°), cell 1e-4° = 1000 P units; the closing position and repeats are dropped.
        let r = ring(&json!([[10, 20], [5, 0], [0, 5], [0, 0], [-5, -5]]), -1_420_000_000, 840_000_000, 1000).unwrap();
        assert_eq!(r, vec![[-1_419_990_000, 839_980_000], [-1_419_985_000, 839_980_000], [-1_419_985_000, 839_975_000]]);
        // Generalised responses send the same cells as whole-valued floats.
        assert_eq!(ring(&json!([[10.0, 20.0], [5.0, 0.0], [0.0, 5.0]]), -1_420_000_000, 840_000_000, 1000), Some(r));
    }

    #[test]
    fn clockwise_rings_are_exteriors_and_holes_join_the_smallest_container() {
        let cw = |x: i64, y: i64, s: i64| vec![[x, y], [x, y + s], [x + s, y + s], [x + s, y]];
        let ccw = |x: i64, y: i64, s: i64| { let mut r = cw(x, y, s); r.reverse(); r };
        let polys = group(vec![cw(0, 0, 10), ccw(1, 1, 2), cw(20, 0, 5)]);
        assert_eq!(polys.len(), 2);
        assert_eq!(polys[0].len(), 2);
        assert_eq!(polys[1].len(), 1);
    }
}
