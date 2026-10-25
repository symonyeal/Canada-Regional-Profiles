//! Paged queries against the Statistics Canada 2021 cartographic boundary map service.
//!
//! Geometry is quantized by the server to a 1e-4 degree grid anchored at (142° W, 84° N) (Esri JSON
//! `quantizationParameters`, "view" mode: rings delta-encoded, repeated grid cells dropped). Snapping every feature to
//! one grid keeps the positions that neighbours share identical; full-resolution Arctic coastlines are too large to
//! serve. Pages are written to the cache directory and reused, so an interrupted fetch resumes where it stopped.
//!
//! Two failures recur. About half of new connections get HTTP 500 at once: retried with growing waits. A page holding
//! a very large feature (Qikiqtaaluk, Unorganized: 25 MB) ends after 15 to 20 s with "Error performing query
//! operation": the page is split until it fits, down to one feature. Bodies are read whole (ureq's into_string stops
//! at 10 MB).

use std::{fs, io::Read, path::{Path, PathBuf}, thread, time::Duration};

pub const SERVICE: &str = "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer";
/// The quantization grid: origin (x0, y0) = (-142, 84) degrees, cell 1e-4 degrees, y downward.
pub const GRID: &str = r#"{"mode":"view","originPosition":"upperLeft","tolerance":0.0001,"extent":{"xmin":-142,"ymin":41,"xmax":-52,"ymax":84,"spatialReference":{"wkid":4326}}}"#;

/// One query: layer id, filter, largest page, the server's generalisation in degrees (None: none), geometry or not.
pub struct Query<'a> { pub layer: u32, pub filter: &'a str, pub page: usize, pub offset: Option<&'a str>, pub geometry: bool }

enum Failure { TooLarge, Fatal(String) }

/// Fetches every feature of `q` into `dir/name-<start>-<size>.json` files and returns them in order.
pub fn pages(q: &Query, name: &str, dir: &Path) -> Result<Vec<PathBuf>, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let (mut out, mut start, mut size) = (Vec::new(), 0, q.page);
    loop {
        // A page split on an earlier run is cached under its smaller size; reuse it rather than ask again.
        if let Some(s) = (1..=size).rev().find(|s| dir.join(format!("{name}-{start}-{s}.json")).exists()) { size = s; }
        let path = dir.join(format!("{name}-{start}-{size}.json"));
        if !path.exists() {
            match page(q, start, size) {
                Ok(body) => fs::write(&path, &body).map_err(|e| e.to_string())?,
                Err(Failure::TooLarge) if size > 1 => { size = (size / 4).max(1); continue; }
                Err(Failure::TooLarge) => return Err(format!("{name} @{start}: one feature is too large to serve")),
                Err(Failure::Fatal(e)) => return Err(e),
            }
        }
        let n = count(&fs::read_to_string(&path).map_err(|e| e.to_string())?)?;
        out.push(path);
        if n < size { break; }
        start += n;
        size = (size * 2).min(q.page);
    }
    Ok(out)
}

fn count(body: &str) -> Result<usize, String> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    v["features"].as_array().map(|a| a.len()).ok_or_else(|| "page without features".into())
}

fn page(q: &Query, start: usize, size: usize) -> Result<String, Failure> {
    let url = format!("{SERVICE}/{}/query", q.layer);
    let mut form = vec![("where", q.filter.to_string()), ("outFields", "*".into()), ("returnGeometry", q.geometry.to_string()),
        ("outSR", "4326".into()), ("quantizationParameters", GRID.into()), ("resultOffset", start.to_string()),
        ("resultRecordCount", size.to_string()), ("orderByFields", "OBJECTID".into()), ("f", "json".into())];
    if let Some(o) = q.offset { form.push(("maxAllowableOffset", o.into())); }
    let form: Vec<(&str, &str)> = form.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let (mut last, mut refused) = (String::new(), 0);
    // Waits of 1, 2, 4 … 30 s; thirty attempts outlast the service's bursts of refusals.
    for attempt in 0..30u32 {
        if attempt > 0 { thread::sleep(Duration::from_secs((1u64 << attempt.min(5)).min(30))); }
        match ureq::post(&url).timeout(Duration::from_secs(300)).send_form(&form).map(|r| { let mut b = String::new(); r.into_reader().read_to_string(&mut b).map(|_| b) }) {
            Ok(Ok(body)) if body.contains("\"features\"") => {
                eprintln!("  layer {} {} @{start}+{size}: {:.1} MB (attempt {})", q.layer, q.filter, body.len() as f64 / 1e6, attempt + 1);
                return Ok(body);
            }
            Ok(Ok(body)) if body.contains("Error performing query operation") => {
                refused += 1;
                if refused >= 2 { return Err(Failure::TooLarge); }
                last.clear();
            }
            Ok(Ok(body)) => last = body.chars().take(200).collect(),
            Ok(Err(e)) => last = e.to_string(),
            Err(e) => last = e.to_string(),
        }
        eprintln!("  layer {} {} @{start}+{size}: attempt {} failed: {}", q.layer, q.filter, attempt + 1, if last.is_empty() { "query error" } else { &last[..last.len().min(80)] });
    }
    Err(Failure::Fatal(format!("layer {} {} @{start}: {last}", q.layer, q.filter)))
}
