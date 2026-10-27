//! Writes site/boundaries/neighbours-<pr>.json: the rook adjacency of census subdivisions and of census divisions.
//!
//! Usage: neighbours <boundary-dir>
//! Two areas are neighbours when they share an arc of the committed TopoJSON (csd-<pr>.json, cd-<pr>.json). The
//! builder splits arcs at every junction and gives neighbours identical borders, so a shared arc is a shared border
//! of positive length; areas meeting at a corner only are not neighbours. Files are per province or territory, so
//! neighbours across a provincial border are absent. Output: {DGUID: [DGUID, ...]}, sorted, both levels in one file.

use serde_json::Value;
use std::{collections::{BTreeMap, BTreeSet}, env, fs, path::Path, process};

/// Provinces and territories, territories first (the site's order).
const PT: [&str; 13] = ["60", "61", "62", "59", "48", "47", "46", "35", "24", "13", "12", "11", "10"];

type Graph = BTreeMap<String, BTreeSet<String>>;

/// Adds the adjacency of one TopoJSON topology `t` (object "areas", property DGUID) to `g`.
/// Cost: O(Σ refs + Σ_arc u_a²), u_a the areas using arc a (at most two in a planar subdivision).
fn adjacency(t: &Value, g: &mut Graph) {
    let mut users: BTreeMap<i64, BTreeSet<&str>> = BTreeMap::new();
    for f in t["objects"]["areas"]["geometries"].as_array().into_iter().flatten() {
        let Some(id) = f["properties"]["DGUID"].as_str() else { continue };
        g.entry(id.to_string()).or_default();
        let mut stack = vec![&f["arcs"]];
        while let Some(v) = stack.pop() {
            match v {
                Value::Array(a) => stack.extend(a),
                Value::Number(n) => { let r = n.as_i64().unwrap_or(0); users.entry(if r < 0 { !r } else { r }).or_default().insert(id); }
                _ => {}
            }
        }
    }
    for u in users.values() {
        for a in u { for b in u { if a != b { g.get_mut(*a).unwrap().insert(b.to_string()); } } }
    }
}

fn run(dir: &Path) -> Result<(), String> {
    for pr in PT {
        let mut g = Graph::new();
        for level in ["csd", "cd"] {
            let path = dir.join(format!("{level}-{pr}.json"));
            let t: Value = serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?)
                .map_err(|e| format!("{}: {e}", path.display()))?;
            adjacency(&t, &mut g);
        }
        let out: BTreeMap<&String, Vec<&String>> = g.iter().map(|(k, v)| (k, v.iter().collect())).collect();
        let s = serde_json::to_string(&out).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("neighbours-{pr}.json")), &s).map_err(|e| e.to_string())?;
        println!("neighbours-{pr}.json  {} areas  {} bytes", g.len(), s.len());
    }
    Ok(())
}

fn main() {
    let a: Vec<String> = env::args().collect();
    if a.len() != 2 { eprintln!("usage: neighbours <boundary-dir>"); process::exit(2); }
    if let Err(e) = run(Path::new(&a[1])) { eprintln!("error: {e}"); process::exit(1); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn areas_sharing_an_arc_are_neighbours_in_either_direction() {
        // A | B | C in a row: A and B share arc 1 (B uses it reversed), B and C share arc 3; A and C do not touch.
        let t = json!({"objects": {"areas": {"geometries": [
            {"type": "Polygon", "arcs": [[0, 1]], "properties": {"DGUID": "A"}},
            {"type": "MultiPolygon", "arcs": [[[2, -2, 3]], [[5]]], "properties": {"DGUID": "B"}},
            {"type": "Polygon", "arcs": [[4, -4]], "properties": {"DGUID": "C"}},
            {"type": null, "properties": {"DGUID": "D"}}]}}});
        let mut g = Graph::new();
        adjacency(&t, &mut g);
        let n = |k: &str| g[k].iter().cloned().collect::<Vec<_>>();
        assert_eq!(n("A"), ["B"]);
        assert_eq!(n("B"), ["A", "C"]);
        assert_eq!(n("C"), ["B"]);
        assert!(g["D"].is_empty());
    }
}
