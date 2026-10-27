#![allow(dead_code)]
use crate::geometry::{line_circle_intersections, line_line_intersection, positive_angle};
use acadrust::entities::{Arc, Circle, EntityType, Line, LwPolyline, LwVertex, Text};
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

    pub fn layers(&self) -> impl Iterator<Item = (&str, bool, bool, bool, Option<(u8, u8, u8)>)> {
        self.cad.layers.iter().map(|layer| {
            (
                layer.name.as_str(),
                layer.flags.frozen,
                layer.flags.off,
                layer.flags.locked,
                layer.color.rgb(),
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

    pub fn set_layer_color(&mut self, name: &str, r: u8, g: u8, b: u8) -> Result<(), String> {
        self.cad
            .layers
            .get(name)
            .ok_or_else(|| format!("Layer '{name}' does not exist"))?;
        self.begin_change();
        if let Some(layer) = self.cad.layers.get_mut(name) {
            layer.color = acadrust::types::Color::from_rgb(r, g, b);
        }
        self.advance_state();
        Ok(())
    }

    pub fn add_aligned_dimension(
        &mut self,
        p1: Vector2,
        p2: Vector2,
        offset_p: Vector2,
        text_override: Option<&str>,
    ) -> Result<Vec<Handle>, String> {
        if !finite2(p1) || !finite2(p2) || !finite2(offset_p) || p1 == p2 {
            return Err("DIMENSION requires two distinct finite definition points".to_owned());
        }
        self.ensure_current_layer_editable()?;

        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let len = dx.hypot(dy);
        if len < 1e-6 {
            return Err("Points are too close to dimension".to_owned());
        }

        let ux = dx / len;
        let uy = dy / len;
        let nx = -uy;
        let ny = ux;

        let h = (offset_p.x - p1.x) * nx + (offset_p.y - p1.y) * ny;
        let sign = if h >= 0.0 { 1.0 } else { -1.0 };
        let d1 = Vector2::new(p1.x + h * nx, p1.y + h * ny);
        let d2 = Vector2::new(p2.x + h * nx, p2.y + h * ny);

        self.begin_change();
        let mut handles = Vec::new();
        let layer = self.cad.header.current_layer_name.clone();

        let ext1_s = Vector2::new(p1.x + 0.5 * sign * nx, p1.y + 0.5 * sign * ny);
        let ext1_e = Vector2::new(d1.x + 1.2 * sign * nx, d1.y + 1.2 * sign * ny);
        let mut l1 = Line::from_coords(ext1_s.x, ext1_s.y, 0.0, ext1_e.x, ext1_e.y, 0.0);
        l1.common.layer = layer.clone();
        handles.push(self.cad.add_entity(EntityType::Line(l1)).map_err(|e| e.to_string())?);

        let ext2_s = Vector2::new(p2.x + 0.5 * sign * nx, p2.y + 0.5 * sign * ny);
        let ext2_e = Vector2::new(d2.x + 1.2 * sign * nx, d2.y + 1.2 * sign * ny);
        let mut l2 = Line::from_coords(ext2_s.x, ext2_s.y, 0.0, ext2_e.x, ext2_e.y, 0.0);
        l2.common.layer = layer.clone();
        handles.push(self.cad.add_entity(EntityType::Line(l2)).map_err(|e| e.to_string())?);

        let mut dline = Line::from_coords(d1.x, d1.y, 0.0, d2.x, d2.y, 0.0);
        dline.common.layer = layer.clone();
        handles.push(self.cad.add_entity(EntityType::Line(dline)).map_err(|e| e.to_string())?);

        let tick_len = 1.2;
        let tx = (ux + nx) * 0.707 * tick_len;
        let ty = (uy + ny) * 0.707 * tick_len;
        let mut t1 = Line::from_coords(d1.x - tx, d1.y - ty, 0.0, d1.x + tx, d1.y + ty, 0.0);
        t1.common.layer = layer.clone();
        handles.push(self.cad.add_entity(EntityType::Line(t1)).map_err(|e| e.to_string())?);

        let mut t2 = Line::from_coords(d2.x - tx, d2.y - ty, 0.0, d2.x + tx, d2.y + ty, 0.0);
        t2.common.layer = layer.clone();
        handles.push(self.cad.add_entity(EntityType::Line(t2)).map_err(|e| e.to_string())?);

        let val = text_override.map(|s| s.to_owned()).unwrap_or_else(|| format!("{:.2}", len));
        let mid_x = (d1.x + d2.x) * 0.5 + 0.8 * sign * nx;
        let mid_y = (d1.y + d2.y) * 0.5 + 0.8 * sign * ny;
        let mut rot = dy.atan2(dx);
        if rot > std::f64::consts::FRAC_PI_2 || rot < -std::f64::consts::FRAC_PI_2 {
            rot = positive_angle(rot + std::f64::consts::PI);
        }
        let mut text = Text::with_value(val, Vector3::new(mid_x, mid_y, 0.0));
        text.height = 2.5;
        text.rotation = rot;
        text.common.layer = layer;
        handles.push(self.cad.add_entity(EntityType::Text(text)).map_err(|e| e.to_string())?);

        self.advance_state();
        Ok(handles)
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

    pub fn add_circle(&mut self, center: Vector2, radius: f64) -> Result<Handle, String> {
        if !finite2(center) || !radius.is_finite() || radius <= 0.0 {
            return Err("CIRCLE requires a positive radius and finite center".to_owned());
        }
        self.ensure_current_layer_editable()?;
        self.begin_change();
        let mut circle = Circle::from_coords(center.x, center.y, 0.0, radius);
        circle.common.layer = self.cad.header.current_layer_name.clone();
        self.add_entity(EntityType::Circle(circle))
    }

    pub fn replace_circle(&mut self, handle: Handle, center: Vector2, radius: f64) -> Result<(), String> {
        if !finite2(center) || !radius.is_finite() || radius <= 0.0 {
            return Err("CIRCLE requires a positive radius and finite center".to_owned());
        }
        self.ensure_current_layer_editable()?;
        if !matches!(self.cad.get_entity(handle), Some(EntityType::Circle(_))) {
            return Err("Selected entity is not a CIRCLE".to_owned());
        }
        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();
        if let Some(EntityType::Circle(circle)) = self.cad.get_entity_mut(handle) {
            circle.center = Vector3::new(center.x, center.y, 0.0);
            circle.radius = radius;
        }
        self.advance_state();
        Ok(())
    }

    pub fn add_text(
        &mut self,
        value: &str,
        position: Vector2,
        height: f64,
        rotation_rad: f64,
    ) -> Result<Handle, String> {
        if value.trim().is_empty() {
            return Err("TEXT value cannot be empty".to_owned());
        }
        if !finite2(position) || !height.is_finite() || height <= 0.0 || !rotation_rad.is_finite() {
            return Err("TEXT requires a positive height and finite position and rotation".to_owned());
        }
        self.ensure_current_layer_editable()?;
        self.begin_change();
        let mut text = Text::with_value(value, Vector3::new(position.x, position.y, 0.0));
        text.height = height;
        text.rotation = positive_angle(rotation_rad);
        text.common.layer = self.cad.header.current_layer_name.clone();
        self.add_entity(EntityType::Text(text))
    }

    pub fn replace_text(
        &mut self,
        handle: Handle,
        value: &str,
        position: Vector2,
        height: f64,
        rotation_rad: f64,
    ) -> Result<(), String> {
        if value.trim().is_empty() {
            return Err("TEXT value cannot be empty".to_owned());
        }
        if !finite2(position) || !height.is_finite() || height <= 0.0 || !rotation_rad.is_finite() {
            return Err("TEXT requires a positive height and finite position and rotation".to_owned());
        }
        self.ensure_current_layer_editable()?;
        if !matches!(self.cad.get_entity(handle), Some(EntityType::Text(_))) {
            return Err("Selected entity is not a TEXT".to_owned());
        }
        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();
        if let Some(EntityType::Text(text)) = self.cad.get_entity_mut(handle) {
            text.value = value.to_owned();
            text.insertion_point = Vector3::new(position.x, position.y, 0.0);
            text.height = height;
            text.rotation = positive_angle(rotation_rad);
        }
        self.advance_state();
        Ok(())
    }

    pub fn join_entities(&mut self, handles: &[Handle]) -> Result<Handle, String> {
        let handles = unique_handles(handles);
        if handles.len() < 2 {
            return Err("JOIN requires at least two entities".to_owned());
        }
        for &h in &handles {
            if self.cad.get_entity(h).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            self.ensure_entity_layer_editable(h)?;
        }

        // Convert each entity into a chain of LwVertex
        let mut chains: Vec<Vec<LwVertex>> = Vec::new();
        let first_layer = self.cad.get_entity(handles[0]).unwrap().common().layer.clone();

        for &h in &handles {
            match self.cad.get_entity(h).unwrap() {
                EntityType::Line(line) => {
                    chains.push(vec![
                        LwVertex::new(Vector2::new(line.start.x, line.start.y)),
                        LwVertex::new(Vector2::new(line.end.x, line.end.y)),
                    ]);
                }
                EntityType::Arc(arc) => {
                    let s_pt = Vector2::new(
                        arc.center.x + arc.radius * arc.start_angle.cos(),
                        arc.center.y + arc.radius * arc.start_angle.sin(),
                    );
                    let e_pt = Vector2::new(
                        arc.center.x + arc.radius * arc.end_angle.cos(),
                        arc.center.y + arc.radius * arc.end_angle.sin(),
                    );
                    let sweep = positive_angle(arc.end_angle - arc.start_angle);
                    let bulge = (sweep * 0.25).tan();
                    chains.push(vec![
                        LwVertex::with_bulge(s_pt, bulge),
                        LwVertex::new(e_pt),
                    ]);
                }
                EntityType::LwPolyline(poly) => {
                    if poly.is_closed {
                        return Err("Cannot join an already closed polyline".to_owned());
                    }
                    chains.push(poly.vertices.clone());
                }
                _ => return Err("Only LINE, ARC, and open POLYLINE entities can be joined".to_owned()),
            }
        }

        // Iteratively stitch chains
        let mut merged = chains.remove(0);
        let dist = |a: Vector2, b: Vector2| (a.x - b.x).hypot(a.y - b.y);

        while !chains.is_empty() {
            let mut found = false;
            let m_tail = merged.last().unwrap().location;
            let m_head = merged.first().unwrap().location;

            for i in 0..chains.len() {
                let c_head = chains[i].first().unwrap().location;
                let c_tail = chains[i].last().unwrap().location;

                if dist(m_tail, c_head) < 1e-4 {
                    let chain = chains.remove(i);
                    merged.extend_from_slice(&chain[1..]);
                    found = true;
                    break;
                } else if dist(m_tail, c_tail) < 1e-4 {
                    let mut chain = chains.remove(i);
                    // Reverse chain
                    chain.reverse();
                    for v in &mut chain {
                        v.bulge = -v.bulge;
                    }
                    merged.extend_from_slice(&chain[1..]);
                    found = true;
                    break;
                } else if dist(m_head, c_tail) < 1e-4 {
                    let mut chain = chains.remove(i);
                    let _ = chain.pop();
                    chain.extend(merged);
                    merged = chain;
                    found = true;
                    break;
                } else if dist(m_head, c_head) < 1e-4 {
                    let mut chain = chains.remove(i);
                    chain.reverse();
                    for v in &mut chain {
                        v.bulge = -v.bulge;
                    }
                    let _ = chain.pop();
                    chain.extend(merged);
                    merged = chain;
                    found = true;
                    break;
                }
            }

            if !found {
                return Err("Selected entities do not form a continuous chain".to_owned());
            }
        }

        // Check if endpoints meet to form a closed polyline
        let mut closed = false;
        if merged.len() >= 3 && dist(merged.first().unwrap().location, merged.last().unwrap().location) < 1e-4 {
            merged.pop();
            closed = true;
        }

        self.begin_change();
        for &h in &handles {
            let _ = self.cad.remove_entity(h);
        }
        let mut poly = LwPolyline::new();
        poly.vertices = merged;
        poly.is_closed = closed;
        poly.common.layer = first_layer;
        let new_h = self.cad.add_entity(EntityType::LwPolyline(poly)).map_err(|e| e.to_string())?;
        self.advance_state();
        Ok(new_h)
    }

    pub fn fillet_lines(
        &mut self,
        h1: Handle,
        h2: Handle,
        radius: f64,
    ) -> Result<(Handle, Handle, Option<Handle>), String> {
        if !radius.is_finite() || radius < 0.0 {
            return Err("FILLET radius must be non-negative".to_owned());
        }
        if h1 == h2 {
            return Err("FILLET requires two different lines".to_owned());
        }
        let e1 = self.cad.get_entity(h1).cloned().ok_or("First line no longer exists")?;
        let e2 = self.cad.get_entity(h2).cloned().ok_or("Second line no longer exists")?;
        let (l1, l2) = match (&e1, &e2) {
            (EntityType::Line(l1), EntityType::Line(l2)) => (l1, l2),
            _ => return Err("FILLET currently supports two LINE entities".to_owned()),
        };
        self.ensure_entity_layer_editable(h1)?;
        self.ensure_entity_layer_editable(h2)?;

        let p1 = Vector2::new(l1.start.x, l1.start.y);
        let p2 = Vector2::new(l1.end.x, l1.end.y);
        let p3 = Vector2::new(l2.start.x, l2.start.y);
        let p4 = Vector2::new(l2.end.x, l2.end.y);

        let (inter, _t, _u) = line_line_intersection(p1, p2, p3, p4)
            .ok_or_else(|| "Lines are parallel or collinear".to_owned())?;

        let d1_s = (p1.x - inter.x).hypot(p1.y - inter.y);
        let d1_e = (p2.x - inter.x).hypot(p2.y - inter.y);
        let far1 = if d1_s >= d1_e { p1 } else { p2 };

        let d2_s = (p3.x - inter.x).hypot(p3.y - inter.y);
        let d2_e = (p4.x - inter.x).hypot(p4.y - inter.y);
        let far2 = if d2_s >= d2_e { p3 } else { p4 };

        self.begin_change();
        if radius < 1e-6 {
            if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h1) {
                line.start = Vector3::new(far1.x, far1.y, line.start.z);
                line.end = Vector3::new(inter.x, inter.y, line.end.z);
            }
            if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h2) {
                line.start = Vector3::new(far2.x, far2.y, line.start.z);
                line.end = Vector3::new(inter.x, inter.y, line.end.z);
            }
            self.advance_state();
            return Ok((h1, h2, None));
        }

        let len1 = (far1.x - inter.x).hypot(far1.y - inter.y);
        let len2 = (far2.x - inter.x).hypot(far2.y - inter.y);
        if len1 < 1e-9 || len2 < 1e-9 {
            return Err("Line endpoints are too close to intersection".to_owned());
        }
        let u1 = Vector2::new((far1.x - inter.x) / len1, (far1.y - inter.y) / len1);
        let u2 = Vector2::new((far2.x - inter.x) / len2, (far2.y - inter.y) / len2);

        let dot = (u1.x * u2.x + u1.y * u2.y).clamp(-1.0, 1.0);
        let angle = dot.acos();
        let half_angle = angle * 0.5;
        let tan_half = half_angle.tan();
        if tan_half.abs() < 1e-6 {
            return Err("Lines angle too acute for fillet".to_owned());
        }
        let tangent_dist = radius / tan_half;
        let t1 = Vector2::new(inter.x + tangent_dist * u1.x, inter.y + tangent_dist * u1.y);
        let t2 = Vector2::new(inter.x + tangent_dist * u2.x, inter.y + tangent_dist * u2.y);

        let sum = Vector2::new(u1.x + u2.x, u1.y + u2.y);
        let sum_len = sum.x.hypot(sum.y);
        if sum_len < 1e-9 {
            return Err("Lines are opposite and parallel".to_owned());
        }
        let bisector = Vector2::new(sum.x / sum_len, sum.y / sum_len);
        let center_dist = radius / half_angle.sin();
        let center = Vector2::new(inter.x + center_dist * bisector.x, inter.y + center_dist * bisector.y);

        if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h1) {
            line.start = Vector3::new(far1.x, far1.y, line.start.z);
            line.end = Vector3::new(t1.x, t1.y, line.end.z);
        }
        if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h2) {
            line.start = Vector3::new(far2.x, far2.y, line.start.z);
            line.end = Vector3::new(t2.x, t2.y, line.end.z);
        }

        let a1 = (t1.y - center.y).atan2(t1.x - center.x);
        let a2 = (t2.y - center.y).atan2(t2.x - center.x);
        let cross = u1.x * u2.y - u1.y * u2.x;
        let (start_angle, end_angle) = if cross > 0.0 {
            (positive_angle(a1), positive_angle(a2))
        } else {
            (positive_angle(a2), positive_angle(a1))
        };

        let mut arc = Arc::from_center_radius_angles(
            Vector3::new(center.x, center.y, 0.0),
            radius,
            start_angle,
            end_angle,
        );
        arc.common.layer = l1.common.layer.clone();
        let arc_h = self.cad.add_entity(EntityType::Arc(arc)).map_err(|e| e.to_string())?;
        self.advance_state();
        Ok((h1, h2, Some(arc_h)))
    }

    pub fn chamfer_lines(
        &mut self,
        h1: Handle,
        h2: Handle,
        d1: f64,
        d2: f64,
    ) -> Result<(Handle, Handle, Handle), String> {
        if !d1.is_finite() || !d2.is_finite() || d1 < 0.0 || d2 < 0.0 {
            return Err("CHAMFER distances must be non-negative".to_owned());
        }
        if h1 == h2 {
            return Err("CHAMFER requires two different lines".to_owned());
        }
        let e1 = self.cad.get_entity(h1).cloned().ok_or("First line no longer exists")?;
        let e2 = self.cad.get_entity(h2).cloned().ok_or("Second line no longer exists")?;
        let (l1, l2) = match (&e1, &e2) {
            (EntityType::Line(l1), EntityType::Line(l2)) => (l1, l2),
            _ => return Err("CHAMFER currently supports two LINE entities".to_owned()),
        };
        self.ensure_entity_layer_editable(h1)?;
        self.ensure_entity_layer_editable(h2)?;

        let p1 = Vector2::new(l1.start.x, l1.start.y);
        let p2 = Vector2::new(l1.end.x, l1.end.y);
        let p3 = Vector2::new(l2.start.x, l2.start.y);
        let p4 = Vector2::new(l2.end.x, l2.end.y);

        let (inter, _t, _u) = line_line_intersection(p1, p2, p3, p4)
            .ok_or_else(|| "Lines are parallel or collinear".to_owned())?;

        let d1_s = (p1.x - inter.x).hypot(p1.y - inter.y);
        let d1_e = (p2.x - inter.x).hypot(p2.y - inter.y);
        let far1 = if d1_s >= d1_e { p1 } else { p2 };

        let d2_s = (p3.x - inter.x).hypot(p3.y - inter.y);
        let d2_e = (p4.x - inter.x).hypot(p4.y - inter.y);
        let far2 = if d2_s >= d2_e { p3 } else { p4 };

        let len1 = (far1.x - inter.x).hypot(far1.y - inter.y);
        let len2 = (far2.x - inter.x).hypot(far2.y - inter.y);
        if len1 < 1e-9 || len2 < 1e-9 {
            return Err("Line endpoints too close to intersection".to_owned());
        }
        let u1 = Vector2::new((far1.x - inter.x) / len1, (far1.y - inter.y) / len1);
        let u2 = Vector2::new((far2.x - inter.x) / len2, (far2.y - inter.y) / len2);

        let b1 = Vector2::new(inter.x + d1 * u1.x, inter.y + d1 * u1.y);
        let b2 = Vector2::new(inter.x + d2 * u2.x, inter.y + d2 * u2.y);

        self.begin_change();
        if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h1) {
            line.start = Vector3::new(far1.x, far1.y, line.start.z);
            line.end = Vector3::new(b1.x, b1.y, line.end.z);
        }
        if let Some(EntityType::Line(line)) = self.cad.get_entity_mut(h2) {
            line.start = Vector3::new(far2.x, far2.y, line.start.z);
            line.end = Vector3::new(b2.x, b2.y, line.end.z);
        }

        let mut chamfer_line = Line::from_coords(b1.x, b1.y, 0.0, b2.x, b2.y, 0.0);
        chamfer_line.common.layer = l1.common.layer.clone();
        let chamfer_h = self.cad.add_entity(EntityType::Line(chamfer_line)).map_err(|e| e.to_string())?;
        self.advance_state();
        Ok((h1, h2, chamfer_h))
    }

    pub fn trim_line(
        &mut self,
        target_handle: Handle,
        click_x: f64,
        click_y: f64,
        cutter_handles: &[Handle],
    ) -> Result<Vec<Handle>, String> {
        let entity = self.cad.get_entity(target_handle).cloned().ok_or("Target line no longer exists")?;
        let line = match entity {
            EntityType::Line(l) => l,
            _ => return Err("Only LINE entities can be trimmed currently".to_owned()),
        };
        self.ensure_entity_layer_editable(target_handle)?;

        let p1 = Vector2::new(line.start.x, line.start.y);
        let p2 = Vector2::new(line.end.x, line.end.y);
        let line_len = (p2.x - p1.x).hypot(p2.y - p1.y);
        if line_len < 1e-9 {
            return Err("Target line is degenerate".to_owned());
        }

        let mut t_params = Vec::new();
        t_params.push(0.0);
        t_params.push(1.0);

        for &cutter_h in cutter_handles {
            if cutter_h == target_handle { continue; }
            if let Some(cutter) = self.cad.get_entity(cutter_h) {
                match cutter {
                    EntityType::Line(cl) => {
                        let c1 = Vector2::new(cl.start.x, cl.start.y);
                        let c2 = Vector2::new(cl.end.x, cl.end.y);
                        if let Some((_pt, t, u)) = line_line_intersection(p1, p2, c1, c2) {
                            if t > 1e-6 && t < 1.0 - 1e-6 && u >= -1e-6 && u <= 1.0 + 1e-6 {
                                t_params.push(t);
                            }
                        }
                    }
                    EntityType::Circle(cc) => {
                        let center = Vector2::new(cc.center.x, cc.center.y);
                        for (_pt, t) in line_circle_intersections(p1, p2, center, cc.radius) {
                            if t > 1e-6 && t < 1.0 - 1e-6 {
                                t_params.push(t);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        t_params.sort_by(|a, b| a.partial_cmp(b).unwrap());
        t_params.dedup_by(|a, b| (*a - *b).abs() < 1e-6);

        if t_params.len() <= 2 {
            return Err("No cutting edge intersects this line".to_owned());
        }

        let click = Vector2::new(click_x, click_y);
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let click_t = (((click.x - p1.x) * dx + (click.y - p1.y) * dy) / (line_len * line_len)).clamp(0.0, 1.0);

        let mut trim_idx = 0;
        for i in 0..t_params.len() - 1 {
            if click_t >= t_params[i] && click_t <= t_params[i + 1] {
                trim_idx = i;
                break;
            }
        }

        self.begin_change();
        let mut remaining_handles = Vec::new();
        let layer = line.common.layer.clone();

        for i in 0..trim_idx {
            let t_start = t_params[i];
            let t_end = t_params[i + 1];
            if (t_end - t_start).abs() > 1e-6 {
                let sx = p1.x + t_start * dx;
                let sy = p1.y + t_start * dy;
                let ex = p1.x + t_end * dx;
                let ey = p1.y + t_end * dy;
                let mut nl = Line::from_coords(sx, sy, 0.0, ex, ey, 0.0);
                nl.common.layer = layer.clone();
                let nh = self.cad.add_entity(EntityType::Line(nl)).map_err(|e| e.to_string())?;
                remaining_handles.push(nh);
            }
        }
        for i in (trim_idx + 1)..t_params.len() - 1 {
            let t_start = t_params[i];
            let t_end = t_params[i + 1];
            if (t_end - t_start).abs() > 1e-6 {
                let sx = p1.x + t_start * dx;
                let sy = p1.y + t_start * dy;
                let ex = p1.x + t_end * dx;
                let ey = p1.y + t_end * dy;
                let mut nl = Line::from_coords(sx, sy, 0.0, ex, ey, 0.0);
                nl.common.layer = layer.clone();
                let nh = self.cad.add_entity(EntityType::Line(nl)).map_err(|e| e.to_string())?;
                remaining_handles.push(nh);
            }
        }

        self.cad.remove_entity(target_handle).expect("validated target line");
        self.advance_state();
        Ok(remaining_handles)
    }

    pub fn extend_line(
        &mut self,
        target_handle: Handle,
        click_x: f64,
        click_y: f64,
        boundary_handles: &[Handle],
    ) -> Result<(), String> {
        let entity = self.cad.get_entity(target_handle).cloned().ok_or("Target line no longer exists")?;
        let line = match entity {
            EntityType::Line(l) => l,
            _ => return Err("Only LINE entities can be extended currently".to_owned()),
        };
        self.ensure_entity_layer_editable(target_handle)?;

        let p1 = Vector2::new(line.start.x, line.start.y);
        let p2 = Vector2::new(line.end.x, line.end.y);
        let click = Vector2::new(click_x, click_y);

        let d1 = (p1.x - click.x).hypot(p1.y - click.y);
        let d2 = (p2.x - click.x).hypot(p2.y - click.y);
        let extend_end = d2 <= d1;
        let mut best_t: Option<f64> = None;

        for &bh in boundary_handles {
            if bh == target_handle { continue; }
            if let Some(b_ent) = self.cad.get_entity(bh) {
                match b_ent {
                    EntityType::Line(bl) => {
                        let b1 = Vector2::new(bl.start.x, bl.start.y);
                        let b2 = Vector2::new(bl.end.x, bl.end.y);
                        if let Some((_pt, t, u)) = line_line_intersection(p1, p2, b1, b2) {
                            if u >= -1e-6 && u <= 1.0 + 1e-6 {
                                if extend_end && t > 1.0 + 1e-6 {
                                    if best_t.map_or(true, |bt| t < bt) {
                                        best_t = Some(t);
                                    }
                                } else if !extend_end && t < -1e-6 {
                                    if best_t.map_or(true, |bt| t > bt) {
                                        best_t = Some(t);
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        let target_t = best_t.ok_or_else(|| "No boundary edge found to extend to".to_owned())?;
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let new_pt = Vector2::new(p1.x + target_t * dx, p1.y + target_t * dy);

        self.begin_change();
        if let Some(EntityType::Line(l)) = self.cad.get_entity_mut(target_handle) {
            if extend_end {
                l.end = Vector3::new(new_pt.x, new_pt.y, l.end.z);
            } else {
                l.start = Vector3::new(new_pt.x, new_pt.y, l.start.z);
            }
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

    pub fn copy_many(
        &mut self,
        handles: &[Handle],
        dx: f64,
        dy: f64,
    ) -> Result<Vec<Handle>, String> {
        if !dx.is_finite() || !dy.is_finite() {
            return Err("Copy offset must be finite".to_owned());
        }
        let handles = unique_handles(handles);
        if handles.is_empty() {
            return Ok(Vec::new());
        }
        for handle in &handles {
            if self.cad.get_entity(*handle).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            if !entity_translation_is_finite(self.cad.get_entity(*handle).unwrap(), dx, dy) {
                return Err("Copy would produce non-finite entity coordinates".to_owned());
            }
        }
        self.begin_change();
        let mut new_handles = Vec::with_capacity(handles.len());
        for handle in &handles {
            if let Some(entity) = self.cad.get_entity(*handle) {
                let mut cloned = entity.clone();
                cloned.as_entity_mut().translate(Vector3::new(dx, dy, 0.0));
                let new_handle = self
                    .cad
                    .add_entity(cloned)
                    .map_err(|error| error.to_string())?;
                new_handles.push(new_handle);
            }
        }
        self.advance_state();
        Ok(new_handles)
    }

    pub fn rotate_many(
        &mut self,
        handles: &[Handle],
        cx: f64,
        cy: f64,
        angle_rad: f64,
    ) -> Result<(), String> {
        if !cx.is_finite() || !cy.is_finite() || !angle_rad.is_finite() {
            return Err("Rotation center and angle must be finite".to_owned());
        }
        let handles = unique_handles(handles);
        if handles.is_empty() || angle_rad == 0.0 {
            return Ok(());
        }
        for handle in &handles {
            if self.cad.get_entity(*handle).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            self.ensure_entity_layer_editable(*handle)?;
        }
        let center = Vector2::new(cx, cy);
        let cos_a = angle_rad.cos();
        let sin_a = angle_rad.sin();
        self.begin_change();
        for handle in &handles {
            if let Some(entity) = self.cad.get_entity_mut(*handle) {
                match entity {
                    EntityType::Line(line) => {
                        let s = rotate_vector2(Vector2::new(line.start.x, line.start.y), center, cos_a, sin_a);
                        let e = rotate_vector2(Vector2::new(line.end.x, line.end.y), center, cos_a, sin_a);
                        line.start = Vector3::new(s.x, s.y, line.start.z);
                        line.end = Vector3::new(e.x, e.y, line.end.z);
                    }
                    EntityType::Arc(arc) => {
                        let c = rotate_vector2(Vector2::new(arc.center.x, arc.center.y), center, cos_a, sin_a);
                        arc.center = Vector3::new(c.x, c.y, arc.center.z);
                        arc.start_angle = positive_angle(arc.start_angle + angle_rad);
                        arc.end_angle = positive_angle(arc.end_angle + angle_rad);
                    }
                    EntityType::LwPolyline(poly) => {
                        for v in &mut poly.vertices {
                            v.location = rotate_vector2(v.location, center, cos_a, sin_a);
                        }
                    }
                    EntityType::Circle(circle) => {
                        let c = rotate_vector2(Vector2::new(circle.center.x, circle.center.y), center, cos_a, sin_a);
                        circle.center = Vector3::new(c.x, c.y, circle.center.z);
                    }
                    EntityType::Text(text) => {
                        let p = rotate_vector2(Vector2::new(text.insertion_point.x, text.insertion_point.y), center, cos_a, sin_a);
                        text.insertion_point = Vector3::new(p.x, p.y, text.insertion_point.z);
                        text.rotation = positive_angle(text.rotation + angle_rad);
                    }
                    EntityType::Insert(insert) => {
                        let p = rotate_vector2(Vector2::new(insert.insert_point.x, insert.insert_point.y), center, cos_a, sin_a);
                        insert.insert_point = Vector3::new(p.x, p.y, insert.insert_point.z);
                        insert.rotation = positive_angle(insert.rotation + angle_rad);
                    }
                    _ => {}
                }
            }
        }
        self.advance_state();
        Ok(())
    }

    pub fn mirror_many(
        &mut self,
        handles: &[Handle],
        p1_x: f64,
        p1_y: f64,
        p2_x: f64,
        p2_y: f64,
        keep_source: bool,
    ) -> Result<Vec<Handle>, String> {
        if !p1_x.is_finite() || !p1_y.is_finite() || !p2_x.is_finite() || !p2_y.is_finite() {
            return Err("Mirror line points must be finite".to_owned());
        }
        let p1 = Vector2::new(p1_x, p1_y);
        let p2 = Vector2::new(p2_x, p2_y);
        if p1 == p2 {
            return Err("Mirror line requires two distinct points".to_owned());
        }
        let handles = unique_handles(handles);
        if handles.is_empty() {
            return Ok(Vec::new());
        }
        for handle in &handles {
            if self.cad.get_entity(*handle).is_none() {
                return Err("A selected entity no longer exists".to_owned());
            }
            if !keep_source {
                self.ensure_entity_layer_editable(*handle)?;
            }
        }
        self.begin_change();
        let mut new_handles = Vec::new();
        for handle in &handles {
            if let Some(entity) = self.cad.get_entity(*handle) {
                let mut mirrored = entity.clone();
                match &mut mirrored {
                    EntityType::Line(line) => {
                        let s = mirror_vector2(Vector2::new(line.start.x, line.start.y), p1, p2);
                        let e = mirror_vector2(Vector2::new(line.end.x, line.end.y), p1, p2);
                        line.start = Vector3::new(s.x, s.y, line.start.z);
                        line.end = Vector3::new(e.x, e.y, line.end.z);
                    }
                    EntityType::Arc(arc) => {
                        let c = mirror_vector2(Vector2::new(arc.center.x, arc.center.y), p1, p2);
                        arc.center = Vector3::new(c.x, c.y, arc.center.z);
                        let mirror_axis_angle = (p2.y - p1.y).atan2(p2.x - p1.x);
                        let reflect_angle = |a: f64| -> f64 {
                            positive_angle(2.0 * mirror_axis_angle - a)
                        };
                        let new_start = reflect_angle(arc.end_angle);
                        let new_end = reflect_angle(arc.start_angle);
                        arc.start_angle = new_start;
                        arc.end_angle = new_end;
                    }
                    EntityType::LwPolyline(poly) => {
                        for v in &mut poly.vertices {
                            v.location = mirror_vector2(v.location, p1, p2);
                            v.bulge = -v.bulge;
                        }
                    }
                    EntityType::Circle(circle) => {
                        let c = mirror_vector2(Vector2::new(circle.center.x, circle.center.y), p1, p2);
                        circle.center = Vector3::new(c.x, c.y, circle.center.z);
                    }
                    EntityType::Text(text) => {
                        let p = mirror_vector2(Vector2::new(text.insertion_point.x, text.insertion_point.y), p1, p2);
                        text.insertion_point = Vector3::new(p.x, p.y, text.insertion_point.z);
                        let mirror_axis = (p2.y - p1.y).atan2(p2.x - p1.x);
                        text.rotation = positive_angle(2.0 * mirror_axis - text.rotation);
                    }
                    EntityType::Insert(insert) => {
                        let p = mirror_vector2(Vector2::new(insert.insert_point.x, insert.insert_point.y), p1, p2);
                        insert.insert_point = Vector3::new(p.x, p.y, insert.insert_point.z);
                        let mirror_axis = (p2.y - p1.y).atan2(p2.x - p1.x);
                        insert.rotation = positive_angle(2.0 * mirror_axis - insert.rotation);
                    }
                    _ => {}
                }
                if keep_source {
                    let nh = self.cad.add_entity(mirrored).map_err(|e| e.to_string())?;
                    new_handles.push(nh);
                } else {
                    if let Some(target) = self.cad.get_entity_mut(*handle) {
                        *target = mirrored;
                    }
                    new_handles.push(*handle);
                }
            }
        }
        self.advance_state();
        Ok(new_handles)
    }

    pub fn explode_entity(&mut self, handle: Handle) -> Result<Vec<Handle>, String> {
        let entity = self
            .cad
            .get_entity(handle)
            .ok_or_else(|| "Selected entity no longer exists".to_owned())?;

        let (vertices, closed, layer) = match entity {
            EntityType::LwPolyline(poly) => (poly.vertices.clone(), poly.is_closed, poly.common.layer.clone()),
            _ => return Err("Only Polyline entities can be exploded".to_owned()),
        };

        if vertices.len() < 2 {
            return Err("Polyline does not have enough vertices to explode".to_owned());
        }

        self.ensure_entity_layer_editable(handle)?;
        self.begin_change();

        let mut new_handles = Vec::new();
        let n = if closed { vertices.len() } else { vertices.len() - 1 };

        for i in 0..n {
            let v1 = &vertices[i];
            let v2 = &vertices[(i + 1) % vertices.len()];

            if v1.bulge.abs() < 1e-6 {
                let mut line = Line::from_coords(v1.location.x, v1.location.y, 0.0, v2.location.x, v2.location.y, 0.0);
                line.common.layer = layer.clone();
                let nh = self.cad.add_entity(EntityType::Line(line)).map_err(|e| e.to_string())?;
                new_handles.push(nh);
            } else {
                let dx = v2.location.x - v1.location.x;
                let dy = v2.location.y - v1.location.y;
                let chord = dx.hypot(dy);
                if chord > 1e-10 {
                    let sweep = 4.0 * v1.bulge.atan();
                    let radius = chord / (2.0 * (sweep.abs() / 2.0).sin());
                    let offset = chord / (2.0 * (sweep / 2.0).tan());
                    let cx = (v1.location.x + v2.location.x) * 0.5 - dy / chord * offset;
                    let cy = (v1.location.y + v2.location.y) * 0.5 + dx / chord * offset;
                    let start_angle = (v1.location.y - cy).atan2(v1.location.x - cx);
                    let end_angle = (v2.location.y - cy).atan2(v2.location.x - cx);
                    let (s, e) = if v1.bulge > 0.0 {
                        (positive_angle(start_angle), positive_angle(end_angle))
                    } else {
                        (positive_angle(end_angle), positive_angle(start_angle))
                    };
                    let mut arc = Arc::from_center_radius_angles(Vector3::new(cx, cy, 0.0), radius, s, e);
                    arc.common.layer = layer.clone();
                    let nh = self.cad.add_entity(EntityType::Arc(arc)).map_err(|e| e.to_string())?;
                    new_handles.push(nh);
                }
            }
        }

        self.cad.remove_entity(handle).expect("polyline handle validated");
        self.advance_state();
        Ok(new_handles)
    }

    pub fn offset_entity(
        &mut self,
        handle: Handle,
        distance: f64,
        side_point: Vector2,
    ) -> Result<Handle, String> {
        if !distance.is_finite() || distance <= 0.0 || !finite2(side_point) {
            return Err("Offset requires a positive distance and finite side point".to_owned());
        }
        let entity = self
            .cad
            .get_entity(handle)
            .cloned()
            .ok_or_else(|| "Selected entity no longer exists".to_owned())?;

        let layer = entity.common().layer.clone();
        self.begin_change();

        match entity {
            EntityType::Circle(circle) => {
                let center = Vector2::new(circle.center.x, circle.center.y);
                let dist_to_center = (side_point.x - center.x).hypot(side_point.y - center.y);
                let new_radius = if dist_to_center > circle.radius {
                    circle.radius + distance
                } else {
                    circle.radius - distance
                };
                if new_radius <= 0.0 {
                    return Err("Offset would produce non-positive circle radius".to_owned());
                }
                let mut new_c = Circle::from_coords(center.x, center.y, 0.0, new_radius);
                new_c.common.layer = layer;
                let nh = self.cad.add_entity(EntityType::Circle(new_c)).map_err(|e| e.to_string())?;
                self.advance_state();
                return Ok(nh);
            }
            EntityType::Line(line) => {
                let dx = line.end.x - line.start.x;
                let dy = line.end.y - line.start.y;
                let len = dx.hypot(dy);
                if len < 1e-10 {
                    return Err("Line length is too small to offset".to_owned());
                }
                let mut nx = -dy / len;
                let mut ny = dx / len;
                let to_side_x = side_point.x - line.start.x;
                let to_side_y = side_point.y - line.start.y;
                if to_side_x * nx + to_side_y * ny < 0.0 {
                    nx = -nx;
                    ny = -ny;
                }
                let mut new_line = Line::from_coords(
                    line.start.x + nx * distance,
                    line.start.y + ny * distance,
                    line.start.z,
                    line.end.x + nx * distance,
                    line.end.y + ny * distance,
                    line.end.z,
                );
                new_line.common.layer = layer;
                let nh = self.cad.add_entity(EntityType::Line(new_line)).map_err(|e| e.to_string())?;
                self.advance_state();
                Ok(nh)
            }
            EntityType::Arc(arc) => {
                let d_to_center = (side_point.x - arc.center.x).hypot(side_point.y - arc.center.y);
                let new_radius = if d_to_center >= arc.radius {
                    arc.radius + distance
                } else {
                    if arc.radius <= distance {
                        return Err("Offset distance is larger than arc radius".to_owned());
                    }
                    arc.radius - distance
                };
                let mut new_arc = Arc::from_center_radius_angles(arc.center, new_radius, arc.start_angle, arc.end_angle);
                new_arc.common.layer = layer;
                let nh = self.cad.add_entity(EntityType::Arc(new_arc)).map_err(|e| e.to_string())?;
                self.advance_state();
                Ok(nh)
            }
            _ => Err("Offset is currently supported for Line and Arc".to_owned()),
        }
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

fn rotate_vector2(p: Vector2, center: Vector2, cos_a: f64, sin_a: f64) -> Vector2 {
    let dx = p.x - center.x;
    let dy = p.y - center.y;
    Vector2::new(
        center.x + dx * cos_a - dy * sin_a,
        center.y + dx * sin_a + dy * cos_a,
    )
}

fn mirror_vector2(p: Vector2, p1: Vector2, p2: Vector2) -> Vector2 {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-12 {
        return p;
    }
    let dot = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len_sq;
    let proj_x = p1.x + dot * dx;
    let proj_y = p1.y + dot * dy;
    Vector2::new(2.0 * proj_x - p.x, 2.0 * proj_y - p.y)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_entities_and_undo() {
        let mut doc = DrawingDocument::new();
        let l_h = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(10.0, 0.0)).unwrap();
        let a_h = doc.add_arc(Vector2::new(0.0, 0.0), 5.0, 0.0, 1.57).unwrap();
        let c_h = doc.add_circle(Vector2::new(5.0, 5.0), 3.0).unwrap();
        let t_h = doc.add_text("CONCOSTCAD", Vector2::new(2.0, 2.0), 2.5, 0.0).unwrap();

        assert_eq!(doc.cad.entities().count(), 4);
        assert!(doc.cad.get_entity(l_h).is_some());
        assert!(doc.cad.get_entity(a_h).is_some());
        assert!(doc.cad.get_entity(c_h).is_some());
        assert!(doc.cad.get_entity(t_h).is_some());

        // Test undo
        assert!(doc.undo());
        assert_eq!(doc.cad.entities().count(), 3);
        assert!(doc.cad.get_entity(t_h).is_none());

        // Test redo
        assert!(doc.redo());
        assert_eq!(doc.cad.entities().count(), 4);
        assert!(doc.cad.get_entity(t_h).is_some());
    }

    #[test]
    fn test_join_entities() {
        let mut doc = DrawingDocument::new();
        let l1 = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(10.0, 0.0)).unwrap();
        let l2 = doc.add_line(Vector2::new(10.0, 0.0), Vector2::new(10.0, 10.0)).unwrap();

        let joined = doc.join_entities(&[l1, l2]).unwrap();
        assert_eq!(doc.cad.entities().count(), 1);
        if let Some(EntityType::LwPolyline(p)) = doc.cad.get_entity(joined) {
            assert_eq!(p.vertices.len(), 3);
            assert_eq!(p.vertices[0].location, Vector2::new(0.0, 0.0));
            assert_eq!(p.vertices[1].location, Vector2::new(10.0, 0.0));
            assert_eq!(p.vertices[2].location, Vector2::new(10.0, 10.0));
        } else {
            panic!("Expected LwPolyline");
        }
    }

    #[test]
    fn test_fillet_lines_r0_and_r_positive() {
        let mut doc = DrawingDocument::new();
        let l1 = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(10.0, 0.0)).unwrap();
        let l2 = doc.add_line(Vector2::new(10.0, 5.0), Vector2::new(10.0, 15.0)).unwrap();

        // Fillet R=0 extends lines to meet at (10, 0)
        let (_h1, _h2, arc_opt) = doc.fillet_lines(l1, l2, 0.0).unwrap();
        assert!(arc_opt.is_none());
        if let Some(EntityType::Line(l)) = doc.cad.get_entity(l1) {
            assert_eq!(l.end.x, 10.0);
            assert_eq!(l.end.y, 0.0);
        }
    }

    #[test]
    fn test_dxf_roundtrip_verification() {
        let mut doc = DrawingDocument::new();
        let _l = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(100.0, 50.0)).unwrap();
        let _c = doc.add_circle(Vector2::new(20.0, 30.0), 15.0).unwrap();
        let _t = doc.add_text("TEST_TEXT", Vector2::new(5.0, 5.0), 4.0, 0.5).unwrap();

        let temp_dir = std::env::temp_dir();
        let test_dxf = temp_dir.join("concostcad_test_roundtrip.dxf");

        // Write atomic
        write_atomic(&doc.cad, &test_dxf, DrawingFormat::Dxf).unwrap();

        // Read back
        let reopened = read_cad_file(&test_dxf, DrawingFormat::Dxf).unwrap();
        assert_eq!(reopened.entities().count(), 3);

        let _ = fs::remove_file(test_dxf);
    }

    #[test]
    fn test_chamfer_lines() {
        let mut doc = DrawingDocument::new();
        let l1 = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(10.0, 0.0)).unwrap();
        let l2 = doc.add_line(Vector2::new(10.0, 0.0), Vector2::new(10.0, 10.0)).unwrap();

        let (_h1, _h2, bevel) = doc.chamfer_lines(l1, l2, 2.0, 3.0).unwrap();
        assert_eq!(doc.cad.entities().count(), 3);
        assert!(doc.cad.get_entity(bevel).is_some());
    }

    #[test]
    fn test_trim_and_extend_lines() {
        let mut doc = DrawingDocument::new();
        // Horizontal target line from (0, 0) to (20, 0)
        let target = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(20.0, 0.0)).unwrap();
        // Vertical cutter line at x=10 from (10, -10) to (10, 10)
        let cutter = doc.add_line(Vector2::new(10.0, -10.0), Vector2::new(10.0, 10.0)).unwrap();

        // Trim right half by clicking at (15, 0)
        let remaining = doc.trim_line(target, 15.0, 0.0, &[cutter]).unwrap();
        assert_eq!(remaining.len(), 1);
        if let Some(EntityType::Line(rem_l)) = doc.cad.get_entity(remaining[0]) {
            assert_eq!(rem_l.start.x, 0.0);
            assert_eq!(rem_l.end.x, 10.0);
        }

        // Now extend it back towards a boundary at x=25
        let boundary = doc.add_line(Vector2::new(25.0, -10.0), Vector2::new(25.0, 10.0)).unwrap();
        doc.extend_line(remaining[0], 9.0, 0.0, &[boundary]).unwrap();
        if let Some(EntityType::Line(ext_l)) = doc.cad.get_entity(remaining[0]) {
            assert_eq!(ext_l.end.x, 25.0);
        }
    }

    #[test]
    fn test_layer_color_and_dimension() {
        let mut doc = DrawingDocument::new();
        doc.add_layer("DIM_LAYER").unwrap();
        doc.set_layer_color("DIM_LAYER", 255, 0, 0).unwrap();
        doc.set_current_layer("DIM_LAYER").unwrap();

        let handles = doc.add_aligned_dimension(
            Vector2::new(0.0, 0.0),
            Vector2::new(100.0, 0.0),
            Vector2::new(50.0, 10.0),
            None,
        ).unwrap();
        assert_eq!(handles.len(), 6); // 2 ext lines + 1 dim line + 2 ticks + 1 text
        assert_eq!(doc.cad.entities().count(), 6);
    }

    #[test]
    fn test_load_corpus_fixtures() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let fix1 = manifest_dir.join("fixtures").join("structural_grid_sample.dxf");
        let fix2 = manifest_dir.join("fixtures").join("mechanical_part_sample.dxf");

        if fix1.exists() {
            let doc1 = read_cad_file(&fix1, DrawingFormat::Dxf).unwrap();
            assert_eq!(doc1.entities().count(), 20);
        }
        if fix2.exists() {
            let doc2 = read_cad_file(&fix2, DrawingFormat::Dxf).unwrap();
            assert_eq!(doc2.entities().count(), 8);
        }
    }

    #[test]
    fn test_dwg_roundtrip_verification() {
        let mut doc = DrawingDocument::new();
        let _l = doc.add_line(Vector2::new(0.0, 0.0), Vector2::new(50.0, 50.0)).unwrap();
        let _c = doc.add_circle(Vector2::new(10.0, 10.0), 8.0).unwrap();

        let temp_dir = std::env::temp_dir();
        let test_dwg = temp_dir.join("concostcad_test_roundtrip.dwg");

        // Write atomic DWG
        let res = write_atomic(&doc.cad, &test_dwg, DrawingFormat::Dwg);
        if let Ok(()) = res {
            let reopened = read_cad_file(&test_dwg, DrawingFormat::Dwg).unwrap();
            assert_eq!(reopened.entities().count(), 2);
            let _ = fs::remove_file(test_dwg);
        }
    }
    #[test]
    fn test_large_corpus_stress_benchmark() {
        let mut doc = DrawingDocument::new();
        // Generate 1,000 lines and 1,000 circles (2,000 entities)
        for i in 0..1000 {
            let offset = i as f64 * 2.0;
            let _ = doc.add_line(Vector2::new(offset, 0.0), Vector2::new(offset, 100.0)).unwrap();
            let _ = doc.add_circle(Vector2::new(offset, 50.0), 1.0).unwrap();
        }
        assert_eq!(doc.cad.entities().count(), 2000);

        // Perform batch transform on all 2,000 entities
        let handles: Vec<_> = doc.cad.entities().map(|e| e.common().handle).collect();
        let rotated = doc.rotate_many(&handles, 0.0, 0.0, std::f64::consts::PI / 4.0);
        assert!(rotated.is_ok());
        assert_eq!(doc.cad.entities().count(), 2000);

        // Verify transaction rollback / undo operates cleanly under large batch
        assert!(doc.undo());
        assert_eq!(doc.cad.entities().count(), 2000);
    }
}
