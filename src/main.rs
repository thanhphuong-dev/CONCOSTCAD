mod document;
mod geometry;

use acadrust::entities::{EntityType, LwVertex};
use acadrust::types::Vector2;
use document::DrawingDocument;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

struct CadState(Mutex<DrawingDocument>);

#[derive(Serialize)]
struct CadSnapshot {
    title: String,
    dirty: bool,
    entity_count: usize,
    current_layer: String,
    layers: Vec<LayerView>,
    entities: Vec<EntityView>,
}

#[derive(Serialize)]
struct LayerView {
    name: String,
    frozen: bool,
    off: bool,
    locked: bool,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum EntityView {
    Line {
        handle: u64,
        layer: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    Arc {
        handle: u64,
        layer: String,
        x: f64,
        y: f64,
        radius: f64,
        start: f64,
        end: f64,
    },
    Polyline {
        handle: u64,
        layer: String,
        closed: bool,
        points: Vec<VertexView>,
    },
}

#[derive(Serialize)]
struct VertexView {
    x: f64,
    y: f64,
    bulge: f64,
}

fn snapshot(drawing: &DrawingDocument) -> CadSnapshot {
    let path = drawing.path().map(|p| p.display().to_string());
    let entities = drawing
        .model_space_entities()
        .filter_map(|entity| {
            let handle = entity.common().handle.value();
            let layer = entity.common().layer.clone();
            match entity {
                EntityType::Line(line) => Some(EntityView::Line {
                    handle,
                    layer,
                    x1: line.start.x,
                    y1: line.start.y,
                    x2: line.end.x,
                    y2: line.end.y,
                }),
                EntityType::Arc(arc) => Some(EntityView::Arc {
                    handle,
                    layer,
                    x: arc.center.x,
                    y: arc.center.y,
                    radius: arc.radius,
                    start: arc.start_angle,
                    end: arc.end_angle,
                }),
                EntityType::LwPolyline(poly) => Some(EntityView::Polyline {
                    handle,
                    layer,
                    closed: poly.is_closed,
                    points: poly
                        .vertices
                        .iter()
                        .map(|v| VertexView {
                            x: v.location.x,
                            y: v.location.y,
                            bulge: v.bulge,
                        })
                        .collect(),
                }),
                _ => None,
            }
        })
        .collect();
    CadSnapshot {
        title: path.unwrap_or_else(|| "Drawing1".into()),
        dirty: drawing.dirty(),
        entity_count: drawing.entity_count(),
        current_layer: drawing.current_layer().to_owned(),
        layers: drawing
            .layers()
            .map(|(name, frozen, off, locked)| LayerView {
                name: name.to_owned(),
                frozen,
                off,
                locked,
            })
            .collect(),
        entities,
    }
}

#[tauri::command]
fn get_snapshot(state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    state
        .0
        .lock()
        .map(|drawing| snapshot(&drawing))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn new_drawing(state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    *drawing = DrawingDocument::new();
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn open_drawing(path: String, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let opened = DrawingDocument::open(&path)?;
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    *drawing = opened;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn save_drawing(path: Option<String>, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let target = path
        .map(PathBuf::from)
        .or_else(|| drawing.path().map(PathBuf::from))
        .ok_or("Choose a file path first")?;
    drawing.save(&target)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_line(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_line(Vector2::new(x1, y1), Vector2::new(x2, y2))?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_polyline(
    points: Vec<[f64; 3]>,
    closed: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let vertices = points
        .into_iter()
        .map(|p| {
            let mut v = LwVertex::new(Vector2::new(p[0], p[1]));
            v.bulge = p[2];
            v
        })
        .collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_polyline_vertices(&vertices, closed)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_arc(
    x: f64,
    y: f64,
    radius: f64,
    start: f64,
    end: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_arc(Vector2::new(x, y), radius, start, end)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn undo(state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.undo();
    Ok(snapshot(&drawing))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CadState(Mutex::new(DrawingDocument::new())))
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            new_drawing,
            open_drawing,
            save_drawing,
            add_line,
            add_arc,
            add_polyline,
            undo
        ])
        .run(tauri::generate_context!())
        .expect("error while running CONCOSTCAD");
}
