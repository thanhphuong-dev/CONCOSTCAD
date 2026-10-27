use crate::geometry::positive_angle;
use acadrust::entities::{Arc, EntityType, Line, LwPolyline, LwVertex};
use acadrust::tables::Layer;
use acadrust::types::{Handle, Vector2, Vector3};
use acadrust::{CadDocument as CadFile, DwgReader, DwgWriter, DxfReader, DxfWriter};
use std::collections::BTreeMap;
use std::collections::HashSet;
use std::fs;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_DRAWING_BYTES: u64 = 1_073_741_824;
const MAX_UNDO_STEPS: usize = 100;
static NEXT_DOCUMENT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DrawingFormat {
    Dwg,
    Dxf,
}

impl DrawingFormat {
    fn from_path(path: &Path) -> Result<Self, String> {
        match path.extension().and_then(|extension| extension.to_str()) {
            Some(extension) if extension.eq_ignore_ascii_case("dwg") => Ok(Self::Dwg),
            Some(extension) if extension.eq_ignore_ascii_case("dxf") => Ok(Self::Dxf),
            _ => Err("Choose a .dwg or .dxf file".to_owned()),
        }
    }
}

pub struct DrawingDocument {
    id: u64,
    cad: CadFile,
    path: Option<PathBuf>,
    source_format: Option<DrawingFormat>,
    state_id: u64,
    saved_state_id: u64,
    next_state_id: u64,
    undo: Vec<HistoryFrame>,
    redo: Vec<HistoryFrame>,
}

struct HistoryFrame {
    cad: CadFile,
    state_id: u64,
}

impl DrawingDocument {
    pub fn new() -> Self {
        Self {
            id: NEXT_DOCUMENT_ID.fetch_add(1, Ordering::Relaxed),
            cad: CadFile::new(),
            path: None,
            source_format: None,
            state_id: 0,
            saved_state_id: 0,
            next_state_id: 1,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }

    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        let metadata = fs::metadata(&path).map_err(|error| format!("Cannot read file: {error}"))?;
        if metadata.len() > MAX_DRAWING_BYTES {
            return Err(format!(
                "Drawing is larger than the current {} MiB file limit",
                MAX_DRAWING_BYTES / (1024 * 1024)
            ));
        }
        let format = DrawingFormat::from_path(&path)?;
        let parsed =
            catch_unwind(AssertUnwindSafe(|| read_cad_file(&path, format))).map_err(|_| {
                "The drawing parser stopped unexpectedly while reading this file".to_owned()
            })??;

        Ok(Self {
            id: NEXT_DOCUMENT_ID.fetch_add(1, Ordering::Relaxed),
            cad: parsed,
            path: Some(path),
            source_format: Some(format),
            state_id: 0,
            saved_state_id: 0,
            next_state_id: 1,
            undo: Vec::new(),
            redo: Vec::new(),
        })
    }

    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    pub fn id(&self) -> u64 {
        self.id
    }
    pub fn state_id(&self) -> u64 {
        self.state_id
    }

    pub fn save_snapshot(&self) -> Self {
        Self {
            id: self.id,
            cad: self.cad.clone(),
            path: self.path.clone(),
            source_format: self.source_format,
            state_id: self.state_id,
            saved_state_id: self.saved_state_id,
            next_state_id: self.next_state_id,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }

    pub fn complete_save(&mut self, path: PathBuf, saved_state_id: u64) -> Result<(), String> {
        let format = DrawingFormat::from_path(&path)?;
        if let Some(source_format) = self.source_format {
            if source_format != format {
                return Err("Save As to another CAD format is disabled until conversion-loss reporting is available".to_owned());
            }
        }
        self.path = Some(path);
        self.source_format = Some(format);
        self.saved_state_id = saved_state_id;
        Ok(())
    }

    pub fn dirty(&self) -> bool {
        self.state_id != self.saved_state_id
    }

    pub fn entity_count(&self) -> usize {
        self.cad.model_space_entities().count()
    }

    pub fn unpreservable_unknown_count(&self, format: DrawingFormat) -> usize {
        self.cad
            .entities()
            .filter(|entity| match entity {
                EntityType::Unknown(unknown) => match format {
                    DrawingFormat::Dwg => unknown.raw_dwg_data.is_none(),
                    DrawingFormat::Dxf => unknown.raw_dxf_codes.is_none(),
                },
                _ => false,
            })
            .count()
    }

    pub fn model_space_entities(&self) -> impl Iterator<Item = &EntityType> + '_ {
        self.cad.model_space_entities()
    }

    pub fn entity(&self, handle: Handle) -> Option<&EntityType> {
        self.cad.get_entity(handle)
    }

    pub fn layers(&self) -> impl Iterator<Item = (&str, bool, bool, bool)> {
        self.cad.layers.iter().map(|layer| {
            (
                layer.name.as_str(),
                layer.flags.frozen,
                layer.flags.off,
                layer.flags.locked,
            )
        })
    }

    pub fn current_layer(&self) -> &str {
        &self.cad.header.current_layer_name
    }

    pub fn add_layer(&mut self, name: &str) -> Result<(), String> {
        let name = name.trim();
        if name.is_empty()
            || name.chars().any(|c| {
                matches!(
                    c,
                    '<' | '>' | '/' | '\\' | '"' | ':' | ';' | '?' | '*' | '|' | '=' | ','
                )
            })
        {
            return Err("Layer name is empty or contains an invalid character".to_owned());
        }
        if self.cad.layers.get(name).is_some() {
            return Err("A layer with that name already exists".to_owned());
        }
        self.begin_change();
        self.cad
            .layers
            .add(Layer::new(name))
            .map_err(|e| e.to_string())?;
        self.cad.assign_table_entry_handles();
        self.cad.header.current_layer_name = name.to_owned();
        self.cad.header.current_layer_handle = self
            .cad
            .layers
            .get(name)
            .map(|layer| layer.handle)
            .unwrap_or(Handle::NULL);
        self.advance_state();
        Ok(())
    }

    pub fn rename_layer(&mut self, old_name: &str, new_name: &str) -> Result<(), String> {
        let new_name = new_name.trim();
        if new_name.is_empty()
            || new_name.chars().any(|c| {
                matches!(
                    c,
                    '<' | '>' | '/' | '\\' | '"' | ':' | ';' | '?' | '*' | '|' | '=' | ','
                )
            })
        {
            return Err("Layer name is empty or contains an invalid character".to_owned());
        }
        if self.cad.layers.get(new_name).is_some() {
            return Err("A layer with that name already exists".to_owned());
        }
        self.cad
            .layers
            .get(old_name)
            .ok_or_else(|| format!("Layer '{old_name}' does not exist"))?;
        self.begin_change();
        self.cad
            .rename_layer(old_name, new_name)
            .map_err(|e| e.to_string())?;
        self.advance_state();
        Ok(())
    }

    pub fn set_current_layer(&mut self, name: &str) -> Result<(), String> {
        let layer = self
            .cad
            .layers
            .get(name)
            .ok_or_else(|| format!("Layer '{name}' does not exist"))?;
        if layer.flags.off || layer.flags.frozen || layer.flags.locked {
            return Err("Cannot make a locked, off, or frozen layer current".to_owned());
        }
        if self
            .cad
            .header
            .current_layer_name
            .eq_ignore_ascii_case(name)
        {
            return Ok(());
        }
        let handle = layer.handle;
        self.begin_change();
        self.cad.header.current_layer_name = name.to_owned();
        self.cad.header.current_layer_handle = handle;
        self.advance_state();
        Ok(())
    }

    pub fn set_entity_layer(&mut self, handle: Handle, name: &str) -> Result<(), String> {
        let layer = self
            .cad
            .layers
            .get(name)
            .ok_or_else(|| format!("Layer '{name}' does not exist"))?;
        if layer.flags.locked || layer.flags.off || layer.flags.frozen {
            return Err("Cannot assign an entity to a locked, off, or frozen layer".to_owned());
        }
        let entity = self
            .cad
            .get_entity(handle)
            .ok_or("Selected entity no longer exists")?;
        if entity.common().layer.eq_ignore_ascii_case(name) {
            return Ok(());
        }
        self.begin_change();
        if let Some(entity) = self.cad.get_entity_mut(handle) {
            entity.common_mut().layer = name.to_owned();
        }
        self.advance_state();
        Ok(())
    }

    pub fn set_layer_flags(
        &mut self,
        name: &str,
        frozen: bool,
        off: bool,
        locked: bool,
    ) -> Result<(), String> {
        if name.eq_ignore_ascii_case("0") && (frozen || off) {
            return Err("Layer 0 cannot be frozen or turned off".to_owned());
        }
        let layer = self
            .cad
            .layers
            .get(name)
            .ok_or_else(|| format!("Layer '{name}' does not exist"))?;
        if layer.flags.frozen == frozen && layer.flags.off == off && layer.flags.locked == locked {
            return Ok(());
        }
        if self
            .cad
            .header
            .current_layer_name
            .eq_ignore_ascii_case(name)
            && (frozen || off || locked)
        {
            return Err(
                "Set another current layer before freezing or turning off this layer".to_owned(),
            );
        }
        self.begin_change();
        if let Some(layer) = self.cad.layers.get_mut(name) {
            layer.flags.frozen = frozen;
            layer.flags.off = off;
            layer.flags.locked = locked;
        }
        self.advance_state();
        Ok(())
    }

    pub fn replace_line(
        &mut self,
        handle: Handle,
        start: Vector2,
        end: Vector2,
    ) -> Result<(), String> {
        if !finite2(start) || !finite2(end) || start == end {
            return Err("LINE requires two distinct finite points".to_owned());
        }
        self.ensure_current_layer_editable()?;
        if !matches!(self.cad.get_entity(handle), Some(EntityType::Line(_))) {
            return Err("Selected entity is not a LINE".to_owned());
        }
        if let Some(EntityType::Line(line)) = self.cad.get_entity(handle) {
            if line.start.x == start.x
                && line.start.y == start.y
                && line.end.x == end.x
                && line.end.y == end.y
            {
                return Ok(());
            }
        }
        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();
        if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(handle) {
            line.start = Vector3::new(start.x, start.y, line.start.z);
            line.end = Vector3::new(end.x, end.y, line.end.z);
        }
        self.advance_state();
        Ok(())
    }

    pub fn replace_arc(
        &mut self,
        handle: Handle,
        center: Vector2,
        radius: f64,
        start: f64,
        end: f64,
    ) -> Result<(), String> {
        if !finite2(center)
            || !radius.is_finite()
            || radius <= 0.0
            || !(center.x.abs() + radius).is_finite()
            || !(center.y.abs() + radius).is_finite()
            || !start.is_finite()
            || !end.is_finite()
        {
            return Err("ARC requires a positive radius and finite center and angles".to_owned());
        }
        let start = positive_angle(start);
        let end = positive_angle(end);
        if start == end {
            return Err(
                "ARC start and end angles must define a non-zero, non-full sweep".to_owned(),
            );
        }
        self.ensure_current_layer_editable()?;
        if !matches!(self.cad.get_entity(handle), Some(EntityType::Arc(_))) {
            return Err("Selected entity is not an ARC".to_owned());
        }
        if let Some(EntityType::Arc(arc)) = self.cad.get_entity(handle) {
            if arc.center.x == center.x
                && arc.center.y == center.y
                && arc.radius == radius
                && arc.start_angle == start
                && arc.end_angle == end
            {
                return Ok(());
            }
        }
        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();
        if let Some(EntityType::Arc(arc)) = self.cad.get_entity_mut(handle) {
            arc.center.x = center.x;
            arc.center.y = center.y;
            arc.radius = radius;
            arc.start_angle = start;
            arc.end_angle = end;
        }
        self.advance_state();
        Ok(())
    }

    pub fn replace_polyline(
        &mut self,
        handle: Handle,
        vertices: &[LwVertex],
        closed: bool,
    ) -> Result<(), String> {
        if vertices.len() < if closed { 3 } else { 2 } {
            return Err(
                "Polyline needs at least two vertices; a closed polyline needs three".to_owned(),
            );
        }
        if vertices
            .iter()
            .any(|v| !finite2(v.location) || !v.bulge.is_finite())
        {
            return Err("Polyline vertices and bulges must be finite".to_owned());
        }
        validate_polyline_vertices(vertices, closed)?;
        if !matches!(self.cad.get_entity(handle), Some(EntityType::LwPolyline(_))) {
            return Err("Selected entity is not a lightweight Polyline".to_owned());
        }
        if let Some(EntityType::LwPolyline(poly)) = self.cad.get_entity(handle) {
            if poly.is_closed == closed
                && poly.vertices.len() == vertices.len()
                && poly.vertices.iter().zip(vertices).all(|(a, b)| {
                    a.location == b.location
                        && a.bulge == b.bulge
                        && a.start_width == b.start_width
                        && a.end_width == b.end_width
                })
            {
                return Ok(());
            }
        }
        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();
        if let Some(EntityType::LwPolyline(poly)) = self.cad.get_entity_mut(handle) {
            poly.vertices = vertices.to_vec();
            poly.is_closed = closed;
        }
        self.advance_state();
        Ok(())
    }

    pub fn add_line(&mut self, start: Vector2, end: Vector2) -> Result<Handle, String> {
        if !finite2(start) || !finite2(end) || start == end {
            return Err("LINE requires two distinct finite points".to_owned());
        }
        self.ensure_current_layer_editable()?;
        self.begin_change();
        let line = Line::from_coords(start.x, start.y, 0.0, end.x, end.y, 0.0);
        let mut line = line;
        line.common.layer = self.cad.header.current_layer_name.clone();
        self.add_entity(EntityType::Line(line))
    }

    pub fn add_arc(
        &mut self,
        center: Vector2,
        radius: f64,
        start: f64,
        end: f64,
    ) -> Result<Handle, String> {
        if !finite2(center)
            || !radius.is_finite()
            || radius <= 0.0
            || !(center.x.abs() + radius).is_finite()
            || !(center.y.abs() + radius).is_finite()
            || !start.is_finite()
            || !end.is_finite()
        {
            return Err("ARC requires a positive radius and finite center and angles".to_owned());
        }
        let start = positive_angle(start);
        let end = positive_angle(end);
        if start == end {
            return Err(
                "ARC start and end angles must define a non-zero, non-full sweep".to_owned(),
            );
        }
        self.ensure_current_layer_editable()?;
        self.begin_change();
        let mut arc = Arc::from_center_radius_angles(
            Vector3::new(center.x, center.y, 0.0),
            radius,
            start,
            end,
        );
        arc.common.layer = self.cad.header.current_layer_name.clone();
        self.add_entity(EntityType::Arc(arc))
    }

    pub fn add_polyline_vertices(
        &mut self,
        vertices: &[LwVertex],
        closed: bool,
    ) -> Result<Handle, String> {
        if vertices.len() < if closed { 3 } else { 2 } {
            return Err(
                "Polyline needs at least two vertices; a closed polyline needs three".to_owned(),
            );
        }
        if vertices
            .iter()
            .any(|v| !finite2(v.location) || !v.bulge.is_finite())
        {
            return Err("Polyline vertices and bulges must be finite".to_owned());
        }
        validate_polyline_vertices(vertices, closed)?;
        self.ensure_current_layer_editable()?;
        self.begin_change();
        let mut polyline = LwPolyline::new();
        polyline.vertices = vertices.to_vec();
        polyline.is_closed = closed;
        polyline.common.layer = self.cad.header.current_layer_name.clone();
        self.add_entity(EntityType::LwPolyline(polyline))
    }

    pub fn translate_many(&mut self, handles: &[Handle], dx: f64, dy: f64) -> Result<(), String> {
        if !dx.is_finite() || !dy.is_finite() {
            return Err("Move offset must be finite".to_owned());
        }
        let handles = unique_handles(handles);
        if handles.is_empty() || (dx == 0.0 && dy == 0.0) {
            return Ok(());
        }
        for handle in &handles {
            if self.cad.get_entity(*handle).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            self.ensure_entity_layer_editable(*handle)?;
            if !entity_translation_is_finite(self.cad.get_entity(*handle).unwrap(), dx, dy) {
                return Err("Move would produce non-finite entity coordinates".to_owned());
            }
        }
        self.begin_change();
        for handle in &handles {
            if let Some(entity) = self.cad.get_entity_mut(*handle) {
                entity.as_entity_mut().translate(Vector3::new(dx, dy, 0.0));
            }
        }
        self.advance_state();
        Ok(())
    }

    pub fn erase_many(&mut self, handles: &[Handle]) -> Result<(), String> {
        let handles = unique_handles(handles);
        if handles.is_empty() {
            return Ok(());
        }
        for handle in &handles {
            if self.cad.get_entity(*handle).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            self.ensure_entity_layer_editable(*handle)?;
        }
        self.begin_change();
        for handle in &handles {
            self.cad
                .remove_entity(*handle)
                .expect("all unique erase handles were validated before commit");
        }
        self.advance_state();
        Ok(())
    }

    pub fn undo(&mut self) -> bool {
        if let Some(previous) = self.undo.pop() {
            self.redo.push(HistoryFrame {
                cad: self.cad.clone(),
                state_id: self.state_id,
            });
            self.cad = previous.cad;
            self.state_id = previous.state_id;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(next) = self.redo.pop() {
            self.undo.push(HistoryFrame {
                cad: self.cad.clone(),
                state_id: self.state_id,
            });
            self.cad = next.cad;
            self.state_id = next.state_id;
            true
        } else {
            false
        }
    }

    pub fn save(&mut self, path: impl AsRef<Path>) -> Result<PathBuf, String> {
        let path = path.as_ref().to_path_buf();
        let target_format = DrawingFormat::from_path(&path)?;
        if let Some(source_format) = self.source_format {
            if source_format != target_format {
                return Err("Save As to another CAD format is disabled until conversion-loss reporting is available".to_owned());
            }
        }
        let unpreservable = self.unpreservable_unknown_count(target_format);
        if unpreservable > 0 {
            return Err(format!(
                "Save cancelled: {unpreservable} unknown entity/entities lack raw {target_format:?} data and would be dropped by the writer"
            ));
        }
        write_atomic(&self.cad, &path, target_format)?;
        self.path = Some(path.clone());
        self.source_format = Some(target_format);
        self.saved_state_id = self.state_id;
        Ok(path)
    }

    fn add_entity(&mut self, entity: EntityType) -> Result<Handle, String> {
        let handle = self
            .cad
            .add_entity(entity)
            .map_err(|error| error.to_string())?;
        self.advance_state();
        Ok(handle)
    }

    fn begin_change(&mut self) {
        self.undo.push(HistoryFrame {
            cad: self.cad.clone(),
            state_id: self.state_id,
        });
        if self.undo.len() > MAX_UNDO_STEPS {
            self.undo.remove(0);
        }
        self.redo.clear();
    }

    fn advance_state(&mut self) {
        self.state_id = self.next_state_id;
        self.next_state_id = self.next_state_id.wrapping_add(1).max(1);
    }

    fn ensure_entity_layer_editable(&self, handle: Handle) -> Result<(), String> {
        let layer_name = &self
            .cad
            .get_entity(handle)
            .ok_or("Selected entity no longer exists")?
            .common()
            .layer;
        if let Some(layer) = self.cad.layers.get(layer_name) {
            if layer.flags.locked || layer.flags.frozen || layer.flags.off {
                return Err(format!(
                    "Entity is on a locked, frozen, or off layer: {layer_name}"
                ));
            }
        }
        Ok(())
    }

    fn ensure_current_layer_editable(&self) -> Result<(), String> {
        let name = &self.cad.header.current_layer_name;
        let layer = self
            .cad
            .layers
            .get(name)
            .ok_or_else(|| format!("Current layer '{name}' is missing"))?;
        if layer.flags.locked || layer.flags.frozen || layer.flags.off {
            return Err(format!("Current layer cannot be edited: {name}"));
        }
        Ok(())
    }
}

fn finite2(p: Vector2) -> bool {
    p.x.is_finite() && p.y.is_finite()
}

fn validate_polyline_vertices(vertices: &[LwVertex], closed: bool) -> Result<(), String> {
    if vertices
        .windows(2)
        .any(|pair| pair[0].location == pair[1].location)
        || (closed && vertices[0].location == vertices[vertices.len() - 1].location)
    {
        return Err("Polyline cannot contain consecutive duplicate vertices".to_owned());
    }
    if vertices.iter().any(|vertex| vertex.bulge.abs() > 1.0e6) {
        return Err("Polyline bulge magnitude must not exceed 1000000".to_owned());
    }
    let segment_count = if closed {
        vertices.len()
    } else {
        vertices.len() - 1
    };
    for index in 0..segment_count {
        let a = vertices[index];
        let b = vertices[(index + 1) % vertices.len()];
        let dx = b.location.x - a.location.x;
        let dy = b.location.y - a.location.y;
        let chord = dx.hypot(dy);
        if !chord.is_finite() {
            return Err("Polyline segment length exceeds numeric limits".to_owned());
        }
        let bulge = a.bulge;
        if bulge.abs() >= 1.0e-10 {
            let sweep = 4.0 * bulge.atan();
            let radius = chord / (2.0 * (sweep.abs() * 0.5).sin());
            let offset = chord / (2.0 * (sweep * 0.5).tan());
            if !radius.is_finite() || !offset.is_finite() {
                return Err("Polyline bulge creates geometry outside numeric limits".to_owned());
            }
        }
    }
    Ok(())
}

fn unique_handles(handles: &[Handle]) -> Vec<Handle> {
    let mut seen = HashSet::with_capacity(handles.len());
    handles
        .iter()
        .copied()
        .filter(|handle| seen.insert(*handle))
        .collect()
}

fn entity_translation_is_finite(entity: &EntityType, dx: f64, dy: f64) -> bool {
    let finite = |x: f64, y: f64| (x + dx).is_finite() && (y + dy).is_finite();
    match entity {
        EntityType::Line(line) => {
            finite(line.start.x, line.start.y) && finite(line.end.x, line.end.y)
        }
        EntityType::Arc(arc) => {
            finite(arc.center.x, arc.center.y)
                && finite(arc.center.x + arc.radius, arc.center.y + arc.radius)
                && finite(arc.center.x - arc.radius, arc.center.y - arc.radius)
        }
        EntityType::LwPolyline(polyline) => polyline
            .vertices
            .iter()
            .all(|vertex| finite(vertex.location.x, vertex.location.y)),
        _ => true,
    }
}

impl Default for DrawingDocument {
    fn default() -> Self {
        Self::new()
    }
}

fn write_atomic(document: &CadFile, target: &Path, format: DrawingFormat) -> Result<(), String> {
    let parent = target
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid target file name")?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let staging = parent.join(format!(".{file_name}.{}.{}.tmp", std::process::id(), nonce));
    let backup = parent.join(format!(".{file_name}.{}.{}.bak", std::process::id(), nonce));

    let write_result = catch_unwind(AssertUnwindSafe(|| match format {
        DrawingFormat::Dwg => DwgWriter::write_to_file(&staging, document),
        DrawingFormat::Dxf => DxfWriter::new(document).write_to_file(&staging),
    }))
    .map_err(|_| "CAD writer stopped unexpectedly".to_owned())
    .and_then(|r| r.map_err(|e| e.to_string()));
    if let Err(error) = write_result {
        let _ = fs::remove_file(&staging);
        return Err(format!("Could not write drawing: {error}"));
    }

    let validation = catch_unwind(AssertUnwindSafe(|| read_cad_file(&staging, format)))
        .map_err(|_| "CAD reader stopped unexpectedly while validating the saved file".to_owned())
        .and_then(|result| result);
    let reopened = match validation {
        Ok(reopened) => reopened,
        Err(error) => {
            let _ = fs::remove_file(&staging);
            return Err(format!("Save validation failed: {error}"));
        }
    };
    if entity_type_counts(&reopened) != entity_type_counts(document) {
        let expected = entity_type_counts(document);
        let actual = entity_type_counts(&reopened);
        let _ = fs::remove_file(&staging);
        return Err(format!(
            "Save validation failed: entity type counts changed from {expected:?} to {actual:?}; original file was kept"
        ));
    }

    if let Err(error) = replace_target(&staging, target, &backup) {
        let _ = fs::remove_file(&staging);
        return Err(format!("Could not atomically replace the drawing: {error}"));
    }
    Ok(())
}

#[cfg(windows)]
fn replace_target(staging: &Path, target: &Path, backup: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MOVEFILE_WRITE_THROUGH, MoveFileExW, ReplaceFileW,
    };

    let wide = |path: &Path| {
        path.as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    let staging_w = wide(staging);
    let target_w = wide(target);
    if target.exists() {
        let backup_w = wide(backup);
        let replaced = unsafe {
            ReplaceFileW(
                target_w.as_ptr(),
                staging_w.as_ptr(),
                backup_w.as_ptr(),
                0,
                std::ptr::null(),
                std::ptr::null_mut(),
            )
        };
        if replaced == 0 {
            return Err(std::io::Error::last_os_error());
        }
        let _ = fs::remove_file(backup);
        Ok(())
    } else {
        let moved = unsafe {
            MoveFileExW(
                staging_w.as_ptr(),
                target_w.as_ptr(),
                MOVEFILE_WRITE_THROUGH,
            )
        };
        if moved == 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(())
        }
    }
}

#[cfg(not(windows))]
fn replace_target(staging: &Path, target: &Path, _backup: &Path) -> std::io::Result<()> {
    fs::rename(staging, target)
}

fn entity_type_counts(document: &CadFile) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for entity in document.entities() {
        *counts
            .entry(entity.as_entity().entity_type().to_owned())
            .or_insert(0) += 1;
    }
    counts
}

fn read_cad_file(path: &Path, format: DrawingFormat) -> Result<CadFile, String> {
    match format {
        DrawingFormat::Dwg => {
            let mut reader = DwgReader::from_file(path).map_err(|e| e.to_string())?;
            reader.read().map_err(|e| e.to_string())
        }
        DrawingFormat::Dxf => DxfReader::from_file(path)
            .and_then(DxfReader::read)
            .map_err(|e| e.to_string()),
    }
}
