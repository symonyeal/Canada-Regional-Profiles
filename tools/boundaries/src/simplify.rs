//! Visvalingam–Whyatt simplification (Visvalingam and Whyatt 1993, The Cartographic Journal 30(1), 46–51).
//!
//! A position's effective area is the triangle it forms with its current neighbours. The position of least area is
//! removed and its neighbours' areas recomputed, until none is left. Areas are made monotone: a position never gets
//! less than the area of the position removed before it (the correction used by Bostock's topojson), so one threshold
//! gives a nested series of simplifications. Arcs are simplified once, so shared borders stay shared.
//!
//! Legend
//!   a   arc positions, planar [x, y]: x = lon·cos(φ̄), y = lat, in degrees (φ̄: the arc's mean latitude)
//!   w   effective area of each position, degrees²; endpoints are infinite and always kept
//! Cost: O(n log n) per arc with a binary heap (stale entries skipped).

use std::{cmp::{Ordering, Reverse}, collections::BinaryHeap};
use crate::topo::{arc, P};

#[derive(PartialEq)]
struct W(f64);
impl Eq for W {}
impl PartialOrd for W { fn partial_cmp(&self, o: &Self) -> Option<Ordering> { Some(self.cmp(o)) } }
impl Ord for W { fn cmp(&self, o: &Self) -> Ordering { self.0.total_cmp(&o.0) } }

/// Effective areas w of arc `a`.
pub fn areas(a: &[[f64; 2]]) -> Vec<f64> {
    let n = a.len();
    let mut w = vec![f64::INFINITY; n];
    if n < 3 { return w; }
    let tri = |i: usize, j: usize, k: usize|
        ((a[j][0] - a[i][0]) * (a[k][1] - a[i][1]) - (a[k][0] - a[i][0]) * (a[j][1] - a[i][1])).abs() / 2.0;
    let (mut prev, mut next): (Vec<usize>, Vec<usize>) = ((0..n).map(|i| i.wrapping_sub(1)).collect(), (1..=n).collect());
    let mut cur = vec![0.0; n];
    let mut heap = BinaryHeap::new();
    for i in 1..n - 1 { cur[i] = tri(i - 1, i, i + 1); heap.push(Reverse((W(cur[i]), i))); }
    let mut floor = 0.0f64;
    while let Some(Reverse((W(x), i))) = heap.pop() {
        if w[i].is_finite() || x != cur[i] { continue; }
        floor = floor.max(x);
        w[i] = floor;
        let (p, q) = (prev[i], next[i]);
        next[p] = q;
        prev[q] = p;
        for j in [p, q] {
            if j > 0 && j < n - 1 { cur[j] = tri(prev[j], j, next[j]); heap.push(Reverse((W(cur[j]), j))); }
        }
    }
    w
}

/// Planar form of an arc of P (see legend).
pub fn planar(a: &[P]) -> Vec<[f64; 2]> {
    let phi = a.iter().map(|p| p[1] as f64).sum::<f64>() / a.len() as f64 * 1e-7;
    let k = phi.to_radians().cos() * 1e-7;
    a.iter().map(|p| [p[0] as f64 * k, p[1] as f64 * 1e-7]).collect()
}

/// Positions kept at threshold `eps`: endpoints and every position with w ≥ eps.
pub fn keep(w: &[f64], eps: f64) -> Vec<bool> { w.iter().map(|&x| x >= eps).collect() }

/// Keeps further positions until every ring has at least three distinct positions: each step restores the
/// position of greatest area among the ring's arcs. A restored position serves every ring sharing the arc.
pub fn guard(w: &[Vec<f64>], kept: &mut [Vec<bool>], rings: &[&Vec<i64>]) {
    for refs in rings {
        loop {
            let k: &[Vec<bool>] = kept;
            let distinct: usize = refs.iter().map(|&r| k[arc(r).0].iter().filter(|&&x| x).count() - 1).sum();
            if distinct >= 3 { break; }
            let best = refs.iter().map(|&r| arc(r).0)
                .flat_map(|i| (0..w[i].len()).filter(move |&j| !k[i][j]).map(move |j| (i, j)))
                .max_by(|x, y| w[x.0][x.1].total_cmp(&w[y.0][y.1]));
            match best { Some((i, j)) => kept[i][j] = true, None => break }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collinear_positions_go_first_and_endpoints_stay() {
        let w = areas(&[[0.0, 0.0], [1.0, 0.0], [2.0, 1.0], [3.0, 0.0], [4.0, 0.0]]);
        assert!(w[0].is_infinite() && w[4].is_infinite());
        assert!(w[2] > w[1] && w[2] > w[3]);
        assert_eq!(keep(&w, w[2]), vec![true, false, true, false, true]);
    }

    #[test]
    fn areas_are_monotone_in_removal_order() {
        // The spike at index 2 is removed after a smaller neighbour; its area never drops below that neighbour's.
        let a = [[0.0, 0.0], [1.0, 0.1], [2.0, 0.0], [3.0, 5.0], [4.0, 0.0]];
        let w = areas(&a);
        assert!(w[1..4].iter().all(|x| x.is_finite()));
        assert!(w[3] >= w[1] && w[3] >= w[2]);
    }
}
