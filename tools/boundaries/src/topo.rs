//! Planar topology of polygon features: shared borders become one arc (Bostock, TopoJSON "join" and "cut"),
//! and unions of features are read off the arcs (dissolve).
//!
//! Legend
//!   P         position [lon, lat] in 1e-7 degrees; exact, because the source publishes six decimals
//!   ring      closed sequence of P without the repeated closing position
//!   arc       open sequence of P from one junction to the next, or a closed ring meeting no junction (first == last)
//!   ref       arc reference: i is arc i forward, !i (= -i - 1) is arc i reversed
//!   junction  a position whose neighbours on some visit differ from its first visit's (in either order)
//!   shape     a feature as polygons of rings of refs, exterior ring first

use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::hash::{Hash, Hasher};

pub type P = [i64; 2];
pub type Polygon = Vec<Vec<P>>;
pub type Refs = Vec<i64>;
pub type Shape = Vec<Vec<Refs>>;

pub struct Topology { pub arcs: Vec<Vec<P>>, pub shapes: Vec<Shape> }

/// Topology of `features`: arcs cut at junctions, each shared border stored once.
pub fn build(features: &[Vec<Polygon>]) -> Topology {
    let mut first: HashMap<P, (P, P)> = HashMap::new();
    let mut junction: HashSet<P> = HashSet::new();
    for r in features.iter().flatten().flatten() {
        let n = r.len();
        for i in 0..n {
            let (a, p, b) = (r[(i + n - 1) % n], r[i], r[(i + 1) % n]);
            match first.get(&p) {
                None => { first.insert(p, (a, b)); }
                Some(&e) => if e != (a, b) && e != (b, a) { junction.insert(p); },
            }
        }
    }
    drop(first);
    let mut t = Topology { arcs: Vec::new(), shapes: Vec::new() };
    let mut index: HashMap<u64, Vec<usize>> = HashMap::new();
    for f in features {
        let shape = f.iter().map(|poly| poly.iter()
            .map(|r| cut(r, &junction).into_iter().map(|a| intern(a, &mut t.arcs, &mut index)).collect())
            .collect()).collect();
        t.shapes.push(shape);
    }
    t
}

/// Arcs of ring `r`: split at its junctions; without junctions, one closed arc starting at its least position.
fn cut(r: &[P], junction: &HashSet<P>) -> Vec<Vec<P>> {
    let n = r.len();
    match (0..n).find(|&i| junction.contains(&r[i])) {
        None => {
            let s = (0..n).min_by_key(|&i| r[i]).unwrap_or(0);
            vec![(0..=n).map(|k| r[(s + k) % n]).collect()]
        }
        Some(s) => {
            let (mut out, mut a) = (Vec::new(), vec![r[s]]);
            for k in 1..=n {
                let p = r[(s + k) % n];
                a.push(p);
                if junction.contains(&p) { out.push(std::mem::replace(&mut a, vec![p])); }
            }
            out
        }
    }
}

fn digest<'a>(ps: impl Iterator<Item = &'a P>) -> u64 {
    let mut h = DefaultHasher::new();
    for p in ps { p.hash(&mut h); }
    h.finish()
}

/// Reference to arc `a`, reusing an equal arc or the reverse of one. A closed arc starts at its least position
/// in either direction, so its reverse is found the same way.
fn intern(a: Vec<P>, arcs: &mut Vec<Vec<P>>, index: &mut HashMap<u64, Vec<usize>>) -> i64 {
    let fwd = digest(a.iter());
    if let Some(c) = index.get(&fwd) { if let Some(&i) = c.iter().find(|&&i| arcs[i] == a) { return i as i64; } }
    let rev = digest(a.iter().rev());
    if let Some(c) = index.get(&rev) {
        if let Some(&i) = c.iter().find(|&&i| arcs[i].iter().eq(a.iter().rev())) { return !(i as i64); }
    }
    arcs.push(a);
    index.entry(fwd).or_default().push(arcs.len() - 1);
    (arcs.len() - 1) as i64
}

pub fn arc(r: i64) -> (usize, bool) { if r >= 0 { (r as usize, true) } else { (!r as usize, false) } }

/// Positions of a ring of refs, closed (first == last).
pub fn positions(arcs: &[Vec<P>], refs: &[i64]) -> Vec<P> {
    let mut out: Vec<P> = Vec::new();
    for &r in refs {
        let (i, fwd) = arc(r);
        let a = &arcs[i];
        let it: Box<dyn Iterator<Item = &P>> = if fwd { Box::new(a.iter()) } else { Box::new(a.iter().rev()) };
        for (k, p) in it.enumerate() { if k > 0 || out.is_empty() { out.push(*p); } }
    }
    out
}

/// Twice the signed area of a closed ring (shoelace; positive when counter-clockwise in lon/lat).
pub fn area2(r: &[P]) -> f64 {
    r.windows(2).map(|w| w[0][0] as f64 * w[1][1] as f64 - w[1][0] as f64 * w[0][1] as f64).sum()
}

/// Whether `p` lies inside closed ring `r` (even–odd ray casting).
pub fn inside(p: P, r: &[P]) -> bool {
    let (x, y) = (p[0] as f64, p[1] as f64);
    let mut c = false;
    for w in r.windows(2) {
        let ([xi, yi], [xj, yj]) = (w[0].map(|v| v as f64), w[1].map(|v| v as f64));
        if (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi { c = !c; }
    }
    c
}

/// Union of the shapes in each group (`group[f]` for feature f, groups 0..k).
/// Within a group each arc's net use (forward minus reverse) is counted: interior arcs cancel and boundary arcs keep
/// their direction, with multiplicity. Counting uses instead fails where snapping to the grid collapses a thin feature
/// onto its neighbour's border (uses +1, -1, +1): the arc is lost and the walk around the outline dead-ends. The net
/// boundary is balanced (every position starts as many arcs as it ends), so chaining arcs end to start always closes.
/// Rings are polygons by orientation (`ext`: sign of exterior rings) and containment.
pub fn dissolve(t: &Topology, group: &[usize], k: usize, ext: f64) -> Vec<Shape> {
    let mut refs: Vec<Vec<i64>> = vec![Vec::new(); k];
    for (f, shape) in t.shapes.iter().enumerate() { refs[group[f]].extend(shape.iter().flatten().flatten()); }
    refs.iter().map(|rs| {
        let mut net: HashMap<usize, i64> = HashMap::new();
        for &r in rs { let (i, fwd) = arc(r); *net.entry(i).or_default() += if fwd { 1 } else { -1 }; }
        let mut ids: Vec<usize> = net.keys().copied().collect();
        ids.sort_unstable();
        let edge: Vec<i64> = ids.iter().flat_map(|&i| { let n = net[&i]; std::iter::repeat(if n > 0 { i as i64 } else { !(i as i64) }).take(n.unsigned_abs() as usize) }).collect();
        let end = |r: i64| { let (i, fwd) = arc(r); if fwd { *t.arcs[i].last().unwrap() } else { t.arcs[i][0] } };
        let start = |r: i64| { let (i, fwd) = arc(r); if fwd { t.arcs[i][0] } else { *t.arcs[i].last().unwrap() } };
        let mut from: HashMap<P, Vec<usize>> = HashMap::new();
        for (e, &r) in edge.iter().enumerate() { from.entry(start(r)).or_default().push(e); }
        let mut used = vec![false; edge.len()];
        let mut rings: Vec<Refs> = Vec::new();
        for e0 in 0..edge.len() {
            if used[e0] { continue; }
            let (mut ring, mut r) = (vec![edge[e0]], edge[e0]);
            used[e0] = true;
            while end(r) != start(edge[e0]) {
                match from.get(&end(r)).and_then(|c| c.iter().copied().find(|&x| !used[x])) {
                    Some(n) => { used[n] = true; ring.push(edge[n]); r = edge[n]; }
                    None => break,
                }
            }
            if end(r) == start(edge[e0]) { rings.push(ring); }
        }
        polygons(&t.arcs, rings, ext)
    }).collect()
}

/// Rings to polygons: exteriors by orientation; each hole goes to the smallest exterior containing it.
pub fn polygons(arcs: &[Vec<P>], rings: Vec<Refs>, ext: f64) -> Shape {
    let pos: Vec<Vec<P>> = rings.iter().map(|r| positions(arcs, r)).collect();
    let a: Vec<f64> = pos.iter().map(|r| area2(r)).collect();
    let outer: Vec<usize> = (0..rings.len()).filter(|&i| a[i] * ext > 0.0).collect();
    let mut shape: Shape = outer.iter().map(|&i| vec![rings[i].clone()]).collect();
    for h in (0..rings.len()).filter(|&i| a[i] * ext <= 0.0) {
        let host = outer.iter().enumerate().filter(|(_, &o)| inside(pos[h][0], &pos[o]))
            .min_by(|x, y| a[*x.1].abs().total_cmp(&a[*y.1].abs())).map(|(j, _)| j);
        if let Some(j) = host { shape[j].push(rings[h].clone()); }
    }
    shape
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sq(x: i64, y: i64, s: i64) -> Vec<P> { vec![[x, y], [x + s, y], [x + s, y + s], [x, y + s]] }

    #[test]
    fn shared_edge_is_one_arc_used_in_both_directions() {
        // Two unit squares side by side: the shared edge x = 1 is one arc, referenced forward and reversed.
        let t = build(&[vec![vec![sq(0, 0, 1)]], vec![vec![sq(1, 0, 1)]]]);
        let all: Vec<i64> = t.shapes.iter().flatten().flatten().flatten().copied().collect();
        let shared: Vec<usize> = (0..t.arcs.len()).filter(|&i| all.contains(&(i as i64)) && all.contains(&!(i as i64))).collect();
        assert_eq!(shared.len(), 1);
        assert_eq!(t.arcs[shared[0]].len(), 2);
        for s in &t.shapes { let r = positions(&t.arcs, &s[0][0]); assert_eq!(r.first(), r.last()); assert_eq!(r.len(), 5); }
    }

    #[test]
    fn island_in_a_hole_is_one_closed_arc() {
        // A square with a hole, and the island filling the hole: one closed arc for both rings.
        let t = build(&[vec![vec![sq(0, 0, 4), sq(1, 1, 2).into_iter().rev().collect()]], vec![vec![sq(1, 1, 2)]]]);
        assert_eq!(t.shapes[0][0][1].len(), 1);
        assert_eq!(arc(t.shapes[0][0][1][0]).0, arc(t.shapes[1][0][0][0]).0);
    }

    #[test]
    fn dissolve_of_a_two_by_two_grid_is_its_outline() {
        let cells: Vec<Vec<Polygon>> = [(0, 0), (1, 0), (0, 1), (1, 1)].iter().map(|&(x, y)| vec![vec![sq(x, y, 1)]]).collect();
        let t = build(&cells);
        let d = dissolve(&t, &[0, 0, 0, 0], 1, 1.0);
        assert_eq!(d[0].len(), 1);
        let r = positions(&t.arcs, &d[0][0][0]);
        assert_eq!(area2(&r), 8.0);
        let corners: HashSet<P> = r.iter().copied().collect();
        for c in [[0, 0], [2, 0], [2, 2], [0, 2]] { assert!(corners.contains(&c)); }
    }

    #[test]
    fn dissolve_keeps_an_arc_with_nonzero_net_use() {
        // A unit square (one closed arc) and a zero-area feature tracing that arc out and back: the arc is used three
        // times with net +1, and the union is still the square.
        let t = build(&[vec![vec![sq(0, 0, 1)]]]);
        let sliver: Shape = vec![vec![vec![0, !0]]];
        let t = Topology { arcs: t.arcs, shapes: vec![t.shapes[0].clone(), sliver] };
        let d = dissolve(&t, &[0, 0], 1, 1.0);
        assert_eq!(d[0].len(), 1);
        assert_eq!(area2(&positions(&t.arcs, &d[0][0][0])), 2.0);
    }

    #[test]
    fn dissolve_keeps_a_hole_left_by_an_excluded_feature() {
        // Ring of eight cells around a centre cell in another group: the union is an exterior with one hole.
        let mut cells = Vec::new();
        let mut group = Vec::new();
        for y in 0..3 { for x in 0..3 { cells.push(vec![vec![sq(x, y, 1)]]); group.push(if (x, y) == (1, 1) { 1 } else { 0 }); } }
        let t = build(&cells);
        let d = dissolve(&t, &group, 2, 1.0);
        assert_eq!(d[0].len(), 1);
        assert_eq!(d[0][0].len(), 2);
        assert_eq!(area2(&positions(&t.arcs, &d[0][0][0])), 18.0);
        assert_eq!(area2(&positions(&t.arcs, &d[0][0][1])), -2.0);
    }
}
