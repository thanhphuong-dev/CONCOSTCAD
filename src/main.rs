mod document;
mod geometry;

use acadrust::entities::{EntityType, LwVertex};
use acadrust::types::{Handle, Vector2};
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
    color: String,
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
    Circle {
        handle: u64,
        layer: String,
        cx: f64,
        cy: f64,
        radius: f64,
    },
    Polyline {
        handle: u64,
        layer: String,
        closed: bool,
        points: Vec<VertexView>,
    },
    Text {
        handle: u64,
        layer: String,
        text: String,
        x: f64,
        y: f64,
        height: f64,
        rotation: f64,
    },
    Insert {
        handle: u64,
        layer: String,
        block_name: String,
        x: f64,
        y: f64,
        scale_x: f64,
        scale_y: f64,
        rotation: f64,
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
                EntityType::Circle(circle) => Some(EntityView::Circle {
                    handle,
                    layer,
                    cx: circle.center.x,
                    cy: circle.center.y,
                    radius: circle.radius,
                }),
                EntityType::Text(text) => Some(EntityView::Text {
                    handle,
                    layer,
                    text: text.value.clone(),
                    x: text.insertion_point.x,
                    y: text.insertion_point.y,
                    height: text.height,
                    rotation: text.rotation,
                }),
                EntityType::Insert(insert) => Some(EntityView::Insert {
                    handle,
                    layer,
                    block_name: insert.block_name.clone(),
                    x: insert.insert_point.x,
                    y: insert.insert_point.y,
                    scale_x: insert.x_scale(),
                    scale_y: insert.y_scale(),
                    rotation: insert.rotation,
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
            .map(|(name, frozen, off, locked, rgb)| {
                let color = match rgb {
                    Some((r, g, b)) => format!("#{:02x}{:02x}{:02x}", r, g, b),
                    None => "#79c9dc".to_owned(),
                };
                LayerView {
                    name: name.to_owned(),
                    frozen,
                    off,
                    locked,
                    color,
                }
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

#[tauri::command]
fn redo(state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.redo();
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn erase_entities(handles: Vec<u64>, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let handles = handles.into_iter().map(Handle::new).collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.erase_many(&handles)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn move_entities(
    handles: Vec<u64>,
    dx: f64,
    dy: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = handles.into_iter().map(Handle::new).collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.translate_many(&handles, dx, dy)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_layer(name: String, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_layer(&name)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn set_current_layer(name: String, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.set_current_layer(&name)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn set_entity_layer(
    handle: u64,
    layer: String,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.set_entity_layer(Handle::new(handle), &layer)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn copy_entities(
    handles: Vec<u64>,
    dx: f64,
    dy: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = handles.into_iter().map(Handle::new).collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.copy_many(&handles, dx, dy)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn rotate_entities(
    handles: Vec<u64>,
    cx: f64,
    cy: f64,
    angle_deg: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = handles.into_iter().map(Handle::new).collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let rad = angle_deg * std::f64::consts::PI / 180.0;
    drawing.rotate_many(&handles, cx, cy, rad)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn mirror_entities(
    handles: Vec<u64>,
    p1_x: f64,
    p1_y: f64,
    p2_x: f64,
    p2_y: f64,
    keep_source: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = handles.into_iter().map(Handle::new).collect::<Vec<_>>();
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.mirror_many(&handles, p1_x, p1_y, p2_x, p2_y, keep_source)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_line(
    handle: u64,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_line(Handle::new(handle), Vector2::new(x1, y1), Vector2::new(x2, y2))?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_arc(
    handle: u64,
    x: f64,
    y: f64,
    radius: f64,
    start: f64,
    end: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_arc(Handle::new(handle), Vector2::new(x, y), radius, start, end)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_polyline(
    handle: u64,
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
    drawing.replace_polyline(Handle::new(handle), &vertices, closed)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn explode_entity(handle: u64, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.explode_entity(Handle::new(handle))?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn offset_entity(
    handle: u64,
    distance: f64,
    side_x: f64,
    side_y: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.offset_entity(Handle::new(handle), distance, Vector2::new(side_x, side_y))?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn set_layer_flags(
    name: String,
    frozen: bool,
    off: bool,
    locked: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.set_layer_flags(&name, frozen, off, locked)?;
    Ok(snapshot(&drawing))
}


#[tauri::command]
fn add_circle(
    cx: f64,
    cy: f64,
    radius: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_circle(Vector2::new(cx, cy), radius)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_circle(
    handle: u64,
    cx: f64,
    cy: f64,
    radius: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_circle(Handle::from(handle), Vector2::new(cx, cy), radius)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_text(
    value: String,
    x: f64,
    y: f64,
    height: f64,
    rotation: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_text(&value, Vector2::new(x, y), height, rotation)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_text(
    handle: u64,
    value: String,
    x: f64,
    y: f64,
    height: f64,
    rotation: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_text(Handle::from(handle), &value, Vector2::new(x, y), height, rotation)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn join_entities(handles: Vec<u64>, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let rust_handles: Vec<Handle> = handles.into_iter().map(Handle::from).collect();
    drawing.join_entities(&rust_handles)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn fillet_lines(
    h1: u64,
    h2: u64,
    radius: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.fillet_lines(Handle::from(h1), Handle::from(h2), radius)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn chamfer_lines(
    h1: u64,
    h2: u64,
    d1: f64,
    d2: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.chamfer_lines(Handle::from(h1), Handle::from(h2), d1, d2)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn trim_line(
    target_handle: u64,
    click_x: f64,
    click_y: f64,
    cutter_handles: Vec<u64>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let cutters: Vec<Handle> = cutter_handles.into_iter().map(Handle::from).collect();
    drawing.trim_line(Handle::from(target_handle), click_x, click_y, &cutters)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn extend_line(
    target_handle: u64,
    click_x: f64,
    click_y: f64,
    boundary_handles: Vec<u64>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let boundaries: Vec<Handle> = boundary_handles.into_iter().map(Handle::from).collect();
    drawing.extend_line(Handle::from(target_handle), click_x, click_y, &boundaries)?;
    Ok(snapshot(&drawing))
}


#[tauri::command]
fn set_layer_color(
    name: String,
    hex: String,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let hex_clean = hex.trim_start_matches('#');
    if hex_clean.len() == 6 {
        let r = u8::from_str_radix(&hex_clean[0..2], 16).map_err(|e| e.to_string())?;
        let g = u8::from_str_radix(&hex_clean[2..4], 16).map_err(|e| e.to_string())?;
        let b = u8::from_str_radix(&hex_clean[4..6], 16).map_err(|e| e.to_string())?;
        drawing.set_layer_color(&name, r, g, b)?;
    }
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn add_dimension(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    ox: f64,
    oy: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_aligned_dimension(
        Vector2::new(x1, y1),
        Vector2::new(x2, y2),
        Vector2::new(ox, oy),
        None,
    )?;
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
            undo,
            redo,
            erase_entities,
            move_entities,
            add_layer,
            set_current_layer,
            set_entity_layer,
            set_layer_flags,
            copy_entities,
            rotate_entities,
            mirror_entities,
            update_line,
            update_arc,
            update_polyline,
            explode_entity,
            offset_entity,
            add_circle,
            update_circle,
            add_text,
            update_text,
            join_entities,
            fillet_lines,
            chamfer_lines,
            trim_line,
            extend_line,
            set_layer_color,
            add_dimension,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CONCOSTCAD");
}
