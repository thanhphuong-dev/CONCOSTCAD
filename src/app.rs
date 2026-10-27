use crate::document::DrawingDocument;
use crate::geometry::{Arc2, Point2};
use acadrust::entities::{EntityType, LwVertex};
use acadrust::types::{Handle, Vector2, Vector3};
use eframe::egui::{self, Align, Color32, Id, Layout, Pos2, Rect, Sense, Stroke, Vec2, WidgetText};
use egui_dock::{DockArea, DockState, NodeIndex, Style, TabViewer};
use std::collections::HashSet;
use std::sync::mpsc::{self, Receiver};

const APP_BG: Color32 = Color32::from_rgb(27, 30, 35);
const PANEL_BG: Color32 = Color32::from_rgb(36, 40, 46);
const RIBBON_BG: Color32 = Color32::from_rgb(42, 47, 54);
const CANVAS_BG: Color32 = Color32::from_rgb(20, 23, 27);
const ACCENT: Color32 = Color32::from_rgb(49, 167, 196);
const TEXT: Color32 = Color32::from_rgb(224, 228, 232);
const MUTED: Color32 = Color32::from_rgb(147, 157, 168);
const GRID: Color32 = Color32::from_rgb(42, 48, 55);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Tool {
    Select,
    Line,
    Arc,
    Polyline,
    Move,
}

impl Tool {
    fn name(self) -> &'static str {
        match self {
            Self::Select => "Select",
            Self::Line => "LINE",
            Self::Arc => "ARC · 3 point",
            Self::Polyline => "PLINE",
            Self::Move => "MOVE",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RibbonTab {
    Home,
    Draw,
    Annotate,
    View,
}

impl RibbonTab {
    const ALL: [Self; 4] = [Self::Home, Self::Draw, Self::Annotate, Self::View];

    fn label(self) -> &'static str {
        match self {
            Self::Home => "Home",
            Self::Draw => "Draw",
            Self::Annotate => "Annotate",
            Self::View => "View",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum WorkspaceTab {
    Drawing,
    Properties,
    Layers,
}

pub struct CadApp {
    dock_state: DockState<WorkspaceTab>,
    ribbon_tab: RibbonTab,
    tool: Tool,
    drawing: DrawingDocument,
    selection: Vec<Handle>,
    selection_drag_start: Option<Pos2>,
    property_draft: Option<(Handle, u64, PropertyDraft)>,
    new_layer_name: String,
    selected_layer: String,
    rename_layer_name: String,
    pending_points: Vec<Point2>,
    pending_bulges: Vec<f64>,
    command_line: String,
    status: String,
    confirm_new: bool,
    confirm_open: bool,
    pending_open_path: Option<std::path::PathBuf>,
    open_receiver: Option<Receiver<Result<(std::path::PathBuf, DrawingDocument), String>>>,
    save_receiver: Option<Receiver<(u64, u64, std::path::PathBuf, Result<(), String>)>>,
    zoom: f32,
    world_center: Point2,
    cursor_world: Point2,
    snap_enabled: bool,
    snap_cache: SnapCache,
    ortho_enabled: bool,
}

impl CadApp {
    pub fn new(context: &eframe::CreationContext<'_>) -> Self {
        apply_theme(&context.egui_ctx);

        let mut dock_state = DockState::new(vec![WorkspaceTab::Drawing]);
        let surface = dock_state.main_surface_mut();
        let [_, properties] =
            surface.split_right(NodeIndex::root(), 0.76, vec![WorkspaceTab::Properties]);
        surface.split_below(properties, 0.55, vec![WorkspaceTab::Layers]);

        Self {
            dock_state,
            ribbon_tab: RibbonTab::Home,
            tool: Tool::Select,
            drawing: DrawingDocument::new(),
            selection: Vec::new(),
            selection_drag_start: None,
            property_draft: None,
            new_layer_name: String::new(),
            selected_layer: String::new(),
            rename_layer_name: String::new(),
            pending_points: Vec::new(),
            pending_bulges: Vec::new(),
            command_line: String::new(),
            status: "Ready · New drawing".to_owned(),
            confirm_new: false,
            confirm_open: false,
            pending_open_path: None,
            open_receiver: None,
            save_receiver: None,
            zoom: 40.0,
            world_center: Point2::default(),
            cursor_world: Point2::default(),
            snap_enabled: true,
            snap_cache: SnapCache::default(),
            ortho_enabled: false,
        }
    }

    fn set_tool(&mut self, tool: Tool) {
        self.tool = tool;
        self.pending_points.clear();
        self.pending_bulges.clear();
        self.status = match tool {
            Tool::Select => "Select geometry".to_owned(),
            Tool::Line => "LINE · Pick first point".to_owned(),
            Tool::Arc => "ARC · Pick start, point on arc, then end".to_owned(),
            Tool::Polyline => "PLINE · Pick vertices; press Enter to finish".to_owned(),
            Tool::Move => "MOVE · Pick base point".to_owned(),
        };
    }

    fn open_dialog(&mut self) {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("CAD drawings", &["dwg", "dxf"])
            .pick_file()
        else {
            return;
        };
        if self.drawing.dirty() {
            self.pending_open_path = Some(path);
            self.confirm_open = true;
            return;
        }
        self.load_path(path);
    }

    fn load_path(&mut self, path: std::path::PathBuf) {
        let (sender, receiver) = mpsc::channel();
        self.open_receiver = Some(receiver);
        self.status = format!("Opening {}…", path.display());
        std::thread::spawn(move || {
            let result = DrawingDocument::open(&path).map(|doc| (path, doc));
            let _ = sender.send(result);
        });
    }

    fn poll_open(&mut self, ctx: &egui::Context) {
        let result = self
            .open_receiver
            .as_ref()
            .and_then(|receiver| receiver.try_recv().ok());
        if let Some(result) = result {
            self.open_receiver = None;
            match result {
                Ok((path, drawing)) => {
                    let count = drawing.entity_count();
                    self.drawing = drawing;
                    self.selection.clear();
                    self.pending_points.clear();
                    self.pending_bulges.clear();
                    self.status =
                        format!("Opened {} · {count} model-space entities", path.display());
                }
                Err(error) => self.status = format!("Open failed: {error}"),
            }
        } else if self.open_receiver.is_some() {
            ctx.request_repaint_after(std::time::Duration::from_millis(100));
        }
    }

    fn save_dialog(&mut self) {
        if self.save_receiver.is_some() {
            self.status = "Save already in progress".to_owned();
            return;
        }
        let path = self
            .drawing
            .path()
            .map(|path| path.to_path_buf())
            .or_else(|| {
                rfd::FileDialog::new()
                    .add_filter("DWG drawing", &["dwg"])
                    .add_filter("DXF drawing", &["dxf"])
                    .save_file()
            });
        if let Some(path) = path {
            let mut snapshot = self.drawing.save_snapshot();
            let document_id = snapshot.id();
            let state_id = snapshot.state_id();
            let (sender, receiver) = mpsc::channel();
            self.save_receiver = Some(receiver);
            self.status = format!("Saving {}…", path.display());
            std::thread::spawn(move || {
                let result = snapshot.save(&path).map(|_| ());
                let _ = sender.send((document_id, state_id, path, result));
            });
        }
    }

    fn poll_save(&mut self, ctx: &egui::Context) {
        let result = self
            .save_receiver
            .as_ref()
            .and_then(|receiver| receiver.try_recv().ok());
        if let Some((document_id, state_id, path, result)) = result {
            self.save_receiver = None;
            match result {
                Ok(()) if self.drawing.id() == document_id => {
                    match self.drawing.complete_save(path.clone(), state_id) {
                        Ok(()) => {
                            self.status = format!(
                                "Saved {}{}",
                                path.display(),
                                if self.drawing.dirty() {
                                    " · newer edits remain unsaved"
                                } else {
                                    ""
                                }
                            )
                        }
                        Err(error) => self.status = format!("Save completion failed: {error}"),
                    }
                }
                Ok(()) => self.status = format!("Saved previous drawing to {}", path.display()),
                Err(error) => self.status = format!("Save failed: {error}"),
            }
        } else if self.save_receiver.is_some() {
            ctx.request_repaint_after(std::time::Duration::from_millis(100));
        }
    }

    fn choose_file_command(&mut self, command: &str) {
        match command {
            "Open" => self.open_dialog(),
            "Save" => self.save_dialog(),
            _ => {}
        }
    }

    fn execute_command_line(&mut self) {
        let raw = self.command_line.trim().to_owned();
        let command = raw.to_ascii_uppercase();
        self.command_line.clear();
        if self.tool == Tool::Polyline {
            if let Some(value) = command.strip_prefix("CLOSE,B=") {
                match value.parse::<f64>() {
                    Ok(bulge) if bulge.is_finite() && bulge.abs() <= 1.0e6 => {
                        if let Some(last) = self.pending_bulges.last_mut() {
                            *last = bulge;
                            self.finish_polyline(true);
                        } else {
                            self.status = "Add Polyline vertices before closing".to_owned();
                        }
                    }
                    _ => self.status = "Closing bulge must be finite with magnitude at most 1000000".to_owned(),
                }
                return;
            }
        }
        if self.tool != Tool::Select {
            if self.tool == Tool::Polyline {
                match parse_polyline_coordinate(
                    &raw,
                    self.pending_points
                        .last()
                        .copied()
                        .unwrap_or(self.cursor_world),
                ) {
                    Ok(Some((point, bulge))) => {
                        if !self.pending_points.is_empty() {
                            if let Some(last) = self.pending_bulges.last_mut() {
                                *last = bulge;
                            }
                        }
                        handle_point(
                            &mut self.tool,
                            &mut self.drawing,
                            &mut self.selection,
                            &mut self.pending_points,
                            &mut self.pending_bulges,
                            &mut self.status,
                            point,
                            self.ortho_enabled,
                            1.0,
                        );
                        return;
                    }
                    Err(error) => {
                        self.status = error;
                        return;
                    }
                    Ok(None) => {}
                }
            }
            match parse_coordinate(
                &raw,
                self.pending_points
                    .last()
                    .copied()
                    .unwrap_or(self.cursor_world),
            ) {
                Ok(Some(point)) => {
                    handle_point(
                        &mut self.tool,
                        &mut self.drawing,
                        &mut self.selection,
                        &mut self.pending_points,
                        &mut self.pending_bulges,
                        &mut self.status,
                        point,
                        self.ortho_enabled,
                        1.0,
                    );
                    return;
                }
                Err(error) => {
                    self.status = error;
                    return;
                }
                Ok(None) => {}
            }
        }
        match command.as_str() {
            "L" | "LINE" => self.set_tool(Tool::Line),
            "A" | "ARC" => self.set_tool(Tool::Arc),
            "PL" | "PLINE" | "POLYLINE" => self.set_tool(Tool::Polyline),
            "M" | "MOVE" if !self.selection.is_empty() => self.set_tool(Tool::Move),
            "SELECT" | "S" => self.set_tool(Tool::Select),
            "CLOSE" if self.tool == Tool::Polyline => self.finish_polyline(true),
            "BULGE" if self.tool == Tool::Polyline => {
                self.status = "PLINE bulge: enter the next point as x,y,b=<value> (for example 10,5,b=0.4142)".to_owned();
            }
            "E" | "ERASE" => self.erase_selection(),
            "U" | "UNDO" => {
                self.drawing.undo();
            }
            "REDO" => {
                self.drawing.redo();
            }
            "ORTHO" => {
                self.ortho_enabled = !self.ortho_enabled;
                self.status = format!("Ortho {}", if self.ortho_enabled { "On" } else { "Off" });
            }
            "OSNAP" => {
                self.snap_enabled = !self.snap_enabled;
                self.status = format!(
                    "Object snap {}",
                    if self.snap_enabled { "On" } else { "Off" }
                );
            }
            "" => {}
            _ => self.status = format!("Unknown command: {command}"),
        }
    }

    fn finish_polyline(&mut self, closed: bool) {
        if self.pending_points.len() >= if closed { 3 } else { 2 } {
            let points = std::mem::take(&mut self.pending_points);
            let mut vertices = points
                .iter()
                .enumerate()
                .map(|(index, point)| {
                    let mut vertex = LwVertex::new(Vector2::new(point.x, point.y));
                    vertex.bulge = self.pending_bulges.get(index).copied().unwrap_or(0.0);
                    vertex
                })
                .collect::<Vec<_>>();
            if !closed && !vertices.is_empty() {
                vertices.last_mut().unwrap().bulge = 0.0;
            }
            match self.drawing.add_polyline_vertices(&vertices, closed) {
                Ok(_) => {
                    self.status = if closed {
                        "Closed polyline created".to_owned()
                    } else {
                        "Polyline created".to_owned()
                    }
                }
                Err(error) => self.status = error,
            }
        } else {
            self.pending_points.clear();
            self.status = "Polyline needs at least two points".to_owned();
        }
        self.pending_bulges.clear();
        self.tool = Tool::Select;
    }

    fn workspace_ui(&mut self, ui: &mut egui::Ui) {
        let Self {
            dock_state,
            ribbon_tab,
            tool,
            drawing,
            selection,
            selection_drag_start,
            property_draft,
            new_layer_name,
            selected_layer,
            rename_layer_name,
            pending_points,
            pending_bulges,
            status,
            zoom,
            world_center,
            cursor_world,
            snap_enabled,
            snap_cache,
            ortho_enabled,
            ..
        } = self;

        let mut viewer = WorkspaceViewer {
            tool,
            drawing,
            selection,
            selection_drag_start,
            property_draft,
            new_layer_name,
            selected_layer,
            rename_layer_name,
            pending_points,
            pending_bulges,
            status,
            zoom,
            world_center,
            cursor_world,
            snap_enabled,
            snap_cache,
            ortho_enabled,
        };

        let mut dock_style = Style::from_egui(ui.style());
        dock_style.separator.width = 5.0;
        ui.horizontal(|ui| {
            draw_tool_rail(ui, &mut viewer);
            DockArea::new(dock_state)
                .id(Id::new("concostcad_workspace"))
                .style(dock_style)
                .show_inside(ui, &mut viewer);
        });
        let _ = ribbon_tab;
    }

    fn ribbon_ui(&mut self, ui: &mut egui::Ui) {
        egui::Frame::new()
            .fill(RIBBON_BG)
            .inner_margin(egui::Margin::symmetric(12, 6))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    for tab in RibbonTab::ALL {
                        let selected = self.ribbon_tab == tab;
                        let response = ui.selectable_label(selected, tab.label());
                        if response.clicked() {
                            self.ribbon_tab = tab;
                        }
                    }
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(egui::RichText::new("2D MODEL SPACE").small().color(MUTED));
                    });
                });
                ui.add_space(5.0);
                ui.horizontal(|ui| match self.ribbon_tab {
                    RibbonTab::Home | RibbonTab::Draw => {
                        ribbon_group(ui, "DRAW", |ui| {
                            tool_button(ui, "Line", self.tool == Tool::Line, || {
                                self.set_tool(Tool::Line)
                            });
                            tool_button(ui, "Arc", self.tool == Tool::Arc, || {
                                self.set_tool(Tool::Arc)
                            });
                            tool_button(ui, "Polyline", self.tool == Tool::Polyline, || {
                                self.set_tool(Tool::Polyline)
                            });
                        });
                        ribbon_group(ui, "MODIFY", |ui| {
                            tool_button(ui, "Select", self.tool == Tool::Select, || {
                                self.set_tool(Tool::Select)
                            });
                            if ui
                                .add_enabled(!self.selection.is_empty(), egui::Button::new("Move"))
                                .clicked()
                            {
                                self.set_tool(Tool::Move);
                            }
                            if ui
                                .add_enabled(!self.selection.is_empty(), egui::Button::new("Erase"))
                                .clicked()
                            {
                                self.erase_selection();
                            }
                        });
                        ribbon_group(ui, "FILE", |ui| {
                            if ui.button("Open").clicked() {
                                self.choose_file_command("Open");
                            }
                            if ui.button("Save").clicked() {
                                self.choose_file_command("Save");
                            }
                        });
                    }
                    RibbonTab::Annotate => {
                        ribbon_group(ui, "ANNOTATION", |ui| {
                            ui.add_enabled(false, egui::Button::new("Text"));
                            ui.add_enabled(false, egui::Button::new("Dimension"));
                        });
                    }
                    RibbonTab::View => {
                        ribbon_group(ui, "VIEW", |ui| {
                            ui.label("Zoom with wheel · Pan with middle mouse");
                            ui.checkbox(&mut self.snap_enabled, "Object snap · F3");
                            ui.checkbox(&mut self.ortho_enabled, "Ortho · F8");
                        });
                    }
                });
            });
    }

    fn top_bar(&mut self, ui: &mut egui::Ui) {
        egui::Frame::new()
            .fill(APP_BG)
            .inner_margin(egui::Margin::symmetric(12, 5))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    egui::Frame::new()
                        .fill(ACCENT)
                        .corner_radius(egui::CornerRadius::same(5))
                        .inner_margin(egui::Margin::symmetric(7, 3))
                        .show(ui, |ui| {
                            ui.label(egui::RichText::new("C").strong().color(Color32::BLACK))
                        });
                    ui.label(egui::RichText::new("CONCOSTCAD").strong().color(TEXT));
                    ui.separator();
                    if ui.button("New").clicked() {
                        if !self.drawing.dirty() && self.pending_points.is_empty() {
                            self.start_new_drawing();
                        } else {
                            self.confirm_new = true;
                        }
                    }
                    if ui.button("Open DWG/DXF").clicked() {
                        self.choose_file_command("Open DWG/DXF");
                    }
                    let title = self
                        .drawing
                        .path()
                        .and_then(|p| p.file_name())
                        .and_then(|s| s.to_str())
                        .unwrap_or("Drawing1");
                    ui.label(
                        egui::RichText::new(format!(
                            "{title}{}",
                            if self.drawing.dirty() {
                                " · Modified"
                            } else {
                                ""
                            }
                        ))
                        .small()
                        .color(MUTED),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(egui::RichText::new("RUST EDITION").small().color(ACCENT));
                    });
                });
            });
    }

    fn start_new_drawing(&mut self) {
        self.drawing = DrawingDocument::new();
        self.selection.clear();
        self.pending_points.clear();
        self.pending_bulges.clear();
        self.tool = Tool::Select;
        self.status = "New drawing".to_owned();
    }
}

impl eframe::App for CadApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        self.poll_open(&ctx);
        self.poll_save(&ctx);
        let (save, open, undo, redo) = ctx.input(|i| {
            (
                i.modifiers.ctrl && i.key_pressed(egui::Key::S),
                i.modifiers.ctrl && i.key_pressed(egui::Key::O),
                i.modifiers.ctrl && i.key_pressed(egui::Key::Z),
                i.modifiers.ctrl && i.key_pressed(egui::Key::Y),
            )
        });
        if save {
            self.save_dialog();
        }
        if open {
            self.open_dialog();
        }
        if undo {
            self.drawing.undo();
            self.selection.clear();
        }
        if redo {
            self.drawing.redo();
            self.selection.clear();
        }
        if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
            self.pending_points.clear();
            self.pending_bulges.clear();
            self.tool = Tool::Select;
            self.status = "Command cancelled".to_owned();
        }
        if ctx.input(|input| input.key_pressed(egui::Key::F3)) {
            self.snap_enabled = !self.snap_enabled;
        }
        if ctx.input(|input| input.key_pressed(egui::Key::F8)) {
            self.ortho_enabled = !self.ortho_enabled;
        }
        if ctx.input(|input| input.key_pressed(egui::Key::Enter))
            && self.tool == Tool::Polyline
            && self.command_line.trim().is_empty()
        {
            self.finish_polyline(false);
        }

        ui.set_min_height(0.0);
        ui.vertical(|ui| {
            self.top_bar(ui);
            self.ribbon_ui(ui);
            let workspace_height = (ui.available_height() - 58.0).max(160.0);
            ui.allocate_ui_with_layout(
                Vec2::new(ui.available_width(), workspace_height),
                Layout::top_down(Align::Min),
                |ui| self.workspace_ui(ui),
            );
            self.command_bar(ui);
            self.status_bar(ui);
        });

        if self.confirm_new {
            egui::Window::new("Start a new drawing?")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
                .show(&ctx, |ui| {
                    ui.label(
                        "The current drawing has unsaved geometry. Starting over will discard it.",
                    );
                    ui.horizontal(|ui| {
                        if ui.button("Keep drawing").clicked() {
                            self.confirm_new = false;
                        }
                        if ui.button("Discard and start new").clicked() {
                            self.start_new_drawing();
                            self.confirm_new = false;
                        }
                    });
                });
        }
        if self.confirm_open {
            egui::Window::new("Open another drawing?")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, Vec2::ZERO)
                .show(&ctx, |ui| {
                    ui.label("The current drawing has unsaved changes.");
                    ui.horizontal(|ui| {
                        if ui.button("Keep drawing").clicked() {
                            self.confirm_open = false;
                            self.pending_open_path = None;
                        }
                        if ui.button("Discard and open").clicked() {
                            self.confirm_open = false;
                            if let Some(path) = self.pending_open_path.take() {
                                self.load_path(path);
                            }
                        }
                    });
                });
        }
    }
}

impl CadApp {
    fn erase_selection(&mut self) {
        if !self.selection.is_empty() {
            let count = self.selection.len();
            self.status = self
                .drawing
                .erase_many(&self.selection)
                .map(|_| {
                    self.selection.clear();
                    format!("Erased {count} entities")
                })
                .unwrap_or_else(|error| error);
        }
    }

    fn command_bar(&mut self, ui: &mut egui::Ui) {
        egui::Frame::new()
            .fill(PANEL_BG)
            .inner_margin(egui::Margin::symmetric(10, 5))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new(">_").monospace().color(ACCENT));
                    let response = ui.add_sized(
                        [ui.available_width(), 25.0],
                        egui::TextEdit::singleline(&mut self.command_line).hint_text(
                            "Command or point x,y · @dx,dy · @distance<angle · PLINE x,y,b=value",
                        ),
                    );
                    if response.lost_focus()
                        && ui.input(|input| input.key_pressed(egui::Key::Enter))
                    {
                        self.execute_command_line();
                    }
                });
            });
    }

    fn status_bar(&self, ui: &mut egui::Ui) {
        egui::Frame::new()
            .fill(Color32::from_rgb(31, 35, 40))
            .inner_margin(egui::Margin::symmetric(10, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new(&self.status).small().color(TEXT));
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if self.ortho_enabled {
                            ui.label(egui::RichText::new("ORTHO").small().strong().color(ACCENT));
                        }
                        if self.snap_enabled {
                            ui.label(egui::RichText::new("OSNAP").small().strong().color(ACCENT));
                        }
                        ui.label(
                            egui::RichText::new(format!(
                                "X {:.3}   Y {:.3}     {:.0}%",
                                self.cursor_world.x,
                                self.cursor_world.y,
                                self.zoom * 100.0 / 40.0
                            ))
                            .small()
                            .monospace()
                            .color(MUTED),
                        );
                    });
                });
            });
    }
}

#[derive(Clone)]
enum PropertyDraft {
    Line {
        start: Point2,
        end: Point2,
    },
    Arc {
        center: Point2,
        radius: f64,
        start_degrees: f64,
        end_degrees: f64,
    },
    Polyline {
        vertices: Vec<PolylineVertexDraft>,
        closed: bool,
    },
    Unsupported {
        kind: String,
    },
}

#[derive(Clone)]
struct PolylineVertexDraft {
    point: Point2,
    bulge: f64,
    template: LwVertex,
}

impl PropertyDraft {
    fn from_entity(entity: &EntityType) -> Self {
        match entity {
            EntityType::Line(line) => Self::Line {
                start: Point2::new(line.start.x, line.start.y),
                end: Point2::new(line.end.x, line.end.y),
            },
            EntityType::Arc(arc) => Self::Arc {
                center: Point2::new(arc.center.x, arc.center.y),
                radius: arc.radius,
                start_degrees: arc.start_angle.to_degrees(),
                end_degrees: arc.end_angle.to_degrees(),
            },
            EntityType::LwPolyline(poly) => Self::Polyline {
                vertices: poly
                    .vertices
                    .iter()
                    .map(|v| PolylineVertexDraft {
                        point: Point2::new(v.location.x, v.location.y),
                        bulge: v.bulge,
                        template: *v,
                    })
                    .collect(),
                closed: poly.is_closed,
            },
            _ => Self::Unsupported {
                kind: entity.as_entity().entity_type().to_owned(),
            },
        }
    }
}

fn point_editor(ui: &mut egui::Ui, label: &str, point: &mut Point2) {
    ui.horizontal(|ui| {
        ui.label(egui::RichText::new(label).small().color(MUTED));
        ui.add(egui::DragValue::new(&mut point.x).speed(0.1).prefix("X "));
        ui.add(egui::DragValue::new(&mut point.y).speed(0.1).prefix("Y "));
    });
}

fn number_editor(ui: &mut egui::Ui, label: &str, value: &mut f64, speed: f64) {
    ui.horizontal(|ui| {
        ui.label(egui::RichText::new(label).small().color(MUTED));
        ui.add(egui::DragValue::new(value).speed(speed));
    });
}

struct WorkspaceViewer<'a> {
    tool: &'a mut Tool,
    drawing: &'a mut DrawingDocument,
    selection: &'a mut Vec<Handle>,
    selection_drag_start: &'a mut Option<Pos2>,
    property_draft: &'a mut Option<(Handle, u64, PropertyDraft)>,
    new_layer_name: &'a mut String,
    selected_layer: &'a mut String,
    rename_layer_name: &'a mut String,
    pending_points: &'a mut Vec<Point2>,
    pending_bulges: &'a mut Vec<f64>,
    status: &'a mut String,
    zoom: &'a mut f32,
    world_center: &'a mut Point2,
    cursor_world: &'a mut Point2,
    snap_enabled: &'a mut bool,
    snap_cache: &'a mut SnapCache,
    ortho_enabled: &'a mut bool,
}

impl TabViewer for WorkspaceViewer<'_> {
    type Tab = WorkspaceTab;

    fn id(&mut self, tab: &mut Self::Tab) -> Id {
        Id::new(match tab {
            WorkspaceTab::Drawing => "drawing",
            WorkspaceTab::Properties => "properties",
            WorkspaceTab::Layers => "layers",
        })
    }

    fn title(&mut self, tab: &mut Self::Tab) -> WidgetText {
        match tab {
            WorkspaceTab::Drawing => "Drawing1".into(),
            WorkspaceTab::Properties => "Properties".into(),
            WorkspaceTab::Layers => "Layers".into(),
        }
    }

    fn ui(&mut self, ui: &mut egui::Ui, tab: &mut Self::Tab) {
        match tab {
            WorkspaceTab::Drawing => self.canvas_ui(ui),
            WorkspaceTab::Properties => self.properties_ui(ui),
            WorkspaceTab::Layers => self.layers_ui(ui),
        }
    }
}

impl WorkspaceViewer<'_> {
    fn canvas_ui(&mut self, ui: &mut egui::Ui) {
        let (rect, response) = ui.allocate_exact_size(ui.available_size(), Sense::click_and_drag());
        let painter = ui.painter_at(rect);
        painter.rect_filled(rect, 0.0, CANVAS_BG);
        draw_grid(&painter, rect, *self.zoom, *self.world_center);
        let origin = world_to_screen(Point2::default(), rect, *self.zoom, *self.world_center);
        if rect.contains(origin) {
            painter.line_segment(
                [
                    Pos2::new(rect.left(), origin.y),
                    Pos2::new(rect.right(), origin.y),
                ],
                Stroke::new(1.0, Color32::from_rgb(83, 54, 56)),
            );
            painter.line_segment(
                [
                    Pos2::new(origin.x, rect.top()),
                    Pos2::new(origin.x, rect.bottom()),
                ],
                Stroke::new(1.0, Color32::from_rgb(48, 74, 91)),
            );
        }

        let cursor_preview = response.hover_pos().map(|pointer| {
            let raw = screen_to_world(pointer, rect, *self.zoom, *self.world_center);
            let snap = if *self.snap_enabled && *self.tool != Tool::Select {
                ensure_snap_cache(self.drawing, self.snap_cache);
                nearest_snap(
                    self.snap_cache,
                    raw,
                    10.0 / f64::from((*self.zoom).max(0.1)),
                )
            } else {
                None
            };
            let target = snap.map(|s| s.point).unwrap_or(raw);
            let point =
                constrain_ortho(*self.tool, self.pending_points, target, *self.ortho_enabled);
            *self.cursor_world = point;
            (point, snap)
        });

        let hidden_layers = self
            .drawing
            .layers()
            .filter(|(_, frozen, off, _)| *frozen || *off)
            .map(|(name, _, _, _)| name.to_ascii_lowercase())
            .collect::<HashSet<_>>();
        for entity in self.drawing.model_space_entities() {
            if hidden_layers.contains(&entity.common().layer.to_ascii_lowercase()) {
                continue;
            }
            let color = if self.selection.contains(&entity.common().handle) {
                Color32::YELLOW
            } else {
                ACCENT
            };
            draw_cad_entity(
                &painter,
                rect,
                *self.zoom,
                *self.world_center,
                entity,
                color,
            );
        }
        if let Some((cursor, snap)) = cursor_preview {
            draw_command_preview(
                &painter,
                rect,
                *self.zoom,
                *self.world_center,
                *self.tool,
                self.drawing,
                self.selection,
                self.pending_points,
                self.pending_bulges,
                cursor,
            );
            if let Some(snap) = snap {
                if !*self.ortho_enabled || cursor.distance(snap.point) < 1e-9 {
                    draw_snap_marker(
                        &painter,
                        world_to_screen(snap.point, rect, *self.zoom, *self.world_center),
                        snap.kind,
                    );
                }
            }
        } else if !self.pending_points.is_empty() {
            if *self.tool == Tool::Polyline {
                draw_pending_polyline(&painter, rect, *self.zoom, *self.world_center,
                    self.pending_points, self.pending_bulges, None);
            } else {
                draw_pending_points(&painter, rect, *self.zoom, *self.world_center, self.pending_points);
            }
        }
        let wheel = ui.input(|input| input.smooth_scroll_delta.y);
        if response.hovered() && wheel.abs() > 0.0 {
            *self.zoom = (*self.zoom * (wheel * 0.001).exp()).clamp(0.5, 4_000.0);
        }
        if response.dragged_by(egui::PointerButton::Middle) {
            let delta = response.drag_delta();
            self.world_center.x -= f64::from(delta.x / *self.zoom);
            self.world_center.y += f64::from(delta.y / *self.zoom);
        }
        if *self.tool == Tool::Select && response.drag_started_by(egui::PointerButton::Primary) {
            *self.selection_drag_start = response.interact_pointer_pos();
        }
        if *self.tool == Tool::Select && response.dragged_by(egui::PointerButton::Primary) {
            if let (Some(start), Some(end)) =
                (*self.selection_drag_start, response.interact_pointer_pos())
            {
                let box_rect = Rect::from_two_pos(start, end);
                let crossing = end.x < start.x;
                let color = if crossing {
                    Color32::from_rgb(70, 190, 130)
                } else {
                    Color32::from_rgb(80, 150, 230)
                };
                painter.rect_stroke(
                    box_rect,
                    0.0,
                    Stroke::new(1.0, color),
                    egui::StrokeKind::Middle,
                );
            }
        }
        if *self.tool == Tool::Select && response.drag_stopped_by(egui::PointerButton::Primary) {
            if let (Some(start), Some(end)) = (
                self.selection_drag_start.take(),
                response.interact_pointer_pos(),
            ) {
                let box_rect = Rect::from_two_pos(start, end);
                let crossing = end.x < start.x;
                let hidden_layers = self
                    .drawing
                    .layers()
                    .filter(|(_, frozen, off, _)| *frozen || *off)
                    .map(|(name, _, _, _)| name.to_ascii_lowercase())
                    .collect::<HashSet<_>>();
                self.selection.clear();
                for entity in self.drawing.model_space_entities() {
                    if hidden_layers.contains(&entity.common().layer.to_ascii_lowercase()) {
                        continue;
                    }
                    let points = entity_sample_points(entity);
                    if selection_box_matches(
                        &points,
                        box_rect,
                        rect,
                        *self.zoom,
                        *self.world_center,
                        crossing,
                    ) {
                        self.selection.push(entity.common().handle);
                    }
                }
                *self.status = format!("{} entities selected", self.selection.len());
            }
        }
        if response.clicked_by(egui::PointerButton::Primary) {
            if let Some(pointer) = response.interact_pointer_pos() {
                let raw = screen_to_world(pointer, rect, *self.zoom, *self.world_center);
                let point = if *self.tool == Tool::Select {
                    raw
                } else if *self.snap_enabled {
                    ensure_snap_cache(self.drawing, self.snap_cache);
                    nearest_snap(
                        self.snap_cache,
                        raw,
                        10.0 / f64::from((*self.zoom).max(0.1)),
                    )
                    .map(|snap| snap.point)
                    .unwrap_or(raw)
                } else {
                    raw
                };
                self.handle_canvas_pick(point);
            }
        }

        painter.text(
            Pos2::new(rect.left() + 14.0, rect.bottom() - 13.0),
            egui::Align2::LEFT_BOTTOM,
            "MODEL SPACE  ·  GRID ON  ·  UCS WORLD",
            egui::FontId::proportional(10.0),
            MUTED,
        );
        if self.drawing.entity_count() == 0 && self.pending_points.is_empty() {
            painter.text(
                rect.center(),
                egui::Align2::CENTER_CENTER,
                "Choose Line, Arc, or Polyline to begin",
                egui::FontId::proportional(15.0),
                MUTED,
            );
        }
    }

    fn handle_canvas_pick(&mut self, point: Point2) {
        handle_point(
            self.tool,
            self.drawing,
            self.selection,
            self.pending_points,
            self.pending_bulges,
            self.status,
            point,
            *self.ortho_enabled,
            *self.zoom,
        );
    }

    fn properties_ui(&mut self, ui: &mut egui::Ui) {
        panel_heading(ui, "PROPERTIES");
        ui.add_space(7.0);
        if self.selection.len() > 1 {
            ui.label(format!("{} entities selected", self.selection.len()));
            ui.label(
                egui::RichText::new("Select one entity to edit its properties.")
                    .small()
                    .color(MUTED),
            );
        } else if let Some(handle) = self.selection.first().copied() {
            let mut entity_layer = self
                .drawing
                .entity(handle)
                .map(|entity| entity.common().layer.clone())
                .unwrap_or_default();
            let current_entity_layer = entity_layer.clone();
            let layers = self
                .drawing
                .layers()
                .map(|(name, _, _, _)| name.to_owned())
                .collect::<Vec<_>>();
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("Layer").small().color(MUTED));
                egui::ComboBox::from_id_salt("selected_entity_layer")
                    .selected_text(&entity_layer)
                    .show_ui(ui, |ui| {
                        for name in &layers {
                            ui.selectable_value(&mut entity_layer, name.clone(), name);
                        }
                    });
            });
            if entity_layer != current_entity_layer {
                *self.status = self
                    .drawing
                    .set_entity_layer(handle, &entity_layer)
                    .map(|_| "Entity layer changed".to_owned())
                    .unwrap_or_else(|e| e);
                *self.property_draft = None;
            }
            if self
                .property_draft
                .as_ref()
                .is_none_or(|(draft_handle, revision, _)| {
                    *draft_handle != handle || *revision != self.drawing.state_id()
                })
            {
                *self.property_draft = self.drawing.entity(handle).map(|entity| {
                    (
                        handle,
                        self.drawing.state_id(),
                        PropertyDraft::from_entity(entity),
                    )
                });
            }
            ui.label(
                egui::RichText::new(format!("Selected · handle {}", handle.value()))
                    .small()
                    .color(TEXT),
            );
            if let Some((_, _, draft)) = self.property_draft.as_mut() {
                let mut remove_vertex = None;
                let mut insert_after = None;
                match draft {
                    PropertyDraft::Line { start, end } => {
                        ui.label(
                            egui::RichText::new("LINE endpoints")
                                .small()
                                .strong()
                                .color(MUTED),
                        );
                        point_editor(ui, "Start", start);
                        point_editor(ui, "End", end);
                    }
                    PropertyDraft::Arc {
                        center,
                        radius,
                        start_degrees,
                        end_degrees,
                    } => {
                        ui.label(
                            egui::RichText::new("ARC geometry")
                                .small()
                                .strong()
                                .color(MUTED),
                        );
                        point_editor(ui, "Center", center);
                        number_editor(ui, "Radius", radius, 0.1);
                        number_editor(ui, "Start °", start_degrees, 1.0);
                        number_editor(ui, "End °", end_degrees, 1.0);
                    }
                    PropertyDraft::Polyline { vertices, closed } => {
                        let vertex_count = vertices.len();
                        ui.label(
                            egui::RichText::new("LWPOLYLINE vertices")
                                .small()
                                .strong()
                                .color(MUTED),
                        );
                        for (index, vertex) in vertices.iter_mut().enumerate() {
                            ui.push_id(index, |ui| {
                                ui.horizontal(|ui| {
                                    ui.label(format!("{}", index + 1));
                                    ui.add(
                                        egui::DragValue::new(&mut vertex.point.x)
                                            .speed(0.1)
                                            .prefix("X ")
                                            .max_decimals(3),
                                    );
                                    ui.add(
                                        egui::DragValue::new(&mut vertex.point.y)
                                            .speed(0.1)
                                            .prefix("Y ")
                                            .max_decimals(3),
                                    );
                                });
                                ui.horizontal(|ui| {
                                    ui.add(
                                        egui::DragValue::new(&mut vertex.bulge)
                                            .speed(0.01)
                                            .prefix("B "),
                                    );
                                    ui.label(
                                        egui::RichText::new("tan(angle/4)").small().color(MUTED),
                                    );
                                    if ui.small_button("−").clicked() {
                                        remove_vertex = Some(index);
                                    }
                                    let has_next = index + 1 < vertex_count || *closed;
                                    if has_next
                                        && ui
                                            .small_button("↳+")
                                            .on_hover_text(
                                                "Insert a vertex halfway along this segment",
                                            )
                                            .clicked()
                                    {
                                        insert_after = Some(index);
                                    }
                                });
                            });
                        }
                        if let Some(index) = remove_vertex {
                            if vertices.len() > if *closed { 3 } else { 2 } {
                                vertices.remove(index);
                            }
                        }
                        if let Some(index) = insert_after {
                            if index < vertices.len() && (index + 1 < vertices.len() || *closed) {
                                let next = (index + 1) % vertices.len();
                                let a = vertices[index].point;
                                let b = vertices[next].point;
                                let original_bulge = vertices[index].bulge;
                                if let Some((point, half_bulge)) =
                                    split_bulge_segment(a, b, original_bulge)
                                {
                                    vertices[index].bulge = half_bulge;
                                    vertices.insert(
                                        next,
                                        PolylineVertexDraft {
                                            point,
                                            bulge: half_bulge,
                                            template: LwVertex::new(Vector2::new(point.x, point.y)),
                                        },
                                    );
                                }
                            }
                        }
                        ui.horizontal(|ui| {
                            if ui.button("+ Vertex").clicked() {
                                let point = vertices
                                    .last()
                                    .map(|v| Point2::new(v.point.x + 10.0, v.point.y))
                                    .unwrap_or_default();
                                vertices.push(PolylineVertexDraft {
                                    point,
                                    bulge: 0.0,
                                    template: LwVertex::new(Vector2::new(point.x, point.y)),
                                });
                            }
                            ui.checkbox(closed, "Closed");
                        });
                    }
                    PropertyDraft::Unsupported { kind } => {
                        ui.label(format!("{kind} editing is not available yet"));
                    }
                }
                ui.add_space(6.0);
                if !matches!(draft, PropertyDraft::Unsupported { .. })
                    && ui.button("Apply properties").clicked()
                {
                    let result = match draft.clone() {
                        PropertyDraft::Line { start, end } => self.drawing.replace_line(
                            handle,
                            Vector2::new(start.x, start.y),
                            Vector2::new(end.x, end.y),
                        ),
                        PropertyDraft::Arc {
                            center,
                            radius,
                            start_degrees,
                            end_degrees,
                        } => self.drawing.replace_arc(
                            handle,
                            Vector2::new(center.x, center.y),
                            radius,
                            start_degrees.to_radians(),
                            end_degrees.to_radians(),
                        ),
                        PropertyDraft::Polyline { vertices, closed } => {
                            let updated = vertices
                                .iter()
                                .map(|v| {
                                    let mut template = v.template;
                                    template.location = Vector2::new(v.point.x, v.point.y);
                                    template.bulge = v.bulge;
                                    template
                                })
                                .collect::<Vec<_>>();
                            self.drawing.replace_polyline(handle, &updated, closed)
                        }
                        PropertyDraft::Unsupported { .. } => Ok(()),
                    };
                    match result {
                        Ok(()) => {
                            *self.status = "Entity properties updated".to_owned();
                            *self.property_draft = self.drawing.entity(handle).map(|entity| {
                                (
                                    handle,
                                    self.drawing.state_id(),
                                    PropertyDraft::from_entity(entity),
                                )
                            });
                        }
                        Err(error) => *self.status = error,
                    }
                }
            }
        } else {
            *self.property_draft = None;
            property_row(
                ui,
                "Selection",
                if self.pending_points.is_empty() {
                    "None"
                } else {
                    "In progress"
                },
            );
        }
        property_row(ui, "Current tool", self.tool.name());
        property_row(ui, "Entities", &self.drawing.entity_count().to_string());
        ui.separator();
        ui.label(
            egui::RichText::new("Drawing settings")
                .small()
                .strong()
                .color(TEXT),
        );
        property_row(ui, "Units", "Drawing units");
        property_row(ui, "Coordinate", "World XY");
        ui.add_space(8.0);
        ui.label(
            egui::RichText::new("Geometry edits are applied as a single undoable change.")
                .small()
                .color(MUTED),
        );
    }

    fn layers_ui(&mut self, ui: &mut egui::Ui) {
        panel_heading(ui, "LAYERS");
        if self.selected_layer.is_empty() {
            *self.selected_layer = self.drawing.current_layer().to_owned();
            *self.rename_layer_name = self.selected_layer.clone();
        }
        ui.label(
            egui::RichText::new(format!("Current: {}", self.drawing.current_layer()))
                .small()
                .color(ACCENT),
        );
        ui.add_space(5.0);
        let layers = self
            .drawing
            .layers()
            .map(|(name, frozen, off, locked)| (name.to_owned(), frozen, off, locked))
            .collect::<Vec<_>>();
        egui::ScrollArea::vertical().show(ui, |ui| {
            for (name, mut frozen, mut off, mut locked) in layers {
                ui.horizontal(|ui| {
                    let current = self.drawing.current_layer().eq_ignore_ascii_case(&name);
                    if ui.selectable_label(current, format!("● {name}")).clicked() {
                        *self.selected_layer = name.clone();
                        *self.rename_layer_name = name.clone();
                        *self.status = self
                            .drawing
                            .set_current_layer(&name)
                            .map(|_| format!("Current layer: {name}"))
                            .unwrap_or_else(|e| e);
                    }
                    ui.label(
                        egui::RichText::new(if locked { "🔒" } else { "" })
                            .small()
                            .color(MUTED),
                    );
                });
                ui.collapsing("Layer state", |ui| {
                    let mut changed = false;
                    changed |= ui.checkbox(&mut frozen, "Frozen").changed();
                    changed |= ui.checkbox(&mut off, "Off").changed();
                    changed |= ui.checkbox(&mut locked, "Locked").changed();
                    if changed {
                        *self.status = self
                            .drawing
                            .set_layer_flags(&name, frozen, off, locked)
                            .map(|_| format!("Updated layer {name}"))
                            .unwrap_or_else(|e| e);
                    }
                });
            }
        });
        ui.separator();
        ui.label(
            egui::RichText::new(format!("Selected: {}", self.selected_layer))
                .small()
                .color(MUTED),
        );
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(self.rename_layer_name)
                    .hint_text("Rename layer")
                    .desired_width(120.0),
            );
            if ui.button("Rename").clicked() {
                let old = self.selected_layer.clone();
                let new = self.rename_layer_name.clone();
                match self.drawing.rename_layer(&old, &new) {
                    Ok(()) => {
                        *self.selected_layer = new.clone();
                        *self.rename_layer_name = new.clone();
                        *self.status = format!("Renamed layer {old} to {new}");
                    }
                    Err(error) => *self.status = error,
                }
            }
        });
        ui.separator();
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(self.new_layer_name)
                    .hint_text("New layer name")
                    .desired_width(120.0),
            );
            if ui.button("Add").clicked() {
                *self.status = self
                    .drawing
                    .add_layer(self.new_layer_name)
                    .map(|_| {
                        self.new_layer_name.clear();
                        "Layer created and set current".to_owned()
                    })
                    .unwrap_or_else(|e| e);
            }
        });
    }
}

fn handle_point(
    tool: &mut Tool,
    drawing: &mut DrawingDocument,
    selection: &mut Vec<Handle>,
    pending: &mut Vec<Point2>,
    bulges: &mut Vec<f64>,
    status: &mut String,
    point: Point2,
    ortho: bool,
    zoom: f32,
) {
    let point = constrain_ortho(*tool, pending, point, ortho);
    match *tool {
        Tool::Select => {
            selection.clear();
            if let Some(handle) = drawing.model_space_entities().find_map(|entity| {
                let hidden = drawing.layers().any(|(name, frozen, off, _)| {
                    name.eq_ignore_ascii_case(&entity.common().layer) && (frozen || off)
                });
                (!hidden && hit_test(entity, point, 8.0 / f64::from(zoom.max(0.1))))
                    .then_some(entity.common().handle)
            }) {
                selection.push(handle);
            }
            *status = if !selection.is_empty() {
                "Entity selected · use Erase or Move".to_owned()
            } else {
                "Nothing selected".to_owned()
            };
        }
        Tool::Line => {
            pending.push(point);
            if pending.len() == 2 {
                let start = pending[0];
                let end = pending[1];
                pending.clear();
                *status = drawing
                    .add_line(Vector2::new(start.x, start.y), Vector2::new(end.x, end.y))
                    .map(|_| "LINE created · pick first point".to_owned())
                    .unwrap_or_else(|e| e);
            } else {
                *status = "LINE · Pick second point".to_owned();
            }
        }
        Tool::Arc => {
            pending.push(point);
            match pending.len() {
                1 => *status = "ARC · Pick a point on the arc".to_owned(),
                2 => *status = "ARC · Pick end point".to_owned(),
                3 => {
                    let pts = std::mem::take(pending);
                    if let Some(arc) = Arc2::through_three_points(pts[0], pts[1], pts[2]) {
                        *status = drawing
                            .add_arc(
                                Vector2::new(arc.center.x, arc.center.y),
                                arc.radius,
                                arc.start_angle,
                                arc.start_angle + arc.sweep(),
                            )
                            .map(|_| "ARC created · pick start point".to_owned())
                            .unwrap_or_else(|e| e);
                    } else {
                        *status = "ARC points are collinear; pick start again".to_owned();
                    }
                }
                _ => {}
            }
        }
        Tool::Polyline => {
            pending.push(point);
            bulges.push(0.0);
            *status = format!(
                "PLINE · {} vertices · press Enter to finish or type CLOSE",
                pending.len()
            );
        }
        Tool::Move => {
            if pending.is_empty() {
                pending.push(point);
                *status = "MOVE · pick destination point".to_owned();
            } else {
                let base = pending.remove(0);
                if !selection.is_empty() {
                    let count = selection.len();
                    *status = drawing
                        .translate_many(selection, point.x - base.x, point.y - base.y)
                        .map(|_| format!("Moved {count} entities"))
                        .unwrap_or_else(|e| e);
                }
                *tool = Tool::Select;
            }
        }
    }
}

fn entity_sample_points(entity: &EntityType) -> Vec<Point2> {
    match entity {
        EntityType::Line(line) => vec![
            Point2::new(line.start.x, line.start.y),
            Point2::new(line.end.x, line.end.y),
        ],
        EntityType::Arc(arc) => {
            let start = arc.start_angle;
            let sweep = (arc.end_angle - start).rem_euclid(std::f64::consts::TAU);
            let count =
                ((sweep.abs() / (std::f64::consts::PI / 32.0)).ceil() as usize).clamp(2, 256);
            (0..=count)
                .map(|i| {
                    let angle = start + sweep * i as f64 / count as f64;
                    Point2::new(
                        arc.center.x + arc.radius * angle.cos(),
                        arc.center.y + arc.radius * angle.sin(),
                    )
                })
                .collect()
        }
        EntityType::LwPolyline(poly) => {
            let vertices = &poly.vertices;
            if vertices.is_empty() {
                return Vec::new();
            }
            let mut points = Vec::new();
            let count = if poly.is_closed {
                vertices.len()
            } else {
                vertices.len().saturating_sub(1)
            };
            for i in 0..count {
                let a = &vertices[i];
                let b = &vertices[(i + 1) % vertices.len()];
                let p0 = Point2::new(a.location.x, a.location.y);
                let p1 = Point2::new(b.location.x, b.location.y);
                if points.is_empty() {
                    points.push(p0);
                }
                if a.bulge.abs() < 1e-10 {
                    points.push(p1);
                } else if let Some((center, radius, start, sweep)) = bulge_geometry(p0, p1, a.bulge)
                {
                    let n = ((sweep.abs() / (std::f64::consts::PI / 32.0)).ceil() as usize)
                        .clamp(2, 256);
                    for j in 1..=n {
                        let angle = start + sweep * j as f64 / n as f64;
                        points.push(Point2::new(
                            center.x + radius * angle.cos(),
                            center.y + radius * angle.sin(),
                        ));
                    }
                } else {
                    points.push(p1);
                }
            }
            if !poly.is_closed && count == 0 {
                points.push(Point2::new(vertices[0].location.x, vertices[0].location.y));
            }
            points
        }
        _ => Vec::new(),
    }
}

fn selection_box_matches(
    points: &[Point2],
    box_rect: Rect,
    canvas: Rect,
    zoom: f32,
    center: Point2,
    crossing: bool,
) -> bool {
    if points.is_empty() {
        return false;
    }
    let screen = points
        .iter()
        .map(|p| world_to_screen(*p, canvas, zoom, center))
        .collect::<Vec<_>>();
    if !crossing {
        return screen.iter().all(|p| box_rect.contains(*p));
    }
    screen.iter().any(|p| box_rect.contains(*p))
        || screen
            .windows(2)
            .any(|pair| segment_intersects_rect(pair[0], pair[1], box_rect))
}

fn segment_intersects_rect(a: Pos2, b: Pos2, rect: Rect) -> bool {
    if rect.contains(a) || rect.contains(b) {
        return true;
    }
    let edges = [
        (rect.left_top(), rect.right_top()),
        (rect.right_top(), rect.right_bottom()),
        (rect.right_bottom(), rect.left_bottom()),
        (rect.left_bottom(), rect.left_top()),
    ];
    edges.into_iter().any(|(c, d)| {
        let cross =
            |p: Pos2, q: Pos2, r: Pos2| (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        let (o1, o2, o3, o4) = (
            cross(a, b, c),
            cross(a, b, d),
            cross(c, d, a),
            cross(c, d, b),
        );
        o1 * o2 <= 0.0 && o3 * o4 <= 0.0
    })
}

fn constrain_ortho(tool: Tool, pending: &[Point2], point: Point2, enabled: bool) -> Point2 {
    if !enabled {
        return point;
    }
    let anchor = match tool {
        Tool::Line | Tool::Polyline => pending.last().copied(),
        Tool::Move => pending.first().copied(),
        _ => None,
    };
    let Some(anchor) = anchor else {
        return point;
    };
    if (point.x - anchor.x).abs() >= (point.y - anchor.y).abs() {
        Point2::new(point.x, anchor.y)
    } else {
        Point2::new(anchor.x, point.y)
    }
}

fn parse_coordinate(input: &str, base: Point2) -> Result<Option<Point2>, String> {
    let relative = input.starts_with('@');
    let value = if relative { &input[1..] } else { input };
    if let Some((distance, angle)) = value.split_once('<') {
        if !relative {
            return Ok(None);
        }
        let distance = distance
            .parse::<f64>()
            .map_err(|_| "Invalid polar distance".to_owned())?;
        let angle = angle
            .parse::<f64>()
            .map_err(|_| "Invalid polar angle".to_owned())?
            .to_radians();
        if !distance.is_finite() || !angle.is_finite() {
            return Err("Coordinate must be finite".to_owned());
        }
        return Ok(Some(Point2::new(
            base.x + distance * angle.cos(),
            base.y + distance * angle.sin(),
        )));
    }
    let Some((x, y)) = value.split_once(',') else {
        return Ok(None);
    };
    let x = x
        .trim()
        .parse::<f64>()
        .map_err(|_| "Invalid X coordinate".to_owned())?;
    let y = y
        .trim()
        .parse::<f64>()
        .map_err(|_| "Invalid Y coordinate".to_owned())?;
    if !x.is_finite() || !y.is_finite() {
        return Err("Coordinate must be finite".to_owned());
    }
    Ok(Some(if relative {
        Point2::new(base.x + x, base.y + y)
    } else {
        Point2::new(x, y)
    }))
}

fn parse_polyline_coordinate(input: &str, base: Point2) -> Result<Option<(Point2, f64)>, String> {
    let lower = input.to_ascii_lowercase();
    let Some(index) = lower.find(",b=") else {
        return parse_coordinate(input, base).map(|point| point.map(|point| (point, 0.0)));
    };
    let (coordinate, suffix) = input.split_at(index);
    let bulge_text = &suffix[3..];
    let Some(point) = parse_coordinate(coordinate.trim(), base)? else {
        return Err("Polyline bulge syntax is x,y,b=<value>".to_owned());
    };
    let bulge = bulge_text
        .trim()
        .parse::<f64>()
        .map_err(|_| "Invalid Polyline bulge".to_owned())?;
    if !bulge.is_finite() || bulge.abs() > 1.0e6 {
        return Err("Interactive Polyline bulge magnitude must not exceed 1000000".to_owned());
    }
    Ok(Some((point, bulge)))
}

fn draw_tool_rail(ui: &mut egui::Ui, viewer: &mut WorkspaceViewer<'_>) {
    egui::Frame::new()
        .fill(Color32::from_rgb(32, 36, 41))
        .inner_margin(egui::Margin::symmetric(5, 8))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                for (tool, glyph) in [
                    (Tool::Select, "S"),
                    (Tool::Line, "L"),
                    (Tool::Arc, "A"),
                    (Tool::Polyline, "PL"),
                ] {
                    let selected = *viewer.tool == tool;
                    let button = egui::Button::new(egui::RichText::new(glyph).small().strong())
                        .min_size(Vec2::splat(32.0))
                        .fill(if selected {
                            ACCENT
                        } else {
                            Color32::TRANSPARENT
                        });
                    if ui.add(button).on_hover_text(tool.name()).clicked() {
                        *viewer.tool = tool;
                        viewer.pending_points.clear();
                        viewer.pending_bulges.clear();
                        *viewer.status = match tool {
                            Tool::Select => "Select geometry".to_owned(),
                            Tool::Line => "LINE · Pick first point".to_owned(),
                            Tool::Arc => "ARC · Pick start, point on arc, then end".to_owned(),
                            Tool::Polyline => {
                                "PLINE · Pick vertices; press Enter to finish".to_owned()
                            }
                            Tool::Move => "MOVE · Pick base point".to_owned(),
                        };
                    }
                }
            });
        });
}

fn draw_grid(painter: &egui::Painter, rect: Rect, zoom: f32, center: Point2) {
    let spacing = grid_spacing(zoom);
    let min_x = center.x + f64::from(rect.left() - rect.center().x) / f64::from(zoom);
    let max_x = center.x + f64::from(rect.right() - rect.center().x) / f64::from(zoom);
    let min_y = center.y - f64::from(rect.bottom() - rect.center().y) / f64::from(zoom);
    let max_y = center.y - f64::from(rect.top() - rect.center().y) / f64::from(zoom);
    let first_x = (min_x / spacing).floor() as i64;
    let last_x = (max_x / spacing).ceil() as i64;
    let first_y = (min_y / spacing).floor() as i64;
    let last_y = (max_y / spacing).ceil() as i64;

    for index in first_x..=last_x {
        let x = index as f64 * spacing;
        let screen = world_to_screen(Point2::new(x, center.y), rect, zoom, center).x;
        let color = if index.rem_euclid(5) == 0 {
            Color32::from_rgb(52, 59, 67)
        } else {
            GRID
        };
        painter.line_segment(
            [
                Pos2::new(screen, rect.top()),
                Pos2::new(screen, rect.bottom()),
            ],
            Stroke::new(1.0, color),
        );
    }
    for index in first_y..=last_y {
        let y = index as f64 * spacing;
        let screen = world_to_screen(Point2::new(center.x, y), rect, zoom, center).y;
        let color = if index.rem_euclid(5) == 0 {
            Color32::from_rgb(52, 59, 67)
        } else {
            GRID
        };
        painter.line_segment(
            [
                Pos2::new(rect.left(), screen),
                Pos2::new(rect.right(), screen),
            ],
            Stroke::new(1.0, color),
        );
    }
}

fn grid_spacing(zoom: f32) -> f64 {
    let target = f64::from(32.0 / zoom.max(0.01));
    let magnitude = 10.0_f64.powf(target.log10().floor());
    for multiplier in [1.0, 2.0, 5.0, 10.0] {
        let candidate = magnitude * multiplier;
        if candidate * f64::from(zoom) >= 24.0 {
            return candidate;
        }
    }
    magnitude * 10.0
}

fn draw_pending_points(
    painter: &egui::Painter,
    rect: Rect,
    zoom: f32,
    center: Point2,
    points: &[Point2],
) {
    let screen = points
        .iter()
        .map(|p| world_to_screen(*p, rect, zoom, center))
        .collect::<Vec<_>>();
    if screen.len() > 1 {
        painter.add(egui::Shape::line(
            screen,
            Stroke::new(1.7, Color32::from_rgb(233, 190, 91)),
        ));
    }
}

fn draw_command_preview(
    painter: &egui::Painter,
    rect: Rect,
    zoom: f32,
    center: Point2,
    tool: Tool,
    drawing: &DrawingDocument,
    selection: &[Handle],
    pending: &[Point2],
    bulges: &[f64],
    cursor: Point2,
) {
    let color = Color32::from_rgb(233, 190, 91);
    let stroke = Stroke::new(1.7, color);
    match tool {
        Tool::Line => {
            if let Some(start) = pending.last() {
                painter.line_segment(
                    [
                        world_to_screen(*start, rect, zoom, center),
                        world_to_screen(cursor, rect, zoom, center),
                    ],
                    stroke,
                );
            }
        }
        Tool::Polyline => {
            draw_pending_polyline(painter, rect, zoom, center, pending, bulges, Some(cursor));
        }
        Tool::Arc => match pending.len() {
            0 => {}
            1 => {
                painter.line_segment(
                    [
                        world_to_screen(pending[0], rect, zoom, center),
                        world_to_screen(cursor, rect, zoom, center),
                    ],
                    stroke,
                );
            }
            _ => {
                if let Some(arc) = Arc2::through_three_points(pending[0], pending[1], cursor) {
                    let count = ((arc.sweep() * f64::from(zoom) * arc.radius / 2.5).ceil()
                        as usize)
                        .clamp(12, 256);
                    let points = (0..=count)
                        .map(|i| {
                            let angle = arc.start_angle + arc.sweep() * i as f64 / count as f64;
                            world_to_screen(
                                Point2::new(
                                    arc.center.x + arc.radius * angle.cos(),
                                    arc.center.y + arc.radius * angle.sin(),
                                ),
                                rect,
                                zoom,
                                center,
                            )
                        })
                        .collect();
                    painter.add(egui::Shape::line(points, stroke));
                }
            }
        },
        Tool::Move => {
            if let Some(base) = pending.first() {
                for handle in selection {
                    if let Some(entity) = drawing.entity(*handle) {
                        let mut preview = entity.clone();
                        preview.as_entity_mut().translate(Vector3::new(
                            cursor.x - base.x,
                            cursor.y - base.y,
                            0.0,
                        ));
                        draw_cad_entity(painter, rect, zoom, center, &preview, color);
                    }
                }
            }
        }
        Tool::Select => {}
    }
}

fn draw_cad_entity(
    painter: &egui::Painter,
    rect: Rect,
    zoom: f32,
    center: Point2,
    entity: &EntityType,
    color: Color32,
) {
    let stroke = Stroke::new(1.7, color);
    match entity {
        EntityType::Line(line) => {
            painter.line_segment(
                [
                    world_to_screen(Point2::new(line.start.x, line.start.y), rect, zoom, center),
                    world_to_screen(Point2::new(line.end.x, line.end.y), rect, zoom, center),
                ],
                stroke,
            );
        }
        EntityType::Arc(arc) => {
            let sweep = (arc.end_angle - arc.start_angle).rem_euclid(std::f64::consts::TAU);
            let n = ((sweep * f64::from(zoom) * arc.radius / 2.5).ceil() as usize).clamp(12, 256);
            let points = (0..=n)
                .map(|i| {
                    let angle = arc.start_angle + sweep * i as f64 / n as f64;
                    world_to_screen(
                        Point2::new(
                            arc.center.x + arc.radius * angle.cos(),
                            arc.center.y + arc.radius * angle.sin(),
                        ),
                        rect,
                        zoom,
                        center,
                    )
                })
                .collect();
            painter.add(egui::Shape::line(points, stroke));
        }
        EntityType::LwPolyline(polyline) => {
            let pts = &polyline.vertices;
            for pair in pts.windows(2) {
                draw_bulge_segment(
                    painter,
                    rect,
                    zoom,
                    center,
                    pair[0].location.x,
                    pair[0].location.y,
                    pair[1].location.x,
                    pair[1].location.y,
                    pair[0].bulge,
                    stroke,
                );
            }
            if polyline.is_closed && pts.len() > 2 {
                let a = pts[pts.len() - 1];
                let b = pts[0];
                draw_bulge_segment(
                    painter,
                    rect,
                    zoom,
                    center,
                    a.location.x,
                    a.location.y,
                    b.location.x,
                    b.location.y,
                    a.bulge,
                    stroke,
                );
            }
        }
        _ => {}
    }
}

fn draw_bulge_segment(
    painter: &egui::Painter,
    rect: Rect,
    zoom: f32,
    center: Point2,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    bulge: f64,
    stroke: Stroke,
) {
    if bulge.abs() < 1e-10 {
        painter.line_segment(
            [
                world_to_screen(Point2::new(x1, y1), rect, zoom, center),
                world_to_screen(Point2::new(x2, y2), rect, zoom, center),
            ],
            stroke,
        );
        return;
    }
    let dx = x2 - x1;
    let dy = y2 - y1;
    let chord = dx.hypot(dy);
    if chord == 0.0 {
        return;
    }
    let sweep = 4.0 * bulge.atan();
    let radius = chord / (2.0 * (sweep.abs() / 2.0).sin());
    let midx = (x1 + x2) / 2.0;
    let midy = (y1 + y2) / 2.0;
    let offset = chord / (2.0 * (sweep / 2.0).tan());
    let cx = midx - dy / chord * offset;
    let cy = midy + dx / chord * offset;
    let start = (y1 - cy).atan2(x1 - cx);
    let n = ((sweep.abs() * radius * f64::from(zoom) / 2.5).ceil() as usize).clamp(8, 256);
    let points = (0..=n)
        .map(|i| {
            let a = start + sweep * i as f64 / n as f64;
            world_to_screen(
                Point2::new(cx + radius * a.cos(), cy + radius * a.sin()),
                rect,
                zoom,
                center,
            )
        })
        .collect();
    painter.add(egui::Shape::line(points, stroke));
}

fn hit_test(entity: &EntityType, p: Point2, tol: f64) -> bool {
    match entity {
        EntityType::Line(l) => {
            point_segment_distance(
                p,
                Point2::new(l.start.x, l.start.y),
                Point2::new(l.end.x, l.end.y),
            ) <= tol
        }
        EntityType::Arc(a) => {
            let r = Point2::new(a.center.x, a.center.y).distance(p);
            let ang = (p.y - a.center.y).atan2(p.x - a.center.x);
            let sweep = (a.end_angle - a.start_angle).rem_euclid(std::f64::consts::TAU);
            let along = (ang - a.start_angle).rem_euclid(std::f64::consts::TAU) <= sweep;
            along && (r - a.radius).abs() <= tol
        }
        EntityType::LwPolyline(poly) => {
            let vs = &poly.vertices;
            let mut hit = vs.windows(2).any(|w| {
                hit_bulge_segment(
                    p,
                    tol,
                    Point2::new(w[0].location.x, w[0].location.y),
                    Point2::new(w[1].location.x, w[1].location.y),
                    w[0].bulge,
                )
            });
            if poly.is_closed && vs.len() > 2 {
                let a = vs[vs.len() - 1];
                let b = vs[0];
                hit |= hit_bulge_segment(
                    p,
                    tol,
                    Point2::new(a.location.x, a.location.y),
                    Point2::new(b.location.x, b.location.y),
                    a.bulge,
                );
            }
            hit
        }
        _ => false,
    }
}

fn hit_bulge_segment(p: Point2, tol: f64, a: Point2, b: Point2, bulge: f64) -> bool {
    if bulge.abs() < 1e-10 {
        return point_segment_distance(p, a, b) <= tol;
    }
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let chord = dx.hypot(dy);
    if chord == 0.0 {
        return p.distance(a) <= tol;
    }
    let sweep = 4.0 * bulge.atan();
    let radius = chord / (2.0 * (sweep.abs() / 2.0).sin());
    let offset = chord / (2.0 * (sweep / 2.0).tan());
    let cx = (a.x + b.x) / 2.0 - dy / chord * offset;
    let cy = (a.y + b.y) / 2.0 + dx / chord * offset;
    let angle = (p.y - cy).atan2(p.x - cx);
    let start = (a.y - cy).atan2(a.x - cx);
    let delta = if sweep >= 0.0 {
        (angle - start).rem_euclid(std::f64::consts::TAU)
    } else {
        (start - angle).rem_euclid(std::f64::consts::TAU)
    };
    delta <= sweep.abs() && (Point2::new(cx, cy).distance(p) - radius).abs() <= tol
}

#[derive(Clone, Copy)]
enum SnapKind {
    Endpoint,
    Midpoint,
    Center,
    Intersection,
}

#[derive(Clone, Copy)]
struct SnapPoint {
    point: Point2,
    kind: SnapKind,
}

#[derive(Default)]
struct SnapCache {
    document_id: Option<u64>,
    revision: Option<u64>,
    points: Vec<SnapPoint>,
    lines: Vec<(Point2, Point2)>,
}

fn ensure_snap_cache(document: &DrawingDocument, cache: &mut SnapCache) {
    let revision = document.state_id();
    if cache.document_id == Some(document.id()) && cache.revision == Some(revision) {
        return;
    }
    let hidden = document
        .layers()
        .filter(|(_, f, o, _)| *f || *o)
        .map(|(n, _, _, _)| n.to_ascii_lowercase())
        .collect::<HashSet<_>>();
    let mut points = Vec::new();
    let mut lines = Vec::new();
    let mut add = |point, kind| points.push(SnapPoint { point, kind });
    for entity in document.model_space_entities() {
        if hidden.contains(&entity.common().layer.to_ascii_lowercase()) {
            continue;
        }
        match entity {
            EntityType::Line(line) => {
                let a = Point2::new(line.start.x, line.start.y);
                let b = Point2::new(line.end.x, line.end.y);
                add(a, SnapKind::Endpoint);
                add(b, SnapKind::Endpoint);
                add(
                    Point2::new((a.x + b.x) * 0.5, (a.y + b.y) * 0.5),
                    SnapKind::Midpoint,
                );
                lines.push((a, b));
            }
            EntityType::Arc(arc) => {
                let c = Point2::new(arc.center.x, arc.center.y);
                let sweep = (arc.end_angle - arc.start_angle).rem_euclid(std::f64::consts::TAU);
                let at = |angle: f64| {
                    Point2::new(
                        c.x + arc.radius * angle.cos(),
                        c.y + arc.radius * angle.sin(),
                    )
                };
                add(c, SnapKind::Center);
                add(at(arc.start_angle), SnapKind::Endpoint);
                add(at(arc.end_angle), SnapKind::Endpoint);
                add(at(arc.start_angle + sweep * 0.5), SnapKind::Midpoint);
            }
            EntityType::LwPolyline(poly) => {
                let vertices = &poly.vertices;
                for vertex in vertices {
                    add(
                        Point2::new(vertex.location.x, vertex.location.y),
                        SnapKind::Endpoint,
                    );
                }
                let segments = vertices.windows(2).map(|w| (w[0], w[1])).chain(
                    if poly.is_closed && vertices.len() > 2 {
                        Some((vertices[vertices.len() - 1], vertices[0]))
                    } else {
                        None
                    },
                );
                for (v1, v2) in segments {
                    let a = Point2::new(v1.location.x, v1.location.y);
                    let b = Point2::new(v2.location.x, v2.location.y);
                    if let Some((center, radius, start, sweep)) = bulge_geometry(a, b, v1.bulge) {
                        add(center, SnapKind::Center);
                        add(
                            Point2::new(
                                center.x + radius * (start + sweep * 0.5).cos(),
                                center.y + radius * (start + sweep * 0.5).sin(),
                            ),
                            SnapKind::Midpoint,
                        );
                    } else {
                        add(
                            Point2::new((a.x + b.x) * 0.5, (a.y + b.y) * 0.5),
                            SnapKind::Midpoint,
                        );
                    }
                }
            }
            _ => {}
        }
    }
    points.sort_by(|a, b| a.point.x.total_cmp(&b.point.x));
    cache.document_id = Some(document.id());
    cache.revision = Some(revision);
    cache.points = points;
    cache.lines = lines;
}

fn nearest_snap(cache: &SnapCache, cursor: Point2, tolerance: f64) -> Option<SnapPoint> {
    let mut best: Option<(f64, SnapPoint)> = None;
    let consider = |best: &mut Option<(f64, SnapPoint)>, point: Point2, kind: SnapKind| {
        let distance = cursor.distance(point);
        if distance <= tolerance && best.as_ref().is_none_or(|(prior, _)| distance < *prior) {
            *best = Some((distance, SnapPoint { point, kind }));
        }
    };
    let first = cache
        .points
        .partition_point(|snap| snap.point.x < cursor.x - tolerance);
    for snap in cache.points[first..]
        .iter()
        .take_while(|snap| snap.point.x <= cursor.x + tolerance)
    {
        consider(&mut best, snap.point, snap.kind);
    }
    let nearby = cache
        .lines
        .iter()
        .copied()
        .filter(|(a, b)| {
            cursor.x >= a.x.min(b.x) - tolerance
                && cursor.x <= a.x.max(b.x) + tolerance
                && cursor.y >= a.y.min(b.y) - tolerance
                && cursor.y <= a.y.max(b.y) + tolerance
        })
        .take(257)
        .collect::<Vec<_>>();
    if nearby.len() <= 256 {
        for i in 0..nearby.len() {
            for j in i + 1..nearby.len() {
                if let Some(point) =
                    segment_intersection(nearby[i].0, nearby[i].1, nearby[j].0, nearby[j].1)
                {
                    consider(&mut best, point, SnapKind::Intersection);
                }
            }
        }
    }
    best.map(|(_, snap)| snap)
}

fn segment_intersection(a: Point2, b: Point2, c: Point2, d: Point2) -> Option<Point2> {
    let rx = b.x - a.x;
    let ry = b.y - a.y;
    let sx = d.x - c.x;
    let sy = d.y - c.y;
    let denominator = rx * sy - ry * sx;
    if denominator.abs() < 1e-14 {
        return None;
    }
    let qx = c.x - a.x;
    let qy = c.y - a.y;
    let t = (qx * sy - qy * sx) / denominator;
    let u = (qx * ry - qy * rx) / denominator;
    ((0.0..=1.0).contains(&t) && (0.0..=1.0).contains(&u))
        .then_some(Point2::new(a.x + t * rx, a.y + t * ry))
}

fn bulge_geometry(a: Point2, b: Point2, bulge: f64) -> Option<(Point2, f64, f64, f64)> {
    if bulge.abs() < 1e-10 {
        return None;
    }
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let chord = dx.hypot(dy);
    if chord == 0.0 {
        return None;
    }
    let sweep = 4.0 * bulge.atan();
    let radius = chord / (2.0 * (sweep.abs() / 2.0).sin());
    let offset = chord / (2.0 * (sweep / 2.0).tan());
    let center = Point2::new(
        (a.x + b.x) * 0.5 - dy / chord * offset,
        (a.y + b.y) * 0.5 + dx / chord * offset,
    );
    Some((
        center,
        radius,
        (a.y - center.y).atan2(a.x - center.x),
        sweep,
    ))
}

fn split_bulge_segment(a: Point2, b: Point2, bulge: f64) -> Option<(Point2, f64)> {
    if !a.x.is_finite() || !a.y.is_finite() || !b.x.is_finite() || !b.y.is_finite() || a == b {
        return None;
    }
    if bulge.abs() < 1e-10 {
        return Some((Point2::new((a.x + b.x) * 0.5, (a.y + b.y) * 0.5), 0.0));
    }
    let (center, radius, start, sweep) = bulge_geometry(a, b, bulge)?;
    let angle = start + sweep * 0.5;
    Some((
        Point2::new(
            center.x + radius * angle.cos(),
            center.y + radius * angle.sin(),
        ),
        (sweep * 0.25).tan(),
    ))
}

fn draw_snap_marker(painter: &egui::Painter, pos: Pos2, kind: SnapKind) {
    let color = Color32::from_rgb(255, 211, 82);
    let stroke = Stroke::new(1.6, color);
    match kind {
        SnapKind::Endpoint => {
            painter.rect_stroke(
                Rect::from_center_size(pos, Vec2::splat(9.0)),
                0.0,
                stroke,
                egui::StrokeKind::Middle,
            );
        }
        SnapKind::Midpoint => {
            painter.add(egui::Shape::convex_polygon(
                vec![
                    pos + Vec2::new(0.0, -6.0),
                    pos + Vec2::new(6.0, 5.0),
                    pos + Vec2::new(-6.0, 5.0),
                ],
                Color32::TRANSPARENT,
                stroke,
            ));
        }
        SnapKind::Center => {
            painter.circle_stroke(pos, 5.0, stroke);
        }
        SnapKind::Intersection => {
            painter.line_segment(
                [pos + Vec2::new(-5.0, -5.0), pos + Vec2::new(5.0, 5.0)],
                stroke,
            );
            painter.line_segment(
                [pos + Vec2::new(-5.0, 5.0), pos + Vec2::new(5.0, -5.0)],
                stroke,
            );
        }
    }
}

fn point_segment_distance(p: Point2, a: Point2, b: Point2) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let d = dx * dx + dy * dy;
    if d == 0.0 {
        return p.distance(a);
    }
    let t = (((p.x - a.x) * dx + (p.y - a.y) * dy) / d).clamp(0.0, 1.0);
    p.distance(Point2::new(a.x + t * dx, a.y + t * dy))
}

fn world_to_screen(point: Point2, rect: Rect, zoom: f32, center: Point2) -> Pos2 {
    Pos2::new(
        rect.center().x + ((point.x - center.x) as f32 * zoom),
        rect.center().y - ((point.y - center.y) as f32 * zoom),
    )
}

fn screen_to_world(point: Pos2, rect: Rect, zoom: f32, center: Point2) -> Point2 {
    Point2::new(
        center.x + f64::from((point.x - rect.center().x) / zoom),
        center.y - f64::from((point.y - rect.center().y) / zoom),
    )
}

fn ribbon_group(ui: &mut egui::Ui, title: &str, contents: impl FnOnce(&mut egui::Ui)) {
    egui::Frame::new()
        .fill(Color32::from_rgb(48, 53, 60))
        .stroke(Stroke::new(1.0, Color32::from_rgb(62, 69, 77)))
        .corner_radius(egui::CornerRadius::same(4))
        .inner_margin(egui::Margin::symmetric(8, 5))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal(contents);
                ui.add_space(2.0);
                ui.label(egui::RichText::new(title).small().color(MUTED));
            });
        });
}

fn tool_button(ui: &mut egui::Ui, label: &str, selected: bool, action: impl FnOnce()) {
    let response = ui.add(
        egui::Button::new(label)
            .min_size(Vec2::new(72.0, 34.0))
            .fill(if selected {
                Color32::from_rgb(55, 98, 112)
            } else {
                PANEL_BG
            }),
    );
    if response.clicked() {
        action();
    }
}

fn panel_heading(ui: &mut egui::Ui, title: &str) {
    ui.label(egui::RichText::new(title).small().strong().color(MUTED));
}

fn property_row(ui: &mut egui::Ui, name: &str, value: &str) {
    ui.horizontal(|ui| {
        ui.label(egui::RichText::new(name).small().color(MUTED));
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            ui.label(egui::RichText::new(value).small().color(TEXT));
        });
    });
}

fn apply_theme(context: &egui::Context) {
    let mut visuals = egui::Visuals::dark();
    visuals.panel_fill = APP_BG;
    visuals.window_fill = PANEL_BG;
    visuals.extreme_bg_color = Color32::from_rgb(22, 25, 29);
    visuals.faint_bg_color = Color32::from_rgb(45, 50, 57);
    visuals.selection.bg_fill = Color32::from_rgb(48, 119, 139);
    visuals.selection.stroke = Stroke::new(1.0, Color32::from_rgb(117, 205, 223));
    visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, TEXT);
    visuals.widgets.inactive.bg_fill = Color32::from_rgb(52, 58, 66);
    visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT);
    visuals.widgets.hovered.bg_fill = Color32::from_rgb(66, 76, 86);
    visuals.widgets.hovered.fg_stroke = Stroke::new(1.0, Color32::WHITE);
    visuals.widgets.active.bg_fill = ACCENT;
    visuals.widgets.active.fg_stroke = Stroke::new(1.0, Color32::BLACK);
    context.set_visuals(visuals);
    context.style_mut_of(egui::Theme::Dark, |style| {
        style.spacing.item_spacing = Vec2::new(6.0, 5.0);
        style.visuals.window_corner_radius = egui::CornerRadius::same(5);
    });
}
