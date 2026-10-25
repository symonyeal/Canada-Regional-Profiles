//! Quantized TopoJSON output (Bostock, TopoJSON Format Specification 1.0: transforms §2.1.2, arcs §2.2).
//! Positions become integers on a q × q grid over the file's bounding box, and arcs are delta-encoded.
//! The decoder is `topology()` in site/js/geo.js.

use std::{fmt::Write as _, fs, path::Path};
use crate::topo::{arc, Shape, P};

pub struct Feature { pub props: serde_json::Value, pub shape: Shape }

/// Writes features `fs` and the arcs they use (positions where `kept`) to `path`; returns the bytes written.
pub fn write(path: &Path, arcs: &[Vec<P>], kept: &[Vec<bool>], fs: &[Feature], q: f64) -> std::io::Result<usize> {
    let mut id = vec![usize::MAX; arcs.len()];
    let mut used = Vec::new();
    for r in fs.iter().flat_map(|f| f.shape.iter().flatten().flatten()) {
        let (i, _) = arc(*r);
        if id[i] == usize::MAX { id[i] = used.len(); used.push(i); }
    }
    let pts: Vec<Vec<P>> = used.iter().map(|&i| arcs[i].iter().zip(&kept[i]).filter(|(_, &k)| k).map(|(p, _)| *p).collect()).collect();
    let (mut lo, mut hi) = ([i64::MAX; 2], [i64::MIN; 2]);
    for p in pts.iter().flatten() { for d in 0..2 { lo[d] = lo[d].min(p[d]); hi[d] = hi[d].max(p[d]); } }
    let k: [f64; 2] = [0, 1].map(|d| ((hi[d] - lo[d]) as f64 / (q - 1.0)).max(1.0));
    // Quantize, drop repeats, delta-encode; every arc keeps at least two positions.
    let enc: Vec<Vec<[i64; 2]>> = pts.iter().map(|a| {
        let mut g: Vec<[i64; 2]> = Vec::new();
        for p in a {
            let x = [0, 1].map(|d| ((p[d] - lo[d]) as f64 / k[d]).round() as i64);
            if g.last() != Some(&x) { g.push(x); }
        }
        if g.len() == 1 { g.push(g[0]); }
        let mut prev = [0, 0];
        g.into_iter().map(|x| { let d = [x[0] - prev[0], x[1] - prev[1]]; prev = x; d }).collect()
    }).collect();
    let len = |r: i64| enc[id[arc(r).0]].len();
    let ring_ok = |refs: &Vec<i64>| refs.iter().map(|&r| len(r) - 1).sum::<usize>() + 1 >= 4;

    let mut s = String::with_capacity(1 << 20);
    write!(s, r#"{{"type":"Topology","transform":{{"scale":[{},{}],"translate":[{},{}]}},"objects":{{"areas":{{"type":"GeometryCollection","geometries":["#,
        k[0] * 1e-7, k[1] * 1e-7, lo[0] as f64 * 1e-7, lo[1] as f64 * 1e-7).unwrap();
    for (n, f) in fs.iter().enumerate() {
        if n > 0 { s.push(','); }
        let polys: Vec<Vec<Vec<i64>>> = f.shape.iter().filter(|p| ring_ok(&p[0]))
            .map(|p| p.iter().filter(|r| ring_ok(r)).map(|r| r.iter().map(|&x| { let (i, fwd) = arc(x); let j = id[i] as i64; if fwd { j } else { !j } }).collect()).collect())
            .collect();
        let props = f.props.to_string();
        match polys.len() {
            0 => write!(s, r#"{{"type":null,"properties":{props}}}"#),
            1 => write!(s, r#"{{"type":"Polygon","arcs":{},"properties":{props}}}"#, serde_json::to_string(&polys[0]).unwrap()),
            _ => write!(s, r#"{{"type":"MultiPolygon","arcs":{},"properties":{props}}}"#, serde_json::to_string(&polys).unwrap()),
        }.unwrap();
    }
    s.push_str("]}},\"arcs\":[");
    for (n, a) in enc.iter().enumerate() {
        if n > 0 { s.push(','); }
        s.push('[');
        for (m, d) in a.iter().enumerate() { if m > 0 { s.push(','); } write!(s, "[{},{}]", d[0], d[1]).unwrap(); }
        s.push(']');
    }
    s.push_str("]}");
    fs::write(path, &s)?;
    Ok(s.len())
}
