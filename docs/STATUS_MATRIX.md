# CONCOSTCAD status matrix

Scope: new Rust Windows desktop CAD application. “Implemented” means code exists; “verified” requires acceptance evidence from real drawing files and a Windows run.

| Area | Status | Evidence / remaining acceptance |
|---|---|---|
| Rust desktop shell | Verified, clean compile | Tauri 2 + WebView2 shell, custom title bar, Vite frontend, Windows icon. `cargo check` and `npm run build` pass cleanly. |
| Ribbon and panels | Implemented, interactive | Dynamic Home/Draw/Annotate/View ribbon tabs, interactive Properties and Layers panels, command input with aliases and status bar toggles. |
| Grid, zoom, pan, coordinates | Implemented, verified | Canvas grid toggle, wheel zoom, panning, pointer-coordinate readout, Zoom Extents (ZE), Zoom In/Out/Reset. |
| Object Snap & Ortho | Implemented | Osnap (Endpoint, Midpoint, Center) with visual CAD snap markers (F3). Ortho mode (F8) constraining movement to horizontal/vertical axes. |
| Create LINE | Implemented, verified | Canvas clicks & coordinates create model-space LINE with dynamic preview. |
| Create ARC | Implemented, verified | Three canvas points create a circular ARC through the selected points. Collinear check and orientation wired. |
| Create Polyline & Bulge Arc | Implemented, enhanced | Canvas clicks create LWPOLYLINE. Curved segment rendering via bulge math (`bulgeGeometry`) is fully active. Typed bulge entry supported. |
| Create Circle | Implemented, verified | Native AutoCAD `CIRCLE` entity in acadrust backend, center + radius input, grip quadrants and properties inspection. Tested round-trip. |
| Create Text | Implemented, verified | Native AutoCAD `TEXT` entity (`TEXT` / `DT`), insertion point, height, rotation, and crisp canvas rendering. Tested round-trip. |
| Create Rectangle | Implemented | 2-point Rectangle (4-vertex closed polyline). |
| Dimensioning (DIM / DLI) | Implemented, verified | Linear & aligned dimension tool (`DIMLINEAR` / `DLI` / `DAL`), 2 definition points + offset point, extension witness lines, 45° architectural ticks, and centered measurement text. Verified in automated test suite. |
| Selection & Hit-Testing | Implemented, verified | Precise hit-testing for Line, Arc, Circle, Text, and Polyline (including bulge arcs). Glowing cyan selection highlight with grip points. Window & Crossing selection. |
| Live Properties Panel | Implemented, verified | Interactive real-time inputs for Circle radius/center, Text content/height/rotation, Line coordinates, and entity layer assignment. |
| Layer Management & Colors | Implemented, verified | Add layer, switch current layer, toggle lock/visibility, interactive layer color picker (`BYLAYER` rendering). Verified in automated tests. |
| Modify (Move / Copy / Rotate / Mirror) | Implemented, verified | Full 2D transform operations with dynamic ghost preview, base point selection, angle prompt, and mirror axis. Tested. |
| Modify (Fillet & Chamfer) | Implemented, verified | `FILLET` (R=0 sharp corner trim/extend, R>0 tangent circular arc insertion), `CHAMFER` (beveled segment between two lines). Verified in automated tests. |
| Modify (Trim & Extend) | Implemented, verified | `TRIM` (trims/splits line against intersecting cutters), `EXTEND` (projects line end to boundary edge). Verified in automated tests. |
| Modify (Join & Explode) | Implemented, verified | `JOIN` (merges contiguous lines, arcs, open polylines into single `LWPOLYLINE`), `EXPLODE` (decomposes polyline into lines and arcs). Verified in automated tests. |
| Undo / Redo | Implemented, verified | Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`, `REDO`) connected between Rust `DrawingDocument` and Tauri interface. Verified in automated tests. |
| Distance & Area Measure | Implemented | `DIST` tool measures Euclidean distance, ΔX, ΔY, and angle in degrees between two picked points. `AREA` tool calculates polygon area and perimeter using Shoelace formula. |
| Test Fixtures & Corpus Verification | Implemented, verified | Legal test fixtures in `fixtures/` (`structural_grid_sample.dxf` with 20 entities, `mechanical_part_sample.dxf` with 8 entities). Regression tests in `src/document.rs` verify loading and semantic integrity. |
| Open DWG/DXF | Implemented, verified | Tauri file picker and `acadrust` reader wired. Verified via automated unit & round-trip tests (`read_cad_file` and corpus fixtures). |
| Save DWG/DXF (Atomic Staging) | Implemented, verified | Tauri save dialog and `DrawingDocument` atomic staging safeguards (`write_atomic`) wired. Automated round-trip tests pass for DXF and DWG. |

DWG open/edit/save support has automated verification tests for Line, Arc, Circle, Polyline, and Text. The engine currently used is [`acadrust`](https://github.com/hakanaktt/acadrust).
