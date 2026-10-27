# CONCOSTCAD

New Rust desktop CAD application for Windows, targeting DWG/DXF open-edit-save, a CAD ribbon/panel workspace, and 2D LINE, ARC, and Polyline workflows.

## Run

```powershell
cargo run
```

## Current build status

The current shell uses `eframe`/`egui` with dockable workspace panes. It has an in-memory drawing model backed by `acadrust`, file dialogs for DWG/DXF, save, create LINE/three-point ARC/Polyline, display LINE/ARC/LWPOLYLINE. PLINE accepts a bulge suffix on a typed vertex (`x,y,b=0.4142` or `x,y,b=-0.4142`) to curve the segment from the previous vertex into that point; interactive bulge magnitude is capped at `1000000`; `CLOSE,b=value` applies a bulge to the closing segment, and early point/window/crossing selection and grouped Move/Erase/Undo/Redo workflows. LINE, ARC, Polyline and Move show live previews before confirmation. Object snaps for visible endpoints, midpoints, arc/polyline-arc centers and LINE intersections can be toggled with F3. Ortho mode (F8) constrains LINE/Polyline/Move to horizontal or vertical. While a drawing command is active, the command line accepts absolute `x,y`, relative `@dx,dy`, and polar `@distance<angle` points. The Properties pane edits LINE endpoints, ARC center/radius/angles, and LWPOLYLINE vertices/bulges/closed state, including vertex insertion/removal, with one Apply per undo step. The Layers pane lists, creates and renames layers, sets the current layer, changes frozen/off/locked flags, filters frozen/off entities from canvas display, assigns new and selected entities to layers, and prevents edits on locked/off/frozen layers. Layer deletion and layer appearance controls remain unimplemented. Other entity types are retained in the drawing model but are not displayed or editable yet.

Build check: `cargo check` succeeds for the host and Windows MSVC target. Open and Save run on worker threads. Save writes a staging file, reopens it, compares entity-type counts, and refuses to replace the target if that check fails or a detected Unknown entity lacks raw data for the output format. Replacing an existing file uses Windows `ReplaceFileW`; creating a new file uses `MoveFileExW` with write-through. This guards the file replacement step; it does not prove geometry/metadata fidelity or storage-device durability. File compatibility has not been validated against a real customer DWG/DXF set or round-tripped through a reference CAD application. Shortcuts: Ctrl+O, Ctrl+S, Ctrl+Z, Ctrl+Y. See [the status matrix](docs/STATUS_MATRIX.md) and [the Rust development plan](docs/RUST_DEVELOPMENT_PLAN.md).
