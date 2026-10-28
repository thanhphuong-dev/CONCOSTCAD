#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod document;
mod geometry;
mod logging;

use acadrust::entities::{EntityType, LwVertex};
use acadrust::types::{Handle, Vector2};
use document::DrawingDocument;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::{Deref, DerefMut};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

struct CadState(Mutex<CadWorkspace>);

struct CadWorkspace {
    documents: BTreeMap<u64, DrawingDocument>,
    active_id: u64,
    autosave_session: String,
}

impl CadWorkspace {
    fn new() -> Self {
        let drawing = DrawingDocument::new();
        let active_id = drawing.id();
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        Self {
            documents: BTreeMap::from([(active_id, drawing)]),
            active_id,
            autosave_session: format!("{}-{stamp}", std::process::id()),
        }
    }

    fn active(&self) -> &DrawingDocument {
        self.documents
            .get(&self.active_id)
            .expect("active drawing exists")
    }

    fn active_mut(&mut self) -> &mut DrawingDocument {
        self.documents
            .get_mut(&self.active_id)
            .expect("active drawing exists")
    }

    fn insert(&mut self, drawing: DrawingDocument) {
        self.active_id = drawing.id();
        self.documents.insert(self.active_id, drawing);
    }

    fn switch(&mut self, id: u64) -> Result<(), String> {
        if !self.documents.contains_key(&id) {
            return Err("Drawing tab no longer exists".to_owned());
        }
        self.active_id = id;
        Ok(())
    }

    fn close(&mut self, id: u64, discard: bool) -> Result<(), String> {
        let drawing = self
            .documents
            .get(&id)
            .ok_or("Drawing tab no longer exists")?;
        if drawing.dirty() && !discard {
            return Err("Save or confirm discarding this drawing before closing it".to_owned());
        }
        self.documents.remove(&id);
        if self.documents.is_empty() {
            self.insert(DrawingDocument::new());
        } else if self.active_id == id {
            self.active_id = *self.documents.keys().next_back().expect("drawing exists");
        }
        Ok(())
    }
}

impl Deref for CadWorkspace {
    type Target = DrawingDocument;

    fn deref(&self) -> &Self::Target {
        self.active()
    }
}

impl DerefMut for CadWorkspace {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.active_mut()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CadSnapshot {
    document_id: u64,
    documents: Vec<DocumentTabView>,
    title: String,
    dirty: bool,
    entity_count: usize,
    current_layer: String,
    layers: Vec<LayerView>,
    entities: Vec<EntityView>,
}

#[derive(Serialize)]
struct DocumentTabView {
    id: u64,
    title: String,
    dirty: bool,
}

#[derive(Serialize)]
struct LayerView {
    handle: CadHandleId,
    name: String,
    frozen: bool,
    off: bool,
    locked: bool,
    color: String,
}

/// CAD handles cross the JavaScript boundary as decimal strings so JavaScript
/// cannot round a valid 64-bit drawing handle to a different object ID.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(transparent)]
struct CadHandleId(String);

impl From<Handle> for CadHandleId {
    fn from(handle: Handle) -> Self {
        Self(handle.value().to_string())
    }
}

impl CadHandleId {
    fn into_handle(self) -> Result<Handle, String> {
        let value = self.0.parse::<u64>().map_err(|_| {
            format!(
                "Invalid CAD handle '{}': expected an unsigned 64-bit decimal",
                self.0
            )
        })?;
        if value == 0 {
            return Err("CAD handle 0 is invalid".to_owned());
        }
        Ok(Handle::new(value))
    }
}

fn parse_handles(handles: Vec<CadHandleId>) -> Result<Vec<Handle>, String> {
    handles.into_iter().map(CadHandleId::into_handle).collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddDimensionRequest {
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    ox: f64,
    oy: f64,
    text_override: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[serde(rename_all_fields = "camelCase")]
enum EntityView {
    Line {
        handle: CadHandleId,
        layer: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    Arc {
        handle: CadHandleId,
        layer: String,
        x: f64,
        y: f64,
        radius: f64,
        start: f64,
        end: f64,
    },
    Circle {
        handle: CadHandleId,
        layer: String,
        cx: f64,
        cy: f64,
        radius: f64,
    },
    Polyline {
        handle: CadHandleId,
        layer: String,
        closed: bool,
        points: Vec<VertexView>,
        bounds: Option<BoundsView>,
    },
    Text {
        handle: CadHandleId,
        layer: String,
        text: String,
        x: f64,
        y: f64,
        height: f64,
        rotation: f64,
    },
    Insert {
        handle: CadHandleId,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BoundsView {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

fn snapshot(workspace: &CadWorkspace) -> CadSnapshot {
    let drawing = workspace.active();
    let path = drawing.path().map(|p| p.display().to_string());
    let entities = drawing
        .model_space_entities()
        .filter_map(|entity| {
            let handle = CadHandleId::from(entity.common().handle);
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
                    bounds: geometry::polyline_metrics(&poly.vertices, poly.is_closed).map(
                        |metrics| BoundsView {
                            min_x: metrics.bounds.min.x,
                            min_y: metrics.bounds.min.y,
                            max_x: metrics.bounds.max.x,
                            max_y: metrics.bounds.max.y,
                        },
                    ),
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
        document_id: drawing.id(),
        documents: workspace
            .documents
            .values()
            .map(|document| DocumentTabView {
                id: document.id(),
                title: document
                    .path()
                    .and_then(|p| p.file_name())
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| format!("Drawing{}", document.id())),
                dirty: document.dirty(),
            })
            .collect(),
        title: path.unwrap_or_else(|| format!("Drawing{}", drawing.id())),
        dirty: drawing.dirty(),
        entity_count: drawing.entity_count(),
        current_layer: drawing.current_layer().to_owned(),
        layers: drawing
            .layers()
            .map(|(handle, name, frozen, off, locked, rgb)| {
                let color = match rgb {
                    Some((r, g, b)) => format!("#{:02x}{:02x}{:02x}", r, g, b),
                    None => "#79c9dc".to_owned(),
                };
                LayerView {
                    handle: CadHandleId::from(handle),
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
fn hit_test_entity(
    x: f64,
    y: f64,
    tolerance: f64,
    zoom: f64,
    state: State<'_, CadState>,
) -> Result<Option<CadHandleId>, String> {
    let workspace = state.0.lock().map_err(|error| error.to_string())?;
    Ok(workspace
        .hit_test_entity(Vector2::new(x, y), tolerance, zoom)
        .map(CadHandleId::from))
}

#[tauri::command]
fn new_drawing(state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.insert(DrawingDocument::new());
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn open_drawing(path: String, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let opened = match DrawingDocument::open(&path) {
        Ok(opened) => opened,
        Err(error) => {
            logging::error(&format!("drawing open failed: {error}"));
            return Err(error);
        }
    };
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.insert(opened);
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn switch_drawing(id: u64, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut workspace = state.0.lock().map_err(|e| e.to_string())?;
    workspace.switch(id)?;
    Ok(snapshot(&workspace))
}

#[tauri::command]
fn close_drawing(
    id: u64,
    discard: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut workspace = state.0.lock().map_err(|e| e.to_string())?;
    workspace.close(id, discard)?;
    Ok(snapshot(&workspace))
}

#[tauri::command]
fn autosave_drawings(state: State<'_, CadState>) -> Result<Vec<String>, String> {
    let (session, drawings) = {
        let workspace = state.0.lock().map_err(|e| e.to_string())?;
        (
            workspace.autosave_session.clone(),
            workspace
                .documents
                .values()
                .filter(|drawing| drawing.dirty())
                .map(|drawing| {
                    let extension = drawing
                        .path()
                        .and_then(|path| path.extension())
                        .and_then(|ext| ext.to_str())
                        .filter(|ext| {
                            ext.eq_ignore_ascii_case("dwg") || ext.eq_ignore_ascii_case("dxf")
                        })
                        .unwrap_or("dxf")
                        .to_ascii_lowercase();
                    (drawing.id(), extension, drawing.save_snapshot())
                })
                .collect::<Vec<_>>(),
        )
    };
    if drawings.is_empty() {
        return Ok(Vec::new());
    }
    let root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("CONCOSTCAD")
        .join("Autosave");
    std::fs::create_dir_all(&root)
        .map_err(|error| format!("Cannot create autosave directory: {error}"))?;
    let mut saved = Vec::with_capacity(drawings.len());
    for (id, extension, mut drawing) in drawings {
        let path = root.join(format!("autosave-{session}-{id}.{extension}"));
        drawing
            .save(&path)
            .map_err(|error| format!("Autosave {} failed: {error}", path.display()))?;
        saved.push(path.display().to_string());
    }
    Ok(saved)
}

#[tauri::command]
fn save_warnings(path: Option<String>, state: State<'_, CadState>) -> Result<Vec<String>, String> {
    let workspace = state.0.lock().map_err(|e| e.to_string())?;
    let drawing = workspace.active();
    let target = path
        .map(PathBuf::from)
        .or_else(|| drawing.path().map(PathBuf::from))
        .ok_or("Choose a file path first")?;
    drawing.save_warnings_for_path(target)
}

#[tauri::command]
fn save_drawing(
    path: Option<String>,
    acknowledge_warnings: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let target = path
        .map(PathBuf::from)
        .or_else(|| drawing.path().map(PathBuf::from))
        .ok_or("Choose a file path first")?;
    let warnings = drawing.save_warnings_for_path(&target)?;
    if !warnings.is_empty() && !acknowledge_warnings {
        return Err("Save requires acknowledging the unsupported-data warning".to_owned());
    }
    if let Err(error) = drawing.save(&target) {
        logging::error(&format!("drawing save failed: {error}"));
        return Err(error);
    }
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
fn erase_entities(
    handles: Vec<CadHandleId>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = parse_handles(handles)?;
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.erase_many(&handles)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn move_entities(
    handles: Vec<CadHandleId>,
    dx: f64,
    dy: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = parse_handles(handles)?;
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
    handle: CadHandleId,
    layer: String,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.set_entity_layer(handle.into_handle()?, &layer)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn copy_entities(
    handles: Vec<CadHandleId>,
    dx: f64,
    dy: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = parse_handles(handles)?;
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.copy_many(&handles, dx, dy)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn rotate_entities(
    handles: Vec<CadHandleId>,
    cx: f64,
    cy: f64,
    angle_deg: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = parse_handles(handles)?;
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let rad = angle_deg * std::f64::consts::PI / 180.0;
    drawing.rotate_many(&handles, cx, cy, rad)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn mirror_entities(
    handles: Vec<CadHandleId>,
    p1_x: f64,
    p1_y: f64,
    p2_x: f64,
    p2_y: f64,
    keep_source: bool,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let handles = parse_handles(handles)?;
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.mirror_many(&handles, p1_x, p1_y, p2_x, p2_y, keep_source)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_line(
    handle: CadHandleId,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_line(
        handle.into_handle()?,
        Vector2::new(x1, y1),
        Vector2::new(x2, y2),
    )?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_arc(
    handle: CadHandleId,
    x: f64,
    y: f64,
    radius: f64,
    start: f64,
    end: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_arc(
        handle.into_handle()?,
        Vector2::new(x, y),
        radius,
        start,
        end,
    )?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn update_polyline(
    handle: CadHandleId,
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
    drawing.replace_polyline(handle.into_handle()?, &vertices, closed)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn explode_entity(handle: CadHandleId, state: State<'_, CadState>) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.explode_entity(handle.into_handle()?)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn offset_entity(
    handle: CadHandleId,
    distance: f64,
    side_x: f64,
    side_y: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.offset_entity(
        handle.into_handle()?,
        distance,
        Vector2::new(side_x, side_y),
    )?;
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
    handle: CadHandleId,
    cx: f64,
    cy: f64,
    radius: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_circle(handle.into_handle()?, Vector2::new(cx, cy), radius)?;
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
    handle: CadHandleId,
    value: String,
    x: f64,
    y: f64,
    height: f64,
    rotation: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.replace_text(
        handle.into_handle()?,
        &value,
        Vector2::new(x, y),
        height,
        rotation,
    )?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn join_entities(
    handles: Vec<CadHandleId>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let rust_handles: Vec<Handle> = parse_handles(handles)?;
    drawing.join_entities(&rust_handles)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn fillet_lines(
    h1: CadHandleId,
    h2: CadHandleId,
    radius: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.fillet_lines(h1.into_handle()?, h2.into_handle()?, radius)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn chamfer_lines(
    h1: CadHandleId,
    h2: CadHandleId,
    d1: f64,
    d2: f64,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.chamfer_lines(h1.into_handle()?, h2.into_handle()?, d1, d2)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn trim_line(
    target_handle: CadHandleId,
    click_x: f64,
    click_y: f64,
    cutter_handles: Vec<CadHandleId>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let cutters = parse_handles(cutter_handles)?;
    drawing.trim_line(target_handle.into_handle()?, click_x, click_y, &cutters)?;
    Ok(snapshot(&drawing))
}

#[tauri::command]
fn extend_line(
    target_handle: CadHandleId,
    click_x: f64,
    click_y: f64,
    boundary_handles: Vec<CadHandleId>,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    let boundaries = parse_handles(boundary_handles)?;
    drawing.extend_line(target_handle.into_handle()?, click_x, click_y, &boundaries)?;
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
    request: AddDimensionRequest,
    state: State<'_, CadState>,
) -> Result<CadSnapshot, String> {
    let mut drawing = state.0.lock().map_err(|e| e.to_string())?;
    drawing.add_aligned_dimension(
        Vector2::new(request.x1, request.y1),
        Vector2::new(request.x2, request.y2),
        Vector2::new(request.ox, request.oy),
        request.text_override.as_deref(),
    )?;
    Ok(snapshot(&drawing))
}

fn main() {
    let log_path = logging::initialize();
    logging::install_panic_hook();
    logging::info(&format!(
        "starting CONCOSTCAD {} (pid {})",
        env!("CARGO_PKG_VERSION"),
        std::process::id()
    ));
    if let Some(path) = log_path {
        logging::info(&format!("local diagnostic log: {}", path.display()));
    }

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CadState(Mutex::new(CadWorkspace::new())))
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            hit_test_entity,
            new_drawing,
            open_drawing,
            save_warnings,
            switch_drawing,
            close_drawing,
            autosave_drawings,
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
        .run(tauri::generate_context!());

    match result {
        Ok(()) => logging::info("CONCOSTCAD exited normally"),
        Err(error) => {
            logging::error(&format!("Tauri runtime failed: {error}"));
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod workspace_tests {
    use super::*;

    #[test]
    fn switching_tabs_preserves_each_drawing_and_undo_history() {
        let mut workspace = CadWorkspace::new();
        let first = workspace.active_id;
        workspace
            .add_line(Vector2::new(0.0, 0.0), Vector2::new(10.0, 0.0))
            .unwrap();

        let second = DrawingDocument::new();
        let second_id = second.id();
        workspace.insert(second);
        workspace
            .add_line(Vector2::new(0.0, 0.0), Vector2::new(0.0, 20.0))
            .unwrap();

        workspace.switch(first).unwrap();
        assert_eq!(workspace.entity_count(), 1);
        workspace.undo();
        assert_eq!(workspace.entity_count(), 0);

        workspace.switch(second_id).unwrap();
        assert_eq!(workspace.entity_count(), 1);
        assert!(workspace.dirty());
    }

    #[test]
    fn closing_a_dirty_tab_requires_discard_confirmation() {
        let mut workspace = CadWorkspace::new();
        let id = workspace.active_id;
        workspace
            .add_line(Vector2::new(0.0, 0.0), Vector2::new(1.0, 0.0))
            .unwrap();

        assert!(workspace.close(id, false).is_err());
        assert_eq!(workspace.active_id, id);
        assert_eq!(workspace.entity_count(), 1);

        workspace.close(id, true).unwrap();
        assert_ne!(workspace.active_id, id);
        assert_eq!(workspace.entity_count(), 0);
    }
}
